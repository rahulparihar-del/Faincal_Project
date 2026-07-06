"use client";

import dynamic from "next/dynamic";

const ManufacturersContent = dynamic(
  () => import("./ManufacturersContent"),
  {
    ssr: false,
    loading: () => (
      <div className="flex items-center justify-center h-64">
        <div className="text-[#888] text-sm font-medium">Loading Manufacturers...</div>
      </div>
    ),
  }
);

export default function ManufacturersPage() {
  return <ManufacturersContent />;
}
