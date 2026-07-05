/**
 * BizTrack — useMeeshoOrders hook
 *
 * Fetches MeeshoOrder rows directly from the meesho_orders Supabase table
 * (structured columns, NOT the legacy data jsonb pattern).
 *
 * Returns [orders, isReady, refetch] — read-only; all writes go through
 * orderService.mergeOrders() which then triggers a refetch.
 */

import { useState, useEffect, useCallback } from "react";
import { supabase, isSupabaseConfigured } from "@/lib/supabase/client";
import type { MeeshoOrder } from "@/lib/meesho/types";

export function useMeeshoOrders(): [MeeshoOrder[], boolean, () => void] {
  const [orders, setOrders] = useState<MeeshoOrder[]>([]);
  const [isReady, setIsReady] = useState(false);

  const fetchOrders = useCallback(async () => {
    if (!isSupabaseConfigured || !supabase) {
      setIsReady(true);
      return;
    }

    const { data, error } = await supabase
      .from("meesho_orders")
      .select("*")
      .order("order_date", { ascending: false });

    if (error) {
      console.error("[useMeeshoOrders] fetch failed:", error.message);
    } else {
      setOrders((data ?? []) as MeeshoOrder[]);
    }
    setIsReady(true);
  }, []);

  useEffect(() => {
    void fetchOrders();
  }, [fetchOrders]);

  return [orders, isReady, fetchOrders];
}
