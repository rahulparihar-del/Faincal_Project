"use client";

import dynamic from "next/dynamic";

const SitesContent = dynamic(
  () => import("./SitesContent"),
  {
    ssr: false,
    loading: () => (
      <div className="flex items-center justify-center h-64">
        <div className="text-[#888] text-sm font-medium">Loading Sites...</div>
      </div>
    ),
  }
);

export default function SitesPage() {
  return <SitesContent />;
}
