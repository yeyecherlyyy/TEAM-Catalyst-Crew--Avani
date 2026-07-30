-- ============================================================
-- GHOST PM — Full Database Schema
-- Run this in Supabase SQL Editor (Dashboard → SQL Editor → New query)
-- ============================================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "vector";

-- ============================================================
-- ENUMS
-- ============================================================
CREATE TYPE team_role AS ENUM ('owner', 'member');
CREATE TYPE hackathon_format AS ENUM (
  'ideathon', 'prototype_build', 'ppt_presentation',
  'build_pitch_hybrid', 'research_innovation', 'mixed'
);
CREATE TYPE duration_bracket AS ENUM ('lt_8hrs', '24hrs', '36_48hrs', 'multi_week');
CREATE TYPE artifact_type AS ENUM (
  'scorecard', 'comparison_table', 'roadmap', 'flowchart',
  'brief', 'nudge', 'resource_list', 'schedule', 'code', 'note'
);
CREATE TYPE nudge_severity AS ENUM ('info', 'warning', 'critical');
CREATE TYPE task_status AS ENUM ('not_started', 'in_progress', 'done', 'cut');
CREATE TYPE notification_type AS ENUM (
  'nudge', 'score_update', 'schedule_alert', 'team_join', 'general'
);
CREATE TYPE brainstorm_classification AS ENUM (
  'on_track', 'productive_tangent', 'circular', 'derailed', 'out_of_scope'
);

