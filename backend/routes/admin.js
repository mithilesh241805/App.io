// ============================================================
//  SDUCS – MK  |  Admin Routes
// ============================================================
const express = require("express");
const router = express.Router();
const { authenticate, requireAdmin } = require("../middleware/auth");
const User = require("../models/User");
const File = require("../models/File");
const Transaction = require("../models/Transaction");
const DownloadJob = require("../models/DownloadJob");

router.use(authenticate, requireAdmin);

// ── GET /api/admin/stats ──────────────────────────────────────
router.get("/stats", async (req, res) => {
  try {
    const [
      totalUsers, activeUsers, totalFiles, totalTransactions,
      successfulPayments, pendingPayments, totalRevenue,
    ] = await Promise.all([
      User.countDocuments(),
      User.countDocuments({ lastLoginAt: { $gte: new Date(Date.now() - 7*24*60*60*1000) } }),
      File.countDocuments({ isDeleted: false }),
      Transaction.countDocuments(),
      Transaction.countDocuments({ status: "success" }),
      Transaction.countDocuments({ status: "manual_review" }),
      Transaction.aggregate([{ $match: { status: "success" } }, { $group: { _id: null, total: { $sum: "$amountINR" } } }]),
    ]);

    res.json({
      users: { total: totalUsers, activeThisWeek: activeUsers },
      files: { total: totalFiles },
      payments: {
        total: totalTransactions,
        successful: successfulPayments,
        pending: pendingPayments,
        totalRevenueINR: totalRevenue[0]?.total || 0,
      },
    });
  } catch (err) {
    res.status(500).json({ error: "Stats fetch failed." });
  }
});

// ── GET /api/admin/users ──────────────────────────────────────
router.get("/users", async (req, res) => {
  try {
    const { page = 1, limit = 20, search } = req.query;
    const query = {};
    if (search) query.$or = [
      { email: { $regex: search, $options: "i" } },
      { displayName: { $regex: search, $options: "i" } },
    ];
    const [users, total] = await Promise.all([
      User.find(query).sort({ createdAt: -1 }).skip((page-1)*limit).limit(parseInt(limit))
          .select("-passwordHash -jwtVersion"),
      User.countDocuments(query),
    ]);
    res.json({ users, total });
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch users." });
  }
});

// ── PATCH /api/admin/users/:uid ───────────────────────────────
router.patch("/users/:uid", async (req, res) => {
  try {
    const { isActive, isAdmin, addStorageGB, addDataGB } = req.body;
    const update = {};
    if (isActive !== undefined) update.isActive = isActive;
    if (isAdmin !== undefined) update.isAdmin = isAdmin;
    if (addStorageGB) update.$inc = { "cloudStorage.totalBytes": addStorageGB * 1024*1024*1024 };
    if (addDataGB) update.$inc = { ...(update.$inc || {}), "downloadData.totalBytes": addDataGB * 1024*1024*1024 };

    await User.findOneAndUpdate({ uid: req.params.uid }, update);
    res.json({ message: "User updated." });
  } catch (err) {
    res.status(500).json({ error: "Update failed." });
  }
});

// ── GET /api/admin/pending-payments ──────────────────────────
router.get("/pending-payments", async (req, res) => {
  try {
    const pending = await Transaction.find({ status: "manual_review" }).sort({ createdAt: 1 });
    res.json({ transactions: pending });
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch pending." });
  }
});

// ── GET /api/admin/revenue ────────────────────────────────────
router.get("/revenue", async (req, res) => {
  try {
    const byPlan = await Transaction.aggregate([
      { $match: { status: "success" } },
      { $group: { _id: "$plan", count: { $sum: 1 }, revenue: { $sum: "$amountINR" } } },
    ]);

    const dailyRevenue = await Transaction.aggregate([
      { $match: { status: "success", createdAt: { $gte: new Date(Date.now() - 30*24*60*60*1000) } } },
      {
        $group: {
          _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
          revenue: { $sum: "$amountINR" },
          count: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    res.json({ byPlan, dailyRevenue });
  } catch (err) {
    res.status(500).json({ error: "Revenue fetch failed." });
  }
});

module.exports = router;


// ============================================================
//  SDUCS – MK  |  Firebase Admin Init
// ============================================================
// Save as: backend/utils/firebaseAdmin.js
const admin = require("firebase-admin");

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId:   process.env.FIREBASE_PROJECT_ID,
      privateKey:  process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n"),
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
    }),
    storageBucket: process.env.FIREBASE_STORAGE_BUCKET,
  });
}

module.exports = admin;
