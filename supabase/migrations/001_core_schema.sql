-- ============================================================
-- Ghost-PM Core Schema
-- 5 tables for: rooms, members, milestones, commits, code graph
-- Run this in your Supabase SQL Editor to set up the backend.
-- ============================================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "pgcrypto";


-- ──────────────────────────────────────────────────────────────
-- Helper: short ID generator for room codes (e.g., "abc-xyz-123")
-- ──────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION generate_room_id()
RETURNS TEXT AS $$
DECLARE
    chars TEXT := 'abcdefghijklmnopqrstuvwxyz0123456789';
    result TEXT := '';
    i INT;
    segment INT;
BEGIN
    -- Generate 3 segments of 3 characters separated by hyphens
    FOR segment IN 1..3 LOOP
        IF segment > 1 THEN
            result := result || '-';
        END IF;
        FOR i IN 1..3 LOOP
            result := result || substr(chars, floor(random() * length(chars) + 1)::int, 1);
        END LOOP;
    END LOOP;
    RETURN result;
END;
$$ LANGUAGE plpgsql;


-- ──────────────────────────────────────────────────────────────
-- Table 1: ROOMS
-- The hackathon workspace. Created via Web UI.
-- ──────────────────────────────────────────────────────────────
CREATE TABLE rooms (
    id TEXT PRIMARY KEY DEFAULT generate_room_id(),
    name TEXT NOT NULL,
    description TEXT DEFAULT '',
    tech_stack TEXT[] DEFAULT '{}',
    duration_hours INT DEFAULT 24,
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT now(),
    hackathon_start TIMESTAMPTZ DEFAULT now(),
    hackathon_end TIMESTAMPTZ DEFAULT (now() + INTERVAL '24 hours'),
    
    -- State
    panic_mode BOOLEAN DEFAULT false,
    active_milestone_id INT,                    -- FK added after milestones table
    
    -- PRD (product requirements doc, set by init agent)
    prd JSONB DEFAULT '{}'::jsonb
);

-- Index for quick room lookups
CREATE INDEX idx_rooms_created_at ON rooms(created_at DESC);


-- ──────────────────────────────────────────────────────────────
-- Table 2: ROOM MEMBERS
-- Each connected terminal session registers here.
-- ──────────────────────────────────────────────────────────────
CREATE TABLE room_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    room_id TEXT NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
    
    -- Identity
    member_name TEXT NOT NULL,
    device_id TEXT DEFAULT '',                  -- Unique per terminal session
    
    -- Current activity (updated by daemon)
    current_file TEXT DEFAULT '',
    current_file_since TIMESTAMPTZ DEFAULT now(),
    current_milestone_id INT,
    idle_minutes INT DEFAULT 0,
    
    -- Productivity metrics
    total_commits INT DEFAULT 0,
    productive_minutes INT DEFAULT 0,
    distraction_score FLOAT DEFAULT 0.0,        -- 0.0 (focused) to 1.0 (distracted)
    
    -- Timestamps
    joined_at TIMESTAMPTZ DEFAULT now(),
    last_active TIMESTAMPTZ DEFAULT now(),
    is_online BOOLEAN DEFAULT true,
    
    -- Prevent duplicate member names per room
    UNIQUE(room_id, member_name)
);

-- Indexes
CREATE INDEX idx_members_room ON room_members(room_id);
CREATE INDEX idx_members_online ON room_members(room_id, is_online);


-- ──────────────────────────────────────────────────────────────
-- Table 3: MILESTONES
-- Progress tracking for the hackathon roadmap.
-- ──────────────────────────────────────────────────────────────
CREATE TABLE milestones (
    id SERIAL PRIMARY KEY,
    room_id TEXT NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
    
    -- Definition
    name TEXT NOT NULL,
    description TEXT DEFAULT '',
    order_index INT NOT NULL,                   -- Display order (1, 2, 3...)
    
    -- Status
    status TEXT DEFAULT 'pending'
        CHECK (status IN ('pending', 'active', 'completed')),
    progress_percent FLOAT DEFAULT 0.0,
    
    -- Expected scope (files/dirs this milestone should touch)
    files_expected TEXT[] DEFAULT '{}',
    
    -- Graph metrics (from graphify)
    functions_expected INT DEFAULT 0,
    functions_implemented INT DEFAULT 0,
    
    -- Timestamps
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    
    UNIQUE(room_id, order_index)
);

CREATE INDEX idx_milestones_room ON milestones(room_id);
CREATE INDEX idx_milestones_status ON milestones(room_id, status);


-- ──────────────────────────────────────────────────────────────
-- Table 4: COMMITS
-- Every git commit tracked with scope verdict and code graph delta.
-- ──────────────────────────────────────────────────────────────
CREATE TABLE commits (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    room_id TEXT NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
    
    -- Who and when
    member_name TEXT NOT NULL,
    committed_at TIMESTAMPTZ DEFAULT now(),
    
    -- Git data
    commit_hash TEXT DEFAULT '',
    message TEXT NOT NULL,
    files_changed TEXT[] DEFAULT '{}',
    insertions INT DEFAULT 0,
    deletions INT DEFAULT 0,
    
    -- Milestone association
    milestone_id INT REFERENCES milestones(id),
    
    -- Scope guard verdict (from AI agent)
    scope_verdict JSONB DEFAULT '{}'::jsonb,
    -- Example: {"allowed": true, "reason": "Matches active milestone", "severity": "info"}
    
    -- Code graph delta (what changed in the graph)
    functions_added TEXT[] DEFAULT '{}',
    functions_modified TEXT[] DEFAULT '{}',
    functions_removed TEXT[] DEFAULT '{}',
    graph_nodes_delta INT DEFAULT 0,            -- +/- nodes compared to previous
    graph_edges_delta INT DEFAULT 0             -- +/- edges compared to previous
);

