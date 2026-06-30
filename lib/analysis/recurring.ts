import { addDays, coefficientOfVariation, daysBetween, mean, median } from './stats';
import { titleCase } from './normalize';
import type { DetectedStream, Txn } from './types';

const PERIODS = [
  { name: 'weekly', days: 7 },
  { name: 'biweekly', days: 14 },
  { name: 'monthly', days: 30 },
  { name: 'quarterly', days: 91 },
  { name: 'annual', days: 365 },
] as const;

const MIN_OCCURRENCES = 3;
const INTERVAL_TOLERANCE = 0.25; // gaps may vary ±25% from the matched period
const AMOUNT_CV_MAX = 0.35; // charge amounts must be reasonably stable

function matchPeriod(medianGap: number): (typeof PERIODS)[number] | null {
  let best: (typeof PERIODS)[number] | null = null;
  let bestErr = Infinity;
  for (const p of PERIODS) {
    const err = Math.abs(medianGap - p.days) / p.days;
    if (err < INTERVAL_TOLERANCE && err < bestErr) {
      best = p;
      bestErr = err;
    }
  }
  return best;
}

// Detect recurring streams from a flat list of transactions.
// Groups by normalized merchant, then looks for a regular cadence + stable amount.
// kind='spend' finds subscriptions (outflows); kind='income' finds recurring
// inflows like paychecks. Amounts are stored as positive magnitudes either way.
export function detectRecurringStreams(
  txns: Txn[],
  today: string,
  kind: 'spend' | 'income' = 'spend',
): DetectedStream[] {
  const relevant = txns.filter((t) =>
    !t.pending && (kind === 'income' ? t.amount < 0 : t.amount > 0),
  );

  const byMerchant = new Map<string, Txn[]>();
  for (const t of relevant) {
    const key = t.normalized_merchant;
    if (!key) continue;
    if (!byMerchant.has(key)) byMerchant.set(key, []);
    byMerchant.get(key)!.push(t);
  }

  const streams: DetectedStream[] = [];

  for (const [merchant, groupRaw] of byMerchant) {
    const group = [...groupRaw].sort((a, b) => (a.date < b.date ? -1 : 1));
    if (group.length < MIN_OCCURRENCES) continue;

    const gaps: number[] = [];
    for (let i = 1; i < group.length; i++) {
      gaps.push(daysBetween(group[i - 1].date, group[i].date));
    }
    const medGap = median(gaps);
    const period = matchPeriod(medGap);
    if (!period) continue;

    const amounts = group.map((t) => Math.abs(t.amount)); // positive magnitudes
    const amountCv = coefficientOfVariation(amounts);
    if (amountCv > AMOUNT_CV_MAX) continue; // amounts too erratic to be a subscription

    const intervalCv = coefficientOfVariation(gaps);
    // Confidence blends cadence regularity, amount stability, and sample size.
    const regularity = Math.max(0, 1 - intervalCv);
    const stability = Math.max(0, 1 - amountCv / AMOUNT_CV_MAX);
    const samples = Math.min(1, group.length / 6);
    const confidence = Number((0.5 * regularity + 0.3 * stability + 0.2 * samples).toFixed(2));

    const firstSeen = group[0].date;
    const lastSeen = group[group.length - 1].date;
    const expectedNext = addDays(lastSeen, period.days);
    const overdueBy = daysBetween(expectedNext, today);
    const status: DetectedStream['status'] =
      overdueBy > period.days * INTERVAL_TOLERANCE + 5 ? 'late' : 'active';

    streams.push({
      normalized_merchant: merchant,
      display_name: titleCase(group[group.length - 1].merchant_name || merchant),
      category: group[group.length - 1].pfc_primary,
      frequency: period.name,
      avg_amount: Number(mean(amounts).toFixed(2)),
      first_amount: Number(amounts[0].toFixed(2)),
      last_amount: Number(amounts[amounts.length - 1].toFixed(2)),
      amount_history: group.map((t) => ({ date: t.date, amount: Math.abs(t.amount) })),
      occurrences: group.length,
      first_seen: firstSeen,
      last_seen: lastSeen,
      expected_next: expectedNext,
      status,
      confidence,
      is_subscription: kind === 'spend',
    });
  }

  // Strongest signals first.
  return streams.sort((a, b) => b.confidence - a.confidence);
}

const PERIODS_PER_YEAR: Record<DetectedStream['frequency'], number> = {
  weekly: 52,
  biweekly: 26,
  monthly: 12,
  quarterly: 4,
  annual: 1,
};

export function annualCost(stream: {
  frequency: DetectedStream['frequency'];
  avg_amount: number;
}): number {
  return Number((stream.avg_amount * PERIODS_PER_YEAR[stream.frequency]).toFixed(2));
}

export function periodsPerYear(freq: DetectedStream['frequency']): number {
  return PERIODS_PER_YEAR[freq];
}
