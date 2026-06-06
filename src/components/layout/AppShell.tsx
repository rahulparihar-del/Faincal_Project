"use client";

import React, { useState } from "react";
import { Sidebar, MobileTabBar } from "./Sidebar";
import { TopBar } from "./TopBar";
import { PageTransition } from "../ui/PageTransition";

export function AppShell({ children }: { children: React.ReactNode }) {
  const [isMobileOpen, setMobileOpen] = useState(false);

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
