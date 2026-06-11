"use client";

import React from "react";
import { Menu, Sun, Moon, Database, CloudOff, LogOut } from "lucide-react";
import { usePathname } from "next/navigation";
import { useTheme } from "@/context/ThemeContext";
import { useAuth } from "@/context/AuthContext";
import { useSupabaseStatus, type ConnectionStatus } from "@/lib/hooks/useSupabaseStatus";
import { useSupabaseUsage, type UsageInfo, type UsageState } from "@/lib/hooks/useSupabaseUsage";

const TAB_NAMES: Record<string, string> = {
  "/": "Dashboard",
  "/ecom": "E-commerce Sales",
  "/wholesale": "Wholesale Sales",
  "/manufacturers": "Manufacturers",
  "/purchases": "Purchase Orders",
  "/bank": "Bank Transactions",
  "/pl": "P&L Report",
  "/inventory": "Prints Inventory",
  "/sites": "My Sites",
  "/catalog": "Catalog",
  "/branding": "Branding & Packaging",
  "/vault": "Vault",
};

const STATUS_CONFIG: Record<
  ConnectionStatus,
  { dot: string; label: string; title: string; offline?: boolean }
> = {
  connected: {
    dot: "bg-green-500",
    label: "Supabase",
    title: "Connected to Supabase — data is saved to the cloud",
  },
  checking: {
    dot: "bg-amber-400 animate-pulse",
    label: "Connecting",
    title: "Connecting to Supabase…",
  },
  local: {
    dot: "bg-gray-400",
    label: "Local",
    title: "Supabase not configured — using local storage",
    offline: true,
  },
  error: {
    dot: "bg-red-500",
    label: "Offline",
    title: "Supabase unreachable — using local cache",
    offline: true,
  },
};

function ConnectionBadge({ status }: { status: ConnectionStatus }) {
  const cfg = STATUS_CONFIG[status];
  const Icon = cfg.offline ? CloudOff : Database;

  return (
    <div
      className="flex items-center gap-2 h-8 px-2.5 rounded-lg border border-[#e0e0e0] bg-[#fafafa]"
      role="status"
      aria-live="polite"
      aria-label={cfg.title}
      title={cfg.title}
    >
      <Icon size={14} className="text-[#666] shrink-0" />
      <span className="text-xs font-semibold text-[#666] hidden sm:inline">{cfg.label}</span>
      <span className={`w-2 h-2 rounded-full shrink-0 ${cfg.dot}`} aria-hidden="true" />
    </div>
  );
}

function formatSize(bytes: number): string {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function UsageRing({ info, state }: { info: UsageInfo | null; state: UsageState }) {
  if (state === "unavailable") return null;

  const pct = info ? info.percent : 0;
  const size = 26;
  const stroke = 3;
  const r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  const dash = circ * (pct / 100);
  const warn = pct >= 95 ? "#dc2626" : pct >= 80 ? "#d97706" : null;

  const title = info
    ? `Supabase database: ${formatSize(info.usedBytes)} of ${formatSize(info.limitBytes)} used (${pct.toFixed(1)}%)`
    : "Checking Supabase usage…";

  return (
    <div
      className="flex items-center gap-1.5 h-8 px-2 rounded-lg border border-[#e0e0e0] bg-[#fafafa]"
      title={title}
      role="img"
      aria-label={title}
    >
      <svg width={size} height={size} className="-rotate-90 shrink-0">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth={stroke} className="stroke-[#e0e0e0] dark:stroke-[#333]" />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          strokeWidth={stroke}
          strokeLinecap="round"
          stroke={warn ?? "currentColor"}
          className={warn ? "" : "text-black"}
          strokeDasharray={`${dash} ${circ}`}
        />
      </svg>
      <span className="text-[11px] font-bold text-[#666] hidden md:inline">{info ? `${Math.round(pct)}%` : "…"}</span>
    </div>
  );
}

export function TopBar({ setMobileOpen }: { setMobileOpen: (v: boolean) => void }) {
  const pathname = usePathname();
  const title = TAB_NAMES[pathname] || "BizTrack";
  const { theme, toggleTheme } = useTheme();
  const status = useSupabaseStatus();
  const { info: usage, state: usageState } = useSupabaseUsage();
  const { logout } = useAuth();

  return (
    <header className="h-16 bg-white border-b border-[#e0e0e0] flex items-center px-5 lg:px-8 shrink-0 z-30">
      {/* Bottom tab bar handles mobile nav — hamburger not needed on mobile */}
      <h1 className="text-lg font-bold text-black tracking-tight flex-1 min-w-0 truncate mr-2 lg:flex-none lg:truncate-none">{title}</h1>

      <div className="ml-auto flex items-center gap-2 shrink-0">
        {/* Badges visible on desktop; hidden on mobile to avoid crowding the title */}
        <div className="hidden lg:contents">
          <UsageRing info={usage} state={usageState} />
          <ConnectionBadge status={status} />
        </div>
        <button
          onClick={toggleTheme}
          className="w-9 h-9 flex items-center justify-center rounded-lg text-[#666] hover:text-black hover:bg-[#f5f5f5] transition-colors focus:outline-none focus:ring-2 focus:ring-gray-400"
          aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
          title={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
        >
          {theme === "dark" ? <Sun size={18} /> : <Moon size={18} />}
        </button>
        <button
          onClick={logout}
          className="w-9 h-9 flex items-center justify-center rounded-lg text-[#666] hover:text-black hover:bg-[#f5f5f5] transition-colors focus:outline-none focus:ring-2 focus:ring-gray-400"
          aria-label="Sign out"
          title="Sign out"
        >
          <LogOut size={18} />
        </button>
      </div>
    </header>
  );
}
