/**
 * BizTrack — Meesho Order Service
 *
 * Single save/merge layer for ALL order writes — both the extension sync
 * and the CSV/XLSX backup import funnel through here.
 *
 * Responsibilities:
 *   1. Validate each incoming record.
 *   2. Deduplicate against what already exists in Supabase.
 *   3. Detect updates (same id, different field values).
 *   4. Upsert valid records in batches.
 *   5. Write a row to meesho_sync_log.
 *   6. Return a SyncResult summary.
 */

import { supabase, isSupabaseConfigured } from "@/lib/supabase/client";
import type { MeeshoOrder, MeeshoOrderRow, SyncResult, ValidationError } from "./types";

const ORDERS_TABLE = "meesho_orders";
const SYNC_LOG_TABLE = "meesho_sync_log";
const UPSERT_CHUNK_SIZE = 200;

// ── Validation ────────────────────────────────────────────────────────

/**
 * Minimal validity rules for an order row.
 * Returns array of errors; empty array = valid.
 */
export function validateOrder(
  row: Partial<MeeshoOrder>
): ValidationError[] {
  const errs: ValidationError[] = [];
  const id = row.id ?? row.sub_order_no ?? "(unknown)";

  if (!row.id && !row.sub_order_no) {
    errs.push({ id, field: "sub_order_no", reason: "Missing sub_order_no — required primary key" });
  }

  if (row.id && !/\d{6,}/.test(row.id)) {
    errs.push({ id, field: "id", reason: "sub_order_no must contain at least 6 consecutive digits" });
  }

  if (!row.order_date) {
    errs.push({ id, field: "order_date", reason: "Missing order_date" });
  }

  if (row.qty !== undefined && (isNaN(row.qty) || row.qty < 1)) {
    errs.push({ id, field: "qty", reason: "qty must be a positive integer" });
  }

  return errs;
}

// ── Field-level diff ──────────────────────────────────────────────────

const TRACKED_FIELDS: (keyof MeeshoOrder)[] = [
  "status", "dispatch_date", "selling_price", "listing_price",
  "product_name", "sku", "size", "qty", "catalog_id", "packet_id",
  "image_url", "order_source", "customer_state", "customer_city",
];

/**
 * Returns true if `incoming` has at least one field value that differs
 * from `existing` on any of the TRACKED_FIELDS.
 */
function hasChanged(existing: MeeshoOrder, incoming: Partial<MeeshoOrder>): boolean {
  return TRACKED_FIELDS.some((f) => {
    const a = existing[f];
    const b = incoming[f];
    return b !== undefined && b !== null && b !== "" && String(a) !== String(b);
  });
}

// ── Merge & upsert ────────────────────────────────────────────────────

/**
 * Main entry point.
 *
 * @param incomingRaw   Raw/partial records from extension or parser.
 * @param source        "extension" | "csv" | "xlsx"
 * @param context       Optional metadata for sync_log (pageUrl, extensionVer).
 */
