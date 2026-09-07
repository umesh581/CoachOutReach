import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { maskKey } from '@/lib/settings';

export async function GET() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data } = await supabase.from('settings').select('*').eq('owner_id', user.id).maybeSingle();

  return NextResponse.json({
    settings: {
      sender_name: data?.sender_name || '',
      sender_company: data?.sender_company || '',
      sender_email: data?.sender_email || '',
      mailing_address: data?.mailing_address || '',
      daily_send_limit: data?.daily_send_limit ?? 40,
      firecrawl_api_key_masked: maskKey(data?.firecrawl_api_key),
      anthropic_api_key_masked: maskKey(data?.anthropic_api_key),
      resend_api_key_masked: maskKey(data?.resend_api_key),
      has_firecrawl_key: Boolean(data?.firecrawl_api_key),
      has_anthropic_key: Boolean(data?.anthropic_api_key),
      has_resend_key: Boolean(data?.resend_api_key),
    },
  });
}

export async function POST(request: NextRequest) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await request.json();
  const updates: Record<string, unknown> = { owner_id: user.id };

  for (const key of ['sender_name', 'sender_company', 'sender_email', 'mailing_address'] as const) {
    if (key in body) updates[key] = String(body[key] || '').trim() || null;
  }
  if ('daily_send_limit' in body) {
    const limit = Number(body.daily_send_limit);
    updates.daily_send_limit = Number.isFinite(limit) && limit > 0 ? Math.floor(limit) : 40;
  }
  // API keys are only overwritten when a non-empty value is submitted, so
  // saving the form again doesn't blank out a previously configured key.
  for (const key of ['firecrawl_api_key', 'anthropic_api_key', 'resend_api_key'] as const) {
    if (key in body && String(body[key] || '').trim()) {
      updates[key] = String(body[key]).trim();
    }
  }

  const { error } = await supabase.from('settings').upsert(updates, { onConflict: 'owner_id' });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
