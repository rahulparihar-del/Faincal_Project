import { StorageProvider, LocalStorageProvider } from "./storage";
import {
  MMOrder,
  MMReturn,
  MMClaim,
  MMAdCampaign,
  MMPaymentCycle,
  MMSettings,
  MMInventoryItem,
  ImportRecord,
  MMNotification,
  BSSnapshot
} from "@/components/meesho/types";

// Legacy Seed Data
const SEED_ORDERS: MMOrder[] = [
  { id: "o1", date: "2026-06-25", orderNo: "ME209384", sku: "SKU001", productName: "Fitted Cotton T-Shirt", qty: 2, sellingPrice: 598, costOfGoods: 220, platformFee: 60, shippingCharge: 80, adSpend: 30, status: "delivered", courier: "Xpressbees", city: "Mumbai", state: "Maharashtra", paymentType: "prepaid", deliveryDays: 3 },
  { id: "o2", date: "2026-06-26", orderNo: "ME209385", sku: "SKU002", productName: "Slim Fit Jeans", qty: 1, sellingPrice: 899, costOfGoods: 350, platformFee: 90, shippingCharge: 95, adSpend: 50, status: "delivered", courier: "Delhivery", city: "Delhi", state: "Delhi", paymentType: "cod", deliveryDays: 4 },
  { id: "o3", date: "2026-06-26", orderNo: "ME209386", sku: "SKU001", productName: "Fitted Cotton T-Shirt", qty: 1, sellingPrice: 299, costOfGoods: 110, platformFee: 30, shippingCharge: 80, adSpend: 15, status: "rto", courier: "Shadowfax", city: "Bengaluru", state: "Karnataka", paymentType: "cod", rtoAttempts: 2 },
  { id: "o4", date: "2026-06-27", orderNo: "ME209387", sku: "SKU003", productName: "Casual Canvas Sneakers", qty: 1, sellingPrice: 499, costOfGoods: 180, platformFee: 50, shippingCharge: 85, adSpend: 40, status: "packed", courier: "Ekart", city: "Hyderabad", state: "Telangana", paymentType: "prepaid" },
  { id: "o5", date: "2026-06-27", orderNo: "ME209388", sku: "SKU002", productName: "Slim Fit Jeans", qty: 1, sellingPrice: 899, costOfGoods: 350, platformFee: 90, shippingCharge: 95, adSpend: 50, status: "returned", courier: "Xpressbees", city: "Pune", state: "Maharashtra", paymentType: "cod", returnReason: "size_issue", deliveryDays: 3 },
  { id: "o6", date: "2026-06-20", orderNo: "ME209370", sku: "SKU001", productName: "Fitted Cotton T-Shirt", qty: 3, sellingPrice: 897, costOfGoods: 330, platformFee: 90, shippingCharge: 80, adSpend: 45, status: "delivered", courier: "Bluedart", city: "Chennai", state: "Tamil Nadu", paymentType: "prepaid", deliveryDays: 2 },
  { id: "o7", date: "2026-06-21", orderNo: "ME209371", sku: "SKU003", productName: "Casual Canvas Sneakers", qty: 2, sellingPrice: 998, costOfGoods: 360, platformFee: 100, shippingCharge: 90, adSpend: 80, status: "delivered", courier: "Valmo", city: "Ahmedabad", state: "Gujarat", paymentType: "cod", deliveryDays: 5 },
  { id: "o8", date: "2026-06-22", orderNo: "ME209372", sku: "SKU001", productName: "Fitted Cotton T-Shirt", qty: 1, sellingPrice: 299, costOfGoods: 110, platformFee: 30, shippingCharge: 80, adSpend: 15, status: "shipped", courier: "Xpressbees", city: "Kolkata", state: "West Bengal", paymentType: "prepaid" },
  { id: "o9", date: "2026-06-23", orderNo: "ME209373", sku: "SKU002", productName: "Slim Fit Jeans", qty: 1, sellingPrice: 899, costOfGoods: 350, platformFee: 90, shippingCharge: 95, adSpend: 50, status: "cancelled", courier: "Delhivery", city: "Jaipur", state: "Rajasthan", paymentType: "cod" },
  { id: "o10", date: "2026-06-24", orderNo: "ME209374", sku: "SKU003", productName: "Casual Canvas Sneakers", qty: 1, sellingPrice: 499, costOfGoods: 180, platformFee: 50, shippingCharge: 85, adSpend: 40, status: "rto", courier: "Shadowfax", city: "Lucknow", state: "Uttar Pradesh", paymentType: "cod", rtoAttempts: 3 },
  { id: "o11", date: "2026-06-15", orderNo: "ME209350", sku: "SKU001", productName: "Fitted Cotton T-Shirt", qty: 2, sellingPrice: 598, costOfGoods: 220, platformFee: 60, shippingCharge: 80, adSpend: 30, status: "delivered", courier: "Ekart", city: "Patna", state: "Bihar", paymentType: "prepaid", deliveryDays: 4 },
  { id: "o12", date: "2026-06-16", orderNo: "ME209351", sku: "SKU002", productName: "Slim Fit Jeans", qty: 2, sellingPrice: 1798, costOfGoods: 700, platformFee: 180, shippingCharge: 100, adSpend: 100, status: "delivered", courier: "Delhivery", city: "Bhopal", state: "Madhya Pradesh", paymentType: "cod", deliveryDays: 3 },
  { id: "o13", date: "2026-06-17", orderNo: "ME209352", sku: "SKU003", productName: "Casual Canvas Sneakers", qty: 1, sellingPrice: 499, costOfGoods: 180, platformFee: 50, shippingCharge: 85, adSpend: 40, status: "returned", courier: "Xpressbees", city: "Surat", state: "Gujarat", paymentType: "prepaid", returnReason: "quality_issue", deliveryDays: 4 },
  { id: "o14", date: "2026-06-18", orderNo: "ME209353", sku: "SKU001", productName: "Fitted Cotton T-Shirt", qty: 1, sellingPrice: 299, costOfGoods: 110, platformFee: 30, shippingCharge: 80, adSpend: 15, status: "delivered", courier: "Bluedart", city: "Chandigarh", state: "Punjab", paymentType: "prepaid", deliveryDays: 2 },
  { id: "o15", date: "2026-06-19", orderNo: "ME209354", sku: "SKU002", productName: "Slim Fit Jeans", qty: 1, sellingPrice: 899, costOfGoods: 350, platformFee: 90, shippingCharge: 95, adSpend: 50, status: "delivered", courier: "Xpressbees", city: "Indore", state: "Madhya Pradesh", paymentType: "cod", deliveryDays: 5 }
];

