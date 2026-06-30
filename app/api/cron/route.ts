import { NextResponse } from 'next/server';
import { syncAllItems } from '@/lib/sync';
import { runAnalysis } from '@/lib/analysis/run';
import { maybeSendAlerts } from '@/lib/alerts';
import { generateDigest } from '@/lib/advisor/digest';
import { sendEmail } from '@/lib/email';
import { today } from '@/lib/today';

export const dynamic = 'force-dynamic';

// Single scheduled entry point (Vercel cron / external scheduler send GET).
// Guarded by CRON_SECRET when set. Pass ?digest=true on the weekly run.
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (secret && req.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const sendDigest = new URL(req.url).searchParams.get('digest') === 'true';
  try {
    const sync = await syncAllItems();
    const analysis = await runAnalysis(today());
    const alerted = await maybeSendAlerts();

    let digest = false;
    if (sendDigest) {
      const { digest: text, facts } = await generateDigest();
      await sendEmail(
        `mehdi — your ${(facts as any).period} spending digest`,
        `<div style="font-family:system-ui;white-space:pre-wrap">${text}</div>`,
      );
      digest = true;
    }

    return NextResponse.json({ ok: true, sync, analysis, alerted, digest });
  } catch (err: any) {
    console.error('cron error', err?.message || err);
    return NextResponse.json({ error: err?.message || 'cron failed' }, { status: 500 });
  }
}
