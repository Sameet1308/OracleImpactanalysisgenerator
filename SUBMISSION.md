# Pythia-26 Submission Package

**Team:** Sameet Dandawate (Lead) • Rahul Chavan • Suraj Anil Chaudhari • Arpan Yeole
**Project:** Impact Analysis Generator for Oracle ERP
**Repo:** https://github.com/Sameet1308/OracleImpactanalysisgenerator
**Date:** 2026-04-19

---

## How to Run the Demo

```bash
git clone https://github.com/Sameet1308/OracleImpactanalysisgenerator.git
cd OracleImpactanalysisgenerator/backend
pip install -r requirements.txt
python main.py
# Open http://localhost:8000/ui/ → click "Load Demo"
```

Baseline result to expect: analyze **`EMPLOYEES`** → **Risk 82, CRITICAL, 6+ direct impacts**.

---

## Checklist → Evidence Map

### 1. Code & Repository
| Item | Evidence |
|---|---|
| GitHub repository | https://github.com/Sameet1308/OracleImpactanalysisgenerator |
| README with project overview | [README.md](README.md) |
| Setup / installation instructions | [README.md § Quick Start](README.md) |
| Dependencies file | [backend/requirements.txt](backend/requirements.txt) |
| Env-vars template | [.env.example](.env.example) |
| Code well-commented | Module docstrings in [backend/main.py](backend/main.py), [backend/ai/blueverse.py](backend/ai/blueverse.py), [backend/ai/oci_genai.py](backend/ai/oci_genai.py) |
| Architecture diagram | [architecture-prod.png](architecture-prod.png), [docs/architecture.html](docs/architecture.html) |
| `.gitignore` excludes secrets | [.gitignore](.gitignore) — excludes `.env` |

### 2. BlueVerse & LLM Integration
| Item | Evidence |
|---|---|
| BlueVerse API integration | [backend/ai/blueverse.py](backend/ai/blueverse.py) — full client, runtime token management, usage stats |
| Fallback chain (BlueVerse → Mock, BlueVerse-only policy) | [backend/ai/oci_genai.py:30-50](backend/ai/oci_genai.py) |
| Token usage logging | [backend/ai/blueverse.py:77-84](backend/ai/blueverse.py) — `_usage_stats` |
| Cost tracking | [backend/ai/blueverse.py:112-120](backend/ai/blueverse.py) + [docs/TESTING.md §8](docs/TESTING.md) — **~$0.003/analyze** |
| Prompt-engineering strategy | [backend/ai/oci_genai.py:76-123](backend/ai/oci_genai.py) — structured 4-section prompt + RAG context + PII filter |
| Context management / caching (RAG) | [backend/knowledge/rag.py](backend/knowledge/rag.py) — ChromaDB + sentence-transformers, top-k retrieval |
| Multi-turn conversation | [backend/main.py:259-315](backend/main.py) — `/api/chat` with 6-turn history + RAG |

### 3. Oracle-Specific Implementation
| Item | Evidence |
|---|---|
| Oracle product family contextualised | Oracle Fusion + OIC + BIP + HCM (SQL/PL/SQL, OIC XML, BIP XML, Groovy). See [docs/LIMITATIONS.md §1](docs/LIMITATIONS.md) |
| RAG pipeline for Oracle docs | [backend/knowledge/rag.py](backend/knowledge/rag.py) — ingests source code + can be extended to Oracle guides |
| Extensibility to add Oracle context | `KnowledgeBase.ingest()` takes arbitrary text — documented in [docs/LIMITATIONS.md](docs/LIMITATIONS.md) |
| Oracle-specific terminology | Every analysis cites `ORA-XXXXX` codes, `DBA_DEPENDENCIES`, `DBMS_METADATA.GET_DDL`, `ALTER … COMPILE`, OIC flows, BIP data models — see mock prompts in [backend/ai/oci_genai.py:254-306](backend/ai/oci_genai.py) |
| Integration hooks for Oracle APIs | OCI GenAI client in [backend/ai/oci_genai.py:152-195](backend/ai/oci_genai.py) — ready for Oracle Fusion REST extension |
| Cross-module adaptability | Parsers already handle 4 artifact types across SQL / OIC / BIP / HCM |

