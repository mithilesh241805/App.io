// ============================================================
//  SDUCS – MK  |  File Manager Page
// ============================================================
import React, { useState, useEffect, useRef, useCallback } from "react";
import { useSearchParams } from "react-router-dom";
import { api } from "../utils/api";
import "./FileManager.css";

const CATEGORIES = ["all","image","video","audio","document","archive","other"];
const CATEGORY_ICONS = { image:"🖼️", video:"🎬", audio:"🎵", document:"📄", archive:"📦", other:"📁" };

const fmt = (b) => b >= 1e9 ? (b/1e9).toFixed(1)+"GB" : b >= 1e6 ? (b/1e6).toFixed(1)+"MB" : (b/1e3).toFixed(0)+"KB";

function FileCard({ file, onDelete, onShare, onRestore, inBin }) {
  const [menu, setMenu] = useState(false);
  const icon = CATEGORY_ICONS[file.category] || "📁";

  return (
    <div className="file-card">
      <div className="fc-thumb">
        {file.mimeType?.startsWith("image/") && file.downloadURL
          ? <img src={file.downloadURL} alt={file.originalName} className="fc-img" />
          : <span className="fc-icon-big">{icon}</span>}
      </div>
      <div className="fc-body">
        <p className="fc-name" title={file.originalName}>{file.originalName}</p>
        <p className="fc-meta">{fmt(file.sizeBytes)} · {new Date(file.createdAt).toLocaleDateString()}</p>
        {file.aiTags?.length > 0 && (
          <div className="fc-tags">
            {file.aiTags.slice(0,3).map(t => <span key={t} className="fc-tag">{t}</span>)}
          </div>
        )}
      </div>
      <div className="fc-actions">
        {!inBin && (
          <>
            <button className="fa-btn" onClick={() => onShare(file)} title="Share">🔗</button>
            <button className="fa-btn" onClick={() => onDelete(file._id)} title="Delete">🗑️</button>
          </>
        )}
        {inBin && (
          <>
            <button className="fa-btn restore" onClick={() => onRestore(file._id)} title="Restore">↩️</button>
            <button className="fa-btn danger" onClick={() => onDelete(file._id, true)} title="Delete Forever">💀</button>
          </>
        )}
      </div>
    </div>
  );
}

function UploadZone({ onUpload }) {
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const inputRef = useRef();

  const doUpload = async (files) => {
    if (!files.length) return;
    setUploading(true);
    setProgress(0);
    for (let i = 0; i < files.length; i++) {
      const fd = new FormData();
      fd.append("file", files[i]);
      try {
        await api.post("/files/upload", fd, {
          headers: { "Content-Type": "multipart/form-data" },
          onUploadProgress: (e) => setProgress(Math.round((e.loaded / e.total) * 100)),
        });
        setProgress(100);
      } catch (err) {
        const msg = err.response?.data?.error || "Upload failed.";
        alert(msg);
      }
    }
    setUploading(false);
    setProgress(0);
    onUpload();
  };

  return (
    <div
      className={`upload-zone ${dragging ? "drag-over" : ""}`}
      onDragEnter={(e) => { e.preventDefault(); setDragging(true); }}
      onDragLeave={() => setDragging(false)}
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => { e.preventDefault(); setDragging(false); doUpload([...e.dataTransfer.files]); }}
      onClick={() => !uploading && inputRef.current.click()}
    >
      <input ref={inputRef} type="file" multiple style={{ display: "none" }} onChange={(e) => doUpload([...e.target.files])} />
      {uploading ? (
        <div className="upload-prog">
          <div className="up-bar"><div className="up-fill" style={{ width: `${progress}%` }} /></div>
          <span className="up-label">Uploading… {progress}%</span>
        </div>
      ) : (
        <>
          <div className="uz-icon">{dragging ? "📂" : "☁️"}</div>
          <p className="uz-text">{dragging ? "Drop files here" : "Drag & drop or click to upload"}</p>
          <p className="uz-sub">Files are AES-256 encrypted automatically</p>
        </>
      )}
    </div>
  );
}

