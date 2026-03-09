"""
Groovy Parser — extracts Oracle object references from HCM Groovy scripts.

Uses regex to detect:
  - SQL queries (executeQuery, executeFunction, executeProcedure)
  - Table/view references in embedded SQL strings
  - Package.function calls
"""

import re
from typing import Dict, List, Tuple

# executeQuery("SELECT ... FROM TABLE_NAME ...")
EXEC_QUERY_PATTERN = re.compile(
    r'(?:executeQuery|executeUpdate)\s*\(\s*["\'](.+?)["\']',
    re.IGNORECASE | re.DOTALL,
)

# executeFunction("FUNC_NAME", [...])
EXEC_FUNC_PATTERN = re.compile(
    r'executeFunction\s*\(\s*["\'](\w+(?:\.\w+)?)["\']',
    re.IGNORECASE,
)

# executeProcedure("PROC_NAME", [...])
EXEC_PROC_PATTERN = re.compile(
    r'executeProcedure\s*\(\s*["\'](\w+(?:\.\w+)?)["\']',
    re.IGNORECASE,
)

# Table/view references in SQL strings: FROM, JOIN, INTO, UPDATE
SQL_TABLE_PATTERN = re.compile(
    r'(?:FROM|JOIN|INTO|UPDATE)\s+(\w+)',
    re.IGNORECASE,
)

SQL_KEYWORDS = {
    "SELECT", "FROM", "WHERE", "AND", "OR", "NOT", "IN", "AS", "ON",
    "JOIN", "LEFT", "RIGHT", "INNER", "OUTER", "GROUP", "ORDER", "BY",
    "SET", "NULL", "VALUES", "DUAL",
}


def parse_groovy(filename: str, content: str) -> Tuple[List[Dict], List[Dict]]:
    """Parse Groovy HCM script. Returns (objects, dependencies)."""
    objects = []
    dependencies = []

    # The Groovy script itself is a logical object
    # Derive a name from the filename
    script_name = re.sub(r'\.\w+$', '', filename).upper().replace(" ", "_")
    script_name = re.sub(r'[^A-Z0-9_]', '', script_name)
    if not script_name:
        script_name = "GROOVY_SCRIPT"

    objects.append({
        "name": script_name,
        "type": "GROOVY_SCRIPT",
        "source_file": filename,
    })

    # --- Extract SQL queries and their table references ---
    for match in EXEC_QUERY_PATTERN.finditer(content):
        sql_text = match.group(1)
        for table_match in SQL_TABLE_PATTERN.finditer(sql_text):
            target = table_match.group(1).upper()
            if target not in SQL_KEYWORDS:
                dependencies.append({
                    "source": script_name,
                    "target": target,
                    "relationship": "QUERIES",
                    "source_file": filename,
                })

    # --- Extract function calls ---
    for match in EXEC_FUNC_PATTERN.finditer(content):
        func_name = match.group(1).upper()
        dependencies.append({
            "source": script_name,
            "target": func_name,
            "relationship": "CALLS",
            "source_file": filename,
        })

    # --- Extract procedure calls ---
    for match in EXEC_PROC_PATTERN.finditer(content):
        proc_name = match.group(1).upper()
        dependencies.append({
            "source": script_name,
            "target": proc_name,
            "relationship": "CALLS",
            "source_file": filename,
        })

    # Deduplicate
    seen = set()
    unique_deps = []
    for dep in dependencies:
        key = (dep["source"], dep["target"], dep["relationship"])
        if key not in seen:
            seen.add(key)
            unique_deps.append(dep)

    return objects, unique_deps
