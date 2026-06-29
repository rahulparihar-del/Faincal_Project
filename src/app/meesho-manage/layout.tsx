"use client";

import React from "react";
import { MeeshoShell } from "@/components/meesho/MeeshoShell";

export default function MeeshoManageLayout({ children }: { children: React.ReactNode }) {
  return <MeeshoShell>{children}</MeeshoShell>;
}
