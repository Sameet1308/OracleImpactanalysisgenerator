# Known Limitations, Assumptions & Data Sources

**Project:** Impact Analysis Generator — Oracle Pythia-26 (LTIMindtree)

## 1. Supported Artifact Types

| Type | Extension | Parser | Extraction |
|---|---|---|---|
| SQL / PL/SQL | `.sql` | `sql_parser.py` (sqlparse + regex) | Tables, views, procedures, functions, packages, triggers, sequences + FK/ref dependencies |
| Oracle Integration Cloud (OIC) flows | `.xml` | `oic_parser.py` (xml.etree) | Flow name, connections, consumed/produced objects |
| Oracle BIP reports | `.xml` | same parser (heuristic on XML shape) | Report name, source SQL queries |
| Groovy (HCM scripts) | `.groovy` | `groovy_parser.py` (regex) | Script name, referenced tables/views |

**Not yet supported** (future work):
- Oracle Forms / Reports (`.fmb`, `.rdf`)
- APEX applications
- Workflow Builder `.wft`
- VBCS artifacts
- OCI Functions / Oracle Functions
- PeopleSoft-specific artifacts (PeopleCode, App Engine)

## 2. Known Limitations

1. **Column-level support — partial** — the graph now tracks column-level dependencies for SQL tables and views (extracts `CREATE TABLE` columns, parses `CREATE VIEW AS SELECT …` projection lists, and captures qualified `TABLE.COLUMN` references inside procedure bodies). `POST /api/analyze-column` returns `confirmed_impact` (dependents where the column reference is identified) and `possible_impact` (conservative fallback for dependents without column metadata — typically OIC/BIP/Groovy). Column-level tracking inside OIC/BIP/Groovy payloads is a phase-3 feature requiring per-format XPath/regex patterns.
2. **In-memory graph** — state lives in a single Python process. Restart clears everything. Not multi-user without externalising to a graph DB.
3. **No persistence** — uploaded artifacts are parsed on the fly; original files are not stored.
4. **Regex-based parsing** — pattern-driven rather than a full Oracle grammar. Dynamic SQL built at runtime and heavily templated PL/SQL with nested `EXECUTE IMMEDIATE` can be missed.
5. **Single-dialect** — targeted at Oracle 12c+ SQL syntax. MySQL/Postgres/SQL-Server not supported.
6. **LLM latency** — BlueVerse calls take 5–12 s. Mock mode is sub-100 ms but less specific.
7. **BlueVerse JWT expiry** — tokens expire every ~20 min; UI Settings modal lets the user paste a fresh token without restart.
8. **CORS fully open** — required because demo uses `file://` frontend. Must be tightened for production.
9. **No authentication** — hackathon-grade demo. Enterprise version would need SSO / OAuth2 / per-tenant roles.
10. **Frontend is a single `index.html`** — no component tree, no bundler. Intentional for zero build-step demo; future rewrite in React for richer interactivity.
11. **RAG index is non-persistent** — rebuilt on every `POST /api/demo` or upload. Fine for demo; future: persistent ChromaDB volume.
12. **ORA error-code validation list is a subset** — 25 common codes. The AI could legitimately cite a code we haven't whitelisted, resulting in a false-positive hallucination flag.
13. **No GenAI streaming** — responses arrive as a single blob. UI shows a loading indicator.

## 3. Assumptions

1. Artifact file names are descriptive of the object inside (we parse object names from content, but fall back to filename).
2. Oracle object names are case-insensitive; we canonicalise to UPPER in the graph.
3. Edge direction `A → B` means "A depends on B" (A reads, references, or is affected by B).
4. Risk scoring formula weights (52 % direct + 18 % indirect + 30 % type-criticality) are tuned on the demo dataset — may need re-tuning per customer.
5. The LLM prompt is English-only; non-English identifiers are passed through but the generated analysis is English.
6. BlueVerse is the sole trusted LLM endpoint (LTIMindtree BlueVerse-only policy) — we do not re-validate PII stripping on the response, only on the prompt.
7. The user running the tool has authorisation to see the dependency metadata of all uploaded artifacts — no per-object ACL.

## 4. Data Sources

| Data | Source | Licensing |
|---|---|---|
| Demo SQL artifacts | Synthetic — written by the team to mirror Oracle HCM / Fusion HR patterns | MIT-equivalent (our own) |
| Demo OIC XML | Hand-crafted to match OIC export schema | Own |
| Demo BIP XML | Hand-crafted to match BIP data-model XML | Own |
| Demo Groovy | Hand-crafted, resembles Fusion HCM Fast Formula / compensation scripts | Own |
| Oracle error codes | Public Oracle Database documentation (`ORA-*` codes) | Oracle docs — public |
| Oracle artifact concepts | Oracle Fusion / OIC / BIP / HCM public documentation + LTIMindtree SME knowledge | Public + internal |
| LLM (sole provider) | LTIMindtree-internal `AI_Elite_Ora1` agent on BlueVerse Foundry | LTIMindtree internal |
| Embedding model (RAG, local) | `sentence-transformers/all-MiniLM-L6-v2` | Apache 2.0 — runs in-process, no network |

**No customer data, no PII, no production-copied artifacts** are included in this repo.

## 5. Compliance Notes

- `.gitignore` excludes `.env`, preventing token commits.
- PII filter in AI prompt builder redacts passwords, connection strings, tokens, and emails before any code is sent to an external LLM.
- Production deployment must tighten CORS (see [DEPLOYMENT.md §7](DEPLOYMENT.md)).
- No customer data is persisted; the app is stateless across restarts.
