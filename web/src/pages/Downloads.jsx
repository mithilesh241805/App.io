// ============================================================
//  SDUCS – MK  |  Web Downloads Page
// ============================================================
import React, { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../utils/api'
import './Downloads.css'

const fmt = (b) => {
  if (!b) return '?'
  if (b >= 1e9) return (b / 1e9).toFixed(1) + ' GB'
  if (b >= 1e6) return (b / 1e6).toFixed(1) + ' MB'
  return (b / 1e3).toFixed(0) + ' KB'
}

const STATUS_ICON  = { queued:'⏳', downloading:'⬇️', completed:'✅', failed:'❌', cancelled:'🚫', paused:'⏸️' }
const STATUS_COLOR = { queued:'#f59e0b', downloading:'#818cf8', completed:'#34d399', failed:'#f87171', cancelled:'#9ca3af' }

export default function Downloads() {
  const navigate = useNavigate()
  const [url, setUrl]             = useState('')
  const [detected, setDetected]   = useState(null)
  const [detecting, setDetecting] = useState(false)
  const [starting, setStarting]   = useState(false)
  const [quality, setQuality]     = useState('best')
  const [jobs, setJobs]           = useState([])
  const [stats, setStats]         = useState(null)
  const pollRef = useRef(null)

  const QUALITIES = ['best','1080p','720p','480p','360p','audio_only','original']

  useEffect(() => {
    loadJobs()
    loadStats()
    // Poll every 4s for active downloads
    pollRef.current = setInterval(() => {
      loadJobs(true)
    }, 4000)
    return () => clearInterval(pollRef.current)
  }, [])

  const loadStats = async () => {
    try {
      const { data } = await api.get('/files/stats')
      setStats(data.downloadData)
    } catch {}
  }

  const loadJobs = async (silent = false) => {
    try {
      const { data } = await api.get('/downloads')
      setJobs(data.jobs || [])
    } catch {}
  }

  const detectURL = async () => {
    if (!url.trim()) return
    setDetecting(true)
    setDetected(null)
    try {
      const { data } = await api.post('/downloads/detect', { url: url.trim() })
      setDetected(data)
    } catch (err) {
      alert(err.response?.data?.error || 'Invalid URL or unreachable link.')
    } finally {
      setDetecting(false)
    }
  }

  const startDownload = async () => {
    if (!url.trim()) return
    setStarting(true)
    try {
      await api.post('/downloads/start', { url: url.trim(), quality })
      setUrl('')
      setDetected(null)
      setQuality('best')
      loadJobs()
      loadStats()
    } catch (err) {
      const msg = err.response?.data?.error || 'Download failed.'
      if (msg.includes('download data') || err.response?.status === 402) {
        if (confirm('Download data exhausted. Upgrade your plan?')) navigate('/plans')
      } else {
        alert(msg)
      }
    } finally {
      setStarting(false)
    }
  }

  const removeJob = async (id) => {
    try {
      await api.delete(`/downloads/${id}`)
      setJobs(j => j.filter(x => x._id !== id))
    } catch {}
  }

  const dataUsed    = stats?.used    || 0
  const dataTotal   = stats?.total   || 10 * 1e9
  const dataPct     = Math.min((dataUsed / dataTotal) * 100, 100).toFixed(1)
  const hasActive   = jobs.some(j => j.status === 'downloading')

  return (
    <div className="downloads-page">
      <div className="dl-header">
        <h1 className="dl-title">Download Manager</h1>
        <span className="dl-count">{jobs.length} jobs</span>
      </div>

      {/* Data Usage */}
      <div className="data-quota-card">
        <div className="dq-row">
          <span className="dq-label">⬇️  Download Data</span>
          <span className="dq-nums">{fmt(dataUsed)} <span>/ {fmt(dataTotal)}</span></span>
        </div>
        <div className="dq-bar">
          <div className="dq-fill" style={{
            width: `${dataPct}%`,
            background: dataPct > 80 ? 'linear-gradient(90deg,#f59e0b,#ef4444)' : 'linear-gradient(90deg,#5c6ee6,#34d399)'
          }} />
        </div>
        {dataPct > 80 && (
          <button className="dq-warn" onClick={() => navigate('/plans')}>
            ⚠️ Running low — Upgrade plan →
          </button>
        )}
      </div>

      {/* URL Input */}
      <div className="dl-input-card">
        <h3 className="dic-title">New Download</h3>
        <div className="url-row">
          <input
            className="url-input"
            type="url"
            placeholder="Paste direct download URL here…"
            value={url}
            onChange={e => { setUrl(e.target.value); setDetected(null) }}
            onKeyDown={e => e.key === 'Enter' && detectURL()}
          />
          <button className="detect-btn" onClick={detectURL} disabled={detecting || !url.trim()}>
            {detecting ? <span className="spinner" /> : '🔍'}
          </button>
        </div>

        {/* Detected file info */}
        {detected && (
          <div className="detected-info">
            <div className="di-left">
              <span className="di-icon">{detected.icon || '📁'}</span>
              <div>
                <p className="di-name">{detected.fileName}</p>
                <p className="di-meta">{detected.mimeType} · {fmt(detected.estimatedSize)}</p>
              </div>
            </div>
            {detected.hasQualityOptions && (
              <div className="quality-row">
                <span className="q-label">Quality:</span>
                {QUALITIES.map(q => (
                  <button key={q} className={`q-pill ${quality === q ? 'active' : ''}`} onClick={() => setQuality(q)}>{q}</button>
                ))}
              </div>
            )}
          </div>
        )}

        <button className="dl-start-btn" onClick={startDownload} disabled={starting || !url.trim()}>
          {starting ? <><span className="spinner" /> Starting…</> : '⬇️  Start Download'}
        </button>
      </div>

      {/* Jobs */}
      {jobs.length > 0 && (
        <div className="jobs-section">
          <div className="js-header">
            <h3>Download History</h3>
            <button className="js-refresh" onClick={() => loadJobs()}>↻ Refresh</button>
          </div>
          <div className="jobs-list">
            {jobs.map(job => (
              <div key={job._id} className="job-card">
                <div className="jc-top">
                  <span className="jc-status-icon">{STATUS_ICON[job.status] || '📋'}</span>
                  <div className="jc-info">
                    <p className="jc-name">{job.fileName || job.url}</p>
                    <p className="jc-meta">
                      {job.sizeBytes ? fmt(job.sizeBytes) : 'detecting…'}
                      {job.speedBps > 0 && ` · ${fmt(job.speedBps)}/s`}
                    </p>
                  </div>
                  <span className="jc-badge" style={{ color: STATUS_COLOR[job.status] || '#9ca3af' }}>
                    {job.status}
                  </span>
                  <button className="jc-del" onClick={() => removeJob(job._id)}>✕</button>
                </div>
                {job.status === 'downloading' && (
                  <div className="jc-progress">
                    <div className="jp-bar">
                      <div className="jp-fill" style={{ width: `${job.progressPercent || 0}%` }} />
                    </div>
                    <span className="jp-pct">{job.progressPercent || 0}%</span>
                  </div>
                )}
                {job.status === 'failed' && job.errorMessage && (
                  <p className="jc-error">{job.errorMessage}</p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
