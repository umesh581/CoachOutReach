import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getEffectiveSettings } from '@/lib/settings';
import { sendEmail, checkDailySendLimit } from '@/lib/resend';

export async function POST(_request: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: message, error: messageError } = await supabase
    .from('messages')
    .select('*')
    .eq('id', params.id)
    .single();

  if (messageError || !message) {
    return NextResponse.json({ error: 'Message not found' }, { status: 404 });
  }

  const { data: prospect, error: prospectError } = await supabase
    .from('prospects')
    .select('*')
    .eq('id', message.prospect_id)
    .single();

  if (prospectError || !prospect) {
    return NextResponse.json({ error: 'Prospect not found' }, { status: 404 });
  }

  if (message.status !== 'draft' && message.status !== 'approved') {
    return NextResponse.json({ error: `Message already ${message.status}` }, { status: 400 });
  }

  if (message.channel !== 'email') {
    return NextResponse.json(
      { error: 'Only email sends are supported in this MVP (no LinkedIn DM automation).' },
      { status: 400 },
    );
  }

  if (prospect.stage === 'unsubscribed') {
    return NextResponse.json(
      { error: 'This prospect has unsubscribed. Sending is blocked.' },
      { status: 400 },
    );
  }

  if (!prospect.email) {
    return NextResponse.json({ error: 'Prospect has no email address on file.' }, { status: 400 });
  }

  if (!message.subject || !message.body) {
    return NextResponse.json({ error: 'Message is missing a subject or body.' }, { status: 400 });
  }

  const settings = await getEffectiveSettings();
  if (!settings.resendApiKey) {
    return NextResponse.json({ error: 'Resend API key is not configured. Add it in Settings.' }, { status: 400 });
  }
  if (!settings.senderEmail || !settings.senderName) {
    return NextResponse.json(
      { error: 'Configure sender name and sender email in Settings before sending.' },
      { status: 400 },
    );
  }

  const { allowed, sentToday } = await checkDailySendLimit(supabase, user.id, settings.dailySendLimit);
  if (!allowed) {
    return NextResponse.json(
      {
        error: `Daily send limit reached (${sentToday}/${settings.dailySendLimit}). This protects sender reputation while warming up your domain. Try again tomorrow or raise the limit in Settings.`,
      },
      { status: 429 },
    );
  }

  try {
    const result = await sendEmail(settings.resendApiKey, {
      to: prospect.email,
      from: `${settings.senderName} <${settings.senderEmail}>`,
      subject: message.subject,
      text: message.body,
      prospectId: prospect.id,
    });

    const { data: updatedMessage, error: updateError } = await supabase
      .from('messages')
      .update({
        status: 'sent',
        sent_at: new Date().toISOString(),
        resend_message_id: result?.id ?? null,
      })
      .eq('id', params.id)
      .select()
      .single();

    if (updateError) throw new Error(updateError.message);

    await supabase.from('prospects').update({ stage: 'messaged' }).eq('id', prospect.id);
    await supabase.from('activities').insert({
      prospect_id: prospect.id,
      type: 'email_sent',
      note: `Sent: "${message.subject}"`,
    });

    return NextResponse.json({ message: updatedMessage });
  } catch (err) {
    return NextResponse.json(
      { error: `Resend send failed: ${err instanceof Error ? err.message : String(err)}` },
      { status: 502 },
    );
  }
}
