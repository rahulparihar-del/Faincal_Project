"use client";

import React, { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useAuth } from "@/context/AuthContext";
import { LoginScreen } from "./LoginScreen";
import { LandingScreen } from "./LandingScreen";

/** Shows the landing screen, then login, until the user is authenticated. */
export function AuthGate({ children }: { children: React.ReactNode }) {
  const { isAuthed, ready } = useAuth();
  const [showLogin, setShowLogin] = useState(false);

  if (!ready) {
    return <div className="min-h-screen bg-[#0a0a0a]" />;
  }

  if (!isAuthed) {
    return (
      <AnimatePresence mode="wait">
        {showLogin ? (
          <motion.div
            key="login"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
          >
            <LoginScreen onBack={() => setShowLogin(false)} />
          </motion.div>
        ) : (
          <motion.div
            key="landing"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
          >
            <LandingScreen onEnter={() => setShowLogin(true)} />
          </motion.div>
        )}
      </AnimatePresence>
    );
  }

  return <>{children}</>;
}
