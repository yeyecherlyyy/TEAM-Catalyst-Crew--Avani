'use client';

import { use, useState } from 'react';
import { useTeam } from '@/hooks/use-team';
import {
  Settings, Copy, Check, RefreshCw, Users, Loader2,
  Shield, Clock, Zap, Trophy,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  HACKATHON_FORMAT_LABELS,
  DURATION_LABELS,
  JUDGING_EMPHASIS_OPTIONS,
} from '@/lib/constants';
import type { HackathonFormat, DurationBracket } from '@/lib/types';

export default function SettingsPage({
  params,
}: {
  params: Promise<{ teamId: string }>;
}) {
  const { teamId } = use(params);
  const { team, members, refreshTeam } = useTeam(teamId);

  const [copied, setCopied] = useState(false);
  const [saving, setSaving] = useState(false);
  const [regenerating, setRegenerating] = useState(false);

  // Edit state
  const [editFormat, setEditFormat] = useState<HackathonFormat | null>(null);
  const [editDuration, setEditDuration] = useState<DurationBracket | null>(null);
  const [editEmphasis, setEditEmphasis] = useState<string[]>([]);
  const [editConstraints, setEditConstraints] = useState('');
  const [isEditing, setIsEditing] = useState(false);

  const startEditing = () => {
    if (!team) return;
    setEditFormat(team.hackathon_format);
    setEditDuration(team.duration_bracket);
    setEditEmphasis(team.judging_emphasis || []);
    setEditConstraints(team.tech_constraints || '');
    setIsEditing(true);
  };

  const saveSettings = async () => {
    setSaving(true);
    await fetch(`/api/teams/${teamId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        hackathon_format: editFormat,
        duration_bracket: editDuration,
        judging_emphasis: editEmphasis,
        tech_constraints: editConstraints,
      }),
    });
    await refreshTeam();
    setIsEditing(false);
    setSaving(false);
  };

  const regenerateCode = async () => {
    setRegenerating(true);
    await fetch(`/api/teams/${teamId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ regenerate_code: true }),
    });
    await refreshTeam();
    setRegenerating(false);
  };

  const copyCode = async () => {
    if (team) {
      await navigator.clipboard.writeText(team.team_code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  if (!team) return null;

  return (
    <div className="animate-fade-in space-y-6 max-w-2xl">
      <h1 className="text-2xl font-bold flex items-center gap-2">
        <Settings className="w-6 h-6 text-muted-foreground" />
        Team Settings
      </h1>

      {/* Join Code */}
      <div className="card-elevated p-5">
        <h2 className="font-medium mb-3 flex items-center gap-2">
          <Shield className="w-4 h-4 text-violet-400" />
          Join Code
        </h2>
        <div className="flex items-center gap-3">
          <div className="flex-1 px-4 py-3 bg-secondary rounded-lg font-mono text-2xl tracking-[0.5em] text-center text-violet-300">
            {team.team_code}
          </div>
          <button
            onClick={copyCode}
            className="p-3 rounded-lg border border-border hover:bg-secondary transition-colors"
            title="Copy code"
          >
            {copied ? <Check className="w-5 h-5 text-emerald-400" /> : <Copy className="w-5 h-5" />}
          </button>
          <button
            onClick={regenerateCode}
            disabled={regenerating}
            className="p-3 rounded-lg border border-border hover:bg-secondary transition-colors"
            title="Regenerate code"
          >
            <RefreshCw className={cn('w-5 h-5', regenerating && 'animate-spin')} />
          </button>
        </div>
        <p className="text-xs text-muted-foreground mt-2">
          Share this code with teammates to let them join
        </p>
      </div>

      {/* Hackathon Profile */}
      <div className="card-elevated p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-medium flex items-center gap-2">
            <Zap className="w-4 h-4 text-amber-400" />
            Hackathon Profile
          </h2>
          {!isEditing && (
            <button
              onClick={startEditing}
              className="text-xs text-violet-400 hover:text-violet-300 transition-colors"
            >
              Edit
            </button>
          )}
        </div>

        {isEditing ? (
          <div className="space-y-5">
            <div>
              <label className="block text-sm font-medium mb-2">Format</label>
              <div className="grid grid-cols-2 gap-2">
                {Object.entries(HACKATHON_FORMAT_LABELS).map(([key, label]) => (
                  <button
                    key={key}
                    onClick={() => setEditFormat(key as HackathonFormat)}
                    className={cn(
                      'p-3 rounded-lg border text-xs text-left transition-all',
                      editFormat === key ? 'border-violet-500 bg-violet-500/10' : 'border-border hover:border-violet-500/30'
                    )}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Duration</label>
              <div className="grid grid-cols-2 gap-2">
                {Object.entries(DURATION_LABELS).map(([key, label]) => (
                  <button
                    key={key}
                    onClick={() => setEditDuration(key as DurationBracket)}
                    className={cn(
                      'p-3 rounded-lg border text-xs text-left transition-all',
                      editDuration === key ? 'border-blue-500 bg-blue-500/10' : 'border-border hover:border-blue-500/30'
                    )}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Judging Emphasis</label>
              <div className="flex flex-wrap gap-2">
                {JUDGING_EMPHASIS_OPTIONS.map((opt) => (
                  <button
                    key={opt}
                    onClick={() =>
                      setEditEmphasis((prev) =>
                        prev.includes(opt) ? prev.filter((e) => e !== opt) : [...prev, opt]
                      )
                    }
                    className={cn(
                      'px-3 py-1.5 rounded-full text-xs border transition-all',
                      editEmphasis.includes(opt) ? 'border-amber-500 bg-amber-500/10 text-amber-300' : 'border-border text-muted-foreground'
                    )}
                  >
                    {opt}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Tech Constraints</label>
              <textarea
                value={editConstraints}
                onChange={(e) => setEditConstraints(e.target.value)}
                rows={3}
                className="w-full px-3 py-2 text-sm bg-input border border-border rounded-lg focus:ring-2 focus:ring-ring outline-none resize-none placeholder:text-muted-foreground"
              />
            </div>

            <div className="flex gap-2">
              <button
                onClick={saveSettings}
                disabled={saving}
                className="px-4 py-2 text-sm font-semibold text-white rounded-lg gradient-primary disabled:opacity-50 flex items-center gap-2"
              >
                {saving && <Loader2 className="w-4 h-4 animate-spin" />}
                Save Changes
              </button>
              <button
                onClick={() => setIsEditing(false)}
                className="px-4 py-2 text-sm text-muted-foreground hover:text-foreground"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Format</span>
              <span className="font-medium">{HACKATHON_FORMAT_LABELS[team.hackathon_format as HackathonFormat] || 'Not set'}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Duration</span>
              <span className="font-medium">{DURATION_LABELS[team.duration_bracket as DurationBracket] || 'Not set'}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Judging</span>
              <span className="font-medium">{team.judging_emphasis?.join(', ') || 'Not set'}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Constraints</span>
              <span className="font-medium truncate ml-4">{team.tech_constraints || 'None'}</span>
            </div>
          </div>
        )}
      </div>

      {/* Members */}
      <div className="card-elevated p-5">
        <h2 className="font-medium mb-4 flex items-center gap-2">
          <Users className="w-4 h-4 text-indigo-400" />
          Members ({members.length})
        </h2>
        <div className="space-y-3">
          {members.map((m) => (
            <div key={m.id} className="flex items-center justify-between p-3 rounded-lg bg-secondary/50">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-violet-500/20 flex items-center justify-center text-xs font-bold text-violet-400">
                  {m.user_id.slice(0, 2).toUpperCase()}
                </div>
                <span className="text-sm font-mono text-muted-foreground">{m.user_id.slice(0, 12)}...</span>
              </div>
              <span className="text-xs px-2 py-0.5 rounded-full bg-violet-500/10 text-violet-400 border border-violet-500/20">
                {m.role}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
