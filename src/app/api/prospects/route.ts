import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const campaignId = request.nextUrl.searchParams.get('campaign_id');

  let query = supabase.from('prospects').select('*').order('updated_at', { ascending: false });
  if (campaignId) query = query.eq('campaign_id', campaignId);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ prospects: data });
}

export async function POST(request: NextRequest) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await request.json();
  const { name, company, country, linkedin_url, website_url, email, source, campaign_id, intent_score } =
    body;

  if (!name || typeof name !== 'string') {
    return NextResponse.json({ error: 'name is required' }, { status: 400 });
  }

  const { data, error } = await supabase
    .from('prospects')
    .insert({
      owner_id: user.id,
      name,
      company: company || null,
      country: country || null,
      linkedin_url: linkedin_url || null,
      website_url: website_url || null,
      email: email || null,
      source: source || 'manual',
      campaign_id: campaign_id || null,
      intent_score: typeof intent_score === 'number' ? intent_score : 0,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ prospect: data }, { status: 201 });
}
