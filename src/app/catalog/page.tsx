"use client";

import dynamic from "next/dynamic";

const CatalogContent = dynamic(
  () => import("./CatalogContent"),
  {
    ssr: false,
    loading: () => (
      <div className="flex items-center justify-center h-64">
        <div className="text-[#888] text-sm font-medium">Loading Catalog...</div>
      </div>
    ),
  }
);

export default function CatalogPage() {
  return <CatalogContent />;
}
