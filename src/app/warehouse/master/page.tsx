'use client';

import React, { useState, useEffect, Suspense, useCallback } from 'react';
import { useSearchParams } from 'next/navigation';
import { DataTable } from '@/components/wms/ui/DataTable';
import { useWmsToast } from '@/components/wms/ui/WmsToast';
import { ConfirmDialog } from '@/components/wms/ui/ConfirmDialog';
import { supabase } from '@/lib/supabase/client';
import { Plus, RefreshCw, Folder, Settings, MapPin, Truck, Layers, Palette, Edit2, Trash2, CheckCircle2, XCircle } from 'lucide-react';

type TabType = 'categories' | 'sizes' | 'colors' | 'fabrics' | 'warehouses' | 'suppliers' | 'channels';

interface CategoryRow {
  id: string;
  code: string;
  name: string;
  sort_order: number;
  is_active: boolean;
}

interface SizeRow {
  id: string;
  category_id: string;
  code: string;
  label: string;
  sort_order: number;
  is_active: boolean;
  category?: {
    id: string;
    name: string;
    code: string;
  } | null;
}

interface ColorRow {
  id: string;
  name: string;
  hex_code: string;
  is_active: boolean;
}

interface FabricRow {
  id: string;
  code: string;
  name: string;
  is_active: boolean;
}

interface WarehouseRow {
  id: string;
  code: string;
  name: string;
  city: string;
  is_default: boolean;
  is_active: boolean;
}

interface SupplierRow {
  id: string;
  code: string;
  name: string;
  city: string;
  phone: string;
  is_active: boolean;
}

interface ChannelRow {
  id: string;
  code: string;
  name: string;
  is_active: boolean;
}

type MasterRow = CategoryRow & SizeRow & ColorRow & FabricRow & WarehouseRow & SupplierRow & ChannelRow;

