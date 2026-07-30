// ============================================================
// GHOST PM — Join Team API Route
// ============================================================

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { code } = body;

    if (!code || typeof code !== 'string' || code.trim().length === 0) {
      return NextResponse.json({ error: 'Join code is required' }, { status: 400 });
    }

    // Find team by code
    const { data: team, error: teamError } = await supabase
      .from('teams')
      .select('id, name')
      .eq('team_code', code.trim().toUpperCase())
      .single();

    if (teamError || !team) {
      return NextResponse.json({ error: 'Invalid join code' }, { status: 404 });
    }

    // Check if already a member
    const { data: existing } = await supabase
      .from('team_members')
      .select('id')
      .eq('team_id', team.id)
      .eq('user_id', user.id)
      .single();

    if (existing) {
      return NextResponse.json({
        team,
        message: 'Already a member of this team',
      });
    }

    // Join team
    const { error: joinError } = await supabase.from('team_members').insert({
      team_id: team.id,
      user_id: user.id,
      role: 'member',
    });

    if (joinError) {
      return NextResponse.json({ error: joinError.message }, { status: 500 });
    }

    // Create notification for team
    await supabase.from('notifications').insert({
      team_id: team.id,
      user_id: user.id,
      type: 'team_join',
      title: 'New member joined',
      body: `${user.email} joined the team`,
    });

    return NextResponse.json({ team, message: 'Successfully joined team' });
  } catch (error) {
    console.error('Join team error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
