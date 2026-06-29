"use client";

import React, { useRef, useEffect, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  X, Bold, Italic, Underline, AlignLeft, AlignCenter, AlignRight,
  List, ListOrdered, Trash2, Tag, Calendar, Minus, Plus,
  ChevronDown, Type, Palette
} from "lucide-react";
import { RoadmapNode, NodeStatus, NodePriority, STATUS_META, PRIORITY_META, NODE_ACCENT_COLORS } from "./types";

/* ── Font families ────────────────────────────────────── */
const FONTS = [
  { name: "Inter",            value: "Inter, sans-serif" },
  { name: "Playfair Display", value: "'Playfair Display', serif" },
  { name: "Space Grotesk",    value: "'Space Grotesk', sans-serif" },
  { name: "Outfit",           value: "'Outfit', sans-serif" },
  { name: "Fira Code",        value: "'Fira Code', monospace" },
  { name: "DM Serif Display", value: "'DM Serif Display', serif" },
];

/* ── Highlight colors ─────────────────────────────────── */
const HIGHLIGHTS = [
  { label: "None",    bg: "transparent",      text: "inherit"    },
  { label: "Yellow",  bg: "#fef08a",           text: "#78350f"    },
  { label: "Mint",    bg: "#bbf7d0",           text: "#14532d"    },
  { label: "Sky",     bg: "#bae6fd",           text: "#0c4a6e"    },
  { label: "Pink",    bg: "#fbcfe8",           text: "#831843"    },
  { label: "Violet",  bg: "#ddd6fe",           text: "#4c1d95"    },
  { label: "Orange",  bg: "#fed7aa",           text: "#7c2d12"    },
  { label: "Red",     bg: "#fecaca",           text: "#7f1d1d"    },
];

/* ── Text colors ──────────────────────────────────────── */
const TEXT_COLORS = [
  "#ffffff", "#e5e7eb", "#f87171", "#fb923c",
  "#facc15", "#4ade80", "#60a5fa", "#c084fc",
  "#f472b6", "#34d399", "#38bdf8", "#a78bfa",
];

interface Props {
  node: RoadmapNode | null;
  onClose: () => void;
  onUpdate: (patch: Partial<RoadmapNode>) => void;
  onDelete: (id: string) => void;
}

