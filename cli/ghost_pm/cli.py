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
from rich.rule import Rule

from ghost_pm.config import GhostConfig, GHOST_UI_URL
from ghost_pm.state import (
    CodeGraphSummary,
    CommitSummary,
    MilestoneState,
    ProjectState,
    TeamMemberSnapshot,
)

console = Console()

# ── Premium Unicode chars ─────────────────────────────
BAR_FULL = "█"
BAR_LOW = "░"
DOT_ON = "●"
DOT_OFF = "○"
ARROW = "›"
CHECK = "✓"
CROSS = "✗"
SPARK = "*"
WARN = "!"
FIRE = "[HOT]"
CLOCK = "[TIME]"
ROCKET = ">>"
BRAIN = "[AI]"

# ── Premium ASCII art logo ────────────────────────────
GHOST_LOGO = """[bold cyan]
   ██████╗ ██╗  ██╗ ██████╗ ███████╗████████╗   ██████╗ ███╗   ███╗
  ██╔════╝ ██║  ██║██╔═══██╗██╔════╝╚══██╔══╝   ██╔══██╗████╗ ████║
  ██║  ███╗███████║██║   ██║███████╗   ██║█████╗ ██████╔╝██╔████╔██║
  ██║   ██║██╔══██║██║   ██║╚════██║   ██║╚════╝ ██╔═══╝ ██║╚██╔╝██║
  ╚██████╔╝██║  ██║╚██████╔╝███████║   ██║       ██║     ██║ ╚═╝ ██║
   ╚═════╝ ╚═╝  ╚═╝ ╚═════╝ ╚══════╝   ╚═╝       ╚═╝     ╚═╝     ╚═╝[/bold cyan]"""

# ── Compact ASCII banner (for quick commands) ────────
BANNER_SMALL = """[bold cyan]
  ╔══════════════════════════════════════╗
  ║  Ghost-PM  ·  Headless CLI Manager  ║
  ╚══════════════════════════════════════╝[/bold cyan]"""


def _progress_bar(percent: float, width: int = 20) -> str:
    """Premium Unicode progress bar."""
    filled = int(percent / 100 * width)
    empty = width - filled
    if percent >= 80:
        color = "green"
    elif percent >= 40:
        color = "yellow"
    else:
        color = "red"
    bar = f"[{color}]{BAR_FULL * filled}[/{color}][dim]{BAR_LOW * empty}[/dim]"
    return f"{bar} [bold]{percent:.0f}%[/bold]"


def _time_display(hours: float) -> str:
    """Premium time remaining display."""
    if hours < 1:
        mins = int(hours * 60)
        return f"[bold red]{FIRE} {mins}m remaining[/bold red]"
    elif hours < 3:
        return f"[bold red]{CLOCK} {hours:.1f}h remaining[/bold red]"
    elif hours < 8:
        return f"[yellow]{CLOCK} {hours:.1f}h remaining[/yellow]"
    else:
        return f"[green]{CLOCK} {hours:.1f}h remaining[/green]"


