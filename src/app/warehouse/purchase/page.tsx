'use client';

import React from 'react';
import { ShoppingCart, ShieldAlert } from 'lucide-react';
import { DataTable } from '@/components/wms/ui/DataTable';

export default function PurchasePage() {
  const mockPo = [
    { id: 'PO-20260701-01', supplier: 'Cotton Fabric Mills', expected: '2026-07-10', items: 5, status: 'ordered' },
  ];

  const columns = [
    { key: 'id', header: 'Purchase Order ID', render: (row: any) => <span className="font-mono font-bold">{row.id}</span> },
    { key: 'supplier', header: 'Supplier Name' },
    { key: 'expected', header: 'Expected Delivery' },
    { key: 'items', header: 'Items Count', align: 'center' as const },
    {
      key: 'status',
      header: 'Status',
      render: (row: any) => (
        <span className="px-2 py-0.5 rounded-full text-[9px] font-bold border bg-indigo-50 text-indigo-600 border-indigo-100">
          {row.status.toUpperCase()}
        </span>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold text-slate-800 dark:text-white tracking-tight flex items-center gap-2">
          <ShoppingCart className="w-6 h-6 text-indigo-500" /> Purchase Orders (PO)
        </h1>
        <p className="text-xs text-slate-400 mt-0.5 font-medium">
          Manage supplier purchase contracts and inbound inventory supply chains.
        </p>
      </div>

      <div className="p-4 bg-indigo-50/70 dark:bg-indigo-950/20 border border-indigo-100 dark:border-indigo-900/30 rounded-2xl flex gap-3 items-start shadow-sm">
        <div className="shrink-0 w-8 h-8 rounded-lg bg-indigo-500/10 flex items-center justify-center text-indigo-600 dark:text-indigo-400">
          <ShieldAlert className="w-4.5 h-4.5" />
        </div>
        <div className="space-y-1">
          <h4 className="text-xs font-bold text-indigo-900 dark:text-indigo-300">
            Roadmap Update: Purchase PO Module (Phase 2 Integration)
          </h4>
          <p className="text-xs text-indigo-700/80 dark:text-indigo-400/80 leading-relaxed font-medium">
            Supplier inward receipts are active. Supplier procurement tracking, unit cost invoicing logs, PO creation forms, and backorder triggers are scheduled for **Phase 2**.
          </p>
        </div>
      </div>

      <div className="bg-white dark:bg-[#1e293b] border border-slate-200 dark:border-slate-800 p-5 rounded-2xl shadow-sm">
        <DataTable data={mockPo} columns={columns} emptyMessage="No active purchase orders." />
      </div>
    </div>
  );
}
