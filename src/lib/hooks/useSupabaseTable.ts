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
 */
export function useSupabaseTable<T extends { id: string }>(
  table: string,
  storageKey: string,
  initialValue: T[]
) {
  const [data, setData] = useState<T[]>(initialValue);
  const [isReady, setIsReady] = useState(false);
  // Mirror of the latest data so writes can diff without stale closures.
  const dataRef = useRef<T[]>(initialValue);

  const readLocal = useCallback((): T[] => {
    try {
      const raw = window.localStorage.getItem(storageKey);
      return raw ? (JSON.parse(raw) as T[]) : initialValue;
    } catch (error) {
      console.warn(`Error reading localStorage key "${storageKey}":`, error);
      return initialValue;
    }
    // initialValue intentionally excluded; it's a stable [] from the caller.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storageKey]);

  // ── Initial load (with one-time localStorage -> Supabase migration) ──
  useEffect(() => {
    let active = true;
    const migratedFlag = `${storageKey}__migrated`;

    (async () => {
      if (isSupabaseConfigured && supabase) {
        const { data: rows, error } = await supabase
          .from(table)
          .select("data, created_at")
          .order("created_at", { ascending: false });

        if (!active) return;

        if (error) {
          console.error(`Supabase load failed for "${table}", using local cache:`, error.message);
          const local = readLocal();
          setData(local);
          dataRef.current = local;
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

          if (records.length === 0 && !alreadyMigrated) {
            const local = readLocal();
            if (local.length > 0) {
              const { error: seedError } = await supabase
                .from(table)
                .upsert(local.map((r) => ({ id: r.id, data: r })), { onConflict: "id" });
              if (!seedError) {
                records = local;
              } else {
                console.error(`Supabase migration failed for "${table}":`, seedError.message);
              }
            }
            try {
              window.localStorage.setItem(migratedFlag, "1");
            } catch {
              /* ignore */
            }
          }

          if (!active) return;
          setData(records);
          dataRef.current = records;
        }
      } else {
        const local = readLocal();
        setData(local);
        dataRef.current = local;
      }

      if (active) setIsReady(true);
    })();

    return () => {
      active = false;
    };
  }, [table, storageKey, readLocal]);

  // ── Persist a diff to Supabase (or localStorage fallback) ──
  const persist = useCallback(
    (prev: T[], next: T[]) => {
      if (!isSupabaseConfigured || !supabase) {
        try {
          window.localStorage.setItem(storageKey, JSON.stringify(next));
        } catch (error) {
          console.warn(`Error writing localStorage key "${storageKey}":`, error);
        }
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
          const message = error instanceof Error ? error.message : String(error);
          console.error(`Supabase sync failed for "${table}":`, message);
        }
      })();
    },
    [table, storageKey]
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

  return [data, setValue, isReady] as const;
}
