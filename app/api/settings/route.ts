import { NextResponse } from 'next/server';
import { supabaseAdmin, supabaseConfigured } from '@/lib/supabase';
import { plaidClient } from '@/lib/plaid';
import { decryptSecret, encryptionEnabled } from '@/lib/crypto';
import { advisorAvailable } from '@/lib/advisor/claudeCode';
import { emailConfigured } from '@/lib/email';
import { authConfigured } from '@/lib/auth';

export const dynamic = 'force-dynamic';

// Config + data status.
export async function GET() {
  const base = {
    supabase: supabaseConfigured(),
    plaidEnv: process.env.PLAID_ENV || 'sandbox',
    advisor: advisorAvailable(),
    encryption: encryptionEnabled(),
    email: emailConfigured(),
    authGate: authConfigured(),
  };
  if (!supabaseConfigured()) return NextResponse.json({ ...base, transactions: 0, accounts: 0, items: 0 });
  try {
    const db = supabaseAdmin();
    const [tx, acc, items] = await Promise.all([
      db.from('transactions').select('transaction_id', { count: 'exact', head: true }),
      db.from('accounts').select('account_id', { count: 'exact', head: true }),
      db.from('plaid_items').select('institution_name'),
    ]);
    return NextResponse.json({
      ...base,
      transactions: tx.count || 0,
      accounts: acc.count || 0,
      items: (items.data || []).length,
    });
  } catch (err: any) {
    return NextResponse.json({ ...base, error: err?.message }, { status: 200 });
  }
}

// Wipe all data. Revokes Plaid items first, then clears every table.
export async function DELETE() {
  if (!supabaseConfigured()) return NextResponse.json({ error: 'not configured' }, { status: 400 });
  try {
    const db = supabaseAdmin();

    const { data: items } = await db.from('plaid_items').select('access_token');
    for (const it of items || []) {
      try {
        await plaidClient.itemRemove({ access_token: decryptSecret(it.access_token) });
      } catch {
        /* best-effort revoke */
      }
    }

    const tables = [
      'transactions',
      'recurring_streams',
      'insights',
      'chat_messages',
      'accounts',
      'plaid_items',
      'budgets',
      'goals',
    ];
    for (const t of tables) {
      try {
        await db.from(t).delete().not('id', 'is', null);
      } catch {
        /* table may not exist (budgets/goals pre-migration) */
      }
    }
    return NextResponse.json({ ok: true });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'Failed' }, { status: 500 });
  }
}
