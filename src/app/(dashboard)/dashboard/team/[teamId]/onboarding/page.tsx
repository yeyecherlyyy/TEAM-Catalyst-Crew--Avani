'use client';

import { use, useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { useOnboarding } from '@/hooks/use-onboarding';
import {
  Sparkles, ArrowRight, ArrowLeft, Check, Loader2,
  Zap, Clock, Users, Trophy, Wrench,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  HACKATHON_FORMAT_LABELS,
  DURATION_LABELS,
  JUDGING_EMPHASIS_OPTIONS,
} from '@/lib/constants';
import type { HackathonFormat, DurationBracket } from '@/lib/types';

const DURATION_HOURS: Record<string, number> = {
  lt_8hrs: 6,
  '24hrs': 24,
  '36_48hrs': 42,
  multi_week: 168,
};

const STEP_ICONS = [Zap, Clock, Users, Trophy, Wrench];

export default function OnboardingPage({
  params,
}: {
  params: Promise<{ teamId: string }>;
}) {
  const { teamId } = use(params);
  const router = useRouter();
  const [saving, setSaving] = useState(false);

  const {
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
  } = useOnboarding();

  const handleFinish = async () => {
    setSaving(true);
    const res = await fetch(`/api/teams/${teamId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        hackathon_format: state.hackathon_format,
        duration_bracket: state.duration_bracket,
        duration_hours: state.duration_hours || DURATION_HOURS[state.duration_bracket || '24hrs'],
        team_skills: state.team_skills,
        judging_emphasis: state.judging_emphasis,
        tech_constraints: state.tech_constraints || null,
        onboarding_complete: true,
      }),
    });

    if (res.ok) {
      router.push(`/dashboard/team/${teamId}`);
      router.refresh();
    } else {
      setSaving(false);
    }
  };

  const isLastStep = state.step === totalSteps - 1;

  return (
    <div className="max-w-2xl mx-auto animate-fade-in">
      {/* Progress Bar */}
      <div className="flex items-center gap-2 mb-8">
        {Array.from({ length: totalSteps }).map((_, i) => (
          <div key={i} className="flex-1 flex items-center gap-2">
            <div
              className={cn(
                'w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0 transition-all duration-300',
                i < state.step
                  ? 'gradient-primary text-white glow-sm'
                  : i === state.step
                  ? 'border-2 border-violet-500 text-violet-400'
                  : 'border border-border text-muted-foreground'
              )}
            >
              {i < state.step ? <Check className="w-3.5 h-3.5" /> : i + 1}
            </div>
            {i < totalSteps - 1 && (
              <div className={cn('flex-1 h-0.5 rounded-full transition-colors duration-300', i < state.step ? 'bg-violet-500' : 'bg-border')} />
            )}
          </div>
        ))}
      </div>

      {/* Step Content */}
      <AnimatePresence mode="wait">
        <motion.div
          key={state.step}
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -20 }}
          transition={{ duration: 0.3 }}
          className="card-elevated p-8"
        >
          {/* Step 0: Hackathon Format */}
          {state.step === 0 && (
            <div>
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 rounded-xl bg-violet-500/10 flex items-center justify-center">
                  <Zap className="w-5 h-5 text-violet-400" />
                </div>
                <div>
                  <h2 className="text-xl font-bold">Hackathon Format</h2>
                  <p className="text-sm text-muted-foreground">What type of hackathon are you in?</p>
                </div>
              </div>
              <div className="grid sm:grid-cols-2 gap-3">
                {Object.entries(HACKATHON_FORMAT_LABELS).map(([key, label]) => (
                  <button
                    key={key}
                    onClick={() => setFormat(key as HackathonFormat)}
                    className={cn(
                      'p-4 rounded-xl border text-left transition-all duration-200',
                      state.hackathon_format === key
                        ? 'border-violet-500 bg-violet-500/10 text-violet-300'
                        : 'border-border hover:border-violet-500/30 hover:bg-secondary'
                    )}
                  >
                    <p className="font-medium text-sm">{label}</p>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Step 1: Duration */}
          {state.step === 1 && (
            <div>
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center">
                  <Clock className="w-5 h-5 text-blue-400" />
                </div>
                <div>
                  <h2 className="text-xl font-bold">Duration</h2>
                  <p className="text-sm text-muted-foreground">How long is your hackathon?</p>
                </div>
              </div>
              <div className="grid sm:grid-cols-2 gap-3">
                {Object.entries(DURATION_LABELS).map(([key, label]) => (
                  <button
                    key={key}
                    onClick={() => setDuration(key as DurationBracket, DURATION_HOURS[key])}
                    className={cn(
                      'p-4 rounded-xl border text-left transition-all duration-200',
                      state.duration_bracket === key
                        ? 'border-blue-500 bg-blue-500/10 text-blue-300'
                        : 'border-border hover:border-blue-500/30 hover:bg-secondary'
                    )}
                  >
                    <p className="font-medium text-sm">{label}</p>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Step 2: Team Skills */}
          {state.step === 2 && (
            <div>
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center">
                  <Users className="w-5 h-5 text-emerald-400" />
                </div>
                <div>
                  <h2 className="text-xl font-bold">Team Composition</h2>
                  <p className="text-sm text-muted-foreground">How many people in each role?</p>
                </div>
              </div>
              <div className="space-y-4">
                {[
                  { key: 'devs', label: 'Developers' },
                  { key: 'designers', label: 'Designers' },
                  { key: 'pms', label: 'PMs / Business' },
                  { key: 'other', label: 'Other' },
                ].map((role) => (
                  <div key={role.key} className="flex items-center justify-between p-3 rounded-lg border border-border">
                    <span className="text-sm font-medium">{role.label}</span>
                    <div className="flex items-center gap-3">
                      <button
                        onClick={() =>
                          setSkills({
                            ...state.team_skills,
                            [role.key]: Math.max(0, (state.team_skills[role.key as keyof typeof state.team_skills] || 0) - 1),
                          })
                        }
                        className="w-8 h-8 rounded-lg border border-border hover:bg-secondary flex items-center justify-center text-lg transition-colors"
                      >
                        −
                      </button>
                      <span className="w-8 text-center font-mono font-bold">
                        {state.team_skills[role.key as keyof typeof state.team_skills] || 0}
                      </span>
                      <button
                        onClick={() =>
                          setSkills({
                            ...state.team_skills,
                            [role.key]: (state.team_skills[role.key as keyof typeof state.team_skills] || 0) + 1,
                          })
                        }
                        className="w-8 h-8 rounded-lg border border-border hover:bg-secondary flex items-center justify-center text-lg transition-colors"
                      >
                        +
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Step 3: Judging Emphasis */}
          {state.step === 3 && (
            <div>
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 rounded-xl bg-amber-500/10 flex items-center justify-center">
                  <Trophy className="w-5 h-5 text-amber-400" />
                </div>
                <div>
                  <h2 className="text-xl font-bold">Judging Emphasis</h2>
                  <p className="text-sm text-muted-foreground">What do the judges prioritize? Select all that apply.</p>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                {JUDGING_EMPHASIS_OPTIONS.map((option) => (
                  <button
                    key={option}
                    onClick={() => toggleJudgingEmphasis(option)}
                    className={cn(
                      'px-4 py-2 rounded-full text-sm font-medium border transition-all duration-200',
                      state.judging_emphasis.includes(option)
                        ? 'border-amber-500 bg-amber-500/10 text-amber-300'
                        : 'border-border hover:border-amber-500/30 text-muted-foreground hover:text-foreground'
                    )}
                  >
                    {state.judging_emphasis.includes(option) && (
                      <Check className="w-3 h-3 inline mr-1.5" />
                    )}
                    {option}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Step 4: Tech Constraints */}
          {state.step === 4 && (
            <div>
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 rounded-xl bg-rose-500/10 flex items-center justify-center">
                  <Wrench className="w-5 h-5 text-rose-400" />
                </div>
                <div>
                  <h2 className="text-xl font-bold">Tech Constraints</h2>
                  <p className="text-sm text-muted-foreground">Any required technologies, sponsor APIs, or domain restrictions? (Optional)</p>
                </div>
              </div>
              <textarea
                value={state.tech_constraints}
                onChange={(e) => setTechConstraints(e.target.value)}
                placeholder="e.g. Must use React, AWS credits provided, healthcare domain only..."
                rows={4}
                className="w-full px-4 py-3 text-sm bg-input border border-border rounded-lg focus:ring-2 focus:ring-ring focus:border-transparent outline-none transition-all placeholder:text-muted-foreground resize-none"
              />
            </div>
          )}

          {/* Navigation */}
          <div className="flex items-center justify-between mt-8 pt-6 border-t border-border">
            <button
              onClick={prevStep}
              disabled={state.step === 0}
              className="flex items-center gap-2 px-4 py-2 text-sm text-muted-foreground hover:text-foreground disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              Back
            </button>

            {isLastStep ? (
              <button
                onClick={handleFinish}
                disabled={saving}
                className="flex items-center gap-2 px-6 py-2.5 text-sm font-semibold text-white rounded-lg gradient-primary hover:opacity-90 transition-opacity disabled:opacity-50"
              >
                {saving ? (
                  <><Loader2 className="w-4 h-4 animate-spin" /> Saving...</>
                ) : (
                  <><Sparkles className="w-4 h-4" /> Launch Team</>
                )}
              </button>
            ) : (
              <button
                onClick={nextStep}
                disabled={!canProceed()}
                className="flex items-center gap-2 px-6 py-2.5 text-sm font-semibold text-white rounded-lg gradient-primary hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Continue
                <ArrowRight className="w-4 h-4" />
              </button>
            )}
          </div>
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
