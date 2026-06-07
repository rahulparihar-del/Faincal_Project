-- Meesho Orders table
-- Run this in your Supabase SQL editor to enable the Meesho scanner feature
-- Same schema as all other BizTrack tables: id (pk), data (jsonb), created_at

create table if not exists meesho_orders (
  id         text        primary key,
  data       jsonb       not null,
  created_at timestamptz default now()
);

-- Optional: enable Row Level Security (recommended for production)
-- alter table meesho_orders enable row level security;
-- create policy "Allow all" on meesho_orders for all using (true) with check (true);
