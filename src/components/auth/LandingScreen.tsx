"use client";

import React, { useRef } from "react";
import { motion, Variants } from "framer-motion";
import { useGSAP } from "@gsap/react";
import { gsap } from "gsap";
import { ArrowRight, TrendingUp, FileText, BarChart3, ShoppingCart } from "lucide-react";

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

  useGSAP(
    () => {
      gsap.to(".orb-a", { x: 60, y: -40, scale: 1.1, duration: 9, repeat: -1, yoyo: true, ease: "sine.inOut" });
      gsap.to(".orb-b", { x: -70, y: 50, scale: 1.15, duration: 11, repeat: -1, yoyo: true, ease: "sine.inOut" });
      gsap.to(".orb-c", { x: 40, y: 60, duration: 13, repeat: -1, yoyo: true, ease: "sine.inOut" });
    },
    { scope: root }
  );

  return (
    <div
      ref={root}
      className="relative h-screen w-full overflow-hidden bg-[#0a0a0a] text-white flex flex-col items-center justify-center px-6"
    >
      {/* Animated background */}
      <div className="pointer-events-none absolute inset-0">
        <div className="orb-a absolute -top-24 -left-16 w-[26rem] h-[26rem] rounded-full bg-white/[0.07] blur-3xl" />
        <div className="orb-b absolute -bottom-20 -right-10 w-[30rem] h-[30rem] rounded-full bg-indigo-500/[0.10] blur-3xl" />
        <div className="orb-c absolute top-1/3 left-1/2 w-[22rem] h-[22rem] rounded-full bg-white/[0.04] blur-3xl" />
        <div
          className="absolute inset-0"
          style={{
            backgroundImage:
              "linear-gradient(rgba(255,255,255,0.045) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.045) 1px, transparent 1px)",
            backgroundSize: "48px 48px",
            maskImage: "radial-gradient(ellipse at 50% 40%, black, transparent 70%)",
            WebkitMaskImage: "radial-gradient(ellipse at 50% 40%, black, transparent 70%)",
          }}
        />
      </div>

      {/* Content */}
      <motion.div
        variants={container}
        initial="hidden"
        animate="show"
        className="relative z-10 w-full max-w-2xl flex flex-col items-center text-center"
      >
        <motion.div variants={item}>
          <div className="w-16 h-16 bg-white text-black flex items-center justify-center font-bold rounded-2xl text-2xl shadow-[0_8px_30px_rgba(255,255,255,0.18)]">
            B
          </div>
        </motion.div>

        <motion.span variants={item} className="mt-5 text-sm font-semibold tracking-[0.2em] text-white/50 uppercase">
          BizTrack
        </motion.span>

        <motion.h1 variants={item} className="mt-3 text-4xl sm:text-5xl font-bold tracking-tight leading-[1.1]">
          Your business,
          <br />
          in clear numbers.
        </motion.h1>

        <motion.p variants={item} className="mt-5 text-[15px] sm:text-base text-white/60 max-w-md leading-relaxed">
          Sales, purchases, invoices, GST and profit — tracked in one clean, fast dashboard.
        </motion.p>

        <motion.div variants={item} className="mt-7 flex flex-wrap items-center justify-center gap-2.5">
          {CHIPS.map((c) => (
            <span
              key={c.label}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/[0.06] border border-white/10 text-[13px] font-medium text-white/80 backdrop-blur-sm"
            >
              <c.icon size={14} className="text-white/70" />
              {c.label}
            </span>
          ))}
        </motion.div>

        <motion.button
          variants={item}
          onClick={onEnter}
          whileHover={{ scale: 1.04 }}
          whileTap={{ scale: 0.97 }}
          className="group mt-9 inline-flex items-center gap-2 bg-white text-black font-bold text-sm px-7 py-3.5 rounded-2xl shadow-[0_8px_30px_rgba(255,255,255,0.15)]"
        >
          Open Dashboard
          <ArrowRight size={17} className="group-hover:translate-x-1 transition-transform" />
        </motion.button>
      </motion.div>

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1, duration: 0.8 }}
        className="absolute bottom-6 text-[11px] text-white/30"
      >
        © {new Date().getFullYear()} BizTrack · KiddieKa
      </motion.div>
    </div>
  );
}
