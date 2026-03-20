// ============================================================
//  SDUCS – MK  |  AI Routes (Gemini / OpenAI)
// ============================================================
const express = require("express");
const router = express.Router();
const { GoogleGenerativeAI } = require("@google/generative-ai");
const { authenticate } = require("../middleware/auth");
const File = require("../models/File");
const User = require("../models/User");

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// ── POST /api/ai/categorize-file ──────────────────────────────
router.post("/categorize-file", authenticate, async (req, res) => {
  try {
    const { fileId } = req.body;
    const file = await File.findOne({ _id: fileId, ownerId: req.user.uid });
    if (!file) return res.status(404).json({ error: "File not found." });

    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
    const prompt = `
Analyze this file metadata and provide smart categorization:
- Filename: ${file.originalName}
- MIME type: ${file.mimeType}
- Size: ${(file.sizeBytes / 1024 / 1024).toFixed(2)} MB
- Category: ${file.category}
- Created: ${file.createdAt}
- Access count: ${file.accessCount}
- Last accessed: ${file.lastAccessedAt || "Never"}

Provide:
1. Suggested tags (5-8 keywords)
2. A brief AI description (1-2 sentences)
3. Whether this file is likely unused/safe to delete
4. Storage optimization suggestion

Respond ONLY in this exact JSON format:
{
  "tags": ["tag1", "tag2"],
  "description": "brief description",
  "isLikelyUnused": true/false,
  "optimizationTip": "suggestion text"
}`;

    const result = await model.generateContent(prompt);
    const text = result.response.text();
    const clean = text.replace(/```json|```/g, "").trim();
    const parsed = JSON.parse(clean);

    // Save AI metadata
    file.aiTags = parsed.tags;
    file.aiDescription = parsed.description;
    await file.save();

    res.json({
      fileId,
      ...parsed,
    });
  } catch (err) {
    console.error("AI categorize error:", err);
    res.status(500).json({ error: "AI categorization failed." });
  }
});

// ── POST /api/ai/storage-optimization ────────────────────────
router.post("/storage-optimization", authenticate, async (req, res) => {
  try {
    const [files, user] = await Promise.all([
      File.find({ ownerId: req.user.uid, isDeleted: false })
        .select("originalName sizeBytes category lastAccessedAt accessCount createdAt aiTags")
        .sort({ lastAccessedAt: 1 })
        .limit(50),
      User.findOne({ uid: req.user.uid }),
    ]);

    const storagePercent = user.getStoragePercent();
    const filesSummary = files.map(f => ({
      name: f.originalName,
      size: f.sizeBytes,
      category: f.category,
      lastAccessed: f.lastAccessedAt,
      accessCount: f.accessCount,
      ageMs: Date.now() - f.createdAt.getTime(),
    }));

    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
    const prompt = `
You are a storage optimization assistant for SDUCS-MK cloud storage app.

Storage usage: ${storagePercent}% of ${(user.cloudStorage.totalBytes / 1024 / 1024 / 1024).toFixed(1)} GB used.
Total files: ${files.length}

File analysis data:
${JSON.stringify(filesSummary.slice(0, 20), null, 2)}

Provide smart storage optimization recommendations.
Respond ONLY in this JSON format:
{
  "summary": "2 sentence summary of storage health",
  "recommendations": [
    {
      "priority": "high/medium/low",
      "type": "delete_duplicates/cleanup_old/compress/organize",
      "title": "short title",
      "description": "what to do",
      "estimatedSavingsMB": 0
    }
  ],
  "cleanupCandidates": ["filename1", "filename2"],
  "storageScore": 0
}`;

    const result = await model.generateContent(prompt);
    const text = result.response.text();
    const clean = text.replace(/```json|```/g, "").trim();
    const data = JSON.parse(clean);

    res.json(data);
  } catch (err) {
    console.error("AI optimization error:", err);
    res.status(500).json({ error: "AI optimization failed." });
  }
});

// ── POST /api/ai/smart-duplicate-detect ──────────────────────
router.post("/smart-duplicate-detect", authenticate, async (req, res) => {
  try {
    // Hash-based duplicates (exact)
    const exactDuplicates = await File.findDuplicates(req.user.uid);

    // Near-duplicate detection by name similarity (AI-assisted)
    const files = await File.find({ ownerId: req.user.uid, isDeleted: false })
      .select("originalName sizeBytes category fileHash")
      .limit(200);

    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
    const prompt = `
Analyze these filenames for near-duplicates (same content, different names like "photo.jpg" and "photo (1).jpg"):
${files.map(f => `${f._id}:${f.originalName}:${f.sizeBytes}`).join("\n")}

Respond ONLY in JSON:
{
  "nearDuplicateGroups": [
    {
      "confidence": "high/medium",
      "reason": "explanation",
      "fileIds": ["id1", "id2"]
    }
  ]
}`;

    const result = await model.generateContent(prompt);
    const text = result.response.text();
    const clean = text.replace(/```json|```/g, "").trim();
    const aiResult = JSON.parse(clean);

    res.json({
      exactDuplicates: exactDuplicates.length,
      exactGroups: exactDuplicates,
      nearDuplicateGroups: aiResult.nearDuplicateGroups || [],
    });
  } catch (err) {
    console.error("Smart duplicate detect error:", err);
    res.status(500).json({ error: "Duplicate detection failed." });
  }
});

// ── POST /api/ai/chat ─────────────────────────────────────────
// General-purpose AI assistant for file management queries
router.post("/chat", authenticate, async (req, res) => {
  try {
    const { message } = req.body;
    if (!message) return res.status(400).json({ error: "Message required." });

    const user = await User.findOne({ uid: req.user.uid });
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

    const context = `
You are SDUCS-MK's AI assistant. Help users manage their cloud storage.
User storage: ${user.getStoragePercent()}% used.
Download data: ${user.getDownloadPercent()}% used.
Keep responses concise (under 150 words). Be helpful, friendly, and practical.`;

    const result = await model.generateContent(`${context}\n\nUser: ${message}`);
    const reply = result.response.text();

    res.json({ reply });
  } catch (err) {
    console.error("AI chat error:", err);
    res.status(500).json({ error: "AI chat failed." });
  }
});

module.exports = router;
