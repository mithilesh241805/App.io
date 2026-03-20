// ============================================================
//  SDUCS – MK  |  Auth Middleware
// ============================================================
const jwt = require("jsonwebtoken");
const admin = require("../utils/firebaseAdmin");
const User = require("../models/User");

/**
 * Verify Firebase ID token OR our own JWT (dual-mode).
 * Attaches `req.user` on success.
 */
const authenticate = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ error: "No authorization token provided." });
    }

    const token = authHeader.split(" ")[1];
    let uid;

    // ── Try our own JWT first ────────────────────────────────
    try {
      const payload = jwt.verify(token, process.env.JWT_SECRET);
      uid = payload.uid;

      // Verify JWT version (invalidate old tokens on password change)
      const user = await User.findOne({ uid }).lean();
      if (!user) return res.status(401).json({ error: "User not found." });
      if (user.jwtVersion !== payload.version) {
        return res.status(401).json({ error: "Token invalidated. Please log in again." });
      }
      if (!user.isActive) return res.status(403).json({ error: "Account suspended." });
      if (user.lockedUntil && user.lockedUntil > new Date()) {
        return res.status(403).json({ error: "Account temporarily locked." });
      }

      req.user = user;
      return next();
    } catch (jwtErr) {
      // Not our JWT — try Firebase token
    }

    // ── Try Firebase ID Token ────────────────────────────────
    const decoded = await admin.auth().verifyIdToken(token);
    uid = decoded.uid;

    let user = await User.findOne({ uid });
    if (!user) {
      // Auto-create user from Firebase token
      user = await User.create({
        uid: decoded.uid,
        email: decoded.email,
        displayName: decoded.name || decoded.email?.split("@")[0],
        photoURL: decoded.picture,
        provider: decoded.firebase.sign_in_provider === "google.com" ? "google" : "email",
        emailVerified: decoded.email_verified,
        lastLoginAt: new Date(),
      });
    } else {
      user.lastLoginAt = new Date();
      await user.save();
    }

    if (!user.isActive) return res.status(403).json({ error: "Account suspended." });
    req.user = user.toObject ? user.toObject() : user;
    next();
  } catch (err) {
    console.error("Auth middleware error:", err.message);
    return res.status(401).json({ error: "Invalid or expired token." });
  }
};

/**
 * Admin-only guard — must run after `authenticate`.
 */
const requireAdmin = (req, res, next) => {
  if (!req.user?.isAdmin) {
    return res.status(403).json({ error: "Admin access required." });
  }
  next();
};

/**
 * Soft auth — attaches user if token present, continues without one.
 */
const optionalAuth = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) return next();
  try {
    await authenticate(req, res, next);
  } catch {
    next();
  }
};

module.exports = { authenticate, requireAdmin, optionalAuth };
