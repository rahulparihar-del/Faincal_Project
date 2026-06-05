"use client";

import React, { useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { Lock, Mail, Eye, EyeOff } from "lucide-react";

export function LoginScreen() {
  const { login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [error, setError] = useState(false);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const ok = login(email, password);
    if (!ok) setError(true);
  };

  const inputCls =
    "w-full bg-[#f5f5f5] border border-[#e8e8e8] rounded-xl pl-10 pr-3 py-3 text-sm font-medium text-black placeholder:text-[#aaa] focus:outline-none focus:ring-2 focus:ring-black/10 focus:border-[#ccc] transition-colors";

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-[var(--color-gray-50)] p-5">
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center mb-8">
          <div className="w-14 h-14 bg-black text-white flex items-center justify-center font-bold rounded-2xl text-xl shadow-[0_4px_16px_rgba(0,0,0,0.2)]">
            B
          </div>
          <h1 className="mt-4 text-2xl font-bold tracking-tight text-black">BizTrack</h1>
          <p className="text-sm text-[#888] mt-1">Sign in to continue</p>
        </div>

        <form
          onSubmit={submit}
          className="bg-white border border-[#e8e8e8] rounded-2xl p-6 shadow-[0_1px_3px_rgba(0,0,0,0.04),0_8px_24px_rgba(0,0,0,0.04)] space-y-4"
        >
          <div>
            <label className="block text-[12px] font-semibold text-[#555] mb-1.5">Email</label>
            <div className="relative">
              <Mail size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#aaa]" />
              <input
                type="text"
                autoFocus
                value={email}
                onChange={(e) => { setEmail(e.target.value); setError(false); }}
                placeholder="you@example.com"
                className={inputCls}
              />
            </div>
          </div>

          <div>
            <label className="block text-[12px] font-semibold text-[#555] mb-1.5">Password</label>
            <div className="relative">
              <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#aaa]" />
              <input
                type={show ? "text" : "password"}
                value={password}
                onChange={(e) => { setPassword(e.target.value); setError(false); }}
                placeholder="••••••••"
                className={`${inputCls} pr-10`}
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
              Incorrect email or password.
            </div>
          )}

          <button
            type="submit"
            className="w-full bg-black text-white font-bold py-3 rounded-xl hover:bg-[#1a1a1a] transition-colors shadow-[0_2px_8px_rgba(0,0,0,0.15)]"
          >
            Sign In
          </button>
        </form>
      </div>
    </div>
  );
}
