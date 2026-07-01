import { NextResponse } from 'next/server';
import { supabaseAdmin, supabaseConfigured } from '@/lib/supabase';
import { plaidClient } from '@/lib/plaid';
import { decryptSecret } from '@/lib/crypto';

export const dynamic = 'force-dynamic';

// Pull credit-card APRs, statement balance, minimum payment, and due date.
export async function GET() {
  if (!supabaseConfigured()) return NextResponse.json({ configured: false });
  try {
    const db = supabaseAdmin();
    const { data: items } = await db.from('plaid_items').select('access_token');
    const cards: any[] = [];
    for (const it of items || []) {
      try {
        const res = await plaidClient.liabilitiesGet({ access_token: decryptSecret(it.access_token) });
        const accounts = res.data.accounts;
        for (const c of res.data.liabilities?.credit || []) {
          const acct = accounts.find((a) => a.account_id === c.account_id);
          cards.push({
            name: acct?.name,
            mask: acct?.mask,
            balance: acct?.balances?.current,
            last_statement_balance: c.last_statement_balance,
            minimum_payment: c.minimum_payment_amount,
            next_due_date: c.next_payment_due_date,
            last_payment_amount: c.last_payment_amount,
            is_overdue: c.is_overdue,
            aprs: (c.aprs || []).map((a) => ({ type: a.apr_type, pct: a.apr_percentage })),
          });
        }
      } catch (e: any) {
        return NextResponse.json({
          ok: false,
          error_code: e?.response?.data?.error_code || null,
          error_message: e?.response?.data?.error_message || e?.message,
        });
      }
    }
    return NextResponse.json({ ok: true, cards });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'Failed' }, { status: 500 });
  }
}
