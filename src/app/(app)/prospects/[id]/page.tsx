import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import ProspectDetailClient from '@/components/ProspectDetailClient';

export const dynamic = 'force-dynamic';

export default async function ProspectDetailPage({ params }: { params: { id: string } }) {
  const supabase = createClient();

  const [{ data: prospect }, { data: campaigns }, { data: analyses }, { data: messages }, { data: activities }] =
    await Promise.all([
      supabase.from('prospects').select('*').eq('id', params.id).single(),
      supabase.from('campaigns').select('id, name').order('name'),
      supabase
        .from('funnel_analyses')
        .select('*')
        .eq('prospect_id', params.id)
        .order('analyzed_at', { ascending: false }),
      supabase.from('messages').select('*').eq('prospect_id', params.id).order('created_at', { ascending: false }),
      supabase.from('activities').select('*').eq('prospect_id', params.id).order('created_at', { ascending: false }),
    ]);

  if (!prospect) notFound();

  return (
    <ProspectDetailClient
      prospect={prospect}
      campaigns={campaigns ?? []}
      initialAnalyses={analyses ?? []}
      initialMessages={messages ?? []}
      initialActivities={activities ?? []}
    />
  );
}
