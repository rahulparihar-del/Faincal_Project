"use client";

import React, { useState } from "react";
import { usePathname } from "next/navigation";
import { Sidebar, MobileTabBar } from "./Sidebar";
import { TopBar } from "./TopBar";
import { PageTransition } from "../ui/PageTransition";
import { useData } from "@/context/DataContext";

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [isMobileOpen, setMobileOpen] = useState(false);
  const { isReady } = useData();

  React.useEffect(() => {
    const updateTableLabels = () => {
      document.querySelectorAll("table").forEach((table) => {
        // Find headers in thead
        const headers = Array.from(table.querySelectorAll("thead th")).map((th) => {
          // Exclude helper/empty headers if needed, but standard mapping is positional
          return th.textContent ? th.textContent.trim() : "";
        });
        if (headers.length === 0) return;

        // Add class to the table
        table.classList.add("responsive-table");

        // Assign data-label to td elements in tbody tr
        table.querySelectorAll("tbody tr").forEach((row) => {
          row.querySelectorAll("td").forEach((td, index) => {
            const header = headers[index];
            if (header && !td.getAttribute("data-label")) {
              td.setAttribute("data-label", header);
            }
          });
        });
      });
    };

    // Run initially
    updateTableLabels();

    // Observe changes in document body to capture client-side route changes and dynamic render
    const observer = new MutationObserver(() => {
      updateTableLabels();
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true,
    });

    return () => observer.disconnect();
  }, [isReady]);

  // WMS routes handle their own layout — render bare container only
  if (pathname.startsWith('/warehouse')) {
    return <div className="flex h-screen w-full overflow-hidden">{children}</div>;
  }

  if (!isReady) {
    return (
      <div className="fixed inset-0 z-[99999] flex flex-col items-center justify-center bg-gray-50 dark:bg-neutral-950 transition-opacity duration-300">
        <div className="flex flex-col items-center gap-4">
          <div className="relative w-16 h-16 flex items-center justify-center">
            <div className="absolute inset-0 rounded-full bg-black/5 dark:bg-white/5 animate-ping" />
            <div className="w-12 h-12 rounded-full border-4 border-gray-200 dark:border-neutral-800 border-t-black dark:border-t-white animate-spin" />
            <div className="absolute w-6 h-6 bg-black dark:bg-white text-white dark:text-black flex items-center justify-center font-bold rounded-lg text-xs shadow-md">
              B
            </div>
          </div>
          <div className="flex flex-col items-center gap-1">
            <span className="text-sm font-bold text-black dark:text-white tracking-tight">Loading BizTrack</span>
            <span className="text-[11px] font-medium text-[#888] animate-pulse">Syncing database...</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen w-full overflow-hidden bg-gray-50">
      <Sidebar isMobileOpen={isMobileOpen} setMobileOpen={setMobileOpen} />

      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <TopBar setMobileOpen={setMobileOpen} />

        {/* Desktop: exact original padding (p-5 lg:p-8).
            Mobile: adds bottom padding so content isn't hidden behind the tab bar. */}
        <main
          className="flex-1 overflow-y-auto p-5 lg:p-8 pb-[calc(5rem+env(safe-area-inset-bottom))] lg:pb-8"
          role="main"
        >
          <PageTransition>
            {children}
          </PageTransition>
        </main>
      </div>

      {/* Mobile bottom tab bar — only visible on mobile, hidden on desktop */}
      <MobileTabBar />
    </div>
  );
}
