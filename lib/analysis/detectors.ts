import { annualCost, periodsPerYear } from './recurring';
import {
  categoryBaselines,
  categoryMonthlyTotals,
  lastCompleteMonth,
} from './baselines';
import { linregSlope, daysBetween, monthKey } from './stats';
import { isDiscretionary } from './normalize';
import type { DetectedStream, InsightDraft, Txn } from './types';

const PRICE_CREEP_PCT = 0.1; // flag a sustained increase of ≥10%
const NEW_RECURRING_DAYS = 45; // a stream first seen this recently is "new"
const ANNUAL_RENEWAL_WARN_DAYS = 30;
const OVERSPEND_K = 2; // latest > median + k·MAD ⇒ anomaly

function money(n: number): string {
  return `$${Math.abs(n).toFixed(2)}`;
}

// 1. Price creep — subscription amount climbed over time.
function priceCreep(streams: DetectedStream[]): InsightDraft[] {
  const out: InsightDraft[] = [];
  for (const s of streams) {
    if (s.occurrences < 3 || s.first_amount <= 0) continue;
    const pct = (s.last_amount - s.first_amount) / s.first_amount;
    if (pct < PRICE_CREEP_PCT) continue;
    const annualImpact = Number(
      ((s.last_amount - s.first_amount) * periodsPerYear(s.frequency)).toFixed(2),
    );
    out.push({
      type: 'price_creep',
      severity: pct >= 0.25 ? 'high' : 'warn',
      title: `${s.display_name} went up ${(pct * 100).toFixed(0)}%`,
      body: `${s.display_name} rose from ${money(s.first_amount)} to ${money(
        s.last_amount,
      )} (${s.frequency}). That's about ${money(annualImpact)}/yr more than when you started.`,
      facts: {
        merchant: s.display_name,
        first_amount: s.first_amount,
        last_amount: s.last_amount,
        pct_increase: Number((pct * 100).toFixed(1)),
        frequency: s.frequency,
      },
      annualized_impact: annualImpact,
      dedupe_key: `price_creep:${s.normalized_merchant}:${s.last_amount}`,
    });
  }
  return out;
}

// 2. New recurring charge — a stream that appeared recently (possible trial→paid).
function newRecurring(streams: DetectedStream[], today: string): InsightDraft[] {
  const out: InsightDraft[] = [];
  for (const s of streams) {
    if (daysBetween(s.first_seen, today) > NEW_RECURRING_DAYS) continue;
    out.push({
      type: 'new_recurring',
      severity: 'warn',
      title: `New recurring charge: ${s.display_name}`,
      body: `A new ${s.frequency} charge of ${money(
        s.avg_amount,
      )} from ${s.display_name} started on ${s.first_seen} — roughly ${money(
        annualCost(s),
      )}/yr. If this was a free trial converting to paid, cancel now if you don't want it.`,
      facts: {
        merchant: s.display_name,
        amount: s.avg_amount,
        frequency: s.frequency,
        first_seen: s.first_seen,
      },
      annualized_impact: annualCost(s),
      dedupe_key: `new_recurring:${s.normalized_merchant}:${s.first_seen}`,
    });
  }
  return out;
}

// 3. Duplicate / overlapping services — multiple active subs in one category.
function duplicateServices(streams: DetectedStream[]): InsightDraft[] {
  const active = streams.filter((s) => s.status !== 'ended' && s.category);
  const byCat = new Map<string, DetectedStream[]>();
  for (const s of active) {
    const c = s.category!;
    if (!byCat.has(c)) byCat.set(c, []);
    byCat.get(c)!.push(s);
  }
  const out: InsightDraft[] = [];
  for (const [cat, group] of byCat) {
    if (group.length < 2) continue;
    const total = group.reduce((a, s) => a + annualCost(s), 0);
    const names = group.map((s) => s.display_name).join(', ');
    out.push({
      type: 'duplicate_services',
      severity: group.length >= 3 ? 'high' : 'warn',
      title: `${group.length} overlapping ${cat.replace(/_/g, ' ').toLowerCase()} subscriptions`,
      body: `You're paying for ${group.length} services in the same category (${names}) totaling about ${money(
        total,
      )}/yr. Consider consolidating to one.`,
      facts: { category: cat, services: names, count: group.length, annual_total: Number(total.toFixed(2)) },
      annualized_impact: Number(total.toFixed(2)),
      dedupe_key: `duplicate:${cat}:${group.length}`,
    });
  }
  return out;
}

