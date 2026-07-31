// ============================================================
// GHOST PM — Teams API Route
// ============================================================

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { generateJoinCode } from '@/lib/utils';

export async function GET() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get teams for current user
    const { data: memberships, error: memberError } = await supabase
      .from('team_members')
      .select('team_id, role')
      .eq('user_id', user.id);

    if (memberError) {
      return NextResponse.json({ error: memberError.message }, { status: 500 });
    }

    if (!memberships || memberships.length === 0) {
      return NextResponse.json({ teams: [] });
    }

    const teamIds = memberships.map((m) => m.team_id);
    const { data: teams, error: teamError } = await supabase
      .from('teams')
      .select('*')
      .in('id', teamIds);

    if (teamError) {
      return NextResponse.json({ error: teamError.message }, { status: 500 });
    }

    // Attach role to each team
    const teamsWithRole = (teams || []).map((team) => ({
      ...team,
      role: memberships.find((m) => m.team_id === team.id)?.role || 'member',
    }));

    return NextResponse.json({ teams: teamsWithRole });
  } catch (error) {
    console.error('Teams GET error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      console.log('API Teams POST: No user found, 401');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: { session } } = await supabase.auth.getSession();
    console.log('API Teams POST Success:', {
      userId: user.id,
      email: user.email,
      hasSession: !!session,
      accessTokenLength: session?.access_token?.length || 0,
    });

    const body = await request.json();
    const { name } = body;

    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      return NextResponse.json({ error: 'Team name is required' }, { status: 400 });
    }

    const teamCode = generateJoinCode();

    // Create team
    const { data: team, error: teamError } = await supabase
      .from('teams')
      .insert({
        name: name.trim(),
        team_code: teamCode,
        owner_id: user.id,
      })
      .select()
      .single();

    if (teamError) {
      return NextResponse.json({ error: teamError.message }, { status: 500 });
    }

    // Add owner as team member
    const { error: memberError } = await supabase.from('team_members').insert({
      team_id: team.id,
      user_id: user.id,
      role: 'owner',
    });

    if (memberError) {
      return NextResponse.json({ error: memberError.message }, { status: 500 });
    }

    return NextResponse.json({ team }, { status: 201 });
  } catch (error) {
    console.error('Teams POST error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
