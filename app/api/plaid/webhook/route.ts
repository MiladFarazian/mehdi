import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { syncItem } from '@/lib/sync';
import { runAnalysis } from '@/lib/analysis/run';
import { decryptSecret } from '@/lib/crypto';
import { verifyPlaidWebhook } from '@/lib/plaidWebhook';
import { today } from '@/lib/today';

export const dynamic = 'force-dynamic';

// Plaid calls this when new transactions are available. For SYNC_UPDATES_AVAILABLE
// we re-sync the item and re-run analysis so insights stay fresh automatically.
export async function POST(req: Request) {
  try {
    const raw = await req.text();

    // Reject forged webhooks in production. In sandbox/dev the signature may be
    // absent (e.g. manual testing), so we only enforce when env is production.
    const verified = await verifyPlaidWebhook(raw, req.headers.get('plaid-verification'));
    if (process.env.PLAID_ENV === 'production' && !verified) {
      return NextResponse.json({ error: 'invalid signature' }, { status: 401 });
    }

    const body = JSON.parse(raw || '{}');
    const { webhook_type, webhook_code, item_id } = body;

    if (
      webhook_type === 'TRANSACTIONS' &&
      ['SYNC_UPDATES_AVAILABLE', 'DEFAULT_UPDATE', 'INITIAL_UPDATE', 'HISTORICAL_UPDATE'].includes(
        webhook_code,
      )
    ) {
      const db = supabaseAdmin();
      const { data, error } = await db
        .from('plaid_items')
        .select('item_id, access_token, cursor')
        .eq('item_id', item_id)
        .single();
      if (error) throw new Error(error.message);
      if (data) {
        await syncItem({
          item_id: data.item_id,
          access_token: decryptSecret(data.access_token), // stored encrypted
          cursor: data.cursor,
        });
        await runAnalysis(today());
      }
    }

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    console.error('webhook error', err?.response?.data || err);
    // Always 200 on processing errors so Plaid doesn't hammer retries.
    return NextResponse.json({ ok: false }, { status: 200 });
  }
}
