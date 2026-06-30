import { NextResponse } from 'next/server';
import { plaidClient } from '@/lib/plaid';
import { writeStore } from '@/lib/store';

// Exchanges the public_token (from a successful Link) for a long-lived
// access_token, then stores it server-side. The access_token must NEVER reach
// the browser.
export async function POST(req: Request) {
  try {
    const { public_token } = await req.json();
    if (!public_token) {
      return NextResponse.json({ error: 'public_token is required' }, { status: 400 });
    }

    const res = await plaidClient.itemPublicTokenExchange({ public_token });
    await writeStore({
      accessToken: res.data.access_token,
      itemId: res.data.item_id,
    });

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    console.error('exchange-public-token error', err?.response?.data || err);
    return NextResponse.json({ error: 'Failed to exchange public token' }, { status: 500 });
  }
}
