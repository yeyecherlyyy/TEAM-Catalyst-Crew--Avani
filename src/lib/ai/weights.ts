// ============================================================
// GHOST PM — Rating Weight Configuration (Section 4.2)
// ============================================================

import type { HackathonFormat, WeightProfile } from '@/lib/types';

/**
 * Default weight profiles per hackathon format.
 * Weights sum to 1.0. Competition is inverted in composite calculation.
 */
export const DEFAULT_WEIGHTS: Record<HackathonFormat, WeightProfile> = {
  ideathon: {
    uniqueness: 0.25,
    innovation: 0.30,
    scalability: 0.10,
    feasibility: 0.05,
    competition: 0.10,
    judging_fit: 0.20,
  },
  prototype_build: {
    uniqueness: 0.10,
    innovation: 0.10,
    scalability: 0.20,
    feasibility: 0.35,
    competition: 0.10,
    judging_fit: 0.15,
  },
  ppt_presentation: {
    uniqueness: 0.15,
    innovation: 0.20,
    scalability: 0.15,
    feasibility: 0.05,
    competition: 0.10,
    judging_fit: 0.35,
  },
  build_pitch_hybrid: {
    uniqueness: 0.15,
    innovation: 0.15,
    scalability: 0.15,
    feasibility: 0.25,
    competition: 0.10,
    judging_fit: 0.20,
  },
  research_innovation: {
    uniqueness: 0.30,
    innovation: 0.30,
    scalability: 0.15,
    feasibility: 0.05,
    competition: 0.05,
    judging_fit: 0.15,
  },
  mixed: {
    uniqueness: 0.18,
    innovation: 0.18,
    scalability: 0.16,
    feasibility: 0.18,
    competition: 0.12,
    judging_fit: 0.18,
  },
};

/**
 * Calculate composite score using weighted average with competition inversion.
 * Competition is inverted: w_c × (10 − competition_score)
 */
export function calculateComposite(
  scores: {
    uniqueness: number;
    innovation: number;
    scalability: number;
    feasibility: number;
    competition: number;
    judging_fit: number;
  },
  weights: WeightProfile
): number {
  const composite =
    weights.uniqueness * scores.uniqueness +
    weights.innovation * scores.innovation +
    weights.scalability * scores.scalability +
    weights.feasibility * scores.feasibility +
    weights.competition * (10 - scores.competition) + // Invert competition
    weights.judging_fit * scores.judging_fit;

  return Math.round(composite * 100) / 100;
}

/**
 * Get weight profile for a hackathon format, falling back to 'mixed'.
 */
export function getWeights(format: HackathonFormat | null): WeightProfile {
  return DEFAULT_WEIGHTS[format ?? 'mixed'];
}
