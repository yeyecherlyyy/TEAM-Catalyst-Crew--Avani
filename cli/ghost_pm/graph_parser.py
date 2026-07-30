"""Ghost-PM Graph Parser.

Parses graphify's output (graph.json, GRAPH_REPORT.md) into Ghost-PM's
state models. This is the bridge between graphify and state.json.

Usage:
    parser = GraphParser(project_root=Path("."))
    summary = parser.build_summary()
    # summary is a CodeGraphSummary that gets merged into state.json
"""

from __future__ import annotations

import json
import subprocess
import sys
from pathlib import Path
from typing import Any

from rich.console import Console

from ghost_pm.state import (
    CodeGraphSummary,
    FileRecord,
    GodNode,
    GraphCommunity,
    GraphNode,
)

console = Console()

# File extensions to language mapping (for files not tagged by graphify)
EXTENSION_LANGUAGE_MAP: dict[str, str] = {
    ".py": "python",
    ".js": "javascript",
    ".ts": "typescript",
    ".tsx": "typescript",
    ".jsx": "javascript",
    ".go": "go",
    ".rs": "rust",
    ".java": "java",
    ".c": "c",
    ".cpp": "cpp",
    ".h": "c",
    ".hpp": "cpp",
    ".rb": "ruby",
    ".php": "php",
    ".swift": "swift",
    ".kt": "kotlin",
    ".scala": "scala",
    ".cs": "csharp",
    ".vue": "vue",
    ".svelte": "svelte",
    ".html": "html",
    ".css": "css",
    ".scss": "scss",
    ".sql": "sql",
    ".sh": "shell",
    ".bash": "shell",
    ".yaml": "yaml",
    ".yml": "yaml",
    ".json": "json",
    ".toml": "toml",
    ".md": "markdown",
}


def detect_language(file_path: str) -> str:
    """Detect language from file extension."""
    ext = Path(file_path).suffix.lower()
    return EXTENSION_LANGUAGE_MAP.get(ext, "unknown")