@click.group(invoke_without_command=True)
@click.version_option(version="2.0.1", prog_name="ghostpm")
@click.pass_context
def cli(ctx: click.Context) -> None:
    """Ghost-PM — AI-Powered CLI Project Manager for Hackathons."""
    if ctx.invoked_subcommand is None:
        console.print(GHOST_LOGO)
        console.print()
        console.print(
            f"  [dim]v2.0.1[/dim]  {ARROW}  "
            f"[bold]AI-Powered CLI Project Manager for Hackathons[/bold]"
        )
        console.print(Rule(style="cyan"))
        console.print()
        console.print(Panel(
            f"  [bold cyan]Get Started[/bold cyan]\n"
            f"    1. Visit the web dashboard to create a team\n"
            f"    2. Run: [bold]ghostpm join <team_code>[/bold]\n"
            f"    3. You're in! Use [bold]/help[/bold] for commands.",
            expand=False, border_style="cyan", padding=(1, 2)
        ))
        console.print()
        console.print("  [bold]Commands:[/bold]")
        console.print(f"    [cyan]login[/cyan]     — Authenticate with email/password")
        console.print(f"    [cyan]signup[/cyan]    — Create a new account")
        console.print(f"    [cyan]join[/cyan]      — Join a team & enter interactive mode")
        console.print(f"    [cyan]status[/cyan]    — Quick project status check")
        console.print(f"    [cyan]watch[/cyan]     — Live auto-refreshing dashboard")
        console.print()


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
                console.print(f"  [green]{CHECK}[/green] Logged in as [bold]{config.member_name}[/bold]")
            else:
                console.print(f"  [red]{CROSS}[/red] Login failed.")
        except Exception as e:
            console.print(f"  [red]{CROSS}[/red] Login error: {e}")
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

    # ── Premium welcome ──
    console.print(GHOST_LOGO)
    console.print()
    console.print(
        f"  [dim]v2.0.1[/dim]  {ARROW}  "
        f"[bold]AI-Powered CLI Project Manager for Hackathons[/bold]"
    )
    console.print(Rule(style="cyan"))

    # ── Step 1: Authenticate ──
    from ghost_pm.auth import ensure_authenticated

    if not config.has_auth:
        console.print()
        console.print(Panel(
            f"  {ROCKET} [bold]Welcome to Ghost-PM![/bold]\n\n"
            f"  You need an account to join a team.\n"
            f"  Sign up at [cyan]{config.ui_url}[/cyan] or create one below.",
            expand=False, border_style="cyan", padding=(1, 2),
        ))

    config = ensure_authenticated(config)
    if not config:
        console.print(f"  [red]{CROSS}[/red] Authentication required to join a team.")
        return

    console.print(
        f"  [green]{CHECK}[/green] Authenticated as [bold]{config.member_name}[/bold]"
    )

    if name:
        config.member_name = name

    console.print()

    # ── Step 2: Resolve team_code → team ──
    import time as _time

    steps = [
        (f"{SPARK} Connecting to team [bold]{team_code}[/bold]...", 0.3),
        (f"{SPARK} Resolving team via secure RPC...", 0.2),
    ]
    for msg, delay in steps:
        console.print(f"  [dim]{msg}[/dim]")
        _time.sleep(delay)

    from ghost_pm.sync.client import GhostSyncClient
    sync = GhostSyncClient(config)

    team = sync.get_team_by_code(team_code.upper().strip())
    if not team:
        console.print()
        console.print(Panel(
            f"  [red]{CROSS} Team '[bold]{team_code}[/bold]' not found.[/red]\n\n"
            f"  Make sure you have the correct code from the web dashboard.\n"
            f"  Create a new team at: [cyan]{config.ui_url}[/cyan]",
            expand=False, border_style="red", title="[red]Team Not Found[/red]",
            padding=(1, 2),
        ))
        return

    team_id = team["id"]
    config.team_id = team_id
    config.team_code = team.get("team_code", team_code)
    console.print(
        f"  [green]{CHECK}[/green] Found team: "
        f"[bold]{team.get('name', team_code)}[/bold] "
        f"[dim]({config.team_code})[/dim]"
    )

    # ── Step 3: Register as member ──
    console.print(f"  [dim]{SPARK} Registering as team member...[/dim]")
    _time.sleep(0.2)
    member = sync.join_team(team_id, config.user_id, config.member_name)
    if member:
        console.print(
            f"  [green]{CHECK}[/green] Registered as [bold]{config.member_name}[/bold]"
        )
    else:
        console.print(f"  [yellow]{WARN}[/yellow] Could not register. Continuing in offline mode.")

    # ── Step 4: Setup local project ──
    console.print(f"  [dim]{SPARK} Setting up local project...[/dim]")
    _time.sleep(0.2)
    config.ghost_dir.mkdir(parents=True, exist_ok=True)
    config.save_ghost_config()
    console.print(f"  [green]{CHECK}[/green] Config saved to [dim].ghost/config.json[/dim]")

    _ensure_git_repo()
    _ensure_gitignore()

    # ── Step 5: Build initial state ──
    console.print(f"  [dim]{SPARK} Building project state...[/dim]")
    _time.sleep(0.2)
    state = _build_initial_state(config, team, sync)
    state.save(config.state_path)
    console.print(f"  [green]{CHECK}[/green] Project state initialized")

    # Run initial graph analysis
    console.print(f"  [dim]{SPARK} Analyzing codebase with graphify...[/dim]")
    _run_initial_graph(config, state, sync, team_id, config.member_name)
    
    # Save again after graph is built
    state.save(config.state_path)

    # Install git hooks
    _install_hooks_if_git()

    # ── Step 6: Start daemon ──
    console.print(f"  [dim]{SPARK} Starting background daemon...[/dim]")
    _time.sleep(0.2)
    _start_daemon_background(config)

    # ── Step 7: Summary panel ──
    state.update_hours_remaining()
    state.compute_overall_progress()
    hours = state.hours_remaining
    team_count = len([m for m in state.team if m.is_online])
    progress = state.overall_progress_percent

    console.print()
    console.print(Rule(characters="─", style="cyan"))
    console.print()

    info_lines = [
        f"  [bold]Project[/bold]    {team.get('name', config.team_code)}",
        f"  [bold]Team Code[/bold]  [cyan]{config.team_code}[/cyan]",
        f"  [bold]You[/bold]        {config.member_name}",
        f"  [bold]Online[/bold]     [green]{team_count}[/green] member{'s' if team_count != 1 else ''}",
        f"  [bold]Time[/bold]       {_time_display(hours)}",
        f"  [bold]Progress[/bold]   {_progress_bar(progress, 20)}",
    ]

    console.print(Panel(
        "\n".join(info_lines),
        border_style="cyan",
        title="[bold cyan]🚀 Ready to Build[/bold cyan]",
        subtitle="[dim]Type [bold]/help[/bold] for commands  ·  [bold]@ai[/bold] to chat with AI[/dim]",
        expand=False,
        padding=(1, 2),
    ))
    console.print()

    # ── Step 8: Enter REPL ──
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
        console.print(f"  [yellow]{WARN}[/yellow] Not connected to a team yet.")
        console.print(f"  Join one:  [bold]ghostpm join <team_code>[/bold]")
        console.print(f"  Create at: [bold]{config.ui_url}[/bold]")
        return

    state = ProjectState.load(config.state_path)
    state.update_hours_remaining()
    state.compute_overall_progress()

    hours = state.hours_remaining
    progress = state.overall_progress_percent

    # Header
    console.print()
    console.print(Panel(
        f"[bold]{state.project_name or 'Ghost-PM'}[/bold]\n"
        f"  Team: [cyan]{config.team_code}[/cyan]  {ARROW}  "
        f"{_time_display(hours)}\n"
        f"  Progress: {_progress_bar(progress, 25)}",
        expand=False, border_style="cyan",
    ))

    # Milestones
    if state.milestones:
        table = Table(show_header=True, header_style="bold", border_style="dim", show_lines=False)
        table.add_column("", width=2)
        table.add_column("Milestone", style="bold")
        table.add_column("Status")
        table.add_column("Progress")
        table.add_column("Commits", justify="right")

        for ms in state.milestones:
            if ms.status == "completed":
                icon, style = f"[green]{CHECK}[/green]", "green"
            elif ms.status == "active":
                icon, style = f"[cyan]{ARROW}[/cyan]", "cyan"
            else:
                icon, style = f"[dim]{DOT_OFF}[/dim]", "dim"
            table.add_row(icon, ms.name, f"[{style}]{ms.status}[/{style}]", _progress_bar(ms.progress_percent, 12), str(ms.commit_count))
        console.print(table)

    # Code graph
    graph = state.code_graph
    if graph.total_nodes > 0:
        console.print(
            f"\n  [bold]Code Graph[/bold]  {ARROW}  "
            f"{graph.total_nodes} nodes, {graph.total_edges} edges, "
            f"{graph.total_functions} functions, {graph.total_files} files"
        )
        if graph.god_nodes:
            names = ", ".join(f"[yellow]{gn.name}[/yellow]" for gn in graph.god_nodes[:3])
            console.print(f"  [yellow]{WARN} God Nodes:[/yellow] {names}")

    # Team
    if state.team:
        console.print(f"\n  [bold]Team[/bold]")
        for m in state.team:
            dot = f"[green]{DOT_ON}[/green]" if m.is_online else f"[red]{DOT_OFF}[/red]"
            file_info = m.current_file if m.current_file else "[dim]idle[/dim]"
            console.print(f"   {dot} [bold]{m.member_name}[/bold]  {ARROW}  {file_info}")

    # Footer
    console.print()
    console.print(
        f"  Commits: [bold]{state.total_commits}[/bold]  {ARROW}  "
        f"v{state.state_version}  {ARROW}  "
        f"[dim]ghostpm join {config.team_code} for interactive mode[/dim]"
    )
    console.print()


