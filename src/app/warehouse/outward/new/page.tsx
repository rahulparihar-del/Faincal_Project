'use client';

import React, { useState, useEffect } from 'react';
import { useWms } from '@/context/WmsContext';
import { useMasterData } from '@/lib/wms/hooks/useMasterData';
import { BarcodeScanner } from '@/components/wms/ui/BarcodeScanner';
import { getVariantByBarcode, getVariantBySku } from '@/lib/wms/services/productService';
import { createStockMovement } from '@/lib/wms/services/movementService';
import { getInventorySnapshot } from '@/lib/wms/services/inventoryService';
import { useWmsToast } from '@/components/wms/ui/WmsToast';
import { supabase } from '@/lib/supabase/client';
import { SkuTag } from '@/components/wms/ui/SkuTag';
import { Trash2, ArrowLeft, ScanLine, Keyboard, AlertTriangle } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { StockMovementType } from '@/lib/wms/types';
import { useAuth } from '@/context/AuthContext';

interface OutwardItem {
  variantId: string;
  sku: string;
  productName: string;
  sizeLabel: string;
  availableQty: number; // dynamically fetched stock
  quantity: number;
}

export default function NewOutwardPage() {
  const router = useRouter();
  const { selectedWarehouseId, warehouses } = useWms();
  const { channels, loading: masterLoading } = useMasterData();
  const { success, error: toastError, warning } = useWmsToast();
  const { userEmail } = useAuth();

  const [channelId, setChannelId] = useState('');
  const [warehouseId, setWarehouseId] = useState('');
  const [orderReference, setOrderReference] = useState('');
  const [dispatchedBy, setDispatchedBy] = useState('Admin Operator');
  const [notes, setNotes] = useState('');

  useEffect(() => {
    if (userEmail) {
      setDispatchedBy(userEmail.split('@')[0]);
    }
  }, [userEmail]);

  const [items, setItems] = useState<OutwardItem[]>([]);
  const [scanActive, setScanActive] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Manual sku entry
  const [manualSkuInput, setManualSkuInput] = useState('');
  const [manualQtyInput, setManualQtyInput] = useState(1);

  // Load selected warehouse
  useEffect(() => {
    if (selectedWarehouseId) {
      setWarehouseId(selectedWarehouseId);
    }
  }, [selectedWarehouseId]);

  // Fetch stock level for a variant in selected warehouse
  const fetchStockLevel = async (variantId: string, whId: string): Promise<number> => {
    if (!supabase) return 0;
    try {
      const { data } = await supabase
        .from('wms_inventory_snapshot')
        .select('available')
        .eq('variant_id', variantId)
        .eq('warehouse_id', whId)
        .single();
      return data?.available ?? 0;
    } catch {
      return 0;
    }
  };

  const handleBarcodeScan = async (code: string) => {
    if (!warehouseId) {
      toastError('Please select a warehouse first.');
      return;
    }
    try {
      const variant = await getVariantByBarcode(code);
      if (variant) {
        const stock = await fetchStockLevel(variant.id, warehouseId);

        setItems((prev) => {
          const existing = prev.find((item) => item.variantId === variant.id);
          const nextQty = existing ? existing.quantity + 1 : 1;

          if (nextQty > stock) {
            warning(`Insufficient stock for ${variant.sku}. Available: ${stock}`);
            return prev;
          }

          if (existing) {
            return prev.map((item) =>
              item.variantId === variant.id
                ? { ...item, quantity: nextQty }
                : item
            );
          } else {
            return [
              ...prev,
              {
                variantId: variant.id,
                sku: variant.sku,
                productName: variant.product?.product_name || 'Unknown',
                sizeLabel: variant.size?.label || 'N/A',
                availableQty: stock,
                quantity: 1,
              },
            ];
          }
        });
        success(`Scanned: ${variant.sku}`);
      } else {
        warning(`No SKU matches barcode: ${code}`);
      }
    } catch (err) {
      toastError('Failed to lookup barcode.');
    }
  };

  const handleManualAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualSkuInput.trim()) return;
    if (!warehouseId) {
      toastError('Please select a warehouse first.');
      return;
    }

    try {
      const variant = await getVariantBySku(manualSkuInput.trim());
      if (variant) {
        const stock = await fetchStockLevel(variant.id, warehouseId);

        setItems((prev) => {
          const existing = prev.find((item) => item.variantId === variant.id);
          const nextQty = existing ? existing.quantity + manualQtyInput : manualQtyInput;

          if (nextQty > stock) {
            warning(`Insufficient stock for ${variant.sku}. Available: ${stock}`);
            return prev;
          }

          if (existing) {
            return prev.map((item) =>
              item.variantId === variant.id
                ? { ...item, quantity: nextQty }
                : item
            );
          } else {
            return [
              ...prev,
              {
                variantId: variant.id,
                sku: variant.sku,
                productName: variant.product?.product_name || 'Unknown',
                sizeLabel: variant.size?.label || 'N/A',
                availableQty: stock,
                quantity: manualQtyInput,
              },
            ];
          }
        });
        success(`Added: ${variant.sku}`);
        setManualSkuInput('');
        setManualQtyInput(1);
      } else {
        warning(`No product matches SKU: ${manualSkuInput}`);
      }
    } catch (err) {
      toastError('Failed to lookup SKU.');
    }
  };

  const handleQtyChange = (variantId: string, value: number) => {
    setItems((prev) =>
      prev.map((item) => {
        if (item.variantId === variantId) {
          const targetQty = Math.max(1, value);
          if (targetQty > item.availableQty) {
            warning(`Insufficient stock. Maximum available: ${item.availableQty}`);
            return { ...item, quantity: item.availableQty };
          }
          return { ...item, quantity: targetQty };
        }
        return item;
      })
    );
  };

  const handleRemoveItem = (variantId: string) => {
    setItems((prev) => prev.filter((item) => item.variantId !== variantId));
  };

  const handleSubmitOutward = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supabase) return;
    if (items.length === 0) {
      toastError('Please scan or add at least one stock item.');
      return;
    }
    if (!warehouseId || !channelId) {
      toastError('Warehouse and sales channel are required.');
      return;
    }

    // Verify stock one last time before committing transaction
    for (const item of items) {
      const stock = await fetchStockLevel(item.variantId, warehouseId);
      if (item.quantity > stock) {
        toastError(`Stock changed for ${item.sku}. Only ${stock} units available.`);
        setItems((prev) =>
          prev.map((it) => (it.variantId === item.variantId ? { ...it, availableQty: stock } : it))
        );
        return;
      }
    }

    setSubmitting(true);
    try {
      // 1. Fetch next human-readable ID
      const { data: outwardId, error: seqError } = await supabase.rpc('wms_next_id', { p_prefix: 'OUT' });
      if (seqError || !outwardId) throw seqError || new Error('Failed to generate Outward ID');

      // 2. Insert wms_outwards
      const { error: outwardError } = await supabase.from('wms_outwards').insert({
        id: outwardId,
        channel_id: channelId,
        warehouse_id: warehouseId,
        order_reference: orderReference,
        dispatched_by: dispatchedBy,
        notes,
        status: 'dispatched', // Auto complete outward on create
        dispatch_date: new Date().toISOString().slice(0, 10),
      });

      if (outwardError) throw outwardError;

      // 3. Process outward items and ledger stock movements
      const channel = channels.find((c) => c.id === channelId);
      const chCode = channel?.code || 'OFF';
      // Dynamically select movement type based on channel code: sale_amazon, sale_flipkart, etc.
      const movementType = `sale_${chCode.toLowerCase()}` as StockMovementType;

      for (const item of items) {
        // (a) Record Stock Movement ledger: Dispatch from Available to Dispatched bucket
        // We move from 'available' directly into 'dispatched'
        const movResult = await createStockMovement({
          movement_type: movementType,
          variant_id: item.variantId,
          warehouse_id: warehouseId,
          from_bucket: 'available',
          to_bucket: 'dispatched',
          quantity: item.quantity,
          reference_id: outwardId,
          reference_type: 'outward',
          channel_id: channelId,
          performed_by: dispatchedBy,
          remarks: `Dispatch delivery of ${item.sku}. Ref: ${orderReference}`,
        });

        const movementId = movResult?.id || null;

        // (b) Insert outward items log
        await supabase.from('wms_outward_items').insert({
          outward_id: outwardId,
          variant_id: item.variantId,
          quantity: item.quantity,
          movement_id: movementId,
        });
      }

      success('Outward stock ledger updated successfully!');
      router.push('/warehouse/outward');
    } catch (err) {
      console.error('Failed to create outward:', err);
      toastError('Failed to record stock outward transaction.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Title & Back */}
      <div className="flex flex-col gap-2">
        <Link
          href="/warehouse/outward"
          className="inline-flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-700 dark:hover:text-slate-200 cursor-pointer self-start"
        >
          <ArrowLeft className="w-4 h-4" /> Back to Outward list
        </Link>
        <h1 className="text-2xl font-extrabold text-slate-800 dark:text-white tracking-tight">
          New Outward Dispatch
        </h1>
      </div>

      <form onSubmit={handleSubmitOutward} className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left column: metadata & scanner */}
        <div className="lg:col-span-1 space-y-6">
          <div className="bg-white dark:bg-[#1e293b] border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm space-y-4">
            <h3 className="text-xs font-bold text-slate-800 dark:text-white uppercase tracking-wider border-b border-slate-100 dark:border-slate-800 pb-2">
              Dispatch Parameters
            </h3>

            <div className="space-y-3.5 text-xs">
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase">Sales Channel *</label>
                <select
                  required
                  value={channelId}
                  onChange={(e) => setChannelId(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl"
                >
                  <option value="">Select Channel</option>
                  {channels.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} ({c.code})
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase">Source Warehouse *</label>
                <select
                  required
                  value={warehouseId}
                  onChange={(e) => {
                    setWarehouseId(e.target.value);
                    setItems([]); // clear scanned items as stock matches warehouse
                  }}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl"
                >
                  <option value="">Select Warehouse</option>
                  {warehouses.map((w) => (
                    <option key={w.id} value={w.id}>
                      {w.name} ({w.code})
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase">Order Reference / ID</label>
                <input
                  type="text"
                  placeholder="e.g. AMZ-98218-09"
                  value={orderReference}
                  onChange={(e) => setOrderReference(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase">Operator Name *</label>
                <input
                  type="text"
                  required
                  value={dispatchedBy}
                  onChange={(e) => setDispatchedBy(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase">Dispatch Notes</label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Remarks or dispatch instructions..."
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl h-16"
                />
              </div>
            </div>
          </div>

          {/* Scanner widget */}
          <div className="space-y-2">
            <div className="flex items-center justify-between pl-1">
              <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest flex items-center gap-1">
                <ScanLine className="w-3.5 h-3.5 text-indigo-500 animate-pulse" /> Barcode Reader
              </span>
              <button
                type="button"
                onClick={() => setScanActive(!scanActive)}
                className={`text-[10px] px-2 py-0.5 rounded font-bold cursor-pointer transition-colors ${
                  scanActive
                    ? 'bg-rose-50 text-rose-600 hover:bg-rose-100'
                    : 'bg-indigo-50 text-indigo-600 hover:bg-indigo-100'
                }`}
              >
                {scanActive ? 'Close Reader' : 'Open Reader'}
              </button>
            </div>
            <BarcodeScanner
              onScan={handleBarcodeScan}
              isActive={scanActive}
              placeholder="Scan Code128 or type code..."
            />
          </div>
        </div>

        {/* Right column: scanned items list */}
        <div className="lg:col-span-2 space-y-4">
          {/* Manual input segment */}
          <div className="bg-white dark:bg-[#1e293b] border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm space-y-3">
            <h3 className="text-xs font-bold text-slate-850 dark:text-white flex items-center gap-1">
              <Keyboard className="w-4 h-4 text-slate-450" /> Add SKU manually
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3 items-end">
              <div className="space-y-1 md:col-span-2">
                <label className="text-[9px] font-bold text-slate-400 dark:text-slate-500 uppercase">SKU Code</label>
                <input
                  type="text"
                  placeholder="e.g. CJ-DEER-03M"
                  value={manualSkuInput}
                  onChange={(e) => setManualSkuInput(e.target.value)}
                  className="w-full px-3 py-1.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-mono uppercase"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[9px] font-bold text-slate-400 dark:text-slate-500 uppercase">Quantity</label>
                <input
                  type="number"
                  value={manualQtyInput}
                  onChange={(e) => setManualQtyInput(Number(e.target.value))}
                  className="w-full px-3 py-1.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs"
                />
              </div>
              <button
                type="button"
                onClick={handleManualAdd}
                className="w-full py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl border border-slate-200 shadow-sm cursor-pointer transition-colors"
              >
                Add SKU
              </button>
            </div>
          </div>

          {/* Items dispatch checklist table */}
          <div className="bg-white dark:bg-[#1e293b] border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm space-y-4">
            <h3 className="text-sm font-bold text-slate-800 dark:text-white">
              Dispatch Packing List
            </h3>
            <div className="overflow-x-auto min-h-[200px]">
              <table className="w-full text-xs text-left text-slate-500 dark:text-slate-400">
                <thead className="text-[10px] text-slate-400 uppercase bg-slate-50 dark:bg-slate-900 border-b border-slate-100 dark:border-slate-800">
                  <tr>
                    <th className="px-3 py-2">SKU Code</th>
                    <th className="px-3 py-2">Product Name</th>
                    <th className="px-3 py-2 text-center w-24">Stock Available</th>
                    <th className="px-3 py-2 text-center w-24">Qty Pack</th>
                    <th className="px-3 py-2 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80">
                  {items.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-3 py-16 text-center text-slate-400 font-semibold text-[11px]">
                        Scanned or manual items will appear here. Start scanning!
                      </td>
                    </tr>
                  ) : (
                    items.map((item) => (
                      <tr key={item.variantId} className="hover:bg-slate-50 dark:hover:bg-slate-900/30">
                        <td className="px-3 py-2.5 font-mono">
                          <SkuTag sku={item.sku} copyable={false} size="sm" />
                        </td>
                        <td className="px-3 py-2.5">
                          <div className="flex flex-col">
                            <span className="font-semibold text-slate-700 dark:text-slate-350 leading-relaxed truncate max-w-[200px]">
                              {item.productName}
                            </span>
                            <span className="text-[10px] text-slate-405">Size: {item.sizeLabel}</span>
                          </div>
                        </td>
                        <td className="px-3 py-2.5 text-center font-semibold text-slate-800 dark:text-slate-200">
                          {item.availableQty} units
                        </td>
                        <td className="px-3 py-2.5 text-center">
                          <input
                            type="number"
                            min="1"
                            max={item.availableQty}
                            value={item.quantity}
                            onChange={(e) => handleQtyChange(item.variantId, Number(e.target.value))}
                            className="w-16 px-2 py-1 border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 rounded-lg text-center text-xs font-bold"
                          />
                        </td>
                        <td className="px-3 py-2.5 text-right">
                          <button
                            type="button"
                            onClick={() => handleRemoveItem(item.variantId)}
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

            {/* Submission Actions */}
            <div className="flex justify-end gap-2 border-t border-slate-100 dark:border-slate-800 pt-4">
              <Link
                href="/warehouse/outward"
                className="px-4 py-2 border border-slate-250 dark:border-slate-700 text-xs font-bold text-slate-600 hover:bg-slate-50 dark:text-slate-350 dark:hover:bg-slate-850 rounded-xl cursor-pointer"
              >
                Cancel
              </Link>
              <button
                type="submit"
                disabled={submitting || items.length === 0}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl shadow-sm transition-all disabled:opacity-50 disabled:pointer-events-none cursor-pointer flex items-center gap-1.5"
              >
                {submitting && (
                  <div className="w-3.5 h-3.5 border border-current border-t-transparent rounded-full animate-spin" />
                )}
                Commit Dispatch
              </button>
            </div>
          </div>
        </div>
      </form>
    </div>
  );
}
