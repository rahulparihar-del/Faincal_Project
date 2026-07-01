import { InventoryBucket, StockMovementType } from './types';

export const BUCKET_CONFIG: Record<InventoryBucket, { label: string; color: string; bgColor: string; description: string }> = {
  available:    { label: 'Available',    color: '#10b981', bgColor: '#d1fae5', description: 'Ready to sell' },
  reserved:     { label: 'Reserved',     color: '#6366f1', bgColor: '#e0e7ff', description: 'Reserved for orders' },
  packed:       { label: 'Packed',       color: '#3b82f6', bgColor: '#dbeafe', description: 'Packed for dispatch' },
  dispatched:   { label: 'Dispatched',   color: '#8b5cf6', bgColor: '#ede9fe', description: 'Sent to courier' },
  qc_pending:   { label: 'QC Pending',   color: '#f59e0b', bgColor: '#fef3c7', description: 'Awaiting quality check' },
  returned:     { label: 'Returned',     color: '#06b6d4', bgColor: '#cffafe', description: 'Returned from customer' },
  damaged:      { label: 'Damaged',      color: '#ef4444', bgColor: '#fee2e2', description: 'Damaged goods' },
  wrong_return: { label: 'Wrong Return', color: '#f97316', bgColor: '#ffedd5', description: 'Wrong item returned' },
  lost:         { label: 'Lost',         color: '#6b7280', bgColor: '#f3f4f6', description: 'Lost/missing stock' },
  transfer:     { label: 'Transfer',     color: '#14b8a6', bgColor: '#ccfbf1', description: 'In transit between warehouses' },
  rto:          { label: 'RTO',          color: '#dc2626', bgColor: '#fee2e2', description: 'Return to origin' },
  blocked:      { label: 'Blocked',      color: '#374151', bgColor: '#e5e7eb', description: 'Blocked/on hold' },
};

export const MOVEMENT_TYPE_CONFIG: Record<StockMovementType, { label: string; color: string; isInbound: boolean }> = {
  opening:           { label: 'Opening Stock',      color: '#6366f1', isInbound: true },
  production:        { label: 'Production',          color: '#10b981', isInbound: true },
  purchase:          { label: 'Purchase',            color: '#10b981', isInbound: true },
  purchase_return:   { label: 'Purchase Return',     color: '#ef4444', isInbound: false },
  transfer_in:       { label: 'Transfer In',         color: '#3b82f6', isInbound: true },
  transfer_out:      { label: 'Transfer Out',        color: '#f59e0b', isInbound: false },
  sale_amazon:       { label: 'Amazon Sale',         color: '#f97316', isInbound: false },
  sale_flipkart:     { label: 'Flipkart Sale',       color: '#3b82f6', isInbound: false },
  sale_meesho:       { label: 'Meesho Sale',         color: '#ec4899', isInbound: false },
  sale_website:      { label: 'Website Sale',        color: '#8b5cf6', isInbound: false },
  sale_offline:      { label: 'Offline Sale',        color: '#6b7280', isInbound: false },
  customer_return:   { label: 'Customer Return',     color: '#06b6d4', isInbound: true },
  marketplace_return:{ label: 'Marketplace Return',  color: '#14b8a6', isInbound: true },
  rto:               { label: 'RTO',                 color: '#dc2626', isInbound: false },
  wrong_return:      { label: 'Wrong Return',        color: '#f97316', isInbound: false },
  damage:            { label: 'Damage',              color: '#ef4444', isInbound: false },
  replacement:       { label: 'Replacement',         color: '#6366f1', isInbound: true },
  sample:            { label: 'Sample',              color: '#8b5cf6', isInbound: false },
  adjustment:        { label: 'Adjustment',          color: '#f59e0b', isInbound: false },
  qc_pass:           { label: 'QC Pass',             color: '#10b981', isInbound: true },
  qc_fail:           { label: 'QC Fail',             color: '#ef4444', isInbound: false },
};

export const CATEGORY_SKU_CODES: Record<string, string> = {
  'Cotton Jabla': 'CJ',
  'Cotton Co-ord Set': 'CCS',
  'Polyester Co-ord Set': 'PCS',
  'Cotton Night Suit Half Sleeve': 'CNH',
  'Cotton Night Suit Full Sleeve': 'CNF',
  'Cotton Frock': 'CF',
  'Cotton Hooded Towel': 'CHT',
  'Cotton Swaddle': 'CS',
  'Wipes Cotton Rumal': 'WCR',
  'Track Pant': 'TP',
};

export const WMS_ID_PREFIXES = {
  movement: 'SM',
  inward: 'INW',
  outward: 'OUT',
  return: 'RET',
  manufacturing: 'MFG',
  purchase: 'PO',
  audit: 'AUD',
  adjustment: 'ADJ',
  batch: 'BAT',
} as const;

export const INWARD_TYPES = [
  { value: 'production', label: 'Production' },
  { value: 'purchase', label: 'Purchase' },
  { value: 'transfer', label: 'Transfer' },
  { value: 'return', label: 'Return' },
] as const;

export const OUTWARD_STATUSES = ['draft', 'picking', 'packed', 'dispatched', 'cancelled'] as const;
export const INWARD_STATUSES = ['draft', 'received', 'partial', 'cancelled'] as const;
export const PRODUCT_STATUSES = ['active', 'inactive', 'discontinued'] as const;

export const LOW_STOCK_THRESHOLD_DEFAULT = 10;

export const BUCKETS_ORDER: InventoryBucket[] = [
  'available', 'reserved', 'packed', 'dispatched',
  'qc_pending', 'returned', 'damaged', 'wrong_return',
  'lost', 'transfer', 'rto', 'blocked'
];
