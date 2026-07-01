'use client';

import React from 'react';

interface SkeletonTableProps {
  rows?: number;
  columns?: number;
  className?: string;
}

export function SkeletonTable({ rows = 5, columns = 4, className = '' }: SkeletonTableProps) {
  return (
    <>
      {Array.from({ length: rows }).map((_, rIdx) => (
        <tr key={`sk-row-${rIdx}`} className={`animate-shimmer ${className}`}>
          {Array.from({ length: columns }).map((_, cIdx) => {
            // Varying widths for visual realism
            const widths = ['w-2/3', 'w-1/2', 'w-3/4', 'w-5/6'];
            const wClass = widths[(rIdx + cIdx) % widths.length];

            return (
              <td key={`sk-cell-${rIdx}-${cIdx}`} className="px-4 py-3.5">
                <div className={`h-3 bg-slate-200 dark:bg-slate-800 rounded ${wClass}`} />
              </td>
            );
          })}
        </tr>
      ))}
    </>
  );
}
