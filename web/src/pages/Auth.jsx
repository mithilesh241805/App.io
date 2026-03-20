// ============================================================
//  SDUCS – MK  |  Auth Page — Glassmorphism Dark UI
// ============================================================
import React, { useState, useEffect } from "react";
import { signInWithPopup, GoogleAuthProvider, createUserWithEmailAndPassword, signInWithEmailAndPassword } from "firebase/auth";
import { auth } from "../utils/firebase";
import { useAuth } from "../context/AuthContext";
import { api } from "../utils/api";
import "./Auth.css";

const GoogleIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
  </svg>
);

const EyeIcon = ({ open }) => open ? (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>
  </svg>
) : (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/>
    <line x1="1" y1="1" x2="23" y2="23"/>
  </svg>
);

export default function Auth() {
  const { setUser } = useAuth();
  const [mode, setMode] = useState("signin"); // "signin" | "signup"
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [showPwd, setShowPwd] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [particles, setParticles] = useState([]);

  // Generate floating particles
  useEffect(() => {
    const p = Array.from({ length: 20 }, (_, i) => ({
      id: i,
      x: Math.random() * 100,
      y: Math.random() * 100,
      size: Math.random() * 4 + 2,
      delay: Math.random() * 5,
      duration: Math.random() * 10 + 8,
    }));
    setParticles(p);
  }, []);

  const handleGoogle = async () => {
    setLoading(true);
    setError("");
    try {
      const provider = new GoogleAuthProvider();
      const result = await signInWithPopup(auth, provider);
      const idToken = await result.user.getIdToken();
      const { data } = await api.post("/auth/google", { idToken });
      localStorage.setItem("sducs_token", data.token);
      setUser(data.user);
    } catch (err) {
      setError("Google sign-in failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleEmailSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      if (mode === "signup") {
        await createUserWithEmailAndPassword(auth, email, password);
        const { data } = await api.post("/auth/register", { email, password, displayName: name });
        localStorage.setItem("sducs_token", data.token);
        setUser(data.user);
      } else {
        await signInWithEmailAndPassword(auth, email, password);
        const { data } = await api.post("/auth/login", { email, password });
        localStorage.setItem("sducs_token", data.token);
        setUser(data.user);
      }
    } catch (err) {
      const msg = {
        "auth/user-not-found": "No account found with this email.",
        "auth/wrong-password": "Incorrect password.",
        "auth/email-already-in-use": "Email already registered.",
        "auth/weak-password": "Password must be at least 6 characters.",
        "auth/invalid-email": "Invalid email address.",
      }[err.code] || err.response?.data?.error || "Authentication failed.";
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-root">
      {/* Animated background */}
      <div className="auth-bg">
        <div className="bg-orb orb-1" />
        <div className="bg-orb orb-2" />
        <div className="bg-orb orb-3" />
        {particles.map(p => (
          <div key={p.id} className="particle" style={{
            left: `${p.x}%`, top: `${p.y}%`,
            width: p.size, height: p.size,
            animationDelay: `${p.delay}s`,
            animationDuration: `${p.duration}s`,
          }} />
        ))}
      </div>

      {/* Glass card */}
      <div className="auth-card">
        {/* Logo */}
        <div className="auth-logo">
          <div className="logo-mark">
            <span className="logo-s">S</span>
            <div className="logo-dot" />
          </div>
          <div className="logo-text">
            <span className="logo-sducs">SDUCS</span>
            <span className="logo-mk">MK Multitasking</span>
          </div>
        </div>

        <p className="auth-tagline">Your intelligent cloud workspace</p>

        {/* Mode toggle */}
        <div className="auth-toggle">
          <button
            className={`toggle-btn ${mode === "signin" ? "active" : ""}`}
            onClick={() => { setMode("signin"); setError(""); }}
          >Sign In</button>
          <button
            className={`toggle-btn ${mode === "signup" ? "active" : ""}`}
            onClick={() => { setMode("signup"); setError(""); }}
          >Sign Up</button>
        </div>

        {/* Google button */}
        <button className="google-btn" onClick={handleGoogle} disabled={loading}>
          <GoogleIcon />
          <span>Continue with Google</span>
        </button>

        <div className="auth-divider"><span>or</span></div>

        {/* Email form */}
        <form className="auth-form" onSubmit={handleEmailSubmit}>
          {mode === "signup" && (
            <div className="field-wrap">
              <label>Full Name</label>
              <input
                type="text"
                placeholder="Your name"
                value={name}
                onChange={e => setName(e.target.value)}
                required
              />
            </div>
          )}
          <div className="field-wrap">
            <label>Email</label>
            <input
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
            />
          </div>
          <div className="field-wrap">
            <label>Password</label>
            <div className="pwd-wrap">
              <input
                type={showPwd ? "text" : "password"}
                placeholder={mode === "signup" ? "At least 8 characters" : "Your password"}
                value={password}
                onChange={e => setPassword(e.target.value)}
                minLength={8}
                required
              />
              <button type="button" className="eye-btn" onClick={() => setShowPwd(!showPwd)}>
                <EyeIcon open={showPwd} />
              </button>
            </div>
          </div>

          {error && <div className="auth-error">{error}</div>}

          <button type="submit" className="submit-btn" disabled={loading}>
            {loading ? <span className="spinner" /> : (mode === "signin" ? "Sign In" : "Create Account")}
          </button>
        </form>

        {mode === "signup" && (
          <div className="auth-bonus">
            🎁 Sign up & get <strong>30 GB cloud storage</strong> + <strong>10 GB download data</strong> free!
          </div>
        )}
      </div>
    </div>
  );
}
