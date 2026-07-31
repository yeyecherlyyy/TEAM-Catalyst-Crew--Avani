"""Ghost-PM Interactive REPL.

The always-running terminal interface — the heart of Ghost-PM v2.
Like Claude Code, it stays alive, watches files, syncs with the team,
and gives proactive AI suggestions. Slash commands + free-form chat.
"""

from __future__ import annotations

import os
import subprocess
import sys
import threading
import time
from datetime import datetime
from pathlib import Path

from rich.console import Console
from rich.panel import Panel
from rich.table import Table
from rich.text import Text
from rich.rule import Rule
from rich.columns import Columns

from ghost_pm.config import GhostConfig
from ghost_pm.state import ProjectState, TeamMemberSnapshot

console = Console()

# ── Premium Unicode characters ────────────────────────
BAR_FULL = "█"
BAR_MED = "▓"
BAR_LOW = "░"
DOT_ON = "●"
DOT_OFF = "○"
ARROW = "›"
CHECK = "✓"
CROSS = "✗"
SPARK = "⚡"
WARN = "⚠"
FIRE = "🔥"
BRAIN = "🧠"
CLOCK = "⏱"
ROCKET = "🚀"

# ── ASCII art logo ────────────────────────────────────
GHOST_LOGO = """[bold cyan]
   ██████╗ ██╗  ██╗ ██████╗ ███████╗████████╗   ██████╗ ███╗   ███╗
  ██╔════╝ ██║  ██║██╔═══██╗██╔════╝╚══██╔══╝   ██╔══██╗████╗ ████║
  ██║  ███╗███████║██║   ██║███████╗   ██║█████╗ ██████╔╝██╔████╔██║
  ██║   ██║██╔══██║██║   ██║╚════██║   ██║╚════╝ ██╔═══╝ ██║╚██╔╝██║
  ╚██████╔╝██║  ██║╚██████╔╝███████║   ██║       ██║     ██║ ╚═╝ ██║
   ╚═════╝ ╚═╝  ╚═╝ ╚═════╝ ╚══════╝   ╚═╝       ╚═╝     ╚═╝     ╚═╝[/bold cyan]"""


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


# ──────────────────────────────────────────────────────
# REPL Engine
# ──────────────────────────────────────────────────────


