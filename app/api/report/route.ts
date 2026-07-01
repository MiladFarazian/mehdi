import { NextResponse } from 'next/server';
import { supabaseConfigured } from '@/lib/supabase';
import { getInsights, getStreams, getTransactions } from '@/lib/db';
import { listBudgets } from '@/lib/budgets';
import { NON_INCOME_CATEGORIES, NON_SPEND_CATEGORIES, titleCase } from '@/lib/analysis/normalize';
import { monthKey } from '@/lib/analysis/stats';
import { lastCompleteMonth } from '@/lib/analysis/baselines';
import { today } from '@/lib/today';

export const dynamic = 'force-dynamic';

// A self-contained monthly report for the requested (or last complete) month.
export async function GET(req: Request) {
  if (!supabaseConfigured()) return NextResponse.json({ configured: false });
  try {
    const [txns, streams, insights, budgets] = await Promise.all([
      getTransactions(),
      getStreams(),
      getInsights(),
      listBudgets(),
    ]);

    const availableMonths = [...new Set(txns.map((t) => monthKey(t.date)))].sort().reverse();
    const month = new URL(req.url).searchParams.get('month') || lastCompleteMonth(today());
    const rows = txns.filter((t) => monthKey(t.date) === month && !t.pending);

    let income = 0;
    let spend = 0;
    const cat = new Map<string, number>();
    const merch = new Map<string, { total: number; count: number; name: string }>();
    for (const t of rows) {
      if (t.amount < 0 && !NON_INCOME_CATEGORIES.has(t.pfc_primary || '')) income += Math.abs(t.amount);
      else if (t.amount > 0 && !NON_SPEND_CATEGORIES.has(t.pfc_primary || '')) {
        spend += t.amount;
        const c = t.pfc_primary || 'UNCATEGORIZED';
        cat.set(c, (cat.get(c) || 0) + t.amount);
        const e = merch.get(t.normalized_merchant) || { total: 0, count: 0, name: t.merchant_name || t.normalized_merchant };
        e.total += t.amount;
        e.count += 1;
        merch.set(t.normalized_merchant, e);
      }
    }

    const budgetStatus = budgets.map((b) => ({
      category: b.category,
      limit: b.monthly_limit,
      spent: Number((cat.get(b.category) || 0).toFixed(2)),
    }));

    const monthlySubTotal = streams.reduce((s, x) => s + Number(x.annual_cost) / 12, 0);

    return NextResponse.json({
      configured: true,
      month,
      availableMonths,
      income: Number(income.toFixed(2)),
      spend: Number(spend.toFixed(2)),
      net: Number((income - spend).toFixed(2)),
      topCategories: [...cat.entries()]
        .map(([category, total]) => ({ category, total: Number(total.toFixed(2)) }))
        .sort((a, b) => b.total - a.total),
      topMerchants: [...merch.entries()]
        .map(([merchant, e]) => ({ merchant, display_name: titleCase(e.name), total: Number(e.total.toFixed(2)), count: e.count }))
        .sort((a, b) => b.total - a.total)
        .slice(0, 8),
      subscriptions: { count: streams.length, monthlyTotal: Number(monthlySubTotal.toFixed(2)) },
      budgets: budgetStatus,
      insights: insights
        .filter((i) => i.status !== 'dismissed')
        .map((i) => ({ type: i.type, severity: i.severity, title: i.title, annualized_impact: i.annualized_impact })),
    });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'Failed' }, { status: 500 });
  }
}
