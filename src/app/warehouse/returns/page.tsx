'use client';

import React, { useState } from 'react';
import { DataTable } from '@/components/wms/ui/DataTable';
import { StockBadge } from '@/components/wms/ui/StockBadge';
import { SkuTag } from '@/components/wms/ui/SkuTag';
import { RotateCcw, ShieldCheck, AlertCircle, HelpCircle, ArrowRight } from 'lucide-react';

export default function ReturnsPage() {
  const [loading] = useState(false);

  // Mock return entries representing Phase 3 QC return tracking
  const mockReturns = [
    {
      id: 'RET-20260701-000001',
      channel: 'Amazon',
      orderRef: 'AMZ-99381-01',
      sku: 'CJ-DEER-03M',
      productName: 'Cotton Jabla (Deer Print)',
      qty: 2,
      status: 'qc_pending',
      qcStatus: 'Good',
      date: '2026-07-01',
    },
    {
      id: 'RET-20260630-000042',
      channel: 'Flipkart',
      orderRef: 'FLK-48192-99',
      sku: 'CCS-MINT-1218M',
      productName: 'Cotton Co-ord Set (Mint Green)',
      qty: 1,
      status: 'qc_done',
      qcStatus: 'Damaged (Stain)',
      date: '2026-06-30',
    },
    {
      id: 'RET-20260629-000015',
      channel: 'Website',
      orderRef: 'KK-18938',
      sku: 'CNH-YELW-0612M',
      productName: 'Cotton Night Suit Half (Yellow)',
      qty: 3,
      status: 'closed',
      qcStatus: 'Wrong product returned',
      date: '2026-06-29',
    },
  ];

  interface MockReturn {
    id: string;
    channel: string;
    orderRef: string;
    sku: string;
    productName: string;
    qty: number;
    status: string;
    qcStatus: string;
    date: string;
  }

  const columns = [
    {
      key: 'id',
      header: 'Return ID',
      render: (row: MockReturn) => <span className="font-mono font-bold text-slate-800 dark:text-slate-200">{row.id}</span>,
    },
    {
      key: 'channel',
      header: 'Sales Channel',
      render: (row: MockReturn) => (
        <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 dark:bg-slate-900 text-slate-600 dark:text-slate-300">
          {row.channel}
        </span>
      ),
    },
    {
      key: 'sku',
      header: 'SKU / Product',
      render: (row: MockReturn) => (
        <div className="flex flex-col gap-0.5">
          <SkuTag sku={row.sku} copyable={false} size="sm" />
          <span className="text-[10px] text-slate-450 truncate max-w-[160px]">{row.productName}</span>
        </div>
      ),
    },
    {
      key: 'qty',
      header: 'Returned Qty',
      align: 'center' as const,
      render: (row: MockReturn) => <span className="font-bold text-slate-800 dark:text-white">{row.qty} units</span>,
    },
    {
      key: 'date',
      header: 'Date Logged',
      render: (row: MockReturn) => <span className="text-slate-450">{row.date}</span>,
    },
    {
      key: 'qcStatus',
      header: 'QC Inspection Notes',
      render: (row: MockReturn) => (
        <span className={`font-semibold ${row.qcStatus.includes('Damaged') || row.qcStatus.includes('Wrong') ? 'text-rose-500' : 'text-emerald-500'}`}>
          {row.qcStatus}
        </span>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (row: MockReturn) => {
        const colors: Record<string, string> = {
          qc_pending: 'bg-amber-50 text-amber-600 border-amber-100 dark:bg-amber-950/20 dark:border-amber-900/30',
          qc_done: 'bg-indigo-50 text-indigo-600 border-indigo-100 dark:bg-indigo-950/20 dark:border-indigo-900/30',
          closed: 'bg-slate-50 text-slate-500 border-slate-200 dark:bg-slate-900 dark:border-slate-800',
        };
        const labels: Record<string, string> = {
          qc_pending: 'QC PENDING',
          qc_done: 'QC DONE',
          closed: 'CLOSED',
        };
        return (
          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[9px] font-bold border ${colors[row.status]}`}>
            {labels[row.status]}
          </span>
        );
      },
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-800 dark:text-white tracking-tight flex items-center gap-2">
            <RotateCcw className="w-6 h-6 text-indigo-500" /> Returns & QC Center
          </h1>
          <p className="text-xs text-slate-400 mt-0.5 font-medium">
            Manage channel return receipts and run quality control (QC) checks.
          </p>
        </div>
      </div>

      {/* Phase 3 Roadmap Banner */}
      <div className="p-4 bg-indigo-50/70 dark:bg-indigo-950/20 border border-indigo-100 dark:border-indigo-900/30 rounded-2xl flex gap-3 items-start shadow-sm">
        <div className="shrink-0 w-8 h-8 rounded-lg bg-indigo-500/10 flex items-center justify-center text-indigo-600 dark:text-indigo-400">
          <ShieldCheck className="w-4.5 h-4.5" />
        </div>
        <div className="space-y-1">
          <h4 className="text-xs font-bold text-indigo-900 dark:text-indigo-300">
            Roadmap Update: Returns & QC Module (Phase 3 Integration)
          </h4>
          <p className="text-xs text-indigo-700/80 dark:text-indigo-400/80 leading-relaxed font-medium">
            You are currently viewing a Phase 1 operational simulation grid. Standard return receipt ledger logging (inwarding to the `qc_pending` bucket) is active. Interactive itemized QC checklist panels, wrong product return logs, and marketplace API returns sync are scheduled for **Phase 3**.
          </p>
          <div className="flex items-center gap-1.5 text-[10px] font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-wider pt-1 hover:underline cursor-pointer">
            <span>Review implementation timeline</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </div>
        </div>
      </div>

      {/* QC simulation grid */}
      <div className="bg-white dark:bg-[#1e293b] border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold text-slate-850 dark:text-white">
              Simulated Returns Logs
            </h3>
            <p className="text-[10px] text-slate-400">
              Historical channel return packages logged in warehouse.
            </p>
          </div>
        </div>

        <DataTable
          data={mockReturns}
          columns={columns}
          loading={loading}
          emptyMessage="No returns logged in simulated workspace."
        />
      </div>
    </div>
  );
}
