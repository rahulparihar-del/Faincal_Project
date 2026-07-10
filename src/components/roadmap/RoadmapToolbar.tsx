"use client";

import React from "react";
import { Plus, ZoomIn, ZoomOut, Maximize2, LayoutTemplate, Download } from "lucide-react";
import { useTheme } from "@/context/ThemeContext";

interface CanvasTransform {
  x: number;
  y: number;
  scale: number;
}

interface Props {
  onAddNode: () => void;
  canvasTransform: CanvasTransform;
  onTransformChange: (t: CanvasTransform) => void;
  onAutoLayout: () => void;
  onResetView: () => void;
  onExportPng: () => void;
  nodeCount: number;
  edgeCount: number;
}

export function RoadmapToolbar({
  onAddNode,
  canvasTransform,
  onTransformChange,
  onAutoLayout,
  onResetView,
  onExportPng,
  nodeCount,
  edgeCount,
}: Props) {
  const { theme } = useTheme();
  const isDark = theme === "dark";
  const zoom = Math.round(canvasTransform.scale * 100);

  const zoomIn = () => {
    const s = Math.min(canvasTransform.scale * 1.2, 3);
    onTransformChange({ ...canvasTransform, scale: s });
  };

  const zoomOut = () => {
    const s = Math.max(canvasTransform.scale * 0.8, 0.2);
    onTransformChange({ ...canvasTransform, scale: s });
  };

  return (
    <div
      style={{
        position: "absolute",
        top: 16,
        left: 16,
        zIndex: 30,
        display: "flex",
        flexDirection: "column",
        gap: 6,
      }}
    >
      {/* Local Styles for precise light/dark rendering regardless of Tailwind compilation */}
      <style>{`
        .rm-tb-btn {
          color: ${isDark ? "#d4d4d4" : "#555555"} !important;
          background: transparent;
          border: 1px solid transparent;
          transition: all 0.15s ease;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
        }
        .rm-tb-btn:hover {
          color: ${isDark ? "#ffffff" : "#000000"} !important;
          background: ${isDark ? "#2c2c2e" : "#f0f0f0"} !important;
          border-color: ${isDark ? "#3a3a3c" : "#e0e0e0"} !important;
        }
        .rm-tb-btn:active {
          background: ${isDark ? "#3a3a3c" : "#e8e8e8"} !important;
        }
      `}</style>

      {/* Add node */}
      <button
        onClick={onAddNode}
        title="Add node (or double-click canvas)"
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          padding: "8px 14px 8px 10px",
          background: "linear-gradient(135deg, #7c3aed, #5b21b6)",
          border: "1px solid rgba(124,58,237,0.3)",
          borderRadius: 12,
          color: "white",
          fontSize: 12,
          fontWeight: 700,
          cursor: "pointer",
          boxShadow: isDark 
            ? "0 4px 16px rgba(124,58,237,0.2)"
            : "0 4px 16px rgba(124,58,237,0.3)",
          transition: "all 0.2s",
          letterSpacing: "-0.01em",
          whiteSpace: "nowrap",
        }}
        onMouseEnter={(e) => { 
          e.currentTarget.style.boxShadow = isDark 
            ? "0 6px 24px rgba(124,58,237,0.35)"
            : "0 6px 24px rgba(124,58,237,0.45)"; 
          e.currentTarget.style.transform = "translateY(-1px)"; 
        }}
        onMouseLeave={(e) => { 
          e.currentTarget.style.boxShadow = isDark
            ? "0 4px 16px rgba(124,58,237,0.2)"
            : "0 4px 16px rgba(124,58,237,0.3)"; 
          e.currentTarget.style.transform = "translateY(0)"; 
        }}
      >
        <Plus size={15} />
        Add Node
      </button>

      {/* Control group */}
      <div
        style={{
          background: isDark ? "#1e1e1e" : "#ffffff",
          border: isDark ? "1px solid #2d2d2d" : "1px solid #e8e8e8",
          borderRadius: 14,
          padding: 6,
          display: "flex",
          flexDirection: "column",
          gap: 2,
          boxShadow: isDark 
            ? "0 4px 16px rgba(0,0,0,0.3)" 
            : "0 4px 16px rgba(0,0,0,0.08)",
        }}
      >
        <button className="w-9 h-9 rounded-xl rm-tb-btn" onClick={zoomIn} title="Zoom in">
          <ZoomIn size={16} />
        </button>

        {/* Zoom % display */}
        <div
          style={{
            textAlign: "center",
            fontSize: 10,
            fontWeight: 700,
            color: isDark ? "#d4d4d4" : "#666666",
            padding: "2px 0",
            letterSpacing: "0.04em",
          }}
        >
          {zoom}%
        </div>

        <button className="w-9 h-9 rounded-xl rm-tb-btn" onClick={zoomOut} title="Zoom out">
          <ZoomOut size={16} />
        </button>

        <div style={{ height: 1, background: isDark ? "#2d2d2d" : "#f0f0f0", margin: "2px 0" }} />

        <button className="w-9 h-9 rounded-xl rm-tb-btn" onClick={onResetView} title="Reset view">
          <Maximize2 size={15} />
        </button>

        <button className="w-9 h-9 rounded-xl rm-tb-btn" onClick={onAutoLayout} title="Auto-layout nodes">
          <LayoutTemplate size={15} />
        </button>

        <div style={{ height: 1, background: isDark ? "#2d2d2d" : "#f0f0f0", margin: "2px 0" }} />

        <button className="w-9 h-9 rounded-xl rm-tb-btn" onClick={onExportPng} title="Export as PNG">
          <Download size={15} />
        </button>
      </div>

      {/* Stats pill */}
      <div
        style={{
          background: isDark ? "#1e1e1e" : "#ffffff",
          border: isDark ? "1px solid #2d2d2d" : "1px solid #e8e8e8",
          borderRadius: 10,
          padding: "6px 12px",
          display: "flex",
          gap: 10,
          boxShadow: isDark ? "0 2px 8px rgba(0,0,0,0.3)" : "0 2px 8px rgba(0,0,0,0.05)",
          alignItems: "center",
        }}
      >
        <span style={{ fontSize: 10, fontWeight: 700, color: isDark ? "#a3a3a3" : "#777777" }}>
          <span style={{ color: isDark ? "#ffffff" : "#262626", marginRight: 3 }}>{nodeCount}</span> nodes
        </span>
        <span style={{ fontSize: 10, color: isDark ? "#444444" : "#dddddd" }}>·</span>
        <span style={{ fontSize: 10, fontWeight: 700, color: isDark ? "#a3a3a3" : "#777777" }}>
          <span style={{ color: isDark ? "#ffffff" : "#262626", marginRight: 3 }}>{edgeCount}</span> edges
        </span>
      </div>
    </div>
  );
}
