-- Schema do App Financeiro no Supabase
-- Rode este script inteiro no SQL Editor do seu projeto Supabase (uma vez só).

create extension if not exists "pgcrypto";

-- ---------- TABELAS ----------

create table years (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  year int not null,
  created_at timestamptz not null default now(),
  unique (user_id, year)
);

create table categories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  year int not null,
  name text not null,
  type text not null check (type in ('Entrada', 'Saída')),
  created_at timestamptz not null default now(),
  unique (user_id, year, name)
);

create table entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  category_id uuid not null references categories(id) on delete cascade,
  month smallint not null check (month between 1 and 12),
  value numeric,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (category_id, month)
);

-- ---------- ROW LEVEL SECURITY ----------

alter table years enable row level security;
alter table categories enable row level security;
alter table entries enable row level security;

create policy "years: only owner" on years
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy "categories: only owner" on categories
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy "entries: only owner" on entries
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ---------- ÍNDICES ----------

create index idx_categories_user_year on categories(user_id, year);
create index idx_entries_category on entries(category_id);
