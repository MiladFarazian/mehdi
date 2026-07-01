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
      // Consent to Liabilities too (APR, statement balance, due date) without
      // requiring it, so credit-card details are available after linking.
      additional_consented_products: [Products.Liabilities],
      country_codes: [CountryCode.Us],
      language: 'en',
      // Pull up to 24 months of history (default is only 90 days) so the
      // analysis has enough to build baselines and detect price creep.
      transactions: { days_requested: 730 },
      // When deployed with a public URL, register the webhook so new
      // transactions sync automatically. Ignored locally if unset.
      ...(process.env.PLAID_WEBHOOK_URL ? { webhook: process.env.PLAID_WEBHOOK_URL } : {}),
      // Required for OAuth banks (Chase, BofA, etc.) — must be an HTTPS URL
      // registered in the Plaid dashboard's allowed redirect URIs.
      ...(process.env.PLAID_REDIRECT_URI ? { redirect_uri: process.env.PLAID_REDIRECT_URI } : {}),
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
