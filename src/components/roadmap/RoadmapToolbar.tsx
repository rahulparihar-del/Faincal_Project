"use client";

import React from "react";
import {
  Plus, ZoomIn, ZoomOut, Maximize2, LayoutTemplate, Download
} from "lucide-react";

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
  const zoom = Math.round(canvasTransform.scale * 100);

  const btnCls = `
    flex items-center justify-center w-9 h-9 rounded-xl
    text-[#555] hover:text-black
    hover:bg-[#f0f0f0] active:bg-[#e8e8e8]
    transition-all duration-150 cursor-pointer border border-transparent
    hover:border-[#e0e0e0]
  `.trim();

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
          boxShadow: "0 4px 16px rgba(124,58,237,0.3)",
          transition: "all 0.2s",
          letterSpacing: "-0.01em",
          whiteSpace: "nowrap",
        }}
        onMouseEnter={(e) => { e.currentTarget.style.boxShadow = "0 6px 24px rgba(124,58,237,0.45)"; e.currentTarget.style.transform = "translateY(-1px)"; }}
        onMouseLeave={(e) => { e.currentTarget.style.boxShadow = "0 4px 16px rgba(124,58,237,0.3)"; e.currentTarget.style.transform = "translateY(0)"; }}
      >
        <Plus size={15} />
        Add Node
      </button>

      {/* Control group */}
      <div
        style={{
          background: "#ffffff",
          border: "1px solid #e8e8e8",
          borderRadius: 14,
          padding: 6,
          display: "flex",
          flexDirection: "column",
          gap: 2,
          boxShadow: "0 4px 16px rgba(0,0,0,0.08)",
        }}
      >
        <button className={btnCls} onClick={zoomIn} title="Zoom in">
          <ZoomIn size={16} />
        </button>

        {/* Zoom % display */}
        <div
          style={{
            textAlign: "center",
            fontSize: 10,
            fontWeight: 700,
            color: "#aaa",
            padding: "2px 0",
            letterSpacing: "0.04em",
          }}
        >
          {zoom}%
        </div>

        <button className={btnCls} onClick={zoomOut} title="Zoom out">
          <ZoomOut size={16} />
        </button>

        <div style={{ height: 1, background: "#f0f0f0", margin: "2px 0" }} />

        <button className={btnCls} onClick={onResetView} title="Reset view">
          <Maximize2 size={15} />
        </button>

        <button className={btnCls} onClick={onAutoLayout} title="Auto-layout nodes">
          <LayoutTemplate size={15} />
        </button>

        <div style={{ height: 1, background: "#f0f0f0", margin: "2px 0" }} />

        <button className={btnCls} onClick={onExportPng} title="Export as PNG">
          <Download size={15} />
        </button>
      </div>

      {/* Stats pill */}
      <div
        style={{
          background: "#ffffff",
          border: "1px solid #e8e8e8",
          borderRadius: 10,
          padding: "6px 10px",
          display: "flex",
          gap: 10,
          boxShadow: "0 2px 8px rgba(0,0,0,0.05)",
        }}
      >
        <span style={{ fontSize: 10, fontWeight: 700, color: "#aaa" }}>
          <span style={{ color: "#333" }}>{nodeCount}</span> nodes
        </span>
        <span style={{ fontSize: 10, color: "#ddd" }}>·</span>
        <span style={{ fontSize: 10, fontWeight: 700, color: "#aaa" }}>
          <span style={{ color: "#333" }}>{edgeCount}</span> edges
        </span>
      </div>
    </div>
  );
}