const SEED_RETURNS: MMReturn[] = [
  { id: "r1", orderId: "o3", date: "2026-06-28", sku: "SKU001", productName: "Fitted Cotton T-Shirt", reason: "other", courier: "Shadowfax", returnShippingCharge: 60, isRTO: true, rtoAttempts: 2, recoveryStatus: "recovered", financialLoss: 60, city: "Bengaluru" },
  { id: "r2", orderId: "o5", date: "2026-06-29", sku: "SKU002", productName: "Slim Fit Jeans", reason: "size_issue", courier: "Xpressbees", returnShippingCharge: 70, isRTO: false, rtoAttempts: 0, recoveryStatus: "pending", financialLoss: 420, city: "Pune" },
  { id: "r3", orderId: "o10", date: "2026-06-26", sku: "SKU003", productName: "Casual Canvas Sneakers", reason: "other", courier: "Shadowfax", returnShippingCharge: 60, isRTO: true, rtoAttempts: 3, recoveryStatus: "lost", financialLoss: 240, city: "Lucknow" },
  { id: "r4", orderId: "o13", date: "2026-06-20", sku: "SKU003", productName: "Casual Canvas Sneakers", reason: "quality_issue", courier: "Xpressbees", returnShippingCharge: 70, isRTO: false, rtoAttempts: 0, recoveryStatus: "recovered", financialLoss: 70, city: "Surat" }
];

