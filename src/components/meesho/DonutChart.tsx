"use client";

import React, { useMemo } from "react";
import { motion } from "framer-motion";

interface DonutChartProps {
  data: Array<{ label: string; value: number; color: string }>;
  title?: string;
  centerLabel?: string;
  centerValue?: string;
  size?: number;
  showLegend?: boolean;
}

export function DonutChart({
  data,
  title,
  centerLabel = "Total",
  centerValue,
  size = 140,
  showLegend = true,
}: DonutChartProps) {
  const total = useMemo(() => {
    return data.reduce((sum, item) => sum + item.value, 0);
  }, [data]);

  const displayVal = centerValue || total.toString();

  // Compute arcs
  const segments = useMemo(() => {
    let accumulatedAngle = 0;
    const radius = 50;
    const circumference = 2 * Math.PI * radius;

    return data.map((item) => {
      const percentage = total === 0 ? 0 : item.value / total;
      const strokeLength = percentage * circumference;
      const strokeOffset = circumference - strokeLength + accumulatedAngle;
      accumulatedAngle -= strokeLength;

      return {
        ...item,
        percentage,
        strokeLength,
        strokeOffset,
        circumference,
      };
    });
  }, [data, total]);

  if (total === 0) {
    return (
      <div
        style={{
          background: "#ffffff",
          border: "1px solid #e8e8e8",
          borderRadius: 16,
          padding: 20,
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
        gap: 16,
      }}
    >
      {title && (
        <div style={{ fontSize: 13, fontWeight: 700, color: "#1a1a1a", letterSpacing: "-0.01em" }}>
          {title}
        </div>
      )}

      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 24, flexWrap: "wrap" }}>
        {/* SVG Circle */}
        <div style={{ position: "relative", width: size, height: size }}>
          <svg viewBox="0 0 120 120" width="100%" height="100%" style={{ transform: "rotate(-90deg)" }}>
            {segments.map((seg, idx) => (
              <motion.circle
                key={idx}
                cx="60"
                cy="60"
                r="50"
                fill="transparent"
                stroke={seg.color}
                strokeWidth="12"
                strokeDasharray={`${seg.strokeLength} ${seg.circumference}`}
                initial={{ strokeDashoffset: seg.circumference }}
                animate={{ strokeDashoffset: seg.strokeOffset }}
                transition={{ duration: 0.6, ease: "easeOut" }}
              />
            ))}
          </svg>

          {/* Center text */}
          <div
            style={{
              position: "absolute",
              top: "50%",
              left: "50%",
              transform: "translate(-50%, -50%)",
              textAlign: "center",
            }}
          >
            <div style={{ fontSize: 9, fontWeight: 700, color: "#999", textTransform: "uppercase", letterSpacing: "0.05em" }}>
              {centerLabel}
            </div>
            <div style={{ fontSize: 16, fontWeight: 800, color: "#1a1a1a", marginTop: 1 }}>
              {displayVal}
            </div>
          </div>
        </div>

        {/* Legend */}
        {showLegend && (
          <div style={{ display: "flex", flexDirection: "column", gap: 8, flex: 1, minWidth: 120 }}>
            {segments.map((seg, idx) => (
              <div key={idx} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <div style={{ width: 8, height: 8, borderRadius: "50%", background: seg.color, flexShrink: 0 }} />
                  <span style={{ fontSize: 11, fontWeight: 600, color: "#555" }}>{seg.label}</span>
                </div>
                <span style={{ fontSize: 11, fontWeight: 700, color: "#1a1a1a" }}>
                  {seg.value} ({Math.round(seg.percentage * 100)}%)
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
