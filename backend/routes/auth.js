// ============================================================
//  SDUCS – MK  |  Auth Routes
// ============================================================
const express = require("express");
const router = express.Router();
const jwt = require("jsonwebtoken");
const { v4: uuidv4 } = require("uuid");
const admin = require("../utils/firebaseAdmin");
const User = require("../models/User");
const { authenticate } = require("../middleware/auth");

const signJWT = (user) => jwt.sign(
  { uid: user.uid, email: user.email, version: user.jwtVersion },
  process.env.JWT_SECRET,
  { expiresIn: process.env.JWT_EXPIRES_IN || "7d" }
);

// ── POST /api/auth/register ───────────────────────────────────
router.post("/register", async (req, res) => {
  try {
    const { email, password, displayName } = req.body;
    if (!email || !password) return res.status(400).json({ error: "Email and password required." });
    if (password.length < 8) return res.status(400).json({ error: "Password must be at least 8 characters." });

    const exists = await User.findOne({ email: email.toLowerCase() });
    if (exists) return res.status(409).json({ error: "Email already registered." });

    // Create Firebase user
    const firebaseUser = await admin.auth().createUser({ email, password, displayName });

    const user = await User.create({
      uid: firebaseUser.uid,
      email: email.toLowerCase(),
      displayName: displayName || email.split("@")[0],
      provider: "email",
      emailVerified: false,
    });

    const token = signJWT(user);
    res.status(201).json({ token, user: user.toJSON() });
  } catch (err) {
    if (err.code === "auth/email-already-exists") {
      return res.status(409).json({ error: "Email already registered." });
    }
    console.error("Register error:", err);
    res.status(500).json({ error: "Registration failed." });
  }
});

// ── POST /api/auth/login ──────────────────────────────────────
router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: "Email and password required." });

    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) return res.status(401).json({ error: "Invalid credentials." });

    if (user.lockedUntil && user.lockedUntil > new Date()) {
      return res.status(403).json({ error: "Account locked. Try again later." });
    }

    const valid = await user.comparePassword(password);
    if (!valid) {
      user.failedLoginAttempts = (user.failedLoginAttempts || 0) + 1;
      if (user.failedLoginAttempts >= 5) {
        user.lockedUntil = new Date(Date.now() + 30 * 60 * 1000); // 30 min
      }
      await user.save();
      return res.status(401).json({ error: "Invalid credentials." });
    }

    user.failedLoginAttempts = 0;
    user.lockedUntil = undefined;
    user.lastLoginAt = new Date();
    await user.save();

    const token = signJWT(user);
    res.json({ token, user: user.toJSON() });
  } catch (err) {
    console.error("Login error:", err);
    res.status(500).json({ error: "Login failed." });
  }
});

// ── POST /api/auth/google ─────────────────────────────────────
// Exchange Firebase ID token for our JWT
router.post("/google", async (req, res) => {
  try {
    const { idToken } = req.body;
    if (!idToken) return res.status(400).json({ error: "Firebase ID token required." });

    const decoded = await admin.auth().verifyIdToken(idToken);

    let user = await User.findOne({ uid: decoded.uid });
    if (!user) {
      user = await User.create({
        uid: decoded.uid,
        email: decoded.email.toLowerCase(),
        displayName: decoded.name,
        photoURL: decoded.picture,
        provider: "google",
        emailVerified: true,
        lastLoginAt: new Date(),
      });
    } else {
      user.lastLoginAt = new Date();
      user.photoURL = decoded.picture || user.photoURL;
      await user.save();
    }

    const token = signJWT(user);
    res.json({ token, user: user.toJSON() });
  } catch (err) {
    console.error("Google auth error:", err);
    res.status(401).json({ error: "Google authentication failed." });
  }
});

// ── GET /api/auth/me ──────────────────────────────────────────
router.get("/me", authenticate, async (req, res) => {
  try {
    const user = await User.findOne({ uid: req.user.uid });
    if (!user) return res.status(404).json({ error: "User not found." });
    res.json(user.toJSON());
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch user." });
  }
});

// ── POST /api/auth/logout ─────────────────────────────────────
router.post("/logout", authenticate, async (req, res) => {
  try {
    // Increment jwtVersion to invalidate all existing tokens
    await User.updateOne({ uid: req.user.uid }, { $inc: { jwtVersion: 1 } });
    res.json({ message: "Logged out successfully." });
  } catch (err) {
    res.status(500).json({ error: "Logout failed." });
  }
});

// ── POST /api/auth/change-password ───────────────────────────
router.post("/change-password", authenticate, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!newPassword || newPassword.length < 8) {
      return res.status(400).json({ error: "New password must be at least 8 characters." });
    }

    const user = await User.findOne({ uid: req.user.uid });
    if (user.provider === "email") {
      const valid = await user.comparePassword(currentPassword);
      if (!valid) return res.status(401).json({ error: "Current password is incorrect." });
    }

    await user.setPassword(newPassword);
    user.jwtVersion += 1;  // Invalidate all existing sessions
    await user.save();

    // Update Firebase password too
    await admin.auth().updateUser(user.uid, { password: newPassword });

    res.json({ message: "Password changed. Please log in again." });
  } catch (err) {
    console.error("Change password error:", err);
    res.status(500).json({ error: "Password change failed." });
  }
});

module.exports = router;
