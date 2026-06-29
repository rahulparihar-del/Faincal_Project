"use client";

import React, { useEffect } from "react";
import { DateFilter, DateRange } from "./types";

interface Props {
  value: DateFilter;
  onChange: (f: DateFilter) => void;
}

export function DateRangeFilter({ value, onChange }: Props) {
  const getDatesForRange = (range: DateRange): { from: string; to: string } => {
    const today = new Date();
    const formatDateStr = (d: Date) => d.toISOString().split("T")[0];

    switch (range) {
      case "today":
        return { from: formatDateStr(today), to: formatDateStr(today) };
      case "yesterday": {
        const yesterday = new Date();
        yesterday.setDate(today.getDate() - 1);
        return { from: formatDateStr(yesterday), to: formatDateStr(yesterday) };
      }
      case "7days": {
        const d7 = new Date();
        d7.setDate(today.getDate() - 6);
        return { from: formatDateStr(d7), to: formatDateStr(today) };
      }
      case "30days": {
        const d30 = new Date();
        d30.setDate(today.getDate() - 29);
        return { from: formatDateStr(d30), to: formatDateStr(today) };
      }
      case "thisMonth": {
        const start = new Date(today.getFullYear(), today.getMonth(), 1);
        return { from: formatDateStr(start), to: formatDateStr(today) };
      }
      case "lastMonth": {
        const start = new Date(today.getFullYear(), today.getMonth() - 1, 1);
        const end = new Date(today.getFullYear(), today.getMonth(), 0);
        return { from: formatDateStr(start), to: formatDateStr(end) };
      }
      case "custom":
      default:
        return { from: value.from || formatDateStr(today), to: value.to || formatDateStr(today) };
    }
  };

  const handlePillClick = (range: DateRange) => {
    if (range === "custom") {
      onChange({ ...value, range: "custom" });
    } else {
      const dates = getDatesForRange(range);
      onChange({ range, ...dates });
    }
  };

  // Sync dates on mount if not custom
  useEffect(() => {
    if (value.range !== "custom" && (!value.from || !value.to)) {
      const dates = getDatesForRange(value.range);
      onChange({ range: value.range, ...dates });
    }
  }, []);

  const pills: { label: string; range: DateRange }[] = [
    { label: "Today", range: "today" },
    { label: "Yesterday", range: "yesterday" },
    { label: "Last 7 Days", range: "7days" },
    { label: "Last 30 Days", range: "30days" },
    { label: "This Month", range: "thisMonth" },
    { label: "Last Month", range: "lastMonth" },
    { label: "Custom Range", range: "custom" },
  ];

  return (
    <div
      style={{
        background: "#ffffff",
        border: "1px solid #e8e8e8",
        borderRadius: 14,
        padding: "10px 16px",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 16,
        marginBottom: 20,
        boxShadow: "0 2px 8px rgba(0,0,0,0.02)",
        flexWrap: "wrap",
      }}
    >
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
        {pills.map((pill) => {
          const isActive = value.range === pill.range;
          return (
            <button
              key={pill.range}
              onClick={() => handlePillClick(pill.range)}
              style={{
                fontSize: 11,
                fontWeight: 600,
                padding: "6px 12px",
                borderRadius: 8,
                border: isActive ? "1px solid #7c3aed" : "1px solid #e8e8e8",
                background: isActive ? "#7c3aed" : "transparent",
                color: isActive ? "#ffffff" : "#555",
                cursor: "pointer",
                transition: "all 0.15s ease",
              }}
            >
              {pill.label}
            </button>
          );
        })}
      </div>

      {value.range === "custom" && (
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <input
            type="date"
            value={value.from}
            onChange={(e) => onChange({ ...value, from: e.target.value })}
            style={{
              padding: "5px 10px",
              fontSize: 11,
              fontWeight: 600,
              borderRadius: 6,
              border: "1px solid #e8e8e8",
              color: "#333",
              outline: "none",
            }}
          />
          <span style={{ fontSize: 11, color: "#888", fontWeight: 600 }}>to</span>
          <input
            type="date"
            value={value.to}
            onChange={(e) => onChange({ ...value, to: e.target.value })}
            style={{
              padding: "5px 10px",
              fontSize: 11,
              fontWeight: 600,
              borderRadius: 6,
              border: "1px solid #e8e8e8",
              color: "#333",
              outline: "none",
            }}
          />
        </div>
      )}
    </div>
  );
}
