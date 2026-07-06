"use client";

import dynamic from "next/dynamic";

const PlContent = dynamic(
  () => import("./PlContent"),
  {
    ssr: false,
    loading: () => (
      <div className="flex items-center justify-center h-64">
        <div className="text-[#888] text-sm font-medium">Loading P&L...</div>
      </div>
    ),
  }
);

export default function PlPage() {
  return <PlContent />;
}
