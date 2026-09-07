import { createClient } from '@/lib/supabase/server';
import ProspectsBoard from '@/components/ProspectsBoard';

export const dynamic = 'force-dynamic';

export default async function ProspectsPage({
  searchParams,
}: {
  searchParams: { campaign_id?: string };
}) {
  const supabase = createClient();

  let query = supabase.from('prospects').select('*').order('updated_at', { ascending: false });
  if (searchParams.campaign_id) {
    query = query.eq('campaign_id', searchParams.campaign_id);
  }

  const [{ data: prospects }, { data: campaigns }] = await Promise.all([
    query,
    supabase.from('campaigns').select('id, name').order('name'),
  ]);

  return (
    <ProspectsBoard
      initialProspects={prospects ?? []}
      campaigns={campaigns ?? []}
      initialCampaignFilter={searchParams.campaign_id ?? ''}
    />
  );
}
