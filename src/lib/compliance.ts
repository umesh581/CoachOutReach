import crypto from 'crypto';

/**
 * Signs a prospect id so the public unsubscribe link cannot be forged or
 * enumerated for a different prospect. HMAC-SHA256 with a server-only secret.
 */
export function signUnsubscribeToken(prospectId: string): string {
  const secret = requireSecret();
  return crypto.createHmac('sha256', secret).update(prospectId).digest('hex');
}

export function verifyUnsubscribeToken(prospectId: string, token: string): boolean {
  const expected = signUnsubscribeToken(prospectId);
  const a = Buffer.from(expected);
  const b = Buffer.from(token || '');
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

function requireSecret(): string {
  const secret = process.env.UNSUBSCRIBE_SECRET;
  if (!secret) {
    throw new Error('UNSUBSCRIBE_SECRET is not configured');
  }
  return secret;
}

export function buildUnsubscribeUrl(prospectId: string): string {
  const base = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
  const token = signUnsubscribeToken(prospectId);
  return `${base}/unsubscribe?id=${prospectId}&token=${token}`;
}

/**
 * CAN-SPAM (and UK/AU equivalent) requires: real sender identity, a physical
 * mailing address, and a one-click unsubscribe link on every commercial email.
 */
export function buildComplianceFooter(opts: {
  senderName: string;
  senderCompany: string;
  mailingAddress: string;
  prospectId: string;
}): string {
  const { senderName, senderCompany, mailingAddress, prospectId } = opts;
  const unsubscribeUrl = buildUnsubscribeUrl(prospectId);

  const lines = [
    '--',
    [senderName, senderCompany].filter(Boolean).join(', '),
    mailingAddress || '[Mailing address not configured — set one in Settings]',
    `Don't want future emails? Unsubscribe: ${unsubscribeUrl}`,
  ];

  return lines.filter(Boolean).join('\n');
}
