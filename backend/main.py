"""
Impact Analysis Generator — FastAPI Backend
Oracle Pythia-26 Hackathon | Team: Sameet, Rahul, Suraj, Arpan

6 REST endpoints for Oracle ERP cross-artifact dependency analysis.
"""

from dotenv import load_dotenv
load_dotenv()

from pathlib import Path
from typing import List, Optional

from fastapi import FastAPI, File, UploadFile, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

from parsers import parse_file, parse_files
from graph.engine import DependencyGraph
from ai.oci_genai import generate_analysis, get_ai_mode
from ai.blueverse import update_token, get_token_status
from knowledge.rag import KnowledgeBase
from pdf_report import generate_pdf_report

app = FastAPI(
    title="Impact Analysis Generator",
    description="Oracle ERP cross-artifact dependency analysis with OCI Generative AI",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Global dependency graph — in-memory, no persistence needed
graph = DependencyGraph()
# RAG knowledge base — in-memory, embeds source code for richer AI context
knowledge_base = KnowledgeBase()

SAMPLE_DIR = Path(__file__).parent / "sample_artifacts"


class AnalyzeRequest(BaseModel):
    object_name: str


@app.get("/")
async def health_check():
    """Health check — shows AI mode and graph stats."""
    return {
        "status": "ok",
        "ai_mode": get_ai_mode(),
        "objects_loaded": graph.graph.number_of_nodes(),
        "token_status": get_token_status(),
        "knowledge_base": knowledge_base.get_status(),
        "version": "1.0.0",
    }


@app.post("/api/upload")
async def upload_artifacts(files: List[UploadFile] = File(...)):
    """Upload Oracle artifact files for parsing. Supported: .sql, .xml, .groovy"""
    all_objects = []
    all_deps = []
    errors = []

    for f in files:
        try:
            content = (await f.read()).decode("utf-8")
            objects, deps = parse_file(f.filename, content)
            all_objects.extend(objects)
            all_deps.extend(deps)
            # Ingest into RAG knowledge base
            knowledge_base.ingest(f.filename, content, objects)
        except Exception as e:
            errors.append({"file": f.filename, "error": str(e)})

    graph.add_objects(all_objects)
    graph.add_dependencies(all_deps)

    result = {
        "files_processed": len(files),
        "objects_found": len(all_objects),
        "dependencies_found": len(all_deps),
    }
    if errors:
        result["errors"] = errors
    return result


@app.post("/api/demo")
async def load_demo():
    """Load built-in sample artifacts. Resets graph first for clean demo state."""
    graph.clear()
    knowledge_base.clear()

    sample_files = {}
    for f in SAMPLE_DIR.iterdir():
        if f.suffix in (".sql", ".xml", ".groovy"):
            sample_files[f.name] = f.read_text(encoding="utf-8")

    if not sample_files:
        raise HTTPException(status_code=500, detail="No sample artifacts found")

    all_objects, all_deps = parse_files(sample_files)
    graph.add_objects(all_objects)
    graph.add_dependencies(all_deps)

    # Ingest all sample files into RAG knowledge base
    for fname, fcontent in sample_files.items():
        file_objects = [o for o in all_objects if o.get("source_file") == fname]
        knowledge_base.ingest(fname, fcontent, file_objects)

    return {
        "files_processed": len(sample_files),
        "objects_found": len(all_objects),
        "dependencies_found": len(all_deps),
        "knowledge_base": knowledge_base.get_status(),
    }


@app.post("/api/analyze")
async def analyze_impact(request: AnalyzeRequest):
    """Compute impact analysis for a selected Oracle object with AI recommendations."""
    if graph.graph.number_of_nodes() == 0:
        raise HTTPException(
            status_code=400,
            detail="No artifacts loaded. Upload files or load demo first.",
        )

    object_name = request.object_name.upper().strip()
    impact = graph.compute_impact(object_name)

    if not impact.get("found"):
        available = [n for n in graph.graph.nodes]
        raise HTTPException(
            status_code=404,
            detail=f"Object '{object_name}' not found. Available: {available}",
        )

    # Retrieve relevant source code chunks from RAG knowledge base
    code_context = knowledge_base.retrieve(
        object_name,
        impact.get("all_impacted", []),
    )

    ai_result = await generate_analysis(impact, code_context=code_context)

    return {
        "object_name": impact["object_name"],
        "risk_score": impact["risk_score"],
        "severity": impact["severity"],
        "direct_impact": impact["direct_impact"],
        "indirect_impact": impact["indirect_impact"],
        "all_impacted": impact["all_impacted"],
        "code_context_used": len(code_context),
        "ai_analysis": {
            "root_cause": ai_result.get("root_cause", ""),
            "recommendations": ai_result.get("recommendations", []),
            "testing_checklist": ai_result.get("testing_checklist", []),
            "rollback_plan": ai_result.get("rollback_plan", []),
        },
        "ai_mode": ai_result.get("mode", "mock"),
    }


class AnalyzeColumnRequest(BaseModel):
    object_name: str
    column_name: str


@app.post("/api/analyze-column")
async def analyze_column_impact(request: AnalyzeColumnRequest):
    """Column-level impact: which downstream objects reference this specific column."""
    if graph.graph.number_of_nodes() == 0:
        raise HTTPException(
            status_code=400,
            detail="No artifacts loaded. Upload files or load demo first.",
        )

    obj_name = request.object_name.upper().strip()
    col_name = request.column_name.upper().strip()
    result = graph.compute_column_impact(obj_name, col_name)
    if not result.get("found"):
        raise HTTPException(status_code=404, detail=result.get("error"))
    return result


@app.get("/api/columns/{object_name}")
async def list_columns(object_name: str):
    """List all columns of a table/view (if parsed)."""
    obj_name = object_name.upper().strip()
    cols = graph.get_columns(obj_name)
    if not cols:
        if not graph.has_object(obj_name):
            raise HTTPException(status_code=404, detail=f"Object '{obj_name}' not found")
        return {"object_name": obj_name, "columns": [], "note": "No column metadata — object is not a TABLE or columns were not parseable"}
    return {"object_name": obj_name, "columns": cols, "count": len(cols)}


@app.get("/api/report/{object_name}")
async def download_report(object_name: str):
    """Generate and download a PDF impact analysis report for the given object."""
    if graph.graph.number_of_nodes() == 0:
        raise HTTPException(
            status_code=400,
            detail="No artifacts loaded. Upload files or load demo first.",
        )

    object_name = object_name.upper().strip()
    impact = graph.compute_impact(object_name)

    if not impact.get("found"):
        available = [n for n in graph.graph.nodes]
        raise HTTPException(
            status_code=404,
            detail=f"Object '{object_name}' not found. Available: {available}",
        )

    ai_result = await generate_analysis(impact)

    impact_data = {
        "object_name": impact["object_name"],
        "object_type": impact.get("object_type", "OBJECT"),
        "risk_score": impact["risk_score"],
        "severity": impact["severity"],
        "direct_impact": impact["direct_impact"],
        "indirect_impact": impact["indirect_impact"],
        "all_impacted": impact["all_impacted"],
    }
    ai_analysis = {
        "root_cause": ai_result.get("root_cause", ""),
        "recommendations": ai_result.get("recommendations", []),
        "testing_checklist": ai_result.get("testing_checklist", []),
        "rollback_plan": ai_result.get("rollback_plan", []),
    }

    pdf_bytes = generate_pdf_report(impact_data, ai_analysis)
    filename = f"impact_report_{object_name}.pdf"

    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={
            "Content-Disposition": f'attachment; filename="{filename}"',
        },
    )


