import { NextResponse } from 'next/server';
import { supabaseAdmin, supabaseConfigured } from '@/lib/supabase';
import { inferCategory } from '@/lib/analysis/categorize';
import { isDiscretionary } from '@/lib/analysis/normalize';

export const dynamic = 'force-dynamic';

// Re-run the merchant-name categorizer over already-stored transactions
// (Plaid left many as OTHER). Updates in one query per resulting category.
export async function POST() {
  if (!supabaseConfigured()) return NextResponse.json({ error: 'not configured' }, { status: 400 });
  try {
    const db = supabaseAdmin();
    const PAGE = 1000;
    const rows: any[] = [];
    for (let offset = 0; ; offset += PAGE) {
      const { data, error } = await db
        .from('transactions')
        .select('transaction_id, name, merchant_name, pfc_primary')
        .order('date', { ascending: true })
        .range(offset, offset + PAGE - 1);
      if (error) throw new Error(error.message);
      rows.push(...(data || []));
      if (!data || data.length < PAGE) break;
    }

    const byCategory = new Map<string, string[]>();
    for (const t of rows) {
      const inferred = inferCategory(`${t.merchant_name || ''} ${t.name || ''}`, t.pfc_primary);
      if (inferred !== t.pfc_primary) {
        if (!byCategory.has(inferred)) byCategory.set(inferred, []);
        byCategory.get(inferred)!.push(t.transaction_id);
      }
    }

    let updated = 0;
    for (const [cat, ids] of byCategory) {
      for (let i = 0; i < ids.length; i += 200) {
        const chunk = ids.slice(i, i + 200);
        const { error: uErr } = await db
          .from('transactions')
          .update({ pfc_primary: cat, is_discretionary: isDiscretionary(cat) })
          .in('transaction_id', chunk);
        if (uErr) throw new Error(uErr.message);
        updated += chunk.length;
      }
    }

    return NextResponse.json({ ok: true, updated });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'Failed' }, { status: 500 });
  }
}
