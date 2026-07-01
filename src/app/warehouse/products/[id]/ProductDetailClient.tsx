'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase/client';
import { updateProduct, createVariant } from '@/lib/wms/services/productService';
import { useMasterData } from '@/lib/wms/hooks/useMasterData';
import { DataTable } from '@/components/wms/ui/DataTable';
import { SkuTag } from '@/components/wms/ui/SkuTag';
import { BarcodeDisplay } from '@/components/wms/ui/BarcodeDisplay';
import { useWmsToast } from '@/components/wms/ui/WmsToast';
import { ArrowLeft, Edit, Layers, Plus, Save, Printer } from 'lucide-react';
import Link from 'next/link';
import { WmsProduct, WmsProductVariant } from '@/lib/wms/types';

interface ProductDetailClientProps {
  productId: string;
}

export default function ProductDetailClient({ productId }: ProductDetailClientProps) {
  const { categories, sizes, colors, loading: masterLoading } = useMasterData();
  const { success, error: toastError } = useWmsToast();

  const [product, setProduct] = useState<WmsProduct | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [showAddVariant, setShowAddVariant] = useState(false);
  const [selectedVariant, setSelectedVariant] = useState<WmsProductVariant | null>(null);

  // Edit Product states
  const [editForm, setEditForm] = useState({
    product_name: '',
    print_name: '',
    description: '',
    hsn: '',
    gst_percent: 5,
  });

  // Add Variant state
  const [variantForm, setVariantForm] = useState({
    size_id: '',
    color_id: '',
    print_code: '',
    cost_price: 0,
    selling_price: 0,
    mrp: 0,
    low_stock_threshold: 10,
    weight_grams: 0,
  });

  const loadProduct = useCallback(async () => {
    if (!supabase) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('wms_products')
        .select(`
          *,
          category:wms_categories(id, name, code),
          type:wms_product_types(id, name, code),
          fabric:wms_fabrics(id, name, code),
          variants:wms_product_variants(
            id, sku, barcode, mrp, selling_price, cost_price, status, low_stock_threshold, weight_grams,
            size:wms_sizes(id, label, code),
            color:wms_colors(id, name, hex_code)
          )
        `)
        .eq('id', productId)
        .is('deleted_at', null)
        .single();

      if (error) throw error;
      if (data) {
        setProduct(data as any);
        setEditForm({
          product_name: data.product_name,
          print_name: data.print_name,
          description: data.description || '',
          hsn: data.hsn || '',
          gst_percent: data.gst_percent,
        });
      }
    } catch (err) {
      console.error('Failed to load product details:', err);
      toastError('Failed to load product details.');
    } finally {
      setLoading(false);
    }
  }, [productId]);

  useEffect(() => {
    loadProduct();
  }, [loadProduct]);

  const handleUpdateProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const updated = await updateProduct(productId, editForm);
      if (updated) {
        success('Product updated successfully!');
        setEditing(false);
        loadProduct();
      } else {
        toastError('Failed to update product details.');
      }
    } catch (err) {
      toastError('An error occurred.');
    }
  };

  const handleCreateVariant = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!product) return;
    if (!variantForm.size_id || !variantForm.print_code) {
      toastError('Size and SKU print code are required.');
      return;
    }

    const cat = categories.find((c) => c.id === product.category_id);
    const sz = sizes.find((s) => s.id === variantForm.size_id);
    if (!cat || !sz) {
      toastError('Invalid Category or Size reference.');
      return;
    }

    const sku = `${cat.code}-${variantForm.print_code.toUpperCase()}-${sz.code}`;

    try {
      const res = await createVariant({
        product_id: productId,
        size_id: variantForm.size_id,
        color_id: variantForm.color_id || undefined,
        sku,
        cost_price: Number(variantForm.cost_price),
        selling_price: Number(variantForm.selling_price),
        mrp: Number(variantForm.mrp),
        low_stock_threshold: Number(variantForm.low_stock_threshold),
        weight_grams: Number(variantForm.weight_grams),
      });

      if (res) {
        success('SKU Variant created!');
        setShowAddVariant(false);
        setVariantForm({
          size_id: '',
          color_id: '',
          print_code: '',
          cost_price: 0,
          selling_price: 0,
          mrp: 0,
          low_stock_threshold: 10,
          weight_grams: 0,
        });
        loadProduct();
      } else {
        toastError('Variant SKU already exists.');
      }
    } catch (err) {
      toastError('An error occurred.');
    }
  };

  if (loading && !product) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!product) {
    return (
      <div className="text-center py-16 bg-white dark:bg-[#1e293b] rounded-2xl border border-slate-200 dark:border-slate-800 p-8 shadow-sm">
        <h2 className="text-sm font-bold text-slate-800 dark:text-white">Product not found</h2>
        <p className="text-xs text-slate-400 mt-2">The product might have been deleted or doesn't exist.</p>
        <Link
          href="/warehouse/products"
          className="mt-4 inline-flex items-center gap-1.5 text-xs text-indigo-600 hover:underline"
        >
          <ArrowLeft className="w-4 h-4" /> Back to Products
        </Link>
      </div>
    );
  }

  const columns = [
    {
      key: 'sku',
      header: 'SKU / Barcode',
      sortable: true,
      render: (row: WmsProductVariant) => (
        <div className="flex flex-col gap-1">
          <SkuTag sku={row.sku} copyable={true} size="sm" />
          <span className="text-[10px] text-slate-400 font-mono">BC: {row.barcode}</span>
        </div>
      ),
    },
    {
      key: 'size',
      header: 'Size',
      render: (row: WmsProductVariant) => (
        <span className="font-semibold text-slate-700 dark:text-slate-300">
          {row.size?.label || 'N/A'}
        </span>
      ),
    },
    {
      key: 'color',
      header: 'Color',
      render: (row: WmsProductVariant) => (
        <div className="flex items-center gap-1.5">
          {row.color?.hex_code && (
            <span
              className="w-3 h-3 rounded-full border border-black/10"
              style={{ backgroundColor: row.color.hex_code }}
            />
          )}
          <span className="text-slate-600 dark:text-slate-400">
            {row.color?.name || 'N/A'}
          </span>
        </div>
      ),
    },
    {
      key: 'prices',
      header: 'Cost / MRP / Selling',
      render: (row: WmsProductVariant) => (
        <div className="flex flex-col font-mono text-[10px]">
          <span>Cost: ₹{row.cost_price}</span>
          <span>MRP: ₹{row.mrp}</span>
          <span>Sell: ₹{row.selling_price}</span>
        </div>
      ),
    },
    {
      key: 'threshold',
      header: 'Low Alert Limit',
      align: 'center' as const,
      render: (row: WmsProductVariant) => (
        <span className="font-semibold text-slate-700 dark:text-slate-300">
          {row.low_stock_threshold} units
        </span>
      ),
    },
    {
      key: 'weight',
      header: 'Weight',
      render: (row: WmsProductVariant) => (
        <span className="text-slate-500">
          {row.weight_grams ? `${row.weight_grams}g` : '—'}
        </span>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      {/* Back button & title */}
      <div className="flex flex-col gap-2">
        <Link
          href="/warehouse/products"
          className="inline-flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-700 dark:hover:text-slate-200 cursor-pointer self-start"
        >
          <ArrowLeft className="w-4 h-4" /> Back to Catalog
        </Link>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-extrabold text-slate-800 dark:text-white tracking-tight">
              {product.product_name}
            </h1>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-xs font-semibold px-2 py-0.5 bg-indigo-50 text-indigo-600 rounded">
                Category: {product.category?.name}
              </span>
              {product.fabric && (
                <span className="text-xs font-semibold px-2 py-0.5 bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400 rounded">
                  Fabric: {product.fabric.name}
                </span>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setEditing(!editing)}
              className="flex items-center gap-1 px-3 py-1.5 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-xs font-semibold text-slate-600 dark:text-slate-400 rounded-xl cursor-pointer transition-colors"
            >
              <Edit className="w-4 h-4" />
              {editing ? 'Cancel' : 'Edit Details'}
            </button>
            <button
              onClick={() => setShowAddVariant(true)}
              className="flex items-center gap-1 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-xl cursor-pointer transition-colors"
            >
              <Plus className="w-4 h-4" />
              Add Variant
            </button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Info panel or edit panel */}
        <div className="lg:col-span-1 space-y-6">
          {editing ? (
            <div className="bg-white dark:bg-[#1e293b] border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm space-y-4">
              <h3 className="text-xs font-bold text-slate-800 dark:text-white uppercase tracking-wider">
                Edit Product Info
              </h3>
              <form onSubmit={handleUpdateProduct} className="space-y-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase">Product Name</label>
                  <input
                    type="text"
                    required
                    value={editForm.product_name}
                    onChange={(e) => setEditForm({ ...editForm, product_name: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase">Print Name Code</label>
                  <input
                    type="text"
                    required
                    value={editForm.print_name}
                    onChange={(e) => setEditForm({ ...editForm, print_name: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase">HSN Code</label>
                    <input
                      type="text"
                      value={editForm.hsn}
                      onChange={(e) => setEditForm({ ...editForm, hsn: e.target.value })}
                      className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase">GST Rate (%)</label>
                    <input
                      type="number"
                      value={editForm.gst_percent}
                      onChange={(e) => setEditForm({ ...editForm, gst_percent: Number(e.target.value) })}
                      className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs"
                    />
                  </div>
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase">Description</label>
                  <textarea
                    value={editForm.description}
                    onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs h-24"
                  />
                </div>
                <button
                  type="submit"
                  className="w-full py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-xl flex items-center justify-center gap-1 shadow cursor-pointer"
                >
                  <Save className="w-4 h-4" /> Save Changes
                </button>
              </form>
            </div>
          ) : (
            <div className="bg-white dark:bg-[#1e293b] border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm space-y-4">
              <h3 className="text-xs font-bold text-slate-800 dark:text-white uppercase tracking-wider border-b border-slate-100 pb-2">
                Product Details
              </h3>
              <div className="space-y-3.5 text-xs">
                <div className="flex justify-between">
                  <span className="text-slate-400">Print Name:</span>
                  <span className="font-semibold text-slate-800 dark:text-slate-200">{product.print_name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Category HSN:</span>
                  <span className="font-semibold text-slate-800 dark:text-slate-200">{product.hsn || 'None'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">GST Percent:</span>
                  <span className="font-semibold text-slate-800 dark:text-slate-200">{product.gst_percent}%</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Fabric details:</span>
                  <span className="font-semibold text-slate-800 dark:text-slate-200">{product.fabric?.name || 'Unspecified'}</span>
                </div>
                <div className="space-y-1">
                  <span className="text-slate-400 block">Description:</span>
                  <p className="text-slate-600 dark:text-slate-400 leading-relaxed font-medium bg-slate-50 dark:bg-slate-900 p-2.5 rounded-xl border border-slate-100 dark:border-slate-800/80">
                    {product.description || 'No description recorded.'}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Active variant label display preview */}
          {selectedVariant && (
            <div className="animate-fade-in space-y-2">
              <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest pl-1">
                Thermal Label Preview
              </h3>
              <BarcodeDisplay
                value={selectedVariant.barcode}
                sku={selectedVariant.sku}
                productName={product.product_name}
                size={selectedVariant.size?.label}
                mrp={selectedVariant.mrp}
              />
            </div>
          )}
        </div>

        {/* Variants List */}
        <div className="lg:col-span-2 space-y-4">
          <div className="bg-white dark:bg-[#1e293b] border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm">
            <h3 className="text-sm font-bold text-slate-800 dark:text-white mb-4">
              Active SKU Variants
            </h3>
            <DataTable
              data={product.variants || []}
              columns={columns}
              emptyMessage="No SKU variants generated for this product."
              onRowClick={(row) => setSelectedVariant(row)}
              actions={(row: WmsProductVariant) => (
                <div className="flex gap-1 justify-end">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedVariant(row);
                    }}
                    className="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 rounded transition-colors cursor-pointer"
                    title="Preview Label"
                  >
                    <Printer className="w-4 h-4" />
                  </button>
                </div>
              )}
            />
          </div>
        </div>
      </div>

      {/* Add Variant Modal */}
      {showAddVariant && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div onClick={() => setShowAddVariant(false)} className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm" />
          <div className="relative bg-white dark:bg-[#1e293b] w-full max-w-lg rounded-2xl p-6 border border-slate-200 dark:border-slate-800 shadow-2xl z-10">
            <h3 className="text-sm font-bold text-slate-800 dark:text-white mb-4">
              Add SKU Variant
            </h3>
            <form onSubmit={handleCreateVariant} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase">Select Size *</label>
                  <select
                    required
                    value={variantForm.size_id}
                    onChange={(e) => setVariantForm({ ...variantForm, size_id: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs"
                  >
                    <option value="">Select Size</option>
                    {sizes
                      .filter((s) => s.category_id === product.category_id)
                      .map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.label} ({s.code})
                        </option>
                      ))}
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase">SKU Print Segment *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. DEER (Caps)"
                    value={variantForm.print_code}
                    onChange={(e) => setVariantForm({ ...variantForm, print_code: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-mono uppercase"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase">Select Color</label>
                  <select
                    value={variantForm.color_id}
                    onChange={(e) => setVariantForm({ ...variantForm, color_id: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs"
                  >
                    <option value="">Select Color</option>
                    {colors.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase">Alert Threshold</label>
                  <input
                    type="number"
                    value={variantForm.low_stock_threshold}
                    onChange={(e) => setVariantForm({ ...variantForm, low_stock_threshold: Number(e.target.value) })}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase">Cost Price (₹)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={variantForm.cost_price}
                    onChange={(e) => setVariantForm({ ...variantForm, cost_price: Number(e.target.value) })}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase">Selling Price (₹)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={variantForm.selling_price}
                    onChange={(e) => setVariantForm({ ...variantForm, selling_price: Number(e.target.value) })}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase">MRP (₹)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={variantForm.mrp}
                    onChange={(e) => setVariantForm({ ...variantForm, mrp: Number(e.target.value) })}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs"
                  />
                </div>
              </div>

              {variantForm.size_id && variantForm.print_code && (
                <div className="p-3 bg-slate-50 dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 text-[10px] font-medium text-slate-500">
                  SKU preview:{' '}
                  <span className="font-mono font-black text-slate-800 dark:text-slate-200">
                    {(() => {
                      const cat = categories.find((c) => c.id === product.category_id);
                      const sz = sizes.find((s) => s.id === variantForm.size_id);
                      return `${cat?.code || ''}-${variantForm.print_code.toUpperCase()}-${sz?.code || ''}`;
                    })()}
                  </span>
                </div>
              )}

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddVariant(false)}
                  className="px-4 py-2 border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-600 rounded-xl hover:bg-slate-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-xl cursor-pointer"
                >
                  Create Variant
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
