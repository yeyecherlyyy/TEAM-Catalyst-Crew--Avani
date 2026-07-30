"""Ghost-PM Comprehensive Integration Test.

Tests EVERY core feature against live Supabase:
1. Room creation with ID generation
2. Member registration + realtime join
3. Milestone creation + progress tracking
4. Commit recording with scope verdicts
5. Code graph snapshot creation + updates
6. Member activity updates (file tracking, idle detection)
7. Milestone advancement
8. Data consistency verification at every step
"""

import json
import sys
import time
from datetime import datetime, timedelta
from pathlib import Path

# ── Setup ─────────────────────────────────────────────
from ghost_pm.config import GhostConfig, GHOST_SUPABASE_URL, GHOST_SUPABASE_KEY
from ghost_pm.sync.client import GhostSyncClient
from ghost_pm.state import (
    ProjectState, MilestoneState, TeamMemberSnapshot,
    CodeGraphSummary, GraphCommunity, GodNode, CommitSummary,
    Alert, FileRecord,
)
from ghost_pm.graph_parser import GraphParser

passed = 0
failed = 0


def test(name, condition, detail=""):
    global passed, failed
    if condition:
        passed += 1
        print(f"  ✅ {name}")
    else:
        failed += 1
        print(f"  ❌ {name}")
    if detail:
        print(f"      → {detail}")


def section(title):
    print(f"\n{'─' * 60}")
    print(f"  {title}")
    print(f"{'─' * 60}")


print("=" * 60)
print("  Ghost-PM — Comprehensive Integration Test")
print(f"  Supabase: {GHOST_SUPABASE_URL}")
print(f"  Time: {datetime.now().isoformat()}")
print("=" * 60)

config = GhostConfig()
sync = GhostSyncClient(config)

# ══════════════════════════════════════════════════════
# TEST 1: Room Creation
# ══════════════════════════════════════════════════════
section("TEST 1: Room Creation")

room_data = sync.create_room({
    "name": "HackFusion 2026",
    "description": "AI-powered food delivery app",
    "duration_hours": 24,
    "tech_stack": ["Python", "React", "FastAPI", "PostgreSQL"],
    "hackathon_start": datetime.now().isoformat(),
    "hackathon_end": (datetime.now() + timedelta(hours=24)).isoformat(),
})

test("Room created in Supabase", room_data is not None)
room_id = room_data["id"] if room_data else "FAILED"
test("Room ID generated (format: xxx-xxx-xxx)", 
     room_data is not None and len(room_id.split("-")) == 3,
     f"Room ID = {room_id}")
test("Room name stored correctly",
     room_data is not None and room_data.get("name") == "HackFusion 2026",
     f"Name = {room_data.get('name') if room_data else 'N/A'}")
test("Tech stack stored as array",
     room_data is not None and isinstance(room_data.get("tech_stack"), list),
     f"Stack = {room_data.get('tech_stack') if room_data else 'N/A'}")
test("Hackathon times set",
     room_data is not None and room_data.get("hackathon_start") is not None,
     f"Start = {room_data.get('hackathon_start', 'N/A')[:19] if room_data else 'N/A'}")

# Verify readback
room_check = sync.get_room(room_id)
test("Room readback matches",
     room_check is not None and room_check.get("name") == "HackFusion 2026")

# ══════════════════════════════════════════════════════
# TEST 2: Member Registration
# ══════════════════════════════════════════════════════
section("TEST 2: Member Registration (Team Join)")

member1 = sync.register_member(room_id, "Aaditya")
test("Member 1 (Aaditya) registered", member1 is not None,
     f"ID = {member1.get('id', 'N/A')[:8] if member1 else 'N/A'}")

member2 = sync.register_member(room_id, "Rahul")
test("Member 2 (Rahul) registered", member2 is not None)

member3 = sync.register_member(room_id, "Priya")
test("Member 3 (Priya) registered", member3 is not None)

# Verify all members visible
members = sync.get_members(room_id)
member_names = [m["member_name"] for m in members]
test("All 3 members visible",
     len(members) == 3 and "Aaditya" in member_names and "Rahul" in member_names and "Priya" in member_names,
     f"Members = {member_names}")

# Test duplicate join (upsert - should not create duplicate)
member1_rejoin = sync.register_member(room_id, "Aaditya")
members_after_rejoin = sync.get_members(room_id)
test("Duplicate join doesn't create duplicate member",
     len(members_after_rejoin) == 3,
     f"Count = {len(members_after_rejoin)} (expected 3)")

