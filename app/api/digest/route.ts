import { NextResponse } from 'next/server';
import { buildDigestFacts } from '@/lib/advisor/digestFacts';
import { writeDigest, claudeConfigured } from '@/lib/advisor/claude';
import { sendEmail } from '@/lib/email';

export const dynamic = 'force-dynamic';

// Build the digest from grounded facts, optionally email it. Hit by a cron
// (see vercel.json) or manually from the dashboard.
export async function POST(req: Request) {
  if (!claudeConfigured()) {
    return NextResponse.json(
      { error: 'Set ANTHROPIC_API_KEY in .env.local to generate digests.' },
      { status: 400 },
    );
  }
  try {
    const send = new URL(req.url).searchParams.get('send') === 'true';
    const facts = await buildDigestFacts();
    const digest = await writeDigest(facts);

    let emailed = false;
    if (send) {
      emailed = await sendEmail(
        `mehdi — your ${facts.period} spending digest`,
        `<div style="font-family:system-ui;white-space:pre-wrap">${digest}</div>`,
      );
    }

    return NextResponse.json({ ok: true, digest, facts, emailed });
  } catch (err: any) {
    console.error('digest error', err?.message || err);
    return NextResponse.json({ error: err?.message || 'Digest failed' }, { status: 500 });
  }
}
