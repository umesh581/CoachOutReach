import { Resend } from 'resend';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/types';

export interface SendEmailInput {
  to: string;
  from: string;
  subject: string;
  text: string;
  prospectId: string;
}

export async function sendEmail(apiKey: string, input: SendEmailInput) {
  const resend = new Resend(apiKey);
  const { data, error } = await resend.emails.send({
    from: input.from,
    to: input.to,
    subject: input.subject,
    text: input.text,
    headers: {
      // List-Unsubscribe enables the one-click unsubscribe button most
      // inbox providers show next to the sender, on top of the footer link.
      'X-Entity-Ref-ID': input.prospectId,
    },
    tags: [{ name: 'prospect_id', value: input.prospectId }],
  });

  if (error) {
    throw new Error(error.message || 'Resend send failed');
  }

  return data;
}

/**
 * Conservative daily send cap while warming up a new sending domain.
 * Counts messages already sent today (UTC) for this owner and compares
 * against the configured daily_send_limit.
 */
export async function checkDailySendLimit(
  supabase: SupabaseClient<Database>,
  ownerId: string,
  dailyLimit: number,
): Promise<{ allowed: boolean; sentToday: number }> {
  const startOfDay = new Date();
  startOfDay.setUTCHours(0, 0, 0, 0);

  const { data: prospectIds } = await supabase
    .from('prospects')
    .select('id')
    .eq('owner_id', ownerId);

  const ids = (prospectIds ?? []).map((p) => p.id);
  if (ids.length === 0) {
    return { allowed: true, sentToday: 0 };
  }

  const { count } = await supabase
    .from('messages')
    .select('id', { count: 'exact', head: true })
    .in('prospect_id', ids)
    .eq('status', 'sent')
    .gte('sent_at', startOfDay.toISOString());

  const sentToday = count ?? 0;
  return { allowed: sentToday < dailyLimit, sentToday };
}
