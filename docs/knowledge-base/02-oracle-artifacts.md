# 02 — Oracle Artifacts (What We Parse)

An "artifact" is any piece of code or configuration that developers create during an Oracle project. Our tool parses 4 types.

---

## Type 1: PL/SQL (lives inside Oracle Database)

PL/SQL = Procedural Language / SQL. It's Oracle's programming language for database logic.

### TABLE
**What:** Stores data in rows and columns — like an Excel spreadsheet.
**Example:** The `EMPLOYEES` table has columns: EMPLOYEE_ID, FIRST_NAME, LAST_NAME, SALARY, DEPARTMENT_ID.
**Why it matters:** Tables are the foundation. Everything else reads from or writes to tables.

### VIEW
**What:** A saved SQL query that looks like a table. It doesn't store data — it pulls from other tables on the fly.
**Example:** `HR_EMPLOYEE_SUMMARY` joins EMPLOYEES + DEPARTMENTS to show employee names with department names.
**Why it matters:** If the underlying table changes (column renamed, dropped), the view breaks.

### PROCEDURE
**What:** A reusable block of code that DOES something (updates data, sends notifications).
**Example:** `GET_EMPLOYEE_SALARY` takes an employee ID and returns their salary from EMPLOYEES table.
**Why it matters:** Procedures are called by other procedures, functions, OIC flows, and Groovy scripts.

### FUNCTION
**What:** Like a procedure, but it CALCULATES and returns a value.
**Example:** `CALC_ANNUAL_BONUS` calculates an employee's annual bonus by calling GET_EMPLOYEE_SALARY and looking up their job grade.
**Why it matters:** Functions are used in SQL queries, views, and other PL/SQL code.

### PACKAGE
**What:** A container that groups related procedures and functions together. Has two parts: SPEC (the interface) and BODY (the implementation).
**Example:** `HR_PACKAGE` contains PROCESS_HIRE procedure and GET_HEADCOUNT function.
**Why it matters:** Packages are the most reused objects. Many other artifacts call package functions.

### TRIGGER
**What:** Code that runs AUTOMATICALLY when data changes (insert, update, delete).
**Example:** `PAYROLL_TRIGGER` fires after SALARY is updated on EMPLOYEES — logs the change to SALARY_AUDIT_LOG.
**Why it matters:** Triggers are invisible — developers often forget they exist until they cause unexpected behavior.

### SEQUENCE
**What:** Generates unique numbers, typically for primary key IDs.
**Example:** `EMP_ID_SEQ` generates 1001, 1002, 1003... for new employee IDs.
**Why it matters:** Low dependency risk, but still tracked in our graph.

---

## Type 2: OIC Integration Flows (lives in Oracle Integration Cloud)

OIC = Oracle Integration Cloud. It's a drag-and-drop tool for building data pipelines between systems.

### Integration Flow
**What:** An automated pipeline that moves data between Oracle and other systems.
**Example:** `HR_EMPLOYEE_SYNC` runs every night at 2 AM, reads employee data from HCM, and pushes it to an external payroll system.
**Contains:**
- **Connections** — configured adapters (e.g., HCM REST connection, database connection)
- **Steps** — invoke a procedure, run a query, transform data
- **XSLT Mappings** — transform data format between source and target
- **References** — which tables, views, procedures the flow touches

**Why it matters:** OIC flows are the most dangerous blind spot. They call PL/SQL procedures and query views, but this relationship is invisible in DBA_DEPENDENCIES because OIC lives outside the database.

---

## Type 3: BIP Reports (Oracle BI Publisher)

BIP = BI Publisher. It's Oracle's reporting tool for generating PDF, Excel, and HTML reports.

### BIP Report
**What:** A formatted report with a data model (SQL queries) and a template (layout).
**Example:** `MONTHLY_PAYROLL_REPORT` has SQL queries that pull from PAYROLL_VIEW and DEPARTMENTS, formatted as a PDF with department breakdowns.
**Contains:**
- **Data Model** — one or more SQL queries (datasets)
- **Template** — RTF/Excel layout file
- **Schedule** — when the report runs

**Why it matters:** If a view or table that the report queries changes, the report breaks silently — it either shows wrong data or errors out on the next scheduled run.

---

## Type 4: Groovy Scripts (Oracle Fusion HCM)

Groovy is a scripting language used to customize Oracle Fusion HCM (HR module).

### Groovy HCM Script
**What:** Custom business logic for compensation, payroll, and HR calculations.
**Example:** `COMPENSATION` script calls CALC_ANNUAL_BONUS function and HR_PACKAGE.GET_HEADCOUNT to calculate total compensation.
**Contains:**
- `executeQuery("SELECT ... FROM TABLE")` — SQL queries
- `executeFunction("FUNC_NAME")` — calls PL/SQL functions
- `executeProcedure("PROC_NAME")` — calls PL/SQL procedures

**Why it matters:** Groovy scripts reference PL/SQL objects but this dependency is completely invisible to database tools. Only our regex parser catches these.

---

## Summary: What Can See What

| Tool | TABLE | VIEW | PROC | FUNC | PKG | TRIGGER | OIC | BIP | Groovy |
|------|:-----:|:----:|:----:|:----:|:---:|:-------:|:---:|:---:|:------:|
| DBA_DEPENDENCIES | Yes | Yes | Yes | Yes | Yes | Yes | **No** | **No** | **No** |
| OIC Gen3 Projects | No | No | No | No | No | No | Yes | **No** | **No** |
| **Our Tool** | **Yes** | **Yes** | **Yes** | **Yes** | **Yes** | **Yes** | **Yes** | **Yes** | **Yes** |
