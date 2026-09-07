import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import type { Country, Prospect } from '@/lib/types';

interface ImportRow {
  name?: string;
  company?: string;
  country?: string;
  linkedin_url?: string;
  website_url?: string;
  email?: string;
  source?: string;
}

const VALID_COUNTRIES: Country[] = ['US', 'UK', 'AU'];

function normalizeCountry(value: string | undefined): Country | null {
  if (!value) return null;
  const upper = value.trim().toUpperCase();
  if (VALID_COUNTRIES.includes(upper as Country)) return upper as Country;
  if (['UNITED STATES', 'USA'].includes(upper)) return 'US';
  if (['UNITED KINGDOM', 'GREAT BRITAIN'].includes(upper)) return 'UK';
  if (['AUSTRALIA'].includes(upper)) return 'AU';
  return null;
}

export async function POST(request: NextRequest) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await request.json();
  const rows: ImportRow[] = Array.isArray(body.rows) ? body.rows : [];
  const campaignId: string | null = body.campaign_id || null;
  const source: string = body.source || 'csv';

  if (rows.length === 0) {
    return NextResponse.json({ error: 'No rows to import' }, { status: 400 });
  }
  if (rows.length > 5000) {
    return NextResponse.json({ error: 'Import is limited to 5000 rows at a time' }, { status: 400 });
  }

  const { data: existing } = await supabase
    .from('prospects')
    .select('email, linkedin_url')
    .eq('owner_id', user.id);

  const existingEmails = new Set(
    (existing ?? []).map((p) => p.email?.toLowerCase()).filter(Boolean) as string[],
  );
  const existingLinkedIn = new Set(
    (existing ?? []).map((p) => p.linkedin_url?.toLowerCase()).filter(Boolean) as string[],
  );

  const seenEmails = new Set<string>();
  const seenLinkedIn = new Set<string>();

  const toInsert: Partial<Prospect>[] = [];
  let skippedNoName = 0;
  let skippedDuplicate = 0;

  for (const row of rows) {
    const name = row.name?.trim();
    if (!name) {
      skippedNoName++;
      continue;
    }

    const email = row.email?.trim() || null;
    const linkedinUrl = row.linkedin_url?.trim() || null;
    const emailKey = email?.toLowerCase();
    const linkedinKey = linkedinUrl?.toLowerCase();

    const isDuplicate =
      (emailKey && (existingEmails.has(emailKey) || seenEmails.has(emailKey))) ||
      (linkedinKey && (existingLinkedIn.has(linkedinKey) || seenLinkedIn.has(linkedinKey)));

    if (isDuplicate) {
      skippedDuplicate++;
      continue;
    }

    if (emailKey) seenEmails.add(emailKey);
    if (linkedinKey) seenLinkedIn.add(linkedinKey);

    toInsert.push({
      owner_id: user.id,
      campaign_id: campaignId,
      name,
      company: row.company?.trim() || null,
      country: normalizeCountry(row.country),
      linkedin_url: linkedinUrl,
      website_url: row.website_url?.trim() || null,
      email,
      source,
      stage: 'new',
    });
  }

  let inserted = 0;
  if (toInsert.length > 0) {
    const { error } = await supabase.from('prospects').insert(toInsert);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    inserted = toInsert.length;
  }

  return NextResponse.json({
    inserted,
    skipped_duplicate: skippedDuplicate,
    skipped_no_name: skippedNoName,
    total_rows: rows.length,
  });
}
