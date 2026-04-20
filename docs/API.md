# API Reference

**Base URL:** `http://localhost:8000` (local) — production: `https://<render-deployment>.onrender.com`

Interactive Swagger UI: `GET /docs`  •  OpenAPI JSON: `GET /openapi.json`

All endpoints return JSON unless noted. CORS is fully open (`*`) so the frontend may be opened via `file://`.

---

## Health & Status

### `GET /`
Health check and service state.
```json
{
  "status": "ok",
  "ai_mode": "blueverse|mock",
  "objects_loaded": 20,
  "token_status": { "status": "valid", "expires_in_minutes": 18.3 },
  "knowledge_base": { "chunks": 31, "files": 5, "objects": 21 },
  "version": "1.0.0"
}
```

### `GET /api/usage`
Token usage, latency, cost, and hallucination flags.
```json
{
  "total_calls": 42, "total_prompt_chars": 386400,
  "total_response_chars": 82100, "avg_latency_ms": 6240,
  "failed_calls": 0, "hallucination_flags": 3,
  "est_prompt_tokens": 96600, "est_response_tokens": 20525
}
```

### `GET /api/knowledge/status`
RAG knowledge-base index size.

### `GET /api/token/status`
Current BlueVerse JWT status (valid / expiring_soon / expired).

---

## Artifact Ingestion

### `POST /api/upload` (multipart)
Upload `.sql`, `.xml`, or `.groovy` artifact files.
**Form field:** `files` (list of files).
```json
{ "files_processed": 3, "objects_found": 12, "dependencies_found": 17 }
```

### `POST /api/demo`
Load the 5 built-in sample artifacts. **Clears graph first** — idempotent for clean demos.
```json
{ "files_processed": 5, "objects_found": 21, "dependencies_found": 24,
  "knowledge_base": { "chunks": 31, "files": 5, "objects": 21 } }
```

---

## Impact Analysis

### `POST /api/analyze`
Compute the blast radius and AI analysis for a single object.
**Body:** `{ "object_name": "EMPLOYEES" }`
```json
{
  "object_name": "EMPLOYEES",
  "risk_score": 82,
  "severity": "CRITICAL",
  "direct_impact": [ { "name": "V_EMPLOYEE_SUMMARY", "type": "VIEW" }, ... ],
  "indirect_impact": [ ... ],
  "all_impacted": [ ... ],
  "code_context_used": 5,
  "ai_analysis": {
    "root_cause": "...",
    "recommendations": [ "...", "...", "...", "...", "..." ],
    "testing_checklist": [ ... ],
    "rollback_plan": [ ... ]
  },
  "ai_mode": "blueverse"
}
```
Errors: `400` if no artifacts loaded, `404` if object unknown (returns list of available names).

### `GET /api/report/{object_name}`
Download a formatted PDF impact report for the named object. Returns `application/pdf`.

---

## Chat (Multi-Turn)

### `POST /api/chat`
Ask Pythia follow-up questions with conversation context retention.
**Body:**
```json
{
  "message": "Which of those are OIC flows?",
  "object_name": "EMPLOYEES",
  "history": [
    { "role": "user", "content": "..." },
    { "role": "assistant", "content": "..." }
  ]
}
```
**Response:** `{ "response": "...", "mode": "blueverse" | "mock" }`

Last 6 turns of history + current impact context + top-3 RAG code chunks are attached to the prompt.

---

## Graph & Objects

### `GET /api/objects`
List every parsed object currently in the graph — used by UI dropdown.

### `GET /api/graph`
Full dependency graph JSON for D3.js visualisation.
```json
{
  "nodes": [ { "id": "EMPLOYEES", "type": "TABLE", "source_file": "employees.sql" }, ... ],
  "edges": [ { "source": "V_EMPLOYEE_SUMMARY", "target": "EMPLOYEES", "kind": "READS" }, ... ]
}
```

---

## Runtime Configuration

### `POST /api/token`
Update the BlueVerse JWT without restarting the server — the UI Settings modal uses this.
**Body:** `{ "token": "<jwt>" }`  → returns expiry status.

---

## Error Format

HTTP errors return FastAPI's standard shape:
```json
{ "detail": "Object 'XYZ' not found. Available: [EMPLOYEES, ...]" }
```
All LLM failures degrade gracefully to mock mode — never surface as HTTP 5xx.
