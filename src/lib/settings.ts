import { createClient } from '@/lib/supabase/server';
import type { Settings } from '@/lib/types';

export interface EffectiveSettings {
  senderName: string;
  senderCompany: string;
  senderEmail: string;
  mailingAddress: string;
  dailySendLimit: number;
  firecrawlApiKey: string | null;
  anthropicApiKey: string | null;
  resendApiKey: string | null;
}

/**
 * Server-only. Reads the current owner's settings row (if any) and layers it
 * over environment variable fallbacks. Never call this from a Client
 * Component or return the result directly to the browser.
 */
export async function getEffectiveSettings(): Promise<EffectiveSettings> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let row: Settings | null = null;
  if (user) {
    const { data } = await supabase.from('settings').select('*').eq('owner_id', user.id).maybeSingle();
    row = data;
  }

  return {
    senderName: row?.sender_name || process.env.SENDER_NAME || '',
    senderCompany: row?.sender_company || process.env.SENDER_COMPANY || '',
    senderEmail: row?.sender_email || process.env.SENDER_EMAIL || '',
    mailingAddress: row?.mailing_address || process.env.SENDER_MAILING_ADDRESS || '',
    dailySendLimit: row?.daily_send_limit ?? 40,
    firecrawlApiKey: row?.firecrawl_api_key || process.env.FIRECRAWL_API_KEY || null,
    anthropicApiKey: row?.anthropic_api_key || process.env.ANTHROPIC_API_KEY || null,
    resendApiKey: row?.resend_api_key || process.env.RESEND_API_KEY || null,
  };
}

/** Masks a secret for display in the UI, e.g. "sk-ant-...a1b2" */
export function maskKey(key: string | null | undefined): string {
  if (!key) return '';
  if (key.length <= 8) return '••••••••';
  return `${key.slice(0, 6)}...${key.slice(-4)}`;
}
