"use client";

import React, { useRef, useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  LayoutDashboard,
  ShoppingCart,
  Truck,
  Users,
  FileText,
  Landmark,
  BarChart3,
  Menu,
  Calendar,
  ScanLine,
  Receipt,
  Globe,
  Boxes,
  LockKeyhole,
  Package,
  Stamp,
  GitBranch,
  TrendingUp,
  ChevronDown,
  LayoutGrid,
  Wallet,
} from "lucide-react";
import { gsap } from "gsap";
import { useGSAP } from "@gsap/react";

const NAV_ITEMS = [
  { name: "Dashboard",     href: "/",             icon: LayoutDashboard, mobileName: "Home" },
  { name: "Manufacturers", href: "/manufacturers", icon: Users,           mobileName: "Mfg" },
  { name: "Purchases",     href: "/purchases",     icon: FileText,        mobileName: "Purchases" },
  { name: "E-commerce",    href: "/ecom",          icon: ShoppingCart,    mobileName: "E-com" },
  {
    name: "Platforms",
    href: "/platforms",
    icon: LayoutGrid,
    mobileName: "Platforms",
    subItems: [
      { name: "Meesho", href: "/meesho" },
      { name: "Flipkart", href: "/flipkart" },
      { name: "Amazon", href: "/amazon" }
    ]
  },

  { name: "Wholesale",     href: "/wholesale",     icon: Truck,           mobileName: "Wholesale" },
  { name: "Expenses",      href: "/expenses",      icon: Receipt,         mobileName: "Expenses" },
  { name: "P&L",           href: "/pl",            icon: BarChart3,       mobileName: "P&L" },
  { name: "Finance",       href: "/finance",       icon: Wallet,          mobileName: "Finance" },
  { name: "Stock Inventory", href: "/inventory",   icon: Package,         mobileName: "Stock" },
  { name: "My Sites",      href: "/sites",         icon: Globe,           mobileName: "Sites" },
  { name: "Catalog",       href: "/catalog",       icon: Boxes,           mobileName: "Catalog" },
  { name: "Branding",      href: "/branding",      icon: Stamp,           mobileName: "Branding" },
  { name: "Roadmap",       href: "/roadmap",       icon: GitBranch,       mobileName: "Roadmap" },
  { name: "Vault",         href: "/vault",         icon: LockKeyhole,     mobileName: "Vault" },
];

/* Section labels keyed by the index of the first item in each group. */
const SECTION_AT: Record<number, string> = {
  0: "Overview",
  1: "Operations",
  9: "Finance",
  12: "Inventory",
  13: "Tools",
};

