import { getTransactions, insertInsights, upsertStreams } from '../db';
import { listBudgets } from '../budgets';
import { detectRecurringStreams } from './recurring';
import { budgetInsights, runDetectors } from './detectors';

// The full analysis pass: detect subscriptions, run every detector, persist
// streams and any newly-found insights. Returns a summary for the UI/alerts.
export async function runAnalysis(today: string): Promise<{
  transactions: number;
  streams: number;
  newInsights: number;
}> {
  const txns = await getTransactions();
  const spendStreams = detectRecurringStreams(txns, today, 'spend');
  const incomeStreams = detectRecurringStreams(txns, today, 'income');
  await upsertStreams([...spendStreams, ...incomeStreams]);

  // Runaway/overspend detectors only consider active subscriptions (spend
  // streams still being charged) — not old/ended ones from historical data.
  const activeStreams = spendStreams.filter((s) => s.status !== 'ended');
  const drafts = runDetectors(txns, activeStreams, today);
  const budgetDrafts = budgetInsights(txns, await listBudgets(), today);
  const newInsights = await insertInsights([...drafts, ...budgetDrafts]);

  return { transactions: txns.length, streams: spendStreams.length, newInsights };
}
