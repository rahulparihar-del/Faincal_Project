"use client";

import React, { useMemo, useState, useEffect } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { motion } from "framer-motion";
import {
  BarChart2,
  TrendingUp,
  Package,
  RotateCcw,
  Shield,
  Megaphone,
  CreditCard,
  Star,
  Activity,
  AlertTriangle,
  CheckCircle,
  Truck,
  ArrowLeft,
  DollarSign
} from "lucide-react";
import { useMMData } from "@/components/meesho/useMeeshoData";
import { calculateSkuStats, calculateCourierStats } from "@/lib/data/analytics";
import { HealthScoreMeter } from "@/components/meesho/HealthScoreMeter";
import { KpiCard } from "@/components/meesho/KpiCard";
import { DataTable } from "@/components/meesho/DataTable";

export default function Product360Page() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { orders, returns, claims, adCampaigns, paymentCycles, inventory, settings, isLoaded } = useMMData();

  const [selectedSku, setSelectedSku] = useState<string>("SKU001");

  // Read SKU from query params
  useEffect(() => {
    const skuParam = searchParams.get("sku");
    if (skuParam) {
      setSelectedSku(skuParam);
    }
  }, [searchParams]);

  // List of all unique SKUs in our inventory or orders
  const skuList = useMemo(() => {
    const skus = new Set<string>();
    inventory.forEach((i) => skus.add(i.sku));
    orders.forEach((o) => skus.add(o.sku));
    return Array.from(skus);
  }, [inventory, orders]);

  // Calculate statistics for the selected SKU
  const skuStats = useMemo(() => {
    const allStats = calculateSkuStats(orders, returns, settings, adCampaigns);
    return allStats.find((s) => s.sku === selectedSku) || {
      sku: selectedSku,
      productName: inventory.find((i) => i.sku === selectedSku)?.productName || `SKU ${selectedSku}`,
      revenue: 0,
      orders: 0,
      returns: 0,
      rto: 0,
      adsCost: 0,
      shippingCost: 0,
      platformFees: 0,
      cogs: 0,
      netProfit: 0,
      returnRate: 0,
      rtoRate: 0,
      healthScore: 100,
    };
  }, [selectedSku, orders, returns, settings, adCampaigns, inventory]);

  // Get inventory intelligence details
  const inventoryItem = useMemo(() => {
    return inventory.find((i) => i.sku === selectedSku) || {
      sku: selectedSku,
      productName: `SKU ${selectedSku}`,
      currentStock: 0,
      reservedStock: 0,
      availableStock: 0,
      avgDailySales: 0.1,
      daysRemaining: 0,
      health: "out_of_stock" as const,
    };
  }, [selectedSku, inventory]);

  // Courier performance for this specific SKU
  const courierPerformance = useMemo(() => {
    const skuOrders = orders.filter((o) => o.sku === selectedSku);
    const skuReturns = returns.filter((r) => r.sku === selectedSku);
    return calculateCourierStats(skuOrders, skuReturns);
  }, [selectedSku, orders, returns]);

  // Claims filed for this SKU
  const skuClaims = useMemo(() => {
    const skuOrders = orders.filter((o) => o.sku === selectedSku);
    const orderIds = skuOrders.map((o) => o.id);
    const orderNos = skuOrders.map((o) => o.orderNo);
    return claims.filter((c) => orderIds.includes(c.orderId) || orderNos.includes(c.orderId));
  }, [selectedSku, orders, claims]);

  const claimsSummary = useMemo(() => {
    const filed = skuClaims.reduce((sum, c) => sum + c.amountClaimed, 0);
    const approved = skuClaims.filter((c) => c.status === "approved").reduce((sum, c) => sum + c.amountApproved, 0);
    return { filed, approved };
  }, [skuClaims]);

  // Payments cycles where this SKU was present
  const skuSettlements = useMemo(() => {
    // Proportional breakdown: estimate payment share based on order share
    const totalRev = orders
      .filter((o) => o.status !== "rto" && o.status !== "cancelled" && o.status !== "returned")
      .reduce((sum, o) => sum + o.sellingPrice, 0);

    const skuRev = orders
      .filter((o) => o.sku === selectedSku && o.status !== "rto" && o.status !== "cancelled" && o.status !== "returned")
      .reduce((sum, o) => sum + o.sellingPrice, 0);

    const proportion = totalRev > 0 ? skuRev / totalRev : 0;

    return paymentCycles.map((p) => ({
      ...p,
      skuGrossShare: Math.round(p.grossAmount * proportion),
      skuNetShare: Math.round(p.netAmount * proportion),
    }));
  }, [selectedSku, orders, paymentCycles]);

  const handleSkuChange = (sku: string) => {
    setSelectedSku(sku);
    router.push(`/meesho-manage/product-360?sku=${sku}`);
  };

  const courierColumns = [
    { key: "courier", label: "Courier Partner", sortable: true },
    { key: "total", label: "Shipments", align: "center" as const },
    { key: "delivered", label: "Delivered", align: "center" as const },
    { key: "rto", label: "RTO", align: "center" as const },
    {
      key: "successRate",
      label: "Success Rate",
      align: "center" as const,
      render: (row: any) => (
        <span style={{ fontWeight: 700, color: row.successRate >= 80 ? "#10b981" : row.successRate >= 60 ? "#f59e0b" : "#ef4444" }}>
          {row.successRate.toFixed(1)}%
        </span>
      )
    },
    { key: "avgDeliveryDays", label: "Avg Speed", align: "center" as const, render: (row: any) => row.avgDeliveryDays ? `${row.avgDeliveryDays.toFixed(1)} days` : "-" },
    { key: "totalCost", label: "Cost", align: "right" as const, render: (row: any) => `₹${row.totalCost.toLocaleString("en-IN")}` }
  ];

  if (!isLoaded) {
    return (
      <div style={{ display: "flex", height: "100%", alignItems: "center", justifyContent: "center" }}>
        <div style={{ fontSize: 13, color: "#888" }}>Opening Product 360 file…</div>
      </div>
    );
  }

  return (
    <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
      {/* Back Link & Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
        <div>
          <button
            onClick={() => router.back()}
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              color: "#64748b",
              fontSize: 10,
              fontWeight: 700,
              display: "flex",
              alignItems: "center",
              gap: 4,
              padding: 0,
              marginBottom: 6
            }}
          >
            <ArrowLeft size={10} /> Back to Previous
          </button>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: "#1a1a1a", letterSpacing: "-0.02em" }}>Product 360 view</h1>
          <p style={{ fontSize: 12, color: "#888", marginTop: 2 }}>Unified analytics breakdown for a single SKU</p>
        </div>

        {/* SKU Selection Picker */}
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontSize: 11, fontWeight: 700, color: "#64748b", textTransform: "uppercase" }}>Select SKU:</span>
          <select
            value={selectedSku}
            onChange={(e) => handleSkuChange(e.target.value)}
            style={{
              padding: "8px 16px",
              borderRadius: 10,
              border: "1px solid #cbd5e1",
              fontSize: 12,
              fontWeight: 700,
              background: "#fff",
              color: "#1e293b",
              cursor: "pointer"
            }}
          >
            {skuList.map((sku) => (
              <option key={sku} value={sku}>
                {sku} - {inventory.find((i) => i.sku === sku)?.productName || sku}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Product Title Bar & Health score */}
      <div
        style={{
          background: "#ffffff",
          border: "1px solid #e8e8e8",
          borderRadius: 16,
          padding: "16px 20px",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 20,
          flexWrap: "wrap",
          gap: 16
        }}
      >
        <div>
          <span style={{ fontSize: 10, fontWeight: 800, color: "#7c3aed", background: "#7c3aed12", padding: "3px 8px", borderRadius: 4 }}>
            {skuStats.sku}
          </span>
          <h2 style={{ fontSize: 16, fontWeight: 800, color: "#1e293b", marginTop: 6 }}>{skuStats.productName}</h2>
        </div>

        <div style={{ width: 140 }}>
          <HealthScoreMeter score={skuStats.healthScore} />
        </div>
      </div>

      {/* KPI Performance Grid */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 16, marginBottom: 20 }}>
        <KpiCard title="SKU Gross Sales" value={skuStats.revenue.toLocaleString("en-IN")} prefix="₹" color="#7c3aed" icon={<TrendingUp size={16} />} />
        <KpiCard title="SKU Net Profit" value={skuStats.netProfit.toLocaleString("en-IN")} prefix="₹" isProfit color="#10b981" icon={<DollarSign size={16} />} />
        <KpiCard title="Total Ordered" value={skuStats.orders} color="#f59e0b" icon={<Package size={16} />} />
        <KpiCard title="Return / RTO rate" value={`${skuStats.returnRate.toFixed(1)}% / ${skuStats.rtoRate.toFixed(1)}%`} color="#ef4444" icon={<RotateCcw size={16} />} />
        <KpiCard title="Ad Spend" value={skuStats.adsCost.toLocaleString("en-IN")} prefix="₹" color="#ec4899" icon={<Megaphone size={16} />} />
      </div>

      {/* Middle row: Inventory Intelligence & Logistics Courier partners */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1.2fr", gap: 16, marginBottom: 20 }}>
        {/* Left Column: Inventory Intelligence */}
        <div style={{ background: "#ffffff", border: "1px solid #e8e8e8", borderRadius: 16, padding: 20, display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
              <Package size={16} style={{ color: "#7c3aed" }} />
              <h3 style={{ fontSize: 13, fontWeight: 800, color: "#1e293b", textTransform: "uppercase" }}>Inventory Intelligence</h3>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 16 }}>
              <div style={{ display: "flex", justifyContent: "space-between", borderBottom: "1px solid #f1f5f9", paddingBottom: 6 }}>
                <span style={{ fontSize: 11, color: "#64748b" }}>Current Stock</span>
                <span style={{ fontSize: 11, fontWeight: 700, color: "#1e293b" }}>{inventoryItem.currentStock} units</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", borderBottom: "1px solid #f1f5f9", paddingBottom: 6 }}>
                <span style={{ fontSize: 11, color: "#64748b" }}>Reserved Stock</span>
                <span style={{ fontSize: 11, fontWeight: 700, color: "#64748b" }}>{inventoryItem.reservedStock} units</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", borderBottom: "1px solid #f1f5f9", paddingBottom: 6 }}>
                <span style={{ fontSize: 11, color: "#64748b" }}>Available Sellable Stock</span>
                <span style={{ fontSize: 11, fontWeight: 800, color: "#10b981" }}>{inventoryItem.availableStock} units</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", borderBottom: "1px solid #f1f5f9", paddingBottom: 6 }}>
                <span style={{ fontSize: 11, color: "#64748b" }}>Average Daily Sales (30 Days)</span>
                <span style={{ fontSize: 11, fontWeight: 700, color: "#1e293b" }}>{inventoryItem.avgDailySales.toFixed(1)} units/day</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", borderBottom: "1px solid #f1f5f9", paddingBottom: 6 }}>
                <span style={{ fontSize: 11, color: "#64748b" }}>Days Remaining</span>
                <span
                  style={{
                    fontSize: 11,
                    fontWeight: 800,
                    color: inventoryItem.daysRemaining < 7 ? "#ef4444" : "#10b981"
                  }}
                >
                  {inventoryItem.daysRemaining} days
                </span>
              </div>

              {inventoryItem.suggestedReorderDate && (
                <div style={{ display: "flex", justifyContent: "space-between", borderBottom: "1px solid #f1f5f9", paddingBottom: 6, background: "#fffbeb", padding: 6, borderRadius: 6 }}>
                  <span style={{ fontSize: 11, color: "#d97706", fontWeight: 700, display: "flex", alignItems: "center", gap: 4 }}>
                    <AlertTriangle size={12} /> Suggested Reorder Date
                  </span>
                  <span style={{ fontSize: 11, fontWeight: 800, color: "#b45309" }}>{inventoryItem.suggestedReorderDate}</span>
                </div>
              )}
            </div>
          </div>

          <div
            style={{
              padding: 10,
              borderRadius: 10,
              background: inventoryItem.health === 'healthy' ? '#f0fdf4' : inventoryItem.health === 'low_stock' ? '#fffbeb' : '#fef2f2',
              border: `1px solid ${inventoryItem.health === 'healthy' ? '#bbf7d0' : inventoryItem.health === 'low_stock' ? '#fde68a' : '#fecaca'}`,
              color: inventoryItem.health === 'healthy' ? '#15803d' : inventoryItem.health === 'low_stock' ? '#b45309' : '#b91c1c',
              fontSize: 10,
              display: "flex",
              alignItems: "center",
              gap: 8
            }}
          >
            {inventoryItem.health === 'healthy' ? <CheckCircle size={14} /> : <AlertTriangle size={14} />}
            <span style={{ fontWeight: 700 }}>
              Stock status is {inventoryItem.health === 'healthy' ? 'Healthy. Stock level is optimal.' : inventoryItem.health === 'low_stock' ? 'Warning: Low Stock alert.' : 'Critical: Out of Stock.'}
            </span>
          </div>
        </div>

        {/* Right Column: Courier Partner comparison */}
        <div style={{ background: "#ffffff", border: "1px solid #e8e8e8", borderRadius: 16, padding: 20 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
            <Truck size={16} style={{ color: "#7c3aed" }} />
            <h3 style={{ fontSize: 13, fontWeight: 800, color: "#1e293b", textTransform: "uppercase" }}>Courier performance for SKU</h3>
          </div>

          {courierPerformance.length === 0 ? (
            <div style={{ padding: "32px 0", textAlign: "center", fontSize: 11, color: "#94a3b8" }}>No shipping data recorded for this SKU.</div>
          ) : (
            <DataTable columns={courierColumns} data={courierPerformance} searchable={false} />
          )}
        </div>
      </div>

      {/* Bottom row: Payout Settlements, Safety Claims and Mock Ratings */}
      <div style={{ display: "grid", gridTemplateColumns: "1.2fr 1fr 1fr", gap: 16 }}>
        {/* Proportional Settlement share */}
        <div style={{ background: "#ffffff", border: "1px solid #e8e8e8", borderRadius: 16, padding: 20 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
            <CreditCard size={16} style={{ color: "#7c3aed" }} />
            <h3 style={{ fontSize: 13, fontWeight: 800, color: "#1e293b", textTransform: "uppercase" }}>Payout cycle settlements</h3>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {skuSettlements.map((p) => (
              <div key={p.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid #f1f5f9", paddingBottom: 6 }}>
                <div>
                  <div style={{ fontSize: 10, fontWeight: 700, color: "#334155" }}>Cycle {p.cycleDate}</div>
                  <div style={{ fontSize: 8, color: "#94a3b8" }}>UTR {p.utr || 'processing'}</div>
                </div>

                <div style={{ textAlign: "right" }}>
                  <div style={{ fontSize: 11, fontWeight: 800, color: "#10b981" }}>₹{p.skuNetShare.toLocaleString("en-IN")}</div>
                  <div style={{ fontSize: 8, color: "#94a3b8" }}>Est Gross ₹{p.skuGrossShare.toLocaleString()}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Safety Claims */}
        <div style={{ background: "#ffffff", border: "1px solid #e8e8e8", borderRadius: 16, padding: 20 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
            <Shield size={16} style={{ color: "#7c3aed" }} />
            <h3 style={{ fontSize: 13, fontWeight: 800, color: "#1e293b", textTransform: "uppercase" }}>Safety claims logged</h3>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 12 }}>
            <div style={{ display: "flex", justifyContent: "space-between", borderBottom: "1px solid #f1f5f9", paddingBottom: 4 }}>
              <span style={{ fontSize: 10, color: "#64748b" }}>Claims Submitted</span>
              <span style={{ fontSize: 10, fontWeight: 700 }}>{skuClaims.length} claims</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", borderBottom: "1px solid #f1f5f9", paddingBottom: 4 }}>
              <span style={{ fontSize: 10, color: "#64748b" }}>Total Claim Value</span>
              <span style={{ fontSize: 10, fontWeight: 700 }}>₹{claimsSummary.filed.toLocaleString("en-IN")}</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", borderBottom: "1px solid #f1f5f9", paddingBottom: 4 }}>
              <span style={{ fontSize: 10, color: "#64748b" }}>Approved Recovery</span>
              <span style={{ fontSize: 10, fontWeight: 800, color: "#10b981" }}>₹{claimsSummary.approved.toLocaleString("en-IN")}</span>
            </div>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 4, maxHeight: 100, overflowY: "auto" }}>
            {skuClaims.map((claim) => (
              <div key={claim.id} style={{ fontSize: 8.5, background: "#f8fafc", padding: 6, borderRadius: 4, display: "flex", justifyContent: "space-between" }}>
                <span>Order {claim.orderId.substring(0, 8)} ({claim.claimType.replace('_', ' ')})</span>
                <strong style={{ color: claim.status === 'approved' ? '#10b981' : claim.status === 'pending' ? '#f59e0b' : '#ef4444' }}>
                  ₹{claim.amountApproved || claim.amountClaimed}
                </strong>
              </div>
            ))}
          </div>
        </div>

        {/* Star Rating summary widget */}
        <div style={{ background: "#ffffff", border: "1px solid #e8e8e8", borderRadius: 16, padding: 20 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
            <Star size={16} style={{ color: "#7c3aed" }} />
            <h3 style={{ fontSize: 13, fontWeight: 800, color: "#1e293b", textTransform: "uppercase" }}>Ratings & Feedback</h3>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
            <div style={{ textAlign: "center" }}>
              <div style={{ fontSize: 28, fontWeight: 900, color: "#1e293b" }}>{selectedSku === 'SKU003' ? '3.9' : selectedSku === 'SKU002' ? '4.1' : '4.4'}</div>
              <div style={{ display: "flex", gap: 1, justifyContent: "center" }}>
                <Star size={10} fill="#f59e0b" color="#f59e0b" />
                <Star size={10} fill="#f59e0b" color="#f59e0b" />
                <Star size={10} fill="#f59e0b" color="#f59e0b" />
                <Star size={10} fill="#f59e0b" color="#f59e0b" />
                <Star size={10} fill="#e2e8f0" color="#cbd5e1" />
              </div>
              <div style={{ fontSize: 8, color: "#94a3b8", marginTop: 4 }}>128 ratings</div>
            </div>

            <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 3 }}>
              {[
                { star: 5, pct: selectedSku === 'SKU003' ? 45 : 62 },
                { star: 4, pct: selectedSku === 'SKU003' ? 20 : 25 },
                { star: 3, pct: selectedSku === 'SKU003' ? 15 : 8 },
                { star: 2, pct: selectedSku === 'SKU003' ? 10 : 3 },
                { star: 1, pct: selectedSku === 'SKU003' ? 10 : 2 }
              ].map((r) => (
                <div key={r.star} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <span style={{ fontSize: 8, color: "#64748b", width: 8 }}>{r.star}</span>
                  <div style={{ flex: 1, height: 4, background: "#f1f5f9", borderRadius: 2, overflow: "hidden" }}>
                    <div style={{ width: `${r.pct}%`, height: "100%", background: "#f59e0b" }} />
                  </div>
                  <span style={{ fontSize: 8, color: "#94a3b8", width: 18, textAlign: "right" }}>{r.pct}%</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