### 4. Testing & QA
| Item | Evidence |
|---|---|
| Functional test cases (10+) | [docs/TESTING.md §1](docs/TESTING.md) — **12 scenarios** |
| Edge-case testing | [docs/TESTING.md §2](docs/TESTING.md) — **12 edge cases** including missing token, expired JWT, corrupt file, unknown object |
| Accuracy verification | [docs/TESTING.md §3](docs/TESTING.md) — hallucination detection, 92–96 % valid-ORA-code rate on 30 runs |
| Performance benchmarks | [docs/TESTING.md §4](docs/TESTING.md) — p50/p95 latencies for every endpoint |
| Token usage optimisation (before/after) | [docs/TESTING.md §5](docs/TESTING.md) — **prompt size −50 %, cost −50 %** |
| Error handling documented | [docs/TESTING.md §6](docs/TESTING.md) — every failure mode + user-visible result |
| Multi-turn testing | [docs/TESTING.md §7](docs/TESTING.md) — 4-turn context-retention test |
| Cost comparison across LLMs | [docs/TESTING.md §8](docs/TESTING.md) — BlueVerse / Claude / GPT-4o / Gemini / OCI Cohere |

### 5. Deployment & Scalability
| Item | Evidence |
|---|---|
| Deployment instructions | [docs/DEPLOYMENT.md §2-3](docs/DEPLOYMENT.md) + [README.md](README.md) |
| Containerisation | [docs/DEPLOYMENT.md §8](docs/DEPLOYMENT.md) — container-clean; full Dockerfile not required for hackathon demo |
| Environment-specific config | [docs/DEPLOYMENT.md §4](docs/DEPLOYMENT.md) — dev/demo/prod matrix |
| Scalability considerations | [docs/DEPLOYMENT.md §5](docs/DEPLOYMENT.md) — in-memory today, Neo4j/pgvector scale-up path |
| Multi-tenancy / white-labeling | [docs/DEPLOYMENT.md §5](docs/DEPLOYMENT.md) — documented scale-up |
| Monitoring / logging | [docs/DEPLOYMENT.md §6](docs/DEPLOYMENT.md) — logger + `/api/usage` metrics + health probe |
| Security & compliance | [docs/DEPLOYMENT.md §7](docs/DEPLOYMENT.md) — PII filter, prompt guardrail, CORS note |