-- ============================================================
-- TEAMS
-- ============================================================
CREATE TABLE teams (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  team_code TEXT NOT NULL UNIQUE,
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  hackathon_format hackathon_format,
  duration_bracket duration_bracket,
  duration_hours NUMERIC,
  team_skills JSONB DEFAULT '{}',
  judging_emphasis JSONB DEFAULT '[]',
  tech_constraints TEXT,
  onboarding_complete BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_teams_code ON teams(team_code);
CREATE INDEX idx_teams_owner ON teams(owner_id);

-- ============================================================
-- TEAM MEMBERS
-- ============================================================
CREATE TABLE team_members (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role team_role NOT NULL DEFAULT 'member',
  joined_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(team_id, user_id)
);

CREATE INDEX idx_team_members_team ON team_members(team_id);
CREATE INDEX idx_team_members_user ON team_members(user_id);

-- ============================================================
-- PROBLEM STATEMENTS
-- ============================================================
CREATE TABLE problem_statements (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  is_selected BOOLEAN DEFAULT FALSE,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_problem_statements_team ON problem_statements(team_id);

-- ============================================================
-- RATINGS (6-axis scoring)
-- ============================================================
CREATE TABLE ratings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  problem_statement_id UUID NOT NULL REFERENCES problem_statements(id) ON DELETE CASCADE,
  team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  uniqueness NUMERIC NOT NULL CHECK (uniqueness >= 1 AND uniqueness <= 10),
  innovation NUMERIC NOT NULL CHECK (innovation >= 1 AND innovation <= 10),
  scalability NUMERIC NOT NULL CHECK (scalability >= 1 AND scalability <= 10),
  feasibility NUMERIC NOT NULL CHECK (feasibility >= 1 AND feasibility <= 10),
  competition NUMERIC NOT NULL CHECK (competition >= 1 AND competition <= 10),
  judging_fit NUMERIC NOT NULL CHECK (judging_fit >= 1 AND judging_fit <= 10),
  composite NUMERIC NOT NULL,
  justifications JSONB NOT NULL DEFAULT '{}',
  weighting_profile JSONB NOT NULL DEFAULT '{}',
  prior_art JSONB DEFAULT '[]',
  recommendation TEXT,
  version INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_ratings_problem ON ratings(problem_statement_id);
CREATE INDEX idx_ratings_team ON ratings(team_id);

-- ============================================================
-- IDEAS (versioned snapshots)
-- ============================================================
CREATE TABLE ideas (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  problem_statement_id UUID REFERENCES problem_statements(id),
  title TEXT NOT NULL,
  description TEXT,
  version INTEGER NOT NULL DEFAULT 1,
  parent_idea_id UUID REFERENCES ideas(id),
  differentiation_notes TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_ideas_team ON ideas(team_id);

-- ============================================================
-- BRAINSTORM SESSIONS
-- ============================================================
CREATE TABLE brainstorm_sessions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  anchor_text TEXT,
  anchor_embedding vector(768),
  idea_id UUID REFERENCES ideas(id),
  is_active BOOLEAN DEFAULT TRUE,
  message_count INTEGER DEFAULT 0,
  last_drift_check_at TIMESTAMPTZ,
  last_classification brainstorm_classification,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_brainstorm_sessions_team ON brainstorm_sessions(team_id);

-- ============================================================
-- BRAINSTORM MESSAGES
-- ============================================================
CREATE TABLE brainstorm_messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_id UUID NOT NULL REFERENCES brainstorm_sessions(id) ON DELETE CASCADE,
  team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id),
  is_ai BOOLEAN DEFAULT FALSE,
  content TEXT NOT NULL,
  parent_message_id UUID REFERENCES brainstorm_messages(id),
  reactions JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_brainstorm_messages_session ON brainstorm_messages(session_id);
CREATE INDEX idx_brainstorm_messages_team ON brainstorm_messages(team_id);

-- ============================================================
-- NUDGES
-- ============================================================
CREATE TABLE nudges (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  session_id UUID REFERENCES brainstorm_sessions(id) ON DELETE CASCADE,
  reason TEXT NOT NULL,
  severity nudge_severity DEFAULT 'info',
  suggestion TEXT,
  is_dismissed BOOLEAN DEFAULT FALSE,
  dismissed_by UUID REFERENCES auth.users(id),
  dismissed_at TIMESTAMPTZ,
  pivot_accepted BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_nudges_team ON nudges(team_id);
CREATE INDEX idx_nudges_session ON nudges(session_id);

-- ============================================================
-- ROADMAPS
-- ============================================================
CREATE TABLE roadmaps (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  idea_id UUID REFERENCES ideas(id),
  title TEXT NOT NULL,
  phases JSONB NOT NULL DEFAULT '[]',
  total_predicted_hours NUMERIC,
  version INTEGER DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_roadmaps_team ON roadmaps(team_id);

-- ============================================================
-- ROADMAP TASKS
-- ============================================================
CREATE TABLE roadmap_tasks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  roadmap_id UUID NOT NULL REFERENCES roadmaps(id) ON DELETE CASCADE,
  team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  phase_index INTEGER NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  predicted_hours NUMERIC,
  status task_status DEFAULT 'not_started',
  assigned_to UUID REFERENCES auth.users(id),
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_roadmap_tasks_roadmap ON roadmap_tasks(roadmap_id);

-- ============================================================
-- PROGRESS CHECK-INS
-- ============================================================
CREATE TABLE progress_checkins (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  roadmap_id UUID REFERENCES roadmaps(id),
  predicted_percent NUMERIC,
  actual_percent NUMERIC NOT NULL,
  notes TEXT,
  checked_in_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_progress_checkins_team ON progress_checkins(team_id);

-- ============================================================
-- NOTIFICATIONS
-- ============================================================
CREATE TABLE notifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type notification_type DEFAULT 'general',
  title TEXT NOT NULL,
  body TEXT,
  link TEXT,
  is_read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_notifications_user ON notifications(user_id);
CREATE INDEX idx_notifications_unread ON notifications(user_id, is_read) WHERE NOT is_read;

-- ============================================================
-- SHARED DOCUMENTS
-- ============================================================
CREATE TABLE shared_documents (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  title TEXT NOT NULL DEFAULT 'Untitled',
  content JSONB DEFAULT '{}',
  last_edited_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_shared_documents_team ON shared_documents(team_id);

-- ============================================================
-- RESOURCES (global + team-specific)
-- ============================================================
CREATE TABLE resources (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  team_id UUID REFERENCES teams(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  url TEXT NOT NULL,
  description TEXT,
  category TEXT,
  tags TEXT[] DEFAULT '{}',
  is_global BOOLEAN DEFAULT FALSE,
  added_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_resources_team ON resources(team_id);
CREATE INDEX idx_resources_global ON resources(is_global) WHERE is_global = TRUE;

-- ============================================================
-- ARTIFACTS (versioned, generic store)
-- ============================================================
CREATE TABLE artifacts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  session_id UUID REFERENCES brainstorm_sessions(id),
  idea_id UUID REFERENCES ideas(id),
  artifact_type artifact_type NOT NULL,
  title TEXT NOT NULL,
  version INTEGER NOT NULL DEFAULT 1,
  content JSONB NOT NULL DEFAULT '{}',
  superseded_by UUID REFERENCES artifacts(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_artifacts_team ON artifacts(team_id);
CREATE INDEX idx_artifacts_type ON artifacts(team_id, artifact_type);
CREATE INDEX idx_artifacts_session ON artifacts(session_id);

-- ============================================================
-- ROW LEVEL SECURITY POLICIES
-- ============================================================

-- Helper function: check team membership
CREATE OR REPLACE FUNCTION is_team_member(check_team_id UUID)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM team_members
    WHERE team_id = check_team_id AND user_id = auth.uid()
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Check team ownership
CREATE OR REPLACE FUNCTION is_team_owner(check_team_id UUID)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM team_members
    WHERE team_id = check_team_id AND user_id = auth.uid() AND role = 'owner'
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Securely join a team by code
CREATE OR REPLACE FUNCTION join_team_by_code(p_team_code TEXT)
RETURNS UUID AS $$
DECLARE
  v_team_id UUID;
BEGIN
  -- Find the team (runs as SECURITY DEFINER so it bypasses RLS)
  SELECT id INTO v_team_id FROM teams WHERE team_code = p_team_code;
  
  IF v_team_id IS NOT NULL THEN
    -- Insert into team_members if not already there
    INSERT INTO team_members (team_id, user_id, role)
    VALUES (v_team_id, auth.uid(), 'member')
    ON CONFLICT (team_id, user_id) DO NOTHING;
    
    RETURN v_team_id;
  END IF;
  
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- TEAMS
ALTER TABLE teams ENABLE ROW LEVEL SECURITY;
CREATE POLICY "teams_select" ON teams FOR SELECT USING (
  auth.uid() = owner_id OR is_team_member(id)
);
CREATE POLICY "teams_insert" ON teams FOR INSERT WITH CHECK (true);
CREATE POLICY "teams_update" ON teams FOR UPDATE USING (is_team_owner(id));

-- TEAM MEMBERS
ALTER TABLE team_members ENABLE ROW LEVEL SECURITY;
CREATE POLICY "members_select" ON team_members FOR SELECT USING (is_team_member(team_id));
CREATE POLICY "members_insert" ON team_members FOR INSERT WITH CHECK (
  auth.uid() = user_id OR is_team_owner(team_id)
);
CREATE POLICY "members_delete" ON team_members FOR DELETE USING (
  auth.uid() = user_id OR is_team_owner(team_id)
);

-- Apply team-scoped RLS to all data tables
DO $$
DECLARE
  tbl TEXT;
BEGIN
  FOR tbl IN
    SELECT unnest(ARRAY[
      'problem_statements', 'ratings', 'ideas',
      'brainstorm_sessions', 'brainstorm_messages', 'nudges',
      'roadmaps', 'roadmap_tasks', 'progress_checkins',
      'shared_documents', 'artifacts'
    ])
  LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', tbl);
    EXECUTE format(
      'CREATE POLICY "%s_select" ON %I FOR SELECT USING (is_team_member(team_id))',
      tbl, tbl
    );
    EXECUTE format(
      'CREATE POLICY "%s_insert" ON %I FOR INSERT WITH CHECK (is_team_member(team_id))',
      tbl, tbl
    );
    EXECUTE format(
      'CREATE POLICY "%s_update" ON %I FOR UPDATE USING (is_team_member(team_id))',
      tbl, tbl
    );
    EXECUTE format(
      'CREATE POLICY "%s_delete" ON %I FOR DELETE USING (is_team_member(team_id))',
      tbl, tbl
    );
  END LOOP;
END $$;

-- NOTIFICATIONS
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "notifications_select" ON notifications FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "notifications_update" ON notifications FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "notifications_insert" ON notifications FOR INSERT WITH CHECK (is_team_member(team_id));

-- RESOURCES (global readable by all, team-scoped by membership)
ALTER TABLE resources ENABLE ROW LEVEL SECURITY;
CREATE POLICY "resources_select" ON resources FOR SELECT USING (
  is_global = TRUE OR team_id IS NULL OR is_team_member(team_id)
);
CREATE POLICY "resources_insert" ON resources FOR INSERT WITH CHECK (
  team_id IS NULL OR is_team_member(team_id)
);
CREATE POLICY "resources_update" ON resources FOR UPDATE USING (
  team_id IS NOT NULL AND is_team_member(team_id)
);
CREATE POLICY "resources_delete" ON resources FOR DELETE USING (
  team_id IS NOT NULL AND is_team_member(team_id)
);

-- ============================================================
-- FUNCTIONS
-- ============================================================

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER teams_updated_at BEFORE UPDATE ON teams
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER brainstorm_sessions_updated_at BEFORE UPDATE ON brainstorm_sessions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER shared_documents_updated_at BEFORE UPDATE ON shared_documents
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Increment message count on brainstorm sessions
CREATE OR REPLACE FUNCTION increment_message_count()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE brainstorm_sessions
  SET message_count = message_count + 1, updated_at = NOW()
  WHERE id = NEW.session_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER brainstorm_message_count AFTER INSERT ON brainstorm_messages
  FOR EACH ROW EXECUTE FUNCTION increment_message_count();

-- ============================================================
-- SEED: Global Resources
-- ============================================================
INSERT INTO resources (name, url, description, category, tags, is_global) VALUES
  ('Figma', 'https://figma.com', 'Collaborative design tool', 'Design', ARRAY['design', 'ui', 'prototyping'], TRUE),
  ('GitHub', 'https://github.com', 'Code hosting and collaboration', 'Development', ARRAY['code', 'git', 'version-control'], TRUE),
  ('Vercel', 'https://vercel.com', 'Frontend deployment platform', 'Deployment', ARRAY['hosting', 'deploy', 'frontend'], TRUE),
  ('Supabase', 'https://supabase.com', 'Backend as a service', 'Backend', ARRAY['database', 'auth', 'api'], TRUE),
  ('Excalidraw', 'https://excalidraw.com', 'Virtual whiteboard for sketching', 'Design', ARRAY['whiteboard', 'diagram', 'sketch'], TRUE),
  ('Notion', 'https://notion.so', 'Documentation and notes', 'Productivity', ARRAY['docs', 'wiki', 'notes'], TRUE),
  ('Miro', 'https://miro.com', 'Online collaborative whiteboard', 'Collaboration', ARRAY['whiteboard', 'brainstorm', 'sticky-notes'], TRUE),
  ('DevPost', 'https://devpost.com', 'Hackathon project submission', 'Hackathon', ARRAY['submission', 'showcase', 'portfolio'], TRUE),
  ('Canva', 'https://canva.com', 'Presentation and graphic design', 'Design', ARRAY['presentation', 'graphics', 'slides'], TRUE),
  ('Postman', 'https://postman.com', 'API testing and documentation', 'Development', ARRAY['api', 'testing', 'docs'], TRUE);

-- ============================================================
-- SHARED RESOURCES
-- ============================================================
CREATE TABLE shared_resources (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  url TEXT NOT NULL,
  description TEXT,
  added_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE shared_resources ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Team members can manage shared resources"
  ON shared_resources FOR ALL USING (
    team_id IN (SELECT team_id FROM team_members WHERE user_id = auth.uid())
  );

-- ============================================================
-- Enable Realtime for collaborative features
-- ============================================================
ALTER PUBLICATION supabase_realtime ADD TABLE brainstorm_messages;
ALTER PUBLICATION supabase_realtime ADD TABLE shared_documents;
ALTER PUBLICATION supabase_realtime ADD TABLE nudges;
ALTER PUBLICATION supabase_realtime ADD TABLE notifications;
ALTER PUBLICATION supabase_realtime ADD TABLE team_members;
ALTER PUBLICATION supabase_realtime ADD TABLE shared_resources;

