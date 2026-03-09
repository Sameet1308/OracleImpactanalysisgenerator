"""
OCI Generative AI Client — generates root cause analysis and fix recommendations.

Two modes:
  - Mock (default): deterministic structured output for demo without credentials
  - Live: calls OCI Generative AI (Cohere Command R+) via oci SDK

Toggle via OCI_GENAI_ENABLED environment variable.
"""

import os
from typing import Any, Dict

# --- Configuration ---
OCI_GENAI_ENABLED = os.getenv("OCI_GENAI_ENABLED", "false").lower() == "true"
OCI_COMPARTMENT_ID = os.getenv("OCI_COMPARTMENT_ID", "")
OCI_REGION = os.getenv("OCI_REGION", "us-chicago-1")
OCI_MODEL_ID = os.getenv("OCI_MODEL_ID", "cohere.command-r-plus")
OCI_ENDPOINT = f"https://inference.generativeai.{OCI_REGION}.oci.oraclecloud.com"
OCI_TIMEOUT = 30  # seconds


def get_ai_mode() -> str:
    """Return current AI mode string."""
    return "live" if OCI_GENAI_ENABLED else "mock"


async def generate_analysis(impact_result: Dict[str, Any]) -> Dict[str, Any]:
    """
    Generate AI-powered root cause analysis and fix recommendations.
    Routes to mock or live OCI GenAI based on configuration.
    """
    if OCI_GENAI_ENABLED:
        return await _call_oci_genai(impact_result)
    else:
        return _mock_analysis(impact_result)


async def _call_oci_genai(impact_result: Dict[str, Any]) -> Dict[str, Any]:
    """Call OCI Generative AI (Cohere Command R+) for analysis."""
    try:
        import oci

        config = oci.config.from_file()
        client = oci.generative_ai_inference.GenerativeAiInferenceClient(
            config=config,
            service_endpoint=OCI_ENDPOINT,
            timeout=(OCI_TIMEOUT, OCI_TIMEOUT),
        )

        target = impact_result["object_name"]
        obj_type = impact_result.get("object_type", "UNKNOWN")
        severity = impact_result["severity"]
        score = impact_result["risk_score"]
        direct = impact_result.get("direct_impact", [])
        indirect = impact_result.get("indirect_impact", [])

        direct_names = ", ".join(d["name"] for d in direct) or "None"
        indirect_names = ", ".join(d["name"] for d in indirect) or "None"

        prompt = f"""You are an Oracle ERP impact analysis expert. A developer is about to modify an Oracle artifact. Analyze the dependency impact and provide actionable guidance.

TARGET OBJECT: {target} (Type: {obj_type})
SEVERITY: {severity}
IMPACT SCORE: {score}/100
DIRECTLY IMPACTED OBJECTS ({len(direct)}): {direct_names}
INDIRECTLY IMPACTED OBJECTS ({len(indirect)}): {indirect_names}

Provide your analysis in exactly these 4 sections:

## ROOT CAUSE ANALYSIS
Explain in 3-4 sentences why modifying {target} causes cascading failures across the Oracle ERP system.

## FIX RECOMMENDATIONS
Provide exactly 5 numbered steps to safely modify {target} without breaking dependent objects.

## TESTING CHECKLIST
Provide 4-5 bullet points of specific tests to run after the change.

## ROLLBACK PLAN
Provide 5 numbered steps to revert the change if something breaks in production."""

        chat_detail = oci.generative_ai_inference.models.ChatDetails(
            compartment_id=OCI_COMPARTMENT_ID,
            serving_mode=oci.generative_ai_inference.models.OnDemandServingMode(
                model_id=OCI_MODEL_ID,
            ),
            chat_request=oci.generative_ai_inference.models.CohereChatRequest(
                message=prompt,
                max_tokens=2000,
                temperature=0.3,
            ),
        )

        response = client.chat(chat_detail)
        ai_text = response.data.chat_response.text

        return {
            "mode": "live",
            "model": OCI_MODEL_ID,
            **_parse_ai_response(ai_text),
            "raw_response": ai_text,
        }

    except ImportError:
        result = _mock_analysis(impact_result)
        result["error"] = "oci package not installed — fell back to mock mode"
        return result
    except Exception as e:
        result = _mock_analysis(impact_result)
        result["error"] = f"OCI GenAI call failed: {str(e)} — fell back to mock mode"
        return result