# ══════════════════════════════════════════════════════
# TEST 3: Milestone Creation + Management
# ══════════════════════════════════════════════════════
section("TEST 3: Milestone Creation + Progress Tracking")

milestones_data = sync.create_milestones([
    {
        "room_id": room_id,
        "name": "Project Setup & Auth",
        "description": "Initialize repo, set up auth, database schema",
        "order_index": 1,
        "status": "active",
        "files_expected": ["src/auth/", "src/models/", "pyproject.toml"],
        "functions_expected": 10,
    },
    {
        "room_id": room_id,
        "name": "Core API Endpoints",
        "description": "Restaurant listing, menu, order placement",
        "order_index": 2,
        "status": "pending",
        "files_expected": ["src/api/", "src/services/"],
        "functions_expected": 20,
    },
    {
        "room_id": room_id,
        "name": "Frontend + Demo Polish",
        "description": "React UI, live demo prep, pitch deck data",
        "order_index": 3,
        "status": "pending",
        "files_expected": ["frontend/", "src/components/"],
        "functions_expected": 15,
    },
])

test("3 milestones created", len(milestones_data) == 3,
     f"Created = {len(milestones_data)}")

ms_readback = sync.get_milestones(room_id)
test("Milestones ordered correctly",
     ms_readback[0]["order_index"] == 1 and ms_readback[2]["order_index"] == 3,
     f"Order = {[m['order_index'] for m in ms_readback]}")
test("First milestone is active",
     ms_readback[0]["status"] == "active",
     f"Status = {ms_readback[0]['status']}")
test("Expected files stored",
     "src/auth/" in ms_readback[0].get("files_expected", []),
     f"Files = {ms_readback[0].get('files_expected')}")

# Update milestone progress
ms1_id = milestones_data[0]["id"]
sync.update_milestone(ms1_id, {
    "progress_percent": 35.0,
    "functions_implemented": 4,
    "started_at": datetime.now().isoformat(),
})

ms_updated = sync.get_milestones(room_id)
test("Milestone progress updated to 35%",
     ms_updated[0].get("progress_percent") == 35.0,
     f"Progress = {ms_updated[0].get('progress_percent')}%")
test("Functions implemented tracked",
     ms_updated[0].get("functions_implemented") == 4,
     f"Implemented = {ms_updated[0].get('functions_implemented')}/10")

# ══════════════════════════════════════════════════════
# TEST 4: Commit Recording
# ══════════════════════════════════════════════════════
section("TEST 4: Commit Recording + Scope Verdicts")

# Commit 1: normal commit
commit1 = sync.push_commit(
    room_id=room_id,
    member_name="Aaditya",
    commit_data={
        "hash": "a1b2c3d4e5f6",
        "message": "feat: add user authentication with JWT",
        "files": ["src/auth/jwt.py", "src/auth/middleware.py", "src/models/user.py"],
        "insertions": 120,
        "deletions": 5,
    },
    milestone_id=ms1_id,
    scope_verdict={"allowed": True, "reason": "Matches active milestone scope", "severity": "info"},
)
test("Commit 1 recorded (auth feature)", commit1 is not None,
     f"Hash = a1b2c3d")

# Commit 2: by different member
commit2 = sync.push_commit(
    room_id=room_id,
    member_name="Rahul",
    commit_data={
        "hash": "b2c3d4e5f6g7",
        "message": "feat: add database models for restaurants and menu",
        "files": ["src/models/restaurant.py", "src/models/menu.py", "migrations/001_init.sql"],
        "insertions": 85,
        "deletions": 0,
    },
    milestone_id=ms1_id,
    scope_verdict={"allowed": True, "reason": "Database models in scope", "severity": "info"},
)
test("Commit 2 recorded (Rahul - models)", commit2 is not None)

# Commit 3: scope violation
commit3 = sync.push_commit(
    room_id=room_id,
    member_name="Priya",
    commit_data={
        "hash": "c3d4e5f6g7h8",
        "message": "feat: add payment processing integration",
        "files": ["src/payments/stripe.py", "src/payments/webhook.py"],
        "insertions": 200,
        "deletions": 0,
    },
    milestone_id=ms1_id,
    scope_verdict={"allowed": False, "reason": "Payment is Milestone 2 scope, current is Setup & Auth", "severity": "block"},
)
test("Commit 3 recorded (scope violation)", commit3 is not None)

# Verify commits
commits = sync.get_commits(room_id)
test("3 commits visible in room", len(commits) == 3,
     f"Count = {len(commits)}")