/* ─── Desktop Sidebar ──────────────────────────────────────────────────────── */
export function Sidebar({
  isMobileOpen,
  setMobileOpen,
}: {
  isMobileOpen: boolean;
  setMobileOpen: (v: boolean) => void;
}) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const sidebarRef = useRef<HTMLElement>(null);
  const [dateStr, setDateStr] = useState("");
  const [dayName, setDayName] = useState("");
  const [expandedMenus, setExpandedMenus] = useState<Record<string, boolean>>({
    Platforms: true
  });

  const toggleMenu = (name: string) => {
    setExpandedMenus(prev => ({ ...prev, [name]: !prev[name] }));
  };

  useEffect(() => {
    const updateDateTime = () => {
      const now = new Date();
      setDateStr(now.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }));
      setDayName(now.toLocaleDateString("en-IN", { weekday: "long" }));
    };
    updateDateTime();
    const now = new Date();
    const tomorrow = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
    const msUntilMidnight = tomorrow.getTime() - now.getTime();
    const timeoutId = setTimeout(() => {
      updateDateTime();
      const intervalId = setInterval(updateDateTime, 24 * 60 * 60 * 1000);
      return () => clearInterval(intervalId);
    }, msUntilMidnight);
    return () => clearTimeout(timeoutId);
  }, []);

  useGSAP(
    () => {
      if (!sidebarRef.current) return;
      if (collapsed) {
        gsap.to(sidebarRef.current, { width: 72, duration: 0.3, ease: "power2.out" });
        gsap.to(".nav-label, .nav-title", { opacity: 0, display: "none", duration: 0.15 });
      } else {
        gsap.to(sidebarRef.current, { width: 256, duration: 0.3, ease: "power2.out" });
        gsap.to(".nav-label, .nav-title", { opacity: 1, display: "block", duration: 0.2, delay: 0.1 });
      }
    },
    [collapsed]
  );

  return (
    <>
      {/* Desktop sidebar — completely hidden on mobile */}
      <aside
        ref={sidebarRef}
        className="hidden lg:flex fixed inset-y-0 left-0 z-50 flex-col bg-white border-r border-[#e8e8e8] lg:static lg:h-screen w-64 shrink-0"
        aria-label="Main navigation"
      >
        {/* Logo */}
        <div className="flex items-center justify-between h-16 px-5 border-b border-[#e8e8e8]">
          <Link href="/" className="flex items-center gap-3 overflow-hidden">
            <div className="w-9 h-9 bg-black text-white flex items-center justify-center font-bold rounded-xl text-sm shrink-0 shadow-[0_2px_8px_rgba(0,0,0,0.15)]">
              B
            </div>
            <span className="nav-title font-bold text-[1.1rem] tracking-tight whitespace-nowrap">BizTrack</span>
          </Link>
          <button
            className="flex w-8 h-8 items-center justify-center rounded-lg hover:bg-[#f5f5f5] transition-colors shrink-0 focus:outline-none focus:ring-2 focus:ring-gray-400"
            onClick={() => setCollapsed(!collapsed)}
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            <Menu size={16} className="text-[#888]" />
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto py-3 px-3 overflow-x-hidden" aria-label="Primary">
          <div className="space-y-0.5">
            {NAV_ITEMS.map((item, index) => {
              const isActive = pathname === item.href;
              const section = SECTION_AT[index];
              const hasSubItems = 'subItems' in item && item.subItems;

              return (
                <React.Fragment key={item.name}>
                  {section && (
                    <div className="nav-label px-3 pt-4 pb-1.5 text-[10px] font-bold uppercase tracking-[0.12em] text-[#aaa] first:pt-1">
                      {section}
                    </div>
                  )}

                  {hasSubItems ? (
                    <>
                      <button
                        onClick={() => toggleMenu(item.name)}
                        className="w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-[#666] hover:bg-[#f5f5f5] hover:text-black transition-all duration-200 group focus:outline-none focus:ring-2 focus:ring-gray-400"
                      >
                        <div className="flex items-center gap-3">
                          <item.icon
                            size={18}
                            className="shrink-0 text-[#888] group-hover:text-black transition-colors"
                          />
                          <span className="nav-label whitespace-nowrap font-medium text-[0.8125rem]">{item.name}</span>
                        </div>
                        <motion.div
                          animate={{ rotate: expandedMenus[item.name] ? 180 : 0 }}
                          transition={{ duration: 0.2 }}
                          className="nav-label text-[#888]"
                        >
                          <ChevronDown size={14} />
                        </motion.div>
                      </button>

                      <AnimatePresence initial={false}>
                        {expandedMenus[item.name] && !collapsed && (
                          <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: "auto", opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            transition={{ duration: 0.25, ease: "easeInOut" }}
                            style={{ overflow: "hidden" }}
                            className="mt-1 ml-4 pl-3 border-l border-[#e8e8e8] space-y-0.5 nav-label"
                          >
                            {item.subItems.map((sub) => {
                              const isSubActive = pathname === sub.href;
                              return (
                                <Link
                                  key={sub.name}
                                  href={sub.href}
                                  className={`flex items-center gap-3 px-3 py-2 rounded-lg transition-all duration-200 focus:outline-none ${
                                    isSubActive
                                      ? "bg-black text-white shadow-sm"
                                      : "text-[#666] hover:bg-[#f5f5f5] hover:text-black"
                                  }`}
                                >
                                  <span className="whitespace-nowrap font-medium text-[0.75rem]">{sub.name}</span>
                                </Link>
                              );
                            })}
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </>
                  ) : (
                    <Link
                      href={item.href}
                      className={`flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200 group focus:outline-none focus:ring-2 focus:ring-offset-2 ${
                        isActive
                          ? "bg-black text-white shadow-[0_2px_8px_rgba(0,0,0,0.12)] focus:ring-black"
                          : "text-[#666] hover:bg-[#f5f5f5] hover:text-black focus:ring-gray-400"
                      }`}
                      aria-current={isActive ? "page" : undefined}
                    >
                      <item.icon
                        size={18}
                        className={`shrink-0 transition-colors ${isActive ? "text-white" : "text-[#888] group-hover:text-black"}`}
                      />
                      <span className="nav-label whitespace-nowrap font-medium text-[0.8125rem]">{item.name}</span>
                    </Link>
                  )}
                </React.Fragment>
              );
            })}
          </div>
        </nav>

        {/* Bottom Date */}
        <div className="px-4 py-4 border-t border-[#e8e8e8]">
          <div className="flex items-center gap-3 overflow-hidden">
            <div className="shrink-0 w-9 h-9 rounded-xl bg-[#f5f5f5] flex items-center justify-center">
              <Calendar size={15} className="text-[#888]" />
            </div>
            <div className="flex flex-col nav-label">
              <span className="text-[11px] text-[#aaa] font-medium uppercase tracking-widest">{dayName}</span>
              <span className="text-sm font-bold tracking-tight">{dateStr}</span>
            </div>
          </div>
        </div>
      </aside>
    </>
  );
}

/* ─── Mobile Bottom Tab Bar ───────────────────────────────────────────────── */
// Only visible on mobile (< lg). Native-app feel — pill indicator + labels.
export function MobileTabBar() {
  const pathname = usePathname();
  // Exclude Platforms item (which is a submenu button, not a direct page link)
  const PRIMARY = NAV_ITEMS.filter(item => !('subItems' in item)).slice(0, 5);
  const EXTRA = NAV_ITEMS.filter(item => !PRIMARY.includes(item));

  return (
    <nav
      className="lg:hidden fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-[#e8e8e8] flex items-stretch"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      aria-label="Mobile navigation"
    >
      {PRIMARY.map((item) => {
        const isActive = pathname === item.href;
        return (
          <Link
            key={item.href}
            href={item.href}
            className="flex-1 flex flex-col items-center justify-center py-2 gap-0.5 transition-colors focus:outline-none"
            aria-current={isActive ? "page" : undefined}
          >
            <div
              className={`flex items-center justify-center w-10 h-6 rounded-full transition-all duration-200 ${
                isActive ? "bg-black" : "bg-transparent"
              }`}
            >
              <item.icon
                size={18}
                className={`transition-colors ${isActive ? "text-white" : "text-[#999]"}`}
              />
            </div>
            <span
              className={`text-[9px] sm:text-[10px] font-semibold tracking-tight transition-colors ${
                isActive ? "text-black" : "text-[#aaa]"
              }`}
            >
              {item.mobileName || item.name}
            </span>
          </Link>
        );
      })}

      <MoreTab extraItems={EXTRA} pathname={pathname} />
    </nav>
  );
}

function MoreTab({ extraItems, pathname }: { extraItems: typeof NAV_ITEMS; pathname: string }) {
  const [open, setOpen] = useState(false);
  const sheetRef = useRef<HTMLDivElement>(null);
  
  // Custom check for active items (checks subItems as well)
  const isExtraActive = extraItems.some((item) => {
    if ('subItems' in item && item.subItems) {
      return item.subItems.some(sub => pathname === sub.href);
    }
    return item.href === pathname;
  });

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent | TouchEvent) => {
      if (sheetRef.current && !sheetRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    document.addEventListener("touchstart", handler);
    return () => {
      document.removeEventListener("mousedown", handler);
      document.removeEventListener("touchstart", handler);
    };
  }, [open]);

  return (
    <>
      {open && (
        <div
          ref={sheetRef}
          className="absolute bottom-full right-0 mb-1 mr-1 bg-white rounded-2xl border border-[#e8e8e8] shadow-[0_8px_32px_rgba(0,0,0,0.12)] p-2 min-w-[180px] z-50 max-h-[70vh] overflow-y-auto"
        >
          {extraItems.map((item) => {
            if ('subItems' in item && item.subItems) {
              return (
                <div key={item.name} className="py-1 border-b border-[#f5f5f5] last:border-0">
                  <div className="px-3 py-1 text-[9px] font-bold uppercase tracking-wider text-[#aaa]">
                    {item.name}
                  </div>
                  {item.subItems.map((sub) => {
                    const isSubActive = pathname === sub.href;
                    return (
                      <Link
                        key={sub.href}
                        href={sub.href}
                        onClick={() => setOpen(false)}
                        className={`flex items-center gap-3 px-3 py-2 rounded-xl transition-all ${
                          isSubActive ? "bg-black text-white shadow-sm" : "text-[#555] hover:bg-[#f5f5f5]"
                        }`}
                      >
                        <span className="text-xs font-semibold pl-2">{sub.name}</span>
                      </Link>
                    );
                  })}
                </div>
              );
            }

            const isActive = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setOpen(false)}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all ${
                  isActive ? "bg-black text-white" : "text-[#555] hover:bg-[#f5f5f5]"
                }`}
              >
                <item.icon size={16} className={isActive ? "text-white" : "text-[#888]"} />
                <span className="text-sm font-semibold">{item.name}</span>
              </Link>
            );
          })}
        </div>
      )}
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex-1 flex flex-col items-center justify-center py-2 gap-0.5 focus:outline-none"
        aria-label="More navigation options"
        aria-expanded={open}
      >
        <div className={`flex items-center justify-center w-10 h-6 rounded-full transition-all duration-200 ${isExtraActive || open ? "bg-black" : "bg-transparent"}`}>
          <Menu size={18} className={isExtraActive || open ? "text-white" : "text-[#999]"} />
        </div>
        <span className={`text-[10px] font-semibold tracking-tight ${isExtraActive || open ? "text-black" : "text-[#aaa]"}`}>More</span>
      </button>
    </>
  );
}
