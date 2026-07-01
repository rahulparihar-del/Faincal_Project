'use client';

import React from 'react';
import { StockMovementType } from '@/lib/wms/types';
import { MOVEMENT_TYPE_CONFIG } from '@/lib/wms/constants';
import { ArrowDownLeft, ArrowUpRight } from 'lucide-react';

interface MovementTypeBadgeProps {
  type: StockMovementType;
  compact?: boolean;
}

export function MovementTypeBadge({ type, compact = false }: MovementTypeBadgeProps) {
  const config = MOVEMENT_TYPE_CONFIG[type] ?? {
    label: type,
    color: '#6b7280',
    isInbound: true,
  };

  const isPositive = config.isInbound;

  if (compact) {
    return (
      <span
        className={`inline-flex items-center justify-center w-6 h-6 rounded-full border border-black/5 dark:border-white/5`}
        style={{
          backgroundColor: isPositive ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)',
          color: config.color,
        }}
        title={config.label}
      >
        {isPositive ? (
          <ArrowDownLeft className="w-3.5 h-3.5" />
        ) : (
          <ArrowUpRight className="w-3.5 h-3.5" />
        )}
      </span>
    );
  }

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider border`}
      style={{
        backgroundColor: isPositive ? 'rgba(16, 185, 129, 0.06)' : 'rgba(239, 68, 68, 0.06)',
        color: config.color,
        borderColor: `${config.color}20`,
      }}
    >
      {isPositive ? (
        <ArrowDownLeft className="w-3 h-3 text-emerald-500" />
      ) : (
        <ArrowUpRight className="w-3 h-3 text-rose-500" />
      )}
      {config.label}
    </span>
  );
}
