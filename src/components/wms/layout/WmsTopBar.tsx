'use client';

import React, { useState } from 'react';
import { usePathname } from 'next/navigation';
import { Bell, Menu, Search, Warehouse, X, AlertTriangle, CheckCircle2, Info } from 'lucide-react';
import { useWms } from '@/context/WmsContext';

// ─── Breadcrumb helper ────────────────────────────────────────────────────────

const SEGMENT_LABELS: Record<string, string> = {
  warehouse: 'Warehouse',
  master: 'Master Data',
  categories: 'Categories',
  sizes: 'Sizes',
  colors: 'Colors',
  fabrics: 'Fabrics',
  warehouses: 'Warehouses',
  suppliers: 'Suppliers',
  channels: 'Channels',
  products: 'Products',
  barcodes: 'Barcode Center',
  inventory: 'Inventory',
  ledger: 'Stock Ledger',
  inward: 'Inward',
  outward: 'Outward',
  returns: 'Returns & QC',
  manufacturing: 'Manufacturing',
  purchase: 'Purchase',
  audit: 'Stock Audit',
  marketplace: 'Marketplace',
  reports: 'Reports',
  settings: 'Settings',
  dashboard: 'Dashboard',
};

function getPageTitle(pathname: string): string {
  const segments = pathname.split('/').filter(Boolean);
  if (segments.length === 1 && segments[0] === 'warehouse') return 'Dashboard';
  const last = segments[segments.length - 1];
  return SEGMENT_LABELS[last] ?? last.charAt(0).toUpperCase() + last.slice(1);
}

// ─── TopBar ───────────────────────────────────────────────────────────────────

interface WmsTopBarProps {
  onMenuClick: () => void;
}

