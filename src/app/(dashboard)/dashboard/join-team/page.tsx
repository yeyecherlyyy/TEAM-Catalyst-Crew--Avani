'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Loader2, Users, KeyRound } from 'lucide-react';

export default function JoinTeamPage() {
  const router = useRouter();
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleJoin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    const res = await fetch('/api/teams/join', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code }),
    });

    const data = await res.json();

    if (!res.ok) {
      setError(data.error || 'Failed to join team');
      setLoading(false);
      return;
    }

    router.push(`/dashboard/team/${data.team.id}`);
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
        <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-indigo-500 to-blue-600 flex items-center justify-center mb-6 glow-sm">
          <KeyRound className="w-7 h-7 text-white" />
        </div>

        <h1 className="text-2xl font-bold mb-2">Join a Team</h1>
        <p className="text-sm text-muted-foreground mb-8">
          Enter the 6-character code shared by your team leader
        </p>

        <form onSubmit={handleJoin} className="space-y-5">
          {error && (
            <div className="p-3 text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg">
              {error}
            </div>
          )}

          <div>
            <label htmlFor="join-code" className="block text-sm font-medium mb-1.5">
              Join Code
            </label>
            <input
              id="join-code"
              type="text"
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase().slice(0, 6))}
              placeholder="ABC123"
              required
              maxLength={6}
              className="w-full px-4 py-3 text-center text-2xl font-mono tracking-[0.5em] bg-input border border-border rounded-lg focus:ring-2 focus:ring-ring focus:border-transparent outline-none transition-all placeholder:text-muted-foreground placeholder:tracking-[0.5em]"
            />
          </div>

          <button
            type="submit"
            disabled={loading || code.length !== 6}
            className="w-full py-3 text-sm font-semibold text-white rounded-lg gradient-primary hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {loading ? (
              <><Loader2 className="w-4 h-4 animate-spin" /> Joining...</>
            ) : (
              <><Users className="w-4 h-4" /> Join Team</>
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
