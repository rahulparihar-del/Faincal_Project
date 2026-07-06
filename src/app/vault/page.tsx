"use client";

import dynamic from "next/dynamic";

const VaultContent = dynamic(
  () => import("./VaultContent"),
  {
    ssr: false,
    loading: () => (
      <div className="flex items-center justify-center h-64">
        <div className="text-[#888] text-sm font-medium">Loading Vault...</div>
      </div>
    ),
  }
);

export default function VaultPage() {
  return <VaultContent />;
}