test("Commits ordered by time (newest first)",
     commits[0]["committed_at"] >= commits[1]["committed_at"])
test("Scope violation recorded correctly",
     any(c.get("scope_verdict", {}).get("allowed") == False for c in commits),
     "Found blocked commit")

# Check specific commit data
auth_commit = [c for c in commits if "authentication" in c.get("message", "")]
test("Commit details preserved (files, insertions, deletions)",
     len(auth_commit) == 1 and auth_commit[0].get("insertions") == 120,
     f"Insertions = {auth_commit[0].get('insertions') if auth_commit else 'N/A'}")

# ══════════════════════════════════════════════════════
# TEST 5: Code Graph Snapshots
# ══════════════════════════════════════════════════════
section("TEST 5: Code Graph Snapshots (Graphify Integration)")

# Snapshot 1: initial graph
graph1 = CodeGraphSummary(
    total_nodes=18,
    total_edges=12,
    total_functions=10,
    total_files=6,
    communities=[
        GraphCommunity(name="auth", files=["src/auth/jwt.py", "src/auth/middleware.py"], functions=4, description="Authentication module"),
        GraphCommunity(name="models", files=["src/models/user.py", "src/models/restaurant.py"], functions=3, description="Database models"),
        GraphCommunity(name="config", files=["src/config.py"], functions=3, description="Configuration"),
    ],
    god_nodes=[
        GodNode(name="src/models/user.py", file_path="src/models/user.py", connections=8, risk="medium"),
    ],
    function_statuses={"stub": 3, "in_progress": 4, "implemented": 3, "tested": 0, "broken": 0, "unknown": 0},
)

snap1 = sync.push_graph_snapshot(room_id, "Aaditya", graph1)
test("Graph snapshot 1 pushed", snap1 is not None)

# Verify readback
snap_check = sync.get_latest_graph_snapshot(room_id)
test("Graph snapshot readable",
     snap_check is not None and snap_check.get("total_nodes") == 18,
     f"Nodes = {snap_check.get('total_nodes') if snap_check else 'N/A'}")
test("Function statuses stored",
     snap_check is not None and snap_check.get("function_statuses", {}).get("in_progress") == 4,
     f"Statuses = {snap_check.get('function_statuses') if snap_check else 'N/A'}")
test("Communities stored",
     snap_check is not None and len(snap_check.get("communities", [])) == 3,
     f"Communities = {[c.get('name') for c in snap_check.get('communities', [])] if snap_check else 'N/A'}")
test("God nodes stored",
     snap_check is not None and len(snap_check.get("god_nodes", [])) == 1,
     f"God nodes = {snap_check.get('god_nodes') if snap_check else 'N/A'}")

# Snapshot 2: updated graph (simulating progress)
time.sleep(1)  # ensure different timestamp
graph2 = CodeGraphSummary(
    total_nodes=28,
    total_edges=22,
    total_functions=18,
    total_files=9,
    communities=[
        GraphCommunity(name="auth", files=["src/auth/jwt.py", "src/auth/middleware.py", "src/auth/oauth.py"], functions=6),
        GraphCommunity(name="models", files=["src/models/user.py", "src/models/restaurant.py", "src/models/menu.py"], functions=5),
        GraphCommunity(name="api", files=["src/api/routes.py", "src/api/schemas.py"], functions=4),
        GraphCommunity(name="config", files=["src/config.py"], functions=3),
    ],
    god_nodes=[
        GodNode(name="src/models/user.py", file_path="src/models/user.py", connections=12, risk="high"),
        GodNode(name="src/api/routes.py", file_path="src/api/routes.py", connections=11, risk="high"),
    ],
    function_statuses={"stub": 2, "in_progress": 5, "implemented": 9, "tested": 2, "broken": 0, "unknown": 0},
)

snap2 = sync.push_graph_snapshot(room_id, "Aaditya", graph2)
test("Graph snapshot 2 pushed (updated)", snap2 is not None)

# Verify latest snapshot is snapshot 2
snap_latest = sync.get_latest_graph_snapshot(room_id)
test("Latest snapshot returns updated data",
     snap_latest is not None and snap_latest.get("total_nodes") == 28,
     f"Nodes: 18 → {snap_latest.get('total_nodes') if snap_latest else 'N/A'}")
test("Function progress tracked (implemented: 3→9)",
     snap_latest is not None and snap_latest.get("function_statuses", {}).get("implemented") == 9,
     f"Implemented: 3 → {snap_latest.get('function_statuses', {}).get('implemented') if snap_latest else 'N/A'}")
