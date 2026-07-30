"""Ghost-PM AI Advisor.

Reads state.json and sends it to Gemini for structured advice.
Can be called on-demand (/advice) or auto-triggered by the daemon.
Uses google-genai SDK directly for simplicity.
"""

from __future__ import annotations

import json
import os
from datetime import datetime
from typing import Any

from rich.console import Console
from rich.panel import Panel
from rich.table import Table

from ghost_pm.config import GhostConfig
from ghost_pm.state import ProjectState, Suggestion

console = Console()

# ──────────────────────────────────────────────────────────────
# System prompt for the advisor
# ──────────────────────────────────────────────────────────────

ADVISOR_SYSTEM_PROMPT = """You are Ghost-PM Advisor, an AI assistant embedded in a hackathon CLI tool.
You analyze the team's project state and provide actionable, time-aware advice.

RULES:
1. Be direct and specific — no fluff. Hackathon time is precious.
2. Prioritize based on time remaining. If <2 hours left, suggest cutting features.
3. Flag "god nodes" (files with too many connections) as refactor risks.
4. If a team member has been idle >30 minutes, suggest they might be stuck.
5. If milestone progress is behind schedule, suggest scope cuts.
6. Never suggest adding new features unless progress is ahead of schedule.
7. Keep suggestions to 3-5 items max.
8. If the codebase has all "stub" functions, the team hasn't started coding yet — urge them to start.

RESPONSE FORMAT (JSON):
{
  "summary": "One-line assessment of current state",
  "urgency": "low|medium|high|critical",
  "suggestions": [
    {"priority": "high|medium|low", "category": "scope|code|team|time", "message": "..."}
  ],
  "encouragement": "One motivational line"
}
"""


def _build_context(state: ProjectState, config: GhostConfig) -> str:
    """Build a compact context string from state.json for the LLM."""
    lines = [
        f"Project: {state.project_name}",
        f"Description: {state.description}",
        f"Tech Stack: {', '.join(state.tech_stack) if state.tech_stack else 'not specified'}",
        f"Hours Remaining: {state.hours_remaining:.1f}",
        f"Overall Progress: {state.overall_progress_percent:.0f}%",
        f"Total Commits: {state.total_commits}",
        f"Scope Violations: {state.scope_violations}",
        "",
        "--- Code Graph ---",
        f"Nodes: {state.code_graph.total_nodes}",
        f"Functions: {state.code_graph.total_functions}",
        f"Files: {state.code_graph.total_files}",
        f"Function Statuses: {json.dumps(state.code_graph.function_statuses)}",
    ]

    if state.code_graph.god_nodes:
        lines.append("God Nodes (high connectivity risk):")
        for gn in state.code_graph.god_nodes[:5]:
            lines.append(f"  - {gn.name}: {gn.connections} connections ({gn.risk})")

    if state.milestones:
        lines.append("")
        lines.append("--- Milestones ---")
        for ms in state.milestones:
            lines.append(
                f"  [{ms.status}] {ms.name}: {ms.progress_percent:.0f}% "
                f"({ms.commit_count} commits)"
            )

    if state.team:
        lines.append("")
        lines.append("--- Team ---")
        for member in state.team:
            status = "online" if member.is_online else "offline"
            file_info = f"working on {member.current_file}" if member.current_file else "no active file"
            idle = f", idle {member.idle_minutes}m" if member.idle_minutes > 10 else ""
            lines.append(f"  {member.member_name}: {status}, {file_info}{idle}")

    if state.active_alerts:
        lines.append("")
        lines.append("--- Active Alerts ---")
        for alert in state.active_alerts[-5:]:
            lines.append(f"  [{alert.alert_type}] {alert.message}")

    return "\n".join(lines)


