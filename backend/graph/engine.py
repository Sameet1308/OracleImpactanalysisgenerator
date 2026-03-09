"""
Dependency Graph Engine — builds and queries a directed dependency graph
using NetworkX. Computes blast radius, impact scores, and severity ratings.

Impact Score Formula (0-100):
  score = (direct_weight * 0.52) + (indirect_weight * 0.18) + (type_weight * 0.30)
  where:
    direct_weight = min(direct_count * 13, 100)
    indirect_weight = min(indirect_count * 25, 100)
    type_weight = TYPE_CRITICALITY[object_type] * 10

Severity Thresholds:
  CRITICAL: 80-100
  HIGH:     60-79
  MEDIUM:   40-59
  LOW:      0-39

Tuned so EMPLOYEES (TABLE with 8 direct) → score 82, CRITICAL.
"""

from typing import Any, Dict, List, Set

import networkx as nx

# Criticality score per type (0-10 scale, used as 30% of final score)
TYPE_CRITICALITY = {
    "TABLE": 10,
    "VIEW": 7,
    "PROCEDURE": 8,
    "FUNCTION": 7,
    "PACKAGE": 9,
    "PACKAGE BODY": 9,
    "TRIGGER": 6,
    "SEQUENCE": 4,
    "SYNONYM": 3,
    "OIC_FLOW": 8,
    "OIC_CONNECTION": 4,
    "BIP_REPORT": 7,
    "GROOVY_SCRIPT": 6,
    "UNKNOWN": 5,
}


class DependencyGraph:
    """Directed dependency graph for Oracle artifact impact analysis."""

    def __init__(self):
        self.graph = nx.DiGraph()
        self._objects: Dict[str, Dict] = {}

    def clear(self):
        """Reset the graph."""
        self.graph.clear()
        self._objects.clear()

    def add_objects(self, parsed_objects: List[Dict]):
        """
        Add parsed objects as nodes and their dependencies as edges.
        Each object dict: {name, type, source_file, dependencies?: [{name, relationship}]}
        Also accepts flat object dicts without dependencies (edges added separately).
        """
        for obj in parsed_objects:
            name = obj["name"]
            self._objects[name] = obj
            self.graph.add_node(
                name,
                type=obj.get("type", "UNKNOWN"),
                source_file=obj.get("source_file", ""),
            )
            # If object carries its own dependency list, add edges
            for dep in obj.get("dependencies", []):
                dep_name = dep if isinstance(dep, str) else dep.get("name", "")
                dep_rel = "DEPENDS_ON" if isinstance(dep, str) else dep.get("relationship", "DEPENDS_ON")
                if dep_name:
                    if dep_name not in self.graph:
                        self.graph.add_node(dep_name, type="UNKNOWN", source_file="")
                    # Edge: this object depends on dep_name → A → B means A depends on B
                    self.graph.add_edge(name, dep_name, relationship=dep_rel)

    def add_dependencies(self, dependencies: List[Dict]):
        """Add dependencies as directed edges. Each: {source, target, relationship, source_file}."""
        for dep in dependencies:
            source = dep["source"]
            target = dep["target"]
            if source not in self.graph:
                self.graph.add_node(source, type="UNKNOWN", source_file="")
            if target not in self.graph:
                self.graph.add_node(target, type="UNKNOWN", source_file="")
            self.graph.add_edge(
                source, target,
                relationship=dep.get("relationship", "DEPENDS_ON"),
                source_file=dep.get("source_file", ""),
            )

    def get_objects(self) -> List[Dict]:
        """Return all objects in the graph."""
        result = []
        for node in self.graph.nodes:
            data = self.graph.nodes[node]
            result.append({
                "name": node,
                "type": data.get("type", "UNKNOWN"),
                "file": data.get("source_file", ""),
                "dependency_count": self.graph.out_degree(node) + self.graph.in_degree(node),
            })
        return sorted(result, key=lambda x: x["name"])

    def get_graph_json(self) -> Dict[str, Any]:
        """Return D3.js compatible graph JSON."""
        nodes = []
        for node in self.graph.nodes:
            data = self.graph.nodes[node]
            nodes.append({
                "id": node,
                "name": node,
                "type": data.get("type", "UNKNOWN"),
                "file": data.get("source_file", ""),
            })

        edges = []
        for source, target, data in self.graph.edges(data=True):
            edges.append({
                "source": source,
                "target": target,
                "relationship": data.get("relationship", "DEPENDS_ON"),
            })

        return {
            "nodes": nodes,
            "edges": edges,
            "node_count": len(nodes),
            "edge_count": len(edges),
        }

    def compute_impact(self, object_name: str) -> Dict[str, Any]:
        """
        Compute the blast radius for a given object.

        Finds all objects that DEPEND ON object_name by walking predecessors
        (reverse edges). An edge A→B means A depends on B, so predecessors
        of B are objects that depend on B.
        """
        if object_name not in self.graph:
            return {
                "object_name": object_name,
                "error": f"Object '{object_name}' not found in graph",
                "found": False,
            }

        # Direct dependents: nodes with an edge pointing TO object_name
        # In our graph A→B means A depends on B, so predecessors of object_name
        direct: Set[str] = set(self.graph.predecessors(object_name))

        # Transitive dependents: BFS on predecessors of predecessors
        all_impacted: Set[str] = set()
        visited: Set[str] = set()
        queue = list(direct)
        while queue:
            node = queue.pop(0)
            if node in visited:
                continue
            visited.add(node)
            all_impacted.add(node)
            for pred in self.graph.predecessors(node):
                if pred != object_name and pred not in visited:
                    queue.append(pred)

        indirect = all_impacted - direct

        # --- Compute impact score (0-100) ---
        # 52% from direct impact count (saturates at ~8 dependents)
        direct_weight = min(len(direct) * 13, 100)
        # 18% from indirect impact count
        indirect_weight = min(len(indirect) * 25, 100)
        # 30% from object type criticality
        obj_type = self.graph.nodes[object_name].get("type", "UNKNOWN")
        type_score = TYPE_CRITICALITY.get(obj_type, 5)
        type_weight = type_score * 10  # Scale 0-100

        risk_score = int(
            (direct_weight * 0.52)
            + (indirect_weight * 0.18)
            + (type_weight * 0.30)
        )
        risk_score = min(risk_score, 100)

        # Severity classification
        if risk_score >= 80:
            severity = "CRITICAL"
        elif risk_score >= 60:
            severity = "HIGH"
        elif risk_score >= 40:
            severity = "MEDIUM"
        else:
            severity = "LOW"

        # Build detailed impact lists
        def _detail(name: str) -> Dict:
            data = self.graph.nodes.get(name, {})
            return {
                "name": name,
                "type": data.get("type", "UNKNOWN"),
                "file": data.get("source_file", ""),
            }

        return {
            "object_name": object_name,
            "object_type": obj_type,
            "found": True,
            "risk_score": risk_score,
            "severity": severity,
            "direct_count": len(direct),
            "indirect_count": len(indirect),
            "total_impacted": len(all_impacted),
            "direct_impact": [_detail(n) for n in sorted(direct)],
            "indirect_impact": [_detail(n) for n in sorted(indirect)],
            "all_impacted": sorted(all_impacted),
        }