function ShareModal({ file, onClose }) {
  const [link, setLink] = useState("");
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);

  const generate = async (withCode) => {
    setLoading(true);
    try {
      const { data } = await api.post(`/files/${file._id}/share`, {
        expiresIn: 24,
        generateCode: withCode,
      });
      setLink(data.shareLink);
      if (data.accessCode) setCode(data.accessCode);
    } catch (err) {
      alert("Failed to generate share link.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box" onClick={(e) => e.stopPropagation()}>
        <h3 className="modal-title">Share "{file.originalName}"</h3>
        <div className="share-btns">
          <button className="share-opt" onClick={() => generate(false)} disabled={loading}>🔗 Get Share Link</button>
          <button className="share-opt" onClick={() => generate(true)} disabled={loading}>🔐 Link + 6-Digit Code</button>
        </div>
        {link && (
          <div className="share-result">
            <label>Share Link</label>
            <div className="copy-row">
              <input readOnly value={link} />
              <button onClick={() => navigator.clipboard.writeText(link)}>Copy</button>
            </div>
            {code && (
              <div className="code-display">
                <label>Access Code (share separately)</label>
                <div className="code-digits">
                  {code.split("").map((d, i) => <span key={i}>{d}</span>)}
                </div>
                <p className="code-note">⚠️ This code is shown only once. Note it down.</p>
              </div>
            )}
          </div>
        )}
        <button className="modal-close" onClick={onClose}>Close</button>
      </div>
    </div>
  );
}

export default function FileManager() {
  const [searchParams] = useSearchParams();
  const defaultTab = searchParams.get("tab") || "files";
  const [tab, setTab] = useState(defaultTab);
  const [category, setCategory] = useState("all");
  const [search, setSearch] = useState("");
  const [files, setFiles] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [shareFile, setShareFile] = useState(null);
  const [duplicates, setDuplicates] = useState([]);
  const [aiSuggestions, setAiSuggestions] = useState(null);
  const [aiLoading, setAiLoading] = useState(false);

  const loadFiles = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page, limit: 20 });
      if (category !== "all") params.append("category", category);
      if (search) params.append("search", search);
      if (tab === "bin") params.append("deleted", "true");

      const { data } = await api.get(`/files?${params}`);
      setFiles(data.files || []);
      setTotal(data.total || 0);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [tab, category, search, page]);

  const loadDuplicates = useCallback(async () => {
    try {
      const { data } = await api.get("/files/duplicates");
      setDuplicates(data.groups || []);
    } catch {}
  }, []);

  const loadAI = async () => {
    setAiLoading(true);
    try {
      const { data } = await api.post("/ai/storage-optimization");
      setAiSuggestions(data);
    } catch { alert("AI analysis failed."); }
    finally { setAiLoading(false); }
  };

  useEffect(() => {
    if (tab === "duplicates") loadDuplicates();
    else loadFiles();
  }, [tab, loadFiles, loadDuplicates]);

  const handleDelete = async (id, permanent = false) => {
    if (!confirm(permanent ? "Permanently delete? This cannot be undone." : "Move to recycle bin?")) return;
    try {
      await api.delete(`/files/${id}${permanent ? "?permanent=true" : ""}`);
      loadFiles();
    } catch { alert("Delete failed."); }
  };

  const handleRestore = async (id) => {
    try {
      await api.post(`/files/${id}/restore`);
      loadFiles();
    } catch { alert("Restore failed."); }
  };

  const tabs = [
    { id: "files", label: "📁 My Files" },
    { id: "duplicates", label: "🔁 Duplicates" },
    { id: "ai", label: "🤖 AI Optimize" },
    { id: "bin", label: "🗑️ Recycle Bin" },
  ];

  return (
    <div className="file-manager">
      <div className="fm-header">
        <h1 className="fm-title">File Manager</h1>
        <span className="fm-count">{total} files</span>
      </div>

      {/* Tabs */}
      <div className="fm-tabs">
        {tabs.map(t => (
          <button key={t.id} className={`fm-tab ${tab === t.id ? "active" : ""}`} onClick={() => setTab(t.id)}>
            {t.label}
          </button>
        ))}
      </div>

      {/* Files Tab */}
      {(tab === "files" || tab === "bin") && (
        <>
          <UploadZone onUpload={loadFiles} />

          {/* Filters */}
          <div className="fm-filters">
            <input
              className="fm-search"
              placeholder="🔍 Search files…"
              value={search}
              onChange={e => { setSearch(e.target.value); setPage(1); }}
            />
            <div className="cat-pills">
              {CATEGORIES.map(c => (
                <button key={c} className={`cat-pill ${category === c ? "active" : ""}`} onClick={() => { setCategory(c); setPage(1); }}>
                  {c === "all" ? "All" : `${CATEGORY_ICONS[c]} ${c}`}
                </button>
              ))}
            </div>
          </div>

          {loading ? (
            <div className="fm-loading">Loading files…</div>
          ) : files.length === 0 ? (
            <div className="fm-empty">
              <span>{tab === "bin" ? "🗑️ Recycle bin is empty" : "📭 No files yet. Upload your first file!"}</span>
            </div>
          ) : (
            <div className="files-grid">
              {files.map(f => (
                <FileCard key={f._id} file={f} inBin={tab === "bin"} onDelete={handleDelete} onShare={setShareFile} onRestore={handleRestore} />
              ))}
            </div>
          )}

          {/* Pagination */}
          {total > 20 && (
            <div className="fm-pagination">
              <button disabled={page === 1} onClick={() => setPage(p => p - 1)}>← Prev</button>
              <span>Page {page}</span>
              <button disabled={files.length < 20} onClick={() => setPage(p => p + 1)}>Next →</button>
            </div>
          )}
        </>
      )}

      {/* Duplicates Tab */}
      {tab === "duplicates" && (
        <div className="dup-section">
          {duplicates.length === 0 ? (
            <div className="fm-empty">✅ No duplicate files found!</div>
          ) : (
            <>
              <p className="dup-info">Found {duplicates.length} groups of duplicate files. Delete the extras to save space.</p>
              {duplicates.map((g, i) => (
                <div key={i} className="dup-group">
                  <div className="dg-header">
                    <span className="dg-hash">Hash: {g._id?.slice(0,12)}…</span>
                    <span className="dg-count">{g.count} copies · Save {fmt(g.files[0]?.sizeBytes * (g.count - 1))}</span>
                  </div>
                  {g.files.map(f => (
                    <div key={f._id} className="dg-file">
                      <span className="dg-name">{f.originalName}</span>
                      <span className="dg-size">{fmt(f.sizeBytes)}</span>
                      <button className="dg-del" onClick={() => handleDelete(f._id)}>Delete</button>
                    </div>
                  ))}
                </div>
              ))}
            </>
          )}
        </div>
      )}

      {/* AI Optimize Tab */}
      {tab === "ai" && (
        <div className="ai-section">
          <button className="ai-scan-btn" onClick={loadAI} disabled={aiLoading}>
            {aiLoading ? "🤖 Analyzing…" : "🤖 Run AI Storage Analysis"}
          </button>
          {aiSuggestions && (
            <div className="ai-results">
              <div className="ai-score">
                <span>Storage Health Score</span>
                <strong style={{ color: aiSuggestions.storageScore >= 70 ? "#34d399" : "#f59e0b" }}>
                  {aiSuggestions.storageScore}/100
                </strong>
              </div>
              <p className="ai-summary">{aiSuggestions.summary}</p>
              <div className="ai-recs">
                {aiSuggestions.recommendations?.map((r, i) => (
                  <div key={i} className={`ai-rec priority-${r.priority}`}>
                    <div className="ar-header">
                      <span className="ar-priority">{r.priority}</span>
                      <span className="ar-title">{r.title}</span>
                      {r.estimatedSavingsMB > 0 && <span className="ar-savings">Save ~{r.estimatedSavingsMB} MB</span>}
                    </div>
                    <p className="ar-desc">{r.description}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {shareFile && <ShareModal file={shareFile} onClose={() => setShareFile(null)} />}
    </div>
  );
}
