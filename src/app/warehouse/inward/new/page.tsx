'use client';

import React, { useState, useEffect } from 'react';
import { useWms } from '@/context/WmsContext';
import { useMasterData } from '@/lib/wms/hooks/useMasterData';
import { BarcodeScanner } from '@/components/wms/ui/BarcodeScanner';
import { getVariantByBarcode, getVariantBySku } from '@/lib/wms/services/productService';
import { createStockMovement } from '@/lib/wms/services/movementService';
import { useWmsToast } from '@/components/wms/ui/WmsToast';
import { supabase } from '@/lib/supabase/client';
import { SkuTag } from '@/components/wms/ui/SkuTag';
import { Trash2, ArrowLeft, Plus, ScanLine, Keyboard } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';

interface InwardItem {
  variantId: string;
  sku: string;
  productName: string;
  sizeLabel: string;
  expectedQty: number;
  receivedQty: number;
  unitCost: number;
}

export default function NewInwardPage() {
  const router = useRouter();
  const { selectedWarehouseId, warehouses } = useWms();
  const { suppliers, loading: masterLoading } = useMasterData();
  const { success, error: toastError, warning } = useWmsToast();
  const { userEmail } = useAuth();

  const [type, setType] = useState<'production' | 'purchase' | 'transfer' | 'return'>('production');
  const [warehouseId, setWarehouseId] = useState('');
  const [supplierId, setSupplierId] = useState('');
  const [referenceNo, setReferenceNo] = useState('');
  const [receivedBy, setReceivedBy] = useState('Admin Operator');
  const [notes, setNotes] = useState('');

  useEffect(() => {
    if (userEmail) {
      setReceivedBy(userEmail.split('@')[0]);
    }
  }, [userEmail]);

  const [items, setItems] = useState<InwardItem[]>([]);
  const [scanActive, setScanActive] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Manual sku entry
  const [manualSkuInput, setManualSkuInput] = useState('');
  const [manualQtyInput, setManualQtyInput] = useState(1);
  const [manualCostInput, setManualCostInput] = useState(0);

  useEffect(() => {
    if (selectedWarehouseId) {
      setWarehouseId(selectedWarehouseId);
    }
  }, [selectedWarehouseId]);

  const handleBarcodeScan = async (code: string) => {
    try {
      const variant = await getVariantByBarcode(code);
      if (variant) {
        // Add or increment item
        setItems((prev) => {
          const existing = prev.find((item) => item.variantId === variant.id);
          if (existing) {
            return prev.map((item) =>
              item.variantId === variant.id
                ? { ...item, receivedQty: item.receivedQty + 1 }
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
                expectedQty: 0,
                receivedQty: 1,
                unitCost: variant.cost_price || 0,
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
    try {
      const variant = await getVariantBySku(manualSkuInput.trim());
      if (variant) {
        setItems((prev) => {
          const existing = prev.find((item) => item.variantId === variant.id);
          if (existing) {
            return prev.map((item) =>
              item.variantId === variant.id
                ? { ...item, receivedQty: item.receivedQty + manualQtyInput }
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
                expectedQty: 0,
                receivedQty: manualQtyInput,
                unitCost: manualCostInput || variant.cost_price || 0,
              },
            ];
          }
        });
        success(`Added: ${variant.sku}`);
        setManualSkuInput('');
        setManualQtyInput(1);
        setManualCostInput(0);
      } else {
        warning(`No product matches SKU: ${manualSkuInput}`);
      }
    } catch (err) {
      toastError('Failed to lookup SKU.');
    }
  };

  const handleQtyChange = (variantId: string, value: number) => {
    setItems((prev) =>
      prev.map((item) =>
        item.variantId === variantId
          ? { ...item, receivedQty: Math.max(1, value) }
          : item
      )
    );
  };

  const handleCostChange = (variantId: string, value: number) => {
    setItems((prev) =>
      prev.map((item) =>
        item.variantId === variantId
          ? { ...item, unitCost: Math.max(0, value) }
          : item
      )
    );
  };

  const handleRemoveItem = (variantId: string) => {
    setItems((prev) => prev.filter((item) => item.variantId !== variantId));
  };

  const handleSubmitInward = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supabase) return;
    if (items.length === 0) {
      toastError('Please scan or add at least one stock item.');
      return;
    }
    if (!warehouseId || !receivedBy) {
      toastError('Warehouse and operator name are required.');
      return;
    }

    setSubmitting(true);
    try {
      // 1. Fetch next human-readable ID
      const { data: inwardId, error: seqError } = await supabase.rpc('wms_next_id', { p_prefix: 'INW' });
      if (seqError || !inwardId) throw seqError || new Error('Failed to generate Inward ID');

      // 2. Insert wms_inwards
      const { error: inwardError } = await supabase.from('wms_inwards').insert({
        id: inwardId,
        type,
        warehouse_id: warehouseId,
        supplier_id: type === 'purchase' ? supplierId || null : null,
        reference_no: referenceNo,
        received_by: receivedBy,
        notes,
        status: 'received', // Auto complete inward on create
        received_date: new Date().toISOString().slice(0, 10),
      });

      if (inwardError) throw inwardError;

      // 3. Process inward items and ledger stock movements
      for (const item of items) {
        // (a) Record Stock Movement ledger: Opening, Production or Purchase
        // We inward directly into the 'available' bucket (or 'qc_pending' if Return)
        const bucket = type === 'return' ? 'qc_pending' : 'available';
        const movementType = type === 'production' ? 'production' : type === 'purchase' ? 'purchase' : 'transfer_in';

        const movResult = await createStockMovement({
          movement_type: movementType,
          variant_id: item.variantId,
          warehouse_id: warehouseId,
          to_bucket: bucket,
          quantity: item.receivedQty,
          reference_id: inwardId,
          reference_type: 'inward',
          performed_by: receivedBy,
          remarks: `Inward receipt of ${item.sku}. Ref: ${referenceNo}`,
        });

        const movementId = movResult?.id || null;

        // (b) Insert inward items log
        await supabase.from('wms_inward_items').insert({
          inward_id: inwardId,
          variant_id: item.variantId,
          expected_qty: item.expectedQty || item.receivedQty,
          received_qty: item.receivedQty,
          unit_cost: item.unitCost,
          movement_id: movementId,
        });
      }

      success('Inward stock ledger updated successfully!');
      router.push('/warehouse/inward');
    } catch (err) {
      console.error('Failed to create inward:', err);
      toastError('Failed to record stock inward transaction.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Title & Back */}
      <div className="flex flex-col gap-2">
        <Link
          href="/warehouse/inward"
          className="inline-flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-700 dark:hover:text-slate-200 cursor-pointer self-start"
        >
          <ArrowLeft className="w-4 h-4" /> Back to Inward list
        </Link>
        <h1 className="text-2xl font-extrabold text-slate-800 dark:text-white tracking-tight">
          Inward Stock Receipt
        </h1>
      </div>

      <form onSubmit={handleSubmitInward} className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left column: metadata & scanner */}
        <div className="lg:col-span-1 space-y-6">
          <div className="bg-white dark:bg-[#1e293b] border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm space-y-4">
            <h3 className="text-xs font-bold text-slate-800 dark:text-white uppercase tracking-wider border-b border-slate-100 dark:border-slate-800 pb-2">
              Receipt Parameters
            </h3>

            <div className="space-y-3.5 text-xs">
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase">Inward Type *</label>
                <select
                  value={type}
                  onChange={(e) => setType(e.target.value as 'production' | 'purchase' | 'transfer' | 'return')}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl"
                >
                  <option value="production">Production Inward (Internal)</option>
                  <option value="purchase">Purchase Invoice (PO)</option>
                  <option value="transfer">Warehouse Transfer</option>
                  <option value="return">Customer Return (QC Pending)</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase">Destination Warehouse *</label>
                <select
                  required
                  value={warehouseId}
                  onChange={(e) => setWarehouseId(e.target.value)}
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

              {type === 'purchase' && (
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase">Supplier *</label>
                  <select
                    required
                    value={supplierId}
                    onChange={(e) => setSupplierId(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl"
                  >
                    <option value="">Select Supplier</option>
                    {suppliers.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name} ({s.code})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase">Reference No / Invoice</label>
                <input
                  type="text"
                  placeholder="e.g. PO-2412 or MFG-98"
                  value={referenceNo}
                  onChange={(e) => setReferenceNo(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase">Operator Name *</label>
                <input
                  type="text"
                  required
                  value={receivedBy}
                  onChange={(e) => setReceivedBy(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase">Inward Notes</label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Remarks or inward description..."
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl h-16"
                />
              </div>
            </div>
          </div>

          {/* Scanner module widget */}
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
              <div className="space-y-1">
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
              <div className="space-y-1">
                <label className="text-[9px] font-bold text-slate-400 dark:text-slate-500 uppercase">Unit Cost (₹)</label>
                <input
                  type="number"
                  value={manualCostInput}
                  onChange={(e) => setManualCostInput(Number(e.target.value))}
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

          {/* Items checklist table */}
          <div className="bg-white dark:bg-[#1e293b] border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm space-y-4">
            <h3 className="text-sm font-bold text-slate-800 dark:text-white">
              Stock Inward List
            </h3>
            <div className="overflow-x-auto min-h-[200px]">
              <table className="w-full text-xs text-left text-slate-500 dark:text-slate-400">
                <thead className="text-[10px] text-slate-400 uppercase bg-slate-50 dark:bg-slate-900 border-b border-slate-100 dark:border-slate-800">
                  <tr>
                    <th className="px-3 py-2">SKU Code</th>
                    <th className="px-3 py-2">Product Name</th>
                    <th className="px-3 py-2 text-center w-24">Qty Received</th>
                    <th className="px-3 py-2 text-center w-28">Unit Cost (₹)</th>
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
                        <td className="px-3 py-2.5 text-center">
                          <input
                            type="number"
                            min="1"
                            value={item.receivedQty}
                            onChange={(e) => handleQtyChange(item.variantId, Number(e.target.value))}
                            className="w-16 px-2 py-1 border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 rounded-lg text-center text-xs font-bold"
                          />
                        </td>
                        <td className="px-3 py-2.5 text-center">
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            value={item.unitCost}
                            onChange={(e) => handleCostChange(item.variantId, Number(e.target.value))}
                            className="w-24 px-2 py-1 border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 rounded-lg text-center text-xs font-mono font-bold"
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
                href="/warehouse/inward"
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
                Commit Inward stock
              </button>
            </div>
          </div>
        </div>
      </form>
    </div>
  );
}
