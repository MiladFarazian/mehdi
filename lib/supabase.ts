import { createClient, type SupabaseClient } from '@supabase/supabase-js';

// Server-side admin client. Uses the Supabase SECRET key, which bypasses RLS.
// Never import this into client components — it must stay server-only.
let client: SupabaseClient | null = null;

export function supabaseAdmin(): SupabaseClient {
  const url = process.env.SUPABASE_URL;
  const secret = process.env.SUPABASE_SECRET_KEY;
  if (!url || !secret) {
    throw new Error(
      'Supabase is not configured. Set SUPABASE_URL and SUPABASE_SECRET_KEY in .env.local.',
    );
  }
  if (!client) {
    client = createClient(url, secret, { auth: { persistSession: false } });
  }
  return client;
}

export function supabaseConfigured(): boolean {
  return Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_SECRET_KEY);
}
