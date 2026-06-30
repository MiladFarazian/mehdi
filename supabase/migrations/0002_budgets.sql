-- mehdi — budgets (Phase: category budgets)
-- Apply via Supabase Dashboard → SQL Editor (paste & run), or `supabase db push`.
-- Depends on set_updated_at() from 0001_init.sql.

create table if not exists budgets (
  id uuid primary key default gen_random_uuid(),
  category text unique not null,        -- Plaid personal_finance_category.primary
  monthly_limit numeric not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists set_updated_at on budgets;
create trigger set_updated_at before update on budgets
  for each row execute function set_updated_at();

-- RLS on, no policies (server uses the secret key, which bypasses RLS).
alter table budgets enable row level security;
