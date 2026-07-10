"use client";

import React, { useState, useCallback, useRef, useEffect } from "react";
import { useSupabaseTable } from "@/lib/hooks/useSupabaseTable";
import {
  RoadmapProject,
  RoadmapNode,
  RoadmapEdge,
  NODE_ACCENT_COLORS,
  PROJECT_COLORS,
} from "@/components/roadmap/types";
import { RoadmapCanvas } from "@/components/roadmap/RoadmapCanvas";
import { NodeDetailPanel } from "@/components/roadmap/NodeDetailPanel";
import { RoadmapToolbar } from "@/components/roadmap/RoadmapToolbar";
import { ProjectManager } from "@/components/roadmap/ProjectManager";

/* ── Helpers ─────────────────────────────────────────────── */
function uid() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

function makeDefaultProject(): RoadmapProject {
  return {
    id: uid(),
    name: "Instagram Post Strategy",
    color: PROJECT_COLORS[0],
    createdAt: new Date().toISOString(),
  };
}

function makeDefaultNode(projectId: string, x: number, y: number, dayNumber: number): RoadmapNode {
  return {
    id: uid(),
    projectId,
    title: `Day ${dayNumber}: Post Title`,
    richContent: "",
    status: "todo",
    priority: "medium",
    tags: ["strategy"],
    progress: 0,
    dueDate: new Date().toISOString().split("T")[0],
    x,
    y,
    color: NODE_ACCENT_COLORS[Math.floor(Math.random() * NODE_ACCENT_COLORS.length)],
  };
}

/* ── Auto layout (top-down tree) ────────────────────────── */
function autoLayout(nodes: RoadmapNode[], edges: RoadmapEdge[]): RoadmapNode[] {
  if (nodes.length === 0) return nodes;

  const NODE_W = 260;
  const NODE_H = 260; // larger for Instagram square images
  const H_GAP = 60;
  const V_GAP = 80;

  // Build adjacency
  const children: Record<string, string[]> = {};
  const parents: Record<string, string[]> = {};
  nodes.forEach((n) => { children[n.id] = []; parents[n.id] = []; });
  edges.forEach((e) => {
    children[e.fromNodeId]?.push(e.toNodeId);
    parents[e.toNodeId]?.push(e.fromNodeId);
  });

  // Find roots (no parents)
  let roots = nodes.filter((n) => (parents[n.id]?.length ?? 0) === 0).map((n) => n.id);
  if (roots.length === 0) roots = [nodes[0].id];

  const positions: Record<string, { x: number; y: number }> = {};
  const visited = new Set<string>();

  // BFS layout
  const queue: { id: string; depth: number }[] = roots.map((id) => ({ id, depth: 0 }));
  const depthCols: Record<number, number> = {};

  while (queue.length > 0) {
    const { id, depth } = queue.shift()!;
    if (visited.has(id)) continue;
    visited.add(id);

    if (depthCols[depth] === undefined) depthCols[depth] = 0;
    const c = depthCols[depth];
    positions[id] = {
      x: c * (NODE_W + H_GAP) + 80,
      y: depth * (NODE_H + V_GAP) + 80,
    };
    depthCols[depth]++;

    children[id]?.forEach((child) => {
      if (!visited.has(child)) queue.push({ id: child, depth: depth + 1 });
    });
  }

  // Orphans
  let orphanCol = 0;
  const maxDepth = Math.max(...Object.values(depthCols).map((_, i) => i), 0);
  nodes.forEach((n) => {
    if (!positions[n.id]) {
      positions[n.id] = { x: orphanCol * (NODE_W + H_GAP) + 80, y: (maxDepth + 2) * (NODE_H + V_GAP) + 80 };
      orphanCol++;
    }
  });

  return nodes.map((n) => ({ ...n, ...positions[n.id] }));
}

