"use client";

import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Package, AlertTriangle, X, CheckCircle, Upload, RotateCcw, Store, LayoutDashboard } from "lucide-react";
import { useTheme } from "@/context/ThemeContext";
import { useSupabaseTable } from "@/lib/hooks/useSupabaseTable";
import OverviewTab from "@/components/meesho/OverviewTab";
import OrdersTab from "@/components/meesho/OrdersTab";
import ReturnsTab from "@/components/meesho/ReturnsTab";
import { useMeeshoOrders } from "@/lib/hooks/useMeeshoOrders";
import { AnimatedCounter } from "@/components/ui/AnimatedCounter";


interface MeeshoManualOrder {
  id: string;
  image: string;
  productName: string;
  orderId: string;
  subOrderNo: string;
  sku: string;
  catalogId: string;
  qty: number;
  size: string;
  orderDate: string;
  slaStatus: "Normal" | "Breaching Soon" | "Breached";
  // Raw Excel headers extracted
  reasonForCreditEntry: string;
  orderSource: string;
  customerState: string;
  supplierListedPrice: number;
  supplierDiscountedPrice: number;
  packetId: string;
}

const DEFAULT_ORDERS: MeeshoManualOrder[] = [];


interface MeeshoReturn {
  id: string;
  sNo: string;
  productName: string;
  sku: string;
  variation: string;
  meeshoPid: string;
  category: string;
  qty: number;
  orderNumber: string;
  suborderNumber: string;
  dispatchDate: string;
  returnCreatedDate: string;
  typeOfReturn: string;
  subType: string;
  expectedDeliveryDate: string;
  courierPartner: string;
  awbNumber: string;
  status: string;
  attempt: string;
  trackingLink: string;
  returnPriceType: string;
  returnReason: string;
  detailedReturnReason: string;
  deliveredDate?: string;
  proofOfDelivery?: string;
  otpVerifiedAt?: string;
}

const DEFAULT_RETURNS: MeeshoReturn[] = [];



// Parses dates like "24/06/26", "24/06/2026", "2026-07-14" → "14 Jul 2026"
function formatReturnDate(raw: string): string {
  if (!raw || raw === "NA" || raw === "null" || raw === "") return raw;
  let d: Date | null = null;
  // Try DD/MM/YY or DD/MM/YYYY
  const dmy = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
  if (dmy) {
    let year = parseInt(dmy[3]);
    if (year < 100) year += 2000;
    d = new Date(year, parseInt(dmy[2]) - 1, parseInt(dmy[1]));
  } else {
    // Try ISO "2026-07-14"
    const iso = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (iso) d = new Date(parseInt(iso[1]), parseInt(iso[2]) - 1, parseInt(iso[3]));
  }
  if (!d || isNaN(d.getTime())) return raw;
  return d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

// Returns a human-friendly duration string between two raw date strings
function calcDuration(from: string, to: string): string {
  const parseRaw = (raw: string): Date | null => {
    const dmy = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
    if (dmy) {
      let year = parseInt(dmy[3]);
      if (year < 100) year += 2000;
      return new Date(year, parseInt(dmy[2]) - 1, parseInt(dmy[1]));
    }
    const iso = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (iso) return new Date(parseInt(iso[1]), parseInt(iso[2]) - 1, parseInt(iso[3]));
    return null;
  };
  const d1 = parseRaw(from);
  const d2 = parseRaw(to);
  if (!d1 || !d2 || isNaN(d1.getTime()) || isNaN(d2.getTime())) return "";
  const diffMs = d2.getTime() - d1.getTime();
  const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));
  if (diffDays < 0) return `${Math.abs(diffDays)} days overdue`;
  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "1 day";
  if (diffDays < 7) return `${diffDays} days`;
  if (diffDays < 14) return "1 week";
  if (diffDays < 30) return `${Math.round(diffDays / 7)} weeks`;
  if (diffDays < 60) return "~1 month";
  return `~${Math.round(diffDays / 30)} months`;
}

function isSameOrder(a: MeeshoManualOrder, b: MeeshoManualOrder): boolean {
  return (
    a.subOrderNo === b.subOrderNo &&
    a.productName === b.productName &&
    a.orderId === b.orderId &&
    a.sku === b.sku &&
    a.catalogId === b.catalogId &&
    a.qty === b.qty &&
    a.size === b.size &&
    a.orderDate === b.orderDate &&
    a.reasonForCreditEntry === b.reasonForCreditEntry &&
    a.orderSource === b.orderSource &&
    a.customerState === b.customerState &&
    a.supplierListedPrice === b.supplierListedPrice &&
    a.supplierDiscountedPrice === b.supplierDiscountedPrice &&
    a.packetId === b.packetId
  );
}

function isSameReturn(a: MeeshoReturn, b: MeeshoReturn): boolean {
  return (
    a.sNo === b.sNo &&
    a.productName === b.productName &&
    a.sku === b.sku &&
    a.variation === b.variation &&
    a.meeshoPid === b.meeshoPid &&
    a.category === b.category &&
    a.qty === b.qty &&
    a.orderNumber === b.orderNumber &&
    a.suborderNumber === b.suborderNumber &&
    a.dispatchDate === b.dispatchDate &&
    a.returnCreatedDate === b.returnCreatedDate &&
    a.typeOfReturn === b.typeOfReturn &&
    a.subType === b.subType &&
    a.expectedDeliveryDate === b.expectedDeliveryDate &&
    a.courierPartner === b.courierPartner &&
    a.awbNumber === b.awbNumber &&
    a.status === b.status &&
    a.attempt === b.attempt &&
    a.trackingLink === b.trackingLink &&
    a.returnPriceType === b.returnPriceType &&
    a.returnReason === b.returnReason &&
    a.detailedReturnReason === b.detailedReturnReason &&
    a.deliveredDate === b.deliveredDate &&
    a.proofOfDelivery === b.proofOfDelivery &&
    a.otpVerifiedAt === b.otpVerifiedAt
  );
}

