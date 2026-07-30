'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Loader2, Sparkles, Rocket } from 'lucide-react';

export default function CreateTeamPage() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    const res = await fetch('/api/teams', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name }),
    });

    const data = await res.json();

    if (!res.ok) {
      setError(data.error || 'Failed to create team');
      setLoading(false);
      return;
    }

    router.push(`/dashboard/team/${data.team.id}/onboarding`);
  };

  return (
    <div className="max-w-lg mx-auto animate-fade-in">
      <Link
        href="/dashboard"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-8 transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to dashboard
      </Link>

      <div className="card-elevated p-8">
        <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center mb-6 glow-sm">
          <Rocket className="w-7 h-7 text-white" />
        </div>

        <h1 className="text-2xl font-bold mb-2">Create a Team</h1>
        <p className="text-sm text-muted-foreground mb-8">
          Name your team and get a join code to share with your squad.
        </p>

        <form onSubmit={handleCreate} className="space-y-5">
          {error && (
            <div className="p-3 text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg">
              {error}
            </div>
          )}

          <div>
            <label htmlFor="team-name" className="block text-sm font-medium mb-1.5">
              Team Name
            </label>
            <input
              id="team-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Team Phoenix, The Debuggers"
              required
              maxLength={50}
              className="w-full px-4 py-3 text-sm bg-input border border-border rounded-lg focus:ring-2 focus:ring-ring focus:border-transparent outline-none transition-all placeholder:text-muted-foreground"
            />
          </div>

          <button
            type="submit"
            disabled={loading || !name.trim()}
            className="w-full py-3 text-sm font-semibold text-white rounded-lg gradient-primary hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {loading ? (
              <><Loader2 className="w-4 h-4 animate-spin" /> Creating...</>
            ) : (
              <><Sparkles className="w-4 h-4" /> Create Team</>
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
