'use client';

import React, { useEffect, useRef, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Plus, Upload } from 'lucide-react';
import apiClient from '@/lib/apiClient';

/**
 * SparePartsPage - full updated version with robust Excel import and realtime
 *
 * Requirements:
 *  - npm i xlsx
 *  - supabase client exported from '@/lib/supabase'
 *  - DB tables: spare_parts (id, part_number, name, description, compatibility, reorder_threshold, category_id, rack_id)
 *    and categories (id, name), racks (id, name)
 *
 * If your DB uses different table/column names, update the table names
 * or column mapping accordingly. The import has a "missing column recovery" helper that will attempt to remove unknown
 * columns from the payload and retry automatically.
 */

// Tiny modal primitive used for examples — replace with your modal components if you have them
function Modal({ open, onClose, children, title }: { open: boolean; onClose: () => void; children: React.ReactNode; title?: string; }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative z-10 w-full max-w-2xl rounded bg-white p-4 sm:p-6 shadow-lg">
        {title && <h3 className="mb-4 text-lg font-semibold">{title}</h3>}
        {children}
      </div>
    </div>
  );
}

interface SparePart {
  id?: string;
  part_number?: string;
  name?: string;
  description?: string | null;
  category?: { name?: string } | null;
  category_id?: string | null;
  rack_id?: string | null;
  compatibility?: string | null;
  reorder_threshold?: number | null;
}

