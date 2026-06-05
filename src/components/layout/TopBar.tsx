"use client";

import React from "react";
import { Menu, Sun, Moon, Database, CloudOff } from "lucide-react";
import { usePathname } from "next/navigation";
import { useTheme } from "@/context/ThemeContext";
import { useSupabaseStatus, type ConnectionStatus } from "@/lib/hooks/useSupabaseStatus";

const TAB_NAMES: Record<string, string> = {
  "/": "Dashboard",
  "/ecom": "E-commerce Sales",
  "/wholesale": "Wholesale Sales",
  "/manufacturers": "Manufacturers",
  "/purchases": "Purchase Orders",
  "/bank": "Bank Transactions",
  "/pl": "P&L Report",
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

export function TopBar({ setMobileOpen }: { setMobileOpen: (v: boolean) => void }) {
  const pathname = usePathname();
  const title = TAB_NAMES[pathname] || "BizTrack";
  const { theme, toggleTheme } = useTheme();
  const status = useSupabaseStatus();

  return (
    <header className="h-16 bg-white border-b border-[#e0e0e0] flex items-center px-5 lg:px-8 shrink-0 z-30">
      <button 
        className="lg:hidden block text-black mr-4 p-2 rounded-lg hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-gray-400" 
        onClick={() => setMobileOpen(true)}
        aria-label="Open navigation menu"
      >
        <Menu size={20} />
      </button>
      <h1 className="text-lg font-bold text-black tracking-tight">{title}</h1>

      <div className="ml-auto flex items-center gap-2">
        <ConnectionBadge status={status} />
        <button
          onClick={toggleTheme}
          className="w-9 h-9 flex items-center justify-center rounded-lg text-[#666] hover:text-black hover:bg-[#f5f5f5] transition-colors focus:outline-none focus:ring-2 focus:ring-gray-400"
          aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
          title={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
        >
          {theme === "dark" ? <Sun size={18} /> : <Moon size={18} />}
        </button>
      </div>
    </header>
  );
}
