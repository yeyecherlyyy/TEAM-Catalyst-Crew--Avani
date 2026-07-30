"""Ghost-PM Pre-Commit Hook — Scope Guard.

Runs as a module: python -m ghost_pm.hooks.pre_commit

Checks if staged changes align with the active milestone.
Uses the LLM (if available) or a heuristic fallback.
Exit code 0 = allow commit, 1 = block commit.
"""

from __future__ import annotations

import json
import subprocess
import sys
from datetime import datetime
from pathlib import Path

from rich.console import Console

from ghost_pm.config import GhostConfig
from ghost_pm.state import Alert, ProjectState

console = Console()


def get_staged_diff() -> str:
    """Get the staged diff summary."""
    result = subprocess.run(
        ["git", "diff", "--cached", "--stat"],
        capture_output=True, text=True,
    )
    return result.stdout.strip()


def get_staged_files() -> list[str]:
    """Get list of staged file paths."""
    result = subprocess.run(
        ["git", "diff", "--cached", "--name-only"],
        capture_output=True, text=True,
    )
    return [f.strip() for f in result.stdout.strip().split("\n") if f.strip()]


def get_commit_message() -> str:
    """Try to get the commit message from COMMIT_EDITMSG."""
    msg_file = Path.cwd() / ".git" / "COMMIT_EDITMSG"
    if msg_file.exists():
        return msg_file.read_text().strip()
    return ""


# Files that are always allowed regardless of milestone
ALWAYS_ALLOWED_PATTERNS = [
    ".env", ".gitignore", "README", "LICENSE",
    "package.json", "package-lock.json",
    "pyproject.toml", "requirements.txt",
    "Makefile", "Dockerfile", "docker-compose",
    ".ghost/", "graphify-out/",
    "tsconfig", "vite.config", "next.config",
    ".eslintrc", ".prettierrc",
]


def is_always_allowed(file_path: str) -> bool:
    """Check if a file is in the always-allowed list."""
    lower = file_path.lower()
    return any(pattern.lower() in lower for pattern in ALWAYS_ALLOWED_PATTERNS)


def heuristic_scope_check(
    staged_files: list[str],
    milestone: dict,
) -> tuple[bool, str, str]:
    """Fallback scope check without LLM.

    Returns (allowed, reason, severity).
    """
    expected_files = milestone.get("files_expected", [])
    milestone_name = milestone.get("name", "Unknown")

    # If no expected files defined, allow everything
    if not expected_files:
        return True, f"No file restrictions for '{milestone_name}'", "info"

    # Check each staged file
    off_scope_files = []
    for f in staged_files:
        if is_always_allowed(f):
            continue
        # Check if any expected pattern matches
        matches = any(
            expected.lower() in f.lower() or f.lower().startswith(expected.lower())
            for expected in expected_files
        )
        if not matches:
            off_scope_files.append(f)

    if not off_scope_files:
        return True, f"All changes align with '{milestone_name}'", "info"

    # Determine severity
    total_files = len([f for f in staged_files if not is_always_allowed(f)])
    off_ratio = len(off_scope_files) / max(total_files, 1)

    if off_ratio > 0.5:
        return (
            False,
            f"Scope creep: {len(off_scope_files)} files outside '{milestone_name}' scope: "
            + ", ".join(off_scope_files[:5]),
            "block",
        )
    else:
        return (
            True,
            f"Warning: {len(off_scope_files)} files outside scope but majority aligns",
            "warning",
        )


