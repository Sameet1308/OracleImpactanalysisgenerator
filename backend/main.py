"""
Impact Analysis Generator — FastAPI Backend
Oracle Pythia-26 Hackathon | Team: Pranali, Suraj, Sameet

6 REST endpoints for Oracle ERP cross-artifact dependency analysis.
"""

from dotenv import load_dotenv
load_dotenv()

from pathlib import Path
from typing import List

from fastapi import FastAPI, File, UploadFile, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

from parsers import parse_file, parse_files
from graph.engine import DependencyGraph
from ai.oci_genai import generate_analysis, get_ai_mode
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

    sample_files = {}
    for f in SAMPLE_DIR.iterdir():
        if f.suffix in (".sql", ".xml", ".groovy"):
            sample_files[f.name] = f.read_text(encoding="utf-8")

    if not sample_files:
        raise HTTPException(status_code=500, detail="No sample artifacts found")

    all_objects, all_deps = parse_files(sample_files)
    graph.add_objects(all_objects)
    graph.add_dependencies(all_deps)

    return {
        "files_processed": len(sample_files),
        "objects_found": len(all_objects),
        "dependencies_found": len(all_deps),
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

    ai_result = await generate_analysis(impact)

    return {
        "object_name": impact["object_name"],
        "risk_score": impact["risk_score"],
        "severity": impact["severity"],
        "direct_impact": impact["direct_impact"],
        "indirect_impact": impact["indirect_impact"],
        "all_impacted": impact["all_impacted"],
        "ai_analysis": {
            "root_cause": ai_result.get("root_cause", ""),
            "recommendations": ai_result.get("recommendations", []),
            "testing_checklist": ai_result.get("testing_checklist", []),
            "rollback_plan": ai_result.get("rollback_plan", []),
        },
        "ai_mode": ai_result.get("mode", "mock"),
    }


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
