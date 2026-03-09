# 10 — Competitor Gap Analysis

## What Oracle Already Provides

### 1. DBA_DEPENDENCIES (Database View)

**What it is:** A built-in Oracle Database dictionary view that shows dependencies between database objects.

**What it tracks:**
- TABLE → VIEW (view references table) ✓
- VIEW → PROCEDURE (procedure uses view) ✓
- PROCEDURE → PACKAGE (package calls procedure) ✓
- FUNCTION → TRIGGER (trigger calls function) ✓

**What it CANNOT see:**
- OIC integration flows ✗
- BIP reports and data models ✗
- Groovy HCM scripts ✗
- Any artifact that lives OUTSIDE the Oracle Database ✗

**Why:** DBA_DEPENDENCIES only queries the database's internal catalog. OIC, BIP, and Groovy artifacts live in separate Oracle Cloud services — they're not registered in the database.

### 2. OIC Gen3 Projects (Integration Cloud)

**What it is:** Oracle Integration Cloud Generation 3 introduced "Projects" — a way to organize and visualize integrations.

**What it tracks:**
- Integration → Connection (which connections an integration uses) ✓
- Integration → Lookup (which lookups are referenced) ✓
- Integration → Library (shared code) ✓

**What it CANNOT see:**
- PL/SQL objects (tables, views, procedures) the integration calls ✗
- BIP reports ✗
- Groovy scripts ✗
- Any artifact OUTSIDE the OIC project ✗

**Why:** OIC Gen3 Projects are scoped to a single OIC project. They show intra-project relationships, not cross-platform dependencies.

### 3. Oracle Fusion 26A AI Agents (600+)

**What they do:** Oracle has released 600+ embedded AI agents across Fusion Cloud applications:
- Invoice processing agents (AP)
- Payroll calculation agents (HCM)
- Supply chain optimization agents (SCM)
- Employee self-service agents (HR)

**What they DON'T do:**
- None of them address **developer tooling** ✗
- None analyze **code dependencies** ✗
- None perform **cross-artifact impact analysis** ✗

These are business-user-facing agents, not developer tools.

### 4. Oracle Fusion Documentation

**What it is:** Oracle's official product documentation for Fusion Cloud apps (HCM, ERP, SCM).

**Is it relevant to our hackathon?**

**Partially.** Here's the distinction:
- Fusion docs describe **standard product behavior** (how HCM processes payroll, how ERP handles AP)
- Our tool analyzes **custom extensions** built on top of Fusion (PL/SQL, OIC, BIP, Groovy)
- Understanding Fusion context helps explain WHY certain objects exist, but it doesn't solve the dependency mapping problem

**Bottom line:** Fusion docs are useful background knowledge for understanding the Oracle ecosystem, but they don't provide the cross-artifact impact analysis capability we built.

## The Gap We Fill

| Capability | DBA_DEPENDENCIES | OIC Gen3 | Fusion AI Agents | **Our Tool** |
|-----------|:----------------:|:---------:|:----------------:|:------------:|
| PL/SQL dependencies | ✓ | ✗ | ✗ | **✓** |
| OIC flow dependencies | ✗ | ✓ (intra-project) | ✗ | **✓** |
| BIP report dependencies | ✗ | ✗ | ✗ | **✓** |
| Groovy script dependencies | ✗ | ✗ | ✗ | **✓** |
| **Cross-artifact** mapping | ✗ | ✗ | ✗ | **✓** |
| Transitive (indirect) impact | ✗ | ✗ | ✗ | **✓** |
| Risk scoring | ✗ | ✗ | ✗ | **✓** |
| AI fix recommendations | ✗ | ✗ | ✗ | **✓** |
| Visual dependency graph | ✗ | Partial | ✗ | **✓** |

## Our USP (Unique Selling Proposition)

**"The only tool that maps dependencies across ALL Oracle artifact types and computes blast radius with AI-powered fix recommendations."**

No existing Oracle tool — built-in view, cloud service, or AI agent — provides unified cross-artifact dependency analysis. We built what Oracle hasn't.
