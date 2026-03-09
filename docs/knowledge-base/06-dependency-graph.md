# 06 — Dependency Graph Explained

## What is a Dependency Graph?

A graph where:
- **Nodes** = Oracle objects (EMPLOYEES, HR_PACKAGE, etc.)
- **Edges** = dependency relationships between them
- **Direction** = Edge A → B means "A depends on B"

## What is NetworkX?

NetworkX is a Python library for creating and analyzing graphs. It's used at Google, NASA, and in academic research. We use it to build a **directed graph** (DiGraph) — where edges have direction.

## How We Build the Graph

```python
# 1. Parsers extract objects and dependencies
objects = [
    {"name": "EMPLOYEES", "type": "TABLE"},
    {"name": "HR_EMPLOYEE_SUMMARY", "type": "VIEW"},
    ...
]
dependencies = [
    {"source": "HR_EMPLOYEE_SUMMARY", "target": "EMPLOYEES", "relationship": "REFERENCES"},
    ...
]

# 2. Add to NetworkX
graph = nx.DiGraph()
graph.add_node("EMPLOYEES", type="TABLE")
graph.add_node("HR_EMPLOYEE_SUMMARY", type="VIEW")
graph.add_edge("HR_EMPLOYEE_SUMMARY", "EMPLOYEES", relationship="REFERENCES")
```

## What is a Transitive Dependency?

A depends on B, B depends on C. So A **transitively** depends on C.

```
COMPENSATION → CALC_ANNUAL_BONUS → EMPLOYEES
```

COMPENSATION doesn't reference EMPLOYEES directly. But if EMPLOYEES changes, CALC_ANNUAL_BONUS might break, and then COMPENSATION breaks too. This is a **transitive (indirect) dependency**.

**This is the hardest thing to find manually.** Our graph engine finds it automatically using BFS traversal.

## How Impact Analysis Works (BFS)

BFS = Breadth-First Search. Starting from the target object, we walk the graph in reverse (following edges backward) to find everything that depends on it.

```
Target: EMPLOYEES

Step 1: Find direct predecessors of EMPLOYEES
  → HR_EMPLOYEE_SUMMARY, PAYROLL_VIEW, GET_EMPLOYEE_SALARY,
    CALC_ANNUAL_BONUS, HR_PACKAGE, HR_EMPLOYEE_SYNC
  (These are DIRECT impacts — they reference EMPLOYEES)

Step 2: Find predecessors of those predecessors
  → COMPENSATION (depends on CALC_ANNUAL_BONUS)
  → MONTHLY_PAYROLL_REPORT (depends on PAYROLL_VIEW)
  → ONBOARDING_FLOW (depends on HR_PACKAGE)
  (These are INDIRECT impacts — they don't reference EMPLOYEES directly)

Step 3: No more predecessors found. Done.
```

## What is Blast Radius?

**Blast radius** = the total set of objects impacted by a change. Like an explosion — the bigger the blast radius, the more dangerous the change.

For EMPLOYEES:
- Blast radius = 9 objects (6 direct + 3 indirect)
- Crosses 4 artifact types (PL/SQL, OIC, BIP, Groovy)
- Severity: CRITICAL

## Visualization (D3.js)

The graph is rendered as an interactive **force-directed graph** using D3.js:
- Nodes are circles, colored by type (blue=TABLE, cyan=VIEW, etc.)
- Edges are arrows showing dependency direction
- After impact analysis, impacted nodes turn RED
- You can drag nodes, zoom, and hover for details
