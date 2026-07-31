'use client';

import { useEffect, useRef } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { RealtimeChannel } from '@supabase/supabase-js';

interface UseRealtimeOptions {
  channel: string;
  table: string;
  filter?: string;
  onInsert?: (payload: Record<string, unknown>) => void;
  onUpdate?: (payload: Record<string, unknown>) => void;
  onDelete?: (payload: Record<string, unknown>) => void;
  enabled?: boolean;
}

export function useRealtime({
  channel,
  table,
  filter,
  onInsert,
  onUpdate,
  onDelete,
  enabled = true,
}: UseRealtimeOptions) {
  const channelRef = useRef<RealtimeChannel | null>(null);

  useEffect(() => {
    if (!enabled) return;

    const supabase = createClient();

    const realtimeFilter = filter
      ? { event: '*' as const, schema: 'public', table, filter }
      : { event: '*' as const, schema: 'public', table };

    channelRef.current = supabase
      .channel(channel)
      .on('postgres_changes', realtimeFilter, (payload) => {
        switch (payload.eventType) {
          case 'INSERT':
            onInsert?.(payload.new as Record<string, unknown>);
            break;
          case 'UPDATE':
            onUpdate?.(payload.new as Record<string, unknown>);
            break;
          case 'DELETE':
            onDelete?.(payload.old as Record<string, unknown>);
            break;
        }
      })
      .subscribe();

    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
      }
    };
  }, [channel, table, filter, enabled, onInsert, onUpdate, onDelete]);

  return channelRef;
}

interface UsePresenceOptions {
  channel: string;
  userState: Record<string, unknown>;
  enabled?: boolean;
}

export function usePresence({
  channel,
  userState,
  enabled = true,
}: UsePresenceOptions) {
  const channelRef = useRef<RealtimeChannel | null>(null);

  useEffect(() => {
    if (!enabled) return;

    const supabase = createClient();

    channelRef.current = supabase
      .channel(channel)
      .on('presence', { event: 'sync' }, () => {
        // Presence state synced
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await channelRef.current?.track(userState);
        }
      });

    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
      }
    };
  }, [channel, enabled]); // eslint-disable-line react-hooks/exhaustive-deps

  return channelRef;
}