def get_advice(state: ProjectState, config: GhostConfig) -> dict[str, Any] | None:
    """Send state.json to Gemini and get structured advice.

    Returns parsed JSON response or None on failure.
    """
    if not config.gemini_api_key:
        return None

    # Set the API key in environment for the SDK
    os.environ["GEMINI_API_KEY"] = config.gemini_api_key

    context = _build_context(state, config)

    try:
        from google import genai

        client = genai.Client(api_key=config.gemini_api_key)

        response = client.models.generate_content(
            model=config.model,
            contents=f"{ADVISOR_SYSTEM_PROMPT}\n\n--- Current Project State ---\n{context}",
            config={
                "response_mime_type": "application/json",
                "temperature": 0.3,
            },
        )

        # Parse the JSON response
        text = response.text.strip()
        return json.loads(text)

    except ImportError:
        console.print("[dim]google-genai not installed. Run: pip install google-genai[/dim]")
        return None
    except json.JSONDecodeError:
        # If JSON parsing fails, return the raw text as a summary
        return {
            "summary": response.text.strip()[:200] if response else "No response",
            "urgency": "medium",
            "suggestions": [],
            "encouragement": "",
        }
    except Exception as e:
        console.print(f"[dim]AI advisor error: {e}[/dim]")
        return None


def get_chat_response(
    message: str,
    state: ProjectState,
    config: GhostConfig,
    chat_history: list[dict] | None = None,
) -> str | None:
    """Get an AI response to a team chat message.

    This is for when someone types a question in the terminal.
    The AI has context of the full project state.
    """
    if not config.gemini_api_key:
        return None

    context = _build_context(state, config)

    system = (
        "You are Ghost-PM, an AI team assistant embedded in a hackathon CLI. "
        "Answer questions concisely. You have access to the team's project state. "
        "Be helpful but brief — this is a terminal, not a chat app.\n\n"
        f"--- Project Context ---\n{context}"
    )

    try:
        from google import genai

        client = genai.Client(api_key=config.gemini_api_key)

        contents = system + "\n\n"
        if chat_history:
            for msg in chat_history[-10:]:  # Last 10 messages for context
                role = "User" if not msg.get("is_ai") else "AI"
                contents += f"{role}: {msg['content']}\n"

        contents += f"User: {message}\nAI:"

        response = client.models.generate_content(
            model=config.model,
            contents=contents,
            config={"temperature": 0.5, "max_output_tokens": 500},
        )

        return response.text.strip() if response.text else None

    except Exception as e:
        return f"[AI error: {e}]"


def render_advice(advice: dict[str, Any]) -> None:
    """Render AI advice as a rich panel in the terminal."""
    urgency = advice.get("urgency", "medium")
    urgency_colors = {
        "low": "green",
        "medium": "yellow",
        "high": "red",
        "critical": "bold red",
    }
    color = urgency_colors.get(urgency, "yellow")

    # Summary
    summary = advice.get("summary", "No assessment available")

    # Suggestions table
    suggestions = advice.get("suggestions", [])
    content_lines = [f"[{color}]{summary}[/{color}]", ""]

    if suggestions:
        for i, s in enumerate(suggestions, 1):
            priority = s.get("priority", "medium")
            category = s.get("category", "general")
            message = s.get("message", "")
            icon = {"high": "!!!", "medium": " ! ", "low": "   "}.get(priority, " - ")
            p_color = {"high": "red", "medium": "yellow", "low": "dim"}.get(priority, "")
            content_lines.append(
                f"  [{p_color}]{icon}[/{p_color}] [{p_color}][{category}][/{p_color}] {message}"
            )

    encouragement = advice.get("encouragement", "")
    if encouragement:
        content_lines.append("")
        content_lines.append(f"  [dim italic]{encouragement}[/dim italic]")

    console.print(Panel(
        "\n".join(content_lines),
        title="[bold]AI Advisor[/bold]",
        subtitle=f"[dim]{datetime.now().strftime('%H:%M')}[/dim]",
        border_style=color,
        expand=False,
        padding=(1, 2),
    ))


def advice_to_suggestions(advice: dict[str, Any]) -> list[Suggestion]:
    """Convert AI advice to Suggestion models for state.json."""
    results = []
    for s in advice.get("suggestions", []):
        results.append(Suggestion(
            message=s.get("message", ""),
            priority=s.get("priority", "medium"),
            category=s.get("category", "general"),
        ))
    return results
