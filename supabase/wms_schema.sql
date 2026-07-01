-- WMS Database Schema for KiddieKa WMS

-- 1. Master tables
CREATE TABLE IF NOT EXISTS wms_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  code TEXT NOT NULL UNIQUE,
  description TEXT,
  is_active BOOLEAN DEFAULT true,
  sort_order INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS wms_product_types (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id UUID REFERENCES wms_categories(id),
  name TEXT NOT NULL,
  code TEXT NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(category_id, code)
);

CREATE TABLE IF NOT EXISTS wms_sizes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id UUID REFERENCES wms_categories(id),
  label TEXT NOT NULL,
  code TEXT NOT NULL,
  sort_order INT DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(category_id, code)
);

CREATE TABLE IF NOT EXISTS wms_fabrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  code TEXT NOT NULL UNIQUE,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS wms_colors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  hex_code TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS wms_warehouses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  code TEXT NOT NULL UNIQUE,
  address TEXT,
  city TEXT,
  state TEXT,
  pincode TEXT,
  phone TEXT,
  is_active BOOLEAN DEFAULT true,
  is_default BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS wms_warehouse_locations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  warehouse_id UUID REFERENCES wms_warehouses(id),
  zone TEXT,
  rack TEXT,
  shelf TEXT,
  bin TEXT,
  location_code TEXT NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(warehouse_id, location_code)
);

CREATE TABLE IF NOT EXISTS wms_suppliers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  code TEXT NOT NULL UNIQUE,
  phone TEXT,
  email TEXT,
  city TEXT,
  state TEXT,
  gstin TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS wms_marketplace_channels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  code TEXT NOT NULL UNIQUE,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS wms_barcode_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  width_mm INT NOT NULL,
  height_mm INT NOT NULL,
  fields JSONB NOT NULL DEFAULT '[]',
  is_active BOOLEAN DEFAULT true,
  is_default BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Product Hierarchy
CREATE TABLE IF NOT EXISTS wms_products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id UUID NOT NULL REFERENCES wms_categories(id),
  type_id UUID REFERENCES wms_product_types(id),
  fabric_id UUID REFERENCES wms_fabrics(id),
  product_name TEXT NOT NULL,
  print_name TEXT NOT NULL,
  description TEXT,
  hsn TEXT,
  gst_percent NUMERIC(5,2) DEFAULT 5.0,
  status TEXT DEFAULT 'active' CHECK (status IN ('active','inactive','discontinued')),
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS wms_product_variants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES wms_products(id),
  size_id UUID NOT NULL REFERENCES wms_sizes(id),
  color_id UUID REFERENCES wms_colors(id),
  sku TEXT NOT NULL UNIQUE,
  barcode TEXT NOT NULL UNIQUE,
  weight_grams NUMERIC(8,2),
  cost_price NUMERIC(10,2) DEFAULT 0,
  selling_price NUMERIC(10,2) DEFAULT 0,
  mrp NUMERIC(10,2) DEFAULT 0,
  low_stock_threshold INT DEFAULT 10,
  status TEXT DEFAULT 'active' CHECK (status IN ('active','inactive','discontinued')),
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS wms_product_images (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES wms_products(id),
  variant_id UUID REFERENCES wms_product_variants(id),
  url TEXT NOT NULL,
  type TEXT DEFAULT 'main' CHECK (type IN ('main','back','fabric','label','packaging','lifestyle')),
  sort_order INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS wms_marketplace_mappings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  variant_id UUID NOT NULL REFERENCES wms_product_variants(id),
  channel_id UUID NOT NULL REFERENCES wms_marketplace_channels(id),
  marketplace_sku TEXT,
  listing_id TEXT,
  marketplace_mrp NUMERIC(10,2),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(variant_id, channel_id)
);

