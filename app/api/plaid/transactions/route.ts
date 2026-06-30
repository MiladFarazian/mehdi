import { NextResponse } from 'next/server';
import type { Transaction } from 'plaid';
import { plaidClient } from '@/lib/plaid';
import { readStore } from '@/lib/store';

// Must run per-request — it reads live linked state, never prerender at build.
export const dynamic = 'force-dynamic';

// Pulls transactions via Plaid's /transactions/sync. For Phase 0 we sync from
// scratch on every request (cursor = undefined) so the list always renders.
// Phase 1 persists transactions + the sync cursor in Postgres and only fetches
// the delta.
export async function GET() {
  const store = await readStore();
  if (!store.accessToken) {
    return NextResponse.json({ linked: false, transactions: [] });
  }

  try {
    let cursor: string | undefined = undefined;
    let added: Transaction[] = [];
    let hasMore = true;

    while (hasMore) {
      const res = await plaidClient.transactionsSync({
        access_token: store.accessToken,
        cursor,
      });
      added = added.concat(res.data.added);
      hasMore = res.data.has_more;
      cursor = res.data.next_cursor;
    }

    const transactions = added
      .sort((a, b) => (a.date < b.date ? 1 : -1))
      .slice(0, 50)
      .map((t) => ({
        id: t.transaction_id,
        date: t.date,
        name: t.merchant_name || t.name,
        amount: t.amount,
        category: t.personal_finance_category?.primary ?? 'UNCATEGORIZED',
        pending: t.pending,
      }));

    return NextResponse.json({ linked: true, transactions });
  } catch (err: any) {
    const data = err?.response?.data;
    console.error('transactions error', data || err);
    // Sandbox occasionally needs a beat to generate transactions.
    if (data?.error_code === 'PRODUCT_NOT_READY') {
      return NextResponse.json({ linked: true, transactions: [], notReady: true });
    }
    return NextResponse.json({ error: 'Failed to fetch transactions' }, { status: 500 });
  }
}
