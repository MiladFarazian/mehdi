// Shared shapes used across the analysis engine.

export type Txn = {
  transaction_id: string;
  date: string; // YYYY-MM-DD
  amount: number; // Plaid sign: + = money OUT (spend)
  name: string | null;
  merchant_name: string | null;
  normalized_merchant: string;
  pfc_primary: string | null;
  is_discretionary: boolean | null;
  pending: boolean | null;
};

export type DetectedStream = {
  normalized_merchant: string;
  display_name: string;
  category: string | null;
  frequency: 'weekly' | 'biweekly' | 'monthly' | 'quarterly' | 'annual';
  avg_amount: number;
  first_amount: number;
  last_amount: number;
  amount_history: { date: string; amount: number }[];
  occurrences: number;
  first_seen: string;
  last_seen: string;
  expected_next: string;
  status: 'active' | 'late' | 'ended';
  confidence: number;
  is_subscription: boolean;
};

export type InsightDraft = {
  type:
    | 'price_creep'
    | 'new_recurring'
    | 'duplicate_services'
    | 'annual_renewal'
    | 'category_overspend'
    | 'merchant_spike'
    | 'lifestyle_creep'
    | 'small_leaks';
  severity: 'info' | 'warn' | 'high';
  title: string;
  body: string;
  facts: Record<string, unknown>;
  annualized_impact: number | null;
  dedupe_key: string;
};
