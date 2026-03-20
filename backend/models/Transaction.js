// ============================================================
//  SDUCS – MK  |  Transaction Model
// ============================================================
const mongoose = require("mongoose");

const PLANS = {
  lite:    { dataGB: 5,  price: 25,  days: 2,  label: "Lite"    },
  premium: { dataGB: 10, price: 49,  days: 4,  label: "Premium" },
  pro:     { dataGB: 20, price: 99,  days: 6,  label: "Pro"     },
  promax:  { dataGB: 50, price: 200, days: 8,  label: "Pro Max" },
};

const transactionSchema = new mongoose.Schema({
  // ── User ──────────────────────────────────────────────────
  userId: { type: String, required: true, index: true },
  userEmail: { type: String },

  // ── Plan ──────────────────────────────────────────────────
  plan: {
    type: String,
    enum: Object.keys(PLANS),
    required: true,
  },
  planLabel: { type: String },
  dataGB: { type: Number },
  amountINR: { type: Number, required: true },
  durationDays: { type: Number },

  // ── Payment Method ────────────────────────────────────────
  method: {
    type: String,
    enum: ["razorpay", "upi_screenshot"],
    required: true,
  },
  status: {
    type: String,
    enum: ["pending", "processing", "success", "failed", "refunded", "manual_review"],
    default: "pending",
  },

  // ── Razorpay ──────────────────────────────────────────────
  razorpayOrderId: { type: String },
  razorpayPaymentId: { type: String },
  razorpaySignature: { type: String },
  qrCodeData: { type: String },
  qrExpiresAt: { type: Date },

  // ── UPI Screenshot Fallback ───────────────────────────────
  screenshotUrl: { type: String },
  screenshotKey: { type: String },
  utrNumber: { type: String },
  adminNote: { type: String },
  verifiedBy: { type: String },
  verifiedAt: { type: Date },

  // ── Subscription Dates ────────────────────────────────────
  activatedAt: { type: Date },
  expiresAt: { type: Date },

  // ── Metadata ──────────────────────────────────────────────
  ipAddress: { type: String },
  userAgent: { type: String },
  failureReason: { type: String },
}, {
  timestamps: true,
});

transactionSchema.index({ razorpayOrderId: 1 });
transactionSchema.index({ razorpayPaymentId: 1 });
transactionSchema.index({ status: 1, createdAt: -1 });
transactionSchema.index({ userId: 1, status: 1 });

transactionSchema.statics.PLANS = PLANS;

transactionSchema.methods.activate = function () {
  const plan = PLANS[this.plan];
  this.status = "success";
  this.activatedAt = new Date();
  this.expiresAt = new Date(Date.now() + plan.days * 24 * 60 * 60 * 1000);
  this.dataGB = plan.dataGB;
  this.durationDays = plan.days;
  this.planLabel = plan.label;
};

module.exports = mongoose.model("Transaction", transactionSchema);
module.exports.PLANS = PLANS;
