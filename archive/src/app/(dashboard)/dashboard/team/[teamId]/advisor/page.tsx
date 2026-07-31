'use client';

import { use, useState, useEffect, useCallback } from 'react';
import { useTeam } from '@/hooks/use-team';
import { createClient } from '@/lib/supabase/client';
import { useAppStore } from '@/stores/app-store';
import {
  Plus, Brain, Loader2, Trash2, Star, Search,
  BarChart3, ChevronDown, ChevronUp, Sparkles,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { RATING_AXES } from '@/lib/constants';
import type { ProblemStatement, Rating, ScorecardContent } from '@/lib/types';
import {
  Radar, RadarChart, PolarGrid, PolarAngleAxis,
  PolarRadiusAxis, ResponsiveContainer, Tooltip,
} from 'recharts';

export default function AdvisorPage({
  params,
}: {
  params: Promise<{ teamId: string }>;
}) {
  const { teamId } = use(params);
  const { team } = useTeam(teamId);
  const { isAiLoading, setAiLoading, setAiLoadingMessage } = useAppStore();

  const [statements, setStatements] = useState<(ProblemStatement & { ratings?: Rating[] })[]>([]);
  const [newTitle, setNewTitle] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [showInput, setShowInput] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchStatements = useCallback(async () => {
    const supabase = createClient();
    const { data: ps } = await supabase
      .from('problem_statements')
      .select('*')
      .eq('team_id', teamId)
      .order('created_at', { ascending: false });

    if (ps) {
      const withRatings = await Promise.all(
        ps.map(async (p) => {
          const { data: ratings } = await supabase
            .from('ratings')
            .select('*')
            .eq('problem_statement_id', p.id)
            .order('version', { ascending: false })
            .limit(1);
          return { ...p, ratings: ratings || [] };
        })
      );
      setStatements(withRatings);
    }
    setLoading(false);
  }, [teamId]);

  useEffect(() => {
    fetchStatements();
  }, [fetchStatements]);

  const addStatement = async () => {
    if (!newTitle.trim()) return;
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    await supabase.from('problem_statements').insert({
      team_id: teamId,
      title: newTitle.trim(),
      description: newDesc.trim() || null,
      created_by: user?.id,
    });
    setNewTitle('');
    setNewDesc('');
    setShowInput(false);
    fetchStatements();
  };

  const deleteStatement = async (id: string) => {
    const supabase = createClient();
    await supabase.from('problem_statements').delete().eq('id', id);
    fetchStatements();
  };

  const rateStatement = async (ps: ProblemStatement) => {
    setAiLoading(true);
    setAiLoadingMessage(`Rating "${ps.title}"...`);

    try {
      // First, search for prior art
      let priorArt: Array<{ title: string; url: string; description: string }> = [];
      try {
        const searchRes = await fetch('/api/ai/search', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ query: ps.title }),
        });
        const searchData = await searchRes.json();
        priorArt = searchData.results || [];
      } catch {
        // Search is optional
      }

      const res = await fetch('/api/ai/rate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          teamId,
          problemStatementId: ps.id,
          title: ps.title,
          description: ps.description,
          priorArt,
        }),
      });

      if (res.ok) {
        fetchStatements();
      }
    } finally {
      setAiLoading(false);
      setAiLoadingMessage('');
    }
  };

  const rateAll = async () => {
    for (const ps of statements) {
      if (!ps.ratings || ps.ratings.length === 0) {
        await rateStatement(ps);
      }
    }
  };

  const getRadarData = (rating: Rating) => {
    return RATING_AXES.map((axis) => ({
      axis: axis.label,
      value: rating[axis.key as keyof Rating] as number,
      fullMark: 10,
    }));
  };

  return (
    <div className="animate-fade-in space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Brain className="w-6 h-6 text-violet-400" />
            Problem Statement Advisor
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Add statements and get AI-powered 6-axis scoring
          </p>
        </div>
        <div className="flex items-center gap-2">
          {statements.length > 1 && (
            <button
              onClick={rateAll}
              disabled={isAiLoading}
              className="hidden sm:flex items-center gap-2 px-4 py-2 text-sm font-medium text-white rounded-lg gradient-primary hover:opacity-90 transition-opacity disabled:opacity-50"
            >
              <BarChart3 className="w-4 h-4" />
              Rate All
            </button>
          )}
          <button
            onClick={() => setShowInput(!showInput)}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg border border-border hover:bg-secondary transition-colors"
          >
            <Plus className="w-4 h-4" />
            Add
          </button>
        </div>
      </div>

      {/* Add Statement Form */}
      {showInput && (
        <div className="card-elevated p-5 animate-fade-in">
          <h3 className="font-medium mb-3">New Problem Statement</h3>
          <div className="space-y-3">
            <input
              type="text"
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              placeholder="Problem statement title..."
              className="w-full px-4 py-2.5 text-sm bg-input border border-border rounded-lg focus:ring-2 focus:ring-ring outline-none transition-all placeholder:text-muted-foreground"
            />
            <textarea
              value={newDesc}
              onChange={(e) => setNewDesc(e.target.value)}
              placeholder="Optional: Describe the problem in more detail..."
              rows={3}
              className="w-full px-4 py-2.5 text-sm bg-input border border-border rounded-lg focus:ring-2 focus:ring-ring outline-none transition-all placeholder:text-muted-foreground resize-none"
            />
            <div className="flex gap-2">
              <button
                onClick={addStatement}
                disabled={!newTitle.trim()}
                className="px-4 py-2 text-sm font-semibold text-white rounded-lg gradient-primary hover:opacity-90 disabled:opacity-50 transition-opacity"
              >
                Add Statement
              </button>
              <button
                onClick={() => { setShowInput(false); setNewTitle(''); setNewDesc(''); }}
                className="px-4 py-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* AI Loading */}
      {isAiLoading && (
        <div className="card-elevated p-5 border-violet-500/30 animate-pulse-glow">
          <div className="flex items-center gap-3">
            <Loader2 className="w-5 h-5 text-violet-400 animate-spin" />
            <div>
              <p className="font-medium text-violet-300">AI is analyzing...</p>
              <p className="text-xs text-muted-foreground">{useAppStore.getState().aiLoadingMessage}</p>
            </div>
          </div>
        </div>
      )}

      {/* Statements List */}
      {loading ? (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => <div key={i} className="skeleton h-32 rounded-xl" />)}
        </div>
      ) : statements.length === 0 ? (
        <div className="card-elevated p-12 text-center">
          <Brain className="w-16 h-16 text-muted-foreground/30 mx-auto mb-4" />
          <h3 className="text-lg font-semibold mb-2">No problem statements yet</h3>
          <p className="text-sm text-muted-foreground mb-4">
            Add your ideas and let AI score them
          </p>
          <button
            onClick={() => setShowInput(true)}
            className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-semibold text-white rounded-lg gradient-primary"
          >
            <Plus className="w-4 h-4" />
            Add Your First Statement
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {statements.map((ps) => {
            const rating = ps.ratings?.[0];
            const isExpanded = expandedId === ps.id;

            return (
              <div key={ps.id} className="card-elevated overflow-hidden">
                <div className="p-5">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0 flex-1">
                      <h3 className="font-semibold truncate">{ps.title}</h3>
                      {ps.description && (
                        <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{ps.description}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      {rating && (
                        <div className="flex items-center gap-1 px-3 py-1.5 rounded-full bg-violet-500/10 border border-violet-500/20">
                          <Star className="w-3.5 h-3.5 text-violet-400" />
                          <span className="text-sm font-bold text-violet-300">
                            {rating.composite.toFixed(1)}
                          </span>
                        </div>
                      )}
                      <button
                        onClick={() => rateStatement(ps)}
                        disabled={isAiLoading}
                        className="p-2 rounded-lg hover:bg-violet-500/10 text-muted-foreground hover:text-violet-400 transition-colors disabled:opacity-50"
                        title="Rate with AI"
                      >
                        <Sparkles className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => deleteStatement(ps.id)}
                        className="p-2 rounded-lg hover:bg-red-500/10 text-muted-foreground hover:text-red-400 transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {/* Score Preview */}
                  {rating && (
                    <div className="mt-4">
                      <div className="flex flex-wrap gap-2 mb-3">
                        {RATING_AXES.map((axis) => {
                          const score = rating[axis.key as keyof Rating] as number;
                          return (
                            <div
                              key={axis.key}
                              className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-secondary text-xs"
                            >
                              <div
                                className="w-2 h-2 rounded-full"
                                style={{ backgroundColor: axis.color }}
                              />
                              <span className="text-muted-foreground">{axis.label}</span>
                              <span className="font-bold">{score}</span>
                            </div>
                          );
                        })}
                      </div>
                      <button
                        onClick={() => setExpandedId(isExpanded ? null : ps.id)}
                        className="flex items-center gap-1 text-xs text-violet-400 hover:text-violet-300 transition-colors"
                      >
                        {isExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                        {isExpanded ? 'Hide' : 'Show'} details
                      </button>
                    </div>
                  )}
                </div>

                {/* Expanded: Radar Chart + Justifications */}
                {rating && isExpanded && (
                  <div className="border-t border-border p-5 bg-secondary/30 animate-fade-in">
                    <div className="grid md:grid-cols-2 gap-6">
                      {/* Radar Chart */}
                      <div className="h-72">
                        <ResponsiveContainer width="100%" height="100%">
                          <RadarChart data={getRadarData(rating)}>
                            <PolarGrid stroke="rgba(124, 58, 237, 0.15)" />
                            <PolarAngleAxis dataKey="axis" tick={{ fill: '#8b8da3', fontSize: 11 }} />
                            <PolarRadiusAxis angle={30} domain={[0, 10]} tick={{ fill: '#8b8da3', fontSize: 10 }} />
                            <Radar
                              name="Score"
                              dataKey="value"
                              stroke="#7c3aed"
                              fill="#7c3aed"
                              fillOpacity={0.2}
                              strokeWidth={2}
                            />
                            <Tooltip
                              contentStyle={{
                                backgroundColor: '#12131f',
                                border: '1px solid #2a2b42',
                                borderRadius: '8px',
                                fontSize: '12px',
                              }}
                            />
                          </RadarChart>
                        </ResponsiveContainer>
                      </div>

                      {/* Justifications */}
                      <div className="space-y-3">
                        {RATING_AXES.map((axis) => {
                          const justification = rating.justifications?.[axis.key as keyof typeof rating.justifications];
                          if (!justification) return null;
                          return (
                            <div key={axis.key} className="p-3 rounded-lg bg-secondary/50 border border-border">
                              <div className="flex items-center gap-2 mb-1">
                                <div className="w-2 h-2 rounded-full" style={{ backgroundColor: axis.color }} />
                                <span className="text-xs font-medium">{axis.label}</span>
                                <span className="text-xs font-bold text-muted-foreground ml-auto">
                                  {rating[axis.key as keyof Rating] as number}/10
                                </span>
                              </div>
                              <p className="text-xs text-muted-foreground leading-relaxed">
                                {String(justification)}
                              </p>
                            </div>
                          );
                        })}
                        {rating.recommendation && (
                          <div className="p-3 rounded-lg bg-violet-500/5 border border-violet-500/20">
                            <p className="text-xs font-medium text-violet-300 mb-1">Recommendation</p>
                            <p className="text-xs text-muted-foreground leading-relaxed">
                              {rating.recommendation}
                            </p>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
