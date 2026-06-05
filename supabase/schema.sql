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

do $$
declare
  t text;
begin
  foreach t in array array['ecom_sales','wholesale_sales','manufacturers','purchases','transactions']
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
