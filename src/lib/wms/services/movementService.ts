import { supabase } from '@/lib/supabase/client';
import { StockMovementType, InventoryBucket } from '../types';
import { generateMovementId } from '../sku-generator';
import { logAudit } from './auditService';

interface CreateMovementParams {
  movement_type: StockMovementType;
  variant_id: string;
  warehouse_id: string;
  location_id?: string;
  batch_id?: string;
  from_bucket?: InventoryBucket;
  to_bucket?: InventoryBucket;
  quantity: number;
  reference_id?: string;
  reference_type?: string;
  channel_id?: string;
  performed_by?: string;
  remarks?: string;
}

export async function createStockMovement(params: CreateMovementParams): Promise<{ id: string } | null> {
  if (!supabase) {
    console.warn('Supabase not initialized — stock movement not created');
    return null;
  }

  // Try to generate ID from Supabase stored procedure
  let movementId: string;
  try {
    const { data, error } = await supabase.rpc('wms_next_id', { p_prefix: 'SM' });
    if (error || !data) throw error || new Error('No ID returned');
    movementId = data;
  } catch (err) {
    console.warn('Supabase rpc wms_next_id failed, falling back to local ID generator:', err);
    movementId = generateMovementId('SM');
  }

  const newMovement = {
    id: movementId,
    movement_type: params.movement_type,
    variant_id: params.variant_id,
    warehouse_id: params.warehouse_id,
    location_id: params.location_id,
    batch_id: params.batch_id,
    from_bucket: params.from_bucket,
    to_bucket: params.to_bucket,
    quantity: params.quantity,
    reference_id: params.reference_id,
    reference_type: params.reference_type,
    channel_id: params.channel_id,
    performed_by: params.performed_by ?? 'user',
    performed_at: new Date().toISOString(),
    remarks: params.remarks,
  };

  const { error } = await supabase.from('wms_stock_movements').insert(newMovement);

  if (error) {
    console.error('Failed to insert stock movement ledger row:', error);
    return null;
  }

  // Record audit log entry (fire-and-forget)
  logAudit({
    entity_type: 'stock_movement',
    entity_id: movementId,
    action: 'created',
    new_value: JSON.stringify({
      type: params.movement_type,
      qty: params.quantity,
      from: params.from_bucket,
      to: params.to_bucket,
    }),
    performed_by: params.performed_by,
  });

  return { id: movementId };
}
