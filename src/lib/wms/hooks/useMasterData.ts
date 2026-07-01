'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase/client';
import {
  WmsCategory,
  WmsSize,
  WmsColor,
  WmsFabric,
  WmsWarehouse,
  WmsSupplier,
  WmsMarketplaceChannel,
  WmsBarcodeTemplate,
} from '../types';

export function useMasterData() {
  const [categories, setCategories] = useState<WmsCategory[]>([]);
  const [sizes, setSizes] = useState<WmsSize[]>([]);
  const [colors, setColors] = useState<WmsColor[]>([]);
  const [fabrics, setFabrics] = useState<WmsFabric[]>([]);
  const [warehouses, setWarehouses] = useState<WmsWarehouse[]>([]);
  const [suppliers, setSuppliers] = useState<WmsSupplier[]>([]);
  const [channels, setChannels] = useState<WmsMarketplaceChannel[]>([]);
  const [templates, setTemplates] = useState<WmsBarcodeTemplate[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!supabase) {
      setLoading(false);
      return;
    }

    const loadAll = async () => {
      try {
        const [cats, szs, cols, fabs, whs, sups, chans, tmps] = await Promise.all([
          supabase!.from('wms_categories').select('*').eq('is_active', true).order('sort_order', { ascending: true }),
          supabase!.from('wms_sizes').select('*').eq('is_active', true).order('sort_order', { ascending: true }),
          supabase!.from('wms_colors').select('*').eq('is_active', true).order('name', { ascending: true }),
          supabase!.from('wms_fabrics').select('*').eq('is_active', true).order('name', { ascending: true }),
          supabase!.from('wms_warehouses').select('*').eq('is_active', true).order('name', { ascending: true }),
          supabase!.from('wms_suppliers').select('*').eq('is_active', true).order('name', { ascending: true }),
          supabase!.from('wms_marketplace_channels').select('*').eq('is_active', true).order('name', { ascending: true }),
          supabase!.from('wms_barcode_templates').select('*').eq('is_active', true).order('name', { ascending: true }),
        ]);

        setCategories(cats.data ?? []);
        setSizes(szs.data ?? []);
        setColors(cols.data ?? []);
        setFabrics(fabs.data ?? []);
        setWarehouses(whs.data ?? []);
        setSuppliers(sups.data ?? []);
        setChannels(chans.data ?? []);
        setTemplates(tmps.data ?? []);
      } catch (err) {
        console.error('Failed to load master data:', err);
      } finally {
        setLoading(false);
      }
    };

    loadAll();
  }, []);

  return {
    categories,
    sizes,
    colors,
    fabrics,
    warehouses,
    suppliers,
    channels,
    templates,
    loading,
  };
}
