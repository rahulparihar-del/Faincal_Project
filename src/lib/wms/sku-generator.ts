/**
 * SKU Generation for KiddieKa WMS
 * Format: {CATEGORY_CODE}-{PRINT_CODE}-{SIZE_CODE}
 * Example: CJ-DEER-03M
 */

export function generateSku(params: {
  categoryCode: string;   // e.g. "CJ"
  printCode: string;      // e.g. "DEER" (from product type or manual input)
  sizeCode: string;       // e.g. "03M"
}): string {
  const cat = params.categoryCode.toUpperCase().replace(/[^A-Z0-9]/g, '');
  const print = params.printCode.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8);
  const size = params.sizeCode.toUpperCase().replace(/[^A-Z0-9]/g, '');
  return `${cat}-${print}-${size}`;
}

/**
 * Generate batch number: BAT-{CAT_CODE}-{YYMMDD}-{SEQ3}
 */
export function generateBatchNumber(params: {
  categoryCode: string;
  date?: Date;
  sequence: number;
}): string {
  const date = params.date ?? new Date();
  const yy = String(date.getFullYear()).slice(2);
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  const seq = String(params.sequence).padStart(3, '0');
  return `BAT-${params.categoryCode.toUpperCase()}-${yy}${mm}${dd}-${seq}`;
}

/**
 * Generate human-readable movement ID locally (fallback if Supabase function unavailable)
 * Note: For production, use the wms_next_id() SQL function via Supabase RPC
 */
export function generateMovementId(prefix: string): string {
  const now = new Date();
  const dateStr = now.toISOString().slice(0, 10).replace(/-/g, '');
  const rand = Math.floor(Math.random() * 999999).toString().padStart(6, '0');
  return `${prefix}-${dateStr}-${rand}`;
}

/**
 * Validate SKU format
 */
export function isValidSku(sku: string): boolean {
  return /^[A-Z]{1,4}-[A-Z0-9]{1,8}-[A-Z0-9]{1,6}$/.test(sku);
}

/**
 * Parse SKU back into parts
 */
export function parseSku(sku: string): { categoryCode: string; printCode: string; sizeCode: string } | null {
  const parts = sku.split('-');
  if (parts.length !== 3) return null;
  return { categoryCode: parts[0], printCode: parts[1], sizeCode: parts[2] };
}
