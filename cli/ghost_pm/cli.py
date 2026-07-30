"""Ghost-PM CLI — The main entry point.

Install: pip install ghostpm
Usage:   ghostpm create       Create a new hackathon room (interactive setup)
         ghostpm join <id>    Join a room by its ID
         ghostpm status       Show current state
         ghostpm commit       Smart commit with scope check
         ghostpm advance      Complete current milestone
         ghostpm override     Bypass scope guard once
         ghostpm graph        Rebuild code graph
         ghostpm daemon       Manage background daemon
"""

from __future__ import annotations

import json
import os
import subprocess
import sys
import uuid
from datetime import datetime, timedelta
from pathlib import Path

import click
from rich.console import Console
from rich.panel import Panel
from rich.table import Table
from rich.prompt import Prompt, IntPrompt, Confirm

from ghost_pm.config import GhostConfig
from ghost_pm.graph_parser import GraphParser
from ghost_pm.state import (
    Alert,
    MilestoneState,
    ProjectState,
    TeamMemberSnapshot,
)

console = Console()

GHOST_BANNER = """[bold cyan]
   ██████╗ ██╗  ██╗ ██████╗ ███████╗████████╗    ██████╗ ███╗   ███╗
  ██╔════╝ ██║  ██║██╔═══██╗██╔════╝╚══██╔══╝    ██╔══██╗████╗ ████║
  ██║  ███╗███████║██║   ██║███████╗   ██║  ███╗ ██████╔╝██╔████╔██║
  ██║   ██║██╔══██║██║   ██║╚════██║   ██║  ╚══╝ ██╔═══╝ ██║╚██╔╝██║
  ╚██████╔╝██║  ██║╚██████╔╝███████║   ██║       ██║     ██║ ╚═╝ ██║
   ╚═════╝ ╚═╝  ╚═╝ ╚═════╝ ╚══════╝   ╚═╝       ╚═╝     ╚═╝     ╚═╝
[/bold cyan]"""


# ──────────────────────────────────────────────────────────────
# CLI Group
# ──────────────────────────────────────────────────────────────


@click.group()
@click.version_option(version="0.1.0", prog_name="ghostpm")
def cli() -> None:
    """👻 Ghost-PM — Headless CLI Project Manager for Hackathons."""
    pass


# ──────────────────────────────────────────────────────────────
# ghostpm create  — Full interactive room setup
# ──────────────────────────────────────────────────────────────