/* ── Page ────────────────────────────────────────────────── */
export default function RoadmapPage() {
  const [projects, setProjects, projectsReady] = useSupabaseTable<RoadmapProject>(
    "roadmap_projects",
    "biztrack_rm_projects",
    []
  );
  const [nodes, setNodes, nodesReady] = useSupabaseTable<RoadmapNode>(
    "roadmap_nodes",
    "biztrack_rm_nodes",
    []
  );
  const [edges, setEdges, edgesReady] = useSupabaseTable<RoadmapEdge>(
    "roadmap_edges",
    "biztrack_rm_edges",
    []
  );

  const [activeProjectId, setActiveProjectId] = useState<string | null>(null);
  const [selectedNode, setSelectedNode] = useState<RoadmapNode | null>(null);
  const [canvasTransform, setCanvasTransform] = useState({ x: 80, y: 60, scale: 0.85 }); // Zoomed out slightly by default
  const canvasRef = useRef<HTMLDivElement>(null);

  // Initialize default project and nodes once ready
  useEffect(() => {
    if (!projectsReady || !nodesReady || !edgesReady) return;
    if (projects.length === 0) {
      const p = makeDefaultProject();
      setProjects([p]);
      setActiveProjectId(p.id);

      // Prepopulate sequence of 3 mock days for beautiful default view
      const day1Id = uid();
      const day2Id = uid();
      const day3Id = uid();

      const initialNodes: RoadmapNode[] = [
        {
          id: day1Id,
          projectId: p.id,
          title: "Day 1: Brand Introduction",
          richContent: "Introduce the faces behind the brand! Share your founding story, core values, and what to expect on this account.<br><br>Call to Action: Read our story in the caption and say hi in the comments!",
          status: "done",
          priority: "medium", // Carousel
          tags: ["branding", "storytelling", "intro"],
          progress: 100,
          dueDate: new Date().toISOString().split("T")[0],
          x: 120,
          y: 80,
          color: "#7c3aed",
          imageUrl: "https://images.unsplash.com/photo-1522071820081-009f0129c71c?auto=format&fit=crop&w=500&q=80",
        },
        {
          id: day2Id,
          projectId: p.id,
          title: "Day 2: Core Educational Value",
          richContent: "Provide immediate, high-value advice on a major pain point your audience faces. Keep it clear, quick, and highly practical.<br><br>Call to Action: Save this Reel so you can reference it later!",
          status: "in-progress",
          priority: "low", // Reel
          tags: ["education", "marketing", "quicktips"],
          progress: 40,
          dueDate: new Date(Date.now() + 86400000).toISOString().split("T")[0],
          x: 120,
          y: 440,
          color: "#2563eb",
          imageUrl: "https://images.unsplash.com/photo-1460925895917-afdab827c52f?auto=format&fit=crop&w=500&q=80",
        },
        {
          id: day3Id,
          projectId: p.id,
          title: "Day 3: Call to Action Offer",
          richContent: "Introduce your primary product or coaching offer with a limited-time bonus discount. Make sure to explain exactly how it benefits the reader.<br><br>Call to Action: DM us the word 'STRATEGY' to get access!",
          status: "todo",
          priority: "high", // Single Image
          tags: ["sales", "strategy", "promo"],
          progress: 0,
          dueDate: new Date(Date.now() + 172800000).toISOString().split("T")[0],
          x: 120,
          y: 800,
          color: "#db2777",
          imageUrl: "https://images.unsplash.com/photo-1611162617213-7d7a39e9b1d7?auto=format&fit=crop&w=500&q=80",
        }
      ];

      const initialEdges: RoadmapEdge[] = [
        {
          id: uid(),
          projectId: p.id,
          fromNodeId: day1Id,
          toNodeId: day2Id,
          fromHandle: "bottom",
          toHandle: "top",
        },
        {
          id: uid(),
          projectId: p.id,
          fromNodeId: day2Id,
          toNodeId: day3Id,
          fromHandle: "bottom",
          toHandle: "top",
        }
      ];

      setNodes(initialNodes);
      setEdges(initialEdges);
    } else if (!activeProjectId) {
      setActiveProjectId(projects[0].id);
    }
  }, [projectsReady, nodesReady, edgesReady]); // eslint-disable-line react-hooks/exhaustive-deps

  const projectNodes = nodes.filter((n) => n.projectId === activeProjectId);
  const projectEdges = edges.filter((e) => e.projectId === activeProjectId);

  /* ── Node handlers ─────────────────────────────────────── */
  const handleAddNode = useCallback(
    (x?: number, y?: number) => {
      if (!activeProjectId) return;
      const canvasX = x ?? (canvasRef.current?.clientWidth ?? 800) / 2 / canvasTransform.scale - 130 + Math.random() * 40;
      const canvasY = y ?? 200 + Math.random() * 60;
      
      setNodes((prev) => {
        const count = prev.filter((n) => n.projectId === activeProjectId).length;
        const node = makeDefaultNode(activeProjectId, canvasX, canvasY, count + 1);
        setSelectedNode(node);
        return [...prev, node];
      });
    },
    [activeProjectId, canvasTransform.scale, setNodes]
  );

  const handleNodeUpdate = useCallback(
    (id: string, patch: Partial<RoadmapNode>) => {
      setNodes((prev) => prev.map((n) => (n.id === id ? { ...n, ...patch } : n)));
      setSelectedNode((prev) => (prev?.id === id ? { ...prev, ...patch } : prev));
    },
    [setNodes]
  );

  const handleNodeDelete = useCallback(
    (id: string) => {
      setNodes((prev) => prev.filter((n) => n.id !== id));
      setEdges((prev) => prev.filter((e) => e.fromNodeId !== id && e.toNodeId !== id));
      setSelectedNode((prev) => (prev?.id === id ? null : prev));
    },
    [setNodes, setEdges]
  );

  /* ── Edge handlers ─────────────────────────────────────── */
  const handleEdgeAdd = useCallback(
    (edge: Omit<RoadmapEdge, "id">) => {
      setEdges((prev) => [...prev, { ...edge, id: uid() }]);
    },
    [setEdges]
  );

  const handleEdgeDelete = useCallback(
    (id: string) => {
      setEdges((prev) => prev.filter((e) => e.id !== id));
    },
    [setEdges]
  );

  /* ── Project handlers ──────────────────────────────────── */
  const handleAddProject = useCallback(
    (name: string, color: string) => {
      const p: RoadmapProject = { id: uid(), name, color, createdAt: new Date().toISOString() };
      setProjects((prev) => [...prev, p]);
      setActiveProjectId(p.id);
      setSelectedNode(null);
      setCanvasTransform({ x: 80, y: 60, scale: 1 });
    },
    [setProjects]
  );

  const handleDeleteProject = useCallback(
    (id: string) => {
      setProjects((prev) => {
        const filtered = prev.filter((p) => p.id !== id);
        if (filtered.length === 0) {
          const newP = makeDefaultProject();
          setActiveProjectId(newP.id);
          return [newP];
        }
        setActiveProjectId(filtered[0].id);
        return filtered;
      });
      setNodes((prev) => prev.filter((n) => n.projectId !== id));
      setEdges((prev) => prev.filter((e) => e.projectId !== id));
      setSelectedNode(null);
    },
    [setProjects, setNodes, setEdges]
  );

  const handleRenameProject = useCallback(
    (id: string, name: string) => {
      setProjects((prev) => prev.map((p) => (p.id === id ? { ...p, name } : p)));
    },
    [setProjects]
  );

  /* ── Auto layout ───────────────────────────────────────── */
  const handleAutoLayout = useCallback(() => {
    const laid = autoLayout(projectNodes, projectEdges);
    setNodes((prev) =>
      prev.map((n) => {
        const updated = laid.find((l) => l.id === n.id);
        return updated ? { ...n, x: updated.x, y: updated.y } : n;
      })
    );
  }, [projectNodes, projectEdges, setNodes]);

  /* ── Reset view ────────────────────────────────────────── */
  const handleResetView = useCallback(() => {
    setCanvasTransform({ x: 80, y: 60, scale: 1 });
  }, []);

  /* ── Export PNG (simple screenshot) ──────────────────────
     We use a hidden canvas trick or open-in-new-tab approach.
     For a real export we'd use html2canvas, but we avoid extra deps. */
  const handleExportPng = useCallback(() => {
    alert("Export: Right-click on the canvas and choose 'Save as Image', or use browser screenshot.");
  }, []);

  /* ── Node count per project ─────────────────────────────── */
  const nodeCountMap = projects.reduce<Record<string, number>>((acc, p) => {
    acc[p.id] = nodes.filter((n) => n.projectId === p.id).length;
    return acc;
  }, {});

  if (!projectsReady || !nodesReady || !edgesReady) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="w-8 h-8 rounded-full border-2 border-violet-500/30 border-t-violet-500 animate-spin" />
      </div>
    );
  }

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        /* Cancel the AppShell padding so the canvas fills edge-to-edge */
        margin: "-1.25rem -1.25rem -2rem",
        height: "calc(100vh - 64px)",
        background: "#f5f5f5",
        position: "relative",
        overflow: "hidden",
      }}
    >
      {/* Google Fonts for editor */}
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;700&family=Space+Grotesk:wght@400;600;700&family=Outfit:wght@400;600;700&family=Fira+Code:wght@400;500&family=DM+Serif+Display&display=swap');
        [contenteditable]:empty:before {
          content: attr(data-placeholder);
          color: #bbb;
          pointer-events: none;
        }
        input[type="range"] {
          -webkit-appearance: none;
          appearance: none;
          height: 4px;
          border-radius: 99px;
          outline: none;
        }
        input[type="range"]::-webkit-slider-thumb {
          -webkit-appearance: none;
          appearance: none;
          width: 14px;
          height: 14px;
          border-radius: 50%;
          background: currentColor;
          cursor: pointer;
        }
      `}</style>

      {/* Project tab bar */}
      <ProjectManager
        projects={projects}
        activeProjectId={activeProjectId}
        onSelect={(id) => {
          setActiveProjectId(id);
          setSelectedNode(null);
          setCanvasTransform({ x: 80, y: 60, scale: 1 });
        }}
        onAdd={handleAddProject}
        onDelete={handleDeleteProject}
        onRename={handleRenameProject}
        nodeCountMap={nodeCountMap}
      />

      {/* Canvas area */}
      <div ref={canvasRef} style={{ flex: 1, position: "relative", overflow: "hidden" }}>
        {activeProjectId && (
          <>
            {/* Toolbar */}
            <RoadmapToolbar
              onAddNode={() => handleAddNode()}
              canvasTransform={canvasTransform}
              onTransformChange={setCanvasTransform}
              onAutoLayout={handleAutoLayout}
              onResetView={handleResetView}
              onExportPng={handleExportPng}
              nodeCount={projectNodes.length}
              edgeCount={projectEdges.length}
            />

            {/* Canvas */}
            <RoadmapCanvas
              nodes={projectNodes}
              edges={projectEdges}
              projectId={activeProjectId}
              onNodeUpdate={handleNodeUpdate}
              onNodeDelete={handleNodeDelete}
              onNodeClick={setSelectedNode}
              onEdgeAdd={handleEdgeAdd}
              onEdgeDelete={handleEdgeDelete}
              onAddNode={handleAddNode}
              canvasTransform={canvasTransform}
              onTransformChange={setCanvasTransform}
            />

            {/* Node detail panel */}
            <NodeDetailPanel
              node={selectedNode}
              onClose={() => setSelectedNode(null)}
              onUpdate={(patch) => selectedNode && handleNodeUpdate(selectedNode.id, patch)}
              onDelete={handleNodeDelete}
            />
          </>
        )}
      </div>
    </div>
  );
}
