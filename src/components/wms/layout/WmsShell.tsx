'use client';

import React, { useState } from 'react';
import { WmsSidebar } from './WmsSidebar';
import { WmsTopBar } from './WmsTopBar';
import { WmsProvider } from '@/context/WmsContext';
import { WmsToastProvider } from '@/components/wms/ui/WmsToast';

export function WmsShell({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <WmsProvider>
      <WmsToastProvider>
        <div className="flex h-screen w-full overflow-hidden bg-[#f8fafc] dark:bg-[#0f172a]">
          <WmsSidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

          <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
            <WmsTopBar onMenuClick={() => setSidebarOpen(true)} />
            <main className="flex-1 overflow-y-auto p-4 lg:p-6">
              {children}
            </main>
          </div>
        </div>
      </WmsToastProvider>
    </WmsProvider>
  );
}

