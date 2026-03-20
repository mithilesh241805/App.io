// ============================================================
//  SDUCS – MK  |  Download Manager Routes
// ============================================================
const express = require("express");
const router = express.Router();
const axios = require("axios");
const { authenticate } = require("../middleware/auth");
const DownloadJob = require("../models/DownloadJob");
const User = require("../models/User");
const File = require("../models/File");
const { uploadToStorage } = require("../utils/storage");
const { encryptBuffer, hashBuffer } = require("../utils/encryption");
const { v4: uuidv4 } = require("uuid");

// MIME type → category/icon mapping
const MIME_META = {
  "video/mp4": { cat:"video", icon:"🎬", quality:true },
  "video/webm":{ cat:"video", icon:"🎬", quality:true },
  "video/x-matroska": { cat:"video", icon:"🎬", quality:true },
  "audio/mpeg":{ cat:"audio", icon:"🎵", quality:true },
  "audio/wav": { cat:"audio", icon:"🎵", quality:false },
  "image/jpeg":{ cat:"image", icon:"🖼️", quality:false },
  "image/png": { cat:"image", icon:"🖼️", quality:false },
  "application/pdf": { cat:"document", icon:"📄", quality:false },
  "application/zip": { cat:"archive", icon:"📦", quality:false },
};

function detectMimeFromURL(url) {
  const ext = url.split("?")[0].split(".").pop()?.toLowerCase();
  const extMap = {
    mp4:"video/mp4", webm:"video/webm", mkv:"video/x-matroska",
    mp3:"audio/mpeg", wav:"audio/wav",
    jpg:"image/jpeg", jpeg:"image/jpeg", png:"image/png", gif:"image/gif",
    pdf:"application/pdf", zip:"application/zip", rar:"application/x-rar",
    doc:"application/msword", docx:"application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    txt:"text/plain",
  };
  return extMap[ext] || "application/octet-stream";
}