test("God nodes updated (1→2, risk escalated)",
     snap_latest is not None and len(snap_latest.get("god_nodes", [])) == 2,
     f"God nodes: 1 → {len(snap_latest.get('god_nodes', [])) if snap_latest else 'N/A'}")

# ══════════════════════════════════════════════════════
# TEST 6: Member Activity Tracking
# ══════════════════════════════════════════════════════
section("TEST 6: Member Activity Tracking (Daemon Simulation)")

# Simulate Aaditya working on auth
sync.update_member_activity(room_id, "Aaditya", {
    "current_file": "src/auth/jwt.py",
    "current_file_since": datetime.now().isoformat(),
    "total_commits": 1,
    "idle_minutes": 0,
    "productive_minutes": 45,
    "distraction_score": 0.1,
    "is_online": True,
    "last_active": datetime.now().isoformat(),
    "current_milestone_id": ms1_id,
})

# Simulate Rahul working on models
sync.update_member_activity(room_id, "Rahul", {
    "current_file": "src/models/restaurant.py",
    "current_file_since": (datetime.now() - timedelta(minutes=30)).isoformat(),
    "total_commits": 1,
    "idle_minutes": 5,
    "productive_minutes": 60,
    "distraction_score": 0.2,
    "is_online": True,
    "last_active": datetime.now().isoformat(),
})

# Simulate Priya idle
sync.update_member_activity(room_id, "Priya", {
    "current_file": "src/payments/stripe.py",
    "total_commits": 1,
    "idle_minutes": 50,
    "productive_minutes": 20,
    "distraction_score": 0.7,
    "is_online": True,
    "last_active": (datetime.now() - timedelta(minutes=50)).isoformat(),
})

# Verify activity
members_activity = sync.get_members(room_id)
aaditya = [m for m in members_activity if m["member_name"] == "Aaditya"][0]
rahul = [m for m in members_activity if m["member_name"] == "Rahul"][0]
priya = [m for m in members_activity if m["member_name"] == "Priya"][0]

test("Aaditya current file tracked",
     aaditya.get("current_file") == "src/auth/jwt.py",
     f"File = {aaditya.get('current_file')}")
test("Rahul current file tracked",
     rahul.get("current_file") == "src/models/restaurant.py",
     f"File = {rahul.get('current_file')}")
test("Priya idle minutes tracked",
     priya.get("idle_minutes") == 50,
     f"Idle = {priya.get('idle_minutes')}m")
test("Distraction scores stored",
     priya.get("distraction_score") == 0.7,
     f"Priya distraction = {priya.get('distraction_score')}")
test("All members show online",
     all(m.get("is_online") for m in members_activity),
     f"Online = {[m['member_name'] for m in members_activity if m.get('is_online')]}")

# ══════════════════════════════════════════════════════
# TEST 7: Milestone Advancement
# ══════════════════════════════════════════════════════
section("TEST 7: Milestone Advancement")

# Complete milestone 1
sync.update_milestone(ms1_id, {
    "status": "completed",
    "progress_percent": 100.0,
    "functions_implemented": 10,
    "completed_at": datetime.now().isoformat(),
})

# Activate milestone 2
ms2_id = milestones_data[1]["id"]
sync.update_milestone(ms2_id, {
    "status": "active",
    "started_at": datetime.now().isoformat(),
})

ms_after_advance = sync.get_milestones(room_id)
test("Milestone 1 marked completed",
     ms_after_advance[0]["status"] == "completed",
     f"Status = {ms_after_advance[0]['status']}")
test("Milestone 1 at 100%",
     ms_after_advance[0]["progress_percent"] == 100.0,
     f"Progress = {ms_after_advance[0]['progress_percent']}%")
test("Milestone 2 now active",
     ms_after_advance[1]["status"] == "active",
     f"Status = {ms_after_advance[1]['status']}")
test("Milestone 3 still pending",
     ms_after_advance[2]["status"] == "pending",
     f"Status = {ms_after_advance[2]['status']}")

# ══════════════════════════════════════════════════════
# TEST 8: State.json Integration
# ══════════════════════════════════════════════════════
section("TEST 8: Local State.json (LLM Context)")