export function WmsTopBar({ onMenuClick }: WmsTopBarProps) {
  const pathname = usePathname();
  const pageTitle = getPageTitle(pathname);

  const { warehouses, selectedWarehouseId } = useWms();
  const selectedWarehouse = warehouses.find((w) => w.id === selectedWarehouseId);
  const warehouseLabel = selectedWarehouse?.name ?? 'Main Warehouse';

  // Notifications State
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [unread, setUnread] = useState(true);
  const [notifications, setNotifications] = useState([
    {
      id: 1,
      title: 'Low Stock Alert',
      message: 'CJ-DEER-03M available stock is down to 2 units (Limit: 10)',
      time: '10m ago',
      type: 'warning',
    },
    {
      id: 2,
      title: 'Inward Receipt Complete',
      message: 'Logged receipt INW-20260701-000001 for 100 units',
      time: '1h ago',
      type: 'info',
    },
    {
      id: 3,
      title: 'Amazon Dispatch Success',
      message: 'Sales dispatch OUT-20260701-000002 has left warehouse',
      time: '3h ago',
      type: 'success',
    },
  ]);

  const handleClearNotifications = () => {
    setNotifications([]);
    setUnread(false);
  };

  const handleOpenDropdown = () => {
    setDropdownOpen(!dropdownOpen);
    if (unread) {
      setUnread(false); // mark as read on open
    }
  };

  return (
    <header className="sticky top-0 z-30 h-16 flex-shrink-0 bg-white/80 dark:bg-[#0f172a]/85 backdrop-blur-md border-b border-slate-200/80 dark:border-slate-800/80 flex items-center justify-between px-6 gap-4">
      {/* Left side: Menu hamburger & Title */}
      <div className="flex items-center gap-4 min-w-0">
        {/* Hamburger — mobile only */}
        <button
          id="wms-mobile-menu-btn"
          onClick={onMenuClick}
          className="lg:hidden flex-shrink-0 p-2 rounded-xl text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-900 transition-colors"
          aria-label="Open menu"
        >
          <Menu size={20} />
        </button>

        {/* Page title / breadcrumb */}
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-[10px] font-bold tracking-wider text-slate-400 uppercase hidden sm:inline">WMS</span>
          <span className="text-slate-300 dark:text-slate-700 hidden sm:inline">/</span>
          <h1 className="text-sm font-extrabold text-slate-850 dark:text-white tracking-tight truncate">
            {pageTitle}
          </h1>
        </div>
      </div>

      {/* Backdrop for click outside */}
      {dropdownOpen && (
        <div 
          className="fixed inset-0 z-40 bg-transparent cursor-default" 
          onClick={() => setDropdownOpen(false)} 
        />
      )}

      {/* Right side controls */}
      <div className="flex items-center gap-4 flex-shrink-0 relative z-50">
        {/* Search — hidden on mobile */}
        <div className="hidden md:flex items-center gap-2 w-72 h-9 bg-slate-50 dark:bg-slate-900 border border-slate-250 dark:border-slate-800 rounded-xl px-3 transition-all focus-within:border-slate-450 dark:focus-within:border-slate-600 focus-within:ring-2 focus-within:ring-slate-950/5 dark:focus-within:ring-white/5">
          <Search size={14} className="text-slate-400 flex-shrink-0" />
          <input
            id="wms-search-input"
            type="text"
            placeholder="Search SKU, barcode..."
            className="flex-1 !bg-transparent !border-none !shadow-none !outline-none !ring-0 !p-0 !m-0 !h-auto text-xs text-slate-800 dark:text-slate-200 placeholder:text-slate-400 dark:placeholder:text-slate-600 min-w-0 font-medium"
            readOnly
          />
        </div>

        {/* Warehouse Selection pill */}
        <div
          id="wms-warehouse-pill"
          className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-50 dark:bg-slate-900 text-slate-800 dark:text-slate-100 text-xs font-bold border border-slate-250 dark:border-slate-800 shadow-sm cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800 transition-all"
        >
          <Warehouse size={13} className="text-slate-500" />
          <span className="truncate max-w-[130px] font-semibold">{warehouseLabel}</span>
        </div>

        {/* Bell relative wrapper */}
        <div className="relative">
          {/* Minimal Bell with ping indicator */}
          <button
            id="wms-notifications-btn"
            onClick={handleOpenDropdown}
            className="relative p-2 rounded-xl text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-900 transition-colors border border-slate-200/50 dark:border-slate-800 flex-shrink-0 cursor-pointer"
            aria-label="Notifications"
          >
            <Bell size={16} />
            {unread && (
              <>
                <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full bg-slate-950 dark:bg-white animate-ping" />
                <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full bg-slate-950 dark:bg-white" />
              </>
            )}
          </button>

          {/* Notifications Dropdown Panel */}
          {dropdownOpen && (
            <div className="absolute right-0 mt-2.5 w-80 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xl p-4 space-y-3 z-50 text-xs text-left animate-fade-in">
              <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-850 pb-2">
                <span className="font-bold text-slate-800 dark:text-white">WMS Signals</span>
                {notifications.length > 0 && (
                  <button 
                    onClick={handleClearNotifications}
                    className="text-[10px] font-bold text-slate-400 hover:text-slate-800 dark:hover:text-white uppercase tracking-wider"
                  >
                    Clear All
                  </button>
                )}
              </div>

              <div className="max-h-64 overflow-y-auto space-y-2.5 pr-0.5">
                {notifications.length === 0 ? (
                  <div className="py-6 text-center text-slate-400 font-medium">
                    No active notifications.
                  </div>
                ) : (
                  notifications.map((n) => (
                    <div key={n.id} className="flex gap-2.5 p-2 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-850/50 transition-colors">
                      <div className="shrink-0 mt-0.5">
                        {n.type === 'warning' && <AlertTriangle className="w-4 h-4 text-amber-500" />}
                        {n.type === 'success' && <CheckCircle2 className="w-4 h-4 text-emerald-500" />}
                        {n.type === 'info' && <Info className="w-4 h-4 text-blue-500" />}
                      </div>
                      <div className="space-y-0.5 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-bold text-slate-850 dark:text-slate-200">{n.title}</span>
                          <span className="text-[9px] text-slate-400 font-bold shrink-0">{n.time}</span>
                        </div>
                        <p className="text-[10px] text-slate-450 dark:text-slate-400 leading-normal font-semibold">
                          {n.message}
                        </p>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>

        {/* User profile dropdown avatar */}
        <div
          id="wms-user-avatar"
          className="flex items-center gap-2 flex-shrink-0 cursor-pointer group bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 px-2.5 py-1.5 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-all"
        >
          <div className="w-6 h-6 rounded-lg bg-slate-950 dark:bg-white flex items-center justify-center text-white dark:text-slate-950 text-[10px] font-black shadow-sm">
            A
          </div>
          <span className="hidden lg:inline text-xs font-bold text-slate-700 dark:text-slate-350 group-hover:text-slate-950 dark:group-hover:text-white transition-colors">
            Admin
          </span>
        </div>
      </div>
    </header>
  );
}