async def llm_scope_check(
    staged_diff: str,
    staged_files: list[str],
    commit_message: str,
    milestone: dict,
    config: GhostConfig,
) -> tuple[bool, str, str]:
    """LLM-powered scope check using Pydantic-AI.

    Returns (allowed, reason, severity).
    """
    try:
        from pydantic import BaseModel
        from pydantic_ai import Agent
        from typing import Literal

        # Inject API key into environment so pydantic-ai can find it
        import os
        if config.gemini_api_key:
            os.environ["GEMINI_API_KEY"] = config.gemini_api_key
        if config.openai_api_key:
            os.environ["OPENAI_API_KEY"] = config.openai_api_key

        class ScopeVerdict(BaseModel):
            allowed: bool
            reason: str
            severity: Literal["info", "warning", "block"]

        scope_agent = Agent(
            model=config.llm_model_string,
            output_type=ScopeVerdict,
            system_prompt=(
                "You are a scope guard for a hackathon project. "
                "Given the active milestone, staged files, and commit message, "
                "determine if this commit aligns with the milestone. "
                "Be practical — config files, dependencies, and shared utilities are always allowed. "
                "Only block if the changes are clearly working on a different feature/milestone. "
                "Use severity 'block' only for clear scope violations, 'warning' for borderline cases."
            ),
        )

        context = (
            f"Active Milestone: {milestone.get('name', 'Unknown')}\n"
            f"Milestone Description: {milestone.get('description', 'N/A')}\n"
            f"Expected Files/Dirs: {', '.join(milestone.get('files_expected', []))}\n"
            f"---\n"
            f"Commit Message: {commit_message}\n"
            f"Staged Files: {', '.join(staged_files)}\n"
            f"---\n"
            f"Diff Summary (first 2000 chars):\n{staged_diff[:2000]}"
        )

        result = await scope_agent.run(context)
        verdict = result.data
        return verdict.allowed, verdict.reason, verdict.severity

    except Exception as e:
        console.print(f"[dim]LLM scope check failed: {e}. Using heuristic.[/dim]")
        return heuristic_scope_check(staged_files, milestone)


def main() -> None:
    """Main scope guard logic."""
    config = GhostConfig.load()
    state = ProjectState.load(config.state_path)

    # If no active milestone, allow everything
    active_ms = state.get_active_milestone()
    if active_ms is None:
        sys.exit(0)

    staged_files = get_staged_files()
    if not staged_files:
        sys.exit(0)

    staged_diff = get_staged_diff()
    commit_message = get_commit_message()

    milestone_data = {
        "name": active_ms.name,
        "description": active_ms.description,
        "files_expected": active_ms.files_expected,
    }

    # Try LLM check, fall back to heuristic
    if config.has_llm:
        import asyncio
        allowed, reason, severity = asyncio.run(
            llm_scope_check(staged_diff, staged_files, commit_message, milestone_data, config)
        )
    else:
        allowed, reason, severity = heuristic_scope_check(staged_files, milestone_data)

    # Log the verdict
    log_entry = {
        "timestamp": datetime.now().isoformat(),
        "commit_message": commit_message,
        "files": staged_files,
        "milestone": active_ms.name,
        "allowed": allowed,
        "reason": reason,
        "severity": severity,
    }
    with open(config.scope_log_path, "a") as f:
        f.write(json.dumps(log_entry) + "\n")

    if severity == "block" and not allowed:
        state.scope_violations += 1
        state.active_alerts.append(
            Alert(
                alert_type="critical",
                category="scope_violation",
                message=reason,
                member_name=config.member_name,
            )
        )
        state.increment_version()
        state.save(config.state_path)

        console.print(f"\n[red bold]⛔ [Ghost-PM] SCOPE VIOLATION[/red bold]")
        console.print(f"[red]{reason}[/red]")
        console.print(f"[dim]Active milestone: {active_ms.name}[/dim]")
        console.print(f"[dim]Run 'ghost override' to bypass for one commit.[/dim]\n")
        sys.exit(1)

    elif severity == "warning":
        console.print(f"[yellow]⚠ [Ghost-PM] {reason}[/yellow]")
        sys.exit(0)

    else:
        console.print(f"[green]✓ [Ghost-PM] {reason}[/green]")
        sys.exit(0)


if __name__ == "__main__":
    main()
