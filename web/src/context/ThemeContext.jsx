// ============================================================
//  SDUCS – MK  |  Theme Context
// ============================================================
import React, { createContext, useContext, useState, useEffect } from "react";

const ThemeContext = createContext(null);

export function ThemeProvider({ children }) {
  const [theme, setTheme] = useState(() => localStorage.getItem("sducs_theme") || "dark");

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem("sducs_theme", theme);
  }, [theme]);

  const toggle = () => setTheme(t => t === "dark" ? "light" : "dark");

  return (
    <ThemeContext.Provider value={{ theme, toggle, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export const useTheme = () => useContext(ThemeContext);


// ============================================================
//  SDUCS – MK  |  Toast Context
// ============================================================
import React, { createContext, useContext, useState, useCallback } from "react";

const ToastContext = createContext(null);

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const show = useCallback((message, type = "info", duration = 4000) => {
    const id = Date.now() + Math.random();
    setToasts(t => [...t, { id, message, type }]);
    setTimeout(() => setToasts(t => t.filter(toast => toast.id !== id)), duration);
  }, []);

  const dismiss = (id) => setToasts(t => t.filter(toast => toast.id !== id));

  return (
    <ToastContext.Provider value={{ show, dismiss }}>
      {children}
      <div style={{ position:"fixed", bottom:24, right:24, zIndex:9999, display:"flex", flexDirection:"column", gap:8 }}>
        {toasts.map(toast => (
          <div key={toast.id} onClick={() => dismiss(toast.id)} style={{
            padding:"12px 18px",
            borderRadius:12,
            background: toast.type==="success" ? "rgba(52,211,153,0.15)" : toast.type==="error" ? "rgba(239,68,68,0.15)" : "rgba(99,102,241,0.15)",
            border: `1px solid ${toast.type==="success" ? "rgba(52,211,153,0.3)" : toast.type==="error" ? "rgba(239,68,68,0.3)" : "rgba(99,102,241,0.3)"}`,
            color: "#fff",
            fontSize:14,
            cursor:"pointer",
            backdropFilter:"blur(12px)",
            maxWidth:320,
            animation:"fadeInUp 0.3s ease",
          }}>
            {toast.type==="success" ? "✅ " : toast.type==="error" ? "❌ " : "ℹ️ "}{toast.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export const useToast = () => useContext(ToastContext);
