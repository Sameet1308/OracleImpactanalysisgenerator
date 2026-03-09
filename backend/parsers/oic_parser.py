"""
OIC + BIP XML Parser — extracts Oracle objects and dependencies from:
  - OIC integration flow XMLs (connections, orchestration steps, referenced objects)
  - BIP report XMLs (data model queries, referenced tables/views/functions)
"""

import re
import xml.etree.ElementTree as ET
from typing import Dict, List, Tuple

# SQL references inside embedded queries
SQL_REF_PATTERN = re.compile(
    r"(?:FROM|JOIN|INTO|UPDATE)\s+(\w+)",
    re.IGNORECASE,
)

# Function calls in SQL: FUNC_NAME(...)
FUNC_CALL_PATTERN = re.compile(
    r"(\w+(?:\.\w+)?)\s*\(",
    re.IGNORECASE,
)

# Known SQL keywords/functions to exclude from dependency detection
SQL_KEYWORDS = {
    "SELECT", "FROM", "WHERE", "AND", "OR", "NOT", "IN", "AS", "ON",
    "JOIN", "LEFT", "RIGHT", "INNER", "OUTER", "GROUP", "ORDER", "BY",
    "HAVING", "UNION", "INSERT", "UPDATE", "DELETE", "INTO", "VALUES",
    "SET", "NULL", "IS", "BETWEEN", "LIKE", "EXISTS", "CASE", "WHEN",
    "THEN", "ELSE", "END", "COUNT", "SUM", "AVG", "MIN", "MAX",
    "DISTINCT", "ALL", "ANY", "ADD_MONTHS", "SYSDATE", "NVL", "DECODE",
    "TO_CHAR", "TO_DATE", "TO_NUMBER", "TRIM", "UPPER", "LOWER",
    "CALL", "MERGE",
}


def parse_xml(filename: str, content: str) -> Tuple[List[Dict], List[Dict]]:
    """Parse OIC or BIP XML file. Auto-detects type from root element."""
    try:
        root = ET.fromstring(content)
    except ET.ParseError as e:
        raise ValueError(f"Invalid XML in {filename}: {e}")

    tag = root.tag.lower()
    if tag == "integration":
        return _parse_oic(filename, root)
    elif tag == "report":
        return _parse_bip(filename, root)
    else:
        # Try both parsers, return whichever finds objects
        objects, deps = _parse_oic(filename, root)
        if not objects:
            objects, deps = _parse_bip(filename, root)
        return objects, deps


def _parse_oic(filename: str, root: ET.Element) -> Tuple[List[Dict], List[Dict]]:
    """Parse Oracle Integration Cloud flow XML."""
    objects = []
    dependencies = []

    flow_name = root.get("name", "UNKNOWN_FLOW")
    objects.append({
        "name": flow_name,
        "type": "OIC_FLOW",
        "source_file": filename,
    })

    # Extract connections as objects
    for conn in root.iter("connection"):
        conn_name = conn.get("name")
        if conn_name:
            objects.append({
                "name": conn_name,
                "type": "OIC_CONNECTION",
                "source_file": filename,
            })
            dependencies.append({
                "source": flow_name,
                "target": conn_name,
                "relationship": "USES_CONNECTION",
                "source_file": filename,
            })

    # Extract steps and their references
    for step in root.iter("step"):
        step_name = step.get("name", "")

        # Procedure/function calls
        proc_el = step.find("procedure")
        if proc_el is not None and proc_el.text:
            proc_name = proc_el.text.strip().upper()
            dependencies.append({
                "source": flow_name,
                "target": proc_name,
                "relationship": "CALLS",
                "source_file": filename,
            })

        # Target table references
        target_el = step.find("target_table")
        if target_el is not None and target_el.text:
            table_name = target_el.text.strip().upper()
            dependencies.append({
                "source": flow_name,
                "target": table_name,
                "relationship": "WRITES_TO",
                "source_file": filename,
            })

        # Embedded SQL queries
        query_el = step.find("query")
        if query_el is not None and query_el.text:
            _extract_sql_refs(flow_name, query_el.text, filename, dependencies)

        # Explicit <references> blocks
        refs_el = step.find("references")
        if refs_el is not None:
            for obj_el in refs_el.findall("object"):
                obj_name = (obj_el.text or "").strip().upper()
                obj_type = (obj_el.get("type") or "UNKNOWN").upper()
                if obj_name:
                    dependencies.append({
                        "source": flow_name,
                        "target": obj_name,
                        "relationship": f"REFERENCES_{obj_type}",
                        "source_file": filename,
                    })

    # Deduplicate
    return objects, _dedupe(dependencies)


def _parse_bip(filename: str, root: ET.Element) -> Tuple[List[Dict], List[Dict]]:
    """Parse BI Publisher report XML."""
    objects = []
    dependencies = []

    report_name = root.get("name", "UNKNOWN_REPORT")
    objects.append({
        "name": report_name,
        "type": "BIP_REPORT",
        "source_file": filename,
    })

    # Parse data model datasets
    for dataset in root.iter("dataset"):
        ds_name = dataset.get("name", "")

        # SQL queries
        sql_el = dataset.find("sql")
        if sql_el is not None and sql_el.text:
            _extract_sql_refs(report_name, sql_el.text, filename, dependencies)
            # Also detect function calls in SQL
            _extract_func_calls(report_name, sql_el.text, filename, dependencies)

        # Explicit references
        refs_el = dataset.find("references")
        if refs_el is not None:
            for obj_el in refs_el.findall("object"):
                obj_name = (obj_el.text or "").strip().upper()
                obj_type = (obj_el.get("type") or "UNKNOWN").upper()
                if obj_name:
                    dependencies.append({
                        "source": report_name,
                        "target": obj_name,
                        "relationship": f"REFERENCES_{obj_type}",
                        "source_file": filename,
                    })

    return objects, _dedupe(dependencies)


def _extract_sql_refs(source: str, sql: str, filename: str, deps: List[Dict]):
    """Extract table/view references from embedded SQL."""
    for match in SQL_REF_PATTERN.finditer(sql):
        target = match.group(1).upper()
        if target not in SQL_KEYWORDS:
            deps.append({
                "source": source,
                "target": target,
                "relationship": "QUERIES",
                "source_file": filename,
            })


def _extract_func_calls(source: str, sql: str, filename: str, deps: List[Dict]):
    """Extract function/package calls from SQL (e.g., GET_ANNUAL_SALARY(...))."""
    for match in FUNC_CALL_PATTERN.finditer(sql):
        target = match.group(1).upper()
        if target not in SQL_KEYWORDS and not target.startswith("("):
            deps.append({
                "source": source,
                "target": target,
                "relationship": "CALLS",
                "source_file": filename,
            })


def _dedupe(deps: List[Dict]) -> List[Dict]:
    """Remove duplicate dependencies."""
    seen = set()
    result = []
    for dep in deps:
        key = (dep["source"], dep["target"], dep["relationship"])
        if key not in seen:
            seen.add(key)
            result.append(dep)
    return result
