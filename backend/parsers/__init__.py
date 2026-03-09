"""
Parser Registry — dispatches files to the correct parser based on extension.
Supported: .sql (PL/SQL), .xml (OIC flows + BIP reports), .groovy (HCM scripts)
"""

from pathlib import Path
from typing import Dict, List, Tuple

from .sql_parser import parse_sql
from .oic_parser import parse_xml
from .groovy_parser import parse_groovy

# Maps file extension to parser function
PARSER_MAP = {
    ".sql": parse_sql,
    ".xml": parse_xml,
    ".groovy": parse_groovy,
}


def parse_file(filename: str, content: str) -> Tuple[List[Dict], List[Dict]]:
    """
    Parse a single file and return (objects, dependencies).

    Each object: {"name": str, "type": str, "source_file": str}
    Each dependency: {"source": str, "target": str, "relationship": str, "source_file": str}
    """
    ext = Path(filename).suffix.lower()
    parser = PARSER_MAP.get(ext)
    if parser is None:
        raise ValueError(f"Unsupported file type: {ext} (supported: {', '.join(PARSER_MAP.keys())})")
    return parser(filename, content)


def parse_files(files: Dict[str, str]) -> Tuple[List[Dict], List[Dict]]:
    """
    Parse multiple files. files = {filename: content}.
    Returns aggregated (all_objects, all_dependencies).
    """
    all_objects = []
    all_deps = []
    for filename, content in files.items():
        objects, deps = parse_file(filename, content)
        all_objects.extend(objects)
        all_deps.extend(deps)
    return all_objects, all_deps
