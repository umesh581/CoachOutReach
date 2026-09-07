import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import type { Prospect } from '@/lib/types';

const EDITABLE_FIELDS = [
  'name',
  'company',
  'country',
  'linkedin_url',
  'website_url',
  'email',
  'email_verified',
  'source',
  'campaign_id',
  'intent_score',
  'stage',
] as const;

export async function GET(_request: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const [{ data: prospect, error }, { data: analyses }, { data: messages }, { data: activities }] =
    await Promise.all([
      supabase.from('prospects').select('*').eq('id', params.id).single(),
      supabase
        .from('funnel_analyses')
        .select('*')
        .eq('prospect_id', params.id)
        .order('analyzed_at', { ascending: false }),
      supabase
        .from('messages')
        .select('*')
        .eq('prospect_id', params.id)
        .order('created_at', { ascending: false }),
      supabase
        .from('activities')
        .select('*')
        .eq('prospect_id', params.id)
        .order('created_at', { ascending: false }),
    ]);

  if (error) return NextResponse.json({ error: error.message }, { status: 404 });

  return NextResponse.json({
    prospect,
    funnel_analyses: analyses ?? [],
    messages: messages ?? [],
    activities: activities ?? [],
  });
}

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await request.json();
  const updates: Partial<Prospect> = {};
  for (const key of EDITABLE_FIELDS) {
    if (key in body) (updates as Record<string, unknown>)[key] = body[key];
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 });
  }

  const { data: existing } = await supabase
    .from('prospects')
    .select('stage')
    .eq('id', params.id)
    .single();

  const { data, error } = await supabase
    .from('prospects')
    .update(updates)
    .eq('id', params.id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  if (typeof updates.stage === 'string' && existing && existing.stage !== updates.stage) {
    await supabase.from('activities').insert({
      prospect_id: params.id,
      type: 'stage_change',
      note: `Stage changed from "${existing.stage}" to "${updates.stage}"`,
    });
  }

  return NextResponse.json({ prospect: data });
}

export async function DELETE(_request: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { error } = await supabase.from('prospects').delete().eq('id', params.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