# ──────────────────────────────────────────────────────────────
# ghostpm watch
# ──────────────────────────────────────────────────────────────


@cli.command()
@click.option("--interval", "-i", default=3, help="Refresh interval in seconds")
def watch(interval: int) -> None:
    """Live dashboard — auto-refreshes. Press Ctrl+C to stop."""
    config = GhostConfig.load()

    if not config.state_path.exists():
        console.print(f"  [yellow]{WARN}[/yellow] Not connected to a team yet.")
        return

    from rich.live import Live

    def build_display() -> Table:
        state = ProjectState.load(config.state_path)
        state.update_hours_remaining()
        state.compute_overall_progress()

        hours = state.hours_remaining
        progress = state.overall_progress_percent

        outer = Table.grid(padding=(1, 0))
        outer.add_row(
            f"[bold cyan]Ghost-PM[/bold cyan]  {ARROW}  "
            f"Team: [cyan]{config.team_code}[/cyan]  {ARROW}  "
            f"{_time_display(hours)}  {ARROW}  "
            f"{_progress_bar(progress, 15)}  {ARROW}  "
            f"[dim]{datetime.now().strftime('%H:%M:%S')}[/dim]"
        )

        # Milestones
        if state.milestones:
            ms_table = Table(show_header=True, header_style="bold", border_style="dim", expand=True)
            ms_table.add_column("", width=2)
            ms_table.add_column("Phase", style="bold")
            ms_table.add_column("Status")
            ms_table.add_column("Progress")
            ms_table.add_column("Commits", justify="right")

            for ms in state.milestones:
                if ms.status == "completed":
                    icon, style = f"[green]{CHECK}[/green]", "green"
                elif ms.status == "active":
                    icon, style = f"[cyan]{ARROW}[/cyan]", "cyan"
                else:
                    icon, style = f"[dim]{DOT_OFF}[/dim]", "dim"
                ms_table.add_row(icon, ms.name, f"[{style}]{ms.status}[/{style}]", _progress_bar(ms.progress_percent, 12), str(ms.commit_count))
            outer.add_row(ms_table)

        # Team
        if state.team:
            team_table = Table(show_header=True, header_style="bold", border_style="dim", expand=True)
            team_table.add_column("", width=2)
            team_table.add_column("Member", style="bold")
            team_table.add_column("Working On")
            team_table.add_column("Idle", justify="right")
            team_table.add_column("Commits", justify="right")

            for m in state.team:
                dot = f"[green]{DOT_ON}[/green]" if m.is_online else f"[red]{DOT_OFF}[/red]"
                idle_str = f"{m.idle_minutes}m" if m.idle_minutes > 0 else "—"
                team_table.add_row(dot, m.member_name, m.current_file or "[dim]—[/dim]", idle_str, str(m.total_commits))
            outer.add_row(team_table)

        outer.add_row(f"[dim]Press Ctrl+C to stop  {ARROW}  Refreshing every {interval}s[/dim]")
        return outer

    try:
        with Live(build_display(), console=console, refresh_per_second=1, screen=True) as live:
            while True:
                time.sleep(interval)
                live.update(build_display())
    except KeyboardInterrupt:
        console.print(f"\n  [dim]{ARROW} Watch stopped.[/dim]")


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
            console.print(f"  [yellow]{WARN}[/yellow] Daemon already running (PID {pid})")
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
        console.print("  [dim]No daemon running.[/dim]")
        return

    try:
        pid = int(pid_file.read_text().strip())
        os.kill(pid, 15)  # SIGTERM
        pid_file.unlink(missing_ok=True)
        console.print(f"  [green]{CHECK}[/green] Daemon stopped (PID {pid})")
    except (ProcessLookupError, ValueError):
        pid_file.unlink(missing_ok=True)
        console.print("  [dim]Daemon was not running.[/dim]")


