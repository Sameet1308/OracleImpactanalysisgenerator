# 12 — Panel Q&A Preparation

## Questions the Jury Might Ask (and How to Answer)

### Q: "How is this different from DBA_DEPENDENCIES?"

**A:** DBA_DEPENDENCIES only tracks objects inside the Oracle Database — tables, views, procedures, packages. It has zero visibility into OIC integration flows, BIP reports, or Groovy scripts. These artifacts live outside the database in separate Oracle Cloud services. Our tool parses ALL artifact types and builds a unified graph that crosses platform boundaries.

### Q: "Does OIC Gen3 already solve this?"

**A:** OIC Gen3 Projects show dependencies within a single OIC project — which integrations use which connections and lookups. But it doesn't look outside OIC. It can't see that an integration calls a PL/SQL procedure that depends on a table that a BIP report also queries. Our tool connects OIC to PL/SQL to BIP to Groovy in one graph.

### Q: "Why not just use Oracle's 600+ AI agents?"

**A:** Oracle's Fusion AI agents are business-user-facing — they help with invoice processing, payroll calculations, supply chain optimization. None of them are developer tools. None analyze code dependencies or perform impact analysis. We built the developer tooling layer that's missing from Oracle's AI strategy.

### Q: "How accurate is the parsing?"

**A:** Our parsers use a combination of SQL tokenization (sqlparse library) and regex pattern matching. For the demo artifacts, we achieve 100% accuracy — every object and dependency is captured. For production use, the parsers would need to handle edge cases (dynamic SQL, complex package bodies), but the architecture supports extensibility.

### Q: "Can this work with real Oracle environments?"

**A:** Yes. The architecture is designed for it:
- PL/SQL files can be exported from SQL Developer or queried from ALL_SOURCE
- OIC flows can be exported as .iar files (which contain XML)
- BIP reports can be exported as .xdoz files (which contain XML)
- Groovy scripts can be exported from HCM Setup
- The parsing pipeline processes any files uploaded through the API

### Q: "Why Cohere Command A instead of other models?"

**A:** Three reasons:
1. **Data sovereignty** — OCI GenAI keeps enterprise data inside the Oracle tenancy (no data leaving to external AI providers)
2. **256K context** — We can fit an entire schema + all impacted objects in a single prompt
3. **Enterprise optimization** — Command A is specifically optimized for agentic enterprise tasks and matches GPT-4o on enterprise benchmarks

### Q: "What's the risk scoring formula?"

**A:** `score = (direct_weight × 0.52) + (indirect_weight × 0.18) + (type_weight × 0.30)`. It weighs three factors: how many objects directly depend on the target (52%), how many are transitively affected (18%), and how critical the object type is (30%). A TABLE has maximum type criticality because everything else is built on tables. See [07-risk-scoring.md](07-risk-scoring.md) for the full breakdown.

### Q: "What happens if OCI GenAI is unavailable?"

**A:** The system gracefully degrades. We have a mock engine that generates the same structured output (root cause, recommendations, testing checklist, rollback plan) using deterministic rules. The impact analysis (graph traversal, risk scoring) works entirely offline — it doesn't depend on AI at all.

---

## Questions TO ASK the Panel/Organizers

### About Infrastructure
1. "Will OCI Compute instances be pre-provisioned, or do we deploy from scratch?"
2. "Is there a shared OCI tenancy with GenAI service enabled, or do we use our own?"
3. "Which OCI regions are available? (GenAI is region-specific — we need us-chicago-1 or similar)"

### About Evaluation
4. "Is the judging focused more on the technical implementation or the business value?"
5. "Do you prefer a live demo with real OCI GenAI calls, or is mock mode acceptable?"

### About Scope
6. "Should we focus on the EMPLOYEES demo case, or prepare multiple object analyses?"
7. "Is there a presentation time limit beyond the demo itself?"

### About Data
8. "Can we use sample/synthetic Oracle data, or do you expect us to connect to a live Fusion instance?"
9. "Are there any specific Oracle modules (HCM, ERP, SCM) you'd like us to focus on?"
