-- Meesho Returns table
-- Run this in your Supabase SQL editor to enable the Meesho Returns feature
-- Same schema as all other BizTrack tables: id (pk), data (jsonb), created_at

create table if not exists meesho_returns (
  id         text        primary key,
  data       jsonb       not null,
  created_at timestamptz default now()
);

-- Disable Row Level Security (Recommended for dev)
alter table meesho_returns disable row level security;
