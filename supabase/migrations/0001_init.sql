-- mehdi schema — Phase 1+
-- Apply via Supabase Dashboard → SQL Editor (paste & run), or `supabase db push`.

create extension if not exists "pgcrypto";

-- updated_at helper -----------------------------------------------------------
create or replace function set_updated_at() returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

-- Plaid items (one row per linked institution login) --------------------------
create table if not exists plaid_items (
  id uuid primary key default gen_random_uuid(),
  item_id text unique not null,
  access_token text not null,            -- TODO(prod): encrypt at rest (Vault/pgsodium)
  institution_name text,
  cursor text,                           -- /transactions/sync cursor
  status text not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Accounts --------------------------------------------------------------------
create table if not exists accounts (
  id uuid primary key default gen_random_uuid(),
  account_id text unique not null,
  item_id text not null references plaid_items(item_id) on delete cascade,
  name text,
  official_name text,
  type text,
  subtype text,
  mask text,
  current_balance numeric,
  available_balance numeric,
  iso_currency_code text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Transactions (canonical ledger) ---------------------------------------------
create table if not exists transactions (
  id uuid primary key default gen_random_uuid(),
  transaction_id text unique not null,
  account_id text not null,
  item_id text,
  date date not null,
  authorized_date date,
  amount numeric not null,               -- Plaid sign: + = money OUT (spend)
  iso_currency_code text,
  name text,
  merchant_name text,
  normalized_merchant text,
  pfc_primary text,                      -- personal_finance_category.primary
  pfc_detailed text,
  is_discretionary boolean,
  pending boolean default false,
  stream_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists transactions_date_idx on transactions(date);
create index if not exists transactions_merchant_idx on transactions(normalized_merchant);
create index if not exists transactions_pfc_idx on transactions(pfc_primary);

-- Recurring streams (detected subscriptions) ----------------------------------
create table if not exists recurring_streams (
  id uuid primary key default gen_random_uuid(),
  normalized_merchant text unique not null,
  display_name text,
  category text,
  frequency text,                        -- weekly/biweekly/monthly/quarterly/annual
  avg_amount numeric,
  first_amount numeric,
  last_amount numeric,
  amount_history jsonb not null default '[]'::jsonb,
  occurrences int not null default 0,
  first_seen date,
  last_seen date,
  expected_next date,
  status text not null default 'active', -- active/late/ended
  confidence numeric,
  is_subscription boolean not null default true,
  user_status text,                      -- keep/cancel/using/not_using (user feedback)
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Insights (generated findings) -----------------------------------------------
create table if not exists insights (
  id uuid primary key default gen_random_uuid(),
  type text not null,                    -- price_creep | new_recurring | duplicate_services |
                                         -- annual_renewal | category_overspend | merchant_spike |
                                         -- lifestyle_creep | small_leaks
  severity text not null default 'info', -- info | warn | high
  title text not null,
  body text,
  facts jsonb not null default '{}'::jsonb,
  annualized_impact numeric,
  status text not null default 'new',    -- new | seen | dismissed | actioned
  dedupe_key text unique,                -- prevents duplicate insights re-firing
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists insights_status_idx on insights(status);
create index if not exists insights_severity_idx on insights(severity);

-- Advisor chat history --------------------------------------------------------
create table if not exists chat_messages (
  id uuid primary key default gen_random_uuid(),
  role text not null,                    -- user | assistant
  content text not null,
  created_at timestamptz not null default now()
);

-- updated_at triggers ---------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array['plaid_items','accounts','transactions','recurring_streams','insights']
  loop
    execute format('drop trigger if exists set_updated_at on %I', t);
    execute format('create trigger set_updated_at before update on %I for each row execute function set_updated_at()', t);
  end loop;
end $$;

-- RLS: enable with NO policies. The server uses the secret key (bypasses RLS);
-- the browser never touches these tables directly. This denies anon access.
alter table plaid_items       enable row level security;
alter table accounts          enable row level security;
alter table transactions      enable row level security;
alter table recurring_streams enable row level security;
alter table insights          enable row level security;
alter table chat_messages     enable row level security;
