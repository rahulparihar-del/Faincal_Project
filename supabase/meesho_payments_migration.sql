-- Meesho Payments dashboard tables
-- Run this in your Supabase SQL editor to enable the Meesho "Payments & Ads" tab.
-- Same schema as all other BizTrack tables: id (pk), data (jsonb), created_at

create table if not exists meesho_payments (
  id         text        primary key,
  data       jsonb       not null,
  created_at timestamptz default now()
);

create table if not exists meesho_ads (
  id         text        primary key,
  data       jsonb       not null,
  created_at timestamptz default now()
);

create table if not exists meesho_order_log (
  id         text        primary key,
  data       jsonb       not null,
  created_at timestamptz default now()
);

-- Disable Row Level Security (matches the other BizTrack tables for this private tool)
alter table meesho_payments  disable row level security;
alter table meesho_ads       disable row level security;
alter table meesho_order_log disable row level security;
