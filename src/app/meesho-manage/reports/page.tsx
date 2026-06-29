"use client";

import React, { useState, useMemo } from "react";
import { motion } from "framer-motion";
import { Download, FileSpreadsheet, Calendar } from "lucide-react";
import { useMMData, filterByDate } from "@/components/meesho/useMeeshoData";
import { DateRangeFilter } from "@/components/meesho/DateRangeFilter";
import { DateFilter } from "@/components/meesho/types";

export default function ReportsPage() {
  const { orders, returns, adCampaigns, paymentCycles, claims, isLoaded } = useMMData();

  const [dateFilter, setDateFilter] = useState<DateFilter>({
    range: "30days",
    from: "",
    to: "",
  });

  const filteredOrders = useMemo(() => filterByDate(orders, dateFilter), [orders, dateFilter]);
  const filteredReturns = useMemo(() => filterByDate(returns, dateFilter), [returns, dateFilter]);
  const filteredCampaigns = useMemo(() => {
    const fromTime = dateFilter.from ? new Date(dateFilter.from + "T00:00:00").getTime() : 0;
    const toTime = dateFilter.to ? new Date(dateFilter.to + "T23:59:59").getTime() : Infinity;
    return adCampaigns.filter((c) => {
      const time = new Date(c.startDate + "T12:00:00").getTime();
      return time >= fromTime && time <= toTime;
    });
  }, [adCampaigns, dateFilter]);

  const stats = useMemo(() => {
    return {
      ordersCount: filteredOrders.length,
      returnsCount: filteredReturns.length,
      campaignsCount: filteredCampaigns.length,
      paymentsCount: paymentCycles.length,
      claimsCount: claims.length,
    };
  }, [filteredOrders, filteredReturns, filteredCampaigns, paymentCycles, claims]);

  const downloadCSV = (filename: string, headers: string[], rows: string[][]) => {
    const csvContent =
      "data:text/csv;charset=utf-8," +
      [headers.join(","), ...rows.map((e) => e.map((val) => `"${String(val).replace(/"/g, '""')}"`).join(","))].join("\n");

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `${filename}_${dateFilter.range}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const exportOrders = () => {
    const headers = ["Order No", "Date", "SKU", "Product", "Qty", "Selling Price", "COGS", "Fee", "Shipping", "Status", "Courier", "City", "Payment Type"];
    const rows = filteredOrders.map((o) => [
      o.orderNo,
      o.date,
      o.sku,
      o.productName,
      String(o.qty),
      String(o.sellingPrice),
      String(o.costOfGoods),
      String(o.platformFee),
      String(o.shippingCharge),
      o.status,
      o.courier,
      o.city,
      o.paymentType,
    ]);
    downloadCSV("meesho_orders_report", headers, rows);
  };

  const exportReturns = () => {
    const headers = ["Order ID", "Date", "SKU", "Product", "Reason", "Courier", "Is RTO", "Attempts", "Financial Loss"];
    const rows = filteredReturns.map((r) => [
      r.orderId,
      r.date,
      r.sku,
      r.productName,
      r.reason,
      r.courier,
      r.isRTO ? "YES" : "NO",
      String(r.rtoAttempts),
      String(r.financialLoss),
    ]);
    downloadCSV("meesho_returns_report", headers, rows);
  };

  const exportPnL = () => {
    const revenue = filteredOrders
      .filter((o) => o.status !== "rto" && o.status !== "cancelled" && o.status !== "returned")
      .reduce((sum, o) => sum + o.sellingPrice, 0);
    const cogs = filteredOrders.reduce((sum, o) => sum + o.costOfGoods, 0);
    const fees = filteredOrders.reduce((sum, o) => sum + o.platformFee, 0);
    const shipping = filteredOrders.reduce((sum, o) => sum + o.shippingCharge, 0);
    const ads = filteredOrders.reduce((sum, o) => sum + o.adSpend, 0);
    const returnCharges = filteredReturns.filter((r) => !r.isRTO).reduce((sum, r) => sum + r.returnShippingCharge, 0);
    const rtoLoss = filteredReturns.filter((r) => r.isRTO).reduce((sum, r) => sum + r.financialLoss, 0);
    const claimRecovery = claims.filter((c) => c.status === "approved").reduce((sum, c) => sum + c.amountApproved, 0);
    const netProfit = revenue - cogs - fees - shipping - ads - returnCharges - rtoLoss + claimRecovery;

    const headers = ["Financial Metric", "Value (INR)"];
    const rows = [
      ["Gross Sales Revenue", String(revenue)],
      ["Less: COGS (Inventory Cost)", String(-cogs)],
      ["Less: Platform Comm. Fees", String(-fees)],
      ["Less: Shipping Outward Costs", String(-shipping)],
      ["Less: Marketing Ad spend", String(-ads)],
      ["Less: Return Shipping Charges", String(-returnCharges)],
      ["Less: RTO Logistics Losses", String(-rtoLoss)],
      ["Add: Claim Recoveries", String(claimRecovery)],
      ["Net Earnings Payout Margin", String(netProfit)],
    ];
    downloadCSV("meesho_profit_statement", headers, rows);
  };

  const exportAds = () => {
    const headers = ["Campaign Name", "Start Date", "End Date", "Status", "Budget", "Spend", "Impressions", "Clicks", "Orders", "Revenue", "ROAS"];
    const rows = filteredCampaigns.map((c) => {
      const roas = c.spend ? c.revenue / c.spend : 0;
      return [
        c.name,
        c.startDate,
        c.endDate,
        c.status,
        String(c.budget),
        String(c.spend),
        String(c.impressions),
        String(c.clicks),
        String(c.orders),
        String(c.revenue),
        `${roas.toFixed(2)}x`,
      ];
    });
    downloadCSV("meesho_ad_performance", headers, rows);
  };

  const exportPayments = () => {
    const headers = ["Cycle Date", "From Date", "To Date", "Gross Amount", "Fees Deductions", "TDS", "Shipping Deductions", "Net Settled", "Status", "UTR"];
    const rows = paymentCycles.map((p) => [
      p.cycleDate,
      p.fromDate,
      p.toDate,
      String(p.grossAmount),
      String(p.platformFees),
      String(p.tds),
      String(p.shippingDeductions),
      String(p.netAmount),
      p.status,
      p.utr || "-",
    ]);
    downloadCSV("meesho_settlement_ledger", headers, rows);
  };

  if (!isLoaded) {
    return (
      <div style={{ display: "flex", height: "100%", alignItems: "center", justifyContent: "center" }}>
        <div style={{ fontSize: 13, color: "#888" }}>Setting up export profiles…</div>
      </div>
    );
  }

  const reports = [
    { name: "Orders Ledger Report", desc: "Detailed transactions for active shipments, pricing, and cities", icon: <FileSpreadsheet size={20} />, count: stats.ordersCount, onClick: exportOrders },
    { name: "Returns & RTO Statement", desc: "Customer returns reasons, Courier RTO rates, and losses", icon: <FileSpreadsheet size={20} />, count: stats.returnsCount, onClick: exportReturns },
    { name: "Profitability Waterfall Summary", desc: "Gross, EBITDA, Platform Fee, ad spend, and net contribution P&L", icon: <FileSpreadsheet size={20} />, count: 1, onClick: exportPnL },
    { name: "Ad Campaign ROI Ledger", desc: "Impressions, budgets, ad click CPCs, orders, and ROAS parameters", icon: <FileSpreadsheet size={20} />, count: stats.campaignsCount, onClick: exportAds },
    { name: "Bank Settlements Ledger", desc: "UTR reconciliation, gross payouts, TDS and deductions schedules", icon: <FileSpreadsheet size={20} />, count: stats.paymentsCount, onClick: exportPayments },
  ];

  return (
    <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
      {/* Header */}
      <div style={{ marginBottom: 20 }}>
        <h1 style={{ fontSize: 22, fontWeight: 800, color: "#1a1a1a", letterSpacing: "-0.02em" }}>Reports & Reconciliation</h1>
        <p style={{ fontSize: 12, color: "#888", marginTop: 2 }}>Export operational ledgers, tax P&Ls and UTR statements as CSV files</p>
      </div>

      <DateRangeFilter value={dateFilter} onChange={setDateFilter} />

      {/* Reports Grid */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 16, marginBottom: 20 }}>
        {reports.map((rep, idx) => (
          <div
            key={idx}
            style={{
              background: "#ffffff",
              border: "1px solid #e8e8e8",
              borderRadius: 16,
              padding: 20,
              display: "flex",
              flexDirection: "column",
              justifyContent: "space-between",
              boxShadow: "0 2px 8px rgba(0,0,0,0.01)",
            }}
          >
            <div>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, marginBottom: 8 }}>
                <div style={{ width: 36, height: 36, borderRadius: 10, background: "#7c3aed12", color: "#7c3aed", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  {rep.icon}
                </div>
                <span style={{ fontSize: 10, fontWeight: 800, color: "#bbb", textTransform: "uppercase" }}>
                  {rep.count} records
                </span>
              </div>
              <div style={{ fontSize: 13, fontWeight: 800, color: "#1a1a1a", marginBottom: 4 }}>
                {rep.name}
              </div>
              <p style={{ fontSize: 11, color: "#666", lineHeight: 1.4, marginBottom: 16 }}>
                {rep.desc}
              </p>
            </div>

            <button
              onClick={rep.onClick}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 8,
                background: "#7c3aed",
                border: "none",
                borderRadius: 8,
                color: "#fff",
                fontSize: 11,
                fontWeight: 700,
                padding: "8px 12px",
                cursor: "pointer",
                transition: "background 0.2s",
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = "#6d28d9")}
              onMouseLeave={(e) => (e.currentTarget.style.background = "#7c3aed")}
            >
              <Download size={12} />
              Export CSV Report
            </button>
          </div>
        ))}
      </div>
    </motion.div>
  );
}
