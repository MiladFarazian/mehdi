import { NextResponse } from 'next/server';
import { supabaseAdmin, supabaseConfigured } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

// Filtered, paginated transaction browser feed.
export async function GET(req: Request) {
  if (!supabaseConfigured()) {
    return NextResponse.json({ configured: false, transactions: [], total: 0, categories: [] });
  }
  try {
    const url = new URL(req.url);
    // Strip characters that would break a PostgREST or() filter.
    const search = (url.searchParams.get('search') || '').replace(/[,()%*]/g, '').trim();
    const category = url.searchParams.get('category') || '';
    const month = url.searchParams.get('month') || '';
    const limit = Math.min(Number(url.searchParams.get('limit')) || 50, 200);
    const offset = Math.max(0, Number(url.searchParams.get('offset')) || 0);

    const db = supabaseAdmin();
    let q = db
      .from('transactions')
      .select('transaction_id, date, merchant_name, name, amount, pfc_primary, pending', {
        count: 'exact',
      })
      .order('date', { ascending: false });

    if (search) q = q.or(`merchant_name.ilike.%${search}%,name.ilike.%${search}%`);
    if (category) q = q.eq('pfc_primary', category);
    if (month) q = q.gte('date', `${month}-01`).lte('date', `${month}-31`);
    q = q.range(offset, offset + limit - 1);

    const { data, error, count } = await q;
    if (error) throw new Error(error.message);

    const { data: catRows } = await db.from('transactions').select('pfc_primary').limit(5000);
    const categories = [...new Set((catRows || []).map((r) => r.pfc_primary).filter(Boolean))].sort();

    const transactions = (data || []).map((t) => ({
      id: t.transaction_id,
      date: t.date,
      name: t.merchant_name || t.name,
      amount: Number(t.amount),
      category: t.pfc_primary || 'UNCATEGORIZED',
      pending: t.pending,
    }));

    return NextResponse.json({ configured: true, transactions, total: count || 0, categories });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'Failed' }, { status: 500 });
  }
}
