-- mehdi — business vs. personal merchant tags
-- Apply via Supabase Dashboard → SQL Editor (paste & run), or `supabase db push`.

create table if not exists merchant_tags (
  id uuid primary key default gen_random_uuid(),
  normalized_merchant text unique not null,
  tag text not null check (tag in ('business', 'personal')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists set_updated_at on merchant_tags;
create trigger set_updated_at before update on merchant_tags
  for each row execute function set_updated_at();

alter table merchant_tags enable row level security;
