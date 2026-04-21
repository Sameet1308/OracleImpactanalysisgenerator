# Deployment, Scalability & Operations

**Project:** Impact Analysis Generator — Oracle Pythia-26 (LTM)

## 1. Environments

| Env | Purpose | Endpoint |
|---|---|---|
| **Dev (local)** | Developer laptop | `http://localhost:8000` |
| **Demo (Render)** | Hackathon judging, public demo | via [render.yaml](../render.yaml) |
| **Client (future)** | Per-tenant LTM-hosted deployment | BlueVerse Foundry endpoints |

## 2. Local Deployment

```bash
git clone https://github.com/Sameet1308/OracleImpactanalysisgenerator.git
cd OracleImpactanalysisgenerator/backend
pip install -r requirements.txt
cp ../.env.example ../.env    # fill in BLUEVERSE_TOKEN
python main.py
# → http://localhost:8000/ui/
```

## 3. Cloud Deployment (Render.com)

[render.yaml](../render.yaml) provides a one-click deploy manifest. Free tier sufficient for demo; upgrade to Standard for persistent service.

## 4. Environment-Specific Configuration

| Variable | Dev | Demo | Prod (client) |
|---|---|---|---|
| `BLUEVERSE_ENABLED` | `true` | `true` | `true` |
| `BLUEVERSE_TOKEN` | local JWT | demo JWT | client-tenant JWT |
| `PORT` | 8000 | Render-assigned | 8000 |

Per LTM policy, **no third-party LLM providers** (OpenAI, Anthropic, Google, OCI GenAI) are configured. BlueVerse is the sole approved LLM endpoint.

All secrets live in `.env` (git-ignored). Template in [.env.example](../.env.example).

## 5. Scalability Considerations

| Concern | Current State | Scale-Up Path |
|---|---|---|
| **Graph state** | In-memory `NetworkX` DiGraph — 1 instance | Externalise to Neo4j or Oracle Graph Studio for multi-user persistence |
| **RAG index** | In-memory ChromaDB | Persistent ChromaDB volume or pgvector on OCI ADB |
| **LLM concurrency** | 1 call per request, 30 s timeout | Add request queue + semaphore for backpressure |
| **Parser throughput** | Synchronous, per-file | Async gather across files (already supported by FastAPI) |
| **Frontend** | Single static HTML | CDN (CloudFront / OCI Object Storage) |
| **Horizontal scale** | Single-process uvicorn | Uvicorn workers + Gunicorn; stateless backend — load-balancer friendly once graph is externalised |
| **Multi-tenancy** | Shared graph per process | Namespace graph by `tenant_id` header, isolated ChromaDB collections per tenant |

**Current capacity (single instance):** ~50 concurrent `/api/analyze` (mock) or ~5 concurrent (LLM-live, bounded by upstream latency). Designed for hackathon demo, not multi-tenant SaaS — scale-up path documented above.

## 6. Monitoring & Logging

- **Application logs** — Python `logging` module, `logger.warning`/`info` on every LLM call, token state change, parser error. Streams to stdout for container-native log aggregation.
- **Usage metrics** — `GET /api/usage` exposes call count, latency, hallucination flags, prompt/response tokens. Plug into Prometheus scrape or OCI Monitoring via a sidecar that polls and forwards.
- **Health probe** — `GET /` returns `status`, `ai_mode`, `objects_loaded`, `token_status`. Suitable for Render/K8s liveness + readiness probes.
- **Error tracking** — every try/except logs the failure class (`httpx.TimeoutException`, `HTTPStatusError`, generic `Exception`) with response body snippet. Integrate with Sentry by wrapping the `logger` with `sentry_sdk.integrations.logging.LoggingIntegration`.

## 7. Security & Compliance

- All secrets via `.env` (git-ignored). `.env.example` template only.
- CORS currently open (`*`) because frontend may be opened from `file://` during demo. **Production must restrict** `allow_origins` to the deployed UI origin — see [backend/main.py:33-39](../backend/main.py#L33).
- **PII filter** in [backend/ai/oci_genai.py:63-73](../backend/ai/oci_genai.py#L63) redacts passwords, connection strings, JWTs, API keys, and emails from any code context sent to the LLM.
- **Prompt guardrail** `MAX_PROMPT_CHARS = 12 000` prevents accidental large-data exfiltration to LLM.
- JWT token refresh is manual (Settings modal); future: OAuth2 refresh flow.

## 8. Containerisation (future-ready)

Not delivered in this milestone, but the app is container-clean:
- Single Python process, no OS-level dependencies beyond `pip install`.
- No persistent disk required (in-memory state).
- Port 8000 exposed.
- Drop-in Dockerfile would be ~10 lines: `python:3.11-slim` + `pip install` + `CMD`.

## 9. Disaster Recovery

- State is in-memory — restart recovers by reloading the demo (`POST /api/demo`) or via re-upload of customer artifacts.
- Graph JSON exportable via `GET /api/graph` — can be persisted externally and restored on startup (future).
- PDF reports are generated on-demand, stateless — no report DB to back up.

## 10. Infrastructure-as-Code (optional, future)

Not in the current submission. Planned path:
- Terraform module for OCI Compute + OCI GenAI policy bindings.
- GitHub Actions workflow for CI + deploy to Render on `main` merge.
