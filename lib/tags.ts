import { supabaseAdmin } from './supabase';

export type Tag = 'business' | 'personal';

// Merchants that are almost always business infrastructure — used to pre-suggest
// tags so the user can confirm in one tap instead of hunting.
const BUSINESS_HINTS =
  /\b(SUPABASE|CAPGO|RAILWAY|VERCEL|NETLIFY|HEROKU|RENDER|FLY\.IO|AWS|AMAZON WEB|GOOGLE CLOUD|\bGCP\b|DIGITALOCEAN|CLOUDFLARE|GITHUB|GITLAB|STRIPE|TWILIO|SENDGRID|POSTHOG|SENTRY|DATADOG|LINEAR|NOTION|FIGMA|EXPO|APPLE DEVELOPER|GOOGLE PLAY|NAMECHEAP|GODADDY|MAILGUN|RESEND|CLERK|AUTH0|MONGODB|PLANETSCALE|ANTHROPIC)\b/;

export function suggestBusiness(nameOrKey: string): boolean {
  return BUSINESS_HINTS.test((nameOrKey || '').toUpperCase());
}

// All reads tolerate the table not existing yet (before the 0005 migration).
export async function tagsTableExists(): Promise<boolean> {
  try {
    const { error } = await supabaseAdmin().from('merchant_tags').select('id').limit(1);
    return !error;
  } catch {
    return false;
  }
}

export async function getMerchantTagMap(): Promise<Record<string, Tag>> {
  try {
    const { data, error } = await supabaseAdmin()
      .from('merchant_tags')
      .select('normalized_merchant, tag');
    if (error) return {};
    const map: Record<string, Tag> = {};
    for (const r of data || []) map[r.normalized_merchant] = r.tag as Tag;
    return map;
  } catch {
    return {};
  }
}

export async function setTag(normalized_merchant: string, tag: Tag): Promise<void> {
  const { error } = await supabaseAdmin()
    .from('merchant_tags')
    .upsert({ normalized_merchant, tag }, { onConflict: 'normalized_merchant' });
  if (error) throw new Error(error.message);
}

export async function deleteTag(normalized_merchant: string): Promise<void> {
  const { error } = await supabaseAdmin()
    .from('merchant_tags')
    .delete()
    .eq('normalized_merchant', normalized_merchant);
  if (error) throw new Error(error.message);
}