@cli.command()
def create() -> None:
    """Create a new hackathon room with full interactive setup."""
    console.print(GHOST_BANNER)
    console.print("[bold]Let's set up your hackathon project.[/bold]\n")

    config = GhostConfig()
    from ghost_pm.sync.client import GhostSyncClient
    sync = GhostSyncClient(config)

    # ── Step 1: Project Details ──────────────────────
    console.print("[bold cyan]━━━ Step 1: Project Details ━━━[/bold cyan]")
    project_name = Prompt.ask("📛 Project name")
    description = Prompt.ask("📝 Description (what are you building?)", default="")
    
    # Tech stack
    tech_input = Prompt.ask(
        "🛠  Tech stack (comma-separated)",
        default="Python, React"
    )
    tech_stack = [t.strip() for t in tech_input.split(",") if t.strip()]
    
    # Duration
    duration = IntPrompt.ask("⏱  Hackathon duration (hours)", default=24)

    # ── Step 2: Milestones ───────────────────────────
    console.print("\n[bold cyan]━━━ Step 2: Define Milestones ━━━[/bold cyan]")
    
    num_milestones = IntPrompt.ask(
        "📊 How many milestones? (1-5, recommended: 3)",
        default=3
    )
    num_milestones = max(1, min(num_milestones, 5))

    milestones_input: list[dict] = []
    for i in range(1, num_milestones + 1):
        ms_name = Prompt.ask(f"  #{i} name", default=f"Phase {i}")
        milestones_input.append({
            "name": ms_name,
            "description": "",
            "order_index": i,
            "files_expected": [],
        })

    # ── Step 3: Your Info ────────────────────────────
    console.print("\n[bold cyan]━━━ Step 3: Your Info ━━━[/bold cyan]")
    member_name = Prompt.ask("👤 Your name")
    api_key = Prompt.ask(
        "🔑 LLM API key (Gemini/OpenAI — for AI scope checking, optional)",
        default="", password=True
    )

    # ── Create Room ──────────────────────────────────
    console.print("\n[dim]Creating room...[/dim]")
    
    now = datetime.now()
    room_data = sync.create_room({
        "name": project_name,
        "description": description,
        "duration_hours": duration,
        "tech_stack": tech_stack,
        "hackathon_start": now.isoformat(),
        "hackathon_end": (now + timedelta(hours=duration)).isoformat(),
    })

    if room_data is None:
        console.print("[red]✗ Failed to create room. Check your network.[/red]")
        return

    room_id = room_data["id"]
    console.print(f"[green]✓[/green] Room created: [bold cyan]{room_id}[/bold cyan]")

    # ── Create Milestones ────────────────────────────
    ms_rows = []
    for ms in milestones_input:
        ms["room_id"] = room_id
        ms["status"] = "active" if ms["order_index"] == 1 else "pending"
        ms_rows.append(ms)

    created_ms = sync.create_milestones(ms_rows)
    console.print(f"[green]✓[/green] Created {len(created_ms)} milestones")

    # ── Register Member ──────────────────────────────
    sync.register_member(room_id, member_name)
    console.print(f"[green]✓[/green] Registered as: [bold]{member_name}[/bold]")

    # ── Auto Git Init ────────────────────────────────
    _ensure_git_repo()

    # ── Setup .ghost/ and state.json ─────────────────
    config.room_id = room_id
    config.member_name = member_name
    config.ghost_dir = Path.cwd() / ".ghost"
    config.project_root = Path.cwd()
    if api_key:
        config.gemini_api_key = api_key
    config.save_ghost_config()
    console.print("[green]✓[/green] Saved .ghost/config.json")

    # Build state
    state = _build_initial_state(config, room_data, created_ms)
    state.save(config.state_path)
    console.print("[green]✓[/green] Created .ghost/state.json")

    # ── Install Git Hooks ────────────────────────────
    _install_hooks_if_git()

    # ── Run Graphify ─────────────────────────────────
    _run_initial_graph(config, state, sync, room_id, member_name)

    # ── Add .ghost to .gitignore ─────────────────────
    _ensure_gitignore()

    # ── Summary ──────────────────────────────────────
    console.print()
    console.print(Panel(
        f"[bold green]✓ Room is live![/bold green]\n\n"
        f"  Room ID:     [bold cyan]{room_id}[/bold cyan]\n"
        f"  Project:     {project_name}\n"
        f"  Duration:    {duration}h\n"
        f"  Milestones:  {len(created_ms)}\n"
        f"  Tech Stack:  {', '.join(tech_stack)}\n\n"
        f"  [yellow]Share this command with your team:[/yellow]\n"
        f"  [bold]ghostpm join {room_id}[/bold]",
        title="🏠 Room Ready",
        expand=False,
    ))


# ──────────────────────────────────────────────────────────────
# ghostpm join <room_id>  — Join an existing room
# ──────────────────────────────────────────────────────────────


@cli.command()
@click.argument("room_id")
def join(room_id: str) -> None:
    """Join a hackathon room and set up Ghost-PM locally."""
    console.print(GHOST_BANNER)

    config = GhostConfig()
    from ghost_pm.sync.client import GhostSyncClient
    sync = GhostSyncClient(config)

    # Verify room exists
    console.print(f"[dim]Looking up room [bold]{room_id}[/bold]...[/dim]")
    room_data = sync.get_room(room_id)
    if room_data is None:
        console.print(f"[red]✗ Room '{room_id}' not found.[/red]")
        console.print("[dim]Create one with: ghostpm create[/dim]")
        return

    console.print(f"[green]✓[/green] Found: [bold]{room_data.get('name', room_id)}[/bold]")
    console.print(f"  {room_data.get('description', '')}")

    # Show existing milestones
    milestones = sync.get_milestones(room_id)
    if milestones:
        console.print(f"\n  📊 Milestones:")
        for ms in milestones:
            icon = "🟢" if ms["status"] == "completed" else "🔵" if ms["status"] == "active" else "⚪"
            console.print(f"    {icon} {ms['name']}")

    # Show existing members
    members = sync.get_members(room_id)
    if members:
        names = [m["member_name"] for m in members]
        console.print(f"  👥 Team: {', '.join(names)}")

    # Collect info
    console.print()
    member_name = Prompt.ask("👤 Your name")
    api_key = Prompt.ask(
        "🔑 LLM API key (optional, for AI scope checking)",
        default="", password=True
    )

    # Register
    sync.register_member(room_id, member_name)
    console.print(f"[green]✓[/green] Joined as: [bold]{member_name}[/bold]")

    # Auto git init
    _ensure_git_repo()

    # Setup .ghost/
    config.room_id = room_id
    config.member_name = member_name
    config.ghost_dir = Path.cwd() / ".ghost"
    config.project_root = Path.cwd()
    if api_key:
        config.gemini_api_key = api_key
    config.save_ghost_config()
    console.print("[green]✓[/green] Saved .ghost/config.json")

    # Build state
    milestones = sync.get_milestones(room_id)
    state = _build_initial_state(config, room_data, milestones)
    state.save(config.state_path)
    console.print("[green]✓[/green] Created .ghost/state.json")

    # Git hooks
    _install_hooks_if_git()

    # Graph
    _run_initial_graph(config, state, sync, room_id, member_name)

    # Gitignore
    _ensure_gitignore()

    console.print()
    console.print(Panel(
        "[bold green]✓ Ghost-PM is ready![/bold green]\n\n"
        "  [cyan]ghostpm status[/cyan]    — View current state\n"
        "  [cyan]ghostpm commit[/cyan]    — Smart commit with scope check\n"
        "  [cyan]ghostpm graph[/cyan]     — Rebuild code graph\n"
        "  [cyan]ghostpm advance[/cyan]   — Complete current milestone\n"
        "  [cyan]ghostpm daemon start[/cyan] — Start background sync",
        title="🚀 Ready",
        expand=False,
    ))


