import { NextResponse } from 'next/server';
import { supabaseAdmin, supabaseConfigured } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

// Read recent transactions from the database (populated by /api/plaid/sync).
export async function GET() {
  if (!supabaseConfigured()) {
    return NextResponse.json({ configured: false, transactions: [] });
  }
  try {
    const db = supabaseAdmin();
    const { data, error } = await db
      .from('transactions')
      .select('transaction_id, date, merchant_name, name, amount, pfc_primary, pending')
      .order('date', { ascending: false })
      .limit(50);
    if (error) throw new Error(error.message);

    const transactions = (data || []).map((t) => ({
      id: t.transaction_id,
      date: t.date,
      name: t.merchant_name || t.name,
      amount: Number(t.amount),
      category: t.pfc_primary ?? 'UNCATEGORIZED',
      pending: t.pending,
    }));
    return NextResponse.json({ configured: true, linked: transactions.length > 0, transactions });
  } catch (err: any) {
    console.error('transactions error', err?.message || err);
    return NextResponse.json({ error: err?.message || 'Failed' }, { status: 500 });
  }
}
