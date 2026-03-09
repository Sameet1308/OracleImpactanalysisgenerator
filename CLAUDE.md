# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Impact Analysis Generator** — Oracle Pythia-26 Hackathon (LTIMindtree). Team: Pranali (10842412), Suraj (10842302), Sameet (lead).

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

1. **Mock mode must always work** — demo runs with zero OCI credentials
2. **EMPLOYEES → CRITICAL, score 82** — this exact result must be reproducible from sample data. Do not modify sample artifacts or scoring formula without verifying this.
3. **Frontend is one file** — `frontend/index.html`, no build step, no npm
4. **Graph state is in-memory** — no database, no persistence
5. **CORS open for all origins** — frontend may be opened from file:// protocol
6. **OCI GenAI calls must have 30s timeout** and fall back to mock on failure

## Architecture

```
frontend/index.html (D3.js) ──HTTP──▶ FastAPI :8000 ──▶ Parsers + NetworkX + OCI GenAI
```

- **Parsers** (`backend/parsers/`): sql_parser (sqlparse + regex), oic_parser (xml.etree), groovy_parser (regex). Dispatcher in `__init__.py` routes by file extension.
- **Graph Engine** (`backend/graph/engine.py`): NetworkX DiGraph. Edge A→B means A depends on B. Impact analysis walks predecessors (reverse). Score = 52% direct + 18% indirect + 30% type criticality.
- **AI Module** (`backend/ai/oci_genai.py`): Mock returns structured dict with root_cause, recommendations, testing_checklist, rollback_plan. Live mode calls OCI Generative AI (Cohere Command R+) via `oci` SDK.
- **Frontend**: Dark theme, 30/70 left-right layout. Left = controls. Right = 3 tabs (Graph, Impact, AI). D3.js force-directed graph with type-colored nodes. Impacted nodes turn red.

## Environment Variables (for OCI live mode)

```
OCI_GENAI_ENABLED=true
OCI_COMPARTMENT_ID=ocid1.compartment.oc1..xxx
OCI_REGION=us-chicago-1
OCI_MODEL_ID=cohere.command-r-plus
```

## Verified Metrics

- 15 objects, 30 dependencies parsed from 4 sample files
- 20 graph nodes, 24 edges
- EMPLOYEES: score 82, CRITICAL, 8 direct impacts
- Mock AI: 5 recommendations, 5 testing items, 5 rollback steps
