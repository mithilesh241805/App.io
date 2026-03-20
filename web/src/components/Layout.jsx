// ============================================================
//  SDUCS – MK  |  Layout Component
// ============================================================
import React, { useState } from "react";
import { Outlet, NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useTheme } from "../context/ThemeContext";
import "./Layout.css";

const NAV_ITEMS = [
  { to: "/dashboard", icon: "⚡", label: "Dashboard" },
  { to: "/files",     icon: "📁", label: "Files" },
  { to: "/downloads", icon: "⬇️", label: "Downloads" },
  { to: "/plans",     icon: "💎", label: "Plans" },
  { to: "/recycle-bin", icon: "🗑️", label: "Recycle Bin" },
  { to: "/settings",  icon: "⚙️", label: "Settings" },
];

export default function Layout() {
  const { user, logout } = useAuth();
  const { theme, toggle } = useTheme();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className={`app-layout theme-${theme}`}>
      {/* Sidebar */}
      <aside className={`sidebar ${sidebarOpen ? "open" : ""}`}>
        <div className="sb-logo">
          <div className="sb-logo-mark">S</div>
          <div>
            <div className="sb-title">SDUCS</div>
            <div className="sb-sub">MK Multitasking</div>
          </div>
        </div>

        <nav className="sb-nav">
          {NAV_ITEMS.map(item => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) => `sb-link ${isActive ? "active" : ""}`}
              onClick={() => setSidebarOpen(false)}
            >
              <span className="sb-icon">{item.icon}</span>
              <span className="sb-label">{item.label}</span>
            </NavLink>
          ))}
          {user?.isAdmin && (
            <NavLink to="/admin" className={({ isActive }) => `sb-link ${isActive ? "active" : ""}`}>
              <span className="sb-icon">🛡️</span>
              <span className="sb-label">Admin Panel</span>
            </NavLink>
          )}
        </nav>

        <div className="sb-footer">
          <div className="sb-user">
            <div className="sb-avatar">
              {user?.photoURL
                ? <img src={user.photoURL} alt="avatar" />
                : <span>{user?.displayName?.[0]?.toUpperCase() || "U"}</span>}
            </div>
            <div className="sb-user-info">
              <span className="sb-user-name">{user?.displayName || "User"}</span>
              <span className="sb-user-email">{user?.email}</span>
            </div>
          </div>
          <button className="sb-logout" onClick={logout}>Sign out</button>
        </div>
      </aside>

      {/* Overlay */}
      {sidebarOpen && <div className="sb-overlay" onClick={() => setSidebarOpen(false)} />}

      {/* Main */}
      <main className="main-content">
        <header className="top-bar">
          <button className="hamburger" onClick={() => setSidebarOpen(true)}>☰</button>
          <div className="tb-right">
            <button className="theme-toggle" onClick={toggle}>
              {theme === "dark" ? "☀️" : "🌙"}
            </button>
            <button className="tb-upgrade" onClick={() => navigate("/plans")}>
              ✨ Upgrade
            </button>
          </div>
        </header>
        <div className="page-body">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
