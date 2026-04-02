"use client";

import { useState, useRef, useEffect } from "react";

// ============================================================
// AI_Elite_Ora1 — Production System Architecture
// Interactive JSX diagram with SVG arrows and click-to-expand
// ============================================================

type Box = {
  id: string;
  label: string;
  subtitle: string;
  color: string;
  bg: string;
  items: { name: string; detail: string }[];
  x: number;
  y: number;
  w: number;
  h: number;
};

type Arrow = {
  from: string;
  to: string;
  label: string;
  color: string;
  fromSide?: "right" | "bottom";
  toSide?: "left" | "top";
  dashed?: boolean;
};

// Layout: 3 rows. Row 1 = linear flow (User→API→Parser). Row 2 = parallel (Graph ‖ RAG) → AI. Row 3 = Output → Frontend
// Wider gaps between columns for clean arrows

const BOXES: Box[] = [
  // Row 1
  { id: "user", label: "USER INPUT", subtitle: "Data Sources", color: "#2563EB", bg: "#eff6ff",
    items: [
      { name: "Oracle Database", detail: "Connect to DBA_OBJECTS + DBA_SOURCE for live artifact discovery from any Oracle schema" },
      { name: "Upload Artifacts", detail: "Drag & drop .sql, .xml, .groovy files. Parser auto-detects type by extension" },
      { name: "OIC REST API", detail: "Auto-discover integration flows, connections, and lookups via Oracle Integration Cloud REST endpoints" },
      { name: "Demo Artifacts", detail: "Pre-built sample: Official Oracle HR schema + OIC flows + BIP reports + Groovy scripts" },
    ],
    x: 20, y: 20, w: 180, h: 210,
  },
  { id: "api", label: "API GATEWAY", subtitle: "FastAPI :8000", color: "#4f46e5", bg: "#eef2ff",
    items: [
      { name: "8 REST Endpoints", detail: "POST /upload, /demo, /analyze, /chat — GET /graph, /objects, /report/:name, /token/status" },
      { name: "Input Validation", detail: "File type whitelist (.sql/.xml/.groovy), size limits, XML well-formedness check" },
      { name: "CORS + Rate Limit", detail: "Configurable origins, per-IP throttle, request logging" },
      { name: "Auth Middleware", detail: "Oracle IDCS SSO integration. JWT session validation on every request" },
    ],
    x: 280, y: 20, w: 180, h: 210,
  },
  { id: "parser", label: "PARSER ENGINE", subtitle: "Auto-Detect & Extract", color: "#b45309", bg: "#fffbeb",
    items: [
      { name: "SQL Parser", detail: "sqlparse + custom regex. Extracts CREATE TABLE/VIEW/PROC/FUNC/PKG/TRIGGER/SEQ, FK constraints (multi-line), FROM/JOIN refs, function calls" },
      { name: "OIC/BIP Parser", detail: "xml.etree. Extracts integration steps, connections, procedure calls, embedded SQL from BIP datasets" },
      { name: "Groovy Parser", detail: "Regex patterns for executeFunction, executeProcedure, executeQuery. Detects indirect DB dependencies" },
      { name: "Extensible", detail: "PARSER_MAP pattern: register new parser per file extension. Add EBS, JDE, EPM, APEX parsers without touching existing code" },
    ],
    x: 540, y: 20, w: 180, h: 210,
  },

  // Row 2 left: Graph + RAG (stacked)
  { id: "graph", label: "GRAPH ENGINE", subtitle: "Dependency Analysis", color: "#7c3aed", bg: "#f5f3ff",
    items: [
      { name: "NetworkX DiGraph", detail: "Directed graph. Nodes = parsed objects. Edges = dependencies with relationship type" },
      { name: "BFS Blast Radius", detail: "Breadth-first search. Finds direct predecessors + transitive indirect dependents" },
      { name: "Risk Score 0-100", detail: "52% direct + 18% indirect + 30% type criticality. CRITICAL ≥80" },
    ],
    x: 820, y: 20, w: 200, h: 145,
  },
  { id: "rag", label: "RAG ENGINE", subtitle: "Embeddings + Retrieval", color: "#ea580c", bg: "#fff7ed",
    items: [
      { name: "Local Embeddings", detail: "sentence-transformers all-MiniLM-L6-v2. 384-dim. Local, zero API cost" },
      { name: "ChromaDB Vectors", detail: "In-memory vector DB. Cosine similarity. Metadata filtering" },
      { name: "2-Stage Retrieval", detail: "Stage 1: Exact metadata match. Stage 2: Semantic search. Top-k=5" },
    ],
    x: 820, y: 185, w: 200, h: 145,
  },

  // Row 2 right: AI Service
  { id: "ai", label: "AI SERVICE", subtitle: "BlueVerse + Guardrails", color: "#dc2626", bg: "#fef2f2",
    items: [
      { name: "Prompt Builder", detail: "Merges impact data + code snippets + question into single ~3000 token prompt" },
      { name: "Token Manager", detail: "JWT auto-refresh, expiry detection, usage tracking per session" },
      { name: "Guardrails", detail: "Prompt size cap, PII filter, conversation limit (6 turns), output validation" },
      { name: "BlueVerse Foundry", detail: "AI_Elite_Ora1: pre-trained Oracle ERP agent. Single API call. Structured response" },
      { name: "Response Validator", detail: "Parses into 4 sections. Re-parses with fallback if malformed" },
    ],
    x: 1120, y: 20, w: 200, h: 310,
  },

  // Row 3: Output
  { id: "output", label: "AI OUTPUT", subtitle: "4 Deliverables + Report", color: "#16a34a", bg: "#f0fdf4",
    items: [
      { name: "Root Cause Analysis", detail: "WHY the change breaks downstream. Specific object references" },
      { name: "Fix + ORA Codes", detail: "ORA-04063, ORA-06508, ORA-00904 with remediation commands" },
      { name: "Testing Checklist", detail: "Regression test plan per impacted artifact" },
      { name: "Rollback Plan", detail: "Step-by-step reversal with DBMS_METADATA, ALTER COMPILE" },
      { name: "PDF Report", detail: "Full report via ReportLab. All sections + dependency list" },
    ],
    x: 1120, y: 380, w: 200, h: 210,
  },

  // Row 3: Frontend (bottom)
  { id: "frontend", label: "FRONTEND", subtitle: "Next.js + D3.js + Chat", color: "#8b5cf6", bg: "#f5f3ff",
    items: [
      { name: "D3.js Radial Graph", detail: "Interactive radial spoke with card nodes, edge labels, zoom/pan" },
      { name: "Ask Ora1 Chat", detail: "AI follow-up with file attach. Quick prompts. Context-aware" },
      { name: "Risk Dashboard", detail: "Score 0-100, severity badge, analysis modal" },
      { name: "Connector Tiles", detail: "Oracle DB, OIC, BIP, HCM/ERP, Fusion. Upload. Token mgmt" },
    ],
    x: 20, y: 350, w: 700, h: 160,
  },
];

