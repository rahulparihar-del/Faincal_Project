'use client';

import React, { useState, useEffect } from 'react';
import { useMasterData } from '@/lib/wms/hooks/useMasterData';
import { getProducts } from '@/lib/wms/services/productService';
import { BarcodeDisplay } from '@/components/wms/ui/BarcodeDisplay';
import { useWmsToast } from '@/components/wms/ui/WmsToast';
import { supabase } from '@/lib/supabase/client';
import { Printer, RefreshCw, Clipboard, Plus, Trash2, List } from 'lucide-react';
import { WmsProduct, WmsProductVariant, WmsBarcodePrintLog } from '@/lib/wms/types';

interface QueueItem {
  id: string;
  variant: WmsProductVariant;
  productName: string;
  copies: number;
}

export default function BarcodeCenterPage() {
  const { templates, loading: masterLoading } = useMasterData();
  const { success, error: toastError, warning } = useWmsToast();

  const [products, setProducts] = useState<WmsProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [printLogs, setPrintLogs] = useState<WmsBarcodePrintLog[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState('');
  const [selectedProductId, setSelectedProductId] = useState('');
  const [selectedVariantId, setSelectedVariantId] = useState('');
  const [copies, setCopies] = useState(1);
  const [printQueue, setPrintQueue] = useState<QueueItem[]>([]);

  // Fetch products catalog
  const loadProducts = async () => {
    setLoading(true);
    try {
      const res = await getProducts({ status: 'active' });
      setProducts(res);
    } catch (err) {
      console.error('Failed to load products:', err);
    } finally {
      setLoading(false);
    }
  };

  // Fetch print history
  const loadPrintLogs = async () => {
    if (!supabase) return;
    try {
      const { data } = await supabase
        .from('wms_barcode_print_log')
        .select(`
          *,
          variant:wms_product_variants(
            sku,
            product:wms_products(product_name),
            size:wms_sizes(label)
          )
        `)
        .order('printed_at', { ascending: false })
        .limit(10);
      
      setPrintLogs(data || []);
    } catch (err) {
      console.error('Failed to load print logs:', err);
    }
  };

  useEffect(() => {
    loadProducts();
    loadPrintLogs();
  }, []);

  useEffect(() => {
    if (templates.length > 0) {
      const def = templates.find((t) => t.is_default) ?? templates[0];
      setSelectedTemplateId(def.id);
    }
  }, [templates]);

  // Derived variants of selected product
  const currentProduct = products.find((p) => p.id === selectedProductId);
  const currentVariant = currentProduct?.variants?.find((v) => v.id === selectedVariantId);

  const handleAddToQueue = () => {
    if (!currentProduct || !currentVariant) {
      toastError('Please select a product and size variant.');
      return;
    }

    const existingIndex = printQueue.findIndex((item) => item.variant.id === currentVariant.id);
    if (existingIndex >= 0) {
      setPrintQueue((prev) =>
        prev.map((item, idx) =>
          idx === existingIndex ? { ...item, copies: item.copies + copies } : item
        )
      );
    } else {
      setPrintQueue((prev) => [
        ...prev,
        {
          id: Math.random().toString(36).substring(2, 9),
          variant: currentVariant,
          productName: currentProduct.product_name,
          copies,
        },
      ]);
    }

    success(`Added ${currentVariant.sku} (${copies} copies) to print queue.`);
  };

  const handleRemoveFromQueue = (id: string) => {
    setPrintQueue((prev) => prev.filter((item) => item.id !== id));
  };

  const handleClearQueue = () => {
    setPrintQueue([]);
  };

  const handlePrintQueue = async () => {
    if (printQueue.length === 0) {
      toastError('Print queue is empty.');
      return;
    }
    if (!supabase) return;

    try {
      // 1. Record logs inside wms_barcode_print_log
      for (const item of printQueue) {
        await supabase.from('wms_barcode_print_log').insert({
          variant_id: item.variant.id,
          sku: item.variant.sku,
          barcode: item.variant.barcode,
          template_id: selectedTemplateId || null,
          copies: item.copies,
          printed_by: 'Admin Operator',
        });
      }

      success('Print logs recorded. Opening browser print dialogue...');

      // 2. Trigger browser native printing on a clean overlay layout
      const printWindow = window.open('', '_blank');
      if (printWindow) {
        printWindow.document.write('<html><head><title>Print Labels</title><style>');
        printWindow.document.write(`
          @page { size: auto; margin: 0; }
          body { font-family: monospace; margin: 0; padding: 10px; display: flex; flex-direction: column; align-items: center; }
          .label-card { width: 50mm; height: 25mm; padding: 2mm; border: 1px dashed #ccc; margin-bottom: 5mm; display: flex; flex-direction: column; align-items: center; justify-content: center; page-break-inside: avoid; }
          .title { font-[9px]; font-weight: bold; margin-bottom: 2px; text-transform: uppercase; text-align: center; }
          .barcode-img { width: 42mm; height: 12mm; }
          .meta { display: flex; justify-content: space-between; width: 100%; font-size: 8px; margin-top: 2px; }
        `);
        printWindow.document.write('</style></head><body>');

        for (const item of printQueue) {
          const barcodeVal = item.variant.barcode;
          // Format label elements: render jsbarcode inline in print window
          for (let c = 0; c < item.copies; c++) {
            printWindow.document.write(`
              <div class="label-card">
                <div class="title">${item.productName.slice(0, 22)}</div>
                <div style="font-size: 9px; font-weight: bold; font-family: monospace; letter-spacing: 0.5px; border: 1px solid #000; padding: 2px 4px; margin-bottom: 2px;">
                  ${barcodeVal}
                </div>
                <div class="meta">
                  <span>SKU: ${item.variant.sku}</span>
                  <span>SZ: ${item.variant.size?.label || 'N/A'}</span>
                  <span>MRP: INR ${item.variant.mrp}</span>
                </div>
              </div>
            `);
          }
        }

        printWindow.document.write('</body></html>');
        printWindow.document.close();
        printWindow.focus();
        setTimeout(() => {
          printWindow.print();
          printWindow.close();
        }, 300);
      }

      setPrintQueue([]);
      loadPrintLogs();
    } catch (err) {
      console.error('Print trigger failed:', err);
      toastError('Failed to complete print action.');
    }
  };

  return (
    <div className="space-y-6">
      {/* Title */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-800 dark:text-white tracking-tight">
            Barcode Center
          </h1>
          <p className="text-xs text-slate-400 mt-0.5 font-medium">
            Generate and queue Code128 thermal labels for apparel variants.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Label configurator */}
        <div className="lg:col-span-1 space-y-6">
          <div className="bg-white dark:bg-[#1e293b] border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm space-y-4">
            <h3 className="text-xs font-bold text-slate-800 dark:text-white uppercase tracking-wider border-b border-slate-100 dark:border-slate-800 pb-2">
              Label Parameters
            </h3>

            <div className="space-y-3.5 text-xs">
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase">Select Product</label>
                <select
                  value={selectedProductId}
                  onChange={(e) => {
                    setSelectedProductId(e.target.value);
                    setSelectedVariantId(''); // reset variant
                  }}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl"
                >
                  <option value="">Choose product...</option>
                  {products.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.product_name}
                    </option>
                  ))}
                </select>
              </div>

              {currentProduct && (
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase">Select Size Variant</label>
                  <select
                    value={selectedVariantId}
                    onChange={(e) => setSelectedVariantId(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl"
                  >
                    <option value="">Choose size...</option>
                    {currentProduct.variants?.map((v) => (
                      <option key={v.id} value={v.id}>
                        {v.size?.label} ({v.sku})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase">Barcode Template</label>
                <select
                  value={selectedTemplateId}
                  onChange={(e) => setSelectedTemplateId(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl"
                >
                  {templates.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name} ({t.width_mm}×{t.height_mm}mm)
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase">Copies</label>
                <input
                  type="number"
                  min="1"
                  max="100"
                  value={copies}
                  onChange={(e) => setCopies(Number(e.target.value))}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl font-bold text-center"
                />
              </div>

              <button
                type="button"
                onClick={handleAddToQueue}
                disabled={!currentVariant}
                className="w-full py-2.5 bg-slate-950 dark:bg-white hover:bg-slate-850 dark:hover:bg-slate-100 text-white dark:text-slate-950 text-xs font-bold rounded-xl shadow-sm transition-all disabled:opacity-50 disabled:pointer-events-none cursor-pointer flex items-center justify-center gap-1.5"
              >
                <Plus className="w-4 h-4" /> Add to Print Queue
              </button>
            </div>
          </div>

          {/* Quick barcode display preview */}
          {currentProduct && currentVariant && (
            <div className="animate-fade-in space-y-2">
              <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest pl-1">
                Active Label Preview
              </h3>
              <BarcodeDisplay
                value={currentVariant.barcode}
                sku={currentVariant.sku}
                productName={currentProduct.product_name}
                size={currentVariant.size?.label}
                mrp={currentVariant.mrp}
              />
            </div>
          )}
        </div>

        {/* Right Column: Print queue and log history */}
        <div className="lg:col-span-2 space-y-6">
          {/* Print Queue */}
          <div className="bg-white dark:bg-[#1e293b] border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-800 dark:text-white flex items-center gap-1.5">
                <List className="w-4 h-4 text-slate-450" /> Print Queue List
              </h3>
              {printQueue.length > 0 && (
                <button
                  onClick={handleClearQueue}
                  className="text-[10px] text-rose-500 font-bold hover:underline cursor-pointer uppercase tracking-wider"
                >
                  Clear Queue
                </button>
              )}
            </div>

            <div className="overflow-x-auto min-h-[120px] max-h-[300px] overflow-y-auto">
              <table className="w-full text-xs text-left text-slate-500">
                <thead className="text-[10px] text-slate-400 uppercase bg-slate-50 dark:bg-slate-900 border-b border-slate-100 dark:border-slate-800">
                  <tr>
                    <th className="px-3 py-2">SKU Code</th>
                    <th className="px-3 py-2">Product Name</th>
                    <th className="px-3 py-2 text-center w-24">Copies</th>
                    <th className="px-3 py-2 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80">
                  {printQueue.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="px-3 py-10 text-center text-slate-450 font-semibold text-[11px]">
                        Queue is empty. Select label parameters and add items to list.
                      </td>
                    </tr>
                  ) : (
                    printQueue.map((item) => (
                      <tr key={item.id} className="hover:bg-slate-50 dark:hover:bg-slate-900/30">
                        <td className="px-3 py-2.5 font-mono font-bold text-slate-800 dark:text-slate-200">
                          {item.variant.sku}
                        </td>
                        <td className="px-3 py-2.5 text-slate-600 dark:text-slate-400 font-medium">
                          {item.productName} ({item.variant.size?.label})
                        </td>
                        <td className="px-3 py-2.5 text-center font-extrabold text-slate-800 dark:text-white">
                          {item.copies}
                        </td>
                        <td className="px-3 py-2.5 text-right">
                          <button
                            type="button"
                            onClick={() => handleRemoveFromQueue(item.id)}
                            className="p-1.5 hover:bg-rose-50 dark:hover:bg-rose-950/20 text-rose-500 rounded transition-colors cursor-pointer"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {printQueue.length > 0 && (
              <button
                onClick={handlePrintQueue}
                className="w-full py-2 bg-slate-950 dark:bg-white hover:bg-slate-850 dark:hover:bg-slate-100 text-white dark:text-slate-950 text-xs font-bold rounded-xl flex items-center justify-center gap-1.5 shadow-md cursor-pointer"
              >
                <Printer className="w-4 h-4" /> Trigger Label Printing
              </button>
            )}
          </div>

          {/* Recently Printed Log */}
          <div className="bg-white dark:bg-[#1e293b] border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-800 dark:text-white">
                Recent Print History log
              </h3>
              <button
                onClick={loadPrintLogs}
                className="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 rounded cursor-pointer"
                title="Refresh log list"
              >
                <RefreshCw className="w-4 h-4" />
              </button>
            </div>

            <div className="flow-root">
              <ul className="divide-y divide-slate-100 dark:divide-slate-800/80 -my-2.5">
                {printLogs.length === 0 ? (
                  <li className="py-8 text-center text-slate-450 font-semibold text-[11px]">
                    No printed history recorded.
                  </li>
                ) : (
                  printLogs.map((log, idx) => (
                    <li key={idx} className="py-2.5 flex items-center justify-between text-xs gap-3">
                      <div className="flex flex-col min-w-0">
                        <span className="font-semibold text-slate-700 dark:text-slate-300 truncate">
                          {log.variant?.product?.product_name || 'Barcode Product'}
                        </span>
                        <div className="flex items-center gap-1.5 text-[10px] text-slate-400 mt-0.5 font-semibold">
                          <span className="font-mono">{log.sku}</span>
                          <span>•</span>
                          <span>Printed at {new Date(log.printed_at).toLocaleTimeString()}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-3 shrink-0">
                        <span className="inline-flex items-center justify-center bg-slate-105 px-2 py-0.5 rounded text-[10px] text-slate-600 dark:text-slate-300 font-bold border border-slate-200/50">
                          {log.copies} copies
                        </span>
                      </div>
                    </li>
                  ))
                )}
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
