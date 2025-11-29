// app/inventory/page.tsx
'use client';

import React, { useEffect, useRef, useState } from 'react';
import * as XLSX from 'xlsx';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Plus, Search, Upload, Edit2 } from 'lucide-react';
import apiClient from '@/lib/apiClient';

// Small modal component used in this file
function Modal({ open, title, onClose, children }: { open: boolean; title?: string; onClose: () => void; children: React.ReactNode; }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative z-10 w-full max-w-3xl rounded bg-white p-6 shadow-lg">
        {title && <h3 className="mb-4 text-lg font-semibold">{title}</h3>}
        {children}
      </div>
    </div>
  );
}

/**
 * Inventory page — fully aligned with Excel columns:
 * Item_ID -> sku
 * Item_Name -> name
 * Category -> category (text)
 * Warehouse_ID -> warehouse_id
 * Rack_ID -> rack_id
 * Stock_On_Hand -> qty (integer)
 * Reorder_Level -> reorder_threshold (integer)
 * Unit_Cost -> unit_price (numeric)
 *
 * This file:
 * - keeps workbook in memory, lets you choose a sheet and import it
 * - upserts including category and rack_id
 * - checks information_schema for missing columns and shows SQL to add them
 * - realtime Supabase subscription, add/delete, search
 *
 * Prereqs:
 * - npm i xlsx
 * - Ensure supabase client exported from '@/lib/supabase'
 */

type InventoryItem = {
  sku: string;
  name: string;
  category?: string | null;
  warehouse_id?: string | null;
  rack_id?: string | null;
  qty: number;
  unit_price: number;
  reorder_threshold: number;
};

const safeNum = (v: any) => {
  const n = Number(String(v ?? '').replace(/[^0-9.\-]/g, ''));
  return Number.isFinite(n) ? n : 0;
};
const uuidLike = () => `sku-${Date.now().toString(36)}-${Math.floor(Math.random() * 1e6).toString(36)}`;

function mapRecordToItem(rec: any): InventoryItem {
  return {
    sku: rec.sku ?? rec.item_id ?? String(rec.id ?? uuidLike()),
    name: rec.name ?? rec.item_name ?? '',
    category: rec.category ?? null,
    warehouse_id: rec.warehouse_id ?? rec.warehouse ?? null,
    rack_id: rec.rack_id ?? rec.rack ?? null,
    qty: Number(rec.qty ?? rec.stock_on_hand ?? 0),
    unit_price: Number(rec.unit_price ?? rec.unit_cost ?? 0),
    reorder_threshold: Number(rec.reorder_threshold ?? rec.reorder_level ?? 0)
  };
}

function stripKeyFromObjects<T extends Record<string, any>>(arr: T[], key: string) {
  return arr.map((o) => {
    const c = { ...o };
    if (key in c) delete c[key];
    return c;
  });
}

/** -------------------------
 * Component
 * ------------------------- */
