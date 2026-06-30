import { mad, median, monthKey } from './stats';
import { NON_SPEND_CATEGORIES } from './normalize';
import type { Txn } from './types';

export type CategoryMonth = {
  category: string;
  month: string; // YYYY-MM
  total: number;
};

export type CategoryBaseline = {
  category: string;
  baselineMedian: number; // robust monthly baseline from prior full months
  baselineMad: number;
  latestMonth: string;
  latestTotal: number;
  deltaVsBaseline: number; // latestTotal - baselineMedian
};

// Sum spend per category per month (outflows only, excluding transfers/income).
export function categoryMonthlyTotals(txns: Txn[]): CategoryMonth[] {
  const acc = new Map<string, number>();
  for (const t of txns) {
    if (t.amount <= 0 || t.pending) continue;
    const cat = t.pfc_primary || 'UNCATEGORIZED';
    if (NON_SPEND_CATEGORIES.has(cat)) continue;
    const key = `${cat}|${monthKey(t.date)}`;
    acc.set(key, (acc.get(key) || 0) + t.amount);
  }
  return [...acc.entries()].map(([key, total]) => {
    const [category, month] = key.split('|');
    return { category, month, total: Number(total.toFixed(2)) };
  });
}

// For each category, build a robust baseline from prior full months and compare
// the latest month against it. `latestCompleteMonth` should exclude the current
// partial month so we don't false-alarm mid-month.
export function categoryBaselines(
  rows: CategoryMonth[],
  latestCompleteMonth: string,
): CategoryBaseline[] {
  const byCat = new Map<string, CategoryMonth[]>();
  for (const r of rows) {
    if (!byCat.has(r.category)) byCat.set(r.category, []);
    byCat.get(r.category)!.push(r);
  }

  const out: CategoryBaseline[] = [];
  for (const [category, series] of byCat) {
    const latest = series.find((s) => s.month === latestCompleteMonth);
    if (!latest) continue;
    const prior = series.filter((s) => s.month < latestCompleteMonth).map((s) => s.total);
    if (prior.length < 2) continue; // need history to have a baseline

    const baselineMedian = Number(median(prior).toFixed(2));
    const baselineMad = Number(mad(prior).toFixed(2));
    out.push({
      category,
      baselineMedian,
      baselineMad,
      latestMonth: latest.month,
      latestTotal: latest.total,
      deltaVsBaseline: Number((latest.total - baselineMedian).toFixed(2)),
    });
  }
  return out.sort((a, b) => b.deltaVsBaseline - a.deltaVsBaseline);
}

// The most recent month that is fully elapsed relative to `today`.
export function lastCompleteMonth(today: string): string {
  const d = new Date(today);
  d.setUTCDate(1);
  d.setUTCMonth(d.getUTCMonth() - 1);
  return d.toISOString().slice(0, 7);
}
