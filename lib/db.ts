import { supabaseAdmin } from './supabase';
import { annualCost } from './analysis/recurring';
import type { DetectedStream, InsightDraft, Txn } from './analysis/types';

// Fetch ALL transactions needed by the analysis engine. PostgREST caps a single
// response at ~1000 rows regardless of .limit(), so we page through with range().
export async function getTransactions(): Promise<Txn[]> {
  const db = supabaseAdmin();
  const PAGE = 1000;
  const all: Txn[] = [];
  for (let offset = 0; ; offset += PAGE) {
    const { data, error } = await db
      .from('transactions')
      .select(
        'transaction_id, date, amount, name, merchant_name, normalized_merchant, pfc_primary, is_discretionary, pending',
      )
      .order('date', { ascending: true })
      .range(offset, offset + PAGE - 1);
    if (error) throw new Error(error.message);
    const rows = (data || []).map((t) => ({ ...t, amount: Number(t.amount) })) as Txn[];
    all.push(...rows);
    if (rows.length < PAGE) break;
  }
  return all;
}

// Upsert detected streams, preserving any user feedback (user_status) already set.
export async function upsertStreams(streams: DetectedStream[]): Promise<void> {
  const db = supabaseAdmin();
  if (streams.length === 0) return;
  const rows = streams.map((s) => ({
    normalized_merchant: s.normalized_merchant,
    display_name: s.display_name,
    category: s.category,
    frequency: s.frequency,
    avg_amount: s.avg_amount,
    first_amount: s.first_amount,
    last_amount: s.last_amount,
    amount_history: s.amount_history,
    occurrences: s.occurrences,
    first_seen: s.first_seen,
    last_seen: s.last_seen,
    expected_next: s.expected_next,
    status: s.status,
    confidence: s.confidence,
    is_subscription: s.is_subscription,
  }));
  const { error } = await db
    .from('recurring_streams')
    .upsert(rows, { onConflict: 'normalized_merchant' });
  if (error) throw new Error(error.message);
}

// Insert new insights, skipping any whose dedupe_key already exists.
export async function insertInsights(drafts: InsightDraft[]): Promise<number> {
  const db = supabaseAdmin();
  if (drafts.length === 0) return 0;
  const rows = drafts.map((d) => ({
    type: d.type,
    severity: d.severity,
    title: d.title,
    body: d.body,
    facts: d.facts,
    annualized_impact: d.annualized_impact,
    dedupe_key: d.dedupe_key,
  }));
  // ignoreDuplicates so re-running analysis doesn't spam the same finding.
  const { data, error } = await db
    .from('insights')
    .upsert(rows, { onConflict: 'dedupe_key', ignoreDuplicates: true })
    .select('id');
  if (error) throw new Error(error.message);
  return data?.length || 0;
}

export async function getInsights(status?: string) {
  const db = supabaseAdmin();
  let q = db
    .from('insights')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(200);
  if (status) q = q.eq('status', status);
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return data || [];
}

export async function getStreams() {
  const db = supabaseAdmin();
  const { data, error } = await db
    .from('recurring_streams')
    .select('*')
    .eq('is_subscription', true)
    .order('avg_amount', { ascending: false })
    .limit(500);
  if (error) throw new Error(error.message);
  // attach annualized cost for convenience
  return (data || []).map((s) => ({
    ...s,
    annual_cost: annualCost({ frequency: s.frequency, avg_amount: Number(s.avg_amount) }),
  }));
}

// Recurring inflows (paychecks etc.), stored with is_subscription = false.
export async function getIncomeStreams() {
  const db = supabaseAdmin();
  const { data, error } = await db
    .from('recurring_streams')
    .select('*')
    .eq('is_subscription', false)
    .order('avg_amount', { ascending: false })
    .limit(100);
  if (error) throw new Error(error.message);
  return (data || []).map((s) => ({
    ...s,
    annual_income: annualCost({ frequency: s.frequency, avg_amount: Number(s.avg_amount) }),
  }));
}