function MasterDataInner() {
  const { success, error: toastError } = useWmsToast();
  const searchParams = useSearchParams();
  const tabParam = searchParams.get('tab') as TabType;

  const [activeTab, setActiveTab] = useState<TabType>('categories');
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<MasterRow[]>([]);
  const [categoriesList, setCategoriesList] = useState<CategoryRow[]>([]); // for sizes category picker

  // Add/Edit modal form states
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState<Record<string, string | number | boolean>>({});

  // Delete states
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deletingRowId, setDeletingRowId] = useState<string | null>(null);
  const [deletingRowName, setDeletingRowName] = useState('');

  useEffect(() => {
    if (tabParam && ['categories', 'sizes', 'colors', 'fabrics', 'warehouses', 'suppliers', 'channels'].includes(tabParam)) {
      setActiveTab(tabParam);
    }
  }, [tabParam]);

  const loadTabData = useCallback(async (tab: TabType) => {
    if (!supabase) return;
    setLoading(true);

    try {
      const tabConfig: Record<TabType, { table: string; order: string }> = {
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
      setData((result as MasterRow[]) || []);

      // Cache category list if loading categories
      if (tab === 'categories') {
        setCategoriesList((result as CategoryRow[]) || []);
      } else if (tab === 'sizes' && categoriesList.length === 0) {
        const { data: cats } = await supabase.from('wms_categories').select('*').order('sort_order');
        setCategoriesList((cats as CategoryRow[]) || []);
      }
    } catch (err) {
      console.error(`Failed to load ${tab} master data:`, err);
      toastError(`Failed to load ${tab} data.`);
    } finally {
      setLoading(false);
    }
  }, [categoriesList.length, toastError]);

  useEffect(() => {
    loadTabData(activeTab);
  }, [activeTab, loadTabData]);

  const handleTabChange = (tab: TabType) => {
    setActiveTab(tab);
    setShowAddForm(false);
    setEditingId(null);
    setFormData({});
  };

  const handleToggleStatus = async (row: MasterRow) => {
    if (!supabase) return;
    const tabConfig: Record<TabType, { table: string }> = {
      categories: { table: 'wms_categories' },
      sizes: { table: 'wms_sizes' },
      colors: { table: 'wms_colors' },
      fabrics: { table: 'wms_fabrics' },
      warehouses: { table: 'wms_warehouses' },
      suppliers: { table: 'wms_suppliers' },
      channels: { table: 'wms_marketplace_channels' },
    };

    const config = tabConfig[activeTab];
    const newStatus = !row.is_active;

    try {
      const { error } = await supabase
        .from(config.table)
        .update({ is_active: newStatus })
        .eq('id', row.id);

      if (error) throw error;
      success(`Status updated for ${row.name || row.code || row.label || 'record'}.`);
      loadTabData(activeTab);
    } catch (err) {
      console.error('Status toggle failed:', err);
      toastError('Failed to change status.');
    }
  };

  const handleEditClick = (row: MasterRow) => {
    setEditingId(row.id);
    const initialForm: Record<string, string | number | boolean> = {};
    const fieldsMap: Record<TabType, string[]> = {
      categories: ['name', 'code', 'sort_order'],
      sizes: ['category_id', 'label', 'code', 'sort_order'],
      colors: ['name', 'hex_code'],
      fabrics: ['name', 'code'],
      warehouses: ['name', 'code', 'city', 'is_default'],
      suppliers: ['name', 'code', 'city', 'phone'],
      channels: ['name', 'code'],
    };

    fieldsMap[activeTab].forEach((f) => {
      initialForm[f] = row[f as keyof MasterRow] as string | number | boolean;
    });

    setFormData(initialForm);
    setShowAddForm(true);
  };

  const handleDeleteClick = (row: MasterRow) => {
    setDeletingRowId(row.id);
    setDeletingRowName(row.name || row.code || row.label || 'record');
    setShowDeleteConfirm(true);
  };

  const executeDelete = async () => {
    if (!supabase || !deletingRowId) return;

    const tabConfig: Record<TabType, { table: string }> = {
      categories: { table: 'wms_categories' },
      sizes: { table: 'wms_sizes' },
      colors: { table: 'wms_colors' },
      fabrics: { table: 'wms_fabrics' },
      warehouses: { table: 'wms_warehouses' },
      suppliers: { table: 'wms_suppliers' },
      channels: { table: 'wms_marketplace_channels' },
    };

    const config = tabConfig[activeTab];

    try {
      const { error } = await supabase.from(config.table).delete().eq('id', deletingRowId);
      
      if (error) {
        // Postgres foreign key constraint violation (FK references block delete)
        if (error.code === '23503') {
          toastError('Cannot delete this record because it is referenced in inventory transactions or products. Try toggling active status to FALSE instead.');
          return;
        }
        throw error;
      }

      success('Master data record deleted successfully!');
      loadTabData(activeTab);
    } catch (err) {
      console.error('Deletion error:', err);
      toastError(err instanceof Error ? err.message : 'Deletion failed due to foreign key constraints.');
    } finally {
      setShowDeleteConfirm(false);
      setDeletingRowId(null);
    }
  };

  const handleAddSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supabase) return;

    // Field Valildations
    const codeVal = formData.code as string | undefined;
    if (codeVal && !/^[a-zA-Z0-9_\-]+$/.test(codeVal)) {
      toastError('Code must contain only letters, numbers, hyphens or underscores.');
      return;
    }

    const hexVal = formData.hex_code as string | undefined;
    if (hexVal && !/^#[0-9A-Fa-f]{6}$/.test(hexVal)) {
      toastError('Color hex code must be a valid 6-character hex code starting with # (e.g. #FF0000).');
      return;
    }

    const phoneVal = formData.phone as string | undefined;
    if (phoneVal && !/^[+0-9\s\-]+$/.test(phoneVal)) {
      toastError('Phone must contain only numbers, spaces, hyphens or + symbol.');
      return;
    }

    const tabConfig: Record<TabType, { table: string; fields: string[] }> = {
      categories: { table: 'wms_categories', fields: ['name', 'code', 'sort_order'] },
      sizes: { table: 'wms_sizes', fields: ['category_id', 'label', 'code', 'sort_order'] },
      colors: { table: 'wms_colors', fields: ['name', 'hex_code'] },
      fabrics: { table: 'wms_fabrics', fields: ['name', 'code'] },
      warehouses: { table: 'wms_warehouses', fields: ['name', 'code', 'city', 'is_default'] },
      suppliers: { table: 'wms_suppliers', fields: ['name', 'code', 'city', 'phone'] },
      channels: { table: 'wms_marketplace_channels', fields: ['name', 'code'] },
    };

    const config = tabConfig[activeTab];
    const payload: Record<string, string | number | boolean> = {};
    
    config.fields.forEach((f) => {
      let val = formData[f];
      if (f === 'sort_order') val = Number(val || 0);
      if (f === 'is_default') val = Boolean(val);
      if (typeof val === 'string') val = val.trim();
      payload[f] = val;
    });

    try {
      if (editingId) {
        const { error } = await supabase
          .from(config.table)
          .update({
            ...payload,
            updated_at: new Date().toISOString(),
          })
          .eq('id', editingId);

        if (error) throw error;
        success('Master data record updated!');
      } else {
        const { error } = await supabase.from(config.table).insert({
          ...payload,
          is_active: true,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        });

        if (error) throw error;
        success('Master data record created!');
      }

      setShowAddForm(false);
      setEditingId(null);
      setFormData({});
      loadTabData(activeTab);
    } catch (err) {
      console.error('Failed to save master entry:', err);
      toastError(err instanceof Error ? err.message : 'Failed to save master data record.');
    }
  };

  // Actions render function for DataTable rows
  const renderActions = (row: MasterRow) => {
    return (
      <div className="flex justify-end gap-2">
        <button
          onClick={() => handleToggleStatus(row)}
          title="Toggle Active Status"
          className="p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 cursor-pointer"
        >
          {row.is_active ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
          ) : (
            <XCircle className="w-4 h-4 text-slate-400" />
          )}
        </button>
        <button
          onClick={() => handleEditClick(row)}
          title="Edit Record"
          className="p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 cursor-pointer"
        >
          <Edit2 className="w-4 h-4 text-indigo-500" />
        </button>
        <button
          onClick={() => handleDeleteClick(row)}
          title="Delete Record"
          className="p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 cursor-pointer"
        >
          <Trash2 className="w-4 h-4 text-rose-500" />
        </button>
      </div>
    );
  };

  // Grid Columns Configs
  const columnsConfig = {
    categories: [
      { key: 'code', header: 'Code', sortable: true },
      { key: 'name', header: 'Category Name', sortable: true },
      { key: 'sort_order', header: 'Sort Order', align: 'center' as const },
      {
        key: 'is_active',
        header: 'Status',
        render: (row: MasterRow) => (
          <span className={`px-2 py-0.5 rounded text-[9px] font-bold ${row.is_active ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-100 text-slate-400'}`}>
            {row.is_active ? 'ACTIVE' : 'INACTIVE'}
          </span>
        ),
      },
    ],
    sizes: [
      { key: 'category', header: 'Category Reference', render: (row: MasterRow) => <span>{row.category?.name || 'N/A'}</span> },
      { key: 'code', header: 'Size Code', sortable: true },
      { key: 'label', header: 'Size Label', sortable: true },
      { key: 'sort_order', header: 'Sort Order', align: 'center' as const },
      {
        key: 'is_active',
        header: 'Status',
        render: (row: MasterRow) => (
          <span className={`px-2 py-0.5 rounded text-[9px] font-bold ${row.is_active ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-100 text-slate-400'}`}>
            {row.is_active ? 'ACTIVE' : 'INACTIVE'}
          </span>
        ),
      },
    ],
    colors: [
      { key: 'name', header: 'Color Name', sortable: true },
      {
        key: 'hex_code',
        header: 'Color Code',
        render: (row: MasterRow) => (
          <div className="flex items-center gap-2">
            <span className="w-4 h-4 rounded border" style={{ backgroundColor: row.hex_code }} />
            <span className="font-mono text-slate-500">{row.hex_code}</span>
          </div>
        ),
      },
      {
        key: 'is_active',
        header: 'Status',
        render: (row: MasterRow) => (
          <span className={`px-2 py-0.5 rounded text-[9px] font-bold ${row.is_active ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-100 text-slate-400'}`}>
            {row.is_active ? 'ACTIVE' : 'INACTIVE'}
          </span>
        ),
      },
    ],
    fabrics: [
      { key: 'code', header: 'Fabric Code', sortable: true },
      { key: 'name', header: 'Fabric Description', sortable: true },
      {
        key: 'is_active',
        header: 'Status',
        render: (row: MasterRow) => (
          <span className={`px-2 py-0.5 rounded text-[9px] font-bold ${row.is_active ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-100 text-slate-400'}`}>
            {row.is_active ? 'ACTIVE' : 'INACTIVE'}
          </span>
        ),
      },
    ],
    warehouses: [
      { key: 'code', header: 'Warehouse Code', sortable: true },
      { key: 'name', header: 'Name', sortable: true },
      { key: 'city', header: 'City Location' },
      {
        key: 'is_default',
        header: 'Default WH',
        render: (row: MasterRow) => (
          <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${row.is_default ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-50 text-slate-400'}`}>
            {row.is_default ? 'YES' : 'NO'}
          </span>
        ),
      },
      {
        key: 'is_active',
        header: 'Status',
        render: (row: MasterRow) => (
          <span className={`px-2 py-0.5 rounded text-[9px] font-bold ${row.is_active ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-100 text-slate-400'}`}>
            {row.is_active ? 'ACTIVE' : 'INACTIVE'}
          </span>
        ),
      },
    ],
    suppliers: [
      { key: 'code', header: 'Supplier Code', sortable: true },
      { key: 'name', header: 'Supplier Name', sortable: true },
      { key: 'city', header: 'City' },
      { key: 'phone', header: 'Contact Phone' },
      {
        key: 'is_active',
        header: 'Status',
        render: (row: MasterRow) => (
          <span className={`px-2 py-0.5 rounded text-[9px] font-bold ${row.is_active ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-100 text-slate-400'}`}>
            {row.is_active ? 'ACTIVE' : 'INACTIVE'}
          </span>
        ),
      },
    ],
    channels: [
      { key: 'code', header: 'Channel Code', sortable: true },
      { key: 'name', header: 'Marketplace Channel', sortable: true },
      {
        key: 'is_active',
        header: 'Status',
        render: (row: MasterRow) => (
          <span className={`px-2 py-0.5 rounded text-[9px] font-bold ${row.is_active ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-100 text-slate-400'}`}>
            {row.is_active ? 'ACTIVE' : 'INACTIVE'}
          </span>
        ),
      },
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
            Manage KiddieKa&apos;s foundational data: warehouses, marketplace options, categories, sizes.
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
                onClick={() => handleTabChange(item.type as TabType)}
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
          {/* Add/Edit form */}
          {showAddForm ? (
            <div className="bg-white dark:bg-[#1e293b] border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm space-y-4">
              <h3 className="text-xs font-bold text-slate-850 dark:text-white uppercase tracking-wider">
                {editingId ? 'Edit' : 'Create'} Master Entry — {activeTab}
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
                        value={(formData.code as string) || ''}
                        onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                        className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-slate-400 uppercase">Category Name</label>
                      <input
                        type="text"
                        required
                        placeholder="e.g. Cotton Jabla"
                        value={(formData.name as string) || ''}
                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                        className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-slate-400 uppercase">Sort Order</label>
                      <input
                        type="number"
                        placeholder="0"
                        value={(formData.sort_order as number) || ''}
                        onChange={(e) => setFormData({ ...formData, sort_order: Number(e.target.value) })}
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
                        value={(formData.category_id as string) || ''}
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
                        value={(formData.label as string) || ''}
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
                        value={(formData.code as string) || ''}
                        onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                        className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-slate-400 uppercase">Sort Order</label>
                      <input
                        type="number"
                        placeholder="0"
                        value={(formData.sort_order as number) || ''}
                        onChange={(e) => setFormData({ ...formData, sort_order: Number(e.target.value) })}
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
                        value={(formData.name as string) || ''}
                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                        className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-slate-400 uppercase">Hex Code</label>
                      <input
                        type="text"
                        placeholder="e.g. #FFC0CB"
                        value={(formData.hex_code as string) || ''}
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
                        value={(formData.code as string) || ''}
                        onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                        className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-slate-400 uppercase">Fabric Name</label>
                      <input
                        type="text"
                        required
                        placeholder="e.g. Cotton"
                        value={(formData.name as string) || ''}
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
                        value={(formData.code as string) || ''}
                        onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                        className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-slate-400 uppercase">Warehouse Name</label>
                      <input
                        type="text"
                        required
                        placeholder="e.g. Mumbai Main"
                        value={(formData.name as string) || ''}
                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                        className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-slate-400 uppercase">City</label>
                      <input
                        type="text"
                        placeholder="e.g. Mumbai"
                        value={(formData.city as string) || ''}
                        onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                        className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl"
                      />
                    </div>
                    <div className="space-y-3 flex items-center h-full pt-4">
                      <input
                        type="checkbox"
                        id="is_default"
                        checked={(formData.is_default as boolean) || false}
                        onChange={(e) => setFormData({ ...formData, is_default: e.target.checked })}
                        className="w-4 h-4 text-slate-950 border-slate-200 rounded cursor-pointer"
                      />
                      <label htmlFor="is_default" className="ml-2 font-bold text-slate-500 cursor-pointer">
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
                        value={(formData.code as string) || ''}
                        onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                        className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-slate-400 uppercase">Supplier Name</label>
                      <input
                        type="text"
                        required
                        placeholder="e.g. Cotton Fabric Mills"
                        value={(formData.name as string) || ''}
                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                        className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-slate-400 uppercase">City</label>
                      <input
                        type="text"
                        placeholder="e.g. Surat"
                        value={(formData.city as string) || ''}
                        onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                        className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-slate-400 uppercase">Contact Phone</label>
                      <input
                        type="text"
                        placeholder="e.g. +91 999998888"
                        value={(formData.phone as string) || ''}
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
                        value={(formData.code as string) || ''}
                        onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                        className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-slate-400 uppercase">Channel Name</label>
                      <input
                        type="text"
                        required
                        placeholder="e.g. Amazon"
                        value={(formData.name as string) || ''}
                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                        className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl"
                      />
                    </div>
                  </div>
                )}

                <div className="flex gap-2 justify-end pt-2">
                  <button
                    type="button"
                    onClick={() => {
                      setShowAddForm(false);
                      setEditingId(null);
                      setFormData({});
                    }}
                    className="px-4 py-2 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 rounded-xl hover:bg-slate-50 cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 bg-slate-950 dark:bg-white hover:bg-slate-850 dark:hover:bg-slate-100 text-white dark:text-slate-950 font-bold rounded-xl cursor-pointer"
                  >
                    {editingId ? 'Save Updates' : 'Save Master Entry'}
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
                  onClick={() => {
                    setEditingId(null);
                    setFormData({});
                    setShowAddForm(true);
                  }}
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

          {/* Master Table with Search & Actions Column */}
          <DataTable
            data={data}
            columns={columnsConfig[activeTab]}
            loading={loading}
            searchable={true}
            searchPlaceholder={`Search ${activeTab}...`}
            actions={renderActions}
            emptyMessage={`No ${activeTab} records found in the database. Add entries using the button above.`}
          />
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      <ConfirmDialog
        isOpen={showDeleteConfirm}
        title="Delete Master Entry"
        message={`Are you sure you want to permanently delete the entry "${deletingRowName}"? This action cannot be undone and may fail if referenced by active WMS records.`}
        confirmLabel="Yes, Delete Record"
        cancelLabel="Cancel"
        variant="danger"
        onConfirm={executeDelete}
        onClose={() => {
          setShowDeleteConfirm(false);
          setDeletingRowId(null);
        }}
      />
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
