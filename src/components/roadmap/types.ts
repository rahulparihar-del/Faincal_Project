export type NodeStatus = 'todo' | 'in-progress' | 'done' | 'blocked';
export type NodePriority = 'low' | 'medium' | 'high' | 'critical';
export type HandleSide = 'top' | 'bottom' | 'left' | 'right';

export interface RoadmapProject {
  id: string;
  name: string;
  color: string;
  createdAt: string;
}

export interface RoadmapNode {
  id: string;
  projectId: string;
  title: string;
  richContent: string; // HTML from contentEditable
  status: NodeStatus;
  priority: NodePriority;
  tags: string[];
  progress: number; // 0–100
  dueDate: string;
  x: number;
  y: number;
  color: string; // accent color hex
}

export interface RoadmapEdge {
  id: string;
  projectId: string;
  fromNodeId: string;
  toNodeId: string;
  fromHandle: HandleSide;
  toHandle: HandleSide;
}

export const STATUS_META: Record<NodeStatus, { label: string; color: string; bg: string; border: string }> = {
  todo:        { label: 'To Do',       color: '#6b7280', bg: '#f3f4f6', border: '#d1d5db' },
  'in-progress': { label: 'In Progress', color: '#8b5cf6', bg: '#f5f3ff', border: '#c4b5fd' },
  done:        { label: 'Done',        color: '#10b981', bg: '#ecfdf5', border: '#6ee7b7' },
  blocked:     { label: 'Blocked',     color: '#ef4444', bg: '#fef2f2', border: '#fca5a5' },
};

export const PRIORITY_META: Record<NodePriority, { label: string; color: string; bg: string }> = {
  low:      { label: 'Low',      color: '#6b7280', bg: '#f3f4f6' },
  medium:   { label: 'Medium',   color: '#f59e0b', bg: '#fffbeb' },
  high:     { label: 'High',     color: '#ef4444', bg: '#fef2f2' },
  critical: { label: 'Critical', color: '#7c3aed', bg: '#f5f3ff' },
};

export const NODE_ACCENT_COLORS = [
  '#7c3aed', // violet
  '#2563eb', // blue
  '#059669', // emerald
  '#dc2626', // red
  '#d97706', // amber
  '#db2777', // pink
  '#0891b2', // cyan
  '#65a30d', // lime
];

export const PROJECT_COLORS = [
  '#7c3aed', '#2563eb', '#059669', '#dc2626',
  '#d97706', '#db2777', '#0891b2', '#65a30d',
];
