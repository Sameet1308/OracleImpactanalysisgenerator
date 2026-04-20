"""
SQL/PL/SQL Parser — extracts Oracle objects and dependencies from .sql files.

Handles: CREATE TABLE, VIEW, PROCEDURE, FUNCTION, PACKAGE, PACKAGE BODY,
         TRIGGER, SEQUENCE, SYNONYM, plus dependency detection via references.

Column-level support:
  - Extracts column names + types from CREATE TABLE bodies
  - Finds column references in CREATE VIEW AS SELECT ... projection lists
  - Heuristically finds TABLE.COLUMN references in procedure/function bodies
  - Populates dependency edges with 'columns' list when identifiable
"""

import re
from typing import Dict, List, Set, Tuple

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

# REFERENCES in FK constraints (handles multi-line with tabs/spaces)
FK_PATTERN = re.compile(
    r"REFERENCES\s+(\w+)",
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


def _extract_table_columns(content: str, table_name: str) -> List[Dict[str, str]]:
    """Extract columns from a CREATE TABLE body.

    Returns list of {name, type} dicts. Handles typical Oracle column definitions
    while skipping constraint and FK lines inside the parenthesised body.
    """
    pattern = re.compile(
        rf"CREATE\s+TABLE\s+{re.escape(table_name)}\s*\((.+?)\)\s*(?:TABLESPACE|;|/|$)",
        re.IGNORECASE | re.DOTALL,
    )
    m = pattern.search(content)
    if not m:
        return []
    body = m.group(1)
    columns: List[Dict[str, str]] = []
    # Split the body on commas that are not inside parens (handles VARCHAR2(100))
    depth = 0
    current = ""
    parts = []
    for ch in body:
        if ch == "(":
            depth += 1
        elif ch == ")":
            depth -= 1
        if ch == "," and depth == 0:
            parts.append(current.strip())
            current = ""
        else:
            current += ch
    if current.strip():
        parts.append(current.strip())

    skip_keywords = ("CONSTRAINT", "PRIMARY", "FOREIGN", "UNIQUE", "CHECK", "INDEX")
    col_def = re.compile(r"^(\w+)\s+([A-Z0-9_]+(?:\s*\([^)]+\))?)", re.IGNORECASE)
    for part in parts:
        upper = part.upper().lstrip()
        if any(upper.startswith(k) for k in skip_keywords):
            continue
        cm = col_def.match(part)
        if cm:
            columns.append({"name": cm.group(1).upper(), "type": cm.group(2).upper()})
    return columns


def _extract_view_columns(body: str) -> List[str]:
    """Extract column names referenced in a CREATE VIEW AS SELECT projection list.

    Handles SELECT col1, t.col2, col3 AS alias, col4.
    Returns a list of uppercase column names (aliases stripped).
    """
    sel = re.search(r"\bSELECT\b(.+?)\bFROM\b", body, re.IGNORECASE | re.DOTALL)
    if not sel:
        return []
    projection = sel.group(1)
    cols: List[str] = []
    depth = 0
    current = ""
    for ch in projection:
        if ch == "(":
            depth += 1
        elif ch == ")":
            depth -= 1
        if ch == "," and depth == 0:
            cols.append(current.strip())
            current = ""
        else:
            current += ch
    if current.strip():
        cols.append(current.strip())

    result: List[str] = []
    for c in cols:
        c = c.strip()
        if not c or c == "*":
            continue
        # Strip alias: "col AS something" or "col something"
        c = re.split(r"\s+AS\s+|\s+", c, maxsplit=1, flags=re.IGNORECASE)[0]
        # Strip table prefix: t.col → col
        if "." in c:
            c = c.split(".")[-1]
        # Skip function calls / expressions
        if "(" in c or not re.match(r"^\w+$", c):
            continue
        result.append(c.upper())
    return result


# Pattern to find qualified column references: TABLE.COLUMN or ALIAS.COLUMN
QUALIFIED_COL_PATTERN = re.compile(r"\b(\w+)\.(\w+)\b")


def parse_sql(filename: str, content: str) -> Tuple[List[Dict], List[Dict]]:
    """Parse SQL/PL/SQL file. Returns (objects, dependencies).

    Objects carry a 'columns' list where identifiable.
    Dependency edges carry a 'columns' list when specific columns are referenced.
    """
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
        obj_entry = {
            "name": obj_name,
            "type": obj_type,
            "source_file": filename,
        }
        # For TABLE objects, extract columns
        if obj_type == "TABLE":
            obj_entry["columns"] = _extract_table_columns(content, obj_name)
        objects.append(obj_entry)
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

        # Collect view projection columns (populated once per VIEW block)
        view_cols: List[str] = []
        if source_type == "VIEW":
            view_cols = _extract_view_columns(body)

        # Collect qualified column refs (TABLE.COL) keyed by target table
        qualified_cols: Dict[str, Set[str]] = {}
        for qm in QUALIFIED_COL_PATTERN.finditer(body):
            t = qm.group(1).upper()
            c = qm.group(2).upper()
            # Skip known pseudo-columns and packages
            if c in ("NEXTVAL", "CURRVAL", "ROWID", "ROWNUM"):
                continue
            qualified_cols.setdefault(t, set()).add(c)

        # Table/view references (FROM, JOIN, INTO, UPDATE)
        for ref in TABLE_REF_PATTERN.finditer(body):
            target = ref.group(1).upper()
            if target != source_name and target not in ("DUAL", "SYS", "DBMS_OUTPUT"):
                dep_entry = {
                    "source": source_name,
                    "target": target,
                    "relationship": "REFERENCES",
                    "source_file": filename,
                }
                # Attach column list
                cols_used: Set[str] = set()
                if target in qualified_cols:
                    cols_used |= qualified_cols[target]
                # For a VIEW, also attribute unqualified projection columns to the FROM target
                if source_type == "VIEW" and view_cols:
                    for vc in view_cols:
                        cols_used.add(vc)
                if cols_used:
                    dep_entry["columns"] = sorted(cols_used)
                dependencies.append(dep_entry)

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

    # --- Parse ALTER TABLE ... ADD CONSTRAINT ... REFERENCES (common in Oracle official schemas) ---
    alter_pattern = re.compile(
        r"ALTER\s+TABLE\s+(\w+)\s+.*?REFERENCES\s+(\w+)",
        re.IGNORECASE | re.DOTALL,
    )
    for match in alter_pattern.finditer(content):
        source = match.group(1).upper()
        target = match.group(2).upper()
        if source != target:
            dependencies.append({
                "source": source,
                "target": target,
                "relationship": "FK_REFERENCES",
                "source_file": filename,
            })

    # --- Global FK scan with context: find every FOREIGN KEY ... REFERENCES and determine source table ---
    # Normalize whitespace to handle Oracle's multi-line tab-indented FK constraints
    normalized = re.sub(r"\s+", " ", content)

    # Strategy: find all CREATE TABLE positions, then for each FK, assign to nearest preceding CREATE TABLE
    table_positions = [(m.start(), m.group(1).upper()) for m in re.finditer(r"CREATE\s+TABLE\s+(\w+)", normalized, re.IGNORECASE)]

    for fk in re.finditer(r"FOREIGN\s+KEY\s*\([^)]+\)\s*REFERENCES\s+(\w+)", normalized, re.IGNORECASE):
        target = fk.group(1).upper()
        # Find which CREATE TABLE this FK belongs to (nearest preceding one)
        source_name = None
        for pos, name in reversed(table_positions):
            if pos < fk.start():
                source_name = name
                break
        if source_name and target != source_name:
            dependencies.append({
                "source": source_name,
                "target": target,
                "relationship": "FK_REFERENCES",
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
