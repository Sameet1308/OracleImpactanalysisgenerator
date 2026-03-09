# 05 — OCI Generative AI

## What is Generative AI?

Generative AI = AI that generates text, code, or images. Think ChatGPT, but for enterprise use.

## What is OCI Generative AI?

It's Oracle's managed AI service inside OCI. Instead of calling OpenAI's API (where your data leaves your cloud), you call OCI GenAI — and your data stays inside your Oracle tenancy.

**Why this matters for enterprises:** Oracle ERP data contains employee salaries, financial records, PII. Companies don't want this going to external AI providers. OCI GenAI keeps it all inside Oracle Cloud.

## Available Models on OCI GenAI (as of 2026)

| Model | Provider | Strength |
|-------|----------|----------|
| **Cohere Command A** | Cohere | Enterprise tasks, 256K context, agentic |
| Cohere Command R+ 08-2024 | Cohere | General purpose, 128K context |
| Meta Llama 4 Scout/Maverick | Meta | Open-source, reasoning |
| xAI Grok 4 Fast | xAI | Fast inference |
| OpenAI gpt-oss (20B/120B) | OpenAI | Open-source GPT variants |

## Why We Chose Cohere Command A

| Feature | Command A | Command R+ |
|---------|-----------|------------|
| Context window | **256,000 tokens** | 128,000 tokens |
| Throughput | **150% faster** | Baseline |
| Agentic tasks | **Optimized** | General |
| Enterprise benchmarks | **Matches GPT-4o** | Below GPT-4o |
| Model ID | `cohere.command-a-03-2025` | `cohere.command-r-plus-08-2024` |

The 256K context is key — we can fit an entire Oracle schema description + all impacted objects + their source code in a single prompt.

## How We Use It

### The Prompt

We send OCI GenAI a structured prompt with all the impact analysis context:

```
You are an Oracle ERP impact analysis expert.

TARGET OBJECT: EMPLOYEES (Type: TABLE)
SEVERITY: CRITICAL
IMPACT SCORE: 82/100
DIRECTLY IMPACTED (6): HR_EMPLOYEE_SUMMARY, PAYROLL_VIEW,
  GET_EMPLOYEE_SALARY, CALC_ANNUAL_BONUS, HR_PACKAGE, HR_EMPLOYEE_SYNC
INDIRECTLY IMPACTED (3): COMPENSATION, MONTHLY_PAYROLL_REPORT,
  ONBOARDING_FLOW

Provide:
1. ROOT CAUSE ANALYSIS
2. FIX RECOMMENDATIONS (5 steps)
3. TESTING CHECKLIST
4. ROLLBACK PLAN
```

### The Response

The AI returns structured text with Oracle-specific recommendations:
- Mentions `DBMS_METADATA.GET_DDL` for backup
- References ORA-04021 and ORA-06508 error codes
- Suggests OIC flow version rollback
- Recommends BIP data model regeneration

### Mock Mode

When OCI credentials aren't available, our mock engine generates the same 4-section output using deterministic rules. The mock output is curated to look realistic and Oracle-specific.

## OCI GenAI Architecture

```
Our Backend (FastAPI)
    │
    │  POST /api/analyze
    │  {object_name: "EMPLOYEES"}
    │
    ▼
Graph Engine → computes impact
    │
    ▼
AI Module (oci_genai.py)
    │
    ├── OCI_GENAI_ENABLED=true?
    │   ├── YES → Call OCI GenAI API
    │   │         Model: cohere.command-a-03-2025
    │   │         Endpoint: inference.generativeai.{region}.oci.oraclecloud.com
    │   │         Timeout: 30 seconds
    │   │         On failure → fall back to mock
    │   │
    │   └── NO → Use mock engine
    │
    ▼
Return structured analysis
```

## Configuration

```bash
OCI_GENAI_ENABLED=true              # Enable live mode
OCI_COMPARTMENT_ID=ocid1.comp...    # Your compartment
OCI_REGION=us-chicago-1             # Region where GenAI is available
OCI_MODEL_ID=cohere.command-a-03-2025  # Model (default)
```
