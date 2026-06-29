"use client";

import React from "react";
import { Sparkles, ArrowRight } from "lucide-react";

interface Insight {
  type: "success" | "warning" | "danger" | "info";
  title: string;
  description: string;
  action?: string;
  value?: string;
}

interface Props {
  insights: Insight[];
  title?: string;
}

export function AiInsightPanel({ insights, title = "AI Copilot Insights" }: Props) {
  const TYPE_META = {
    success: { bg: "#f0fdf4", border: "#bbf7d0", color: "#16a34a", dot: "#22c55e", label: "Opportunity" },
    warning: { bg: "#fffbeb", border: "#fde68a", color: "#d97706", dot: "#f59e0b", label: "Attention" },
    danger: { bg: "#fef2f2", border: "#fecaca", color: "#dc2626", dot: "#ef4444", label: "Critical Loss" },
    info: { bg: "#f0f9ff", border: "#bae6fd", color: "#0284c7", dot: "#0ea5e9", label: "Info" },
  };

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
      <div style={{ display: "flex", alignItems: "center", gap: 8, borderBottom: "1px solid #f0f0f0", paddingBottom: 10 }}>
        <Sparkles size={16} style={{ color: "#7c3aed" }} />
        <span style={{ fontSize: 13, fontWeight: 700, color: "#1a1a1a" }}>{title}</span>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {insights.length === 0 ? (
          <div style={{ fontSize: 11, color: "#888", textAlign: "center", padding: "12px 0" }}>
            No recommendations generated. Keep scanning and entering data.
          </div>
        ) : (
          insights.map((ins, idx) => {
            const meta = TYPE_META[ins.type];
            return (
              <div
                key={idx}
                style={{
                  background: meta.bg,
                  border: `1px solid ${meta.border}`,
                  borderRadius: 12,
                  padding: "12px 14px",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "flex-start",
                  gap: 12,
                  flexWrap: "wrap",
                }}
              >
                <div style={{ display: "flex", gap: 10, flex: 1 }}>
                  {/* Indicator Dot */}
                  <div
                    style={{
                      width: 8,
                      height: 8,
                      borderRadius: "50%",
                      background: meta.dot,
                      marginTop: 5,
                      flexShrink: 0,
                    }}
                  />
                  <div>
                    <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 2 }}>
                      <span style={{ fontSize: 9, fontWeight: 700, color: meta.color, textTransform: "uppercase", letterSpacing: "0.04em" }}>
                        {meta.label}
                      </span>
                      {ins.value && (
                        <span
                          style={{
                            fontSize: 10,
                            fontWeight: 700,
                            color: "#1a1a1a",
                            background: "rgba(0,0,0,0.05)",
                            padding: "1px 5px",
                            borderRadius: 4,
                          }}
                        >
                          {ins.value}
                        </span>
                      )}
                    </div>
                    <div style={{ fontSize: 12, fontWeight: 700, color: "#1a1a1a" }}>
                      {ins.title}
                    </div>
                    <div style={{ fontSize: 11, color: "#555", marginTop: 4, lineHeight: 1.5 }}>
                      {ins.description}
                    </div>
                  </div>
                </div>

                {ins.action && (
                  <button
                    style={{
                      fontSize: 10,
                      fontWeight: 700,
                      color: meta.color,
                      background: "transparent",
                      border: "none",
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      gap: 4,
                      padding: 0,
                      marginTop: 4,
                    }}
                  >
                    {ins.action}
                    <ArrowRight size={10} />
                  </button>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
