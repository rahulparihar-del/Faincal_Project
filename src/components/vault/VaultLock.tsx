"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import { motion } from "framer-motion";
import { LockKeyhole, Delete, ShieldCheck } from "lucide-react";

const LEN = 4;

/**
 * Lock screen with a numeric keypad.
 * - mode "setup": user picks a PIN (entered twice to confirm) — used the first
 *   time the vault is created.
 * - mode "unlock": user enters the PIN; `verify` decrypts the stored verifier
 *   to confirm correctness (async).
 */
export function VaultLock({
  mode,
  verify,
  onUnlock,
  notice,
  onReset,
}: {
  mode: "setup" | "unlock";
  verify: (pin: string) => Promise<boolean>;
  onUnlock: () => void;
  notice?: string;
  onReset?: () => void;
}) {
  const [pin, setPin] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [working, setWorking] = useState(false);
  const [phase, setPhase] = useState<"create" | "confirm">("create");
  const firstPin = useRef("");
  // Guards so the async check isn't re-triggered by re-renders / its own state.
  const runningRef = useRef(false);
  const completedRef = useRef(false);
  // Keep latest callbacks without putting them in effect deps (avoids re-runs).
  const verifyRef = useRef(verify);
  const onUnlockRef = useRef(onUnlock);

  useEffect(() => {
    verifyRef.current = verify;
    onUnlockRef.current = onUnlock;
  }, [verify, onUnlock]);

  const busy = working || success;

  const press = useCallback((d: string) => {
    setError(null);
    setPin((p) => (p.length >= LEN ? p : p + d));
  }, []);

  const back = useCallback(() => {
    setError(null);
    setPin((p) => p.slice(0, -1));
  }, []);

  // Handle a fully-entered PIN.
  useEffect(() => {
    if (pin.length < LEN) return;
    if (runningRef.current || completedRef.current) return;
    runningRef.current = true;

    (async () => {
      try {
        if (mode === "setup") {
          if (phase === "create") {
            firstPin.current = pin;
            setPin("");
            setPhase("confirm");
            return;
          }
          // confirm
          if (pin !== firstPin.current) {
            setError("PINs didn't match. Start again.");
            setPhase("create");
            firstPin.current = "";
            setPin("");
            return;
          }
          setWorking(true);
          const ok = await verifyRef.current(pin);
          setWorking(false);
          if (ok) {
            completedRef.current = true;
            setSuccess(true);
            setTimeout(() => onUnlockRef.current(), 650);
          } else {
            setError("Couldn't set up the vault. Try again.");
            setPin("");
            setPhase("create");
          }
          return;
        }

        // unlock
        setWorking(true);
        const ok = await verifyRef.current(pin);
        setWorking(false);
        if (ok) {
          completedRef.current = true;
          setSuccess(true);
          setTimeout(() => onUnlockRef.current(), 650);
        } else {
          setError("Wrong PIN. Try again.");
          setTimeout(() => setPin(""), 450);
        }
      } finally {
        runningRef.current = false;
      }
    })();
  }, [pin, mode, phase]);

  // Hardware keyboard support.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (busy) return;
      if (e.key >= "0" && e.key <= "9") press(e.key);
      else if (e.key === "Backspace") back();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [press, back, busy]);

  const keys = ["1", "2", "3", "4", "5", "6", "7", "8", "9"];

  const subtitle = success
    ? mode === "setup" ? "Securing…" : "Unlocking…"
    : working
    ? "Checking…"
    : error
    ? error
    : mode === "setup"
    ? phase === "create"
      ? "Create a PIN to protect your Vault"
      : "Re-enter your PIN to confirm"
    : notice
    ? notice
    : "Enter your PIN to continue";

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, scale: 1.06, filter: "blur(8px)" }}
      transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
      className="flex flex-col items-center justify-center min-h-[calc(100vh-200px)] select-none"
    >
      <motion.div
        animate={success ? { scale: [1, 1.15, 1] } : {}}
        transition={{ duration: 0.5 }}
        className={`w-20 h-20 rounded-3xl flex items-center justify-center mb-6 transition-colors duration-300 ${
          success ? "bg-green-500 text-white" : "bg-black text-white"
        }`}
        style={{ boxShadow: "0 10px 40px rgba(0,0,0,0.18)" }}
      >
        {success ? <ShieldCheck size={34} /> : <LockKeyhole size={32} />}
      </motion.div>

      <h2 className="text-xl font-bold text-black tracking-tight">
        {mode === "setup" ? "Set up your Vault" : "Private Vault"}
      </h2>
      <p className={`text-sm mt-1 mb-7 ${error ? "text-red-500 font-medium" : "text-[#888]"}`}>
        {subtitle}
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
            disabled={busy}
            className="h-16 rounded-2xl bg-white border border-[#e8e8e8] text-2xl font-semibold text-black hover:bg-[#f5f5f5] active:scale-95 transition-all shadow-[0_1px_3px_rgba(0,0,0,0.04)] disabled:opacity-50"
          >
            {k}
          </button>
        ))}
        <span />
        <button
          onClick={() => press("0")}
          disabled={busy}
          className="h-16 rounded-2xl bg-white border border-[#e8e8e8] text-2xl font-semibold text-black hover:bg-[#f5f5f5] active:scale-95 transition-all shadow-[0_1px_3px_rgba(0,0,0,0.04)] disabled:opacity-50"
        >
          0
        </button>
        <button
          onClick={back}
          disabled={busy}
          className="h-16 rounded-2xl flex items-center justify-center text-[#888] hover:bg-[#f5f5f5] active:scale-95 transition-all disabled:opacity-50"
          aria-label="Delete"
        >
          <Delete size={24} />
        </button>
      </div>

      {onReset && (
        <button
          onClick={onReset}
          className="mt-6 text-xs text-red-500 hover:text-red-700 hover:underline font-semibold transition-colors"
        >
          Reset Vault
        </button>
      )}
    </motion.div>
  );
}
