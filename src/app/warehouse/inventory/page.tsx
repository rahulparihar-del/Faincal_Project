'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useWms } from '@/context/WmsContext';
import { getInventorySnapshot } from '@/lib/wms/services/inventoryService';
import { DataTable } from '@/components/wms/ui/DataTable';
import { SkuTag } from '@/components/wms/ui/SkuTag';
import { StockBadge } from '@/components/wms/ui/StockBadge';
import { useMasterData } from '@/lib/wms/hooks/useMasterData';
import { Search, Filter, RefreshCw, AlertTriangle } from 'lucide-react';
import { WmsInventorySnapshot } from '@/lib/wms/types';

export default function InventoryPage() {
  const { selectedWarehouseId, warehouses } = useWms();
  const { categories, loading: masterLoading } = useMasterData();

  const [inventory, setInventory] = useState<WmsInventorySnapshot[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'low_stock' | 'qc_pending' | 'damaged'>('all');

  const loadInventory = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getInventorySnapshot(selectedWarehouseId || undefined);
      setInventory(res);
    } catch (err) {
      console.error('Failed to load inventory snapshot:', err);
    } finally {
      setLoading(false);
    }
  }, [selectedWarehouseId]);

  useEffect(() => {
    loadInventory();
  }, [loadInventory]);

  // Client filtering
  const filteredInventory = inventory.filter((item) => {
    const variant = item.variant;
    if (!variant) return false;

    const matchesCategory = selectedCategory
      ? variant.product?.category_id === selectedCategory
      : true;

    const matchesSearch = search
      ? variant.sku.toLowerCase().includes(search.toLowerCase()) ||
        variant.product?.product_name.toLowerCase().includes(search.toLowerCase()) ||
        variant.barcode.includes(search)
      : true;

    const matchesFilterType = (() => {
      switch (filterType) {
        case 'low_stock':
          return (item.available ?? 0) <= (variant.low_stock_threshold ?? 10);
        case 'qc_pending':
          return (item.qc_pending ?? 0) > 0;
        case 'damaged':
          return (item.damaged ?? 0) > 0;
        default:
          return true;
      }
    })();

    return matchesCategory && matchesSearch && matchesFilterType;
  });

  const columns = [
    {
      key: 'sku',
      header: 'SKU Code',
      sortable: true,
      render: (row: WmsInventorySnapshot) => (
        <div className="flex flex-col gap-0.5">
          <SkuTag sku={row.variant?.sku || 'N/A'} copyable={true} size="sm" />
          <span className="text-[9px] text-slate-400 font-mono">BC: {row.variant?.barcode}</span>
        </div>
      ),
    },
    {
      key: 'product_name',
      header: 'Product Detail',
      render: (row: WmsInventorySnapshot) => (
        <div className="flex flex-col">
          <span className="font-semibold text-slate-800 dark:text-slate-200">
            {row.variant?.product?.product_name || 'Unknown'}
          </span>
          <span className="text-[10px] text-slate-400">
            Sz: {row.variant?.size?.label || 'N/A'} | Col: {row.variant?.color?.name || 'N/A'}
          </span>
        </div>
      ),
    },
    {
      key: 'available',
      header: 'Available',
      align: 'center' as const,
      sortable: true,
      render: (row: WmsInventorySnapshot) => {
        const threshold = row.variant?.low_stock_threshold ?? 10;
        const isLow = (row.available ?? 0) <= threshold;
        const isOut = (row.available ?? 0) === 0;

        return (
          <div className="flex flex-col items-center">
            <span className={`px-2 py-0.5 rounded font-bold ${
              isOut
                ? 'bg-rose-50 text-rose-600 dark:bg-rose-950/20'
                : isLow
                ? 'bg-amber-50 text-amber-600 dark:bg-amber-950/20'
                : 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/20'
            }`}>
              {row.available ?? 0}
            </span>
            {isLow && !isOut && (
              <span className="text-[8px] text-amber-500 font-bold flex items-center gap-0.5 mt-0.5">
                <AlertTriangle className="w-2.5 h-2.5" /> LOW
              </span>
            )}
          </div>
        );
      },
    },
    {
      key: 'reserved',
      header: 'Reserved',
      align: 'center' as const,
      render: (row: WmsInventorySnapshot) => (
        <span className="font-semibold text-indigo-600 dark:text-indigo-400">{row.reserved ?? 0}</span>
      ),
    },
    {
      key: 'packed',
      header: 'Packed',
      align: 'center' as const,
      render: (row: WmsInventorySnapshot) => (
        <span className="text-slate-600 dark:text-slate-400">{row.packed ?? 0}</span>
      ),
    },
    {
      key: 'dispatched',
      header: 'Dispatched',
      align: 'center' as const,
      render: (row: WmsInventorySnapshot) => (
        <span className="text-slate-400">{row.dispatched ?? 0}</span>
      ),
    },
    {
      key: 'qc_pending',
      header: 'QC Pending',
      align: 'center' as const,
      render: (row: WmsInventorySnapshot) => (
        <span className={`font-semibold ${row.qc_pending ? 'text-amber-500' : 'text-slate-400'}`}>
          {row.qc_pending ?? 0}
        </span>
      ),
    },
    {
      key: 'damaged',
      header: 'Damaged',
      align: 'center' as const,
      render: (row: WmsInventorySnapshot) => (
        <span className={`font-semibold ${row.damaged ? 'text-rose-500' : 'text-slate-400'}`}>
          {row.damaged ?? 0}
        </span>
      ),
    },
    {
      key: 'wrong_return',
      header: 'Wrong Ret',
      align: 'center' as const,
      render: (row: WmsInventorySnapshot) => (
        <span className="text-slate-400">{row.wrong_return ?? 0}</span>
      ),
    },
    {
      key: 'rto',
      header: 'RTO',
      align: 'center' as const,
      render: (row: WmsInventorySnapshot) => (
        <span className="text-slate-400">{row.rto ?? 0}</span>
      ),
    },
    {
      key: 'total_stock',
      header: 'Total Stock',
      align: 'center' as const,
      sortable: true,
      render: (row: WmsInventorySnapshot) => (
        <span className="font-extrabold text-slate-800 dark:text-white">
          {row.total_stock ?? 0}
        </span>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      {/* Page Title & Stats */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-800 dark:text-white tracking-tight">
            Inventory Stock snapshot
          </h1>
          <p className="text-xs text-slate-400 mt-0.5 font-medium">
            Aggregated relational snapshot of product buckets.
          </p>
        </div>
      </div>

      {/* Filter Options */}
      <div className="flex flex-wrap gap-3 items-center bg-white dark:bg-[#1e293b] border border-slate-200 dark:border-slate-800 p-4 rounded-2xl shadow-sm">
        <div className="relative flex-1 min-w-[200px]">
          <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-400 dark:text-slate-500">
            <Search className="w-4 h-4" />
          </span>
          <input
            type="text"
            placeholder="Search SKU or product..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500"
          />
        </div>

        <div className="flex flex-wrap gap-2">
          {/* Quick Filter tabs */}
          <button
            type="button"
            onClick={() => setFilterType('all')}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all cursor-pointer ${
              filterType === 'all'
                ? 'bg-indigo-50 border-indigo-200 text-indigo-600 dark:bg-indigo-950/20 dark:border-indigo-900/30 dark:text-indigo-400'
                : 'bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-500'
            }`}
          >
            All Stock
          </button>
          <button
            type="button"
            onClick={() => setFilterType('low_stock')}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all cursor-pointer ${
              filterType === 'low_stock'
                ? 'bg-amber-50 border-amber-200 text-amber-600 dark:bg-amber-950/20 dark:border-amber-900/30 dark:text-amber-400'
                : 'bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-500'
            }`}
          >
            Low Stock Alerts
          </button>
          <button
            type="button"
            onClick={() => setFilterType('qc_pending')}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all cursor-pointer ${
              filterType === 'qc_pending'
                ? 'bg-blue-50 border-blue-200 text-blue-600 dark:bg-blue-950/20 dark:border-blue-900/30 dark:text-blue-400'
                : 'bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-500'
            }`}
          >
            QC Pending
          </button>
          <button
            type="button"
            onClick={() => setFilterType('damaged')}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all cursor-pointer ${
              filterType === 'damaged'
                ? 'bg-rose-50 border-rose-200 text-rose-600 dark:bg-rose-950/20 dark:border-rose-900/30 dark:text-rose-400'
                : 'bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-500'
            }`}
          >
            Damaged
          </button>
        </div>

        <div className="flex items-center gap-2 border-l border-slate-250 pl-3">
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          >
            <option value="">All Categories</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>

        <button
          onClick={loadInventory}
          className="p-2 border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl text-slate-500 cursor-pointer"
          title="Refresh table"
        >
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      {/* Inventory table */}
      <DataTable
        data={filteredInventory}
        columns={columns}
        loading={loading || masterLoading}
        emptyMessage="No stock inventory snapshots matched the selected filters."
      />
    </div>
  );
}
