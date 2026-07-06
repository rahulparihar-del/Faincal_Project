"use client";

import dynamic from "next/dynamic";

const FinanceContent = dynamic(
  () => import("./FinanceContent"),
  {
    ssr: false,
    loading: () => (
      <div className="flex items-center justify-center h-64">
        <div className="text-[#888] text-sm font-medium">Loading Finance...</div>
      </div>
    ),
  }
);

export default function FinancePage() {
  return <FinanceContent />;
}
