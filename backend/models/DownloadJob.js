// ============================================================
//  SDUCS – MK  |  DownloadJob Model
// ============================================================
const mongoose = require("mongoose");

const downloadJobSchema = new mongoose.Schema({
  userId: { type: String, required: true, index: true },
  url: { type: String, required: true },
  fileName: { type: String },
  mimeType: { type: String },
  sizeBytes: { type: Number },
  estimatedSizeBytes: { type: Number },
  quality: { type: String, enum: ["best", "1080p", "720p", "480p", "360p", "audio_only", "original"], default: "best" },
  status: {
    type: String,
    enum: ["queued", "detecting", "downloading", "paused", "completed", "failed", "cancelled"],
    default: "queued",
  },
  progressBytes: { type: Number, default: 0 },
  progressPercent: { type: Number, default: 0 },
  speedBps: { type: Number, default: 0 },
  storageKey: { type: String },
  storageProvider: { type: String },
  localPath: { type: String },
  previewUrl: { type: String },
  errorMessage: { type: String },
  retryCount: { type: Number, default: 0 },
  startedAt: { type: Date },
  completedAt: { type: Date },
  fileId: { type: mongoose.Schema.Types.ObjectId, ref: "File" },
}, { timestamps: true });

module.exports = mongoose.model("DownloadJob", downloadJobSchema);