-- 3. Batches
CREATE TABLE IF NOT EXISTS wms_batches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_number TEXT NOT NULL UNIQUE,
  variant_id UUID NOT NULL REFERENCES wms_product_variants(id),
  warehouse_id UUID NOT NULL REFERENCES wms_warehouses(id),
  type TEXT NOT NULL CHECK (type IN ('production','purchase')),
  production_date DATE,
  expiry_date DATE,
  operator TEXT,
  supplier_id UUID REFERENCES wms_suppliers(id),
  received_qty INT DEFAULT 0,
  available_qty INT DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 4. Stock Movement Ledger (Immutable)
CREATE TABLE IF NOT EXISTS wms_stock_movements (
  id TEXT PRIMARY KEY,
  movement_type TEXT NOT NULL CHECK (movement_type IN (
    'opening','production','purchase','purchase_return',
    'transfer_in','transfer_out','sale_amazon','sale_flipkart',
    'sale_meesho','sale_website','sale_offline','customer_return',
    'marketplace_return','rto','wrong_return','damage',
    'replacement','sample','adjustment','qc_pass','qc_fail'
  )),
  variant_id UUID NOT NULL REFERENCES wms_product_variants(id),
  warehouse_id UUID NOT NULL REFERENCES wms_warehouses(id),
  location_id UUID REFERENCES wms_warehouse_locations(id),
  batch_id UUID REFERENCES wms_batches(id),
  from_bucket TEXT CHECK (from_bucket IN (
    'available','reserved','packed','dispatched','qc_pending',
    'returned','damaged','wrong_return','lost','transfer','rto','blocked'
  )),
  to_bucket TEXT CHECK (to_bucket IN (
    'available','reserved','packed','dispatched','qc_pending',
    'returned','damaged','wrong_return','lost','transfer','rto','blocked'
  )),
  quantity INT NOT NULL CHECK (quantity > 0),
  reference_id TEXT,
  reference_type TEXT,
  channel_id UUID REFERENCES wms_marketplace_channels(id),
  performed_by TEXT NOT NULL,
  performed_at TIMESTAMPTZ DEFAULT now(),
  remarks TEXT,
  CONSTRAINT chk_different_buckets CHECK (from_bucket IS DISTINCT FROM to_bucket)
);

CREATE INDEX IF NOT EXISTS idx_movements_variant ON wms_stock_movements(variant_id);
CREATE INDEX IF NOT EXISTS idx_movements_warehouse ON wms_stock_movements(warehouse_id);
CREATE INDEX IF NOT EXISTS idx_movements_performed_at ON wms_stock_movements(performed_at DESC);
CREATE INDEX IF NOT EXISTS idx_movements_reference ON wms_stock_movements(reference_id);

-- 5. Inventory Snapshot (Optimized for Querying)
CREATE TABLE IF NOT EXISTS wms_inventory_snapshot (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  variant_id UUID NOT NULL REFERENCES wms_product_variants(id),
  warehouse_id UUID NOT NULL REFERENCES wms_warehouses(id),
  available INT DEFAULT 0,
  reserved INT DEFAULT 0,
  packed INT DEFAULT 0,
  dispatched INT DEFAULT 0,
  qc_pending INT DEFAULT 0,
  returned INT DEFAULT 0,
  damaged INT DEFAULT 0,
  wrong_return INT DEFAULT 0,
  lost INT DEFAULT 0,
  transfer INT DEFAULT 0,
  rto INT DEFAULT 0,
  blocked INT DEFAULT 0,
  total_stock INT GENERATED ALWAYS AS (
    available + reserved + packed + dispatched + qc_pending +
    returned + damaged + wrong_return + lost + transfer + rto + blocked
  ) STORED,
  last_movement_id TEXT REFERENCES wms_stock_movements(id),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(variant_id, warehouse_id)
);

