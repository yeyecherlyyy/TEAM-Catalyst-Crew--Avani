// ============================================================
// GHOST PM — Core Type Definitions
// ============================================================

// ---- Enums ----
export type TeamRole = 'owner' | 'member';

export type HackathonFormat =
  | 'ideathon'
  | 'prototype_build'
  | 'ppt_presentation'
  | 'build_pitch_hybrid'
  | 'research_innovation'
  | 'mixed';

export type DurationBracket = 'lt_8hrs' | '24hrs' | '36_48hrs' | 'multi_week';

export type ArtifactType =
  | 'scorecard'
  | 'comparison_table'
  | 'roadmap'
  | 'flowchart'
  | 'brief'
  | 'nudge'
  | 'resource_list'
  | 'schedule'
  | 'code'
  | 'note';

export type NudgeSeverity = 'info' | 'warning' | 'critical';
export type TaskStatus = 'not_started' | 'in_progress' | 'done' | 'cut';
export type NotificationType = 'nudge' | 'score_update' | 'schedule_alert' | 'team_join' | 'general';
export type BrainstormClassification = 'on_track' | 'productive_tangent' | 'circular' | 'derailed' | 'out_of_scope';

// ---- Database Row Types ----

export interface Team {
  id: string;
  name: string;
  team_code: string;
  owner_id: string;
  hackathon_format: HackathonFormat | null;
  duration_bracket: DurationBracket | null;
  duration_hours: number | null;
  team_skills: TeamSkills;
  judging_emphasis: string[];
  tech_constraints: string | null;
  onboarding_complete: boolean;
  created_at: string;
  updated_at: string;
}

export interface TeamSkills {
  devs?: number;
  designers?: number;
  pms?: number;
  other?: number;
}

export interface TeamMember {
  id: string;
  team_id: string;
  user_id: string;
  role: TeamRole;
  joined_at: string;
  // Joined user data
  user?: {
    email: string;
    user_metadata?: {
      full_name?: string;
      avatar_url?: string;
    };
  };
}

export interface ProblemStatement {
  id: string;
  team_id: string;
  title: string;
  description: string | null;
  is_selected: boolean;
  created_by: string | null;
  created_at: string;
  // Joined
  ratings?: Rating[];
}

export interface Rating {
  id: string;
  problem_statement_id: string;
  team_id: string;
  uniqueness: number;
  innovation: number;
  scalability: number;
  feasibility: number;
  competition: number;
  judging_fit: number;
  composite: number;
  justifications: RatingJustifications;
  weighting_profile: WeightProfile;
  prior_art: PriorArtItem[];
  recommendation: string | null;
  version: number;
  created_at: string;
}

export interface RatingJustifications {
  uniqueness: string;
  innovation: string;
  scalability: string;
  feasibility: string;
  competition: string;
  judging_fit: string;
  overall: string;
}

export interface WeightProfile {
  uniqueness: number;
  innovation: number;
  scalability: number;
  feasibility: number;
  competition: number;
  judging_fit: number;
}

export interface PriorArtItem {
  title: string;
  url: string;
  description: string;
  relevance: string;
}

export interface Idea {
  id: string;
  team_id: string;
  problem_statement_id: string | null;
  title: string;
  description: string | null;
  version: number;
  parent_idea_id: string | null;
  differentiation_notes: string | null;
  created_by: string | null;
  created_at: string;
}

export interface BrainstormSession {
  id: string;
  team_id: string;
  anchor_text: string | null;
  idea_id: string | null;
  is_active: boolean;
  message_count: number;
  last_drift_check_at: string | null;
  last_classification: BrainstormClassification | null;
  created_at: string;
  updated_at: string;
}

export interface BrainstormMessage {
  id: string;
  session_id: string;
  team_id: string;
  user_id: string | null;
  is_ai: boolean;
  content: string;
  parent_message_id: string | null;
  reactions: Record<string, string[]>;
  created_at: string;
}

export interface Nudge {
  id: string;
  team_id: string;
  session_id: string | null;
  reason: string;
  severity: NudgeSeverity;
  suggestion: string | null;
  is_dismissed: boolean;
  dismissed_by: string | null;
  dismissed_at: string | null;
  pivot_accepted: boolean;
  created_at: string;
}

