'use client';

import React from 'react';
import { Globe, ShieldAlert } from 'lucide-react';
import { DataTable } from '@/components/wms/ui/DataTable';

export default function MarketplacePage() {
  const mockMappings = [
    { id: 'MAP-101', sku: 'CJ-DEER-03M', channel: 'Amazon (AMZ)', marketplaceSku: 'KID-CJ-DEER-03M-FBA', active: true },
  ];

  const columns = [
    { key: 'sku', header: 'WMS SKU' },
    { key: 'channel', header: 'Marketplace Channel' },
    { key: 'marketplaceSku', header: 'Marketplace SKU (Listing ID)', render: (row: { marketplaceSku: string }) => <span className="font-mono">{row.marketplaceSku}</span> },
    {
      key: 'active',
      header: 'Sync Status',
      render: (row: { active: boolean }) => (
        <span className="px-2 py-0.5 rounded-full text-[9px] font-bold border bg-emerald-50 text-emerald-600 border-emerald-100">
          ACTIVE SYNC
        </span>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold text-slate-800 dark:text-white tracking-tight flex items-center gap-2">
          <Globe className="w-6 h-6 text-indigo-500" /> Marketplace Mappings
        </h1>
        <p className="text-xs text-slate-400 mt-0.5 font-medium">
          Map KiddieKa warehouse variants to marketplace listings on Amazon, Flipkart, Meesho.
        </p>
      </div>

      <div className="p-4 bg-indigo-50/70 dark:bg-indigo-950/20 border border-indigo-100 dark:border-indigo-900/30 rounded-2xl flex gap-3 items-start shadow-sm">
        <div className="shrink-0 w-8 h-8 rounded-lg bg-indigo-500/10 flex items-center justify-center text-indigo-600 dark:text-indigo-400">
          <ShieldAlert className="w-4.5 h-4.5" />
        </div>
        <div className="space-y-1">
          <h4 className="text-xs font-bold text-indigo-900 dark:text-indigo-300">
            Roadmap Update: Marketplace Sync Module (Phase 4 Integration)
          </h4>
          <p className="text-xs text-indigo-700/80 dark:text-indigo-400/80 leading-relaxed font-medium">
            Marketplace channel definitions are active. Real-time API listings inventory sync, stock push schedulers, and incoming orders pulls are scheduled for **Phase 4**.
          </p>
        </div>
      </div>

      <div className="bg-white dark:bg-[#1e293b] border border-slate-200 dark:border-slate-800 p-5 rounded-2xl shadow-sm">
        <DataTable data={mockMappings} columns={columns} emptyMessage="No marketplace mappings." />
      </div>
    </div>
  );
}