// ── POST /api/downloads/detect ────────────────────────────────
router.post("/detect", authenticate, async (req, res) => {
  try {
    const { url } = req.body;
    if (!url || !url.startsWith("http")) {
      return res.status(400).json({ error: "Invalid URL. Only direct HTTP/HTTPS links are accepted." });
    }

    // HEAD request to get metadata without downloading
    let mimeType = detectMimeFromURL(url);
    let estimatedSize = 0;
    let fileName = url.split("/").pop()?.split("?")[0] || "download";

    try {
      const headRes = await axios.head(url, { timeout: 10000, maxRedirects: 5 });
      mimeType = headRes.headers["content-type"]?.split(";")[0] || mimeType;
      estimatedSize = parseInt(headRes.headers["content-length"] || "0");
      const disposition = headRes.headers["content-disposition"];
      if (disposition) {
        const match = disposition.match(/filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/);
        if (match) fileName = match[1].replace(/['"]/g, "");
      }
    } catch (headErr) {
      // HEAD not supported by server — use URL-based detection only
    }

    const meta = MIME_META[mimeType] || { cat:"other", icon:"📁", quality:false };

    res.json({
      url,
      fileName,
      mimeType,
      estimatedSize,
      category: meta.cat,
      icon: meta.icon,
      hasQualityOptions: meta.quality,
    });
  } catch (err) {
    console.error("Detect error:", err);
    res.status(400).json({ error: "Could not detect file. Ensure the URL is a direct download link." });
  }
});

// ── POST /api/downloads/start ─────────────────────────────────
router.post("/start", authenticate, async (req, res) => {
  try {
    const { url, quality = "best" } = req.body;
    if (!url) return res.status(400).json({ error: "URL required." });

    const user = await User.findOne({ uid: req.user.uid });

    // First detect size
    let estimatedSize = 0;
    let mimeType = detectMimeFromURL(url);
    let fileName = url.split("/").pop()?.split("?")[0] || "download";

    try {
      const headRes = await axios.head(url, { timeout: 8000 });
      estimatedSize = parseInt(headRes.headers["content-length"] || "0");
      mimeType = headRes.headers["content-type"]?.split(";")[0] || mimeType;
    } catch {}

    // Check download data quota
    const available = user.downloadData.totalBytes - user.downloadData.usedBytes;
    if (estimatedSize > 0 && estimatedSize > available) {
      return res.status(402).json({
        error: "Insufficient download data. Please upgrade your plan.",
        available,
        required: estimatedSize,
      });
    }

    // Create job record
    const job = await DownloadJob.create({
      userId: req.user.uid,
      url,
      fileName,
      mimeType,
      estimatedSizeBytes: estimatedSize,
      quality,
      status: "queued",
    });

    // Fire and forget — process download async
    processDownload(job._id, user, url, mimeType, fileName);

    res.status(201).json({ jobId: job._id, message: "Download queued." });
  } catch (err) {
    console.error("Start download error:", err);
    res.status(500).json({ error: "Failed to start download." });
  }
});

// ── GET /api/downloads ────────────────────────────────────────
router.get("/", authenticate, async (req, res) => {
  try {
    const jobs = await DownloadJob.find({ userId: req.user.uid })
      .sort({ createdAt: -1 })
      .limit(30)
      .select("-storageKey");
    res.json({ jobs });
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch download history." });
  }
});

// ── GET /api/downloads/:id ────────────────────────────────────
router.get("/:id", authenticate, async (req, res) => {
  try {
    const job = await DownloadJob.findOne({ _id: req.params.id, userId: req.user.uid });
    if (!job) return res.status(404).json({ error: "Job not found." });
    res.json(job);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch job." });
  }
});

// ── DELETE /api/downloads/:id ─────────────────────────────────
router.delete("/:id", authenticate, async (req, res) => {
  try {
    const job = await DownloadJob.findOne({ _id: req.params.id, userId: req.user.uid });
    if (!job) return res.status(404).json({ error: "Job not found." });
    if (job.status === "downloading") {
      job.status = "cancelled";
      await job.save();
    } else {
      await job.deleteOne();
    }
    res.json({ message: "Download removed." });
  } catch (err) {
    res.status(500).json({ error: "Failed to remove download." });
  }
});

// ── Async download processor ──────────────────────────────────
async function processDownload(jobId, user, url, mimeType, fileName) {
  try {
    await DownloadJob.findByIdAndUpdate(jobId, { status: "downloading", startedAt: new Date() });

    // Stream download
    const response = await axios.get(url, {
      responseType: "arraybuffer",
      timeout: 5 * 60 * 1000, // 5 min timeout
      onDownloadProgress: async (progressEvent) => {
        const percent = Math.round((progressEvent.loaded / (progressEvent.total || 1)) * 100);
        await DownloadJob.findByIdAndUpdate(jobId, {
          progressBytes: progressEvent.loaded,
          progressPercent: percent,
          sizeBytes: progressEvent.total || progressEvent.loaded,
        });
      },
    });

    const buffer = Buffer.from(response.data);
    const actualSize = buffer.length;

    // Check data quota again with actual size
    const freshUser = await User.findOne({ uid: user.uid });
    const available = freshUser.downloadData.totalBytes - freshUser.downloadData.usedBytes;
    if (actualSize > available) {
      await DownloadJob.findByIdAndUpdate(jobId, { status: "failed", errorMessage: "Insufficient download data." });
      return;
    }

    // Encrypt & upload to cloud
    const fileId = uuidv4();
    const { encryptedBuffer, iv } = encryptBuffer(buffer, process.env.ENCRYPTION_MASTER_KEY, fileId);
    const ext = fileName.split(".").pop()?.toLowerCase() || "bin";
    const storageKey = `${user.uid}/${fileId}.enc`;

    await uploadToStorage(encryptedBuffer, storageKey, "application/octet-stream");

    // Save file record
    const fileHash = hashBuffer(buffer);
    const category = mimeType.startsWith("video/") ? "video" :
                     mimeType.startsWith("audio/") ? "audio" :
                     mimeType.startsWith("image/") ? "image" : "other";

    const fileRecord = await File.create({
      ownerId: user.uid, ownerEmail: user.email,
      originalName: fileName, storedName: storageKey,
      mimeType, sizeBytes: actualSize, extension: ext, category,
      storageKey, isEncrypted: true, encryptionIV: iv, fileHash,
    });

    // Deduct data usage & update storage
    await User.findOneAndUpdate(
      { uid: user.uid },
      {
        $inc: {
          "downloadData.usedBytes": actualSize,
          "cloudStorage.usedBytes": actualSize,
        },
      }
    );

    await DownloadJob.findByIdAndUpdate(jobId, {
      status: "completed",
      sizeBytes: actualSize,
      progressPercent: 100,
      storageKey,
      completedAt: new Date(),
      fileId: fileRecord._id,
    });

    console.log(`✅ Download ${jobId} completed: ${actualSize} bytes`);
  } catch (err) {
    console.error("Download process error:", err.message);
    await DownloadJob.findByIdAndUpdate(jobId, {
      status: "failed",
      errorMessage: err.message,
    });
  }
}

module.exports = router;
