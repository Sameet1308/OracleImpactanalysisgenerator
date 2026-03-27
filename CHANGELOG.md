# CHANGELOG

Project progress log for Oracle ERP Impact Analysis Generator.
Each session is documented with changes, files modified, and next steps.

---

## 2026-03-23 — Enterprise UI Overhaul + BlueVerse Integration

**What changed:**
- Integrated BlueVerse Marketplace agent (AI_Elite_Ora1) as primary AI backend
- Added 3-tier AI fallback: BlueVerse → OCI GenAI → Mock
- Redesigned frontend from dark theme to Oracle-branded enterprise light theme
- Added login screen with email/password + Oracle SSO option
- Added phased onboarding flow: Connect → Artifacts → Dashboard
- Built 3-column dashboard layout: Change Details | Dependency Graph | Impact Summary
- Graph now shows clean placeholder until user runs analysis (no more node dump)
- Card-style SVG nodes with colored type icons and white label cards
- Edge labels on connectors (Calls, Reads, Depends On, Uses, Triggers)
- Risk-colored edges: red for critical paths, orange for high impact, gray dashed for indirect
- Radial spoke layout with target node centered and glowing
- Bottom tabs: Evidence, Test Scope, Rollback Plan, Call Hierarchy — all populated from AI
- Right panel: Risk Score badge, impact stats, recommended tests, rollback risks, confidence %
- Nav links functional: Dashboard, Analyze Change, Artifact Explorer, Reports
- Updated .gitignore to exclude .claude/, node_modules, pitch deck files
- Updated CLAUDE.md with session discipline rules

**Files modified:**
- `frontend/index.html` — complete UI rewrite (1042 lines)
- `backend/ai/blueverse.py` — new BlueVerse API client
- `backend/ai/oci_genai.py` — updated with 3-tier fallback logic
- `backend/main.py` — added python-dotenv loading
- `backend/requirements.txt` — added python-dotenv, httpx
- `backend/.env` — BlueVerse token (gitignored)
- `.env.example` — placeholder config for new developers
- `.gitignore` — added .claude/, node_modules, pitch_deck.*
- `CLAUDE.md` — updated architecture, env vars, session discipline
- `CHANGELOG.md` — created (this file)

**Commits this session:**
- `d99c022` Integrate BlueVerse agent as primary AI backend
- `4a9d193` Redesign UI: Oracle light theme, meaningful graph, risk gauge
- `eb4ded1` Enterprise UI: filtered graph, flow layout, clean header
- `8855aba` Update gitignore: exclude pitch deck, node_modules, worktree
- `c6a5e9b` WIP: Login screen, phased onboarding, radial graph layout
- `b977bbe` Oracle Redwood widget dashboard with login and onboarding flow
- `e27b62a` Redesign UI to match enterprise mockup: 3-column layout
- `3c09bf4` Card-style graph nodes, layout fixes, viewport fit
- `f0509cd` Fix nav links and bottom tabs visibility
- `7670aaa` Fix UI: graph placeholder, nav links, edge colors, tab sizing

**Open items:**
- Graph nodes overlap on small screens — need better collision handling
- Left panel nav items (PL/SQL, Reports, etc.) are cosmetic — not wired to filter
- BlueVerse JWT token expires — need refresh mechanism or user prompt
- PDF export endpoint (`/api/report/`) not implemented yet
- Artifact Explorer view needs its own layout (currently reuses dashboard)

**Next steps:**
- Polish graph: curved edges, better spacing, intermediary dots
- Wire left panel nav to filter objects by type
- Add PDF report generation endpoint
- Prepare 60-second demo script for hackathon judging
- Consider metadata-first architecture for enterprise deployment

---

## 2026-03-10 — README + Deployment Config

**What changed:**
- Added comprehensive README with setup instructions, architecture diagram, API docs
- Added Render deployment config for free cloud hosting
- Removed internal reference docs from repo (kept pitch deck only)

**Commits:**
- `427118a` Add comprehensive README
- `3b8404e` Add Render deployment config
- `dd9dc42` Remove internal reference docs

---

## 2026-03-09 — Hackathon Enhancements

**What changed:**
- Added mobile-responsive layout for phone/tablet demo
- Created knowledge base: 14 explainer files covering every concept
- Updated AI model to Cohere Command A with research-backed pitch claims
- Built interactive pitch deck for hackathon judging
- Enhanced graph: richer visualization, indirect impacts, PDF export

**Commits:**
- `28acd42` Add mobile-responsive layout
- `b246207` Add knowledge base: 14 files
- `5b39cec` Update to Cohere Command A
- `535f489` Add interactive pitch deck
- `755bedb` Enhance for hackathon: richer graph, indirect impacts, PDF export

---

## 2026-03-08 — Initial Build

**What changed:**
- Built complete Impact Analysis Generator from scratch
- SQL/PL/SQL parser, OIC XML parser, Groovy parser
- NetworkX graph engine with risk scoring
- FastAPI backend with 6 REST endpoints
- D3.js frontend with force-directed dependency graph
- Mock AI module with structured recommendations

**Commits:**
- `5a1c23b` Initial commit: Impact Analysis Generator
- `e742011` Initial commit
