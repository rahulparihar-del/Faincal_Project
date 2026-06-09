"use client";

import React from "react";
import { motion } from "framer-motion";
import { useTheme } from "@/context/ThemeContext";
import { Sun, Moon } from "lucide-react";

export function AuthTopBar({ onSignIn }: { onSignIn?: () => void }) {
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === "dark";

  const iconBtn = isDark
    ? "text-white/70 hover:text-white hover:bg-white/10"
    : "text-[#555] hover:text-black hover:bg-black/5";

  return (
    <motion.header
      initial={{ opacity: 0, y: -12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
      className="absolute top-0 left-0 right-0 z-30 flex items-center justify-between px-5 sm:px-8 h-16"
    >
      <div className="flex items-center gap-2.5">
        <div className={`w-8 h-8 flex items-center justify-center font-bold rounded-lg text-sm ${isDark ? "bg-white text-black" : "bg-black text-white"}`}>
          B
        </div>
        <span className={`font-bold tracking-tight ${isDark ? "text-white" : "text-black"}`}>BizTrack</span>
      </div>

      <div className="flex items-center gap-2">
        <button
          onClick={toggleTheme}
          aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
          title={isDark ? "Switch to light mode" : "Switch to dark mode"}
          className={`w-9 h-9 flex items-center justify-center rounded-lg transition-colors ${iconBtn}`}
        >
          {isDark ? <Sun size={18} /> : <Moon size={18} />}
        </button>
        {onSignIn && (
          <button
            onClick={onSignIn}
            className={`px-4 py-2 rounded-xl font-bold text-sm transition-transform hover:scale-105 ${isDark ? "bg-white text-black" : "bg-black text-white"}`}
          >
            Sign In
          </button>
        )}
      </div>
    </motion.header>
  );
}
