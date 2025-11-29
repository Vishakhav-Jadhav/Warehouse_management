// app/warehouses/page.tsx
'use client';

import React, { useEffect, useRef, useState } from 'react';
import * as XLSX from 'xlsx';
import apiClient from '@/lib/apiClient';

/**
 * Warehouses page:
 * - Parses workbook sheets into separate localStorage keys
 * - Real-time sync across tabs via BroadcastChannel (with storage fallback)
 * - Add / Import / Delete (per-item) functionality
 *
 * Install: npm install xlsx
 */

/** -------------------------
 * Types
 * ------------------------- */
type Warehouse = {
  id: string;
  name: string;
  district?: string;
  address?: string;
  manager?: string;
  phone?: string;
  createdAt?: string;
};

type InventoryItem = {
  sku: string;
  name: string;
  category?: string;
  warehouseId?: string;
  rackId?: string;
  qty?: number;
  reorderThreshold?: number;
  unitPrice?: number;
};

type Rack = {
  id: string;
  warehouseId?: string;
  name?: string;
  itemName?: string;
  capacity?: number;
};

type SparePart = {
  id: string;
  name?: string;
  description?: string;
  rate?: number;
  mrp?: number;
  warehouseId?: string;
};

/** -------------------------
 * Helpers
 * ------------------------- */
