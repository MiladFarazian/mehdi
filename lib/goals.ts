import { supabaseAdmin } from './supabase';

export type Goal = {
  id: string;
  name: string;
  target_amount: number;
  current_amount: number;
  target_date: string | null;
};

// Tolerant of the table not existing yet (before the 0003_goals migration).
export async function goalsTableExists(): Promise<boolean> {
  try {
    const { error } = await supabaseAdmin().from('goals').select('id').limit(1);
    return !error;
  } catch {
    return false;
  }
}

export async function listGoals(): Promise<Goal[]> {
  try {
    const { data, error } = await supabaseAdmin()
      .from('goals')
      .select('id, name, target_amount, current_amount, target_date')
      .order('created_at', { ascending: true });
    if (error) return [];
    return (data || []).map((g) => ({
      id: g.id,
      name: g.name,
      target_amount: Number(g.target_amount),
      current_amount: Number(g.current_amount),
      target_date: g.target_date,
    }));
  } catch {
    return [];
  }
}

export async function upsertGoal(g: {
  name: string;
  target_amount: number;
  current_amount?: number;
  target_date?: string | null;
}): Promise<void> {
  const row: Record<string, unknown> = {
    name: g.name,
    target_amount: g.target_amount,
    target_date: g.target_date ?? null,
  };
  if (g.current_amount !== undefined) row.current_amount = g.current_amount;
  const { error } = await supabaseAdmin().from('goals').upsert(row, { onConflict: 'name' });
  if (error) throw new Error(error.message);
}

export async function deleteGoal(name: string): Promise<void> {
  const { error } = await supabaseAdmin().from('goals').delete().eq('name', name);
  if (error) throw new Error(error.message);
}
