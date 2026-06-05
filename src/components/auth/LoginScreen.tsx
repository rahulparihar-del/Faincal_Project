"use client";

import React, { useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { Lock, Mail, Eye, EyeOff, ArrowRight, TrendingUp, FileText, BarChart3, ShieldCheck } from "lucide-react";

const FEATURES = [
  { icon: TrendingUp, title: "Sales & revenue", desc: "E-commerce and wholesale in one place" },
  { icon: FileText, title: "Invoices & GST", desc: "Auto-extract bills with confidence scoring" },
  { icon: BarChart3, title: "P&L reports", desc: "Month-by-month profit, exportable to Excel" },
];

export function LoginScreen() {
  const { login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [shake, setShake] = useState(false);
  const [submitting, setSubmitting] = useState(false);

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
    <div className="min-h-screen w-full grid lg:grid-cols-2 bg-[var(--color-gray-50)]">
      {/* ── Showcase panel (always dark for a premium feel) ── */}
      <div className="relative hidden lg:flex flex-col justify-between overflow-hidden bg-[#0a0a0a] text-white p-12">
        {/* decorative glows + grid */}
        <div className="pointer-events-none absolute inset-0 opacity-60">
          <div className="absolute -top-24 -left-24 w-96 h-96 rounded-full bg-white/5 blur-3xl" />
          <div className="absolute bottom-0 right-0 w-[28rem] h-[28rem] rounded-full bg-white/[0.04] blur-3xl" />
          <div
            className="absolute inset-0"
            style={{
              backgroundImage:
                "linear-gradient(rgba(255,255,255,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.04) 1px, transparent 1px)",
              backgroundSize: "44px 44px",
              maskImage: "radial-gradient(ellipse at 30% 20%, black, transparent 75%)",
              WebkitMaskImage: "radial-gradient(ellipse at 30% 20%, black, transparent 75%)",
            }}
          />
        </div>

        <div className="relative">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 bg-white text-black flex items-center justify-center font-bold rounded-2xl text-lg shadow-[0_4px_16px_rgba(255,255,255,0.15)]">
              B
            </div>
            <span className="font-bold text-xl tracking-tight">BizTrack</span>
          </div>
        </div>

        <div className="relative max-w-md">
          <h2 className="text-4xl font-bold tracking-tight leading-tight">
            Run your business<br />by the numbers.
          </h2>
          <p className="text-white/60 mt-4 text-[15px] leading-relaxed">
            Sales, purchases, invoices, GST and profit — tracked in one clean dashboard.
          </p>

          <div className="mt-10 space-y-5">
            {FEATURES.map((f) => (
              <div key={f.title} className="flex items-start gap-4">
                <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center shrink-0">
                  <f.icon size={18} className="text-white" />
                </div>
                <div>
                  <div className="font-semibold text-sm">{f.title}</div>
                  <div className="text-white/50 text-[13px]">{f.desc}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="relative text-white/40 text-xs">
          © {new Date().getFullYear()} BizTrack · KiddieKa
        </div>
      </div>

      {/* ── Form panel ── */}
      <div className="flex items-center justify-center p-6 sm:p-10">
        <div className="w-full max-w-sm animate-fade-in-up">
          {/* compact brand for mobile (panel hidden) */}
          <div className="flex lg:hidden flex-col items-center mb-8">
            <div className="w-14 h-14 bg-black text-white flex items-center justify-center font-bold rounded-2xl text-xl shadow-[0_4px_16px_rgba(0,0,0,0.2)]">
              B
            </div>
            <h1 className="mt-4 text-2xl font-bold tracking-tight text-black">BizTrack</h1>
          </div>

          <div className="mb-7">
            <h1 className="text-2xl font-bold tracking-tight text-black">Welcome back</h1>
            <p className="text-sm text-[#888] mt-1.5">Sign in to your dashboard to continue.</p>
          </div>

          <form
            onSubmit={submit}
            className={`space-y-4 ${shake ? "animate-shake" : ""}`}
          >
            <div>
              <label className="block text-[12px] font-semibold text-[#555] mb-1.5">Email</label>
              <div className="relative">
                <Mail size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#aaa]" />
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
              <label className="block text-[12px] font-semibold text-[#555] mb-1.5">Password</label>
              <div className="relative">
                <Lock size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#aaa]" />
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
                  className="absolute right-2 top-1/2 -translate-y-1/2 w-7 h-7 flex items-center justify-center rounded-lg text-[#888] hover:text-black hover:bg-[#f5f5f5]"
                  aria-label={show ? "Hide password" : "Show password"}
                >
                  {show ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl px-4 py-2.5">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="group w-full bg-black text-white font-bold py-3 rounded-xl hover:bg-[#1a1a1a] transition-colors shadow-[0_2px_8px_rgba(0,0,0,0.15)] flex items-center justify-center gap-2 disabled:opacity-60"
            >
              {submitting ? "Signing in…" : "Sign In"}
              {!submitting && <ArrowRight size={16} className="group-hover:translate-x-0.5 transition-transform" />}
            </button>
          </form>

          <div className="mt-6 flex items-center justify-center gap-1.5 text-[12px] text-[#aaa]">
            <ShieldCheck size={13} />
            Protected area · authorized access only
          </div>
        </div>
      </div>
    </div>
  );
}
