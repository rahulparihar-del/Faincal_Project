"use client";

import { useState, useEffect } from "react";
import { supabase, isSupabaseConfigured } from "@/lib/supabase/client";

export type ConnectionStatus = "checking" | "connected" | "local" | "error";

/**
 * Reports the live connection state to Supabase:
 *  - "local"      → env vars not set, app is using localStorage
 *  - "checking"   → configured, verifying reachability
 *  - "connected"  → a lightweight query succeeded
 *  - "error"      → configured but the query failed (unreachable / schema issue)
 */
export function useSupabaseStatus(): ConnectionStatus {
  const [status, setStatus] = useState<ConnectionStatus>(
    isSupabaseConfigured ? "checking" : "local"
  );

  useEffect(() => {
    if (!isSupabaseConfigured || !supabase) {
      setStatus("local");
      return;
    }

    let active = true;
    (async () => {
      const { error } = await supabase.from("manufacturers").select("id").limit(1);
      if (!active) return;
      setStatus(error ? "error" : "connected");
    })();

    return () => {
      active = false;
    };
  }, []);

  return status;
}
