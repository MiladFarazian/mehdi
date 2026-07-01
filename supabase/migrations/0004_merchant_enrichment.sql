-- mehdi — merchant enrichment fields from Plaid
-- Apply via Supabase Dashboard → SQL Editor (paste & run), or `supabase db push`.

alter table transactions
  add column if not exists logo_url text,
  add column if not exists website text,
  add column if not exists merchant_entity_id text,
  add column if not exists payment_channel text,
  add column if not exists pfc_confidence text,
  add column if not exists counterparties jsonb,
  add column if not exists location jsonb;

alter table recurring_streams
  add column if not exists logo_url text;

create index if not exists transactions_merchant_entity_idx on transactions(merchant_entity_id);
