import { NextResponse } from 'next/server';
import { supabaseAdmin, supabaseConfigured } from '@/lib/supabase';
import { getTransactions } from '@/lib/db';
import { getMerchantTagMap } from '@/lib/tags';
import { NON_INCOME_CATEGORIES, NON_SPEND_CATEGORIES } from '@/lib/analysis/normalize';
import { median, monthKey } from '@/lib/analysis/stats';
import { today } from '@/lib/today';

export const dynamic = 'force-dynamic';

// Personal burn rate (income − spend) and how long linked cash lasts at that rate.
export async function GET() {
  if (!supabaseConfigured()) return NextResponse.json({ configured: false });
  try {
    const db = supabaseAdmin();
    const [txns, acctRes, tagMap] = await Promise.all([
      getTransactions(),
      db.from('accounts').select('type, subtype, current_balance'),
      getMerchantTagMap(),
    ]);

    const spend = new Map<string, number>(); // personal only
    const business = new Map<string, number>();
    const income = new Map<string, number>();
    for (const t of txns) {
      if (t.pending) continue;
      const m = monthKey(t.date);
      if (t.amount > 0 && !NON_SPEND_CATEGORIES.has(t.pfc_primary || '')) {
        // Business-tagged merchants don't count toward personal burn.
        if (tagMap[t.normalized_merchant] === 'business') {
          business.set(m, (business.get(m) || 0) + t.amount);
        } else {
          spend.set(m, (spend.get(m) || 0) + t.amount);
        }
      } else if (t.amount < 0 && !NON_INCOME_CATEGORIES.has(t.pfc_primary || '')) {
        income.set(m, (income.get(m) || 0) + Math.abs(t.amount));
      }
    }

    // Use complete months only (drop the in-progress one).
    const cur = monthKey(today());
    const months = [...new Set([...spend.keys(), ...income.keys()])]
      .filter((m) => m !== cur)
      .sort()
      .slice(-6);

    const nets = months.map((m) => (income.get(m) || 0) - (spend.get(m) || 0));
    const monthlyIncome = Number(median(months.map((m) => income.get(m) || 0)).toFixed(2));
    const monthlySpend = Number(median(months.map((m) => spend.get(m) || 0)).toFixed(2));
    const monthlyBusinessSpend = Number(median(months.map((m) => business.get(m) || 0)).toFixed(2));
    const medianNet = Number(median(nets).toFixed(2));
    const burnPerMonth = medianNet < 0 ? -medianNet : 0;

    // Liquid cash = depository (checking/savings) balances.
    const liquidCash = (acctRes.data || [])
      .filter((a) => a.type === 'depository')
      .reduce((s, a) => s + Number(a.current_balance || 0), 0);

    const runwayMonths =
      burnPerMonth > 0 && liquidCash > 0 ? Number((liquidCash / burnPerMonth).toFixed(1)) : null;

    return NextResponse.json({
      configured: true,
      months: months.length,
      monthlyIncome,
      monthlySpend,
      monthlyBusinessSpend,
      medianNet,
      burnPerMonth: Number(burnPerMonth.toFixed(2)),
      liquidCash: Number(liquidCash.toFixed(2)),
      runwayMonths,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'Failed' }, { status: 500 });
  }
}
