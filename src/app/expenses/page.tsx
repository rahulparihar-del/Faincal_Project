"use client";

import dynamic from "next/dynamic";

const ExpensesContent = dynamic(
  () => import("./ExpensesContent"),
  {
    ssr: false,
    loading: () => (
      <div className="flex items-center justify-center h-64">
        <div className="text-[#888] text-sm font-medium">Loading Expenses...</div>
      </div>
    ),
  }
);

export default function ExpensesPage() {
  return <ExpensesContent />;
}
