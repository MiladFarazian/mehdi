import { getInsights, getStreams, getTransactions } from '../db';
import { supabaseAdmin } from '../supabase';
import { listBudgets } from '../budgets';
import { categoryMonthlyTotals } from '../analysis/baselines';
import { NON_SPEND_CATEGORIES } from '../analysis/normalize';
import { monthKey } from '../analysis/stats';
import { today } from '../today';

const ASSET_TYPES = new Set(['depository', 'investment', 'brokerage', 'other']);
const LIABILITY_TYPES = new Set(['credit', 'loan']);

// A compact, grounded snapshot of the user's finances, passed to the advisor so
// every figure it cites comes from real data (the CLI path is single-shot, so we
// give it the numbers up front instead of letting it call tools).
export async function buildFinancialContext() {
  const [txns, subscriptions, insights, budgets, acctRes] = await Promise.all([
    getTransactions(),
    getStreams(),
    getInsights(),
    listBudgets(),
    supabaseAdmin().from('accounts').select('type, current_balance'),
  ]);

  // Net worth
  const accounts = acctRes.data || [];
  const assets = accounts
    .filter((a) => ASSET_TYPES.has(a.type || ''))
    .reduce((s, a) => s + Number(a.current_balance || 0), 0);
  const liabilities = accounts
    .filter((a) => LIABILITY_TYPES.has(a.type || ''))
    .reduce((s, a) => s + Number(a.current_balance || 0), 0);

  // Top merchants by total spend
  const merchantTotals = new Map<string, number>();
  for (const t of txns) {
    if (t.amount > 0 && !t.pending) {
      merchantTotals.set(t.normalized_merchant, (merchantTotals.get(t.normalized_merchant) || 0) + t.amount);
    }
  }
  const topMerchants = [...merchantTotals.entries()]
    .map(([merchant, total]) => ({ merchant, total: Number(total.toFixed(2)) }))
    .sort((a, b) => b.total - a.total)
    .slice(0, 15);

  // Cash flow (last 6 months)
  const spendByMonth = new Map<string, number>();
  const incomeByMonth = new Map<string, number>();
  for (const t of txns) {
    if (t.pending) continue;
    const m = monthKey(t.date);
    if (t.amount > 0 && !NON_SPEND_CATEGORIES.has(t.pfc_primary || '')) {
      spendByMonth.set(m, (spendByMonth.get(m) || 0) + t.amount);
    } else if (t.amount < 0) {
      incomeByMonth.set(m, (incomeByMonth.get(m) || 0) + Math.abs(t.amount));
    }
  }
  const cfMonths = [...new Set([...spendByMonth.keys(), ...incomeByMonth.keys()])].sort().slice(-6);
  const cashflow = cfMonths.map((m) => ({
    month: m,
    income: Number((incomeByMonth.get(m) || 0).toFixed(2)),
    spend: Number((spendByMonth.get(m) || 0).toFixed(2)),
    net: Number(((incomeByMonth.get(m) || 0) - (spendByMonth.get(m) || 0)).toFixed(2)),
  }));

  // Budgets vs current-month spend
  const curMonth = monthKey(today());
  const curSpend = new Map<string, number>();
  for (const t of txns) {
    if (t.amount > 0 && !t.pending && monthKey(t.date) === curMonth) {
      const c = t.pfc_primary || 'UNCATEGORIZED';
      curSpend.set(c, (curSpend.get(c) || 0) + t.amount);
    }
  }
  const budgetStatus = budgets.map((b) => ({
    category: b.category,
    limit: b.monthly_limit,
    spent: Number((curSpend.get(b.category) || 0).toFixed(2)),
  }));

  return {
    net_worth: Number((assets - liabilities).toFixed(2)),
    assets: Number(assets.toFixed(2)),
    liabilities: Number(liabilities.toFixed(2)),
    cashflow,
    budgets: budgetStatus,
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