# ──────────────────────────────────────────────────────────────
# Helpers
# ──────────────────────────────────────────────────────────────


def _ensure_git_repo() -> None:
    """Initialize a git repo if one doesn't exist."""
    if not (Path.cwd() / ".git").is_dir():
        console.print(f"  [dim]{SPARK} Initializing git repository...[/dim]")
        subprocess.run(["git", "init"], capture_output=True, cwd=str(Path.cwd()))
        console.print(f"  [green]{CHECK}[/green] Git repository initialized")


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

        sync.push_graph_snapshot(team_id, member_name, summary)
        console.print(
            f"  [green]{CHECK}[/green] Code graph: "
            f"{summary.total_nodes} nodes, "
            f"{summary.total_functions} functions, "
            f"{summary.total_files} files"
        )
    except Exception as e:
        console.print(f"  [dim]Graph analysis skipped: {e}[/dim]")


def _build_initial_state(config, team, sync) -> ProjectState:
    """Build the initial ProjectState from Supabase team data."""
    team_id = team["id"]

    problem = sync.get_problem_statement(team_id)

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
            console.print(f"  [green]{CHECK}[/green] Git hooks installed")
        except Exception as e:
            console.print(f"  [dim]Hooks skipped: {e}[/dim]")


def _start_daemon_background(config: GhostConfig) -> None:
    """Start the daemon as a background process."""
    pid_file = config.ghost_dir / "daemon.pid"

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
        console.print(f"  [green]{CHECK}[/green] Daemon started (PID {process.pid})")
    except Exception as e:
        console.print(f"  [dim]Daemon start failed: {e}[/dim]")


# ──────────────────────────────────────────────────────────────
# Entry point
# ──────────────────────────────────────────────────────────────

if __name__ == "__main__":
    cli()
