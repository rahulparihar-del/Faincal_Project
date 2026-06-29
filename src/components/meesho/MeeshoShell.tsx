"use client";

import React, { useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Package,
  RotateCcw,
  CreditCard,
  Megaphone,
  Truck,
  Shield,
  BarChart2,
  DollarSign,
  Users,
  FileText,
  Settings,
  ScanLine,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { gsap } from "gsap";
import { useGSAP } from "@gsap/react";

const SHELL_ITEMS = [
  { name: "Executive Dashboard", href: "/meesho-manage/dashboard", icon: LayoutDashboard },
  { name: "Orders", href: "/meesho-manage/orders", icon: Package },
  { name: "Returns & RTO", href: "/meesho-manage/returns", icon: RotateCcw },
  { name: "Payments", href: "/meesho-manage/payments", icon: CreditCard },
  { name: "Advertisement", href: "/meesho-manage/advertisement", icon: Megaphone },
  { name: "Logistics", href: "/meesho-manage/logistics", icon: Truck },
  { name: "Claims", href: "/meesho-manage/claims", icon: Shield },
  { name: "Product Analytics", href: "/meesho-manage/product-analytics", icon: BarChart2 },
  { name: "Profit Analytics", href: "/meesho-manage/profit-analytics", icon: DollarSign },
  { name: "Customer Returns", href: "/meesho-manage/customer-analytics", icon: Users },
  { name: "Reports", href: "/meesho-manage/reports", icon: FileText },
  { name: "Settings", href: "/meesho-manage/settings", icon: Settings },
];

interface Props {
  children: React.ReactNode;
}

export function MeeshoShell({ children }: Props) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const sidebarRef = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      if (!sidebarRef.current) return;
      if (collapsed) {
        gsap.to(sidebarRef.current, { width: 56, duration: 0.25, ease: "power2.out" });
        gsap.to(".mm-label, .mm-title", { opacity: 0, display: "none", duration: 0.1 });
      } else {
        gsap.to(sidebarRef.current, { width: 220, duration: 0.25, ease: "power2.out" });
        gsap.to(".mm-label, .mm-title", { opacity: 1, display: "flex", duration: 0.15, delay: 0.05 });
      }
    },
    [collapsed]
  );

  return (
    <div style={{ display: "flex", height: "calc(100vh - 64px)", overflow: "hidden", background: "#f5f5f5", margin: "-1.25rem -1.25rem -2rem" }}>
      {/* Mini side navigation */}
      <div
        ref={sidebarRef}
        style={{
          width: 220,
          background: "#ffffff",
          borderRight: "1px solid #e8e8e8",
          display: "flex",
          flexDirection: "column",
          flexShrink: 0,
          position: "relative",
          zIndex: 10,
        }}
      >
        {/* Module Title Header */}
        <div
          style={{
            height: 48,
            padding: "0 16px",
            borderBottom: "1px solid #f0f0f0",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            overflow: "hidden",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div
              style={{
                width: 24,
                height: 24,
                borderRadius: 6,
                background: "linear-gradient(135deg, #ec4899, #7c3aed)",
                color: "#fff",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 10,
                fontWeight: 900,
                flexShrink: 0,
              }}
            >
              M
            </div>
            <span
              className="mm-title"
              style={{
                fontSize: 11,
                fontWeight: 800,
                color: "#1a1a1a",
                textTransform: "uppercase",
                letterSpacing: "0.06em",
                whiteSpace: "nowrap",
              }}
            >
              Meesho Manage
            </span>
          </div>

          <button
            onClick={() => setCollapsed(!collapsed)}
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              color: "#aaa",
              padding: 4,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            {collapsed ? <ChevronRight size={13} /> : <ChevronLeft size={13} />}
          </button>
        </div>

        {/* Nav Items */}
        <div style={{ flex: 1, overflowY: "auto", padding: "8px 8px", display: "flex", flexDirection: "column", gap: 3 }}>
          {SHELL_ITEMS.map((item) => {
            const isActive = pathname === item.href;
            const Icon = item.icon;

            return (
              <Link
                key={item.href}
                href={item.href}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  padding: "8px 10px",
                  borderRadius: 8,
                  background: isActive ? "#7c3aed12" : "transparent",
                  color: isActive ? "#7c3aed" : "#555",
                  textDecoration: "none",
                  transition: "all 0.15s ease",
                  cursor: "pointer",
                }}
                onMouseEnter={(e) => {
                  if (!isActive) {
                    e.currentTarget.style.background = "#f5f5f5";
                    e.currentTarget.style.color = "#1b1b1b";
                  }
                }}
                onMouseLeave={(e) => {
                  if (!isActive) {
                    e.currentTarget.style.background = "transparent";
                    e.currentTarget.style.color = "#555";
                  }
                }}
              >
                <Icon size={15} style={{ flexShrink: 0 }} />
                <span className="mm-label" style={{ fontSize: 11, fontWeight: isActive ? 700 : 600, whiteSpace: "nowrap" }}>
                  {item.name}
                </span>
              </Link>
            );
          })}
        </div>

        {/* Bottom link to Scanner */}
        <div style={{ borderTop: "1px solid #f0f0f0", padding: "8px 8px" }}>
          <Link
            href="/meesho"
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              padding: "8px 10px",
              borderRadius: 8,
              background: "transparent",
              color: "#aaa",
              textDecoration: "none",
              transition: "all 0.15s ease",
              cursor: "pointer",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = "#f5f5f5";
              e.currentTarget.style.color = "#333";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = "transparent";
              e.currentTarget.style.color = "#aaa";
            }}
          >
            <ScanLine size={15} style={{ flexShrink: 0 }} />
            <span className="mm-label" style={{ fontSize: 11, fontWeight: 600, whiteSpace: "nowrap" }}>
              Meesho Scanner
            </span>
          </Link>
        </div>
      </div>

      {/* Right scrollable content panel */}
      <div style={{ flex: 1, overflowY: "auto", padding: "20px 24px" }}>
        {children}
      </div>
    </div>
  );
}
