// Inventory buckets (12 total)
export type InventoryBucket =
  | 'available'
  | 'reserved'
  | 'packed'
  | 'dispatched'
  | 'qc_pending'
  | 'returned'
  | 'damaged'
  | 'wrong_return'
  | 'lost'
  | 'transfer'
  | 'rto'
  | 'blocked';

// All 20 movement types
export type StockMovementType =
  | 'opening'
  | 'production'
  | 'purchase'
  | 'purchase_return'
  | 'transfer_in'
  | 'transfer_out'
  | 'sale_amazon'
  | 'sale_flipkart'
  | 'sale_meesho'
  | 'sale_website'
  | 'sale_offline'
  | 'customer_return'
  | 'marketplace_return'
  | 'rto'
  | 'wrong_return'
  | 'damage'
  | 'replacement'
  | 'sample'
  | 'adjustment'
  | 'qc_pass'
  | 'qc_fail';

// Product status
export type ProductStatus = 'active' | 'inactive' | 'discontinued';

// QC status
export type QcStatus = 'good' | 'damaged' | 'used' | 'wrong_product' | 'missing_item' | 'empty_box';

export interface WmsCategory {
  id: string;
  name: string;
  code: string;
  description?: string;
  is_active: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface WmsProductType {
  id: string;
  category_id: string;
  name: string;
  code: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface WmsSize {
  id: string;
  category_id: string;
  label: string;
  code: string;
  sort_order: number;
  is_active: boolean;
  created_at: string;
}

export interface WmsFabric {
  id: string;
  name: string;
  code: string;
  is_active: boolean;
  created_at: string;
}

export interface WmsColor {
  id: string;
  name: string;
  hex_code?: string;
  is_active: boolean;
  created_at: string;
}

export interface WmsWarehouse {
  id: string;
  name: string;
  code: string;
  address?: string;
  city?: string;
  state?: string;
  pincode?: string;
  phone?: string;
  is_active: boolean;
  is_default: boolean;
  created_at: string;
  updated_at: string;
}

export interface WmsWarehouseLocation {
  id: string;
  warehouse_id: string;
  zone?: string;
  rack?: string;
  shelf?: string;
  bin?: string;
  location_code: string;
  is_active: boolean;
  created_at: string;
}

export interface WmsSupplier {
  id: string;
  name: string;
  code: string;
  phone?: string;
  email?: string;
  city?: string;
  state?: string;
  gstin?: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface WmsMarketplaceChannel {
  id: string;
  name: string;
  code: string;
  is_active: boolean;
  created_at: string;
}

export interface WmsBarcodeTemplate {
  id: string;
  name: string;
  width_mm: number;
  height_mm: number;
  fields: Array<{ field: string; show: boolean; label?: string }>;
  is_active: boolean;
  is_default: boolean;
  created_at: string;
  updated_at: string;
}

export interface WmsProduct {
  id: string;
  category_id: string;
  type_id?: string;
  fabric_id?: string;
  product_name: string;
  print_name: string;
  description?: string;
  hsn?: string;
  gst_percent: number;
  status: ProductStatus;
  deleted_at?: string;
  created_at: string;
  updated_at: string;
  // Joined fields
  category?: WmsCategory;
  type?: WmsProductType;
  fabric?: WmsFabric;
  variants?: WmsProductVariant[];
}

export interface WmsProductVariant {
  id: string;
  product_id: string;
  size_id: string;
  color_id?: string;
  sku: string;
  barcode: string;
  weight_grams?: number;
  cost_price: number;
  selling_price: number;
  mrp: number;
  low_stock_threshold: number;
  status: ProductStatus;
  deleted_at?: string;
  created_at: string;
  updated_at: string;
  // Joined
  size?: WmsSize;
  color?: WmsColor;
  product?: WmsProduct;
  inventory?: WmsInventorySnapshot;
}

export interface WmsProductImage {
  id: string;
  product_id: string;
  variant_id?: string;
  url: string;
  type: 'main' | 'back' | 'fabric' | 'label' | 'packaging' | 'lifestyle';
  sort_order: number;
  created_at: string;
}

export interface WmsMarketplaceMapping {
  id: string;
  variant_id: string;
  channel_id: string;
  marketplace_sku?: string;
  listing_id?: string;
  marketplace_mrp?: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  channel?: WmsMarketplaceChannel;
}

export interface WmsBatch {
  id: string;
  batch_number: string;
  variant_id: string;
  warehouse_id: string;
  type: 'production' | 'purchase';
  production_date?: string;
  expiry_date?: string;
  operator?: string;
  supplier_id?: string;
  received_qty: number;
  available_qty: number;
  notes?: string;
  created_at: string;
  updated_at: string;
  variant?: WmsProductVariant;
  supplier?: WmsSupplier;
}

export interface WmsStockMovement {
  id: string;
  movement_type: StockMovementType;
  variant_id: string;
  warehouse_id: string;
  location_id?: string;
  batch_id?: string;
  from_bucket?: InventoryBucket;
  to_bucket?: InventoryBucket;
  quantity: number;
  reference_id?: string;
  reference_type?: string;
  channel_id?: string;
  performed_by: string;
  performed_at: string;
  remarks?: string;
  variant?: WmsProductVariant;
  warehouse?: WmsWarehouse;
  channel?: WmsMarketplaceChannel;
}

export interface WmsInventorySnapshot {
  id: string;
  variant_id: string;
  warehouse_id: string;
  available: number;
  reserved: number;
  packed: number;
  dispatched: number;
  qc_pending: number;
  returned: number;
  damaged: number;
  wrong_return: number;
  lost: number;
  transfer: number;
  rto: number;
  blocked: number;
  total_stock: number;
  last_movement_id?: string;
  updated_at: string;
  variant?: WmsProductVariant;
  warehouse?: WmsWarehouse;
}

export interface WmsInward {
  id: string;
  type: 'production' | 'purchase' | 'transfer' | 'return';
  warehouse_id: string;
  supplier_id?: string;
  reference_no?: string;
  received_date: string;
  received_by: string;
  status: 'draft' | 'received' | 'partial' | 'cancelled';
  notes?: string;
  created_at: string;
  updated_at: string;
  warehouse?: WmsWarehouse;
  supplier?: WmsSupplier;
  items?: WmsInwardItem[];
}

export interface WmsInwardItem {
  id: string;
  inward_id: string;
  variant_id: string;
  batch_id?: string;
  expected_qty: number;
  received_qty: number;
  unit_cost?: number;
  movement_id?: string;
  variant?: WmsProductVariant;
  batch?: WmsBatch;
}

export interface WmsOutward {
  id: string;
  channel_id: string;
  warehouse_id: string;
  order_reference?: string;
  dispatch_date: string;
  dispatched_by: string;
  status: 'draft' | 'picking' | 'packed' | 'dispatched' | 'cancelled';
  notes?: string;
  created_at: string;
  updated_at: string;
  channel?: WmsMarketplaceChannel;
  warehouse?: WmsWarehouse;
  items?: WmsOutwardItem[];
}

export interface WmsOutwardItem {
  id: string;
  outward_id: string;
  variant_id: string;
  batch_id?: string;
  quantity: number;
  movement_id?: string;
  variant?: WmsProductVariant;
}

export interface WmsReturn {
  id: string;
  channel_id?: string;
  warehouse_id: string;
  order_reference?: string;
  return_date: string;
  received_by: string;
  status: 'received' | 'qc_pending' | 'qc_done' | 'closed';
  notes?: string;
  created_at: string;
  updated_at: string;
  channel?: WmsMarketplaceChannel;
  items?: WmsReturnItem[];
}

export interface WmsReturnItem {
  id: string;
  return_id: string;
  variant_id: string;
  quantity: number;
  qc_status?: QcStatus;
  qc_notes?: string;
  qc_by?: string;
  qc_at?: string;
  movement_id?: string;
  variant?: WmsProductVariant;
}

export interface WmsManufacturing {
  id: string;
  warehouse_id: string;
  production_date: string;
  operator: string;
  status: 'in_progress' | 'completed' | 'cancelled';
  notes?: string;
  created_at: string;
  updated_at: string;
  warehouse?: WmsWarehouse;
  items?: WmsManufacturingItem[];
}

export interface WmsManufacturingItem {
  id: string;
  mfg_id: string;
  variant_id: string;
  batch_id?: string;
  planned_qty: number;
  produced_qty: number;
  movement_id?: string;
  variant?: WmsProductVariant;
  batch?: WmsBatch;
}

export interface WmsPurchaseOrder {
  id: string;
  supplier_id: string;
  warehouse_id: string;
  order_date: string;
  expected_date?: string;
  invoice_no?: string;
  invoice_date?: string;
  gst_percent: number;
  status: 'draft' | 'ordered' | 'partial' | 'received' | 'cancelled';
  notes?: string;
  created_at: string;
  updated_at: string;
  supplier?: WmsSupplier;
  warehouse?: WmsWarehouse;
  items?: WmsPurchaseOrderItem[];
}

export interface WmsPurchaseOrderItem {
  id: string;
  po_id: string;
  variant_id: string;
  expected_qty: number;
  received_qty: number;
  pending_qty: number;
  unit_cost: number;
  movement_id?: string;
  variant?: WmsProductVariant;
}

export interface WmsStockAudit {
  id: string;
  warehouse_id: string;
  started_by: string;
  started_at: string;
  completed_at?: string;
  approved_by?: string;
  approved_at?: string;
  status: 'in_progress' | 'completed' | 'approved' | 'cancelled';
  warehouse?: WmsWarehouse;
  items?: WmsStockAuditItem[];
}

export interface WmsStockAuditItem {
  id: string;
  audit_id: string;
  variant_id: string;
  batch_id?: string;
  expected_qty: number;
  actual_qty: number;
  variance_qty: number;
  adjustment_movement_id?: string;
  scanned_at?: string;
  scanned_by?: string;
  variant?: WmsProductVariant;
}

export interface WmsBarcodePrintLog {
  id: string;
  variant_id: string;
  sku: string;
  barcode: string;
  template_id?: string;
  copies: number;
  reprint_count: number;
  is_reprint: boolean;
  printer?: string;
  printed_by: string;
  printed_at: string;
  reference_id?: string;
  reference_type?: string;
  variant?: WmsProductVariant;
  template?: WmsBarcodeTemplate;
}

export interface WmsAuditLog {
  id: string;
  entity_type: string;
  entity_id: string;
  action: string;
  field_name?: string;
  old_value?: string;
  new_value?: string;
  performed_by: string;
  performed_at: string;
}

// ── UI helper types ──────────────────────────────────────────
export interface WmsTableFilter {
  search?: string;
  category_id?: string;
  warehouse_id?: string;
  status?: string;
  date_from?: string;
  date_to?: string;
  page?: number;
  per_page?: number;
}

export interface WmsDashboardStats {
  totalStock: number;
  inventoryValue: number;
  todayInward: number;
  todayOutward: number;
  todayReturns: number;
  todayRto: number;
  qcPending: number;
  damaged: number;
  wrongReturn: number;
  reserved: number;
  lowStockCount: number;
}
