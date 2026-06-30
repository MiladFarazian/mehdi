import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { syncItem } from '@/lib/sync';
import { runAnalysis } from '@/lib/analysis/run';
import { today } from '@/lib/today';

export const dynamic = 'force-dynamic';

// Plaid calls this when new transactions are available. For SYNC_UPDATES_AVAILABLE
// we re-sync the item and re-run analysis so insights stay fresh automatically.
// NOTE(prod): verify the Plaid webhook JWT before trusting the payload.
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { webhook_type, webhook_code, item_id } = body;

    if (
      webhook_type === 'TRANSACTIONS' &&
      (webhook_code === 'SYNC_UPDATES_AVAILABLE' ||
        webhook_code === 'DEFAULT_UPDATE' ||
        webhook_code === 'INITIAL_UPDATE' ||
        webhook_code === 'HISTORICAL_UPDATE')
    ) {
      const db = supabaseAdmin();
      const { data, error } = await db
        .from('plaid_items')
        .select('item_id, access_token, cursor')
        .eq('item_id', item_id)
        .single();
      if (error) throw new Error(error.message);
      if (data) {
        await syncItem(data as any);
        await runAnalysis(today());
      }
    }

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    console.error('webhook error', err?.response?.data || err);
    // Always 200 so Plaid doesn't hammer retries on our processing errors.
    return NextResponse.json({ ok: false }, { status: 200 });
  }
}
