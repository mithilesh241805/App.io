// ============================================================
//  SDUCS – MK  |  Dashboard Page
// ============================================================
import React, { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { api } from "../utils/api";
import "./Dashboard.css";

const fmt = (bytes) => {
  if (bytes >= 1e9) return (bytes / 1e9).toFixed(1) + " GB";
  if (bytes >= 1e6) return (bytes / 1e6).toFixed(1) + " MB";
  if (bytes >= 1e3) return (bytes / 1e3).toFixed(1) + " KB";
  return bytes + " B";
};

function CircleProgress({ percent, color, size = 120 }) {
  const r = (size - 16) / 2;
  const circ = 2 * Math.PI * r;
  const offset = circ - (Math.min(parseFloat(percent) || 0, 100) / 100) * circ;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth="8" />
      <circle
        cx={size/2} cy={size/2} r={r}
        fill="none" stroke={color} strokeWidth="8"
        strokeDasharray={circ} strokeDashoffset={offset}
        strokeLinecap="round"
        transform={`rotate(-90 ${size/2} ${size/2})`}
        style={{ transition: "stroke-dashoffset 1s cubic-bezier(0.4,0,0.2,1)" }}
      />
    </svg>
  );
}

function StatCard({ icon, label, used, total, percent, color, href, tag }) {
  const navigate = useNavigate();
  return (
    <div className="stat-card" onClick={() => navigate(href)} style={{ cursor: "pointer" }}>
      {tag && <span className="stat-tag">{tag}</span>}
      <div className="stat-chart">
        <CircleProgress percent={percent} color={color} />
        <div className="stat-pct" style={{ color }}>{percent}%</div>
      </div>
      <div className="stat-info">
        <div className="stat-icon">{icon}</div>
        <div className="stat-label">{label}</div>
        <div className="stat-numbers">
          <span className="stat-used" style={{ color }}>{fmt(used)}</span>
          <span className="stat-sep"> / </span>
          <span className="stat-total">{fmt(total)}</span>
        </div>
      </div>
    </div>
  );
}

function AdRewardCard({ status, onWatchAd, loading }) {
  const pct = status ? Math.round((status.dailyAdsWatched / status.dailyAdsLimit) * 100) : 0;
  return (
    <div className="reward-card">
      <div className="reward-header">
        <span className="reward-title">📺 Daily Ad Rewards</span>
        <span className="reward-sub">Earn storage by watching ads</span>
      </div>
      <div className="reward-progress">
        <div className="rp-bar">
          <div className="rp-fill" style={{ width: `${pct}%` }} />
        </div>
        <span className="rp-label">{status?.dailyAdsWatched || 0} / {status?.dailyAdsLimit || 10} ads today</span>
      </div>
      <div className="reward-range">
        Earn <strong>100–500 MB</strong> per ad · Max <strong>2 GB/day</strong>
      </div>
      <button
        className="watch-btn"
        onClick={onWatchAd}
        disabled={!status?.canWatch || loading}
      >
        {loading ? <span className="spinner-sm" /> : "▶ Watch Ad & Earn"}
      </button>
    </div>
  );
}

function PlanBadge({ subscription }) {
  if (!subscription?.plan || subscription.plan === "none") return null;
  const colors = { lite: "#60a5fa", premium: "#34d399", pro: "#f59e0b", promax: "#f472b6" };
  return (
    <div className="plan-badge" style={{ borderColor: colors[subscription.plan] }}>
      <span style={{ color: colors[subscription.plan] }}>
        ✦ {subscription.planLabel || subscription.plan.toUpperCase()} Plan
      </span>
      {subscription.expiresAt && (
        <span className="plan-exp">
          Expires {new Date(subscription.expiresAt).toLocaleDateString()}
        </span>
      )}
    </div>
  );
}

