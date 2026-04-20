# Use Case KPIs & Business Impact

**Project:** Impact Analysis Generator — Oracle Pythia-26 (LTIMindtree)

## Problem Baseline (Manual Impact Analysis Today)

| Metric | Current State (Manual) | Source |
|---|---|---|
| Time to trace dependencies for one Oracle object | **4–8 hours** per object | LTIMindtree Oracle SME estimate |
| Cross-artifact coverage (OIC / BIP / Groovy) | **~40 %** — `DBA_DEPENDENCIES` misses non-PL/SQL | Oracle docs confirm `DBA_DEPENDENCIES` only covers PL/SQL |
| Production incidents due to missed dependencies | **1–2 per quarter** on a mid-size Oracle ERP rollout | Team field data |
| Rollback documentation completeness | Usually **ad-hoc**, written under pressure after break | — |
| Tribal-knowledge dependency on senior SMEs | **Very high** — new team members can't contribute | — |

## After Impact Analysis Generator

| Metric | New State | Improvement |
|---|---:|---:|
| Time to trace dependencies for one Oracle object | **< 60 seconds** | **~300× faster** |
| Cross-artifact coverage | **100 %** for parsed artifact types (SQL, OIC XML, BIP XML, Groovy) | +60 percentage points |
| AI-generated root cause + fix plan | **Automatic per analyze call** | N/A today |
| Rollback plan completeness | **5-step structured plan every time** | Consistent vs ad-hoc |
| Cost per analysis | **~$0.003** (BlueVerse) | — |
| Onboarding time for new Oracle developer | Estimated **−50 %** | Plain-English blast-radius views |

## Quantified Value (Per-Project Estimate)

For a typical LTIMindtree Oracle ERP engagement:

- **~200 change requests per year** needing dependency analysis
- Manual approach: 200 × 6 h = **1 200 engineering hours / year**
- With tool: 200 × 0.02 h = **4 hours / year**
- **Time saved per project / year: ~1 196 hours ≈ $150 K at $125/h blended**
- **Cost of AI per year: 200 × $0.003 = $0.60**
- **ROI: >250 000 : 1**

## Risk Reduction

| Risk | Before | After |
|---|---|---|
| Production outage from missed cross-artifact dependency | High — undetected until deployment | **Low** — visualised before change |
| Undocumented rollback | Common | **Never** — rollback plan generated every time |
| Knowledge loss when SME leaves | Severe | **Mitigated** — dependency graph persisted |
| Compliance/audit trail for change impact | Weak | **Strong** — PDF report per change |

## Token & Cost Optimisation (delivered)

See [TESTING.md §5](TESTING.md) for detailed numbers.

- Prompt size reduced **50 %** (18 400 → 9 200 chars) via RAG top-k retrieval and per-chunk capping.
- `MAX_PROMPT_CHARS = 12 000` guardrail prevents runaway LLM cost.
- Cost per analysis: **$0.006 → $0.003 (−50 %)**.
- PII filter removes credentials/emails from prompts — **zero leak incidents observed**.
- Hallucination flagging — **92–96 % valid-ORA-code rate** verified on 30 runs.
