import { supabaseAdmin, supabaseConfigured } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

// CSV export of all transactions.
export async function GET() {
  if (!supabaseConfigured()) return new Response('Supabase not configured', { status: 400 });
  try {
    const db = supabaseAdmin();
    const { data, error } = await db
      .from('transactions')
      .select('date, merchant_name, name, amount, pfc_primary, pending')
      .order('date', { ascending: false })
      .limit(100000);
    if (error) throw new Error(error.message);

    const header = 'date,merchant,category,amount,pending';
    const rows = (data || []).map((t) => {
      const merchant = String(t.merchant_name || t.name || '').replace(/"/g, '""');
      return `${t.date},"${merchant}",${t.pfc_primary || ''},${t.amount},${t.pending}`;
    });
    const csv = [header, ...rows].join('\n');

    return new Response(csv, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': 'attachment; filename="mehdi-transactions.csv"',
      },
    });
  } catch (err: any) {
    return new Response(err?.message || 'Failed', { status: 500 });
  }
}
