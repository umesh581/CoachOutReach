import { createClient } from '@/lib/supabase/server';
import { maskKey } from '@/lib/settings';
import SettingsClient from '@/components/SettingsClient';

export const dynamic = 'force-dynamic';

export default async function SettingsPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data } = user
    ? await supabase.from('settings').select('*').eq('owner_id', user.id).maybeSingle()
    : { data: null };

  return (
    <SettingsClient
      initial={{
        sender_name: data?.sender_name || '',
        sender_company: data?.sender_company || '',
        sender_email: data?.sender_email || '',
        mailing_address: data?.mailing_address || '',
        daily_send_limit: data?.daily_send_limit ?? 40,
        firecrawl_api_key_masked: maskKey(data?.firecrawl_api_key),
        anthropic_api_key_masked: maskKey(data?.anthropic_api_key),
        resend_api_key_masked: maskKey(data?.resend_api_key),
      }}
    />
  );
}