# ──────────────────────────────────────────────────────────────
# Shared helpers
# ──────────────────────────────────────────────────────────────


def _ensure_git_repo() -> None:
    """Auto-initialize a git repo if one doesn't exist."""
    if not (Path.cwd() / ".git").is_dir():
        console.print("[dim]  No git repo found — initializing...[/dim]")
        result = subprocess.run(
            ["git", "init"], capture_output=True, text=True, cwd=str(Path.cwd())
        )
        if result.returncode == 0:
            console.print("[green]✓[/green] Initialized git repository")
        else:
            console.print(f"[yellow]⚠ git init failed: {result.stderr}[/yellow]")
    else:
        console.print("[green]✓[/green] Git repo found")


def _ensure_gitignore() -> None:
    """Add .ghost/ and graphify-out/ to .gitignore."""
    gitignore = Path.cwd() / ".gitignore"
    entries = [".ghost/", "graphify-out/", "__pycache__/"]
    existing = gitignore.read_text() if gitignore.exists() else ""
    
    to_add = [e for e in entries if e not in existing]
    if to_add:
        with open(gitignore, "a") as f:
            if existing and not existing.endswith("\n"):
                f.write("\n")
            f.write("# Ghost-PM\n")
            for entry in to_add:
                f.write(f"{entry}\n")
        console.print("[green]✓[/green] Updated .gitignore")


def _run_initial_graph(config, state, sync, room_id, member_name):
    """Run graphify and push snapshot to Supabase."""
    parser = GraphParser(project_root=Path.cwd(), ghost_dir=config.ghost_dir)
    if parser.run_graphify():
        summary = parser.build_summary()
        state.code_graph = summary
        state.files = parser.build_file_records()
        state.increment_version()
        state.save(config.state_path)
        console.print(
            f"[green]✓[/green] Code graph: {summary.total_nodes} nodes, "
            f"{summary.total_functions} functions, {summary.total_files} files"
        )
        sync.push_graph_snapshot(room_id, member_name, summary)
        console.print("[green]✓[/green] Graph snapshot synced to cloud")
    else:
        console.print("[dim]  Code graph will be built on first commit[/dim]")


