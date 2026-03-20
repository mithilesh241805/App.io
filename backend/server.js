// ============================================================
//  SDUCS – MK Multitasking  |  Backend Server
//  Node.js + Express + MongoDB
// ============================================================

require("dotenv").config();
const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const morgan = require("morgan");
const cron = require("node-cron");

const authRoutes = require("./routes/auth");
const fileRoutes = require("./routes/files");
const downloadRoutes = require("./routes/downloads");
const paymentRoutes = require("./routes/payments");
const adRoutes = require("./routes/ads");
const adminRoutes = require("./routes/admin");
const aiRoutes = require("./routes/ai");

const { cleanupRecycleBin } = require("./jobs/recycleBinCleanup");
const { expireSubscriptions } = require("./jobs/subscriptionExpiry");

const app = express();

// ── Security Middleware ──────────────────────────────────────
app.use(helmet());
app.use(cors({
  origin: process.env.ALLOWED_ORIGINS?.split(",") || ["http://localhost:3000"],
  credentials: true,
}));

// ── Rate Limiting ────────────────────────────────────────────
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 200,
  message: { error: "Too many requests. Please try again later." },
});
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: { error: "Too many auth attempts. Please try again later." },
});

app.use(globalLimiter);
app.use(morgan("combined"));
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));

// ── Database ─────────────────────────────────────────────────
mongoose.connect(process.env.MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
  .then(() => console.log("✅ MongoDB connected"))
  .catch((err) => {
    console.error("❌ MongoDB connection error:", err);
    process.exit(1);
  });

// ── Routes ───────────────────────────────────────────────────
app.use("/api/auth", authLimiter, authRoutes);
app.use("/api/files", fileRoutes);
app.use("/api/downloads", downloadRoutes);
app.use("/api/payments", paymentRoutes);
app.use("/api/ads", adRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/ai", aiRoutes);

// Razorpay webhook (raw body needed for signature verification)
app.use("/api/payments/webhook", express.raw({ type: "application/json" }));

// ── Health Check ─────────────────────────────────────────────
app.get("/health", (req, res) => {
  res.json({
    status: "ok",
    service: "SDUCS-MK Backend",
    version: "1.0.0",
    timestamp: new Date().toISOString(),
  });
});

// ── Error Handler ─────────────────────────────────────────────
app.use((err, req, res, next) => {
  console.error("Unhandled error:", err);
  res.status(err.status || 500).json({
    error: err.message || "Internal server error",
    ...(process.env.NODE_ENV === "development" && { stack: err.stack }),
  });
});

// ── Cron Jobs ────────────────────────────────────────────────
// Run daily at 2 AM — purge recycle bin items older than 30 days
cron.schedule("0 2 * * *", () => {
  console.log("🗑️  Running recycle bin cleanup...");
  cleanupRecycleBin();
});

// Run every hour — expire subscriptions
cron.schedule("0 * * * *", () => {
  console.log("🔄 Checking subscription expiry...");
  expireSubscriptions();
});

// ── Start Server ─────────────────────────────────────────────
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`🚀 SDUCS-MK Backend running on port ${PORT}`);
  console.log(`   Environment: ${process.env.NODE_ENV || "development"}`);
});

module.exports = app;
