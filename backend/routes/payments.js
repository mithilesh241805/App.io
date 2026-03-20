// ============================================================
//  SDUCS – MK  |  Payment Routes (Razorpay + UPI Fallback)
// ============================================================
const express = require("express");
const router = express.Router();
const Razorpay = require("razorpay");
const crypto = require("crypto");
const multer = require("multer");
const QRCode = require("qrcode");
const { authenticate, requireAdmin } = require("../middleware/auth");
const Transaction = require("../models/Transaction");
const User = require("../models/User");
const { uploadToStorage } = require("../utils/storage");

const PLANS = Transaction.PLANS;

const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET,
});

const screenshotUpload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });

// ── POST /api/payments/create-order ──────────────────────────
router.post("/create-order", authenticate, async (req, res) => {
  try {
    const { plan } = req.body;
    if (!PLANS[plan]) return res.status(400).json({ error: "Invalid plan." });

    const planInfo = PLANS[plan];
    const amountPaise = planInfo.price * 100;

    // Create Razorpay order
    const order = await razorpay.orders.create({
      amount: amountPaise,
      currency: "INR",
      receipt: `sducs_${Date.now()}`,
      notes: { plan, userId: req.user.uid },
    });

    // Generate UPI QR from Razorpay order
    const upiString = `upi://pay?pa=${process.env.RAZORPAY_UPI_ID}&pn=SDUCS-MK&am=${planInfo.price}&cu=INR&tn=SDUCS_${plan}_plan&tr=${order.id}`;
    const qrDataURL = await QRCode.toDataURL(upiString, { width: 300, errorCorrectionLevel: "H" });

    const txn = await Transaction.create({
      userId: req.user.uid,
      userEmail: req.user.email,
      plan,
      planLabel: planInfo.label,
      amountINR: planInfo.price,
      durationDays: planInfo.days,
      dataGB: planInfo.dataGB,
      method: "razorpay",
      status: "pending",
      razorpayOrderId: order.id,
      qrCodeData: qrDataURL,
      qrExpiresAt: new Date(Date.now() + 30 * 60 * 1000), // 30 minutes
      ipAddress: req.ip,
      userAgent: req.headers["user-agent"],
    });

    res.json({
      orderId: order.id,
      transactionId: txn._id,
      amount: planInfo.price,
      currency: "INR",
      plan: planInfo,
      qrCode: qrDataURL,
      qrExpiresAt: txn.qrExpiresAt,
      razorpayKeyId: process.env.RAZORPAY_KEY_ID,
    });
  } catch (err) {
    console.error("Create order error:", err);
    res.status(500).json({ error: "Failed to create payment order." });
  }
});

// ── POST /api/payments/verify ─────────────────────────────────
router.post("/verify", authenticate, async (req, res) => {
  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;

    // Verify Razorpay signature
    const expectedSig = crypto
      .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
      .update(`${razorpay_order_id}|${razorpay_payment_id}`)
      .digest("hex");

    if (expectedSig !== razorpay_signature) {
      return res.status(400).json({ error: "Payment signature verification failed." });
    }

    const txn = await Transaction.findOne({ razorpayOrderId: razorpay_order_id, userId: req.user.uid });
    if (!txn) return res.status(404).json({ error: "Transaction not found." });
    if (txn.status === "success") return res.json({ message: "Already activated.", transaction: txn });

    txn.razorpayPaymentId = razorpay_payment_id;
    txn.razorpaySignature = razorpay_signature;
    txn.activate();
    await txn.save();

    // Credit user account
    await creditUserAccount(req.user.uid, txn);

    res.json({ message: "Payment verified. Account credited!", transaction: txn });
  } catch (err) {
    console.error("Verify payment error:", err);
    res.status(500).json({ error: "Payment verification failed." });
  }
});

// ── POST /api/payments/webhook ────────────────────────────────
// Razorpay sends webhook events here
router.post("/webhook", express.raw({ type: "application/json" }), async (req, res) => {
  try {
    const sig = req.headers["x-razorpay-signature"];
    const expectedSig = crypto
      .createHmac("sha256", process.env.RAZORPAY_WEBHOOK_SECRET)
      .update(req.body)
      .digest("hex");

    if (sig !== expectedSig) {
      console.warn("Invalid webhook signature");
      return res.status(400).json({ error: "Invalid signature." });
    }

    const event = JSON.parse(req.body.toString());

    if (event.event === "payment.captured") {
      const payment = event.payload.payment.entity;
      const txn = await Transaction.findOne({ razorpayOrderId: payment.order_id });

      if (txn && txn.status !== "success") {
        txn.razorpayPaymentId = payment.id;
        txn.activate();
        await txn.save();
        await creditUserAccount(txn.userId, txn);
        console.log(`✅ Webhook: Payment ${payment.id} credited to user ${txn.userId}`);
      }
    }

    if (event.event === "payment.failed") {
      const payment = event.payload.payment.entity;
      await Transaction.findOneAndUpdate(
        { razorpayOrderId: payment.order_id },
        { status: "failed", failureReason: payment.error_description }
      );
    }

    res.json({ received: true });
  } catch (err) {
    console.error("Webhook error:", err);
    res.status(500).json({ error: "Webhook processing failed." });
  }
});

