"use client";

import React from "react";
import { motion } from "framer-motion";
import { TrendingUp, TrendingDown } from "lucide-react";
import { MiniChart } from "./MiniChart";

interface Props {
  title: string;
  value: string | number;
  prefix?: string;
  suffix?: string;
  trend?: number;
  trendLabel?: string;
  color?: string;
  icon?: React.ReactNode;
  onClick?: () => void;
  sparkData?: number[];
  isProfit?: boolean;
  subtitle?: string;
}

export function KpiCard({
  title,
  value,
  prefix = "",
  suffix = "",
  trend,
  trendLabel = "",
  color = "#7c3aed",
  icon,
  onClick,
  sparkData,
  isProfit,
  subtitle,
}: Props) {
  const isPositive = trend !== undefined && trend >= 0;

  // If isProfit is true, color value directly based on sign
  let valueColor = "#1a1a1a";
  if (isProfit) {
    const rawVal = typeof value === "number" ? value : parseFloat(String(value).replace(/[^\d.-]/g, ""));
    if (!isNaN(rawVal)) {
      valueColor = rawVal > 0 ? "#10b981" : rawVal < 0 ? "#ef4444" : "#1a1a1a";
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.2 }}
      onClick={onClick}
      style={{
        background: "#ffffff",
        border: "1px solid #e8e8e8",
        borderRadius: 16,
        padding: 16,
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        boxShadow: "0 4px 12px rgba(0,0,0,0.01)",
        cursor: onClick ? "pointer" : "default",
        position: "relative",
        overflow: "hidden",
        minHeight: 110,
      }}
      whileHover={onClick ? { y: -2, boxShadow: "0 8px 24px rgba(0,0,0,0.06)" } : undefined}
    >
      {/* Top row */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div>
          <div
            style={{
              fontSize: 10,
              fontWeight: 700,
              color: "#888",
              textTransform: "uppercase",
              letterSpacing: "0.06em",
              marginBottom: 4,
            }}
          >
            {title}
          </div>
          <div style={{ fontSize: 20, fontWeight: 800, color: valueColor, letterSpacing: "-0.02em" }}>
            {prefix}
            {value}
            {suffix}
          </div>
          {subtitle && (
            <div style={{ fontSize: 10, color: "#aaa", marginTop: 2, fontWeight: 500 }}>
              {subtitle}
            </div>
          )}
        </div>

        {icon && (
          <div
            style={{
              width: 32,
              height: 32,
              borderRadius: 8,
              background: `${color}12`,
              color: color,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
            }}
          >
            {icon}
          </div>
        )}
      </div>

      {/* Bottom row (sparkline + trend) */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginTop: 12 }}>
        <div>
          {trend !== undefined && (
            <div style={{ display: "flex", alignItems: "center", gap: 3 }}>
              <span
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  fontSize: 10,
                  fontWeight: 700,
                  color: isPositive ? "#10b981" : "#ef4444",
                  background: isPositive ? "#10b98112" : "#ef444412",
                  padding: "2px 6px",
                  borderRadius: 6,
                }}
              >
                {isPositive ? <TrendingUp size={10} style={{ marginRight: 2 }} /> : <TrendingDown size={10} style={{ marginRight: 2 }} />}
                {isPositive ? "+" : ""}
                {trend.toFixed(1)}%
              </span>
              {trendLabel && (
                <span style={{ fontSize: 9, color: "#aaa", fontWeight: 500 }}>
                  {trendLabel}
                </span>
              )}
            </div>
          )}
        </div>

        {sparkData && sparkData.length > 1 && (
          <div style={{ paddingBottom: 2 }}>
            <MiniChart data={sparkData} color={color} />
          </div>
        )}
      </div>
    </motion.div>
  );
}
