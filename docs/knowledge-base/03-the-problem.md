# 03 — The Problem We Solve

## The Scenario (happens on every Oracle project)

1. A developer needs to add a column to the `EMPLOYEES` table
2. They check `DBA_DEPENDENCIES` — sees 5 PL/SQL objects depend on it
3. They update those 5 objects. Ship it.
4. **3 days later:**
   - The nightly OIC payroll sync fails (it queries a view built on EMPLOYEES)
   - The monthly BIP report shows empty columns (its SQL references EMPLOYEES)
   - The compensation Groovy script throws errors (it calls a function that queries EMPLOYEES)
5. Payroll is wrong. HR escalation. Production incident. Rollback.

**Cost:** 2-5 days of investigation, emergency fixes, and re-testing.

## Why This Happens

### Gap 1: DBA_DEPENDENCIES is database-only

Oracle's built-in dependency view (`DBA_DEPENDENCIES`) tracks relationships between PL/SQL objects:
- Table → View ✓
- View → Procedure ✓
- Procedure → Package ✓

But it has **zero visibility** into:
- OIC integration flows that call those procedures
- BIP reports that query those views
- Groovy scripts that reference those functions

These artifacts live OUTSIDE the database — DBA_DEPENDENCIES can't see them.

### Gap 2: OIC Gen3 Projects are intra-project only

Oracle Integration Cloud Gen3 introduced "Projects" that visualize dependencies between integrations, connections, and lookups **within a single OIC project**. But it doesn't look outside OIC — it can't see that an integration calls a PL/SQL procedure that depends on a table that a BIP report also queries.

### Gap 3: No existing tool maps across all artifact types

Oracle has released 600+ AI agents in Fusion Cloud 26A — for invoice processing, payroll, supply chain, HR workflows. None of them address **developer tooling for cross-artifact impact analysis**.

The result: developers rely on tribal knowledge, spreadsheets, and manual code searches. This is:
- **Incomplete** — they miss OIC/BIP/Groovy dependencies
- **Slow** — 2-5 days per change assessment
- **Error-prone** — transitive dependencies (A → B → C) are nearly impossible to trace manually

## The Numbers

| Metric | Current State |
|--------|--------------|
| Time to assess impact of one change | 2-5 days |
| Dependency coverage (manual) | ~40% |
| Production incidents from missed dependencies | Frequent |
| Cross-artifact visibility | None (no tool exists) |

## What We Built

A tool that:
1. Parses ALL artifact types (PL/SQL + OIC + BIP + Groovy)
2. Builds a unified dependency graph
3. Computes blast radius with a risk score
4. Uses AI to generate fix recommendations

**Impact assessment time: Days → 60 seconds.**