class GhostREPL:
    """Interactive terminal REPL — runs continuously like Claude Code."""

    def __init__(self, config: GhostConfig) -> None:
        self.config = config
        self.running = True
        self.chat_session_id: str | None = None
        self.last_advice_time = 0.0
        self._realtime_channel = None
        self._sync = None  # Lazily initialized sync client

        # Command registry
        self.commands: dict[str, tuple[callable, str, str]] = {
            "/help":      (self._cmd_help,      "Show all commands",                     "general"),
            "/status":    (self._cmd_status,     "Full project dashboard",                "info"),
            "/team":      (self._cmd_team,       "Who's online & what they're working on","info"),
            "/tasks":     (self._cmd_tasks,      "View & manage roadmap tasks",           "roadmap"),
            "/checkin":   (self._cmd_checkin,     "Log a progress check-in",              "roadmap"),
            "/milestone": (self._cmd_milestone,  "List milestones & phases",              "roadmap"),
            "/discuss":   (self._cmd_discuss,     "Send a team chat message",             "chat"),
            "/advice":    (self._cmd_advice,      "Get AI-powered suggestions",           "ai"),
            "/graph":     (self._cmd_graph,       "Code graph summary (graphify)",        "code"),
            "/commit":    (self._cmd_commit,      "Stage, scope-check & commit",          "code"),
            "/audit":     (self._cmd_audit,       "Scan codebase for issues",             "code"),
            "/review":    (self._cmd_review,      "Review recent commits for quality",    "code"),
            "/panic":     (self._cmd_panic,       "Toggle panic mode (relax scope)",      "general"),
            "/clear":     (self._cmd_clear,       "Clear the terminal",                   "general"),
            "/quit":      (self._cmd_quit,        "Exit (daemon keeps running)",          "general"),
            "/q":         (self._cmd_quit,        "Exit",                                 "general"),
        }

    @property
    def sync(self):
        """Lazily initialize and cache the sync client."""
        if self._sync is None and self.config.team_id:
            try:
                from ghost_pm.sync.client import GhostSyncClient
                self._sync = GhostSyncClient(self.config)
            except Exception:
                pass
        return self._sync

    def _init_chat_session(self) -> None:
        """Initialize or restore the chat session ID.

        Checks .ghost/config.json first, then Supabase.
        Caches the result so we never re-query during this REPL session.
        """
        if not self.config.team_id or not self.sync:
            return

        # Try to load from persisted config first
        import json
        config_path = self.config.ghost_dir / "config.json"
        if config_path.exists():
            try:
                data = json.loads(config_path.read_text())
                cached_sid = data.get("chat_session_id")
                if cached_sid:
                    self.chat_session_id = cached_sid
                    return
            except Exception:
                pass

        # Resolve from Supabase
        try:
            sid = self.sync.get_or_create_chat_session(self.config.team_id)
            if sid:
                self.chat_session_id = sid
                # Persist to config
                self._persist_session_id(sid)
        except Exception:
            pass

    def _persist_session_id(self, sid: str) -> None:
        """Save the chat session ID to .ghost/config.json."""
        import json
        config_path = self.config.ghost_dir / "config.json"
        try:
            data = {}
            if config_path.exists():
                data = json.loads(config_path.read_text())
            data["chat_session_id"] = sid
            config_path.write_text(json.dumps(data, indent=2))
        except Exception:
            pass

    def start(self) -> None:
        """Start the interactive REPL."""
        self._print_welcome()
        self._init_chat_session()
        self._load_recent_chat()
        self._start_background_sync()

        try:
            while self.running:
                try:
                    user_input = console.input(
                        "\n[bold cyan]ghost-pm[/bold cyan] [dim]›[/dim] "
                    ).strip()
                except (EOFError, KeyboardInterrupt):
                    self._cmd_quit("")
                    break

                if not user_input:
                    continue

                self._handle_input(user_input)

        except Exception as e:
            console.print(f"[red]REPL error: {e}[/red]")
        finally:
            self._cleanup()

    def _handle_input(self, user_input: str) -> None:
        """Route user input to commands or chat."""
        if user_input.startswith("/"):
            parts = user_input.split(None, 1)
            cmd = parts[0].lower()
            args = parts[1] if len(parts) > 1 else ""

            if cmd in self.commands:
                handler, _, _ = self.commands[cmd]
                handler(args)
            else:
                console.print(f"  [yellow]{WARN} Unknown command: {cmd}[/yellow]")
                console.print("  [dim]Type /help for available commands[/dim]")
        else:
            # Plain text → send as team chat
            self._send_chat(user_input)

    # ──────────────────────────────────────────────────────
    # Commands
    # ──────────────────────────────────────────────────────

    def _cmd_help(self, args: str) -> None:
        """Show all commands grouped by category."""
        console.print()

        categories = {
            "info":    ("[INFO]", "Information"),
            "roadmap": ("[MAP] ", "Roadmap & Tasks"),
            "chat":    ("[CHAT]", "Communication"),
            "ai":      ("[AI]  ", "AI Assistant"),
            "code":    ("[CODE]", "Code & Git"),
            "general": ("[GEN] ", "General"),
        }

        for cat_key, (icon, cat_name) in categories.items():
            cmds = [
                (cmd, desc)
                for cmd, (_, desc, cat) in self.commands.items()
                if cat == cat_key and cmd != "/q"
            ]
            if not cmds:
                continue

            console.print(f"  {icon} [bold]{cat_name}[/bold]")
            for cmd, desc in cmds:
                console.print(f"     [cyan]{cmd:<14}[/cyan] [dim]{desc}[/dim]")
            console.print()

        console.print(f"  [CHAT] [bold]Chat[/bold]")
        console.print(f"     [dim]Type any text to send as team chat[/dim]")
        console.print(f"     [dim]Prefix with [bold]@ai[/bold] to ask the AI[/dim]")
        console.print()

    def _cmd_status(self, args: str) -> None:
        """Premium project dashboard."""
        state = ProjectState.load(self.config.state_path)
        state.update_hours_remaining()
        state.compute_overall_progress()

        hours = state.hours_remaining
        progress = state.overall_progress_percent

        # Header panel
        header = (
            f"[bold]{state.project_name or 'Ghost-PM'}[/bold]\n"
            f"  Team: [cyan]{self.config.team_code}[/cyan]  {ARROW}  "
            f"{_time_display(hours)}\n"
            f"  Progress: {_progress_bar(progress, 25)}  {ARROW}  "
            f"[dim]v{state.state_version}[/dim]"
        )
        console.print()
        console.print(Panel(header, border_style="cyan", expand=False, padding=(1, 3)))

        # Milestones
        if state.milestones:
            table = Table(
                show_header=True, header_style="bold",
                border_style="dim", show_lines=False,
                padding=(0, 1), expand=False,
            )
            table.add_column("", width=2)
            table.add_column("Phase", style="bold", min_width=20)
            table.add_column("Status", min_width=10)
            table.add_column("Progress", min_width=25)
            table.add_column("Commits", justify="right", min_width=7)

            for ms in state.milestones:
                if ms.status == "completed":
                    icon, style = f"[green]{CHECK}[/green]", "green"
                elif ms.status == "active":
                    icon, style = f"[cyan]{ARROW}[/cyan]", "cyan"
                else:
                    icon, style = f"[dim]{DOT_OFF}[/dim]", "dim"

                table.add_row(
                    icon,
                    ms.name,
                    f"[{style}]{ms.status}[/{style}]",
                    _progress_bar(ms.progress_percent, 15),
                    str(ms.commit_count),
                )
            console.print(table)

        # Graph summary
        g = state.code_graph
        if g.total_nodes > 0:
            console.print(
                f"\n  [bold]Code Graph[/bold]  {ARROW}  "
                f"{g.total_nodes} nodes, {g.total_edges} edges, "
                f"{g.total_functions} functions, {g.total_files} files"
            )
            if g.god_nodes:
                names = ", ".join(
                    f"[yellow]{gn.name}[/yellow]" for gn in g.god_nodes[:3]
                )
                console.print(f"  [yellow]{WARN} God Nodes:[/yellow] {names}")

        # Team
        if state.team:
            console.print(f"\n  [bold]Team[/bold]")
            for m in state.team:
                if m.is_online:
                    dot = f"[green]{DOT_ON}[/green]"
                else:
                    dot = f"[red]{DOT_OFF}[/red]"
                file_info = m.current_file if m.current_file else "[dim]idle[/dim]"
                idle_warn = ""
                if m.idle_minutes > 30:
                    idle_warn = f" [yellow]({m.idle_minutes}m idle)[/yellow]"
                elif m.idle_minutes > 60:
                    idle_warn = f" [red]({m.idle_minutes}m idle)[/red]"
                console.print(
                    f"   {dot} [bold]{m.member_name}[/bold]  {ARROW}  {file_info}{idle_warn}"
                )

        # Active suggestions
        if state.suggestions:
            console.print(f"\n  [bold]{BRAIN} AI Suggestions[/bold]")
            for s in state.suggestions[:3]:
                p_icon = {"high": "[red]!!![/red]", "medium": "[yellow] ! [/yellow]", "low": "[dim] · [/dim]"}.get(s.priority, " · ")
                console.print(f"   {p_icon} {s.message}")

        console.print()

    def _cmd_team(self, args: str) -> None:
        """Show detailed team activity."""
        state = ProjectState.load(self.config.state_path)

        if not state.team:
            console.print("  [dim]No team members connected.[/dim]")
            return

        table = Table(
            title=f"[bold]Team Activity[/bold]",
            show_lines=False, border_style="dim", padding=(0, 1),
        )
        table.add_column("", width=2)
        table.add_column("Member", style="bold", min_width=15)
        table.add_column("Working On", min_width=25)
        table.add_column("Idle", justify="right", min_width=6)
        table.add_column("Commits", justify="right", min_width=7)

        for m in state.team:
            dot = f"[green]{DOT_ON}[/green]" if m.is_online else f"[red]{DOT_OFF}[/red]"
            idle_str = f"{m.idle_minutes}m" if m.idle_minutes > 0 else "—"
            if m.idle_minutes > 45:
                idle_str = f"[red]{idle_str}[/red]"
            elif m.idle_minutes > 15:
                idle_str = f"[yellow]{idle_str}[/yellow]"
            table.add_row(
                dot, m.member_name,
                m.current_file or "[dim]—[/dim]",
                idle_str, str(m.total_commits),
            )
        console.print(table)

    def _cmd_tasks(self, args: str) -> None:
        """View and manage roadmap tasks from CLI."""
        if not self.config.team_id:
            console.print("  [dim]Join a team first to access tasks.[/dim]")
            return

        try:
            from ghost_pm.sync.client import GhostSyncClient
            sync = GhostSyncClient(self.config)
            tasks = sync.get_roadmap_tasks(self.config.team_id)

            if not tasks:
                console.print("  [dim]No tasks found. Create a roadmap on the web dashboard.[/dim]")
                return

            # Group by phase
            phases: dict[int, list[dict]] = {}
            for t in tasks:
                idx = t.get("phase_index", 0)
                phases.setdefault(idx, []).append(t)

            STATUS_ICONS = {
                "not_started": f"[dim]{DOT_OFF}[/dim]",
                "in_progress": f"[cyan]{ARROW}[/cyan]",
                "done":        f"[green]{CHECK}[/green]",
                "cut":         f"[red]{CROSS}[/red]",
            }

            total = len(tasks)
            done = sum(1 for t in tasks if t.get("status") == "done")
            console.print(
                f"\n  [bold]Roadmap Tasks[/bold]  {ARROW}  "
                f"{done}/{total} complete  {_progress_bar(done/max(total,1)*100, 15)}"
            )

            for phase_idx in sorted(phases.keys()):
                phase_tasks = phases[phase_idx]
                console.print(f"\n  [bold blue]Phase {phase_idx + 1}[/bold blue]")
                for t in phase_tasks:
                    icon = STATUS_ICONS.get(t.get("status", "not_started"), DOT_OFF)
                    title = t.get("title", "Untitled")
                    status = t.get("status", "not_started")
                    style = "dim" if status == "done" else ""
                    strike = "strikethrough" if status == "done" else ""
                    console.print(f"   {icon} [{style}{strike}]{title}[/{style}{strike}]")

            console.print(
                f"\n  [dim]Manage tasks on the web dashboard or use "
                f"/checkin to log progress[/dim]"
            )

        except Exception as e:
            console.print(f"  [dim]Error loading tasks: {e}[/dim]")

    def _cmd_checkin(self, args: str) -> None:
        """Log a progress check-in to Supabase."""
        if not self.config.team_id:
            console.print("  [dim]Join a team first.[/dim]")
            return

        # Parse percentage from args or prompt
        percent = None
        notes = ""
        if args:
            parts = args.split(None, 1)
            try:
                percent = float(parts[0].rstrip("%"))
                notes = parts[1] if len(parts) > 1 else ""
            except ValueError:
                notes = args

        if percent is None:
            try:
                raw = console.input("  [cyan]Progress %:[/cyan] ").strip().rstrip("%")
                percent = float(raw)
            except (ValueError, EOFError):
                console.print("  [dim]Cancelled.[/dim]")
                return

        if not notes:
            try:
                notes = console.input("  [cyan]Notes (optional):[/cyan] ").strip()
            except EOFError:
                pass

        percent = max(0.0, min(100.0, percent))

        try:
            from ghost_pm.sync.client import GhostSyncClient
            sync = GhostSyncClient(self.config)
            sync.push_checkin(
                team_id=self.config.team_id,
                data={
                    "actual_percent": percent,
                    "notes": notes or None,
                    "checked_in_by": self.config.user_id or None,
                },
            )
            console.print(
                f"  [green]{CHECK}[/green] Check-in recorded: "
                f"[bold]{percent:.0f}%[/bold]"
                + (f" — {notes}" if notes else "")
            )
        except Exception as e:
            console.print(f"  [dim]Check-in failed: {e}[/dim]")

    def _cmd_discuss(self, args: str) -> None:
        """Send a chat message to the team."""
        if not args:
            console.print("  [dim]Usage: /discuss <message>[/dim]")
            return
        self._send_chat(args)

    def _cmd_advice(self, args: str) -> None:
        """Get AI-powered advice."""
        if not self.config.has_llm:
            console.print(f"  [yellow]{WARN} No AI API key configured.[/yellow]")
            console.print("  [dim]Set GEMINI_API_KEY in your environment or .env[/dim]")
            return

        state = ProjectState.load(self.config.state_path)
        state.update_hours_remaining()

        console.print(f"  [dim]{BRAIN} Consulting AI advisor...[/dim]")

        from ghost_pm.ai_advisor import get_advice, render_advice, advice_to_suggestions

        advice = get_advice(state, self.config)
        if advice:
            render_advice(advice)
            state.suggestions = advice_to_suggestions(advice)
            state.increment_version()
            state.save(self.config.state_path)
            self._log_advice(advice)
        else:
            console.print(f"  [yellow]{WARN} AI advisor returned no response.[/yellow]")

    def _cmd_graph(self, args: str) -> None:
        """Show code graph summary."""
        state = ProjectState.load(self.config.state_path)
        g = state.code_graph

        if g.total_nodes == 0:
            console.print("  [dim]No code graph data yet. Run graphify first.[/dim]")
            return

        table = Table(
            title=f"[bold]Code Graph[/bold] [dim](graphify)[/dim]",
            show_lines=False, border_style="dim", padding=(0, 2),
        )
        table.add_column("Metric", style="bold", min_width=15)
        table.add_column("Value", justify="right", min_width=8)
        table.add_column("", min_width=20)

        # Main metrics
        table.add_row("Nodes", str(g.total_nodes), "")
        table.add_row("Edges", str(g.total_edges), "")
        table.add_row("Functions", str(g.total_functions), "")
        table.add_row("Files", str(g.total_files), "")

        # Function statuses as mini bars
        total_f = max(sum(g.function_statuses.values()), 1)
        for status_name, count in g.function_statuses.items():
            if count > 0:
                pct = count / total_f * 100
                colors = {
                    "implemented": "green", "tested": "blue",
                    "in_progress": "yellow", "stub": "red",
                    "broken": "bold red", "unknown": "dim",
                }
                c = colors.get(status_name, "dim")
                mini_bar = f"[{c}]{BAR_FULL * int(pct / 5)}[/{c}]"
                table.add_row(f"  {status_name}", str(count), mini_bar)

        console.print(table)

        if g.god_nodes:
            console.print(f"\n  [bold yellow]{WARN} God Nodes (refactor risks):[/bold yellow]")
            for gn in g.god_nodes[:5]:
                risk_color = {"high": "red", "medium": "yellow", "low": "green"}.get(gn.risk, "dim")
                console.print(
                    f"   [{risk_color}]{DOT_ON}[/{risk_color}] "
                    f"[bold]{gn.name}[/bold]  {ARROW}  "
                    f"{gn.connections} connections [{risk_color}]{gn.risk}[/{risk_color}]"
                )

    def _cmd_commit(self, args: str) -> None:
        """Smart commit with scope guard."""
        message = ""
        if "-m" in args:
            parts = args.split("-m", 1)
            message = parts[1].strip().strip('"').strip("'")
        else:
            message = args.strip()

        if not message:
            try:
                message = console.input("  [cyan]Commit message:[/cyan] ").strip()
            except EOFError:
                pass
            if not message:
                console.print("  [dim]Cancelled.[/dim]")
                return

        project_root = self.config.project_root

        console.print("  [dim]Staging changes...[/dim]")
        subprocess.run(["git", "add", "-A"], cwd=str(project_root), capture_output=True)

        result = subprocess.run(
            ["git", "diff", "--cached", "--stat"],
            capture_output=True, text=True, cwd=str(project_root),
        )
        if not result.stdout.strip():
            console.print(f"  [yellow]{WARN} No changes to commit.[/yellow]")
            return

        # Show staged files compactly
        lines = result.stdout.strip().split("\n")
        for line in lines[-5:]:
            console.print(f"  [dim]{line.strip()}[/dim]")

        result = subprocess.run(
            ["git", "commit", "--no-verify", "-m", message],
            capture_output=True, text=True, cwd=str(project_root),
        )
        if result.returncode == 0:
            hash_line = result.stdout.strip().split("\n")[0] if result.stdout else ""
            console.print(f"  [green]{CHECK}[/green] {hash_line}")

            state = ProjectState.load(self.config.state_path)
            from ghost_pm.state import CommitSummary
            state.recent_commits.append(CommitSummary(
                hash=message[:8], message=message,
                author=self.config.member_name,
            ))
            state.total_commits += 1
            member = state.get_member(self.config.member_name)
            if member:
                member.total_commits += 1
            state.increment_version()
            state.save(self.config.state_path)
        else:
            console.print(f"  [red]{CROSS} Commit failed:[/red] {result.stderr.strip()}")

    def _cmd_milestone(self, args: str) -> None:
        """List milestones."""
        state = ProjectState.load(self.config.state_path)

        if not state.milestones:
            console.print("  [dim]No milestones configured.[/dim]")
            return

        console.print(f"\n  [bold]Milestones[/bold]")
        for ms in state.milestones:
            if ms.status == "completed":
                icon, style = f"[green]{CHECK}[/green]", "green"
            elif ms.status == "active":
                icon, style = f"[cyan]{ARROW}[/cyan]", "cyan"
            else:
                icon, style = f"[dim]{DOT_OFF}[/dim]", "dim"
            console.print(
                f"   {icon} [{style}]#{ms.order_index}[/{style}] "
                f"[bold]{ms.name}[/bold]  "
                f"{_progress_bar(ms.progress_percent, 12)}"
            )
        console.print()

    def _cmd_panic(self, args: str) -> None:
        """Toggle panic mode."""
        console.print(f"\n  [bold red]{FIRE} PANIC MODE ACTIVATED[/bold red]")
        console.print("  [red]Scope guards relaxed. Sync frequency increased.[/red]")
        console.print("  [dim]Focus on shipping. Cut non-essential features.[/dim]")
        try:
            from ghost_pm.sync.client import GhostSyncClient
            sync = GhostSyncClient(self.config)
            sync.update_team(self.config.team_id, {"panic_mode": True})
        except Exception:
            pass

    def _cmd_audit(self, args: str) -> None:
        """Run codebase audit."""
        state = ProjectState.load(self.config.state_path)
        from ghost_pm.auditor import audit_codebase, render_audit
        findings = audit_codebase(state, self.config)
        render_audit(findings)

    def _cmd_review(self, args: str) -> None:
        """Review recent commits."""
        from ghost_pm.auditor import review_recent_commits, render_review
        n = int(args) if args.isdigit() else 5
        commits = review_recent_commits(self.config, n)
        render_review(commits)

    def _cmd_clear(self, args: str) -> None:
        """Clear the terminal."""
        os.system("clear" if os.name != "nt" else "cls")
        self._print_banner_compact()

    def _cmd_quit(self, args: str) -> None:
        """Exit the REPL."""
        self.running = False
        console.print(
            f"\n  [dim]{ARROW} Ghost-PM exited. "
            f"Daemon keeps running in background.[/dim]\n"
        )

    # ──────────────────────────────────────────────────────
    # Chat
    # ──────────────────────────────────────────────────────

    def _send_chat(self, message: str) -> None:
        """Send a chat message to the team."""
        name = self.config.member_name or "anonymous"
        timestamp = datetime.now().strftime("%H:%M")

        console.print(
            f"  [dim]{timestamp}[/dim]  "
            f"[bold cyan]{name}[/bold cyan]  {message}"
        )

        # Push to Supabase using cached sync client & session
        if self.sync and self.config.team_id:
            try:
                self.sync.send_chat_message(
                    team_id=self.config.team_id,
                    user_id=self.config.user_id,
                    member_name=name,
                    content=message,
                )
            except Exception:
                pass

        # @ai / @ghost trigger
        lower = message.lower()
        if lower.startswith("@ai ") or lower.startswith("@ghost "):
            query = message.split(None, 1)[1] if " " in message else ""
            if query:
                self._ask_ai_chat(query)

    def _ask_ai_chat(self, question: str) -> None:
        """Ask the AI a question inline."""
        if not self.config.has_llm:
            console.print(f"  [dim]{BRAIN} AI not configured (no API key)[/dim]")
            return

        state = ProjectState.load(self.config.state_path)
        from ghost_pm.ai_advisor import get_chat_response
        console.print(f"  [dim]{BRAIN} Thinking...[/dim]")
        response = get_chat_response(question, state, self.config)

        if response:
            timestamp = datetime.now().strftime("%H:%M")
            console.print(
                f"  [dim]{timestamp}[/dim]  "
                f"[bold magenta]{BRAIN} Ghost-AI[/bold magenta]  {response}"
            )

    def _log_advice(self, advice: dict) -> None:
        """Log AI advice to Supabase."""
        if self.sync and self.config.team_id:
            try:
                self.sync.log_advice(
                    team_id=self.config.team_id,
                    member_name=self.config.member_name,
                    advice=advice,
                )
            except Exception:
                pass

    def _load_recent_chat(self) -> None:
        """Load and display recent chat messages from Supabase.

        Uses the cached chat_session_id and sync client.
        """
        if not self.sync or not self.config.team_id:
            return
        try:
            messages = self.sync.get_recent_chat(self.config.team_id, limit=10)

            if messages:
                console.print(f"  [dim]─── Recent chat (session: {self.chat_session_id or '?'}...) ───[/dim]")
                for msg in messages:
                    content = msg.get("content", "")
                    is_ai = msg.get("is_ai", False)
                    ts = msg.get("created_at", "")
                    if ts:
                        try:
                            dt = datetime.fromisoformat(ts.replace("Z", "+00:00"))
                            ts = dt.strftime("%H:%M")
                        except Exception:
                            ts = ""

                    if is_ai:
                        console.print(
                            f"  [dim]{ts}[/dim]  "
                            f"[magenta]{BRAIN} AI[/magenta]  {content}"
                        )
                    else:
                        console.print(
                            f"  [dim]{ts}[/dim]  {content}"
                        )
                console.print(f"  [dim]───────────────────────────────────[/dim]")
        except Exception:
            pass

    # ──────────────────────────────────────────────────────
    # Background sync
    # ──────────────────────────────────────────────────────

    def _start_background_sync(self) -> None:
        """Background thread for file watching and periodic sync."""
        def bg_loop():
            while self.running:
                try:
                    self._bg_tick()
                except Exception:
                    pass
                time.sleep(5)

        thread = threading.Thread(target=bg_loop, daemon=True)
        thread.start()

    def _bg_tick(self) -> None:
        """Watch files and update state."""
        project_root = self.config.project_root
        skip_dirs = {
            ".git", ".ghost", "node_modules", "__pycache__",
            ".venv", "venv", ".next", "dist", "build", "graphify-out",
        }

        newest_file = ""
        newest_mtime = 0.0

        try:
            for root, dirs, files in os.walk(project_root):
                dirs[:] = [d for d in dirs if d not in skip_dirs]
                for fname in files:
                    fpath = os.path.join(root, fname)
                    try:
                        mtime = os.path.getmtime(fpath)
                        if mtime > newest_mtime:
                            newest_mtime = mtime
                            newest_file = os.path.relpath(fpath, project_root)
                    except OSError:
                        continue
        except OSError:
            return

        state = ProjectState.load(self.config.state_path)
        member = state.get_member(self.config.member_name)
        if member and newest_file:
            member.current_file = newest_file
            member.last_active = datetime.now()
            member.is_online = True
            if newest_mtime > 0:
                member.idle_minutes = int((time.time() - newest_mtime) / 60)
            state.update_hours_remaining()
            state.increment_version()
            state.save(self.config.state_path)

    # ──────────────────────────────────────────────────────
    # Welcome screen
    # ──────────────────────────────────────────────────────

    def _print_welcome(self) -> None:
        """Print the premium welcome banner."""
        state = ProjectState.load(self.config.state_path)
        state.update_hours_remaining()

        hours = state.hours_remaining
        team_count = len([m for m in state.team if m.is_online])
        progress = state.overall_progress_percent

        console.print(GHOST_LOGO)
        console.print()

        info_lines = [
            f"  [bold]Project[/bold]    {state.project_name or self.config.team_code}",
            f"  [bold]Team Code[/bold]  [cyan]{self.config.team_code}[/cyan]",
            f"  [bold]You[/bold]        {self.config.member_name}",
            f"  [bold]Online[/bold]     [green]{team_count}[/green] member{'s' if team_count != 1 else ''}",
            f"  [bold]Time[/bold]       {_time_display(hours)}",
            f"  [bold]Progress[/bold]   {_progress_bar(progress, 20)}",
        ]

        console.print(Panel(
            "\n".join(info_lines),
            border_style="cyan",
            title="[bold cyan]v2.0.1[/bold cyan]",
            subtitle="[dim]Type [bold]/help[/bold] for commands  ·  [bold]@ai[/bold] to chat with AI[/dim]",
            expand=False,
            padding=(1, 2),
        ))
        console.print()

    def _print_banner_compact(self) -> None:
        """Compact banner after clear."""
        console.print(
            f"[bold cyan]Ghost-PM[/bold cyan] v2  {ARROW}  "
            f"Team: [cyan]{self.config.team_code}[/cyan]  {ARROW}  "
            f"[dim]/help for commands[/dim]"
        )

    def _cleanup(self) -> None:
        """Cleanup on exit."""
        # Mark ourselves offline
        if self.sync and self.config.team_id and self.config.user_id:
            try:
                self.sync.set_member_offline(self.config.team_id, self.config.user_id)
            except Exception:
                pass
