"use client";

import { useState, useEffect, useCallback } from "react";
import { MMOrder, MMReturn, MMClaim, MMAdCampaign, MMPaymentCycle, MMSettings, DateFilter } from "./types";

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

export function filterByDate<T extends { date: string }>(items: T[], filter: DateFilter): T[] {
  const fromTime = filter.from ? new Date(filter.from + "T00:00:00").getTime() : 0;
  const toTime = filter.to ? new Date(filter.to + "T23:59:59").getTime() : Infinity;

  return items.filter((item) => {
    if (!item.date) return false;
    const itemTime = new Date(item.date + "T12:00:00").getTime();
    return itemTime >= fromTime && itemTime <= toTime;
  });
}

export function useMMData() {
  const [orders, setOrdersState] = useState<MMOrder[]>([]);
  const [returns, setReturnsState] = useState<MMReturn[]>([]);
  const [claims, setClaimsState] = useState<MMClaim[]>([]);
  const [adCampaigns, setAdCampaignsState] = useState<MMAdCampaign[]>([]);
  const [paymentCycles, setPaymentCyclesState] = useState<MMPaymentCycle[]>([]);
  const [settings, setSettingsState] = useState<MMSettings>(DEFAULT_SETTINGS);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    // Initial fetch from LocalStorage or seed defaults
    const localOrders = localStorage.getItem("biztrack_mm_orders");
    const localReturns = localStorage.getItem("biztrack_mm_returns");
    const localClaims = localStorage.getItem("biztrack_mm_claims");
    const localAds = localStorage.getItem("biztrack_mm_ads");
    const localPayments = localStorage.getItem("biztrack_mm_payments");
    const localSettings = localStorage.getItem("biztrack_mm_settings");

    if (localOrders) setOrdersState(JSON.parse(localOrders));
    else {
      setOrdersState(SEED_ORDERS);
      localStorage.setItem("biztrack_mm_orders", JSON.stringify(SEED_ORDERS));
    }

    if (localReturns) setReturnsState(JSON.parse(localReturns));
    else {
      setReturnsState(SEED_RETURNS);
      localStorage.setItem("biztrack_mm_returns", JSON.stringify(SEED_RETURNS));
    }

    if (localClaims) setClaimsState(JSON.parse(localClaims));
    else {
      setClaimsState(SEED_CLAIMS);
      localStorage.setItem("biztrack_mm_claims", JSON.stringify(SEED_CLAIMS));
    }

    if (localAds) setAdCampaignsState(JSON.parse(localAds));
    else {
      setAdCampaignsState(SEED_CAMPAIGNS);
      localStorage.setItem("biztrack_mm_ads", JSON.stringify(SEED_CAMPAIGNS));
    }

    if (localPayments) setPaymentCyclesState(JSON.parse(localPayments));
    else {
      setPaymentCyclesState(SEED_PAYMENTS);
      localStorage.setItem("biztrack_mm_payments", JSON.stringify(SEED_PAYMENTS));
    }

    if (localSettings) setSettingsState(JSON.parse(localSettings));
    else {
      setSettingsState(DEFAULT_SETTINGS);
      localStorage.setItem("biztrack_mm_settings", JSON.stringify(DEFAULT_SETTINGS));
    }

    setIsLoaded(true);
  }, []);

  const setOrders = useCallback((data: MMOrder[] | ((prev: MMOrder[]) => MMOrder[])) => {
    setOrdersState((prev) => {
      const next = typeof data === "function" ? data(prev) : data;
      localStorage.setItem("biztrack_mm_orders", JSON.stringify(next));
      return next;
    });
  }, []);

  const setReturns = useCallback((data: MMReturn[] | ((prev: MMReturn[]) => MMReturn[])) => {
    setReturnsState((prev) => {
      const next = typeof data === "function" ? data(prev) : data;
      localStorage.setItem("biztrack_mm_returns", JSON.stringify(next));
      return next;
    });
  }, []);

  const setClaims = useCallback((data: MMClaim[] | ((prev: MMClaim[]) => MMClaim[])) => {
    setClaimsState((prev) => {
      const next = typeof data === "function" ? data(prev) : data;
      localStorage.setItem("biztrack_mm_claims", JSON.stringify(next));
      return next;
    });
  }, []);

  const setAdCampaigns = useCallback((data: MMAdCampaign[] | ((prev: MMAdCampaign[]) => MMAdCampaign[])) => {
    setAdCampaignsState((prev) => {
      const next = typeof data === "function" ? data(prev) : data;
      localStorage.setItem("biztrack_mm_ads", JSON.stringify(next));
      return next;
    });
  }, []);

  const setPaymentCycles = useCallback((data: MMPaymentCycle[] | ((prev: MMPaymentCycle[]) => MMPaymentCycle[])) => {
    setPaymentCyclesState((prev) => {
      const next = typeof data === "function" ? data(prev) : data;
      localStorage.setItem("biztrack_mm_payments", JSON.stringify(next));
      return next;
    });
  }, []);

  const setSettings = useCallback((data: MMSettings | ((prev: MMSettings) => MMSettings)) => {
    setSettingsState((prev) => {
      const next = typeof data === "function" ? data(prev) : data;
      localStorage.setItem("biztrack_mm_settings", JSON.stringify(next));
      return next;
    });
  }, []);

  return {
    orders,
    returns,
    claims,
    adCampaigns,
    paymentCycles,
    settings,
    setOrders,
    setReturns,
    setClaims,
    setAdCampaigns,
    setPaymentCycles,
    setSettings,
    isLoaded
  };
}
