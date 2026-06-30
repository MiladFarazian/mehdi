import { supabaseAdmin } from './supabase';

export type Budget = { category: string; monthly_limit: number };

// All budget reads are tolerant of the table not existing yet (before the
// 0002_budgets migration is applied), so the rest of the app never breaks.

export async function budgetsTableExists(): Promise<boolean> {
  try {
    const { error } = await supabaseAdmin().from('budgets').select('id').limit(1);
    return !error;
  } catch {
    return false;
  }
}

export async function listBudgets(): Promise<Budget[]> {
  try {
    const { data, error } = await supabaseAdmin().from('budgets').select('category, monthly_limit');
    if (error) return [];
    return (data || []).map((b) => ({ category: b.category, monthly_limit: Number(b.monthly_limit) }));
  } catch {
    return [];
  }
}

export async function upsertBudget(category: string, monthly_limit: number): Promise<void> {
  const { error } = await supabaseAdmin()
    .from('budgets')
    .upsert({ category, monthly_limit }, { onConflict: 'category' });
  if (error) throw new Error(error.message);
}

export async function deleteBudget(category: string): Promise<void> {
  const { error } = await supabaseAdmin().from('budgets').delete().eq('category', category);
  if (error) throw new Error(error.message);
}
