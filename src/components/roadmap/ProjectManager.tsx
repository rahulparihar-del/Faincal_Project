"use client";

import React, { useState, useRef, useEffect } from "react";
import { Plus, X, Pencil, Check } from "lucide-react";
import { RoadmapProject, PROJECT_COLORS } from "./types";

interface Props {
  projects: RoadmapProject[];
  activeProjectId: string | null;
  onSelect: (id: string) => void;
  onAdd: (name: string, color: string) => void;
  onDelete: (id: string) => void;
  onRename: (id: string, name: string) => void;
  nodeCountMap: Record<string, number>;
}

export function ProjectManager({
  projects,
  activeProjectId,
  onSelect,
  onAdd,
  onDelete,
  onRename,
  nodeCountMap,
}: Props) {
  const [isAdding, setIsAdding] = useState(false);
  const [newName, setNewName] = useState("");
  const [newColor, setNewColor] = useState(PROJECT_COLORS[0]);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameVal, setRenameVal] = useState("");
  const newInputRef = useRef<HTMLInputElement>(null);
  const renameRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isAdding) newInputRef.current?.focus();
  }, [isAdding]);

  useEffect(() => {
    if (renamingId) renameRef.current?.focus();
  }, [renamingId]);

  const commitAdd = () => {
    const name = newName.trim();
    if (name) onAdd(name, newColor);
    setIsAdding(false);
    setNewName("");
    setNewColor(PROJECT_COLORS[0]);
  };

  const commitRename = () => {
    const name = renameVal.trim();
    if (name && renamingId) onRename(renamingId, name);
    setRenamingId(null);
    setRenameVal("");
  };

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 6,
        padding: "0 20px",
        height: 52,
        borderBottom: "1px solid rgba(255,255,255,0.06)",
        background: "rgba(10,10,18,0.95)",
        overflowX: "auto",
        scrollbarWidth: "none",
        flexShrink: 0,
      }}
    >
      {projects.map((project) => {
        const isActive = project.id === activeProjectId;
        const isRenaming = renamingId === project.id;
        const count = nodeCountMap[project.id] ?? 0;

        return (
          <div
            key={project.id}
            onClick={() => !isRenaming && onSelect(project.id)}
            onDoubleClick={() => {
              setRenamingId(project.id);
              setRenameVal(project.name);
            }}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 7,
              padding: "0 12px",
              height: 34,
              borderRadius: 9,
              background: isActive ? `${project.color}20` : "rgba(255,255,255,0.04)",
              border: isActive ? `1px solid ${project.color}50` : "1px solid rgba(255,255,255,0.06)",
              cursor: "pointer",
              transition: "all 0.2s",
              flexShrink: 0,
              position: "relative",
            }}
          >
            {/* Color dot */}
            <div
              style={{
                width: 7,
                height: 7,
                borderRadius: "50%",
                background: project.color,
                boxShadow: isActive ? `0 0 6px ${project.color}` : "none",
                flexShrink: 0,
              }}
            />

            {/* Name or rename input */}
            {isRenaming ? (
              <input
                ref={renameRef}
                value={renameVal}
                onChange={(e) => setRenameVal(e.target.value)}
                onBlur={commitRename}
                onKeyDown={(e) => {
                  if (e.key === "Enter") commitRename();
                  if (e.key === "Escape") setRenamingId(null);
                }}
                onClick={(e) => e.stopPropagation()}
                style={{
                  background: "transparent",
                  border: "none",
                  outline: "none",
                  color: "rgba(255,255,255,0.9)",
                  fontSize: 12,
                  fontWeight: 600,
                  width: 80,
                  fontFamily: "inherit",
                }}
              />
            ) : (
              <span
                style={{
                  fontSize: 12,
                  fontWeight: 600,
                  color: isActive ? "rgba(255,255,255,0.9)" : "rgba(255,255,255,0.45)",
                  whiteSpace: "nowrap",
                  transition: "color 0.2s",
                }}
              >
                {project.name}
              </span>
            )}

            {/* Node count badge */}
            {count > 0 && (
              <span
                style={{
                  fontSize: 9,
                  fontWeight: 700,
                  color: isActive ? project.color : "rgba(255,255,255,0.25)",
                  background: isActive ? `${project.color}20` : "rgba(255,255,255,0.05)",
                  padding: "1px 5px",
                  borderRadius: 99,
                }}
              >
                {count}
              </span>
            )}

            {/* Delete button (on active project) */}
            {isActive && projects.length > 1 && !isRenaming && (
              <button
                onClick={(e) => { e.stopPropagation(); onDelete(project.id); }}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  width: 16,
                  height: 16,
                  borderRadius: 4,
                  background: "rgba(255,255,255,0.05)",
                  border: "none",
                  cursor: "pointer",
                  color: "rgba(255,255,255,0.3)",
                  padding: 0,
                  marginLeft: 2,
                  transition: "all 0.15s",
                }}
                onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(239,68,68,0.2)"; e.currentTarget.style.color = "#ef4444"; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = "rgba(255,255,255,0.05)"; e.currentTarget.style.color = "rgba(255,255,255,0.3)"; }}
              >
                <X size={10} />
              </button>
            )}
          </div>
        );
      })}

      {/* Add project */}
      {isAdding ? (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            padding: "0 10px",
            height: 34,
            borderRadius: 9,
            background: "rgba(255,255,255,0.06)",
            border: "1px solid rgba(255,255,255,0.12)",
            flexShrink: 0,
          }}
        >
          {/* Color picker row */}
          <div style={{ display: "flex", gap: 3 }}>
            {PROJECT_COLORS.slice(0, 5).map((c) => (
              <button
                key={c}
                onClick={() => setNewColor(c)}
                style={{
                  width: 10,
                  height: 10,
                  borderRadius: "50%",
                  background: c,
                  border: newColor === c ? "2px solid white" : "2px solid transparent",
                  cursor: "pointer",
                  padding: 0,
                }}
              />
            ))}
          </div>
          <input
            ref={newInputRef}
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") commitAdd();
              if (e.key === "Escape") { setIsAdding(false); setNewName(""); }
            }}
            placeholder="Project name…"
            style={{
              background: "transparent",
              border: "none",
              outline: "none",
              color: "rgba(255,255,255,0.8)",
              fontSize: 12,
              fontWeight: 600,
              width: 110,
              fontFamily: "inherit",
            }}
          />
          <button
            onClick={commitAdd}
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              width: 20,
              height: 20,
              borderRadius: 5,
              background: "rgba(139,92,246,0.3)",
              border: "none",
              cursor: "pointer",
              color: "#a78bfa",
              padding: 0,
            }}
          >
            <Check size={12} />
          </button>
          <button
            onClick={() => { setIsAdding(false); setNewName(""); }}
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              width: 20,
              height: 20,
              borderRadius: 5,
              background: "rgba(255,255,255,0.05)",
              border: "none",
              cursor: "pointer",
              color: "rgba(255,255,255,0.3)",
              padding: 0,
            }}
          >
            <X size={12} />
          </button>
        </div>
      ) : (
        <button
          onClick={() => setIsAdding(true)}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 5,
            padding: "0 10px",
            height: 30,
            borderRadius: 8,
            background: "transparent",
            border: "1px dashed rgba(255,255,255,0.15)",
            color: "rgba(255,255,255,0.35)",
            fontSize: 11,
            fontWeight: 600,
            cursor: "pointer",
            transition: "all 0.2s",
            flexShrink: 0,
            whiteSpace: "nowrap",
          }}
          onMouseEnter={(e) => { e.currentTarget.style.borderColor = "rgba(139,92,246,0.5)"; e.currentTarget.style.color = "#a78bfa"; }}
          onMouseLeave={(e) => { e.currentTarget.style.borderColor = "rgba(255,255,255,0.15)"; e.currentTarget.style.color = "rgba(255,255,255,0.35)"; }}
        >
          <Plus size={12} />
          New Project
        </button>
      )}
    </div>
  );
}
