"""Ghost-PM Background Daemon.

Runs silently after `ghostpm join`. Watches the file system for changes,
updates teammate activity, syncs state to Supabase, and auto-drops
AI advice periodically.

Can be run directly: python -m ghost_pm.daemon
Or via the CLI: ghostpm daemon start
"""

from __future__ import annotations

import os
import signal
import sys
import time
from datetime import datetime
from pathlib import Path

from rich.console import Console

from ghost_pm.config import GhostConfig
from ghost_pm.state import Alert, ProjectState, TeamMemberSnapshot

console = Console(stderr=True)

# How often to check for file changes (seconds)
FILE_WATCH_INTERVAL = 5

# How often to sync to Supabase (seconds)
SYNC_INTERVAL = 30

# How often to regenerate productivity alerts (seconds)
ALERT_INTERVAL = 300  # 5 minutes

# How often to auto-drop AI advice (seconds)
AI_ADVICE_INTERVAL = 900  # 15 minutes

# Time thresholds (minutes)
IDLE_WARNING_THRESHOLD = 45
TIME_BOX_WARNING_THRESHOLD = 120  # 2 hours in one file


class GhostDaemon:
    """Background file watcher, sync daemon, and AI advice engine."""

    def __init__(self) -> None:
        self.config = GhostConfig.load()
        self.running = True
        self.last_sync = time.time()
        self.last_alert_check = time.time()
        self.last_advice_check = 0.0
        self.last_known_files: dict[str, float] = {}
        self.current_file: str = ""
        self.current_file_since: float = time.time()

    def start(self) -> None:
        """Main daemon loop."""
        console.print(f"[cyan]Ghost-PM daemon started (PID {os.getpid()})[/cyan]")

        # Write PID file
        pid_file = self.config.ghost_dir / "daemon.pid"
        pid_file.write_text(str(os.getpid()))

        # Handle graceful shutdown
        signal.signal(signal.SIGTERM, self._handle_shutdown)
        signal.signal(signal.SIGINT, self._handle_shutdown)

        try:
            while self.running:
                self._tick()
                time.sleep(FILE_WATCH_INTERVAL)
        except KeyboardInterrupt:
            pass
        finally:
            self._cleanup()

    def _tick(self) -> None:
        """One iteration of the daemon loop."""
        now = time.time()

        # 1. Watch for file changes
        self._watch_files()

        # 2. Periodic sync to Supabase
        if now - self.last_sync >= SYNC_INTERVAL:
            self._sync_to_cloud()
            self.last_sync = now

        # 3. Periodic alert generation
        if now - self.last_alert_check >= ALERT_INTERVAL:
            self._check_alerts()
            self.last_alert_check = now

        # 4. Auto AI advice (every 15 minutes)
        if (
            self.config.has_llm
            and self.last_advice_check > 0
            and now - self.last_advice_check >= AI_ADVICE_INTERVAL
        ):
            self._auto_advice()
            self.last_advice_check = now
        elif self.last_advice_check == 0:
            self.last_advice_check = now  # Initialize on first tick

    def _watch_files(self) -> None:
        """Scan project files for recent modifications."""
        project_root = self.config.project_root
        newest_file = ""
        newest_mtime = 0.0

        skip_dirs = {
            ".git", ".ghost", "node_modules", "__pycache__",
            ".venv", "venv", ".next", "dist", "build",
            "graphify-out", ".mypy_cache", ".pytest_cache",
        }

        try:
            for root, dirs, files in os.walk(project_root):
                dirs[:] = [d for d in dirs if d not in skip_dirs]
                for fname in files:
                    fpath = os.path.join(root, fname)
                    try:
                        mtime = os.path.getmtime(fpath)
                        rel_path = os.path.relpath(fpath, project_root)
                        if mtime > newest_mtime:
                            newest_mtime = mtime
                            newest_file = rel_path
                    except OSError:
                        continue
        except OSError:
            return

        # Detect current file change
        if newest_file and newest_file != self.current_file:
            self.current_file = newest_file
            self.current_file_since = time.time()

        # Update state.json
        state = ProjectState.load(self.config.state_path)
        member = state.get_member(self.config.member_name)
        if member:
            member.current_file = self.current_file
            time_in_file = (time.time() - self.current_file_since) / 60
            member.time_in_current_file_minutes = int(time_in_file)
            member.last_active = datetime.now()
            member.is_online = True

            if newest_mtime > 0:
                seconds_since_last_change = time.time() - newest_mtime
                member.idle_minutes = int(seconds_since_last_change / 60)

            state.update_hours_remaining()
            state.increment_version()
            state.save(self.config.state_path)

    def _sync_to_cloud(self) -> None:
        """Push current activity to Supabase."""
        if not self.config.has_supabase:
            return

        try:
            from ghost_pm.sync.client import GhostSyncClient

            sync = GhostSyncClient(self.config)
            state = ProjectState.load(self.config.state_path)
            member = state.get_member(self.config.member_name)

            if member and self.config.user_id:
                sync.update_member_activity(
                    team_id=self.config.team_id,
                    user_id=self.config.user_id,
                    data={
                        "current_file": member.current_file,
                        "current_file_since": (
                            member.current_file_since.isoformat()
                            if isinstance(member.current_file_since, datetime)
                            else datetime.now().isoformat()
                        ),
                        "idle_minutes": member.idle_minutes,
                        "is_online": True,
                        "last_active": datetime.now().isoformat(),
                        "productive_minutes": member.productive_minutes,
                        "total_commits": member.total_commits,
                    },
                )

            # Pull teammate data
            if self.config.team_id:
                members_data = sync.get_members(self.config.team_id)
                for m_data in members_data:
                    m_name = m_data.get("member_name", "")
                    if not m_name or m_name == self.config.member_name:
                        continue

                    existing = state.get_member(m_name)
                    if existing:
                        existing.current_file = m_data.get("current_file", "")
                        existing.is_online = m_data.get("is_online", False)
                        existing.idle_minutes = m_data.get("idle_minutes", 0)
                        existing.total_commits = m_data.get("total_commits", 0)
                    else:
                        state.team.append(
                            TeamMemberSnapshot(
                                member_name=m_name,
                                current_file=m_data.get("current_file", ""),
                                is_online=m_data.get("is_online", False),
                                idle_minutes=m_data.get("idle_minutes", 0),
                                total_commits=m_data.get("total_commits", 0),
                            )
                        )

                state.increment_version()
                state.save(self.config.state_path)

        except Exception:
            pass  # Silent fail — daemon should never crash

    def _check_alerts(self) -> None:
        """Generate productivity alerts."""
        state = ProjectState.load(self.config.state_path)
        member = state.get_member(self.config.member_name)
        if not member:
            return

        new_alerts: list[Alert] = []

        # Time-box warning: >2 hours in one file
        if member.time_in_current_file_minutes > TIME_BOX_WARNING_THRESHOLD:
            new_alerts.append(
                Alert(
                    alert_type="warning",
                    category="time_box",
                    message=(
                        f"You've been in {member.current_file} for "
                        f"{member.time_in_current_file_minutes} minutes. "
                        "Consider breaking this down."
                    ),
                    member_name=self.config.member_name,
                )
            )

        # Idle warning
        if member.idle_minutes > IDLE_WARNING_THRESHOLD:
            new_alerts.append(
                Alert(
                    alert_type="warning",
                    category="idle_warning",
                    message=(
                        f"No file changes in {member.idle_minutes} minutes. "
                        "Stuck? Try /advice for suggestions."
                    ),
                    member_name=self.config.member_name,
                )
            )

        # Time running out
        state.update_hours_remaining()
        if state.hours_remaining < 2 and state.overall_progress_percent < 70:
            new_alerts.append(
                Alert(
                    alert_type="critical",
                    category="general",
                    message=(
                        f"{state.hours_remaining:.1f} hours left with "
                        f"only {state.overall_progress_percent:.0f}% progress. "
                        "Consider cutting non-essential features."
                    ),
                    member_name=self.config.member_name,
                )
            )

        if new_alerts:
            state.active_alerts = (state.active_alerts + new_alerts)[-20:]
            state.increment_version()
            state.save(self.config.state_path)

    def _auto_advice(self) -> None:
        """Auto-generate AI advice and store in state."""
        try:
            state = ProjectState.load(self.config.state_path)
            state.update_hours_remaining()

            from ghost_pm.ai_advisor import get_advice, advice_to_suggestions

            advice = get_advice(state, self.config)
            if advice:
                state.suggestions = advice_to_suggestions(advice)
                state.increment_version()
                state.save(self.config.state_path)

                # Log to Supabase
                if self.config.has_supabase and self.config.team_id:
                    from ghost_pm.sync.client import GhostSyncClient
                    sync = GhostSyncClient(self.config)
                    sync.log_advice(
                        self.config.team_id,
                        self.config.member_name,
                        advice,
                    )

        except Exception:
            pass  # Silent fail

    def _handle_shutdown(self, signum, frame) -> None:
        """Handle graceful shutdown."""
        self.running = False

    def _cleanup(self) -> None:
        """Cleanup on shutdown."""
        pid_file = self.config.ghost_dir / "daemon.pid"
        pid_file.unlink(missing_ok=True)

        if self.config.has_supabase and self.config.user_id:
            try:
                from ghost_pm.sync.client import GhostSyncClient
                sync = GhostSyncClient(self.config)
                sync.set_member_offline(self.config.team_id, self.config.user_id)
            except Exception:
                pass

        console.print("[dim]Ghost-PM daemon stopped[/dim]")


def main() -> None:
    """Entry point for the daemon."""
    daemon = GhostDaemon()
    daemon.start()


if __name__ == "__main__":
    main()
