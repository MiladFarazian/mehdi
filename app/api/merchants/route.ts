import { NextResponse } from 'next/server';
import { supabaseConfigured } from '@/lib/supabase';
import { getStreams, getTransactions } from '@/lib/db';
import { monthKey } from '@/lib/analysis/stats';
import { titleCase } from '@/lib/analysis/normalize';

export const dynamic = 'force-dynamic';

// No ?m → list of merchants by spend. ?m=KEY → deep-dive for one merchant.
export async function GET(req: Request) {
  if (!supabaseConfigured()) return NextResponse.json({ configured: false });
  try {
    const m = new URL(req.url).searchParams.get('m');
    const [txns, streams] = await Promise.all([getTransactions(), getStreams()]);
    const subs = new Map(streams.map((s) => [s.normalized_merchant, s]));

    if (!m) {
      const agg = new Map<
        string,
        { total: number; count: number; last: string; name: string; logo: string | null }
      >();
      for (const t of txns) {
        if (t.amount <= 0 || t.pending || !t.normalized_merchant) continue;
        const e = agg.get(t.normalized_merchant) || {
          total: 0,
          count: 0,
          last: t.date,
          name: t.merchant_name || t.normalized_merchant,
          logo: null,
        };
        e.total += t.amount;
        e.count += 1;
        if (t.date > e.last) e.last = t.date;
        if (!e.logo && t.logo_url) e.logo = t.logo_url;
        agg.set(t.normalized_merchant, e);
      }
      const merchants = [...agg.entries()]
        .map(([merchant, e]) => ({
          merchant,
          display_name: titleCase(e.name),
          total: Number(e.total.toFixed(2)),
          count: e.count,
          last: e.last,
          logo_url: e.logo,
          isSubscription: subs.has(merchant),
        }))
        .sort((a, b) => b.total - a.total);
      return NextResponse.json({ configured: true, merchants });
    }

    // detail
    const rows = txns.filter((t) => t.normalized_merchant === m);
    const spend = rows.filter((t) => t.amount > 0 && !t.pending);
    const amounts = spend.map((t) => t.amount);
    const total = amounts.reduce((a, b) => a + b, 0);

    const byMonth = new Map<string, number>();
    for (const t of spend) byMonth.set(monthKey(t.date), (byMonth.get(monthKey(t.date)) || 0) + t.amount);
    const monthly = [...byMonth.entries()]
      .map(([month, s]) => ({ month, spend: Number(s.toFixed(2)) }))
      .sort((a, b) => (a.month < b.month ? -1 : 1))
      .slice(-12);

    const dates = spend.map((t) => t.date).sort();
    const stream = subs.get(m);

    return NextResponse.json({
      configured: true,
      merchant: m,
      display_name: titleCase(rows[0]?.merchant_name || m),
      logo_url: rows.map((r) => r.logo_url).find(Boolean) ?? null,
      total: Number(total.toFixed(2)),
      count: spend.length,
      avg: amounts.length ? Number((total / amounts.length).toFixed(2)) : 0,
      min: amounts.length ? Math.min(...amounts) : 0,
      max: amounts.length ? Math.max(...amounts) : 0,
      first: dates[0] || null,
      last: dates[dates.length - 1] || null,
      monthly,
      transactions: rows
        .slice()
        .sort((a, b) => (a.date < b.date ? 1 : -1))
        .slice(0, 50)
        .map((t) => ({
          date: t.date,
          amount: t.amount,
          category: t.pfc_primary || 'UNCATEGORIZED',
          pending: t.pending,
        })),
      subscription: stream
        ? {
            frequency: stream.frequency,
            expected_next: stream.expected_next,
            avg_amount: Number(stream.avg_amount),
            annual_cost: Number(stream.annual_cost),
          }
        : null,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'Failed' }, { status: 500 });
  }
}
