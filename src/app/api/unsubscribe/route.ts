import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { verifyUnsubscribeToken } from '@/lib/compliance';

export async function POST(request: NextRequest) {
  const { id, token } = await request.json().catch(() => ({ id: null, token: null }));

  if (!id || !token || !verifyUnsubscribeToken(id, token)) {
    return NextResponse.json({ error: 'Invalid or expired unsubscribe link.' }, { status: 400 });
  }

  const supabase = createAdminClient();

  const { data: prospect, error } = await supabase
    .from('prospects')
    .update({ stage: 'unsubscribed', unsubscribed_at: new Date().toISOString() })
    .eq('id', id)
    .select('id, name')
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!prospect) return NextResponse.json({ error: 'Prospect not found.' }, { status: 404 });

  await supabase.from('activities').insert({
    prospect_id: id,
    type: 'unsubscribed',
    note: 'Prospect unsubscribed via one-click email link.',
  });

  return NextResponse.json({ ok: true });
}
