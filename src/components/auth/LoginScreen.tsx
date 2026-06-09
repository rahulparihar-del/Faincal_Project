"use client";

import React, { useRef, useState } from "react";
import { motion } from "framer-motion";
import { useGSAP } from "@gsap/react";
import { gsap } from "gsap";
import { useAuth } from "@/context/AuthContext";
import { Lock, Mail, Eye, EyeOff, ArrowRight, ArrowLeft, ShieldCheck } from "lucide-react";

export function LoginScreen({ onBack }: { onBack?: () => void }) {
  const { login } = useAuth();
  const root = useRef<HTMLDivElement>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [shake, setShake] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useGSAP(
    () => {
      gsap.to(".lorb-a", { x: 50, y: -30, duration: 9, repeat: -1, yoyo: true, ease: "sine.inOut" });
      gsap.to(".lorb-b", { x: -60, y: 40, duration: 11, repeat: -1, yoyo: true, ease: "sine.inOut" });
    },
    { scope: root }
  );

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    setError(null);
    const res = await login(email, password);
    setSubmitting(false);
    if (!res.ok) {
      setError(res.error || "Incorrect email or password.");
      setShake(true);
      setTimeout(() => setShake(false), 500);
    }
  };

  const inputCls =
    "w-full bg-[#f5f5f5] border border-[#e8e8e8] rounded-xl pl-11 pr-3 py-3 text-sm font-medium text-black placeholder:text-[#aaa] focus:outline-none focus:ring-2 focus:ring-black/10 focus:border-[#ccc] transition-colors";

  return (
    <div
      ref={root}
      className="relative min-h-screen w-full overflow-hidden flex items-center justify-center p-6 bg-[#0a0a0a]"
    >
      {/* Animated background */}
      <div className="pointer-events-none absolute inset-0">
        <div className="lorb-a absolute -top-20 -left-10 w-[24rem] h-[24rem] rounded-full bg-white/[0.06] blur-3xl" />
        <div className="lorb-b absolute -bottom-16 -right-8 w-[28rem] h-[28rem] rounded-full bg-indigo-500/[0.10] blur-3xl" />
        <div
          className="absolute inset-0"
          style={{
            backgroundImage:
              "linear-gradient(rgba(255,255,255,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.04) 1px, transparent 1px)",
            backgroundSize: "48px 48px",
            maskImage: "radial-gradient(ellipse at 50% 45%, black, transparent 72%)",
            WebkitMaskImage: "radial-gradient(ellipse at 50% 45%, black, transparent 72%)",
          }}
        />
      </div>

      {onBack && (
        <button
          onClick={onBack}
          className="absolute top-5 left-5 z-20 inline-flex items-center gap-1.5 text-sm font-medium text-white/60 hover:text-white transition-colors"
        >
          <ArrowLeft size={16} /> Back
        </button>
      )}

      <motion.div
        initial={{ opacity: 0, y: 24, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
        className="relative z-10 w-full max-w-sm"
      >
        <div className="flex flex-col items-center mb-7">
          <div className="w-14 h-14 bg-white text-black flex items-center justify-center font-bold rounded-2xl text-xl shadow-[0_8px_30px_rgba(255,255,255,0.18)]">
            B
          </div>
          <h1 className="mt-4 text-xl font-bold tracking-tight text-white">Welcome back</h1>
          <p className="text-sm text-white/50 mt-1">Sign in to your dashboard</p>
        </div>

        <form
          onSubmit={submit}
          className={`bg-white/[0.04] backdrop-blur-xl border border-white/10 rounded-2xl p-6 shadow-[0_20px_60px_rgba(0,0,0,0.5)] space-y-4 ${shake ? "animate-shake" : ""}`}
        >
          <div>
            <label className="block text-[12px] font-semibold text-white/70 mb-1.5">Email</label>
            <div className="relative">
              <Mail size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#aaa] z-10" />
              <input
                type="text"
                autoFocus
                value={email}
                onChange={(e) => { setEmail(e.target.value); setError(null); }}
                placeholder="you@example.com"
                className={inputCls}
                style={{ paddingLeft: "2.75rem" }}
              />
            </div>
          </div>

          <div>
            <label className="block text-[12px] font-semibold text-white/70 mb-1.5">Password</label>
            <div className="relative">
              <Lock size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#aaa] z-10" />
              <input
                type={show ? "text" : "password"}
                value={password}
                onChange={(e) => { setPassword(e.target.value); setError(null); }}
                placeholder="••••••••"
                className={inputCls}
                style={{ paddingLeft: "2.75rem", paddingRight: "2.75rem" }}
              />
              <button
                type="button"
                onClick={() => setShow((s) => !s)}
                className="absolute right-2 top-1/2 -translate-y-1/2 w-7 h-7 flex items-center justify-center rounded-lg text-[#888] hover:text-black hover:bg-[#f5f5f5] z-10"
                aria-label={show ? "Hide password" : "Show password"}
              >
                {show ? <EyeOff size={15} /> : <Eye size={15} />}
              </button>
            </div>
          </div>

          {error && (
            <div className="bg-red-500/15 border border-red-500/30 text-red-300 text-sm rounded-xl px-4 py-2.5">
              {error}
            </div>
          )}

          <motion.button
            type="submit"
            disabled={submitting}
            whileHover={{ scale: submitting ? 1 : 1.02 }}
            whileTap={{ scale: 0.98 }}
            className="group w-full bg-white text-black font-bold py-3 rounded-xl flex items-center justify-center gap-2 disabled:opacity-60 shadow-[0_8px_30px_rgba(255,255,255,0.12)]"
          >
            {submitting ? "Signing in…" : "Sign In"}
            {!submitting && <ArrowRight size={16} className="group-hover:translate-x-0.5 transition-transform" />}
          </motion.button>
        </form>

        <div className="mt-5 flex items-center justify-center gap-1.5 text-[12px] text-white/40">
          <ShieldCheck size={13} />
          Protected area · authorized access only
        </div>
      </motion.div>
    </div>
  );
}
