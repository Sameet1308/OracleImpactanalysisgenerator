# 08 — Oracle SDLC & Where We Fit

## What is SDLC?

SDLC = Software Development Life Cycle. The stages a project goes through:

```
PLAN → DESIGN → BUILD → TEST → DEPLOY → MAINTAIN
```

## Oracle Project SDLC (Typical)

In an Oracle ERP implementation (like Fusion Cloud or E-Business Suite), each stage involves specific Oracle tools:

| Stage | Activities | Tools Used |
|-------|-----------|------------|
| **PLAN** | Requirements gathering, gap analysis | Oracle docs, spreadsheets |
| **DESIGN** | Technical design, object modeling | ERD tools, design docs |
| **BUILD** | Write PL/SQL, configure OIC flows, build BIP reports, write Groovy | SQL Developer, OIC Console, BIP, JDeveloper |
| **TEST** | Unit test, integration test, UAT | Manual testing, some automation |
| **DEPLOY** | Move code to production | FBDI, migration scripts, OIC export/import |
| **MAINTAIN** | Bug fixes, enhancements, changes | This is where WE come in |

## Where Our Tool Fits: The MAINTAIN Phase

When a production Oracle system needs changes (new column, modified procedure, updated integration), developers must:

1. **Identify what will break** ← Our tool does this (impact analysis)
2. **Understand the blast radius** ← Our tool does this (risk scoring)
3. **Plan the fix** ← Our tool does this (AI recommendations)
4. **Test safely** ← Our tool provides the testing checklist
5. **Have a rollback plan** ← Our tool generates this

**Without our tool:** Steps 1-5 take 2-5 days of manual investigation.
**With our tool:** Steps 1-5 take 60 seconds.

## Oracle Fusion Cloud (SaaS) vs. On-Premises

| Aspect | Fusion Cloud (SaaS) | On-Premises (EBS) |
|--------|--------------------|--------------------|
| Hosting | Oracle manages infrastructure | Customer manages servers |
| Updates | Quarterly automatic updates (26A, 26B...) | Customer-controlled upgrades |
| Customization | Groovy scripts, OIC, BIP | PL/SQL, custom forms, reports |
| Our relevance | **HIGH** — Groovy+OIC+BIP are the customization tools | **HIGH** — PL/SQL dependencies are complex |

## Oracle Fusion Docs — Are They Relevant?

**Yes, but not directly.** Here's how:

- **Oracle Fusion documentation** describes how the standard product works (HCM, ERP, SCM modules)
- **Our tool** analyzes the **custom code** that customers write ON TOP of Fusion
- Fusion docs help understand the CONTEXT (what EMPLOYEES table means in HCM), but they don't solve the DEPENDENCY problem

Think of it this way:
- Oracle Fusion = the car (the product)
- Custom PL/SQL/OIC/BIP/Groovy = modifications to the car
- Our tool = tells you "if you change the engine, here's everything else that will break"
- Oracle's docs = the car manual (helpful context, but doesn't tell you about YOUR modifications)

## What Oracle Provides vs. What's Missing

| Oracle Provides | What's Missing (Our Gap) |
|----------------|--------------------------|
| DBA_DEPENDENCIES for PL/SQL objects | Cross-artifact visibility (OIC, BIP, Groovy) |
| OIC Gen3 project-level dependency view | Cross-platform dependency mapping |
| 600+ AI agents in Fusion 26A | Developer tooling for impact analysis |
| Comprehensive product documentation | Automated change risk assessment |
