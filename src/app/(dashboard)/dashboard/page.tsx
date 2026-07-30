'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { Plus, Users, ArrowRight, Ghost, Sparkles } from 'lucide-react';
import type { Team } from '@/lib/types';

export default function DashboardPage() {
  const [teams, setTeams] = useState<(Team & { role: string })[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchTeams();
  }, []);

  async function fetchTeams() {
    const res = await fetch('/api/teams');
    const data = await res.json();
    setTeams(data.teams || []);
    setLoading(false);
  }

  return (
    <div className="animate-fade-in">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold">Your Teams</h1>
          <p className="text-muted-foreground mt-1">
            Create or join a team to start building
          </p>
        </div>
      </div>

      {/* Action Cards */}
      <div className="grid sm:grid-cols-2 gap-4 mb-8">
        <Link
          href="/dashboard/create-team"
          className="group card-elevated p-6 hover:border-violet-500/30 transition-all duration-300"
        >
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
            <Plus className="w-6 h-6 text-white" />
          </div>
          <h3 className="text-lg font-semibold mb-1">Create a Team</h3>
          <p className="text-sm text-muted-foreground">
            Start a new hackathon project with your squad
          </p>
        </Link>

        <Link
          href="/dashboard/join-team"
          className="group card-elevated p-6 hover:border-indigo-500/30 transition-all duration-300"
        >
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-indigo-500 to-blue-600 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
            <Users className="w-6 h-6 text-white" />
          </div>
          <h3 className="text-lg font-semibold mb-1">Join a Team</h3>
          <p className="text-sm text-muted-foreground">
            Enter a 6-character code to join your team
          </p>
        </Link>
      </div>

      {/* Teams List */}
      {loading ? (
        <div className="space-y-4">
          {[1, 2].map((i) => (
            <div key={i} className="skeleton h-24 rounded-xl" />
          ))}
        </div>
      ) : teams.length === 0 ? (
        <div className="card-elevated p-12 text-center">
          <Ghost className="w-16 h-16 text-muted-foreground/30 mx-auto mb-4" />
          <h3 className="text-lg font-semibold mb-2">No teams yet</h3>
          <p className="text-sm text-muted-foreground mb-6">
            Create your first team or join an existing one with a code
          </p>
          <Link
            href="/dashboard/create-team"
            className="inline-flex items-center gap-2 px-6 py-2.5 text-sm font-semibold text-white rounded-lg gradient-primary hover:opacity-90 transition-opacity"
          >
            <Sparkles className="w-4 h-4" />
            Create Your First Team
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {teams.map((team) => (
            <Link
              key={team.id}
              href={
                team.onboarding_complete
                  ? `/dashboard/team/${team.id}`
                  : `/dashboard/team/${team.id}/onboarding`
              }
              className="group flex items-center justify-between card-elevated p-5 hover:border-violet-500/20 transition-all duration-300"
            >
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-violet-500/20 to-indigo-500/20 border border-violet-500/20 flex items-center justify-center">
                  <Ghost className="w-5 h-5 text-violet-400" />
                </div>
                <div>
                  <h3 className="font-semibold group-hover:text-violet-300 transition-colors">
                    {team.name}
                  </h3>
                  <div className="flex items-center gap-3 mt-0.5">
                    <span className="text-xs text-muted-foreground">
                      Code: <span className="font-mono text-violet-400">{team.team_code}</span>
                    </span>
                    <span className="text-xs px-2 py-0.5 rounded-full bg-violet-500/10 text-violet-400 border border-violet-500/20">
                      {team.role}
                    </span>
                    {!team.onboarding_complete && (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20">
                        Setup needed
                      </span>
                    )}
                  </div>
                </div>
              </div>
              <ArrowRight className="w-5 h-5 text-muted-foreground group-hover:text-violet-400 group-hover:translate-x-1 transition-all" />
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
