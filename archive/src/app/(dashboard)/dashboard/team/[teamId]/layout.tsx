'use client';

import { use } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useTeam } from '@/hooks/use-team';
import {
  LayoutDashboard, Brain, MessageSquare, FolderOpen,
  TrendingUp, Settings, Ghost, Copy, Check, ArrowLeft,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useState } from 'react';

const NAV_ITEMS = [
  { label: 'Overview', href: '', icon: LayoutDashboard },
  { label: 'Advisor', href: '/advisor', icon: Brain },
  { label: 'Brainstorm', href: '/brainstorm', icon: MessageSquare },
  { label: 'Workspace', href: '/workspace', icon: FolderOpen },
  { label: 'Progress', href: '/progress', icon: TrendingUp },
  { label: 'Settings', href: '/settings', icon: Settings },
];

export default function TeamLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ teamId: string }>;
}) {
  const { teamId } = use(params);
  const pathname = usePathname();
  const { team, loading } = useTeam(teamId);
  const [copied, setCopied] = useState(false);

  const basePath = `/dashboard/team/${teamId}`;

  const copyCode = async () => {
    if (team) {
      await navigator.clipboard.writeText(team.team_code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg gradient-primary animate-pulse" />
          <span className="text-muted-foreground">Loading team...</span>
        </div>
      </div>
    );
  }

  if (!team) {
    return (
      <div className="text-center py-20">
        <Ghost className="w-16 h-16 text-muted-foreground/30 mx-auto mb-4" />
        <h2 className="text-xl font-semibold mb-2">Team not found</h2>
        <Link href="/dashboard" className="text-violet-400 hover:text-violet-300 text-sm">
          ← Back to dashboard
        </Link>
      </div>
    );
  }

  return (
    <div className="flex gap-6 min-h-[calc(100vh-8rem)]">
      {/* Sidebar */}
      <aside className="hidden lg:flex flex-col w-64 shrink-0">
        <div className="card-elevated p-4 mb-4">
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground mb-3 transition-colors"
          >
            <ArrowLeft className="w-3 h-3" />
            All teams
          </Link>
          <h2 className="font-semibold text-lg truncate">{team.name}</h2>
          <button
            onClick={copyCode}
            className="mt-2 flex items-center gap-2 text-xs text-muted-foreground hover:text-violet-400 transition-colors font-mono"
          >
            {copied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
            {team.team_code}
          </button>
        </div>

        <nav className="card-elevated p-2 flex-1">
          {NAV_ITEMS.map((item) => {
            const href = `${basePath}${item.href}`;
            const isActive =
              item.href === ''
                ? pathname === basePath
                : pathname.startsWith(href);

            return (
              <Link
                key={item.label}
                href={href}
                className={cn(
                  'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200',
                  isActive
                    ? 'bg-violet-500/10 text-violet-300 border border-violet-500/20'
                    : 'text-muted-foreground hover:text-foreground hover:bg-secondary'
                )}
              >
                <item.icon className={cn('w-4 h-4', isActive && 'text-violet-400')} />
                {item.label}
              </Link>
            );
          })}
        </nav>
      </aside>

      {/* Mobile Nav */}
      <div className="lg:hidden fixed bottom-0 left-0 right-0 z-40 glass border-t border-border px-2 py-2">
        <div className="flex items-center justify-around">
          {NAV_ITEMS.slice(0, 5).map((item) => {
            const href = `${basePath}${item.href}`;
            const isActive =
              item.href === ''
                ? pathname === basePath
                : pathname.startsWith(href);

            return (
              <Link
                key={item.label}
                href={href}
                className={cn(
                  'flex flex-col items-center gap-1 px-3 py-1.5 rounded-lg text-[10px] font-medium transition-colors',
                  isActive ? 'text-violet-400' : 'text-muted-foreground'
                )}
              >
                <item.icon className="w-5 h-5" />
                {item.label}
              </Link>
            );
          })}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0 pb-20 lg:pb-0">
        {children}
      </div>
    </div>
  );
}
