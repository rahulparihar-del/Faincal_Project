"use client";

import React from "react";
import { motion } from "framer-motion";

interface Props {
  revenue: number;
  platformFees: number;
  shippingCharges: number;
  adSpend: number;
  returnCharges: number;
  rtoLoss: number;
  claimsRecovery: number;
  cogs: number;
}

export function MoneyFlow({
  revenue,
  platformFees,
  shippingCharges,
  adSpend,
  returnCharges,
  rtoLoss,
  claimsRecovery,
  cogs,
}: Props) {
  const netEarnings =
    revenue -
    platformFees -
    shippingCharges -
    adSpend -
    returnCharges -
    rtoLoss +
    claimsRecovery -
    cogs;

  const totalDeductions =
    platformFees + shippingCharges + adSpend + returnCharges + rtoLoss + cogs;

  const steps = [
    { label: "Sales Revenue", amount: revenue, type: "start" },
    { label: "COGS (Product Cost)", amount: -cogs, type: "deduct" },
    { label: "Platform Fees", amount: -platformFees, type: "deduct" },
    { label: "Shipping Charges", amount: -shippingCharges, type: "deduct" },
    { label: "Ad Spend", amount: -adSpend, type: "deduct" },
    { label: "Return Charges", amount: -returnCharges, type: "deduct" },
    { label: "RTO Losses", amount: -rtoLoss, type: "deduct" },
    { label: "Claims Recoveries", amount: claimsRecovery, type: "add" },
    { label: "Net Earnings", amount: netEarnings, type: "end" },
  ];

  const maxVal = Math.max(
    revenue,
    totalDeductions,
    Math.abs(netEarnings),
    1
  );

  return (
    <div
      style={{
        background: "#ffffff",
        border: "1px solid #e8e8e8",
        borderRadius: 16,
        padding: 20,
        boxShadow: "0 2px 8px rgba(0,0,0,0.01)",
        display: "flex",
        flexDirection: "column",
        gap: 16,
      }}
    >
      <div
        style={{
          fontSize: 13,
          fontWeight: 700,
          color: "#1a1a1a",
          borderBottom: "1px solid #f0f0f0",
          paddingBottom: 8,
        }}
      >
        Financial Waterfall (Sales to Payout Flow)
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {steps.map((step, idx) => {
          if (step.amount === 0 && step.type !== "end") return null;

          const absoluteVal = Math.abs(step.amount);
          const pct = (absoluteVal / maxVal) * 100;

          let barColor = "#7c3aed"; // Violet default (start)
          if (step.type === "deduct") barColor = "#ef4444"; // Red for costs
          if (step.type === "add") barColor = "#10b981"; // Green for claim recoveries
          if (step.type === "end") barColor = step.amount >= 0 ? "#10b981" : "#ef4444";

          const amountFormatted =
            step.amount >= 0
              ? `+₹${step.amount.toLocaleString("en-IN")}`
              : `-₹${absoluteVal.toLocaleString("en-IN")}`;

          return (
            <div key={idx} style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <div
                style={{
                  width: 130,
                  fontSize: 11,
                  fontWeight: step.type === "end" || step.type === "start" ? 700 : 600,
                  color: step.type === "end" ? "#1a1a1a" : "#666",
                }}
              >
                {step.label}
              </div>

              <div style={{ flex: 1, height: 16, display: "flex", alignItems: "center" }}>
                <div style={{ width: "100%", height: 10, background: "#f5f5f5", borderRadius: 5, overflow: "hidden", position: "relative" }}>
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${pct}%` }}
                    transition={{ duration: 0.5, ease: "easeOut" }}
                    style={{
                      height: "100%",
                      background: barColor,
                      borderRadius: 5,
                    }}
                  />
                </div>
              </div>

              <div
                style={{
                  width: 90,
                  fontSize: 11,
                  fontWeight: 700,
                  color: step.type === "deduct" ? "#ef4444" : step.type === "add" ? "#10b981" : "#1a1a1a",
                  textAlign: "right",
                }}
              >
                {step.amount === netEarnings && step.amount >= 0 ? `₹${step.amount.toLocaleString("en-IN")}` : amountFormatted}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