const SEED_CLAIMS: MMClaim[] = [
  { id: "c1", orderId: "o10", date: "2026-06-27", claimType: "rto_recovery", amountClaimed: 240, amountApproved: 180, status: "approved", notes: "Product was damaged during RTO process, claim approved partially." },
  { id: "c2", orderId: "o5", date: "2026-06-29", claimType: "damaged", amountClaimed: 350, amountApproved: 0, status: "pending", notes: "Customer returned empty box, claim submitted." }
];

const SEED_CAMPAIGNS: MMAdCampaign[] = [
  { id: "ad1", name: "T-Shirt Monsoon Sale", startDate: "2026-06-01", endDate: "2026-06-30", status: "active", budget: 5000, spend: 3200, impressions: 45000, clicks: 3200, orders: 120, revenue: 35880, sku: "SKU001" },
  { id: "ad2", name: "Jeans Smart Choice", startDate: "2026-06-10", endDate: "2026-06-25", status: "ended", budget: 3000, spend: 3000, impressions: 22000, clicks: 1800, orders: 45, revenue: 40455, sku: "SKU002" },
  { id: "ad3", name: "Sneakers Launch", startDate: "2026-06-15", endDate: "2026-07-15", status: "active", budget: 8000, spend: 4500, impressions: 60000, clicks: 5100, orders: 75, revenue: 37425, sku: "SKU003" },
  { id: "ad4", name: "All Products Boost", startDate: "2026-06-01", endDate: "2026-06-15", status: "ended", budget: 2000, spend: 2000, impressions: 18000, clicks: 1200, orders: 20, revenue: 8900 }
];

const SEED_PAYMENTS: MMPaymentCycle[] = [
  { id: "p1", cycleDate: "2026-06-10", fromDate: "2026-06-01", toDate: "2026-06-07", grossAmount: 18450, platformFees: 1845, tds: 184, shippingDeductions: 1450, returnDeductions: 480, netAmount: 14491, status: "settled", utr: "UTR9238479234" },
  { id: "p2", cycleDate: "2026-06-20", fromDate: "2026-06-08", toDate: "2026-06-15", grossAmount: 22890, platformFees: 2289, tds: 228, shippingDeductions: 1980, returnDeductions: 720, netAmount: 17673, status: "settled", utr: "UTR9238479255" },
  { id: "p3", cycleDate: "2026-07-02", fromDate: "2026-06-16", toDate: "2026-06-30", grossAmount: 15400, platformFees: 1540, tds: 154, shippingDeductions: 1220, returnDeductions: 350, netAmount: 12136, status: "processing" }
];

const DEFAULT_SETTINGS: MMSettings = {
  cogsMap: {
    SKU001: 110,
    SKU002: 350,
    SKU003: 180
  },
  platformFeeRate: 10,
  defaultShippingCost: 80
};

const SEED_INVENTORY: MMInventoryItem[] = [
  { sku: "SKU001", productName: "Fitted Cotton T-Shirt", currentStock: 125, reservedStock: 15, availableStock: 110, avgDailySales: 5.5, daysRemaining: 20, health: "healthy" },
  { sku: "SKU002", productName: "Slim Fit Jeans", currentStock: 45, reservedStock: 5, availableStock: 40, avgDailySales: 1.8, daysRemaining: 22, health: "healthy" },
  { sku: "SKU003", productName: "Casual Canvas Sneakers", currentStock: 12, reservedStock: 4, availableStock: 8, avgDailySales: 2.2, daysRemaining: 3.6, health: "low_stock" }
];

