"""Ghost-PM CLI — Entry Point.

The main CLI interface for Ghost-PM v2.
Users interact through three main commands:
  ghostpm join <team_code>  — Join a team and enter interactive mode
  ghostpm login             — Authenticate with Supabase
  ghostpm status            — Quick one-shot status check

All other interactions happen inside the interactive REPL.
"""

from __future__ import annotations

import os
import subprocess
import sys
import time
from datetime import datetime, timedelta
from pathlib import Path

import click
from rich.console import Console
from rich.panel import Panel
from rich.table import Table

from ghost_pm.config import GhostConfig, GHOST_UI_URL
from ghost_pm.state import (
    CodeGraphSummary,
    CommitSummary,
    MilestoneState,
    ProjectState,
    TeamMemberSnapshot,
)

console = Console()


@click.group()
@click.version_option(version="2.0.0", prog_name="ghostpm")
def cli() -> None:
    """Ghost-PM — Headless CLI Project Manager for Hackathons.

    Get started:
      1. Visit the web dashboard to create a team
      2. Run: ghostpm join <team_code>
      3. You're in! Use /help for commands.
    """
    pass


# ──────────────────────────────────────────────────────────────
# ghostpm login
# ──────────────────────────────────────────────────────────────


@cli.command()
@click.option("--email", "-e", help="Email address")
def login(email: str | None) -> None:
    """Authenticate with Ghost-PM (Supabase Auth)."""
    config = GhostConfig.load()

    from ghost_pm.auth import login_with_email, ensure_authenticated

    if email:
        # Direct email login
        import getpass
        password = getpass.getpass("Password: ")
        from supabase import create_client
        client = create_client(config.supabase_url, config.supabase_key)
        try:
            result = client.auth.sign_in_with_password({"email": email, "password": password})
            if result.user:
                config.access_token = result.session.access_token
                config.refresh_token = result.session.refresh_token
                config.user_id = result.user.id
                meta = result.user.user_metadata or {}
                config.member_name = meta.get("full_name", email.split("@")[0])
                config.save_ghost_config()
                console.print(f"[green]Logged in as {config.member_name}[/green]")
            else:
                console.print("[red]Login failed.[/red]")
        except Exception as e:
            console.print(f"[red]Login error: {e}[/red]")
    else:
        ensure_authenticated(config)


@cli.command()
def signup() -> None:
    """Create a new Ghost-PM account."""
    config = GhostConfig.load()

    from ghost_pm.auth import signup_with_email
    signup_with_email(config)


# ──────────────────────────────────────────────────────────────
# ghostpm join <team_code>  — THE MAIN ENTRY POINT
# ──────────────────────────────────────────────────────────────


@cli.command()
@click.argument("team_code")
@click.option("--name", "-n", help="Your display name")
def join(team_code: str, name: str | None) -> None:
    """Join a hackathon team and enter interactive mode.

    TEAM_CODE is the code shown on the web dashboard (e.g. ABC123).
    """
    config = GhostConfig.load()

    # ── Step 1: Authenticate ──
    from ghost_pm.auth import ensure_authenticated

    if not config.has_auth:
        console.print()
        console.print(Panel(
            "[bold]Welcome to Ghost-PM[/bold]\n\n"
            "You need an account to join a team.\n"
            f"Sign up at [cyan]{config.ui_url}[/cyan] or create one here.",
            expand=False,
        ))
        config = ensure_authenticated(config)
        if not config:
            console.print("[red]Authentication required to join a team.[/red]")
            return

    # Override name if provided
    if name:
        config.member_name = name

    # ── Step 2: Resolve team_code → team ──
    console.print(f"[dim]Connecting to team {team_code}...[/dim]")

    from ghost_pm.sync.client import GhostSyncClient
    sync = GhostSyncClient(config)

    team = sync.get_team_by_code(team_code.upper().strip())
    if not team:
        console.print(f"[red]Team '{team_code}' not found.[/red]")
        console.print(f"[dim]Create a team at {config.ui_url}/dashboard[/dim]")
        return

    team_id = team["id"]
    config.team_id = team_id
    config.team_code = team.get("team_code", team_code)

    # ── Step 3: Register as member ──
    member = sync.join_team(team_id, config.user_id, config.member_name)
    if member:
        console.print(f"[green]Joined team: {team.get('name', team_code)}[/green]")
    else:
        console.print("[yellow]Could not register. Continuing in offline mode.[/yellow]")

    # ── Step 4: Setup local project ──
    config.ghost_dir.mkdir(parents=True, exist_ok=True)
    config.save_ghost_config()

    # Initialize git if needed
    _ensure_git_repo()
    _ensure_gitignore()

    # ── Step 5: Build initial state ──
    state = _build_initial_state(config, team, sync)
    state.save(config.state_path)

    # Run initial graph analysis
    _run_initial_graph(config, state, sync, team_id, config.member_name)

    # Install git hooks
    _install_hooks_if_git()

    # ── Step 6: Start daemon ──
    _start_daemon_background(config)

    # ── Step 7: Enter REPL ──
    from ghost_pm.repl import GhostREPL
    repl = GhostREPL(config)
    repl.start()


