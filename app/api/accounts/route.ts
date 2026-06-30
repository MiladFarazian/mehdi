import { NextResponse } from 'next/server';
import { supabaseAdmin, supabaseConfigured } from '@/lib/supabase';
import { getIncomeStreams } from '@/lib/db';

export const dynamic = 'force-dynamic';

const ASSET_TYPES = new Set(['depository', 'investment', 'brokerage', 'other']);
const LIABILITY_TYPES = new Set(['credit', 'loan']);

// Account balances, net worth, and detected recurring income.
export async function GET() {
  if (!supabaseConfigured()) return NextResponse.json({ configured: false });
  try {
    const db = supabaseAdmin();
    const { data, error } = await db
      .from('accounts')
      .select('account_id, name, official_name, type, subtype, mask, current_balance, iso_currency_code');
    if (error) throw new Error(error.message);

    const accounts = (data || []).map((a) => ({
      ...a,
      current_balance: Number(a.current_balance ?? 0),
      isLiability: LIABILITY_TYPES.has(a.type || ''),
    }));

    const assets = accounts
      .filter((a) => ASSET_TYPES.has(a.type || ''))
      .reduce((s, a) => s + a.current_balance, 0);
    const liabilities = accounts
      .filter((a) => a.isLiability)
      .reduce((s, a) => s + a.current_balance, 0);

    const income = await getIncomeStreams();

    return NextResponse.json({
      configured: true,
      accounts,
      assets: Number(assets.toFixed(2)),
      liabilities: Number(liabilities.toFixed(2)),
      netWorth: Number((assets - liabilities).toFixed(2)),
      income,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'Failed' }, { status: 500 });
  }
}
