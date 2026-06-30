import { NextResponse } from 'next/server';
import { supabaseAdmin, supabaseConfigured } from '@/lib/supabase';
import { budgetsTableExists, deleteBudget, listBudgets, upsertBudget } from '@/lib/budgets';
import { monthKey } from '@/lib/analysis/stats';
import { NON_SPEND_CATEGORIES } from '@/lib/analysis/normalize';
import { today } from '@/lib/today';

export const dynamic = 'force-dynamic';

// GET: budgets with this (current) month's spend, plus available categories.
export async function GET() {
  if (!supabaseConfigured()) return NextResponse.json({ configured: false });
  try {
    const tableExists = await budgetsTableExists();
    if (!tableExists) return NextResponse.json({ configured: true, tableExists: false, budgets: [] });

    const db = supabaseAdmin();
    const month = monthKey(today());
    const [budgets, txnRows] = await Promise.all([
      listBudgets(),
      db
        .from('transactions')
        .select('amount, pfc_primary')
        .gt('amount', 0)
        .gte('date', `${month}-01`)
        .lte('date', `${month}-31`),
    ]);

    const spend = new Map<string, number>();
    const allCats = new Set<string>();
    for (const t of txnRows.data || []) {
      const c = t.pfc_primary || 'UNCATEGORIZED';
      if (NON_SPEND_CATEGORIES.has(c)) continue;
      allCats.add(c);
      spend.set(c, (spend.get(c) || 0) + Number(t.amount));
    }

    const withSpend = budgets
      .map((b) => {
        const spent = Number((spend.get(b.category) || 0).toFixed(2));
        return {
          category: b.category,
          monthly_limit: b.monthly_limit,
          spent,
          pct: Math.round((spent / b.monthly_limit) * 100),
        };
      })
      .sort((a, b) => b.pct - a.pct);

    const budgeted = new Set(budgets.map((b) => b.category));
    const availableCategories = [...allCats].filter((c) => !budgeted.has(c)).sort();

    return NextResponse.json({ configured: true, tableExists: true, month, budgets: withSpend, availableCategories });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'Failed' }, { status: 500 });
  }
}

// PUT: upsert a budget. DELETE: remove one.
export async function PUT(req: Request) {
  try {
    const { category, monthly_limit } = await req.json();
    if (!category || !(monthly_limit > 0)) {
      return NextResponse.json({ error: 'category and positive monthly_limit required' }, { status: 400 });
    }
    await upsertBudget(category, Number(monthly_limit));
    return NextResponse.json({ ok: true });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'Failed' }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const { category } = await req.json();
    if (!category) return NextResponse.json({ error: 'category required' }, { status: 400 });
    await deleteBudget(category);
    return NextResponse.json({ ok: true });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'Failed' }, { status: 500 });
  }
}