# ──────────────────────────────────────────────────────────────
# ghostpm status (one-shot, for quick checks)
# ──────────────────────────────────────────────────────────────


@cli.command()
def status() -> None:
    """Quick one-shot status check (without entering interactive mode)."""
    config = GhostConfig.load()

    if not config.state_path.exists():
        console.print("[yellow]Not connected to a team yet.[/yellow]")
        console.print(f"  Join one:  [bold]ghostpm join <team_code>[/bold]")
        console.print(f"  Create at: [bold]{config.ui_url}[/bold]")
        return

    state = ProjectState.load(config.state_path)
    state.update_hours_remaining()

    # Header
    hours = state.hours_remaining
    time_color = "red" if hours < 2 else "yellow" if hours < 6 else "green"
    console.print(Panel(
        f"[bold]{state.project_name or 'Ghost-PM'}[/bold]  |  "
        f"Team: [cyan]{config.team_code}[/cyan]  |  "
        f"[{time_color}]{hours:.1f}h remaining[/{time_color}]",
        expand=False,
    ))

    # Milestones
    if state.milestones:
        ms_table = Table(title="Milestones", show_lines=True)
        ms_table.add_column("", width=3)
        ms_table.add_column("Milestone", style="bold")
        ms_table.add_column("Status")
        ms_table.add_column("Progress")
        ms_table.add_column("Commits", justify="right")

        for ms in state.milestones:
            icon = ">" if ms.status == "completed" else "~" if ms.status == "active" else " "
            style = "green" if ms.status == "completed" else "cyan" if ms.status == "active" else "dim"
            bar = _make_progress_bar(ms.progress_percent)
            ms_table.add_row(icon, ms.name, f"[{style}]{ms.status}[/{style}]", bar, str(ms.commit_count))
        console.print(ms_table)

    # Code graph
    graph = state.code_graph
    if graph.total_nodes > 0:
        console.print()
        graph_table = Table(title="Code Graph", show_lines=True)
        graph_table.add_column("Metric", style="bold")
        graph_table.add_column("Value", justify="right")
        graph_table.add_row("Nodes", str(graph.total_nodes))
        graph_table.add_row("Edges", str(graph.total_edges))
        graph_table.add_row("Functions", str(graph.total_functions))
        graph_table.add_row("Files", str(graph.total_files))
        if graph.god_nodes:
            graph_table.add_row("God Nodes", str(len(graph.god_nodes)))
        for sn, cnt in graph.function_statuses.items():
            if cnt > 0:
                graph_table.add_row(f"  {sn}", str(cnt))
        console.print(graph_table)

    # Team
    if state.team:
        console.print()
        team_table = Table(title="Team", show_lines=True)
        team_table.add_column("Member", style="bold")
        team_table.add_column("Status")
        team_table.add_column("Working On")
        team_table.add_column("Commits", justify="right")

        for m in state.team:
            online = "online" if m.is_online else "offline"
            team_table.add_row(m.member_name, online, m.current_file or "--", str(m.total_commits))
        console.print(team_table)

    # Footer
    console.print()
    state.compute_overall_progress()
    console.print(
        f"  Commits: [bold]{state.total_commits}[/bold]  |  "
        f"Progress: [bold]{state.overall_progress_percent:.0f}%[/bold]  |  "
        f"v{state.state_version}"
    )
    console.print()
    console.print("[dim]For interactive mode: ghostpm join <team_code>[/dim]")


# ──────────────────────────────────────────────────────────────
# ghostpm watch
# ──────────────────────────────────────────────────────────────


