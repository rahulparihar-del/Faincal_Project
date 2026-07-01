'use client';

import React, { useState, useEffect } from 'react';
import { getProducts, updateProduct, createProduct, createVariant } from '@/lib/wms/services/productService';
import { useMasterData } from '@/lib/wms/hooks/useMasterData';
import { DataTable } from '@/components/wms/ui/DataTable';
import { SkuTag } from '@/components/wms/ui/SkuTag';
import { useWmsToast } from '@/components/wms/ui/WmsToast';
import { Plus, Search, Eye, Filter, RefreshCw, Layers } from 'lucide-react';
import { WmsProduct } from '@/lib/wms/types';
import Link from 'next/link';

export default function ProductsPage() {
  const { categories, sizes, colors, fabrics, loading: masterLoading } = useMasterData();
  const { success, error: toastError } = useWmsToast();

  const [products, setProducts] = useState<WmsProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [showVariantModal, setShowVariantModal] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<WmsProduct | null>(null);

  // Form states
  const [newProduct, setNewProduct] = useState({
    product_name: '',
    print_name: '',
    category_id: '',
    fabric_id: '',
    description: '',
    hsn: '',
    gst_percent: 5,
  });

  const [newVariant, setNewVariant] = useState({
    size_id: '',
    color_id: '',
    print_code: '', // print code segment for SKU (e.g. DEER)
    cost_price: 0,
    selling_price: 0,
    mrp: 0,
    low_stock_threshold: 10,
    weight_grams: 0,
  });

  const loadProducts = async () => {
    setLoading(true);
    try {
      const res = await getProducts();
      setProducts(res);
    } catch (err) {
      console.error('Failed to load products:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadProducts();
  }, []);

  const handleCreateProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newProduct.product_name || !newProduct.print_name || !newProduct.category_id) {
      toastError('Please fill in all required fields.');
      return;
    }

    try {
      const res = await createProduct({
        product_name: newProduct.product_name,
        print_name: newProduct.print_name,
        category_id: newProduct.category_id,
        fabric_id: newProduct.fabric_id || undefined,
        description: newProduct.description,
        hsn: newProduct.hsn,
        gst_percent: Number(newProduct.gst_percent),
      });

      if (res) {
        success('Product created successfully!');
        setShowAddModal(false);
        setNewProduct({
          product_name: '',
          print_name: '',
          category_id: '',
          fabric_id: '',
          description: '',
          hsn: '',
          gst_percent: 5,
        });
        loadProducts();
      } else {
        toastError('Failed to create product.');
      }
    } catch (err) {
      toastError('An error occurred.');
    }
  };

  const handleCreateVariant = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProduct) return;
    if (!newVariant.size_id || !newVariant.print_code) {
      toastError('Size and SKU Print Code are required.');
      return;
    }

    const category = categories.find((c) => c.id === selectedProduct.category_id);
    const size = sizes.find((s) => s.id === newVariant.size_id);

    if (!category || !size) {
      toastError('Invalid Category or Size reference.');
      return;
    }

    // Auto SKU format: CJ-DEER-03M
    const sku = `${category.code}-${newVariant.print_code.toUpperCase()}-${size.code}`;

    try {
      const res = await createVariant({
        product_id: selectedProduct.id,
        size_id: newVariant.size_id,
        color_id: newVariant.color_id || undefined,
        sku,
        cost_price: Number(newVariant.cost_price),
        selling_price: Number(newVariant.selling_price),
        mrp: Number(newVariant.mrp),
        low_stock_threshold: Number(newVariant.low_stock_threshold),
        weight_grams: Number(newVariant.weight_grams),
      });

      if (res) {
        success('Product Variant created successfully!');
        setShowVariantModal(false);
        setNewVariant({
          size_id: '',
          color_id: '',
          print_code: '',
          cost_price: 0,
          selling_price: 0,
          mrp: 0,
          low_stock_threshold: 10,
          weight_grams: 0,
        });
        loadProducts();
      } else {
        toastError('Failed to create variant (SKU might already exist).');
      }
    } catch (err) {
      toastError('An error occurred.');
    }
  };

  // Filtered list
  const filteredProducts = products.filter((p) => {
    const matchesCategory = selectedCategory ? p.category_id === selectedCategory : true;
    const matchesSearch = search
      ? p.product_name.toLowerCase().includes(search.toLowerCase()) ||
        p.print_name.toLowerCase().includes(search.toLowerCase()) ||
        (p.hsn && p.hsn.includes(search))
      : true;
    return matchesCategory && matchesSearch;
  });

  const columns = [
    {
      key: 'product_name',
      header: 'Product Name',
      sortable: true,
      render: (row: WmsProduct) => (
        <div className="flex flex-col">
          <span className="font-semibold text-slate-800 dark:text-slate-200">{row.product_name}</span>
          <span className="text-[10px] text-slate-400 font-medium">Print Name: {row.print_name}</span>
        </div>
      ),
    },
    {
      key: 'category',
      header: 'Category',
      render: (row: WmsProduct) => (
        <span className="font-medium text-slate-700 dark:text-slate-300">
          {row.category?.name || 'Unassigned'}
        </span>
      ),
    },
    {
      key: 'fabric',
      header: 'Fabric',
      render: (row: WmsProduct) => (
        <span className="text-slate-500 dark:text-slate-400">
          {row.fabric?.name || 'N/A'}
        </span>
      ),
    },
    {
      key: 'variants',
      header: 'Variants',
      align: 'center' as const,
      render: (row: WmsProduct) => (
        <span className="inline-flex items-center justify-center bg-slate-100 dark:bg-slate-800/80 text-slate-700 dark:text-slate-300 font-bold px-2 py-0.5 rounded text-[10px]">
          {row.variants?.length ?? 0} variants
        </span>
      ),
    },
    {
      key: 'hsn',
      header: 'HSN / GST',
      render: (row: WmsProduct) => (
        <span className="text-slate-500 dark:text-slate-400">
          {row.hsn || '—'} ({row.gst_percent}%)
        </span>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (row: WmsProduct) => (
        <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
          row.status === 'active'
            ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/20'
            : 'bg-slate-100 text-slate-500 dark:bg-slate-850'
        }`}>
          <span className={`w-1 h-1 rounded-full ${row.status === 'active' ? 'bg-emerald-500' : 'bg-slate-400'}`} />
          {row.status}
        </span>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      {/* Page Title & Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-800 dark:text-white tracking-tight">
            Products Catalog
          </h1>
          <p className="text-xs text-slate-400 mt-0.5 font-medium">
            Manage KiddieKa's apparel product hierarchy and generate SKU variants.
          </p>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          className="flex items-center gap-1.5 px-4 py-2 bg-slate-950 dark:bg-white hover:bg-slate-850 dark:hover:bg-slate-100 text-white dark:text-slate-950 text-xs font-bold rounded-xl shadow-sm cursor-pointer transition-all self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" />
          Add Product
        </button>
      </div>

      {/* Filter Row */}
      <div className="flex flex-wrap gap-3 items-center bg-white dark:bg-[#1e293b] border border-slate-200 dark:border-slate-800 p-4 rounded-2xl shadow-sm">
        <div className="relative flex-1 min-w-[200px]">
          <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-400 dark:text-slate-500">
            <Search className="w-4 h-4" />
          </span>
          <input
            type="text"
            placeholder="Search products, prints, HSN..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-slate-900 focus:border-slate-900 focus:bg-white"
          />
        </div>

        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-slate-400 shrink-0" />
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-1 focus:ring-slate-900"
          >
            <option value="">All Categories</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>

        <button
          onClick={loadProducts}
          className="p-2 border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl text-slate-500 cursor-pointer transition-colors"
          title="Refresh table"
        >
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      {/* Catalog Table */}
      <DataTable
        data={filteredProducts}
        columns={columns}
        loading={loading || masterLoading}
        emptyMessage="No apparel products found in the catalog."
        actions={(row: WmsProduct) => (
          <div className="flex justify-end gap-1">
            <button
              onClick={() => {
                setSelectedProduct(row);
                setShowVariantModal(true);
              }}
              className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-900 dark:text-white rounded transition-colors cursor-pointer"
              title="Add Variant"
            >
              <Layers className="w-4 h-4" />
            </button>
            <Link
              href={`/warehouse/products/${row.id}`}
              className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 dark:text-slate-400 rounded transition-colors cursor-pointer"
              title="View Product Details"
            >
              <Eye className="w-4 h-4" />
            </Link>
          </div>
        )}
      />

      {/* Add Product Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div onClick={() => setShowAddModal(false)} className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm" />
          <div className="relative bg-white dark:bg-[#1e293b] w-full max-w-lg rounded-2xl p-6 border border-slate-200 dark:border-slate-800 shadow-2xl z-10">
            <h3 className="text-sm font-bold text-slate-800 dark:text-white mb-4">
              Add New Product Master
            </h3>
            <form onSubmit={handleCreateProduct} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase">Product Name *</label>
                  <input
                    type="text"
                    required
                    value={newProduct.product_name}
                    onChange={(e) => setNewProduct({ ...newProduct, product_name: e.target.value })}
                    placeholder="e.g. Cotton Jabla Deer"
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase">Print Code Name *</label>
                  <input
                    type="text"
                    required
                    value={newProduct.print_name}
                    onChange={(e) => setNewProduct({ ...newProduct, print_name: e.target.value })}
                    placeholder="e.g. DEER, FLOWER, MINT"
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase">Category *</label>
                  <select
                    required
                    value={newProduct.category_id}
                    onChange={(e) => setNewProduct({ ...newProduct, category_id: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs"
                  >
                    <option value="">Select Category</option>
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name} ({c.code})
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase">Fabric</label>
                  <select
                    value={newProduct.fabric_id}
                    onChange={(e) => setNewProduct({ ...newProduct, fabric_id: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs"
                  >
                    <option value="">Select Fabric</option>
                    {fabrics.map((f) => (
                      <option key={f.id} value={f.id}>
                        {f.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase">HSN Code</label>
                  <input
                    type="text"
                    value={newProduct.hsn}
                    onChange={(e) => setNewProduct({ ...newProduct, hsn: e.target.value })}
                    placeholder="e.g. 6111"
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase">GST Rate (%)</label>
                  <input
                    type="number"
                    value={newProduct.gst_percent}
                    onChange={(e) => setNewProduct({ ...newProduct, gst_percent: Number(e.target.value) })}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase">Description</label>
                <textarea
                  value={newProduct.description}
                  onChange={(e) => setNewProduct({ ...newProduct, description: e.target.value })}
                  placeholder="Apparel description details..."
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs h-20"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-600 rounded-xl hover:bg-slate-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-slate-950 dark:bg-white hover:bg-slate-850 dark:hover:bg-slate-100 text-white dark:text-slate-950 text-xs font-semibold rounded-xl cursor-pointer"
                >
                  Create Product
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Variant Modal */}
      {showVariantModal && selectedProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div onClick={() => setShowVariantModal(false)} className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm" />
          <div className="relative bg-white dark:bg-[#1e293b] w-full max-w-lg rounded-2xl p-6 border border-slate-200 dark:border-slate-800 shadow-2xl z-10">
            <h3 className="text-sm font-bold text-slate-800 dark:text-white leading-tight">
              Create SKU Variant
            </h3>
            <p className="text-[10px] text-slate-400 mb-4 mt-0.5">
              Add a size/color variant SKU under: <span className="font-bold text-slate-700 dark:text-slate-300">{selectedProduct.product_name}</span>.
            </p>
            <form onSubmit={handleCreateVariant} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase">Select Size *</label>
                  <select
                    required
                    value={newVariant.size_id}
                    onChange={(e) => setNewVariant({ ...newVariant, size_id: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs"
                  >
                    <option value="">Select Size</option>
                    {sizes
                      .filter((s) => s.category_id === selectedProduct.category_id)
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
                    placeholder="e.g. DEER, FLWR (Caps)"
                    value={newVariant.print_code}
                    onChange={(e) => setNewVariant({ ...newVariant, print_code: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-mono uppercase"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase">Select Color</label>
                  <select
                    value={newVariant.color_id}
                    onChange={(e) => setNewVariant({ ...newVariant, color_id: e.target.value })}
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
                  <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase">Low Stock Threshold</label>
                  <input
                    type="number"
                    value={newVariant.low_stock_threshold}
                    onChange={(e) => setNewVariant({ ...newVariant, low_stock_threshold: Number(e.target.value) })}
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
                    value={newVariant.cost_price}
                    onChange={(e) => setNewVariant({ ...newVariant, cost_price: Number(e.target.value) })}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase">Selling Price (₹)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={newVariant.selling_price}
                    onChange={(e) => setNewVariant({ ...newVariant, selling_price: Number(e.target.value) })}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase">MRP (₹)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={newVariant.mrp}
                    onChange={(e) => setNewVariant({ ...newVariant, mrp: Number(e.target.value) })}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs"
                  />
                </div>
              </div>

              {/* Display SKU preview */}
              {newVariant.size_id && newVariant.print_code && (
                <div className="p-3 bg-slate-50 dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 text-[10px] font-medium text-slate-500">
                  SKU Code Preview:{' '}
                  <span className="font-mono font-black text-slate-800 dark:text-slate-200">
                    {(() => {
                      const category = categories.find((c) => c.id === selectedProduct.category_id);
                      const size = sizes.find((s) => s.id === newVariant.size_id);
                      return `${category?.code || ''}-${newVariant.print_code.toUpperCase()}-${size?.code || ''}`;
                    })()}
                  </span>
                </div>
              )}

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowVariantModal(false)}
                  className="px-4 py-2 border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-600 rounded-xl hover:bg-slate-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-slate-950 dark:bg-white hover:bg-slate-850 dark:hover:bg-slate-100 text-white dark:text-slate-950 text-xs font-semibold rounded-xl cursor-pointer"
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
