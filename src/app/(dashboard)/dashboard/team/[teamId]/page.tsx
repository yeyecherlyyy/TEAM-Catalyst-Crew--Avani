'use client';

import { use, useEffect, useState } from 'react';
import Link from 'next/link';
import { useTeam } from '@/hooks/use-team';
import { createClient } from '@/lib/supabase/client';
import {
  Brain, MessageSquare, FolderOpen, TrendingUp,
  Users, Clock, Sparkles, ArrowRight, Ghost,
} from 'lucide-react';
import type { ProblemStatement, BrainstormSession, Roadmap } from '@/lib/types';

export default function TeamOverviewPage({
  params,
}: {
  params: Promise<{ teamId: string }>;
}) {
  const { teamId } = use(params);
  const { team, members } = useTeam(teamId);
  const [stats, setStats] = useState({
    problemStatements: 0,
    brainstormMessages: 0,
    activeSessions: 0,
    roadmaps: 0,
  });

  useEffect(() => {
    async function fetchStats() {
      const supabase = createClient();
      const [ps, bm, bs, rm] = await Promise.all([
        supabase.from('problem_statements').select('id', { count: 'exact', head: true }).eq('team_id', teamId),
        supabase.from('brainstorm_messages').select('id', { count: 'exact', head: true }).eq('team_id', teamId),
        supabase.from('brainstorm_sessions').select('id', { count: 'exact', head: true }).eq('team_id', teamId).eq('is_active', true),
        supabase.from('roadmaps').select('id', { count: 'exact', head: true }).eq('team_id', teamId),
      ]);
      setStats({
        problemStatements: ps.count || 0,
        brainstormMessages: bm.count || 0,
        activeSessions: bs.count || 0,
        roadmaps: rm.count || 0,
      });
    }
    fetchStats();
  }, [teamId]);

  if (!team) return null;

  const quickActions = [
    { label: 'Rate Ideas', href: `/dashboard/team/${teamId}/advisor`, icon: Brain, gradient: 'from-violet-500 to-purple-600', desc: 'Score problem statements' },
    { label: 'Brainstorm', href: `/dashboard/team/${teamId}/brainstorm`, icon: MessageSquare, gradient: 'from-indigo-500 to-blue-600', desc: 'Start or join a session' },
    { label: 'Workspace', href: `/dashboard/team/${teamId}/workspace`, icon: FolderOpen, gradient: 'from-emerald-500 to-teal-600', desc: 'Shared docs & resources' },
    { label: 'Progress', href: `/dashboard/team/${teamId}/progress`, icon: TrendingUp, gradient: 'from-amber-500 to-orange-600', desc: 'Track your timeline' },
  ];

  const statCards = [
    { label: 'Problem Statements', value: stats.problemStatements, icon: Brain },
    { label: 'Brainstorm Messages', value: stats.brainstormMessages, icon: MessageSquare },
    { label: 'Active Sessions', value: stats.activeSessions, icon: Sparkles },
    { label: 'Roadmaps', value: stats.roadmaps, icon: Clock },
  ];

  return (
    <div className="animate-fade-in space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold">{team.name}</h1>
        <p className="text-muted-foreground text-sm mt-1">
          {members.length} member{members.length !== 1 ? 's' : ''} · {team.hackathon_format ? team.hackathon_format.replace(/_/g, ' ') : 'Format not set'}
        </p>
      </div>

      {!team.onboarding_complete && (
        <Link
          href={`/dashboard/team/${teamId}/onboarding`}
          className="flex items-center justify-between card-elevated p-5 border-amber-500/30 hover:border-amber-500/50 transition-colors"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 flex items-center justify-center">
              <Sparkles className="w-5 h-5 text-amber-400" />
            </div>
            <div>
              <p className="font-medium text-amber-300">Complete Setup</p>
              <p className="text-xs text-muted-foreground">Configure your hackathon profile to unlock AI features</p>
            </div>
          </div>
          <ArrowRight className="w-5 h-5 text-amber-400" />
        </Link>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {statCards.map((stat) => (
          <div key={stat.label} className="card-elevated p-4">
            <div className="flex items-center gap-2 mb-2">
              <stat.icon className="w-4 h-4 text-muted-foreground" />
              <span className="text-xs text-muted-foreground">{stat.label}</span>
            </div>
            <p className="text-2xl font-bold gradient-text">{stat.value}</p>
          </div>
        ))}
      </div>

      {/* Quick Actions */}
      <div>
        <h2 className="text-lg font-semibold mb-3">Quick Actions</h2>
        <div className="grid sm:grid-cols-2 gap-3">
          {quickActions.map((action) => (
            <Link
              key={action.label}
              href={action.href}
              className="group flex items-center gap-4 card-elevated p-4 hover:border-violet-500/20 transition-all duration-300"
            >
              <div className={`w-11 h-11 rounded-xl bg-gradient-to-br ${action.gradient} flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform`}>
                <action.icon className="w-5 h-5 text-white" />
              </div>
              <div className="min-w-0">
                <p className="font-medium text-sm group-hover:text-violet-300 transition-colors">{action.label}</p>
                <p className="text-xs text-muted-foreground truncate">{action.desc}</p>
              </div>
              <ArrowRight className="w-4 h-4 text-muted-foreground ml-auto shrink-0 group-hover:text-violet-400 group-hover:translate-x-1 transition-all" />
            </Link>
          ))}
        </div>
      </div>

      {/* Team Members */}
      <div>
        <h2 className="text-lg font-semibold mb-3">Team Members</h2>
        <div className="card-elevated p-4 space-y-3">
          {members.map((member) => (
            <div key={member.id} className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-violet-500/20 flex items-center justify-center">
                  <Users className="w-4 h-4 text-violet-400" />
                </div>
                <span className="text-sm font-medium">{member.user_id.slice(0, 8)}...</span>
              </div>
              <span className="text-xs px-2 py-0.5 rounded-full bg-violet-500/10 text-violet-400 border border-violet-500/20">
                {member.role}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