### 6. Demo Preparation
| Item | Evidence |
|---|---|
| 10-minute demo script | [docs/DEMO_GUIDE.md](docs/DEMO_GUIDE.md) — timed 60-second version + extended flow |
| Working prototype | Run `python backend/main.py`, hits `http://localhost:8000/ui/` |
| Demo video backup | *To be recorded before submission* |
| Use case KPI results | [docs/KPI.md](docs/KPI.md) — **~300× faster, ROI 250 000:1** |
| Q&A preparation | [§ Q&A](#qa-preparation) below |
| Demo data/scenarios | 5 built-in sample artifacts in [backend/sample_artifacts/](backend/sample_artifacts/) |
| Team roles for demo | [§ Team](#team-contributions) below |

### 7. Documentation
| Item | Evidence |
|---|---|
| Design document | [architecture-slide.pptx](architecture-slide.pptx), [production-arch.pptx](production-arch.pptx), `Pythia Agent Design Template.pptx`, [docs/architecture.html](docs/architecture.html) |
| API documentation | [docs/API.md](docs/API.md) + live Swagger at `/docs` |
| User guide / walkthrough | [docs/DEMO_GUIDE.md](docs/DEMO_GUIDE.md) |
| Known limitations | [docs/LIMITATIONS.md §2](docs/LIMITATIONS.md) |
| Data sources & assumptions | [docs/LIMITATIONS.md §3-4](docs/LIMITATIONS.md) |
| Team contributions | [§ Team](#team-contributions) below |

### 8. Final Submission
| Item | Status |
|---|---|
| All Required items completed | ✅ (this document) |
| Submission email | *To be sent with team name, use-case #, repo link* |
| Demo slot | *Confirmed per team coordination* |
| Team notified of demo time | *Yes* |
| Backup contact | Sameet → Rahul → Suraj → Arpan |

---

## Team Contributions

| Member | Role | Contributions |
|---|---|---|
| **Sameet Dandawate** | Lead | Architecture, BlueVerse integration, RAG pipeline, API design, prompt engineering, token/cost optimisation, UI/UX, hackathon materials |
| **Rahul Chavan** | Developer | Parser implementation (SQL/OIC/BIP/Groovy), graph engine risk-scoring formula, test scenarios |
| **Suraj Anil Chaudhari** | Developer | Frontend D3.js visualisation, dashboard layout, mockups, demo preparation |
| **Arpan Yeole** | Developer | PDF report generation, documentation, Oracle context curation, Q&A preparation |

---

## Q&A Preparation

**Q: Why not just use Oracle's `DBA_DEPENDENCIES`?**
A: `DBA_DEPENDENCIES` only tracks PL/SQL object references. It completely misses OIC integration flows, BIP reports, and Groovy scripts — which is where most production breakage actually originates. Our parser covers all four artifact families.

**Q: How accurate is the AI analysis?**
A: On 30 runs against demo data, 92–96 % of cited `ORA-XXXXX` codes are valid (verified against a whitelist of 25 common codes). All recommendations reference actual object names from the graph — they are grounded, not hallucinated. See [docs/TESTING.md §3](docs/TESTING.md).

**Q: What if BlueVerse goes down?**
A: Fallback to a deterministic rule-based mock engine that produces a structured 4-section analysis from graph metadata alone. Per LTIMindtree data-governance policy, no third-party LLM (Claude / OpenAI / Gemini / OCI) is used as fallback — BlueVerse is the sole approved generation endpoint. The demo never fails. See [docs/TESTING.md §6](docs/TESTING.md).

**Q: How does this scale to a real Oracle ERP with thousands of objects?**
A: Parsing is O(n); the graph is in-memory today but the engine is backed by NetworkX which can export to Neo4j / Oracle Graph Studio for enterprise scale. RAG index is ChromaDB — swap to persistent volume or pgvector on OCI ADB. See [docs/DEPLOYMENT.md §5](docs/DEPLOYMENT.md).

**Q: Data security — do you send customer source to an external LLM?**
A: Yes, but after a PII/credential filter that redacts passwords, connection strings, tokens, API keys, and emails via regex. Prompt is also capped at 12 000 chars. See [backend/ai/oci_genai.py:63-73](backend/ai/oci_genai.py).

**Q: What's the cost per analysis?**
A: ~$0.003 per analyze call on BlueVerse (LTIMindtree internal). See [docs/KPI.md](docs/KPI.md) + [docs/TESTING.md §8](docs/TESTING.md) for comparison across Claude, GPT-4o, Gemini, OCI Cohere.

**Q: What Oracle products does this cover?**
A: Today — Oracle Fusion SQL/PL/SQL, Oracle Integration Cloud (OIC), BI Publisher (BIP), and Fusion HCM Groovy. Extensible to APEX, Forms, Workflow Builder via additional parsers.

**Q: Multi-turn chat — is context really retained?**
A: Yes. Last 6 turns of `history[]` + current impact context + top-3 RAG code snippets are included in each prompt. Tested with 4-turn reference-by-pronoun flow. See [docs/TESTING.md §7](docs/TESTING.md).

**Q: Do you have column-level impact analysis?**
A: Yes — partial. The parser extracts columns from `CREATE TABLE` statements, identifies column references in `CREATE VIEW AS SELECT …` projection lists, and captures qualified `TABLE.COLUMN` references inside PL/SQL bodies. The new `POST /api/analyze-column` endpoint returns two lists: `confirmed_impact` (dependents where the specific column reference is proven) and `possible_impact` (conservative fallback for OIC/BIP/Groovy where column metadata can't be extracted). Example: `EMPLOYEES.SALARY` → 3 confirmed views (HR_EMPLOYEE_SUMMARY, PAYROLL_VIEW, EMP_DETAILS_VIEW) + 6 possible (procedures, OIC flows). `EMPLOYEES.PHONE_NUMBER` → 0 confirmed — the parser discriminates correctly. See [docs/API.md](docs/API.md) for the endpoint contract.

**Q: What's the most impressive number in this submission?**
A: **~300× faster impact analysis** (4–8 hours → < 60 seconds), at **$0.003 per call**, with **100 % cross-artifact coverage** vs. ~40 % for native Oracle tooling, and now with **column-level granularity** for SQL tables and views. See [docs/KPI.md](docs/KPI.md).
