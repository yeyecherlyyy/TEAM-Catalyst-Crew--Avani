"""Ghost-PM Background Daemon.

Runs silently after `ghost connect`. Watches the file system for changes,
updates teammate activity, and syncs state to Supabase periodically.

Can be run directly: python -m ghost_pm.daemon
Or via the CLI: ghost daemon start
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

# Time thresholds (minutes)
IDLE_WARNING_THRESHOLD = 45
TIME_BOX_WARNING_THRESHOLD = 120  # 2 hours in one file


class GhostDaemon:
    """Background file watcher and sync daemon."""

    def __init__(self) -> None:
        self.config = GhostConfig.load()
        self.running = True
        self.last_sync = time.time()
        self.last_alert_check = time.time()
        self.last_known_files: dict[str, float] = {}  # path -> mtime
        self.current_file: str = ""
        self.current_file_since: float = time.time()

    def start(self) -> None:
        """Main daemon loop."""
        console.print(f"[cyan]👻 Ghost-PM daemon started (PID {os.getpid()})[/cyan]")

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

    def _watch_files(self) -> None:
        """Scan project files for recent modifications."""
        project_root = self.config.project_root
        newest_file = ""
        newest_mtime = 0.0

        # Directories to skip
        skip_dirs = {
            ".git", ".ghost", "node_modules", "__pycache__",
            ".venv", "venv", ".next", "dist", "build",
            "graphify-out", ".mypy_cache", ".pytest_cache",
        }

        try:
            for root, dirs, files in os.walk(project_root):
                # Skip excluded directories
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

            # Detect idle
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
            if member:
                sync.update_member_activity(
                    room_id=self.config.room_id,
                    member_name=self.config.member_name,
                    data={
                        "current_file": member.current_file,
                        "current_file_since": member.current_file_since.isoformat()
                        if isinstance(member.current_file_since, datetime)
                        else datetime.now().isoformat(),
                        "idle_minutes": member.idle_minutes,
                        "is_online": True,
                        "last_active": datetime.now().isoformat(),
                        "productive_minutes": member.productive_minutes,
                        "distraction_score": member.distraction_score,
                        "total_commits": member.total_commits,
                    },
                )

            # Also pull teammate data
            members_data = sync.get_members(self.config.room_id)
            for m_data in members_data:
                if m_data["member_name"] != self.config.member_name:
                    existing = state.get_member(m_data["member_name"])
                    if existing:
                        existing.current_file = m_data.get("current_file", "")
                        existing.is_online = m_data.get("is_online", False)
                        existing.idle_minutes = m_data.get("idle_minutes", 0)
                        existing.total_commits = m_data.get("total_commits", 0)
                    else:
                        state.team.append(
                            TeamMemberSnapshot(
                                member_name=m_data["member_name"],
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
                        "Consider breaking this down or pair programming."
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
                        "Are you stuck? Try 'ghost advice' for suggestions."
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
                        f"⚠ {state.hours_remaining:.1f} hours left with "
                        f"only {state.overall_progress_percent:.0f}% progress. "
                        "Consider cutting non-essential features!"
                    ),
                    member_name=self.config.member_name,
                )
            )

        if new_alerts:
            # Keep only last 20 alerts
            state.active_alerts = (state.active_alerts + new_alerts)[-20:]
            state.increment_version()
            state.save(self.config.state_path)

    def _handle_shutdown(self, signum, frame) -> None:
        """Handle graceful shutdown."""
        self.running = False

    def _cleanup(self) -> None:
        """Cleanup on shutdown."""
        # Remove PID file
        pid_file = self.config.ghost_dir / "daemon.pid"
        pid_file.unlink(missing_ok=True)

        # Mark member as offline
        if self.config.has_supabase:
            try:
                from ghost_pm.sync.client import GhostSyncClient

                sync = GhostSyncClient(self.config)
                sync.set_member_offline(self.config.room_id, self.config.member_name)
            except Exception:
                pass

        console.print("[dim]👻 Ghost-PM daemon stopped[/dim]")


def main() -> None:
    """Entry point for the daemon."""
    daemon = GhostDaemon()
    daemon.start()


if __name__ == "__main__":
    main()
