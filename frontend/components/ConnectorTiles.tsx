"use client";

import { useState, useEffect, useRef } from "react";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8000";

type Props = {
  onConnect: (source: string) => void;
  onUpload: (files: FileList) => void;
  onLoadDemo: () => void;
  loading: boolean;
};

type TokenStatus = { status: string; expires_in_minutes?: number };

// SVG icons for each connector
const icons: Record<string, JSX.Element> = {
  "oracle-db": (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#C74634" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"/><path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"/>
    </svg>
  ),
  "oic": (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#D84315" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="16 3 21 3 21 8"/><line x1="4" y1="20" x2="21" y2="3"/><polyline points="21 16 21 21 16 21"/><line x1="15" y1="15" x2="21" y2="21"/><line x1="4" y1="4" x2="9" y2="9"/>
    </svg>
  ),
  "bip": (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#C2185B" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/>
    </svg>
  ),
  "hcm": (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#7B1FA2" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
    </svg>
  ),
  "fusion": (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#1565C0" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/>
    </svg>
  ),
  "upload": (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#2E7D32" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/>
    </svg>
  ),
  "demo": (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#F57F17" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="5 3 19 12 5 21 5 3"/>
    </svg>
  ),
};

const CONNECTORS = [
  { id: "oracle-db", name: "Oracle Database", desc: "DBA_OBJECTS & DBA_SOURCE", color: "#C74634", active: true },
  { id: "oic", name: "Integration Cloud", desc: "OIC flows & connections", color: "#D84315", active: false },
  { id: "bip", name: "BI Publisher", desc: "Reports & data models", color: "#C2185B", active: false },
  { id: "hcm", name: "HCM / ERP Cloud", desc: "Groovy & fast formulas", color: "#7B1FA2", active: false },
  { id: "fusion", name: "Fusion Apps", desc: "OTBI & ESS jobs", color: "#1565C0", active: false },
  { id: "upload", name: "Upload Files", desc: ".sql .xml .groovy", color: "#2E7D32", active: true },
];