class GraphParser:
    """Parses graphify output into Ghost-PM state models."""

    def __init__(self, project_root: Path, ghost_dir: Path | None = None) -> None:
        self.project_root = project_root
        self.ghost_dir = ghost_dir or (project_root / ".ghost")
        self.graphify_dir = project_root / "graphify-out"

    # ──────────────────────────────────────────────────────────
    # Run graphify
    # ──────────────────────────────────────────────────────────

    def run_graphify(self) -> bool:
        """Execute graphify extract on the project root.

        Uses --code-only for AST-only extraction (no API key needed).
        Returns True if successful, False otherwise.
        """
        console.print("[cyan]⚡ Running graphify to build code graph...[/cyan]")
        try:
            result = subprocess.run(
                [
                    "graphify", "extract", str(self.project_root),
                    "--code-only",      # AST only, no LLM API key needed
                    "--no-cluster",     # Skip clustering for speed
                    "--out", str(self.project_root),  # Output to project_root/graphify-out/
                ],
                capture_output=True,
                text=True,
                timeout=120,  # 2 minute timeout
                cwd=str(self.project_root),
            )
            if result.returncode == 0:
                console.print("[green]✓ Code graph built successfully[/green]")
                return True
            else:
                console.print(f"[yellow]⚠ graphify returned code {result.returncode}[/yellow]")
                stderr = result.stderr.strip()
                if stderr:
                    console.print(f"[dim]{stderr[:500]}[/dim]")
                return False
        except FileNotFoundError:
            console.print(
                "[yellow]⚠ graphify not installed. "
                "Install with: pip install graphifyy[/yellow]"
            )
            return False
        except subprocess.TimeoutExpired:
            console.print("[yellow]⚠ graphify timed out (>120s)[/yellow]")
            return False

    # ──────────────────────────────────────────────────────────
    # Parse graph.json
    # ──────────────────────────────────────────────────────────

    def load_graph_json(self) -> dict[str, Any] | None:
        """Load and return the raw graph.json data."""
        graph_path = self.graphify_dir / "graph.json"
        if not graph_path.exists():
            return None
        with open(graph_path, "r") as f:
            return json.load(f)

    def load_graph_report(self) -> str:
        """Load the GRAPH_REPORT.md content."""
        report_path = self.graphify_dir / "GRAPH_REPORT.md"
        if not report_path.exists():
            return ""
        with open(report_path, "r") as f:
            return f.read()

    def _parse_nodes(self, data: dict[str, Any]) -> list[GraphNode]:
        """Extract nodes from graph.json (graphify format)."""
        nodes: list[GraphNode] = []
        raw_nodes = data.get("nodes", [])
        edges = data.get("edges", data.get("links", []))

        # Pre-compute connection count per node from edges
        conn_count: dict[str, int] = {}
        for edge in edges:
            src = edge.get("source", edge.get("from", ""))
            tgt = edge.get("target", edge.get("to", ""))
            conn_count[src] = conn_count.get(src, 0) + 1
            conn_count[tgt] = conn_count.get(tgt, 0) + 1

        for raw in raw_nodes:
            node_id = raw.get("id", "")
            source_file = raw.get("source_file", raw.get("file", raw.get("path", "")))
            node = GraphNode(
                name=raw.get("label", node_id),
                node_type=self._classify_node_type(raw),
                file_path=source_file,
                language=detect_language(source_file),
                status=self._infer_status(raw),
                line_start=raw.get("line_start"),
                line_end=raw.get("line_end"),
                connections=conn_count.get(node_id, 0),
                community=str(raw.get("community", raw.get("group", ""))),
                description=raw.get("description", raw.get("docstring", "")),
            )
            nodes.append(node)

        return nodes

    def _classify_node_type(self, raw: dict[str, Any]) -> str:
        """Classify a raw node into our type system.

        Graphify uses:
          - file_type: 'code' | 'rationale' | 'package'
          - source_location: 'L1' for file-level, 'L<n>' for symbols
          - label ending with '()' for functions/methods
        """
        # Skip non-code nodes (rationale, documentation)
        file_type = raw.get("file_type", "").lower()
        if file_type in ("rationale", "doc", "documentation"):
            return "other"
        if file_type == "package":
            return "module"

        # Check explicit type/kind fields first (non-graphify formats)
        explicit = raw.get("type", raw.get("kind", "")).lower()
        type_map = {
            "file": "file", "function": "function", "func": "function",
            "method": "function", "class": "class", "module": "module",
            "package": "module", "variable": "variable",
        }
        if explicit in type_map:
            return type_map[explicit]

        # Graphify heuristics: source_location == 'L1' means file-level
        source_loc = raw.get("source_location", "")
        label = raw.get("label", "")

        if source_loc == "L1":
            return "file"
        elif "()" in label or source_loc not in ("", "L1"):
            return "function"
        else:
            return "other"

    def _infer_status(self, raw: dict[str, Any]) -> str:
        """Infer implementation status from node metadata."""
        # If graphify provides a status, use it
        if "status" in raw:
            return raw["status"]

        # Heuristic: look at line count, TODO markers, etc.
        line_start = raw.get("line_start", 0)
        line_end = raw.get("line_end", 0)
        body = raw.get("body", "")

        if line_end - line_start <= 2:
            return "stub"
        if any(marker in body.lower() for marker in ["todo", "fixme", "hack", "xxx"]):
            return "in_progress"
        if "error" in raw.get("parse_status", "").lower():
            return "broken"

        return "implemented" if line_end - line_start > 2 else "unknown"

    # ──────────────────────────────────────────────────────────
    # Build summary
    # ──────────────────────────────────────────────────────────

    def build_summary(self, run_graphify: bool = False) -> CodeGraphSummary:
        """Build a CodeGraphSummary from graphify output.

        Args:
            run_graphify: If True, runs graphify before parsing.

        Returns:
            A compact summary suitable for state.json.
        """
        if run_graphify:
            self.run_graphify()

        data = self.load_graph_json()
        if data is None:
            console.print("[dim]No graph.json found. Returning empty summary.[/dim]")
            return CodeGraphSummary()

        nodes = self._parse_nodes(data)
        edges = data.get("edges", data.get("links", []))

        # Count by type
        function_nodes = [n for n in nodes if n.node_type == "function"]
        file_nodes = [n for n in nodes if n.node_type == "file"]

        # Count statuses
        status_counts: dict[str, int] = {
            "stub": 0,
            "in_progress": 0,
            "implemented": 0,
            "tested": 0,
            "broken": 0,
            "unknown": 0,
        }
        for fn in function_nodes:
            status = fn.status if fn.status in status_counts else "unknown"
            status_counts[status] += 1

        # Extract communities
        communities = self._extract_communities(nodes, data)

        # Identify god nodes (>10 connections)
        god_nodes = [
            GodNode(
                name=n.name,
                file_path=n.file_path,
                connections=n.connections,
                risk="high" if n.connections > 20 else "medium" if n.connections > 10 else "low",
            )
            for n in nodes
            if n.connections > 10
        ]
        god_nodes.sort(key=lambda g: g.connections, reverse=True)

        return CodeGraphSummary(
            total_nodes=len(nodes),
            total_edges=len(edges),
            total_functions=len(function_nodes),
            total_files=len(file_nodes),
            communities=communities,
            god_nodes=god_nodes[:10],  # Top 10 only
            function_statuses=status_counts,
        )

    def _extract_communities(
        self, nodes: list[GraphNode], data: dict[str, Any]
    ) -> list[GraphCommunity]:
        """Extract community clusters from graph data."""
        # Try graphify's community detection output
        raw_communities = data.get("communities", [])
        if raw_communities:
            return [
                GraphCommunity(
                    name=c.get("name", f"community_{i}"),
                    files=c.get("files", []),
                    functions=c.get("function_count", len(c.get("members", []))),
                    description=c.get("description", ""),
                )
                for i, c in enumerate(raw_communities)
            ]

        # Fallback: group nodes by their community field
        community_map: dict[str, list[GraphNode]] = {}
        for node in nodes:
            if node.community:
                community_map.setdefault(node.community, []).append(node)

        return [
            GraphCommunity(
                name=name,
                files=list({n.file_path for n in members if n.file_path}),
                functions=sum(1 for n in members if n.node_type == "function"),
            )
            for name, members in community_map.items()
        ]

    # ──────────────────────────────────────────────────────────
    # Build file records
    # ──────────────────────────────────────────────────────────

    def build_file_records(self) -> list[FileRecord]:
        """Build file-level records from graphify output."""
        data = self.load_graph_json()
        if data is None:
            return []

        nodes = self._parse_nodes(data)

        # Group functions by file
        file_functions: dict[str, list[GraphNode]] = {}
        for node in nodes:
            if node.node_type == "function" and node.file_path:
                file_functions.setdefault(node.file_path, []).append(node)

        records: list[FileRecord] = []
        for file_path, functions in file_functions.items():
            implemented = sum(
                1 for f in functions if f.status in ("implemented", "tested")
            )
            records.append(
                FileRecord(
                    path=file_path,
                    language=detect_language(file_path),
                    functions_count=len(functions),
                    implemented_count=implemented,
                    status="stable" if implemented == len(functions) else "in_progress",
                )
            )

        return records

    # ──────────────────────────────────────────────────────────
    # Copy graph.json to .ghost/ for LLM access
    # ──────────────────────────────────────────────────────────

    def sync_to_ghost_dir(self) -> None:
        """Copy graph outputs to .ghost/ directory."""
        self.ghost_dir.mkdir(parents=True, exist_ok=True)

        # Copy graph.json
        src = self.graphify_dir / "graph.json"
        if src.exists():
            dst = self.ghost_dir / "graph.json"
            dst.write_text(src.read_text())

        # Copy GRAPH_REPORT.md
        src = self.graphify_dir / "GRAPH_REPORT.md"
        if src.exists():
            dst = self.ghost_dir / "graph_report.md"
            dst.write_text(src.read_text())
