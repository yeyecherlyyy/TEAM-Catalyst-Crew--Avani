"""Ghost-PM Supabase Sync Client.

Handles all CRUD operations and realtime sync with Supabase.
Uses the unified schema (teams + CLI extensions).
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
        """Lazy-init Supabase client with auth if available."""
        if self._client is None:
            from supabase import create_client

            self._client = create_client(
                self.config.supabase_url,
                self.config.supabase_key,
            )

            # Set auth session if we have tokens
            if self.config.access_token:
                try:
                    self._client.auth.set_session(
                        self.config.access_token,
                        self.config.refresh_token,
                    )
                    # Force postgrest to use the token for table & rpc queries
                    self._client.postgrest.auth(self.config.access_token)
                except Exception:
                    pass  # Continue without auth — RLS may block some ops

        return self._client

    # ──────────────────────────────────────────────────────
    # Teams (replaces old "rooms")
    # ──────────────────────────────────────────────────────

    def get_team_by_code(self, team_code: str) -> dict | None:
        """Fetch team data by team_code (the human-readable join code)."""
        try:
            # First use the RPC to securely join the team and bypass RLS to get the team ID
            rpc_res = self.client.rpc("join_team_by_code", {"p_team_code": team_code}).execute()
            team_id = rpc_res.data

            if not team_id:
                return None

            # Now we are a member, so RLS allows us to fetch the full team data
            result = (
                self.client.table("teams")
                .select("*")
                .eq("id", team_id)
                .single()
                .execute()
            )
            return result.data
        except Exception as e:
            console.print(f"[dim]Failed to fetch team: {e}[/dim]")
            return None

    def get_team(self, team_id: str) -> dict | None:
        """Fetch team data by UUID."""
        try:
            result = (
                self.client.table("teams")
                .select("*")
                .eq("id", team_id)
                .single()
                .execute()
            )
            return result.data
        except Exception as e:
            console.print(f"[dim]Failed to fetch team: {e}[/dim]")
            return None

    def update_team(self, team_id: str, data: dict) -> None:
        """Update team data (e.g. panic_mode)."""
        try:
            self.client.table("teams").update(data).eq("id", team_id).execute()
        except Exception as e:
            console.print(f"[dim]Failed to update team: {e}[/dim]")

    # ──────────────────────────────────────────────────────
    # Members
    # ──────────────────────────────────────────────────────

    def join_team(self, team_id: str, user_id: str, member_name: str) -> dict | None:
        """Join a team as a member. Uses upsert to handle re-joins."""
        try:
            result = (
                self.client.table("team_members")
                .upsert(
                    {
                        "team_id": team_id,
                        "user_id": user_id,
                        "role": "member",
                        "member_name": member_name,
                        "is_online": True,
                        "last_active": datetime.now().isoformat(),
                    },
                    on_conflict="team_id,user_id",
                )
                .execute()
            )
            return result.data[0] if result.data else None
        except Exception as e:
            console.print(f"[dim]Failed to join team: {e}[/dim]")
            return None

    def update_member_activity(
        self, team_id: str, user_id: str, data: dict
    ) -> None:
        """Update a member's activity data (current file, idle, etc.)."""
        try:
            (
                self.client.table("team_members")
                .update(data)
                .eq("team_id", team_id)
                .eq("user_id", user_id)
                .execute()
            )
        except Exception as e:
            console.print(f"[dim]Failed to update activity: {e}[/dim]")

    def get_members(self, team_id: str) -> list[dict]:
        """Get all members of a team."""
        try:
            result = (
                self.client.table("team_members")
                .select("*")
                .eq("team_id", team_id)
                .execute()
            )
            return result.data or []
        except Exception:
            return []

    def set_member_offline(self, team_id: str, user_id: str) -> None:
        """Mark a member as offline."""
        try:
            (
                self.client.table("team_members")
                .update({"is_online": False})
                .eq("team_id", team_id)
                .eq("user_id", user_id)
                .execute()
            )
        except Exception:
            pass

    # ──────────────────────────────────────────────────────
    # Problem Statements & Roadmaps
    # ──────────────────────────────────────────────────────

    def get_problem_statement(self, team_id: str) -> dict | None:
        """Get the selected problem statement for a team."""
        try:
            result = (
                self.client.table("problem_statements")
                .select("*")
                .eq("team_id", team_id)
                .eq("is_selected", True)
                .limit(1)
                .execute()
            )
            return result.data[0] if result.data else None
        except Exception:
            return None

    def get_roadmap(self, team_id: str) -> dict | None:
        """Get the latest roadmap for a team."""
        try:
            result = (
                self.client.table("roadmaps")
                .select("*, roadmap_tasks(*)")
                .eq("team_id", team_id)
                .order("created_at", desc=True)
                .limit(1)
                .execute()
            )
            return result.data[0] if result.data else None
        except Exception:
            return None

    def get_roadmap_tasks(self, team_id: str) -> list[dict]:
        """Get all roadmap tasks for a team."""
        try:
            result = (
                self.client.table("roadmap_tasks")
                .select("*")
                .eq("team_id", team_id)
                .order("phase_index")
                .execute()
            )
            return result.data or []
        except Exception:
            return []

    # ──────────────────────────────────────────────────────
    # Chat (uses brainstorm_messages)
    # ──────────────────────────────────────────────────────

    def get_or_create_chat_session(self, team_id: str) -> str | None:
        """Get or create the shared chat session for a team.

        Uses __web_chat__ anchor — same as the frontend — so messages
        are visible in both the CLI terminal and the web dashboard.
        """
        try:
            # Look for existing shared chat session
            result = (
                self.client.table("brainstorm_sessions")
                .select("id")
                .eq("team_id", team_id)
                .eq("anchor_text", "__web_chat__")
                .eq("is_active", True)
                .order("created_at", desc=True)
                .limit(1)
                .execute()
            )
            if result.data:
                return result.data[0]["id"]

            # Create one
            result = (
                self.client.table("brainstorm_sessions")
                .insert({
                    "team_id": team_id,
                    "anchor_text": "__web_chat__",
                    "is_active": True,
                })
                .execute()
            )
            return result.data[0]["id"] if result.data else None

        except Exception as e:
            console.print(f"[dim]Chat session error: {e}[/dim]")
            return None

    def send_chat_message(
        self,
        team_id: str,
        user_id: str,
        member_name: str,
        content: str,
        is_ai: bool = False,
    ) -> dict | None:
        """Send a chat message via brainstorm_messages."""
        try:
            session_id = self.get_or_create_chat_session(team_id)
            if not session_id:
                return None

            result = (
                self.client.table("brainstorm_messages")
                .insert({
                    "session_id": session_id,
                    "team_id": team_id,
                    "user_id": user_id if user_id else None,
                    "is_ai": is_ai,
                    "content": f"[{member_name}] {content}" if not is_ai else content,
                })
                .execute()
            )
            return result.data[0] if result.data else None
        except Exception:
            return None

    def get_recent_chat(self, team_id: str, limit: int = 20) -> list[dict]:
        """Get recent chat messages."""
        try:
            session_id = self.get_or_create_chat_session(team_id)
            if not session_id:
                return []

            result = (
                self.client.table("brainstorm_messages")
                .select("*")
                .eq("session_id", session_id)
                .order("created_at", desc=True)
                .limit(limit)
                .execute()
            )
            return list(reversed(result.data)) if result.data else []
        except Exception:
            return []

    # ──────────────────────────────────────────────────────
    # Commits
    # ──────────────────────────────────────────────────────

    def push_commit(self, team_id: str, commit_data: dict) -> dict | None:
        """Record a commit in Supabase."""
        try:
            commit_data["team_id"] = team_id
            result = (
                self.client.table("commits")
                .insert(commit_data)
                .execute()
            )
            return result.data[0] if result.data else None
        except Exception:
            return None

    def get_commits(self, team_id: str, limit: int = 20) -> list[dict]:
        """Get recent commits for a team."""
        try:
            result = (
                self.client.table("commits")
                .select("*")
                .eq("team_id", team_id)
                .order("committed_at", desc=True)
                .limit(limit)
                .execute()
            )
            return result.data or []
        except Exception:
            return []

    # ──────────────────────────────────────────────────────
    # Code Graph Snapshots
    # ──────────────────────────────────────────────────────

    def push_graph_snapshot(
        self,
        team_id: str,
        member_name: str,
        summary: CodeGraphSummary,
    ) -> dict | None:
        """Push a code graph snapshot to Supabase."""
        try:
            data = {
                "team_id": team_id,
                "member_name": member_name,
                "total_nodes": summary.total_nodes,
                "total_edges": summary.total_edges,
                "total_functions": summary.total_functions,
                "total_files": summary.total_files,
                "function_statuses": summary.function_statuses,
                "god_nodes": [gn.model_dump() for gn in summary.god_nodes],
                "communities": [c.model_dump() for c in summary.communities],
            }
            result = (
                self.client.table("code_graph_snapshots")
                .insert(data)
                .execute()
            )
            return result.data[0] if result.data else None
        except Exception:
            return None

    # ──────────────────────────────────────────────────────
    # AI Advice Log
    # ──────────────────────────────────────────────────────

    def log_advice(self, team_id: str, member_name: str, advice: dict) -> None:
        """Log AI advice to Supabase."""
        try:
            self.client.table("ai_advice_log").insert({
                "team_id": team_id,
                "member_name": member_name,
                "advice_type": advice.get("urgency", "general"),
                "response": advice.get("summary", ""),
                "suggestions": advice.get("suggestions", []),
            }).execute()
        except Exception:
            pass

    # ──────────────────────────────────────────────────────
    # Nudges
    # ──────────────────────────────────────────────────────

    def get_active_nudges(self, team_id: str) -> list[dict]:
        """Get active (non-dismissed) nudges for a team."""
        try:
            result = (
                self.client.table("nudges")
                .select("*")
                .eq("team_id", team_id)
                .eq("is_dismissed", False)
                .order("created_at", desc=True)
                .limit(10)
                .execute()
            )
            return result.data or []
        except Exception:
            return []

    # ──────────────────────────────────────────────────────
    # Progress Checkins
    # ──────────────────────────────────────────────────────

    def push_checkin(self, team_id: str, data: dict) -> None:
        """Record a progress check-in."""
        try:
            data["team_id"] = team_id
            self.client.table("progress_checkins").insert(data).execute()
        except Exception:
            pass