def _build_initial_state(
    config: GhostConfig,
    room_data: dict,
    milestones: list[dict],
) -> ProjectState:
    """Build initial state from Supabase room data."""
    ms_list = [
        MilestoneState(
            id=m.get("id", i),
            name=m.get("name", f"Milestone {i + 1}"),
            description=m.get("description", ""),
            order_index=m.get("order_index", i),
            status=m.get("status", "pending"),
            files_expected=m.get("files_expected", []),
        )
        for i, m in enumerate(milestones)
    ]

    active_id = None
    for ms in ms_list:
        if ms.status == "active":
            active_id = ms.id
            break
    if active_id is None and ms_list:
        active_id = ms_list[0].id
        ms_list[0].status = "active"

    now = datetime.now()
    
    # Parse hackathon times (handle both string and datetime)
    def parse_dt(val, fallback):
        if val is None:
            return fallback
        if isinstance(val, datetime):
            return val
        try:
            dt = datetime.fromisoformat(str(val))
            # Strip timezone for consistency
            if dt.tzinfo is not None:
                dt = dt.replace(tzinfo=None)
            return dt
        except (ValueError, TypeError):
            return fallback
    
    hackathon_start = parse_dt(room_data.get("hackathon_start"), now)
    hackathon_end = parse_dt(room_data.get("hackathon_end"), now + timedelta(hours=24))

    return ProjectState(
        room_id=config.room_id,
        project_name=room_data.get("name", ""),
        description=room_data.get("description", ""),
        tech_stack=room_data.get("tech_stack", []),
        hackathon_start=hackathon_start,
        hackathon_end=hackathon_end,
        milestones=ms_list,
        active_milestone_id=active_id,
        team=[
            TeamMemberSnapshot(member_name=config.member_name, is_online=True)
        ],
    )


def _install_hooks_if_git() -> None:
    """Install git hooks if we're in a git repository."""
    git_dir = Path.cwd() / ".git"
    if git_dir.is_dir():
        try:
            from ghost_pm.hooks.installer import install_hooks
            install_hooks(Path.cwd())
            console.print("[green]✓[/green] Installed git hooks (scope guard + progress tracker)")
        except Exception as e:
            console.print(f"[yellow]⚠ Could not install git hooks: {e}[/yellow]")


# ──────────────────────────────────────────────────────────────
# ghostpm status
# ──────────────────────────────────────────────────────────────


@cli.command()
def status() -> None:
    """Show current project state."""
    config = GhostConfig.load()
    
    if not config.state_path.exists():
        console.print("[yellow]Not connected to a room yet.[/yellow]")
        console.print("  Create one:  [bold]ghostpm create[/bold]")
        console.print("  Or join one: [bold]ghostpm join <room-id>[/bold]")
        return

    state = ProjectState.load(config.state_path)
    state.update_hours_remaining()

    # Header
    hours = state.hours_remaining
    time_color = "red" if hours < 2 else "yellow" if hours < 6 else "green"
    console.print(Panel(
        f"[bold]{state.project_name or 'Ghost-PM'}[/bold]  •  "
        f"Room: [cyan]{state.room_id}[/cyan]  •  "
        f"[{time_color}]⏱ {hours:.1f}h remaining[/{time_color}]",
        expand=False,
    ))

    # Milestones
    if state.milestones:
        ms_table = Table(title="📊 Milestones", show_lines=True)
        ms_table.add_column("", width=3)
        ms_table.add_column("Milestone", style="bold")
        ms_table.add_column("Status")
        ms_table.add_column("Progress")
        ms_table.add_column("Commits", justify="right")

        for ms in state.milestones:
            icon = "🟢" if ms.status == "completed" else "🔵" if ms.status == "active" else "⚪"
            status_style = (
                "green" if ms.status == "completed"
                else "cyan" if ms.status == "active"
                else "dim"
            )
            progress_bar = _make_progress_bar(ms.progress_percent)
            ms_table.add_row(
                icon,
                ms.name,
                f"[{status_style}]{ms.status}[/{status_style}]",
                progress_bar,
                str(ms.commit_count),
            )
        console.print(ms_table)

    # Code graph summary
    graph = state.code_graph
    if graph.total_nodes > 0:
        console.print()
        graph_table = Table(title="🔗 Code Graph (graphify)", show_lines=True)
        graph_table.add_column("Metric", style="bold")
        graph_table.add_column("Value", justify="right")
        graph_table.add_row("Total Nodes", str(graph.total_nodes))
        graph_table.add_row("Total Edges", str(graph.total_edges))
        graph_table.add_row("Functions", str(graph.total_functions))
        graph_table.add_row("Files", str(graph.total_files))
        graph_table.add_row("Communities", str(len(graph.communities)))
        if graph.god_nodes:
            graph_table.add_row("⚠ God Nodes", str(len(graph.god_nodes)))
        for status_name, count in graph.function_statuses.items():
            if count > 0:
                emoji = {"stub": "⬜", "in_progress": "🟡", "implemented": "🟢",
                         "tested": "✅", "broken": "🔴"}.get(status_name, "⚪")
                graph_table.add_row(f"  {emoji} {status_name}", str(count))
        console.print(graph_table)

    # Team
    if state.team:
        console.print()
        team_table = Table(title="👥 Team Activity", show_lines=True)
        team_table.add_column("Member", style="bold")
        team_table.add_column("Status")
        team_table.add_column("Current File")
        team_table.add_column("Commits", justify="right")

        for member in state.team:
            online_icon = "🟢" if member.is_online else "🔴"
            team_table.add_row(
                f"{online_icon} {member.member_name}",
                "online" if member.is_online else "offline",
                member.current_file or "—",
                str(member.total_commits),
            )
        console.print(team_table)

    # Stats footer
    console.print()
    state.compute_overall_progress()
    console.print(
        f"  Commits: [bold]{state.total_commits}[/bold]  •  "
        f"Scope violations: [bold]{state.scope_violations}[/bold]  •  "
        f"Progress: [bold]{state.overall_progress_percent:.0f}%[/bold]  •  "
        f"v{state.state_version}"
    )

    # Active alerts
    if state.active_alerts:
        console.print()
        for alert in state.active_alerts[-3:]:
            icon = "🔴" if alert.alert_type == "critical" else "⚠️"
            console.print(f"  {icon} {alert.message}")


