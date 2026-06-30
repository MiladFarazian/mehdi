import { getInsights, getStreams, getTransactions } from '../db';
import { categoryMonthlyTotals } from '../analysis/baselines';

// A compact, grounded snapshot of the user's finances, passed to the advisor so
// every figure it cites comes from real data (the CLI path is single-shot, so we
// give it the numbers up front instead of letting it call tools).
export async function buildFinancialContext() {
  const [txns, subscriptions, insights] = await Promise.all([
    getTransactions(),
    getStreams(),
    getInsights(),
  ]);

  const merchantTotals = new Map<string, number>();
  for (const t of txns) {
    if (t.amount > 0 && !t.pending) {
      merchantTotals.set(
        t.normalized_merchant,
        (merchantTotals.get(t.normalized_merchant) || 0) + t.amount,
      );
    }
  }
  const topMerchants = [...merchantTotals.entries()]
    .map(([merchant, total]) => ({ merchant, total: Number(total.toFixed(2)) }))
    .sort((a, b) => b.total - a.total)
    .slice(0, 15);

  return {
    subscriptions: subscriptions.map((s) => ({
      name: s.display_name,
      frequency: s.frequency,
      amount: Number(s.avg_amount),
      annual_cost: Number(s.annual_cost),
      user_status: s.user_status,
    })),
    monthly_category_spend: categoryMonthlyTotals(txns)
      .sort((a, b) => (a.month < b.month ? 1 : -1))
      .slice(0, 60),
    top_merchants: topMerchants,
    insights: insights.map((i) => ({
      type: i.type,
      severity: i.severity,
      title: i.title,
      annualized_impact: i.annualized_impact,
      status: i.status,
    })),
  };
}
