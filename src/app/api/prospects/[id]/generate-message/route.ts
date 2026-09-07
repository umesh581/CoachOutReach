import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getEffectiveSettings } from '@/lib/settings';
import { generateOutreachMessage } from '@/lib/anthropic';
import { buildComplianceFooter } from '@/lib/compliance';

const DEFAULT_SERVICE_ANGLE =
  'We build sales funnels, run Meta Ads, and set up AI automation for coaches and consultants who already have an offer and traffic but are leaving conversions on the table.';

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: prospect, error: prospectError } = await supabase
    .from('prospects')
    .select('*')
    .eq('id', params.id)
    .single();

  if (prospectError || !prospect) {
    return NextResponse.json({ error: 'Prospect not found' }, { status: 404 });
  }

  if (prospect.stage === 'unsubscribed') {
    return NextResponse.json(
      { error: 'This prospect has unsubscribed. No further outreach can be generated.' },
      { status: 400 },
    );
  }

  const { data: latestAnalysis } = await supabase
    .from('funnel_analyses')
    .select('*')
    .eq('prospect_id', params.id)
    .order('analyzed_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!latestAnalysis?.findings_brief) {
    return NextResponse.json(
      { error: 'Run "Analyze funnel" first — message generation needs a findings brief.' },
      { status: 400 },
    );
  }

  const settings = await getEffectiveSettings();
  if (!settings.anthropicApiKey) {
    return NextResponse.json({ error: 'Anthropic API key is not configured. Add it in Settings.' }, { status: 400 });
  }
  if (!settings.senderName || !settings.mailingAddress) {
    return NextResponse.json(
      { error: 'Set your sender name and mailing address in Settings before generating outreach (required for compliant email footers).' },
      { status: 400 },
    );
  }

  const body = await request.json().catch(() => ({}));
  const serviceAngle: string = body.service_angle || DEFAULT_SERVICE_ANGLE;

  const footer = buildComplianceFooter({
    senderName: settings.senderName,
    senderCompany: settings.senderCompany,
    mailingAddress: settings.mailingAddress,
    prospectId: params.id,
  });

  let generated;
  try {
    generated = await generateOutreachMessage(
      settings.anthropicApiKey,
      {
        name: prospect.name,
        company: prospect.company,
        niche: prospect.source,
        country: prospect.country,
        websiteUrl: prospect.website_url,
      },
      latestAnalysis.findings_brief,
      serviceAngle,
      footer,
    );
  } catch (err) {
    return NextResponse.json(
      { error: `Claude message generation failed: ${err instanceof Error ? err.message : String(err)}` },
      { status: 502 },
    );
  }

  const { data: message, error: insertError } = await supabase
    .from('messages')
    .insert({
      prospect_id: params.id,
      channel: 'email',
      subject: generated.subjects[0],
      body: generated.body,
      status: 'draft',
    })
    .select()
    .single();

  if (insertError) return NextResponse.json({ error: insertError.message }, { status: 500 });

  await supabase.from('activities').insert({
    prospect_id: params.id,
    type: 'note',
    note: 'Draft outreach message generated',
  });

  return NextResponse.json({ message, subject_variants: generated.subjects });
}
