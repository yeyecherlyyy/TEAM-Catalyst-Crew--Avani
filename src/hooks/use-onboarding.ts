'use client';

import { useState, useCallback } from 'react';
import type { OnboardingState, HackathonFormat, DurationBracket, TeamSkills } from '@/lib/types';

const INITIAL_STATE: OnboardingState = {
  step: 0,
  hackathon_format: null,
  duration_bracket: null,
  duration_hours: null,
  team_skills: { devs: 0, designers: 0, pms: 0, other: 0 },
  judging_emphasis: [],
  tech_constraints: '',
};

export function useOnboarding() {
  const [state, setState] = useState<OnboardingState>(INITIAL_STATE);
  const totalSteps = 5;

  const setFormat = useCallback((format: HackathonFormat) => {
    setState((prev) => ({ ...prev, hackathon_format: format }));
  }, []);

  const setDuration = useCallback((bracket: DurationBracket, hours?: number) => {
    setState((prev) => ({
      ...prev,
      duration_bracket: bracket,
      duration_hours: hours || null,
    }));
  }, []);

  const setSkills = useCallback((skills: TeamSkills) => {
    setState((prev) => ({ ...prev, team_skills: skills }));
  }, []);

  const toggleJudgingEmphasis = useCallback((emphasis: string) => {
    setState((prev) => ({
      ...prev,
      judging_emphasis: prev.judging_emphasis.includes(emphasis)
        ? prev.judging_emphasis.filter((e) => e !== emphasis)
        : [...prev.judging_emphasis, emphasis],
    }));
  }, []);

  const setTechConstraints = useCallback((constraints: string) => {
    setState((prev) => ({ ...prev, tech_constraints: constraints }));
  }, []);

  const nextStep = useCallback(() => {
    setState((prev) => ({
      ...prev,
      step: Math.min(prev.step + 1, totalSteps - 1),
    }));
  }, []);

  const prevStep = useCallback(() => {
    setState((prev) => ({
      ...prev,
      step: Math.max(prev.step - 1, 0),
    }));
  }, []);

  const canProceed = useCallback(() => {
    switch (state.step) {
      case 0:
        return state.hackathon_format !== null;
      case 1:
        return state.duration_bracket !== null;
      case 2: {
        const total =
          (state.team_skills.devs || 0) +
          (state.team_skills.designers || 0) +
          (state.team_skills.pms || 0) +
          (state.team_skills.other || 0);
        return total > 0;
      }
      case 3:
        return state.judging_emphasis.length > 0;
      case 4:
        return true; // Tech constraints are optional
      default:
        return false;
    }
  }, [state]);

  const reset = useCallback(() => {
    setState(INITIAL_STATE);
  }, []);

  return {
    state,
    totalSteps,
    setFormat,
    setDuration,
    setSkills,
    toggleJudgingEmphasis,
    setTechConstraints,
    nextStep,
    prevStep,
    canProceed,
    reset,
  };
}
