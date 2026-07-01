'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useWms } from '@/context/WmsContext';
import { getDashboardStats, getInventorySnapshot, getLowStockItems } from '@/lib/wms/services/inventoryService';
import { StatCard } from '@/components/wms/ui/StatCard';
import { StockBadge } from '@/components/wms/ui/StockBadge';
import { SkuTag } from '@/components/wms/ui/SkuTag';
import {
  Boxes,
  IndianRupee,
  CheckCircle,
  Clock,
  AlertTriangle,
  ArrowDownToLine,
  ArrowUpFromLine,
  RotateCcw,
  PackageX,
  ClipboardCheck,
  AlertCircle,
  Truck,
  RefreshCw,
  TrendingUp,
  Inbox,
} from 'lucide-react';
import { supabase } from '@/lib/supabase/client';
import Link from 'next/link';

export default function WmsDashboard() {
  const { selectedWarehouseId, warehouses } = useWms();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<any>(null);
  const [lowStock, setLowStock] = useState<any[]>([]);
  const [categoryData, setCategoryData] = useState<any[]>([]);
  const [recentMovements, setRecentMovements] = useState<any[]>([]);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      // 1. Get statistics and low stock items
      const [statsRes, lowStockRes, snapshotRes] = await Promise.all([
        getDashboardStats(selectedWarehouseId || undefined),
        getLowStockItems(selectedWarehouseId || undefined, 10),
        getInventorySnapshot(selectedWarehouseId || undefined),
      ]);

      setStats(statsRes);
      setLowStock(lowStockRes.slice(0, 5)); // show top 5 low stock

      // 2. Aggregate snapshot data by category for category chart
      const catMap: Record<string, number> = {};
      snapshotRes.forEach((item: any) => {
        const catName = item.variant?.product?.category?.name || 'Unassigned';
        catMap[catName] = (catMap[catName] || 0) + (item.available || 0);
      });
      const catArray = Object.entries(catMap)
        .map(([name, stock]) => ({ name, stock }))
        .sort((a, b) => b.stock - a.stock)
        .slice(0, 8); // top 8 categories
      setCategoryData(catArray);

      // 3. Get recent movements
      if (supabase) {
        let query = supabase
          .from('wms_stock_movements')
          .select(`
            id, movement_type, quantity, performed_at,
            variant:wms_product_variants(
              sku,
              product:wms_products(product_name)
            )
          `)
          .order('performed_at', { ascending: false })
          .limit(10);
        
        if (selectedWarehouseId) {
          query = query.eq('warehouse_id', selectedWarehouseId);
        }
        const { data: movs } = await query;
        setRecentMovements(movs || []);
      }
    } catch (err) {
      console.error('Failed to load WMS dashboard data:', err);
    } finally {
      setLoading(false);
    }
  }, [selectedWarehouseId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // SVG Donut calculation helpers
  const totalStockForDonut = stats?.totalStock || 0;
  const availablePct = totalStockForDonut > 0 ? (stats?.available / totalStockForDonut) * 100 : 0;
  const reservedPct = totalStockForDonut > 0 ? (stats?.reserved / totalStockForDonut) * 100 : 0;
  const otherPct = totalStockForDonut > 0 ? ((totalStockForDonut - (stats?.available + stats?.reserved)) / totalStockForDonut) * 100 : 0;

  const selectedWarehouse = warehouses.find((w) => w.id === selectedWarehouseId);

  const relativeTime = (dateStr: string) => {
    try {
      const diffMs = new Date().getTime() - new Date(dateStr).getTime();
      const diffMins = Math.floor(diffMs / 60000);
      if (diffMins < 1) return 'Just now';
      if (diffMins < 60) return `${diffMins}m ago`;
      const diffHours = Math.floor(diffMins / 60);
      if (diffHours < 24) return `${diffHours}h ago`;
      return new Date(dateStr).toLocaleDateString();
    } catch {
      return '';
    }
  };

  return (
    <div className="space-y-6">
      {/* Header section */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-800 dark:text-white tracking-tight">
            Warehouse Dashboard
          </h1>
          <p className="text-xs text-slate-400 dark:text-slate-500 mt-1 font-medium">
            Real-time stock ledger levels and transaction activity logs.
          </p>
        </div>
        <div className="flex items-center gap-2 self-start md:self-auto">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-slate-950 dark:bg-white text-white dark:text-slate-950 text-xs font-bold rounded-xl shadow-sm">
            <span className="w-1.5 h-1.5 rounded-full bg-white dark:bg-slate-950 animate-pulse" />
            {selectedWarehouse ? `${selectedWarehouse.name} (${selectedWarehouse.code})` : 'All Warehouses'}
          </span>
          <button
            onClick={loadData}
            disabled={loading}
            className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-500 dark:text-slate-400 cursor-pointer transition-colors disabled:opacity-50"
            title="Refresh dashboard"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>


      {/* Loading state placeholders */}
      {loading && !stats ? (
        <div className="space-y-6">
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-32 bg-white dark:bg-[#1e293b] border border-slate-200 dark:border-slate-800 rounded-2xl animate-shimmer" />
            ))}
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-24 bg-white dark:bg-[#1e293b] border border-slate-200 dark:border-slate-800 rounded-2xl animate-shimmer" />
            ))}
          </div>
        </div>
      ) : (
        <>
          {/* Row 1: 5 KPI Stat Cards */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
            <StatCard
              title="Total Stock"
              value={stats?.totalStock?.toLocaleString('en-IN') ?? '0'}
              icon={<Boxes className="w-5 h-5 text-slate-950 dark:text-white" />}
              iconBg="bg-slate-100 dark:bg-slate-850"
              subtitle="All buckets combined"
            />
            <StatCard
              title="Inventory Value"
              value={`₹${(stats?.inventoryValue ?? 0).toLocaleString('en-IN')}`}
              icon={<IndianRupee className="w-5 h-5 text-slate-950 dark:text-white" />}
              iconBg="bg-slate-100 dark:bg-slate-850"
              subtitle="Value based on unit cost"
            />
            <StatCard
              title="Available Stock"
              value={stats?.available?.toLocaleString('en-IN') ?? '0'}
              icon={<CheckCircle className="w-5 h-5 text-slate-950 dark:text-white" />}
              iconBg="bg-slate-100 dark:bg-slate-850"
              subtitle="Available for fulfillment"
            />
            <StatCard
              title="Reserved Stock"
              value={stats?.reserved?.toLocaleString('en-IN') ?? '0'}
              icon={<Clock className="w-5 h-5 text-slate-950 dark:text-white" />}
              iconBg="bg-slate-100 dark:bg-slate-850"
              subtitle="Held for marketplace orders"
            />
            <StatCard
              title="Low Stock Alerts"
              value={stats?.lowStockCount ?? '0'}
              icon={<AlertTriangle className="w-5 h-5 text-slate-950 dark:text-white" />}
              iconBg="bg-slate-100 dark:bg-slate-850"
              highlight={stats?.lowStockCount > 0}
              subtitle="Items below threshold"
            />
          </div>

          {/* Row 2: Today's Transaction metrics */}
          <div className="space-y-3">
            <h2 className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest pl-1">
              Today's Activity
            </h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <StatCard
                title="Inward Quantity"
                value={stats?.todayInward ?? '0'}
                icon={<ArrowDownToLine className="w-4 h-4 text-slate-950 dark:text-white" />}
                iconBg="bg-slate-100 dark:bg-slate-850"
              />
              <StatCard
                title="Outward Quantity"
                value={stats?.todayOutward ?? '0'}
                icon={<ArrowUpFromLine className="w-4 h-4 text-slate-950 dark:text-white" />}
                iconBg="bg-slate-100 dark:bg-slate-850"
              />
              <StatCard
                title="Returned Quantity"
                value={stats?.todayReturns ?? '0'}
                icon={<RotateCcw className="w-4 h-4 text-slate-950 dark:text-white" />}
                iconBg="bg-slate-100 dark:bg-slate-850"
              />
              <StatCard
                title="RTO Quantity"
                value={stats?.todayRto ?? '0'}
                icon={<PackageX className="w-4 h-4 text-slate-950 dark:text-white" />}
                iconBg="bg-slate-100 dark:bg-slate-850"
              />
            </div>
          </div>

          {/* Row 3: Status Buckets Breakdown */}
          <div className="space-y-3">
            <h2 className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest pl-1">
              Operational Status Buckets
            </h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-white dark:bg-[#1e293b] border border-slate-200 dark:border-slate-800 rounded-2xl p-4 flex items-center justify-between shadow-sm">
                <div className="space-y-0.5">
                  <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider block">
                    QC Pending
                  </span>
                  <span className="text-lg font-extrabold text-slate-800 dark:text-white">
                    {stats?.qcPending ?? 0}
                  </span>
                </div>
                <div className="w-8 h-8 rounded-xl bg-amber-50/80 dark:bg-amber-950/10 flex items-center justify-center text-amber-500">
                  <ClipboardCheck className="w-4 h-4" />
                </div>
              </div>

              <div className="bg-white dark:bg-[#1e293b] border border-slate-200 dark:border-slate-800 rounded-2xl p-4 flex items-center justify-between shadow-sm">
                <div className="space-y-0.5">
                  <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider block">
                    Damaged
                  </span>
                  <span className="text-lg font-extrabold text-slate-800 dark:text-white text-rose-500">
                    {stats?.damaged ?? 0}
                  </span>
                </div>
                <div className="w-8 h-8 rounded-xl bg-rose-50/80 dark:bg-rose-950/10 flex items-center justify-center text-rose-500">
                  <AlertCircle className="w-4 h-4" />
                </div>
              </div>

              <div className="bg-white dark:bg-[#1e293b] border border-slate-200 dark:border-slate-800 rounded-2xl p-4 flex items-center justify-between shadow-sm">
                <div className="space-y-0.5">
                  <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider block">
                    Wrong Return
                  </span>
                  <span className="text-lg font-extrabold text-slate-800 dark:text-white">
                    {stats?.wrongReturn ?? 0}
                  </span>
                </div>
                <div className="w-8 h-8 rounded-xl bg-orange-50/80 dark:bg-orange-950/10 flex items-center justify-center text-orange-500">
                  <AlertTriangle className="w-4 h-4" />
                </div>
              </div>

              <div className="bg-white dark:bg-[#1e293b] border border-slate-200 dark:border-slate-800 rounded-2xl p-4 flex items-center justify-between shadow-sm">
                <div className="space-y-0.5">
                  <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider block">
                    RTO Pending
                  </span>
                  <span className="text-lg font-extrabold text-slate-800 dark:text-white">
                    {stats?.rto ?? 0}
                  </span>
                </div>
                <div className="w-8 h-8 rounded-xl bg-red-50/80 dark:bg-red-950/10 flex items-center justify-center text-red-500">
                  <Truck className="w-4 h-4" />
                </div>
              </div>
            </div>
          </div>

          {/* Row 4: Charts Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Category Chart */}
            <div className="bg-white dark:bg-[#1e293b] border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm space-y-4">
              <div>
                <h3 className="text-sm font-bold text-slate-800 dark:text-white leading-tight">
                  Stock by Category
                </h3>
                <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5">
                  Total available inventory levels sorted by product category.
                </p>
              </div>
              <div className="space-y-3.5 pt-2">
                {categoryData.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 text-slate-400 gap-1.5">
                    <Inbox className="w-6 h-6 stroke-1" />
                    <span className="text-xs">No stock data available</span>
                  </div>
                ) : (
                  categoryData.map((cat, idx) => {
                    const maxStock = Math.max(...categoryData.map((c) => c.stock));
                    const percentage = maxStock > 0 ? (cat.stock / maxStock) * 100 : 0;
                    return (
                      <div key={idx} className="space-y-1">
                        <div className="flex justify-between items-center text-xs">
                          <span className="font-semibold text-slate-700 dark:text-slate-300">
                            {cat.name}
                          </span>
                          <span className="font-bold text-slate-900 dark:text-white">
                            {cat.stock.toLocaleString('en-IN')} units
                          </span>
                        </div>
                        <div className="w-full h-2 bg-slate-100 dark:bg-slate-800/80 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-slate-950 dark:bg-white rounded-full transition-all duration-500"
                            style={{ width: `${percentage}%` }}
                          />
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            {/* Stock Health Donut */}
            <div className="bg-white dark:bg-[#1e293b] border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm space-y-4 flex flex-col justify-between">
              <div>
                <h3 className="text-sm font-bold text-slate-800 dark:text-white leading-tight">
                  Stock Health & Proportions
                </h3>
                <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5">
                  Visual breakdown of warehouse storage availability status.
                </p>
              </div>
              {totalStockForDonut === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-slate-400 gap-1.5">
                  <Inbox className="w-6 h-6 stroke-1" />
                  <span className="text-xs">No active stock to analyze</span>
                </div>
              ) : (
                <div className="flex flex-col sm:flex-row items-center justify-around gap-6 pt-2">
                  {/* SVG Donut Ring */}
                  <div className="relative w-36 h-36 flex items-center justify-center">
                    <svg className="w-full h-full -rotate-90" viewBox="0 0 36 36">
                      {/* Grey placeholder background */}
                      <circle cx="18" cy="18" r="15.915" fill="none" stroke="#e2e8f0" className="dark:stroke-slate-800" strokeWidth="2.5" />
                      
                      {/* Available Segment */}
                      <circle
                        cx="18"
                        cy="18"
                        r="15.915"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="3.2"
                        strokeDasharray={`${availablePct} ${100 - availablePct}`}
                        strokeDashoffset="0"
                        className="transition-all duration-300 text-slate-955 dark:text-white"
                      />
                      {/* Reserved Segment */}
                      <circle
                        cx="18"
                        cy="18"
                        r="15.915"
                        fill="none"
                        stroke="#64748b"
                        strokeWidth="3.2"
                        strokeDasharray={`${reservedPct} ${100 - reservedPct}`}
                        strokeDashoffset={-availablePct}
                        className="transition-all duration-300"
                      />
                      {/* Other Segment */}
                      <circle
                        cx="18"
                        cy="18"
                        r="15.915"
                        fill="none"
                        stroke="#cbd5e1"
                        strokeWidth="3.2"
                        strokeDasharray={`${otherPct} ${100 - otherPct}`}
                        strokeDashoffset={-(availablePct + reservedPct)}
                        className="transition-all duration-300 dark:stroke-slate-700"
                      />
                    </svg>
                    <div className="absolute flex flex-col items-center justify-center text-center">
                      <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">
                        Total
                      </span>
                      <span className="text-lg font-black text-slate-800 dark:text-white leading-none mt-0.5">
                        {totalStockForDonut.toLocaleString('en-IN')}
                      </span>
                    </div>
                  </div>

                  {/* Legends */}
                  <div className="space-y-3">
                    <div className="flex items-center gap-2 text-xs">
                      <span className="w-3 h-3 rounded-full bg-slate-950 dark:bg-white border" />
                      <div className="flex flex-col">
                        <span className="font-semibold text-slate-700 dark:text-slate-300">
                          Available ({availablePct.toFixed(0)}%)
                        </span>
                        <span className="text-[10px] text-slate-400 dark:text-slate-500 font-bold">
                          {stats?.available.toLocaleString('en-IN')} units
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 text-xs">
                      <span className="w-3 h-3 rounded-full bg-slate-500" />
                      <div className="flex flex-col">
                        <span className="font-semibold text-slate-700 dark:text-slate-300">
                          Reserved ({reservedPct.toFixed(0)}%)
                        </span>
                        <span className="text-[10px] text-slate-400 dark:text-slate-500 font-bold">
                          {stats?.reserved.toLocaleString('en-IN')} units
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 text-xs">
                      <span className="w-3 h-3 rounded-full bg-slate-200 dark:bg-slate-750 border dark:border-slate-800" />
                      <div className="flex flex-col">
                        <span className="font-semibold text-slate-700 dark:text-slate-300">
                          Other buckets ({otherPct.toFixed(0)}%)
                        </span>
                        <span className="text-[10px] text-slate-400 dark:text-slate-500 font-bold">
                          {(totalStockForDonut - (stats?.available + stats?.reserved)).toLocaleString('en-IN')} units
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Row 5: Action logs and tables */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Low stock table */}
            <div className="bg-white dark:bg-[#1e293b] border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-slate-800 dark:text-white leading-tight">
                    Low Stock Alerts
                  </h3>
                  <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5">
                    Products currently close to or below safety stock.
                  </p>
                </div>
                <Link
                  href="/warehouse/inventory?filter=low_stock"
                  className="text-[10px] font-bold text-slate-900 dark:text-white hover:underline uppercase tracking-wider"
                >
                  View All
                </Link>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left text-slate-500">
                  <thead className="text-[10px] text-slate-400 uppercase bg-slate-50 dark:bg-slate-900 border-b border-slate-100 dark:border-slate-800">
                    <tr>
                      <th className="px-3 py-2">SKU</th>
                      <th className="px-3 py-2">Product</th>
                      <th className="px-3 py-2 text-center">Available</th>
                      <th className="px-3 py-2 text-center">Limit</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80">
                    {lowStock.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="px-3 py-8 text-center text-slate-400 font-semibold text-[11px]">
                          No low stock alerts. Stock health looks good!
                        </td>
                      </tr>
                    ) : (
                      lowStock.map((item, idx) => {
                        const threshold = item.variant?.low_stock_threshold ?? 10;
                        const isOut = item.available === 0;
                        return (
                          <tr key={idx} className="hover:bg-slate-50 dark:hover:bg-slate-900/30">
                            <td className="px-3 py-2.5 font-mono">
                              <SkuTag sku={item.variant?.sku || 'N/A'} copyable={false} size="sm" />
                            </td>
                            <td className="px-3 py-2.5">
                              <div className="flex flex-col">
                                <span className="font-semibold text-slate-700 dark:text-slate-300 truncate max-w-[140px]">
                                  {item.variant?.product?.product_name || 'Unknown'}
                                </span>
                                <span className="text-[10px] text-slate-400">
                                  Size: {item.variant?.size?.label || 'N/A'}
                                </span>
                              </div>
                            </td>
                            <td className="px-3 py-2.5 text-center">
                              <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                isOut
                                  ? 'bg-rose-50 text-rose-600 dark:bg-rose-950/20 dark:text-rose-400'
                                  : 'bg-amber-50 text-amber-600 dark:bg-amber-950/20 dark:text-amber-400'
                              }`}>
                                {item.available ?? 0}
                              </span>
                            </td>
                            <td className="px-3 py-2.5 text-center font-semibold text-slate-700 dark:text-slate-300">
                              {threshold}
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Recent movements */}
            <div className="bg-white dark:bg-[#1e293b] border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-slate-800 dark:text-white leading-tight">
                    Recent Stock Movements
                  </h3>
                  <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5">
                    Latest inserts into the append-only stock movement ledger.
                  </p>
                </div>
                <Link
                  href="/warehouse/ledger"
                  className="text-[10px] font-bold text-slate-900 dark:text-white hover:underline uppercase tracking-wider"
                >
                  View Ledger
                </Link>
              </div>

              <div className="flow-root">
                <ul className="divide-y divide-slate-100 dark:divide-slate-800/80 -my-2.5">
                  {recentMovements.length === 0 ? (
                    <li className="py-8 text-center text-slate-400 font-semibold text-[11px]">
                      No movement ledger logs recorded yet.
                    </li>
                  ) : (
                    recentMovements.map((mov, idx) => (
                      <li key={idx} className="py-2.5 flex items-center justify-between text-xs gap-3">
                        <div className="flex flex-col min-w-0">
                          <span className="font-semibold text-slate-700 dark:text-slate-300 truncate">
                            {mov.variant?.product?.product_name || 'Stock Item'}
                          </span>
                          <div className="flex items-center gap-1.5 text-[10px] text-slate-400 mt-0.5 font-semibold">
                            <span className="font-mono">{mov.variant?.sku}</span>
                            <span>•</span>
                            <span>{relativeTime(mov.performed_at)}</span>
                          </div>
                        </div>
                        <div className="flex items-center gap-3 shrink-0">
                          <StockBadge bucket={mov.movement_type === 'qc_fail' || mov.movement_type === 'damage' ? 'damaged' : 'available'} size="sm" />
                          <span className="font-extrabold text-slate-800 dark:text-white">
                            {mov.quantity} pcs
                          </span>
                        </div>
                      </li>
                    ))
                  )}
                </ul>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
