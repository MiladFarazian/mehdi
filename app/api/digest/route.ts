import { NextResponse } from 'next/server';
import { generateDigest } from '@/lib/advisor/digest';
import { sendEmail } from '@/lib/email';

export const dynamic = 'force-dynamic';

// Build the digest from grounded facts, optionally email it. Hit by a cron
// (see vercel.json) or manually from the dashboard.
export async function POST(req: Request) {
  try {
    const send = new URL(req.url).searchParams.get('send') === 'true';
    const { digest, facts } = await generateDigest();

    let emailed = false;
    if (send) {
      emailed = await sendEmail(
        `mehdi — your ${(facts as any).period} spending digest`,
        `<div style="font-family:system-ui;white-space:pre-wrap">${digest}</div>`,
      );
    }

    return NextResponse.json({ ok: true, digest, facts, emailed });
  } catch (err: any) {
    console.error('digest error', err?.message || err);
    return NextResponse.json({ error: err?.message || 'Digest failed' }, { status: 500 });
  }
}
