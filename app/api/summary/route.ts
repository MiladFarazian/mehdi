import { NextResponse } from 'next/server';
import { supabaseAdmin, supabaseConfigured } from '@/lib/supabase';
import { annualCost } from '@/lib/analysis/recurring';
import { lastCompleteMonth } from '@/lib/analysis/baselines';
import { NON_SPEND_CATEGORIES } from '@/lib/analysis/normalize';
import { monthStart, nextMonthStart } from '@/lib/analysis/stats';
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
      db
        .from('recurring_streams')
        .select('frequency, avg_amount, user_status')
        .eq('is_subscription', true)
        .in('status', ['active', 'late']),
      db.from('insights').select('id', { count: 'exact', head: true }).eq('status', 'new'),
      db
        .from('transactions')
        .select('amount, pfc_primary')
        .gte('date', monthStart(month))
        .lt('date', nextMonthStart(month)),
    ]);

    const subs = (streams.data || []).filter((s) => s.user_status !== 'not_subscription');
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
