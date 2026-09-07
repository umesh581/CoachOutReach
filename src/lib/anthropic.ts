import Anthropic from '@anthropic-ai/sdk';

const MODEL = 'claude-sonnet-4-5-20250929';

export interface ProspectContext {
  name: string;
  company: string | null;
  niche: string | null;
  country: string | null;
  websiteUrl: string | null;
}

/**
 * Given a Firecrawl page extract, produces a short internal brief (bullet
 * gaps/opportunities). This brief is outreach ammunition for our own use —
 * it is never shown to the prospect.
 */
export async function generateFindingsBrief(
  apiKey: string,
  prospect: ProspectContext,
  pageMarkdown: string,
): Promise<string> {
  const client = new Anthropic({ apiKey });

  const truncated = pageMarkdown.slice(0, 15000);

  const message = await client.messages.create({
    model: MODEL,
    max_tokens: 700,
    system:
      'You are a blunt, expert direct-response marketing auditor. You review a coach or ' +
      "consultant's website/funnel and identify concrete, specific gaps that a sales " +
      'funnel, Meta Ads, or AI automation agency could fix. You write for internal use by ' +
      'a salesperson preparing a cold outreach email — never for the prospect. Be specific ' +
      'and reference exact page content (headlines, CTAs, pricing, structure). Avoid vague ' +
      'generic marketing advice.',
    messages: [
      {
        role: 'user',
        content: [
          `Prospect: ${prospect.name}${prospect.company ? ` at ${prospect.company}` : ''}`,
          prospect.niche ? `Niche: ${prospect.niche}` : null,
          prospect.websiteUrl ? `Website: ${prospect.websiteUrl}` : null,
          '',
          'Page content (markdown extract):',
          '"""',
          truncated,
          '"""',
          '',
          'Produce a findings brief with 3-5 bullet points covering concrete funnel gaps ' +
            '(examples: no upsell/order bump, weak or vague headline, no urgency or scarcity, ' +
            'CTA buried below the fold, no lead magnet/opt-in, pricing hidden, no social proof, ' +
            'no clear next step, slow/cluttered page). Each bullet must cite something specific ' +
            'from the page content above, not a generic observation. End with one line naming ' +
            'the single highest-leverage fix.',
        ]
          .filter(Boolean)
          .join('\n'),
      },
    ],
  });

  return extractText(message);
}

export interface MessageVariant {
  subject: string;
  body: string;
}

/**
 * Given the findings brief plus prospect/service context, drafts a short,
 * specific, non-generic cold email with 2-3 subject line variants.
 */
export async function generateOutreachMessage(
  apiKey: string,
  prospect: ProspectContext,
  findingsBrief: string,
  serviceAngle: string,
  complianceFooter: string,
): Promise<{ subjects: string[]; body: string }> {
  const client = new Anthropic({ apiKey });

  const message = await client.messages.create({
    model: MODEL,
    max_tokens: 900,
    system:
      'You write short, specific, non-generic cold outreach emails for a sales funnel / ' +
      'Meta Ads / AI automation agency pitching coaches and consultants. Rules: ' +
      '(1) Reference exactly ONE concrete observation from the findings brief — never vague ' +
      'flattery like "I love what you\'re doing". ' +
      '(2) Keep the body under 130 words, plain text, no markdown, no bullet points, ' +
      'written like a real 1:1 email from a person, not a template. ' +
      '(3) End with a low-friction call to action (a question or short call offer), not a hard sell. ' +
      '(4) The subject line must accurately reflect the email content — never deceptive or clickbait. ' +
      '(5) Do not include a greeting placeholder like [Name] — use the prospect\'s actual first name. ' +
      '(6) Do not include the compliance footer or sign-off block; that is appended separately.',
    messages: [
      {
        role: 'user',
        content: [
          `Prospect: ${prospect.name}${prospect.company ? ` at ${prospect.company}` : ''}`,
          prospect.niche ? `Niche/offer: ${prospect.niche}` : null,
          prospect.country ? `Country: ${prospect.country}` : null,
          '',
          'Internal findings brief (ammunition, not shown to prospect):',
          findingsBrief,
          '',
          `Our service angle: ${serviceAngle}`,
          '',
          'Respond with EXACTLY this format, nothing else:',
          'SUBJECT 1: <subject line>',
          'SUBJECT 2: <subject line>',
          'SUBJECT 3: <subject line>',
          'BODY:',
          '<email body text>',
        ]
          .filter(Boolean)
          .join('\n'),
      },
    ],
  });

  const text = extractText(message);
  return parseMessageResponse(text, complianceFooter);
}

function extractText(message: Anthropic.Messages.Message): string {
  return message.content
    .filter((block): block is Anthropic.Messages.TextBlock => block.type === 'text')
    .map((block) => block.text)
    .join('\n')
    .trim();
}

function parseMessageResponse(
  text: string,
  complianceFooter: string,
): { subjects: string[]; body: string } {
  const subjects: string[] = [];
  const subjectRegex = /SUBJECT\s*\d\s*:\s*(.+)/gi;
  let match: RegExpExecArray | null;
  while ((match = subjectRegex.exec(text)) !== null) {
    subjects.push(match[1].trim());
  }

  const bodyMatch = text.match(/BODY:\s*([\s\S]*)$/i);
  const body = (bodyMatch ? bodyMatch[1] : text).trim();

  return {
    subjects: subjects.length > 0 ? subjects : ['Quick question about your funnel'],
    body: `${body}\n\n${complianceFooter}`,
  };
}
