"use client";

import React, { useRef } from "react";
import { useGSAP } from "@gsap/react";
import { gsap } from "gsap";

export function CardGroup({ children, cols }: { children: React.ReactNode; cols?: string }) {
  const containerRef = useRef<HTMLDivElement>(null);

  useGSAP(() => {
    if (!containerRef.current) return;
    const cards = containerRef.current.querySelectorAll(".gsap-card");
    if (cards.length === 0) return;

    gsap.from(cards, {
      y: 24,
      opacity: 0,
      duration: 0.5,
      stagger: 0.07,
      ease: "power2.out",
    });
  }, { scope: containerRef });

  return (
    <div ref={containerRef} className={cols || "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 mb-8"}>
      {children}
    </div>
  );
}

export function Card({ children, className = "", ...props }: { children: React.ReactNode; className?: string } & React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={`gsap-card bg-white rounded-2xl p-5 shadow-[0_1px_3px_rgba(0,0,0,0.04),0_4px_12px_rgba(0,0,0,0.03)] border border-[#e8e8e8] hover:shadow-[0_2px_8px_rgba(0,0,0,0.06),0_8px_24px_rgba(0,0,0,0.04)] transition-shadow duration-300 ${className}`} {...props}>
      {children}
    </div>
  );
}

type StatCardVariant = "profit" | "loss" | "neutral";

const variantStyles: Record<StatCardVariant, { bg: string; icon: string }> = {
  profit:  { bg: "bg-[var(--color-profit-bg)] border border-[var(--color-profit-border)]",  icon: "text-[var(--color-profit-icon)]" },
  loss:    { bg: "bg-[var(--color-loss-bg)] border border-[var(--color-loss-border)]",       icon: "text-[var(--color-loss-icon)]" },
  neutral: { bg: "bg-[#f5f5f5]",                                                              icon: "text-[#666]" },
};

export function StatCard({
  title, value, subtitle, icon: Icon, variant = "neutral",
}: {
  title: string;
  value: React.ReactNode;
  subtitle?: string;
  icon?: React.ElementType;
  variant?: StatCardVariant;
}) {
  const { bg, icon } = variantStyles[variant];
  return (
    <Card className="flex flex-col gap-3" role="region" aria-label={title}>
      <div className="flex items-center justify-between">
        <h3 className="text-[13px] font-medium text-[#888] uppercase tracking-wider">{title}</h3>
        {Icon && (
          <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${bg}`} aria-hidden="true">
            <Icon size={16} className={icon} />
          </div>
        )}
      </div>
      <div className="text-[1.75rem] font-bold text-black leading-tight tracking-tight">{value}</div>
      {subtitle && <p className="text-xs text-[#888]">{subtitle}</p>}
    </Card>
  );
}
