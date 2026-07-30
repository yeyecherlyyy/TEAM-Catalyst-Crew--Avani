'use client';

import { useState, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { Artifact, ArtifactType } from '@/lib/types';

export function useArtifacts(teamId: string) {
  const [artifacts, setArtifacts] = useState<Artifact[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchArtifacts = useCallback(
    async (type?: ArtifactType, sessionId?: string) => {
      setLoading(true);
      const supabase = createClient();

      let query = supabase
        .from('artifacts')
        .select('*')
        .eq('team_id', teamId)
        .is('superseded_by', null)
        .order('created_at', { ascending: false });

      if (type) query = query.eq('artifact_type', type);
      if (sessionId) query = query.eq('session_id', sessionId);

      const { data, error } = await query;

      if (!error && data) {
        setArtifacts(data);
      }
      setLoading(false);
      return data || [];
    },
    [teamId]
  );

  const saveArtifact = useCallback(
    async (artifact: {
      artifact_type: ArtifactType;
      title: string;
      content: Record<string, unknown>;
      session_id?: string;
      idea_id?: string;
    }) => {
      const supabase = createClient();

      // Check for existing artifact of same type/title to version
      const { data: existing } = await supabase
        .from('artifacts')
        .select('id, version')
        .eq('team_id', teamId)
        .eq('artifact_type', artifact.artifact_type)
        .eq('title', artifact.title)
        .is('superseded_by', null)
        .single();

      const newVersion = existing ? existing.version + 1 : 1;

      const { data: newArtifact, error } = await supabase
        .from('artifacts')
        .insert({
          team_id: teamId,
          artifact_type: artifact.artifact_type,
          title: artifact.title,
          version: newVersion,
          content: artifact.content,
          session_id: artifact.session_id || null,
          idea_id: artifact.idea_id || null,
        })
        .select()
        .single();

      if (error) throw error;

      // Supersede old version
      if (existing) {
        await supabase
          .from('artifacts')
          .update({ superseded_by: newArtifact.id })
          .eq('id', existing.id);
      }

      return newArtifact;
    },
    [teamId]
  );

  const getArtifactHistory = useCallback(
    async (artifactType: ArtifactType, title: string) => {
      const supabase = createClient();

      const { data } = await supabase
        .from('artifacts')
        .select('*')
        .eq('team_id', teamId)
        .eq('artifact_type', artifactType)
        .eq('title', title)
        .order('version', { ascending: true });

      return data || [];
    },
    [teamId]
  );

  return { artifacts, loading, fetchArtifacts, saveArtifact, getArtifactHistory };
}
