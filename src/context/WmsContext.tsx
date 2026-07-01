'use client';

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from 'react';
import { supabase } from '@/lib/supabase/client';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface WmsCategory {
  id: string;
  name: string;
  slug: string;
  sort_order: number;
  is_active: boolean;
}

export interface WmsWarehouse {
  id: string;
  name: string;
  code: string;
  location?: string;
  is_default: boolean;
  is_active: boolean;
}

interface WmsContextType {
  categories: WmsCategory[];
  warehouses: WmsWarehouse[];
  selectedWarehouseId: string;
  setSelectedWarehouseId: (id: string) => void;
  isReady: boolean;
  refresh: () => void;
}

// ─── Context ──────────────────────────────────────────────────────────────────

const WmsContext = createContext<WmsContextType | undefined>(undefined);

// ─── Provider ─────────────────────────────────────────────────────────────────

export function WmsProvider({ children }: { children: React.ReactNode }) {
  const [categories, setCategories] = useState<WmsCategory[]>([]);
  const [warehouses, setWarehouses] = useState<WmsWarehouse[]>([]);
  const [selectedWarehouseId, setSelectedWarehouseId] = useState<string>('');
  const [isReady, setIsReady] = useState(false);

  const load = useCallback(async () => {
    setIsReady(false);

    // Gracefully handle missing supabase client
    if (!supabase) {
      setIsReady(true);
      return;
    }

    try {
      const [catRes, whRes] = await Promise.all([
        supabase
          .from('wms_categories')
          .select('*')
          .eq('is_active', true)
          .order('sort_order', { ascending: true }),
        supabase
          .from('wms_warehouses')
          .select('*')
          .eq('is_active', true)
          .order('name', { ascending: true }),
      ]);

      const cats: WmsCategory[] = catRes.data ?? [];
      const whs: WmsWarehouse[] = whRes.data ?? [];

      setCategories(cats);
      setWarehouses(whs);

      // Pick default warehouse: is_default=true first, otherwise first row
      if (whs.length > 0) {
        const defaultWh = whs.find((w) => w.is_default) ?? whs[0];
        setSelectedWarehouseId((prev) => prev || defaultWh.id);
      }
    } catch {
      // Silently fail — tables may not exist yet
    } finally {
      setIsReady(true);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <WmsContext.Provider
      value={{
        categories,
        warehouses,
        selectedWarehouseId,
        setSelectedWarehouseId,
        isReady,
        refresh: load,
      }}
    >
      {children}
    </WmsContext.Provider>
  );
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useWms(): WmsContextType {
  const ctx = useContext(WmsContext);
  if (ctx === undefined) {
    throw new Error('useWms must be used within a WmsProvider');
  }
  return ctx;
}
