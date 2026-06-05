"use client";

import { useState, useEffect } from "react";
import { supabase, isSupabaseConfigured } from "@/lib/supabase/client";

export interface UsageInfo {
  usedBytes: number;
  limitBytes: number;
  percent: number;
}

export type UsageState = "loading" | "ready" | "unavailable";

/**
 * Reads the Supabase database size via the `biztrack_db_usage` RPC and
 * expresses it as a percentage of the free-tier 500 MB limit.
 * Falls back to "unavailable" if the function/RPC isn't set up.
 */
export function useSupabaseUsage(): { info: UsageInfo | null; state: UsageState } {
  const [info, setInfo] = useState<UsageInfo | null>(null);
  const [state, setState] = useState<UsageState>(isSupabaseConfigured ? "loading" : "unavailable");

  useEffect(() => {
    if (!isSupabaseConfigured || !supabase) {
      setState("unavailable");
      return;
    }
    let active = true;
    (async () => {
      const { data, error } = await supabase.rpc("biztrack_db_usage");
      if (!active) return;
      if (error || !data) {
        setState("unavailable");
        return;
      }
      const used = Number(data.used_bytes) || 0;
      const limit = Number(data.limit_bytes) || 524288000;
      setInfo({ usedBytes: used, limitBytes: limit, percent: Math.min(100, (used / limit) * 100) });
      setState("ready");
    })();
    return () => {
      active = false;
    };
  }, []);

  return { info, state };
}
