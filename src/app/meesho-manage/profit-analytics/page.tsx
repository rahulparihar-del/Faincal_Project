"use client";

import React, { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useMMData, filterByDate } from "@/components/meesho/useMeeshoData";
import { DateRangeFilter } from "@/components/meesho/DateRangeFilter";
import { KpiCard } from "@/components/meesho/KpiCard";
import { MoneyFlow } from "@/components/meesho/MoneyFlow";
import { DonutChart } from "@/components/meesho/DonutChart";
import { DateFilter } from "@/components/meesho/types";
import { calculateMetrics } from "@/lib/data/analytics";
import { Info, X, Search, ChevronRight, Calculator } from "lucide-react";

type TraceType = 'revenue' | 'cogs' | 'platformFees' | 'shippingCharges' | 'adsSpend' | 'returnCharges' | 'rtoLoss' | 'claimRecovery' | null;

export default function ProfitAnalyticsPage() {
  const { orders, returns, claims, adCampaigns, isLoaded } = useMMData();

  const [dateFilter, setDateFilter] = useState<DateFilter>({
    range: "30days",
    from: "",
    to: "",
  });

  const [selectedTrace, setSelectedTrace] = useState<TraceType>(null);
  const [searchTerm, setSearchTerm] = useState("");

  const filteredOrders = useMemo(() => filterByDate(orders, dateFilter), [orders, dateFilter]);
  const filteredReturns = useMemo(() => filterByDate(returns, dateFilter), [returns, dateFilter]);
  const filteredClaims = useMemo(() => filterByDate(claims, dateFilter), [claims, dateFilter]);

  const metrics = useMemo(() => {
    return calculateMetrics(filteredOrders, filteredReturns, filteredClaims);
  }, [filteredOrders, filteredReturns, filteredClaims]);

  const costBreakdown = useMemo(() => {
    return [
      { label: "COGS (Inventory Cost)", value: metrics.cogs, color: "#f59e0b" },
      { label: "Platform Fees", value: metrics.platformFees, color: "#64748b" },
      { label: "Shipping Fees", value: metrics.shippingCharges, color: "#0ea5e9" },
      { label: "Ad Spend", value: metrics.adsSpend, color: "#ec4899" },
      { label: "Return Charges", value: metrics.returnCharges, color: "#f97316" },
      { label: "RTO Losses", value: metrics.rtoLoss, color: "#ef4444" },
    ].filter((d) => d.value > 0);
  }, [metrics]);

  // Modal Table Trace Data Resolver
  const traceTransactions = useMemo(() => {
    if (!selectedTrace) return [];

    switch (selectedTrace) {
      case 'revenue':
        return filteredOrders
          .filter((o) => o.status !== "rto" && o.status !== "cancelled" && o.status !== "returned")
          .map((o) => ({
            id: o.id,
            date: o.date,
            ref: o.orderNo,
            name: o.productName,
            sku: o.sku,
            amount: o.sellingPrice,
            detail: `Status: ${o.status.toUpperCase()} | Qty: ${o.qty}`
          }));
      case 'cogs':
        return filteredOrders.map((o) => ({
          id: o.id,
          date: o.date,
          ref: o.orderNo,
          name: o.productName,
          sku: o.sku,
          amount: o.costOfGoods,
          detail: `Qty: ${o.qty} | Est. Cost: ₹${Math.round(o.costOfGoods / o.qty)} / unit`
        }));
      case 'platformFees':
        return filteredOrders.map((o) => ({
          id: o.id,
          date: o.date,
          ref: o.orderNo,
          name: o.productName,
          sku: o.sku,
          amount: o.platformFee,
          detail: `Selling Price: ₹${o.sellingPrice}`
        }));
      case 'shippingCharges':
        return filteredOrders.map((o) => ({
          id: o.id,
          date: o.date,
          ref: o.orderNo,
          name: `${o.courier} Shipping`,
          sku: o.sku,
          amount: o.shippingCharge,
          detail: `Courier: ${o.courier} | Dest: ${o.city}, ${o.state}`
        }));
      case 'adsSpend':
        // Ads Campaigns
        const list = adCampaigns.map((c) => ({
          id: c.id,
          date: c.startDate,
          ref: c.status.toUpperCase(),
          name: c.name,
          sku: c.sku || "General",
          amount: c.spend,
          detail: `Budget: ₹${c.budget} | ROAS: ${(c.spend ? c.revenue / c.spend : 0).toFixed(1)}x`
        }));
        // Order Ad spend allocs
        const orderAllocs = filteredOrders.filter(o => o.adSpend > 0).map((o) => ({
          id: `ad_${o.id}`,
          date: o.date,
          ref: o.orderNo,
          name: `Direct Ad Allocation`,
          sku: o.sku,
          amount: o.adSpend,
          detail: `Attributed product marketing cost`
        }));
        return [...list, ...orderAllocs];
      case 'returnCharges':
        return filteredReturns
          .filter((r) => !r.isRTO)
          .map((r) => ({
            id: r.id,
            date: r.date,
            ref: r.orderId,
            name: r.productName,
            sku: r.sku,
            amount: r.returnShippingCharge,
            detail: `Reason: ${r.reason.replace('_', ' ')} | Courier: ${r.courier}`
          }));
      case 'rtoLoss':
        return filteredReturns
          .filter((r) => r.isRTO)
          .map((r) => ({
            id: r.id,
            date: r.date,
            ref: r.orderId,
            name: `${r.productName} (Undelivered)`,
            sku: r.sku,
            amount: r.financialLoss,
            detail: `RTO attempts: ${r.rtoAttempts} | Status: ${r.recoveryStatus.toUpperCase()}`
          }));
      case 'claimRecovery':
        return filteredClaims
          .filter((c) => c.status === "approved")
          .map((c) => ({
            id: c.id,
            date: c.date,
            ref: c.orderId,
            name: `Claim: ${c.claimType.replace('_', ' ')}`,
            sku: "-",
            amount: c.amountApproved,
            detail: `Claimed: ₹${c.amountClaimed} | Notes: ${c.notes}`
          }));
      default:
        return [];
    }
  }, [selectedTrace, filteredOrders, filteredReturns, filteredClaims, adCampaigns]);

  const filteredTraceTransactions = useMemo(() => {
    if (!searchTerm) return traceTransactions;
    const term = searchTerm.toLowerCase();
    return traceTransactions.filter(
      (t) =>
        t.ref.toLowerCase().includes(term) ||
        t.name.toLowerCase().includes(term) ||
        t.sku.toLowerCase().includes(term) ||
        t.detail.toLowerCase().includes(term)
    );
  }, [traceTransactions, searchTerm]);

  const traceDetailsTitle = {
    revenue: "Delivered Sales Revenue",
    cogs: "Inventory COGS Deductions",
    platformFees: "Platform Commission Fees",
    shippingCharges: "Logistics Outward Shipping Charges",
    adsSpend: "Ad Campaigns Marketing Spends",
    returnCharges: "Customer Return Shipping Charges",
    rtoLoss: "Undelivered RTO Financial Losses",
    claimRecovery: "Approved Safety Claim Recoveries"
  }[selectedTrace || 'revenue'];

  if (!isLoaded) {
    return (
      <div style={{ display: "flex", height: "100%", alignItems: "center", justifyContent: "center" }}>
        <div style={{ fontSize: 13, color: "#888" }}>Evaluating profitability charts…</div>
      </div>
    );
  }

  return (
    <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
      {/* Header */}
      <div style={{ marginBottom: 20 }}>
        <h1 style={{ fontSize: 22, fontWeight: 800, color: "#1a1a1a", letterSpacing: "-0.02em" }}>Profitability & COGS Audit</h1>
        <p style={{ fontSize: 12, color: "#888", marginTop: 2 }}>Trace bottomline margins, transaction costs, and deductions</p>
      </div>

      <DateRangeFilter value={dateFilter} onChange={setDateFilter} />

      {/* KPI stats */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 16, marginBottom: 20 }}>
        <div onClick={() => setSelectedTrace('revenue')} style={{ cursor: "pointer" }}>
          <KpiCard title="Revenue (Delivered)" value={metrics.revenue.toLocaleString("en-IN")} prefix="₹" color="#7c3aed" />
        </div>
        <div onClick={() => setSelectedTrace('cogs')} style={{ cursor: "pointer" }}>
          <KpiCard title="Cost of Goods (COGS)" value={metrics.cogs.toLocaleString("en-IN")} prefix="₹" color="#f59e0b" />
        </div>
        <KpiCard title="Net Profit Earnings" value={metrics.netProfit.toLocaleString("en-IN")} prefix="₹" isProfit color="#10b981" />
        <KpiCard title="Net Margin %" value={`${metrics.margin.toFixed(1)}%`} color={metrics.margin >= 15 ? "#10b981" : "#f59e0b"} />
      </div>

      {/* Waterfall MoneyFlow component */}
      <div style={{ display: "grid", gridTemplateColumns: "2fr 1.2fr", gap: 16, marginBottom: 20 }}>
        <MoneyFlow
          revenue={metrics.revenue}
          cogs={metrics.cogs}
          platformFees={metrics.platformFees}
          shippingCharges={metrics.shippingCharges}
          adSpend={metrics.adsSpend}
          returnCharges={metrics.returnCharges}
          rtoLoss={metrics.rtoLoss}
          claimsRecovery={metrics.claimRecovery}
        />
        {costBreakdown.length > 0 ? (
          <DonutChart title="Cost Structure Breakdown" data={costBreakdown} size={120} />
        ) : (
          <div style={{ background: "#fff", border: "1px solid #e8e8e8", borderRadius: 16, padding: 20, display: "flex", alignItems: "center", justifyContent: "center", color: "#aaa", fontSize: 12 }}>
            No expense metrics
          </div>
        )}
      </div>

      {/* EBITDA Profit & Loss Summary grid */}
      <div
        style={{
          background: "#ffffff",
          border: "1px solid #e8e8e8",
          borderRadius: 16,
          padding: 20,
          boxShadow: "0 2px 8px rgba(0,0,0,0.01)",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid #f0f0f0", paddingBottom: 10, marginBottom: 12 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: "#1a1a1a" }}>
            EBITDA Profit & Loss Summary
          </div>
          <span style={{ fontSize: 9, color: "#64748b", display: "flex", alignItems: "center", gap: 4 }}>
            <Info size={11} /> Click any line item to audit contributing transactions
          </span>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {/* Revenue */}
          <div
            onClick={() => setSelectedTrace('revenue')}
            style={{ display: "flex", justifyContent: "space-between", fontSize: 12, borderBottom: "1px solid #f5f5f5", paddingBottom: 6, cursor: "pointer", transition: "all 0.15s", padding: "4px 8px", borderRadius: 6 }}
            onMouseEnter={(e) => e.currentTarget.style.background = "#f8fafc"}
            onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}
          >
            <span style={{ fontWeight: 600, color: "#555", display: "flex", alignItems: "center", gap: 4 }}>Gross Sales Revenue <ChevronRight size={10} /></span>
            <span style={{ fontWeight: 700, color: "#1a1a1a" }}>₹{metrics.revenue.toLocaleString("en-IN")}</span>
          </div>

          {/* COGS */}
          <div
            onClick={() => setSelectedTrace('cogs')}
            style={{ display: "flex", justifyContent: "space-between", fontSize: 12, borderBottom: "1px solid #f5f5f5", paddingBottom: 6, cursor: "pointer", transition: "all 0.15s", padding: "4px 8px", borderRadius: 6 }}
            onMouseEnter={(e) => e.currentTarget.style.background = "#f8fafc"}
            onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}
          >
            <span style={{ fontWeight: 600, color: "#555", display: "flex", alignItems: "center", gap: 4 }}>Less: Inventory COGS <ChevronRight size={10} /></span>
            <span style={{ fontWeight: 700, color: "#ef4444" }}>-₹{metrics.cogs.toLocaleString("en-IN")}</span>
          </div>

          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, borderBottom: "1px solid #f5f5f5", paddingBottom: 6, padding: "4px 8px" }}>
            <span style={{ fontWeight: 700, color: "#333" }}>Gross Profit Margin</span>
            <span style={{ fontWeight: 700, color: "#10b981" }}>₹{metrics.grossProfit.toLocaleString("en-IN")}</span>
          </div>

          {/* Platform Fees */}
          <div
            onClick={() => setSelectedTrace('platformFees')}
            style={{ display: "flex", justifyContent: "space-between", fontSize: 12, borderBottom: "1px solid #f5f5f5", paddingBottom: 6, cursor: "pointer", transition: "all 0.15s", padding: "4px 8px", borderRadius: 6 }}
            onMouseEnter={(e) => e.currentTarget.style.background = "#f8fafc"}
            onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}
          >
            <span style={{ fontWeight: 600, color: "#555", display: "flex", alignItems: "center", gap: 4 }}>Less: Platform Fees / Comm. <ChevronRight size={10} /></span>
            <span style={{ fontWeight: 700, color: "#ef4444" }}>-₹{metrics.platformFees.toLocaleString("en-IN")}</span>
          </div>

          {/* Shipping */}
          <div
            onClick={() => setSelectedTrace('shippingCharges')}
            style={{ display: "flex", justifyContent: "space-between", fontSize: 12, borderBottom: "1px solid #f5f5f5", paddingBottom: 6, cursor: "pointer", transition: "all 0.15s", padding: "4px 8px", borderRadius: 6 }}
            onMouseEnter={(e) => e.currentTarget.style.background = "#f8fafc"}
            onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}
          >
            <span style={{ fontWeight: 600, color: "#555", display: "flex", alignItems: "center", gap: 4 }}>Less: Shipping Costs <ChevronRight size={10} /></span>
            <span style={{ fontWeight: 700, color: "#ef4444" }}>-₹{metrics.shippingCharges.toLocaleString("en-IN")}</span>
          </div>

          {/* Ad Spend */}
          <div
            onClick={() => setSelectedTrace('adsSpend')}
            style={{ display: "flex", justifyContent: "space-between", fontSize: 12, borderBottom: "1px solid #f5f5f5", paddingBottom: 6, cursor: "pointer", transition: "all 0.15s", padding: "4px 8px", borderRadius: 6 }}
            onMouseEnter={(e) => e.currentTarget.style.background = "#f8fafc"}
            onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}
          >
            <span style={{ fontWeight: 600, color: "#555", display: "flex", alignItems: "center", gap: 4 }}>Less: Ad Spend (Marketing) <ChevronRight size={10} /></span>
            <span style={{ fontWeight: 700, color: "#ef4444" }}>-₹{metrics.adsSpend.toLocaleString("en-IN")}</span>
          </div>

          {/* Returns */}
          <div
            onClick={() => setSelectedTrace('returnCharges')}
            style={{ display: "flex", justifyContent: "space-between", fontSize: 12, borderBottom: "1px solid #f5f5f5", paddingBottom: 6, cursor: "pointer", transition: "all 0.15s", padding: "4px 8px", borderRadius: 6 }}
            onMouseEnter={(e) => e.currentTarget.style.background = "#f8fafc"}
            onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}
          >
            <span style={{ fontWeight: 600, color: "#555", display: "flex", alignItems: "center", gap: 4 }}>Less: Return Shipping & Losses <ChevronRight size={10} /></span>
            <span style={{ fontWeight: 700, color: "#ef4444" }}>-₹{metrics.returnCharges.toLocaleString("en-IN")}</span>
          </div>

          {/* RTO */}
          <div
            onClick={() => setSelectedTrace('rtoLoss')}
            style={{ display: "flex", justifyContent: "space-between", fontSize: 12, borderBottom: "1px solid #f5f5f5", paddingBottom: 6, cursor: "pointer", transition: "all 0.15s", padding: "4px 8px", borderRadius: 6 }}
            onMouseEnter={(e) => e.currentTarget.style.background = "#f8fafc"}
            onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}
          >
            <span style={{ fontWeight: 600, color: "#555", display: "flex", alignItems: "center", gap: 4 }}>Less: Logistics RTO Losses <ChevronRight size={10} /></span>
            <span style={{ fontWeight: 700, color: "#ef4444" }}>-₹{metrics.rtoLoss.toLocaleString("en-IN")}</span>
          </div>

          {/* Claims */}
          <div
            onClick={() => setSelectedTrace('claimRecovery')}
            style={{ display: "flex", justifyContent: "space-between", fontSize: 12, borderBottom: "1px solid #f5f5f5", paddingBottom: 6, cursor: "pointer", transition: "all 0.15s", padding: "4px 8px", borderRadius: 6 }}
            onMouseEnter={(e) => e.currentTarget.style.background = "#f8fafc"}
            onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}
          >
            <span style={{ fontWeight: 600, color: "#555", display: "flex", alignItems: "center", gap: 4 }}>Add: Claims Approved / Recovered <ChevronRight size={10} /></span>
            <span style={{ fontWeight: 700, color: "#10b981" }}>+₹{metrics.claimRecovery.toLocaleString("en-IN")}</span>
          </div>

          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, borderBottom: "2px solid #e8e8e8", paddingBottom: 8, marginTop: 4, padding: "4px 8px" }}>
            <span style={{ fontWeight: 800, color: "#1a1a1a" }}>Net Earnings Payout</span>
            <span style={{ fontWeight: 800, color: metrics.netProfit >= 0 ? "#10b981" : "#ef4444" }}>
              ₹{metrics.netProfit.toLocaleString("en-IN")}
            </span>
          </div>
        </div>
      </div>

      {/* Transaction Traceability Audit Modal overlay */}
      <AnimatePresence>
        {selectedTrace !== null && (
          <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, zIndex: 999, display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
            {/* Backdrop cover */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.6 }}
              exit={{ opacity: 0 }}
              onClick={() => { setSelectedTrace(null); setSearchTerm(""); }}
              style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, background: "#0f172a" }}
            />

            {/* Modal Box */}
            <motion.div
              initial={{ scale: 0.95, opacity: 0, y: 10 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 10 }}
              transition={{ type: "spring", damping: 25, stiffness: 350 }}
              style={{
                position: "relative",
                width: "100%",
                maxWidth: 680,
                maxHeight: "85vh",
                background: "#ffffff",
                borderRadius: 16,
                boxShadow: "0 25px 50px -12px rgba(0,0,0,0.25)",
                display: "flex",
                flexDirection: "column",
                overflow: "hidden",
                zIndex: 1000
              }}
            >
              {/* Modal Header */}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "16px 20px", borderBottom: "1px solid #f1f5f9" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <Calculator size={16} style={{ color: "#7c3aed" }} />
                  <span style={{ fontSize: 13, fontWeight: 800, textTransform: "uppercase", color: "#1e293b" }}>{traceDetailsTitle}</span>
                </div>
                <button
                  onClick={() => { setSelectedTrace(null); setSearchTerm(""); }}
                  style={{ background: "none", border: "none", cursor: "pointer", color: "#94a3b8", display: "flex", alignItems: "center" }}
                >
                  <X size={16} />
                </button>
              </div>

              {/* Modal Search Bar */}
              <div style={{ padding: "10px 20px", borderBottom: "1px solid #f1f5f9", display: "flex", alignItems: "center", gap: 8, background: "#f8fafc" }}>
                <Search size={14} style={{ color: "#94a3b8" }} />
                <input
                  placeholder="Filter transactions by SKU, ID or reference name..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  style={{
                    flex: 1,
                    background: "none",
                    border: "none",
                    fontSize: 11,
                    outline: "none",
                    color: "#334155"
                  }}
                />
                {searchTerm && (
                  <button onClick={() => setSearchTerm("")} style={{ background: "none", border: "none", color: "#94a3b8", cursor: "pointer" }}>
                    <X size={10} />
                  </button>
                )}
              </div>

              {/* Modal Table body */}
              <div style={{ flex: 1, overflowY: "auto", padding: "16px 20px" }}>
                {filteredTraceTransactions.length === 0 ? (
                  <div style={{ padding: "32px 0", textAlign: "center", fontSize: 11, color: "#94a3b8" }}>No ledger logs found matching current filters.</div>
                ) : (
                  <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left", fontSize: 11 }}>
                    <thead>
                      <tr style={{ borderBottom: "2px solid #f1f5f9" }}>
                        <th style={{ padding: 8, color: "#64748b", fontWeight: 700 }}>Date</th>
                        <th style={{ padding: 8, color: "#64748b", fontWeight: 700 }}>Ref / ID</th>
                        <th style={{ padding: 8, color: "#64748b", fontWeight: 700 }}>Item Description</th>
                        <th style={{ padding: 8, color: "#64748b", fontWeight: 700 }}>SKU</th>
                        <th style={{ padding: 8, color: "#64748b", fontWeight: 700, textAlign: "right" }}>Amount</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredTraceTransactions.map((t, idx) => (
                        <tr key={t.id + "_" + idx} style={{ borderBottom: "1px solid #f1f5f9" }}>
                          <td style={{ padding: 8, color: "#64748b", whiteSpace: "nowrap" }}>{t.date}</td>
                          <td style={{ padding: 8, fontWeight: 700, color: "#334155" }}>{t.ref}</td>
                          <td style={{ padding: 8 }}>
                            <div style={{ fontWeight: 600, color: "#1e293b" }}>{t.name}</div>
                            <span style={{ fontSize: 9, color: "#94a3b8" }}>{t.detail}</span>
                          </td>
                          <td style={{ padding: 8, color: "#64748b" }}>{t.sku}</td>
                          <td style={{ padding: 8, fontWeight: 800, textAlign: "right", color: selectedTrace === 'claimRecovery' || selectedTrace === 'revenue' ? '#10b981' : '#ef4444' }}>
                            {selectedTrace === 'claimRecovery' || selectedTrace === 'revenue' ? '+' : '-'}₹{t.amount.toLocaleString("en-IN")}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>

              {/* Modal Footer */}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 20px", borderTop: "1px solid #f1f5f9", background: "#f8fafc", fontSize: 10, color: "#64748b" }}>
                <span>Showing {filteredTraceTransactions.length} transaction entries</span>
                <span style={{ fontWeight: 700, color: "#1e293b" }}>
                  Cumulative sum: ₹{filteredTraceTransactions.reduce((s, t) => s + t.amount, 0).toLocaleString("en-IN")}
                </span>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