const ARROWS: Arrow[] = [
  { from: "user", to: "api", label: "HTTPS", color: "#3b82f6" },
  { from: "api", to: "parser", label: "Files", color: "#6366f1" },
  { from: "parser", to: "graph", label: "Objs+Deps", color: "#b45309" },
  { from: "parser", to: "rag", label: "Code", color: "#ea580c", fromSide: "right", toSide: "left" },
  { from: "graph", to: "ai", label: "Impact", color: "#7c3aed" },
  { from: "rag", to: "ai", label: "Context", color: "#ea580c" },
  { from: "ai", to: "output", label: "Analysis", color: "#dc2626", fromSide: "bottom", toSide: "top" },
  { from: "output", to: "frontend", label: "Response", color: "#16a34a", fromSide: "left", toSide: "right" },
  { from: "frontend", to: "ai", label: "Follow-up", color: "#dc2626", dashed: true, fromSide: "right", toSide: "bottom" },
];

function getBoxCenter(box: Box, side: "left" | "right" | "top" | "bottom" = "right") {
  switch (side) {
    case "right": return { x: box.x + box.w, y: box.y + box.h / 2 };
    case "left": return { x: box.x, y: box.y + box.h / 2 };
    case "top": return { x: box.x + box.w / 2, y: box.y };
    case "bottom": return { x: box.x + box.w / 2, y: box.y + box.h };
  }
}

