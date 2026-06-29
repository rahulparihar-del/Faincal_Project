"use client";

import React, { useState, useMemo } from "react";
import { motion } from "framer-motion";
import { Plus, Check, Trash2, Save, ShoppingCart, RotateCcw, CreditCard, Megaphone, Shield, Key } from "lucide-react";
import { useMMData } from "@/components/meesho/useMeeshoData";
import { MMOrder, MMReturn, MMClaim, MMAdCampaign, MMPaymentCycle, OrderStatus, CourierName, ReturnReason, ClaimStatus, AdStatus, PaymentStatus } from "@/components/meesho/types";

export default function SettingsPage() {
  const {
    orders, returns, claims, adCampaigns, paymentCycles, settings,
    setOrders, setReturns, setClaims, setAdCampaigns, setPaymentCycles, setSettings, isLoaded
  } = useMMData();

  const [activeTab, setActiveTab] = useState<"orders" | "returns" | "payments" | "ads" | "claims" | "cogs">("orders");

  // Orders Form State
  const [orderForm, setOrderForm] = useState({
    date: new Date().toISOString().split("T")[0],
    orderNo: "",
    sku: "SKU001",
    productName: "Fitted Cotton T-Shirt",
    qty: 1,
    sellingPrice: 299,
    platformFee: 30,
    shippingCharge: 80,
    status: "packed" as OrderStatus,
    courier: "Xpressbees" as CourierName,
    city: "",
    state: "",
    paymentType: "prepaid" as "prepaid" | "cod",
  });

  // Returns Form State
  const [returnForm, setReturnForm] = useState({
    orderId: "",
    date: new Date().toISOString().split("T")[0],
    reason: "size_issue" as ReturnReason,
    courier: "Xpressbees" as CourierName,
    returnShippingCharge: 70,
    isRTO: false,
    rtoAttempts: 0,
    recoveryStatus: "pending" as "pending" | "recovered" | "lost",
    financialLoss: 0,
    city: "",
  });

  // Payments Form State
  const [paymentForm, setPaymentForm] = useState({
    cycleDate: new Date().toISOString().split("T")[0],
    fromDate: "",
    toDate: "",
    grossAmount: 0,
    platformFees: 0,
    tds: 0,
    shippingDeductions: 0,
    returnDeductions: 0,
    status: "pending" as PaymentStatus,
    utr: "",
  });

  // Ads Form State
  const [adForm, setAdForm] = useState({
    name: "",
    startDate: new Date().toISOString().split("T")[0],
    endDate: "",
    status: "active" as AdStatus,
    budget: 1000,
    spend: 0,
    impressions: 0,
    clicks: 0,
    orders: 0,
    revenue: 0,
    sku: "SKU001",
  });

  // Claims Form State
  const [claimForm, setClaimForm] = useState({
    orderId: "",
    date: new Date().toISOString().split("T")[0],
    claimType: "rto_recovery" as "missing_item" | "damaged" | "wrong_delivery" | "rto_recovery",
    amountClaimed: 0,
    amountApproved: 0,
    status: "pending" as ClaimStatus,
    notes: "",
  });

  // COGS State
  const [cogsMap, setCogsMap] = useState<Record<string, number>>({});

  // Initialize COGS State on data load
  React.useEffect(() => {
    if (isLoaded && settings?.cogsMap) {
      setCogsMap(settings.cogsMap);
    }
  }, [isLoaded, settings]);

  const handleAddOrder = (e: React.FormEvent) => {
    e.preventDefault();
    if (!orderForm.orderNo) return;
    const cogs = cogsMap[orderForm.sku] || 0;

    const newOrder: MMOrder = {
      id: "o_" + Date.now(),
      costOfGoods: cogs,
      adSpend: 0,
      ...orderForm,
    };

    setOrders([newOrder, ...orders]);
    setOrderForm((prev) => ({ ...prev, orderNo: "", city: "", state: "" }));
    alert("Order added successfully!");
  };

  const handleAddReturn = (e: React.FormEvent) => {
    e.preventDefault();
    if (!returnForm.orderId) return;

    const order = orders.find((o) => o.id === returnForm.orderId || o.orderNo === returnForm.orderId);
    const resolvedProduct = order?.productName || "Unknown Product";
    const resolvedSku = order?.sku || "SKU001";
    const resolvedCity = order?.city || returnForm.city;

    const newReturn: MMReturn = {
      ...returnForm,
      id: "r_" + Date.now(),
      productName: resolvedProduct,
      sku: resolvedSku,
      city: resolvedCity,
    };

    setReturns([newReturn, ...returns]);
    setReturnForm((prev) => ({ ...prev, orderId: "", city: "" }));
    alert("Return transaction logged!");
  };

  const handleAddPayment = (e: React.FormEvent) => {
    e.preventDefault();
    const netAmount =
      paymentForm.grossAmount -
      paymentForm.platformFees -
      paymentForm.tds -
      paymentForm.shippingDeductions -
      paymentForm.returnDeductions;

    const newCycle: MMPaymentCycle = {
      id: "p_" + Date.now(),
      netAmount,
      ...paymentForm,
    };

    setPaymentCycles([newCycle, ...paymentCycles]);
    setPaymentForm({
      cycleDate: new Date().toISOString().split("T")[0],
      fromDate: "",
      toDate: "",
      grossAmount: 0,
      platformFees: 0,
      tds: 0,
      shippingDeductions: 0,
      returnDeductions: 0,
      status: "pending",
      utr: "",
    });
    alert("Payment cycle logged!");
  };

  const handleAddAd = (e: React.FormEvent) => {
    e.preventDefault();
    if (!adForm.name) return;

    const newCampaign: MMAdCampaign = {
      id: "ad_" + Date.now(),
      ...adForm,
    };

    setAdCampaigns([newCampaign, ...adCampaigns]);
    setAdForm({
      name: "",
      startDate: new Date().toISOString().split("T")[0],
      endDate: "",
      status: "active",
      budget: 1000,
      spend: 0,
      impressions: 0,
      clicks: 0,
      orders: 0,
      revenue: 0,
      sku: "SKU001",
    });
    alert("Ad campaign launched!");
  };

  const handleAddClaim = (e: React.FormEvent) => {
    e.preventDefault();
    if (!claimForm.orderId) return;

    const newClaim: MMClaim = {
      id: "c_" + Date.now(),
      ...claimForm,
    };

    setClaims([newClaim, ...claims]);
    setClaimForm({
      orderId: "",
      date: new Date().toISOString().split("T")[0],
      claimType: "rto_recovery",
      amountClaimed: 0,
      amountApproved: 0,
      status: "pending",
      notes: "",
    });
    alert("Claim filed!");
  };

  const handleSaveCOGS = () => {
    setSettings((prev) => ({
      ...prev,
      cogsMap,
    }));
    alert("SKU COGS updated successfully!");
  };

  const uniqueSkus = useMemo(() => {
    return Array.from(new Set(orders.map((o) => o.sku)));
  }, [orders]);

  if (!isLoaded) {
    return (
      <div style={{ display: "flex", height: "100%", alignItems: "center", justifyContent: "center" }}>
        <div style={{ fontSize: 13, color: "#888" }}>Opening control panel…</div>
      </div>
    );
  }

  const tabs = [
    { id: "orders", label: "Orders Entry", icon: <ShoppingCart size={13} /> },
    { id: "returns", label: "Returns / RTO", icon: <RotateCcw size={13} /> },
    { id: "payments", label: "Payment Cycles", icon: <CreditCard size={13} /> },
    { id: "ads", label: "Ad Campaigns", icon: <Megaphone size={13} /> },
    { id: "claims", label: "Claims Entry", icon: <Shield size={13} /> },
    { id: "cogs", label: "SKU COGS Mappings", icon: <Key size={13} /> },
  ] as const;

  return (
    <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
      {/* Header */}
      <div style={{ marginBottom: 20 }}>
        <h1 style={{ fontSize: 22, fontWeight: 800, color: "#1a1a1a", letterSpacing: "-0.02em" }}>Control Panel & Configuration</h1>
        <p style={{ fontSize: 12, color: "#888", marginTop: 2 }}>Log manual entries, update inventory margins, and manage campaign budgets</p>
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", gap: 6, borderBottom: "1px solid #e8e8e8", paddingBottom: 10, marginBottom: 20, flexWrap: "wrap" }}>
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              fontSize: 11,
              fontWeight: 700,
              padding: "8px 14px",
              borderRadius: 8,
              border: activeTab === tab.id ? "1px solid #7c3aed" : "1px solid transparent",
              background: activeTab === tab.id ? "#7c3aed12" : "transparent",
              color: activeTab === tab.id ? "#7c3aed" : "#666",
              cursor: "pointer",
              transition: "all 0.15s",
            }}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Contents */}
      <div style={{ background: "#ffffff", border: "1px solid #e8e8e8", borderRadius: 16, padding: 20 }}>
        {activeTab === "orders" && (
          <form onSubmit={handleAddOrder} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <h3 style={{ fontSize: 14, fontWeight: 700, color: "#1a1a1a" }}>Add manual Order</h3>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 16 }}>
              <div>
                <label style={{ display: "block", fontSize: 10, fontWeight: 700, color: "#888", textTransform: "uppercase", marginBottom: 6 }}>Order Date</label>
                <input type="date" value={orderForm.date} onChange={(e) => setOrderForm({ ...orderForm, date: e.target.value })} style={{ width: "100%", padding: "8px 12px", border: "1px solid #ddd", borderRadius: 8, fontSize: 12 }} required />
              </div>
              <div>
                <label style={{ display: "block", fontSize: 10, fontWeight: 700, color: "#888", textTransform: "uppercase", marginBottom: 6 }}>Order Number</label>
                <input placeholder="e.g. ME928349" value={orderForm.orderNo} onChange={(e) => setOrderForm({ ...orderForm, orderNo: e.target.value })} style={{ width: "100%", padding: "8px 12px", border: "1px solid #ddd", borderRadius: 8, fontSize: 12 }} required />
              </div>
              <div>
                <label style={{ display: "block", fontSize: 10, fontWeight: 700, color: "#888", textTransform: "uppercase", marginBottom: 6 }}>SKU Code</label>
                <select value={orderForm.sku} onChange={(e) => setOrderForm({ ...orderForm, sku: e.target.value })} style={{ width: "100%", padding: "8px 12px", border: "1px solid #ddd", borderRadius: 8, fontSize: 12 }}>
                  <option value="SKU001">SKU001</option>
                  <option value="SKU002">SKU002</option>
                  <option value="SKU003">SKU003</option>
                </select>
              </div>
              <div>
                <label style={{ display: "block", fontSize: 10, fontWeight: 700, color: "#888", textTransform: "uppercase", marginBottom: 6 }}>Product Name</label>
                <input placeholder="Product details" value={orderForm.productName} onChange={(e) => setOrderForm({ ...orderForm, productName: e.target.value })} style={{ width: "100%", padding: "8px 12px", border: "1px solid #ddd", borderRadius: 8, fontSize: 12 }} required />
              </div>
              <div>
                <label style={{ display: "block", fontSize: 10, fontWeight: 700, color: "#888", textTransform: "uppercase", marginBottom: 6 }}>Selling Price (₹)</label>
                <input type="number" value={orderForm.sellingPrice} onChange={(e) => setOrderForm({ ...orderForm, sellingPrice: Number(e.target.value) })} style={{ width: "100%", padding: "8px 12px", border: "1px solid #ddd", borderRadius: 8, fontSize: 12 }} required />
              </div>
              <div>
                <label style={{ display: "block", fontSize: 10, fontWeight: 700, color: "#888", textTransform: "uppercase", marginBottom: 6 }}>City</label>
                <input placeholder="e.g. Mumbai" value={orderForm.city} onChange={(e) => setOrderForm({ ...orderForm, city: e.target.value })} style={{ width: "100%", padding: "8px 12px", border: "1px solid #ddd", borderRadius: 8, fontSize: 12 }} required />
              </div>
              <div>
                <label style={{ display: "block", fontSize: 10, fontWeight: 700, color: "#888", textTransform: "uppercase", marginBottom: 6 }}>Status</label>
                <select value={orderForm.status} onChange={(e) => setOrderForm({ ...orderForm, status: e.target.value as OrderStatus })} style={{ width: "100%", padding: "8px 12px", border: "1px solid #ddd", borderRadius: 8, fontSize: 12 }}>
                  <option value="packed">Packed</option>
                  <option value="shipped">Shipped</option>
                  <option value="delivered">Delivered</option>
                </select>
              </div>
              <div>
                <label style={{ display: "block", fontSize: 10, fontWeight: 700, color: "#888", textTransform: "uppercase", marginBottom: 6 }}>Payment Mode</label>
                <select value={orderForm.paymentType} onChange={(e) => setOrderForm({ ...orderForm, paymentType: e.target.value as "prepaid" | "cod" })} style={{ width: "100%", padding: "8px 12px", border: "1px solid #ddd", borderRadius: 8, fontSize: 12 }}>
                  <option value="prepaid">Prepaid</option>
                  <option value="cod">COD</option>
                </select>
              </div>
            </div>
            <button type="submit" style={{ background: "#7c3aed", color: "#fff", border: "none", borderRadius: 8, padding: "10px 20px", fontSize: 11, fontWeight: 700, cursor: "pointer", alignSelf: "flex-end" }}>Add Order</button>
          </form>
        )}

        {activeTab === "returns" && (
          <form onSubmit={handleAddReturn} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <h3 style={{ fontSize: 14, fontWeight: 700, color: "#1a1a1a" }}>Log Return / RTO</h3>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 16 }}>
              <div>
                <label style={{ display: "block", fontSize: 10, fontWeight: 700, color: "#888", textTransform: "uppercase", marginBottom: 6 }}>Order Number / ID</label>
                <input placeholder="Order number to return" value={returnForm.orderId} onChange={(e) => setReturnForm({ ...returnForm, orderId: e.target.value })} style={{ width: "100%", padding: "8px 12px", border: "1px solid #ddd", borderRadius: 8, fontSize: 12 }} required />
              </div>
              <div>
                <label style={{ display: "block", fontSize: 10, fontWeight: 700, color: "#888", textTransform: "uppercase", marginBottom: 6 }}>Return Date</label>
                <input type="date" value={returnForm.date} onChange={(e) => setReturnForm({ ...returnForm, date: e.target.value })} style={{ width: "100%", padding: "8px 12px", border: "1px solid #ddd", borderRadius: 8, fontSize: 12 }} required />
              </div>
              <div>
                <label style={{ display: "block", fontSize: 10, fontWeight: 700, color: "#888", textTransform: "uppercase", marginBottom: 6 }}>Return Reason</label>
                <select value={returnForm.reason} onChange={(e) => setReturnForm({ ...returnForm, reason: e.target.value as ReturnReason })} style={{ width: "100%", padding: "8px 12px", border: "1px solid #ddd", borderRadius: 8, fontSize: 12 }}>
                  <option value="size_issue">Size Issue</option>
                  <option value="quality_issue">Quality Issue</option>
                  <option value="wrong_product">Wrong Product</option>
                  <option value="damaged">Damaged Box</option>
                  <option value="other">Other</option>
                </select>
              </div>
              <div>
                <label style={{ display: "block", fontSize: 10, fontWeight: 700, color: "#888", textTransform: "uppercase", marginBottom: 6 }}>Logistics Type</label>
                <select value={String(returnForm.isRTO)} onChange={(e) => setReturnForm({ ...returnForm, isRTO: e.target.value === "true" })} style={{ width: "100%", padding: "8px 12px", border: "1px solid #ddd", borderRadius: 8, fontSize: 12 }}>
                  <option value="false">Customer Return</option>
                  <option value="true">RTO (Undelivered)</option>
                </select>
              </div>
              <div>
                <label style={{ display: "block", fontSize: 10, fontWeight: 700, color: "#888", textTransform: "uppercase", marginBottom: 6 }}>RTO Loss Amount (₹)</label>
                <input type="number" value={returnForm.financialLoss} onChange={(e) => setReturnForm({ ...returnForm, financialLoss: Number(e.target.value) })} style={{ width: "100%", padding: "8px 12px", border: "1px solid #ddd", borderRadius: 8, fontSize: 12 }} />
              </div>
            </div>
            <button type="submit" style={{ background: "#7c3aed", color: "#fff", border: "none", borderRadius: 8, padding: "10px 20px", fontSize: 11, fontWeight: 700, cursor: "pointer", alignSelf: "flex-end" }}>Log Return</button>
          </form>
        )}

        {activeTab === "payments" && (
          <form onSubmit={handleAddPayment} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <h3 style={{ fontSize: 14, fontWeight: 700, color: "#1a1a1a" }}>Log Bank Settlement Cycle</h3>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 16 }}>
              <div>
                <label style={{ display: "block", fontSize: 10, fontWeight: 700, color: "#888", textTransform: "uppercase", marginBottom: 6 }}>Cycle Settlement Date</label>
                <input type="date" value={paymentForm.cycleDate} onChange={(e) => setPaymentForm({ ...paymentForm, cycleDate: e.target.value })} style={{ width: "100%", padding: "8px 12px", border: "1px solid #ddd", borderRadius: 8, fontSize: 12 }} required />
              </div>
              <div>
                <label style={{ display: "block", fontSize: 10, fontWeight: 700, color: "#888", textTransform: "uppercase", marginBottom: 6 }}>Gross Payout (₹)</label>
                <input type="number" value={paymentForm.grossAmount} onChange={(e) => setPaymentForm({ ...paymentForm, grossAmount: Number(e.target.value) })} style={{ width: "100%", padding: "8px 12px", border: "1px solid #ddd", borderRadius: 8, fontSize: 12 }} required />
              </div>
              <div>
                <label style={{ display: "block", fontSize: 10, fontWeight: 700, color: "#888", textTransform: "uppercase", marginBottom: 6 }}>Platform Commission Deducted (₹)</label>
                <input type="number" value={paymentForm.platformFees} onChange={(e) => setPaymentForm({ ...paymentForm, platformFees: Number(e.target.value) })} style={{ width: "100%", padding: "8px 12px", border: "1px solid #ddd", borderRadius: 8, fontSize: 12 }} />
              </div>
              <div>
                <label style={{ display: "block", fontSize: 10, fontWeight: 700, color: "#888", textTransform: "uppercase", marginBottom: 6 }}>UTR Number</label>
                <input placeholder="Reconciliation UTR" value={paymentForm.utr} onChange={(e) => setPaymentForm({ ...paymentForm, utr: e.target.value })} style={{ width: "100%", padding: "8px 12px", border: "1px solid #ddd", borderRadius: 8, fontSize: 12 }} />
              </div>
            </div>
            <button type="submit" style={{ background: "#7c3aed", color: "#fff", border: "none", borderRadius: 8, padding: "10px 20px", fontSize: 11, fontWeight: 700, cursor: "pointer", alignSelf: "flex-end" }}>Log Payment</button>
          </form>
        )}

        {activeTab === "ads" && (
          <form onSubmit={handleAddAd} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <h3 style={{ fontSize: 14, fontWeight: 700, color: "#1a1a1a" }}>Register Ad Campaign</h3>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 16 }}>
              <div>
                <label style={{ display: "block", fontSize: 10, fontWeight: 700, color: "#888", textTransform: "uppercase", marginBottom: 6 }}>Campaign Name</label>
                <input placeholder="Ad title" value={adForm.name} onChange={(e) => setAdForm({ ...adForm, name: e.target.value })} style={{ width: "100%", padding: "8px 12px", border: "1px solid #ddd", borderRadius: 8, fontSize: 12 }} required />
              </div>
              <div>
                <label style={{ display: "block", fontSize: 10, fontWeight: 700, color: "#888", textTransform: "uppercase", marginBottom: 6 }}>Budget (₹)</label>
                <input type="number" value={adForm.budget} onChange={(e) => setAdForm({ ...adForm, budget: Number(e.target.value) })} style={{ width: "100%", padding: "8px 12px", border: "1px solid #ddd", borderRadius: 8, fontSize: 12 }} required />
              </div>
              <div>
                <label style={{ display: "block", fontSize: 10, fontWeight: 700, color: "#888", textTransform: "uppercase", marginBottom: 6 }}>Actual Spend (₹)</label>
                <input type="number" value={adForm.spend} onChange={(e) => setAdForm({ ...adForm, spend: Number(e.target.value) })} style={{ width: "100%", padding: "8px 12px", border: "1px solid #ddd", borderRadius: 8, fontSize: 12 }} />
              </div>
              <div>
                <label style={{ display: "block", fontSize: 10, fontWeight: 700, color: "#888", textTransform: "uppercase", marginBottom: 6 }}>Generated Ad Revenue (₹)</label>
                <input type="number" value={adForm.revenue} onChange={(e) => setAdForm({ ...adForm, revenue: Number(e.target.value) })} style={{ width: "100%", padding: "8px 12px", border: "1px solid #ddd", borderRadius: 8, fontSize: 12 }} />
              </div>
              <div>
                <label style={{ display: "block", fontSize: 10, fontWeight: 700, color: "#888", textTransform: "uppercase", marginBottom: 6 }}>Attributed Orders</label>
                <input type="number" value={adForm.orders} onChange={(e) => setAdForm({ ...adForm, orders: Number(e.target.value) })} style={{ width: "100%", padding: "8px 12px", border: "1px solid #ddd", borderRadius: 8, fontSize: 12 }} />
              </div>
            </div>
            <button type="submit" style={{ background: "#7c3aed", color: "#fff", border: "none", borderRadius: 8, padding: "10px 20px", fontSize: 11, fontWeight: 700, cursor: "pointer", alignSelf: "flex-end" }}>Add Campaign</button>
          </form>
        )}

        {activeTab === "claims" && (
          <form onSubmit={handleAddClaim} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <h3 style={{ fontSize: 14, fontWeight: 700, color: "#1a1a1a" }}>File Claims Recovery</h3>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 16 }}>
              <div>
                <label style={{ display: "block", fontSize: 10, fontWeight: 700, color: "#888", textTransform: "uppercase", marginBottom: 6 }}>Order ID</label>
                <input placeholder="e.g. o1" value={claimForm.orderId} onChange={(e) => setClaimForm({ ...claimForm, orderId: e.target.value })} style={{ width: "100%", padding: "8px 12px", border: "1px solid #ddd", borderRadius: 8, fontSize: 12 }} required />
              </div>
              <div>
                <label style={{ display: "block", fontSize: 10, fontWeight: 700, color: "#888", textTransform: "uppercase", marginBottom: 6 }}>Amount Claimed (₹)</label>
                <input type="number" value={claimForm.amountClaimed} onChange={(e) => setClaimForm({ ...claimForm, amountClaimed: Number(e.target.value) })} style={{ width: "100%", padding: "8px 12px", border: "1px solid #ddd", borderRadius: 8, fontSize: 12 }} required />
              </div>
              <div>
                <label style={{ display: "block", fontSize: 10, fontWeight: 700, color: "#888", textTransform: "uppercase", marginBottom: 6 }}>Amount Recovered (Approved) (₹)</label>
                <input type="number" value={claimForm.amountApproved} onChange={(e) => setClaimForm({ ...claimForm, amountApproved: Number(e.target.value) })} style={{ width: "100%", padding: "8px 12px", border: "1px solid #ddd", borderRadius: 8, fontSize: 12 }} />
              </div>
              <div>
                <label style={{ display: "block", fontSize: 10, fontWeight: 700, color: "#888", textTransform: "uppercase", marginBottom: 6 }}>Notes</label>
                <input placeholder="Additional details" value={claimForm.notes} onChange={(e) => setClaimForm({ ...claimForm, notes: e.target.value })} style={{ width: "100%", padding: "8px 12px", border: "1px solid #ddd", borderRadius: 8, fontSize: 12 }} />
              </div>
            </div>
            <button type="submit" style={{ background: "#7c3aed", color: "#fff", border: "none", borderRadius: 8, padding: "10px 20px", fontSize: 11, fontWeight: 700, cursor: "pointer", alignSelf: "flex-end" }}>Submit Claim</button>
          </form>
        )}

        {activeTab === "cogs" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <h3 style={{ fontSize: 14, fontWeight: 700, color: "#1a1a1a" }}>Set inventory cost (COGS) per SKU</h3>
            <p style={{ fontSize: 11, color: "#666" }}>Configure individual product costs. Setting accurate COGS ensures net profitability computations match reality.</p>

            <div style={{ display: "flex", flexDirection: "column", gap: 12, marginTop: 8 }}>
              {uniqueSkus.map((sku) => (
                <div key={sku} style={{ display: "flex", alignItems: "center", gap: 16 }}>
                  <div style={{ width: 80, fontSize: 12, fontWeight: 700, color: "#1a1a1a" }}>{sku}</div>
                  <input
                    type="number"
                    value={cogsMap[sku] ?? 0}
                    onChange={(e) => setCogsMap({ ...cogsMap, [sku]: Number(e.target.value) })}
                    style={{ padding: "6px 12px", border: "1px solid #ddd", borderRadius: 8, fontSize: 12, width: 100 }}
                  />
                  <span style={{ fontSize: 11, color: "#aaa" }}>INR product cost</span>
                </div>
              ))}
            </div>

            <button
              onClick={handleSaveCOGS}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                background: "#10b981",
                color: "#fff",
                border: "none",
                borderRadius: 8,
                padding: "8px 16px",
                fontSize: 11,
                fontWeight: 700,
                cursor: "pointer",
                alignSelf: "flex-end",
                marginTop: 16,
              }}
            >
              <Save size={12} />
              Save SKU COGS
            </button>
          </div>
        )}
      </div>
    </motion.div>
  );
}
