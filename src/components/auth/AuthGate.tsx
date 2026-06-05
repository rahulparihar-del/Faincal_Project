"use client";

import React from "react";
import { useAuth } from "@/context/AuthContext";
import { LoginScreen } from "./LoginScreen";

/** Shows the login screen until the user is authenticated. */
export function AuthGate({ children }: { children: React.ReactNode }) {
  const { isAuthed, ready } = useAuth();

  if (!ready) {
    return <div className="min-h-screen bg-[var(--color-gray-50)]" />;
  }
  if (!isAuthed) {
    return <LoginScreen />;
  }
  return <>{children}</>;
}
