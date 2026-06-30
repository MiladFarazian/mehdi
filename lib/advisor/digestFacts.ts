import { getInsights, getStreams, getTransactions } from '../db';
import { categoryBaselines, categoryMonthlyTotals, lastCompleteMonth } from '../analysis/baselines';
import { today } from '../today';

// Precompute the grounded facts the digest is written from.
export async function buildDigestFacts() {
  const txns = await getTransactions();
  const month = lastCompleteMonth(today());

  const baselines = categoryBaselines(categoryMonthlyTotals(txns), month)
    .slice(0, 8)
    .map((b) => ({
      category: b.category,
      spent_this_month: b.latestTotal,
      typical_monthly: b.baselineMedian,
      over_by: b.deltaVsBaseline,
    }));

  const streams = await getStreams();
  const monthlySubCost = streams.reduce((a, s) => a + Number(s.annual_cost) / 12, 0);
  const topSubscriptions = streams.slice(0, 6).map((s) => ({
    name: s.display_name,
    frequency: s.frequency,
    amount: Number(s.avg_amount),
    annual_cost: Number(s.annual_cost),
    user_status: s.user_status,
  }));

  const insights = (await getInsights())
    .filter((i) => i.status === 'new' || i.severity === 'high')
    .slice(0, 8)
    .map((i) => ({
      type: i.type,
      severity: i.severity,
      title: i.title,
      annualized_impact: i.annualized_impact,
    }));

  return {
    period: month,
    categories: baselines,
    subscriptions: {
      count: streams.length,
      monthly_total: Number(monthlySubCost.toFixed(2)),
      top: topSubscriptions,
    },
    findings: insights,
  };
}
