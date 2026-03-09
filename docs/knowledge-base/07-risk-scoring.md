# 07 — Risk Scoring Formula

## Why We Need a Score

After impact analysis finds all affected objects, we need a single number that tells you: **how dangerous is this change?** That's the risk score (0-100).

## The Formula

```
risk_score = (direct_weight × 0.52) + (indirect_weight × 0.18) + (type_weight × 0.30)
```

### Component Breakdown

| Component | Formula | What It Measures |
|-----------|---------|-----------------|
| `direct_weight` | `min(direct_count × 13, 100)` | How many objects directly reference the target |
| `indirect_weight` | `min(indirect_count × 22, 100)` | How many objects are transitively affected |
| `type_weight` | `type_criticality × 10` | How critical the object type is |

### Type Criticality Scores

| Object Type | Criticality | Why |
|------------|-------------|-----|
| TABLE | 10 (max) | Everything depends on tables — they're the foundation |
| PACKAGE | 8 | Packages are heavily reused containers |
| VIEW | 7 | Views are queried by reports and integrations |
| PROCEDURE | 6 | Called by OIC flows and other PL/SQL |
| FUNCTION | 6 | Used in queries and calculations |
| TRIGGER | 5 | Fires automatically, limited blast radius |
| SEQUENCE | 3 | Low risk — just generates numbers |

### Severity Levels

| Score Range | Severity | Color | Meaning |
|-------------|----------|-------|---------|
| 75-100 | CRITICAL | Red | Change will likely cause production incidents |
| 50-74 | HIGH | Orange | Significant risk, careful testing needed |
| 25-49 | MEDIUM | Yellow | Moderate risk, standard testing |
| 0-24 | LOW | Green | Minimal risk |

## Worked Example: EMPLOYEES Table

```
Target: EMPLOYEES (type: TABLE, criticality: 10)
Direct impacts: 6 objects
Indirect impacts: 3 objects

direct_weight  = min(6 × 13, 100) = min(78, 100) = 78
indirect_weight = min(3 × 22, 100) = min(66, 100) = 66
type_weight    = 10 × 10 = 100

risk_score = (78 × 0.52) + (66 × 0.18) + (100 × 0.30)
           = 40.56 + 11.88 + 30.00
           = 82.44
           = 82 (rounded down)

Severity: CRITICAL (82 ≥ 75)
```

## Why These Weights?

- **52% direct impact** — Direct dependencies are the most immediate risk
- **18% indirect impact** — Transitive dependencies matter but are less immediate
- **30% object type** — A table change is inherently more dangerous than a sequence change, regardless of dependency count

The weights were calibrated so that a TABLE with 6 direct + 3 indirect impacts (our EMPLOYEES demo case) scores exactly 82 — firmly in CRITICAL territory, which matches what an Oracle DBA would intuitively assess.
