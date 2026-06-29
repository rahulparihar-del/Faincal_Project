export type DateRange = 'today' | 'yesterday' | '7days' | '30days' | 'thisMonth' | 'lastMonth' | 'custom';

export interface DateFilter {
  range: DateRange;
  from: string; // YYYY-MM-DD
  to: string;   // YYYY-MM-DD
}

export type OrderStatus = 'packed' | 'shipped' | 'delivered' | 'cancelled' | 'rto' | 'returned';
export type ReturnReason = 'size_issue' | 'quality_issue' | 'wrong_product' | 'damaged' | 'not_needed' | 'other';
export type CourierName = 'Xpressbees' | 'Delhivery' | 'Shadowfax' | 'Ekart' | 'Bluedart' | 'Valmo' | 'Other';
export type ClaimStatus = 'pending' | 'approved' | 'rejected' | 'processing';
export type AdStatus = 'active' | 'paused' | 'ended';
export type PaymentStatus = 'pending' | 'processing' | 'settled';

export interface MMOrder {
  id: string;
  date: string;           // YYYY-MM-DD
  orderNo: string;
  sku: string;
  productName: string;
  qty: number;
  sellingPrice: number;
  costOfGoods: number;    // COGS
  platformFee: number;    // Meesho commission
  shippingCharge: number;
  adSpend: number;        // allocated ad cost
  status: OrderStatus;
  courier: CourierName;
  city: string;
  state: string;
  paymentType: 'prepaid' | 'cod';
  returnReason?: ReturnReason;
  rtoAttempts?: number;
  deliveryDays?: number;  // days to deliver
  claimId?: string;
  paymentCycleId?: string;
}

export interface MMReturn {
  id: string;
  orderId: string;
  date: string;
  sku: string;
  productName: string;
  reason: ReturnReason;
  courier: CourierName;
  returnShippingCharge: number;
  isRTO: boolean;         // true = RTO, false = customer return
  rtoAttempts: number;
  recoveryStatus: 'pending' | 'recovered' | 'lost';
  financialLoss: number;
  city: string;
}

export interface MMClaim {
  id: string;
  orderId: string;
  date: string;
  claimType: 'missing_item' | 'damaged' | 'wrong_delivery' | 'rto_recovery';
  amountClaimed: number;
  amountApproved: number;
  status: ClaimStatus;
  notes: string;
}

export interface MMAdCampaign {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  status: AdStatus;
  budget: number;
  spend: number;
  impressions: number;
  clicks: number;
  orders: number;
  revenue: number;
  sku?: string;
}

export interface MMPaymentCycle {
  id: string;
  cycleDate: string;      // settlement date
  fromDate: string;
  toDate: string;
  grossAmount: number;
  platformFees: number;
  tds: number;
  shippingDeductions: number;
  returnDeductions: number;
  netAmount: number;
  status: PaymentStatus;
  utr?: string;
}

export interface MMSettings {
  cogsMap: Record<string, number>;  // sku -> cost
  platformFeeRate: number;          // default %
  defaultShippingCost: number;
}

export interface MetricsResult {
  revenue: number;
  grossProfit: number;
  netProfit: number;
  totalOrders: number;
  deliveredOrders: number;
  pendingOrders: number;
  returns: number;
  rto: number;
  adsSpend: number;
  platformFees: number;
  shippingCharges: number;
  claimRecovery: number;
  netReceivable: number;
  returnRate: number;
  rtoRate: number;
  roas: number;
}

export interface CourierStats {
  courier: CourierName;
  total: number;
  delivered: number;
  failed: number;
  rto: number;
  returned: number;
  successRate: number;
  avgDeliveryDays: number;
  totalCost: number;
  financialLoss: number;
}

export interface SkuStats {
  sku: string;
  productName: string;
  revenue: number;
  orders: number;
  returns: number;
  rto: number;
  adsCost: number;
  shippingCost: number;
  platformFees: number;
  cogs: number;
  netProfit: number;
  returnRate: number;
  rtoRate: number;
  healthScore: number;
}

export const STATUS_META = {
  packed: { label: "Packed", bg: "rgba(59,130,246,0.1)", color: "#3b82f6", border: "rgba(59,130,246,0.25)" },
  shipped: { label: "Shipped", bg: "rgba(99,102,241,0.1)", color: "#6366f1", border: "rgba(99,102,241,0.25)" },
  delivered: { label: "Delivered", bg: "rgba(16,185,129,0.1)", color: "#10b981", border: "rgba(16,185,129,0.25)" },
  cancelled: { label: "Cancelled", bg: "rgba(107,114,128,0.1)", color: "#6b7280", border: "rgba(107,114,128,0.25)" },
  rto: { label: "RTO", bg: "rgba(239,68,68,0.1)", color: "#ef4444", border: "rgba(239,68,68,0.25)" },
  returned: { label: "Returned", bg: "rgba(249,115,22,0.1)", color: "#f97316", border: "rgba(249,115,22,0.25)" },
};

export const RETURN_REASONS = {
  size_issue: "Size Issue",
  quality_issue: "Quality Issue",
  wrong_product: "Wrong Product Received",
  damaged: "Damaged Product",
  not_needed: "No Longer Needed",
  other: "Other Reason",
};

export interface MMInventoryItem {
  sku: string;
  productName: string;
  currentStock: number;
  reservedStock: number;
  availableStock: number;
  avgDailySales: number;
  daysRemaining: number;
  suggestedReorderDate?: string;
  health: 'healthy' | 'low_stock' | 'out_of_stock';
}

export interface ImportRecord {
  id: string;
  fileName: string;
  type: 'orders' | 'returns' | 'payments' | 'ads' | 'claims' | 'inventory';
  importedRows: number;
  failedRows: number;
  duplicateRows: number;
  importDate: string;
}

export interface MMNotification {
  id: string;
  timestamp: string;
  type: 'critical' | 'warning' | 'opportunity' | 'info';
  message: string;
  read: boolean;
}

export interface BSSnapshot {
  date: string; // YYYY-MM-DD
  revenue: number;
  profit: number;
  orders: number;
  delivered: number;
  returns: number;
  rto: number;
  adsSpend: number;
  shipping: number;
  fees: number;
  claims: number;
  settlement: number;
  inventoryValue: number;
}

