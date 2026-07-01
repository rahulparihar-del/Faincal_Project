'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useWms } from '@/context/WmsContext';
import { DataTable } from '@/components/wms/ui/DataTable';
import { supabase } from '@/lib/supabase/client';
import { Plus, Search, Eye, Calendar, RefreshCw } from 'lucide-react';
import Link from 'next/link';
import { WmsOutward } from '@/lib/wms/types';

export default function OutwardListPage() {
  const { selectedWarehouseId } = useWms();
  const [outwards, setOutwards] = useState<WmsOutward[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedChannel, setSelectedChannel] = useState('');

  const loadOutwards = useCallback(async () => {
    if (!supabase) return;
    setLoading(true);
    try {
      let query = supabase
        .from('wms_outwards')
        .select(`
          *,
          channel:wms_marketplace_channels(id, name, code),
          warehouse:wms_warehouses(id, name, code)
        `)
        .order('created_at', { ascending: false });

      if (selectedWarehouseId) {
        query = query.eq('warehouse_id', selectedWarehouseId);
      }
      if (selectedChannel) {
        query = query.eq('channel_id', selectedChannel);
      }
      if (search) {
        query = query.or(`id.ilike.%${search}%,order_reference.ilike.%${search}%`);
      }

      const { data, error } = await query;
      if (error) throw error;
      setOutwards((data as any[]) ?? []);
    } catch (err) {
      console.error('Failed to load outwards list:', err);
    } finally {
      setLoading(false);
    }
  }, [selectedWarehouseId, selectedChannel, search]);

  useEffect(() => {
    loadOutwards();
  }, [loadOutwards]);

  const columns = [
    {
      key: 'id',
      header: 'Outward ID',
      sortable: true,
      render: (row: WmsOutward) => (
        <span className="font-mono font-bold text-slate-800 dark:text-slate-200">
          {row.id}
        </span>
      ),
    },
    {
      key: 'channel',
      header: 'Destination Channel',
      render: (row: WmsOutward) => (
        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-slate-100 dark:bg-slate-800 text-slate-650 dark:text-slate-350 border border-slate-200/50">
          {row.channel?.name || 'Offline/Direct'}
        </span>
      ),
    },
    {
      key: 'warehouse',
      header: 'Source Warehouse',
      render: (row: WmsOutward) => (
        <span className="text-slate-650 dark:text-slate-400 font-medium">
          {row.warehouse?.name || 'Unknown'}
        </span>
      ),
    },
    {
      key: 'order_reference',
      header: 'Order Reference',
      render: (row: WmsOutward) => (
        <span className="font-semibold text-slate-800 dark:text-slate-200">
          {row.order_reference || '—'}
        </span>
      ),
    },
    {
      key: 'dispatch_date',
      header: 'Dispatch Date',
      render: (row: WmsOutward) => (
        <div className="flex items-center gap-1 text-slate-450">
          <Calendar className="w-3.5 h-3.5" />
          <span>{row.dispatch_date}</span>
        </div>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (row: WmsOutward) => {
        const colors = {
          draft: 'bg-slate-50 text-slate-500 border-slate-200',
          picking: 'bg-indigo-50 text-indigo-600 border-indigo-100 dark:bg-indigo-950/20 dark:border-indigo-900/30',
          packed: 'bg-blue-50 text-blue-600 border-blue-100 dark:bg-blue-950/20 dark:border-blue-900/30',
          dispatched: 'bg-emerald-50 text-emerald-600 border-emerald-100 dark:bg-emerald-950/20 dark:border-emerald-900/30',
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
      {/* Title & Dispatch */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-800 dark:text-white tracking-tight">
            Outward Dispatch
          </h1>
          <p className="text-xs text-slate-400 mt-0.5 font-medium">
            Fulfill marketplace sales orders and dispatch inventory stock from channels.
          </p>
        </div>
        <Link
          href="/warehouse/outward/new"
          className="flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl shadow-sm self-start sm:self-auto cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          Dispatch Order
        </Link>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-center bg-white dark:bg-[#1e293b] border border-slate-200 dark:border-slate-800 p-4 rounded-2xl shadow-sm">
        <div className="relative flex-1 min-w-[200px]">
          <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-400">
            <Search className="w-4 h-4" />
          </span>
          <input
            type="text"
            placeholder="Search Outward ID or Order Ref..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500"
          />
        </div>

        <button
          onClick={loadOutwards}
          className="p-2 border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl text-slate-500 cursor-pointer"
          title="Refresh dispatch table"
        >
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      {/* Outwards Data Table */}
      <DataTable
        data={outwards}
        columns={columns}
        loading={loading}
        emptyMessage="No dispatch orders found."
        actions={(row) => (
          <Link
            href={`/warehouse/outward/${row.id}`}
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