export default function SparePartsPage() {
  const [parts, setParts] = useState<SparePart[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  // file import states
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const workbookRef = useRef<any | null>(null); // persist workbook across hot reloads
  const [workbookSheets, setWorkbookSheets] = useState<string[]>([]);
  const [sheetPreviews, setSheetPreviews] = useState<any[] | null>(null);
  const [selectedSheet, setSelectedSheet] = useState<string | null>(null);
  const [mappingPreviewHeaders, setMappingPreviewHeaders] = useState<string[]>([]);
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const [importMessage, setImportMessage] = useState<string | null>(null);

  // add part
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [newPart, setNewPart] = useState<SparePart>({ name: '', part_number: '', description: '', compatibility: '', reorder_threshold: 0, category: { name: '' } });

  // edit part
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editingPart, setEditingPart] = useState<SparePart | null>(null);
  const [editPart, setEditPart] = useState<SparePart>({ name: '', part_number: '', description: '', compatibility: '', reorder_threshold: 0, category: { name: '' } });

  // categories cache
  const categoriesCacheRef = useRef<Record<string, string>>({}); // name(lower) -> id

  useEffect(() => {
    fetchSpareParts(search);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  // Fetch categories and build cache
  async function fetchCategoriesCache() {
    try {
      // TODO: Integrate with custom backend
      categoriesCacheRef.current = {};
    } catch (err) {
      console.error('fetchCategoriesCache error', err);
    }
  }

  // Fetch spare parts (with category join); normalizes both aliases
  async function fetchSpareParts(searchQuery = '') {
    setLoading(true);
    try {
      const params = searchQuery ? { search: searchQuery } : {};
      const data = await apiClient.getSpareParts(params);
      setParts((data || []).map((part: any) => ({ ...part, id: part._id })));
    } catch (err) {
      console.error('Failed to fetch spare parts:', err);
      setParts([]);
    } finally {
      setLoading(false);
    }
  }

  // Realtime subscription (placeholder)
  function setupRealtime() {
    // TODO: Integrate with custom backend realtime
    return undefined;
  }

  // ----- File input & workbook handling -----
  const onClickImport = () => {
    if (!fileInputRef.current) {
      fileInputRef.current = document.createElement('input');
      fileInputRef.current.type = 'file';
      fileInputRef.current.accept = '.xlsx,.xls,.csv';
      fileInputRef.current.onchange = handleFileInput;
    }
    fileInputRef.current.click();
  };

  async function handleFileInput(e: any) {
    const file = e.target.files?.[0];
    if (!file) return;
    setImportError(null);
    try {
      // Import XLSX library
      const XLSX = await import('xlsx');
      if (!XLSX || !XLSX.read) {
        throw new Error('XLSX library not available');
      }
      const arrayBuffer = await file.arrayBuffer();
      const workbook = XLSX.read(arrayBuffer, { type: 'array' });
      workbookRef.current = workbook; // persist workbook
      const names = workbook?.SheetNames || [];
      setWorkbookSheets(names);
      setSelectedSheet(null);
      setSheetPreviews(null);
      setMappingPreviewHeaders([]);
      setImportModalOpen(true);
    } catch (err) {
      console.error('Failed to parse workbook', err);
      setImportError('Failed to parse Excel file. Check browser console for details.');
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }

  // When user chooses a sheet, preview it
  async function onChooseSheet(name: string) {
    setImportError(null);
    setSelectedSheet(name);
    try {
      const workbook = workbookRef.current;
      if (!workbook) {
        setSheetPreviews(null);
        setMappingPreviewHeaders([]);
        setImportError('Workbook not found. Re-upload the file and try again.');
        return;
      }
      const XLSX = await import('xlsx');
      const sheet = workbook.Sheets[name];
      const json = XLSX.utils.sheet_to_json(sheet, { defval: null, raw: false });
      setSheetPreviews(json.slice(0, 20));
      setMappingPreviewHeaders(json.length > 0 ? Object.keys(json[0] || {}) : []);
    } catch (err) {
      console.error('onChooseSheet error', err);
      setSheetPreviews(null);
      setMappingPreviewHeaders([]);
      setImportError('Failed to generate sheet preview.');
    }
  }

  // ----- Header auto-map helpers -----
  const expectedHeaders: Record<string, string[]> = {
    part_number: ['part_number', 'part no', 'partno', 'part no.','sku','partno.'],
    name: ['name', 'part name', 'item_name', 'item name'],
    description: ['description', 'desc', 'details'],
    category: ['category', 'cat'],
    compatibility: ['compatibility', 'compatible', 'fits'],
    reorder_threshold: ['reorder_level', 'reorder_threshold', 'reorder', 'reorder level', 'reorder_threshold']
  };

  function findHeaderForField(headers: string[], field: string) {
    const candidates = expectedHeaders[field] || [];
    const lower = headers.map(h => (h || '').toString().toLowerCase().trim());
    for (const cand of candidates) {
      const idx = lower.indexOf(cand.toLowerCase());
      if (idx >= 0) return headers[idx];
    }
    // fallback: exact match
    if (headers.includes(field)) return field;
    // fallback: substring match
    for (let i = 0; i < lower.length; i++) {
      if (lower[i].includes(field.replace(/_/g, ' '))) return headers[i];
    }
    return null;
  }

  // ----- Helpers to convert snake<->camel (used for missing-column recovery) -----
  function camelToSnake(s: string) {
    return s.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
  }
  function snakeToCamel(s: string) {
    return s.replace(/_([a-z])/g, (_, g) => g.toUpperCase());
  }

  // Try insert and, if Supabase complains about a missing column, remove it and retry
  async function tryInsertWithMissingColumnRecovery(table: string, batch: any[]) {
    // TODO: Integrate with custom backend
    return { error: { message: 'Backend not implemented' } };
  }

  // ----- Core import function -----
  async function doImportSelectedSheet() {
    setImportError(null);
    if (!selectedSheet) {
      setImportError('No sheet selected.');
      return;
    }
    setImporting(true);

    try {
      const workbook = workbookRef.current;
      if (!workbook) {
        throw new Error('Workbook not available. Please re-upload the file and try again.');
      }

      const XLSX = await import('xlsx');
      const rawRows: any[] = XLSX.utils.sheet_to_json(workbook.Sheets[selectedSheet], { defval: null, raw: false });

      if (!rawRows || rawRows.length === 0) {
        setImportError('Selected sheet is empty.');
        return;
      }

      // Normalize data for spare parts
      const payloads = rawRows.map((r: any) => {
        const norm: Record<string, any> = {};
        for (const k of Object.keys(r)) norm[k.trim().toLowerCase()] = r[k];

        return {
          part_number: norm['part_number'] ?? norm['part no'] ?? norm['partno'] ?? norm['sku'] ?? null,
          name: norm['name'] ?? norm['part name'] ?? norm['item_name'] ?? norm['item name'] ?? null,
          description: norm['description'] ?? norm['desc'] ?? norm['details'] ?? null,
          category_name: norm['category'] ?? norm['cat'] ?? null,
          compatibility: norm['compatibility'] ?? norm['compatible'] ?? norm['fits'] ?? null,
          reorder_threshold: (() => {
            const v = norm['reorder_threshold'] ?? norm['reorder_level'] ?? norm['reorder'] ?? null;
            if (v === null || v === undefined || v === '') return null;
            const n = Number(String(v).replace(/[^0-9.-]/g, ''));
            return Number.isFinite(n) ? n : null;
          })(),
          rack_id: norm['rack_id'] ?? norm['rack'] ?? null,
        };
      });

      const rowsToSend = payloads.filter(r => r.name || r.part_number);
      if (!rowsToSend.length) {
        setImportError('No valid rows to import.');
        return;
      }

      // Send to backend spare parts import endpoint
      const result = await apiClient.importSpareParts(rowsToSend);

      if (result.success) {
        setImportMessage(`Successfully imported ${result.inserted} spare parts${result.skipped > 0 ? `, skipped ${result.skipped} invalid rows` : ''}.`);
        setImportModalOpen(false);
        workbookRef.current = null;
        setWorkbookSheets([]);
        setSheetPreviews(null);
        setSelectedSheet(null);
        fetchSpareParts(search);
      } else {
        setImportError('Import failed: ' + (result.error || 'Unknown error'));
      }
    } catch (err: any) {
      console.error('Import failed', err);
      setImportError(String(err?.message ?? err));
    } finally {
      setImporting(false);
    }
  }

  // ----- Add single part -----
  async function createNewPart() {
    try {
      const payload: any = {
        part_number: newPart.part_number || '',
        name: newPart.name || '',
        description: newPart.description || null,
        compatibility: newPart.compatibility || null,
        reorder_threshold: newPart.reorder_threshold ?? 0,
        category: newPart.category?.name || null,
        rack_id: newPart.rack_id || null,
      };

      await apiClient.createSparePart(payload);

      setAddModalOpen(false);
      setNewPart({ name: '', part_number: '', description: '', compatibility: '', reorder_threshold: 0, category: { name: '' } });
      fetchSpareParts();
    } catch (err: any) {
      console.error('Failed to add part', err);
      alert('Failed to add part: ' + err.message);
    }
  }

  // ----- Edit single part -----
  async function submitEdit() {
    try {
      const payload: any = {
        part_number: editPart.part_number || '',
        name: editPart.name || '',
        description: editPart.description || null,
        compatibility: editPart.compatibility || null,
        reorder_threshold: editPart.reorder_threshold ?? 0,
        category: editPart.category?.name || null,
        rack_id: editPart.rack_id || null,
      };

      await apiClient.updateSparePart(editingPart!.id!, payload);

      setEditModalOpen(false);
      setEditingPart(null);
      setEditPart({ name: '', part_number: '', description: '', compatibility: '', reorder_threshold: 0, category: { name: '' } });
      fetchSpareParts();
    } catch (err: any) {
      console.error('Failed to update part', err);
      alert('Failed to update part: ' + err.message);
    }
  }

  // ----- Delete part -----
  const handleDelete = async (id: string) => {
    if (!confirm('Delete this spare part?')) return;
    try {
      await apiClient.request(`/spare-parts/${id}`, { method: 'DELETE' });
      fetchSpareParts(search);
    } catch (err: any) {
      console.error('Failed to delete part', err);
      alert('Failed to delete part: ' + err.message);
    }
  };

  // ----- UI -----
  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex flex-col space-y-4 sm:flex-row sm:items-center sm:justify-between sm:space-y-0">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-900">Spare Parts</h1>
          <p className="mt-1 text-sm text-slate-600">Catalog of spare parts and components (realtime)</p>
        </div>

        <div className="flex flex-col sm:flex-row gap-2">
          <Button variant="outline" size="sm" onClick={onClickImport}>
            <Upload className="mr-2 h-4 w-4" /> Import
          </Button>

          <Button size="sm" onClick={() => setAddModalOpen(true)}>
            <Plus className="mr-2 h-4 w-4" /> Add Part
          </Button>
        </div>
      </div>

      {/* Search Bar */}
      <div className="mb-6">
        <div className="relative w-full max-w-xs sm:max-w-md md:max-w-96">
          <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none">
              <path d="M21 21l-4.35-4.35" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
          </div>
          <Input
            type="search"
            placeholder="Search spare parts..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>
      </div>

      {loading ? (
        <div className="text-center py-8">Loading parts...</div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:gap-6 md:grid-cols-2 lg:grid-cols-3">
          {parts.map((part: any) => (
            <Card key={part.id} className="overflow-hidden">
              <CardContent className="p-4">
                <div className="mb-3 flex h-32 items-center justify-center rounded-lg bg-slate-100">
                  <span className="text-4xl text-slate-400">📦</span>
                </div>
                <h3 className="font-semibold text-slate-900 truncate">{part.name}</h3>
                <p className="mt-1 text-sm font-mono text-slate-600 truncate">{part.part_number}</p>
                {part.description && <p className="mt-2 text-xs text-slate-500 line-clamp-2">{part.description}</p>}
                {part.compatibility && <p className="mt-2 text-xs text-slate-500 line-clamp-2">Compatible: {part.compatibility}</p>}
                <div className="mt-3 flex items-center justify-between">
                  <span className="text-xs text-slate-500">Reorder: {part.reorder_threshold ?? '-'}</span>
                  <span className="rounded bg-blue-100 px-2 py-1 text-xs font-medium text-blue-700">
                    {part.category?.name || part.categories?.name || 'Uncategorized'}
                  </span>
                </div>
                <div className="mt-3 flex justify-end gap-2">
                  <Button variant="outline" size="sm" onClick={() => { setEditingPart(part); setEditPart({ ...part, category: part.category || { name: '' } }); setEditModalOpen(true); }}>Edit</Button>
                  <Button variant="outline" size="sm" onClick={() => handleDelete(part.id!)}>Delete</Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Import messages */}
      {importMessage && <div className="text-sm text-green-700 mb-4">{importMessage}</div>}
      {importError && <div className="text-sm text-red-600 mb-4">{importError}</div>}

      {/* Import Modal */}
      <Modal open={importModalOpen} title="Import Excel - choose sheet" onClose={() => { setImportModalOpen(false); setWorkbookSheets([]); setSheetPreviews(null); setSelectedSheet(null); setImportError(null); setImportMessage(null); }}>
        <div className="mb-4">
          <p className="text-sm text-slate-600">Choose a sheet to preview and import. Data will be validated and imported to spare parts.</p>
        </div>

        <div className="mb-4 flex gap-2 flex-wrap">
          {workbookSheets.map(sn => (
            <button key={sn} onClick={() => onChooseSheet(sn)} className={`px-3 py-1 rounded border ${selectedSheet === sn ? 'bg-sky-100 border-sky-400' : 'bg-white'}`}>
              {sn}
            </button>
          ))}
        </div>

        {selectedSheet && (
          <>
            <div className="mb-2"><strong>Selected:</strong> {selectedSheet}</div>
            <div className="mb-2"><strong>Detected headers:</strong> {mappingPreviewHeaders.join(', ') || '—'}</div>

            {importError && <div className="mb-2 rounded border-l-4 border-red-400 bg-red-50 p-3 text-sm text-red-700"><strong>Import error:</strong> {importError}</div>}

            <div className="mb-4 max-h-56 overflow-auto border rounded p-2">
              {!sheetPreviews || sheetPreviews.length === 0 ? <div className="text-sm text-slate-500">No preview</div> :
                <table className="w-full text-xs">
                  <thead><tr>{Object.keys(sheetPreviews[0]).map(h => <th key={h} className="border px-2 py-1 text-left">{h}</th>)}</tr></thead>
                  <tbody>
                    {sheetPreviews.slice(0, 20).map((r, i) => <tr key={i}>{Object.keys(r).map(k => <td key={k} className="border px-2 py-1 align-top">{String(r[k] ?? '')}</td>)}</tr>)}
                  </tbody>
                </table>}
            </div>

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => { setImportModalOpen(false); setWorkbookSheets([]); setSheetPreviews(null); setSelectedSheet(null); setImportError(null); setImportMessage(null); }}>Cancel</Button>
              <Button onClick={doImportSelectedSheet} disabled={importing}>{importing ? 'Importing...' : 'Import Sheet'}</Button>
            </div>
          </>
        )}
      </Modal>

      {/* Add Part Modal */}
      <Modal open={addModalOpen} onClose={() => setAddModalOpen(false)} title="Add Spare Part">
        <div className="grid grid-cols-1 gap-3">
          <label className="text-sm">
            Part number
            <Input value={newPart.part_number} onChange={(e) => setNewPart(p => ({ ...p, part_number: e.target.value }))} />
          </label>

          <label className="text-sm">
            Name
            <Input value={newPart.name} onChange={(e) => setNewPart(p => ({ ...p, name: e.target.value }))} />
          </label>

          <label className="text-sm">
            Description
            <Input value={newPart.description || ''} onChange={(e) => setNewPart(p => ({ ...p, description: e.target.value }))} />
          </label>

          <label className="text-sm">
            Category
            <Input value={newPart.category?.name || ''} onChange={(e) => setNewPart(p => ({ ...p, category: { name: e.target.value } }))} />
          </label>

          <label className="text-sm">
            Compatibility
            <Input value={newPart.compatibility || ''} onChange={(e) => setNewPart(p => ({ ...p, compatibility: e.target.value }))} />
          </label>

          <label className="text-sm">
            Reorder threshold
            <Input type="number" value={String(newPart.reorder_threshold ?? 0)} onChange={(e) => setNewPart(p => ({ ...p, reorder_threshold: Number(e.target.value) }))} />
          </label>

          <div className="flex flex-col sm:flex-row justify-end gap-2 pt-2">
            <Button variant="outline" size="sm" onClick={() => setAddModalOpen(false)}>Cancel</Button>
            <Button size="sm" onClick={createNewPart}>Create</Button>
          </div>
        </div>
      </Modal>

      {/* Edit Part Modal */}
      <Modal open={editModalOpen} onClose={() => setEditModalOpen(false)} title="Edit Spare Part">
        <div className="grid grid-cols-1 gap-3">
          <label className="text-sm">
            Part number
            <Input value={editPart.part_number} onChange={(e) => setEditPart(p => ({ ...p, part_number: e.target.value }))} />
          </label>

          <label className="text-sm">
            Name
            <Input value={editPart.name} onChange={(e) => setEditPart(p => ({ ...p, name: e.target.value }))} />
          </label>

          <label className="text-sm">
            Description
            <Input value={editPart.description || ''} onChange={(e) => setEditPart(p => ({ ...p, description: e.target.value }))} />
          </label>

          <label className="text-sm">
            Category
            <Input value={editPart.category?.name || ''} onChange={(e) => setEditPart(p => ({ ...p, category: { name: e.target.value } }))} />
          </label>

          <label className="text-sm">
            Compatibility
            <Input value={editPart.compatibility || ''} onChange={(e) => setEditPart(p => ({ ...p, compatibility: e.target.value }))} />
          </label>

          <label className="text-sm">
            Reorder threshold
            <Input type="number" value={String(editPart.reorder_threshold ?? 0)} onChange={(e) => setEditPart(p => ({ ...p, reorder_threshold: Number(e.target.value) }))} />
          </label>

          <div className="flex flex-col sm:flex-row justify-end gap-2 pt-2">
            <Button variant="outline" size="sm" onClick={() => setEditModalOpen(false)}>Cancel</Button>
            <Button size="sm" onClick={submitEdit}>Update</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