-- Trigger to maintain wms_inventory_snapshot on ledger inserts
CREATE OR REPLACE FUNCTION wms_update_inventory_snapshot()
RETURNS TRIGGER AS $$
BEGIN
  -- 1. Ensure a snapshot record exists for the variant + warehouse
  INSERT INTO wms_inventory_snapshot (variant_id, warehouse_id)
  VALUES (NEW.variant_id, NEW.warehouse_id)
  ON CONFLICT (variant_id, warehouse_id) DO NOTHING;

  -- 2. Decrement from_bucket if specified
  IF NEW.from_bucket IS NOT NULL THEN
    EXECUTE format('UPDATE wms_inventory_snapshot SET %I = COALESCE(%I, 0) - $1, last_movement_id = $2, updated_at = now() WHERE variant_id = $3 AND warehouse_id = $4', NEW.from_bucket, NEW.from_bucket)
    USING NEW.quantity, NEW.id, NEW.variant_id, NEW.warehouse_id;
  END IF;

  -- 3. Increment to_bucket if specified
  IF NEW.to_bucket IS NOT NULL THEN
    EXECUTE format('UPDATE wms_inventory_snapshot SET %I = COALESCE(%I, 0) + $1, last_movement_id = $2, updated_at = now() WHERE variant_id = $3 AND warehouse_id = $4', NEW.to_bucket, NEW.to_bucket)
    USING NEW.quantity, NEW.id, NEW.variant_id, NEW.warehouse_id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_wms_inventory_snapshot
AFTER INSERT ON wms_stock_movements
FOR EACH ROW
EXECUTE FUNCTION wms_update_inventory_snapshot();

-- 6. Inwards
CREATE TABLE IF NOT EXISTS wms_inwards (
  id TEXT PRIMARY KEY,
  type TEXT CHECK (type IN ('production','purchase','transfer','return')),
  warehouse_id UUID NOT NULL REFERENCES wms_warehouses(id),
  supplier_id UUID REFERENCES wms_suppliers(id),
  reference_no TEXT,
  received_date DATE DEFAULT CURRENT_DATE,
  received_by TEXT NOT NULL,
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft','received','partial','cancelled')),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS wms_inward_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  inward_id TEXT NOT NULL REFERENCES wms_inwards(id) ON DELETE CASCADE,
  variant_id UUID NOT NULL REFERENCES wms_product_variants(id),
  batch_id UUID REFERENCES wms_batches(id),
  expected_qty INT DEFAULT 0,
  received_qty INT DEFAULT 0,
  unit_cost NUMERIC(10,2),
  movement_id TEXT REFERENCES wms_stock_movements(id)
);

-- 7. Outwards
CREATE TABLE IF NOT EXISTS wms_outwards (
  id TEXT PRIMARY KEY,
  channel_id UUID REFERENCES wms_marketplace_channels(id),
  warehouse_id UUID NOT NULL REFERENCES wms_warehouses(id),
  order_reference TEXT,
  dispatch_date DATE DEFAULT CURRENT_DATE,
  dispatched_by TEXT NOT NULL,
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft','picking','packed','dispatched','cancelled')),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS wms_outward_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  outward_id TEXT NOT NULL REFERENCES wms_outwards(id) ON DELETE CASCADE,
  variant_id UUID NOT NULL REFERENCES wms_product_variants(id),
  batch_id UUID REFERENCES wms_batches(id),
  quantity INT NOT NULL CHECK (quantity > 0),
  movement_id TEXT REFERENCES wms_stock_movements(id)
);

-- 8. Returns
CREATE TABLE IF NOT EXISTS wms_returns (
  id TEXT PRIMARY KEY,
  channel_id UUID REFERENCES wms_marketplace_channels(id),
  warehouse_id UUID NOT NULL REFERENCES wms_warehouses(id),
  order_reference TEXT,
  return_date DATE DEFAULT CURRENT_DATE,
  received_by TEXT NOT NULL,
  status TEXT DEFAULT 'received' CHECK (status IN ('received','qc_pending','qc_done','closed')),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS wms_return_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  return_id TEXT NOT NULL REFERENCES wms_returns(id) ON DELETE CASCADE,
  variant_id UUID NOT NULL REFERENCES wms_product_variants(id),
  quantity INT NOT NULL CHECK (quantity > 0),
  qc_status TEXT CHECK (qc_status IN ('good','damaged','used','wrong_product','missing_item','empty_box')),
  qc_notes TEXT,
  qc_by TEXT,
  qc_at TIMESTAMPTZ,
  movement_id TEXT REFERENCES wms_stock_movements(id)
);

