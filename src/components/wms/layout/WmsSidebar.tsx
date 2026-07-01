'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import { AnimatePresence, motion } from 'framer-motion';
import {
  ArrowLeft,
  BarChart3,
  Boxes,
  BookOpen,
  ChevronDown,
  ClipboardCheck,
  Database,
  Factory,
  Globe,
  LayoutDashboard,
  Package,
  PackageCheck,
  PackageX,
  QrCode,
  RotateCcw,
  Settings,
  ShoppingCart,
  Warehouse,
} from 'lucide-react';

// ─── Nav Config ───────────────────────────────────────────────────────────────

interface NavItem {
  label: string;
  href: string;
  icon: React.ReactNode;
  children?: { label: string; href: string }[];
}

interface NavSection {
  section: string;
  items: NavItem[];
}

const NAV: NavSection[] = [
  {
    section: 'Overview',
    items: [
      {
        label: 'Dashboard',
        href: '/warehouse',
        icon: <LayoutDashboard size={16} />,
      },
    ],
  },
  {
    section: 'Master Data',
    items: [
      {
        label: 'Master Data',
        href: '/warehouse/master',
        icon: <Database size={16} />,
        children: [
          { label: 'Categories', href: '/warehouse/master?tab=categories' },
          { label: 'Sizes', href: '/warehouse/master?tab=sizes' },
          { label: 'Colors', href: '/warehouse/master?tab=colors' },
          { label: 'Fabrics', href: '/warehouse/master?tab=fabrics' },
          { label: 'Warehouses', href: '/warehouse/master?tab=warehouses' },
          { label: 'Suppliers', href: '/warehouse/master?tab=suppliers' },
          { label: 'Channels', href: '/warehouse/master?tab=channels' },
        ],
      },
    ],
  },
  {
    section: 'Catalog',
    items: [
      { label: 'Products', href: '/warehouse/products', icon: <Package size={16} /> },
      { label: 'Barcode Center', href: '/warehouse/barcodes', icon: <QrCode size={16} /> },
    ],
  },
  {
    section: 'Inventory',
    items: [
      { label: 'Inventory', href: '/warehouse/inventory', icon: <Boxes size={16} /> },
      { label: 'Stock Ledger', href: '/warehouse/ledger', icon: <BookOpen size={16} /> },
    ],
  },
  {
    section: 'Operations',
    items: [
      { label: 'Inward', href: '/warehouse/inward', icon: <PackageCheck size={16} /> },
      { label: 'Outward', href: '/warehouse/outward', icon: <PackageX size={16} /> },
      { label: 'Returns & QC', href: '/warehouse/returns', icon: <RotateCcw size={16} /> },
      { label: 'Manufacturing', href: '/warehouse/manufacturing', icon: <Factory size={16} /> },
      { label: 'Purchase', href: '/warehouse/purchase', icon: <ShoppingCart size={16} /> },
    ],
  },
  {
    section: 'Audit & Reports',
    items: [
      { label: 'Stock Audit', href: '/warehouse/audit', icon: <ClipboardCheck size={16} /> },
      { label: 'Marketplace', href: '/warehouse/marketplace', icon: <Globe size={16} /> },
      { label: 'Reports', href: '/warehouse/reports', icon: <BarChart3 size={16} /> },
    ],
  },
  {
    section: 'Admin',
    items: [
      { label: 'Settings', href: '/warehouse/settings', icon: <Settings size={16} /> },
    ],
  },
];

// ─── Sidebar inner content ─────────────────────────────────────────────────────

