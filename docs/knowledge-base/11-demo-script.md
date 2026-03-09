# 11 — 60-Second Demo Script

## Before the Demo

1. Start the backend: `cd backend && uvicorn main:app --host 0.0.0.0 --port 8000`
2. Open browser: `http://localhost:8000/ui/`
3. You should see the dark-themed UI with the left panel and graph area

## The Script (60 seconds)

### [0-10 sec] The Problem

> "In Oracle ERP projects, when a developer changes a table like EMPLOYEES, they check DBA_DEPENDENCIES and fix the 5 PL/SQL objects it shows. But 3 days later, the OIC payroll sync fails, the BIP monthly report shows blank data, and the Groovy compensation script throws errors. Why? Because those artifacts live OUTSIDE the database — no existing Oracle tool maps them."

### [10-20 sec] Load Demo Data

**Click "Load Demo Artifacts"**

> "We parse 5 Oracle artifact files — PL/SQL, OIC flows, BIP reports, and Groovy scripts. Our parsers extract every object and dependency relationship."

*Point to the graph that appears — colored nodes representing different object types.*

### [20-35 sec] Run Impact Analysis

**Select "EMPLOYEES" from the dropdown. Click "Compute Impact."**

> "When we analyze EMPLOYEES, our graph engine finds 6 DIRECT dependencies — the objects that reference EMPLOYEES. But it also finds 3 INDIRECT dependencies — COMPENSATION, MONTHLY_PAYROLL_REPORT, and ONBOARDING_FLOW — objects that don't reference EMPLOYEES directly but depend on objects that do. These are the ones developers miss."

*Point to the red-highlighted nodes in the graph. Switch to "Impact Analysis" tab to show the table.*

### [35-50 sec] AI Recommendations

**Switch to "AI Analysis" tab.**

> "We send the full impact context to OCI Generative AI — Cohere Command A with 256K context window. It returns a root cause analysis, 5 fix recommendations specific to Oracle, a testing checklist with ORA error codes to watch for, and a rollback plan."

*Scroll through the AI output sections.*

### [50-60 sec] The Result

**Click "Download PDF Report."**

> "Risk score: 82 out of 100, CRITICAL severity. What used to take 2-5 days of manual investigation now takes 60 seconds. The entire blast radius — across PL/SQL, OIC, BIP, and Groovy — in one click."

## Key Points to Emphasize

- **Cross-artifact** — we see OIC, BIP, Groovy (DBA_DEPENDENCIES can't)
- **Transitive dependencies** — indirect impacts that developers miss
- **AI-powered** — OCI GenAI, not just static analysis
- **60 seconds** vs. 2-5 days manual investigation
- **Risk score** — quantified danger, not just a list of objects