// 4. Annual renewal pre-warning — a big yearly charge about to hit.
function annualRenewal(streams: DetectedStream[], today: string): InsightDraft[] {
  const out: InsightDraft[] = [];
  for (const s of streams) {
    if (s.frequency !== 'annual') continue;
    const daysUntil = daysBetween(today, s.expected_next);
    if (daysUntil < 0 || daysUntil > ANNUAL_RENEWAL_WARN_DAYS) continue;
    out.push({
      type: 'annual_renewal',
      severity: 'info',
      title: `${s.display_name} renews in ${daysUntil} days`,
      body: `${s.display_name} (${money(s.avg_amount)}/yr) is set to renew around ${
        s.expected_next
      }. Cancel before then if you no longer want it.`,
      facts: { merchant: s.display_name, amount: s.avg_amount, renews_on: s.expected_next },
      annualized_impact: s.avg_amount,
      dedupe_key: `annual_renewal:${s.normalized_merchant}:${s.expected_next}`,
    });
  }
  return out;
}

// 5. Category overspend — latest full month above its own robust baseline.
function categoryOverspend(txns: Txn[], today: string): InsightDraft[] {
  const month = lastCompleteMonth(today);
  const baselines = categoryBaselines(categoryMonthlyTotals(txns), month);
  const out: InsightDraft[] = [];
  for (const b of baselines) {
    const threshold = b.baselineMedian + OVERSPEND_K * b.baselineMad;
    if (b.latestTotal <= threshold || b.deltaVsBaseline <= 0) continue;
    out.push({
      type: 'category_overspend',
      severity: b.deltaVsBaseline > b.baselineMedian ? 'high' : 'warn',
      title: `${b.category.replace(/_/g, ' ')} spending spiked in ${month}`,
      body: `You spent ${money(b.latestTotal)} on ${b.category
        .replace(/_/g, ' ')
        .toLowerCase()} in ${month} vs your usual ${money(
        b.baselineMedian,
      )}/mo — ${money(b.deltaVsBaseline)} over. Returning to your typical level would save about ${money(
        b.deltaVsBaseline * 12,
      )}/yr.`,
      facts: {
        category: b.category,
        month,
        spent: b.latestTotal,
        baseline: b.baselineMedian,
        over_by: b.deltaVsBaseline,
      },
      annualized_impact: Number((b.deltaVsBaseline * 12).toFixed(2)),
      dedupe_key: `category_overspend:${b.category}:${month}`,
    });
  }
  return out;
}

// 6. Merchant spike — one merchant well above its own monthly median.
function merchantSpike(txns: Txn[], today: string): InsightDraft[] {
  const month = lastCompleteMonth(today);
  const byMerchantMonth = new Map<string, Map<string, number>>();
  for (const t of txns) {
    if (t.amount <= 0 || t.pending || !t.is_discretionary) continue;
    const m = t.normalized_merchant;
    if (!m) continue;
    if (!byMerchantMonth.has(m)) byMerchantMonth.set(m, new Map());
    const mm = byMerchantMonth.get(m)!;
    const k = monthKey(t.date);
    mm.set(k, (mm.get(k) || 0) + t.amount);
  }
  const out: InsightDraft[] = [];
  for (const [merchant, months] of byMerchantMonth) {
    const latest = months.get(month);
    if (latest === undefined) continue;
    const prior = [...months.entries()].filter(([k]) => k < month).map(([, v]) => v);
    if (prior.length < 2) continue;
    const med = prior.slice().sort((a, b) => a - b)[Math.floor(prior.length / 2)];
    if (med <= 0 || latest < med * 1.75 || latest - med < 75) continue;
    out.push({
      type: 'merchant_spike',
      severity: 'warn',
      title: `Unusual spend at ${merchant}`,
      body: `${money(latest)} at ${merchant} in ${month} vs your typical ${money(
        med,
      )}/mo. Worth a look.`,
      facts: { merchant, month, spent: Number(latest.toFixed(2)), typical: Number(med.toFixed(2)) },
      annualized_impact: null,
      dedupe_key: `merchant_spike:${merchant}:${month}`,
    });
  }
  return out;
}

