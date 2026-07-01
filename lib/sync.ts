import type { AccountBase, Transaction } from 'plaid';
import { plaidClient } from './plaid';
import { supabaseAdmin } from './supabase';
import { isDiscretionary, normalizeMerchant } from './analysis/normalize';
import { inferCategory } from './analysis/categorize';
import { decryptSecret } from './crypto';

// Pull accounts for an item and upsert balances.
async function syncAccounts(itemId: string, accessToken: string): Promise<void> {
  const db = supabaseAdmin();
  const res = await plaidClient.accountsGet({ access_token: accessToken });
  const rows = res.data.accounts.map((a: AccountBase) => ({
    account_id: a.account_id,
    item_id: itemId,
    name: a.name,
    official_name: a.official_name,
    type: a.type,
    subtype: a.subtype,
    mask: a.mask,
    current_balance: a.balances.current,
    available_balance: a.balances.available,
    iso_currency_code: a.balances.iso_currency_code,
  }));
  if (rows.length) {
    const { error } = await db.from('accounts').upsert(rows, { onConflict: 'account_id' });
    if (error) throw new Error(error.message);
  }
}

function toRow(t: Transaction) {
  // Fall back to our own categorizer when Plaid returns OTHER/null.
  const primary = inferCategory(
    `${t.merchant_name || ''} ${t.name || ''}`,
    t.personal_finance_category?.primary ?? null,
  );
  return {
    transaction_id: t.transaction_id,
    account_id: t.account_id,
    date: t.date,
    authorized_date: t.authorized_date,
    amount: t.amount,
    iso_currency_code: t.iso_currency_code,
    name: t.name,
    merchant_name: t.merchant_name,
    normalized_merchant: normalizeMerchant(t.merchant_name || t.name),
    pfc_primary: primary,
    pfc_detailed: t.personal_finance_category?.detailed ?? null,
    is_discretionary: isDiscretionary(primary),
    pending: t.pending,
  };
}

export type SyncResult = { added: number; modified: number; removed: number };

// Run /transactions/sync from the stored cursor, persisting adds/mods/removes
// and the new cursor. Idempotent — safe to call repeatedly (e.g. from webhooks).
export async function syncItem(item: {
  item_id: string;
  access_token: string;
  cursor: string | null;
}): Promise<SyncResult> {
  const db = supabaseAdmin();
  await syncAccounts(item.item_id, item.access_token);

  let cursor = item.cursor ?? undefined;
  let added: Transaction[] = [];
  let modified: Transaction[] = [];
  let removed: { transaction_id?: string }[] = [];
  let hasMore = true;

  while (hasMore) {
    const res = await plaidClient.transactionsSync({
      access_token: item.access_token,
      cursor,
    });
    added = added.concat(res.data.added);
    modified = modified.concat(res.data.modified);
    removed = removed.concat(res.data.removed);
    hasMore = res.data.has_more;
    cursor = res.data.next_cursor;
  }

  const upserts = [...added, ...modified].map(toRow);
  if (upserts.length) {
    const { error } = await db
      .from('transactions')
      .upsert(upserts, { onConflict: 'transaction_id' });
    if (error) throw new Error(error.message);
  }

  const removedIds = removed.map((r) => r.transaction_id).filter(Boolean) as string[];
  if (removedIds.length) {
    const { error } = await db.from('transactions').delete().in('transaction_id', removedIds);
    if (error) throw new Error(error.message);
  }

  const { error: curErr } = await db
    .from('plaid_items')
    .update({ cursor })
    .eq('item_id', item.item_id);
  if (curErr) throw new Error(curErr.message);

  return { added: added.length, modified: modified.length, removed: removedIds.length };
}

export async function syncAllItems(): Promise<SyncResult> {
  const db = supabaseAdmin();
  const { data, error } = await db
    .from('plaid_items')
    .select('item_id, access_token, cursor')
    .eq('status', 'active');
  if (error) throw new Error(error.message);

  const totals: SyncResult = { added: 0, modified: 0, removed: 0 };
  for (const item of data || []) {
    // Stored token is encrypted; syncItem needs the raw token.
    const r = await syncItem({
      item_id: (item as any).item_id,
      access_token: decryptSecret((item as any).access_token),
      cursor: (item as any).cursor,
    });
    totals.added += r.added;
    totals.modified += r.modified;
    totals.removed += r.removed;
  }
  return totals;
}