# ──────────────────────────────────────────────────────────────
# ghostpm watch  — Live auto-refreshing dashboard
# ──────────────────────────────────────────────────────────────


@cli.command()
@click.option("--interval", "-i", default=3, help="Refresh interval in seconds")
def watch(interval: int) -> None:
    """Live dashboard — auto-refreshes every few seconds. Press Ctrl+C to stop."""
    config = GhostConfig.load()

    if not config.state_path.exists():
        console.print("[yellow]Not connected to a room yet.[/yellow]")
        return

    from rich.live import Live
    from rich.layout import Layout
    from rich.text import Text

    def build_display() -> Table:
        """Build the full dashboard as a single renderable."""
        state = ProjectState.load(config.state_path)
        state.update_hours_remaining()
        state.compute_overall_progress()

        hours = state.hours_remaining
        time_color = "red" if hours < 2 else "yellow" if hours < 6 else "green"

        # Main table wrapping everything
        outer = Table.grid(padding=(1, 0))

        # Header
        outer.add_row(
            f"[bold]👻 {state.project_name or 'Ghost-PM'}[/bold]  •  "
            f"Room: [cyan]{state.room_id}[/cyan]  •  "
            f"[{time_color}]⏱ {hours:.1f}h[/{time_color}]  •  "
            f"Progress: [bold]{state.overall_progress_percent:.0f}%[/bold]  •  "
            f"v{state.state_version}  •  "
            f"[dim]{datetime.now().strftime('%H:%M:%S')}[/dim]"
        )

        # Milestones
        if state.milestones:
            ms_table = Table(title="📊 Milestones", show_lines=True, expand=True)
            ms_table.add_column("", width=3)
            ms_table.add_column("Milestone", style="bold")
            ms_table.add_column("Status")
            ms_table.add_column("Progress")
            ms_table.add_column("Commits", justify="right")

            for ms in state.milestones:
                icon = "🟢" if ms.status == "completed" else "🔵" if ms.status == "active" else "⚪"
                status_style = "green" if ms.status == "completed" else "cyan" if ms.status == "active" else "dim"
                progress_bar = _make_progress_bar(ms.progress_percent)
                ms_table.add_row(icon, ms.name, f"[{status_style}]{ms.status}[/{status_style}]", progress_bar, str(ms.commit_count))
            outer.add_row(ms_table)

        # Code Graph
        graph = state.code_graph
        if graph.total_nodes > 0:
            graph_table = Table(title="🔗 Code Graph", show_lines=True, expand=True)
            graph_table.add_column("Metric", style="bold")
            graph_table.add_column("Value", justify="right")
            graph_table.add_row("Nodes", str(graph.total_nodes))
            graph_table.add_row("Edges", str(graph.total_edges))
            graph_table.add_row("Functions", str(graph.total_functions))
            graph_table.add_row("Files", str(graph.total_files))
            if graph.god_nodes:
                graph_table.add_row("⚠ God Nodes", ", ".join(gn.name for gn in graph.god_nodes[:5]))
            for sn, cnt in graph.function_statuses.items():
                if cnt > 0:
                    emoji = {"stub": "⬜", "in_progress": "🟡", "implemented": "🟢", "tested": "✅", "broken": "🔴"}.get(sn, "⚪")
                    graph_table.add_row(f"  {emoji} {sn}", str(cnt))
            outer.add_row(graph_table)

        # Team
        if state.team:
            team_table = Table(title="👥 Team Activity", show_lines=True, expand=True)
            team_table.add_column("Member", style="bold")
            team_table.add_column("Status")
            team_table.add_column("Current File")
            team_table.add_column("Idle", justify="right")
            team_table.add_column("Commits", justify="right")

            for member in state.team:
                online_icon = "🟢" if member.is_online else "🔴"
                idle_str = f"{member.idle_minutes}m" if member.idle_minutes > 0 else "—"
                idle_style = "red" if member.idle_minutes > 45 else "yellow" if member.idle_minutes > 15 else ""
                team_table.add_row(
                    f"{online_icon} {member.member_name}",
                    "online" if member.is_online else "offline",
                    member.current_file or "—",
                    f"[{idle_style}]{idle_str}[/{idle_style}]" if idle_style else idle_str,
                    str(member.total_commits),
                )
            outer.add_row(team_table)

        # Alerts
        if state.active_alerts:
            alerts_text = ""
            for alert in state.active_alerts[-5:]:
                icon = "🔴" if alert.alert_type == "critical" else "⚠️"
                alerts_text += f"  {icon} {alert.message}\n"
            outer.add_row(alerts_text.rstrip())

        outer.add_row("[dim]Press Ctrl+C to stop watching[/dim]")
        return outer

    console.print("[cyan]👻 Ghost-PM Watch Mode — Live Dashboard[/cyan]\n")
    try:
        with Live(build_display(), console=console, refresh_per_second=1, screen=True) as live:
            while True:
                time.sleep(interval)
                live.update(build_display())
    except KeyboardInterrupt:
        console.print("\n[dim]Watch mode stopped.[/dim]")


