import { createClient } from '@/lib/supabase/server';
import ImportClient from '@/components/ImportClient';

export const dynamic = 'force-dynamic';

export default async function ImportPage() {
  const supabase = createClient();
  const { data: campaigns } = await supabase.from('campaigns').select('id, name').order('name');
  return <ImportClient campaigns={campaigns ?? []} />;
}
