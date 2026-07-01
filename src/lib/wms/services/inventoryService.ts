import { supabase } from '@/lib/supabase/client';
import { WmsInventorySnapshot } from '../types';

export async function getInventorySnapshot(
  warehouseId?: string
): Promise<WmsInventorySnapshot[]> {
  if (!supabase) return [];
  try {
    let query = supabase
      .from('wms_inventory_snapshot')
      .select(`
        *,
        variant:wms_product_variants(
          id, sku, barcode, mrp, selling_price, cost_price, low_stock_threshold, status,
          product:wms_products(id, product_name, print_name),
          size:wms_sizes(id, label, code),
          color:wms_colors(id, name, hex_code)
        ),
        warehouse:wms_warehouses(id, name, code)
      `)
      .order('updated_at', { ascending: false });

    if (warehouseId) {
      query = query.eq('warehouse_id', warehouseId);
    }

    const { data, error } = await query;
    if (error) throw error;
    return (data as unknown as WmsInventorySnapshot[]) ?? [];
  } catch (err) {
    console.error('Failed to get inventory snapshot:', err);
    return [];
  }
}

export async function getLowStockItems(
  warehouseId?: string,
  threshold?: number
): Promise<WmsInventorySnapshot[]> {
  const snapshot = await getInventorySnapshot(warehouseId);
  return snapshot.filter((item) => {
    const limit = item.variant?.low_stock_threshold ?? threshold ?? 10;
    return (item.available ?? 0) <= limit;
  });
}

interface SnapshotRow {
  available: number | null;
  reserved: number | null;
  packed: number | null;
  dispatched: number | null;
  qc_pending: number | null;
  returned: number | null;
  damaged: number | null;
  wrong_return: number | null;
  lost: number | null;
  transfer: number | null;
  rto: number | null;
  blocked: number | null;
  total_stock: number | null;
  variant: {
    cost_price: number | null;
    low_stock_threshold: number | null;
  } | null;
}

export async function getDashboardStats(warehouseId?: string) {
  if (!supabase) return null;

  const today = new Date().toISOString().slice(0, 10);

  try {
    // 1. Get snapshot counts
    let snapshotQuery = supabase
      .from('wms_inventory_snapshot')
      .select(`
        available, reserved, packed, dispatched, qc_pending, returned,
        damaged, wrong_return, lost, transfer, rto, blocked, total_stock,
        variant:wms_product_variants(cost_price, low_stock_threshold)
      `);
    
    if (warehouseId) {
      snapshotQuery = snapshotQuery.eq('warehouse_id', warehouseId);
    }

    const { data: snapshotData } = await snapshotQuery;

    // 2. Fetch today's movements to calculate aggregate metrics
    let movementsQuery = supabase
      .from('wms_stock_movements')
      .select('movement_type, quantity')
      .gte('performed_at', `${today}T00:00:00.000Z`)
      .lte('performed_at', `${today}T23:59:59.999Z`);

    if (warehouseId) {
      movementsQuery = movementsQuery.eq('warehouse_id', warehouseId);
    }

    const { data: movementsData } = await movementsQuery;

    // Formulate results
    const stats = {
      totalStock: 0,
      inventoryValue: 0,
      available: 0,
      reserved: 0,
      qcPending: 0,
      damaged: 0,
      wrongReturn: 0,
      rto: 0,
      lowStockCount: 0,
      todayInward: 0,
      todayOutward: 0,
      todayReturns: 0,
      todayRto: 0,
    };

    if (snapshotData) {
      (snapshotData as unknown as SnapshotRow[]).forEach((row) => {
        stats.totalStock += row.total_stock ?? 0;
        stats.available += row.available ?? 0;
        stats.reserved += row.reserved ?? 0;
        stats.qcPending += row.qc_pending ?? 0;
        stats.damaged += row.damaged ?? 0;
        stats.wrongReturn += row.wrong_return ?? 0;
        stats.rto += row.rto ?? 0;

        const cost = row.variant?.cost_price ?? 0;
        stats.inventoryValue += (row.available ?? 0) * cost;

        const limit = row.variant?.low_stock_threshold ?? 10;
        if ((row.available ?? 0) <= limit) {
          stats.lowStockCount++;
        }
      });
    }

    if (movementsData) {
      const inboundTypes = [
        'opening', 'production', 'purchase', 'transfer_in',
        'customer_return', 'marketplace_return', 'qc_pass'
      ];
      const outboundTypes = [
        'sale_amazon', 'sale_flipkart', 'sale_meesho', 'sale_website',
        'sale_offline', 'transfer_out', 'qc_fail', 'purchase_return'
      ];
      const returnTypes = ['customer_return', 'marketplace_return'];
      const rtoTypes = ['rto'];

      movementsData.forEach((m) => {
        if (inboundTypes.includes(m.movement_type)) stats.todayInward += m.quantity;
        if (outboundTypes.includes(m.movement_type)) stats.todayOutward += m.quantity;
        if (returnTypes.includes(m.movement_type)) stats.todayReturns += m.quantity;
        if (rtoTypes.includes(m.movement_type)) stats.todayRto += m.quantity;
      });
    }

    return stats;
  } catch (err) {
    console.error('Failed to get dashboard statistics:', err);
    return null;
  }
}
