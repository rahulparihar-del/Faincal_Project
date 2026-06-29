"use client";

import React, { useState, useMemo } from "react";
import { motion } from "framer-motion";
import { Download, FileSpreadsheet, FileText } from "lucide-react";
import { useMMData, filterByDate } from "@/components/meesho/useMeeshoData";
import { DateRangeFilter } from "@/components/meesho/DateRangeFilter";
import { DateFilter } from "@/components/meesho/types";
import { calculateMetrics, calculateCourierStats, calculateSkuStats } from "@/lib/data/analytics";

export default function ReportsPage() {
  const { orders, returns, adCampaigns, paymentCycles, claims, inventory, settings, isLoaded } = useMMData();

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

  // Compute central metrics for statements
  const metrics = useMemo(() => {
    return calculateMetrics(filteredOrders, filteredReturns, claims);
  }, [filteredOrders, filteredReturns, claims]);

  const stats = useMemo(() => {
    return {
      ordersCount: filteredOrders.length,
      returnsCount: filteredReturns.length,
      campaignsCount: filteredCampaigns.length,
      paymentsCount: paymentCycles.length,
      claimsCount: claims.length,
      inventoryCount: inventory.length
    };
  }, [filteredOrders, filteredReturns, filteredCampaigns, paymentCycles, claims, inventory]);

  // Universal CSV Downloader
  const downloadCSV = (filename: string, headers: string[], rows: string[][]) => {
    const csvContent =
      "data:text/csv;charset=utf-8,\uFEFF" +
      [headers.join(","), ...rows.map((e) => e.map((val) => `"${String(val).replace(/"/g, '""')}"`).join(","))].join("\n");

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `${filename}_${dateFilter.range}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Universal PDF Print-Preview Generator
  const downloadPDF = (title: string, headers: string[], rows: string[][]) => {
    const printWindow = window.open("", "_blank");
    if (!printWindow) {
      alert("Popup blocker active. Please allow popups to view report sheets.");
      return;
    }

    const rowsHtml = rows.map(r => `
      <tr>
        ${r.map(val => `<td style="padding: 10px; border-bottom: 1px solid #e2e8f0; font-size: 11px; color: #334155;">${val}</td>`).join("")}
      </tr>
    `).join("");

    const headersHtml = headers.map(h => `
      <th style="padding: 12px 10px; background: #7c3aed; color: #ffffff; text-align: left; font-size: 11px; font-weight: 800; border-bottom: 2px solid #e2e8f0;">${h}</th>
    `).join("");

    printWindow.document.write(`
      <html>
        <head>
          <title>${title}</title>
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; padding: 40px; background: #f8fafc; margin: 0; }
            .container { max-width: 900px; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 12px; padding: 30px; margin: 0 auto; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05); }
            table { width: 100%; border-collapse: collapse; margin-top: 24px; }
            h1 { font-size: 20px; font-weight: 800; color: #0f172a; margin: 0 0 6px 0; }
            p { font-size: 11px; color: #64748b; margin: 0 0 24px 0; }
            .print-btn { background: #7c3aed; color: white; border: none; padding: 8px 16px; font-size: 11px; font-weight: 700; border-radius: 8px; cursor: pointer; margin-bottom: 20px; }
            @media print {
              .print-btn { display: none; }
              body { background: #ffffff; padding: 0; }
              .container { border: none; box-shadow: none; padding: 0; }
            }
          </style>
        </head>
        <body>
          <div class="container">
            <button class="print-btn" onclick="window.print()">Print / Save as PDF</button>
            <h1>${title}</h1>
            <p>Generated on ${new Date().toLocaleDateString("en-IN")} | Date Filter Range: ${dateFilter.range} (${dateFilter.from || "Start"} to ${dateFilter.to || "End"})</p>
            <table>
              <thead>
                <tr>${headersHtml}</tr>
              </thead>
              <tbody>
                ${rowsHtml}
              </tbody>
            </table>
          </div>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  // 1. Executive Report
  const getExecutiveData = () => {
    const headers = ["Executive Metric Parameter", "Metric Value"];
    const rows = [
      ["Gross Sales Revenue", `INR ${metrics.revenue.toLocaleString("en-IN")}`],
      ["Net Earnings Profit", `INR ${metrics.netProfit.toLocaleString("en-IN")}`],
      ["EBITDA Margin Percentage", `${metrics.margin.toFixed(1)}%`],
      ["Total Logged Orders", `${metrics.totalOrders} units`],
      ["Delivered Fulfilled Orders", `${metrics.deliveredOrders} units`],
      ["Returns Ratio", `${metrics.returnRate.toFixed(1)}%`],
      ["RTO Delivery Failure Ratio", `${metrics.rtoRate.toFixed(1)}%`],
      ["Marketing Ad Spends", `INR ${metrics.adsSpend.toLocaleString("en-IN")}`],
      ["Blended ROAS Factor", `${metrics.roas.toFixed(2)}x`],
    ];
    return { headers, rows };
  };

  // 2. Profit & Loss
  const getPnLData = () => {
    const headers = ["Financial Ledger Item", "Amount (INR)"];
    const rows = [
      ["Gross Sales Revenue", String(metrics.revenue)],
      ["Less: Cost of Goods Sold (COGS)", String(-metrics.cogs)],
      ["Gross Profit Margin", String(metrics.grossProfit)],
      ["Less: Platform Commissions", String(-metrics.platformFees)],
      ["Less: Outward Logistics Shipping", String(-metrics.shippingCharges)],
      ["Less: Direct Ad Marketing costs", String(-metrics.adsSpend)],
      ["Less: Customer Return Shipping", String(-metrics.returnCharges)],
      ["Less: RTO Logistics loss", String(-metrics.rtoLoss)],
      ["Add: safety Claim Recovery", String(metrics.claimRecovery)],
      ["Net EBITDA Profit Payout", String(metrics.netProfit)],
    ];
    return { headers, rows };
  };

  // 3. Orders Report
  const getOrdersData = () => {
    const headers = ["Order No", "Date", "SKU", "Product", "Qty", "Selling Price", "Courier", "Destination", "Status"];
    const rows = filteredOrders.map((o) => [
      o.orderNo,
      o.date,
      o.sku,
      o.productName,
      String(o.qty),
      String(o.sellingPrice),
      o.courier,
      `${o.city}, ${o.state}`,
      o.status.toUpperCase(),
    ]);
    return { headers, rows };
  };

  // 4. Payments
  const getPaymentsData = () => {
    const headers = ["Settlement Date", "From Period", "To Period", "Gross Amount", "Comm. Fees", "TDS Deducted", "Shipping Deduct.", "Net Payout", "Status", "UTR Ref"];
    const rows = paymentCycles.map((p) => [
      p.cycleDate,
      p.fromDate,
      p.toDate,
      String(p.grossAmount),
      String(p.platformFees),
      String(p.tds),
      String(p.shippingDeductions),
      String(p.netAmount),
      p.status.toUpperCase(),
      p.utr || "-",
    ]);
    return { headers, rows };
  };

  // 5. Returns
  const getReturnsData = () => {
    const headers = ["Order Ref", "Log Date", "SKU", "Product Description", "Return Reason", "Carrier", "Type (RTO)", "Financial Loss"];
    const rows = filteredReturns.map((r) => [
      r.orderId,
      r.date,
      r.sku,
      r.productName,
      r.reason.replace("_", " "),
      r.courier,
      r.isRTO ? "RTO" : "CUSTOMER",
      String(r.financialLoss),
    ]);
    return { headers, rows };
  };

  // 6. Courier Report
  const getCourierData = () => {
    const headers = ["Courier Partner", "Shipments", "Delivered", "Failed", "RTO", "Success Rate", "Avg Days", "Avg Ship Cost", "RTO Loss"];
    const stats = calculateCourierStats(filteredOrders, filteredReturns);
    const rows = stats.map((c) => [
      c.courier,
      String(c.total),
      String(c.delivered),
      String(c.failed),
      String(c.rto),
      `${c.successRate.toFixed(1)}%`,
      `${c.avgDeliveryDays.toFixed(1)} days`,
      `₹${Math.round(c.totalCost / c.total)}`,
      `₹${c.financialLoss}`,
    ]);
    return { headers, rows };
  };

  // 7. Product Performance
  const getProductData = () => {
    const headers = ["SKU Code", "Product Name", "Units Ordered", "Gross Revenue", "Net Profit Contribution", "Returns Ratio", "RTO Ratio", "Product Health Index"];
    const stats = calculateSkuStats(filteredOrders, filteredReturns, settings, adCampaigns);
    const rows = stats.map((s) => [
      s.sku,
      s.productName,
      String(s.orders),
      `₹${s.revenue.toLocaleString()}`,
      `₹${s.netProfit.toLocaleString()}`,
      `${s.returnRate.toFixed(1)}%`,
      `${s.rtoRate.toFixed(1)}%`,
      String(s.healthScore),
    ]);
    return { headers, rows };
  };

  // 8. Inventory Report
  const getInventoryData = () => {
    const headers = ["SKU Code", "Product Name Description", "Current Stock", "Reserved Stock", "Available Sellable", "Sales Velocity", "Days Left", "Sug. Reorder Date", "Health Status"];
    const rows = inventory.map((i) => [
      i.sku,
      i.productName,
      String(i.currentStock),
      String(i.reservedStock),
      String(i.availableStock),
      `${i.avgDailySales.toFixed(1)}/day`,
      `${i.daysRemaining} days`,
      i.suggestedReorderDate || "Stock Safe",
      i.health.replace("_", " ").toUpperCase(),
    ]);
    return { headers, rows };
  };

  if (!isLoaded) {
    return (
      <div style={{ display: "flex", height: "100%", alignItems: "center", justifyContent: "center" }}>
        <div style={{ fontSize: 13, color: "#888" }}>Setting up export profiles…</div>
      </div>
    );
  }

  const reportsConfig = [
    { name: "Executive Summary Report", desc: "Monitors gross sales, margins, conversion rates, and blended marketing ROAS factors", icon: <FileText size={20} />, count: 9, getData: getExecutiveData, fileBase: "meesho_executive_summary" },
    { name: "Profitability & Loss Audit", desc: "Waterfall summary of COGS, fees, logistics, and safety claim payout returns", icon: <FileSpreadsheet size={20} />, count: 10, getData: getPnLData, fileBase: "meesho_profit_and_loss" },
    { name: "Orders Ledger Statement", desc: "Individual tracking logs for active shipments, payment modes, and destinations", icon: <FileSpreadsheet size={20} />, count: stats.ordersCount, getData: getOrdersData, fileBase: "meesho_orders_statement" },
    { name: "Bank Settlements Ledger", desc: "UTR settlement records, TDS claims, and deduction schedules", icon: <FileSpreadsheet size={20} />, count: stats.paymentsCount, getData: getPaymentsData, fileBase: "meesho_settlement_ledger" },
    { name: "Returns & RTO Statement", desc: "Return shipping logs, RTO failures, courier loss amounts, and customer reasons", icon: <FileSpreadsheet size={20} />, count: stats.returnsCount, getData: getReturnsData, fileBase: "meesho_returns_statement" },
    { name: "Courier Performance Report", desc: "Comparative partner metrics on speeds, rates, costs, and RTO losses", icon: <FileSpreadsheet size={20} />, count: stats.ordersCount > 0 ? 5 : 0, getData: getCourierData, fileBase: "meesho_courier_report" },
    { name: "Product performance Report", desc: "SKU-specific revenues, profit contributions, and health indexes", icon: <FileSpreadsheet size={20} />, count: stats.ordersCount > 0 ? 3 : 0, getData: getProductData, fileBase: "meesho_sku_performance" },
    { name: "Inventory Intelligence Report", desc: "Stock counts, reserve buffers, days remaining, and suggested reorder alarms", icon: <FileSpreadsheet size={20} />, count: stats.inventoryCount, getData: getInventoryData, fileBase: "meesho_inventory_health" },
  ];

  return (
    <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
      {/* Header */}
      <div style={{ marginBottom: 20 }}>
        <h1 style={{ fontSize: 22, fontWeight: 800, color: "#1a1a1a", letterSpacing: "-0.02em" }}>Reports & Universal Reconciliation</h1>
        <p style={{ fontSize: 12, color: "#888", marginTop: 2 }}>Export operational ledgers, tax P&Ls, and UTR statements in CSV and PDF formats</p>
      </div>

      <DateRangeFilter value={dateFilter} onChange={setDateFilter} />

      {/* Reports Grid */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 16, marginBottom: 20 }}>
        {reportsConfig.map((rep, idx) => (
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
                  {rep.count} lines
                </span>
              </div>
              <div style={{ fontSize: 13, fontWeight: 800, color: "#1a1a1a", marginBottom: 4 }}>
                {rep.name}
              </div>
              <p style={{ fontSize: 11, color: "#666", lineHeight: 1.4, marginBottom: 16 }}>
                {rep.desc}
              </p>
            </div>

            {/* Export Actions */}
            <div style={{ display: "flex", gap: 8 }}>
              {/* CSV */}
              <button
                onClick={() => {
                  const data = rep.getData();
                  downloadCSV(rep.fileBase, data.headers, data.rows);
                }}
                style={{
                  flex: 1,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 6,
                  background: "#7c3aed",
                  border: "none",
                  borderRadius: 8,
                  color: "#fff",
                  fontSize: 10,
                  fontWeight: 700,
                  padding: "8px 0",
                  cursor: "pointer",
                  transition: "background 0.2s",
                }}
                onMouseEnter={(e) => (e.currentTarget.style.background = "#6d28d9")}
                onMouseLeave={(e) => (e.currentTarget.style.background = "#7c3aed")}
              >
                <Download size={11} />
                CSV
              </button>

              {/* PDF */}
              <button
                onClick={() => {
                  const data = rep.getData();
                  downloadPDF(rep.name, data.headers, data.rows);
                }}
                style={{
                  flex: 1,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 6,
                  background: "#f1f5f9",
                  border: "1px solid #cbd5e1",
                  borderRadius: 8,
                  color: "#334155",
                  fontSize: 10,
                  fontWeight: 700,
                  padding: "8px 0",
                  cursor: "pointer",
                  transition: "background 0.2s",
                }}
                onMouseEnter={(e) => (e.currentTarget.style.background = "#e2e8f0")}
                onMouseLeave={(e) => (e.currentTarget.style.background = "#f1f5f9")}
              >
                <FileText size={11} />
                PDF
              </button>
            </div>
          </div>
        ))}
      </div>
    </motion.div>
  );
}
