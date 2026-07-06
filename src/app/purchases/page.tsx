"use client";

import dynamic from "next/dynamic";

// Dynamically import the heavy purchases content.
// This prevents the 100KB+ module from being parsed on every navigation,
// and instead loads it as a separate async chunk on first visit.
const PurchasesContent = dynamic(
  () => import("./PurchasesContent"),
  {
    ssr: false,
    loading: () => (
      <div className="flex items-center justify-center h-64">
        <div className="text-[#888] text-sm font-medium">Loading Purchases...</div>
      </div>
    ),
  }
);

export default function PurchasesPage() {
  return <PurchasesContent />;
}
