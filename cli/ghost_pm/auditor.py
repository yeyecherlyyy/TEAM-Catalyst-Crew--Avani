"""Ghost-PM Codebase Auditor.

Ponytail-inspired code quality analysis:
- Detects god nodes, dead code, over-engineering
- Reviews recent commits for scope creep
- Provides actionable simplification suggestions
"""

from __future__ import annotations

import os
import subprocess
from pathlib import Path

from rich.console import Console
from rich.panel import Panel
from rich.table import Table

from ghost_pm.config import GhostConfig
from ghost_pm.state import ProjectState

console = Console()


def audit_codebase(state: ProjectState, config: GhostConfig) -> dict:
    """Full codebase audit inspired by Ponytail's laziness ladder.

    Returns a dict with findings:
    {
        "god_nodes": [...],
        "orphan_nodes": [...],
        "large_files": [...],
        "deep_nesting": [...],
        "score": 0-100,
        "verdict": "...",
    }
    """
    findings = {
        "god_nodes": [],
        "orphan_nodes": [],
        "large_files": [],
        "dependency_bloat": [],
        "score": 100,
        "verdict": "clean",
    }

    graph = state.code_graph

    # 1. God Nodes (>10 connections)
    if graph.god_nodes:
        for gn in graph.god_nodes:
            findings["god_nodes"].append({
                "name": gn.name,
                "connections": gn.connections,
                "risk": gn.risk,
                "suggestion": f"Split {gn.name} into smaller modules",
            })
        findings["score"] -= min(30, len(graph.god_nodes) * 5)

    # 2. Function status distribution
    statuses = graph.function_statuses
    total_funcs = sum(statuses.values())
    if total_funcs > 0:
        stub_ratio = statuses.get("stub", 0) / total_funcs
        if stub_ratio > 0.8:
            findings["score"] -= 20
            findings["dependency_bloat"].append({
                "issue": f"{statuses.get('stub', 0)}/{total_funcs} functions are stubs",
                "suggestion": "Most code is unimplemented. Focus on core functions first.",
            })

    # 3. Scan for large files
    project_root = config.project_root
    skip_dirs = {
        ".git", ".ghost", "node_modules", "__pycache__",
        ".venv", "venv", ".next", "dist", "build", "graphify-out",
    }

    try:
        for root, dirs, files in os.walk(project_root):
            dirs[:] = [d for d in dirs if d not in skip_dirs]
            for fname in files:
                if not fname.endswith((".py", ".js", ".ts", ".jsx", ".tsx")):
                    continue
                fpath = os.path.join(root, fname)
                try:
                    line_count = sum(1 for _ in open(fpath, "r", errors="ignore"))
                    if line_count > 400:
                        rel = os.path.relpath(fpath, project_root)
                        findings["large_files"].append({
                            "file": rel,
                            "lines": line_count,
                            "suggestion": f"{rel} has {line_count} lines. Consider splitting.",
                        })
                except OSError:
                    continue
    except OSError:
        pass

    if findings["large_files"]:
        findings["score"] -= min(15, len(findings["large_files"]) * 3)

    # 4. Check for unnecessary dependencies
    pyproject = project_root / "cli" / "pyproject.toml"
    if pyproject.exists():
        try:
            content = pyproject.read_text()
            dep_count = content.count('"') // 2  # rough estimate
            if dep_count > 12:
                findings["dependency_bloat"].append({
                    "issue": f"~{dep_count} dependencies detected",
                    "suggestion": "For a hackathon, consider if all are necessary.",
                })
                findings["score"] -= 5
        except OSError:
            pass

    # Final verdict
    if findings["score"] >= 80:
        findings["verdict"] = "Clean — codebase is in good shape"
    elif findings["score"] >= 60:
        findings["verdict"] = "Needs attention — some areas to improve"
    elif findings["score"] >= 40:
        findings["verdict"] = "Warning — significant issues found"
    else:
        findings["verdict"] = "Critical — major refactoring needed"

    findings["score"] = max(0, findings["score"])
    return findings