const SEED_NOTIFICATIONS: MMNotification[] = [
  { id: "n1", timestamp: "2026-06-29T10:15:00.000Z", type: "warning", message: "Casual Canvas Sneakers (SKU003) is running low on stock. 3.6 days remaining.", read: false },
  { id: "n2", timestamp: "2026-06-29T11:20:00.000Z", type: "critical", message: "Campaign 'Jeans Smart Choice' exceeded its budget by ₹300.", read: false },
  { id: "n3", timestamp: "2026-06-29T12:05:00.000Z", type: "info", message: "Claim for Order #ME209374 approved for ₹180.", read: false }
];

export class DataRepository {
  private provider: StorageProvider;
  private isLoaded: boolean = false;

  private orders: MMOrder[] = [];
  private returns: MMReturn[] = [];
  private claims: MMClaim[] = [];
  private ads: MMAdCampaign[] = [];
  private payments: MMPaymentCycle[] = [];
  private settings: MMSettings = DEFAULT_SETTINGS;
  private inventory: MMInventoryItem[] = [];
  private notifications: MMNotification[] = [];
  private imports: ImportRecord[] = [];
  private snapshots: BSSnapshot[] = [];
  private syncStatus: Record<string, number> = {};

  constructor(provider?: StorageProvider) {
    this.provider = provider || new LocalStorageProvider();
  }

  async init(): Promise<void> {
    if (this.isLoaded) return;

    const ordersStr = await this.provider.getItem("biztrack_mm_orders");
    const returnsStr = await this.provider.getItem("biztrack_mm_returns");
    const claimsStr = await this.provider.getItem("biztrack_mm_claims");
    const adsStr = await this.provider.getItem("biztrack_mm_ads");
    const paymentsStr = await this.provider.getItem("biztrack_mm_payments");
    const settingsStr = await this.provider.getItem("biztrack_mm_settings");
    const inventoryStr = await this.provider.getItem("biztrack_mm_inventory");
    const notificationsStr = await this.provider.getItem("biztrack_mm_notifications");
    const importsStr = await this.provider.getItem("biztrack_mm_imports");
    const snapshotsStr = await this.provider.getItem("biztrack_mm_snapshots");
    const syncStatusStr = await this.provider.getItem("biztrack_mm_sync_status");

    // Orders
    if (ordersStr) {
      this.orders = JSON.parse(ordersStr);
    } else {
      this.orders = SEED_ORDERS;
      await this.provider.setItem("biztrack_mm_orders", JSON.stringify(SEED_ORDERS));
      this.syncStatus["orders"] = Date.now() - 3600000; // 1 hour ago
    }

    // Returns
    if (returnsStr) {
      this.returns = JSON.parse(returnsStr);
    } else {
      this.returns = SEED_RETURNS;
      await this.provider.setItem("biztrack_mm_returns", JSON.stringify(SEED_RETURNS));
      this.syncStatus["returns"] = Date.now() - 7200000; // 2 hours ago
    }

    // Claims
    if (claimsStr) {
      this.claims = JSON.parse(claimsStr);
    } else {
      this.claims = SEED_CLAIMS;
      await this.provider.setItem("biztrack_mm_claims", JSON.stringify(SEED_CLAIMS));
      this.syncStatus["claims"] = Date.now() - 10800000; // 3 hours ago
    }

    // Ads
    if (adsStr) {
      this.ads = JSON.parse(adsStr);
    } else {
      this.ads = SEED_CAMPAIGNS;
      await this.provider.setItem("biztrack_mm_ads", JSON.stringify(SEED_CAMPAIGNS));
      this.syncStatus["ads"] = Date.now() - 14400000; // 4 hours ago
    }

    // Payments
    if (paymentsStr) {
      this.payments = JSON.parse(paymentsStr);
    } else {
      this.payments = SEED_PAYMENTS;
      await this.provider.setItem("biztrack_mm_payments", JSON.stringify(SEED_PAYMENTS));
      this.syncStatus["payments"] = Date.now() - 86400000; // 1 day ago
    }

    // Settings
    if (settingsStr) {
      this.settings = JSON.parse(settingsStr);
    } else {
      this.settings = DEFAULT_SETTINGS;
      await this.provider.setItem("biztrack_mm_settings", JSON.stringify(DEFAULT_SETTINGS));
    }

    // Inventory
    if (inventoryStr) {
      this.inventory = JSON.parse(inventoryStr);
    } else {
      this.inventory = SEED_INVENTORY;
      await this.provider.setItem("biztrack_mm_inventory", JSON.stringify(SEED_INVENTORY));
      this.syncStatus["inventory"] = Date.now() - 600000; // 10 minutes ago
    }

    // Notifications
    if (notificationsStr) {
      this.notifications = JSON.parse(notificationsStr);
    } else {
      this.notifications = SEED_NOTIFICATIONS;
      await this.provider.setItem("biztrack_mm_notifications", JSON.stringify(SEED_NOTIFICATIONS));
    }

    // Imports
    if (importsStr) {
      this.imports = JSON.parse(importsStr);
    } else {
      this.imports = [];
    }

    // Snapshots
    if (snapshotsStr) {
      this.snapshots = JSON.parse(snapshotsStr);
    } else {
      // Auto generate some mock snapshots for the past 7 days to power analytics
      this.snapshots = this.generateInitialSnapshots();
      await this.provider.setItem("biztrack_mm_snapshots", JSON.stringify(this.snapshots));
    }

    // Sync Status
    if (syncStatusStr) {
      this.syncStatus = JSON.parse(syncStatusStr);
    } else {
      await this.provider.setItem("biztrack_mm_sync_status", JSON.stringify(this.syncStatus));
    }

    this.isLoaded = true;
    this.runStockHealthCheck();
  }

