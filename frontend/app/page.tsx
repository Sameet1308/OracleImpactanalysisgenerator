"use client";

import { useEffect, useRef, useState } from "react";
import * as d3 from "d3";
import Header from "../components/Header";
import LoginScreen from "../components/LoginScreen";
import ChatPanel from "../components/ChatPanel";
import ConnectorTiles from "../components/ConnectorTiles";
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

type ColumnInfo = { name: string; type: string };
type ColumnImpactItem = {
  name: string;
  type: string;
  file?: string;
  relationship?: string;
  columns_referenced?: string[];
};
type ColumnAnalysis = {
  object_name: string;
  object_type: string;
  column_name: string;
  found: boolean;
  confirmed_impact: ColumnImpactItem[];
  possible_impact: ColumnImpactItem[];
  confirmed_count: number;
  possible_count: number;
  columns_on_table: string[];
  note?: string;
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

const TA: Record<string, string> = {
  TABLE: "T", VIEW: "V", PROCEDURE: "P", FUNCTION: "f", PACKAGE: "Pk",
  "PACKAGE BODY": "Pk", TRIGGER: "Tr", SEQUENCE: "#",
  OIC_FLOW: "O", OIC_CONNECTION: "O", BIP_REPORT: "B", GROOVY_SCRIPT: "G", UNKNOWN: "?",
};

function getEdgeLabel(sType: string, tType: string) {
  if (EL[sType] && EL[sType][tType]) return EL[sType][tType];
  if (EL[tType] && EL[tType][sType]) return EL[tType][sType];
  return "Depends On";
}

export default function Home() {
  const [loggedIn, setLoggedIn] = useState(false);
  const [graphData, setGraphData] = useState<GraphJson>({ nodes: [], edges: [] });
  type ObjectItem = { name: string; type?: string; file?: string; dependency_count?: number };
  const [objects, setObjects] = useState<ObjectItem[]>([]);
  const [selected, setSelected] = useState("");
  const [analysis, setAnalysis] = useState<ImpactResult | null>(null);
  const [status, setStatus] = useState("No data loaded");
  const [toast, setToast] = useState<string | null>(null);
  const [showAnalysisModal, setShowAnalysisModal] = useState(false);
  const [aiMode, setAiMode] = useState<string>("checking...");
  const [targetNode, setTargetNode] = useState<string | null>(null);
  const [showFiltered, setShowFiltered] = useState(false);
  const [impactedNodes, setImpactedNodes] = useState<Set<string>>(new Set());
  const [directNodes, setDirectNodes] = useState<Set<string>>(new Set());
  const [indirectNodes, setIndirectNodes] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [graphStats, setGraphStats] = useState({ nodes: 0, edges: 0 });
  const [columns, setColumns] = useState<ColumnInfo[]>([]);
  const [selectedColumn, setSelectedColumn] = useState("");
  const [columnAnalysis, setColumnAnalysis] = useState<ColumnAnalysis | null>(null);
  const [showColumnModal, setShowColumnModal] = useState(false);
  const graphContainerRef = useRef<HTMLDivElement | null>(null);
  const tooltipRef = useRef<HTMLDivElement | null>(null);
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

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 5000);
  }

  async function loadDemo() {
    setLoading(true);
    try {
      const result = await apiPost("/api/demo");
      await fetchGraph();
      await fetchObjects();
      setStatus(`${result.objects_found} objects from ${result.files_processed} files`);
      showToast(`Parsed ${result.files_processed} artifacts \u2192 ${result.objects_found} objects, ${result.dependencies_found} dependencies discovered`);
    } catch (err) {
      console.error(err);
      setStatus(`Load failed: ${err}`);
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
      const result = await res.json();
      await fetchGraph();
      await fetchObjects();
      const fileNames = Array.from(files).map(f => f.name).join(", ");
      setStatus(`${result.objects_found} objects from ${result.files_processed} files`);
      showToast(
        `\u2705 Artifacts added successfully — ${result.files_processed} file${result.files_processed === 1 ? "" : "s"} (${fileNames}) \u2192 ${result.objects_found} objects, ${result.dependencies_found} dependencies`
      );
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
      // data loaded
      setStatus(`Impact analysis ready for ${res.object_name}`);
    } catch (err) {
      console.error(err);
      setStatus(`Analysis failed: ${err}`);
    } finally {
      setLoading(false);
    }
  }

  async function fetchColumns(objectName: string) {
    try {
      const obj = objects.find((o) => o.name === objectName);
      if (!obj || (obj.type || "").toUpperCase() !== "TABLE") {
        setColumns([]);
        setSelectedColumn("");
        return;
      }
      const data = await apiGet(`/api/columns/${encodeURIComponent(objectName)}`);
      setColumns(data.columns || []);
      setSelectedColumn("");
    } catch {
      setColumns([]);
      setSelectedColumn("");
    }
  }

  async function analyzeColumn() {
    if (!selected || !selectedColumn) {
      setStatus("Select a table and column first.");
      return;
    }
    setLoading(true);
    try {
      const res: ColumnAnalysis = await apiPost("/api/analyze-column", {
        object_name: selected,
        column_name: selectedColumn,
      });
      setColumnAnalysis(res);
      setShowColumnModal(true);
      setStatus(`Column impact: ${res.confirmed_count} confirmed + ${res.possible_count} possible for ${selected}.${selectedColumn}`);
    } catch (err) {
      console.error(err);
      setStatus(`Column analysis failed: ${err}`);
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
    if (!graphData?.nodes?.length) return;

    const width = container.clientWidth || 800;
    const height = container.clientHeight || 500;
    const cx = width / 2;
    const cy = height / 2;
    const nodes = graphData.nodes.map((n) => ({ ...n }));
    let edges = graphData.edges.map((e) => ({ ...e }));

    if (showFiltered && targetNode) {
      const nodesFilter = new Set([targetNode, ...impactedNodes]);
      const filteredNodes = nodes.filter((n) => nodesFilter.has(n.id));
      const filteredNodeIds = new Set(filteredNodes.map((n) => n.id));
      edges = edges.filter((e) => filteredNodeIds.has(e.source) && filteredNodeIds.has(e.target));
      nodes.splice(0, nodes.length, ...filteredNodes);
    }

    // Card sizing helpers
    function getCardW(d: DepNode): number {
      return d.id === targetNode ? 140 : Math.max(90, d.id.length * 7.5 + 40);
    }
    function getCardH(d: DepNode): number {
      return d.id === targetNode ? 36 : 28;
    }

    const svg = d3
      .select(container)
      .append("svg")
      .attr("width", width)
      .attr("height", height)
      .style("background", "#F5F6F8");

    // --- SVG Defs: markers, filters ---
    const defs = svg.append("defs");

    // Color-coded arrow markers
    [["arr", "#9CA3AF"], ["arr-r", "#DC2626"], ["arr-o", "#F97316"]].forEach(([id, color]) => {
      defs.append("marker")
        .attr("id", id)
        .attr("viewBox", "0 -5 10 10")
        .attr("refX", 55)
        .attr("refY", 0)
        .attr("markerWidth", 6)
        .attr("markerHeight", 6)
        .attr("orient", "auto")
        .append("path")
        .attr("d", "M0,-5L10,0L0,5")
        .attr("fill", color);
    });

    // Card shadow filter
    const shadowFilter = defs.append("filter").attr("id", "cardShadow")
      .attr("x", "-20%").attr("y", "-20%").attr("width", "140%").attr("height", "140%");
    shadowFilter.append("feDropShadow")
      .attr("dx", 0).attr("dy", 1).attr("stdDeviation", 2).attr("flood-opacity", 0.1);

    // Target glow filter
    const glowFilter = defs.append("filter").attr("id", "targetGlow")
      .attr("x", "-50%").attr("y", "-50%").attr("width", "200%").attr("height", "200%");
    glowFilter.append("feGaussianBlur").attr("in", "SourceGraphic").attr("stdDeviation", 8).attr("result", "blur");
    glowFilter.append("feColorMatrix").attr("in", "blur").attr("type", "matrix")
      .attr("values", "0 0 0 0 0.15  0 0 0 0 0.39  0 0 0 0 0.92  0 0 0 0.3 0").attr("result", "glow");
    const glowMerge = glowFilter.append("feMerge");
    glowMerge.append("feMergeNode").attr("in", "glow");
    glowMerge.append("feMergeNode").attr("in", "SourceGraphic");

    // --- Zoom/Pan ---
    const g = svg.append("g");
    const zoom = d3.zoom<SVGSVGElement, unknown>().scaleExtent([0.2, 4])
      .on("zoom", (event) => g.attr("transform", event.transform));
    svg.call(zoom);

    // Background radial gradient when target is selected
    if (targetNode) {
      const bgGrad = defs.append("radialGradient").attr("id", "bgGrad");
      bgGrad.append("stop").attr("offset", "0%").attr("stop-color", "#E0E7FF").attr("stop-opacity", 0.3);
      bgGrad.append("stop").attr("offset", "100%").attr("stop-color", "#E0E7FF").attr("stop-opacity", 0);
      g.append("circle").attr("cx", cx).attr("cy", cy)
        .attr("r", Math.min(width, height) * 0.48).attr("fill", "url(#bgGrad)");
    }

    // --- Radial/spoke initial positioning ---
    const directArr = nodes.filter((n) => directNodes.has(n.id) && n.id !== targetNode);
    const indirectArr = nodes.filter((n) => indirectNodes.has(n.id) && !directNodes.has(n.id) && n.id !== targetNode);

    nodes.forEach((n) => {
      if (targetNode && n.id === targetNode) {
        n.x = cx; n.y = cy; n.fx = cx; n.fy = cy;
      } else if (targetNode && directNodes.has(n.id)) {
        const idx = directArr.indexOf(n);
        const angle = (2 * Math.PI * idx) / Math.max(directArr.length, 1) - Math.PI / 2;
        const r = Math.min(width, height) * 0.32;
        n.x = cx + r * Math.cos(angle);
        n.y = cy + r * Math.sin(angle);
      } else if (targetNode && indirectNodes.has(n.id)) {
        const idx = indirectArr.indexOf(n);
        const angle = (2 * Math.PI * idx) / Math.max(indirectArr.length, 1) - Math.PI / 4;
        const r = Math.min(width, height) * 0.44;
        n.x = cx + r * Math.cos(angle);
        n.y = cy + r * Math.sin(angle);
      } else {
        const cols = Math.ceil(Math.sqrt(nodes.length));
        const idx = nodes.indexOf(n);
        const col = idx % cols;
        const row = Math.floor(idx / cols);
        const spacing = Math.min(width / (cols + 1), 120);
        n.x = spacing + col * spacing;
        n.y = spacing + row * spacing;
      }
    });

    // --- Edges ---
    const link = g.append("g").selectAll("line").data(edges).join("line")
      .attr("stroke", "#D1D5DB")
      .attr("stroke-width", 0.8)
      .attr("stroke-dasharray", "4,2")
      .attr("marker-end", "url(#arr)")
      .attr("opacity", 0.35);

    // --- Edge labels ---
    const nodeMap: Record<string, DepNode> = {};
    nodes.forEach((n) => (nodeMap[n.id] = n));

    const edgeLabel = g.append("g").selectAll("text").data(edges).join("text")
      .attr("class", "edge-label")
      .text((d: any) => {
        const sId = typeof d.source === "object" ? d.source.id : d.source;
        const tId = typeof d.target === "object" ? d.target.id : d.target;
        const sn = nodeMap[sId];
        const tn = nodeMap[tId];
        if (sn && tn) return getEdgeLabel(sn.type, tn.type);
        return "";
      })
      .attr("opacity", 0.3);

    // --- Card-style nodes ---
    const nodeGroup = g.append("g").selectAll("g").data(nodes).join("g")
      .style("cursor", "grab");

    // Glow ring for target
    nodeGroup.filter((d) => d.id === targetNode)
      .append("circle")
      .attr("r", 45)
      .attr("fill", "none")
      .attr("stroke", "rgba(37,99,235,0.12)")
      .attr("stroke-width", 20);

    // Card background rect
    nodeGroup.append("rect")
      .attr("x", (d) => -getCardW(d) / 2)
      .attr("y", (d) => -getCardH(d) / 2)
      .attr("width", (d) => getCardW(d))
      .attr("height", (d) => getCardH(d))
      .attr("rx", 6).attr("ry", 6)
      .attr("fill", (d) => d.id === targetNode ? "#1B2A4A" : "#FFFFFF")
      .attr("stroke", (d) => {
        if (d.id === targetNode) return "#1B2A4A";
        if (directNodes.has(d.id)) return "#DC2626";
        if (indirectNodes.has(d.id)) return "#F97316";
        return "#D8DCE3";
      })
      .attr("stroke-width", (d) => (d.id === targetNode || directNodes.has(d.id) || indirectNodes.has(d.id)) ? 1.5 : 1)
      .attr("filter", "url(#cardShadow)");

    // Type icon circle (small colored dot)
    nodeGroup.append("circle")
      .attr("cx", (d) => -getCardW(d) / 2 + 14)
      .attr("cy", 0)
      .attr("r", 8)
      .attr("fill", (d) => d.id === targetNode ? "#2563EB" : (TC[d.type] || TC.UNKNOWN))
      .attr("stroke", "#fff")
      .attr("stroke-width", 1.5);

    // Type abbreviation letter
    nodeGroup.append("text")
      .attr("x", (d) => -getCardW(d) / 2 + 14)
      .attr("y", 0)
      .attr("text-anchor", "middle")
      .attr("dominant-baseline", "central")
      .attr("font-size", 8)
      .attr("fill", "#fff")
      .attr("font-weight", 700)
      .style("pointer-events", "none")
      .text((d) => TA[d.type] || TA.UNKNOWN);

    // Node name text
    nodeGroup.append("text")
      .attr("x", (d) => -getCardW(d) / 2 + 28)
      .attr("dominant-baseline", "central")
      .attr("font-size", (d) => d.id === targetNode ? 12 : 10)
      .attr("font-weight", (d) => d.id === targetNode ? 800 : 600)
      .attr("fill", (d) => d.id === targetNode ? "#FFFFFF" : "#1A1D23")
      .style("pointer-events", "none")
      .text((d) => d.id.length > 20 ? d.id.substring(0, 18) + "..." : d.id);

    // --- Interactions ---
    nodeGroup
      .on("click", (_, d) => {
        setSelected(d.id);
        setTargetNode(d.id);
        setStatus(`Selected ${d.id}`);
        analyzeImpact();
      })
      .on("mouseover", (ev: any, d: DepNode) => {
        const tip = tooltipRef.current;
        if (tip) {
          tip.style.display = "block";
          tip.innerHTML = `<strong>${d.id}</strong><br>Type: ${d.type}`;
          tip.style.left = (ev.clientX + 12) + "px";
          tip.style.top = (ev.clientY - 12) + "px";
        }
      })
      .on("mousemove", (ev: any) => {
        const tip = tooltipRef.current;
        if (tip) {
          tip.style.left = (ev.clientX + 12) + "px";
          tip.style.top = (ev.clientY - 12) + "px";
        }
      })
      .on("mouseout", () => {
        const tip = tooltipRef.current;
        if (tip) tip.style.display = "none";
      })
      .call(
        d3.drag<any, DepNode>()
          .on("start", (event: any, d: any) => {
            if (!event.active) simulation.alphaTarget(0.05).restart();
            d.fx = d.x;
            d.fy = d.y;
          })
          .on("drag", (event: any, d: any) => {
            d.fx = event.x;
            d.fy = event.y;
          })
          .on("end", (event: any, d: any) => {
            if (!event.active) simulation.alphaTarget(0);
            // Keep pinned where dropped
          })
      );

    // --- Force simulation (soft params) ---
    const forceLink = d3.forceLink<DepNode, DepEdge>()
      .id((d) => d.id)
      .distance(160)
      .strength(0.03);

    const simulation = d3.forceSimulation<DepNode>(nodes)
      .force("link", forceLink)
      .force("charge", d3.forceManyBody().strength(-500))
      .force("center", d3.forceCenter(cx, cy).strength(0.01))
      .force("collision", d3.forceCollide().radius((d: any) => getCardW(d) / 2 + 25).strength(0.8));

    forceLink.links(edges as any);

    // Pin target at center
    if (targetNode) {
      simulation.force("targetPin", (() => {
        nodes.forEach((n) => {
          if (n.id === targetNode) { n.x = cx; n.y = cy; n.fx = cx; n.fy = cy; }
        });
      }) as any);
    }

    simulation.alpha(1).restart();

    simulation.on("tick", () => {
      link
        .attr("x1", (d: any) => d.source.x)
        .attr("y1", (d: any) => d.source.y)
        .attr("x2", (d: any) => d.target.x)
        .attr("y2", (d: any) => d.target.y);

      nodeGroup.attr("transform", (d: any) => `translate(${d.x},${d.y})`);

      edgeLabel
        .attr("x", (d: any) => (d.source.x + d.target.x) / 2)
        .attr("y", (d: any) => (d.source.y + d.target.y) / 2 - 6);
    });

    d3Ref.current = { node: nodeGroup, link, edgeLabel, edges };
    if (showFiltered || targetNode) {
      highlightGraph();
    }
  }

  function highlightGraph() {
    if (!d3Ref.current) return;
    const { node, link, edgeLabel } = d3Ref.current;
    const rel = new Set(impactedNodes);
    if (targetNode) rel.add(targetNode);

    // Node opacity
    node.attr("opacity", (d: any) => (!showFiltered || rel.has(d.id) ? 1 : 0.12));

    // Granular edge coloring
    link.each(function (d: any) {
      const el = d3.select(this);
      const sId = d.source?.id || d.source;
      const tId = d.target?.id || d.target;

      if (sId === targetNode || tId === targetNode) {
        // Target connections: red, solid, thick
        el.attr("stroke", "#DC2626").attr("stroke-width", 2)
          .attr("marker-end", "url(#arr-r)").attr("opacity", 0.7)
          .attr("stroke-dasharray", "none");
      } else if ((directNodes.has(sId) || sId === targetNode) && (directNodes.has(tId) || tId === targetNode)) {
        // Direct-to-direct: orange
        el.attr("stroke", "#F97316").attr("stroke-width", 1.5)
          .attr("marker-end", "url(#arr-o)").attr("opacity", 0.6)
          .attr("stroke-dasharray", "none");
      } else if (rel.has(sId) && rel.has(tId)) {
        // Other impacted: gray dashed
        el.attr("stroke", "#9CA3AF").attr("stroke-width", 1)
          .attr("marker-end", "url(#arr)").attr("opacity", 0.4)
          .attr("stroke-dasharray", "4,2");
      } else {
        // Non-impacted: very faded
        el.attr("stroke", "#D1D5DB").attr("stroke-width", 0.5)
          .attr("marker-end", "url(#arr)").attr("opacity", showFiltered ? 0.05 : 0.25)
          .attr("stroke-dasharray", "4,2");
      }
    });

    // Edge label opacity
    if (edgeLabel) {
      edgeLabel.attr("opacity", (d: any) => {
        const sId = typeof d.source === "object" ? d.source.id : d.source;
        const tId = typeof d.target === "object" ? d.target.id : d.target;
        return (rel.has(sId) && rel.has(tId)) ? 0.8 : (showFiltered ? 0.05 : 0.3);
      });
    }
  }

  useEffect(() => {
    fetchGraph();
    fetchObjects();
    // Check AI agent status
    apiGet("/").then((data: any) => {
      setAiMode(data.ai_mode === "blueverse" && data.token_status?.status === "valid" ? "AI Live" : data.ai_mode === "blueverse" && data.token_status?.status === "expired" ? "AI Offline (token expired)" : "Mock Mode");
    }).catch(() => setAiMode("Backend offline"));
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
  }, [graphData, targetNode, directNodes, indirectNodes, showFiltered]);

  // When user picks a new object, fetch its columns (if it's a TABLE)
  useEffect(() => {
    if (selected) {
      fetchColumns(selected);
    } else {
      setColumns([]);
      setSelectedColumn("");
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected, objects]);

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

  if (!loggedIn) {
    return <LoginScreen onLogin={() => setLoggedIn(true)} />;
  }

  return (
    <AppProvider>
      <div className="app">
        <Header onLogout={() => setLoggedIn(false)} />

        <div className="toolbar">
          <div className="tb-select">
            <select id="object-select" value={selected} onChange={(e) => setSelected(e.target.value)}>
              <option value="">Select an object...</option>
              {objects.map((o) => (
                <option key={o.name} value={o.name}>
                  {o.name} ({o.type || "UNKNOWN"}) {o.file ? `\u2014 ${o.file}` : ""}
                </option>
              ))}
            </select>
          </div>
          <button className="tb-btn primary" onClick={analyzeImpact} disabled={!objects.length || loading}>Analyze</button>
          {columns.length > 0 && (
            <>
              <div className="tb-select" style={{ marginLeft: 8 }}>
                <select
                  id="column-select"
                  value={selectedColumn}
                  onChange={(e) => setSelectedColumn(e.target.value)}
                  title="Column-level impact — only available for TABLE objects"
                >
                  <option value="">Column (for column-level analysis)…</option>
                  {columns.map((c) => (
                    <option key={c.name} value={c.name}>
                      {c.name} ({c.type})
                    </option>
                  ))}
                </select>
              </div>
              <button
                className="tb-btn outline"
                onClick={analyzeColumn}
                disabled={!selectedColumn || loading}
                title="Show which downstream objects reference this specific column"
              >
                Column Impact
              </button>
            </>
          )}
          <button className="tb-btn outline" onClick={downloadPDF} disabled={!selected || loading}>Export PDF</button>
          <div className="tb-spacer"></div>
          <button className="tb-btn outline" onClick={toggleFiltered}>{showFiltered ? 'Show All' : 'Impact Only'}</button>
          <div className="tb-status">{status}</div>
          <div className={`tb-ai ${aiMode.includes("Live") ? "tb-ai--live" : aiMode.includes("Offline") ? "tb-ai--offline" : "tb-ai--mock"}`}>
            <span className="tb-ai-dot" />
            {aiMode}
          </div>
          <div className="tb-stats">
            <span>{graphStats.nodes} nodes</span>
            <span>{graphStats.edges} edges</span>
          </div>
        </div>

        {toast && <div className="toast">{toast}</div>}

        <div className="split-body">
          {/* LEFT: Connectors + Chat */}
          <div className="split-left">
            <ConnectorTiles
              onConnect={() => { loadDemo(); }}
              onUpload={(files) => { uploadFiles(files); }}
              onLoadDemo={() => { loadDemo(); }}
              loading={loading}
            />
            <ChatPanel objectName={selected || null} onUpload={(files) => uploadFiles(files)} />
          </div>

          {/* RIGHT: Graph + Analysis */}
          <div className="split-right">
            <div className="right-graph">
              <div className="pc-header">
                <h3>Dependency Graph</h3>
                <div className="g-toolbar">
                  <button className="g-tool" onClick={resetGraph}>Reset</button>
                  <button className="g-tool" onClick={() => setShowFiltered((p) => !p)}>{showFiltered ? 'All' : 'Impact'}</button>
                  {analysis && (
                    <button className="g-tool g-tool--accent" onClick={() => setShowAnalysisModal(true)}>
                      Risk: {analysis.severity} ({analysis.risk_score}) — View Report
                    </button>
                  )}
                </div>
              </div>
              <div id="graph-container" ref={graphContainerRef} style={{ width: '100%', flex: 1, minHeight: 0 }} />
              <div ref={tooltipRef} className="graph-tooltip" />
            </div>
          </div>

          {/* Analysis Modal Popup */}
          {showAnalysisModal && analysis && (
            <div className="analysis-modal-backdrop" onClick={() => setShowAnalysisModal(false)}>
              <div className="analysis-modal" onClick={(e) => e.stopPropagation()}>
                <div className="am-header">
                  <div>
                    <h2>Impact Analysis Report</h2>
                    <span className="am-object">{analysis.object_name}</span>
                  </div>
                  <div className="am-actions">
                    <button className="am-btn" onClick={downloadPDF}>Export PDF</button>
                    <button className="am-close" onClick={() => setShowAnalysisModal(false)}>&times;</button>
                  </div>
                </div>

                <div className="am-summary">
                  <div className="am-score" style={{ borderColor: analysis.severity === "CRITICAL" ? "#dc2626" : analysis.severity === "HIGH" ? "#ea580c" : analysis.severity === "MEDIUM" ? "#d97706" : "#16a34a" }}>
                    <div className="am-score-num">{analysis.risk_score}</div>
                    <div className="am-score-label">{analysis.severity}</div>
                  </div>
                  <div className="am-stat"><strong>{analysis.all_impacted.length}</strong> Impacted</div>
                  <div className="am-stat"><strong>{analysis.direct_impact.length}</strong> Breaking</div>
                  <div className="am-stat"><strong>{analysis.indirect_impact.length}</strong> Indirect</div>
                </div>

                <div className="am-body">
                  <div className="pr-section">
                    <h4>Root Cause</h4>
                    <p>{analysis.ai_analysis.root_cause}</p>
                  </div>
                  <div className="pr-section">
                    <h4>Recommendations</h4>
                    <ol>{analysis.ai_analysis.recommendations.map((item, idx) => <li key={idx}>{item}</li>)}</ol>
                  </div>
                  <div className="pr-section">
                    <h4>Testing Checklist</h4>
                    <ol>{analysis.ai_analysis.testing_checklist.map((item, idx) => <li key={idx}>{item}</li>)}</ol>
                  </div>
                  <div className="pr-section">
                    <h4>Rollback Plan</h4>
                    <ol>{analysis.ai_analysis.rollback_plan.map((item, idx) => <li key={idx}>{item}</li>)}</ol>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Column-Level Impact Modal */}
          {showColumnModal && columnAnalysis && (
            <div className="analysis-modal-backdrop" onClick={() => setShowColumnModal(false)}>
              <div className="analysis-modal" onClick={(e) => e.stopPropagation()}>
                <div className="am-header">
                  <div>
                    <h2>Column-Level Impact Analysis</h2>
                    <span className="am-object">
                      {columnAnalysis.object_name}.<strong>{columnAnalysis.column_name}</strong>
                    </span>
                  </div>
                  <div className="am-actions">
                    <button className="am-close" onClick={() => setShowColumnModal(false)}>&times;</button>
                  </div>
                </div>

                <div className="am-summary">
                  <div className="am-score" style={{ borderColor: "#dc2626" }}>
                    <div className="am-score-num">{columnAnalysis.confirmed_count}</div>
                    <div className="am-score-label">Confirmed</div>
                  </div>
                  <div className="am-stat"><strong>{columnAnalysis.possible_count}</strong> Possible</div>
                  <div className="am-stat"><strong>{columnAnalysis.columns_on_table.length}</strong> Columns on table</div>
                  <div className="am-stat"><strong>{columnAnalysis.object_type}</strong></div>
                </div>

                <div className="am-body">
                  <div className="pr-section">
                    <h4 style={{ color: "#dc2626" }}>
                      ✓ Confirmed Impact ({columnAnalysis.confirmed_count})
                    </h4>
                    <p style={{ fontSize: 13, color: "#6b7280", marginBottom: 8 }}>
                      Dependents whose SQL explicitly references <code>{columnAnalysis.column_name}</code>.
                    </p>
                    {columnAnalysis.confirmed_impact.length === 0 ? (
                      <p style={{ color: "#16a34a", fontWeight: 500 }}>
                        ✓ No downstream object directly projects this column — safe to change its internals.
                      </p>
                    ) : (
                      <ul style={{ listStyle: "none", padding: 0 }}>
                        {columnAnalysis.confirmed_impact.map((o, idx) => (
                          <li key={idx} style={{
                            border: "1px solid #fee2e2",
                            background: "#fef2f2",
                            borderRadius: 6,
                            padding: "8px 12px",
                            marginBottom: 6,
                          }}>
                            <div style={{ fontWeight: 600 }}>
                              {o.name} <span style={{ fontSize: 12, color: "#6b7280", fontWeight: 400 }}>({o.type})</span>
                            </div>
                            {o.relationship && (
                              <div style={{ fontSize: 12, color: "#9ca3af" }}>via {o.relationship}</div>
                            )}
                            {o.columns_referenced && o.columns_referenced.length > 0 && (
                              <div style={{ fontSize: 12, color: "#4b5563", marginTop: 4 }}>
                                Columns used: {o.columns_referenced.map((c) => (
                                  <span key={c} style={{
                                    display: "inline-block",
                                    background: c === columnAnalysis.column_name ? "#fca5a5" : "#e5e7eb",
                                    color: c === columnAnalysis.column_name ? "#7f1d1d" : "#374151",
                                    padding: "1px 6px",
                                    borderRadius: 3,
                                    marginRight: 4,
                                    fontWeight: c === columnAnalysis.column_name ? 600 : 400,
                                  }}>{c}</span>
                                ))}
                              </div>
                            )}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>

                  <div className="pr-section">
                    <h4 style={{ color: "#d97706" }}>
                      ? Possible Impact ({columnAnalysis.possible_count})
                    </h4>
                    <p style={{ fontSize: 13, color: "#6b7280", marginBottom: 8 }}>
                      Dependents without column-level metadata (typically OIC flows, BIP reports, Groovy scripts, procedure bodies without qualified refs). Verify manually.
                    </p>
                    {columnAnalysis.possible_impact.length === 0 ? (
                      <p style={{ color: "#6b7280" }}>None.</p>
                    ) : (
                      <ul style={{ listStyle: "none", padding: 0 }}>
                        {columnAnalysis.possible_impact.map((o, idx) => (
                          <li key={idx} style={{
                            border: "1px solid #fef3c7",
                            background: "#fffbeb",
                            borderRadius: 6,
                            padding: "8px 12px",
                            marginBottom: 6,
                          }}>
                            <div style={{ fontWeight: 600 }}>
                              {o.name} <span style={{ fontSize: 12, color: "#6b7280", fontWeight: 400 }}>({o.type})</span>
                            </div>
                            {o.relationship && (
                              <div style={{ fontSize: 12, color: "#9ca3af" }}>via {o.relationship}</div>
                            )}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>

                  {columnAnalysis.note && (
                    <div className="pr-section" style={{ fontSize: 12, color: "#6b7280", fontStyle: "italic" }}>
                      {columnAnalysis.note}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </AppProvider>
  );
}
