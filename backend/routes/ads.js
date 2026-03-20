// ============================================================
//  SDUCS – MK  |  Ad Reward Routes
// ============================================================
const express = require("express");
const router = express.Router();
const crypto = require("crypto");
const { authenticate } = require("../middleware/auth");
const User = require("../models/User");

const MIN_REWARD_BYTES = 100 * 1024 * 1024;   // 100 MB
const MAX_REWARD_BYTES = 500 * 1024 * 1024;   // 500 MB
const MAX_ADS_PER_DAY = 10;
const MAX_BYTES_PER_DAY = 2 * 1024 * 1024 * 1024; // 2 GB

// In-memory store for pending reward tokens (use Redis in production)
const pendingRewards = new Map();

// ── POST /api/ads/initiate ────────────────────────────────────
// Called before showing the ad; returns a one-time token
router.post("/initiate", authenticate, async (req, res) => {
  try {
    const user = await User.findOne({ uid: req.user.uid });

    if (!user.canWatchAd()) {
      return res.status(429).json({
        error: "Daily ad limit reached.",
        dailyLimit: MAX_ADS_PER_DAY,
        resetAt: "midnight",
      });
    }

    // Generate a one-time token for this ad session
    const token = crypto.randomBytes(32).toString("hex");
    const rewardBytes = Math.floor(
      Math.random() * (MAX_REWARD_BYTES - MIN_REWARD_BYTES) + MIN_REWARD_BYTES
    );

    pendingRewards.set(token, {
      uid: req.user.uid,
      rewardBytes,
      createdAt: Date.now(),
      used: false,
    });

    // Expire token after 5 minutes
    setTimeout(() => pendingRewards.delete(token), 5 * 60 * 1000);

    res.json({
      token,
      estimatedRewardMB: Math.floor(rewardBytes / 1024 / 1024),
      adUnitId: process.env.ADMOB_REWARDED_AD_UNIT_ID,
    });
  } catch (err) {
    res.status(500).json({ error: "Failed to initiate ad." });
  }
});

// ── POST /api/ads/complete ────────────────────────────────────
// Called after ad finishes; validates & grants reward
router.post("/complete", authenticate, async (req, res) => {
  try {
    const { token, rewardType = "storage", adType = "rewarded" } = req.body;
    if (!token) return res.status(400).json({ error: "Reward token required." });

    const pending = pendingRewards.get(token);
    if (!pending) return res.status(400).json({ error: "Invalid or expired reward token." });
    if (pending.uid !== req.user.uid) return res.status(403).json({ error: "Token mismatch." });
    if (pending.used) return res.status(400).json({ error: "Reward already claimed." });

    // Anti-abuse: ensure token was issued at least 15 seconds ago
    // (minimum reasonable ad watch time)
    if (Date.now() - pending.createdAt < 15000) {
      return res.status(400).json({ error: "Ad completed too quickly. Possible bot detected." });
    }

    pending.used = true;

    const user = await User.findOne({ uid: req.user.uid });
    if (!user.canWatchAd()) {
      return res.status(429).json({ error: "Daily limit reached during validation." });
    }

    user.recordAdReward(pending.rewardBytes, rewardType);
    await user.save();

    // Cleanup
    pendingRewards.delete(token);

    const rewardMB = Math.floor(pending.rewardBytes / 1024 / 1024);

    res.json({
      message: `🎉 You earned ${rewardMB} MB of ${rewardType === "storage" ? "cloud storage" : "download data"}!`,
      rewardMB,
      rewardType,
      dailyAdsWatched: user.adRewards.dailyAdsWatched,
      dailyRemaining: MAX_ADS_PER_DAY - user.adRewards.dailyAdsWatched,
      dailyBytesEarned: user.adRewards.dailyBytesEarned,
      updatedStorage: rewardType === "storage" ? {
        total: user.cloudStorage.totalBytes,
        used: user.cloudStorage.usedBytes,
      } : null,
      updatedDownload: rewardType === "download" ? {
        total: user.downloadData.totalBytes,
        used: user.downloadData.usedBytes,
      } : null,
    });
  } catch (err) {
    console.error("Ad complete error:", err);
    res.status(500).json({ error: "Failed to process reward." });
  }
});

// ── GET /api/ads/status ───────────────────────────────────────
router.get("/status", authenticate, async (req, res) => {
  try {
    const user = await User.findOne({ uid: req.user.uid }).select("adRewards");
    const today = new Date().toISOString().split("T")[0];
    const rewards = user.adRewards;

    const isNewDay = rewards.lastResetDate !== today;
    const dailyAds = isNewDay ? 0 : rewards.dailyAdsWatched;
    const dailyBytes = isNewDay ? 0 : rewards.dailyBytesEarned;

    res.json({
      canWatch: isNewDay || (dailyAds < MAX_ADS_PER_DAY && dailyBytes < MAX_BYTES_PER_DAY),
      dailyAdsWatched: dailyAds,
      dailyAdsLimit: MAX_ADS_PER_DAY,
      dailyBytesEarned: dailyBytes,
      dailyBytesLimit: MAX_BYTES_PER_DAY,
      totalAdsWatched: rewards.totalAdsWatched,
      totalBytesEarned: rewards.totalBytesEarned,
      estimatedRewardRange: {
        minMB: 100,
        maxMB: 500,
      },
    });
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch ad status." });
  }
});

module.exports = router;