def _parse_ai_response(text: str) -> Dict[str, Any]:
    """Parse structured sections from AI response text."""
    result = {
        "root_cause": "",
        "recommendations": [],
        "testing_checklist": [],
        "rollback_plan": [],
    }

    current = None
    buffer = []

    for line in text.strip().split("\n"):
        upper = line.strip().upper()
        if "ROOT CAUSE" in upper:
            if current:
                _flush(result, current, buffer)
            current = "root_cause"
            buffer = []
        elif "FIX" in upper and "RECOMMEND" in upper:
            if current:
                _flush(result, current, buffer)
            current = "recommendations"
            buffer = []
        elif "TESTING" in upper and "CHECKLIST" in upper:
            if current:
                _flush(result, current, buffer)
            current = "testing_checklist"
            buffer = []
        elif "ROLLBACK" in upper:
            if current:
                _flush(result, current, buffer)
            current = "rollback_plan"
            buffer = []
        else:
            buffer.append(line)

    if current:
        _flush(result, current, buffer)

    return result


def _flush(result: Dict, key: str, lines: list):
    """Flush buffer into result dict."""
    if key == "root_cause":
        result[key] = "\n".join(l for l in lines if l.strip()).strip()
    else:
        items = []
        for l in lines:
            stripped = l.strip().lstrip("0123456789.-•) ")
            if stripped:
                items.append(stripped)
        result[key] = items


def _mock_analysis(impact_result: Dict[str, Any]) -> Dict[str, Any]:
    """Generate deterministic mock analysis for demo mode."""
    target = impact_result["object_name"]
    obj_type = impact_result.get("object_type", "UNKNOWN")
    severity = impact_result["severity"]
    score = impact_result["risk_score"]
    direct = impact_result.get("direct_impact", [])
    indirect = impact_result.get("indirect_impact", [])
    all_names = [d["name"] for d in direct] + [d["name"] for d in indirect]

    return {
        "mode": "mock",
        "model": "rule-based-engine-v1",
        "root_cause": (
            f"{target} is a foundational {obj_type} in the Oracle ERP schema, serving as the "
            f"primary data source for {len(direct)} directly dependent objects and {len(indirect)} "
            f"transitively dependent objects across multiple artifact types. "
            f"Modifying {target} causes cascading failures because downstream views "
            f"({', '.join(d['name'] for d in direct if d.get('type') == 'VIEW') or 'dependent views'}) "
            f"compile against its column definitions, stored procedures reference its fields in DML "
            f"statements, and external integrations (OIC flows, BIP reports, Groovy scripts) "
            f"are tightly coupled to its schema. "
            f"The cross-artifact nature of these dependencies means standard Oracle "
            f"DBA_DEPENDENCIES views miss the OIC, BIP, and Groovy references entirely, "
            f"making manual impact assessment incomplete and unreliable."
        ),
        "recommendations": [
            f"Create a pre-change baseline: export {target} DDL using DBMS_METADATA.GET_DDL and "
            f"snapshot all {len(all_names)} dependent object definitions for comparison.",
            f"Apply the {target} modification in a staging/sandbox environment first — never modify "
            f"a {severity}-severity object directly in production.",
            f"Recompile all directly dependent PL/SQL objects ({', '.join(d['name'] for d in direct[:4])}) "
            f"using ALTER ... COMPILE and check for ORA-04021 or ORA-06508 errors.",
            f"Update OIC integration flows that reference {target}: pause scheduled orchestrations, "
            f"modify connection mappings, run a test payload, then re-enable.",
            f"Regenerate BIP report data models and verify SQL queries still execute correctly "
            f"against the modified {target} schema — re-publish report templates.",
        ],
        "testing_checklist": [
            f"Recompile all PL/SQL objects referencing {target} — verify zero ORA-04021/ORA-06508 errors.",
            f"Execute SELECT * on all dependent views — verify no ORA-00942 (table not found) or ORA-00904 (invalid identifier).",
            f"Run OIC integration flows in test mode with sample payload — verify data mapping integrity.",
            f"Generate BIP reports in all output formats (PDF, XLSX, HTML) — verify data accuracy matches pre-change baseline.",
            f"Execute Groovy HCM scripts in sandbox environment — verify compensation calculations produce expected results.",
        ],
        "rollback_plan": [
            f"Restore {target} from the pre-change DDL export using DBMS_METADATA.",
            f"Recompile all {len(all_names)} dependent PL/SQL objects in dependency order.",
            f"Roll back OIC flow versions to the pre-change snapshot (OIC supports version history).",
            f"Re-publish BIP report templates from backup stored in Oracle Object Storage.",
            f"Validate end-to-end by running the full testing checklist against the restored state.",
        ],
    }
