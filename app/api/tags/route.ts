import { NextResponse } from 'next/server';
import { supabaseConfigured } from '@/lib/supabase';
import { getTransactions } from '@/lib/db';
import { deleteTag, getMerchantTagMap, setTag, suggestBusiness, tagsTableExists } from '@/lib/tags';
import { NON_SPEND_CATEGORIES, titleCase } from '@/lib/analysis/normalize';

export const dynamic = 'force-dynamic';

// GET: merchants by spend with their current tag + a business suggestion.
export async function GET() {
  if (!supabaseConfigured()) return NextResponse.json({ configured: false });
  try {
    if (!(await tagsTableExists())) {
      return NextResponse.json({ configured: true, tableExists: false, merchants: [] });
    }
    const [txns, tagMap] = await Promise.all([getTransactions(), getMerchantTagMap()]);

    const agg = new Map<string, { total: number; count: number; name: string; logo: string | null }>();
    for (const t of txns) {
      if (t.amount <= 0 || t.pending || !t.normalized_merchant) continue;
      if (NON_SPEND_CATEGORIES.has(t.pfc_primary || '')) continue;
      const e = agg.get(t.normalized_merchant) || {
        total: 0,
        count: 0,
        name: t.merchant_name || t.normalized_merchant,
        logo: null,
      };
      e.total += t.amount;
      e.count += 1;
      if (!e.logo && (t as any).logo_url) e.logo = (t as any).logo_url;
      agg.set(t.normalized_merchant, e);
    }

    const merchants = [...agg.entries()]
      .map(([merchant, e]) => ({
        merchant,
        display_name: titleCase(e.name),
        logo_url: e.logo,
        total: Number(e.total.toFixed(2)),
        count: e.count,
        tag: tagMap[merchant] || null,
        suggested: !tagMap[merchant] && suggestBusiness(`${merchant} ${e.name}`) ? 'business' : null,
      }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 250);

    const businessTagged = Object.values(tagMap).filter((t) => t === 'business').length;
    return NextResponse.json({ configured: true, tableExists: true, merchants, businessTagged });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'Failed' }, { status: 500 });
  }
}

export async function PUT(req: Request) {
  try {
    const { normalized_merchant, tag } = await req.json();
    if (!normalized_merchant || !['business', 'personal'].includes(tag)) {
      return NextResponse.json({ error: 'normalized_merchant and tag (business|personal) required' }, { status: 400 });
    }
    await setTag(normalized_merchant, tag);
    return NextResponse.json({ ok: true });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'Failed' }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const { normalized_merchant } = await req.json();
    if (!normalized_merchant) return NextResponse.json({ error: 'normalized_merchant required' }, { status: 400 });
    await deleteTag(normalized_merchant);
    return NextResponse.json({ ok: true });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'Failed' }, { status: 500 });
  }
}