def _make_progress_bar(percent: float) -> str:
    filled = int(percent / 5)
    empty = 20 - filled
    bar = "█" * filled + "░" * empty
    return f"{bar} {percent:.0f}%"


# ──────────────────────────────────────────────────────────────
# ghostpm commit
# ──────────────────────────────────────────────────────────────


@cli.command()
@click.option("-m", "--message", prompt="Commit message", help="Commit message")
def commit(message: str) -> None:
    """Smart commit with scope guard and auto-tracking."""
    config = GhostConfig.load()

    # Ensure we're in a git repo
    if not (Path.cwd() / ".git").is_dir():
        console.print("[yellow]Not a git repo. Initializing...[/yellow]")
        subprocess.run(["git", "init"], capture_output=True, cwd=str(Path.cwd()))

    # Check for staged changes
    try:
        result = subprocess.run(
            ["git", "diff", "--cached", "--stat"],
            capture_output=True, text=True, cwd=str(config.project_root),
        )
        if not result.stdout.strip():
            console.print("[dim]No staged changes. Staging all modified files...[/dim]")
            subprocess.run(["git", "add", "-A"], cwd=str(config.project_root))
    except FileNotFoundError:
        console.print("[red]Git not found.[/red]")
        return

    console.print(f"[cyan]Committing:[/cyan] {message}")
    result = subprocess.run(
        ["git", "commit", "-m", message],
        capture_output=True, text=True, cwd=str(config.project_root),
    )

    if result.returncode == 0:
        console.print(f"[green]✓[/green] {result.stdout.strip()}")
        
        # Rebuild graph after commit
        if config.state_path.exists():
            state = ProjectState.load(config.state_path)
            state.total_commits += 1
            
            # Find active milestone and increment its commit count
            active = state.get_active_milestone()
            if active:
                active.commit_count += 1
            
            state.increment_version()
            state.save(config.state_path)
            
            # Push commit to Supabase
            if config.has_supabase:
                try:
                    from ghost_pm.sync.client import GhostSyncClient
                    sync = GhostSyncClient(config)
                    
                    # Get commit hash
                    hash_result = subprocess.run(
                        ["git", "rev-parse", "HEAD"],
                        capture_output=True, text=True, cwd=str(config.project_root),
                    )
                    commit_hash = hash_result.stdout.strip()[:12]
                    
                    # Get changed files
                    diff_result = subprocess.run(
                        ["git", "diff", "--name-only", "HEAD~1", "HEAD"],
                        capture_output=True, text=True, cwd=str(config.project_root),
                    )
                    files = diff_result.stdout.strip().split("\n") if diff_result.stdout.strip() else []
                    
                    sync.push_commit(
                        room_id=config.room_id,
                        member_name=config.member_name,
                        commit_data={
                            "hash": commit_hash,
                            "message": message,
                            "files": files,
                            "insertions": 0,
                            "deletions": 0,
                        },
                        milestone_id=active.id if active else None,
                    )
                    console.print("[green]✓[/green] Commit synced to cloud")
                except Exception as e:
                    console.print(f"[dim]Sync: {e}[/dim]")
    else:
        stderr = result.stderr.strip()
        stdout = result.stdout.strip()
        out = stderr or stdout
        if "SCOPE VIOLATION" in out:
            console.print(f"[red]{out}[/red]")
            console.print("[dim]Run 'ghostpm override' to bypass.[/dim]")
        elif "nothing to commit" in out:
            console.print("[dim]Nothing to commit — working tree clean.[/dim]")
        else:
            console.print(f"[red]Commit failed:[/red] {out}")