export function NodeDetailPanel({ node, onClose, onUpdate, onDelete }: Props) {
  const editorRef = useRef<HTMLDivElement>(null);
  const [title, setTitle] = useState("");
  const [tagInput, setTagInput] = useState("");
  const [activeFontFamily, setActiveFontFamily] = useState(FONTS[0].value);
  const [showFontPicker, setShowFontPicker] = useState(false);
  const [showHighlights, setShowHighlights] = useState(false);
  const [showTextColors, setShowTextColors] = useState(false);
  const [fontSize, setFontSize] = useState(14);
  const savedSelection = useRef<Range | null>(null);

  // Sync state when node changes
  useEffect(() => {
    if (!node) return;
    setTitle(node.title);
    if (editorRef.current && node.richContent !== editorRef.current.innerHTML) {
      editorRef.current.innerHTML = node.richContent || "";
    }
  }, [node?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  /* ── Save selection before toolbar interaction ───────── */
  const saveSelection = () => {
    const sel = window.getSelection();
    if (sel && sel.rangeCount > 0) {
      savedSelection.current = sel.getRangeAt(0).cloneRange();
    }
  };

  const restoreSelection = () => {
    if (!savedSelection.current) return;
    const sel = window.getSelection();
    if (sel) {
      sel.removeAllRanges();
      sel.addRange(savedSelection.current);
    }
  };

  /* ── execCommand helpers ─────────────────────────────── */
  const exec = useCallback((cmd: string, value?: string) => {
    editorRef.current?.focus();
    restoreSelection();
    document.execCommand(cmd, false, value);
    saveContent();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const saveContent = () => {
    if (editorRef.current && node) {
      onUpdate({ richContent: editorRef.current.innerHTML });
    }
  };

  const applyFont = (fontValue: string) => {
    setActiveFontFamily(fontValue);
    setShowFontPicker(false);
    exec("fontName", fontValue);
  };

  const applyHighlight = (bg: string, color: string) => {
    setShowHighlights(false);
    editorRef.current?.focus();
    restoreSelection();
    if (bg === "transparent") {
      document.execCommand("removeFormat", false, undefined);
    } else {
      document.execCommand("hiliteColor", false, bg);
      document.execCommand("foreColor", false, color);
    }
    saveContent();
  };

  const applyTextColor = (color: string) => {
    setShowTextColors(false);
    exec("foreColor", color);
  };

  const applyFontSize = (size: number) => {
    const clamped = Math.min(Math.max(size, 8), 72);
    setFontSize(clamped);
    exec("fontSize", "7");
    const fontElements = editorRef.current?.querySelectorAll("font[size='7']");
    fontElements?.forEach((el) => {
      (el as HTMLElement).style.fontSize = `${clamped}px`;
      el.removeAttribute("size");
    });
  };

  const applyHeading = (level: number) => {
    editorRef.current?.focus();
    restoreSelection();
    document.execCommand("formatBlock", false, `h${level}`);
    saveContent();
  };

  const addTag = () => {
    const tag = tagInput.trim().toLowerCase().replace(/\s+/g, "-");
    if (!tag || !node || node.tags.includes(tag)) { setTagInput(""); return; }
    onUpdate({ tags: [...node.tags, tag] });
    setTagInput("");
  };

  const removeTag = (tag: string) => {
    if (!node) return;
    onUpdate({ tags: node.tags.filter((t) => t !== tag) });
  };

  if (!node) return null;

  const statusMeta = STATUS_META[node.status];
  const priorityMeta = PRIORITY_META[node.priority];

  const toolbarBtnCls = "w-7 h-7 flex items-center justify-center rounded-lg text-white/60 hover:text-white hover:bg-white/10 transition-all cursor-pointer";

  return (
    <AnimatePresence>
      {node && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 z-40"
            style={{ background: "rgba(0,0,0,0.4)", backdropFilter: "blur(2px)" }}
            onClick={onClose}
          />

          {/* Panel */}
          <motion.div
            initial={{ x: "100%", opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: "100%", opacity: 0 }}
            transition={{ type: "spring", stiffness: 340, damping: 30 }}
            className="absolute right-0 top-0 bottom-0 z-50 flex flex-col"
            style={{
              width: "min(520px, 90vw)",
              background: "linear-gradient(180deg, #13131f 0%, #0e0e1a 100%)",
              borderLeft: "1px solid rgba(255,255,255,0.08)",
              boxShadow: "-24px 0 80px rgba(0,0,0,0.7)",
              overflow: "hidden",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* ── Header ────────────────────────────────── */}
            <div
              style={{
                padding: "16px 20px 14px",
                borderBottom: "1px solid rgba(255,255,255,0.06)",
                display: "flex",
                alignItems: "flex-start",
                gap: 12,
              }}
            >
              {/* Color dot */}
              <div
                style={{
                  width: 12,
                  height: 12,
                  borderRadius: "50%",
                  background: node.color,
                  marginTop: 6,
                  boxShadow: `0 0 8px ${node.color}88`,
                  flexShrink: 0,
                }}
              />

              {/* Title input */}
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                onBlur={() => onUpdate({ title })}
                placeholder="Node title…"
                style={{
                  flex: 1,
                  background: "transparent",
                  border: "none",
                  outline: "none",
                  color: "rgba(255,255,255,0.92)",
                  fontSize: 18,
                  fontWeight: 700,
                  letterSpacing: "-0.02em",
                  fontFamily: "inherit",
                }}
              />

              {/* Close */}
              <button
                onClick={onClose}
                style={{
                  width: 30,
                  height: 30,
                  borderRadius: 8,
                  background: "rgba(255,255,255,0.06)",
                  border: "none",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "rgba(255,255,255,0.5)",
                  flexShrink: 0,
                }}
              >
                <X size={15} />
              </button>
            </div>

            {/* ── Meta row ──────────────────────────────── */}
            <div
              style={{
                padding: "12px 20px",
                borderBottom: "1px solid rgba(255,255,255,0.05)",
                display: "flex",
                gap: 8,
                flexWrap: "wrap",
                alignItems: "center",
              }}
            >
              {/* Status */}
              <div style={{ position: "relative" }}>
                <select
                  value={node.status}
                  onChange={(e) => onUpdate({ status: e.target.value as NodeStatus })}
                  style={{
                    background: `${statusMeta.color}22`,
                    border: `1px solid ${statusMeta.color}44`,
                    color: statusMeta.color,
                    padding: "4px 8px",
                    borderRadius: 99,
                    fontSize: 11,
                    fontWeight: 700,
                    cursor: "pointer",
                    outline: "none",
                    textTransform: "uppercase",
                    letterSpacing: "0.06em",
                    appearance: "none",
                    paddingRight: 24,
                  }}
                >
                  {(Object.keys(STATUS_META) as NodeStatus[]).map((s) => (
                    <option key={s} value={s} style={{ background: "#1a1a2e", color: "#fff" }}>
                      {STATUS_META[s].label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Priority */}
              <select
                value={node.priority}
                onChange={(e) => onUpdate({ priority: e.target.value as NodePriority })}
                style={{
                  background: `${priorityMeta.color}22`,
                  border: `1px solid ${priorityMeta.color}44`,
                  color: priorityMeta.color,
                  padding: "4px 8px",
                  borderRadius: 99,
                  fontSize: 11,
                  fontWeight: 700,
                  cursor: "pointer",
                  outline: "none",
                  textTransform: "uppercase",
                  letterSpacing: "0.06em",
                  appearance: "none",
                }}
              >
                {(Object.keys(PRIORITY_META) as NodePriority[]).map((p) => (
                  <option key={p} value={p} style={{ background: "#1a1a2e", color: "#fff" }}>
                    {PRIORITY_META[p].label}
                  </option>
                ))}
              </select>

              {/* Due date */}
              <label
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 5,
                  fontSize: 11,
                  color: "rgba(255,255,255,0.4)",
                  cursor: "pointer",
                }}
              >
                <Calendar size={12} />
                <input
                  type="date"
                  value={node.dueDate}
                  onChange={(e) => onUpdate({ dueDate: e.target.value })}
                  style={{
                    background: "transparent",
                    border: "none",
                    outline: "none",
                    color: "rgba(255,255,255,0.55)",
                    fontSize: 11,
                    fontFamily: "inherit",
                    cursor: "pointer",
                  }}
                />
              </label>

              {/* Node color */}
              <div style={{ display: "flex", gap: 4 }}>
                {NODE_ACCENT_COLORS.map((c) => (
                  <button
                    key={c}
                    onClick={() => onUpdate({ color: c })}
                    style={{
                      width: 14,
                      height: 14,
                      borderRadius: "50%",
                      background: c,
                      border: node.color === c ? "2px solid white" : "2px solid transparent",
                      cursor: "pointer",
                      transition: "transform 0.15s",
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.transform = "scale(1.3)")}
                    onMouseLeave={(e) => (e.currentTarget.style.transform = "scale(1)")}
                  />
                ))}
              </div>
            </div>

            {/* ── Rich Text Toolbar ─────────────────────── */}
            <div
              style={{
                padding: "8px 12px",
                borderBottom: "1px solid rgba(255,255,255,0.05)",
                display: "flex",
                alignItems: "center",
                gap: 2,
                flexWrap: "wrap",
                background: "rgba(255,255,255,0.02)",
              }}
              onMouseDown={(e) => { e.preventDefault(); saveSelection(); }}
            >
              {/* Font family */}
              <div style={{ position: "relative" }}>
                <button
                  className={toolbarBtnCls}
                  style={{ width: "auto", padding: "0 8px", gap: 4, fontSize: 11 }}
                  onClick={() => { setShowFontPicker((v) => !v); setShowHighlights(false); setShowTextColors(false); }}
                >
                  <Type size={12} />
                  <span style={{ maxWidth: 80, overflow: "hidden", whiteSpace: "nowrap", textOverflow: "ellipsis", fontSize: 10 }}>
                    {FONTS.find((f) => f.value === activeFontFamily)?.name ?? "Font"}
                  </span>
                  <ChevronDown size={10} />
                </button>
                {showFontPicker && (
                  <div
                    style={{
                      position: "absolute",
                      top: "calc(100% + 4px)",
                      left: 0,
                      background: "#1e1e32",
                      border: "1px solid rgba(255,255,255,0.1)",
                      borderRadius: 10,
                      padding: 6,
                      zIndex: 100,
                      minWidth: 180,
                      boxShadow: "0 16px 48px rgba(0,0,0,0.6)",
                    }}
                  >
                    {FONTS.map((f) => (
                      <button
                        key={f.value}
                        onMouseDown={(e) => { e.preventDefault(); applyFont(f.value); }}
                        style={{
                          display: "block",
                          width: "100%",
                          textAlign: "left",
                          padding: "6px 10px",
                          borderRadius: 7,
                          fontSize: 13,
                          fontFamily: f.value,
                          color: "rgba(255,255,255,0.8)",
                          background: activeFontFamily === f.value ? "rgba(139,92,246,0.2)" : "transparent",
                          border: "none",
                          cursor: "pointer",
                        }}
                      >
                        {f.name}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Font size */}
              <div style={{ display: "flex", alignItems: "center", gap: 1 }}>
                <button className={toolbarBtnCls} onMouseDown={(e) => { e.preventDefault(); applyFontSize(fontSize - 2); }}>
                  <Minus size={10} />
                </button>
                <input
                  type="number"
                  value={fontSize}
                  onChange={(e) => applyFontSize(Number(e.target.value))}
                  style={{
                    width: 32,
                    background: "rgba(255,255,255,0.06)",
                    border: "none",
                    borderRadius: 5,
                    color: "rgba(255,255,255,0.7)",
                    textAlign: "center",
                    fontSize: 11,
                    outline: "none",
                    padding: "2px 0",
                  }}
                />
                <button className={toolbarBtnCls} onMouseDown={(e) => { e.preventDefault(); applyFontSize(fontSize + 2); }}>
                  <Plus size={10} />
                </button>
              </div>

              <div style={{ width: 1, height: 18, background: "rgba(255,255,255,0.1)", margin: "0 2px" }} />

              {/* Heading buttons */}
              {[1, 2, 3].map((level) => (
                <button
                  key={level}
                  className={toolbarBtnCls}
                  style={{ fontSize: 11, fontWeight: 700, width: "auto", padding: "0 6px" }}
                  onMouseDown={(e) => { e.preventDefault(); applyHeading(level); }}
                >
                  H{level}
                </button>
              ))}

              <div style={{ width: 1, height: 18, background: "rgba(255,255,255,0.1)", margin: "0 2px" }} />

              {/* Bold / Italic / Underline */}
              <button className={toolbarBtnCls} onMouseDown={(e) => { e.preventDefault(); exec("bold"); }}>
                <Bold size={13} />
              </button>
              <button className={toolbarBtnCls} onMouseDown={(e) => { e.preventDefault(); exec("italic"); }}>
                <Italic size={13} />
              </button>
              <button className={toolbarBtnCls} onMouseDown={(e) => { e.preventDefault(); exec("underline"); }}>
                <Underline size={13} />
              </button>

              <div style={{ width: 1, height: 18, background: "rgba(255,255,255,0.1)", margin: "0 2px" }} />

              {/* Alignment */}
              <button className={toolbarBtnCls} onMouseDown={(e) => { e.preventDefault(); exec("justifyLeft"); }}>
                <AlignLeft size={13} />
              </button>
              <button className={toolbarBtnCls} onMouseDown={(e) => { e.preventDefault(); exec("justifyCenter"); }}>
                <AlignCenter size={13} />
              </button>
              <button className={toolbarBtnCls} onMouseDown={(e) => { e.preventDefault(); exec("justifyRight"); }}>
                <AlignRight size={13} />
              </button>

              <div style={{ width: 1, height: 18, background: "rgba(255,255,255,0.1)", margin: "0 2px" }} />

              {/* Lists */}
              <button className={toolbarBtnCls} onMouseDown={(e) => { e.preventDefault(); exec("insertUnorderedList"); }}>
                <List size={13} />
              </button>
              <button className={toolbarBtnCls} onMouseDown={(e) => { e.preventDefault(); exec("insertOrderedList"); }}>
                <ListOrdered size={13} />
              </button>

              <div style={{ width: 1, height: 18, background: "rgba(255,255,255,0.1)", margin: "0 2px" }} />

              {/* Text color */}
              <div style={{ position: "relative" }}>
                <button
                  className={toolbarBtnCls}
                  onClick={() => { setShowTextColors((v) => !v); setShowHighlights(false); setShowFontPicker(false); }}
                  title="Text color"
                >
                  <Palette size={13} />
                </button>
                {showTextColors && (
                  <div
                    style={{
                      position: "absolute",
                      top: "calc(100% + 4px)",
                      left: 0,
                      background: "#1e1e32",
                      border: "1px solid rgba(255,255,255,0.1)",
                      borderRadius: 10,
                      padding: 8,
                      zIndex: 100,
                      boxShadow: "0 16px 48px rgba(0,0,0,0.6)",
                      display: "grid",
                      gridTemplateColumns: "repeat(6, 1fr)",
                      gap: 4,
                    }}
                  >
                    {TEXT_COLORS.map((c) => (
                      <button
                        key={c}
                        onMouseDown={(e) => { e.preventDefault(); applyTextColor(c); }}
                        style={{
                          width: 20,
                          height: 20,
                          borderRadius: "50%",
                          background: c,
                          border: "2px solid rgba(255,255,255,0.1)",
                          cursor: "pointer",
                        }}
                      />
                    ))}
                  </div>
                )}
              </div>

              {/* Highlight */}
              <div style={{ position: "relative" }}>
                <button
                  className={toolbarBtnCls}
                  onClick={() => { setShowHighlights((v) => !v); setShowTextColors(false); setShowFontPicker(false); }}
                  title="Highlight"
                  style={{ fontSize: 11 }}
                >
                  ✏️
                </button>
                {showHighlights && (
                  <div
                    style={{
                      position: "absolute",
                      top: "calc(100% + 4px)",
                      left: 0,
                      background: "#1e1e32",
                      border: "1px solid rgba(255,255,255,0.1)",
                      borderRadius: 10,
                      padding: 8,
                      zIndex: 100,
                      boxShadow: "0 16px 48px rgba(0,0,0,0.6)",
                      display: "flex",
                      gap: 4,
                      flexWrap: "wrap",
                      width: 180,
                    }}
                  >
                    {HIGHLIGHTS.map((h) => (
                      <button
                        key={h.label}
                        onMouseDown={(e) => { e.preventDefault(); applyHighlight(h.bg, h.text); }}
                        style={{
                          padding: "3px 8px",
                          borderRadius: 6,
                          fontSize: 10,
                          fontWeight: 700,
                          background: h.bg,
                          color: h.text === "inherit" ? "rgba(255,255,255,0.7)" : h.text,
                          border: "1px solid rgba(0,0,0,0.1)",
                          cursor: "pointer",
                        }}
                      >
                        {h.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* ── Editor ───────────────────────────────────── */}
            <div
              style={{ flex: 1, overflow: "auto", padding: "16px 20px" }}
              onClick={() => { setShowFontPicker(false); setShowHighlights(false); setShowTextColors(false); }}
            >
              <div
                ref={editorRef}
                contentEditable
                suppressContentEditableWarning
                onInput={saveContent}
                onMouseUp={saveSelection}
                onKeyUp={saveSelection}
                data-placeholder="Start writing your strategy, notes, details…"
                style={{
                  minHeight: 200,
                  outline: "none",
                  color: "rgba(255,255,255,0.82)",
                  fontSize: 14,
                  lineHeight: 1.7,
                  fontFamily: "Inter, sans-serif",
                  caretColor: "#8b5cf6",
                }}
              />
            </div>

            {/* ── Progress ──────────────────────────────── */}
            <div
              style={{
                padding: "12px 20px",
                borderTop: "1px solid rgba(255,255,255,0.05)",
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginBottom: 8,
                }}
              >
                <span style={{ fontSize: 11, fontWeight: 700, color: "rgba(255,255,255,0.4)", textTransform: "uppercase", letterSpacing: "0.08em" }}>
                  Progress
                </span>
                <span style={{ fontSize: 12, fontWeight: 700, color: node.color }}>
                  {node.progress}%
                </span>
              </div>
              <input
                type="range"
                min={0}
                max={100}
                value={node.progress}
                onChange={(e) => onUpdate({ progress: Number(e.target.value) })}
                style={{
                  width: "100%",
                  accentColor: node.color,
                  cursor: "pointer",
                  height: 4,
                }}
              />
            </div>

            {/* ── Tags ─────────────────────────────────── */}
            <div
              style={{
                padding: "12px 20px",
                borderTop: "1px solid rgba(255,255,255,0.05)",
              }}
            >
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 8 }}>
                {node.tags.map((tag) => (
                  <span
                    key={tag}
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 5,
                      fontSize: 11,
                      fontWeight: 600,
                      color: "rgba(255,255,255,0.55)",
                      background: "rgba(255,255,255,0.06)",
                      padding: "3px 8px",
                      borderRadius: 99,
                    }}
                  >
                    #{tag}
                    <button
                      onClick={() => removeTag(tag)}
                      style={{ background: "none", border: "none", cursor: "pointer", color: "rgba(255,255,255,0.3)", padding: 0 }}
                    >
                      <X size={10} />
                    </button>
                  </span>
                ))}
              </div>
              <div style={{ display: "flex", gap: 6 }}>
                <div
                  style={{
                    flex: 1,
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                    background: "rgba(255,255,255,0.05)",
                    border: "1px solid rgba(255,255,255,0.08)",
                    borderRadius: 8,
                    padding: "6px 10px",
                  }}
                >
                  <Tag size={11} style={{ color: "rgba(255,255,255,0.3)", flexShrink: 0 }} />
                  <input
                    value={tagInput}
                    onChange={(e) => setTagInput(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && addTag()}
                    placeholder="Add tag…"
                    style={{
                      flex: 1,
                      background: "transparent",
                      border: "none",
                      outline: "none",
                      color: "rgba(255,255,255,0.7)",
                      fontSize: 12,
                      fontFamily: "inherit",
                    }}
                  />
                </div>
                <button
                  onClick={addTag}
                  style={{
                    padding: "6px 12px",
                    background: "rgba(255,255,255,0.06)",
                    border: "1px solid rgba(255,255,255,0.08)",
                    borderRadius: 8,
                    color: "rgba(255,255,255,0.6)",
                    fontSize: 11,
                    fontWeight: 700,
                    cursor: "pointer",
                  }}
                >
                  Add
                </button>
              </div>
            </div>

            {/* ── Footer: delete ───────────────────────── */}
            <div
              style={{
                padding: "12px 20px",
                borderTop: "1px solid rgba(255,255,255,0.06)",
                display: "flex",
                justifyContent: "flex-end",
              }}
            >
              <button
                onClick={() => { onDelete(node.id); onClose(); }}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  padding: "6px 14px",
                  background: "rgba(239,68,68,0.1)",
                  border: "1px solid rgba(239,68,68,0.2)",
                  borderRadius: 8,
                  color: "#ef4444",
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: "pointer",
                  transition: "all 0.2s",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = "rgba(239,68,68,0.2)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = "rgba(239,68,68,0.1)";
                }}
              >
                <Trash2 size={13} />
                Delete node
              </button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
