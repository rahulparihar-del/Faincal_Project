"use client";

import React, { useMemo } from "react";
import { motion } from "framer-motion";

interface BarChartProps {
  data: Array<{ label: string; value: number; color?: string }>;
  height?: number;
  horizontal?: boolean;
  title?: string;
  valuePrefix?: string;
  valueSuffix?: string;
}

export function BarChart({
  data,
  height = 200,
  horizontal = false,
  title,
  valuePrefix = "",
  valueSuffix = "",
}: BarChartProps) {
  const maxVal = useMemo(() => {
    const vals = data.map((d) => d.value);
    const m = Math.max(...vals, 0);
    return m === 0 ? 1 : m;
  }, [data]);

  const fmt = (n: number) => {
    if (n >= 100000) return (n / 100000).toFixed(1) + "L";
    if (n >= 1000) return (n / 1000).toFixed(1) + "K";
    return n.toString();
  };

  if (!data || data.length === 0) {
    return (
      <div
        style={{
          background: "#ffffff",
          border: "1px solid #e8e8e8",
          borderRadius: 16,
          padding: 20,
          height,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "#aaa",
          fontSize: 12,
        }}
      >
        No chart data available
      </div>
    );
  }

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
        gap: 12,
      }}
    >
      {title && (
        <div style={{ fontSize: 13, fontWeight: 700, color: "#1a1a1a", letterSpacing: "-0.01em" }}>
          {title}
        </div>
      )}

      {horizontal ? (
        // Horizontal Bar Chart
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {data.map((item, idx) => {
            const pct = (item.value / maxVal) * 100;
            const barColor = item.color || "#7c3aed";

            return (
              <div key={idx} style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <div
                  style={{
                    width: 80,
                    fontSize: 10,
                    fontWeight: 600,
                    color: "#666",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {item.label}
                </div>
                <div style={{ flex: 1, height: 12, background: "#f5f5f5", borderRadius: 6, overflow: "hidden", position: "relative" }}>
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${pct}%` }}
                    transition={{ duration: 0.5, ease: "easeOut" }}
                    style={{
                      height: "100%",
                      background: barColor,
                      borderRadius: 6,
                    }}
                  />
                </div>
                <div style={{ width: 60, fontSize: 10, fontWeight: 700, color: "#1a1a1a", textAlign: "right" }}>
                  {valuePrefix}
                  {fmt(item.value)}
                  {valueSuffix}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        // Vertical Bar Chart
        <div style={{ display: "flex", height: height, alignItems: "flex-end", gap: 10, paddingTop: 10 }}>
          {data.map((item, idx) => {
            const pct = (item.value / maxVal) * 100;
            const barColor = item.color || "#7c3aed";

            return (
              <div
                key={idx}
                style={{
                  flex: 1,
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  height: "100%",
                  justifyContent: "flex-end",
                  gap: 8,
                }}
              >
                <div style={{ flex: 1, width: "100%", display: "flex", alignItems: "flex-end", justifyContent: "center", position: "relative" }}>
                  {/* Tooltip on hover */}
                  <div
                    className="chart-tooltip"
                    style={{
                      position: "absolute",
                      bottom: "calc(100% + 4px)",
                      background: "#1a1a1a",
                      color: "#fff",
                      fontSize: 8,
                      fontWeight: 700,
                      padding: "2px 6px",
                      borderRadius: 4,
                      opacity: 0,
                      transition: "opacity 0.15s",
                      pointerEvents: "none",
                      whiteSpace: "nowrap",
                      zIndex: 10,
                    }}
                  >
                    {valuePrefix}
                    {item.value.toLocaleString("en-IN")}
                    {valueSuffix}
                  </div>

                  <motion.div
                    initial={{ height: 0 }}
                    animate={{ height: `${pct}%` }}
                    transition={{ duration: 0.5, ease: "easeOut" }}
                    style={{
                      width: "60%",
                      minWidth: 10,
                      maxWidth: 32,
                      background: barColor,
                      borderTopLeftRadius: 4,
                      borderTopRightRadius: 4,
                      cursor: "pointer",
                    }}
                    onMouseEnter={(e) => {
                      const tooltip = e.currentTarget.parentElement?.querySelector(".chart-tooltip") as HTMLElement;
                      if (tooltip) tooltip.style.opacity = "1";
                    }}
                    onMouseLeave={(e) => {
                      const tooltip = e.currentTarget.parentElement?.querySelector(".chart-tooltip") as HTMLElement;
                      if (tooltip) tooltip.style.opacity = "0";
                    }}
                  />
                </div>
                <div
                  style={{
                    fontSize: 9,
                    fontWeight: 600,
                    color: "#888",
                    textAlign: "center",
                    width: "100%",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {item.label}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
