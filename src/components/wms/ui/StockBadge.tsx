'use client';

import React from 'react';
import { InventoryBucket } from '@/lib/wms/types';
import { BUCKET_CONFIG } from '@/lib/wms/constants';

interface StockBadgeProps {
  bucket: InventoryBucket;
  quantity?: number; // if provided, shows quantity in the badge
  size?: 'sm' | 'md' | 'lg';
}

export function StockBadge({ bucket, quantity, size = 'md' }: StockBadgeProps) {
  const config = BUCKET_CONFIG[bucket] ?? {
    label: bucket,
    color: '#6b7280',
    bgColor: '#f3f4f6',
    description: 'Unknown bucket',
  };

  const sizeClasses = {
    sm: 'text-[10px] px-1.5 py-0.5 gap-1',
    md: 'text-xs px-2.5 py-1 gap-1.5',
    lg: 'text-sm px-3.5 py-1.5 gap-2',
  };

  const dotSize = {
    sm: 'w-1 h-1',
    md: 'w-1.5 h-1.5',
    lg: 'w-2 h-2',
  };

  return (
    <span
      className={`inline-flex items-center font-semibold rounded-full border border-black/5 dark:border-white/5 ${sizeClasses[size]}`}
      style={{
        backgroundColor: config.bgColor,
        color: config.color,
      }}
      title={config.description}
    >
      <span
        className="rounded-full shrink-0 animate-pulse"
        style={{ backgroundColor: config.color }}
      />
      <span>
        {config.label}
        {quantity !== undefined && (
          <span className="ml-1 font-bold opacity-80">({quantity})</span>
        )}
      </span>
    </span>
  );
}
