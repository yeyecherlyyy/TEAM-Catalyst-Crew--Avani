// ── Supabase Realtime subscriptions ──────────────────
import { useEffect, useRef, useCallback } from "react";
import { supabase } from "./supabase";
import type { RealtimeChannel } from "@supabase/supabase-js";

// ── Generic realtime hook ────────────────────────────
function useRealtimeTable<T>(
  table: string,
  filterColumn: string,
  filterValue: string | null,
  onInsert?: (row: T) => void,
  onUpdate?: (row: T) => void,
  onDelete?: (old: T) => void
) {
  const channelRef = useRef<RealtimeChannel | null>(null);

  useEffect(() => {
    if (!filterValue) return;

    const channel = supabase
      .channel(`${table}_${filterValue}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table,
          filter: `${filterColumn}=eq.${filterValue}`,
        },
        (payload) => onInsert?.(payload.new as T)
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table,
          filter: `${filterColumn}=eq.${filterValue}`,
        },
        (payload) => onUpdate?.(payload.new as T)
      )
      .on(
        "postgres_changes",
        {
          event: "DELETE",
          schema: "public",
          table,
          filter: `${filterColumn}=eq.${filterValue}`,
        },
        (payload) => onDelete?.(payload.old as T)
      )
      .subscribe();

    channelRef.current = channel;

    return () => {
      channel.unsubscribe();
    };
  }, [table, filterColumn, filterValue]);

  return channelRef;
}

// ── Chat messages realtime ───────────────────────────
interface RealtimeMessage {
  id: string;
  session_id: string;
  team_id: string;
  user_id: string | null;
  content: string;
  is_ai: boolean;
  created_at: string;
}

export function useRealtimeMessages(
  sessionId: string | null,
  onNewMessage: (msg: RealtimeMessage) => void
) {
  return useRealtimeTable<RealtimeMessage>(
    "brainstorm_messages",
    "session_id",
    sessionId,
    onNewMessage
  );
}

// ── Roadmap tasks realtime ───────────────────────────
interface RealtimeTask {
  id: string;
  roadmap_id: string;
  team_id: string;
  title: string;
  status: string;
  assigned_to: string | null;
  phase_index: number;
}

export function useRealtimeTasks(
  teamId: string | null,
  onInsert: (task: RealtimeTask) => void,
  onUpdate: (task: RealtimeTask) => void
) {
  return useRealtimeTable<RealtimeTask>(
    "roadmap_tasks",
    "team_id",
    teamId,
    onInsert,
    onUpdate
  );
}

// ── Artifacts realtime ───────────────────────────────
interface RealtimeArtifact {
  id: string;
  team_id: string;
  artifact_type: string;
  title: string;
  content: Record<string, unknown>;
  created_at: string;
}

export function useRealtimeArtifacts(
  teamId: string | null,
  onNew: (artifact: RealtimeArtifact) => void
) {
  return useRealtimeTable<RealtimeArtifact>(
    "artifacts",
    "team_id",
    teamId,
    onNew
  );
}

// ── Team members realtime ────────────────────────────
interface RealtimeMember {
  id: string;
  team_id: string;
  user_id: string;
  role: string;
  joined_at: string;
}

export function useRealtimeMembers(
  teamId: string | null,
  onJoin: (member: RealtimeMember) => void
) {
  return useRealtimeTable<RealtimeMember>(
    "team_members",
    "team_id",
    teamId,
    onJoin
  );
}

// ── Progress check-ins realtime ──────────────────────
interface RealtimeCheckin {
  id: string;
  team_id: string;
  actual_percent: number;
  notes: string | null;
  created_at: string;
}

export function useRealtimeCheckins(
  teamId: string | null,
  onNew: (checkin: RealtimeCheckin) => void
) {
  return useRealtimeTable<RealtimeCheckin>(
    "progress_checkins",
    "team_id",
    teamId,
    onNew
  );
}
