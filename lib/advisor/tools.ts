import { supabaseAdmin } from '../supabase';
import { annualCost } from '../analysis/recurring';
import { NON_SPEND_CATEGORIES } from '../analysis/normalize';
import { monthKey } from '../analysis/stats';

// Read-only tools the advisor can call so every number it states is grounded in
// real rows — the model never invents figures.

export const advisorTools = [
  {
    name: 'query_spending',
    description:
      'Aggregate the user\'s spending. Returns totals grouped by category, merchant, or month. Only counts outflows (money spent); excludes transfers and income.',
    input_schema: {
      type: 'object' as const,
      properties: {
        group_by: { type: 'string', enum: ['category', 'merchant', 'month'] },
        start_date: { type: 'string', description: 'YYYY-MM-DD inclusive (optional)' },
        end_date: { type: 'string', description: 'YYYY-MM-DD inclusive (optional)' },
        limit: { type: 'number', description: 'max rows (default 15)' },
      },
      required: ['group_by'],
    },
  },
  {
    name: 'list_subscriptions',
    description: 'List detected recurring subscriptions with their amount, frequency, and annualized cost.',
    input_schema: { type: 'object' as const, properties: {}, required: [] },
  },
  {
    name: 'list_insights',
    description: 'List current findings (price hikes, overspend, duplicate services, etc.) with annualized impact.',
    input_schema: {
      type: 'object' as const,
      properties: { status: { type: 'string', enum: ['new', 'seen', 'actioned', 'dismissed'] } },
      required: [],
    },
  },
] as const;

export async function executeTool(name: string, input: any): Promise<unknown> {
  const db = supabaseAdmin();

  if (name === 'query_spending') {
    let q = db
      .from('transactions')
      .select('amount, pfc_primary, normalized_merchant, date')
      .gt('amount', 0)
      .limit(10000);
    if (input.start_date) q = q.gte('date', input.start_date);
    if (input.end_date) q = q.lte('date', input.end_date);
    const { data, error } = await q;
    if (error) throw new Error(error.message);

    const rows = (data || []).filter((t) => !NON_SPEND_CATEGORIES.has(t.pfc_primary || ''));
    const acc = new Map<string, number>();
    for (const t of rows) {
      const key =
        input.group_by === 'category'
          ? t.pfc_primary || 'UNCATEGORIZED'
          : input.group_by === 'merchant'
            ? t.normalized_merchant || 'UNKNOWN'
            : monthKey(t.date);
      acc.set(key, (acc.get(key) || 0) + Number(t.amount));
    }
    const limit = input.limit || 15;
    return [...acc.entries()]
      .map(([key, total]) => ({ key, total: Number(total.toFixed(2)) }))
      .sort((a, b) => b.total - a.total)
      .slice(0, limit);
  }

  if (name === 'list_subscriptions') {
    const { data, error } = await db
      .from('recurring_streams')
      .select('display_name, category, frequency, avg_amount, last_amount, first_amount, user_status, expected_next')
      .order('avg_amount', { ascending: false });
    if (error) throw new Error(error.message);
    return (data || []).map((s) => ({
      ...s,
      annual_cost: annualCost({ frequency: s.frequency, avg_amount: Number(s.avg_amount) }),
    }));
  }

  if (name === 'list_insights') {
    let q = db
      .from('insights')
      .select('type, severity, title, body, annualized_impact, status')
      .order('severity', { ascending: true })
      .limit(100);
    if (input.status) q = q.eq('status', input.status);
    const { data, error } = await q;
    if (error) throw new Error(error.message);
    return data || [];
  }

  throw new Error(`unknown tool: ${name}`);
}
