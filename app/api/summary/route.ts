import { NextResponse } from 'next/server';
import { supabaseAdmin, supabaseConfigured } from '@/lib/supabase';
import { annualCost } from '@/lib/analysis/recurring';
import { lastCompleteMonth } from '@/lib/analysis/baselines';
import { NON_SPEND_CATEGORIES } from '@/lib/analysis/normalize';
import { today } from '@/lib/today';

export const dynamic = 'force-dynamic';

export async function GET() {
  if (!supabaseConfigured()) return NextResponse.json({ configured: false });
  try {
    const db = supabaseAdmin();
    const month = lastCompleteMonth(today());

    const [txnCount, accounts, streams, newInsights, monthTxns] = await Promise.all([
      db.from('transactions').select('transaction_id', { count: 'exact', head: true }),
      db.from('accounts').select('account_id', { count: 'exact', head: true }),
      db.from('recurring_streams').select('frequency, avg_amount'),
      db.from('insights').select('id', { count: 'exact', head: true }).eq('status', 'new'),
      db
        .from('transactions')
        .select('amount, pfc_primary')
        .gte('date', `${month}-01`)
        .lte('date', `${month}-31`),
    ]);

    const subs = streams.data || [];
    const monthlySubCost = subs.reduce(
      (a, s) => a + annualCost({ frequency: s.frequency, avg_amount: Number(s.avg_amount) }) / 12,
      0,
    );

    const lastMonthSpend = (monthTxns.data || [])
      .filter((t) => Number(t.amount) > 0 && !NON_SPEND_CATEGORIES.has(t.pfc_primary || ''))
      .reduce((a, t) => a + Number(t.amount), 0);

    return NextResponse.json({
      configured: true,
      transactions: txnCount.count || 0,
      accounts: accounts.count || 0,
      subscriptions: subs.length,
      monthlySubscriptionCost: Number(monthlySubCost.toFixed(2)),
      newInsights: newInsights.count || 0,
      lastCompleteMonth: month,
      lastMonthSpend: Number(lastMonthSpend.toFixed(2)),
    });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'Failed' }, { status: 500 });
  }
}