# Build a full ProjectState from the Supabase data
state = ProjectState(
    room_id=room_id,
    project_name="HackFusion 2026",
    description="AI-powered food delivery app",
    tech_stack=["Python", "React", "FastAPI", "PostgreSQL"],
    hackathon_start=datetime.now(),
    hackathon_end=datetime.now() + timedelta(hours=24),
    milestones=[
        MilestoneState(
            id=ms_after_advance[i]["id"],
            name=ms_after_advance[i]["name"],
            status=ms_after_advance[i]["status"],
            order_index=ms_after_advance[i]["order_index"],
            progress_percent=ms_after_advance[i].get("progress_percent", 0),
        )
        for i in range(3)
    ],
    active_milestone_id=ms2_id,
    code_graph=graph2,
    team=[
        TeamMemberSnapshot(member_name="Aaditya", is_online=True, current_file="src/auth/jwt.py", total_commits=1),
        TeamMemberSnapshot(member_name="Rahul", is_online=True, current_file="src/models/restaurant.py", total_commits=1),
        TeamMemberSnapshot(member_name="Priya", is_online=True, current_file="src/payments/stripe.py", total_commits=1, idle_minutes=50),
    ],
    recent_commits=[
        CommitSummary(hash="a1b2c3d", message="feat: add user authentication with JWT", author="Aaditya"),
        CommitSummary(hash="b2c3d4e", message="feat: add database models for restaurants and menu", author="Rahul"),
        CommitSummary(hash="c3d4e5f", message="feat: add payment processing integration", author="Priya", scope_allowed=False),
    ],
    total_commits=3,
    scope_violations=1,
)

state.compute_overall_progress()
state.update_hours_remaining()
state.increment_version()

# Save to temp path
test_state_path = Path("/tmp/ghost_pm_test_state.json")
state.save(test_state_path)

# Load back
loaded = ProjectState.load(test_state_path)
test("State saves and loads correctly",
     loaded.room_id == room_id and loaded.project_name == "HackFusion 2026")
test("State version incremented", loaded.state_version == 1)
test("Overall progress computed",
     loaded.overall_progress_percent > 0,
     f"Progress = {loaded.overall_progress_percent:.1f}%")
test("Hours remaining calculated",
     23 < loaded.hours_remaining <= 24,
     f"Hours = {loaded.hours_remaining:.1f}")
test("Code graph in state",
     loaded.code_graph.total_functions == 18,
     f"Functions = {loaded.code_graph.total_functions}")
test("Team members in state",
     len(loaded.team) == 3,
     f"Team = {[m.member_name for m in loaded.team]}")
test("Scope violations tracked",
     loaded.scope_violations == 1)

# Check state.json size (must be small enough for LLM context)
state_size = test_state_path.stat().st_size
test("State.json under 10KB (LLM-friendly)",
     state_size < 10240,
     f"Size = {state_size} bytes")

# Cleanup
test_state_path.unlink(missing_ok=True)

# ══════════════════════════════════════════════════════
# TEST 9: Graph Parser (Offline)
# ══════════════════════════════════════════════════════
section("TEST 9: Graph Parser Logic")

parser = GraphParser(
    project_root=Path("/Users/aadityaagarwal/Downloads/Offline_testing/catalyst_crew"),
    ghost_dir=Path("/Users/aadityaagarwal/Downloads/Offline_testing/catalyst_crew/.ghost"),
)

# Test language detection
from ghost_pm.graph_parser import detect_language
test("Language detection: .py → python", detect_language("src/auth.py") == "python")
test("Language detection: .ts → typescript", detect_language("frontend/App.tsx") == "typescript")
test("Language detection: .rs → rust", detect_language("engine/core.rs") == "rust")
test("Language detection: .go → go", detect_language("server/main.go") == "go")
test("Language detection: .java → java", detect_language("Backend.java") == "java")

# Test summary building from empty (no graphify output)
empty_summary = parser.build_summary(run_graphify=False)
test("Empty graph summary returns zeros",
     empty_summary.total_nodes == 0 and empty_summary.total_functions == 0)

# ══════════════════════════════════════════════════════
# FINAL SUMMARY
# ══════════════════════════════════════════════════════
print(f"\n{'=' * 60}")
print(f"  RESULTS: {passed} passed, {failed} failed, {passed + failed} total")
print(f"  Room ID: {room_id}")
print(f"{'=' * 60}")

if failed > 0:
    print(f"\n  ⚠️  {failed} test(s) FAILED — see above for details")
    sys.exit(1)
else:
    print(f"\n  🎉 ALL {passed} TESTS PASSED!")
    print(f"\n  Dashboard URL: test_ui/index.html?room={room_id}")
    print(f"  CLI Join: ghostpm join {room_id}")
    sys.exit(0)