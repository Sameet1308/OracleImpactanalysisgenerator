"""
SQL/PL/SQL Parser — extracts Oracle objects and dependencies from .sql files.

Handles: CREATE TABLE, VIEW, PROCEDURE, FUNCTION, PACKAGE, PACKAGE BODY,
         TRIGGER, SEQUENCE, SYNONYM, plus dependency detection via references.
"""

import re
from typing import Dict, List, Tuple

# Patterns for CREATE statements
CREATE_PATTERN = re.compile(
    r"CREATE\s+(?:OR\s+REPLACE\s+)?"
    r"(TABLE|VIEW|PROCEDURE|FUNCTION|PACKAGE\s+BODY|PACKAGE|TRIGGER|SEQUENCE|SYNONYM)"
    r"\s+(\w+)",
    re.IGNORECASE,
)

# Patterns for dependency detection inside PL/SQL bodies
# References to tables/views in FROM, JOIN, INTO, UPDATE, INSERT INTO
TABLE_REF_PATTERN = re.compile(
    r"(?:FROM|JOIN|INTO|UPDATE|REFERENCES)\s+(\w+)",
    re.IGNORECASE,
)

# Function/procedure calls
CALL_PATTERN = re.compile(
    r"(?::=\s*|CALL\s+)(\w+(?:\.\w+)?)\s*\(",
    re.IGNORECASE,
)

# REFERENCES in FK constraints
FK_PATTERN = re.compile(
    r"REFERENCES\s+(\w+)\s*\(",
    re.IGNORECASE,
)

# Sequence usage: SEQ.NEXTVAL / SEQ.CURRVAL
SEQ_PATTERN = re.compile(
    r"(\w+)\.(NEXTVAL|CURRVAL)",
    re.IGNORECASE,
)

# BEFORE/AFTER trigger ON table
TRIGGER_ON_PATTERN = re.compile(
    r"(?:BEFORE|AFTER)\s+\w+\s+ON\s+(\w+)",
    re.IGNORECASE,
)


def parse_sql(filename: str, content: str) -> Tuple[List[Dict], List[Dict]]:
    """Parse SQL/PL/SQL file. Returns (objects, dependencies)."""
    objects = []
    dependencies = []
    known_objects = set()

    # --- Extract all CREATE statements as objects ---
    for match in CREATE_PATTERN.finditer(content):
        obj_type = match.group(1).upper().strip()
        # Normalize "PACKAGE BODY" vs "PACKAGE"
        if "BODY" in obj_type:
            obj_type = "PACKAGE BODY"
        obj_name = match.group(2).upper()
        objects.append({
            "name": obj_name,
            "type": obj_type,
            "source_file": filename,
        })
        known_objects.add(obj_name)

    # --- Split into blocks per CREATE statement for dependency analysis ---
    blocks = re.split(r"(?=CREATE\s)", content, flags=re.IGNORECASE)

    for block in blocks:
        # Identify which object this block defines
        create_match = CREATE_PATTERN.search(block)
        if not create_match:
            continue
        source_type = create_match.group(1).upper().strip()
        source_name = create_match.group(2).upper()

        # Get the body after the CREATE line
        body = block[create_match.end():]

        # Table/view references (FROM, JOIN, INTO, UPDATE)
        for ref in TABLE_REF_PATTERN.finditer(body):
            target = ref.group(1).upper()
            if target != source_name and target not in ("DUAL", "SYS", "DBMS_OUTPUT"):
                dependencies.append({
                    "source": source_name,
                    "target": target,
                    "relationship": "REFERENCES",
                    "source_file": filename,
                })

        # Function/procedure calls (including PKG.FUNC notation)
        for ref in CALL_PATTERN.finditer(body):
            target = ref.group(1).upper()
            if target != source_name:
                dependencies.append({
                    "source": source_name,
                    "target": target,
                    "relationship": "CALLS",
                    "source_file": filename,
                })

        # FK constraints
        for ref in FK_PATTERN.finditer(body):
            target = ref.group(1).upper()
            if target != source_name:
                dependencies.append({
                    "source": source_name,
                    "target": target,
                    "relationship": "FK_REFERENCES",
                    "source_file": filename,
                })

        # Sequence usage
        for ref in SEQ_PATTERN.finditer(body):
            seq_name = ref.group(1).upper()
            dependencies.append({
                "source": source_name,
                "target": seq_name,
                "relationship": "USES_SEQUENCE",
                "source_file": filename,
            })

        # Trigger ON table
        if "TRIGGER" in source_type:
            for ref in TRIGGER_ON_PATTERN.finditer(block):
                target = ref.group(1).upper()
                dependencies.append({
                    "source": source_name,
                    "target": target,
                    "relationship": "TRIGGER_ON",
                    "source_file": filename,
                })

    # Deduplicate dependencies
    seen = set()
    unique_deps = []
    for dep in dependencies:
        key = (dep["source"], dep["target"], dep["relationship"])
        if key not in seen:
            seen.add(key)
            unique_deps.append(dep)

    return objects, unique_deps