export default function ArchitecturePage() {
  const [selected, setSelected] = useState<string | null>(null);
  const [hovered, setHovered] = useState<string | null>(null);
  const selectedBox = BOXES.find(b => b.id === selected);

  const svgW = 1380;
  const svgH = 610;

  return (
    <div style={{ background: "#0d1117", minHeight: "100vh", fontFamily: "Inter, system-ui, -apple-system, sans-serif" }}>
      {/* Header */}
      <div style={{ background: "linear-gradient(135deg, #7f1d1d, #dc2626)", padding: "10px 24px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <h1 style={{ fontSize: 16, color: "#fff", fontWeight: 800, margin: 0, letterSpacing: 0.5 }}>AI_ELITE_ORA1</h1>
          <div style={{ fontSize: 10, color: "rgba(255,255,255,0.6)", marginTop: 1 }}>Production System Architecture</div>
        </div>
        <div style={{ fontSize: 10, color: "rgba(255,255,255,0.5)" }}>Click any component for implementation details</div>
      </div>

      <div style={{ display: "flex", height: "calc(100vh - 52px)" }}>
        {/* SVG Diagram */}
        <div style={{ flex: 1, overflow: "auto", padding: 16 }}>
          <svg viewBox={`0 0 ${svgW} ${svgH}`} style={{ width: "100%", height: "100%", maxHeight: "calc(100vh - 84px)" }} preserveAspectRatio="xMidYMid meet">
            {/* Arrow defs */}
            <defs>
              {ARROWS.map((a, i) => (
                <marker key={i} id={`ah-${i}`} viewBox="0 -5 10 10" refX="8" refY="0" markerWidth="8" markerHeight="8" orient="auto">
                  <path d="M0,-4L8,0L0,4" fill={a.color} />
                </marker>
              ))}
              {/* Drop shadow */}
              <filter id="shadow" x="-4%" y="-4%" width="108%" height="112%">
                <feDropShadow dx="0" dy="2" stdDeviation="4" floodOpacity="0.08" />
              </filter>
              <filter id="shadowHover" x="-4%" y="-4%" width="108%" height="112%">
                <feDropShadow dx="0" dy="4" stdDeviation="8" floodOpacity="0.15" />
              </filter>
            </defs>

            {/* Draw arrows FIRST (behind boxes) */}
            {ARROWS.map((a, i) => {
              const fromBox = BOXES.find(b => b.id === a.from)!;
              const toBox = BOXES.find(b => b.id === a.to)!;
              const from = getBoxCenter(fromBox, a.fromSide || "right");
              const to = getBoxCenter(toBox, a.toSide || "left");

              // Calculate control points for curved path
              const dx = to.x - from.x;
              const dy = to.y - from.y;
              const midX = from.x + dx * 0.5;
              const midY = from.y + dy * 0.5;

              let path: string;
              if (Math.abs(dy) < 30) {
                // Mostly horizontal
                path = `M${from.x},${from.y} C${from.x + dx * 0.4},${from.y} ${to.x - dx * 0.4},${to.y} ${to.x},${to.y}`;
              } else if (a.fromSide === "bottom" && a.toSide === "top") {
                // Vertical
                path = `M${from.x},${from.y} C${from.x},${from.y + Math.abs(dy) * 0.5} ${to.x},${to.y - Math.abs(dy) * 0.5} ${to.x},${to.y}`;
              } else if (a.dashed) {
                // Feedback loop — route around
                path = `M${from.x},${from.y} C${from.x + 100},${from.y} ${to.x + 40},${to.y + 80} ${to.x},${to.y}`;
              } else {
                // Default curve
                path = `M${from.x},${from.y} C${midX},${from.y} ${midX},${to.y} ${to.x},${to.y}`;
              }

              return (
                <g key={i}>
                  <path
                    d={path}
                    fill="none"
                    stroke={a.color}
                    strokeWidth={2.5}
                    strokeDasharray={a.dashed ? "8,5" : "none"}
                    markerEnd={`url(#ah-${i})`}
                    opacity={0.7}
                  />
                  {/* Label — small pill on the arrow line */}
                  <rect x={midX - 30} y={midY - 16} width={60} height={14} rx={7} fill="#0d1117" stroke={a.color} strokeWidth={0.8} />
                  <text x={midX} y={midY - 7} textAnchor="middle" fontSize={7} fontWeight={700} fill={a.color} fontFamily="Inter, system-ui">
                    {a.label}
                  </text>
                </g>
              );
            })}

            {/* Draw boxes */}
            {BOXES.map((box) => {
              const isSelected = selected === box.id;
              const isHovered = hovered === box.id;
              return (
                <g
                  key={box.id}
                  onClick={() => setSelected(isSelected ? null : box.id)}
                  onMouseEnter={() => setHovered(box.id)}
                  onMouseLeave={() => setHovered(null)}
                  style={{ cursor: "pointer" }}
                >
                  {/* Box background */}
                  <rect
                    x={box.x} y={box.y} width={box.w} height={box.h}
                    rx={10} ry={10}
                    fill="#161b22"
                    stroke={isSelected ? box.color : isHovered ? box.color : "#30363d"}
                    strokeWidth={isSelected ? 3 : isHovered ? 2.5 : 1.5}
                    filter={isHovered || isSelected ? "url(#shadowHover)" : "url(#shadow)"}
                  />

                  {/* Colored header */}
                  <rect x={box.x} y={box.y} width={box.w} height={30} rx={10} ry={10} fill={box.color} />
                  <rect x={box.x} y={box.y + 15} width={box.w} height={15} fill={box.color} />
                  <text x={box.x + box.w / 2} y={box.y + 13} textAnchor="middle" fontSize={12} fontWeight={800} fill="#fff" fontFamily="Inter, system-ui" letterSpacing={1}>
                    {box.label}
                  </text>
                  <text x={box.x + box.w / 2} y={box.y + 25} textAnchor="middle" fontSize={7} fill="rgba(255,255,255,0.7)" fontFamily="Inter, system-ui">
                    {box.subtitle}
                  </text>

                  {/* Items */}
                  {box.items.map((item, j) => {
                    const itemH = Math.max(22, (box.h - 42) / box.items.length - 4);
                    const iy = box.y + 38 + j * (itemH + 3);
                    return (
                      <g key={j}>
                        <rect
                          x={box.x + 6} y={iy} width={box.w - 12} height={itemH}
                          rx={5} ry={5} fill="#1e293b" stroke="#334155" strokeWidth={0.8}
                        />
                        <rect x={box.x + 6} y={iy} width={3} height={itemH} rx={1} fill={box.color} />
                        <text x={box.x + 16} y={iy + itemH / 2 + 3} fontSize={10} fontWeight={600} fill="#e2e8f0" fontFamily="Inter, system-ui">
                          {item.name}
                        </text>
                      </g>
                    );
                  })}
                </g>
              );
            })}

            {/* Parallel split indicator */}
            <text x={805} y={178} fontSize={8} fontWeight={700} fill="#484f58" fontFamily="Inter, system-ui" textAnchor="middle" transform="rotate(-90, 805, 178)">
              PARALLEL
            </text>
            <line x1={810} y1={100} x2={810} y2={340} stroke="#30363d" strokeWidth={1} strokeDasharray="5,4" />
          </svg>

          {/* Bottom legend */}
          <div style={{ display: "flex", justifyContent: "center", gap: 12, marginTop: 6, flexWrap: "wrap" }}>
            <div style={{ background: "#161b22", border: "1px solid #7c3aed", borderRadius: 6, padding: "4px 10px", fontSize: 8, color: "#a78bfa", fontWeight: 600 }}>
              Graph ‖ RAG = parallel processing
            </div>
            <div style={{ background: "#161b22", border: "1px solid #dc2626", borderRadius: 6, padding: "4px 10px", fontSize: 8, color: "#f87171", fontWeight: 600 }}>
              Impact + Code merge → single AI prompt
            </div>
            <div style={{ background: "#161b22", border: "1px dashed #dc2626", borderRadius: 6, padding: "4px 10px", fontSize: 8, color: "#f87171", fontWeight: 600 }}>
              ↩ Chat loops back to AI
            </div>
          </div>
        </div>

        {/* Detail Panel */}
        <div style={{
          width: selected ? 340 : 0,
          transition: "width 0.25s ease",
          overflow: "hidden",
          borderLeft: selected ? "1px solid #21262d" : "none",
          background: "#161b22",
          flexShrink: 0,
        }}>
          {selectedBox && (
            <div style={{ padding: 20, width: 340, height: "100%", overflowY: "auto" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                <div>
                  <h2 style={{ fontSize: 15, fontWeight: 800, color: selectedBox.color, margin: 0 }}>{selectedBox.label}</h2>
                  <div style={{ fontSize: 11, color: "#6e7681" }}>{selectedBox.subtitle}</div>
                </div>
                <button onClick={() => setSelected(null)} style={{ background: "none", border: "none", fontSize: 20, color: "#6e7681", cursor: "pointer", padding: "0 4px" }}>&times;</button>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {selectedBox.items.map((item, i) => (
                  <div key={i} style={{
                    padding: 12,
                    background: "#0d1117",
                    border: `1px solid #21262d`,
                    borderLeft: `4px solid ${selectedBox.color}`,
                    borderRadius: 8,
                  }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: "#e2e8f0", marginBottom: 4 }}>{item.name}</div>
                    <div style={{ fontSize: 11, color: "#8b949e", lineHeight: 1.6 }}>{item.detail}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
