import { useState, useEffect, useCallback, useRef } from "react";
import { supabase, isSupabaseConfigured } from "@/lib/supabase/client";

/**
 * Drop-in replacement for `useLocalStorage` that persists an array of records
 * to a Supabase table shaped as `{ id text pk, data jsonb, created_at }`.
 *
 * It keeps the exact same `[value, setValue, isReady]` signature, so the rest
 * of the app (pages, DataContext) needs no changes. Writes are computed by
 * diffing the previous and next arrays by `id`:
 *   - new / changed records  -> upsert
 *   - removed records        -> delete
 *
 * If Supabase isn't configured, it transparently falls back to localStorage so
 * the app keeps working during setup.
 *
 * Pass `noLocalStorage: true` for sensitive tables (e.g. vault) so that data
 * is never cached in the browser's readable localStorage — Supabase only.
 */
export function useSupabaseTable<T extends { id: string }>(
  table: string,
  storageKey: string,
  initialValue: T[],
  { noLocalStorage = false }: { noLocalStorage?: boolean } = {}
) {
  const [data, setData] = useState<T[]>(initialValue);
  const [isReady, setIsReady] = useState(false);
  // isSynced becomes true once Supabase has responded (or immediately if not configured).
  const [isSynced, setIsSynced] = useState(!isSupabaseConfigured);
  // Mirror of the latest data so writes can diff without stale closures.
  const dataRef = useRef<T[]>(initialValue);

  const readLocal = useCallback((): T[] => {
    if (noLocalStorage) return initialValue;
    try {
      const raw = window.localStorage.getItem(storageKey);
      return raw ? (JSON.parse(raw) as T[]) : initialValue;
    } catch (error) {
      console.warn(`Error reading localStorage key "${storageKey}":`, error);
      return initialValue;
    }
    // initialValue intentionally excluded; it's a stable [] from the caller.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storageKey, noLocalStorage]);

  // ── Initial load (with one-time localStorage -> Supabase migration) ──
  useEffect(() => {
    let active = true;
    const migratedFlag = `${storageKey}__migrated`;

    // If noLocalStorage, purge any previously cached data for this key.
    if (noLocalStorage) {
      try {
        window.localStorage.removeItem(storageKey);
        window.localStorage.removeItem(migratedFlag);
      } catch { /* ignore */ }
    }

    // 1. Immediately load local cache so the UI is ready instantly
    const local = readLocal(); // returns [] when noLocalStorage=true
    setData(local);
    dataRef.current = local;
    setIsReady(true);

    // 2. Fetch fresh data from Supabase in the background if configured
    if (isSupabaseConfigured && supabase) {
      (async () => {
        const { data: rows, error } = await supabase
          .from(table)
          .select("data, created_at")
          .order("created_at", { ascending: false });

        if (!active) return;

        if (error) {
          console.error(`Supabase load failed for "${table}", using local cache:`, error.message);
        } else {
          let records = (rows ?? []).map((r) => (r as { data: T }).data);

          // First run after configuring Supabase: seed any existing
          // localStorage data into the empty table so nothing is lost.
          const alreadyMigrated = (() => {
            try {
              return window.localStorage.getItem(migratedFlag) === "1";
            } catch {
              return false;
            }
          })();

          if (records.length === 0 && local.length > 0) {
            // Load the local cache as fallback so client view is never wiped
            records = local;

            if (!alreadyMigrated) {
              const { error: seedError } = await supabase
                .from(table)
                .upsert(local.map((r) => ({ id: r.id, data: r })), { onConflict: "id" });
              if (seedError) {
                console.warn(`Supabase sync failed for "${table}" (likely RLS policy block):`, seedError.message);
              }
              try {
                window.localStorage.setItem(migratedFlag, "1");
              } catch {
                /* ignore */
              }
            }
          }

          if (!active) return;
          setData(records);
          dataRef.current = records;

          // Keep localStorage updated with fresh data (skip for noLocalStorage tables)
          if (!noLocalStorage) {
            try {
              window.localStorage.setItem(storageKey, JSON.stringify(records));
            } catch (err) {
              console.warn(`Error writing localStorage cache for key "${storageKey}":`, err);
            }
          }
        }

        // Mark as synced regardless of error so callers are never blocked forever.
        if (active) setIsSynced(true);
      })();
    }

    return () => {
      active = false;
    };
  }, [table, storageKey, readLocal]);

  // ── Persist a diff to Supabase (or localStorage fallback) ──
  const persist = useCallback(
    (prev: T[], next: T[]) => {
      // Write to localStorage as a cache mirror — skipped for noLocalStorage tables.
      if (!noLocalStorage) {
        try {
          window.localStorage.setItem(storageKey, JSON.stringify(next));
        } catch (error) {
          console.warn(`Error writing localStorage cache for key "${storageKey}":`, error);
        }
      }

      if (!isSupabaseConfigured || !supabase) {
        return;
      }

      const prevById = new Map(prev.map((r) => [r.id, r]));
      const nextIds = new Set(next.map((r) => r.id));

      const toUpsert = next.filter((r) => {
        const old = prevById.get(r.id);
        return !old || JSON.stringify(old) !== JSON.stringify(r);
      });
      const toDelete = prev.filter((r) => !nextIds.has(r.id)).map((r) => r.id);

      void (async () => {
        try {
          if (toUpsert.length > 0) {
            const { error } = await supabase
              .from(table)
              .upsert(
                toUpsert.map((r) => ({ id: r.id, data: r })),
                { onConflict: "id" }
              );
            if (error) throw error;
          }
          if (toDelete.length > 0) {
            const { error } = await supabase.from(table).delete().in("id", toDelete);
            if (error) throw error;
          }
        } catch (error) {
          let message = String(error);
          if (error && typeof error === "object") {
            message = (error as any).message || (error as any).details || JSON.stringify(error);
          }
          console.error(`Supabase sync failed for "${table}":`, message);
        }
      })();
    },
    [table, storageKey, noLocalStorage]
  );

  const setValue = useCallback(
    (value: T[] | ((prev: T[]) => T[])) => {
      setData((prev) => {
        const next = value instanceof Function ? value(prev) : value;
        dataRef.current = next;
        // Upserts/deletes are keyed by id and therefore idempotent, so this is
        // safe even under React's double-invoked updaters in development.
        persist(prev, next);
        return next;
      });
    },
    [persist]
  );

  return [data, setValue, isReady, isSynced] as const;
}
