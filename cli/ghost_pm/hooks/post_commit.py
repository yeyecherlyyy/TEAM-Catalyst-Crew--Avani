"""Ghost-PM Post-Commit Hook — Progress Tracker.

Runs as a module: python -m ghost_pm.hooks.post_commit

After a successful commit:
1. Records the commit in state.json
2. Rebuilds the code graph (graphify)
3. Updates function statuses and file records
4. Syncs everything to Supabase
"""

from __future__ import annotations
import subprocess
from datetime import datetime
from pathlib import Path

from rich.console import Console

from ghost_pm.config import GhostConfig
from ghost_pm.graph_parser import GraphParser
from ghost_pm.state import CommitSummary, ProjectState

console = Console()


def get_latest_commit_info() -> dict:
    """Get info about the commit that just happened."""
    # Hash
    result = subprocess.run(
        ["git", "log", "-1", "--format=%H"],
        capture_output=True, text=True,
    )
    commit_hash = result.stdout.strip()

    # Message
    result = subprocess.run(
        ["git", "log", "-1", "--format=%s"],
        capture_output=True, text=True,
    )
    message = result.stdout.strip()

    # Author
    result = subprocess.run(
        ["git", "log", "-1", "--format=%an"],
        capture_output=True, text=True,
    )
    author = result.stdout.strip()

    # Files changed
    result = subprocess.run(
        ["git", "diff-tree", "--no-commit-id", "--name-only", "-r", "HEAD"],
        capture_output=True, text=True,
    )
    files = [f.strip() for f in result.stdout.strip().split("\n") if f.strip()]

    # Insertions/deletions
    result = subprocess.run(
        ["git", "diff", "--shortstat", "HEAD~1", "HEAD"],
        capture_output=True, text=True,
    )
    stat_line = result.stdout.strip()
    insertions = 0
    deletions = 0
    if "insertion" in stat_line:
        try:
            insertions = int(stat_line.split("insertion")[0].split(",")[-1].strip())
        except (ValueError, IndexError):
            pass
    if "deletion" in stat_line:
        try:
            deletions = int(stat_line.split("deletion")[0].split(",")[-1].strip())
        except (ValueError, IndexError):
            pass

    return {
        "hash": commit_hash,
        "message": message,
        "author": author,
        "files": files,
        "insertions": insertions,
        "deletions": deletions,
    }


def main() -> None:
    """Post-commit processing."""
    config = GhostConfig.load()
    state = ProjectState.load(config.state_path)

    commit_info = get_latest_commit_info()

    # 1. Record commit in state
    commit_summary = CommitSummary(
        hash=commit_info["hash"][:8],
        message=commit_info["message"],
        author=commit_info.get("author", config.member_name),
        files_changed=commit_info["files"],
        timestamp=datetime.now(),
        milestone_id=state.active_milestone_id,
    )

    state.recent_commits.insert(0, commit_summary)
    # Keep only last 50 commits in state
    state.recent_commits = state.recent_commits[:50]
    state.total_commits += 1

    # Update active milestone commit count
    active_ms = state.get_active_milestone()
    if active_ms:
        active_ms.commit_count += 1

    # Update member stats
    member = state.get_member(config.member_name)
    if member:
        member.total_commits += 1
        member.last_active = datetime.now()

    console.print(f"[green]✓[/green] Tracked commit #{state.total_commits}: {commit_info['message']}")

    # 2. Rebuild code graph
    parser = GraphParser(project_root=config.project_root, ghost_dir=config.ghost_dir)
    if parser.run_graphify():
        old_summary = state.code_graph
        new_summary = parser.build_summary()
        parser.sync_to_ghost_dir()

        # Compute deltas
        nodes_delta = new_summary.total_nodes - old_summary.total_nodes
        edges_delta = new_summary.total_edges - old_summary.total_edges
        funcs_delta = new_summary.total_functions - old_summary.total_functions

        state.code_graph = new_summary
        state.files = parser.build_file_records()

        delta_parts = []
        if nodes_delta != 0:
            delta_parts.append(f"nodes {'+' if nodes_delta > 0 else ''}{nodes_delta}")
        if funcs_delta != 0:
            delta_parts.append(f"functions {'+' if funcs_delta > 0 else ''}{funcs_delta}")
        if delta_parts:
            console.print(f"[cyan]📊 Graph delta:[/cyan] {', '.join(delta_parts)}")

        # Update milestone progress based on function implementation
        if active_ms and new_summary.total_functions > 0:
            implemented = (
                new_summary.function_statuses.get("implemented", 0)
                + new_summary.function_statuses.get("tested", 0)
            )
            total = new_summary.total_functions
            active_ms.functions_implemented = implemented
            active_ms.functions_expected = total
            active_ms.progress_percent = (implemented / total) * 100 if total > 0 else 0

    state.compute_overall_progress()
    state.update_hours_remaining()
    state.increment_version()
    state.save(config.state_path)

    # 3. Sync to Supabase
    if config.has_supabase and config.team_id:
        try:
            from ghost_pm.sync.client import GhostSyncClient

            sync = GhostSyncClient(config)

            # Record commit — push_commit expects (team_id, commit_data)
            push_data = {
                "member_name": config.member_name,
                "commit_hash": commit_info["hash"][:8],
                "message": commit_info["message"],
                "files_changed": commit_info["files"],
                "insertions": commit_info.get("insertions", 0),
                "deletions": commit_info.get("deletions", 0),
            }
            sync.push_commit(
                team_id=config.team_id,
                commit_data=push_data,
            )

            # Push graph snapshot
            sync.push_graph_snapshot(
                team_id=config.team_id,
                member_name=config.member_name,
                summary=state.code_graph,
            )

            # Update member activity — uses team_id + user_id
            if config.user_id:
                sync.update_member_activity(
                    team_id=config.team_id,
                    user_id=config.user_id,
                    data={
                        "total_commits": state.total_commits,
                        "last_active": datetime.now().isoformat(),
                    },
                )
            console.print("[green]✓[/green] Synced to cloud")
        except Exception as e:
            console.print(f"[dim]Supabase sync: {e}[/dim]")

    # Print summary
    console.print(
        f"[dim]  Progress: {state.overall_progress_percent:.0f}% | "
        f"Functions: {state.code_graph.total_functions} | "
        f"Hours left: {state.hours_remaining:.1f}[/dim]"
    )


if __name__ == "__main__":
    main()
