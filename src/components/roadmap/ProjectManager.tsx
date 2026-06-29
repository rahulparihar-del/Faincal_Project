"use client";

import React, { useState, useRef, useEffect } from "react";
import { Plus, X, Check } from "lucide-react";
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
        borderBottom: "1px solid #e8e8e8",
        background: "#ffffff",
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
              background: isActive ? `${project.color}12` : "transparent",
              border: isActive ? `1px solid ${project.color}30` : "1px solid transparent",
              cursor: "pointer",
              transition: "all 0.2s",
              flexShrink: 0,
            }}
            onMouseEnter={(e) => {
              if (!isActive) (e.currentTarget as HTMLElement).style.background = "#f5f5f5";
            }}
            onMouseLeave={(e) => {
              if (!isActive) (e.currentTarget as HTMLElement).style.background = "transparent";
            }}
          >
            {/* Color dot */}
            <div
              style={{
                width: 7,
                height: 7,
                borderRadius: "50%",
                background: project.color,
                boxShadow: isActive ? `0 0 0 2px ${project.color}30` : "none",
                flexShrink: 0,
                transition: "box-shadow 0.2s",
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
                  color: "#1a1a1a",
                  fontSize: 12,
                  fontWeight: 600,
                  width: 90,
                  fontFamily: "inherit",
                }}
              />
            ) : (
              <span
                style={{
                  fontSize: 12,
                  fontWeight: 600,
                  color: isActive ? "#1a1a1a" : "#888",
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
                  color: isActive ? project.color : "#bbb",
                  background: isActive ? `${project.color}12` : "#f5f5f5",
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
                  background: "transparent",
                  border: "none",
                  cursor: "pointer",
                  color: "#ccc",
                  padding: 0,
                  marginLeft: 2,
                  transition: "all 0.15s",
                }}
                onMouseEnter={(e) => { e.currentTarget.style.color = "#ef4444"; e.currentTarget.style.background = "#fef2f2"; }}
                onMouseLeave={(e) => { e.currentTarget.style.color = "#ccc"; e.currentTarget.style.background = "transparent"; }}
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
            background: "#f8f8f8",
            border: "1px solid #e8e8e8",
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
                  border: newColor === c ? `2px solid ${c}` : "2px solid transparent",
                  outline: newColor === c ? `2px solid ${c}40` : "none",
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
              color: "#1a1a1a",
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
              background: "#f0ebff",
              border: "none",
              cursor: "pointer",
              color: "#7c3aed",
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
              background: "#f5f5f5",
              border: "none",
              cursor: "pointer",
              color: "#aaa",
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
            border: "1px dashed #ddd",
            color: "#bbb",
            fontSize: 11,
            fontWeight: 600,
            cursor: "pointer",
            transition: "all 0.2s",
            flexShrink: 0,
            whiteSpace: "nowrap",
          }}
          onMouseEnter={(e) => { e.currentTarget.style.borderColor = "#7c3aed"; e.currentTarget.style.color = "#7c3aed"; e.currentTarget.style.background = "#f5f3ff"; }}
          onMouseLeave={(e) => { e.currentTarget.style.borderColor = "#ddd"; e.currentTarget.style.color = "#bbb"; e.currentTarget.style.background = "transparent"; }}
        >
          <Plus size={12} />
          New Project
        </button>
      )}
    </div>
  );
}
