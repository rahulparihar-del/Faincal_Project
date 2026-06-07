export type Platform = "Amazon" | "Flipkart" | "Meesho" | "Other";
export type PaymentMode = "Cash" | "UPI" | "Bank Transfer";
export type OrderType = "Sample" | "Bulk";
export type PaymentStatus = "Paid" | "Partial" | "Pending";
export type ShipmentStatus = "Ordered" | "Shipped" | "Delivered";
export type TransactionType = "Credit" | "Debit";
export type AccountType = "IDFC Current" | "IDFC Savings";
export type Category = "Business Income" | "Manufacturer Payment" | "Ad Spend" | "Platform Payout" | "Wholesale Collection" | "Personal" | "Household" | "Transfer" | "Other";

export type ExpenseCategory =
  | "Equipment & Electronics"
  | "Packaging & Supplies"
  | "Office & Furniture"
  | "Marketing & Advertising"
  | "Shipping & Logistics"
  | "Software & Subscriptions"
  | "Utilities & Internet"
  | "Repairs & Maintenance"
  | "Other Business Expense";

export interface BusinessExpense {
  id: string;
  date: string;
  category: ExpenseCategory;
  itemName: string;
  quantity: number;
  unitCost: number;
  vendor: string;
  paymentMode: PaymentMode;
  notes: string;
  /** GST percentage applied (e.g. 5 for 5%). 0 = no GST */
  gstPercent: number;
  /** Pre-computed GST amount */
  gstAmount: number;
  /** For packaging: which platform is this for (optional) */
  platform?: string;
}

export interface EcomSale {
  id: string;
  date: string;
  platform: Platform;
  orderId: string;
  productName: string;
  sellingPrice: number;
  commissionPercent: number;
  adSpend: number;
  isRTO: boolean;
  rtoLossAmount: number;
  netPayout: number;
}

export interface WholesaleItem {
  productName: string;
  qty: number;
  rate: number;
}

export interface WholesaleSale {
  id: string;
  date: string;            // Bill Date (YYYY-MM-DD)
  billNo: string;          // Bill No
  retailerName: string;    // Shop Name
  phone: string;
  city: string;
  billAmount: number;      // Bill Amount
  receivedDate: string;    // Received Date (YYYY-MM-DD), "" if unpaid
  paymentReceived: number; // Received Amount
  paymentMode: PaymentMode;
  items?: WholesaleItem[];  // legacy line-items (optional, kept for back-compat)
}

export interface Manufacturer {
  id: string;
  name: string;
  city: string;
  phone: string;
  productsSupplied: string;
  notes: string;
}

export interface PurchaseItem {
  productName: string;
  qty: number;
  rate: number;
}

export interface PurchaseOrder {
  id: string;
  date: string;
  manufacturerId: string;
  orderType: OrderType;
  /** Multi-item line items (preferred). If present, use this for display & totals. */
  items?: PurchaseItem[];
  /** Legacy single-item fields — kept for backward compat with old saved orders */
  productName: string;
  qty: number;
  rate: number;
  /** GST percentage applied (e.g. 5 for 5%). 0 = no GST */
  gstPercent: number;
  /** Pre-computed GST amount = itemsSubtotal * gstPercent / 100 (NOT on transport) */
  gstAmount: number;
  /** Transport / freight charges added AFTER GST (not taxable) */
  transport: number;
  /** Rounding adjustment (can be negative or positive) */
  roundingAmount: number;
  /** Manufacturer bill PDF stored as base64 data URL */
  billPdf?: string;
  /** Original filename of the uploaded PDF */
  billPdfName?: string;
  paymentStatus: PaymentStatus;
  paymentDate: string;
  shipmentStatus: ShipmentStatus;
  expectedDelivery: string;
  actualReceiptDate: string;
  notes: string;
  gst?: string;
}

export interface Transaction {
  id: string;
  date: string;
  account: AccountType;
  type: TransactionType;
  amount: number;
  category: Category;
  description: string;
  utr: string;
}

export interface MeeshoOrder {
  id: string;
  date: string;            // YYYY-MM-DD (packing date)
  scannedAt: string;       // ISO timestamp
  orderNo: string;         // Meesho order number
  invoiceNo: string;       // Tax invoice number
  customerName: string;
  customerAddress: string;
  customerCity: string;
  customerPincode: string;
  sku: string;
  productName: string;
  size: string;
  color: string;
  qty: number;
  grossAmount: number;     // MRP / selling price before discount
  discount: number;        // Discount applied
  tax: number;             // GST / IGST amount
  sellingPrice: number;    // Final amount paid by customer
  paymentType: "Prepaid" | "COD"; // Prepaid or Cash on Delivery
  courier: string;
  status: "Packed" | "Shipped" | "RTO";
  notes: string;
}
