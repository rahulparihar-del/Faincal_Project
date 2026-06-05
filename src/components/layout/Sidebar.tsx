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
  X,
  Calendar,
} from "lucide-react";
import { gsap } from "gsap";
import { useGSAP } from "@gsap/react";

const NAV_ITEMS = [
  { name: "Dashboard", href: "/", icon: LayoutDashboard },
  { name: "E-commerce Sales", href: "/ecom", icon: ShoppingCart },
  { name: "Wholesale Sales", href: "/wholesale", icon: Truck },
  { name: "Manufacturers", href: "/manufacturers", icon: Users },
  { name: "Purchase Orders", href: "/purchases", icon: FileText },
  { name: "Bank Transactions", href: "/bank", icon: Landmark },
  { name: "P&L Report", href: "/pl", icon: BarChart3 },
];

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
      setDateStr(
        now.toLocaleDateString("en-IN", {
          day: "2-digit",
          month: "short",
          year: "numeric",
        })
      );
      setDayName(now.toLocaleDateString("en-IN", { weekday: "long" }));
    };
    
    updateDateTime();
    
    // Update at midnight
    const now = new Date();
    const tomorrow = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
    const msUntilMidnight = tomorrow.getTime() - now.getTime();
    
    const timeoutId = setTimeout(() => {
      updateDateTime();
      // Then update daily
      const intervalId = setInterval(updateDateTime, 24 * 60 * 60 * 1000);
      return () => clearInterval(intervalId);
    }, msUntilMidnight);
    
    return () => clearTimeout(timeoutId);
  }, []);

  useGSAP(
    () => {
      if (!sidebarRef.current) return;
      if (collapsed) {
        gsap.to(sidebarRef.current, {
          width: 72,
          duration: 0.3,
          ease: "power2.out",
        });
        gsap.to(".nav-label, .nav-title", {
          opacity: 0,
          display: "none",
          duration: 0.15,
        });
      } else {
        gsap.to(sidebarRef.current, {
          width: 256,
          duration: 0.3,
          ease: "power2.out",
        });
        gsap.to(".nav-label, .nav-title", {
          opacity: 1,
          display: "block",
          duration: 0.2,
          delay: 0.1,
        });
      }
    },
    [collapsed]
  );

  return (
    <>
      {isMobileOpen && (
        <div
          className="fixed inset-0 bg-black/30 backdrop-blur-[2px] z-40 lg:hidden"
          onClick={() => setMobileOpen(false)}
          role="button"
          tabIndex={0}
          aria-label="Close navigation menu"
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              setMobileOpen(false);
            }
          }}
        />
      )}
      <aside
        ref={sidebarRef}
        className={`fixed inset-y-0 left-0 z-50 flex flex-col bg-white border-r border-[#e8e8e8] transform transition-transform duration-300 lg:translate-x-0 ${
          isMobileOpen ? "translate-x-0" : "-translate-x-full"
        } lg:static lg:h-screen w-64 shrink-0`}
        aria-label="Main navigation"
      >
        {/* Logo */}
        <div className="flex items-center justify-between h-16 px-5 border-b border-[#e8e8e8]">
          <Link href="/" className="flex items-center gap-3 overflow-hidden">
            <div className="w-9 h-9 bg-black text-white flex items-center justify-center font-bold rounded-xl text-sm shrink-0 shadow-[0_2px_8px_rgba(0,0,0,0.15)]">
              B
            </div>
            <span className="nav-title font-bold text-[1.1rem] tracking-tight whitespace-nowrap">
              BizTrack
            </span>
          </Link>
          <button
            className="hidden lg:flex w-8 h-8 items-center justify-center rounded-lg hover:bg-[#f5f5f5] transition-colors shrink-0 focus:outline-none focus:ring-2 focus:ring-gray-400"
            onClick={() => setCollapsed(!collapsed)}
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            <Menu size={16} className="text-[#888]" />
          </button>
          <button
            className="lg:hidden flex w-8 h-8 items-center justify-center rounded-lg hover:bg-[#f5f5f5] transition-colors shrink-0 focus:outline-none focus:ring-2 focus:ring-gray-400"
            onClick={() => setMobileOpen(false)}
            aria-label="Close navigation menu"
          >
            <X size={16} />
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto py-3 px-3 overflow-x-hidden" aria-label="Primary">
          <div className="space-y-0.5">
            {NAV_ITEMS.map((item) => {
              const isActive = pathname === item.href;
              return (
                <Link
                  key={item.name}
                  href={item.href}
                  onClick={() => setMobileOpen(false)}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200 group focus:outline-none focus:ring-2 focus:ring-offset-2 ${
                    isActive
                      ? "bg-black text-white shadow-[0_2px_8px_rgba(0,0,0,0.12)] focus:ring-black"
                      : "text-[#666] hover:bg-[#f5f5f5] hover:text-black focus:ring-gray-400"
                  }`}
                  aria-current={isActive ? "page" : undefined}
                >
                  <item.icon
                    size={18}
                    className={`shrink-0 transition-colors ${
                      isActive
                        ? "text-white"
                        : "text-[#888] group-hover:text-black"
                    }`}
                  />
                  <span className="nav-label whitespace-nowrap font-medium text-[0.8125rem]">
                    {item.name}
                  </span>
                </Link>
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
              <span className="text-[11px] text-[#aaa] font-medium uppercase tracking-widest">
                {dayName}
              </span>
              <span className="text-sm font-bold tracking-tight">
                {dateStr}
              </span>
            </div>
          </div>
        </div>
      </aside>
    </>
  );
}