// ── POST /api/payments/upi-fallback ──────────────────────────
// Static UPI fallback — user uploads payment screenshot
router.post("/upi-fallback/initiate", authenticate, async (req, res) => {
  try {
    const { plan } = req.body;
    if (!PLANS[plan]) return res.status(400).json({ error: "Invalid plan." });

    const planInfo = PLANS[plan];

    // Generate QR for static UPI ID (ID never shown directly in response)
    const upiString = `upi://pay?pa=${process.env.STATIC_UPI_ID}&pn=SDUCS-MK&am=${planInfo.price}&cu=INR&tn=SDUCS_${plan}`;
    const qrDataURL = await QRCode.toDataURL(upiString, { width: 300, errorCorrectionLevel: "H" });

    const txn = await Transaction.create({
      userId: req.user.uid,
      userEmail: req.user.email,
      plan,
      planLabel: planInfo.label,
      amountINR: planInfo.price,
      durationDays: planInfo.days,
      dataGB: planInfo.dataGB,
      method: "upi_screenshot",
      status: "pending",
      qrCodeData: qrDataURL,
      ipAddress: req.ip,
    });

    res.json({
      transactionId: txn._id,
      plan: planInfo,
      qrCode: qrDataURL,               // QR encodes UPI; UPI ID not exposed as text
      instructions: [
        "Scan the QR code using any UPI app (GPay, PhonePe, Paytm, etc.)",
        `Pay exactly ₹${planInfo.price}`,
        "Take a screenshot of the payment confirmation",
        "Upload the screenshot below",
        "Your plan will be activated after admin verification (usually within 2 hours)",
      ],
    });
  } catch (err) {
    res.status(500).json({ error: "Failed to initiate fallback payment." });
  }
});

// ── POST /api/payments/upi-fallback/submit ────────────────────
router.post(
  "/upi-fallback/submit",
  authenticate,
  screenshotUpload.single("screenshot"),
  async (req, res) => {
    try {
      const { transactionId, utrNumber } = req.body;
      const screenshot = req.file;
      if (!screenshot) return res.status(400).json({ error: "Screenshot required." });

      const txn = await Transaction.findOne({ _id: transactionId, userId: req.user.uid, method: "upi_screenshot" });
      if (!txn) return res.status(404).json({ error: "Transaction not found." });
      if (txn.status !== "pending") return res.status(400).json({ error: "Transaction already processed." });

      // Upload screenshot
      const key = `screenshots/${req.user.uid}/${transactionId}.jpg`;
      const { storageKey } = await uploadToStorage(screenshot.buffer, key, screenshot.mimetype);

      txn.screenshotKey = storageKey;
      txn.utrNumber = utrNumber;
      txn.status = "manual_review";
      await txn.save();

      res.json({
        message: "Screenshot submitted. Your plan will be activated after verification.",
        transactionId: txn._id,
        status: txn.status,
      });
    } catch (err) {
      res.status(500).json({ error: "Screenshot submission failed." });
    }
  }
);

// ── GET /api/payments/history ─────────────────────────────────
router.get("/history", authenticate, async (req, res) => {
  try {
    const txns = await Transaction.find({ userId: req.user.uid })
      .sort({ createdAt: -1 })
      .limit(20)
      .select("-qrCodeData -screenshotKey -razorpaySignature");
    res.json({ transactions: txns });
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch history." });
  }
});

// ── ADMIN: GET /api/payments/admin/pending ─────────────────────
router.get("/admin/pending", authenticate, requireAdmin, async (req, res) => {
  try {
    const pending = await Transaction.find({ status: "manual_review" }).sort({ createdAt: 1 });
    res.json({ transactions: pending });
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch pending transactions." });
  }
});

// ── ADMIN: POST /api/payments/admin/approve ────────────────────
router.post("/admin/approve", authenticate, requireAdmin, async (req, res) => {
  try {
    const { transactionId, action, note } = req.body;
    const txn = await Transaction.findById(transactionId);
    if (!txn) return res.status(404).json({ error: "Transaction not found." });

    if (action === "approve") {
      txn.activate();
      txn.verifiedBy = req.user.email;
      txn.verifiedAt = new Date();
      txn.adminNote = note;
      await txn.save();
      await creditUserAccount(txn.userId, txn);
      res.json({ message: "Transaction approved and user credited." });
    } else if (action === "reject") {
      txn.status = "failed";
      txn.adminNote = note;
      txn.verifiedBy = req.user.email;
      txn.verifiedAt = new Date();
      await txn.save();
      res.json({ message: "Transaction rejected." });
    } else {
      res.status(400).json({ error: "Invalid action." });
    }
  } catch (err) {
    res.status(500).json({ error: "Admin action failed." });
  }
});

// ── Helper: Credit user after verified payment ────────────────
async function creditUserAccount(userId, txn) {
  const planInfo = PLANS[txn.plan];
  const addBytes = planInfo.dataGB * 1024 * 1024 * 1024;

  await User.findOneAndUpdate(
    { uid: userId },
    {
      $inc: { "downloadData.totalBytes": addBytes },
      $set: {
        "subscription.plan": txn.plan,
        "subscription.dataGB": planInfo.dataGB,
        "subscription.expiresAt": txn.expiresAt,
        "subscription.activatedAt": txn.activatedAt,
        "subscription.transactionId": txn._id.toString(),
      },
    }
  );
}

module.exports = router;
