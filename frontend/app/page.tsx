"use client";

import { useEffect, useRef, useState } from "react";
import * as d3 from "d3";
import Header from "../components/Header";
import Footer from "../components/Footer";
import { AppProvider } from "../context/AppContext";

type DepNode = d3.SimulationNodeDatum & { id: string; type: string };
type DepEdge = d3.SimulationLinkDatum<DepNode> & { source: string; target: string };
type ImpactResult = {
  object_name: string;
  risk_score: number;
  severity: string;
  direct_impact: Array<{ name: string; type: string }>;
  indirect_impact: Array<{ name: string; type: string }>;
  all_impacted: Array<{ name: string; type: string }>;
  ai_analysis: {
    root_cause: string;
    recommendations: string[];
    testing_checklist: string[];
    rollback_plan: string[];
  };
};

type GraphJson = { nodes: DepNode[]; edges: DepEdge[]; node_count?: number; edge_count?: number };

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8000";

const TC: Record<string, string> = {
  TABLE: "#1565C0",
  VIEW: "#0097A7",
  PROCEDURE: "#2E7D32",
  FUNCTION: "#F57F17",
  PACKAGE: "#7B1FA2",
  "PACKAGE BODY": "#7B1FA2",
  TRIGGER: "#EA580C",
  SEQUENCE: "#6B7280",
  OIC_FLOW: "#D84315",
  OIC_CONNECTION: "#BF360C",
  BIP_REPORT: "#C2185B",
  GROOVY_SCRIPT: "#00695C",
  UNKNOWN: "#6B7280",
};

const TI: Record<string, string> = {
  TABLE: "◉",
  VIEW: "□",
  PROCEDURE: "⚙",
  FUNCTION: "ƒ",
  PACKAGE: "☐",
  "PACKAGE BODY": "☐",
  TRIGGER: "⚡",
  SEQUENCE: "#",
  OIC_FLOW: "⇄",
  OIC_CONNECTION: "⇄",
  BIP_REPORT: "☇",
  GROOVY_SCRIPT: "📝",
  UNKNOWN: "?",
};

const EL: Record<string, Record<string, string>> = {
  TABLE: { PROCEDURE: "Reads", VIEW: "Reads", FUNCTION: "Reads", PACKAGE: "Reads", "PACKAGE BODY": "Reads", TRIGGER: "Triggers", OIC_FLOW: "Spein", GROOVY_SCRIPT: "Uses", BIP_REPORT: "Uses" },
  PROCEDURE: { TABLE: "Calls", VIEW: "Calls", FUNCTION: "Calls", PACKAGE: "Calls" },
  FUNCTION: { TABLE: "Reads", PROCEDURE: "Calls" },
  VIEW: { TABLE: "Reads" },
  OIC_FLOW: { TABLE: "Depends On", PROCEDURE: "Calls", OIC_CONNECTION: "Uses" },
  BIP_REPORT: { TABLE: "Reads", VIEW: "Reads" },
  GROOVY_SCRIPT: { TABLE: "Uses", PROCEDURE: "Calls" },
};

function getEdgeLabel(sType: string, tType: string) {
  if (EL[sType] && EL[sType][tType]) return EL[sType][tType];
  if (EL[tType] && EL[tType][sType]) return EL[tType][sType];
  return "Depends On";
}

