import { NextRequest, NextResponse } from 'next/server';
import { Webhook } from 'svix';
import { createAdminClient } from '@/lib/supabase/admin';
import type { MessageStatus } from '@/lib/types';

interface ResendWebhookEvent {
  type: string;
  data: {
    email_id?: string;
    to?: string[];
    tags?: { name: string; value: string }[];
  };
}

const STATUS_BY_EVENT: Record<string, MessageStatus> = {
  'email.opened': 'opened',
  'email.bounced': 'bounced',
  'email.complained': 'bounced',
};

const ACTIVITY_BY_EVENT: Record<string, string> = {
  'email.delivered': 'email_delivered',
  'email.opened': 'email_opened',
  'email.clicked': 'email_clicked',
  'email.bounced': 'email_bounced',
  'email.complained': 'email_complained',
};

export async function POST(request: NextRequest) {
  const payload = await request.text();
  const secret = process.env.RESEND_WEBHOOK_SECRET;

  if (secret) {
    const headers = {
      'svix-id': request.headers.get('svix-id') ?? '',
      'svix-timestamp': request.headers.get('svix-timestamp') ?? '',
      'svix-signature': request.headers.get('svix-signature') ?? '',
    };
    try {
      new Webhook(secret).verify(payload, headers);
    } catch {
      return NextResponse.json({ error: 'Invalid webhook signature' }, { status: 400 });
    }
  }

  let event: ResendWebhookEvent;
  try {
    event = JSON.parse(payload);
  } catch {
    return NextResponse.json({ error: 'Invalid JSON payload' }, { status: 400 });
  }

  const supabase = createAdminClient();
  const emailId = event.data?.email_id;
  const prospectIdTag = event.data?.tags?.find((t) => t.name === 'prospect_id')?.value;

  if (!emailId && !prospectIdTag) {
    // Nothing we can match this event to; acknowledge so Resend doesn't retry forever.
    return NextResponse.json({ ok: true, ignored: true });
  }

  let message = null;
  if (emailId) {
    const { data } = await supabase.from('messages').select('*').eq('resend_message_id', emailId).maybeSingle();
    message = data;
  }
  if (!message && prospectIdTag) {
    const { data } = await supabase
      .from('messages')
      .select('*')
      .eq('prospect_id', prospectIdTag)
      .eq('status', 'sent')
      .order('sent_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    message = data;
  }

  if (!message) {
    return NextResponse.json({ ok: true, ignored: true });
  }

  const newStatus = STATUS_BY_EVENT[event.type];
  if (newStatus) {
    // Don't downgrade a message that already progressed further (e.g. a
    // late "delivered" event arriving after we recorded a reply).
    const precedence = ['sent', 'opened', 'replied', 'bounced'];
    const currentIdx = precedence.indexOf(message.status);
    const newIdx = precedence.indexOf(newStatus);
    if (newIdx === -1 || currentIdx === -1 || newIdx > currentIdx) {
      await supabase.from('messages').update({ status: newStatus }).eq('id', message.id);
    }
  }

  const activityType = ACTIVITY_BY_EVENT[event.type] || event.type;
  await supabase.from('activities').insert({
    prospect_id: message.prospect_id,
    type: activityType,
    note: `Resend event: ${event.type}`,
  });

  if (event.type === 'email.bounced' || event.type === 'email.complained') {
    await supabase
      .from('prospects')
      .update({ stage: 'unsubscribed', unsubscribed_at: new Date().toISOString() })
      .eq('id', message.prospect_id);
  }

  return NextResponse.json({ ok: true });
}