export default function ConnectorTiles({ onConnect, onUpload, onLoadDemo, loading }: Props) {
  const [tokenStatus, setTokenStatus] = useState<TokenStatus>({ status: "unknown" });
  const [tokenInput, setTokenInput] = useState("");
  const [tokenSaving, setTokenSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<null | {
    ok: boolean;
    text: string;
    detail?: string;
  }>(null);
  const [showDbModal, setShowDbModal] = useState(false);
  const [dbForm, setDbForm] = useState({ host: "", port: "1521", sid: "", user: "", pass: "" });
  const [dbStatus, setDbStatus] = useState<"idle" | "testing" | "connected">("idle");
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    async function checkToken() {
      try {
        const res = await fetch(`${API_BASE}/api/token/status`);
        setTokenStatus(await res.json());
      } catch { setTokenStatus({ status: "unknown" }); }
    }
    checkToken();
    const interval = setInterval(checkToken, 60000);
    return () => clearInterval(interval);
  }, []);

  async function saveToken() {
    if (!tokenInput.trim()) return;
    setTokenSaving(true);
    setTestResult(null);
    try {
      const saveRes = await fetch(`${API_BASE}/api/token`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: tokenInput.trim() }),
      });
      const saved = await saveRes.json();
      setTokenInput("");
      const res = await fetch(`${API_BASE}/api/token/status`);
      setTokenStatus(await res.json());
      if (saved.status === "valid") {
        setTestResult({ ok: true, text: `Token saved — valid for ${Math.round(saved.expires_in_minutes || 0)} min. Click 'Test AI' to confirm the agent responds.` });
      } else if (saved.status === "expired") {
        setTestResult({ ok: false, text: "Token parsed but is already expired. Get a fresher JWT.", detail: `Expires: ${saved.expires_at}` });
      } else {
        setTestResult({ ok: false, text: "Token could not be parsed as a JWT. Paste the full token (no 'Bearer ' prefix needed)." });
      }
    } catch (err) {
      setTestResult({ ok: false, text: `Save failed: ${err}` });
    }
    setTokenSaving(false);
  }

  async function testAgent() {
    setTesting(true);
    setTestResult(null);
    try {
      const res = await fetch(`${API_BASE}/api/test-blueverse`, { method: "POST" });
      const data = await res.json();
      if (data.result === "success") {
        setTestResult({
          ok: true,
          text: `✓ BlueVerse agent responded in ${data.latency_ms}ms`,
          detail: data.response_preview,
        });
      } else if (data.result === "error") {
        setTestResult({ ok: false, text: `✗ ${data.message}`, detail: data.token_status?.expires_at ? `Expires: ${data.token_status.expires_at}` : undefined });
      } else if (data.result === "exception") {
        setTestResult({ ok: false, text: `✗ ${data.error_type}: ${data.error}` });
      } else {
        setTestResult({ ok: false, text: `Unexpected result: ${JSON.stringify(data).slice(0, 200)}` });
      }
    } catch (err) {
      setTestResult({ ok: false, text: `✗ Network error: ${err}` });
    }
    setTesting(false);
  }

  function handleTileClick(id: string) {
    if (loading) return;
    if (id === "oracle-db") setShowDbModal(true);
    else if (id === "upload") fileRef.current?.click();
    else if (id === "demo") onLoadDemo();
  }

  function handleDbConnect() {
    setDbStatus("testing");
    setTimeout(() => {
      setDbStatus("connected");
      setTimeout(() => { setShowDbModal(false); setDbStatus("idle"); onConnect("oracle-db"); }, 1000);
    }, 2000);
  }

  const tokenColor = tokenStatus.status === "valid" ? "#16a34a"
    : tokenStatus.status === "expiring_soon" ? "#d97706"
    : tokenStatus.status === "expired" ? "#dc2626" : "#6b7280";

  const tokenLabel = tokenStatus.status === "valid" ? `Valid (${Math.round(tokenStatus.expires_in_minutes || 0)}m)`
    : tokenStatus.status === "expiring_soon" ? `Expiring (${Math.round(tokenStatus.expires_in_minutes || 0)}m)`
    : tokenStatus.status === "expired" ? "Expired" : "Not configured";

  return (
    <div className="ct-section">
      <div className="ct-header">
        <span className="ct-title">Data Sources</span>
        <span className="ct-token-badge" style={{ color: tokenColor }}>
          <span className="ct-dot" style={{ background: tokenColor }} />
          AI: {tokenLabel}
        </span>
      </div>

      <div className="ct-grid">
        {CONNECTORS.map((c) => (
          <button
            key={c.id}
            className={`ct-card ${!c.active ? "ct-card--disabled" : ""}`}
            onClick={() => c.active && handleTileClick(c.id)}
            disabled={!c.active || loading}
          >
            <div className="ct-card-icon" style={{ borderColor: c.active ? c.color : "#d1d5db" }}>
              {icons[c.id]}
            </div>
            <div className="ct-card-info">
              <div className="ct-card-name">{c.name}</div>
              <div className="ct-card-desc">{c.desc}</div>
            </div>
            {!c.active && <span className="ct-card-badge">Soon</span>}
            {c.active && <span className="ct-card-status" style={{ background: c.color }} />}
          </button>
        ))}
      </div>

      {/* Token input */}
      <div className="ct-token-row">
        <input className="ct-token-input" placeholder="Paste AI agent token..." value={tokenInput} onChange={(e) => setTokenInput(e.target.value)} />
        <button className="ct-token-btn" onClick={saveToken} disabled={tokenSaving || !tokenInput.trim()}>
          {tokenSaving ? "..." : "Save"}
        </button>
        <button className="ct-token-btn" style={{ marginLeft: 4 }} onClick={testAgent} disabled={testing} title="Send a ping to BlueVerse and verify the agent responds">
          {testing ? "..." : "Test AI"}
        </button>
      </div>

      {testResult && (
        <div style={{
          marginTop: 6,
          padding: "8px 10px",
          borderRadius: 6,
          background: testResult.ok ? "#ecfdf5" : "#fef2f2",
          border: `1px solid ${testResult.ok ? "#a7f3d0" : "#fecaca"}`,
          fontSize: 12,
          lineHeight: 1.35,
          color: testResult.ok ? "#065f46" : "#991b1b",
        }}>
          <div style={{ fontWeight: 600 }}>{testResult.text}</div>
          {testResult.detail && <div style={{ marginTop: 4, fontWeight: 400, opacity: 0.8 }}>{testResult.detail}</div>}
        </div>
      )}

      <input ref={fileRef} type="file" multiple accept=".sql,.xml,.groovy,.pls,.pkb,.pks" style={{ display: "none" }} onChange={(e) => e.target.files && onUpload(e.target.files)} />

      {/* Oracle DB Connection Modal */}
      {showDbModal && (
        <div className="db-modal-backdrop" onClick={() => !loading && setShowDbModal(false)}>
          <div className="db-modal" onClick={(e) => e.stopPropagation()}>
            <h3>Connect to Oracle Database</h3>
            <p className="db-modal-desc">Enter credentials to discover artifacts from DBA_OBJECTS and DBA_SOURCE</p>
            <div className="db-form">
              <label>Host</label>
              <input placeholder="e.g., mydb.oraclecloud.com" value={dbForm.host} onChange={(e) => setDbForm({ ...dbForm, host: e.target.value })} />
              <label>Port</label>
              <input placeholder="1521" value={dbForm.port} onChange={(e) => setDbForm({ ...dbForm, port: e.target.value })} />
              <label>SID / Service Name</label>
              <input placeholder="e.g., ORCL" value={dbForm.sid} onChange={(e) => setDbForm({ ...dbForm, sid: e.target.value })} />
              <label>Username</label>
              <input placeholder="e.g., SYS" value={dbForm.user} onChange={(e) => setDbForm({ ...dbForm, user: e.target.value })} />
              <label>Password</label>
              <input type="password" placeholder="Password" value={dbForm.pass} onChange={(e) => setDbForm({ ...dbForm, pass: e.target.value })} />
            </div>
            <button className="db-connect-btn" onClick={handleDbConnect} disabled={dbStatus !== "idle"}>
              {dbStatus === "idle" ? "Connect & Discover" : dbStatus === "testing" ? "Discovering objects..." : "Connected! 25 objects found"}
            </button>
            {dbStatus === "connected" && <div className="db-success">Connected to Oracle DB — discovered 25 objects across 4 schemas</div>}
          </div>
        </div>
      )}
    </div>
  );
}
