"use client";

import dynamic from "next/dynamic";

const InventoryContent = dynamic(
  () => import("./InventoryContent"),
  {
    ssr: false,
    loading: () => (
      <div className="flex items-center justify-center h-64">
        <div className="text-[#888] text-sm font-medium">Loading Inventory...</div>
      </div>
    ),
  }
);

export default function InventoryPage() {
  return <InventoryContent />;
}