export default function InventoryPage() {
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  const fileRef = useRef<HTMLInputElement | null>(null);

  // workbook in memory
  const [workbook, setWorkbook] = useState<XLSX.WorkBook | null>(null);
  const [workbookSheets, setWorkbookSheets] = useState<string[] | null>(null);
  const [sheetPreviews, setSheetPreviews] = useState<Record<string, any[]> | null>(null);
  const [selectedSheet, setSelectedSheet] = useState<string | null>(null);
  const [showSheetPicker, setShowSheetPicker] = useState(false);

  const [importing, setImporting] = useState(false);
  const [importMessage, setImportMessage] = useState<string | null>(null);
  const [importError, setImportError] = useState<string | null>(null);

  // schema-check UI (removed since columns are now added via migration)
  // const [missingColumns, setMissingColumns] = useState<string[] | null>(null);

  // add item modal
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState({
    sku: '',
    name: '',
    category: '',
    warehouse_id: '',
    rack_id: '',
    qty: '',
    unit_price: '',
    reorder_threshold: ''
  });
  const [addError, setAddError] = useState<string | null>(null);
  const [addLoading, setAddLoading] = useState(false);

  // edit item modal
  const [editing, setEditing] = useState(false);
  const [itemToEdit, setItemToEdit] = useState<InventoryItem | null>(null);
  const [editForm, setEditForm] = useState({
    sku: '',
    name: '',
    category: '',
    warehouse_id: '',
    rack_id: '',
    qty: '',
    unit_price: '',
    reorder_threshold: ''
  });
  const [editError, setEditError] = useState<string | null>(null);
  const [editLoading, setEditLoading] = useState(false);

  useEffect(() => {
    // load data and subscribe realtime (schema is now correct via migration)
    (async () => {
      await loadInventory();
      subscribeRealtime();
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function subscribeRealtime() {
    // TODO: Integrate with custom backend realtime
  }

  async function loadInventory() {
    setLoading(true);
    try {
      const data = await apiClient.getInventory();
      setItems(data.data || []);
    } catch (err) {
      console.error('loadInventory failed', err);
      setItems([]);
    } finally {
      setLoading(false);
    }
  }

  const filteredItems = items.filter(
    (item) =>
      (item.name || '').toLowerCase().includes(search.toLowerCase()) ||
      (item.sku || '').toLowerCase().includes(search.toLowerCase())
  );

  /** When a file is chosen: parse workbook fully and open sheet-picker */
  const onFileChosen = async (file?: File | null) => {
    setWorkbook(null);
    setWorkbookSheets(null);
    setSheetPreviews(null);
    setSelectedSheet(null);
    setShowSheetPicker(false);
    setImportError(null);
    setImportMessage(null);

    if (!file) return;
    try {
      const ab = await file.arrayBuffer();
      const wb = XLSX.read(ab, { type: 'array' });
      setWorkbook(wb);
      setWorkbookSheets(wb.SheetNames);

      const previews: Record<string, any[]> = {};
      for (const name of wb.SheetNames) {
        const ws = wb.Sheets[name];
        const json = XLSX.utils.sheet_to_json<Record<string, any>>(ws, { defval: '' });
        previews[name] = json.slice(0, 10);
      }
      setSheetPreviews(previews);
      setShowSheetPicker(true);
    } catch (err) {
      console.error('Failed to read workbook', err);
      setImportError('Failed to read workbook. Make sure it is a valid .xlsx file.');
    }
  };

  /** Import the selected sheet fully (maps Inventory_Data columns) */
  const importSelectedSheet = async () => {
    setImportMessage(null);
    setImportError(null);
    if (!workbook || !selectedSheet) {
      setImportError('No sheet selected or workbook missing.');
      return;
    }
    setImporting(true);

    try {
      const ws = workbook.Sheets[selectedSheet];
      if (!ws) {
        setImportError('Sheet not found in workbook.');
        setImporting(false);
        return;
      }

      const json = XLSX.utils.sheet_to_json<Record<string, any>>(ws, { defval: '' });
      if (!json || json.length === 0) {
        setImportError('Selected sheet is empty.');
        setImporting(false);
        return;
      }

      const payloads = json.map((r) => {
        const norm: Record<string, any> = {};
        for (const k of Object.keys(r)) norm[k.trim().toLowerCase()] = r[k];

        const sku = String(norm['item_id'] ?? norm['itemid'] ?? norm['item id'] ?? uuidLike());
        const name = String(norm['item_name'] ?? norm['itemname'] ?? norm['item name'] ?? norm['name'] ?? '');
        const category = String(norm['category'] ?? '').trim() || null;
        const warehouse_id = String(norm['warehouse_id'] ?? norm['warehouseid'] ?? norm['warehouse id'] ?? norm['warehouse'] ?? '').trim() || null;
        const rack_id = String(norm['rack_id'] ?? norm['rackid'] ?? norm['rack id'] ?? norm['rack'] ?? '').trim() || null;
        const qty = safeNum(norm['stock_on_hand'] ?? norm['stock_onhand'] ?? norm['stock on hand'] ?? norm['qty'] ?? 0);
        const reorder_threshold = safeNum(norm['reorder_level'] ?? norm['reorderlevel'] ?? norm['reorder level'] ?? 0);
        const unit_price = safeNum(norm['unit_cost'] ?? norm['unitcost'] ?? norm['unit cost'] ?? norm['unitprice'] ?? 0);

        return {
          sku,
          name,
          category,
          warehouse_id,
          rack_id,
          qty,
          unit_price,
          reorder_threshold
        };
      });

      // Send to backend inventory import endpoint
      const result = await apiClient.importInventory(payloads);
      if (result.success) {
        setImportMessage(`Successfully imported ${result.inserted} items${result.skipped > 0 ? `, skipped ${result.skipped} invalid rows` : ''}.`);
        setShowSheetPicker(false);
        setWorkbook(null);
        setWorkbookSheets(null);
        setSheetPreviews(null);
        setSelectedSheet(null);
        loadInventory(); // Refresh the inventory list
      } else {
        setImportError('Import failed: ' + (result.error || 'Unknown error'));
      }
    } catch (err: any) {
      console.error('Import failed', err);
      setImportError(String(err?.message ?? err));
    } finally {
      setImporting(false);
    }
  };

  /** Add single item (upsert with fallback) */
  const submitAdd = async (e?: React.FormEvent) => {
    e?.preventDefault();
    setAddError(null);
    setAddLoading(true);
    try {
      if (!form.sku || !form.name) {
        setAddError('SKU and name required');
        setAddLoading(false);
        return;
      }

      const payload = {
        sku: form.sku,
        name: form.name,
        category: form.category || null,
        warehouse_id: form.warehouse_id || null,
        rack_id: form.rack_id || null,
        qty: safeNum(form.qty),
        unit_price: safeNum(form.unit_price),
        reorder_threshold: safeNum(form.reorder_threshold)
      };

      try {
        await apiClient.createInventoryItem(payload);

        // Reset form and refresh data
        setForm({
          sku: '',
          name: '',
          category: '',
          warehouse_id: '',
          rack_id: '',
          qty: '',
          unit_price: '',
          reorder_threshold: ''
        });
        setAdding(false);
        loadInventory(); // Refresh the list
      } catch (error: any) {
        setAddError(error.message || 'Failed to add item');
      }
    } catch (err: any) {
      console.error('Add failed', err);
      setAddError(String(err?.message ?? err));
    } finally {
      setAddLoading(false);
    }
  };

  /** Edit item */
  const submitEdit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    setEditError(null);
    setEditLoading(true);
    try {
      if (!editForm.sku || !editForm.name) {
        setEditError('SKU and name required');
        setEditLoading(false);
        return;
      }

      const payload = {
        sku: editForm.sku,
        name: editForm.name,
        category: editForm.category || null,
        warehouse_id: editForm.warehouse_id || null,
        rack_id: editForm.rack_id || null,
        qty: safeNum(editForm.qty),
        unit_price: safeNum(editForm.unit_price),
        reorder_threshold: safeNum(editForm.reorder_threshold)
      };

      await apiClient.updateInventoryItem(itemToEdit!.sku, payload);

      // Reset form and refresh data
      setEditForm({
        sku: '',
        name: '',
        category: '',
        warehouse_id: '',
        rack_id: '',
        qty: '',
        unit_price: '',
        reorder_threshold: ''
      });
      setEditing(false);
      setItemToEdit(null);
      loadInventory(); // Refresh the list
    } catch (error: any) {
      setEditError(error.message || 'Failed to update item');
    } finally {
      setEditLoading(false);
    }
  };

  /** Delete item */
  const deleteItem = async (sku: string, warehouse_id?: string | null) => {
    if (!confirm('Delete this inventory item?')) return;
    try {
      await apiClient.deleteInventoryItem(sku);
      loadInventory(); // Refresh the list
    } catch (error: any) {
      console.error('Failed to delete item:', error);
      alert('Failed to delete item: ' + error.message);
    }
  };


  return (
    <div className="p-6 space-y-6">
      {/* Schema check removed since columns are now properly added via migration */}

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Inventory</h1>
          <p className="mt-1 text-sm text-slate-600">Upload workbook → pick sheet → import (columns aligned to Inventory_Data)</p>
        </div>

        <div className="flex gap-2">
          <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={(e) => onFileChosen(e.target.files?.[0] ?? null)} />
          <Button variant="outline" onClick={() => fileRef.current?.click()}>
            <Upload className="mr-2 h-4 w-4" />
            Upload Workbook
          </Button>

          <Button onClick={() => setAdding(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Add Item
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>All Items</CardTitle>
            <div className="relative w-64">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <Input type="search" placeholder="Search items..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-10" />
            </div>
          </div>
        </CardHeader>

        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b text-left text-sm font-medium text-slate-600">
                  <th className="pb-3">SKU</th>
                  <th className="pb-3">Name</th>
                  <th className="pb-3">Category</th>
                  <th className="pb-3">Warehouse</th>
                  <th className="pb-3">Rack</th>
                  <th className="pb-3">Quantity</th>
                  <th className="pb-3">Unit Price</th>
                  <th className="pb-3">Stock Value</th>
                  <th className="pb-3">Status</th>
                  <th className="pb-3">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredItems.map((item) => {
                  const stockValue = (item.qty || 0) * (item.unit_price || 0);
                  const isLowStock = (item.qty || 0) <= (item.reorder_threshold || 0);

                  return (
                    <tr key={`${item.sku}::${item.warehouse_id ?? ''}`} className="border-b text-sm">
                      <td className="py-3 font-mono text-slate-900">{item.sku}</td>
                      <td className="py-3 text-slate-900">{item.name}</td>
                      <td className="py-3 text-slate-600">{item.category ?? '—'}</td>
                      <td className="py-3 text-slate-600">{item.warehouse_id ?? 'N/A'}</td>
                      <td className="py-3 text-slate-600">{item.rack_id ?? '—'}</td>
                      <td className="py-3 text-slate-900">{item.qty}</td>
                      <td className="py-3 text-slate-900">₹{(item.unit_price || 0).toFixed(2)}</td>
                      <td className="py-3 font-medium text-slate-900">₹{stockValue.toFixed(2)}</td>
                      <td className="py-3">
                        <span className={`inline-flex rounded-full px-2 py-1 text-xs font-medium ${isLowStock ? 'bg-orange-100 text-orange-700' : 'bg-green-100 text-green-700'}`}>
                          {isLowStock ? 'Low Stock' : 'In Stock'}
                        </span>
                      </td>
                      <td className="py-3">
                        <div className="flex items-center gap-2">
                          <Button variant="ghost" size="sm" onClick={() => { setItemToEdit(item); setEditForm({ sku: item.sku, name: item.name, category: item.category || '', warehouse_id: item.warehouse_id || '', rack_id: item.rack_id || '', qty: String(item.qty), unit_price: String(item.unit_price), reorder_threshold: String(item.reorder_threshold) }); setEditing(true); }}>
                            <Edit2 className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="sm" onClick={() => deleteItem(item.sku, item.warehouse_id)}>
                            <span className="text-red-600 text-sm">Delete</span>
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {filteredItems.length === 0 && !loading && (
                  <tr>
                    <td colSpan={10} className="py-6 text-center text-slate-500">No items found.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Import messages */}
      {importMessage && <div className="text-sm text-green-700">{importMessage}</div>}
      {importError && <div className="text-sm text-red-600">{importError}</div>}

      {/* Import modal */}
      <Modal open={showSheetPicker} title="Import Excel - choose sheet" onClose={() => { setShowSheetPicker(false); setWorkbook(null); setWorkbookSheets(null); setSheetPreviews(null); }}>
        <div className="mb-4">
          <p className="text-sm text-slate-600">Choose a sheet to preview and import. Data will be validated and imported to inventory.</p>
        </div>

        <div className="mb-4 flex gap-2 flex-wrap">
          {workbookSheets?.map(sn => (
            <button key={sn} onClick={() => setSelectedSheet(sn)} className={`px-3 py-1 rounded border ${selectedSheet === sn ? 'bg-sky-100 border-sky-400' : 'bg-white'}`}>
              {sn}
            </button>
          ))}
        </div>

        {selectedSheet && (
          <>
            <div className="mb-2"><strong>Selected:</strong> {selectedSheet}</div>
            <div className="mb-2"><strong>Detected headers:</strong> {sheetPreviews?.[selectedSheet]?.[0] ? Object.keys(sheetPreviews[selectedSheet][0]).join(', ') : '—'}</div>

            {importError && <div className="mb-2 rounded border-l-4 border-red-400 bg-red-50 p-3 text-sm text-red-700"><strong>Import error:</strong> {importError}</div>}

            <div className="mb-4 max-h-56 overflow-auto border rounded p-2">
              {sheetPreviews?.[selectedSheet] && sheetPreviews[selectedSheet].length > 0 ? (
                <table className="w-full text-xs">
                  <thead><tr>{Object.keys(sheetPreviews[selectedSheet][0]).map(h => <th key={h} className="border px-2 py-1 text-left">{h}</th>)}</tr></thead>
                  <tbody>
                    {sheetPreviews[selectedSheet].slice(0, 20).map((r, i) => <tr key={i}>{Object.keys(r).map(k => <td key={k} className="border px-2 py-1 align-top">{String(r[k] ?? '')}</td>)}</tr>)}
                  </tbody>
                </table>
              ) : (
                <div className="text-sm text-slate-500">No preview available</div>
              )}
            </div>

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => { setShowSheetPicker(false); setWorkbook(null); setWorkbookSheets(null); setSheetPreviews(null); setSelectedSheet(null); }}>Cancel</Button>
              <Button onClick={importSelectedSheet} disabled={importing}>{importing ? 'Importing...' : 'Import Sheet'}</Button>
            </div>
          </>
        )}
      </Modal>

      {/* Add Item Modal */}
      {adding && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/30" onClick={() => setAdding(false)} />
          <div className="relative z-10 w-full max-w-md rounded bg-white p-6 shadow-lg">
            <h3 className="text-lg font-semibold">Add Inventory Item</h3>
            <form className="mt-4 space-y-3" onSubmit={submitAdd}>
              <div>
                <label className="text-sm">SKU</label>
                <input value={form.sku} onChange={(e) => setForm({ ...form, sku: e.target.value })} className="mt-1 w-full rounded border px-3 py-2 text-sm" placeholder="Item_ID (unique)" />
              </div>
              <div>
                <label className="text-sm">Name</label>
                <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="mt-1 w-full rounded border px-3 py-2 text-sm" placeholder="Item_Name" />
              </div>

              <div>
                <label className="text-sm">Category</label>
                <input value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} className="mt-1 w-full rounded border px-3 py-2 text-sm" placeholder="Category" />
              </div>

              <div>
                <label className="text-sm">Warehouse ID</label>
                <input value={form.warehouse_id} onChange={(e) => setForm({ ...form, warehouse_id: e.target.value })} className="mt-1 w-full rounded border px-3 py-2 text-sm" placeholder="Warehouse_ID (e.g. W1)" />
              </div>
              <div>
                <label className="text-sm">Rack ID (optional)</label>
                <input value={form.rack_id} onChange={(e) => setForm({ ...form, rack_id: e.target.value })} className="mt-1 w-full rounded border px-3 py-2 text-sm" placeholder="Rack_ID (optional)" />
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="text-sm">Qty</label>
                  <input value={form.qty} onChange={(e) => setForm({ ...form, qty: e.target.value })} className="mt-1 w-full rounded border px-3 py-2 text-sm" placeholder="Stock_On_Hand" />
                </div>
                <div>
                  <label className="text-sm">Unit Price</label>
                  <input value={form.unit_price} onChange={(e) => setForm({ ...form, unit_price: e.target.value })} className="mt-1 w-full rounded border px-3 py-2 text-sm" placeholder="Unit_Cost" />
                </div>
                <div>
                  <label className="text-sm">Reorder</label>
                  <input value={form.reorder_threshold} onChange={(e) => setForm({ ...form, reorder_threshold: e.target.value })} className="mt-1 w-full rounded border px-3 py-2 text-sm" placeholder="Reorder_Level" />
                </div>
              </div>

              {addError && <div className="text-sm text-red-600">{addError}</div>}

              <div className="mt-4 flex justify-end gap-2">
                <button type="button" onClick={() => setAdding(false)} className="rounded border px-3 py-2 text-sm">Cancel</button>
                <button type="submit" disabled={addLoading} className="rounded bg-slate-800 px-3 py-2 text-sm text-white disabled:opacity-60">{addLoading ? 'Adding...' : 'Add'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Item Modal */}
      {editing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/30" onClick={() => setEditing(false)} />
          <div className="relative z-10 w-full max-w-md rounded bg-white p-6 shadow-lg">
            <h3 className="text-lg font-semibold">Edit Inventory Item</h3>
            <form className="mt-4 space-y-3" onSubmit={submitEdit}>
              <div>
                <label className="text-sm">SKU</label>
                <input value={editForm.sku} onChange={(e) => setEditForm({ ...editForm, sku: e.target.value })} className="mt-1 w-full rounded border px-3 py-2 text-sm" placeholder="Item_ID (unique)" />
              </div>
              <div>
                <label className="text-sm">Name</label>
                <input value={editForm.name} onChange={(e) => setEditForm({ ...editForm, name: e.target.value })} className="mt-1 w-full rounded border px-3 py-2 text-sm" placeholder="Item_Name" />
              </div>

              <div>
                <label className="text-sm">Category</label>
                <input value={editForm.category} onChange={(e) => setEditForm({ ...editForm, category: e.target.value })} className="mt-1 w-full rounded border px-3 py-2 text-sm" placeholder="Category" />
              </div>

              <div>
                <label className="text-sm">Warehouse ID</label>
                <input value={editForm.warehouse_id} onChange={(e) => setEditForm({ ...editForm, warehouse_id: e.target.value })} className="mt-1 w-full rounded border px-3 py-2 text-sm" placeholder="Warehouse_ID (e.g. W1)" />
              </div>
              <div>
                <label className="text-sm">Rack ID (optional)</label>
                <input value={editForm.rack_id} onChange={(e) => setEditForm({ ...editForm, rack_id: e.target.value })} className="mt-1 w-full rounded border px-3 py-2 text-sm" placeholder="Rack_ID (optional)" />
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="text-sm">Qty</label>
                  <input value={editForm.qty} onChange={(e) => setEditForm({ ...editForm, qty: e.target.value })} className="mt-1 w-full rounded border px-3 py-2 text-sm" placeholder="Stock_On_Hand" />
                </div>
                <div>
                  <label className="text-sm">Unit Price</label>
                  <input value={editForm.unit_price} onChange={(e) => setEditForm({ ...editForm, unit_price: e.target.value })} className="mt-1 w-full rounded border px-3 py-2 text-sm" placeholder="Unit_Cost" />
                </div>
                <div>
                  <label className="text-sm">Reorder</label>
                  <input value={editForm.reorder_threshold} onChange={(e) => setEditForm({ ...editForm, reorder_threshold: e.target.value })} className="mt-1 w-full rounded border px-3 py-2 text-sm" placeholder="Reorder_Level" />
                </div>
              </div>

              {editError && <div className="text-sm text-red-600">{editError}</div>}

              <div className="mt-4 flex justify-end gap-2">
                <button type="button" onClick={() => setEditing(false)} className="rounded border px-3 py-2 text-sm">Cancel</button>
                <button type="submit" disabled={editLoading} className="rounded bg-slate-800 px-3 py-2 text-sm text-white disabled:opacity-60">{editLoading ? 'Updating...' : 'Update'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );

}
