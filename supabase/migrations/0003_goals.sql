-- mehdi — savings goals
-- Apply via Supabase Dashboard → SQL Editor (paste & run), or `supabase db push`.
-- Depends on set_updated_at() from 0001_init.sql.

create table if not exists goals (
  id uuid primary key default gen_random_uuid(),
  name text unique not null,
  target_amount numeric not null,
  current_amount numeric not null default 0,
  target_date date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists set_updated_at on goals;
create trigger set_updated_at before update on goals
  for each row execute function set_updated_at();

alter table goals enable row level security;