  // Getters
  getOrders(): MMOrder[] { return this.orders; }
  getReturns(): MMReturn[] { return this.returns; }
  getClaims(): MMClaim[] { return this.claims; }
  getAdCampaigns(): MMAdCampaign[] { return this.ads; }
  getPaymentCycles(): MMPaymentCycle[] { return this.payments; }
  getSettings(): MMSettings { return this.settings; }
  getInventory(): MMInventoryItem[] { return this.inventory; }
  getNotifications(): MMNotification[] { return this.notifications; }
  getImportHistory(): ImportRecord[] { return this.imports; }
  getSnapshots(): BSSnapshot[] { return this.snapshots; }
  getSyncStatus(): Record<string, number> { return this.syncStatus; }

  // Setters with auto-save & sync updates
  async saveOrders(orders: MMOrder[]): Promise<void> {
    this.orders = orders;
    await this.provider.setItem("biztrack_mm_orders", JSON.stringify(orders));
    await this.updateSyncTime("orders");
    this.runStockHealthCheck();
  }

  async saveReturns(returns: MMReturn[]): Promise<void> {
    this.returns = returns;
    await this.provider.setItem("biztrack_mm_returns", JSON.stringify(returns));
    await this.updateSyncTime("returns");
  }

  async saveClaims(claims: MMClaim[]): Promise<void> {
    this.claims = claims;
    await this.provider.setItem("biztrack_mm_claims", JSON.stringify(claims));
    await this.updateSyncTime("claims");
  }

  async saveAdCampaigns(ads: MMAdCampaign[]): Promise<void> {
    this.ads = ads;
    await this.provider.setItem("biztrack_mm_ads", JSON.stringify(ads));
    await this.updateSyncTime("ads");
  }

  async savePaymentCycles(payments: MMPaymentCycle[]): Promise<void> {
    this.payments = payments;
    await this.provider.setItem("biztrack_mm_payments", JSON.stringify(payments));
    await this.updateSyncTime("payments");
  }

