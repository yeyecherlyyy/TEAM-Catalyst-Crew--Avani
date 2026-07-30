// ============================================================
// GHOST PM — App Constants
// ============================================================

export const APP_NAME = 'GHOST PM';
export const APP_DESCRIPTION = 'AI-Powered Hackathon Copilot';
export const APP_TAGLINE = 'Rate. Brainstorm. Build. Ship.';

// ---- Join Code ----
export const JOIN_CODE_LENGTH = 6;
export const JOIN_CODE_ALPHABET = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ'; // No 0O1lI

// ---- Hackathon Format Labels ----
export const HACKATHON_FORMAT_LABELS: Record<string, string> = {
  ideathon: 'Ideathon',
  prototype_build: 'Prototype Build',
  ppt_presentation: 'PPT & Presentation',
  build_pitch_hybrid: 'Build + Pitch Hybrid',
  research_innovation: 'Research & Innovation',
  mixed: 'Mixed / Other',
};

// ---- Duration Labels ----
export const DURATION_LABELS: Record<string, string> = {
  lt_8hrs: 'Under 8 hours',
  '24hrs': '24 hours',
  '36_48hrs': '36–48 hours',
  multi_week: 'Multi-week',
};

// ---- Judging Emphasis Options ----
export const JUDGING_EMPHASIS_OPTIONS = [
  'Innovation',
  'Technical depth',
  'Business viability',
  'Social impact',
  'Polish & presentation',
  'User experience',
  'Scalability',
  'Creativity',
];

// ---- Rating Axes ----
export const RATING_AXES = [
  { key: 'uniqueness', label: 'Uniqueness', color: '#a78bfa' },
  { key: 'innovation', label: 'Innovation', color: '#818cf8' },
  { key: 'scalability', label: 'Scalability', color: '#6366f1' },
  { key: 'feasibility', label: 'Feasibility', color: '#34d399' },
  { key: 'competition', label: 'Competition', color: '#f59e0b' },
  { key: 'judging_fit', label: 'Judging Fit', color: '#f472b6' },
] as const;

// ---- Artifact Type Labels ----
export const ARTIFACT_TYPE_LABELS: Record<string, string> = {
  scorecard: 'Scorecard',
  comparison_table: 'Comparison Table',
  roadmap: 'Roadmap',
  flowchart: 'Flowchart',
  brief: 'Brief',
  nudge: 'Nudge',
  resource_list: 'Resource List',
  schedule: 'Schedule',
  code: 'Code',
  note: 'Note',
};

// ---- AI Config ----
export const AI_MODEL = 'gemini-2.5-flash';
export const AI_EMBEDDING_MODEL = 'gemini-embedding-001';
export const DRIFT_CHECK_INTERVAL = 5; // messages between drift checks
export const DRIFT_SIMILARITY_THRESHOLD = 0.7;

// ---- Realtime Channels ----
export const REALTIME_CHANNELS = {
  brainstorm: (teamId: string) => `brainstorm:${teamId}`,
  documents: (teamId: string) => `documents:${teamId}`,
  notifications: (userId: string) => `notifications:${userId}`,
  presence: (teamId: string) => `presence:${teamId}`,
} as const;

// ---- Navigation ----
export const TEAM_NAV_ITEMS = [
  { label: 'Overview', href: '', icon: 'LayoutDashboard' },
  { label: 'Advisor', href: '/advisor', icon: 'Brain' },
  { label: 'Brainstorm', href: '/brainstorm', icon: 'MessageSquare' },
  { label: 'Workspace', href: '/workspace', icon: 'FolderOpen' },
  { label: 'Progress', href: '/progress', icon: 'TrendingUp' },
  { label: 'Settings', href: '/settings', icon: 'Settings' },
] as const;