-- 9. Manufacturing Orders
CREATE TABLE IF NOT EXISTS wms_manufacturing (
  id TEXT PRIMARY KEY,
  warehouse_id UUID NOT NULL REFERENCES wms_warehouses(id),
  production_date DATE DEFAULT CURRENT_DATE,
  operator TEXT NOT NULL,
  status TEXT DEFAULT 'in_progress' CHECK (status IN ('in_progress','completed','cancelled')),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS wms_manufacturing_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mfg_id TEXT NOT NULL REFERENCES wms_manufacturing(id) ON DELETE CASCADE,
  variant_id UUID NOT NULL REFERENCES wms_product_variants(id),
  batch_id UUID REFERENCES wms_batches(id),
  planned_qty INT DEFAULT 0,
  produced_qty INT DEFAULT 0,
  movement_id TEXT REFERENCES wms_stock_movements(id)
);

-- 10. Purchase Orders
CREATE TABLE IF NOT EXISTS wms_purchase_orders (
  id TEXT PRIMARY KEY,
  supplier_id UUID NOT NULL REFERENCES wms_suppliers(id),
  warehouse_id UUID NOT NULL REFERENCES wms_warehouses(id),
  order_date DATE DEFAULT CURRENT_DATE,
  expected_date DATE,
  invoice_no TEXT,
  invoice_date DATE,
  gst_percent NUMERIC(5,2) DEFAULT 0,
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft','ordered','partial','received','cancelled')),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS wms_purchase_order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  po_id TEXT NOT NULL REFERENCES wms_purchase_orders(id) ON DELETE CASCADE,
  variant_id UUID NOT NULL REFERENCES wms_product_variants(id),
  expected_qty INT DEFAULT 0,
  received_qty INT DEFAULT 0,
  unit_cost NUMERIC(10,2) DEFAULT 0,
  movement_id TEXT REFERENCES wms_stock_movements(id)
);

-- 11. Stock Audits
CREATE TABLE IF NOT EXISTS wms_stock_audits (
  id TEXT PRIMARY KEY,
  warehouse_id UUID NOT NULL REFERENCES wms_warehouses(id),
  started_by TEXT NOT NULL,
  started_at TIMESTAMPTZ DEFAULT now(),
  completed_at TIMESTAMPTZ,
  approved_by TEXT,
  approved_at TIMESTAMPTZ,
  status TEXT DEFAULT 'in_progress' CHECK (status IN ('in_progress','completed','approved','cancelled'))
);

CREATE TABLE IF NOT EXISTS wms_stock_audit_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  audit_id TEXT NOT NULL REFERENCES wms_stock_audits(id) ON DELETE CASCADE,
  variant_id UUID NOT NULL REFERENCES wms_product_variants(id),
  batch_id UUID REFERENCES wms_batches(id),
  expected_qty INT DEFAULT 0,
  actual_qty INT DEFAULT 0,
  adjustment_movement_id TEXT REFERENCES wms_stock_movements(id),
  scanned_at TIMESTAMPTZ,
  scanned_by TEXT
);

-- 12. Barcode Print Logs
CREATE TABLE IF NOT EXISTS wms_barcode_print_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  variant_id UUID NOT NULL REFERENCES wms_product_variants(id),
  sku TEXT NOT NULL,
  barcode TEXT NOT NULL,
  template_id UUID REFERENCES wms_barcode_templates(id),
  copies INT DEFAULT 1,
  reprint_count INT DEFAULT 0,
  is_reprint BOOLEAN DEFAULT false,
  printer TEXT,
  printed_by TEXT NOT NULL,
  printed_at TIMESTAMPTZ DEFAULT now(),
  reference_id TEXT,
  reference_type TEXT
);

