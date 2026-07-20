-- Migração: tela "Contas a pagar"
-- Rode este script no SQL Editor do Supabase (depois do supabase_schema.sql original).

create table bill_years (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  year int not null,
  created_at timestamptz not null default now(),
  unique (user_id, year)
);

create table bill_groups (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  year int not null,
  name text not null,
  created_at timestamptz not null default now(),
  unique (user_id, year, name)
);

create table bill_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  group_id uuid not null references bill_groups(id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now(),
  unique (group_id, name)
);

create table bill_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  item_id uuid not null references bill_items(id) on delete cascade,
  month smallint not null check (month between 1 and 12),
  paid boolean not null default false,
  value numeric,
  updated_at timestamptz not null default now(),
  unique (item_id, month)
);

alter table bill_years enable row level security;
alter table bill_groups enable row level security;
alter table bill_items enable row level security;
alter table bill_entries enable row level security;

create policy "bill_years: only owner" on bill_years
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy "bill_groups: only owner" on bill_groups
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy "bill_items: only owner" on bill_items
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy "bill_entries: only owner" on bill_entries
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

create index idx_bill_groups_user_year on bill_groups(user_id, year);
create index idx_bill_items_group on bill_items(group_id);
create index idx_bill_entries_item on bill_entries(item_id);
