// ============================================================
//  SDUCS – MK  |  React Web App Root
// ============================================================
import React, { Suspense, lazy } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { ThemeProvider } from "./context/ThemeContext";
import { ToastProvider } from "./context/ToastContext";
import Layout from "./components/Layout";
import LoadingScreen from "./components/LoadingScreen";

// Lazy-load pages
const Auth        = lazy(() => import("./pages/Auth"));
const Dashboard   = lazy(() => import("./pages/Dashboard"));
const FileManager = lazy(() => import("./pages/FileManager"));
const Downloads   = lazy(() => import("./pages/Downloads"));
const Plans       = lazy(() => import("./pages/Plans"));
const Payment     = lazy(() => import("./pages/Payment"));
const RecycleBin  = lazy(() => import("./pages/RecycleBin"));
const Settings    = lazy(() => import("./pages/Settings"));
const AdminPanel  = lazy(() => import("./pages/AdminPanel"));
const ShareViewer = lazy(() => import("./pages/ShareViewer"));

function ProtectedRoute({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <LoadingScreen />;
  if (!user) return <Navigate to="/auth" replace />;
  return children;
}

function AdminRoute({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <LoadingScreen />;
  if (!user?.isAdmin) return <Navigate to="/dashboard" replace />;
  return children;
}

function PublicRoute({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <LoadingScreen />;
  if (user) return <Navigate to="/dashboard" replace />;
  return children;
}

function AppRoutes() {
  return (
    <Suspense fallback={<LoadingScreen />}>
      <Routes>
        {/* Public */}
        <Route path="/" element={<Navigate to="/auth" replace />} />
        <Route path="/auth" element={<PublicRoute><Auth /></PublicRoute>} />
        <Route path="/share/:token" element={<ShareViewer />} />

        {/* Protected */}
        <Route element={<ProtectedRoute><Layout /></ProtectedRoute>}>
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/files" element={<FileManager />} />
          <Route path="/downloads" element={<Downloads />} />
          <Route path="/plans" element={<Plans />} />
          <Route path="/payment/:plan" element={<Payment />} />
          <Route path="/recycle-bin" element={<RecycleBin />} />
          <Route path="/settings" element={<Settings />} />
        </Route>

        {/* Admin */}
        <Route path="/admin/*" element={<AdminRoute><AdminPanel /></AdminRoute>} />

        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </Suspense>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <ThemeProvider>
        <ToastProvider>
          <AuthProvider>
            <AppRoutes />
          </AuthProvider>
        </ToastProvider>
      </ThemeProvider>
    </BrowserRouter>
  );
}
