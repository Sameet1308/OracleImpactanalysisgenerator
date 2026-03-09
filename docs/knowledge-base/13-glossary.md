# 13 — Glossary

Quick reference for every term used in this project.

---

## A

**Artifact** — Any file or configuration a developer creates in an Oracle project (SQL script, OIC flow, BIP report, Groovy script).

## B

**BFS (Breadth-First Search)** — Graph traversal algorithm that explores all neighbors at the current depth before going deeper. We use it to find all objects impacted by a change.

**BIP (BI Publisher)** — Oracle's reporting tool. Generates PDF, Excel, HTML reports from SQL queries.

**Blast Radius** — The total set of objects impacted when a specific object changes. Bigger blast radius = more dangerous change.

## C

**Cohere Command A** — The AI model we use (`cohere.command-a-03-2025`). 256K context, enterprise-optimized, runs on OCI GenAI.

**CORS (Cross-Origin Resource Sharing)** — Browser security mechanism. Our backend allows all origins so the frontend can call the API.

## D

**D3.js** — JavaScript library for data visualization. We use it for the interactive force-directed dependency graph.

**DBA_DEPENDENCIES** — Oracle Database dictionary view that tracks dependencies between PL/SQL objects. Cannot see OIC, BIP, or Groovy artifacts.

**Dependency Graph** — A directed graph where nodes are Oracle objects and edges represent "depends on" relationships.

**DiGraph** — Directed Graph. A graph where edges have direction (A → B ≠ B → A). NetworkX's `DiGraph` class.

**Direct Impact** — An object that directly references the changed object (1 hop in the graph).

## E

**EBS (E-Business Suite)** — Oracle's older on-premises ERP system. Being replaced by Fusion Cloud.

**ERP (Enterprise Resource Planning)** — Software that manages business operations: finance, HR, supply chain, procurement.

## F

**FastAPI** — Python web framework we use for the backend. Auto-generates API docs.

**Force-Directed Graph** — A visualization where nodes repel each other and edges act as springs, creating a natural-looking layout.

**Fusion Cloud** — Oracle's modern cloud ERP/HCM/SCM suite (SaaS). Current release cycle: 26A, 26B, etc.

## G

**Groovy** — Scripting language used in Oracle Fusion HCM for custom business logic (compensation rules, validation scripts).

## H

**HCM (Human Capital Management)** — Oracle's HR module in Fusion Cloud. Manages employees, payroll, benefits, compensation.

## I

**Impact Analysis** — The process of determining what breaks when a specific object changes.

**Indirect Impact** — An object that doesn't directly reference the changed object but depends on something that does (2+ hops). Also called "transitive dependency."

## M

**Mock Mode** — Our default mode that generates AI-style output without calling OCI GenAI. Deterministic, works offline.

## N

**NetworkX** — Python library for graph data structures and algorithms. We use it to build and traverse the dependency graph.

**Node** — A vertex in the graph. Each Oracle object (table, view, procedure, etc.) is a node.

## O

**OCI (Oracle Cloud Infrastructure)** — Oracle's cloud platform (like AWS or Azure, but Oracle's).

**OCI GenAI** — Oracle's managed generative AI service. Runs models inside the Oracle tenancy — data doesn't leave your cloud.

**OIC (Oracle Integration Cloud)** — Drag-and-drop tool for building data pipelines between Oracle and external systems.

**OIC Gen3** — Latest generation of Oracle Integration Cloud. Introduced "Projects" for organizing integrations.

## P

**PL/SQL (Procedural Language/SQL)** — Oracle's programming language for database logic. Used to write procedures, functions, packages, triggers.

## R

**Risk Score** — A number from 0-100 indicating how dangerous a change is. Calculated from direct impacts, indirect impacts, and object type criticality.

## S

**SDLC (Software Development Life Cycle)** — The stages of building software: Plan → Design → Build → Test → Deploy → Maintain.

**Severity** — Risk category: LOW (0-24), MEDIUM (25-49), HIGH (50-74), CRITICAL (75-100).

## T

**Transitive Dependency** — A depends on B, B depends on C, so A transitively depends on C. The hardest type of dependency to find manually.

## U

**USP (Unique Selling Proposition)** — What makes our tool unique: the only tool that maps dependencies across ALL Oracle artifact types with AI-powered recommendations.

**Uvicorn** — ASGI server that runs our FastAPI backend.
