-- ============================================================
-- BizTrack — Meesho Orders v2 (structured schema)
-- Safe migration: handles both fresh install AND existing old
-- meesho_orders table (id, data jsonb, created_at schema).
-- ============================================================

-- ── Step 1: Back up any existing data ─────────────────────
-- If the old table exists and has rows, rename it as a backup
-- before dropping so nothing is lost.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name   = 'meesho_orders'
  ) THEN
    -- Only rename if new columns don't already exist
    -- (i.e. the old data-jsonb schema is in place)
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name   = 'meesho_orders'
        AND column_name  = 'order_date'
    ) THEN
      -- Rename old table to backup (safe — keeps all old rows)
      ALTER TABLE meesho_orders RENAME TO meesho_orders_old_backup;
      RAISE NOTICE 'Old meesho_orders renamed to meesho_orders_old_backup';
    END IF;
  END IF;
END $$;

-- ── Step 2: Create new structured table ───────────────────
CREATE TABLE IF NOT EXISTS meesho_orders (
  -- Primary key
  id                text        PRIMARY KEY,        -- sub_order_no (e.g. "305233645_1")

  -- Searchable structured columns (indexed)
  sub_order_no      text        NOT NULL,
  order_id          text        NOT NULL DEFAULT '', -- parent order ID (sub_order_no without _N)
  order_date        date,
  dispatch_date     date,

  -- DELIVERED | RTO_COMPLETE | CANCELLED | PENDING | SHIPPED | PICKED_UP
  status            text,

  product_name      text,
  image_url         text,
  sku               text,
  catalog_id        text,                            -- Meesho PID / catalog ID
  packet_id         text,
  size              text,
  qty               integer     DEFAULT 1,
  selling_price     numeric(10,2),
  listing_price     numeric(10,2),

  -- "organic" | "ad_order" | ""
  order_source      text        DEFAULT '',
  customer_state    text        DEFAULT '',
  customer_city     text        DEFAULT '',

  -- Sync & capture metadata
  -- "extension" | "csv" | "xlsx"
  data_source       text        NOT NULL DEFAULT 'extension',
  captured_at       timestamptz,                     -- when extension first saw this order
  last_synced_at    timestamptz DEFAULT now(),       -- last upsert from any source
  last_updated_at   timestamptz DEFAULT now(),       -- last time a field value changed

  -- Full raw API payload (debugging + future extraction)
  raw_json          jsonb,

  created_at        timestamptz DEFAULT now()
);

-- ── Step 3: Indexes ───────────────────────────────────────
CREATE INDEX IF NOT EXISTS meesho_orders_order_date_idx   ON meesho_orders (order_date);
CREATE INDEX IF NOT EXISTS meesho_orders_status_idx       ON meesho_orders (status);
CREATE INDEX IF NOT EXISTS meesho_orders_sku_idx          ON meesho_orders (sku);
CREATE INDEX IF NOT EXISTS meesho_orders_catalog_id_idx   ON meesho_orders (catalog_id);
CREATE INDEX IF NOT EXISTS meesho_orders_data_source_idx  ON meesho_orders (data_source);
CREATE INDEX IF NOT EXISTS meesho_orders_order_id_idx     ON meesho_orders (order_id);

-- ── Step 4: Disable RLS ───────────────────────────────────
ALTER TABLE meesho_orders DISABLE ROW LEVEL SECURITY;

-- ── Notes ─────────────────────────────────────────────────
-- • meesho_order_log is intentionally kept — drop manually
--   once meesho_orders is validated in production.
-- • If meesho_orders_old_backup was created above, its rows
--   used the old {id, data jsonb} shape. You may extract them
--   with: SELECT data FROM meesho_orders_old_backup;
-- ─────────────────────────────────────────────────────────
