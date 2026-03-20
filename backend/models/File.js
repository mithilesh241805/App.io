// ============================================================
//  SDUCS – MK  |  File Model
// ============================================================
const mongoose = require("mongoose");
const crypto = require("crypto");

const fileSchema = new mongoose.Schema({
  // ── Ownership ─────────────────────────────────────────────
  ownerId: { type: String, required: true, index: true },
  ownerEmail: { type: String },

  // ── File Info ─────────────────────────────────────────────
  originalName: { type: String, required: true },
  storedName: { type: String, required: true, unique: true },
  mimeType: { type: String, required: true },
  sizeBytes: { type: Number, required: true },
  extension: { type: String },
  category: {
    type: String,
    enum: ["image", "video", "audio", "document", "archive", "other"],
    default: "other",
  },

  // ── Storage ───────────────────────────────────────────────
  storageProvider: { type: String, enum: ["firebase", "s3"], default: "firebase" },
  storageKey: { type: String, required: true },
  downloadURL: { type: String },

  // ── Security ──────────────────────────────────────────────
  isEncrypted: { type: Boolean, default: true },
  encryptionIV: { type: String },
  fileHash: { type: String },              // SHA-256 for duplicate detection
  accessCode: { type: String },            // 6-digit encrypted share code
  accessCodeHash: { type: String },

  // ── Sharing ───────────────────────────────────────────────
  isPublic: { type: Boolean, default: false },
  shareLink: { type: String },
  shareLinkExpiresAt: { type: Date },
  shareDownloadCount: { type: Number, default: 0 },
  shareDownloadLimit: { type: Number, default: 50 },

  // ── Recycle Bin ───────────────────────────────────────────
  isDeleted: { type: Boolean, default: false },
  deletedAt: { type: Date },
  permanentDeleteAt: { type: Date },

  // ── AI Metadata ───────────────────────────────────────────
  aiTags: [{ type: String }],
  aiDescription: { type: String },
  isDuplicate: { type: Boolean, default: false },
  duplicateOf: { type: mongoose.Schema.Types.ObjectId, ref: "File" },
  lastAccessedAt: { type: Date },
  accessCount: { type: Number, default: 0 },
}, {
  timestamps: true,
});

// ── Indexes ───────────────────────────────────────────────────
fileSchema.index({ ownerId: 1, isDeleted: 1 });
fileSchema.index({ fileHash: 1, ownerId: 1 });
fileSchema.index({ shareLink: 1 });
fileSchema.index({ permanentDeleteAt: 1 }, { sparse: true });
fileSchema.index({ category: 1, ownerId: 1 });

// ── Statics ───────────────────────────────────────────────────
fileSchema.statics.findDuplicates = async function (ownerId) {
  const pipeline = [
    { $match: { ownerId, isDeleted: false } },
    { $group: { _id: "$fileHash", count: { $sum: 1 }, files: { $push: "$$ROOT" } } },
    { $match: { count: { $gt: 1 } } },
  ];
  return this.aggregate(pipeline);
};

fileSchema.statics.getStorageByCategory = async function (ownerId) {
  return this.aggregate([
    { $match: { ownerId, isDeleted: false } },
    {
      $group: {
        _id: "$category",
        totalSize: { $sum: "$sizeBytes" },
        count: { $sum: 1 },
      },
    },
  ]);
};

// ── Methods ───────────────────────────────────────────────────
fileSchema.methods.generateShareCode = function () {
  const code = Math.floor(100000 + Math.random() * 900000).toString();
  this.accessCode = code; // Store raw for response (once only)
  this.accessCodeHash = crypto.createHash("sha256").update(code).digest("hex");
  return code;
};

fileSchema.methods.verifyAccessCode = function (code) {
  const hash = crypto.createHash("sha256").update(code).digest("hex");
  return hash === this.accessCodeHash;
};

fileSchema.methods.markForDeletion = function () {
  this.isDeleted = true;
  this.deletedAt = new Date();
  this.permanentDeleteAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days
};

module.exports = mongoose.model("File", fileSchema);
