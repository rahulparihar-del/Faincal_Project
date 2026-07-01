'use client';

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase/client';

export function useWmsTable<T>(tableName: string) {
  const [data, setData] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetch = useCallback(async () => {
    if (!supabase) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const { data: result, error: err } = await supabase
        .from(tableName)
        .select('*')
        .order('created_at', { ascending: false });

      if (err) throw err;
      setData((result as T[]) ?? []);
    } catch (err) {
      console.error(`Error fetching table ${tableName}:`, err);
      setError(err instanceof Error ? err.message : 'Failed to fetch data');
    } finally {
      setLoading(false);
    }
  }, [tableName]);

  useEffect(() => {
    fetch();
  }, [fetch]);

  const insert = async (row: Partial<T>) => {
    if (!supabase) return null;
    try {
      const { data: result, error: err } = await supabase
        .from(tableName)
        .insert({
          ...row,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (err) throw err;
      await fetch(); // reload
      return result as T;
    } catch (err) {
      console.error(`Error inserting into ${tableName}:`, err);
      setError(err instanceof Error ? err.message : 'Insert failed');
      return null;
    }
  };

  const update = async (id: string, updates: Partial<T>) => {
    if (!supabase) return false;
    try {
      const { error: err } = await supabase
        .from(tableName)
        .update({
          ...updates,
          updated_at: new Date().toISOString(),
        })
        .eq('id', id);

      if (err) throw err;
      await fetch(); // reload
      return true;
    } catch (err) {
      console.error(`Error updating row in ${tableName}:`, err);
      setError(err instanceof Error ? err.message : 'Update failed');
      return false;
    }
  };

  const softDelete = async (id: string) => {
    if (!supabase) return false;
    try {
      const { error: err } = await supabase
        .from(tableName)
        .update({
          deleted_at: new Date().toISOString(),
        })
        .eq('id', id);

      if (err) throw err;
      await fetch();
      return true;
    } catch (err) {
      console.error(`Error deleting row in ${tableName}:`, err);
      setError(err instanceof Error ? err.message : 'Delete failed');
      return false;
    }
  };

  return { data, loading, error, refresh: fetch, insert, update, softDelete };
}
