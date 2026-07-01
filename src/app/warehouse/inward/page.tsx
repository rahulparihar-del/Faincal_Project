'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useWms } from '@/context/WmsContext';
import { DataTable } from '@/components/wms/ui/DataTable';
import { supabase } from '@/lib/supabase/client';
import { Plus, Search, Eye, Calendar, RefreshCw } from 'lucide-react';
import Link from 'next/link';
import { WmsInward } from '@/lib/wms/types';

export default function InwardListPage() {
  const { selectedWarehouseId } = useWms();
  const [inwards, setInwards] = useState<WmsInward[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedType, setSelectedType] = useState('');

  const loadInwards = useCallback(async () => {
    if (!supabase) return;
    setLoading(true);
    try {
      let query = supabase
        .from('wms_inwards')
        .select(`
          *,
          warehouse:wms_warehouses(id, name, code),
          supplier:wms_suppliers(id, name, code)
        `)
        .order('created_at', { ascending: false });

      if (selectedWarehouseId) {
        query = query.eq('warehouse_id', selectedWarehouseId);
      }
      if (selectedType) {
        query = query.eq('type', selectedType);
      }
      if (search) {
        query = query.or(`id.ilike.%${search}%,reference_no.ilike.%${search}%`);
      }

      const { data, error } = await query;
      if (error) throw error;
      setInwards((data as any[]) ?? []);
    } catch (err) {
      console.error('Failed to load inwards list:', err);
    } finally {
      setLoading(false);
    }
  }, [selectedWarehouseId, selectedType, search]);

  useEffect(() => {
    loadInwards();
  }, [loadInwards]);

  const columns = [
    {
      key: 'id',
      header: 'Inward ID',
      sortable: true,
      render: (row: WmsInward) => (
        <span className="font-mono font-bold text-slate-800 dark:text-slate-200">
          {row.id}
        </span>
      ),
    },
    {
      key: 'type',
      header: 'Source Type',
      render: (row: WmsInward) => (
        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
          {row.type}
        </span>
      ),
    },
    {
      key: 'warehouse',
      header: 'Warehouse',
      render: (row: WmsInward) => (
        <span className="text-slate-600 dark:text-slate-400 font-medium">
          {row.warehouse?.name || 'Unknown'}
        </span>
      ),
    },
    {
      key: 'supplier',
      header: 'Supplier Source',
      render: (row: WmsInward) => (
        <span className="text-slate-600 dark:text-slate-400">
          {row.supplier?.name || 'N/A'}
        </span>
      ),
    },
    {
      key: 'reference_no',
      header: 'Ref No / Invoice',
      render: (row: WmsInward) => (
        <span className="font-semibold text-slate-800 dark:text-slate-200">
          {row.reference_no || '—'}
        </span>
      ),
    },
    {
      key: 'received_date',
      header: 'Received Date',
      render: (row: WmsInward) => (
        <div className="flex items-center gap-1 text-slate-450">
          <Calendar className="w-3.5 h-3.5" />
          <span>{row.received_date}</span>
        </div>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (row: WmsInward) => {
        const colors = {
          draft: 'bg-slate-50 text-slate-500 border-slate-200',
          received: 'bg-emerald-50 text-emerald-600 border-emerald-100 dark:bg-emerald-950/20 dark:border-emerald-900/30',
          partial: 'bg-amber-50 text-amber-600 border-amber-100 dark:bg-amber-950/20 dark:border-amber-900/30',
          cancelled: 'bg-rose-50 text-rose-600 border-rose-100 dark:bg-rose-950/20 dark:border-rose-900/30',
        };
        const c = colors[row.status] || colors.draft;
        return (
          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${c}`}>
            {row.status}
          </span>
        );
      },
    },
  ];

  return (
    <div className="space-y-6">
      {/* Title & Add Inward */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-800 dark:text-white tracking-tight">
            Inward Operations
          </h1>
          <p className="text-xs text-slate-400 mt-0.5 font-medium">
            Record supplier purchases, manufacturing receipts, and stock inward transfers.
          </p>
        </div>
        <Link
          href="/warehouse/inward/new"
          className="flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl shadow-sm self-start sm:self-auto cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          Inward Stock
        </Link>
      </div>

      {/* Filter panel */}
      <div className="flex flex-wrap gap-3 items-center bg-white dark:bg-[#1e293b] border border-slate-200 dark:border-slate-800 p-4 rounded-2xl shadow-sm">
        <div className="relative flex-1 min-w-[200px]">
          <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-400">
            <Search className="w-4 h-4" />
          </span>
          <input
            type="text"
            placeholder="Search Inward ID or Reference..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500"
          />
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-400 font-medium">Type:</span>
          <select
            value={selectedType}
            onChange={(e) => setSelectedType(e.target.value)}
            className="px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          >
            <option value="">All Types</option>
            <option value="production">Production Inward</option>
            <option value="purchase">Purchase (PO)</option>
            <option value="transfer">Warehouse Transfer</option>
            <option value="return">Customer Return</option>
          </select>
        </div>

        <button
          onClick={loadInwards}
          className="p-2 border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl text-slate-500 cursor-pointer"
          title="Refresh inwards list"
        >
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      {/* Inwards Data Table */}
      <DataTable
        data={inwards}
        columns={columns}
        loading={loading}
        emptyMessage="No inward logs recorded."
        actions={(row) => (
          <Link
            href={`/warehouse/inward/${row.id}`}
            className="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 rounded cursor-pointer block"
            title="View Details"
          >
            <Eye className="w-4 h-4" />
          </Link>
        )}
      />
    </div>
  );
}
