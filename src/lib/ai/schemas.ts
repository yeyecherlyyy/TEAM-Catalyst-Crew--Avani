// ============================================================
// GHOST PM — Zod Schemas for Artifact Validation
// ============================================================

import { z } from 'zod';

// ---- Score range ----
const score = z.number().min(1).max(10);

// ---- Individual Artifact Schemas ----

export const ScorecardSchema = z.object({
  axes: z.array(
    z.object({
      name: z.string(),
      score: score,
      justification: z.string(),
    })
  ).min(6).max(6),
  composite: z.number().min(0).max(10),
  recommendation: z.string(),
  weighting_profile: z.object({
    uniqueness: z.number(),
    innovation: z.number(),
    scalability: z.number(),
    feasibility: z.number(),
    competition: z.number(),
    judging_fit: z.number(),
  }),
});

export const ComparisonTableSchema = z.object({
  columns: z.array(z.string()),
  rows: z.array(
    z.object({
      label: z.string(),
      values: z.array(z.union([z.string(), z.number()])),
      highlight: z.boolean().optional(),
    })
  ),
  sort_by: z.string().optional(),
});

export const RoadmapSchema = z.object({
  phases: z.array(
    z.object({
      name: z.string(),
      description: z.string(),
      predicted_hours: z.number(),
      tasks: z.array(
        z.object({
          title: z.string(),
          description: z.string().optional(),
          predicted_hours: z.number().optional(),
        })
      ),
    })
  ),
  total_hours: z.number(),
});

export const FlowchartSchema = z.object({
  mermaid_source: z.string(),
  description: z.string().optional(),
});

export const BriefSchema = z.object({
  problem: z.string(),
  solution: z.string(),
  target_users: z.string(),
  tech_stack: z.array(z.string()),
  key_features: z.array(z.string()),
  differentiators: z.array(z.string()),
  risks: z.array(z.string()),
});

export const NudgeSchema = z.object({
  reason: z.string(),
  severity: z.enum(['info', 'warning', 'critical']),
  suggestion: z.string().optional(),
  classification: z.enum([
    'on_track', 'productive_tangent', 'circular', 'derailed', 'out_of_scope',
  ]),
  dismissible: z.boolean(),
});

export const ResourceListSchema = z.object({
  items: z.array(
    z.object({
      name: z.string(),
      url: z.string(),
      description: z.string().optional(),
      tags: z.array(z.string()).optional(),
    })
  ),
});

export const ScheduleSchema = z.object({
  predicted_curve: z.array(
    z.object({ hour: z.number(), percent: z.number() })
  ),
  actual_points: z.array(
    z.object({ hour: z.number(), percent: z.number() })
  ),
  deadline_hours: z.number(),
  status: z.enum(['ahead', 'on_track', 'behind']),
  gap_percent: z.number().optional(),
});

export const CodeSchema = z.object({
  language: z.string(),
  source: z.string(),
  filename: z.string().optional(),
});

export const NoteSchema = z.object({
  text: z.string(),
});

// ---- Artifact Type Map ----
export const ARTIFACT_SCHEMAS = {
  scorecard: ScorecardSchema,
  comparison_table: ComparisonTableSchema,
  roadmap: RoadmapSchema,
  flowchart: FlowchartSchema,
  brief: BriefSchema,
  nudge: NudgeSchema,
  resource_list: ResourceListSchema,
  schedule: ScheduleSchema,
  code: CodeSchema,
  note: NoteSchema,
} as const;

// ---- Response Envelope Schema ----
export const ArtifactEnvelopeItemSchema = z.object({
  id: z.string(),
  artifact_type: z.enum([
    'scorecard', 'comparison_table', 'roadmap', 'flowchart',
    'brief', 'nudge', 'resource_list', 'schedule', 'code', 'note',
  ]),
  title: z.string(),
  version: z.number().int().positive(),
  content: z.record(z.unknown()),
});

export const ResponseEnvelopeSchema = z.object({
  chat_reply: z.string(),
  artifacts: z.array(ArtifactEnvelopeItemSchema),
});

export type ResponseEnvelope = z.infer<typeof ResponseEnvelopeSchema>;
export type ArtifactEnvelopeItem = z.infer<typeof ArtifactEnvelopeItemSchema>;
