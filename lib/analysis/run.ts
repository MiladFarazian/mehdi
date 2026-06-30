import { getTransactions, insertInsights, upsertStreams } from '../db';
import { detectRecurringStreams } from './recurring';
import { runDetectors } from './detectors';

// The full analysis pass: detect subscriptions, run every detector, persist
// streams and any newly-found insights. Returns a summary for the UI/alerts.
export async function runAnalysis(today: string): Promise<{
  transactions: number;
  streams: number;
  newInsights: number;
}> {
  const txns = await getTransactions();
  const streams = detectRecurringStreams(txns, today);
  await upsertStreams(streams);

  const drafts = runDetectors(txns, streams, today);
  const newInsights = await insertInsights(drafts);

  return { transactions: txns.length, streams: streams.length, newInsights };
}
