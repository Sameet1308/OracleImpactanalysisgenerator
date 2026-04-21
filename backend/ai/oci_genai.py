"""
AI Analysis Generator — generates root cause analysis and fix recommendations.

Two modes (checked in order):
  1. BlueVerse (primary): calls published AI_Elite_Ora1 agent on BlueVerse Marketplace
  2. Mock (fallback): deterministic structured output — guarantees demo resilience
     when BlueVerse is unreachable or the JWT has expired.

Per LTM data-governance policy, all LLM generation routes through
BlueVerse-approved models only. Third-party LLM providers are explicitly not used.
"""

import logging
import os
from typing import Any, Dict

from ai.blueverse import call_blueverse

logger = logging.getLogger(__name__)

# --- Configuration ---
BLUEVERSE_ENABLED = os.getenv("BLUEVERSE_ENABLED", "true").lower() == "true"


def get_ai_mode() -> str:
    """Return current AI mode string."""
    return "blueverse" if BLUEVERSE_ENABLED else "mock"


async def generate_analysis(impact_result: Dict[str, Any], code_context: list = None) -> Dict[str, Any]:
    """
    Generate AI-powered root cause analysis and fix recommendations.
    Priority: BlueVerse agent → Mock fallback (LTM BlueVerse-only policy).

    Args:
        impact_result: Impact analysis data from graph engine
        code_context: Optional list of RAG-retrieved source code chunks
    """
    # 1. Try BlueVerse agent first
    if BLUEVERSE_ENABLED:
        result = await _call_blueverse(impact_result, code_context)
        if result is not None:
            return result
        logger.info("BlueVerse unreachable — falling back to deterministic mock mode")

    # 2. Mock fallback — guarantees demo never fails
    return _mock_analysis(impact_result)


import re as _re

def _strip_pii(text: str) -> str:
    """Remove credentials, connection strings, and tokens from code context before sending to AI."""
    # Remove password patterns
    text = _re.sub(r'(?i)(password|passwd|pwd)\s*[:=]\s*["\']?[^\s"\']+', r'\1=***REDACTED***', text)
    # Remove connection strings
    text = _re.sub(r'(?i)(jdbc:|Data Source=|Server=|Host=)[^\s;]+', r'\1***REDACTED***', text)
    # Remove tokens/keys
    text = _re.sub(r'(?i)(token|api_key|secret|bearer)\s*[:=]\s*["\']?[A-Za-z0-9_\-\.]{20,}', r'\1=***REDACTED***', text)
    # Remove email addresses
    text = _re.sub(r'[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}', '***EMAIL***', text)
    return text


def _build_prompt(impact_result: Dict[str, Any], code_context: list = None) -> str:
    """Build the structured analysis prompt from impact data and optional source code.
    Includes PII filtering on code context to prevent credential leakage to AI."""
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
INDIRECTLY IMPACTED OBJECTS ({len(indirect)}): {indirect_names}"""

    # Append RAG-retrieved source code context if available
    if code_context:
        prompt += "\n\n## RELEVANT SOURCE CODE\n"
        prompt += "The following code snippets are from the actual Oracle artifacts involved. "
        prompt += "Use them to provide SPECIFIC recommendations referencing actual column names, procedure parameters, and SQL logic.\n\n"
        for i, chunk in enumerate(code_context[:5], 1):
            obj_name = chunk.get("object_name", "UNKNOWN")
            src_file = chunk.get("source_file", "")
            text = _strip_pii(chunk.get("text", "")[:500])  # Cap at 500 chars + PII filter
            prompt += f"### Snippet {i}: {obj_name} ({src_file})\n```\n{text}\n```\n\n"

    prompt += f"""
Provide your analysis in exactly these 4 sections:

## ROOT CAUSE ANALYSIS
Explain in 3-4 sentences why modifying {target} causes cascading failures across the Oracle ERP system.

## FIX RECOMMENDATIONS
Provide exactly 5 numbered steps to safely modify {target} without breaking dependent objects.

## TESTING CHECKLIST
Provide 4-5 bullet points of specific tests to run after the change.

## ROLLBACK PLAN
Provide 5 numbered steps to revert the change if something breaks in production."""

    return prompt


async def _call_blueverse(impact_result: Dict[str, Any], code_context: list = None) -> Dict[str, Any] | None:
    """Call BlueVerse AI_Elite_Ora1 agent for analysis. Returns None on failure."""
    try:
        prompt = _build_prompt(impact_result, code_context)
        response_text = await call_blueverse(prompt)

        if response_text is None:
            return None

        parsed = _parse_ai_response(response_text)

        # If parsing got nothing useful, still return the raw text as root_cause
        if not parsed["root_cause"] and not parsed["recommendations"]:
            parsed["root_cause"] = response_text

        return {
            "mode": "blueverse",
            "model": "AI_Elite_Ora1 (BlueVerse)",
            **parsed,
            "raw_response": response_text,
        }
    except Exception as e:
        logger.warning("BlueVerse analysis failed: %s", str(e))
        return None


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
        "note": "Generated by deterministic mock engine — BlueVerse unreachable. Restart with a fresh JWT for live AI analysis.",
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
