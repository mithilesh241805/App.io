// ============================================================
//  SDUCS – MK  |  File Routes
// ============================================================
const express = require("express");
const router = express.Router();
const multer = require("multer");
const { authenticate } = require("../middleware/auth");
const File = require("../models/File");
const User = require("../models/User");
const {
  encryptBuffer, decryptBuffer, hashBuffer,
  generateShareToken, generateAccessCode, hashAccessCode, verifyAccessCode,
} = require("../utils/encryption");
const { uploadToStorage, downloadFromStorage, deleteFromStorage } = require("../utils/storage");

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 * 1024 }, // 5 GB max per file
});

function getCategory(mimeType) {
  if (mimeType.startsWith("image/")) return "image";
  if (mimeType.startsWith("video/")) return "video";
  if (mimeType.startsWith("audio/")) return "audio";
  if (mimeType.includes("pdf") || mimeType.includes("document") || mimeType.includes("text")) return "document";
  if (mimeType.includes("zip") || mimeType.includes("archive") || mimeType.includes("rar")) return "archive";
  return "other";
}

// ── POST /api/files/upload ────────────────────────────────────
router.post("/upload", authenticate, upload.single("file"), async (req, res) => {
  try {
    const file = req.file;
    if (!file) return res.status(400).json({ error: "No file provided." });

    const user = await User.findOne({ uid: req.user.uid });

    // ── Check storage quota ──────────────────────────────────
    const available = user.cloudStorage.totalBytes - user.cloudStorage.usedBytes;
    if (file.size > available) {
      return res.status(413).json({
        error: "Insufficient storage space.",
        available,
        required: file.size,
      });
    }

    // ── Hash for duplicate detection ─────────────────────────
    const fileHash = hashBuffer(file.buffer);

    // ── Check for exact duplicate ────────────────────────────
    const existing = await File.findOne({ ownerId: req.user.uid, fileHash, isDeleted: false });
    if (existing) {
      return res.status(409).json({
        error: "Duplicate file detected.",
        duplicate: true,
        existingFileId: existing._id,
        existingFileName: existing.originalName,
      });
    }

    // ── Encrypt ──────────────────────────────────────────────
    const fileId = require("uuid").v4();
    const { encryptedBuffer, iv } = encryptBuffer(file.buffer, process.env.ENCRYPTION_MASTER_KEY, fileId);

    // ── Upload to storage ────────────────────────────────────
    const ext = file.originalname.split(".").pop()?.toLowerCase();
    const storedName = `${req.user.uid}/${fileId}.enc`;
    const { storageKey, downloadURL } = await uploadToStorage(encryptedBuffer, storedName, "application/octet-stream");

    // ── Save record ───────────────────────────────────────────
    const record = await File.create({
      ownerId: req.user.uid,
      ownerEmail: user.email,
      originalName: file.originalname,
      storedName,
      mimeType: file.mimetype,
      sizeBytes: file.size,
      extension: ext,
      category: getCategory(file.mimetype),
      storageKey,
      downloadURL,
      isEncrypted: true,
      encryptionIV: iv,
      fileHash,
    });

    // ── Update user storage ───────────────────────────────────
    user.cloudStorage.usedBytes += file.size;
    await user.save();

    res.status(201).json({
      message: "File uploaded successfully.",
      file: {
        id: record._id,
        name: record.originalName,
        size: record.sizeBytes,
        category: record.category,
        mimeType: record.mimeType,
        createdAt: record.createdAt,
      },
    });
  } catch (err) {
    console.error("Upload error:", err);
    res.status(500).json({ error: "Upload failed." });
  }
});

// ── GET /api/files ────────────────────────────────────────────
router.get("/", authenticate, async (req, res) => {
  try {
    const { category, page = 1, limit = 50, search, deleted } = req.query;
    const query = { ownerId: req.user.uid, isDeleted: deleted === "true" };
    if (category && category !== "all") query.category = category;
    if (search) query.originalName = { $regex: search, $options: "i" };

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const [files, total] = await Promise.all([
      File.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit))
        .select("-storageKey -encryptionIV -fileHash -accessCodeHash"),
      File.countDocuments(query),
    ]);

    res.json({ files, total, page: parseInt(page), pages: Math.ceil(total / parseInt(limit)) });
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch files." });
  }
});

