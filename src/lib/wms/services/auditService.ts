import { supabase } from '@/lib/supabase/client';

export async function logAudit(entry: {
  entity_type: string;
  entity_id: string;
  action: string;
  field_name?: string;
  old_value?: string;
  new_value?: string;
  performed_by?: string;
}): Promise<void> {
  if (!supabase) return;
  try {
    await supabase.from('wms_audit_log').insert({
      entity_type: entry.entity_type,
      entity_id: entry.entity_id,
      action: entry.action,
      field_name: entry.field_name,
      old_value: entry.old_value,
      new_value: entry.new_value,
      performed_by: entry.performed_by ?? 'system',
      performed_at: new Date().toISOString(),
    });
  } catch (err) {
    console.error('Failed to write audit log:', err);
  }
}
