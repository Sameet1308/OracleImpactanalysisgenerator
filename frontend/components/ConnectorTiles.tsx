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

type Connector = {
  id: string;
  name: string;
  desc: string;
  color: string;
  active: boolean;
  future?: string;
};

const CONNECTORS: Connector[] = [
  { id: "oracle-db", name: "Oracle Database", desc: "DBA_OBJECTS & DBA_SOURCE", color: "#C74634", active: true },
  {
    id: "oic", name: "Integration Cloud", desc: "OIC flows & connections", color: "#D84315", active: false,
    future: "Coming soon: direct REST pull from OIC. We'll fetch integration flows, connections, lookups, and schedules via OIC REST API, then parse them into the dependency graph automatically — no manual exports.",
  },
  {
    id: "bip", name: "BI Publisher", desc: "Reports & data models", color: "#C2185B", active: false,
    future: "Coming soon: BIP catalog crawler. We'll index your BI Publisher reports, data models, and SQL queries, then link them to the source tables in the graph to surface report-level blast radius.",
  },
  {
    id: "hcm", name: "HCM / ERP Cloud", desc: "Groovy & fast formulas", color: "#7B1FA2", active: false,
    future: "Coming soon: Fusion HCM / ERP Cloud integration. We'll pull Groovy scripts, fast formulas, flexfields, and BIP-HCM reports directly from your Fusion pod — with SSO / OAuth2 auth.",
  },
  {
    id: "fusion", name: "Fusion Apps", desc: "OTBI & ESS jobs", color: "#1565C0", active: false,
    future: "Coming soon: Fusion Apps metadata. OTBI subject-area dependencies, ESS scheduled jobs, REST services, and approval workflows — all linked in the graph.",
  },
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
  const [showTokenModal, setShowTokenModal] = useState(false);
  const [hoverTile, setHoverTile] = useState<string | null>(null);
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

  async function pingAgent(): Promise<{ ok: boolean; text: string; detail?: string }> {
    try {
      const res = await fetch(`${API_BASE}/api/test-blueverse`, { method: "POST" });
      const data = await res.json();
      if (data.result === "success") {
        return {
          ok: true,
          text: `✓ BlueVerse agent replied in ${data.latency_ms}ms (token valid for ${Math.round(data.token_status?.expires_in_minutes || 0)} min)`,
          detail: data.response_preview,
        };
      }
      if (data.result === "error") {
        return {
          ok: false,
          text: `✗ ${data.message}`,
          detail: data.token_status?.expires_at ? `Token expiry: ${data.token_status.expires_at}` : undefined,
        };
      }
      if (data.result === "exception") {
        return { ok: false, text: `✗ ${data.error_type}: ${data.error}` };
      }
      return { ok: false, text: `Unexpected: ${JSON.stringify(data).slice(0, 200)}` };
    } catch (err) {
      return { ok: false, text: `✗ Network error: ${err}` };
    }
  }

  async function saveAndTest() {
    if (!tokenInput.trim()) return;
    setTokenSaving(true);
    setTestResult({ ok: true, text: "Saving token..." });
    try {
      const saveRes = await fetch(`${API_BASE}/api/token`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: tokenInput.trim() }),
      });
      const saved = await saveRes.json();
      const statusRes = await fetch(`${API_BASE}/api/token/status`);
      setTokenStatus(await statusRes.json());

      if (saved.status !== "valid") {
        if (saved.status === "expired") {
          setTestResult({
            ok: false,
            text: `✗ Token parsed but is already expired (expired ${Math.abs(Math.round(saved.expires_in_minutes || 0))} min ago).`,
            detail: `Get a fresh JWT — they only live 25 minutes. Expires: ${saved.expires_at}`,
          });
        } else {
          setTestResult({
            ok: false,
            text: "✗ Token could not be parsed as a JWT.",
            detail: "Paste the full token (the part after 'Bearer ' if you copied that). Current length: " + (saved.token_length || 0),
          });
        }
        setTokenSaving(false);
        return;
      }

      setTestResult({ ok: true, text: `Token saved (valid ${Math.round(saved.expires_in_minutes || 0)} min). Pinging BlueVerse...` });
      const ping = await pingAgent();
      setTestResult(ping);
      if (ping.ok) setTokenInput("");
    } catch (err) {
      setTestResult({ ok: false, text: `Save failed: ${err}` });
    }
    setTokenSaving(false);
  }

  async function testOnly() {
    setTesting(true);
    setTestResult({ ok: true, text: "Pinging BlueVerse..." });
    const ping = await pingAgent();
    setTestResult(ping);
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
        <button
          className="ct-token-badge"
          onClick={() => setShowTokenModal(true)}
          style={{
            color: tokenColor,
            background: "transparent",
            border: `1px solid ${tokenColor}33`,
            padding: "3px 8px",
            borderRadius: 12,
            cursor: "pointer",
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            fontSize: 12,
            fontWeight: 500,
          }}
          title="Manage BlueVerse token — paste fresh JWT + test agent"
        >
          <span className="ct-dot" style={{ background: tokenColor }} />
          AI: {tokenLabel}
        </button>
      </div>

      <div className="ct-grid">
        {CONNECTORS.map((c) => (
          <div
            key={c.id}
            style={{ position: "relative" }}
            onMouseEnter={() => !c.active && c.future && setHoverTile(c.id)}
            onMouseLeave={() => setHoverTile((prev) => (prev === c.id ? null : prev))}
          >
            <button
              className={`ct-card ${!c.active ? "ct-card--disabled" : ""}`}
              onClick={() => c.active && handleTileClick(c.id)}
              disabled={!c.active || loading}
              style={{ width: "100%" }}
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

            {hoverTile === c.id && c.future && (
              <div style={{
                position: "absolute",
                top: "100%",
                left: 0,
                right: 0,
                marginTop: 6,
                background: "#111827",
                color: "#f9fafb",
                padding: "10px 12px",
                borderRadius: 8,
                fontSize: 11,
                lineHeight: 1.45,
                boxShadow: "0 8px 24px rgba(0,0,0,0.25)",
                zIndex: 50,
                pointerEvents: "none",
              }}>
                <div style={{
                  position: "absolute", top: -5, left: 20,
                  width: 10, height: 10, background: "#111827",
                  transform: "rotate(45deg)",
                }} />
                <div style={{ fontWeight: 600, color: c.color, marginBottom: 4, fontSize: 11, textTransform: "uppercase", letterSpacing: 0.3 }}>
                  Roadmap
                </div>
                {c.future}
              </div>
            )}
          </div>
        ))}
      </div>

      <input ref={fileRef} type="file" multiple accept=".sql,.xml,.groovy,.pls,.pkb,.pks" style={{ display: "none" }} onChange={(e) => e.target.files && onUpload(e.target.files)} />

      {/* BlueVerse Token Modal */}
      {showTokenModal && (
        <div
          className="db-modal-backdrop"
          onClick={() => !tokenSaving && setShowTokenModal(false)}
          style={{
            position: "fixed", inset: 0, background: "rgba(17, 24, 39, 0.5)",
            display: "flex", alignItems: "center", justifyContent: "center",
            zIndex: 1000, padding: 16,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: "white", borderRadius: 12, width: "min(560px, 94vw)",
              maxHeight: "90vh", overflow: "auto", boxShadow: "0 20px 40px rgba(0,0,0,0.15)",
              padding: 24,
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
              <div>
                <h3 style={{ margin: 0, fontSize: 18, fontWeight: 600, color: "#111827" }}>
                  BlueVerse Agent Token
                </h3>
                <p style={{ margin: "4px 0 0 0", fontSize: 12, color: "#6b7280" }}>
                  Paste a fresh JWT (25-min lifetime) and click Save &amp; Test.
                </p>
              </div>
              <button
                onClick={() => setShowTokenModal(false)}
                style={{
                  background: "transparent", border: "none", fontSize: 24,
                  cursor: "pointer", color: "#6b7280", padding: 0, lineHeight: 1,
                }}
                aria-label="Close"
              >
                ×
              </button>
            </div>

            <div style={{
              marginTop: 12, padding: "8px 12px", background: "#f9fafb",
              borderRadius: 6, fontSize: 12, color: "#374151",
              display: "flex", alignItems: "center", gap: 8,
            }}>
              <span style={{
                display: "inline-block", width: 8, height: 8, borderRadius: "50%",
                background: tokenColor,
              }} />
              <span style={{ color: tokenColor, fontWeight: 600 }}>Current: {tokenLabel}</span>
            </div>

            <textarea
              value={tokenInput}
              onChange={(e) => setTokenInput(e.target.value)}
              placeholder="eyJhbGciOiJSUzI1NiIsInR5cCIgOiAiSldUIiwia2lkIiA6..."
              rows={5}
              spellCheck={false}
              style={{
                width: "100%", marginTop: 12, padding: "10px 12px",
                fontSize: 11, fontFamily: "ui-monospace, Menlo, Consolas, monospace",
                border: "1px solid #d1d5db", borderRadius: 6, background: "#f9fafb",
                resize: "vertical", color: "#374151", wordBreak: "break-all",
                boxSizing: "border-box",
              }}
            />

            <div style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 10 }}>
              <button
                onClick={saveAndTest}
                disabled={tokenSaving || !tokenInput.trim()}
                style={{
                  flex: 1, padding: "10px 14px",
                  background: tokenSaving || !tokenInput.trim() ? "#9ca3af" : "#2563eb",
                  color: "white", border: "none", borderRadius: 6,
                  fontWeight: 600, fontSize: 13, cursor: "pointer",
                }}
              >
                {tokenSaving ? "Saving & Testing..." : "Save & Test BlueVerse"}
              </button>
              <button
                onClick={testOnly}
                disabled={testing}
                style={{
                  padding: "10px 14px", background: "#f3f4f6", color: "#374151",
                  border: "1px solid #d1d5db", borderRadius: 6, fontSize: 13,
                  cursor: "pointer",
                }}
                title="Ping the agent using the currently-saved token"
              >
                {testing ? "..." : "Re-test"}
              </button>
            </div>
            {tokenInput && (
              <div style={{ marginTop: 6, fontSize: 11, color: "#6b7280", textAlign: "right" }}>
                {tokenInput.length} chars
              </div>
            )}

            {testResult && (
              <div style={{
                marginTop: 14, padding: "12px 14px", borderRadius: 6,
                background: testResult.ok ? "#ecfdf5" : "#fef2f2",
                border: `1px solid ${testResult.ok ? "#a7f3d0" : "#fecaca"}`,
                fontSize: 13, lineHeight: 1.4,
                color: testResult.ok ? "#065f46" : "#991b1b",
              }}>
                <div style={{ fontWeight: 600 }}>{testResult.text}</div>
                {testResult.detail && (
                  <div style={{
                    marginTop: 8, padding: "8px 10px",
                    background: testResult.ok ? "#d1fae5" : "#fee2e2",
                    borderRadius: 4, fontWeight: 400, fontSize: 11,
                    fontFamily: "ui-monospace, Menlo, Consolas, monospace",
                    whiteSpace: "pre-wrap", wordBreak: "break-word",
                    maxHeight: 180, overflowY: "auto",
                  }}>
                    {testResult.detail}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

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
