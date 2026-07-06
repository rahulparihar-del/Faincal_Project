"use client";

import dynamic from "next/dynamic";

const MeeshoContent = dynamic(
  () => import("./MeeshoContent"),
  {
    ssr: false,
    loading: () => (
      <div className="flex items-center justify-center h-64">
        <div className="text-[#888] text-sm font-medium">Loading Meesho Hub...</div>
      </div>
    ),
  }
);

export default function MeeshoPage() {
  return <MeeshoContent />;
}