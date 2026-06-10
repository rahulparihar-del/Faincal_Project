"use client";

import React, { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import { LockKeyhole, Delete, ShieldCheck } from "lucide-react";

const PIN = "1900";
const LEN = PIN.length;

export function VaultLock({ onUnlock, notice }: { onUnlock: () => void; notice?: string }) {
  const [pin, setPin] = useState("");
  const [error, setError] = useState(false);
  const [success, setSuccess] = useState(false);

  const press = useCallback((d: string) => {
    setError(false);
    setPin((p) => (p.length >= LEN ? p : p + d));
  }, []);

  const back = useCallback(() => {
    setError(false);
    setPin((p) => p.slice(0, -1));
  }, []);

  // Validate once the PIN is fully entered.
  useEffect(() => {
    if (pin.length < LEN) return;
    if (pin === PIN) {
      setSuccess(true);
      const t = setTimeout(onUnlock, 650);
      return () => clearTimeout(t);
    }
    setError(true);
    const t = setTimeout(() => setPin(""), 500);
    return () => clearTimeout(t);
  }, [pin, onUnlock]);

  // Hardware / desktop keyboard support.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key >= "0" && e.key <= "9") press(e.key);
      else if (e.key === "Backspace") back();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [press, back]);

  const keys = ["1", "2", "3", "4", "5", "6", "7", "8", "9"];

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, scale: 1.06, filter: "blur(8px)" }}
      transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
      className="flex flex-col items-center justify-center min-h-[calc(100vh-200px)] select-none"
    >
      {/* Lock badge */}
      <motion.div
        animate={success ? { scale: [1, 1.15, 1], rotate: [0, 0, 0] } : {}}
        transition={{ duration: 0.5 }}
        className={`w-20 h-20 rounded-3xl flex items-center justify-center mb-6 transition-colors duration-300 ${
          success ? "bg-green-500 text-white" : "bg-black text-white"
        }`}
        style={{ boxShadow: "0 10px 40px rgba(0,0,0,0.18)" }}
      >
        {success ? <ShieldCheck size={34} /> : <LockKeyhole size={32} />}
      </motion.div>

      <h2 className="text-xl font-bold text-black tracking-tight">Private Vault</h2>
      <p className="text-sm text-[#888] mt-1 mb-7">
        {success ? "Unlocking…" : notice ? notice : "Enter your PIN to continue"}
      </p>

      {/* PIN dots */}
      <motion.div
        animate={error ? { x: [0, -10, 10, -8, 8, -4, 0] } : { x: 0 }}
        transition={{ duration: 0.4 }}
        className="flex items-center gap-3.5 mb-8"
      >
        {Array.from({ length: LEN }).map((_, i) => {
          const filled = i < pin.length;
          return (
            <span
              key={i}
              className={`w-3.5 h-3.5 rounded-full border-2 transition-all duration-150 ${
                error
                  ? "border-red-400 bg-red-400"
                  : success
                  ? "border-green-500 bg-green-500"
                  : filled
                  ? "border-black bg-black"
                  : "border-[#ccc] bg-transparent"
              }`}
            />
          );
        })}
      </motion.div>

      {/* Keypad */}
      <div className="grid grid-cols-3 gap-3 w-[260px]">
        {keys.map((k) => (
          <button
            key={k}
            onClick={() => press(k)}
            disabled={success}
            className="h-16 rounded-2xl bg-white border border-[#e8e8e8] text-2xl font-semibold text-black hover:bg-[#f5f5f5] active:scale-95 transition-all shadow-[0_1px_3px_rgba(0,0,0,0.04)]"
          >
            {k}
          </button>
        ))}
        <span />
        <button
          onClick={() => press("0")}
          disabled={success}
          className="h-16 rounded-2xl bg-white border border-[#e8e8e8] text-2xl font-semibold text-black hover:bg-[#f5f5f5] active:scale-95 transition-all shadow-[0_1px_3px_rgba(0,0,0,0.04)]"
        >
          0
        </button>
        <button
          onClick={back}
          disabled={success}
          className="h-16 rounded-2xl flex items-center justify-center text-[#888] hover:bg-[#f5f5f5] active:scale-95 transition-all"
          aria-label="Delete"
        >
          <Delete size={24} />
        </button>
      </div>
    </motion.div>
  );
}
