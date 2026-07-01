import { NextResponse } from 'next/server';
import { supabaseConfigured } from '@/lib/supabase';
import { getInsights, getTransactions } from '@/lib/db';
import { NON_INCOME_CATEGORIES, NON_SPEND_CATEGORIES } from '@/lib/analysis/normalize';
import { lastCompleteMonth } from '@/lib/analysis/baselines';
import { monthKey } from '@/lib/analysis/stats';
import { today } from '@/lib/today';

export const dynamic = 'force-dynamic';

// Dashboard analytics: savings rollup, monthly spend trend, top categories,
// and income-vs-spend for the latest complete month.
export async function GET() {
  if (!supabaseConfigured()) return NextResponse.json({ configured: false });
  try {
    const [txns, insights] = await Promise.all([getTransactions(), getInsights()]);

    const spendByMonth = new Map<string, number>();
    const incomeByMonth = new Map<string, number>();
    for (const t of txns) {
      if (t.pending) continue;
      const m = monthKey(t.date);
      if (t.amount > 0 && !NON_SPEND_CATEGORIES.has(t.pfc_primary || '')) {
        spendByMonth.set(m, (spendByMonth.get(m) || 0) + t.amount);
      } else if (t.amount < 0 && !NON_INCOME_CATEGORIES.has(t.pfc_primary || '')) {
        incomeByMonth.set(m, (incomeByMonth.get(m) || 0) + Math.abs(t.amount));
      }
    }

    const monthlyTrend = [...spendByMonth.keys()]
      .sort()
      .slice(-6)
      .map((m) => ({ month: m, spend: Number((spendByMonth.get(m) || 0).toFixed(2)) }));

    const cfMonths = [...new Set([...spendByMonth.keys(), ...incomeByMonth.keys()])]
      .sort()
      .slice(-6);
    const monthlyCashflow = cfMonths.map((m) => {
      const income = Number((incomeByMonth.get(m) || 0).toFixed(2));
      const spend = Number((spendByMonth.get(m) || 0).toFixed(2));
      return { month: m, income, spend, net: Number((income - spend).toFixed(2)) };
    });

    // Day-of-week spending patterns (avg spend per that weekday)
    const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const dowTotal = new Array(7).fill(0);
    const dowDates: Set<string>[] = Array.from({ length: 7 }, () => new Set<string>());
    for (const t of txns) {
      if (t.pending || t.amount <= 0 || NON_SPEND_CATEGORIES.has(t.pfc_primary || '')) continue;
      const dow = new Date(`${t.date}T00:00:00Z`).getUTCDay();
      dowTotal[dow] += t.amount;
      dowDates[dow].add(t.date);
    }
    const order = [1, 2, 3, 4, 5, 6, 0]; // Mon … Sun
    const byDayOfWeek = order.map((i) => ({
      label: DOW[i],
      total: Number(dowTotal[i].toFixed(2)),
      avgPerDay: dowDates[i].size ? Number((dowTotal[i] / dowDates[i].size).toFixed(2)) : 0,
    }));
    const sum = (idx: number[], arr: number[]) => idx.reduce((s, i) => s + arr[i], 0);
    const weekdayDays = sum([1, 2, 3, 4, 5], dowDates.map((s) => s.size));
    const weekendDays = sum([0, 6], dowDates.map((s) => s.size));
    const weekdayAvg = weekdayDays ? sum([1, 2, 3, 4, 5], dowTotal) / weekdayDays : 0;
    const weekendAvg = weekendDays ? sum([0, 6], dowTotal) / weekendDays : 0;
    const priciestDay = [...byDayOfWeek].sort((a, b) => b.avgPerDay - a.avgPerDay)[0]?.label ?? null;
    const spendingPatterns = {
      byDayOfWeek,
      weekdayAvg: Number(weekdayAvg.toFixed(2)),
      weekendAvg: Number(weekendAvg.toFixed(2)),
      priciestDay,
    };

    const lcm = lastCompleteMonth(today());
    const catTotals = new Map<string, number>();
    for (const t of txns) {
      if (t.pending || t.amount <= 0) continue;
      if (NON_SPEND_CATEGORIES.has(t.pfc_primary || '')) continue;
      if (monthKey(t.date) !== lcm) continue;
      const c = t.pfc_primary || 'UNCATEGORIZED';
      catTotals.set(c, (catTotals.get(c) || 0) + t.amount);
    }
    const topCategories = [...catTotals.entries()]
      .map(([category, total]) => ({ category, total: Number(total.toFixed(2)) }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 8);

    // Only count locked-in, actionable savings (cancel/fix a subscription).
    // Overspend/behavioral spikes are annualized ×12 and would inflate this.
    const FIXABLE = new Set(['price_creep', 'duplicate_services', 'new_recurring', 'annual_renewal']);
    const savingsInsights = insights.filter(
      (i) => i.status !== 'dismissed' && i.annualized_impact && FIXABLE.has(i.type),
    );
    const potentialSavings = Number(
      savingsInsights.reduce((a, i) => a + Number(i.annualized_impact), 0).toFixed(2),
    );

    return NextResponse.json({
      configured: true,
      potentialSavings,
      savingsCount: savingsInsights.length,
      monthlyTrend,
      monthlyCashflow,
      spendingPatterns,
      topCategories,
      lastCompleteMonth: lcm,
      income: Number((incomeByMonth.get(lcm) || 0).toFixed(2)),
      spend: Number((spendByMonth.get(lcm) || 0).toFixed(2)),
    });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'Failed' }, { status: 500 });
  }
}