// 7. Lifestyle creep — discretionary spend trending up month over month.
function lifestyleCreep(txns: Txn[]): InsightDraft[] {
  const byMonth = new Map<string, number>();
  for (const t of txns) {
    if (t.amount <= 0 || t.pending) continue;
    if (!isDiscretionary(t.pfc_primary)) continue;
    const k = monthKey(t.date);
    byMonth.set(k, (byMonth.get(k) || 0) + t.amount);
  }
  const months = [...byMonth.keys()].sort();
  if (months.length < 4) return [];
  const series = months.map((m) => byMonth.get(m)!);
  const slope = linregSlope(series); // $/month change
  if (slope < 50) return [];
  return [
    {
      type: 'lifestyle_creep',
      severity: 'warn',
      title: 'Discretionary spending is creeping up',
      body: `Your discretionary spending has trended up by about ${money(
        slope,
      )}/month over the last ${months.length} months. Small lifestyle creep adds up to roughly ${money(
        slope * 12,
      )}/yr.`,
      facts: { slope_per_month: Number(slope.toFixed(2)), months: months.length },
      annualized_impact: Number((slope * 12).toFixed(2)),
      dedupe_key: `lifestyle_creep:${months[months.length - 1]}`,
    },
  ];
}

// Small leaks — many small discretionary charges at one merchant that quietly
// add up over the latest complete month.
function smallLeaks(txns: Txn[], today: string): InsightDraft[] {
  const month = lastCompleteMonth(today);
  const byMerchant = new Map<string, { count: number; total: number }>();
  for (const t of txns) {
    if (t.amount <= 0 || t.pending || !t.is_discretionary) continue;
    if (t.amount > 25) continue; // only small charges
    if (monthKey(t.date) !== month) continue;
    const m = t.normalized_merchant;
    if (!m) continue;
    const e = byMerchant.get(m) || { count: 0, total: 0 };
    e.count += 1;
    e.total += t.amount;
    byMerchant.set(m, e);
  }
  const out: InsightDraft[] = [];
  for (const [m, e] of byMerchant) {
    if (e.count < 5 || e.total < 75) continue;
    out.push({
      type: 'small_leaks',
      severity: 'info',
      title: `Small charges add up at ${m}`,
      body: `${e.count} small charges at ${m} in ${month} summed to ${money(e.total)} (avg ${money(
        e.total / e.count,
      )}). The little ones add up — about ${money(e.total * 12)}/yr at this pace.`,
      facts: { merchant: m, count: e.count, total: Number(e.total.toFixed(2)), month },
      annualized_impact: Number((e.total * 12).toFixed(2)),
      dedupe_key: `small_leaks:${m}:${month}`,
    });
  }
  return out;
}

// Budget overspend — current (in-progress) month spend above a set limit.
export function budgetInsights(
  txns: Txn[],
  budgets: { category: string; monthly_limit: number }[],
  today: string,
): InsightDraft[] {
  if (!budgets.length) return [];
  const month = monthKey(today);
  const spend = new Map<string, number>();
  for (const t of txns) {
    if (t.amount <= 0 || t.pending || monthKey(t.date) !== month) continue;
    const c = t.pfc_primary || 'UNCATEGORIZED';
    spend.set(c, (spend.get(c) || 0) + t.amount);
  }
  const out: InsightDraft[] = [];
  for (const b of budgets) {
    const s = spend.get(b.category) || 0;
    if (s <= b.monthly_limit) continue;
    const label = b.category.replace(/_/g, ' ').toLowerCase();
    out.push({
      type: 'budget_exceeded',
      severity: 'warn',
      title: `Over budget on ${label}`,
      body: `You've spent ${money(s)} of your ${money(b.monthly_limit)} ${month} budget for ${label} — ${money(
        s - b.monthly_limit,
      )} over.`,
      facts: { category: b.category, spent: Number(s.toFixed(2)), limit: b.monthly_limit, month },
      annualized_impact: null,
      dedupe_key: `budget_exceeded:${b.category}:${month}`,
    });
  }
  return out;
}

// Run every detector and return the combined, severity-ranked drafts.
export function runDetectors(
  txns: Txn[],
  streams: DetectedStream[],
  today: string,
): InsightDraft[] {
  const drafts = [
    ...priceCreep(streams),
    ...newRecurring(streams, today),
    ...duplicateServices(streams),
    ...annualRenewal(streams, today),
    ...categoryOverspend(txns, today),
    ...merchantSpike(txns, today),
    ...lifestyleCreep(txns),
    ...smallLeaks(txns, today),
  ];
  const rank = { high: 0, warn: 1, info: 2 } as const;
  return drafts.sort((a, b) => rank[a.severity] - rank[b.severity]);
}
