// ============================================================
//  SDUCS – MK  |  User Model
// ============================================================
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

const subscriptionSchema = new mongoose.Schema({
  plan: { type: String, enum: ["lite", "premium", "pro", "promax", "none"], default: "none" },
  dataGB: { type: Number, default: 0 },
  expiresAt: { type: Date },
  activatedAt: { type: Date },
  transactionId: { type: String },
}, { _id: false });

const storageSchema = new mongoose.Schema({
  usedBytes: { type: Number, default: 0 },
  totalBytes: {
    type: Number,
    default: 30 * 1024 * 1024 * 1024,  // 30 GB signup bonus
  },
  maxCapBytes: {
    type: Number,
    default: 100 * 1024 * 1024 * 1024, // 100 GB hard cap
  },
}, { _id: false });

const downloadDataSchema = new mongoose.Schema({
  usedBytes: { type: Number, default: 0 },
  totalBytes: {
    type: Number,
    default: 10 * 1024 * 1024 * 1024,  // 10 GB signup bonus
  },
}, { _id: false });

const adRewardSchema = new mongoose.Schema({
  dailyAdsWatched: { type: Number, default: 0 },
  dailyBytesEarned: { type: Number, default: 0 },
  lastResetDate: { type: String, default: "" },
  totalAdsWatched: { type: Number, default: 0 },
  totalBytesEarned: { type: Number, default: 0 },
}, { _id: false });

const userSchema = new mongoose.Schema({
  // ── Identity ─────────────────────────────────────────────
  uid: { type: String, required: true, unique: true },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  displayName: { type: String, trim: true },
  photoURL: { type: String },
  provider: { type: String, enum: ["google", "email"], default: "email" },
  passwordHash: { type: String },

  // ── Status ────────────────────────────────────────────────
  isActive: { type: Boolean, default: true },
  isAdmin: { type: Boolean, default: false },
  emailVerified: { type: Boolean, default: false },
  lastLoginAt: { type: Date },
  createdAt: { type: Date, default: Date.now },

  // ── Storage ───────────────────────────────────────────────
  cloudStorage: { type: storageSchema, default: () => ({}) },

  // ── Download Data ─────────────────────────────────────────
  downloadData: { type: downloadDataSchema, default: () => ({}) },

  // ── Subscription ──────────────────────────────────────────
  subscription: { type: subscriptionSchema, default: () => ({}) },

  // ── Ad Rewards ────────────────────────────────────────────
  adRewards: { type: adRewardSchema, default: () => ({}) },

  // ── Security ──────────────────────────────────────────────
  jwtVersion: { type: Number, default: 1 },
  failedLoginAttempts: { type: Number, default: 0 },
  lockedUntil: { type: Date },

  // ── Device / Session ──────────────────────────────────────
  fcmToken: { type: String },
  platform: { type: String, enum: ["android", "web", "ios"], default: "android" },
}, {
  timestamps: true,
  toJSON: {
    transform: (doc, ret) => {
      delete ret.passwordHash;
      delete ret.jwtVersion;
      delete ret.failedLoginAttempts;
      return ret;
    },
  },
});

// ── Indexes ───────────────────────────────────────────────────
userSchema.index({ email: 1 });
userSchema.index({ uid: 1 });
userSchema.index({ createdAt: -1 });

// ── Methods ───────────────────────────────────────────────────
userSchema.methods.comparePassword = async function (plain) {
  if (!this.passwordHash) return false;
  return bcrypt.compare(plain, this.passwordHash);
};

userSchema.methods.setPassword = async function (plain) {
  const salt = await bcrypt.genSalt(12);
  this.passwordHash = await bcrypt.hash(plain, salt);
};

userSchema.methods.getStoragePercent = function () {
  const { usedBytes, totalBytes } = this.cloudStorage;
  return totalBytes > 0 ? ((usedBytes / totalBytes) * 100).toFixed(1) : 0;
};

userSchema.methods.getDownloadPercent = function () {
  const { usedBytes, totalBytes } = this.downloadData;
  return totalBytes > 0 ? ((usedBytes / totalBytes) * 100).toFixed(1) : 0;
};

userSchema.methods.canWatchAd = function () {
  const today = new Date().toISOString().split("T")[0];
  const rewards = this.adRewards;
  const MAX_ADS_PER_DAY = 10;
  const MAX_BYTES_PER_DAY = 2 * 1024 * 1024 * 1024; // 2 GB

  if (rewards.lastResetDate !== today) return true;
  return (
    rewards.dailyAdsWatched < MAX_ADS_PER_DAY &&
    rewards.dailyBytesEarned < MAX_BYTES_PER_DAY
  );
};

userSchema.methods.recordAdReward = function (bytesEarned, rewardType = "storage") {
  const today = new Date().toISOString().split("T")[0];
  const rewards = this.adRewards;

  if (rewards.lastResetDate !== today) {
    rewards.dailyAdsWatched = 0;
    rewards.dailyBytesEarned = 0;
    rewards.lastResetDate = today;
  }

  rewards.dailyAdsWatched += 1;
  rewards.dailyBytesEarned += bytesEarned;
  rewards.totalAdsWatched += 1;
  rewards.totalBytesEarned += bytesEarned;

  if (rewardType === "storage") {
    const cap = this.cloudStorage.maxCapBytes;
    this.cloudStorage.totalBytes = Math.min(
      this.cloudStorage.totalBytes + bytesEarned,
      cap
    );
  } else {
    this.downloadData.totalBytes += bytesEarned;
  }
};

module.exports = mongoose.model("User", userSchema);
