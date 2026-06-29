"use client";

import React from "react";

interface Props {
  data: number[];
  color?: string;
  width?: number;
  height?: number;
}

export function MiniChart({ data, color = "#7c3aed", width = 80, height = 28 }: Props) {
  if (!data || data.length < 2) return null;

  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min === 0 ? 1 : max - min;

  const points = data
    .map((val, index) => {
      const x = (index / (data.length - 1)) * width;
      const y = height - ((val - min) / range) * height;
      return `${x},${y}`;
    })
    .join(" ");

  const lastIndex = data.length - 1;
  const lastX = width;
  const lastY = height - ((data[lastIndex] - min) / range) * height;

  return (
    <svg width={width} height={height} style={{ overflow: "visible" }}>
      <polyline
        fill="none"
        stroke={color}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        points={points}
      />
      <circle cx={lastX} cy={lastY} r="3" fill={color} stroke="#ffffff" strokeWidth="1" />
    </svg>
  );
}
