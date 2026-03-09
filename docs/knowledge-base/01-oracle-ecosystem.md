# 01 — Oracle Ecosystem

## What is Oracle?

Oracle is a company that sells software to run large businesses. Banks, telecom companies, governments, and enterprises all use Oracle to manage their operations — finance, HR, payroll, supply chain, sales.

## The Two Worlds

### World 1: Oracle Applications (the software people use)

| Product | Full Name | What It Does | Example |
|---------|-----------|-------------|---------|
| **Fusion ERP** | Enterprise Resource Planning | Finance, accounting, procurement | Process invoices, close monthly books |
| **HCM** | Human Capital Management | HR, payroll, compensation | Calculate salaries, run payroll cycles |
| **SCM** | Supply Chain Management | Inventory, manufacturing, logistics | Track orders from factory to customer |
| **CX** | Customer Experience | Sales, marketing, service | Manage customer relationships |

These are the apps that business users interact with daily.

### World 2: OCI (the cloud platform everything runs on)

**OCI = Oracle Cloud Infrastructure**

Every cloud provider has one:
- Amazon → **AWS**
- Microsoft → **Azure**
- Google → **GCP**
- Oracle → **OCI**

OCI provides the servers, storage, networking, databases, and AI services. When a company "runs Oracle Fusion ERP," it runs ON OCI.

## How They Connect

```
Business User (HR Manager)
        │
        ▼
Oracle Fusion HCM (the app)
        │
        ▼
OCI (the cloud platform)
├── OCI Compute (servers running the app)
├── Oracle Database (where data lives)
├── OCI Generative AI (AI capabilities)
└── OCI Object Storage (file storage)
```

## What is an Oracle Implementation Project?

When a large company (say, a bank with 50,000 employees) decides to use Oracle Fusion for their HR and payroll, they hire a consulting firm (like LTIMindtree) to set it up. This is called an "implementation project."

During this project, developers:
1. Configure Oracle Fusion modules
2. Write custom PL/SQL code (database logic)
3. Build OIC integration flows (to connect Oracle to other systems)
4. Create BIP reports (for management reporting)
5. Write Groovy scripts (for custom business rules)

These are the "artifacts" our tool analyzes.

## Why This Matters for Our Project

Our tool helps developers during Oracle implementation projects. When they modify any artifact, our tool shows what else will break. This is critical because these projects involve 20-50 developers building hundreds of interconnected artifacts.