export async function mergeOrders(
  incomingRaw: Partial<MeeshoOrder>[],
  source: "extension" | "csv" | "xlsx",
  context: { pageUrl?: string; extensionVer?: string } = {}
): Promise<SyncResult> {
  const now = new Date().toISOString();

  const result: SyncResult = {
    records_in: incomingRaw.length,
    records_new: 0,
    records_upd: 0,
    records_dup: 0,
    records_err: 0,
    errors: [],
  };

  // ── Step 1: Validate ─────────────────────────────────────────────
  const valid: MeeshoOrder[] = [];

  for (const raw of incomingRaw) {
    const errs = validateOrder(raw);
    if (errs.length > 0) {
      result.records_err += 1;
      result.errors.push(...errs);
      continue;
    }

    const subOrderNo = (raw.id ?? raw.sub_order_no)!.trim();
    const orderId = subOrderNo.includes("_")
      ? subOrderNo.slice(0, subOrderNo.lastIndexOf("_"))
      : subOrderNo;

    valid.push({
      id: subOrderNo,
      sub_order_no: subOrderNo,
      order_id: raw.order_id || orderId,
      order_date: raw.order_date ?? "",
      dispatch_date: raw.dispatch_date ?? "",
      status: raw.status ?? "",
      product_name: raw.product_name ?? "",
      image_url: raw.image_url ?? "",
      sku: raw.sku ?? "",
      catalog_id: raw.catalog_id ?? "",
      packet_id: raw.packet_id ?? "",
      size: raw.size ?? "",
      qty: Number(raw.qty) || 1,
      selling_price: Number(raw.selling_price ?? 0),
      listing_price: Number(raw.listing_price ?? 0),
      order_source: raw.order_source ?? "",
      customer_state: raw.customer_state ?? "",
      customer_city: raw.customer_city ?? "",
      data_source: source,
      captured_at: raw.captured_at ?? now,
      last_synced_at: now,
      last_updated_at: now,
      raw_json: (raw.raw_json as Record<string, unknown>) ?? null,
    });
  }

  if (valid.length === 0) {
    await writeSyncLog(result, source, context, now);
    return result;
  }

  // ── Step 2: Fetch existing rows for dedup ────────────────────────
  if (!isSupabaseConfigured || !supabase) {
    // Supabase not configured — treat everything as new (offline mode)
    result.records_new = valid.length;
    await writeSyncLog(result, source, context, now);
    return result;
  }

  const ids = valid.map((r) => r.id);
  const { data: existingRows, error: fetchErr } = await supabase
    .from(ORDERS_TABLE)
    .select("id, status, dispatch_date, selling_price, listing_price, product_name, sku, size, qty, catalog_id, packet_id, image_url, order_source, customer_state, customer_city")
    .in("id", ids);

  if (fetchErr) {
    console.error("[MeeshoOrderService] fetch existing failed:", fetchErr.message);
    // Proceed with blind upsert on error
  }

  const existingMap = new Map<string, MeeshoOrder>(
    (existingRows ?? []).map((r) => [r.id, r as unknown as MeeshoOrder])
  );

  // ── Step 3: Classify each record ─────────────────────────────────
  const toUpsert: MeeshoOrderRow[] = [];

  for (const row of valid) {
    const existing = existingMap.get(row.id);
    if (!existing) {
      // Brand new order
      result.records_new += 1;
      toUpsert.push(row);
    } else if (hasChanged(existing, row)) {
      // Existing order with changed fields
      result.records_upd += 1;
      // Preserve original captured_at; update last_updated_at
      toUpsert.push({
        ...row,
        captured_at: (existing as any).captured_at ?? row.captured_at,
        last_updated_at: now,
      });
    } else {
      // Exact duplicate — no change needed
      result.records_dup += 1;
    }
  }

  // ── Step 4: Upsert in chunks ──────────────────────────────────────
  for (let i = 0; i < toUpsert.length; i += UPSERT_CHUNK_SIZE) {
    const chunk = toUpsert.slice(i, i + UPSERT_CHUNK_SIZE);
    const { error: upsertErr } = await supabase
      .from(ORDERS_TABLE)
      .upsert(chunk, { onConflict: "id" });

    if (upsertErr) {
      console.error("[MeeshoOrderService] upsert failed:", upsertErr.message);
      result.errors.push({
        id: "(batch)",
        field: "upsert",
        reason: upsertErr.message,
      });
      result.records_err += chunk.length;
      result.records_new -= Math.min(result.records_new, chunk.length);
      result.records_upd -= Math.min(result.records_upd, chunk.length);
    }
  }

  // ── Step 5: Write sync log ────────────────────────────────────────
  await writeSyncLog(result, source, context, now);

  return result;
}

// ── Sync log writer ───────────────────────────────────────────────────

async function writeSyncLog(
  result: SyncResult,
  source: "extension" | "csv" | "xlsx",
  context: { pageUrl?: string; extensionVer?: string },
  now: string
): Promise<void> {
  if (!isSupabaseConfigured || !supabase) return;
  try {
    await supabase.from(SYNC_LOG_TABLE).insert({
      source,
      table_name: ORDERS_TABLE,
      records_in: result.records_in,
      records_new: result.records_new,
      records_upd: result.records_upd,
      records_dup: result.records_dup,
      records_err: result.records_err,
      errors: result.errors.length > 0 ? result.errors : [],
      page_url: context.pageUrl ?? null,
      extension_ver: context.extensionVer ?? null,
      synced_at: now,
    });
  } catch (err) {
    // Sync log failure must never break the main flow
    console.warn("[MeeshoOrderService] sync log write failed:", err);
  }
}

// ── Convenience: fetch all orders ────────────────────────────────────

/**
 * Fetch all orders from Supabase, ordered by order_date descending.
 * Returns [] if Supabase is not configured.
 */
export async function fetchAllOrders(): Promise<MeeshoOrder[]> {
  if (!isSupabaseConfigured || !supabase) return [];
  const { data, error } = await supabase
    .from(ORDERS_TABLE)
    .select("*")
    .order("order_date", { ascending: false });

  if (error) {
    console.error("[MeeshoOrderService] fetchAllOrders failed:", error.message);
    return [];
  }
  return (data ?? []) as MeeshoOrder[];
}

/**
 * Delete ALL orders from Supabase (reset).
 */
export async function clearAllOrders(): Promise<void> {
  if (!isSupabaseConfigured || !supabase) return;
  await supabase.from(ORDERS_TABLE).delete().neq("id", "");
}
