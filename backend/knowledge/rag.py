"""
RAG Knowledge Base — Chunks, embeds, and retrieves Oracle artifact source code.

Uses ChromaDB (ephemeral/in-memory) + sentence-transformers for local embeddings.
Gracefully degrades if dependencies are not installed — mock mode still works.
"""

import re
import logging
from typing import Dict, List, Optional

logger = logging.getLogger(__name__)

# Graceful import — RAG is optional
try:
    import chromadb
    from chromadb.utils import embedding_functions
    RAG_AVAILABLE = True
except ImportError:
    RAG_AVAILABLE = False
    logger.info("chromadb not installed — RAG knowledge base disabled")


class KnowledgeBase:
    """In-memory RAG knowledge base for Oracle artifact source code."""

    def __init__(self):
        self._client = None
        self._collection = None
        self._ef = None
        self._stats = {"chunks": 0, "files": 0, "objects": set()}
        self._initialized = False

    def _ensure_initialized(self):
        """Lazy-load ChromaDB and embedding model on first use."""
        if self._initialized or not RAG_AVAILABLE:
            return
        try:
            self._ef = embedding_functions.SentenceTransformerEmbeddingFunction(
                model_name="all-MiniLM-L6-v2"
            )
            self._client = chromadb.Client()  # ephemeral, in-memory
            self._collection = self._client.get_or_create_collection(
                name="oracle_artifacts",
                embedding_function=self._ef,
            )
            self._initialized = True
            logger.info("RAG knowledge base initialized (all-MiniLM-L6-v2)")
        except Exception as e:
            logger.error(f"Failed to initialize RAG: {e}")
            self._initialized = False

    # ──────────────────────────────────────────────
    # Ingestion
    # ──────────────────────────────────────────────

    def ingest(self, filename: str, content: str, objects: List[Dict]) -> Dict:
        """Chunk and embed a file's source code into the knowledge base.

        Args:
            filename: Original filename (routes to correct chunker)
            content: Raw file content
            objects: Parsed objects from this file [{name, type, source_file}, ...]

        Returns:
            {"chunks_added": int, "objects_indexed": [str]}
        """
        if not RAG_AVAILABLE:
            return {"chunks_added": 0, "error": "chromadb not installed"}

        self._ensure_initialized()
        if not self._initialized:
            return {"chunks_added": 0, "error": "initialization failed"}

        ext = filename.rsplit(".", 1)[-1].lower() if "." in filename else ""
        if ext == "sql":
            chunks = self._chunk_sql(filename, content, objects)
        elif ext == "xml":
            chunks = self._chunk_xml(filename, content, objects)
        elif ext == "groovy":
            chunks = self._chunk_groovy(filename, content, objects)
        else:
            chunks = self._chunk_generic(filename, content, objects)

        if not chunks:
            return {"chunks_added": 0, "objects_indexed": []}

        # Upsert into ChromaDB (handles duplicates via deterministic IDs)
        ids = [c["id"] for c in chunks]
        documents = [c["text"] for c in chunks]
        metadatas = [
            {
                "source_file": c["source_file"],
                "object_name": c["object_name"],
                "object_type": c.get("object_type", "UNKNOWN"),
                "chunk_type": c.get("chunk_type", "source"),
            }
            for c in chunks
        ]

        try:
            self._collection.upsert(ids=ids, documents=documents, metadatas=metadatas)
        except Exception as e:
            logger.error(f"ChromaDB upsert failed: {e}")
            return {"chunks_added": 0, "error": str(e)}

        # Update stats
        self._stats["chunks"] += len(chunks)
        self._stats["files"] += 1
        indexed_objects = list({c["object_name"] for c in chunks})
        self._stats["objects"].update(indexed_objects)

        logger.info(f"Ingested {filename}: {len(chunks)} chunks, objects: {indexed_objects}")
        return {"chunks_added": len(chunks), "objects_indexed": indexed_objects}

    def _chunk_sql(self, filename: str, content: str, objects: List[Dict]) -> List[Dict]:
        """Split SQL by CREATE statement blocks."""
        chunks = []
        # Split on CREATE boundaries (same pattern as sql_parser.py)
        blocks = re.split(r"(?=CREATE\s)", content, flags=re.IGNORECASE)

        create_pattern = re.compile(
            r"CREATE\s+(?:OR\s+REPLACE\s+)?"
            r"(TABLE|VIEW|PROCEDURE|FUNCTION|PACKAGE\s+BODY|PACKAGE|TRIGGER|SEQUENCE|SYNONYM)"
            r"\s+(?:\w+\.)?(\w+)",
            re.IGNORECASE,
        )

        for i, block in enumerate(blocks):
            block = block.strip()
            if not block:
                continue

            match = create_pattern.search(block)
            if match:
                obj_type = match.group(1).upper()
                obj_name = match.group(2).upper()
            else:
                # Non-CREATE block (comments, grants, etc.)
                obj_name = "PREAMBLE"
                obj_type = "COMMENT"

            chunks.append({
                "id": f"{filename}:{obj_name}:{i}",
                "text": block[:2000],  # Cap at 2000 chars
                "source_file": filename,
                "object_name": obj_name,
                "object_type": obj_type,
                "chunk_type": "create_block",
            })

        return chunks

    def _chunk_xml(self, filename: str, content: str, objects: List[Dict]) -> List[Dict]:
        """Extract meaningful sections from OIC/BIP XML."""
        import xml.etree.ElementTree as ET

        chunks = []
        # Determine primary object name from parsed objects
        primary = objects[0]["name"] if objects else filename.rsplit(".", 1)[0].upper()
        primary_type = objects[0].get("type", "XML") if objects else "XML"

        # Full file as context chunk
        chunks.append({
            "id": f"{filename}:{primary}:full",
            "text": content[:2000],
            "source_file": filename,
            "object_name": primary,
            "object_type": primary_type,
            "chunk_type": "full_file",
        })

        # Try to extract individual elements
        try:
            root = ET.fromstring(content)

            # OIC steps
            for i, step in enumerate(root.iter("step")):
                step_text = ET.tostring(step, encoding="unicode", method="xml")
                step_name = step.findtext("name", f"step_{i}")
                chunks.append({
                    "id": f"{filename}:{primary}:step_{i}",
                    "text": step_text[:1500],
                    "source_file": filename,
                    "object_name": primary,
                    "object_type": primary_type,
                    "chunk_type": "xml_step",
                })

            # BIP datasets
            for i, ds in enumerate(root.iter("dataset")):
                ds_text = ET.tostring(ds, encoding="unicode", method="xml")
                chunks.append({
                    "id": f"{filename}:{primary}:dataset_{i}",
                    "text": ds_text[:1500],
                    "source_file": filename,
                    "object_name": primary,
                    "object_type": primary_type,
                    "chunk_type": "xml_dataset",
                })

            # Connection elements
            for i, conn in enumerate(root.iter("connection")):
                conn_text = ET.tostring(conn, encoding="unicode", method="xml")
                conn_name = conn.findtext("name", f"conn_{i}")
                chunks.append({
                    "id": f"{filename}:{conn_name.upper()}:conn_{i}",
                    "text": conn_text[:1000],
                    "source_file": filename,
                    "object_name": conn_name.upper(),
                    "object_type": "OIC_CONNECTION",
                    "chunk_type": "xml_connection",
                })

        except ET.ParseError:
            logger.warning(f"XML parse failed for {filename}, using full-file chunk only")

        return chunks

    def _chunk_groovy(self, filename: str, content: str, objects: List[Dict]) -> List[Dict]:
        """Groovy files are typically short — use entire file as one chunk."""
        obj_name = objects[0]["name"] if objects else filename.rsplit(".", 1)[0].upper()
        obj_type = objects[0].get("type", "GROOVY_SCRIPT") if objects else "GROOVY_SCRIPT"

        chunks = [{
            "id": f"{filename}:{obj_name}:0",
            "text": content[:2000],
            "source_file": filename,
            "object_name": obj_name,
            "object_type": obj_type,
            "chunk_type": "full_file",
        }]

        # If long, also split by function/def blocks
        if len(content.splitlines()) > 60:
            blocks = re.split(r"\n(?=def\s|\bclass\s)", content)
            for i, block in enumerate(blocks):
                if block.strip():
                    chunks.append({
                        "id": f"{filename}:{obj_name}:block_{i}",
                        "text": block[:1500],
                        "source_file": filename,
                        "object_name": obj_name,
                        "object_type": obj_type,
                        "chunk_type": "function_block",
                    })

        return chunks

    def _chunk_generic(self, filename: str, content: str, objects: List[Dict]) -> List[Dict]:
        """Fallback: treat entire file as one chunk."""
        obj_name = objects[0]["name"] if objects else filename.upper()
        return [{
            "id": f"{filename}:{obj_name}:0",
            "text": content[:2000],
            "source_file": filename,
            "object_name": obj_name,
            "object_type": "UNKNOWN",
            "chunk_type": "full_file",
        }]

    # ──────────────────────────────────────────────
    # Retrieval
    # ──────────────────────────────────────────────

    def retrieve(self, object_name: str, impacted_objects: List[str], top_k: int = 5) -> List[Dict]:
        """Retrieve relevant code chunks for an object and its blast radius.

        Strategy:
        1. Metadata filter: chunks that define the target object
        2. Semantic search: chunks related to impacted objects
        3. Merge, deduplicate, return top_k
        """
        if not RAG_AVAILABLE or not self._initialized or not self._collection:
            return []

        results = []
        seen_ids = set()

        try:
            # 1. Exact match: chunks belonging to the target object
            exact = self._collection.get(
                where={"object_name": object_name.upper()},
                include=["documents", "metadatas"],
            )
            if exact and exact["documents"]:
                for i, doc in enumerate(exact["documents"]):
                    chunk_id = exact["ids"][i] if exact["ids"] else f"exact_{i}"
                    if chunk_id not in seen_ids:
                        seen_ids.add(chunk_id)
                        results.append({
                            "text": doc,
                            "source_file": exact["metadatas"][i].get("source_file", ""),
                            "object_name": exact["metadatas"][i].get("object_name", ""),
                            "object_type": exact["metadatas"][i].get("object_type", ""),
                            "score": 1.0,  # exact match = highest relevance
                        })

            # 2. Semantic search: query with impacted object names
            if impacted_objects:
                query_text = f"{object_name} " + " ".join(impacted_objects[:10])
                semantic = self._collection.query(
                    query_texts=[query_text],
                    n_results=min(top_k + 3, 10),  # fetch extra for dedup
                    include=["documents", "metadatas", "distances"],
                )
                if semantic and semantic["documents"] and semantic["documents"][0]:
                    for i, doc in enumerate(semantic["documents"][0]):
                        chunk_id = semantic["ids"][0][i] if semantic["ids"] else f"sem_{i}"
                        if chunk_id not in seen_ids:
                            seen_ids.add(chunk_id)
                            distance = semantic["distances"][0][i] if semantic["distances"] else 1.0
                            results.append({
                                "text": doc,
                                "source_file": semantic["metadatas"][0][i].get("source_file", ""),
                                "object_name": semantic["metadatas"][0][i].get("object_name", ""),
                                "object_type": semantic["metadatas"][0][i].get("object_type", ""),
                                "score": max(0, 1.0 - distance),  # convert distance to similarity
                            })

        except Exception as e:
            logger.error(f"RAG retrieval failed: {e}")
            return []

        # Sort by relevance score, return top_k
        results.sort(key=lambda x: x["score"], reverse=True)
        return results[:top_k]

    # ──────────────────────────────────────────────
    # Management
    # ──────────────────────────────────────────────

    def clear(self):
        """Reset the knowledge base (called when loading fresh demo data)."""
        if not RAG_AVAILABLE or not self._initialized:
            return
        try:
            self._client.delete_collection("oracle_artifacts")
            self._collection = self._client.get_or_create_collection(
                name="oracle_artifacts",
                embedding_function=self._ef,
            )
            self._stats = {"chunks": 0, "files": 0, "objects": set()}
            logger.info("Knowledge base cleared")
        except Exception as e:
            logger.error(f"Failed to clear KB: {e}")

    def get_status(self) -> Dict:
        """Return knowledge base stats for frontend display."""
        if not RAG_AVAILABLE:
            return {"enabled": False, "reason": "chromadb not installed"}
        if not self._initialized:
            return {"enabled": False, "reason": "not initialized"}

        try:
            count = self._collection.count() if self._collection else 0
        except Exception:
            count = self._stats["chunks"]

        return {
            "enabled": True,
            "chunks": count,
            "files": self._stats["files"],
            "objects": len(self._stats["objects"]),
            "object_list": sorted(self._stats["objects"]),
            "model": "all-MiniLM-L6-v2",
        }
