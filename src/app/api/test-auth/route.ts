import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Not logged in' });
    }

    // Run a query to select auth.uid() from Postgres
    const { data, error } = await supabase.rpc('get_auth_uid');
    
    // If RPC is not defined, we can run a select query or just check via an ad-hoc query
    const { data: selectData, error: selectError } = await supabase
      .from('teams')
      .select('id')
      .limit(1);

    // Let's run a raw query using a postgres function or a dummy select
    const { data: uidData, error: uidError } = await supabase
      .from('resources')
      .select('name')
      .limit(1);

    // Let's do a simple query to see if we can get auth.uid()
    const { data: testData, error: testError } = await supabase
      .rpc('get_my_uid');

    return NextResponse.json({
      user_id: user.id,
      email: user.email,
      rpc_uid: testData || null,
      rpc_error: testError?.message || null,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message });
  }
}
