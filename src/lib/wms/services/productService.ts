import { supabase } from '@/lib/supabase/client';
import { WmsProduct, WmsProductVariant } from '../types';
import { logAudit } from './auditService';
import { generateBarcodeValue } from '../barcode-generator';

export async function getProducts(filters?: {
  categoryId?: string;
  status?: string;
  search?: string;
}): Promise<WmsProduct[]> {
  if (!supabase) return [];
  try {
    let query = supabase
      .from('wms_products')
      .select(`
        *,
        category:wms_categories(id, name, code),
        type:wms_product_types(id, name, code),
        fabric:wms_fabrics(id, name, code),
        variants:wms_product_variants(
          id, sku, barcode, mrp, selling_price, cost_price, status, low_stock_threshold,
          size:wms_sizes(id, label, code),
          color:wms_colors(id, name, hex_code)
        )
      `)
      .is('deleted_at', null)
      .order('product_name', { ascending: true });

    if (filters?.categoryId) query = query.eq('category_id', filters.categoryId);
    if (filters?.status) query = query.eq('status', filters.status);
    if (filters?.search) query = query.ilike('product_name', `%${filters.search}%`);

    const { data, error } = await query;
    if (error) throw error;
    return (data as WmsProduct[]) ?? [];
  } catch (err) {
    console.error('Failed to get products:', err);
    return [];
  }
}

export async function createProduct(product: {
  category_id: string;
  type_id?: string;
  fabric_id?: string;
  product_name: string;
  print_name: string;
  description?: string;
  hsn?: string;
  gst_percent?: number;
}): Promise<WmsProduct | null> {
  if (!supabase) return null;
  try {
    const { data, error } = await supabase
      .from('wms_products')
      .insert({
        ...product,
        status: 'active',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) throw error;

    logAudit({
      entity_type: 'product',
      entity_id: data.id,
      action: 'created',
      new_value: data.product_name,
    });

    return data as WmsProduct;
  } catch (err) {
    console.error('Failed to create product:', err);
    return null;
  }
}

export async function updateProduct(
  id: string,
  updates: Partial<WmsProduct>
): Promise<boolean> {
  if (!supabase) return false;
  try {
    const { error } = await supabase
      .from('wms_products')
      .update({
        ...updates,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id);

    if (error) throw error;

    logAudit({
      entity_type: 'product',
      entity_id: id,
      action: 'updated',
      new_value: JSON.stringify(updates),
    });

    return true;
  } catch (err) {
    console.error('Failed to update product:', err);
    return false;
  }
}

export async function softDeleteProduct(id: string): Promise<boolean> {
  if (!supabase) return false;
  try {
    const { error } = await supabase
      .from('wms_products')
      .update({
        deleted_at: new Date().toISOString(),
      })
      .eq('id', id);

    if (error) throw error;

    logAudit({
      entity_type: 'product',
      entity_id: id,
      action: 'deleted',
    });

    return true;
  } catch (err) {
    console.error('Failed to delete product:', err);
    return false;
  }
}

export async function createVariant(variant: {
  product_id: string;
  size_id: string;
  color_id?: string;
  sku: string;
  weight_grams?: number;
  cost_price?: number;
  selling_price?: number;
  mrp?: number;
  low_stock_threshold?: number;
}): Promise<WmsProductVariant | null> {
  if (!supabase) return null;
  try {
    const barcode = generateBarcodeValue(variant.sku);
    const { data, error } = await supabase
      .from('wms_product_variants')
      .insert({
        ...variant,
        barcode,
        status: 'active',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) throw error;

    logAudit({
      entity_type: 'variant',
      entity_id: data.id,
      action: 'created',
      new_value: data.sku,
    });

    return data as WmsProductVariant;
  } catch (err) {
    console.error('Failed to create variant:', err);
    return null;
  }
}

export async function updateVariant(
  id: string,
  updates: Partial<WmsProductVariant>
): Promise<boolean> {
  if (!supabase) return false;
  try {
    const { error } = await supabase
      .from('wms_product_variants')
      .update({
        ...updates,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id);

    if (error) throw error;

    logAudit({
      entity_type: 'variant',
      entity_id: id,
      action: 'updated',
      new_value: JSON.stringify(updates),
    });

    return true;
  } catch (err) {
    console.error('Failed to update variant:', err);
    return false;
  }
}

export async function getVariantByBarcode(
  barcode: string
): Promise<WmsProductVariant | null> {
  if (!supabase) return null;
  try {
    const { data, error } = await supabase
      .from('wms_product_variants')
      .select(`
        *,
        product:wms_products(id, product_name, print_name),
        size:wms_sizes(id, label, code),
        color:wms_colors(id, name, hex_code)
      `)
      .eq('barcode', barcode)
      .is('deleted_at', null)
      .single();

    if (error) return null;
    return data as WmsProductVariant;
  } catch (err) {
    return null;
  }
}

export async function getVariantBySku(sku: string): Promise<WmsProductVariant | null> {
  if (!supabase) return null;
  try {
    const { data, error } = await supabase
      .from('wms_product_variants')
      .select(`
        *,
        product:wms_products(id, product_name, print_name),
        size:wms_sizes(id, label, code),
        color:wms_colors(id, name, hex_code)
      `)
      .eq('sku', sku)
      .is('deleted_at', null)
      .single();

    if (error) return null;
    return data as WmsProductVariant;
  } catch (err) {
    return null;
  }
}
