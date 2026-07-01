import { NextResponse } from 'next/server';
import { supabaseConfigured } from '@/lib/supabase';
import { deleteGoal, goalsTableExists, listGoals, upsertGoal } from '@/lib/goals';
import { getTransactions } from '@/lib/db';
import { NON_INCOME_CATEGORIES, NON_SPEND_CATEGORIES } from '@/lib/analysis/normalize';
import { mean, monthKey } from '@/lib/analysis/stats';
import { today } from '@/lib/today';

export const dynamic = 'force-dynamic';

// Average net savings per complete month (used to project goal completion).
async function avgMonthlyNet(): Promise<number> {
  const txns = await getTransactions();
  const spend = new Map<string, number>();
  const income = new Map<string, number>();
  for (const t of txns) {
    if (t.pending) continue;
    const m = monthKey(t.date);
    if (t.amount > 0 && !NON_SPEND_CATEGORIES.has(t.pfc_primary || '')) {
      spend.set(m, (spend.get(m) || 0) + t.amount);
    } else if (t.amount < 0 && !NON_INCOME_CATEGORIES.has(t.pfc_primary || '')) {
      income.set(m, (income.get(m) || 0) + Math.abs(t.amount));
    }
  }
  const cur = monthKey(today());
  const months = [...new Set([...spend.keys(), ...income.keys()])]
    .filter((m) => m !== cur) // drop the in-progress month
    .sort()
    .slice(-6);
  if (!months.length) return 0;
  return mean(months.map((m) => (income.get(m) || 0) - (spend.get(m) || 0)));
}

export async function GET() {
  if (!supabaseConfigured()) return NextResponse.json({ configured: false });
  try {
    if (!(await goalsTableExists())) {
      return NextResponse.json({ configured: true, tableExists: false, goals: [] });
    }
    const [goals, avgNet] = await Promise.all([listGoals(), avgMonthlyNet()]);
    const cur = monthKey(today());

    const withProjection = goals.map((g) => {
      const remaining = Math.max(0, g.target_amount - g.current_amount);
      const pct = Math.min(100, Math.round((g.current_amount / g.target_amount) * 100));
      let projectedMonth: string | null = null;
      let months: number | null = null;
      if (remaining > 0 && avgNet > 0) {
        months = Math.ceil(remaining / avgNet);
        const d = new Date(`${cur}-01T00:00:00Z`);
        d.setUTCMonth(d.getUTCMonth() + months);
        projectedMonth = d.toISOString().slice(0, 7);
      }
      return { ...g, remaining: Number(remaining.toFixed(2)), pct, months, projectedMonth };
    });

    return NextResponse.json({
      configured: true,
      tableExists: true,
      goals: withProjection,
      avgMonthlyNet: Number(avgNet.toFixed(2)),
    });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'Failed' }, { status: 500 });
  }
}

export async function PUT(req: Request) {
  try {
    const { name, target_amount, current_amount, target_date } = await req.json();
    if (!name || !(target_amount > 0)) {
      return NextResponse.json({ error: 'name and positive target_amount required' }, { status: 400 });
    }
    await upsertGoal({
      name,
      target_amount: Number(target_amount),
      current_amount: current_amount === undefined ? undefined : Number(current_amount),
      target_date: target_date || null,
    });
    return NextResponse.json({ ok: true });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'Failed' }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const { name } = await req.json();
    if (!name) return NextResponse.json({ error: 'name required' }, { status: 400 });
    await deleteGoal(name);
    return NextResponse.json({ ok: true });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'Failed' }, { status: 500 });
  }
}
