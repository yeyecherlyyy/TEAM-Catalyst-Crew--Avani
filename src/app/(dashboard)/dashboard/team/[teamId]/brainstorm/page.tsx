'use client';

import { use, useState, useEffect, useRef, useCallback } from 'react';
import { useTeam } from '@/hooks/use-team';
import { useRealtime } from '@/hooks/use-realtime';
import { createClient } from '@/lib/supabase/client';
import { useAppStore } from '@/stores/app-store';
import {
  Send, Sparkles, Loader2, X, AlertTriangle,
  MessageSquare, Plus, Bot, User, FileText,
  Map, GitBranch, Info,
} from 'lucide-react';
import { cn, formatRelativeTime } from '@/lib/utils';
import { DRIFT_CHECK_INTERVAL } from '@/lib/constants';
import type { BrainstormSession, BrainstormMessage, Nudge } from '@/lib/types';

export default function BrainstormPage({
  params,
}: {
  params: Promise<{ teamId: string }>;
}) {
  const { teamId } = use(params);
  const { team } = useTeam(teamId);
  const { isAiLoading, setAiLoading } = useAppStore();

  const [sessions, setSessions] = useState<BrainstormSession[]>([]);
  const [activeSession, setActiveSession] = useState<BrainstormSession | null>(null);
  const [messages, setMessages] = useState<BrainstormMessage[]>([]);
  const [nudges, setNudges] = useState<Nudge[]>([]);
  const [input, setInput] = useState('');
  const [loadingSessions, setLoadingSessions] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const fetchSessions = useCallback(async () => {
    const supabase = createClient();
    const { data } = await supabase
      .from('brainstorm_sessions')
      .select('*')
      .eq('team_id', teamId)
      .order('created_at', { ascending: false });
    setSessions(data || []);
    if (data && data.length > 0 && !activeSession) {
      setActiveSession(data[0]);
    }
    setLoadingSessions(false);
  }, [teamId, activeSession]);

  const fetchMessages = useCallback(async () => {
    if (!activeSession) return;
    const supabase = createClient();
    const { data } = await supabase
      .from('brainstorm_messages')
      .select('*')
      .eq('session_id', activeSession.id)
      .order('created_at', { ascending: true });
    setMessages(data || []);

    const { data: nudgeData } = await supabase
      .from('nudges')
      .select('*')
      .eq('session_id', activeSession.id)
      .eq('is_dismissed', false)
      .order('created_at', { ascending: false });
    setNudges(nudgeData || []);
  }, [activeSession]);

  useEffect(() => { fetchSessions(); }, [fetchSessions]);
  useEffect(() => { fetchMessages(); }, [fetchMessages]);
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Realtime messages
  useRealtime({
    channel: `brainstorm-${activeSession?.id}`,
    table: 'brainstorm_messages',
    filter: activeSession ? `session_id=eq.${activeSession.id}` : undefined,
    onInsert: (payload) => {
      setMessages((prev) => [...prev, payload as unknown as BrainstormMessage]);
    },
    enabled: !!activeSession,
  });

  const createSession = async () => {
    const supabase = createClient();
    const selectedPs = await supabase
      .from('problem_statements')
      .select('title')
      .eq('team_id', teamId)
      .eq('is_selected', true)
      .single();

    const anchorText = selectedPs.data?.title || 'Open brainstorm session';

    const { data } = await supabase
      .from('brainstorm_sessions')
      .insert({
        team_id: teamId,
        anchor_text: anchorText,
        is_active: true,
      })
      .select()
      .single();

    if (data) {
      setActiveSession(data);
      setSessions((prev) => [data, ...prev]);
    }
  };

  const sendMessage = async () => {
    if (!input.trim() || !activeSession) return;
    const content = input.trim();
    setInput('');

    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();

    await supabase.from('brainstorm_messages').insert({
      session_id: activeSession.id,
      team_id: teamId,
      user_id: user?.id,
      content,
      is_ai: false,
    });

    // Check for @ai mentions
    if (content.toLowerCase().includes('@ai')) {
      await triggerAI(content, 'mention');
    } else {
      // Check if we should trigger drift detection
      const newCount = (activeSession.message_count || 0) + 1;
      if (newCount % DRIFT_CHECK_INTERVAL === 0) {
        await triggerAI(content, 'drift_check');
      }
    }
  };

  const triggerAI = async (lastMessage: string, trigger: string) => {
    setAiLoading(true);
    try {
      const recentMsgs = messages.slice(-10).map((m) => ({
        content: m.content,
        is_ai: m.is_ai,
      }));

      await fetch('/api/ai/brainstorm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          teamId,
          sessionId: activeSession?.id,
          recentMessages: [...recentMsgs, { content: lastMessage, is_ai: false }],
          anchorText: activeSession?.anchor_text,
          trigger,
        }),
      });

      fetchMessages();
    } finally {
      setAiLoading(false);
    }
  };

  const dismissNudge = async (nudgeId: string) => {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    await supabase
      .from('nudges')
      .update({ is_dismissed: true, dismissed_by: user?.id, dismissed_at: new Date().toISOString() })
      .eq('id', nudgeId);
    setNudges((prev) => prev.filter((n) => n.id !== nudgeId));
  };

  const generateDeliverable = async (type: string) => {
    setAiLoading(true);
    try {
      await fetch('/api/ai/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          teamId,
          type,
          ideaDescription: activeSession?.anchor_text,
          sessionId: activeSession?.id,
        }),
      });
      fetchMessages();
    } finally {
      setAiLoading(false);
    }
  };

  return (
    <div className="animate-fade-in h-[calc(100vh-12rem)] flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <MessageSquare className="w-6 h-6 text-indigo-400" />
            Brainstorm Wall
          </h1>
          {activeSession && (
            <p className="text-muted-foreground text-xs mt-1">
              Anchor: {activeSession.anchor_text} · {activeSession.message_count} messages
            </p>
          )}
        </div>
        <div className="flex items-center gap-2">
          {/* Deliverable Quick Actions */}
          <div className="hidden sm:flex items-center gap-1">
            {[
              { type: 'roadmap', icon: Map, label: 'Roadmap' },
              { type: 'brief', icon: FileText, label: 'Brief' },
              { type: 'flowchart', icon: GitBranch, label: 'Flowchart' },
            ].map((d) => (
              <button
                key={d.type}
                onClick={() => generateDeliverable(d.type)}
                disabled={isAiLoading || !activeSession}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-border hover:bg-secondary hover:border-violet-500/30 transition-all disabled:opacity-50"
                title={`Generate ${d.label}`}
              >
                <d.icon className="w-3.5 h-3.5" />
                {d.label}
              </button>
            ))}
          </div>
          <button
            onClick={createSession}
            className="flex items-center gap-2 px-3 py-1.5 text-xs font-medium rounded-lg gradient-primary text-white hover:opacity-90"
          >
            <Plus className="w-3.5 h-3.5" />
            New Session
          </button>
        </div>
      </div>

      {/* Nudges */}
      {nudges.map((nudge) => (
        <div
          key={nudge.id}
          className={cn(
            'mb-3 p-4 rounded-xl border animate-slide-in flex items-start gap-3',
            nudge.severity === 'critical' ? 'border-red-500/30 bg-red-500/5' :
            nudge.severity === 'warning' ? 'border-amber-500/30 bg-amber-500/5' :
            'border-blue-500/30 bg-blue-500/5'
          )}
        >
          <AlertTriangle className={cn('w-5 h-5 shrink-0 mt-0.5',
            nudge.severity === 'critical' ? 'text-red-400' :
            nudge.severity === 'warning' ? 'text-amber-400' : 'text-blue-400'
          )} />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium">{nudge.reason}</p>
            {nudge.suggestion && (
              <p className="text-xs text-muted-foreground mt-1">{nudge.suggestion}</p>
            )}
          </div>
          <button onClick={() => dismissNudge(nudge.id)} className="p-1 hover:bg-secondary rounded">
            <X className="w-4 h-4 text-muted-foreground" />
          </button>
        </div>
      ))}

      {/* Messages */}
      <div className="flex-1 overflow-y-auto space-y-3 mb-4 pr-1">
        {!activeSession ? (
          <div className="h-full flex items-center justify-center">
            <div className="text-center">
              <MessageSquare className="w-16 h-16 text-muted-foreground/20 mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">No active session</h3>
              <p className="text-sm text-muted-foreground mb-4">Start a brainstorm session to begin</p>
              <button
                onClick={createSession}
                className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-semibold text-white rounded-lg gradient-primary"
              >
                <Sparkles className="w-4 h-4" />
                Start Brainstorming
              </button>
            </div>
          </div>
        ) : messages.length === 0 ? (
          <div className="h-full flex items-center justify-center">
            <div className="text-center">
              <Info className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3" />
              <p className="text-sm text-muted-foreground">
                Start the conversation. Type <span className="font-mono text-violet-400">@ai</span> to invoke the AI moderator.
              </p>
            </div>
          </div>
        ) : (
          messages.map((msg) => (
            <div
              key={msg.id}
              className={cn(
                'flex gap-3 animate-fade-in',
                msg.is_ai ? 'pr-12' : 'pl-4'
              )}
            >
              <div className={cn(
                'w-8 h-8 rounded-full flex items-center justify-center shrink-0',
                msg.is_ai ? 'bg-violet-500/20' : 'bg-indigo-500/20'
              )}>
                {msg.is_ai ? <Bot className="w-4 h-4 text-violet-400" /> : <User className="w-4 h-4 text-indigo-400" />}
              </div>
              <div className={cn(
                'flex-1 p-3 rounded-xl text-sm',
                msg.is_ai ? 'bg-violet-500/5 border border-violet-500/10' : 'bg-secondary border border-border'
              )}>
                <p className="whitespace-pre-wrap">{msg.content}</p>
                <p className="text-[10px] text-muted-foreground mt-2">
                  {formatRelativeTime(msg.created_at)}
                </p>
              </div>
            </div>
          ))
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      {activeSession && (
        <div className="flex items-center gap-2">
          <div className="flex-1 relative">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && sendMessage()}
              placeholder="Type a message... Use @ai to invoke the AI moderator"
              className="w-full px-4 py-3 pr-12 text-sm bg-input border border-border rounded-xl focus:ring-2 focus:ring-ring outline-none transition-all placeholder:text-muted-foreground"
            />
            {isAiLoading && (
              <Loader2 className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-violet-400 animate-spin" />
            )}
          </div>
          <button
            onClick={sendMessage}
            disabled={!input.trim() || isAiLoading}
            className="p-3 rounded-xl gradient-primary text-white hover:opacity-90 transition-opacity disabled:opacity-50"
          >
            <Send className="w-5 h-5" />
          </button>
        </div>
      )}
    </div>
  );
}