@cli.command()
@click.option("--interval", "-i", default=3, help="Refresh interval in seconds")
def watch(interval: int) -> None:
    """Live dashboard — auto-refreshes. Press Ctrl+C to stop."""
    config = GhostConfig.load()

    if not config.state_path.exists():
        console.print("[yellow]Not connected to a team yet.[/yellow]")
        return

    from rich.live import Live

    def build_display() -> Table:
        state = ProjectState.load(config.state_path)
        state.update_hours_remaining()
        state.compute_overall_progress()

        hours = state.hours_remaining
        time_color = "red" if hours < 2 else "yellow" if hours < 6 else "green"

        outer = Table.grid(padding=(1, 0))
        outer.add_row(
            f"[bold]Ghost-PM[/bold]  |  "
            f"Team: [cyan]{config.team_code}[/cyan]  |  "
            f"[{time_color}]{hours:.1f}h[/{time_color}]  |  "
            f"Progress: [bold]{state.overall_progress_percent:.0f}%[/bold]  |  "
            f"v{state.state_version}  |  "
            f"[dim]{datetime.now().strftime('%H:%M:%S')}[/dim]"
        )

        # Milestones
        if state.milestones:
            ms_table = Table(title="Milestones", show_lines=True, expand=True)
            ms_table.add_column("", width=3)
            ms_table.add_column("Milestone", style="bold")
            ms_table.add_column("Status")
            ms_table.add_column("Progress")
            ms_table.add_column("Commits", justify="right")

            for ms in state.milestones:
                icon = ">" if ms.status == "completed" else "~" if ms.status == "active" else " "
                style = "green" if ms.status == "completed" else "cyan" if ms.status == "active" else "dim"
                bar = _make_progress_bar(ms.progress_percent)
                ms_table.add_row(icon, ms.name, f"[{style}]{ms.status}[/{style}]", bar, str(ms.commit_count))
            outer.add_row(ms_table)

        # Team
        if state.team:
            team_table = Table(title="Team", show_lines=True, expand=True)
            team_table.add_column("Member", style="bold")
            team_table.add_column("Status")
            team_table.add_column("Working On")
            team_table.add_column("Idle", justify="right")
            team_table.add_column("Commits", justify="right")

            for m in state.team:
                online = "online" if m.is_online else "offline"
                idle = f"{m.idle_minutes}m" if m.idle_minutes > 0 else "--"
                team_table.add_row(m.member_name, online, m.current_file or "--", idle, str(m.total_commits))
            outer.add_row(team_table)

        outer.add_row("[dim]Ctrl+C to stop[/dim]")
        return outer

    try:
        with Live(build_display(), console=console, refresh_per_second=1, screen=True) as live:
            while True:
                time.sleep(interval)
                live.update(build_display())
    except KeyboardInterrupt:
        console.print("\n[dim]Watch stopped.[/dim]")


# ──────────────────────────────────────────────────────────────
# ghostpm daemon
# ──────────────────────────────────────────────────────────────


@cli.group()
def daemon() -> None:
    """Manage the background daemon."""
    pass


@daemon.command("start")
def daemon_start() -> None:
    """Start the background daemon."""
    config = GhostConfig.load()

    pid_file = config.ghost_dir / "daemon.pid"
    if pid_file.exists():
        pid = pid_file.read_text().strip()
        try:
            os.kill(int(pid), 0)
            console.print(f"[yellow]Daemon already running (PID {pid})[/yellow]")
            return
        except (ProcessLookupError, ValueError):
            pid_file.unlink(missing_ok=True)

    _start_daemon_background(config)


@daemon.command("stop")
def daemon_stop() -> None:
    """Stop the background daemon."""
    config = GhostConfig.load()
    pid_file = config.ghost_dir / "daemon.pid"

    if not pid_file.exists():
        console.print("[dim]No daemon running.[/dim]")
        return

    try:
        pid = int(pid_file.read_text().strip())
        os.kill(pid, 15)  # SIGTERM
        pid_file.unlink(missing_ok=True)
        console.print(f"[green]Daemon stopped (PID {pid})[/green]")
    except (ProcessLookupError, ValueError):
        pid_file.unlink(missing_ok=True)
        console.print("[dim]Daemon was not running.[/dim]")


# ──────────────────────────────────────────────────────────────
# Helpers
# ──────────────────────────────────────────────────────────────


def _ensure_git_repo() -> None:
    """Initialize a git repo if one doesn't exist."""
    if not (Path.cwd() / ".git").is_dir():
        console.print("[dim]Initializing git repository...[/dim]")
        subprocess.run(["git", "init"], capture_output=True, cwd=str(Path.cwd()))
        console.print("[green]Git repository initialized[/green]")


def _ensure_gitignore() -> None:
    """Ensure .gitignore has Ghost-PM entries."""
    gitignore = Path.cwd() / ".gitignore"
    needed = [".ghost/", "graphify-out/", "__pycache__/", "*.pyc"]

    existing = set()
    if gitignore.exists():
        existing = set(gitignore.read_text().strip().split("\n"))

    additions = [n for n in needed if n not in existing]
    if additions:
        with open(gitignore, "a") as f:
            for line in additions:
                f.write(f"\n{line}")


