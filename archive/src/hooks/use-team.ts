'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { Team, TeamMember } from '@/lib/types';

export function useTeam(teamId: string) {
  const [team, setTeam] = useState<Team | null>(null);
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const supabase = createClient();

    async function fetchTeam() {
      setLoading(true);
      setError(null);

      const { data: teamData, error: teamError } = await supabase
        .from('teams')
        .select('*')
        .eq('id', teamId)
        .single();

      if (teamError) {
        setError(teamError.message);
        setLoading(false);
        return;
      }

      setTeam(teamData);

      const { data: memberData, error: memberError } = await supabase
        .from('team_members')
        .select('*')
        .eq('team_id', teamId);

      if (memberError) {
        setError(memberError.message);
      } else {
        setMembers(memberData || []);
      }

      setLoading(false);
    }

    fetchTeam();
  }, [teamId]);

  const refreshTeam = async () => {
    const supabase = createClient();
    const { data } = await supabase
      .from('teams')
      .select('*')
      .eq('id', teamId)
      .single();
    if (data) setTeam(data);
  };

  return { team, members, loading, error, refreshTeam };
}
