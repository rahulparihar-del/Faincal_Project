"use client";

import React from "react";

interface Props {
  score: number;
  label?: string;
}

export function HealthScoreMeter({ score, label = "Business Health" }: Props) {
  const clampedScore = Math.max(0, Math.min(100, score));

  // Determine color and grade
  let color = "#ef4444"; // Red
  let grade = "F";
  let desc = "Needs immediate optimization. High returns/RTOs or low margins detected.";

  if (clampedScore >= 85) {
    color = "#10b981"; // Green
    grade = "A+";
    desc = "Excellent operational efficiency. High ROAS, solid margins, and low return rates.";
  } else if (clampedScore >= 70) {
    color = "#22c55e"; // Greenish
    grade = "A";
    desc = "Good health. Strong overall profitability, normal return trends.";
  } else if (clampedScore >= 55) {
    color = "#eab308"; // Yellow
    grade = "B";
    desc = "Moderate health. Review ad campaign spends and checkout RTO rates.";
  } else if (clampedScore >= 40) {
    color = "#f97316"; // Orange
    grade = "C";
    desc = "Low health. Platform costs or shipping claims may be dragging profit down.";
  }

  // Semicircle gauge calculation
  const radius = 40;
  const strokeWidth = 8;
  const circumference = Math.PI * radius; // half circle length
  const strokeDashoffset = circumference - (clampedScore / 100) * circumference;

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
        alignItems: "center",
        justifyContent: "space-between",
        gap: 16,
      }}
    >
      <div
        style={{
          width: "100%",
          fontSize: 13,
          fontWeight: 700,
          color: "#1a1a1a",
          borderBottom: "1px solid #f0f0f0",
          paddingBottom: 8,
          textAlign: "left",
        }}
      >
        {label}
      </div>

      {/* Gauge Semicircle */}
      <div style={{ position: "relative", width: 120, height: 75, marginTop: 10 }}>
        <svg viewBox="0 0 100 60" width="100%" height="100%">
          {/* Background track */}
          <path
            d="M 10 50 A 40 40 0 0 1 90 50"
            fill="transparent"
            stroke="#f0f0f0"
            strokeWidth={strokeWidth}
            strokeLinecap="round"
          />
          {/* Active progress */}
          <path
            d="M 10 50 A 40 40 0 0 1 90 50"
            fill="transparent"
            stroke={color}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            style={{ transition: "stroke-dashoffset 0.8s ease, stroke 0.8s ease" }}
          />
        </svg>

        {/* Score display */}
        <div
          style={{
            position: "absolute",
            bottom: 6,
            left: "50%",
            transform: "translateX(-50%)",
            textAlign: "center",
          }}
        >
          <div style={{ fontSize: 24, fontWeight: 900, color: "#1a1a1a", letterSpacing: "-0.03em" }}>
            {clampedScore}
          </div>
          <div
            style={{
              fontSize: 10,
              fontWeight: 800,
              color: color,
              textTransform: "uppercase",
              letterSpacing: "0.04em",
              marginTop: -2,
            }}
          >
            Grade {grade}
          </div>
        </div>
      </div>

      {/* Metric explanation */}
      <div style={{ textAlign: "center" }}>
        <div style={{ fontSize: 11, color: "#555", lineHeight: 1.4, maxWidth: 180 }}>
          {desc}
        </div>
      </div>
    </div>
  );
}
