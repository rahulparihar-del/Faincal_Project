"use client";

import React, { useState, useMemo } from "react";
import { motion } from "framer-motion";
import { useMMData, filterByDate } from "@/components/meesho/useMeeshoData";
import { DateRangeFilter } from "@/components/meesho/DateRangeFilter";
import { KpiCard } from "@/components/meesho/KpiCard";
import { DataTable } from "@/components/meesho/DataTable";
import { DonutChart } from "@/components/meesho/DonutChart";
import { BarChart } from "@/components/meesho/BarChart";
import { DateFilter, MMPaymentCycle } from "@/components/meesho/types";

export default function PaymentsPage() {
  const { paymentCycles, isLoaded } = useMMData();

  const [dateFilter, setDateFilter] = useState<DateFilter>({
    range: "30days",
    from: "",
    to: "",
  });

  const filteredCycles = useMemo(() => {
    // Custom date filter for payment cycles (matches cycleDate)
    const fromTime = dateFilter.from ? new Date(dateFilter.from + "T00:00:00").getTime() : 0;
    const toTime = dateFilter.to ? new Date(dateFilter.to + "T23:59:59").getTime() : Infinity;

    return paymentCycles.filter((c) => {
      const time = new Date(c.cycleDate + "T12:00:00").getTime();
      return time >= fromTime && time <= toTime;
    });
  }, [paymentCycles, dateFilter]);

  const stats = useMemo(() => {
    let settled = 0;
    let pending = 0;
    let fees = 0;
    let shipping = 0;
    let returnsDed = 0;
    let tds = 0;

    filteredCycles.forEach((c) => {
      if (c.status === "settled") {
        settled += c.netAmount;
      } else {
        pending += c.netAmount;
      }
      fees += c.platformFees;
      shipping += c.shippingDeductions;
      returnsDed += c.returnDeductions;
      tds += c.tds;
    });

    const totalDeductions = fees + shipping + returnsDed + tds;

    return { settled, pending, fees, shipping, returnsDed, tds, totalDeductions };
  }, [filteredCycles]);

  const deductionsDonut = useMemo(() => {
    return [
      { label: "Platform Fees", value: stats.fees, color: "#64748b" },
      { label: "Shipping Deductions", value: stats.shipping, color: "#0284c7" },
      { label: "Return Deductions", value: stats.returnsDed, color: "#ef4444" },
      { label: "TDS", value: stats.tds, color: "#f59e0b" },
    ].filter((d) => d.value > 0);
  }, [stats]);

  const monthlyPaymentsChart = useMemo(() => {
    return filteredCycles.map((c) => ({
      label: c.cycleDate.slice(5), // MM-DD
      value: c.netAmount,
    }));
  }, [filteredCycles]);

  const columns = [
    { key: "cycleDate", label: "Cycle Date", sortable: true },
    {
      key: "period",
      label: "Settlement Period",
      render: (row: MMPaymentCycle) => `${row.fromDate} to ${row.toDate}`,
    },
    {
      key: "grossAmount",
      label: "Gross",
      align: "right" as const,
      render: (row: MMPaymentCycle) => `₹${row.grossAmount.toLocaleString("en-IN")}`,
    },
    {
      key: "platformFees",
      label: "Fees",
      align: "right" as const,
      render: (row: MMPaymentCycle) => `₹${row.platformFees.toLocaleString("en-IN")}`,
    },
    {
      key: "shippingDeductions",
      label: "Shipping",
      align: "right" as const,
      render: (row: MMPaymentCycle) => `₹${row.shippingDeductions.toLocaleString("en-IN")}`,
    },
    {
      key: "netAmount",
      label: "Net Received",
      align: "right" as const,
      render: (row: MMPaymentCycle) => `₹${row.netAmount.toLocaleString("en-IN")}`,
    },
    {
      key: "status",
      label: "Status",
      render: (row: MMPaymentCycle) => {
        const colors = {
          settled: { bg: "#f0fdf4", border: "#bbf7d0", color: "#16a34a", text: "Settled" },
          processing: { bg: "#eff6ff", border: "#bfdbfe", color: "#3b82f6", text: "Processing" },
          pending: { bg: "#fffbeb", border: "#fde68a", color: "#d97706", text: "Pending" },
        };
        const c = colors[row.status] || colors.pending;
        return (
          <span
            style={{
              fontSize: 10,
              fontWeight: 700,
              textTransform: "uppercase",
              padding: "2px 8px",
              borderRadius: 20,
              background: c.bg,
              color: c.color,
              border: `1px solid ${c.border}`,
            }}
          >
            {c.text}
          </span>
        );
      },
    },
    { key: "utr", label: "UTR Number" },
  ];

  if (!isLoaded) {
    return (
      <div style={{ display: "flex", height: "100%", alignItems: "center", justifyContent: "center" }}>
        <div style={{ fontSize: 13, color: "#888" }}>Loading payouts data…</div>
      </div>
    );
  }

  return (
    <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
      {/* Header */}
      <div style={{ marginBottom: 20 }}>
        <h1 style={{ fontSize: 22, fontWeight: 800, color: "#1a1a1a", letterSpacing: "-0.02em" }}>Payments & Payouts</h1>
        <p style={{ fontSize: 12, color: "#888", marginTop: 2 }}>Monitor settlement cycles and platform fee deductions</p>
      </div>

      <DateRangeFilter value={dateFilter} onChange={setDateFilter} />

      {/* KPIs */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 16, marginBottom: 20 }}>
        <KpiCard title="Total Settled" value={stats.settled.toLocaleString("en-IN")} prefix="₹" color="#10b981" />
        <KpiCard title="Awaiting Settlement" value={stats.pending.toLocaleString("en-IN")} prefix="₹" color="#f59e0b" />
        <KpiCard title="Total Deductions" value={stats.totalDeductions.toLocaleString("en-IN")} prefix="₹" color="#ef4444" />
        <KpiCard title="TDS Deducted" value={stats.tds.toLocaleString("en-IN")} prefix="₹" color="#64748b" />
      </div>

      {/* Charts */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(360px, 1fr))", gap: 16, marginBottom: 20 }}>
        <BarChart title="Settlement Values by Cycle" data={monthlyPaymentsChart} height={180} valuePrefix="₹" />
        {deductionsDonut.length > 0 ? (
          <DonutChart title="Deductions Breakup" data={deductionsDonut} size={120} />
        ) : (
          <div
            style={{
              background: "#fff",
              border: "1px solid #e8e8e8",
              borderRadius: 16,
              padding: 20,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 12,
              color: "#aaa",
            }}
          >
            No deductions data
          </div>
        )}
      </div>

      {/* Table */}
      <div style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: "#1a1a1a", marginBottom: 12 }}>Settlement Cycle Statements</div>
        <DataTable columns={columns} data={filteredCycles} pageSize={10} searchKeys={["utr", "cycleDate"]} />
      </div>
    </motion.div>
  );
}