-- 13. Audit Log
CREATE TABLE IF NOT EXISTS wms_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  action TEXT NOT NULL,
  field_name TEXT,
  old_value TEXT,
  new_value TEXT,
  performed_by TEXT NOT NULL,
  performed_at TIMESTAMPTZ DEFAULT now(),
  ip_address TEXT,
  session_id TEXT
);

CREATE INDEX IF NOT EXISTS idx_audit_entity ON wms_audit_log(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_audit_performed_by ON wms_audit_log(performed_by);
CREATE INDEX IF NOT EXISTS idx_audit_performed_at ON wms_audit_log(performed_at DESC);

-- 14. Human-readable IDs sequence table & generator function
CREATE TABLE IF NOT EXISTS wms_id_sequences (
  prefix TEXT NOT NULL,
  date_key DATE NOT NULL,
  seq BIGINT DEFAULT 0,
  PRIMARY KEY (prefix, date_key)
);

CREATE OR REPLACE FUNCTION wms_next_id(p_prefix TEXT)
RETURNS TEXT AS $$
DECLARE
  v_today DATE := CURRENT_DATE;
  v_seq BIGINT;
  v_result TEXT;
BEGIN
  INSERT INTO wms_id_sequences (prefix, date_key, seq)
  VALUES (p_prefix, v_today, 1)
  ON CONFLICT (prefix, date_key)
  DO UPDATE SET seq = wms_id_sequences.seq + 1
  RETURNING seq INTO v_seq;

  v_result := p_prefix || '-' || TO_CHAR(v_today, 'YYYYMMDD') || '-' || LPAD(v_seq::TEXT, 6, '0');
  RETURN v_result;
END;
$$ LANGUAGE plpgsql;

-- 15. RLS Rules: Disable RLS restriction or enable full anon access like existing pattern
-- Supabase RLS bypass pattern
ALTER TABLE wms_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE wms_product_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE wms_sizes ENABLE ROW LEVEL SECURITY;
ALTER TABLE wms_fabrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE wms_colors ENABLE ROW LEVEL SECURITY;
ALTER TABLE wms_warehouses ENABLE ROW LEVEL SECURITY;
ALTER TABLE wms_warehouse_locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE wms_suppliers ENABLE ROW LEVEL SECURITY;
ALTER TABLE wms_marketplace_channels ENABLE ROW LEVEL SECURITY;
ALTER TABLE wms_barcode_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE wms_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE wms_product_variants ENABLE ROW LEVEL SECURITY;
ALTER TABLE wms_product_images ENABLE ROW LEVEL SECURITY;
ALTER TABLE wms_marketplace_mappings ENABLE ROW LEVEL SECURITY;
ALTER TABLE wms_batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE wms_stock_movements ENABLE ROW LEVEL SECURITY;
ALTER TABLE wms_inventory_snapshot ENABLE ROW LEVEL SECURITY;
ALTER TABLE wms_inwards ENABLE ROW LEVEL SECURITY;
ALTER TABLE wms_inward_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE wms_outwards ENABLE ROW LEVEL SECURITY;
ALTER TABLE wms_outward_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE wms_returns ENABLE ROW LEVEL SECURITY;
ALTER TABLE wms_return_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE wms_manufacturing ENABLE ROW LEVEL SECURITY;
ALTER TABLE wms_manufacturing_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE wms_purchase_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE wms_purchase_order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE wms_stock_audits ENABLE ROW LEVEL SECURITY;
ALTER TABLE wms_stock_audit_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE wms_barcode_print_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE wms_audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE wms_id_sequences ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE
  tbl RECORD;
BEGIN
  FOR tbl IN 
    SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename LIKE 'wms_%'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS anon_full_access ON %I', tbl.tablename);
    EXECUTE format('CREATE POLICY anon_full_access ON %I FOR ALL USING (true) WITH CHECK (true)', tbl.tablename);
  END LOOP;
END;
$$;
