"use client";

import React, { useEffect, useRef } from "react";
import { RoadmapNode, RoadmapEdge, HandleSide } from "./types";
import { gsap } from "gsap";

interface HandlePos {
  x: number;
  y: number;
}

interface CanvasTransform {
  x: number;
  y: number;
  scale: number;
}

interface PendingEdge {
  fromNodeId: string;
  fromHandle: HandleSide;
  mouseX: number;
  mouseY: number;
  startX: number;
  startY: number;
}

interface Props {
  edges: RoadmapEdge[];
  nodes: RoadmapNode[];
  getHandlePos: (node: RoadmapNode, handle: HandleSide) => HandlePos;
  onEdgeDelete: (id: string) => void;
  pendingEdge: PendingEdge | null;
  canvasTransform: CanvasTransform;
}

function getCubicBezierPath(from: HandlePos, to: HandlePos, fromHandle: HandleSide, toHandle: HandleSide): string {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const strength = Math.min(Math.abs(dx) * 0.5 + Math.abs(dy) * 0.3, 200) + 60;

  const getOffset = (side: HandleSide, dist: number): { cx: number; cy: number } => {
    switch (side) {
      case "top":    return { cx: 0, cy: -dist };
      case "bottom": return { cx: 0, cy: dist };
      case "left":   return { cx: -dist, cy: 0 };
      case "right":  return { cx: dist, cy: 0 };
    }
  };

  const c1 = getOffset(fromHandle, strength);
  const c2 = getOffset(toHandle, strength);

  return `M ${from.x} ${from.y} C ${from.x + c1.cx} ${from.y + c1.cy}, ${to.x + c2.cx} ${to.y + c2.cy}, ${to.x} ${to.y}`;
}

export function EdgeLayer({ edges, nodes, getHandlePos, onEdgeDelete, pendingEdge, canvasTransform }: Props) {
  const svgRef = useRef<SVGSVGElement>(null);

  // Animate edges on mount using GSAP
  useEffect(() => {
    if (!svgRef.current) return;
    const paths = svgRef.current.querySelectorAll(".rm-edge-path");
    paths.forEach((path) => {
      const length = (path as SVGPathElement).getTotalLength?.() || 200;
      gsap.fromTo(
        path,
        { strokeDashoffset: length, strokeDasharray: length },
        { strokeDashoffset: 0, strokeDasharray: length, duration: 0.6, ease: "power2.out" }
      );
    });
  }, [edges.length]);

  const nodeMap = new Map(nodes.map((n) => [n.id, n]));

  return (
    <svg
      ref={svgRef}
      style={{
        position: "absolute",
        inset: 0,
        width: "100%",
        height: "100%",
        pointerEvents: "none",
        overflow: "visible",
        zIndex: 5,
      }}
    >
      <defs>
        <marker
          id="rm-arrow"
          markerWidth="10"
          markerHeight="7"
          refX="9"
          refY="3.5"
          orient="auto"
        >
          <polygon points="0 0, 10 3.5, 0 7" fill="rgba(139,92,246,0.8)" />
        </marker>
        <marker
          id="rm-arrow-hover"
          markerWidth="10"
          markerHeight="7"
          refX="9"
          refY="3.5"
          orient="auto"
        >
          <polygon points="0 0, 10 3.5, 0 7" fill="#8b5cf6" />
        </marker>
        <filter id="rm-edge-glow">
          <feGaussianBlur stdDeviation="2" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      {edges.map((edge) => {
        const fromNode = nodeMap.get(edge.fromNodeId);
        const toNode = nodeMap.get(edge.toNodeId);
        if (!fromNode || !toNode) return null;

        const from = getHandlePos(fromNode, edge.fromHandle);
        const to = getHandlePos(toNode, edge.toHandle);
        const path = getCubicBezierPath(from, to, edge.fromHandle, edge.toHandle);

        return (
          <g key={edge.id} style={{ pointerEvents: "stroke" }}>
            {/* Invisible fat hit area for double-click delete */}
            <path
              d={path}
              fill="none"
              stroke="transparent"
              strokeWidth={20}
              style={{ pointerEvents: "stroke", cursor: "pointer" }}
              onDoubleClick={(e) => {
                e.stopPropagation();
                onEdgeDelete(edge.id);
              }}
            />
            {/* Glow track */}
            <path
              className="rm-edge-path"
              d={path}
              fill="none"
              stroke="rgba(139,92,246,0.15)"
              strokeWidth={6}
              style={{ pointerEvents: "none", filter: "url(#rm-edge-glow)" }}
            />
            {/* Main edge */}
            <path
              className="rm-edge-path"
              d={path}
              fill="none"
              stroke="rgba(139,92,246,0.6)"
              strokeWidth={2}
              markerEnd="url(#rm-arrow)"
              style={{ pointerEvents: "none" }}
            />
            {/* Animated flow dots */}
            <path
              d={path}
              fill="none"
              stroke="rgba(139,92,246,0.9)"
              strokeWidth={2}
              strokeDasharray="6 18"
              markerEnd="url(#rm-arrow-hover)"
              style={{ pointerEvents: "none" }}
            >
              <animate
                attributeName="stroke-dashoffset"
                from="0"
                to="-24"
                dur="0.8s"
                repeatCount="indefinite"
              />
            </path>
          </g>
        );
      })}
    </svg>
  );
}
