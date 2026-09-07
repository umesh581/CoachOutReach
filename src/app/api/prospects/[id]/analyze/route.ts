import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getEffectiveSettings } from '@/lib/settings';
import { scrapeUrl } from '@/lib/firecrawl';
import { generateFindingsBrief } from '@/lib/anthropic';

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

  const body = await request.json().catch(() => ({}));
  const sourceUrl: string | undefined = body.url || prospect.website_url || undefined;

  if (!sourceUrl) {
    return NextResponse.json(
      { error: 'This prospect has no website_url. Add one first or pass a url.' },
      { status: 400 },
    );
  }

  const settings = await getEffectiveSettings();
  if (!settings.firecrawlApiKey) {
    return NextResponse.json({ error: 'Firecrawl API key is not configured. Add it in Settings.' }, { status: 400 });
  }
  if (!settings.anthropicApiKey) {
    return NextResponse.json({ error: 'Anthropic API key is not configured. Add it in Settings.' }, { status: 400 });
  }

  let scrape;
  try {
    scrape = await scrapeUrl(sourceUrl, settings.firecrawlApiKey);
  } catch (err) {
    return NextResponse.json(
      { error: `Firecrawl scrape failed: ${err instanceof Error ? err.message : String(err)}` },
      { status: 502 },
    );
  }

  if (!scrape.markdown) {
    return NextResponse.json({ error: 'Firecrawl returned no page content to analyze.' }, { status: 502 });
  }

  let findingsBrief: string;
  try {
    findingsBrief = await generateFindingsBrief(
      settings.anthropicApiKey,
      {
        name: prospect.name,
        company: prospect.company,
        niche: prospect.source,
        country: prospect.country,
        websiteUrl: sourceUrl,
      },
      scrape.markdown,
    );
  } catch (err) {
    return NextResponse.json(
      { error: `Claude findings brief failed: ${err instanceof Error ? err.message : String(err)}` },
      { status: 502 },
    );
  }

  const { data: analysis, error: insertError } = await supabase
    .from('funnel_analyses')
    .insert({
      prospect_id: params.id,
      source_url: sourceUrl,
      firecrawl_raw: scrape.raw as never,
      findings_brief: findingsBrief,
    })
    .select()
    .single();

  if (insertError) return NextResponse.json({ error: insertError.message }, { status: 500 });

  if (prospect.stage === 'new' || prospect.stage === 'qualified') {
    await supabase.from('prospects').update({ stage: 'analyzed' }).eq('id', params.id);
  }

  await supabase.from('activities').insert({
    prospect_id: params.id,
    type: 'note',
    note: `Funnel analysis completed for ${sourceUrl}`,
  });

  return NextResponse.json({ analysis });
}