class TokenRequest(BaseModel):
    token: str


@app.post("/api/token")
async def refresh_token(request: TokenRequest):
    """Update the BlueVerse JWT token at runtime without restarting the server."""
    result = update_token(request.token)
    return result


@app.get("/api/token/status")
async def token_status():
    """Check current BlueVerse token status (valid/expiring/expired)."""
    return get_token_status()


# ═══ TOKEN USAGE & QUALITY METRICS ═══

@app.get("/api/usage")
async def usage_stats():
    """Return AI token usage metrics, cost tracking, and hallucination flags."""
    from ai.blueverse import get_usage_stats
    return get_usage_stats()


# ═══ CHAT ENDPOINT ═══

class ChatMessage(BaseModel):
    role: str
    content: str

class ChatRequest(BaseModel):
    message: str
    object_name: Optional[str] = None
    history: List[ChatMessage] = []

@app.post("/api/chat")
async def chat(request: ChatRequest):
    """Chat with Pythia AI — context-aware follow-up questions about impact analysis."""
    from ai.blueverse import call_blueverse

    # Build context
    context_parts = []
    context_parts.append("You are Oracle Pythia-26, an Oracle ERP impact analysis assistant built by LTIMindtree. "
                         "You help users understand cross-artifact dependencies, blast radius, and provide "
                         "Oracle-specific recommendations with ORA error codes. Be concise and specific.")

    # Add impact context if object selected
    if request.object_name and graph.has_object(request.object_name):
        impact = graph.compute_impact(request.object_name)
        context_parts.append(f"\n## Current Analysis Context\n"
                             f"Object: {request.object_name}\n"
                             f"Risk Score: {impact.get('risk_score', 'N/A')} ({impact.get('severity', 'N/A')})\n"
                             f"Direct Impact: {', '.join(o['name'] for o in impact.get('direct_impact', []))}\n"
                             f"Indirect Impact: {', '.join(o['name'] for o in impact.get('indirect_impact', []))}")

    # Add RAG code context
    if request.object_name:
        impacted = graph.compute_impact(request.object_name).get('all_impacted', []) if graph.has_object(request.object_name) else []
        code_chunks = knowledge_base.retrieve(request.object_name, impacted, top_k=3)
        if code_chunks:
            context_parts.append("\n## Relevant Source Code")
            for chunk in code_chunks[:3]:
                snippet = chunk.get("text", "")[:400]
                context_parts.append(f"[{chunk.get('object_name', '?')} ({chunk.get('object_type', '?')})]:\n{snippet}")

    # Add conversation history (last 6 turns, capped)
    history_text = ""
    recent_history = request.history[-6:] if len(request.history) > 6 else request.history
    for msg in recent_history:
        prefix = "User" if msg.role == "user" else "Assistant"
        history_text += f"\n{prefix}: {msg.content[:500]}"

    if history_text:
        context_parts.append(f"\n## Conversation History{history_text}")

    context_parts.append(f"\nUser: {request.message}\nAssistant:")

    full_prompt = "\n".join(context_parts)

    # Call BlueVerse
    response_text = await call_blueverse(full_prompt)

    if response_text:
        return {"response": response_text, "mode": "blueverse"}

    # Mock fallback
    obj_name = request.object_name or "the selected object"
    mock_response = (f"Based on the impact analysis of {obj_name}, I can help you understand the dependencies. "
                     f"The object has cross-artifact dependencies that may affect downstream views, procedures, "
                     f"and integrations. Please provide more specific questions about the root cause, "
                     f"testing requirements, or rollback procedures, and I'll give you detailed guidance.")
    return {"response": mock_response, "mode": "mock"}


@app.get("/api/knowledge/status")
async def knowledge_status():
    """Return RAG knowledge base stats — chunks, files, objects indexed."""
    return knowledge_base.get_status()


@app.get("/api/objects")
async def list_objects():
    """List all parsed Oracle objects currently in the graph."""
    return {"objects": graph.get_objects()}


@app.get("/api/graph")
async def get_graph():
    """Get the full dependency graph as JSON for D3.js visualization."""
    return graph.get_graph_json()


# Serve frontend if directory exists
FRONTEND_DIR = Path(__file__).parent.parent / "frontend"
if FRONTEND_DIR.exists():
    app.mount("/ui", StaticFiles(directory=str(FRONTEND_DIR), html=True), name="frontend")


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
