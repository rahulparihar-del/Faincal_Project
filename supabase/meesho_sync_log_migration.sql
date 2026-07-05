-- ============================================================
-- BizTrack — Meesho Sync Log
-- Tracks every sync event (extension push, CSV/XLSX import).
-- Run once in Supabase SQL editor.
-- ============================================================

create table if not exists meesho_sync_log (
  id            bigserial   primary key,

  -- Source that triggered this sync
  -- "extension" | "csv" | "xlsx" | "manual"
  source        text        not null,

  -- Which table was the target
  table_name    text        not null,   -- e.g. "meesho_orders"

  -- Record counts
  records_in    integer     default 0,  -- total records received in this batch
  records_new   integer     default 0,  -- new rows inserted
  records_upd   integer     default 0,  -- existing rows updated (field changed)
  records_dup   integer     default 0,  -- exact duplicates skipped (no change)
  records_err   integer     default 0,  -- rows rejected due to validation errors

  -- Validation error details (array of { id, field, reason })
  errors        jsonb       default '[]'::jsonb,

  -- Browser / capture context (filled by extension; null for CSV uploads)
  page_url      text,                   -- supplier.meesho.com URL at sync time
  extension_ver text,                   -- extension version string

  synced_at     timestamptz default now()
);

-- Index for dashboard queries
create index if not exists meesho_sync_log_source_idx    on meesho_sync_log (source);
create index if not exists meesho_sync_log_synced_at_idx on meesho_sync_log (synced_at desc);

-- Disable RLS
alter table meesho_sync_log disable row level security;
