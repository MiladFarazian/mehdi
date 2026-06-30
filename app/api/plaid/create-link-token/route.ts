import { NextResponse } from 'next/server';
import { CountryCode, Products } from 'plaid';
import { plaidClient } from '@/lib/plaid';

// Creates a short-lived link_token that the frontend hands to Plaid Link.
export async function POST() {
  try {
    const res = await plaidClient.linkTokenCreate({
      user: { client_user_id: 'phase0-user' },
      client_name: 'mehdi',
      products: [Products.Transactions],
      country_codes: [CountryCode.Us],
      language: 'en',
    });
    return NextResponse.json({ link_token: res.data.link_token });
  } catch (err: any) {
    console.error('create-link-token error', err?.response?.data || err);
    return NextResponse.json(
      { error: 'Failed to create link token. Check PLAID_CLIENT_ID / PLAID_SECRET.' },
      { status: 500 },
    );
  }
}
