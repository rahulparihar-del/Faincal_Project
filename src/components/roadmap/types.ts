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
  imageUrl?: string; // base64 or URL for Instagram strategy post image
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
  todo:        { label: 'Draft',       color: '#6b7280', bg: '#f3f4f6', border: '#d1d5db' },
  'in-progress': { label: 'Scheduled', color: '#2563eb', bg: '#eff6ff', border: '#bfdbfe' },
  done:        { label: 'Published',   color: '#059669', bg: '#ecfdf5', border: '#a7f3d0' },
  blocked:     { label: 'Archived',    color: '#dc2626', bg: '#fef2f2', border: '#fca5a5' },
};

export const PRIORITY_META: Record<NodePriority, { label: string; color: string; bg: string }> = {
  low:      { label: 'Reel',      color: '#db2777', bg: '#fdf2f8' },
  medium:   { label: 'Carousel',  color: '#7c3aed', bg: '#f5f3ff' },
  high:     { label: 'Single Image', color: '#0891b2', bg: '#ecfeff' },
  critical: { label: 'Story',     color: '#d97706', bg: '#fffbeb' },
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