export default function MeeshoPage() {
  const { theme } = useTheme();
  const isDark = theme === "dark";
  const [activeTab, setActiveTab] = useState<"overview" | "dispatch" | "return">("overview");

  // Fetch orders and returns count for the header badges
  const [orders] = useMeeshoOrders();
  const [returnsList] = useSupabaseTable<any>(
    "meesho_returns",
    "biztrack_meesho_returns",
    []
  );

  return (
    <div style={{ padding: "24px 30px", background: isDark ? "#09090b" : "#fcfcfc", minHeight: "100vh", transition: "background 0.2s" }}>
      {/* ── Command Bar ── */}
      <motion.div
        initial={{ opacity: 0, y: -16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: "easeOut" }}
        style={{
          position: "relative",
          borderRadius: 22,
          padding: "22px 26px",
          marginBottom: 16,
          background: isDark
            ? "linear-gradient(115deg, #0a0a0b 0%, #131316 55%, #1c1c21 100%)"
            : "linear-gradient(115deg, #000000 0%, #141414 55%, #262626 100%)",
          border: isDark ? "1px solid #27272a" : "1px solid #000",
          overflow: "hidden",
          boxShadow: "0 8px 32px rgba(0,0,0,0.25)",
        }}
      >
        <div
          style={{
            position: "absolute",
            top: -70,
            right: -30,
            width: 260,
            height: 260,
            borderRadius: "50%",
            background: "radial-gradient(circle, rgba(255,255,255,0.09), transparent 70%)",
            pointerEvents: "none",
          }}
        />
        <div
          style={{
            position: "absolute",
            bottom: -90,
            left: "35%",
            width: 220,
            height: 220,
            borderRadius: "50%",
            background: "radial-gradient(circle, rgba(255,255,255,0.05), transparent 70%)",
            pointerEvents: "none",
          }}
        />

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", position: "relative", zIndex: 1, flexWrap: "wrap", gap: 16 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <div style={{
              width: 52,
              height: 52,
              borderRadius: 16,
              background: "rgba(255, 255, 255, 0.08)",
              border: "1px solid rgba(255, 255, 255, 0.15)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}>
              <Store size={22} color="#fff" />
            </div>
            <div>
              <h1 style={{ fontSize: 20, fontWeight: 900, color: "#ffffff", margin: 0, letterSpacing: "-0.02em" }}>
                Meesho Hub
              </h1>
              <p style={{ fontSize: 10.5, color: "rgba(255,255,255,0.65)", fontWeight: 700, letterSpacing: "0.04em", textTransform: "uppercase" }}>
                KiddieKa · Supplier Command Center
              </p>
            </div>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            {[
              { label: "dispatch orders", value: orders.length },
              { label: "returns tracked", value: returnsList.length },
            ].map((c, ci) => (
              <motion.div
                key={c.label}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.2 + ci * 0.1, duration: 0.35 }}
                style={{
                  display: "flex",
                  alignItems: "baseline",
                  gap: 6,
                  background: "rgba(255,255,255,0.08)",
                  border: "1px solid rgba(255,255,255,0.16)",
                  borderRadius: 12,
                  padding: "8px 14px",
                  backdropFilter: "blur(4px)",
                }}
              >
                <span style={{ fontSize: 16, fontWeight: 900, color: "#fff", fontVariantNumeric: "tabular-nums" }}>
                  <AnimatedCounter value={c.value} />
                </span>
                <span style={{ fontSize: 10, fontWeight: 700, color: "rgba(255,255,255,0.6)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                  {c.label}
                </span>
              </motion.div>
            ))}
          </div>
        </div>
      </motion.div>

      {/* ── Tab Rail ── */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15, duration: 0.4, ease: "easeOut" }}
        style={{
          display: "inline-flex",
          gap: 4,
          padding: 4,
          borderRadius: 15,
          background: isDark ? "#18181b" : "#f1f5f9",
          border: isDark ? "1px solid #27272a" : "1px solid #e2e8f0",
          marginBottom: 24,
        }}
      >
        {[
          { id: "overview", label: "Overview", icon: LayoutDashboard },
          { id: "dispatch", label: "Forward Dispatch", icon: Package },
          { id: "return", label: "Customer Returns", icon: RotateCcw },
        ].map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                padding: "8px 16px",
                borderRadius: 12,
                fontSize: 12,
                fontWeight: isActive ? 800 : 600,
                background: isActive ? (isDark ? "#ffffff" : "#000000") : "transparent",
                color: isActive ? (isDark ? "#09090b" : "#ffffff") : (isDark ? "#a1a1aa" : "#475569"),
                border: "none",
                cursor: "pointer",
                transition: "all 0.2s",
              }}
            >
              <tab.icon size={14} />
              {tab.label}
            </button>
          );
        })}
      </motion.div>

      {/* ── Tab Panels ── */}
      {/* Overview Tab */}
      {activeTab === "overview" && (
        <motion.div key="overview" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35, ease: "easeOut" }}>
          <OverviewTab />
        </motion.div>
      )}

      {/* Forward Dispatch — Orders */}
      {activeTab === "dispatch" && (
        <motion.div key="dispatch" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35, ease: "easeOut" }}>
          <OrdersTab />
        </motion.div>
      )}

      {/* Customer Returns — Tab */}
      {activeTab === "return" && (
        <motion.div key="return" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35, ease: "easeOut" }}>
          <ReturnsTab />
        </motion.div>
      )}
    </div>
  );
}