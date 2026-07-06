"use client";

import dynamic from "next/dynamic";

const WholesaleContent = dynamic(
  () => import("./WholesaleContent"),
  {
    ssr: false,
    loading: () => (
      <div className="flex items-center justify-center h-64">
        <div className="text-[#888] text-sm font-medium">Loading Wholesale...</div>
      </div>
    ),
  }
);

export default function WholesalePage() {
  return <WholesaleContent />;
}