# ──────────────────────────────────────────────────────────────
# ghostpm advance
# ──────────────────────────────────────────────────────────────


@cli.command()
def advance() -> None:
    """Complete the current milestone and activate the next one."""
    config = GhostConfig.load()
    
    if not config.state_path.exists():
        console.print("[yellow]Not connected. Run 'ghostpm create' or 'ghostpm join'.[/yellow]")
        return

    state = ProjectState.load(config.state_path)

    current = state.get_active_milestone()
    if current is None:
        console.print("[yellow]No active milestone to advance.[/yellow]")
        if state.milestones:
            console.print("[dim]All milestones may already be completed.[/dim]")
        else:
            console.print("[dim]Add milestones with: ghostpm milestone add 'Name'[/dim]")
        return

    current.status = "completed"
    current.progress_percent = 100.0
    current.completed_at = datetime.now()
    console.print(f"[green]✓[/green] Completed: [bold]{current.name}[/bold]")

    next_ms = None
    for ms in state.milestones:
        if ms.status == "pending":
            next_ms = ms
            break

    if next_ms:
        next_ms.status = "active"
        next_ms.started_at = datetime.now()
        state.active_milestone_id = next_ms.id
        console.print(f"[cyan]→[/cyan] Now active: [bold]{next_ms.name}[/bold]")
    else:
        state.active_milestone_id = None
        console.print("[green]🎉 All milestones completed![/green]")

    state.compute_overall_progress()
    state.increment_version()
    state.save(config.state_path)

    if config.has_supabase:
        try:
            from ghost_pm.sync.client import GhostSyncClient
            sync = GhostSyncClient(config)
            sync.update_milestone(current.id, {"status": "completed", "progress_percent": 100, "completed_at": datetime.now().isoformat()})
            if next_ms:
                sync.update_milestone(next_ms.id, {"status": "active", "started_at": datetime.now().isoformat()})
            console.print("[green]✓[/green] Synced to cloud")
        except Exception as e:
            console.print(f"[dim]Sync: {e}[/dim]")


# ──────────────────────────────────────────────────────────────
# ghostpm override
# ──────────────────────────────────────────────────────────────


@cli.command()
def override() -> None:
    """Temporarily disable scope guard for the next commit."""
    config = GhostConfig.load()
    override_path = config.ghost_dir / ".scope_override"
    override_path.write_text("1")
    console.print(
        "[yellow]⚠ Scope guard disabled for the next commit.[/yellow]\n"
        "  The override will be consumed after one commit."
    )


# ──────────────────────────────────────────────────────────────
# ghostpm graph
# ──────────────────────────────────────────────────────────────


@cli.command()
def graph() -> None:
    """Rebuild the code graph using graphify."""
    config = GhostConfig.load()
    parser = GraphParser(project_root=config.project_root, ghost_dir=config.ghost_dir)

    if parser.run_graphify():
        summary = parser.build_summary()

        if config.state_path.exists():
            state = ProjectState.load(config.state_path)
            state.code_graph = summary
            state.files = parser.build_file_records()
            state.increment_version()
            state.save(config.state_path)

        console.print(
            f"\n[bold]Graph Summary:[/bold]\n"
            f"  Nodes: {summary.total_nodes}  •  Edges: {summary.total_edges}\n"
            f"  Functions: {summary.total_functions}  •  Files: {summary.total_files}\n"
            f"  Communities: {len(summary.communities)}  •  God Nodes: {len(summary.god_nodes)}"
        )

        if config.has_supabase and config.room_id:
            try:
                from ghost_pm.sync.client import GhostSyncClient
                sync = GhostSyncClient(config)
                sync.push_graph_snapshot(config.room_id, config.member_name, summary)
                console.print("[green]✓[/green] Synced graph snapshot to cloud")
            except Exception as e:
                console.print(f"[dim]Sync: {e}[/dim]")
    else:
        console.print("[red]Failed to build code graph.[/red]")
        console.print("[dim]Ensure graphify is installed: pip install graphifyy[/dim]")


