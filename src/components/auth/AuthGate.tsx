"use client";

import React, { useState, useEffect, useRef } from "react";
import { useAuth } from "@/context/AuthContext";
import { LoginScreen } from "./LoginScreen";
import { LandingScreen } from "./LandingScreen";

type Phase = "landing" | "login" | "app";

/**
 * Auth flow: Landing → Login → App.
 * The login screen drives the transition to the app (via onEnterApp) so its
 * sign-in close animation finishes before the dashboard mounts.
 */
export function AuthGate({ children }: { children: React.ReactNode }) {
  const { isAuthed, ready } = useAuth();
  const [phase, setPhase] = useState<Phase>("landing");
  const wasAuthed = useRef(false);

  useEffect(() => {
    if (!ready) return;
    if (isAuthed && !wasAuthed.current) {
      // Authenticated. If this came from a restored session (not the in-app
      // form flow), jump straight to the app. If we're on the login screen,
      // LoginScreen's animation will call onEnterApp itself.
      if (phase !== "login") setPhase("app");
    } else if (!isAuthed && wasAuthed.current) {
      // Logged out → back to the landing screen.
      setPhase("landing");
    }
    wasAuthed.current = isAuthed;
  }, [isAuthed, ready, phase]);

  if (!ready) {
    return <div className="min-h-screen bg-[#0a0a0a]" />;
  }

  if (phase === "app") {
    return <>{children}</>;
  }

  if (phase === "login") {
    return <LoginScreen onBack={() => setPhase("landing")} onEnterApp={() => setPhase("app")} />;
  }

  return <LandingScreen onEnter={() => setPhase("login")} />;
}
