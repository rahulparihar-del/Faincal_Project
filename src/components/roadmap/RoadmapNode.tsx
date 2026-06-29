"use client";

import React, { useRef } from "react";
import { RoadmapNode, HandleSide, STATUS_META, PRIORITY_META } from "./types";

const HANDLE_SIDES: HandleSide[] = ["top", "bottom", "left", "right"];

const HANDLE_POSITIONS: Record<HandleSide, React.CSSProperties> = {
  top:    { top: -8, left: "50%", transform: "translateX(-50%)" },
  bottom: { bottom: -8, left: "50%", transform: "translateX(-50%)" },
  left:   { left: -8, top: "50%", transform: "translateY(-50%)" },
  right:  { right: -8, top: "50%", transform: "translateY(-50%)" },
};

interface Props {
  node: RoadmapNode;
  onDragStart: (e: React.PointerEvent) => void;
  onDragMove: (e: React.PointerEvent) => void;
  onDragEnd: (e: React.PointerEvent) => void;
  onClick: () => void;
  onHandleDragStart: (handle: HandleSide, e: React.PointerEvent) => void;
  onHandleDrop: (handle: HandleSide) => void;
}

export function RoadmapNodeCard({
  node,
  onDragStart,
  onDragMove,
  onDragEnd,
  onClick,
  onHandleDragStart,
  onHandleDrop,
}: Props) {
  const statusMeta = STATUS_META[node.status];
  const priorityMeta = PRIORITY_META[node.priority];
  const isDraggingRef = useRef(false);
  const downPosRef = useRef({ x: 0, y: 0 });

  const handlePointerDown = (e: React.PointerEvent) => {
    if ((e.target as HTMLElement).closest("[data-handle]")) return;
    downPosRef.current = { x: e.clientX, y: e.clientY };
    isDraggingRef.current = false;
    onDragStart(e);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    const dx = Math.abs(e.clientX - downPosRef.current.x);
    const dy = Math.abs(e.clientY - downPosRef.current.y);
    if (dx > 4 || dy > 4) isDraggingRef.current = true;
    onDragMove(e);
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    onDragEnd(e);
    if (!isDraggingRef.current) {
      onClick();
    }
    isDraggingRef.current = false;
  };

  const stripHtml = (html: string) =>
    html.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim().slice(0, 80);

  return (
    <div
      data-node="true"
      style={{
        position: "relative",
        borderRadius: 16,
        background: "#ffffff",
        border: `1px solid #e8e8e8`,
        borderTop: `3px solid ${node.color}`,
        boxShadow: `0 2px 12px rgba(0,0,0,0.07), 0 1px 3px rgba(0,0,0,0.05)`,
        cursor: "grab",
        userSelect: "none",
        transition: "box-shadow 0.2s ease, transform 0.15s ease",
        minHeight: 120,
      }}
      className="rm-node group"
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
    >
      {/* Handle dots */}
      {HANDLE_SIDES.map((side) => (
        <div
          key={side}
          data-handle="true"
          style={{
            position: "absolute",
            ...HANDLE_POSITIONS[side],
            width: 14,
            height: 14,
            borderRadius: "50%",
            background: node.color,
            border: "2px solid #fff",
            cursor: "crosshair",
            opacity: 0,
            transition: "opacity 0.15s, transform 0.15s",
            zIndex: 20,
            boxShadow: `0 2px 8px ${node.color}66`,
          }}
          className="rm-handle"
          onPointerDown={(e) => {
            e.stopPropagation();
            onHandleDragStart(side, e);
          }}
          onPointerUp={(e) => {
            e.stopPropagation();
            onHandleDrop(side);
          }}
          onPointerEnter={(e) => {
            (e.currentTarget as HTMLElement).style.opacity = "1";
            (e.currentTarget as HTMLElement).style.transform = `${(HANDLE_POSITIONS[side].transform as string) || ""} scale(1.3)`;
          }}
          onPointerLeave={(e) => {
            (e.currentTarget as HTMLElement).style.opacity = "0";
            (e.currentTarget as HTMLElement).style.transform = `${(HANDLE_POSITIONS[side].transform as string) || ""} scale(1)`;
          }}
        />
      ))}

      {/* Card content */}
      <div style={{ padding: "14px 16px 12px" }}>
        {/* Top row: status + priority */}
        <div style={{ display: "flex", gap: 6, alignItems: "center", marginBottom: 8, flexWrap: "wrap" }}>
          <span
            style={{
              fontSize: 10,
              fontWeight: 700,
              letterSpacing: "0.06em",
              textTransform: "uppercase",
              color: statusMeta.color,
              background: statusMeta.bg,
              border: `1px solid ${statusMeta.border}`,
              padding: "2px 7px",
              borderRadius: 99,
            }}
          >
            {statusMeta.label}
          </span>
          <span
            style={{
              fontSize: 10,
              fontWeight: 700,
              letterSpacing: "0.06em",
              textTransform: "uppercase",
              color: priorityMeta.color,
              background: priorityMeta.bg,
              padding: "2px 7px",
              borderRadius: 99,
            }}
          >
            {priorityMeta.label}
          </span>
        </div>

        {/* Title */}
        <div
          style={{
            fontSize: 14,
            fontWeight: 700,
            color: "#1a1a1a",
            lineHeight: 1.3,
            marginBottom: 6,
            letterSpacing: "-0.01em",
          }}
        >
          {node.title || "Untitled Node"}
        </div>

        {/* Content preview */}
        {node.richContent && (
          <div
            style={{
              fontSize: 11,
              color: "#888",
              lineHeight: 1.5,
              marginBottom: 10,
              overflow: "hidden",
              display: "-webkit-box",
              WebkitLineClamp: 2,
              WebkitBoxOrient: "vertical",
            }}
          >
            {stripHtml(node.richContent)}
          </div>
        )}

        {/* Progress bar */}
        <div style={{ marginTop: 8 }}>
          <div
            style={{
              height: 3,
              borderRadius: 99,
              background: "#f0f0f0",
              overflow: "hidden",
            }}
          >
            <div
              style={{
                height: "100%",
                width: `${node.progress}%`,
                background: `linear-gradient(90deg, ${node.color}, ${node.color}cc)`,
                borderRadius: 99,
                transition: "width 0.4s ease",
              }}
            />
          </div>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              marginTop: 4,
              fontSize: 9,
              color: "#bbb",
              fontWeight: 600,
            }}
          >
            <span>Progress</span>
            <span>{node.progress}%</span>
          </div>
        </div>

        {/* Tags */}
        {node.tags.length > 0 && (
          <div style={{ display: "flex", gap: 4, flexWrap: "wrap", marginTop: 8 }}>
            {node.tags.slice(0, 3).map((tag) => (
              <span
                key={tag}
                style={{
                  fontSize: 9,
                  fontWeight: 600,
                  color: "#888",
                  background: "#f5f5f5",
                  padding: "2px 6px",
                  borderRadius: 99,
                  letterSpacing: "0.04em",
                  border: "1px solid #eee",
                }}
              >
                #{tag}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* CSS for hover effects */}
      <style>{`
        .rm-node:hover .rm-handle {
          opacity: 1 !important;
        }
        .rm-node:hover {
          box-shadow: 0 8px 32px rgba(0,0,0,0.12), 0 2px 8px rgba(0,0,0,0.06) !important;
          transform: translateY(-1px);
        }
      `}</style>
    </div>
  );
}