CREATE INDEX idx_commits_room ON commits(room_id);
CREATE INDEX idx_commits_member ON commits(room_id, member_name);
CREATE INDEX idx_commits_milestone ON commits(milestone_id);
CREATE INDEX idx_commits_time ON commits(room_id, committed_at DESC);


-- ──────────────────────────────────────────────────────────────
-- Table 5: CODE GRAPH SNAPSHOTS
-- Periodic snapshots of the graphify output, synced to cloud.
-- This is what the LLM reads — never the raw code.
-- ──────────────────────────────────────────────────────────────
CREATE TABLE code_graph_snapshots (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    room_id TEXT NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
    member_name TEXT NOT NULL,
    
    -- Snapshot data
    snapshot_at TIMESTAMPTZ DEFAULT now(),
    
    -- Graph summary (compact version of graph.json for LLM consumption)
    total_nodes INT DEFAULT 0,
    total_edges INT DEFAULT 0,
    total_functions INT DEFAULT 0,
    total_files INT DEFAULT 0,
    
    -- Communities detected by graphify (clusters of related code)
    communities JSONB DEFAULT '[]'::jsonb,
    -- Example: [{"name": "auth", "files": ["auth.ts", "middleware.ts"], "functions": 8}]
    
    -- God nodes (over-connected components — risk indicators)
    god_nodes JSONB DEFAULT '[]'::jsonb,
    -- Example: [{"name": "utils.ts", "connections": 15, "risk": "high"}]
    
    -- Function status summary
    function_statuses JSONB DEFAULT '{}'::jsonb,
    -- Example: {"stub": 5, "in_progress": 8, "implemented": 12, "broken": 1}
    
    -- File-level summary
    file_summaries JSONB DEFAULT '[]'::jsonb,
    -- Example: [{"path": "src/auth.ts", "functions": 4, "status": "in_progress", "last_modifier": "Dev1"}]
    
    -- The full graph report (markdown, from graphify's GRAPH_REPORT.md)
    graph_report_md TEXT DEFAULT '',
    
    -- Active alerts generated from this snapshot
    alerts JSONB DEFAULT '[]'::jsonb
    -- Example: [{"type": "warning", "message": "auth.ts has 15 connections — consider splitting"}]
);

CREATE INDEX idx_snapshots_room ON code_graph_snapshots(room_id);
CREATE INDEX idx_snapshots_time ON code_graph_snapshots(room_id, snapshot_at DESC);
-- Only keep latest snapshot easily queryable
CREATE INDEX idx_snapshots_latest ON code_graph_snapshots(room_id, member_name, snapshot_at DESC);


-- ──────────────────────────────────────────────────────────────
-- ROW LEVEL SECURITY (RLS)
-- Ensures room data is only accessible to room members.
-- For the hackathon, we use a simple approach: the Supabase
-- anon key is shared within the team via the room link.
-- In production, you'd use proper auth + JWT claims.
-- ──────────────────────────────────────────────────────────────

-- Enable RLS on all tables
ALTER TABLE rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE room_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE milestones ENABLE ROW LEVEL SECURITY;
ALTER TABLE commits ENABLE ROW LEVEL SECURITY;
ALTER TABLE code_graph_snapshots ENABLE ROW LEVEL SECURITY;

-- For hackathon: allow all operations via anon key
-- In production, replace these with proper auth-based policies
CREATE POLICY "Allow all for rooms" ON rooms
    FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Allow all for room_members" ON room_members
    FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Allow all for milestones" ON milestones
    FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Allow all for commits" ON commits
    FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Allow all for code_graph_snapshots" ON code_graph_snapshots
    FOR ALL USING (true) WITH CHECK (true);


-- ──────────────────────────────────────────────────────────────
-- REALTIME: Enable realtime on tables that need live updates
-- ──────────────────────────────────────────────────────────────
-- Note: Enable these via Supabase Dashboard > Database > Replication
-- or uncomment the following if your Supabase version supports it:

-- ALTER PUBLICATION supabase_realtime ADD TABLE rooms;
-- ALTER PUBLICATION supabase_realtime ADD TABLE room_members;
-- ALTER PUBLICATION supabase_realtime ADD TABLE milestones;
-- ALTER PUBLICATION supabase_realtime ADD TABLE commits;
-- ALTER PUBLICATION supabase_realtime ADD TABLE code_graph_snapshots;


-- ──────────────────────────────────────────────────────────────
-- HELPER VIEWS
-- ──────────────────────────────────────────────────────────────

-- View: Room dashboard summary
CREATE OR REPLACE VIEW room_dashboard AS
SELECT
    r.id AS room_id,
    r.name AS room_name,
    r.hackathon_end - now() AS time_remaining,
    r.panic_mode,
    COUNT(DISTINCT rm.id) FILTER (WHERE rm.is_online) AS online_members,
    COUNT(DISTINCT m.id) FILTER (WHERE m.status = 'completed') AS completed_milestones,
    COUNT(DISTINCT m.id) AS total_milestones,
    COUNT(DISTINCT c.id) AS total_commits,
    COALESCE(
        (SELECT function_statuses FROM code_graph_snapshots
         WHERE room_id = r.id ORDER BY snapshot_at DESC LIMIT 1),
        '{}'::jsonb
    ) AS latest_function_statuses
FROM rooms r
LEFT JOIN room_members rm ON rm.room_id = r.id
LEFT JOIN milestones m ON m.room_id = r.id
LEFT JOIN commits c ON c.room_id = r.id
GROUP BY r.id;
