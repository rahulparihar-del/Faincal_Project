'use client';

import React, { useEffect, useRef, useState } from 'react';
import { renderBarcodeToCanvas } from '@/lib/wms/barcode-generator';
import { Download } from 'lucide-react';

interface BarcodeDisplayProps {
  value: string; // barcode value to encode
  sku?: string; // shown below barcode as text
  productName?: string; // shown above barcode
  size?: string; // optional size label
  mrp?: number; // optional MRP
  width?: number; // bar width (default 1.5)
  height?: number; // bar height px (default 50)
  displayValue?: boolean; // show text below bars (default true)
  className?: string;
  onGenerated?: (dataUrl: string) => void;
}

export function BarcodeDisplay({
  value,
  sku,
  productName,
  size,
  mrp,
  width = 1.5,
  height = 50,
  displayValue = false, // We'll show text manually for nice formatting
  className = '',
  onGenerated,
}: BarcodeDisplayProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [error, setError] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    let active = true;
    const generate = async () => {
      if (!canvasRef.current) return;
      try {
        setLoading(true);
        setError(false);
        await renderBarcodeToCanvas(canvasRef.current, value, {
          width,
          height,
          displayValue,
          margin: 6,
          background: '#ffffff',
          lineColor: '#000000',
        });
        if (active && onGenerated && canvasRef.current) {
          onGenerated(canvasRef.current.toDataURL('image/png'));
        }
      } catch (err) {
        console.error('Failed to generate barcode:', err);
        if (active) setError(true);
      } finally {
        if (active) setLoading(false);
      }
    };

    generate();

    return () => {
      active = false;
    };
  }, [value, width, height, displayValue, onGenerated]);

  const handleDownload = () => {
    if (!canvasRef.current) return;
    const link = document.createElement('a');
    link.download = `barcode-${sku || value}.png`;
    link.href = canvasRef.current.toDataURL('image/png');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className={`flex flex-col items-center bg-white border border-slate-200 dark:border-slate-800 rounded-xl p-4 shadow-sm w-fit ${className}`}>
      {productName && (
        <span className="text-[10px] font-bold text-slate-800 uppercase tracking-tight text-center max-w-[180px] truncate mb-2">
          {productName}
        </span>
      )}

      <div className="relative bg-white p-1 rounded border border-slate-100 flex items-center justify-center">
        {loading && (
          <div className="absolute inset-0 bg-white/80 dark:bg-slate-900/80 flex items-center justify-center">
            <div className="w-5 h-5 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
          </div>
        )}
        <canvas ref={canvasRef} className={error ? 'hidden' : 'block'} />
        {error && (
          <span className="text-xs font-mono text-rose-500 py-4 px-2">
            Barcode Error: {value}
          </span>
        )}
      </div>

      <div className="mt-2 flex flex-col items-center gap-0.5 text-[9px] font-mono font-bold text-slate-600 dark:text-slate-400">
        <span>SKU: {sku || value}</span>
        <div className="flex gap-3 text-slate-500">
          {size && <span>SZ: {size}</span>}
          {mrp && <span>MRP: ₹{mrp}</span>}
        </div>
      </div>

      <button
        onClick={handleDownload}
        className="mt-3 flex items-center gap-1 text-[10px] font-semibold text-indigo-600 hover:text-indigo-700 bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950/20 dark:text-indigo-400 dark:hover:bg-indigo-950/40 px-2 py-1 rounded transition-colors cursor-pointer"
      >
        <Download className="w-3 h-3" />
        Download Label
      </button>
    </div>
  );
}
