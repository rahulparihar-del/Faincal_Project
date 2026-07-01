'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { useMasterData } from '@/lib/wms/hooks/useMasterData';
import { DataTable } from '@/components/wms/ui/DataTable';
import { useWmsToast } from '@/components/wms/ui/WmsToast';
import { supabase } from '@/lib/supabase/client';
import { Plus, RefreshCw, Folder, Settings, MapPin, Truck, HelpCircle, Layers, Palette } from 'lucide-react';

type TabType = 'categories' | 'sizes' | 'colors' | 'fabrics' | 'warehouses' | 'suppliers' | 'channels';

function MasterDataInner() {
  const { success, error: toastError } = useWmsToast();
  const searchParams = useSearchParams();
  const tabParam = searchParams.get('tab') as TabType;

  const [activeTab, setActiveTab] = useState<TabType>('categories');
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<any[]>([]);
  const [categoriesList, setCategoriesList] = useState<any[]>([]); // for sizes category picker

  // Add Item form states
  const [showAddForm, setShowAddForm] = useState(false);
  const [formData, setFormData] = useState<Record<string, any>>({});

  useEffect(() => {
    if (tabParam && ['categories', 'sizes', 'colors', 'fabrics', 'warehouses', 'suppliers', 'channels'].includes(tabParam)) {
      setActiveTab(tabParam);
    }
  }, [tabParam]);

  const loadTabData = async (tab: TabType) => {
    if (!supabase) return;
    setLoading(true);

    try {
      const tabConfig = {
        categories: { table: 'wms_categories', order: 'sort_order' },
        sizes: { table: 'wms_sizes', order: 'sort_order' },
        colors: { table: 'wms_colors', order: 'name' },
        fabrics: { table: 'wms_fabrics', order: 'name' },
        warehouses: { table: 'wms_warehouses', order: 'name' },
        suppliers: { table: 'wms_suppliers', order: 'name' },
        channels: { table: 'wms_marketplace_channels', order: 'name' },
      };
      
      const config = tabConfig[tab];
      let query = supabase.from(config.table).select('*').order(config.order, { ascending: true });
      
      // If sizes, join category name
      if (tab === 'sizes') {
        query = supabase
          .from('wms_sizes')
          .select('*, category:wms_categories(id, name, code)')
          .order('sort_order', { ascending: true });
      }

      const { data: result, error } = await query;
      if (error) throw error;
      setData(result || []);

      // If categories, save to select list
      if (tab === 'categories') {
        setCategoriesList(result || []);
      } else if (tab === 'sizes' && categoriesList.length === 0) {
        const { data: cats } = await supabase.from('wms_categories').select('*').order('sort_order');
        setCategoriesList(cats || []);
      }
    } catch (err) {
      console.error(`Failed to load ${tab} master data:`, err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTabData(activeTab);
  }, [activeTab]);

  const handleTabChange = (tab: TabType) => {
    setActiveTab(tab);
    setShowAddForm(false);
    setFormData({});
  };

  const handleAddSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supabase) return;

    const tabConfig = {
      categories: { table: 'wms_categories', fields: ['name', 'code', 'sort_order'] },
      sizes: { table: 'wms_sizes', fields: ['category_id', 'label', 'code', 'sort_order'] },
      colors: { table: 'wms_colors', fields: ['name', 'hex_code'] },
      fabrics: { table: 'wms_fabrics', fields: ['name', 'code'] },
      warehouses: { table: 'wms_warehouses', fields: ['name', 'code', 'city', 'is_default'] },
      suppliers: { table: 'wms_suppliers', fields: ['name', 'code', 'city', 'phone'] },
      channels: { table: 'wms_marketplace_channels', fields: ['name', 'code'] },
    };

    const config = tabConfig[activeTab];
    const payload: Record<string, any> = {};
    config.fields.forEach((f) => {
      let val = formData[f];
      if (f === 'sort_order') val = Number(val || 0);
      if (f === 'is_default') val = Boolean(val);
      payload[f] = val;
    });

    try {
      const { error } = await supabase.from(config.table).insert(payload);
      if (error) throw error;
      success('Master data record added!');
      setShowAddForm(false);
      setFormData({});
      loadTabData(activeTab);
    } catch (err: any) {
      console.error('Failed to create master entry:', err);
      toastError(err.message || 'Failed to insert master data record.');
    }
  };

  // Grid Configs
  const columnsConfig = {
    categories: [
      { key: 'code', header: 'Code', sortable: true },
      { key: 'name', header: 'Category Name', sortable: true },
      { key: 'sort_order', header: 'Sort Order', align: 'center' as const },
    ],
    sizes: [
      { key: 'category', header: 'Category Reference', render: (row: any) => <span>{row.category?.name || 'N/A'}</span> },
      { key: 'code', header: 'Size Code', sortable: true },
      { key: 'label', header: 'Size Label', sortable: true },
      { key: 'sort_order', header: 'Sort Order', align: 'center' as const },
    ],
    colors: [
      { key: 'name', header: 'Color Name', sortable: true },
      {
        key: 'hex_code',
        header: 'Color Code',
        render: (row: any) => (
          <div className="flex items-center gap-2">
            <span className="w-4 h-4 rounded border" style={{ backgroundColor: row.hex_code }} />
            <span className="font-mono text-slate-500">{row.hex_code}</span>
          </div>
        ),
      },
    ],
    fabrics: [
      { key: 'code', header: 'Fabric Code', sortable: true },
      { key: 'name', header: 'Fabric Description', sortable: true },
    ],
    warehouses: [
      { key: 'code', header: 'Warehouse Code', sortable: true },
      { key: 'name', header: 'Name', sortable: true },
      { key: 'city', header: 'City Location' },
      {
        key: 'is_default',
        header: 'Default WH',
        render: (row: any) => (
          <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${row.is_default ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-50 text-slate-400'}`}>
            {row.is_default ? 'YES' : 'NO'}
          </span>
        ),
      },
    ],
    suppliers: [
      { key: 'code', header: 'Supplier Code', sortable: true },
      { key: 'name', header: 'Supplier Name', sortable: true },
      { key: 'city', header: 'City' },
      { key: 'phone', header: 'Contact Phone' },
    ],
    channels: [
      { key: 'code', header: 'Channel Code', sortable: true },
      { key: 'name', header: 'Marketplace Channel', sortable: true },
    ],
  };

  const menuItems = [
    { type: 'categories', label: 'Categories', icon: <Folder className="w-4 h-4" /> },
    { type: 'sizes', label: 'Sizes', icon: <Layers className="w-4 h-4" /> },
    { type: 'colors', label: 'Colors', icon: <Palette className="w-4 h-4" /> },
    { type: 'fabrics', label: 'Fabrics', icon: <Palette className="w-4 h-4" /> },
    { type: 'warehouses', label: 'Warehouses', icon: <MapPin className="w-4 h-4" /> },
    { type: 'suppliers', label: 'Suppliers', icon: <Truck className="w-4 h-4" /> },
    { type: 'channels', label: 'Channels', icon: <Settings className="w-4 h-4" /> },
  ];

  return (
    <div className="space-y-6">
      {/* Title */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-800 dark:text-white tracking-tight">
            Master Data Manager
          </h1>
          <p className="text-xs text-slate-400 mt-0.5 font-medium">
            Manage KiddieKa's foundational data: warehouses, marketplace options, categories, sizes.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Left Side: Tab switches */}
        <div className="lg:col-span-1 bg-white dark:bg-[#1e293b] border border-slate-200 dark:border-slate-800 p-4 rounded-2xl shadow-sm h-fit space-y-2">
          <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest pl-2 block mb-3">
            Master Registers
          </span>
          <div className="flex flex-col gap-1">
            {menuItems.map((item) => (
              <button
                key={item.type}
                type="button"
                onClick={() => handleTabChange(item.type as any)}
                className={`flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-xs font-semibold tracking-wide transition-all cursor-pointer ${
                  activeTab === item.type
                    ? 'bg-slate-950 dark:bg-white text-white dark:text-slate-950 shadow-sm'
                    : 'text-slate-650 hover:bg-slate-55 dark:text-slate-350 dark:hover:bg-slate-800'
                }`}
              >
                {item.icon}
                {item.label}
              </button>
            ))}
          </div>
        </div>

        {/* Right Side: Tab content grid */}
        <div className="lg:col-span-3 space-y-4">
          {/* Add Item form */}
          {showAddForm ? (
            <div className="bg-white dark:bg-[#1e293b] border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm space-y-4">
              <h3 className="text-xs font-bold text-slate-850 dark:text-white uppercase tracking-wider">
                Create Master Entry — {activeTab}
              </h3>
              <form onSubmit={handleAddSubmit} className="space-y-4 text-xs">
                {activeTab === 'categories' && (
                  <div className="grid grid-cols-3 gap-4">
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-slate-400 uppercase">Category Code</label>
                      <input
                        type="text"
                        required
                        placeholder="e.g. CJ"
                        value={formData.code || ''}
                        onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                        className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-slate-400 uppercase">Category Name</label>
                      <input
                        type="text"
                        required
                        placeholder="e.g. Cotton Jabla"
                        value={formData.name || ''}
                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                        className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-slate-400 uppercase">Sort Order</label>
                      <input
                        type="number"
                        placeholder="0"
                        value={formData.sort_order || ''}
                        onChange={(e) => setFormData({ ...formData, sort_order: e.target.value })}
                        className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl"
                      />
                    </div>
                  </div>
                )}

                {activeTab === 'sizes' && (
                  <div className="grid grid-cols-4 gap-4">
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-slate-400 uppercase">Category Reference</label>
                      <select
                        required
                        value={formData.category_id || ''}
                        onChange={(e) => setFormData({ ...formData, category_id: e.target.value })}
                        className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl"
                      >
                        <option value="">Choose category...</option>
                        {categoriesList.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.name}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-slate-400 uppercase">Size Label</label>
                      <input
                        type="text"
                        required
                        placeholder="e.g. 0-3M or 2Y"
                        value={formData.label || ''}
                        onChange={(e) => setFormData({ ...formData, label: e.target.value })}
                        className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-slate-400 uppercase">Size Code</label>
                      <input
                        type="text"
                        required
                        placeholder="e.g. 03M or 2Y"
                        value={formData.code || ''}
                        onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                        className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-slate-400 uppercase">Sort Order</label>
                      <input
                        type="number"
                        placeholder="0"
                        value={formData.sort_order || ''}
                        onChange={(e) => setFormData({ ...formData, sort_order: e.target.value })}
                        className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl"
                      />
                    </div>
                  </div>
                )}

                {activeTab === 'colors' && (
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-slate-400 uppercase">Color Name</label>
                      <input
                        type="text"
                        required
                        placeholder="e.g. Pink"
                        value={formData.name || ''}
                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                        className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-slate-400 uppercase">Hex Code</label>
                      <input
                        type="text"
                        placeholder="e.g. #FFC0CB"
                        value={formData.hex_code || ''}
                        onChange={(e) => setFormData({ ...formData, hex_code: e.target.value })}
                        className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl"
                      />
                    </div>
                  </div>
                )}

                {activeTab === 'fabrics' && (
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-slate-400 uppercase">Fabric Code</label>
                      <input
                        type="text"
                        required
                        placeholder="e.g. COT"
                        value={formData.code || ''}
                        onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                        className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-slate-400 uppercase">Fabric Name</label>
                      <input
                        type="text"
                        required
                        placeholder="e.g. Cotton"
                        value={formData.name || ''}
                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                        className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl"
                      />
                    </div>
                  </div>
                )}

                {activeTab === 'warehouses' && (
                  <div className="grid grid-cols-4 gap-4">
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-slate-400 uppercase">Warehouse Code</label>
                      <input
                        type="text"
                        required
                        placeholder="e.g. WH-01"
                        value={formData.code || ''}
                        onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                        className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-slate-400 uppercase">Warehouse Name</label>
                      <input
                        type="text"
                        required
                        placeholder="e.g. Mumbai Main"
                        value={formData.name || ''}
                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                        className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-slate-400 uppercase">City</label>
                      <input
                        type="text"
                        placeholder="e.g. Mumbai"
                        value={formData.city || ''}
                        onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                        className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl"
                      />
                    </div>
                    <div className="space-y-3 flex items-center h-full pt-4">
                      <input
                        type="checkbox"
                        id="is_default"
                        checked={formData.is_default || false}
                        onChange={(e) => setFormData({ ...formData, is_default: e.target.checked })}
                        className="w-4 h-4 text-slate-955 border-slate-200 rounded"
                      />
                      <label htmlFor="is_default" className="ml-2 font-bold text-slate-500">
                        Default WH
                      </label>
                    </div>
                  </div>
                )}

                {activeTab === 'suppliers' && (
                  <div className="grid grid-cols-4 gap-4">
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-slate-400 uppercase">Supplier Code</label>
                      <input
                        type="text"
                        required
                        placeholder="e.g. SUP-09"
                        value={formData.code || ''}
                        onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                        className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-slate-400 uppercase">Supplier Name</label>
                      <input
                        type="text"
                        required
                        placeholder="e.g. Cotton Fabric Mills"
                        value={formData.name || ''}
                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                        className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-slate-400 uppercase">City</label>
                      <input
                        type="text"
                        placeholder="e.g. Surat"
                        value={formData.city || ''}
                        onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                        className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-slate-400 uppercase">Contact Phone</label>
                      <input
                        type="text"
                        placeholder="e.g. +91 999998888"
                        value={formData.phone || ''}
                        onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                        className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl"
                      />
                    </div>
                  </div>
                )}

                {activeTab === 'channels' && (
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-slate-400 uppercase">Channel Code</label>
                      <input
                        type="text"
                        required
                        placeholder="e.g. AMZ"
                        value={formData.code || ''}
                        onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                        className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-slate-400 uppercase">Channel Name</label>
                      <input
                        type="text"
                        required
                        placeholder="e.g. Amazon"
                        value={formData.name || ''}
                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                        className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl"
                      />
                    </div>
                  </div>
                )}

                <div className="flex gap-2 justify-end pt-2">
                  <button
                    type="button"
                    onClick={() => setShowAddForm(false)}
                    className="px-4 py-2 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 rounded-xl hover:bg-slate-55 cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 bg-slate-950 dark:bg-white hover:bg-slate-850 dark:hover:bg-slate-100 text-white dark:text-slate-950 font-bold rounded-xl cursor-pointer"
                  >
                    Save Master Entry
                  </button>
                </div>
              </form>
            </div>
          ) : (
            <div className="flex justify-between items-center bg-white dark:bg-[#1e293b] border border-slate-200 dark:border-slate-800 p-4 rounded-2xl shadow-sm">
              <div>
                <h3 className="text-xs font-bold text-slate-850 dark:text-white uppercase tracking-wider">
                  Active Registers: {activeTab}
                </h3>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setShowAddForm(true)}
                  className="flex items-center gap-1 px-3 py-1.5 bg-slate-950 dark:bg-white hover:bg-slate-850 dark:hover:bg-slate-100 text-white dark:text-slate-950 text-[10px] font-bold rounded-xl cursor-pointer shadow-sm transition-all"
                >
                  <Plus className="w-3.5 h-3.5" /> Add Entry
                </button>
                <button
                  onClick={() => loadTabData(activeTab)}
                  disabled={loading}
                  className="p-2 border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl text-slate-500 cursor-pointer"
                  title="Refresh register table"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          )}

          {/* Master Table */}
          <DataTable
            data={data}
            columns={columnsConfig[activeTab]}
            loading={loading}
            emptyMessage={`No ${activeTab} records found in the database. Add entries using button above.`}
          />
        </div>
      </div>
    </div>
  );
}

export default function MasterDataPage() {
  return (
    <Suspense fallback={<div className="p-10 text-center text-xs text-slate-400 font-semibold">Loading Master Registers...</div>}>
      <MasterDataInner />
    </Suspense>
  );
}

