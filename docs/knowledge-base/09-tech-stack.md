# 09 — Tech Stack Explained

## Backend: Python + FastAPI

### Python
- Language choice: Python is the #1 language for AI/ML and data processing
- Version: 3.9+

### FastAPI
- Modern Python web framework for building APIs
- Automatic API documentation (Swagger UI at `/docs`)
- Async support for high performance
- Type validation with Pydantic

### Key Libraries

| Library | Purpose | Why We Use It |
|---------|---------|---------------|
| `networkx` | Graph data structures and algorithms | Builds the dependency graph, runs BFS traversal |
| `sqlparse` | SQL parsing | Tokenizes PL/SQL for object extraction |
| `xml.etree.ElementTree` | XML parsing | Parses OIC and BIP XML files (built into Python) |
| `reportlab` | PDF generation | Creates downloadable impact reports |
| `oci` | Oracle Cloud SDK | Calls OCI Generative AI API |
| `python-dotenv` | Environment variables | Loads `.env` configuration |
| `uvicorn` | ASGI server | Runs the FastAPI application |

## Frontend: Single-Page HTML + D3.js

### Why Single-File?
- No build step (no webpack, no npm)
- Instant deployment — just serve the HTML file
- Perfect for hackathon demos

### D3.js (Data-Driven Documents)
- JavaScript library for data visualization
- We use it for the **force-directed graph** — nodes repel each other like magnets, edges pull them together
- Nodes are colored by type, turn red on impact
- Interactive: drag, zoom, hover for details

### Fetch API
- Built-in browser API for calling our backend
- No external HTTP library needed (no axios, no jQuery)

## AI: OCI Generative AI

### Model: Cohere Command A
- Model ID: `cohere.command-a-03-2025`
- Context: 256,000 tokens (fits entire schema + all impacted objects)
- Optimized for enterprise agentic tasks

### Two Modes
- **Mock mode** (default): Deterministic rules generate realistic Oracle-specific output
- **Live mode**: Calls OCI GenAI API with full impact context

## Infrastructure

### Local Development
```
Python 3.9+ → pip install -r requirements.txt → uvicorn main:app
```

### OCI Deployment (Optional)
- OCI Compute instance (VM.Standard.E4.Flex)
- systemd service for auto-restart
- Nginx reverse proxy (optional)

## Architecture Diagram

```
┌─────────────────────────────────────────┐
│  Browser (index.html + D3.js)           │
│  ┌──────┐ ┌──────┐ ┌──────┐ ┌───────┐  │
│  │Upload│ │Graph │ │Impact│ │AI Fix │  │
│  │Panel │ │ Tab  │ │ Tab  │ │  Tab  │  │
│  └──┬───┘ └──┬───┘ └──┬───┘ └───┬───┘  │
└─────┼────────┼────────┼─────────┼───────┘
      │  HTTP  │  HTTP  │  HTTP   │  HTTP
      ▼        ▼        ▼         ▼
┌─────────────────────────────────────────┐
│  FastAPI Backend (main.py)              │
│  ┌────────┐ ┌───────┐ ┌─────────────┐  │
│  │Parsers │ │Graph  │ │AI Module    │  │
│  │SQL/XML │ │Engine │ │(OCI GenAI   │  │
│  │Groovy  │ │(NX)   │ │ or Mock)    │  │
│  └────────┘ └───────┘ └─────────────┘  │
└─────────────────────────────────────────┘
```
