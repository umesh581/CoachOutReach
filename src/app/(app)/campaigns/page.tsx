import { createClient } from '@/lib/supabase/server';
import CampaignsClient from '@/components/CampaignsClient';
import type { ProspectStage } from '@/lib/types';

export const dynamic = 'force-dynamic';

export default async function CampaignsPage() {
  const supabase = createClient();
  const [{ data: campaigns }, { data: prospects }] = await Promise.all([
    supabase.from('campaigns').select('*').order('created_at', { ascending: false }),
    supabase.from('prospects').select('id, campaign_id, stage'),
  ]);

  const stageCountsByCampaign = new Map<string, Record<string, number>>();
  const totalByCampaign = new Map<string, number>();
  for (const p of prospects ?? []) {
    if (!p.campaign_id) continue;
    const stages = stageCountsByCampaign.get(p.campaign_id) ?? {};
    stages[p.stage as ProspectStage] = (stages[p.stage as ProspectStage] ?? 0) + 1;
    stageCountsByCampaign.set(p.campaign_id, stages);
    totalByCampaign.set(p.campaign_id, (totalByCampaign.get(p.campaign_id) ?? 0) + 1);
  }

  const enriched = (campaigns ?? []).map((c) => ({
    ...c,
    prospectCount: totalByCampaign.get(c.id) ?? 0,
    stageBreakdown: stageCountsByCampaign.get(c.id) ?? {},
  }));

  return <CampaignsClient initialCampaigns={enriched} />;
}