function uid(prefix = 'id'): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.floor(Math.random() * 1e6).toString(36)}`;
}

/** -------------------------
 * File Upload for Warehouses
 * ------------------------- */
function FileUploader({ onImported }: { onImported?: () => void }) {
  const fileRef = useRef<HTMLInputElement | null>(null);
  const [importing, setImporting] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);

  const handleFile = async (file?: File) => {
    if (!file) return;
    setImportError(null);
    setImporting(true);
    try {
      const XLSX = await import('xlsx');
      const arrayBuffer = await file.arrayBuffer();
      const workbook = XLSX.read(arrayBuffer, { type: 'array' });
      const sheetNames = workbook.SheetNames || [];
      if (sheetNames.length === 0) {
        throw new Error('No sheets found in Excel file');
      }
      const sheet = workbook.Sheets[sheetNames[0]];
      const rawRows: any[] = XLSX.utils.sheet_to_json(sheet, { defval: null, raw: false });
      if (!rawRows || rawRows.length === 0) {
        throw new Error('Sheet is empty');
      }

      // Normalize rows for warehouses
      const normalized = rawRows.map((r: any) => ({
        name: r['name'] ?? r['Name'] ?? r['warehouse_name'] ?? r['Warehouse Name'] ?? null,
        district: r['district'] ?? r['District'] ?? r['location'] ?? r['Location'] ?? null,
        address: r['address'] ?? r['Address'] ?? null,
        manager: r['manager'] ?? r['Manager'] ?? null,
        contact_email: r['contact_email'] ?? r['email'] ?? r['Email'] ?? null,
        phone: r['contact_phone'] ?? r['phone'] ?? r['Phone'] ?? null,
      }));

      const rowsToSend = normalized.filter(r => r.name && r.district);
      if (!rowsToSend.length) {
        throw new Error('No valid warehouse rows to import (name and district required)');
      }

      // Send to backend upload endpoint
      const resp = await apiClient.request('/upload', {
        method: 'POST',
        body: JSON.stringify({ scope: 'warehouses', data: rowsToSend }),
      });

      alert(`Imported ${rowsToSend.length} warehouses successfully.`);
      onImported?.();
    } catch (err: any) {
      console.error('Import exception', err);
      setImportError(err?.message || String(err));
    } finally {
      setImporting(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  return (
    <div className="inline-flex items-start gap-3">
      <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={(e) => handleFile(e.target.files?.[0])} />
      <button
        className="inline-flex items-center gap-2 rounded border px-3 py-2 text-sm hover:bg-slate-50 disabled:opacity-50"
        onClick={() => fileRef.current?.click()}
        disabled={importing}
      >
        <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none">
          <path d="M12 3v12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          <path d="M8 7l4-4 4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          <rect x="3" y="15" width="18" height="6" rx="2" stroke="currentColor" strokeWidth="1.2" />
        </svg>
        {importing ? 'Importing...' : 'Import Warehouses'}
      </button>
      {importError && <div className="text-sm text-red-600">{importError}</div>}
    </div>
  );
}

/** -------------------------
 * WarehouseModal (Add/Edit)
 * ------------------------- */
function WarehouseModal({ onAdded, onRefresh, isEdit = false, warehouseToEdit, open, setOpen }: { onAdded?: () => void; onRefresh?: () => void; isEdit?: boolean; warehouseToEdit?: Warehouse; open: boolean; setOpen: (open: boolean) => void }) {
  const [form, setForm] = useState({ name: '', district: '', address: '', manager: '', phone: '' });
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Pre-fill form when editing or opening
  useEffect(() => {
    if (open) {
      if (isEdit && warehouseToEdit) {
        setForm({
          name: warehouseToEdit.name || '',
          district: warehouseToEdit.district || '',
          address: warehouseToEdit.address || '',
          manager: warehouseToEdit.manager || '',
          phone: warehouseToEdit.phone || '',
        });
      } else {
        setForm({ name: '', district: '', address: '', manager: '', phone: '' });
      }
    }
  }, [isEdit, warehouseToEdit, open]);

  const submit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    setError(null);
    if (!form.name || !form.district) {
      setError('Name and district are required');
      return;
    }
    setLoading(true);
    try {
      const whData = {
        name: form.name,
        district: form.district,
        address: form.address || undefined,
        manager: form.manager || undefined,
        phone: form.phone,
      };

      if (isEdit && warehouseToEdit) {
        const result = await apiClient.patchWarehouse(warehouseToEdit.id, whData);
        if (!result.success) {
          setError(result.message);
          return;
        }
      } else {
        await apiClient.createWarehouse(whData);
      }

      setForm({ name: '', district: '', address: '', manager: '', phone: '' });
      setOpen(false);
      onAdded?.();
      onRefresh?.(); // Refresh data
    } catch (err: any) {
      setError(err.message || `Failed to ${isEdit ? 'edit' : 'add'} warehouse`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/30" onClick={() => setOpen(false)} />
          <div className="relative z-10 w-full max-w-md rounded bg-white p-4 sm:p-6 shadow-lg">
            <h3 className="text-lg font-semibold">{isEdit ? 'Edit Warehouse' : 'Add Warehouse'}</h3>
            <form className="mt-4 space-y-3" onSubmit={submit}>
              <div>
                <label className="text-sm">Name</label>
                <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="mt-1 w-full rounded border px-3 py-2 text-sm" placeholder="Warehouse name" />
              </div>
              <div>
                <label className="text-sm">District / Location</label>
                <input value={form.district} onChange={(e) => setForm({ ...form, district: e.target.value })} className="mt-1 w-full rounded border px-3 py-2 text-sm" placeholder="District or Location" />
              </div>
              <div>
                <label className="text-sm">Address</label>
                <input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} className="mt-1 w-full rounded border px-3 py-2 text-sm" placeholder="Address (optional)" />
              </div>
              <div>
                <label className="text-sm">Manager</label>
                <input value={form.manager} onChange={(e) => setForm({ ...form, manager: e.target.value })} className="mt-1 w-full rounded border px-3 py-2 text-sm" placeholder="Manager (optional)" />
              </div>
              <div>
                <label className="text-sm">Phone</label>
                <input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className="mt-1 w-full rounded border px-3 py-2 text-sm" placeholder="Phone (optional)" />
              </div>

              {error && <div className="text-sm text-red-600">{error}</div>}

              <div className="mt-4 flex flex-col sm:flex-row justify-end gap-2">
                <button type="button" onClick={() => setOpen(false)} className="rounded border px-3 py-2 text-sm">Cancel</button>
                <button type="submit" disabled={loading} className="rounded bg-slate-800 px-3 py-2 text-sm text-white disabled:opacity-60">{loading ? (isEdit ? 'Saving...' : 'Adding...') : (isEdit ? 'Save Changes' : 'Add')}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}

/** -------------------------
 * Main component with delete and realtime
 * ------------------------- */
export default function WarehousesPage() {
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [racks, setRacks] = useState<Rack[]>([]);
  const [spareparts, setSpareparts] = useState<SparePart[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  const loadAll = async () => {
    setLoading(true);
    try {
      const [warehousesRes, inventoryRes] = await Promise.all([
        apiClient.getWarehouses(),
        apiClient.getInventory()
      ]);

      setWarehouses((warehousesRes.data || []).map((w: any) => ({ ...w, id: w._id })));
      setInventory(inventoryRes.data || []);
      // For now, keep racks and spareparts as empty since we don't have dedicated endpoints
      setRacks([]);
      setSpareparts([]);
    } catch (error) {
      console.error('Failed to load data:', error);
      setWarehouses([]);
      setInventory([]);
      setRacks([]);
      setSpareparts([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleImported = () => loadAll();
  const handleAdded = () => loadAll();

  // delete helpers (per-item)
  const deleteWarehouse = async (id: string) => {
    if (!confirm('Delete this warehouse?')) return;
    try {
      const result = await apiClient.deleteWarehouse(id);
      if (!result.success) {
        alert(result.message);
        return;
      }
      loadAll();
    } catch (error) {
      console.error('Failed to delete warehouse:', error);
      alert('Failed to delete warehouse');
    }
  };

  // Compute per-warehouse stats
  const statsByWarehouse = (w: Warehouse) => {
    const wid = (w as any).warehouse_id;
    const items = inventory.filter((it) => it.warehouseId === wid);
    const distinctItems = new Set(items.map((i) => i.sku)).size;
    const totalQty = items.reduce((s, it) => s + (Number(it.qty) || 0), 0);
    const totalValue = items.reduce((s, it) => s + (Number(it.qty) || 0) * (Number(it.unitPrice) || 0), 0);
    const racksForW = racks.filter((r) => r.warehouseId === wid).length;
    const spareForW = spareparts.filter((s) => s.warehouseId === wid).length;
    return { distinctItems, totalQty, totalValue, racksForW, spareForW };
  };

  const filtered = warehouses.filter((w) =>
    (w.name + ' ' + (w.district || '') + ' ' + (w.address || '')).toLowerCase().includes(search.toLowerCase())
  );

  const clearAll = () => {
    alert('Clear all functionality not implemented for backend data');
  };

  // show warehouse details modal (inventory/racks/spares) for management and deletion
  const [selectedWarehouse, setSelectedWarehouse] = useState<Warehouse | null>(null);
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [warehouseToEdit, setWarehouseToEdit] = useState<Warehouse | null>(null);

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex flex-col space-y-4 sm:flex-row sm:items-center sm:justify-between sm:space-y-0">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-900">Warehouses</h1>
          <p className="mt-1 text-sm text-slate-600">Manage warehouse locations and overview</p>
        </div>

        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 sm:gap-3">
          <FileUploader onImported={handleImported} />
          <button onClick={() => setAddModalOpen(true)} className="inline-flex items-center gap-2 rounded bg-slate-800 px-3 py-2 text-sm text-white hover:bg-slate-700">
            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none"><path d="M12 5v14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" /><path d="M5 12h14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" /></svg>
            Add Warehouse
          </button>
          <button onClick={clearAll} className="rounded border px-3 py-2 text-sm text-red-600 hover:bg-red-50">Clear all data</button>
        </div>
      </div>

      <div>
        <div className="flex flex-col space-y-3 sm:flex-row sm:items-center sm:justify-between sm:space-y-0">
          <h2 className="text-lg font-medium">All Warehouses</h2>
          <div className="relative w-full sm:w-64">
            <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none"><path d="M21 21l-4.35-4.35" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
            </div>
            <input className="w-full rounded border px-3 py-2 pl-10 text-sm" placeholder="Search warehouses..." value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
        </div>

        <div className="mt-4">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            {loading ? (
              <div className="col-span-full py-8 text-center text-slate-500">Loading...</div>
            ) : filtered.length === 0 ? (
              <div className="col-span-full py-8 text-center text-slate-500">No warehouses found.</div>
            ) : (
              filtered.map((w) => {
                const s = statsByWarehouse(w);
                return (
                  <div key={w.id} className="rounded border bg-white p-4 shadow-sm">
                    <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between">
                      <div className="flex-1">
                        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2">
                          <div className="flex-1">
                            <div className="font-semibold text-slate-900 truncate">{w.name}</div>
                            <div className="text-sm text-slate-600">{w.district || '—'}</div>
                            {w.address && <div className="mt-2 text-xs text-slate-500 line-clamp-2">{w.address}</div>}
                          </div>
                          <div className="text-left sm:text-right">
                            <div className="text-xs text-slate-500">Racks: {s.racksForW}</div>
                            <div className="text-xs text-slate-500">SpareParts: {s.spareForW}</div>
                          </div>
                        </div>

                        <div className="mt-3 grid grid-cols-3 gap-2">
                          <div className="rounded border p-2 text-xs">
                            <div className="text-[13px] font-medium">{s.distinctItems}</div>
                            <div className="text-[12px] text-slate-500">Items</div>
                          </div>
                          <div className="rounded border p-2 text-xs">
                            <div className="text-[13px] font-medium">{s.totalQty}</div>
                            <div className="text-[12px] text-slate-500">Total Qty</div>
                          </div>
                          <div className="rounded border p-2 text-xs">
                            <div className="text-[13px] font-medium">₹{s.totalValue.toFixed(2)}</div>
                            <div className="text-[12px] text-slate-500">Stock Value</div>
                          </div>
                        </div>

                        <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-slate-500">
                          <div>Manager: {w.manager || '—'}</div>
                          <div>Phone: {w.phone || '—'}</div>
                        </div>
                      </div>

                      <div className="mt-4 sm:mt-0 sm:ml-4 flex sm:flex-col items-center sm:items-start gap-2">
                        <div className="flex gap-2">
                          <button title="Open in Google Maps" onClick={() => {
                            const q = encodeURIComponent(w.address || `${w.name} ${w.district}`);
                            window.open(`https://www.google.com/maps/search/?api=1&query=${q}`, '_blank');
                          }} className="rounded bg-slate-50 px-2 py-1 text-sm">
                            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none"><path d="M12 2C8.14 2 5 5.14 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.86-3.14-7-7-7z" stroke="currentColor" strokeWidth="1.2"/></svg>
                          </button>
                          <button title="View details" onClick={() => setSelectedWarehouse(w)} className="rounded bg-slate-50 px-2 py-1 text-sm">Details</button>
                        </div>
                        <div className="flex gap-2">
                          <button title="Edit warehouse" onClick={() => { setWarehouseToEdit(w); setEditModalOpen(true); }} className="rounded border px-2 py-1 text-sm text-blue-600 hover:bg-blue-50">
                            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/><path d="m18.5 2.5 3 3L12 15l-4 1 1-4 9.5-9.5z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                          </button>
                          <button title="Delete warehouse" onClick={() => deleteWarehouse(w.id)} className="rounded border px-2 py-1 text-sm text-red-600 hover:bg-red-50">Delete</button>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      {/* Add Warehouse Modal */}
      <WarehouseModal open={addModalOpen} setOpen={setAddModalOpen} onAdded={handleAdded} onRefresh={loadAll} />

      {/* Edit Warehouse Modal */}
      <WarehouseModal open={editModalOpen} setOpen={setEditModalOpen} isEdit={true} warehouseToEdit={warehouseToEdit || undefined} onAdded={handleAdded} onRefresh={loadAll} />

      {/* Warehouse Details Modal */}
      {selectedWarehouse && (
        <div className="fixed inset-0 z-50 flex items-start justify-center p-4 overflow-auto">
          <div className="absolute inset-0 bg-black/30" onClick={() => setSelectedWarehouse(null)} />
          <div className="relative z-10 w-full max-w-4xl rounded bg-white p-4 sm:p-6 shadow-lg">
            <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2">
              <div>
                <h3 className="text-lg font-semibold">{selectedWarehouse.name}</h3>
                <div className="text-sm text-slate-500">{selectedWarehouse.district}</div>
              </div>
              <div className="flex flex-col sm:flex-row gap-2">
                <button onClick={() => setSelectedWarehouse(null)} className="rounded border px-3 py-1 text-sm">Close</button>
                <button onClick={() => deleteWarehouse(selectedWarehouse.id)} className="rounded border px-3 py-1 text-sm text-red-600">Delete Warehouse</button>
              </div>
            </div>

            <div className="mt-4 grid grid-cols-1 lg:grid-cols-2 gap-4">
              <div>
                <h4 className="font-medium">Inventory</h4>
                <div className="mt-2 space-y-2 max-h-64 overflow-auto">
                  {inventory.filter((it) => it.warehouseId === (selectedWarehouse as any).warehouse_id).length === 0 ? (
                    <div className="text-xs text-slate-500">No inventory for this warehouse.</div>
                  ) : (
                    inventory.filter((it) => it.warehouseId === (selectedWarehouse as any).warehouse_id).map((it) => (
                      <div key={it.sku} className="flex items-center justify-between rounded border p-2 text-xs">
                        <div className="flex-1 min-w-0">
                          <div className="font-medium truncate">{it.name} <span className="text-[11px] text-slate-500">({it.sku})</span></div>
                          <div className="text-[11px] text-slate-500">Qty: {it.qty || 0} • ₹{(it.unitPrice || 0).toFixed(2)}</div>
                        </div>
                        <div className="flex gap-2 ml-2">
                          <span className="text-[11px] text-slate-500">No delete</span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              <div>
                <h4 className="font-medium">Racks</h4>
                <div className="mt-2 space-y-2 max-h-64 overflow-auto">
                  {racks.filter((r) => r.warehouseId === selectedWarehouse.id).length === 0 ? (
                    <div className="text-xs text-slate-500">No racks for this warehouse.</div>
                  ) : (
                    racks.filter((r) => r.warehouseId === selectedWarehouse.id).map((r) => (
                      <div key={r.id} className="flex items-center justify-between rounded border p-2 text-xs">
                        <div>
                          <div className="font-medium">{r.name || r.id}</div>
                          <div className="text-[11px] text-slate-500">Capacity: {r.capacity ?? '—'}</div>
                        </div>
                        <div>
                          <span className="text-[11px] text-slate-500">No delete</span>
                        </div>
                      </div>
                    ))
                  )}
                </div>

                <h4 className="font-medium mt-4">Spare Parts</h4>
                <div className="mt-2 space-y-2 max-h-52 overflow-auto">
                  {spareparts.filter((s) => s.warehouseId === selectedWarehouse.id).length === 0 ? (
                    <div className="text-xs text-slate-500">No spare parts for this warehouse.</div>
                  ) : (
                    spareparts.filter((s) => s.warehouseId === selectedWarehouse.id).map((s) => (
                      <div key={s.id} className="flex items-center justify-between rounded border p-2 text-xs">
                        <div>
                          <div className="font-medium">{s.name || s.id}</div>
                          <div className="text-[11px] text-slate-500">₹{(s.rate || 0).toFixed(2)}</div>
                        </div>
                        <div>
                          <span className="text-[11px] text-slate-500">No delete</span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
