'use client';

import { use, useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useTeam } from '@/hooks/use-team';
import { useAppStore } from '@/stores/app-store';
import {
  TrendingUp, Clock, CheckCircle2, Circle, Loader2,
  BarChart3, Target, AlertTriangle, Sparkles,
} from 'lucide-react';
import { cn, formatRelativeTime } from '@/lib/utils';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Legend,
} from 'recharts';
import type { Roadmap, RoadmapTask } from '@/lib/types';

export default function ProgressPage({
  params,
}: {
  params: Promise<{ teamId: string }>;
}) {
  const { teamId } = use(params);
  const { team } = useTeam(teamId);
  const { isAiLoading, setAiLoading } = useAppStore();

  const [roadmaps, setRoadmaps] = useState<Roadmap[]>([]);
  const [activeRoadmap, setActiveRoadmap] = useState<Roadmap | null>(null);
  const [tasks, setTasks] = useState<RoadmapTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [aiAnalysis, setAiAnalysis] = useState<string | null>(null);

  const fetchRoadmaps = useCallback(async () => {
    const supabase = createClient();
    const { data } = await supabase
      .from('roadmaps')
      .select('*')
      .eq('team_id', teamId)
      .order('created_at', { ascending: false });

    setRoadmaps(data || []);
    if (data && data.length > 0 && !activeRoadmap) {
      setActiveRoadmap(data[0]);
    }
    setLoading(false);
  }, [teamId, activeRoadmap]);

  const fetchTasks = useCallback(async () => {
    if (!activeRoadmap) return;
    const supabase = createClient();
    const { data } = await supabase
      .from('roadmap_tasks')
      .select('*')
      .eq('roadmap_id', activeRoadmap.id)
      .order('phase_index', { ascending: true });
    setTasks(data || []);
  }, [activeRoadmap]);

  useEffect(() => { fetchRoadmaps(); }, [fetchRoadmaps]);
  useEffect(() => { fetchTasks(); }, [fetchTasks]);

  const toggleTask = async (taskId: string, currentStatus: string) => {
    const newStatus = currentStatus === 'done' ? 'todo' : currentStatus === 'in_progress' ? 'done' : 'in_progress';
    const supabase = createClient();
    await supabase.from('roadmap_tasks')
      .update({
        status: newStatus,
        actual_hours: newStatus === 'done' ? undefined : null,
      })
      .eq('id', taskId);
    fetchTasks();
  };

  const getProgress = () => {
    if (tasks.length === 0) return { done: 0, inProgress: 0, total: 0, percent: 0 };
    const done = tasks.filter((t) => t.status === 'done').length;
    const inProgress = tasks.filter((t) => t.status === 'in_progress').length;
    return {
      done,
      inProgress,
      total: tasks.length,
      percent: Math.round((done / tasks.length) * 100),
    };
  };

  const getChartData = () => {
    if (!activeRoadmap || !team) return [];
    const totalHours = activeRoadmap.total_predicted_hours || team.duration_hours || 24;
    const progress = getProgress();
    const points: Array<{ hour: number; predicted: number; actual: number }> = [];

    for (let h = 0; h <= totalHours; h += Math.max(1, Math.floor(totalHours / 12))) {
      const predicted = Math.min(100, Math.round((h / totalHours) * 100));
      points.push({
        hour: h,
        predicted,
        actual: h <= (totalHours * progress.percent) / 100 ? progress.percent : 0,
      });
    }
    return points;
  };

  const getGroupedTasks = () => {
    const phases: Record<number, { tasks: RoadmapTask[]; name: string }> = {};
    const roadmapPhases = activeRoadmap?.phases as Array<{ name: string }> | undefined;

    tasks.forEach((t) => {
      if (!phases[t.phase_index]) {
        phases[t.phase_index] = {
          tasks: [],
          name: roadmapPhases?.[t.phase_index]?.name || `Phase ${t.phase_index + 1}`,
        };
      }
      phases[t.phase_index].tasks.push(t);
    });
    return Object.entries(phases).sort(([a], [b]) => Number(a) - Number(b));
  };

  const analyzeProgress = async () => {
    setAiLoading(true);
    try {
      const progress = getProgress();
      const totalHours = activeRoadmap?.total_predicted_hours || team?.duration_hours || 24;
      const hoursElapsed = totalHours * 0.5; // Estimate mid-point

      const res = await fetch('/api/ai/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          teamId,
          type: 'progress',
          ideaDescription: `${progress.done}/${progress.total} tasks completed (${progress.percent}%)`,
          extraData: {
            predictedPercent: 50,
            actualPercent: progress.percent,
            hoursElapsed,
            totalHours,
          },
        }),
      });

      if (res.ok) {
        const data = await res.json();
        setAiAnalysis(data.chat_reply);
      }
    } finally {
      setAiLoading(false);
    }
  };

  const progress = getProgress();
  const chartData = getChartData();

  return (
    <div className="animate-fade-in space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <TrendingUp className="w-6 h-6 text-amber-400" />
          Progress Tracker
        </h1>
        {activeRoadmap && (
          <button
            onClick={analyzeProgress}
            disabled={isAiLoading}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white rounded-lg gradient-primary hover:opacity-90 disabled:opacity-50"
          >
            {isAiLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
            AI Analysis
          </button>
        )}
      </div>

      {loading ? (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => <div key={i} className="skeleton h-24 rounded-xl" />)}
        </div>
      ) : !activeRoadmap ? (
        <div className="card-elevated p-12 text-center">
          <TrendingUp className="w-16 h-16 text-muted-foreground/20 mx-auto mb-4" />
          <h3 className="text-lg font-semibold mb-2">No roadmap yet</h3>
          <p className="text-sm text-muted-foreground">
            Generate a roadmap from the Brainstorm page to track your progress
          </p>
        </div>
      ) : (
        <>
          {/* Stats Row */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="card-elevated p-4">
              <p className="text-xs text-muted-foreground mb-1">Completion</p>
              <p className="text-2xl font-bold gradient-text">{progress.percent}%</p>
            </div>
            <div className="card-elevated p-4">
              <p className="text-xs text-muted-foreground mb-1">Done</p>
              <p className="text-2xl font-bold text-emerald-400">{progress.done}</p>
            </div>
            <div className="card-elevated p-4">
              <p className="text-xs text-muted-foreground mb-1">In Progress</p>
              <p className="text-2xl font-bold text-amber-400">{progress.inProgress}</p>
            </div>
            <div className="card-elevated p-4">
              <p className="text-xs text-muted-foreground mb-1">Remaining</p>
              <p className="text-2xl font-bold text-muted-foreground">
                {progress.total - progress.done - progress.inProgress}
              </p>
            </div>
          </div>

          {/* Progress Bar */}
          <div className="card-elevated p-5">
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm font-medium">Overall Progress</p>
              <p className="text-sm text-muted-foreground">{progress.done} / {progress.total} tasks</p>
            </div>
            <div className="w-full h-3 bg-secondary rounded-full overflow-hidden">
              <div
                className="h-full gradient-primary rounded-full transition-all duration-500 ease-out"
                style={{ width: `${progress.percent}%` }}
              />
            </div>
          </div>

          {/* Chart */}
          {chartData.length > 0 && (
            <div className="card-elevated p-5">
              <h3 className="text-sm font-medium mb-4">Predicted vs Actual</h3>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(124,58,237,0.1)" />
                    <XAxis dataKey="hour" tick={{ fill: '#8b8da3', fontSize: 11 }} label={{ value: 'Hours', position: 'bottom', fill: '#8b8da3', fontSize: 11 }} />
                    <YAxis tick={{ fill: '#8b8da3', fontSize: 11 }} label={{ value: '%', angle: -90, position: 'insideLeft', fill: '#8b8da3', fontSize: 11 }} />
                    <Tooltip contentStyle={{ backgroundColor: '#12131f', border: '1px solid #2a2b42', borderRadius: '8px', fontSize: '12px' }} />
                    <Legend />
                    <Area type="monotone" dataKey="predicted" stroke="#6366f1" fill="#6366f1" fillOpacity={0.1} name="Predicted" />
                    <Area type="monotone" dataKey="actual" stroke="#7c3aed" fill="#7c3aed" fillOpacity={0.2} name="Actual" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {/* AI Analysis */}
          {aiAnalysis && (
            <div className="card-elevated p-5 border-violet-500/20 animate-fade-in">
              <div className="flex items-center gap-2 mb-3">
                <Sparkles className="w-4 h-4 text-violet-400" />
                <h3 className="text-sm font-medium">AI Analysis</h3>
              </div>
              <p className="text-sm text-muted-foreground whitespace-pre-wrap">{aiAnalysis}</p>
            </div>
          )}

          {/* Task List by Phase */}
          <div className="space-y-4">
            {getGroupedTasks().map(([phaseIndex, phase]) => {
              const done = phase.tasks.filter((t) => t.status === 'done').length;
              return (
                <div key={phaseIndex} className="card-elevated overflow-hidden">
                  <div className="p-4 border-b border-border flex items-center justify-between">
                    <h3 className="font-medium text-sm">{phase.name}</h3>
                    <span className="text-xs text-muted-foreground">{done}/{phase.tasks.length}</span>
                  </div>
                  <div className="divide-y divide-border">
                    {phase.tasks.map((task) => (
                      <button
                        key={task.id}
                        onClick={() => toggleTask(task.id, task.status)}
                        className="w-full flex items-center gap-3 p-3 hover:bg-secondary/50 transition-colors text-left"
                      >
                        {task.status === 'done' ? (
                          <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
                        ) : task.status === 'in_progress' ? (
                          <Clock className="w-5 h-5 text-amber-400 shrink-0 animate-pulse" />
                        ) : (
                          <Circle className="w-5 h-5 text-muted-foreground shrink-0" />
                        )}
                        <div className="min-w-0 flex-1">
                          <p className={cn('text-sm', task.status === 'done' && 'line-through text-muted-foreground')}>
                            {task.title}
                          </p>
                          {task.description && (
                            <p className="text-xs text-muted-foreground truncate">{task.description}</p>
                          )}
                        </div>
                        {task.predicted_hours && (
                          <span className="text-xs text-muted-foreground shrink-0">
                            ~{task.predicted_hours}h
                          </span>
                        )}
                      </button>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