  async saveSettings(settings: MMSettings): Promise<void> {
    this.settings = settings;
    await this.provider.setItem("biztrack_mm_settings", JSON.stringify(settings));
  }

  async saveInventory(inventory: MMInventoryItem[]): Promise<void> {
    this.inventory = inventory;
    await this.provider.setItem("biztrack_mm_inventory", JSON.stringify(inventory));
    await this.updateSyncTime("inventory");
    this.runStockHealthCheck();
  }

  async saveNotifications(notifications: MMNotification[]): Promise<void> {
    this.notifications = notifications;
    await this.provider.setItem("biztrack_mm_notifications", JSON.stringify(notifications));
  }

  async saveImportHistory(imports: ImportRecord[]): Promise<void> {
    this.imports = imports;
    await this.provider.setItem("biztrack_mm_imports", JSON.stringify(imports));
  }

  async saveSnapshots(snapshots: BSSnapshot[]): Promise<void> {
    this.snapshots = snapshots;
    await this.provider.setItem("biztrack_mm_snapshots", JSON.stringify(snapshots));
  }

  // Helper to record sync status
  private async updateSyncTime(key: string): Promise<void> {
    this.syncStatus[key] = Date.now();
    await this.provider.setItem("biztrack_mm_sync_status", JSON.stringify(this.syncStatus));
  }

  // Push new notification
  async addNotification(type: MMNotification['type'], message: string): Promise<void> {
    const newNotif: MMNotification = {
      id: "n_" + Date.now() + Math.random().toString(36).substr(2, 4),
      timestamp: new Date().toISOString(),
      type,
      message,
      read: false
    };
    this.notifications = [newNotif, ...this.notifications];
    await this.saveNotifications(this.notifications);
  }

  // Generate Daily snapshot
  async createDailySnapshot(dateStr: string): Promise<void> {
    // Check if snapshot for this date already exists
    if (this.snapshots.some(s => s.date === dateStr)) {
      // Update existing
      this.snapshots = this.snapshots.filter(s => s.date !== dateStr);
    }

    const dayOrders = this.orders.filter(o => o.date === dateStr);
    const dayReturns = this.returns.filter(r => r.date === dateStr);
    const dayClaims = this.claims.filter(c => c.date === dateStr);
    const dayPayments = this.payments.filter(p => p.cycleDate === dateStr);

    const revenue = dayOrders
      .filter(o => o.status !== "rto" && o.status !== "cancelled" && o.status !== "returned")
      .reduce((sum, o) => sum + o.sellingPrice, 0);

    const cogs = dayOrders.reduce((sum, o) => sum + o.costOfGoods, 0);
    const fees = dayOrders.reduce((sum, o) => sum + o.platformFee, 0);
    const shipping = dayOrders.reduce((sum, o) => sum + o.shippingCharge, 0);
    const adsSpend = dayOrders.reduce((sum, o) => sum + o.adSpend, 0);

    const returnCharges = dayReturns.filter(r => !r.isRTO).reduce((sum, r) => sum + r.returnShippingCharge, 0);
    const rtoLoss = dayReturns.filter(r => r.isRTO).reduce((sum, r) => sum + r.financialLoss, 0);
    const claimsVal = dayClaims.filter(c => c.status === "approved").reduce((sum, c) => sum + c.amountApproved, 0);
    const settlementVal = dayPayments.reduce((sum, p) => sum + p.netAmount, 0);

    const profit = revenue - cogs - fees - shipping - adsSpend - returnCharges - rtoLoss + claimsVal;

    // Inventory valuation
    const cogsMap = this.settings.cogsMap;
    const inventoryVal = this.inventory.reduce((sum, item) => {
      const unitCost = cogsMap[item.sku] || 0;
      return sum + (item.currentStock * unitCost);
    }, 0);

    const newSnapshot: BSSnapshot = {
      date: dateStr,
      revenue,
      profit,
      orders: dayOrders.length,
      delivered: dayOrders.filter(o => o.status === "delivered").length,
      returns: dayReturns.filter(r => !r.isRTO).length,
      rto: dayReturns.filter(r => r.isRTO).length,
      adsSpend,
      shipping,
      fees,
      claims: claimsVal,
      settlement: settlementVal,
      inventoryValue: inventoryVal
    };

    this.snapshots = [newSnapshot, ...this.snapshots].sort((a, b) => b.date.localeCompare(a.date));
    await this.saveSnapshots(this.snapshots);
  }