// ── GET /api/files/:id/download ───────────────────────────────
router.get("/:id/download", authenticate, async (req, res) => {
  try {
    const { code } = req.query;
    const file = await File.findOne({ _id: req.params.id, isDeleted: false });
    if (!file) return res.status(404).json({ error: "File not found." });

    // Check ownership OR valid access code
    if (file.ownerId !== req.user.uid) {
      if (!code || !file.accessCodeHash) return res.status(403).json({ error: "Access denied." });
      if (!verifyAccessCode(code, file.accessCodeHash)) {
        return res.status(403).json({ error: "Invalid access code." });
      }
    }

    // ── Decrypt and stream ────────────────────────────────────
    const encryptedBuffer = await downloadFromStorage(file.storageKey);
    const decrypted = decryptBuffer(encryptedBuffer, process.env.ENCRYPTION_MASTER_KEY, file.storageKey.split("/")[1].replace(".enc", ""));

    file.accessCount += 1;
    file.lastAccessedAt = new Date();
    await file.save();

    res.set("Content-Disposition", `attachment; filename="${file.originalName}"`);
    res.set("Content-Type", file.mimeType);
    res.set("Content-Length", decrypted.length);
    res.send(decrypted);
  } catch (err) {
    console.error("Download error:", err);
    res.status(500).json({ error: "Download failed." });
  }
});

// ── POST /api/files/:id/share ─────────────────────────────────
router.post("/:id/share", authenticate, async (req, res) => {
  try {
    const { expiresIn = 24, generateCode = false } = req.body;
    const file = await File.findOne({ _id: req.params.id, ownerId: req.user.uid, isDeleted: false });
    if (!file) return res.status(404).json({ error: "File not found." });

    const shareToken = generateShareToken();
    file.shareLink = `${process.env.APP_URL}/share/${shareToken}`;
    file.shareLinkExpiresAt = new Date(Date.now() + expiresIn * 60 * 60 * 1000);
    file.isPublic = true;

    let accessCode;
    if (generateCode) {
      accessCode = file.generateShareCode();
    }

    await file.save();

    res.json({
      shareLink: file.shareLink,
      expiresAt: file.shareLinkExpiresAt,
      accessCode: accessCode || null,
    });
  } catch (err) {
    res.status(500).json({ error: "Failed to generate share link." });
  }
});

// ── GET /api/files/duplicates ─────────────────────────────────
router.get("/duplicates", authenticate, async (req, res) => {
  try {
    const groups = await File.findDuplicates(req.user.uid);
    res.json({ groups, count: groups.length });
  } catch (err) {
    res.status(500).json({ error: "Failed to find duplicates." });
  }
});

// ── DELETE /api/files/:id ─────────────────────────────────────
router.delete("/:id", authenticate, async (req, res) => {
  try {
    const { permanent } = req.query;
    const file = await File.findOne({ _id: req.params.id, ownerId: req.user.uid });
    if (!file) return res.status(404).json({ error: "File not found." });

    if (permanent === "true" && file.isDeleted) {
      // Permanently delete
      await deleteFromStorage(file.storageKey);

      const user = await User.findOne({ uid: req.user.uid });
      user.cloudStorage.usedBytes = Math.max(0, user.cloudStorage.usedBytes - file.sizeBytes);
      await user.save();

      await file.deleteOne();
      return res.json({ message: "File permanently deleted." });
    }

    // Move to recycle bin
    file.markForDeletion();
    await file.save();

    res.json({ message: "File moved to recycle bin.", permanentDeleteAt: file.permanentDeleteAt });
  } catch (err) {
    res.status(500).json({ error: "Delete failed." });
  }
});

// ── POST /api/files/:id/restore ───────────────────────────────
router.post("/:id/restore", authenticate, async (req, res) => {
  try {
    const file = await File.findOne({ _id: req.params.id, ownerId: req.user.uid, isDeleted: true });
    if (!file) return res.status(404).json({ error: "File not found in recycle bin." });

    file.isDeleted = false;
    file.deletedAt = undefined;
    file.permanentDeleteAt = undefined;
    await file.save();

    res.json({ message: "File restored successfully." });
  } catch (err) {
    res.status(500).json({ error: "Restore failed." });
  }
});

// ── GET /api/files/stats ──────────────────────────────────────
router.get("/stats", authenticate, async (req, res) => {
  try {
    const [byCategory, user] = await Promise.all([
      File.getStorageByCategory(req.user.uid),
      User.findOne({ uid: req.user.uid }),
    ]);

    res.json({
      storage: {
        used: user.cloudStorage.usedBytes,
        total: user.cloudStorage.totalBytes,
        max: user.cloudStorage.maxCapBytes,
        percent: user.getStoragePercent(),
      },
      byCategory,
      downloadData: {
        used: user.downloadData.usedBytes,
        total: user.downloadData.totalBytes,
        percent: user.getDownloadPercent(),
      },
    });
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch stats." });
  }
});

module.exports = router;
