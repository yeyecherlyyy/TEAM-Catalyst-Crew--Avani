"""Ghost-PM Supabase Sync Client.

Handles all CRUD operations and realtime sync with Supabase.
Designed to fail gracefully — if Supabase is unreachable,
the CLI continues to work in offline mode.
"""

from __future__ import annotations

from datetime import datetime
from typing import Any

from rich.console import Console

from ghost_pm.config import GhostConfig
from ghost_pm.state import CodeGraphSummary

console = Console()


class GhostSyncClient:
    """Synchronous Supabase client for Ghost-PM."""

    def __init__(self, config: GhostConfig) -> None:
        self.config = config
        self._client = None

    @property
    def client(self):
        """Lazy-init Supabase client."""
        if self._client is None:
            from supabase import create_client

            self._client = create_client(
                self.config.supabase_url,
                self.config.supabase_key,
            )
        return self._client

    # ──────────────────────────────────────────────────────
    # Rooms
    # ──────────────────────────────────────────────────────

    def get_room(self, room_id: str) -> dict | None:
        """Fetch room data by ID."""
        try:
            result = (
                self.client.table("rooms")
                .select("*")
                .eq("id", room_id)
                .single()
                .execute()
            )
            return result.data
        except Exception as e:
            console.print(f"[dim]Failed to fetch room: {e}[/dim]")
            return None

    def create_room(self, data: dict) -> dict | None:
        """Create a new room."""
        try:
            result = self.client.table("rooms").insert(data).execute()
            return result.data[0] if result.data else None
        except Exception as e:
            console.print(f"[dim]Failed to create room: {e}[/dim]")
            return None

    def update_room(self, room_id: str, data: dict) -> None:
        """Update room data."""
        try:
            self.client.table("rooms").update(data).eq("id", room_id).execute()
        except Exception as e:
            console.print(f"[dim]Failed to update room: {e}[/dim]")

    # ──────────────────────────────────────────────────────
    # Members
    # ──────────────────────────────────────────────────────

    def register_member(self, room_id: str, member_name: str) -> dict | None:
        """Register a new team member in a room (upsert)."""
        try:
            result = (
                self.client.table("room_members")
                .upsert(
                    {
                        "room_id": room_id,
                        "member_name": member_name,
                        "is_online": True,
                        "last_active": datetime.now().isoformat(),
                    },
                    on_conflict="room_id,member_name",
                )
                .execute()
            )
            return result.data[0] if result.data else None
        except Exception as e:
            console.print(f"[dim]Failed to register member: {e}[/dim]")
            return None

    def update_member_activity(
        self, room_id: str, member_name: str, data: dict
    ) -> None:
        """Update a member's activity data."""
        try:
            (
                self.client.table("room_members")
                .update(data)
                .eq("room_id", room_id)
                .eq("member_name", member_name)
                .execute()
            )
        except Exception as e:
            console.print(f"[dim]Failed to update member: {e}[/dim]")

    def get_members(self, room_id: str) -> list[dict]:
        """Get all members of a room."""
        try:
            result = (
                self.client.table("room_members")
                .select("*")
                .eq("room_id", room_id)
                .execute()
            )
            return result.data or []
        except Exception as e:
            console.print(f"[dim]Failed to fetch members: {e}[/dim]")
            return []

    def set_member_offline(self, room_id: str, member_name: str) -> None:
        """Mark a member as offline."""
        self.update_member_activity(
            room_id, member_name, {"is_online": False}
        )

    # ──────────────────────────────────────────────────────
    # Milestones
    # ──────────────────────────────────────────────────────

    def get_milestones(self, room_id: str) -> list[dict]:
        """Get all milestones for a room, ordered by index."""
        try:
            result = (
                self.client.table("milestones")
                .select("*")
                .eq("room_id", room_id)
                .order("order_index")
                .execute()
            )
            return result.data or []
        except Exception as e:
            console.print(f"[dim]Failed to fetch milestones: {e}[/dim]")
            return []

    def create_milestones(self, milestones: list[dict]) -> list[dict]:
        """Bulk create milestones."""
        try:
            result = self.client.table("milestones").insert(milestones).execute()
            return result.data or []
        except Exception as e:
            console.print(f"[dim]Failed to create milestones: {e}[/dim]")
            return []

    def update_milestone(self, milestone_id: int, data: dict) -> None:
        """Update a milestone's data."""
        try:
            self.client.table("milestones").update(data).eq("id", milestone_id).execute()
        except Exception as e:
            console.print(f"[dim]Failed to update milestone: {e}[/dim]")

    # ──────────────────────────────────────────────────────
    # Commits
    # ──────────────────────────────────────────────────────

    def push_commit(
        self,
        room_id: str,
        member_name: str,
        commit_data: dict,
        milestone_id: int | None = None,
        scope_verdict: dict | None = None,
    ) -> dict | None:
        """Record a commit in Supabase."""
        try:
            row = {
                "room_id": room_id,
                "member_name": member_name,
                "commit_hash": commit_data.get("hash", ""),
                "message": commit_data.get("message", ""),
                "files_changed": commit_data.get("files", []),
                "insertions": commit_data.get("insertions", 0),
                "deletions": commit_data.get("deletions", 0),
                "committed_at": datetime.now().isoformat(),
            }
            if milestone_id is not None:
                row["milestone_id"] = milestone_id
            if scope_verdict is not None:
                row["scope_verdict"] = scope_verdict

            result = self.client.table("commits").insert(row).execute()
            return result.data[0] if result.data else None
        except Exception as e:
            console.print(f"[dim]Failed to push commit: {e}[/dim]")
            return None

    def get_commits(self, room_id: str, limit: int = 50) -> list[dict]:
        """Get recent commits for a room."""
        try:
            result = (
                self.client.table("commits")
                .select("*")
                .eq("room_id", room_id)
                .order("committed_at", desc=True)
                .limit(limit)
                .execute()
            )
            return result.data or []
        except Exception as e:
            console.print(f"[dim]Failed to fetch commits: {e}[/dim]")
            return []

    # ──────────────────────────────────────────────────────
    # Code Graph Snapshots
    # ──────────────────────────────────────────────────────

    def push_graph_snapshot(
        self,
        room_id: str,
        member_name: str,
        summary: CodeGraphSummary,
    ) -> dict | None:
        """Push a code graph snapshot to Supabase."""
        try:
            row = {
                "room_id": room_id,
                "member_name": member_name,
                "snapshot_at": datetime.now().isoformat(),
                "total_nodes": summary.total_nodes,
                "total_edges": summary.total_edges,
                "total_functions": summary.total_functions,
                "total_files": summary.total_files,
                "communities": [c.model_dump() for c in summary.communities],
                "god_nodes": [g.model_dump() for g in summary.god_nodes],
                "function_statuses": summary.function_statuses,
            }
            result = (
                self.client.table("code_graph_snapshots").insert(row).execute()
            )
            return result.data[0] if result.data else None
        except Exception as e:
            console.print(f"[dim]Failed to push graph snapshot: {e}[/dim]")
            return None

    def get_latest_graph_snapshot(self, room_id: str) -> dict | None:
        """Get the most recent graph snapshot for a room."""
        try:
            result = (
                self.client.table("code_graph_snapshots")
                .select("*")
                .eq("room_id", room_id)
                .order("snapshot_at", desc=True)
                .limit(1)
                .single()
                .execute()
            )
            return result.data
        except Exception as e:
            console.print(f"[dim]Failed to fetch graph snapshot: {e}[/dim]")
            return None

    # ──────────────────────────────────────────────────────
    # Dashboard view
    # ──────────────────────────────────────────────────────

    def get_dashboard(self, room_id: str) -> dict | None:
        """Get the room dashboard summary view."""
        try:
            result = (
                self.client.table("room_dashboard")
                .select("*")
                .eq("room_id", room_id)
                .single()
                .execute()
            )
            return result.data
        except Exception as e:
            console.print(f"[dim]Failed to fetch dashboard: {e}[/dim]")
            return None
