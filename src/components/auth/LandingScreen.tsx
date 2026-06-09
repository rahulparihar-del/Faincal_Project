"use client";

import React, { useRef } from "react";
import { motion, Variants } from "framer-motion";
import { useGSAP } from "@gsap/react";
import { gsap } from "gsap";
import { ArrowRight, TrendingUp, FileText, BarChart3, ShoppingCart } from "lucide-react";
import { useTheme } from "@/context/ThemeContext";
import { AuthTopBar } from "./AuthTopBar";

const container: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.1, delayChildren: 0.15 } },
};
const item: Variants = {
  hidden: { opacity: 0, y: 22 },
  show: { opacity: 1, y: 0, transition: { duration: 0.6, ease: [0.22, 1, 0.36, 1] } },
};

const CHIPS = [
  { icon: ShoppingCart, label: "Sales" },
  { icon: FileText, label: "Invoices & GST" },
  { icon: BarChart3, label: "P&L" },
  { icon: TrendingUp, label: "Profit" },
];

export function LandingScreen({ onEnter }: { onEnter: () => void }) {
  const root = useRef<HTMLDivElement>(null);
  const { theme } = useTheme();
  const isDark = theme === "dark";

  useGSAP(
    () => {
      gsap.to(".orb-a", { x: 60, y: -40, scale: 1.1, duration: 9, repeat: -1, yoyo: true, ease: "sine.inOut" });
      gsap.to(".orb-b", { x: -70, y: 50, scale: 1.15, duration: 11, repeat: -1, yoyo: true, ease: "sine.inOut" });
      gsap.to(".orb-c", { x: 40, y: 60, duration: 13, repeat: -1, yoyo: true, ease: "sine.inOut" });
    },
    { scope: root }
  );

  const c = isDark
    ? {
        bg: "#0a0a0a", text: "text-white", sub: "text-white/60", label: "text-white/50",
        chip: "bg-white/[0.06] border-white/10 text-white/80", chipIcon: "text-white/70",
        cta: "bg-white text-black shadow-[0_8px_30px_rgba(255,255,255,0.15)]",
        logo: "bg-white text-black shadow-[0_8px_30px_rgba(255,255,255,0.18)]",
        orbA: "bg-white/[0.07]", orbB: "bg-indigo-500/[0.10]", orbC: "bg-white/[0.04]",
        grid: "rgba(255,255,255,0.045)", footer: "text-white/30",
      }
    : {
        bg: "#f6f7f9", text: "text-[#0f0f0f]", sub: "text-[#555]", label: "text-[#888]",
        chip: "bg-black/[0.04] border-black/10 text-[#444]", chipIcon: "text-[#666]",
        cta: "bg-black text-white shadow-[0_8px_30px_rgba(0,0,0,0.18)]",
        logo: "bg-black text-white shadow-[0_8px_30px_rgba(0,0,0,0.15)]",
        orbA: "bg-indigo-300/40", orbB: "bg-indigo-400/30", orbC: "bg-black/[0.04]",
        grid: "rgba(0,0,0,0.05)", footer: "text-[#aaa]",
      };

  return (
    <div ref={root} className={`relative h-screen w-full overflow-hidden flex flex-col items-center justify-center px-6 ${c.text}`} style={{ background: c.bg }}>
      <AuthTopBar onSignIn={onEnter} />

      {/* Animated background */}
      <div className="pointer-events-none absolute inset-0">
        <div className={`orb-a absolute -top-24 -left-16 w-[26rem] h-[26rem] rounded-full blur-3xl ${c.orbA}`} />
        <div className={`orb-b absolute -bottom-20 -right-10 w-[30rem] h-[30rem] rounded-full blur-3xl ${c.orbB}`} />
        <div className={`orb-c absolute top-1/3 left-1/2 w-[22rem] h-[22rem] rounded-full blur-3xl ${c.orbC}`} />
        <div
          className="absolute inset-0"
          style={{
            backgroundImage: `linear-gradient(${c.grid} 1px, transparent 1px), linear-gradient(90deg, ${c.grid} 1px, transparent 1px)`,
            backgroundSize: "48px 48px",
            maskImage: "radial-gradient(ellipse at 50% 40%, black, transparent 70%)",
            WebkitMaskImage: "radial-gradient(ellipse at 50% 40%, black, transparent 70%)",
          }}
        />
      </div>

      {/* Content */}
      <motion.div variants={container} initial="hidden" animate="show" className="relative z-10 w-full max-w-2xl flex flex-col items-center text-center">
        <motion.div variants={item}>
          <div className={`w-16 h-16 flex items-center justify-center font-bold rounded-2xl text-2xl ${c.logo}`}>B</div>
        </motion.div>

        <motion.span variants={item} className={`mt-5 text-sm font-semibold tracking-[0.2em] uppercase ${c.label}`}>
          BizTrack
        </motion.span>

        <motion.h1 variants={item} className="mt-3 text-4xl sm:text-5xl font-bold tracking-tight leading-[1.1]">
          Your business,
          <br />
          in clear numbers.
        </motion.h1>

        <motion.p variants={item} className={`mt-5 text-[15px] sm:text-base max-w-md leading-relaxed ${c.sub}`}>
          Sales, purchases, invoices, GST and profit — tracked in one clean, fast dashboard.
        </motion.p>

        <motion.div variants={item} className="mt-7 flex flex-wrap items-center justify-center gap-2.5">
          {CHIPS.map((ch) => (
            <span key={ch.label} className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-[13px] font-medium backdrop-blur-sm ${c.chip}`}>
              <ch.icon size={14} className={c.chipIcon} />
              {ch.label}
            </span>
          ))}
        </motion.div>

        <motion.button
          variants={item}
          onClick={onEnter}
          whileHover={{ scale: 1.04 }}
          whileTap={{ scale: 0.97 }}
          className={`group mt-9 inline-flex items-center gap-2 font-bold text-sm px-7 py-3.5 rounded-2xl ${c.cta}`}
        >
          Open Dashboard
          <ArrowRight size={17} className="group-hover:translate-x-1 transition-transform" />
        </motion.button>
      </motion.div>

      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1, duration: 0.8 }} className={`absolute bottom-6 text-[11px] ${c.footer}`}>
        © {new Date().getFullYear()} BizTrack · KiddieKa
      </motion.div>
    </div>
  );
}