def review_recent_commits(config: GhostConfig, n: int = 5) -> list[dict]:
    """Review recent commits for scope creep and unnecessary complexity.

    Returns list of findings per commit.
    """
    findings = []

    try:
        result = subprocess.run(
            ["git", "log", f"-{n}", "--format=%H|%s|%an", "--name-only"],
            capture_output=True, text=True, cwd=str(config.project_root),
        )
        if result.returncode != 0:
            return findings

        current_commit = None
        current_files = []

        for line in result.stdout.strip().split("\n"):
            if "|" in line and line.count("|") >= 2:
                # Save previous commit
                if current_commit:
                    findings.append({**current_commit, "files": current_files})
                    current_files = []

                parts = line.split("|", 2)
                current_commit = {
                    "hash": parts[0][:8],
                    "message": parts[1],
                    "author": parts[2],
                    "issues": [],
                }
            elif line.strip() and current_commit:
                current_files.append(line.strip())

        if current_commit:
            findings.append({**current_commit, "files": current_files})

        # Analyze each commit
        for commit in findings:
            files = commit.get("files", [])

            # Flag commits touching too many files
            if len(files) > 10:
                commit["issues"].append(
                    f"Touched {len(files)} files — consider smaller commits"
                )

            # Flag commits with vague messages
            msg = commit.get("message", "").lower()
            vague = ["fix", "update", "changes", "stuff", "wip", "misc"]
            if any(msg.strip() == v for v in vague):
                commit["issues"].append(
                    "Vague commit message — be specific about what changed"
                )

    except (FileNotFoundError, OSError):
        pass

    return findings


def render_audit(findings: dict) -> None:
    """Render audit findings as rich output."""
    score = findings.get("score", 0)
    score_color = (
        "green" if score >= 80 else
        "yellow" if score >= 60 else
        "red" if score >= 40 else
        "bold red"
    )

    console.print()
    console.print(Panel(
        f"[{score_color}]Score: {score}/100 — {findings['verdict']}[/{score_color}]",
        title="[bold]Codebase Audit[/bold]",
        expand=False,
    ))

    # God Nodes
    if findings["god_nodes"]:
        table = Table(title="God Nodes (over-connected)", show_lines=True)
        table.add_column("File/Module", style="bold")
        table.add_column("Connections", justify="right")
        table.add_column("Risk")
        table.add_column("Suggestion")

        for gn in findings["god_nodes"]:
            risk_color = {"high": "red", "medium": "yellow", "low": "green"}.get(gn["risk"], "")
            table.add_row(
                gn["name"],
                str(gn["connections"]),
                f"[{risk_color}]{gn['risk']}[/{risk_color}]",
                gn["suggestion"],
            )
        console.print(table)

    # Large files
    if findings["large_files"]:
        table = Table(title="Large Files", show_lines=True)
        table.add_column("File", style="bold")
        table.add_column("Lines", justify="right")
        table.add_column("Suggestion")

        for lf in findings["large_files"]:
            table.add_row(lf["file"], str(lf["lines"]), lf["suggestion"])
        console.print(table)

    # Other issues
    if findings["dependency_bloat"]:
        for issue in findings["dependency_bloat"]:
            console.print(f"  [yellow]![/yellow] {issue['issue']}")
            console.print(f"    [dim]{issue['suggestion']}[/dim]")

    if not any([findings["god_nodes"], findings["large_files"], findings["dependency_bloat"]]):
        console.print("  [green]No major issues found.[/green]")

    console.print()


def render_review(commits: list[dict]) -> None:
    """Render commit review as rich output."""
    if not commits:
        console.print("[dim]No recent commits to review.[/dim]")
        return

    console.print()
    console.print("[bold]Recent Commit Review[/bold]")

    for commit in commits:
        hash_str = commit.get("hash", "?")
        message = commit.get("message", "?")
        author = commit.get("author", "?")
        files = commit.get("files", [])
        issues = commit.get("issues", [])

        style = "red" if issues else "green"
        icon = "!!" if issues else "ok"

        console.print(
            f"  [{style}]{icon}[/{style}] [bold]{hash_str}[/bold] {message} "
            f"[dim]({author}, {len(files)} files)[/dim]"
        )
        for issue in issues:
            console.print(f"     [yellow]> {issue}[/yellow]")

    console.print()
