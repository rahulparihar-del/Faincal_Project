-- ============================================================
-- BizTrack — Supabase schema
-- Run this in the Supabase dashboard: SQL Editor -> New query -> Run.
--
-- Each table stores one record per row as a JSONB document, matching the
-- shapes in src/lib/types.ts. The app reads/writes by `id`.
-- ============================================================

-- ---------- Tables ----------
create table if not exists public.ecom_sales (
  id          text primary key,
  data        jsonb not null,
  created_at  timestamptz not null default now()
);

create table if not exists public.wholesale_sales (
  id          text primary key,
  data        jsonb not null,
  created_at  timestamptz not null default now()
);

create table if not exists public.manufacturers (
  id          text primary key,
  data        jsonb not null,
  created_at  timestamptz not null default now()
);

create table if not exists public.purchases (
  id          text primary key,
  data        jsonb not null,
  created_at  timestamptz not null default now()
);

create table if not exists public.transactions (
  id          text primary key,
  data        jsonb not null,
  created_at  timestamptz not null default now()
);

create table if not exists public.business_expenses (
  id          text primary key,
  data        jsonb not null,
  created_at  timestamptz not null default now()
);

-- ---------- Row Level Security ----------
-- NOTE: The app currently has NO authentication and uses the public anon key
-- from the browser. The policies below allow the anon role full access so the
-- app works out of the box.
--
-- ⚠️  SECURITY: This means anyone who obtains your project URL + anon key can
-- read and write this data. This is fine for a private/personal tool, but for
-- anything shared or production you should add Supabase Auth and restrict these
-- policies to `authenticated` users (e.g. `to authenticated using (auth.uid() = owner)`).

alter table public.ecom_sales      enable row level security;
alter table public.wholesale_sales enable row level security;
alter table public.manufacturers   enable row level security;
alter table public.purchases       enable row level security;
alter table public.transactions    enable row level security;
alter table public.business_expenses enable row level security;

do $$
declare
  t text;
begin
  foreach t in array array['ecom_sales','wholesale_sales','manufacturers','purchases','transactions','business_expenses']
  loop
    execute format('drop policy if exists "anon_full_access" on public.%I;', t);
    execute format(
      'create policy "anon_full_access" on public.%I for all to anon, authenticated using (true) with check (true);',
      t
    );
  end loop;
end $$;

-- ---------- Invoice upload / extraction ----------
-- `invoices` holds the clean summary record (no line items, no file blob).
-- `invoice_details` holds the heavy bits (original file + line items + raw text),
-- fetched only on the View Details page.
create table if not exists public.invoices (
  id          text primary key,
  data        jsonb not null,
  created_at  timestamptz not null default now()
);

create table if not exists public.invoice_details (
  id          text primary key,
  data        jsonb not null,
  created_at  timestamptz not null default now()
);

alter table public.invoices        enable row level security;
alter table public.invoice_details enable row level security;

do $$
declare
  t text;
begin
  foreach t in array array['invoices','invoice_details']
  loop
    execute format('drop policy if exists "anon_full_access" on public.%I;', t);
    execute format(
      'create policy "anon_full_access" on public.%I for all to anon, authenticated using (true) with check (true);',
      t
    );
  end loop;
end $$;

-- ---------- DB usage (for the top-bar usage ring) ----------
-- Returns the database size and the free-tier limit (500 MB). SECURITY DEFINER
-- so the anon/publishable role can read the size without elevated rights.
create or replace function public.biztrack_db_usage()
returns json
language sql
security definer
set search_path = public
as $$
  select json_build_object(
    'used_bytes', pg_database_size(current_database()),
    'limit_bytes', 524288000
  );
$$;

grant execute on function public.biztrack_db_usage() to anon, authenticated;

-- ---------- My Sites bookmarks ----------
create table if not exists public.site_bookmarks (
  id          text primary key,
  data        jsonb not null,
  created_at  timestamptz not null default now()
);

alter table public.site_bookmarks enable row level security;

do $$
begin
  execute 'drop policy if exists "anon_full_access" on public.site_bookmarks;';
  execute 'create policy "anon_full_access" on public.site_bookmarks for all to anon, authenticated using (true) with check (true);';
end $$;

-- ---------- Notes (Notion-style rich notes) ----------
create table if not exists public.notes (
  id          text primary key,
  data        jsonb not null,
  created_at  timestamptz not null default now()
);

alter table public.notes enable row level security;

do $$
begin
  execute 'drop policy if exists "anon_full_access" on public.notes;';
  execute 'create policy "anon_full_access" on public.notes for all to anon, authenticated using (true) with check (true);';
end $$;

-- ---------- Catalog: platforms + products ----------
create table if not exists public.platforms (
  id          text primary key,
  data        jsonb not null,
  created_at  timestamptz not null default now()
);

create table if not exists public.products (
  id          text primary key,
  data        jsonb not null,
  created_at  timestamptz not null default now()
);

alter table public.platforms enable row level security;
alter table public.products  enable row level security;

do $$
declare
  t text;
begin
  foreach t in array array['platforms','products']
  loop
    execute format('drop policy if exists "anon_full_access" on public.%I;', t);
    execute format(
      'create policy "anon_full_access" on public.%I for all to anon, authenticated using (true) with check (true);',
      t
    );
  end loop;
end $$;

-- ---------- Vault (private saved links + context, PIN-locked in UI) ----------
create table if not exists public.vault_items (
  id          text primary key,
  data        jsonb not null,
  created_at  timestamptz not null default now()
);

alter table public.vault_items enable row level security;

do $$
begin
  execute 'drop policy if exists "anon_full_access" on public.vault_items;';
  execute 'create policy "anon_full_access" on public.vault_items for all to anon, authenticated using (true) with check (true);';
end $$;

-- ---------- Inventory (stock matrix per category) ----------
create table if not exists public.inventory_categories (
  id          text primary key,
  data        jsonb not null,
  created_at  timestamptz not null default now()
);

alter table public.inventory_categories enable row level security;

do $$
begin
  execute 'drop policy if exists "anon_full_access" on public.inventory_categories;';
  execute 'create policy "anon_full_access" on public.inventory_categories for all to anon, authenticated using (true) with check (true);';
end $$;
