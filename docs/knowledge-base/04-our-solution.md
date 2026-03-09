# 04 — Our Solution: The 5-Step Pipeline

## Overview

```
INGEST → PARSE → GRAPH → IMPACT → AI FIX
```

User uploads Oracle files → we extract every object and relationship → build a graph → compute blast radius → AI generates recommendations.

---

## Step 1: INGEST

**What happens:** User uploads Oracle artifact files through the web UI or API.

**Supported file types:**
- `.sql` — PL/SQL scripts (tables, views, procedures, functions, packages, triggers)
- `.xml` — OIC integration flows and BIP report definitions
- `.groovy` — HCM Groovy scripts

**API:** `POST /api/upload` (multipart file upload)
**Demo shortcut:** `POST /api/demo` loads 5 built-in sample artifacts

---

## Step 2: PARSE

**What happens:** Each file is routed to the correct parser based on its extension.

| Extension | Parser | Library Used | What It Extracts |
|-----------|--------|-------------|-----------------|
| `.sql` | `sql_parser.py` | sqlparse + regex | CREATE statements, FROM/JOIN refs, function calls, FK references |
| `.xml` | `oic_parser.py` | xml.etree.ElementTree | Integration name, connections, step references, embedded SQL |
| `.groovy` | `groovy_parser.py` | regex | executeQuery, executeFunction, executeProcedure calls |

**Output:** Two lists:
1. **Objects** — `{name, type, source_file}` (e.g., "EMPLOYEES", "TABLE", "employees.sql")
2. **Dependencies** — `{source, target, relationship}` (e.g., "HR_EMPLOYEE_SUMMARY" → "EMPLOYEES", "REFERENCES")

**Our demo produces:** 19 objects, 41 dependencies from 5 files.

---

## Step 3: GRAPH

**What happens:** Objects become nodes, dependencies become directed edges in a NetworkX graph.

**Direction convention:** Edge A → B means "A depends on B"

**Example edges:**
```
HR_EMPLOYEE_SUMMARY → EMPLOYEES    (view depends on table)
HR_EMPLOYEE_SUMMARY → DEPARTMENTS  (view depends on table)
CALC_ANNUAL_BONUS → GET_EMPLOYEE_SALARY (function calls procedure)
COMPENSATION → CALC_ANNUAL_BONUS   (groovy calls function)
```

**Our demo graph:** 25 nodes, 34 edges

---

## Step 4: IMPACT

**What happens:** User selects an object (e.g., EMPLOYEES). The engine walks the graph in REVERSE (finding everything that depends on EMPLOYEES) using BFS (Breadth-First Search).

**Two levels of impact:**
- **Direct:** Objects that reference EMPLOYEES directly (1 hop)
- **Indirect (Transitive):** Objects that don't reference EMPLOYEES directly, but depend on something that does (2+ hops)

**Example for EMPLOYEES:**
```
Direct (6):
  HR_EMPLOYEE_SUMMARY → depends on EMPLOYEES
  PAYROLL_VIEW → depends on EMPLOYEES
  GET_EMPLOYEE_SALARY → depends on EMPLOYEES
  CALC_ANNUAL_BONUS → depends on EMPLOYEES
  HR_PACKAGE → depends on EMPLOYEES
  HR_EMPLOYEE_SYNC → depends on EMPLOYEES

Indirect (3):
  COMPENSATION → depends on CALC_ANNUAL_BONUS (which depends on EMPLOYEES)
  MONTHLY_PAYROLL_REPORT → depends on PAYROLL_VIEW (which depends on EMPLOYEES)
  ONBOARDING_FLOW → depends on HR_PACKAGE (which depends on EMPLOYEES)
```

**Risk score:** 82/100 (CRITICAL) — see [07-risk-scoring.md](07-risk-scoring.md) for the formula.

---

## Step 5: AI FIX

**What happens:** The impact results are sent to OCI Generative AI (Cohere Command A), which generates:

1. **Root Cause Analysis** — WHY modifying this object causes cascading failures
2. **Fix Recommendations** — 5 specific Oracle steps to safely make the change
3. **Testing Checklist** — What to test and which ORA- errors to watch for
4. **Rollback Plan** — How to revert if something breaks

**Two modes:**
- **Mock** (default) — deterministic, works offline, always produces clean output
- **Live** — calls OCI GenAI API, requires OCI credentials

**API:** `POST /api/analyze` with `{object_name: "EMPLOYEES"}`
