# Impact Analysis Generator

**Oracle Pythia-26 Hackathon** | LTIMindtree

> Upload Oracle ERP artifacts. See every dependency. Know the blast radius before you break production.

## The Problem

Oracle ERP environments have hundreds of interconnected artifacts — tables, views, procedures, OIC integrations, BIP reports, Groovy scripts. Modifying one object can silently break others. Standard Oracle tools (`DBA_DEPENDENCIES`) only track PL/SQL references and completely miss cross-artifact dependencies across OIC, BIP, and Groovy.

## Our Solution

Upload your Oracle artifacts and instantly see:
- **Full dependency graph** — every object and how they connect
- **Blast radius analysis** — select any object, see all direct and indirect impacts
- **Risk scoring** — weighted formula (52% direct + 18% indirect + 30% type criticality)
- **AI-powered recommendations** — root cause analysis, fix steps, testing checklist, rollback plan

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Backend | Python, FastAPI, NetworkX |
| Frontend | Vanilla HTML/JS, D3.js (single file, no build step) |
| Parsers | sqlparse + regex (SQL/PL/SQL), xml.etree (OIC/BIP XML), regex (Groovy) |
| AI | OCI Generative AI (Cohere Command A) with mock fallback |
| Reports | ReportLab (PDF generation) |

## Architecture

```
frontend/index.html (D3.js) ──HTTP──> FastAPI :8000 ──> Parsers + NetworkX + OCI GenAI
```

**Parsers** extract objects and dependencies from 4 artifact types:
- `sql_parser.py` — Tables, views, procedures, functions, packages, triggers, sequences
- `oic_parser.py` — OIC integration flows and connections
- `groovy_parser.py` — Groovy/HCM scripts

**Graph Engine** builds a NetworkX DiGraph where edges represent dependencies. Impact analysis walks predecessors to compute the full blast radius.

## Quick Start

```bash
# Clone the repo
git clone https://github.com/Sameet1308/OracleImpactanalysisgenerator.git
cd OracleImpactanalysisgenerator

# Install dependencies
cd backend
pip install -r requirements.txt

# Run the server
python main.py
```

Then open: **http://localhost:8000/ui/**

Click **"Load Demo"** to load sample artifacts and explore the dependency graph.

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/` | Health check |
| `POST` | `/api/upload` | Upload artifact files (multipart) |
| `POST` | `/api/demo` | Load built-in sample artifacts |
| `POST` | `/api/analyze` | Compute impact — body: `{"object_name": "EMPLOYEES"}` |
| `GET` | `/api/objects` | List all parsed objects |
| `GET` | `/api/graph` | Full dependency graph JSON |
| `GET` | `/api/report/{name}` | Download PDF impact report |

Interactive API docs available at **http://localhost:8000/docs**

## Sample Demo Output

Using the built-in sample artifacts (5 files: SQL, OIC XML, BIP XML, Groovy):

- **20 nodes, 24 edges** in the dependency graph
- **EMPLOYEES table** → Risk Score **82/100**, Severity **CRITICAL**, 8 direct impacts
- AI generates root cause analysis, 5 fix recommendations, 5 test items, 5 rollback steps

## OCI GenAI (Optional)

The app works fully in demo mode without any credentials. To enable live AI analysis with Oracle Cloud:

```bash
export OCI_GENAI_ENABLED=true
export OCI_COMPARTMENT_ID=ocid1.compartment.oc1..xxx
export OCI_REGION=us-chicago-1
export OCI_MODEL_ID=cohere.command-a-03-2025
```

Falls back to mock mode automatically if OCI is unreachable (30s timeout).

## Project Structure

```
├── backend/
│   ├── main.py                 # FastAPI app — 6 REST endpoints
│   ├── requirements.txt
│   ├── parsers/
│   │   ├── __init__.py         # Dispatcher — routes by file extension
│   │   ├── sql_parser.py       # SQL/PL/SQL parser (sqlparse + regex)
│   │   ├── oic_parser.py       # OIC XML parser (xml.etree)
│   │   └── groovy_parser.py    # Groovy script parser (regex)
│   ├── graph/
│   │   └── engine.py           # NetworkX DiGraph + impact scoring
│   ├── ai/
│   │   └── oci_genai.py        # OCI GenAI client + mock fallback
│   ├── pdf_report.py           # PDF report generation (ReportLab)
│   └── sample_artifacts/       # 5 built-in demo files
│       ├── employees.sql
│       ├── hr_sync.xml
│       ├── onboarding_flow.xml
│       ├── payroll_report.xml
│       └── compensation.groovy
├── frontend/
│   └── index.html              # Single-file UI (D3.js, dark theme)
├── docs/
│   └── pitch-deck.html         # Interactive pitch deck
└── render.yaml                 # Render deployment config
```

## Submission Package (Pythia-26)

All hackathon checklist items are mapped to evidence in [SUBMISSION.md](SUBMISSION.md).

| Area | Document |
|---|---|
| Submission checklist → evidence | [SUBMISSION.md](SUBMISSION.md) |
| Test scenarios, edge cases, accuracy, performance, cost comparison | [docs/TESTING.md](docs/TESTING.md) |
| API reference | [docs/API.md](docs/API.md) |
| Deployment, scalability, monitoring | [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) |
| Known limitations, assumptions, data sources | [docs/LIMITATIONS.md](docs/LIMITATIONS.md) |
| Use-case KPIs & ROI | [docs/KPI.md](docs/KPI.md) |
| Demo guide | [docs/DEMO_GUIDE.md](docs/DEMO_GUIDE.md) |
| Session/change log | [CHANGELOG.md](CHANGELOG.md) |

## Team

| Name | Role | ID |
|------|------|----|
| Sameet | Lead | — |
| Pranali | Developer | 10842412 |
| Suraj | Developer | 10842302 |
