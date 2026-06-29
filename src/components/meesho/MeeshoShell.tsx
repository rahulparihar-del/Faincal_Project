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
  Bell,
  FileSpreadsheet,
  Check,
  AlertTriangle,
  Info,
  X
} from "lucide-react";
import { gsap } from "gsap";
import { useGSAP } from "@gsap/react";
import { useMMData } from "./useMeeshoData";

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
  { name: "Import Center", href: "/meesho-manage/import-center", icon: FileSpreadsheet },
  { name: "Settings", href: "/meesho-manage/settings", icon: Settings },
];

interface Props {
  children: React.ReactNode;
}

export function MeeshoShell({ children }: Props) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const sidebarRef = useRef<HTMLDivElement>(null);

  const { notifications, markAllNotificationsAsRead } = useMMData();
  const unreadCount = notifications.filter(n => !n.read).length;

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
            padding: "0 12px 0 16px",
            borderBottom: "1px solid #f0f0f0",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            overflow: "hidden",
            position: "relative"
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

          <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
            {/* Notification Bell Icon */}
            <div style={{ position: "relative" }}>
              <button
                onClick={() => setShowNotifications(!showNotifications)}
                style={{
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  color: unreadCount > 0 ? "#7c3aed" : "#aaa",
                  padding: 4,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  position: "relative"
                }}
              >
                <Bell size={14} />
                {unreadCount > 0 && (
                  <span
                    style={{
                      position: "absolute",
                      top: 0,
                      right: 0,
                      background: "#ef4444",
                      color: "#fff",
                      borderRadius: "50%",
                      width: 12,
                      height: 12,
                      fontSize: 8,
                      fontWeight: 800,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center"
                    }}
                  >
                    {unreadCount}
                  </span>
                )}
              </button>

              {/* Notification Popover Dropdown */}
              {showNotifications && (
                <div
                  style={{
                    position: "absolute",
                    top: 28,
                    left: 0,
                    width: 280,
                    maxHeight: 350,
                    overflowY: "auto",
                    background: "#ffffff",
                    borderRadius: 12,
                    boxShadow: "0 10px 25px -5px rgba(0,0,0,0.1), 0 8px 10px -6px rgba(0,0,0,0.1)",
                    border: "1px solid #e2e8f0",
                    zIndex: 99,
                    padding: 12
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10, borderBottom: "1px solid #f1f5f9", paddingBottom: 6 }}>
                    <span style={{ fontSize: 11, fontWeight: 800, color: "#1e293b", textTransform: "uppercase" }}>Notifications</span>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      {unreadCount > 0 && (
                        <button
                          onClick={() => {
                            markAllNotificationsAsRead();
                          }}
                          style={{ background: "none", border: "none", color: "#7c3aed", fontSize: 9, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", gap: 2 }}
                        >
                          <Check size={10} /> Mark read
                        </button>
                      )}
                      <button
                        onClick={() => setShowNotifications(false)}
                        style={{ background: "none", border: "none", color: "#94a3b8", cursor: "pointer" }}
                      >
                        <X size={12} />
                      </button>
                    </div>
                  </div>

                  {notifications.length === 0 ? (
                    <div style={{ padding: "16px 0", textAlign: "center", fontSize: 11, color: "#94a3b8" }}>No active alerts</div>
                  ) : (
                    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                      {notifications.map((notif) => (
                        <div
                          key={notif.id}
                          style={{
                            padding: 8,
                            borderRadius: 6,
                            background: notif.read ? "#f8fafc" : "#7c3aed0a",
                            borderLeft: `3px solid ${notif.type === 'critical' ? '#ef4444' : notif.type === 'warning' ? '#f59e0b' : notif.type === 'opportunity' ? '#10b981' : '#3b82f6'}`,
                            fontSize: 10,
                            color: "#334155",
                            position: "relative"
                          }}
                        >
                          <div style={{ display: "flex", gap: 6, alignItems: "flex-start" }}>
                            {notif.type === 'critical' || notif.type === 'warning' ? (
                              <AlertTriangle size={12} style={{ color: notif.type === 'critical' ? '#ef4444' : '#f59e0b', marginTop: 1, flexShrink: 0 }} />
                            ) : (
                              <Info size={12} style={{ color: notif.type === 'opportunity' ? '#10b981' : '#3b82f6', marginTop: 1, flexShrink: 0 }} />
                            )}
                            <div>
                              <div style={{ fontWeight: notif.read ? 500 : 700 }}>{notif.message}</div>
                              <span style={{ fontSize: 8, color: "#94a3b8" }}>{new Date(notif.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
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
