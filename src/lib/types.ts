export type Platform = "Amazon" | "Flipkart" | "Meesho" | "Other";
export type PaymentMode = "Cash" | "UPI" | "Bank Transfer";
export type OrderType = "Sample" | "Bulk";
export type PaymentStatus = "Paid" | "Partial" | "Pending";
export type ShipmentStatus = "Ordered" | "Shipped" | "Delivered";
export type TransactionType = "Credit" | "Debit";
export type AccountType = "IDFC Current" | "IDFC Savings";
export type Category = "Business Income" | "Manufacturer Payment" | "Ad Spend" | "Platform Payout" | "Wholesale Collection" | "Personal" | "Household" | "Transfer" | "Other";

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

export interface PurchaseOrder {
  id: string;
  date: string;
  manufacturerId: string;
  orderType: OrderType;
  productName: string;
  qty: number;
  rate: number;
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
