"use client";

import React, { useState, useMemo } from "react";
import { motion } from "framer-motion";
import { useMMData, filterByDate } from "@/components/meesho/useMeeshoData";
import { DateRangeFilter } from "@/components/meesho/DateRangeFilter";
import { KpiCard } from "@/components/meesho/KpiCard";
import { DataTable } from "@/components/meesho/DataTable";
import { DonutChart } from "@/components/meesho/DonutChart";
import { DateFilter, MMClaim } from "@/components/meesho/types";

export default function ClaimsPage() {
  const { claims, isLoaded } = useMMData();

  const [dateFilter, setDateFilter] = useState<DateFilter>({
    range: "30days",
    from: "",
    to: "",
  });

  const filteredClaims = useMemo(() => filterByDate(claims, dateFilter), [claims, dateFilter]);

  const stats = useMemo(() => {
    const total = filteredClaims.length;
    const approved = filteredClaims.filter((c) => c.status === "approved").length;
    const pending = filteredClaims.filter((c) => c.status === "pending" || c.status === "processing").length;
    const rejected = filteredClaims.filter((c) => c.status === "rejected").length;

    const claimedAmt = filteredClaims.reduce((sum, c) => sum + c.amountClaimed, 0);
    const recoveredAmt = filteredClaims.reduce((sum, c) => sum + c.amountApproved, 0);

    const recoveryRate = claimedAmt ? (recoveredAmt / claimedAmt) * 100 : 0;

    return { total, approved, pending, rejected, claimedAmt, recoveredAmt, recoveryRate };
  }, [filteredClaims]);

  const statusSplit = useMemo(() => {
    return [
      { label: "Approved", value: stats.approved, color: "#10b981" },
      { label: "Pending", value: stats.pending, color: "#f59e0b" },
      { label: "Rejected", value: stats.rejected, color: "#ef4444" },
    ].filter((d) => d.value > 0);
  }, [stats]);

  const typeSplit = useMemo(() => {
    const map: Record<string, number> = {};
    filteredClaims.forEach((c) => {
      const label = c.claimType.replace("_", " ").toUpperCase();
      map[label] = (map[label] || 0) + 1;
    });

    return Object.entries(map).map(([label, value]) => ({
      label,
      value,
      color: label.includes("MISSING") ? "#3b82f6" : "#8b5cf6",
    }));
  }, [filteredClaims]);

  const columns = [
    { key: "id", label: "Claim ID", sortable: true },
    { key: "orderId", label: "Order ID", sortable: true },
    { key: "date", label: "Date Filed", sortable: true },
    {
      key: "claimType",
      label: "Claim Type",
      render: (row: MMClaim) => row.claimType.replace("_", " ").toUpperCase(),
    },
    {
      key: "amountClaimed",
      label: "Amount Claimed",
      align: "right" as const,
      render: (row: MMClaim) => `₹${row.amountClaimed.toLocaleString("en-IN")}`,
    },
    {
      key: "amountApproved",
      label: "Amount Approved",
      align: "right" as const,
      render: (row: MMClaim) => `₹${row.amountApproved.toLocaleString("en-IN")}`,
    },
    {
      key: "status",
      label: "Status",
      render: (row: MMClaim) => {
        const c = {
          approved: { bg: "#f0fdf4", color: "#16a34a", text: "Approved" },
          pending: { bg: "#fffbeb", color: "#d97706", text: "Pending" },
          processing: { bg: "#eff6ff", color: "#3b82f6", text: "Processing" },
          rejected: { bg: "#fef2f2", color: "#dc2626", text: "Rejected" },
        }[row.status] || { bg: "#f5f5f5", color: "#888", text: "Unknown" };

        return (
          <span style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", padding: "2px 8px", borderRadius: 20, background: c.bg, color: c.color }}>
            {c.text}
          </span>
        );
      },
    },
    { key: "notes", label: "Notes" },
  ];

  if (!isLoaded) {
    return (
      <div style={{ display: "flex", height: "100%", alignItems: "center", justifyContent: "center" }}>
        <div style={{ fontSize: 13, color: "#888" }}>Loading claims logs…</div>
      </div>
    );
  }

  return (
    <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
      {/* Header */}
      <div style={{ marginBottom: 20 }}>
        <h1 style={{ fontSize: 22, fontWeight: 800, color: "#1a1a1a", letterSpacing: "-0.02em" }}>Claim & Loss Recovery</h1>
        <p style={{ fontSize: 12, color: "#888", marginTop: 2 }}>Monitor ticket submissions for RTO/Missing items and recovery percentages</p>
      </div>

      <DateRangeFilter value={dateFilter} onChange={setDateFilter} />

      {/* KPI Cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 16, marginBottom: 20 }}>
        <KpiCard title="Total Claims" value={stats.total} color="#7c3aed" />
        <KpiCard title="Recovery Amount" value={stats.recoveredAmt.toLocaleString("en-IN")} prefix="₹" color="#10b981" />
        <KpiCard title="Claimed Amount" value={stats.claimedAmt.toLocaleString("en-IN")} prefix="₹" color="#64748b" />
        <KpiCard title="Recovery Rate %" value={`${stats.recoveryRate.toFixed(1)}%`} color={stats.recoveryRate >= 70 ? "#10b981" : "#f59e0b"} />
      </div>

      {/* Donut chart splits */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(360px, 1fr))", gap: 16, marginBottom: 20 }}>
        {statusSplit.length > 0 ? (
          <DonutChart title="Claim Status Ratio" data={statusSplit} size={120} />
        ) : (
          <div style={{ background: "#fff", border: "1px solid #e8e8e8", borderRadius: 16, padding: 20, display: "flex", alignItems: "center", justifyContent: "center", color: "#aaa", fontSize: 12 }}>
            No claim status stats
          </div>
        )}
        {typeSplit.length > 0 ? (
          <DonutChart title="Claims by Dispute Category" data={typeSplit} size={120} />
        ) : (
          <div style={{ background: "#fff", border: "1px solid #e8e8e8", borderRadius: 16, padding: 20, display: "flex", alignItems: "center", justifyContent: "center", color: "#aaa", fontSize: 12 }}>
            No claims data
          </div>
        )}
      </div>

      {/* Claims List Table */}
      <div style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: "#1a1a1a", marginBottom: 12 }}>Submissions Directory</div>
        <DataTable columns={columns} data={filteredClaims} pageSize={10} searchKeys={["id", "orderId", "notes"]} />
      </div>
    </motion.div>
  );
}
