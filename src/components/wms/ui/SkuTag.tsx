'use client';

import React, { useState } from 'react';
import { Clipboard, Check } from 'lucide-react';

interface SkuTagProps {
  sku: string;
  copyable?: boolean;
  size?: 'sm' | 'md';
}

export function SkuTag({ sku, copyable = true, size = 'md' }: SkuTagProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async (e: React.MouseEvent) => {
    e.stopPropagation(); // prevent row click
    try {
      await navigator.clipboard.writeText(sku);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch (err) {
      console.error('Failed to copy text: ', err);
    }
  };

  const sizeClasses = {
    sm: 'text-[10px] px-1.5 py-0.5 rounded',
    md: 'text-xs px-2.5 py-1 rounded-md',
  };

  return (
    <span
      className={`inline-flex items-center gap-1 font-mono font-bold bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 ${sizeClasses[size]}`}
    >
      {sku}
      {copyable && (
        <button
          onClick={handleCopy}
          className="ml-0.5 p-0.5 hover:bg-slate-200 dark:hover:bg-slate-800 rounded transition-colors text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
          title="Copy SKU"
        >
          {copied ? (
            <Check className="w-3 h-3 text-emerald-500" />
          ) : (
            <Clipboard className="w-3 h-3" />
          )}
        </button>
      )}
    </span>
  );
}
