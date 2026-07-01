import { NextResponse } from 'next/server';
import { CountryCode, Products } from 'plaid';
import { supabaseAdmin, supabaseConfigured } from '@/lib/supabase';
import { plaidClient } from '@/lib/plaid';
import { budgetsTableExists } from '@/lib/budgets';
import { goalsTableExists } from '@/lib/goals';
import { advisorAvailable } from '@/lib/advisor/claudeCode';
import { encryptionEnabled } from '@/lib/crypto';
import { emailConfigured } from '@/lib/email';
import { authConfigured } from '@/lib/auth';

export const dynamic = 'force-dynamic';

type Check = { name: string; status: 'pass' | 'warn' | 'fail'; note: string };

// Live-ish pre-flight: verifies each integration is actually wired.
export async function GET() {
  const checks: Check[] = [];

  // Supabase — live query
  if (!supabaseConfigured()) {
    checks.push({ name: 'Supabase', status: 'fail', note: 'SUPABASE_URL / SUPABASE_SECRET_KEY not set' });
  } else {
    try {
      const { error } = await supabaseAdmin().from('plaid_items').select('id').limit(1);
      checks.push(
        error
          ? { name: 'Supabase', status: 'fail', note: error.message }
          : { name: 'Supabase', status: 'pass', note: 'connected; core tables present' },
      );
    } catch (e: any) {
      checks.push({ name: 'Supabase', status: 'fail', note: e?.message || 'query failed' });
    }
  }

  // Plaid — real API call (create + discard a link token)
  try {
    await plaidClient.linkTokenCreate({
      user: { client_user_id: 'healthcheck' },
      client_name: 'mehdi',
      products: [Products.Transactions],
      country_codes: [CountryCode.Us],
      language: 'en',
    });
    checks.push({ name: 'Plaid', status: 'pass', note: `keys valid (${process.env.PLAID_ENV || 'sandbox'})` });
  } catch (e: any) {
    checks.push({ name: 'Plaid', status: 'fail', note: e?.response?.data?.error_message || e?.message || 'link token failed' });
  }

  // Migrations
  checks.push({
    name: 'Budgets table',
    status: (await budgetsTableExists()) ? 'pass' : 'warn',
    note: (await budgetsTableExists()) ? 'migration applied' : 'apply 0002_budgets.sql',
  });
  checks.push({
    name: 'Goals table',
    status: (await goalsTableExists()) ? 'pass' : 'warn',
    note: (await goalsTableExists()) ? 'migration applied' : 'apply 0003_goals.sql',
  });

  // Config presence
  checks.push({ name: 'Advisor (Claude Code)', status: advisorAvailable() ? 'pass' : 'warn', note: advisorAvailable() ? 'CLI resolvable' : 'claude CLI not found' });
  checks.push({ name: 'Token encryption', status: encryptionEnabled() ? 'pass' : 'warn', note: encryptionEnabled() ? 'TOKEN_ENC_KEY set' : 'set before real accounts' });
  checks.push({ name: 'Password gate', status: authConfigured() ? 'pass' : 'warn', note: authConfigured() ? 'APP_PASSWORD set' : 'required before deploy' });
  checks.push({ name: 'Email alerts', status: emailConfigured() ? 'pass' : 'warn', note: emailConfigured() ? 'Resend configured' : 'optional' });

  const failed = checks.filter((c) => c.status === 'fail').length;
  return NextResponse.json({ ok: failed === 0, failed, checks });
}
