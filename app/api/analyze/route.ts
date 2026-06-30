import { NextResponse } from 'next/server';
import { runAnalysis } from '@/lib/analysis/run';
import { maybeSendAlerts } from '@/lib/alerts';
import { today } from '@/lib/today';

export const dynamic = 'force-dynamic';

// Run the full analysis pass and email any new high-severity alerts.
export async function POST() {
  try {
    const result = await runAnalysis(today());
    const alerted = await maybeSendAlerts();
    return NextResponse.json({ ok: true, ...result, alerted });
  } catch (err: any) {
    console.error('analyze error', err?.message || err);
    return NextResponse.json({ error: err?.message || 'Analysis failed' }, { status: 500 });
  }
}