def _run_initial_graph(config, state, sync, team_id, member_name):
    """Run graphify to build the initial code graph."""
    try:
        from ghost_pm.graph_parser import GraphParser

        parser = GraphParser(
            project_root=config.project_root,
            ghost_dir=config.ghost_dir,
        )
        summary = parser.build_summary(run_graphify=True)
        state.code_graph = summary
        state.files = parser.build_file_records()

        # Push to cloud
        sync.push_graph_snapshot(team_id, member_name, summary)
        console.print(
            f"[green]Code graph:[/green] {summary.total_nodes} nodes, "
            f"{summary.total_functions} functions, {summary.total_files} files"
        )
    except Exception as e:
        console.print(f"[dim]Graph analysis skipped: {e}[/dim]")


def _build_initial_state(config, team, sync) -> ProjectState:
    """Build the initial ProjectState from Supabase team data."""
    team_id = team["id"]

    # Get problem statement
    problem = sync.get_problem_statement(team_id)

    # Get roadmap and tasks
    roadmap = sync.get_roadmap(team_id)
    milestones = []
    if roadmap and roadmap.get("phases"):
        for i, phase in enumerate(roadmap["phases"]):
            milestones.append(MilestoneState(
                id=i + 1,
                name=phase.get("name", f"Phase {i + 1}"),
                description=phase.get("description", ""),
                order_index=i,
                status="active" if i == 0 else "pending",
            ))

    # Get tasks for progress tracking
    tasks = sync.get_roadmap_tasks(team_id)
    if tasks and milestones:
        for task in tasks:
            phase_idx = task.get("phase_index", 0)
            if phase_idx < len(milestones):
                ms = milestones[phase_idx]
                ms.functions_expected += 1
                if task.get("status") == "done":
                    ms.functions_implemented += 1
                    ms.progress_percent = (
                        ms.functions_implemented / max(ms.functions_expected, 1) * 100
                    )

    # Get members
    members_data = sync.get_members(team_id)
    team_members = []
    for m in members_data:
        team_members.append(TeamMemberSnapshot(
            member_name=m.get("member_name", m.get("user_id", "unknown")),
            is_online=m.get("is_online", False),
            current_file=m.get("current_file", ""),
            idle_minutes=m.get("idle_minutes", 0),
            total_commits=m.get("total_commits", 0),
        ))

    # Parse times
    now = datetime.now()

    def parse_dt(val, fallback):
        if val is None:
            return fallback
        if isinstance(val, datetime):
            return val
        try:
            dt = datetime.fromisoformat(str(val))
            if dt.tzinfo is not None:
                dt = dt.replace(tzinfo=None)
            return dt
        except (ValueError, TypeError):
            return fallback

    duration_hours = team.get("duration_hours") or 24

    return ProjectState(
        room_id=config.team_code,
        project_name=team.get("name", ""),
        description=(problem or {}).get("description", team.get("hackathon_format", "")),
        tech_stack=[],
        hackathon_start=parse_dt(team.get("created_at"), now),
        hackathon_end=parse_dt(team.get("created_at"), now) + timedelta(hours=float(duration_hours)),
        milestones=milestones,
        active_milestone_id=1 if milestones else None,
        team=team_members,
    )


def _install_hooks_if_git() -> None:
    """Install git hooks if we're in a git repository."""
    git_dir = Path.cwd() / ".git"
    if git_dir.is_dir():
        try:
            from ghost_pm.hooks.installer import install_hooks
            install_hooks(Path.cwd())
            console.print("[green]Git hooks installed[/green]")
        except Exception as e:
            console.print(f"[dim]Hooks skipped: {e}[/dim]")


def _start_daemon_background(config: GhostConfig) -> None:
    """Start the daemon as a background process."""
    pid_file = config.ghost_dir / "daemon.pid"

    # Check if already running
    if pid_file.exists():
        try:
            pid = int(pid_file.read_text().strip())
            os.kill(pid, 0)
            return  # Already running
        except (ProcessLookupError, ValueError):
            pid_file.unlink(missing_ok=True)

    try:
        process = subprocess.Popen(
            [sys.executable, "-m", "ghost_pm.daemon"],
            cwd=str(config.project_root),
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
            start_new_session=True,
        )
        console.print(f"[green]Daemon started (PID {process.pid})[/green]")
    except Exception as e:
        console.print(f"[dim]Daemon start failed: {e}[/dim]")


def _make_progress_bar(percent: float) -> str:
    """Render a compact progress bar."""
    filled = int(percent / 5)
    empty = 20 - filled
    return f"{'#' * filled}{'.' * empty} {percent:.0f}%"


# ──────────────────────────────────────────────────────────────
# Entry point
# ──────────────────────────────────────────────────────────────

if __name__ == "__main__":
    cli()
