import { NextResponse } from 'next/server';
import { plaidClient } from '@/lib/plaid';
import { supabaseAdmin } from '@/lib/supabase';
import { syncItem } from '@/lib/sync';
import { encryptSecret } from '@/lib/crypto';

export const dynamic = 'force-dynamic';

// Exchange the public_token for an access_token, persist the item, and run the
// first sync. The access_token is stored server-side only and never returned.
export async function POST(req: Request) {
  try {
    const { public_token, institution_name } = await req.json();
    if (!public_token) {
      return NextResponse.json({ error: 'public_token is required' }, { status: 400 });
    }

    const exchange = await plaidClient.itemPublicTokenExchange({ public_token });
    const item_id = exchange.data.item_id;
    const access_token = exchange.data.access_token;

    const db = supabaseAdmin();
    const { error } = await db.from('plaid_items').upsert(
      {
        item_id,
        access_token: encryptSecret(access_token), // encrypted at rest
        institution_name: institution_name ?? null,
        cursor: null,
        status: 'active',
      },
      { onConflict: 'item_id' },
    );
    if (error) throw new Error(error.message);

    // Best-effort initial sync — sandbox may still be generating data, so don't
    // fail the link if this errors. The user can hit "Sync now" afterward.
    // syncItem always receives the raw (decrypted) token.
    try {
      const result = await syncItem({ item_id, access_token, cursor: null });
      return NextResponse.json({ ok: true, synced: true, ...result });
    } catch (syncErr: any) {
      console.warn('initial sync deferred', syncErr?.response?.data || syncErr?.message);
      return NextResponse.json({ ok: true, synced: false });
    }
  } catch (err: any) {
    console.error('exchange-public-token error', err?.response?.data || err);
    return NextResponse.json(
      { error: err?.message || 'Failed to exchange public token' },
      { status: 500 },
    );
  }
}