export interface Roadmap {
  id: string;
  team_id: string;
  idea_id: string | null;
  title: string;
  phases: RoadmapPhase[];
  total_predicted_hours: number | null;
  version: number;
  created_at: string;
}

export interface RoadmapPhase {
  name: string;
  description: string;
  predicted_hours: number;
  tasks: string[];
}

export interface RoadmapTask {
  id: string;
  roadmap_id: string;
  team_id: string;
  phase_index: number;
  title: string;
  description: string | null;
  predicted_hours: number | null;
  status: TaskStatus;
  assigned_to: string | null;
  completed_at: string | null;
  created_at: string;
}

export interface ProgressCheckin {
  id: string;
  team_id: string;
  roadmap_id: string | null;
  predicted_percent: number | null;
  actual_percent: number;
  notes: string | null;
  checked_in_by: string | null;
  created_at: string;
}

export interface Notification {
  id: string;
  team_id: string;
  user_id: string;
  type: NotificationType;
  title: string;
  body: string | null;
  link: string | null;
  is_read: boolean;
  created_at: string;
}

export interface SharedDocument {
  id: string;
  team_id: string;
  title: string;
  content: Record<string, unknown>;
  last_edited_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface Resource {
  id: string;
  team_id: string | null;
  name: string;
  url: string;
  description: string | null;
  category: string | null;
  tags: string[];
  is_global: boolean;
  added_by: string | null;
  created_at: string;
}

export interface SharedResource {
  id: string;
  team_id: string;
  name: string;
  url: string;
  description: string | null;
  added_by: string | null;
  created_at: string;
}

export interface Artifact {
  id: string;
  team_id: string;
  session_id: string | null;
  idea_id: string | null;
  artifact_type: ArtifactType;
  title: string;
  version: number;
  content: Record<string, unknown>;
  superseded_by: string | null;
  created_at: string;
}

// ---- AI Response Envelope ----

export interface AIResponseEnvelope {
  chat_reply: string;
  artifacts: AIArtifact[];
}

export interface AIArtifact {
  id: string;
  artifact_type: ArtifactType;
  title: string;
  version: number;
  content: Record<string, unknown>;
}

// ---- Artifact Content Types ----

export interface ScorecardContent {
  axes: {
    name: string;
    score: number;
    justification: string;
  }[];
  composite: number;
  recommendation: string;
  weighting_profile: WeightProfile;
}

export interface ComparisonTableContent {
  columns: string[];
  rows: {
    label: string;
    values: (string | number)[];
    highlight?: boolean;
  }[];
  sort_by?: string;
}

export interface RoadmapContent {
  phases: {
    name: string;
    description: string;
    predicted_hours: number;
    tasks: {
      title: string;
      description?: string;
      predicted_hours?: number;
    }[];
  }[];
  total_hours: number;
}

export interface FlowchartContent {
  mermaid_source: string;
  description?: string;
}

export interface BriefContent {
  problem: string;
  solution: string;
  target_users: string;
  tech_stack: string[];
  key_features: string[];
  differentiators: string[];
  risks: string[];
}

export interface NudgeContent {
  reason: string;
  severity: NudgeSeverity;
  suggestion?: string;
  classification: BrainstormClassification;
  dismissible: boolean;
}

export interface ResourceListContent {
  items: {
    name: string;
    url: string;
    description?: string;
    tags?: string[];
  }[];
}

export interface ScheduleContent {
  predicted_curve: { hour: number; percent: number }[];
  actual_points: { hour: number; percent: number }[];
  deadline_hours: number;
  status: 'ahead' | 'on_track' | 'behind';
  gap_percent?: number;
}

export interface CodeContent {
  language: string;
  source: string;
  filename?: string;
}

export interface NoteContent {
  text: string;
}

// ---- UI State Types ----

export interface OnboardingState {
  step: number;
  hackathon_format: HackathonFormat | null;
  duration_bracket: DurationBracket | null;
  duration_hours: number | null;
  team_skills: TeamSkills;
  judging_emphasis: string[];
  tech_constraints: string;
}

export interface UserProfile {
  id: string;
  email: string;
  full_name?: string;
  avatar_url?: string;
}
