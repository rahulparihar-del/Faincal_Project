/**
 * BizTrack — Meesho shared TypeScript interfaces.
 *
 * Single source of truth for every Meesho data shape used across:
 *   - Chrome Extension (content.js / popup.js) — via the Supabase REST API
 *   - Dashboard components (OrdersTab, PaymentsTab, OverviewTab, …)
 *   - orderService.ts (merge / validate / upsert layer)
 *   - ordersParser.ts (CSV / XLSX → MeeshoOrder)
 */

// ── Orders ───────────────────────────────────────────────────────────

/**
 * One Meesho sub-order line item.
 * Maps 1-to-1 with a row in the `meesho_orders` Supabase table.
 */
export interface MeeshoOrder {
  /** Sub-order number — primary key (e.g. "305233645982645470_1") */
  id: string;
  sub_order_no: string;
  /** Parent order ID (sub_order_no without the _N suffix) */
  order_id: string;

  /** YYYY-MM-DD */
  order_date: string;
  /** YYYY-MM-DD — dispatch / SLA date */
  dispatch_date: string;

  /**
   * DELIVERED | RTO_COMPLETE | CANCELLED | PENDING | SHIPPED | PICKED_UP
   * Sourced from reasonForCreditEntry or liveOrderStatus depending on endpoint.
   */
  status: string;

  product_name: string;
  image_url: string;
  sku: string;
  /** Meesho catalog / PID */
  catalog_id: string;
  packet_id: string;
  size: string;
  qty: number;
  /** Discounted / selling price charged to customer */
  selling_price: number;
  /** Supplier listed price (before discount) */
  listing_price: number;

  /** "organic" | "ad_order" | "" */
  order_source: string;
  customer_state: string;
  customer_city: string;

  // ── Sync & capture metadata ──────────────────────────────────────
  /** "extension" | "csv" | "xlsx" */
  data_source: "extension" | "csv" | "xlsx";
  /** ISO timestamp — when the extension first intercepted this order */
  captured_at: string;
  /** ISO timestamp — last upsert to Supabase */
  last_synced_at: string;
  /** ISO timestamp — last time any field value changed */
  last_updated_at: string;

  /** Full raw JSON payload from Meesho API (for debugging & future extraction) */
  raw_json?: Record<string, unknown> | null;

  created_at?: string;
}

// ── Payments ─────────────────────────────────────────────────────────

export interface MeeshoPaymentRow {
  id: string; // subOrderNo | paymentDate (a suborder can settle across multiple payouts)
  subOrderNo: string;
  orderDate: string; // YYYY-MM-DD
  dispatchDate: string;
  productName: string;
  sku: string;
  liveOrderStatus: string; // Delivered | Return | RTO | Exchange | Cancelled | Shipped ...
  listingPrice: number;
  qty: number;
  transactionId: string;
  paymentDate: string; // YYYY-MM-DD — future date means upcoming payment
  settlementAmount: number; // Final Settlement Amount
  saleAmount: number; // Total Sale Amount (Incl. Shipping & GST)
  returnAmount: number; // Total Sale Return Amount
  priceType: string;
}

export interface MeeshoAdsRow {
  id: string; // deductionDuration | deductionDate | campaignId
  deductionDuration: string; // the day the ads actually ran
  deductionDate: string; // YYYY-MM-DD
  campaignId: string;
  adCost: number; // base ad cost (positive)
  gst: number;
  totalAdsCost: number; // total incl GST (positive number = money spent)
}

export interface MeeshoOrderLogRow {
  id: string; // subOrderNo
  subOrderNo: string;
  orderDate: string; // YYYY-MM-DD
  status: string;
  productName: string;
  sku: string;
  size: string;
  qty: number;
  price: number;
  state: string;
}

// ── Sync / validation results ────────────────────────────────────────

export interface ValidationError {
  id: string;
  field: string;
  reason: string;
}

export interface SyncResult {
  /** Records received in this batch */
  records_in: number;
  /** New rows inserted */
  records_new: number;
  /** Existing rows updated (at least one field changed) */
  records_upd: number;
  /** Exact duplicates skipped */
  records_dup: number;
  /** Rows rejected due to validation */
  records_err: number;
  errors: ValidationError[];
}

// ── Supabase row shape ────────────────────────────────────────────────
// meesho_orders table uses structured columns, not the legacy data jsonb pattern.
// This type represents what we POST to Supabase.
export type MeeshoOrderRow = Omit<MeeshoOrder, "created_at">;
