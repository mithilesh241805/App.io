// ============================================================
//  SDUCS – MK  |  Auth Context
// ============================================================
import React, { createContext, useContext, useState, useEffect } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "../utils/firebase";
import { api } from "../utils/api";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        try {
          const token = localStorage.getItem("sducs_token");
          if (token) {
            const { data } = await api.get("/auth/me");
            setUser(data);
          } else {
            setUser(null);
          }
        } catch {
          localStorage.removeItem("sducs_token");
          setUser(null);
        }
      } else {
        localStorage.removeItem("sducs_token");
        setUser(null);
      }
      setLoading(false);
    });
    return unsub;
  }, []);

  const logout = async () => {
    try {
      await api.post("/auth/logout");
    } catch {}
    localStorage.removeItem("sducs_token");
    await auth.signOut();
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, setUser, logout, loading }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
};
