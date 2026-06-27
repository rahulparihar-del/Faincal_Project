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
}: {
  mode: "setup" | "unlock";
  verify: (pin: string) => Promise<boolean>;
  onUnlock: () => void;
  notice?: string;
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
    <div className="flex flex-col items-center justify-center min-h-[calc(100vh-220px)] px-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, filter: "blur(8px)" }}
        transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
        className="max-w-[360px] w-full bg-white dark:bg-zinc-900/60 dark:backdrop-blur-md border border-[#e8e8e8] dark:border-zinc-800 rounded-3xl p-7 shadow-[0_8px_32px_rgba(0,0,0,0.03)] dark:shadow-[0_20px_50px_rgba(0,0,0,0.3)] flex flex-col items-center select-none"
      >
        <motion.div
          animate={success ? { scale: [1, 1.15, 1] } : {}}
          transition={{ duration: 0.5 }}
          className={`w-16 h-16 rounded-2xl flex items-center justify-center mb-5 transition-colors duration-300 ${
            success ? "bg-green-500 text-white" : "bg-zinc-950 dark:bg-zinc-100 text-white dark:text-zinc-900"
          }`}
          style={{ boxShadow: "0 8px 30px rgba(0,0,0,0.12)" }}
        >
          {success ? <ShieldCheck size={28} /> : <LockKeyhole size={26} />}
        </motion.div>

        <h2 className="text-lg font-bold text-black dark:text-white tracking-tight">
          {mode === "setup" ? "Set up your Vault" : "Private Vault"}
        </h2>
        <p className={`text-xs mt-1 mb-6 text-center ${error ? "text-red-500 font-medium" : "text-zinc-500 dark:text-zinc-400"}`}>
          {subtitle}
        </p>

        {/* PIN dots */}
        <motion.div
          animate={error ? { x: [0, -10, 10, -8, 8, -4, 0] } : { x: 0 }}
          transition={{ duration: 0.4 }}
          className="flex items-center gap-3 mb-6"
        >
          {Array.from({ length: LEN }).map((_, i) => {
            const filled = i < pin.length;
            return (
              <span
                key={i}
                className={`w-3 h-3 rounded-full border-2 transition-all duration-150 ${
                  error
                    ? "border-red-400 bg-red-400"
                    : success
                    ? "border-green-500 bg-green-500"
                    : filled
                    ? "border-black dark:border-white bg-black dark:bg-white"
                    : "border-zinc-300 dark:border-zinc-700 bg-transparent"
                }`}
              />
            );
          })}
        </motion.div>

        {/* Keypad */}
        <div className="grid grid-cols-3 gap-2.5 w-full">
          {keys.map((k) => (
            <button
              key={k}
              type="button"
              onClick={() => press(k)}
              disabled={busy}
              className="h-14 rounded-2xl bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200/60 dark:border-zinc-800/80 text-xl font-bold text-zinc-800 dark:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-zinc-800 active:scale-95 transition-all shadow-[0_1px_2px_rgba(0,0,0,0.01)] disabled:opacity-50 cursor-pointer"
            >
              {k}
            </button>
          ))}
          <span />
          <button
            onClick={() => press("0")}
            type="button"
            disabled={busy}
            className="h-14 rounded-2xl bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200/60 dark:border-zinc-800/80 text-xl font-bold text-zinc-800 dark:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-zinc-800 active:scale-95 transition-all shadow-[0_1px_2px_rgba(0,0,0,0.01)] disabled:opacity-50 cursor-pointer"
          >
            0
          </button>
          <button
            onClick={back}
            type="button"
            disabled={busy}
            className="h-14 rounded-2xl flex items-center justify-center text-zinc-400 dark:text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800 active:scale-95 transition-all disabled:opacity-50 cursor-pointer"
            aria-label="Delete"
          >
            <Delete size={20} />
          </button>
        </div>


      </motion.div>
    </div>
  );
}
