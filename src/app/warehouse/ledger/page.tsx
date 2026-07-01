'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useWms } from '@/context/WmsContext';
import { DataTable } from '@/components/wms/ui/DataTable';
import { SkuTag } from '@/components/wms/ui/SkuTag';
import { StockBadge } from '@/components/wms/ui/StockBadge';
import { MovementTypeBadge } from '@/components/wms/ui/MovementTypeBadge';
import { supabase } from '@/lib/supabase/client';
import { Search, RefreshCw, Calendar, Eye } from 'lucide-react';
import { WmsStockMovement } from '@/lib/wms/types';

export default function StockLedgerPage() {
  const { selectedWarehouseId } = useWms();

  const [movements, setMovements] = useState<WmsStockMovement[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [movementType, setMovementType] = useState('');
  const [selectedMovement, setSelectedMovement] = useState<WmsStockMovement | null>(null);

  // Pagination states
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const perPage = 25;

  const loadMovements = useCallback(async () => {
    if (!supabase) return;
    setLoading(true);
    try {
      let query = supabase
        .from('wms_stock_movements')
        .select(`
          *,
          variant:wms_product_variants(
            id, sku, barcode,
            product:wms_products(id, product_name)
          ),
          warehouse:wms_warehouses(id, name, code)
        `, { count: 'exact' });

      if (selectedWarehouseId) {
        query = query.eq('warehouse_id', selectedWarehouseId);
      }
      if (movementType) {
        query = query.eq('movement_type', movementType);
      }
      if (search) {
        // Since we can't easily do text search on variant sku inside joint in a single simple query via client-side filters,
        // we will fetch first and do client-side filter OR query matching sku.
        // Let's use search on reference_id
        query = query.or(`reference_id.ilike.%${search}%,id.ilike.%${search}%`);
      }

      // Pagination
      const from = (page - 1) * perPage;
      const to = from + perPage - 1;
      query = query
        .order('performed_at', { ascending: false })
        .range(from, to);

      const { data, count, error } = await query;
      if (error) throw error;
      setMovements((data as unknown as WmsStockMovement[]) ?? []);
      setTotal(count ?? 0);
    } catch (err) {
      console.error('Failed to load ledger movements:', err);
    } finally {
      setLoading(false);
    }
  }, [selectedWarehouseId, movementType, search, page]);

  useEffect(() => {
    loadMovements();
  }, [loadMovements]);

  // Reset page when filter changes
  useEffect(() => {
    setPage(1);
  }, [search, movementType]);

  const columns = [
    {
      key: 'id',
      header: 'Movement ID',
      sortable: true,
      render: (row: WmsStockMovement) => (
        <span className="font-mono font-bold text-slate-800 dark:text-slate-200">
          {row.id}
        </span>
      ),
    },
    {
      key: 'performed_at',
      header: 'Date & Time',
      render: (row: WmsStockMovement) => (
        <div className="flex items-center gap-1 text-slate-400">
          <Calendar className="w-3.5 h-3.5" />
          <span>{new Date(row.performed_at).toLocaleString()}</span>
        </div>
      ),
    },
    {
      key: 'movement_type',
      header: 'Type',
      render: (row: WmsStockMovement) => (
        <MovementTypeBadge type={row.movement_type} />
      ),
    },
    {
      key: 'sku',
      header: 'SKU / Product',
      render: (row: WmsStockMovement) => (
        <div className="flex flex-col gap-0.5">
          <SkuTag sku={row.variant?.sku || 'N/A'} copyable={true} size="sm" />
          <span className="text-[9px] text-slate-400 truncate max-w-[150px]">
            {row.variant?.product?.product_name}
          </span>
        </div>
      ),
    },
    {
      key: 'buckets',
      header: 'From → To',
      render: (row: WmsStockMovement) => (
        <div className="flex items-center gap-1">
          {row.from_bucket ? (
            <StockBadge bucket={row.from_bucket} size="sm" />
          ) : (
            <span className="text-[10px] bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 px-1.5 py-0.5 rounded text-slate-400">
              —
            </span>
          )}
          <span className="text-slate-400">→</span>
          {row.to_bucket ? (
            <StockBadge bucket={row.to_bucket} size="sm" />
          ) : (
            <span className="text-[10px] bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 px-1.5 py-0.5 rounded text-slate-400">
              —
            </span>
          )}
        </div>
      ),
    },
    {
      key: 'quantity',
      header: 'Qty',
      align: 'center' as const,
      sortable: true,
      render: (row: WmsStockMovement) => (
        <span className="font-extrabold text-slate-800 dark:text-white">
          {row.quantity} pcs
        </span>
      ),
    },
    {
      key: 'reference_id',
      header: 'Reference',
      render: (row: WmsStockMovement) => (
        <div className="flex flex-col">
          <span className="font-semibold text-slate-700 dark:text-slate-300">
            {row.reference_id || '—'}
          </span>
          {row.reference_type && (
            <span className="text-[9px] text-slate-450 uppercase font-black tracking-wider">
              {row.reference_type}
            </span>
          )}
        </div>
      ),
    },
    {
      key: 'performed_by',
      header: 'Operator',
      render: (row: WmsStockMovement) => (
        <span className="text-slate-500 font-medium">{row.performed_by}</span>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      {/* Page Title */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-800 dark:text-white tracking-tight">
            Stock Ledger
          </h1>
          <p className="text-xs text-slate-400 mt-0.5 font-medium">
            Immutable log of all inventory movements. Inventory = Inward - Outward.
          </p>
        </div>
      </div>

      {/* Filter panel */}
      <div className="flex flex-wrap gap-3 items-center bg-white dark:bg-[#1e293b] border border-slate-200 dark:border-slate-800 p-4 rounded-2xl shadow-sm">
        <div className="relative flex-1 min-w-[220px]">
          <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-400 dark:text-slate-500">
            <Search className="w-4 h-4" />
          </span>
          <input
            type="text"
            placeholder="Search Movement ID or Reference..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500"
          />
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-400 font-medium">Type:</span>
          <select
            value={movementType}
            onChange={(e) => setMovementType(e.target.value)}
            className="px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          >
            <option value="">All Movement Types</option>
            <option value="opening">Opening Stock</option>
            <option value="production">Production In</option>
            <option value="purchase">Purchase Inward</option>
            <option value="sale_amazon">Amazon Dispatch</option>
            <option value="sale_flipkart">Flipkart Dispatch</option>
            <option value="sale_meesho">Meesho Dispatch</option>
            <option value="sale_website">Website Dispatch</option>
            <option value="customer_return">Customer Return</option>
            <option value="qc_pass">QC Pass</option>
            <option value="qc_fail">QC Fail</option>
            <option value="damage">Damage Outward</option>
            <option value="adjustment">Stock Adjustment</option>
          </select>
        </div>

        <button
          onClick={loadMovements}
          className="p-2 border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl text-slate-500 cursor-pointer"
          title="Refresh ledger table"
        >
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      {/* Ledger Table */}
      <DataTable
        data={movements}
        columns={columns}
        loading={loading}
        emptyMessage="No ledger logs recorded for this select criteria."
        pagination={{
          page,
          perPage,
          total,
          onPageChange: (newPage) => setPage(newPage),
        }}
        actions={(row) => (
          <button
            onClick={() => setSelectedMovement(row)}
            className="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 rounded cursor-pointer"
            title="View Details"
          >
            <Eye className="w-4 h-4" />
          </button>
        )}
      />

      {/* Details Slideover or Modal */}
      {selectedMovement && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div onClick={() => setSelectedMovement(null)} className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm" />
          <div className="relative bg-white dark:bg-[#1e293b] w-full max-w-md rounded-2xl p-6 border border-slate-200 dark:border-slate-800 shadow-2xl z-10 space-y-4">
            <h3 className="text-sm font-bold text-slate-800 dark:text-white border-b border-slate-100 dark:border-slate-800 pb-2">
              Ledger Entry Details
            </h3>
            <div className="space-y-3 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-400">Movement ID:</span>
                <span className="font-mono font-bold text-slate-800 dark:text-slate-200">{selectedMovement.id}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Timestamp:</span>
                <span className="font-semibold text-slate-800 dark:text-slate-200">
                  {new Date(selectedMovement.performed_at).toLocaleString()}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Movement Type:</span>
                <MovementTypeBadge type={selectedMovement.movement_type} />
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">SKU Code:</span>
                <SkuTag sku={selectedMovement.variant?.sku || ''} copyable={true} size="sm" />
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Product:</span>
                <span className="font-semibold text-slate-800 dark:text-slate-200">
                  {selectedMovement.variant?.product?.product_name}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Warehouse:</span>
                <span className="font-semibold text-slate-700 dark:text-slate-300">
                  {selectedMovement.warehouse?.name} ({selectedMovement.warehouse?.code})
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Quantity:</span>
                <span className="font-black text-slate-900 dark:text-white">
                  {selectedMovement.quantity} pcs
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Transaction buckets:</span>
                <div className="flex items-center gap-1">
                  <StockBadge bucket={selectedMovement.from_bucket || 'available'} size="sm" />
                  <span>→</span>
                  <StockBadge bucket={selectedMovement.to_bucket || 'available'} size="sm" />
                </div>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Reference:</span>
                <span className="font-bold text-slate-800 dark:text-white">
                  {selectedMovement.reference_id || 'None'} ({selectedMovement.reference_type || 'N/A'})
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Logged Operator:</span>
                <span className="font-semibold text-slate-700 dark:text-slate-350">{selectedMovement.performed_by}</span>
              </div>
              <div className="space-y-1">
                <span className="text-slate-400">Remarks:</span>
                <p className="bg-slate-50 dark:bg-slate-900 p-2.5 rounded-xl border border-slate-100 dark:border-slate-800 text-slate-600 dark:text-slate-400 leading-normal">
                  {selectedMovement.remarks || 'No remarks recorded.'}
                </p>
              </div>
            </div>
            <button
              onClick={() => setSelectedMovement(null)}
              className="w-full py-2 bg-slate-150 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-xs font-semibold rounded-xl cursor-pointer"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
