"use client";

import React, { useRef, useState } from "react";
import { RoadmapNode, HandleSide, STATUS_META, PRIORITY_META } from "./types";
import { Film, Layers, Image as ImageIcon, Sparkles, Heart, MessageCircle, Send, Bookmark, Camera, ChevronLeft, ChevronRight } from "lucide-react";
import { useTheme } from "@/context/ThemeContext";

const HANDLE_SIDES: HandleSide[] = ["top", "bottom", "left", "right"];

const HANDLE_POSITIONS: Record<HandleSide, React.CSSProperties> = {
  top:    { top: -7, left: "50%", transform: "translateX(-50%)" },
  bottom: { bottom: -7, left: "50%", transform: "translateX(-50%)" },
  left:   { left: -7, top: "50%", transform: "translateY(-50%)" },
  right:  { right: -7, top: "50%", transform: "translateY(-50%)" },
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
  const { theme } = useTheme();
  const isDark = theme === "dark";
  
  const statusMeta = STATUS_META[node.status];
  const priorityMeta = PRIORITY_META[node.priority];
  const isDraggingRef = useRef(false);
  const downPosRef = useRef({ x: 0, y: 0 });

  // Carousel image list (fallback to imageUrl if imageUrls not initialized)
  const images = node.imageUrls && node.imageUrls.length > 0
    ? node.imageUrls
    : node.imageUrl
      ? [node.imageUrl]
      : [];

  const [activeImageIndex, setActiveImageIndex] = useState(0);

  const handlePointerDown = (e: React.PointerEvent) => {
    if ((e.target as HTMLElement).closest("[data-handle]") || (e.target as HTMLElement).closest(".rm-carousel-btn")) return;
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
    html.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim().slice(0, 70);

  const getPostTypeIcon = (priority: string) => {
    switch (priority) {
      case "low": return <Film size={13} style={{ color: "#db2777" }} />;
      case "medium": return <Layers size={13} style={{ color: "#7c3aed" }} />;
      case "high": return <ImageIcon size={13} style={{ color: "#0891b2" }} />;
      case "critical": return <Sparkles size={13} style={{ color: "#d97706" }} />;
      default: return <ImageIcon size={13} />;
    }
  };

  return (
    <div
      data-node="true"
      style={{
        position: "relative",
        borderRadius: 14,
        background: isDark ? "#1e1e1e" : "#ffffff",
        border: isDark ? "1px solid #2d2d2d" : "1px solid #dbdbdb",
        boxShadow: isDark 
          ? "0 10px 30px rgba(0, 0, 0, 0.4), 0 1px 3px rgba(0, 0, 0, 0.2)"
          : "0 4px 18px rgba(0, 0, 0, 0.06), 0 1px 2px rgba(0, 0, 0, 0.04)",
        cursor: "grab",
        userSelect: "none",
        transition: "box-shadow 0.2s ease, transform 0.15s ease, border-color 0.2s, background-color 0.2s",
        width: 260,
        height: 430,
        overflow: "visible",
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
            border: isDark ? "3.5px solid #1e1e1e" : "3.5px solid #ffffff",
            cursor: "crosshair",
            opacity: 0,
            transition: "opacity 0.15s, transform 0.15s",
            zIndex: 30,
            boxShadow: "0 2px 6px rgba(0,0,0,0.3)",
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
            (e.currentTarget as HTMLElement).style.transform = `${(HANDLE_POSITIONS[side].transform as string) || ""} scale(1.35)`;
          }}
          onPointerLeave={(e) => {
            (e.currentTarget as HTMLElement).style.opacity = "0";
            (e.currentTarget as HTMLElement).style.transform = `${(HANDLE_POSITIONS[side].transform as string) || ""} scale(1)`;
          }}
        />
      ))}

      {/* Card Header (Instagram Profile style) */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "10px 12px",
          borderBottom: isDark ? "1px solid #2d2d2d" : "1px solid #efefef",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {/* Avatar with IG gradient border */}
          <div
            style={{
              width: 26,
              height: 26,
              borderRadius: "50%",
              padding: 1.5,
              background: "linear-gradient(45deg, #f09433 0%, #e6683c 25%, #dc2743 50%, #cc2366 75%, #bc1888 100%)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <div
              style={{
                width: "100%",
                height: "100%",
                borderRadius: "50%",
                background: isDark ? "#1e1e1e" : "#fff",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 10,
                fontWeight: 700,
                color: isDark ? "#f5f5f5" : "#262626",
              }}
            >
              IG
            </div>
          </div>
          <div style={{ display: "flex", flexDirection: "column" }}>
            <span
              style={{
                fontSize: 11,
                fontWeight: 700,
                color: isDark ? "#f5f5f5" : "#262626",
                maxWidth: 110,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
                lineHeight: 1.2,
              }}
            >
              {node.title || "Untitled Post"}
            </span>
            <span
              style={{
                fontSize: 9,
                color: isDark ? "#a8a8a8" : "#8e8e8e",
                display: "flex",
                alignItems: "center",
                gap: 3,
                lineHeight: 1,
                marginTop: 1,
              }}
            >
              {getPostTypeIcon(node.priority)}
              {priorityMeta.label}
            </span>
          </div>
        </div>

        {/* Status Badge */}
        <span
          style={{
            fontSize: 9,
            fontWeight: 700,
            color: statusMeta.color,
            background: isDark ? "rgba(255,255,255,0.04)" : statusMeta.bg,
            border: isDark ? `1px solid ${statusMeta.color}77` : `1px solid ${statusMeta.border}`,
            padding: "2px 6px",
            borderRadius: 4,
            textTransform: "uppercase",
            letterSpacing: "0.04em",
          }}
        >
          {statusMeta.label}
        </span>
      </div>

      {/* Main Square Post Image */}
      <div
        style={{
          width: "100%",
          paddingBottom: "100%", // aspect-ratio 1:1
          position: "relative",
          background: isDark ? "#121212" : "#fafafa",
          overflow: "hidden",
          borderBottom: isDark ? "1px solid #2d2d2d" : "1px solid #efefef",
        }}
      >
        {images.length > 0 ? (
          <>
            <img
              src={images[activeImageIndex]}
              alt={node.title}
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                width: "100%",
                height: "100%",
                objectFit: "cover",
              }}
            />
            {/* Arrows overlay */}
            {images.length > 1 && (
              <>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    e.preventDefault();
                    setActiveImageIndex((prev) => (prev > 0 ? prev - 1 : images.length - 1));
                  }}
                  className="rm-carousel-btn"
                  style={{ left: 8 }}
                  title="Previous image"
                >
                  <ChevronLeft size={14} />
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    e.preventDefault();
                    setActiveImageIndex((prev) => (prev < images.length - 1 ? prev + 1 : 0));
                  }}
                  className="rm-carousel-btn"
                  style={{ right: 8 }}
                  title="Next image"
                >
                  <ChevronRight size={14} />
                </button>
                
                {/* Dots indicators */}
                <div
                  style={{
                    position: "absolute",
                    bottom: 10,
                    left: "50%",
                    transform: "translateX(-50%)",
                    display: "flex",
                    gap: 4,
                    zIndex: 10,
                    background: "rgba(0,0,0,0.35)",
                    padding: "3px 6px",
                    borderRadius: 99,
                  }}
                >
                  {images.map((_, idx) => (
                    <div
                      key={idx}
                      style={{
                        width: 5,
                        height: 5,
                        borderRadius: "50%",
                        background: activeImageIndex === idx ? "#ffffff" : "rgba(255,255,255,0.4)",
                        transition: "all 0.15s ease",
                      }}
                    />
                  ))}
                </div>
              </>
            )}
          </>
        ) : (
          <div
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              width: "100%",
              height: "100%",
              background: isDark 
                ? `linear-gradient(135deg, ${node.color}15, ${node.color}05)`
                : `linear-gradient(135deg, ${node.color}22, ${node.color}11)`,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              gap: 8,
            }}
          >
            <Camera size={26} style={{ color: node.color, opacity: 0.6 }} />
            <span style={{ fontSize: 10, color: isDark ? "#737373" : "#8e8e8e", fontWeight: 600 }}>Click to add image</span>
          </div>
        )}
      </div>

      {/* IG Action Icons bar */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "8px 10px 4px",
          color: isDark ? "#f5f5f5" : "#262626",
        }}
      >
        <div style={{ display: "flex", gap: 10 }}>
          <Heart size={16} style={{ cursor: "pointer" }} />
          <MessageCircle size={16} style={{ cursor: "pointer" }} />
          <Send size={15} style={{ cursor: "pointer" }} />
        </div>
        <Bookmark size={16} style={{ cursor: "pointer" }} />
      </div>

      {/* Caption Content Area */}
      <div style={{ padding: "0 10px 12px" }}>
        {/* Caption text */}
        {node.richContent ? (
          <div
            style={{
              fontSize: 11,
              color: isDark ? "#e5e5e5" : "#262626",
              lineHeight: 1.4,
              overflow: "hidden",
              display: "-webkit-box",
              WebkitLineClamp: 2,
              WebkitBoxOrient: "vertical",
              marginBottom: 4,
            }}
          >
            <span style={{ fontWeight: 700, marginRight: 5, color: isDark ? "#ffffff" : "#262626" }}>brand_strategy</span>
            {stripHtml(node.richContent)}
          </div>
        ) : (
          <div style={{ fontSize: 10, color: isDark ? "#737373" : "#8e8e8e", fontStyle: "italic", marginBottom: 4 }}>
            No description added yet.
          </div>
        )}

        {/* Tags / Hashtags */}
        {node.tags.length > 0 && (
          <div style={{ display: "flex", gap: 4, flexWrap: "wrap", marginTop: 4 }}>
            {node.tags.slice(0, 4).map((tag) => (
              <span
                key={tag}
                style={{
                  fontSize: 10,
                  fontWeight: 600,
                  color: isDark ? "#9ecaff" : "#00376b", // Instagram blue tag link color
                }}
              >
                #{tag}
              </span>
            ))}
          </div>
        )}

        {/* Scheduled date indicator */}
        {node.dueDate && (
          <div style={{ fontSize: 9, color: isDark ? "#737373" : "#8e8e8e", marginTop: 6, fontWeight: 500 }}>
            Scheduled for: {node.dueDate}
          </div>
        )}
      </div>

      {/* CSS for hover effects */}
      <style>{`
        .rm-node:hover .rm-handle {
          opacity: 1 !important;
        }
        .rm-node:hover {
          box-shadow: ${
            isDark 
              ? "0 15px 40px rgba(0,0,0,0.6), 0 3px 12px rgba(0,0,0,0.4) !important" 
              : "0 10px 30px rgba(0,0,0,0.12), 0 3px 10px rgba(0,0,0,0.06) !important"
          };
          transform: translateY(-2px);
          border-color: ${isDark ? "#555555" : "#a8a8a8"} !important;
        }
        .rm-carousel-btn {
          position: absolute;
          top: 50%;
          transform: translateY(-50%);
          width: 24px;
          height: 24px;
          border-radius: 50%;
          background: ${isDark ? "rgba(28,28,30,0.9)" : "rgba(255,255,255,0.9)"};
          color: ${isDark ? "#ffffff" : "#262626"};
          border: none;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          opacity: 0;
          transition: opacity 0.2s, background 0.15s, transform 0.15s;
          box-shadow: 0 2px 6px rgba(0,0,0,0.3);
          z-index: 10;
        }
        .rm-node:hover .rm-carousel-btn {
          opacity: 1;
        }
        .rm-carousel-btn:hover {
          background: ${isDark ? "#2c2c2e" : "#ffffff"};
          transform: translateY(-50%) scale(1.1);
        }
      `}</style>
    </div>
  );
}