# ──────────────────────────────────────────────────────────────
# ghostpm daemon start|stop
# ──────────────────────────────────────────────────────────────


@cli.group()
def daemon() -> None:
    """Manage the background daemon."""
    pass


@daemon.command("start")
def daemon_start() -> None:
    """Start the background file-watching daemon."""
    config = GhostConfig.load()
    pid_file = config.ghost_dir / "daemon.pid"

    if pid_file.exists():
        pid = pid_file.read_text().strip()
        console.print(f"[yellow]Daemon may already be running (PID {pid}).[/yellow]")
        console.print("[dim]Run 'ghostpm daemon stop' first.[/dim]")
        return

    daemon_script = Path(__file__).parent / "daemon.py"
    proc = subprocess.Popen(
        [sys.executable, str(daemon_script)],
        cwd=str(config.project_root),
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
        start_new_session=True,
    )

    pid_file.write_text(str(proc.pid))
    console.print(f"[green]✓[/green] Daemon started (PID {proc.pid})")


@daemon.command("stop")
def daemon_stop() -> None:
    """Stop the background daemon."""
    config = GhostConfig.load()
    pid_file = config.ghost_dir / "daemon.pid"

    if not pid_file.exists():
        console.print("[dim]No daemon running.[/dim]")
        return

    pid = int(pid_file.read_text().strip())
    try:
        os.kill(pid, 9)
        console.print(f"[green]✓[/green] Daemon stopped (PID {pid})")
    except ProcessLookupError:
        console.print("[dim]Daemon was not running.[/dim]")
    finally:
        pid_file.unlink(missing_ok=True)


# ──────────────────────────────────────────────────────────────
# ghostpm milestone add|list
# ──────────────────────────────────────────────────────────────


@cli.group()
def milestone() -> None:
    """Manage hackathon milestones."""
    pass


@milestone.command("add")
@click.argument("name")
@click.option("--description", "-d", default="", help="Milestone description")
@click.option("--files", "-f", multiple=True, help="Expected files/dirs")
def milestone_add(name: str, description: str, files: tuple) -> None:
    """Add a milestone to the current room."""
    config = GhostConfig.load()
    
    if not config.state_path.exists():
        console.print("[yellow]Not connected. Run 'ghostpm create' or 'ghostpm join'.[/yellow]")
        return

    state = ProjectState.load(config.state_path)
    next_index = len(state.milestones) + 1
    is_first = next_index == 1

    if config.has_supabase:
        try:
            from ghost_pm.sync.client import GhostSyncClient
            sync = GhostSyncClient(config)
            result = sync.create_milestones([{
                "room_id": state.room_id,
                "name": name,
                "description": description,
                "order_index": next_index,
                "status": "active" if is_first else "pending",
                "files_expected": list(files),
            }])
            if result:
                ms = MilestoneState(
                    id=result[0].get("id", next_index),
                    name=name,
                    description=description,
                    order_index=next_index,
                    status="active" if is_first else "pending",
                    files_expected=list(files),
                )
                state.milestones.append(ms)
                if is_first:
                    state.active_milestone_id = ms.id
                state.increment_version()
                state.save(config.state_path)
                console.print(f"[green]✓[/green] Added milestone: [bold]{name}[/bold] (#{next_index})")
        except Exception as e:
            console.print(f"[red]✗ Error: {e}[/red]")


@milestone.command("list")
def milestone_list() -> None:
    """List all milestones."""
    config = GhostConfig.load()
    
    if not config.state_path.exists():
        console.print("[yellow]Not connected.[/yellow]")
        return

    state = ProjectState.load(config.state_path)
    if not state.milestones:
        console.print("[dim]No milestones. Add with: ghostpm milestone add 'Name'[/dim]")
        return

    for ms in state.milestones:
        icon = "🟢" if ms.status == "completed" else "🔵" if ms.status == "active" else "⚪"
        console.print(f"  {icon} #{ms.order_index} {ms.name} — {ms.status} ({ms.progress_percent:.0f}%)")


# ──────────────────────────────────────────────────────────────
# Entry point
# ──────────────────────────────────────────────────────────────

if __name__ == "__main__":
    cli()
