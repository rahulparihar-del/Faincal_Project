"use client";

import React, { useRef, useState, useCallback, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { RoadmapNode as NodeType, RoadmapEdge, HandleSide } from "./types";
import { RoadmapNodeCard } from "./RoadmapNode";
import { EdgeLayer } from "./EdgeLayer";

interface CanvasTransform {
  x: number;
  y: number;
  scale: number;
}

interface Props {
  nodes: NodeType[];
  edges: RoadmapEdge[];
  projectId: string;
  onNodeUpdate: (id: string, patch: Partial<NodeType>) => void;
  onNodeDelete: (id: string) => void;
  onNodeClick: (node: NodeType) => void;
  onEdgeAdd: (edge: Omit<RoadmapEdge, "id">) => void;
  onEdgeDelete: (id: string) => void;
  onAddNode: (x: number, y: number) => void;
  canvasTransform: CanvasTransform;
  onTransformChange: (t: CanvasTransform) => void;
}

export function RoadmapCanvas({
  nodes,
  edges,
  projectId,
  onNodeUpdate,
  onNodeDelete,
  onNodeClick,
  onEdgeAdd,
  onEdgeDelete,
  onAddNode,
  canvasTransform,
  onTransformChange,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const isPanningRef = useRef(false);
  const lastPanPos = useRef({ x: 0, y: 0 });

  // Pending edge connection (drag from handle)
  const [pendingEdge, setPendingEdge] = useState<{
    fromNodeId: string;
    fromHandle: HandleSide;
    mouseX: number;
    mouseY: number;
    startX: number;
    startY: number;
  } | null>(null);

  // Node being dragged
  const draggingNodeRef = useRef<{ id: string; startX: number; startY: number; nodeX: number; nodeY: number } | null>(null);

  /* ── Wheel zoom ─────────────────────────────────────── */
  const handleWheel = useCallback(
    (e: WheelEvent) => {
      e.preventDefault();
      const delta = e.deltaY > 0 ? 0.9 : 1.1;
      const newScale = Math.min(Math.max(canvasTransform.scale * delta, 0.2), 3);

      // Zoom towards cursor
      const rect = containerRef.current!.getBoundingClientRect();
      const cx = e.clientX - rect.left;
      const cy = e.clientY - rect.top;
      const newX = cx - ((cx - canvasTransform.x) / canvasTransform.scale) * newScale;
      const newY = cy - ((cy - canvasTransform.y) / canvasTransform.scale) * newScale;

      onTransformChange({ x: newX, y: newY, scale: newScale });
    },
    [canvasTransform, onTransformChange]
  );

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    el.addEventListener("wheel", handleWheel, { passive: false });
    return () => el.removeEventListener("wheel", handleWheel);
  }, [handleWheel]);

  /* ── Canvas Pan ─────────────────────────────────────── */
  const onCanvasPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if ((e.target as HTMLElement).closest("[data-node]") || (e.target as HTMLElement).closest("[data-handle]")) return;
    isPanningRef.current = true;
    lastPanPos.current = { x: e.clientX, y: e.clientY };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };

  const onCanvasPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (pendingEdge) {
      const rect = containerRef.current!.getBoundingClientRect();
      setPendingEdge((prev) =>
        prev ? { ...prev, mouseX: e.clientX - rect.left, mouseY: e.clientY - rect.top } : null
      );
    }
    if (!isPanningRef.current) return;
    const dx = e.clientX - lastPanPos.current.x;
    const dy = e.clientY - lastPanPos.current.y;
    lastPanPos.current = { x: e.clientX, y: e.clientY };
    onTransformChange({ ...canvasTransform, x: canvasTransform.x + dx, y: canvasTransform.y + dy });
  };

  const onCanvasPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    isPanningRef.current = false;
    if (pendingEdge) {
      setPendingEdge(null);
    }
  };

  /* ── Node drag ──────────────────────────────────────── */
  const onNodeDragStart = useCallback(
    (id: string, e: React.PointerEvent) => {
      const node = nodes.find((n) => n.id === id);
      if (!node) return;
      draggingNodeRef.current = {
        id,
        startX: e.clientX,
        startY: e.clientY,
        nodeX: node.x,
        nodeY: node.y,
      };
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    },
    [nodes]
  );

  const onNodeDragMove = useCallback(
    (id: string, e: React.PointerEvent) => {
      if (!draggingNodeRef.current || draggingNodeRef.current.id !== id) return;
      const dx = (e.clientX - draggingNodeRef.current.startX) / canvasTransform.scale;
      const dy = (e.clientY - draggingNodeRef.current.startY) / canvasTransform.scale;
      onNodeUpdate(id, {
        x: draggingNodeRef.current.nodeX + dx,
        y: draggingNodeRef.current.nodeY + dy,
      });
    },
    [canvasTransform.scale, onNodeUpdate]
  );

  const onNodeDragEnd = useCallback(() => {
    draggingNodeRef.current = null;
  }, []);

  /* ── Handle connection drag ─────────────────────────── */
  const onHandleDragStart = useCallback(
    (nodeId: string, handle: HandleSide, e: React.PointerEvent) => {
      e.stopPropagation();
      const rect = containerRef.current!.getBoundingClientRect();
      setPendingEdge({
        fromNodeId: nodeId,
        fromHandle: handle,
        mouseX: e.clientX - rect.left,
        mouseY: e.clientY - rect.top,
        startX: e.clientX - rect.left,
        startY: e.clientY - rect.top,
      });
    },
    []
  );

  const onHandleDrop = useCallback(
    (nodeId: string, handle: HandleSide) => {
      if (!pendingEdge || pendingEdge.fromNodeId === nodeId) return;
      // Check if edge already exists
      const exists = edges.some(
        (edge) =>
          (edge.fromNodeId === pendingEdge.fromNodeId && edge.toNodeId === nodeId) ||
          (edge.fromNodeId === nodeId && edge.toNodeId === pendingEdge.fromNodeId)
      );
      if (!exists) {
        onEdgeAdd({
          projectId,
          fromNodeId: pendingEdge.fromNodeId,
          toNodeId: nodeId,
          fromHandle: pendingEdge.fromHandle,
          toHandle: handle,
        });
      }
      setPendingEdge(null);
    },
    [pendingEdge, edges, projectId, onEdgeAdd]
  );

  /* ── Double-click canvas to add node ───────────────── */
  const onCanvasDblClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if ((e.target as HTMLElement).closest("[data-node]")) return;
    const rect = containerRef.current!.getBoundingClientRect();
    const x = (e.clientX - rect.left - canvasTransform.x) / canvasTransform.scale;
    const y = (e.clientY - rect.top - canvasTransform.y) / canvasTransform.scale;
    onAddNode(x, y);
  };

  /* ── Node center positions for edge rendering ───────── */
  const getHandlePos = (node: NodeType, handle: HandleSide) => {
    const W = 260;
    const H = 140;
    switch (handle) {
      case "top":    return { x: node.x + W / 2, y: node.y };
      case "bottom": return { x: node.x + W / 2, y: node.y + H };
      case "left":   return { x: node.x, y: node.y + H / 2 };
      case "right":  return { x: node.x + W, y: node.y + H / 2 };
    }
  };

  /* ── Grid background ────────────────────────────────── */
  const gridSize = 32 * canvasTransform.scale;
  const gridOffsetX = canvasTransform.x % gridSize;
  const gridOffsetY = canvasTransform.y % gridSize;

  return (
    <div
      ref={containerRef}
      className="relative w-full h-full overflow-hidden select-none"
      style={{ cursor: isPanningRef.current ? "grabbing" : "grab", background: "#f5f5f5" }}
      onPointerDown={onCanvasPointerDown}
      onPointerMove={onCanvasPointerMove}
      onPointerUp={onCanvasPointerUp}
      onDoubleClick={onCanvasDblClick}
    >
      {/* Grid */}
      <svg
        className="absolute inset-0 pointer-events-none"
        width="100%"
        height="100%"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <pattern
            id="rm-grid"
            x={gridOffsetX}
            y={gridOffsetY}
            width={gridSize}
            height={gridSize}
            patternUnits="userSpaceOnUse"
          >
            <circle cx={0} cy={0} r={0.8} fill="rgba(0,0,0,0.12)" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#rm-grid)" />
      </svg>

      {/* Transform group */}
      <div
        style={{
          transform: `translate(${canvasTransform.x}px, ${canvasTransform.y}px) scale(${canvasTransform.scale})`,
          transformOrigin: "0 0",
          position: "absolute",
          inset: 0,
        }}
      >
        {/* SVG edge layer */}
        <EdgeLayer
          edges={edges}
          nodes={nodes}
          getHandlePos={getHandlePos}
          onEdgeDelete={onEdgeDelete}
          pendingEdge={pendingEdge}
          canvasTransform={canvasTransform}
        />

        {/* Nodes */}
        <AnimatePresence>
          {nodes.map((node) => (
            <motion.div
              key={node.id}
              initial={{ opacity: 0, scale: 0.6 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.6 }}
              transition={{ type: "spring", stiffness: 380, damping: 28 }}
              style={{
                position: "absolute",
                left: node.x,
                top: node.y,
                width: 260,
                zIndex: 10,
              }}
            >
              <RoadmapNodeCard
                node={node}
                onDragStart={(e) => onNodeDragStart(node.id, e)}
                onDragMove={(e) => onNodeDragMove(node.id, e)}
                onDragEnd={onNodeDragEnd}
                onClick={() => onNodeClick(node)}
                onHandleDragStart={(handle, e) => onHandleDragStart(node.id, handle, e)}
                onHandleDrop={(handle) => onHandleDrop(node.id, handle)}
              />
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {/* Pending edge preview */}
      {pendingEdge && (
        <svg className="absolute inset-0 pointer-events-none" width="100%" height="100%">
          <line
            x1={pendingEdge.startX}
            y1={pendingEdge.startY}
            x2={pendingEdge.mouseX}
            y2={pendingEdge.mouseY}
            stroke="rgba(139,92,246,0.7)"
            strokeWidth="2"
            strokeDasharray="6 4"
          />
          <circle cx={pendingEdge.mouseX} cy={pendingEdge.mouseY} r={5} fill="#8b5cf6" opacity={0.8} />
        </svg>
      )}

      {/* Empty state */}
      {nodes.length === 0 && (
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
          <div className="text-center">
            <div className="text-6xl mb-4 opacity-30">🗺️</div>
            <p className="text-black/30 text-lg font-semibold">Double-click anywhere to add a node</p>
            <p className="text-black/20 text-sm mt-1">Or use the + button in the toolbar</p>
          </div>
        </div>
      )}
    </div>
  );
}