export default function Dashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [stats, setStats] = useState(null);
  const [adStatus, setAdStatus] = useState(null);
  const [adLoading, setAdLoading] = useState(false);
  const [recentFiles, setRecentFiles] = useState([]);

  const loadData = useCallback(async () => {
    try {
      const [statsRes, adRes, filesRes] = await Promise.all([
        api.get("/files/stats"),
        api.get("/ads/status"),
        api.get("/files?limit=5"),
      ]);
      setStats(statsRes.data);
      setAdStatus(adRes.data);
      setRecentFiles(filesRes.data.files || []);
    } catch (err) {
      console.error("Dashboard load error:", err);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const handleWatchAd = async () => {
    setAdLoading(true);
    try {
      const { data } = await api.post("/ads/initiate");
      // In production: trigger AdMob SDK here with data.adUnitId
      // Simulating ad completion after 5s for web demo
      await new Promise(r => setTimeout(r, 3000));
      const reward = await api.post("/ads/complete", { token: data.token, rewardType: "storage" });
      alert(`🎉 ${reward.data.message}`);
      loadData();
    } catch (err) {
      alert(err.response?.data?.error || "Ad reward failed.");
    } finally {
      setAdLoading(false);
    }
  };

  const greeting = () => {
    const h = new Date().getHours();
    if (h < 12) return "Good morning";
    if (h < 17) return "Good afternoon";
    return "Good evening";
  };

  return (
    <div className="dashboard">
      {/* Header */}
      <div className="dash-header">
        <div>
          <h1 className="dash-greeting">
            {greeting()}, <span>{user?.displayName?.split(" ")[0] || "there"} 👋</span>
          </h1>
          <p className="dash-sub">Here's your SDUCS-MK overview</p>
        </div>
        <PlanBadge subscription={user?.subscription} />
      </div>

      {/* Stat Cards */}
      <div className="stats-grid">
        <StatCard
          icon="☁️"
          label="Cloud Storage"
          used={stats?.storage?.used || 0}
          total={stats?.storage?.total || 30 * 1e9}
          percent={stats?.storage?.percent || 0}
          color="#818cf8"
          href="/files"
          tag="STORAGE"
        />
        <StatCard
          icon="⬇️"
          label="Download Data"
          used={stats?.downloadData?.used || 0}
          total={stats?.downloadData?.total || 10 * 1e9}
          percent={stats?.downloadData?.percent || 0}
          color="#34d399"
          href="/downloads"
          tag="DATA"
        />
      </div>

      {/* Reward + Quick Actions */}
      <div className="dash-bottom">
        <AdRewardCard status={adStatus} onWatchAd={handleWatchAd} loading={adLoading} />

        <div className="quick-actions">
          <h3 className="qa-title">Quick Actions</h3>
          <div className="qa-grid">
            {[
              { icon: "⬆️", label: "Upload File", href: "/files" },
              { icon: "⬇️", label: "Download Manager", href: "/downloads" },
              { icon: "🔍", label: "Find Duplicates", href: "/files?tab=duplicates" },
              { icon: "💎", label: "Upgrade Plan", href: "/plans" },
              { icon: "🗑️", label: "Recycle Bin", href: "/recycle-bin" },
              { icon: "🤖", label: "AI Optimize", href: "/files?tab=ai" },
            ].map(a => (
              <button key={a.href} className="qa-btn" onClick={() => navigate(a.href)}>
                <span className="qa-icon">{a.icon}</span>
                <span className="qa-label">{a.label}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Recent Files */}
      {recentFiles.length > 0 && (
        <div className="recent-files">
          <div className="rf-header">
            <h3>Recent Files</h3>
            <button className="rf-more" onClick={() => navigate("/files")}>View All →</button>
          </div>
          <div className="rf-list">
            {recentFiles.map(f => (
              <div key={f._id} className="rf-item">
                <div className="rf-icon">
                  { f.category === "image" ? "🖼️" : f.category === "video" ? "🎬" :
                    f.category === "audio" ? "🎵" : f.category === "document" ? "📄" : "📁" }
                </div>
                <div className="rf-info">
                  <span className="rf-name">{f.originalName}</span>
                  <span className="rf-meta">{fmt(f.sizeBytes)} · {new Date(f.createdAt).toLocaleDateString()}</span>
                </div>
                <span className="rf-cat">{f.category}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
