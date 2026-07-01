'use client';

import React from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { ArrowUpRight, ArrowDownRight } from 'lucide-react';

interface StatCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: React.ReactNode;
  iconBg?: string; // e.g. 'bg-indigo-100 dark:bg-indigo-900/30'
  trend?: { value: number; label: string; positive: boolean };
  highlight?: boolean; // makes card stand out with indigo border
  loading?: boolean;
  href?: string; // if provided, whole card is clickable
  badge?: string; // small badge text in top right
}

export function StatCard({
  title,
  value,
  subtitle,
  icon,
  iconBg = 'bg-slate-100 dark:bg-slate-800',
  trend,
  highlight = false,
  loading = false,
  href,
  badge,
}: StatCardProps) {
  const cardContent = (
    <div
      className={`relative h-full bg-white dark:bg-[#1e293b] rounded-2xl border p-5 transition-all duration-250 cursor-default ${
        highlight
          ? 'border-slate-950 dark:border-white shadow-md shadow-slate-900/10 ring-1 ring-slate-950/10'
          : 'border-slate-200 dark:border-slate-800/80 shadow-sm hover:shadow-md'
      }`}
    >
      {loading ? (
        <div className="space-y-3 animate-shimmer">
          <div className="flex justify-between items-center">
            <div className="w-10 h-10 bg-slate-200 dark:bg-slate-700 rounded-xl" />
            <div className="w-12 h-4 bg-slate-200 dark:bg-slate-700 rounded" />
          </div>
          <div className="w-24 h-8 bg-slate-200 dark:bg-slate-700 rounded" />
          <div className="w-32 h-4 bg-slate-200 dark:bg-slate-700 rounded" />
        </div>
      ) : (
        <>
          {badge && (
            <span className="absolute top-4 right-4 bg-slate-100 dark:bg-slate-900 text-slate-800 dark:text-slate-250 text-[10px] font-bold px-2.5 py-0.5 rounded-full border border-slate-200 dark:border-slate-800">
              {badge}
            </span>
          )}
          <div className="flex justify-between items-start">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-slate-700 dark:text-slate-200 ${iconBg}`}>
              {icon}
            </div>
            {trend && (
              <span
                className={`flex items-center gap-0.5 text-xs font-semibold px-2 py-0.5 rounded-full ${
                  trend.positive
                    ? 'bg-emerald-50 dark:bg-emerald-950/20 text-emerald-600 dark:text-emerald-400'
                    : 'bg-rose-50 dark:bg-rose-950/20 text-rose-600 dark:text-rose-400'
                }`}
              >
                {trend.positive ? <ArrowUpRight className="w-3.5 h-3.5" /> : <ArrowDownRight className="w-3.5 h-3.5" />}
                {trend.value}%
              </span>
            )}
          </div>
          <div className="mt-4">
            <h3 className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
              {title}
            </h3>
            <p className="text-2xl font-extrabold text-slate-800 dark:text-white mt-1 tracking-tight">
              {value}
            </p>
            {(subtitle || (trend && trend.label)) && (
              <p className="text-xs text-slate-405 dark:text-slate-500 mt-1 font-medium">
                {subtitle ?? trend?.label}
              </p>
            )}
          </div>
        </>
      )}
    </div>
  );

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ y: -4, scale: 1.015 }}
      transition={{ duration: 0.25, ease: 'easeOut' }}
      className="h-full"
    >
      {href ? (
        <Link href={href} className="block h-full cursor-pointer">
          {cardContent}
        </Link>
      ) : (
        cardContent
      )}
    </motion.div>
  );
}