function SidebarContent({ onClose }: { onClose: () => void }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const currentTab = searchParams.get('tab');
  
  const [masterOpen, setMasterOpen] = useState(
    () => pathname.startsWith('/warehouse/master')
  );

  const isActive = (href: string) => {
    if (href === '/warehouse') return pathname === '/warehouse';
    return pathname.startsWith(href);
  };

  const isChildActive = (href: string) => {
    const url = new URL(href, 'http://localhost');
    const tab = url.searchParams.get('tab');
    return pathname.startsWith('/warehouse/master') && currentTab === tab;
  };

  return (
    <div className="flex flex-col h-full w-64 bg-[#0f172a] select-none">
      {/* Logo */}
      <div className="px-4 pt-5 pb-3 border-b border-[#1e293b]">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-white flex items-center justify-center flex-shrink-0 shadow-lg">
            <Warehouse size={18} className="text-black" />
          </div>
          <div className="min-w-0">
            <p className="text-white text-sm font-bold leading-tight tracking-tight truncate">
              KiddieKa WMS
            </p>
            <p className="text-slate-400 text-[10px] font-medium tracking-wide truncate">
              BizTrackData
            </p>
          </div>
        </div>
 
        {/* Back link */}
        <Link
          href="/"
          onClick={onClose}
          className="mt-3 flex items-center gap-1.5 text-slate-400 hover:text-white text-xs transition-colors group"
        >
          <ArrowLeft size={12} className="group-hover:-translate-x-0.5 transition-transform" />
          Back to BizTrack
        </Link>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto py-2 px-2 space-y-0.5 scrollbar-hide">
        {NAV.map(({ section, items }) => (
          <div key={section}>
            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500 px-3 pt-5 pb-1.5">
              {section}
            </p>

            {items.map((item) => {
              const active = isActive(item.href);

              if (item.children) {
                return (
                  <div key={item.href}>
                    <button
                      onClick={() => setMasterOpen((o) => !o)}
                      className={`w-full flex items-center gap-2.5 px-3 py-2 text-sm font-medium transition-all rounded-lg ${
                        active
                          ? 'bg-slate-800 text-white font-bold'
                          : 'text-slate-400 hover:bg-[#1e293b] hover:text-white'
                      }`}
                    >
                      <span className="flex-shrink-0">{item.icon}</span>
                      <span className="flex-1 text-left">{item.label}</span>
                      <motion.span
                        animate={{ rotate: masterOpen ? 180 : 0 }}
                        transition={{ duration: 0.2 }}
                        className="flex-shrink-0"
                      >
                        <ChevronDown size={14} />
                      </motion.span>
                    </button>

                    <AnimatePresence initial={false}>
                      {masterOpen && (
                        <motion.div
                          key="master-sub"
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.22, ease: 'easeInOut' }}
                          className="overflow-hidden"
                        >
                          <div className="ml-5 mt-0.5 border-l border-[#334155] pl-3 space-y-0.5 pb-1">
                            {item.children.map((child) => {
                              const childActive = isChildActive(child.href);
                              return (
                                <Link
                                  key={child.href}
                                  href={child.href}
                                  onClick={onClose}
                                  className={`block px-2 py-1.5 text-xs font-semibold rounded-md transition-all ${
                                    childActive
                                      ? 'bg-white text-black font-extrabold shadow-sm'
                                      : 'text-slate-400 hover:text-white hover:bg-[#1e293b]'
                                  }`}
                                >
                                  {child.label}
                                </Link>
                              );
                            })}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                );
              }

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={onClose}
                  className={`flex items-center gap-2.5 px-3 py-2 text-sm font-medium transition-all rounded-lg ${
                    active
                      ? 'bg-white text-slate-950 font-extrabold shadow-sm'
                      : 'text-slate-400 hover:bg-[#1e293b] hover:text-white'
                  }`}
                >
                  <span className="flex-shrink-0">{item.icon}</span>
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </div>
        ))}
      </nav>

      {/* Footer version chip */}
      <div className="px-4 py-4 border-t border-[#1e293b]">
        <span className="inline-flex items-center px-2.5 py-1 rounded-full bg-slate-800 text-slate-400 text-[10px] font-semibold tracking-wide">
          WMS v1.0
        </span>
      </div>
    </div>
  );
}


// ─── Main export ──────────────────────────────────────────────────────────────

interface WmsSidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

export function WmsSidebar({ isOpen, onClose }: WmsSidebarProps) {
  return (
    <>
      {/* Desktop sidebar — always visible on lg+ */}
      <aside className="hidden lg:flex flex-shrink-0">
        <SidebarContent onClose={() => {}} />
      </aside>

      {/* Mobile overlay sidebar */}
      <AnimatePresence>
        {isOpen && (
          <>
            {/* Backdrop */}
            <motion.div
              key="backdrop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              onClick={onClose}
              className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm lg:hidden"
            />

            {/* Drawer */}
            <motion.aside
              key="drawer"
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ duration: 0.25, ease: 'easeInOut' }}
              className="fixed inset-y-0 left-0 z-50 lg:hidden"
            >
              <SidebarContent onClose={onClose} />
            </motion.aside>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
