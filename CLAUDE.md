# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Impact Analysis Generator** — Oracle Pythia-26 Hackathon (LTM). Team: Sameet Dandawate (lead), Rahul Chavan, Suraj Anil Chaudhari, Arpan Yeole.

Solves the Oracle ERP problem of unknown cross-artifact dependencies. Upload Oracle artifacts (SQL/PL/SQL, OIC XML, BIP XML, Groovy) → tool parses every object and dependency → select any object → see full blast radius → get AI-powered root cause + fix recommendations + rollback plan.

## Running Locally

```bash
# Backend
cd backend
pip install -r requirements.txt
python main.py
# http://localhost:8000 (API) / http://localhost:8000/docs (Swagger) / http://localhost:8000/ui/ (frontend)

# Frontend (alternative: open directly in browser)
open frontend/index.html
```

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/` | Health check — returns `{status, ai_mode, objects_loaded, version}` |
| POST | `/api/upload` | Upload artifact files (multipart) |
| POST | `/api/demo` | Load 4 built-in sample artifacts (clears graph first) |
| POST | `/api/analyze` | Compute impact — body: `{object_name: str}` |
| GET | `/api/objects` | List all parsed objects |
| GET | `/api/graph` | Full dependency graph JSON for D3.js |

## Hard Rules

1. **Mock mode must always work** — demo runs with zero external LLM credentials
2. **EMPLOYEES → CRITICAL, score 82** — this exact result must be reproducible from sample data. Do not modify sample artifacts or scoring formula without verifying this.
3. **Frontend is one file** — `frontend/index.html`, no build step, no npm
4. **Graph state is in-memory** — no database, no persistence
5. **CORS open for all origins** — frontend may be opened from file:// protocol
6. **BlueVerse calls must have 30s timeout** and fall back to mock on failure

## Architecture

```
frontend/index.html (D3.js) ──HTTP──▶ FastAPI :8000 ──▶ Parsers + NetworkX + BlueVerse/OCI GenAI
```

- **Parsers** (`backend/parsers/`): sql_parser (sqlparse + regex), oic_parser (xml.etree), groovy_parser (regex). Dispatcher in `__init__.py` routes by file extension.
- **Graph Engine** (`backend/graph/engine.py`): NetworkX DiGraph. Edge A→B means A depends on B. Impact analysis walks predecessors (reverse). Score = 52% direct + 18% indirect + 30% type criticality.
- **AI Module** (`backend/ai/`): 2-tier chain — BlueVerse Agent → deterministic mock. BlueVerse is the sole approved LLM endpoint per LTM data-governance policy (no third-party LLMs). `blueverse.py` calls the BlueVerse Foundry REST API. `oci_genai.py` is the AI dispatcher (filename kept for import compatibility) that routes to BlueVerse or mock.
- **Frontend**: Enterprise light theme, 3-column layout (Change Details | Dependency Graph | Impact Summary). Login → Connect → Artifacts → Dashboard flow. D3.js radial spoke graph with card-style nodes, edge labels, risk-colored connectors.

## Environment Variables

```
# BlueVerse Agent (sole LLM provider — set in backend/.env)
BLUEVERSE_ENABLED=true
BLUEVERSE_TOKEN=<JWT token>
BLUEVERSE_SPACE=AI_Elite_ora1_45e8873c
BLUEVERSE_FLOW_ID=69ba8b9226e0ed36e19c0c05
```

## Verified Metrics

- 25 objects parsed from 4 sample files
- 20 graph nodes, 24 edges
- EMPLOYEES: score 82, CRITICAL, 6 direct + 3 indirect impacts
- BlueVerse AI: Oracle-specific recommendations with ORA error codes
- Mock AI: 5 recommendations, 5 testing items, 5 rollback steps

## Session Discipline — MANDATORY for every Claude session

### At Session Start
1. Read this file first
2. Read `CHANGELOG.md` to understand what was done previously
3. Run `git log --oneline -10` to see recent commits
4. Run `git status` to check for uncommitted work
5. Summarize to the user: "Here's where we left off: [last commit], [open items]"

### During Work
1. Work in the **main folder** (`D:\WorkspaceAI\oracle-pythia-impact`), NOT in worktrees
2. Test every change in the browser before calling it done — take a screenshot
3. Commit after each meaningful unit of work, not in bulk at the end
4. Never hardcode credentials — use `.env` files

### At Session End
1. Commit all pending changes with descriptive messages
2. Push to GitHub
3. Update `CHANGELOG.md` with what was done this session
4. Verify `git status` is clean

### CHANGELOG.md Format
Each session entry should follow:
```
## YYYY-MM-DD — Session Summary Title
**What changed:**
- bullet points of changes made
**Files modified:**
- list of files
**Open items:**
- what still needs work
**Next steps:**
- what to do next session
```
