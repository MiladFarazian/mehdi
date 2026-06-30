import { Resend } from 'resend';

export function emailConfigured(): boolean {
  return Boolean(
    process.env.RESEND_API_KEY && process.env.ALERT_FROM_EMAIL && process.env.ALERT_TO_EMAIL,
  );
}

// Send an email if Resend is configured; otherwise no-op (so the app works
// fully without email set up). Returns whether an email was actually sent.
export async function sendEmail(subject: string, html: string): Promise<boolean> {
  if (!emailConfigured()) {
    console.log('[email] not configured — would have sent:', subject);
    return false;
  }
  const resend = new Resend(process.env.RESEND_API_KEY);
  await resend.emails.send({
    from: process.env.ALERT_FROM_EMAIL!,
    to: process.env.ALERT_TO_EMAIL!,
    subject,
    html,
  });
  return true;
}