export default function Home() {
  const [phase, setPhase] = useState<"connect" | "artifacts" | "dashboard">("connect");
  const [graphData, setGraphData] = useState<GraphJson>({ nodes: [], edges: [] });
  type ObjectItem = { name: string; type?: string; file?: string; dependency_count?: number };
  const [objects, setObjects] = useState<ObjectItem[]>([]);
  const [selected, setSelected] = useState("");
  const [analysis, setAnalysis] = useState<ImpactResult | null>(null);
  const [status, setStatus] = useState("Ready");
  const [targetNode, setTargetNode] = useState<string | null>(null);
  const [showFiltered, setShowFiltered] = useState(false);
  const [impactedNodes, setImpactedNodes] = useState<Set<string>>(new Set());
  const [directNodes, setDirectNodes] = useState<Set<string>>(new Set());
  const [indirectNodes, setIndirectNodes] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [graphStats, setGraphStats] = useState({ nodes: 0, edges: 0 });
  const graphContainerRef = useRef<HTMLDivElement | null>(null);
  const d3Ref = useRef<{ node: any; link: any; edgeLabel: any; edges: DepEdge[] } | null>(null);

  async function apiGet(path: string) {
    const res = await fetch(`${API_BASE}${path}`);
    if (!res.ok) throw new Error(`API GET ${path} failed: ${res.statusText}`);
    return await res.json();
  }

  async function apiPost(path: string, body?: any) {
    const res = await fetch(`${API_BASE}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: body ? JSON.stringify(body) : undefined,
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`API POST ${path} failed: ${res.status} ${res.statusText} ${text}`);
    }
    return await res.json();
  }

  async function fetchGraph() {
    try {
      const g = await apiGet("/api/graph");
      setGraphData(g);
      setGraphStats({ nodes: g.node_count || g.nodes?.length || 0, edges: g.edge_count || g.edges?.length || 0 });
      setStatus("Graph loaded");
    } catch (err) {
      console.error(err);
      setStatus(`Graph load error: ${err}`);
    }
  }

  async function fetchObjects() {
    try {
      const d = await apiGet("/api/objects");
      setObjects(d.objects || []);
      setStatus("Objects loaded");
    } catch (err) {
      console.error(err);
      setStatus(`Objects load error: ${err}`);
    }
  }

  async function loadDemo() {
    setLoading(true);
    try {
      await apiPost("/api/demo");
      await fetchGraph();
      await fetchObjects();
      setPhase("artifacts");
      setStatus("Demo artifacts loaded");
      setTimeout(() => renderGraph(), 50);
    } catch (err) {
      console.error(err);
      setStatus(`Demo failed: ${err}`);
    } finally {
      setLoading(false);
    }
  }

  async function uploadFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    setLoading(true);
    try {
      const fd = new FormData();
      Array.from(files).forEach((file) => fd.append("files", file));
      const res = await fetch(`${API_BASE}/api/upload`, { method: "POST", body: fd });
      if (!res.ok) throw new Error(`Upload failed: ${res.statusText}`);
      await res.json();
      await fetchGraph();
      await fetchObjects();
      setPhase("artifacts");
      setStatus("Upload successful");
      setTimeout(() => renderGraph(), 50);
    } catch (err) {
      console.error(err);
      setStatus(`Upload failed: ${err}`);
    } finally {
      setLoading(false);
    }
  }

  async function analyzeImpact() {
    if (!selected) {
      setStatus("Select an object first.");
      return;
    }
    setLoading(true);
    try {
      const res: ImpactResult = await apiPost("/api/analyze", { object_name: selected });
      setAnalysis(res);
      const direct = new Set(res.direct_impact.map((o) => o.name));
      const indirect = new Set(res.indirect_impact.map((o) => o.name));
      setDirectNodes(direct);
      setIndirectNodes(indirect);
      const all = new Set([...direct, ...indirect]);
      setImpactedNodes(all);
      setTargetNode(res.object_name);
      setShowFiltered(true);
      setPhase("dashboard");
      setStatus(`Impact analysis ready for ${res.object_name}`);
      setTimeout(() => {
        renderGraph();
      }, 50);
    } catch (err) {
      console.error(err);
      setStatus(`Analysis failed: ${err}`);
    } finally {
      setLoading(false);
    }
  }

  async function downloadPDF() {
    if (!selected) {
      setStatus("Select an object first for report");
      return;
    }
    const filename = `impact_report_${selected}.pdf`;
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/report/${encodeURIComponent(selected)}`);
      if (!res.ok) throw new Error(`Report failed: ${res.statusText}`);
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
      setStatus(`Download started for ${filename}`);
    } catch (err) {
      console.error(err);
      setStatus(`PDF failed: ${err}`);
    } finally {
      setLoading(false);
    }
  }

  function resetGraph() {
    setTargetNode(null);
    setDirectNodes(new Set());
    setIndirectNodes(new Set());
    setImpactedNodes(new Set());
    setShowFiltered(false);
    renderGraph();
  }

  function toggleFiltered() {
    setShowFiltered((prev) => !prev);
  }

  function renderGraph() {
    const container = graphContainerRef.current;
    if (!container) return;
    container.innerHTML = "";
    if (!graphData?.nodes?.length) {
      return;
    }

    const width = container.clientWidth || 800;
    const height = container.clientHeight || 500;
    const nodes = graphData.nodes.map((n) => ({ ...n }));
    let edges = graphData.edges.map((e) => ({ ...e }));

    if (showFiltered && targetNode) {
      const nodesFilter = new Set([targetNode, ...impactedNodes]);
      const filteredNodes = nodes.filter((n) => nodesFilter.has(n.id));
      const filteredNodeIds = new Set(filteredNodes.map((n) => n.id));
      edges = edges.filter((e) => filteredNodeIds.has(e.source) && filteredNodeIds.has(e.target));
      nodes.splice(0, nodes.length, ...filteredNodes);
    }

    const svg = d3
      .select(container)
      .append("svg")
      .attr("width", width)
      .attr("height", height)
      .style("background", "#f8fafc");

    const defs = svg.append("defs");
    defs
      .append("marker")
      .attr("id", "arrow")
      .attr("viewBox", "0 -5 10 10")
      .attr("refX", 18)
      .attr("refY", 0)
      .attr("markerWidth", 6)
      .attr("markerHeight", 6)
      .attr("orient", "auto")
      .append("path")
      .attr("d", "M0,-5L10,0L0,5")
      .attr("fill", "#9CA3AF");

    const link = svg
      .append("g")
      .attr("stroke", "#9CA3AF")
      .attr("stroke-width", 1.2)
      .selectAll("line")
      .data(edges)
      .join("line")
      .attr("marker-end", "url(#arrow)");

    const forceLink = d3
      .forceLink<DepNode, DepEdge>()
      .id((d) => d.id)
      .distance(120)
      .strength(0.6);

    const simulation = d3
      .forceSimulation<DepNode>(nodes)
      .force("link", forceLink)
      .force("charge", d3.forceManyBody().strength(-120))
      .force("center", d3.forceCenter(width / 2, height / 2))
      .force("collide", d3.forceCollide(32));

    forceLink.links(edges as any);

    const nodeGroup = svg
      .append("g")
      .selectAll("g")
      .data(nodes)
      .join("g")
      .on("click", (_, d) => {
        setSelected(d.id);
        setTargetNode(d.id);
        setStatus(`Selected ${d.id}`);
        analyzeImpact();
      })
      .on("mouseover", (_, d) => {
        setStatus(`Node ${d.id} (${d.type})`);
      })
      .call(
        d3
          .drag<any, DepNode>()
          .on("start", (event: any, d: any) => {
            if (!event.active) simulation.alphaTarget(0.3).restart();
            d.fx = d.x;
            d.fy = d.y;
          })
          .on("drag", (event: any, d: any) => {
            d.fx = event.x;
            d.fy = event.y;
          })
          .on("end", (event: any, d: any) => {
            if (!event.active) simulation.alphaTarget(0);
            d.fx = null;
            d.fy = null;
          })
      );

    // circle with small icon
    nodeGroup
      .append("circle")
      .attr("r", 16)
      .attr("fill", (d) => TC[d.type] || TC.UNKNOWN)
      .attr("stroke", "#ffffff")
      .attr("stroke-width", 1.7);

    nodeGroup
      .append("text")
      .attr("class", "node-icon")
      .text((d) => TI[d.type] || TI.UNKNOWN)
      .attr("text-anchor", "middle")
      .attr("dy", 5)
      .style("pointer-events", "none");

    // label to the right of the node
    nodeGroup
      .append("text")
      .attr("class", "node-label")
      .text((d) => d.id)
      .attr("x", 22)
      .attr("y", 4)
      .style("pointer-events", "none");

    // ensure the simulation starts strongly so animation is visible
    simulation.alpha(1).restart();

    simulation.on("tick", () => {
      link
        .attr("x1", (d: any) => (d.source.x))
        .attr("y1", (d: any) => (d.source.y))
        .attr("x2", (d: any) => (d.target.x))
        .attr("y2", (d: any) => (d.target.y));

      nodeGroup.attr("transform", (d: any) => `translate(${d.x},${d.y})`);
    });

    d3Ref.current = { node: nodeGroup, link, edgeLabel: null as any, edges };
    if (showFiltered || targetNode) {
      // highlight now and after tick
      highlightGraph();
      simulation.on("tick", () => highlightGraph());
    }
  }

  function highlightGraph() {
    if (!d3Ref.current) return;
    const { node, link } = d3Ref.current;
    const rel = new Set(impactedNodes);
    if (targetNode) rel.add(targetNode);

    node.attr("opacity", (d: any) => (!showFiltered || rel.has(d.id) ? 1 : 0.15));

    link.attr("stroke", (d: any) => {
      const sourceId = d.source?.id || d.source;
      const targetId = d.target?.id || d.target;
      if (rel.has(sourceId) && rel.has(targetId)) return "#DC2626";
      return "#9CA3AF";
    });

    link.attr("stroke-opacity", (d: any) => {
      const sourceId = d.source?.id || d.source;
      const targetId = d.target?.id || d.target;
      return !showFiltered || (rel.has(sourceId) && rel.has(targetId)) ? 0.8 : 0.2;
    });
  }

  useEffect(() => {
    fetchGraph();
    fetchObjects();
  }, []);

  // rerender graph on resize for responsiveness
  useEffect(() => {
    const onResize = () => {
      renderGraph();
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [graphData, showFiltered, impactedNodes, targetNode]);

  useEffect(() => {
    renderGraph();
  }, [graphData]);

  useEffect(() => {
    if (showFiltered || targetNode) highlightGraph();
  }, [showFiltered, impactedNodes, targetNode]);

  function renderAnalysisTabs() {
    if (!analysis) return null;
    return (
      <>
        <div className="tab-row">
          <button className="tab active">Root Cause</button>
          <button className="tab">Testing</button>
          <button className="tab">Rollback</button>
          <button className="tab">Call Hierarchy</button>
        </div>
        <div className="tab-content">
          <section>
            <h4>Root Cause Analysis</h4>
            <p>{analysis.ai_analysis.root_cause || "N/A"}</p>
          </section>
          <section>
            <h4>Testing Checklist</h4>
            <ol>{analysis.ai_analysis.testing_checklist.map((item, idx) => <li key={idx}>{item}</li>)}</ol>
          </section>
          <section>
            <h4>Rollback Plan</h4>
            <ol>{analysis.ai_analysis.rollback_plan.map((item, idx) => <li key={idx}>{item}</li>)}</ol>
          </section>
          <section>
            <h4>Call Hierarchy</h4>
            <p>Direct: {analysis.direct_impact.map((o) => o.name).join(', ') || 'None'}</p>
            <p>Indirect: {analysis.indirect_impact.map((o) => o.name).join(', ') || 'None'}</p>
          </section>
        </div>
      </>
    );
  }

  return (
    <AppProvider>
      <div className="app">
        <Header />

        {/* <div style={{ padding: '8px 20px', display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ fontSize: 13, color: 'var(--muted)' }}>{status}</div>
        </div> */}

        <div className="toolbar">
        <div className="tb-search">
          <input type="text" placeholder="Filter objects" onChange={(e) => {
            const q = e.target.value.toLowerCase();
            const sel = document.getElementById("object-select") as HTMLSelectElement | null;
            if (!sel) return;
            Array.from(sel.options).forEach((opt) => {
              if (opt.value === "") return;
              opt.style.display = opt.text.toLowerCase().includes(q) ? "" : "none";
            });
          }} />
        </div>
        <div className="tb-select">
          <select id="object-select" value={selected} onChange={(e) => setSelected(e.target.value)}>
            <option value="">Select an object...</option>
            {objects.map((o) => (
              <option key={o.name} value={o.name}>
                {o.name} ({o.type || "UNKNOWN"})
              </option>
            ))}
          </select>
        </div>
        <button className="tb-btn primary" onClick={analyzeImpact} disabled={!objects.length || loading}>Analyze</button>
        <button className="tb-btn outline" onClick={downloadPDF} disabled={!selected || loading}>Export PDF</button>
        <div className="tb-spacer"></div>
        <button className="tb-btn outline" id="btn-toggle" onClick={toggleFiltered}>{showFiltered ? 'Show All' : 'Impact Only'}</button>
      </div>

      <div className="dash-body">
        <div className="panel-left">
          <div className="pl-section">
            <div className="pl-title">Controls</div>
            <button className="pl-upload" onClick={loadDemo} disabled={loading}>Load Demo</button>
            <label className="pl-upload" style={{ marginTop: '8px' }}>
              Upload Files
              <input type="file" multiple style={{ display: 'none' }} onChange={(e) => uploadFiles(e.target.files)} />
            </label>
            <div className="pl-field"><label>Nodes</label><div className="val">{graphStats.nodes}</div></div>
            <div className="pl-field"><label>Edges</label><div className="val">{graphStats.edges}</div></div>
          </div>

          <ul className="pl-nav">
            {objects.slice(0, 40).map((o) => (
              <li key={o.name} className={selected === o.name ? 'active' : ''} onClick={() => { setSelected(o.name); }}>
                {o.name}
                <span className="nav-arrow">›</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="panel-center">
          <div className="pc-header">
            <h3>Dependency Graph</h3>
            <div className="g-toolbar">
              <button className="g-tool" onClick={resetGraph}>Reset View</button>
              <button className="g-tool" onClick={() => setShowFiltered((p) => !p)}>{showFiltered ? 'Show All' : 'Impact Only'}</button>
              <button className="g-tool" onClick={() => loadDemo()}>Refresh Demo</button>
            </div>
          </div>

          <div id="graph-container" ref={graphContainerRef} style={{ width: '100%', height: '100%' }} />

          <div className="pc-tabs">{/* Tab placeholder on UI */}</div>
        </div>

        <div className="panel-right">
          <div id="impact-summary">
            {analysis ? (
              <>
                <div className="risk-badge">Risk Score: {analysis.severity}</div>
                <div className="pr-stat">Impacted Artifacts: {analysis.all_impacted.length}</div>
                <div className="pr-stat">Breaking: {analysis.direct_impact.length}</div>
                <div className="pr-divider"></div>
                <div className="pr-section">
                  <h4>Root cause</h4>
                  <p>{analysis.ai_analysis.root_cause}</p>
                </div>
                <div className="pr-divider"></div>
                <div className="pr-section">
                  <h4>Recommendations</h4>
                  <ol>{analysis.ai_analysis.recommendations.map((item, idx) => <li key={idx}>{item}</li>)}</ol>
                </div>
              </>
            ) : (
              <p>Select an object and run analysis</p>
            )}
          </div>
        </div>
      </div>
      </div>
      <Footer />
    </AppProvider>
  );
}