  // Stock health monitoring check
  private runStockHealthCheck() {
    let changed = false;
    const nextInventory = this.inventory.map(item => {
      // Calculate avg daily sales from last 30 days
      const daysBack = 30;
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - daysBack);
      const cutoffStr = cutoffDate.toISOString().split("T")[0];

      const skuOrders = this.orders.filter(o => o.sku === item.sku && o.date >= cutoffStr);
      const totalQty = skuOrders.reduce((sum, o) => sum + o.qty, 0);
      const avgSales = Math.max(0.1, totalQty / daysBack); // minimum 0.1 to avoid divide by zero

      const available = Math.max(0, item.currentStock - item.reservedStock);
      const daysRem = available / avgSales;

      let health: MMInventoryItem['health'] = "healthy";
      if (available <= 0) {
        health = "out_of_stock";
      } else if (daysRem < 7) {
        health = "low_stock";
      }

      // Check if alert notification should be fired
      if (health !== item.health) {
        changed = true;
        if (health === "out_of_stock") {
          this.addNotification("critical", `Out of Stock Alert: ${item.productName} (${item.sku}) is out of stock!`);
        } else if (health === "low_stock") {
          this.addNotification("warning", `Low Stock Alert: ${item.productName} (${item.sku}) has only ${daysRem.toFixed(1)} days of stock remaining.`);
        }
      }

      return {
        ...item,
        availableStock: available,
        avgDailySales: Number(avgSales.toFixed(2)),
        daysRemaining: Number(daysRem.toFixed(1)),
        health,
        suggestedReorderDate: daysRem < 7 ? this.calculateReorderDate(daysRem) : undefined
      };
    });

    if (changed || JSON.stringify(nextInventory) !== JSON.stringify(this.inventory)) {
      this.inventory = nextInventory;
      this.provider.setItem("biztrack_mm_inventory", JSON.stringify(this.inventory));
    }
  }

  private calculateReorderDate(daysRemaining: number): string {
    const today = new Date();
    // Lead time is 3 days
    const leadTime = 3;
    const daysToReorder = Math.max(0, daysRemaining - leadTime);
    today.setDate(today.getDate() + daysToReorder);
    return today.toISOString().split("T")[0];
  }

  private generateInitialSnapshots(): BSSnapshot[] {
    const snapshots: BSSnapshot[] = [];
    const date = new Date("2026-06-23");
    for (let i = 0; i < 7; i++) {
      const dateStr = date.toISOString().split("T")[0];
      // Generate randomized mock values consistent with seed orders
      const orders = i % 2 === 0 ? 3 : 2;
      const revenue = orders * 350;
      const profit = revenue * 0.35;
      snapshots.push({
        date: dateStr,
        revenue,
        profit,
        orders,
        delivered: orders - (i % 3 === 0 ? 1 : 0),
        returns: i % 4 === 0 ? 1 : 0,
        rto: i % 5 === 0 ? 1 : 0,
        adsSpend: orders * 40,
        shipping: orders * 80,
        fees: orders * 35,
        claims: i % 6 === 0 ? 150 : 0,
        settlement: i % 7 === 0 ? 12000 : 0,
        inventoryValue: 24500 - (i * 200)
      });
      date.setDate(date.getDate() + 1);
    }
    return snapshots.reverse();
  }
}

// Global shared repository instance using LocalStorageProvider
export const repository = new DataRepository();
