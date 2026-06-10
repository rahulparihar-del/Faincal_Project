"use client";

import React, { useRef, useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
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
  NotebookPen,
  Boxes,
  LockKeyhole,
  Package,
} from "lucide-react";
import { gsap } from "gsap";
import { useGSAP } from "@gsap/react";

const NAV_ITEMS = [
  { name: "Dashboard",     href: "/",             icon: LayoutDashboard, mobileName: "Home" },
  { name: "Manufacturers", href: "/manufacturers", icon: Users,           mobileName: "Mfg" },
  { name: "Purchases",     href: "/purchases",     icon: FileText,        mobileName: "Purchases" },
  { name: "E-commerce",    href: "/ecom",          icon: ShoppingCart,    mobileName: "E-com" },
  { name: "Meesho Orders", href: "/meesho",        icon: ScanLine,        mobileName: "Meesho" },
  { name: "Wholesale",     href: "/wholesale",     icon: Truck,           mobileName: "Wholesale" },
  { name: "Expenses",      href: "/expenses",      icon: Receipt,         mobileName: "Expenses" },
  { name: "P&L",           href: "/pl",            icon: BarChart3,       mobileName: "P&L" },
  { name: "Stock Inventory", href: "/inventory",   icon: Package,         mobileName: "Stock" },
  { name: "My Sites",      href: "/sites",         icon: Globe,           mobileName: "Sites" },
  { name: "Catalog",       href: "/catalog",       icon: Boxes,           mobileName: "Catalog" },
  { name: "Notes",         href: "/notes",         icon: NotebookPen,     mobileName: "Notes" },
  { name: "Vault",         href: "/vault",         icon: LockKeyhole,     mobileName: "Vault" },
];

/* Section labels keyed by the index of the first item in each group. */
const SECTION_AT: Record<number, string> = {
  0: "Overview",
  1: "Operations",
  6: "Finance",
  8: "Inventory",
  9: "Tools",
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
              return (
                <React.Fragment key={item.name}>
                  {section && (
                    <div className="nav-label px-3 pt-4 pb-1.5 text-[10px] font-bold uppercase tracking-[0.12em] text-[#aaa] first:pt-1">
                      {section}
                    </div>
                  )}
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
  // Show: Dashboard, E-commerce, Meesho Orders, Wholesale, Purchases
  const PRIMARY = NAV_ITEMS.slice(0, 5);

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

      {/* "More" tab for Manufacturers (item 6) */}
      <MoreTab extraItems={NAV_ITEMS.slice(5)} pathname={pathname} />
    </nav>
  );
}

function MoreTab({ extraItems, pathname }: { extraItems: typeof NAV_ITEMS; pathname: string }) {
  const [open, setOpen] = useState(false);
  const sheetRef = useRef<HTMLDivElement>(null);
  const isExtraActive = extraItems.some((i) => i.href === pathname);

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
          className="absolute bottom-full right-0 mb-1 mr-1 bg-white rounded-2xl border border-[#e8e8e8] shadow-[0_8px_32px_rgba(0,0,0,0.12)] p-2 min-w-[180px] z-50"
        >
          {extraItems.map((item) => {
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
