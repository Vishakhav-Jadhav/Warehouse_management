'use client';

import React, { useEffect, useRef, useState } from 'react';
import { format } from 'date-fns';
import apiClient from '@/lib/apiClient';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  LineChart,
  Line,
  AreaChart,
  Area,
} from 'recharts';
import {
  Package,
  DollarSign,
  AlertTriangle,
  Upload,
  RefreshCw,
  Wrench,
  Building2,
  Activity,
  Clock,
  CheckCircle,
  Zap
} from 'lucide-react';

// Colors used in charts
const COLORS = ['#0ea5e9', '#6366f1', '#f97316', '#f59e0b', '#10b981', '#06b6d4', '#ef4444', '#a78bfa'];

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

interface DashboardData {
  totals: {
    totalStockQty: number;
    totalStockValue: number;
    reorderItems: number;
    totalWarehouses: number;
    totalCategories: number;
    lowStockItems: number;
  };
  chartData: {
    stockByItem: { name: string; value: number }[];
    stockByWarehouse: { name: string; value: number }[];
    categoryBreakdown: { name: string; value: number }[];
  };
  recentTransactions: any[];
  recentSpareParts: any[];
}

export default function DashboardPage() {
   // mounted guard to avoid hydration mismatch
   const [mounted, setMounted] = useState(false);
   useEffect(() => { setMounted(true); }, []);

   // loading + stats
   const [stats, setStats] = useState<DashboardData | null>(null);
   const [loading, setLoading] = useState(true);
   const [lastUpdated, setLastUpdated] = useState<Date>(new Date());

   // filters
   const [filters, setFilters] = useState({
     warehouse: 'All',
     rack: 'All',
     location: 'All',
   });

   // import modal/workbook states
   const fileInputRef = useRef<HTMLInputElement | null>(null);
   const workbookRef = useRef<any | null>(null);
   const [importOpen, setImportOpen] = useState(false);
   const [sheetNames, setSheetNames] = useState<string[]>([]);
   const [selectedSheet, setSelectedSheet] = useState<string | null>(null);
   const [sheetPreview, setSheetPreview] = useState<any[]>([]);
   const [mappingPreviewHeaders, setMappingPreviewHeaders] = useState<string[]>([]);
   const [importing, setImporting] = useState(false);
   const [importError, setImportError] = useState<string | null>(null);

   // Refs for realtime updates
   const intervalRef = useRef<NodeJS.Timeout | null>(null);
   const channelRef = useRef<BroadcastChannel | null>(null);

   // Chart data from API
   const barData = stats?.chartData?.stockByItem || [];
   const pieData = stats?.chartData?.categoryBreakdown || [];
   const warehouseStock = stats?.chartData?.stockByWarehouse || [];
   const categoryLine = stats?.chartData?.categoryBreakdown || [];

   // ----- Realtime setup -----
   useEffect(() => {
     fetchAllData();
     // eslint-disable-next-line react-hooks/exhaustive-deps
   }, []);

   // Periodic refresh every 4 seconds
   useEffect(() => {
     intervalRef.current = setInterval(() => {
       fetchAllData();
     }, 4000);

     // BroadcastChannel for instant updates
     channelRef.current = new BroadcastChannel('dashboard-updates');
     channelRef.current.onmessage = (event) => {
       if (event.data === 'dataUpdated') {
         fetchAllData();
       }
     };

     return () => {
       if (intervalRef.current) {
         clearInterval(intervalRef.current);
       }
       if (channelRef.current) {
         channelRef.current.close();
       }
     };
   }, []);

  // fetchAllData: fetch data from multiple APIs and compute stats
  const fetchAllData = async () => {
    setLoading(true);
    try {
      const [inventory, categories, spareParts, warehouses, transactions] = await Promise.all([
        apiClient.getInventory(),
        apiClient.getCategories(),
        apiClient.getSpareParts(),
        apiClient.getWarehouses(),
        apiClient.getTransactions(),
      ]);

      // Compute totals
      const totalStockQty = spareParts.length;
      const totalStockValue = 0;
      const reorderItems = spareParts.filter((s: any) => s.reorder_threshold > 0).length;
      const totalWarehouses = warehouses.length;
      const totalCategories = categories.length;
      const lowStockItems = reorderItems;

      // Stock by Item: group by name, count, top 10
      const itemMap: Record<string, number> = {};
      spareParts.forEach((s: any) => {
        const name = s.name || 'Unknown';
        itemMap[name] = (itemMap[name] || 0) + 1;
      });
      const stockByItem = Object.entries(itemMap)
        .map(([name, value]) => ({ name, value: value as number }))
        .sort((a, b) => b.value - a.value)
        .slice(0, 10);

      // Stock by Warehouse: spare parts don't have warehouse, so empty
      const stockByWarehouse: { name: string; value: number }[] = [];

      // Category Breakdown: group by category_id, count, map to name
      const categoryMap: Record<string, number> = {};
      const categoryNameMap: Record<string, string> = {};
      categories.forEach((cat: any) => {
        categoryNameMap[cat._id] = cat.name || cat._id;
      });
      spareParts.forEach((s: any) => {
        const catId = s.category_id;
        const catName = categoryNameMap[catId] || catId || 'Unknown';
        categoryMap[catName] = (categoryMap[catName] || 0) + 1;
      });
      const categoryBreakdown = Object.entries(categoryMap)
        .map(([name, value]) => ({ name, value: value as number }))
        .sort((a, b) => b.value - a.value);

      // Recent Spare Parts: sort by createdAt desc, take 5
      const recentSpareParts = [...spareParts]
        .sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime())
        .slice(0, 5);

      // Recent Transactions: sort by date or createdAt desc, take 5
      const recentTransactions = [...transactions]
        .sort((a, b) => new Date(b.date || b.createdAt || 0).getTime() - new Date(a.date || a.createdAt || 0).getTime())
        .slice(0, 5);

      setStats({
        totals: {
          totalStockQty,
          totalStockValue,
          reorderItems,
          totalWarehouses,
          totalCategories,
          lowStockItems,
        },
        chartData: {
          stockByItem,
          stockByWarehouse,
          categoryBreakdown,
        },
        recentTransactions,
        recentSpareParts,
      });
      setLastUpdated(new Date());
    } catch (err) {
      console.error('fetchAllData error', err);
      // Fallback to empty data on error
      setStats({
        totals: {
          totalStockQty: 0,
          totalStockValue: 0,
          reorderItems: 0,
          totalWarehouses: 0,
          totalCategories: 0,
          lowStockItems: 0,
        },
        chartData: {
          stockByItem: [],
          stockByWarehouse: [],
          categoryBreakdown: [],
        },
        recentTransactions: [],
        recentSpareParts: [],
      });
    } finally {
      setLoading(false);
    }
  };

  // Import flow: handle upload, parse workbook and POST to /api/import which should exist server-side
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
      const XLSX = await import('xlsx');
      const arrayBuffer = await file.arrayBuffer();
      const workbook = XLSX.read(arrayBuffer, { type: 'array' });
      workbookRef.current = workbook;
      const names = workbook.SheetNames || [];
      setSheetNames(names);
      setSelectedSheet(null);
      setSheetPreview([]);
      setMappingPreviewHeaders([]);
      setImportOpen(true);
    } catch (err) {
      console.error('Failed to parse workbook', err);
      setImportError('Failed to parse Excel file. Check console.');
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }

  async function onChooseSheet(name: string) {
    setSelectedSheet(name);
    setImportError(null);
    try {
      const workbook = workbookRef.current;
      if (!workbook) {
        setImportError('Workbook not found, re-upload file.');
        return;
      }
      const XLSX = await import('xlsx');
      const sheet = workbook.Sheets[name];
      const json = XLSX.utils.sheet_to_json(sheet, { defval: null, raw: false });
      setSheetPreview(json.slice(0, 20));
      setMappingPreviewHeaders(json.length > 0 ? Object.keys(json[0]) : []);
    } catch (err) {
      console.error(err);
      setImportError('Preview failed.');
      setSheetPreview([]);
      setMappingPreviewHeaders([]);
    }
  }

  // Normalize and send rows to /api/import (server should insert using service role)
  async function doImportSelectedSheet() {
    setImportError(null);
    if (!selectedSheet) {
      setImportError('Select a sheet first.');
      return;
    }
    setImporting(true);
    try {
      const workbook = workbookRef.current;
      if (!workbook) throw new Error('Workbook missing (re-upload).');
      const XLSX = await import('xlsx');
      const rawRows: any[] = XLSX.utils.sheet_to_json(workbook.Sheets[selectedSheet], { defval: null, raw: false });
      if (!rawRows || rawRows.length === 0) {
        setImportError('Sheet empty.');
        return;
      }

      // Minimal mapping — map common headers (adjust if you use different column names)
      const normalized = rawRows.map((r: any) => ({
        part_number: r['part_number'] ?? r['Part Number'] ?? r['SKU'] ?? r['sku'] ?? null,
        name: r['name'] ?? r['Item_Name'] ?? r['Item Name'] ?? r['Name'] ?? null,
        description: r['description'] ?? r['Description'] ?? null,
        compatibility: r['compatibility'] ?? null,
        reorder_threshold: (() => {
          const v = r['reorder_threshold'] ?? r['Reorder Level'] ?? r['Reorder_Level'] ?? null;
          if (v === null || v === undefined || v === '') return null;
          const n = Number(String(v).replace(/[^0-9.-]/g, ''));
          return Number.isFinite(n) ? n : null;
        })(),
        category_name: r['category'] ?? r['Category'] ?? null,
      }));

      const rowsToSend = normalized.filter(r => r.name || r.part_number);
      if (!rowsToSend.length) {
        setImportError('No valid rows to import.');
        return;
      }

      // send to backend upload endpoint
      const resp = await apiClient.request('/upload', {
        method: 'POST',
        body: JSON.stringify({ scope: 'spare_parts', data: rowsToSend }),
      });

      // succeeded — refresh data and close modal
      await fetchAllData();
      setImportOpen(false);
      setSheetNames([]);
      setSheetPreview([]);
      setSelectedSheet(null);
      alert(`Imported ${rowsToSend.length} rows successfully.`);
    } catch (err: any) {
      console.error('Import exception', err);
      setImportError(err?.message || String(err));
    } finally {
      setImporting(false);
    }
  }

  // UI render
  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Warehouse & Rack Management Dashboard</h1>
          <p className="mt-1 text-sm text-slate-600">Live overview of stock, racks and warehouses</p>
          <p className="text-xs text-slate-500 mt-1">
            Last updated: {mounted ? format(lastUpdated, 'MMM dd, yyyy HH:mm:ss') : '—'}
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex gap-2">
            <Select value={filters.warehouse} onValueChange={(v) => setFilters(f => ({ ...f, warehouse: v }))}>
              <SelectTrigger className="w-40">
                <SelectValue placeholder="Warehouse_Name" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="All">All</SelectItem>
                <SelectItem value="Warehouse A">Warehouse A</SelectItem>
                <SelectItem value="Warehouse B">Warehouse B</SelectItem>
              </SelectContent>
            </Select>

            <Select value={filters.rack} onValueChange={(v) => setFilters(f => ({ ...f, rack: v }))}>
              <SelectTrigger className="w-36">
                <SelectValue placeholder="Rack_Name" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="All">All</SelectItem>
                <SelectItem value="Rack 1">Rack 1</SelectItem>
                <SelectItem value="Rack 2">Rack 2</SelectItem>
              </SelectContent>
            </Select>

            <Select value={filters.location} onValueChange={(v) => setFilters(f => ({ ...f, location: v }))}>
              <SelectTrigger className="w-36">
                <SelectValue placeholder="Location" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="All">All</SelectItem>
                <SelectItem value="Zone 1">Zone 1</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex gap-2">
            <Button variant="outline" onClick={fetchAllData}><RefreshCw className="mr-2 h-4 w-4" /> Refresh</Button>
            <Button onClick={onClickImport}><Upload className="mr-2 h-4 w-4" /> Import Data</Button>
          </div>
        </div>
      </div>

      {/* Top KPI chips - visually big rounded boxes like in your image */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3 lg:grid-cols-6">
        <div className="rounded-xl border p-5 bg-white flex flex-col">
          <div className="text-xs text-slate-500">Total Stock Qty</div>
          <div className="text-3xl font-bold text-slate-900 mt-2">{mounted ? (stats?.totals.totalStockQty ?? 0).toLocaleString() : 0}</div>
        </div>

        <div className="rounded-xl border p-5 bg-white flex flex-col">
          <div className="text-xs text-slate-500">Total Stock Value</div>
          <div className="text-3xl font-bold text-slate-900 mt-2">${mounted ? (stats?.totals.totalStockValue ?? 0).toLocaleString() : 0}</div>
        </div>

        <div className="rounded-xl border p-5 bg-white flex flex-col">
          <div className="text-xs text-slate-500">Reorder Items</div>
          <div className="text-3xl font-bold text-slate-900 mt-2">{(stats?.totals.reorderItems ?? 0)}</div>
        </div>

        <div className="rounded-xl border p-5 bg-white flex flex-col">
          <div className="text-xs text-slate-500">Total Warehouses</div>
          <div className="text-3xl font-bold text-slate-900 mt-2">{(stats?.totals.totalWarehouses ?? 0)}</div>
        </div>

        <div className="rounded-xl border p-5 bg-white flex flex-col">
          <div className="text-xs text-slate-500">Total Categories</div>
          <div className="text-3xl font-bold text-slate-900 mt-2">{(stats?.totals.totalCategories ?? 0)}</div>
        </div>

        <div className="rounded-xl border p-5 bg-white flex flex-col">
          <div className="text-xs text-slate-500">Low Stock Items</div>
          <div className="text-3xl font-bold text-slate-900 mt-2">{(stats?.totals.lowStockItems ?? 0)}</div>
        </div>
      </div>

      {/* Charts row matching layout in screenshot */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Wide bar chart (spans two columns on large screens) */}
        <div className="lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>Total Stock Qty by Item_Name</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-56">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={barData} margin={{ top: 8, right: 16, left: -12, bottom: 6 }}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="value">
                        {barData.map((entry, idx) => (
                          <Cell key={`cell-${idx}`} fill={COLORS[idx % COLORS.length]} />
                        ))}
                      </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Pie chart */}
        <Card>
          <CardHeader>
            <CardTitle>Category Split - Total Stock</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={pieData} innerRadius={50} outerRadius={80} dataKey="value" nameKey="name">
                    {pieData.map((entry, idx) => <Cell key={`c-${idx}`} fill={COLORS[idx % COLORS.length]} />)}
                  </Pie>
                  <Tooltip />
                  <Legend verticalAlign="bottom" height={36} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Lower charts row */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>Stock by Warehouse</CardTitle>
          </CardHeader>
          <CardContent>
            <div style={{ height: 160 }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={warehouseStock} margin={{ left: -20 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="value" fill="#3b82f6" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Total Stock Gauge</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-center">
              {/* A simple semicircle "gauge" using AreaChart */}
              <div style={{ width: 200, height: 120 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={[{ x: 0, y: 0 }, { x: 1, y: (stats?.totals.totalStockQty ?? 0) / 2740 }]} margin={{ left: 0, right: 0 }}>
                    <Area type="monotone" dataKey="y" stroke="#0ea5e9" fill="#bae6fd" />
                  </AreaChart>
                </ResponsiveContainer>
                <div className="text-center mt-[-72px]">
                  <div className="text-3xl font-bold">{(stats?.totals.totalStockQty ?? 0)}</div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Sum of Stock_On_Hand by Category</CardTitle>
          </CardHeader>
          <CardContent>
            <div style={{ height: 160 }}>
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={categoryLine}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="category" />
                  <YAxis />
                  <Tooltip />
                  <Line type="monotone" dataKey="value" stroke="#06b6d4" />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Recent lists and feed */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle>Recent Spare Parts</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {(stats?.recentSpareParts || []).slice(0, 5).map((p: any) => (
                <div key={p._id || p.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                  <div>
                    <p className="font-medium">{p.name}</p>
                    <p className="text-xs text-slate-500">{p.part_number}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-medium">{p.category?.name || 'No Category'}</p>
                    <p className="text-xs text-slate-400">
                      {mounted && p?.createdAt ? format(new Date(p.createdAt), 'MMM dd') : (mounted ? '—' : '—')}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle>Recent Transactions</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {(stats?.recentTransactions || []).slice(0, 5).map((t: any) => (
                <div key={t._id || t.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                  <div>
                    <p className="font-medium">{t.type}</p>
                    <p className="text-xs text-slate-500">{t.warehouse?.name || 'Unknown Warehouse'}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-medium">{t.qty} units</p>
                    <p className="text-xs text-slate-400">{mounted && (t.date || t.createdAt) ? format(new Date(t.date || t.createdAt), 'MMM dd') : (mounted ? '—' : '—')}</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle>Live Activity Feed</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 max-h-48 overflow-y-auto">
              <div className="flex items-center gap-3 p-2 bg-green-50 rounded-lg">
                <CheckCircle className="h-4 w-4 text-green-500" />
                <span className="text-sm text-green-800">System online and monitoring</span>
                <span className="text-xs text-green-600 ml-auto">{mounted ? format(new Date(), 'HH:mm:ss') : '—'}</span>
              </div>
              <div className="flex items-center gap-3 p-2 bg-blue-50 rounded-lg">
                <Activity className="h-4 w-4 text-blue-500" />
                <span className="text-sm text-blue-800">Realtime dashboard active</span>
                <span className="text-xs text-blue-600 ml-auto">{mounted ? format(new Date(), 'HH:mm:ss') : '—'}</span>
              </div>
              <div className="flex items-center gap-3 p-2 bg-orange-50 rounded-lg">
                <Package className="h-4 w-4 text-orange-500" />
                <span className="text-sm text-orange-800">{(stats?.totals.totalStockQty ?? 0).toLocaleString()} units in stock</span>
                <span className="text-xs text-orange-600 ml-auto">{mounted ? format(new Date(), 'HH:mm:ss') : '—'}</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Import modal */}
      <Modal open={importOpen} title="Import Excel - choose sheet" onClose={() => setImportOpen(false)}>
        <div className="mb-4">
          <p className="text-sm text-slate-600">Choose a sheet to preview and import. Parsed data will be posted to <code>/api/import</code>.</p>
        </div>

        <div className="mb-4 flex gap-2 flex-wrap">
          {sheetNames.map(sn => (
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
              {sheetPreview.length === 0 ? <div className="text-sm text-slate-500">No preview</div> :
                <table className="w-full text-xs">
                  <thead><tr>{Object.keys(sheetPreview[0]).map(h => <th key={h} className="border px-2 py-1 text-left">{h}</th>)}</tr></thead>
                  <tbody>
                    {sheetPreview.map((r, i) => <tr key={i}>{Object.keys(r).map(k => <td key={k} className="border px-2 py-1 align-top">{String(r[k] ?? '')}</td>)}</tr>)}
                  </tbody>
                </table>}
            </div>

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => { setImportOpen(false); setSheetNames([]); setSelectedSheet(null); setImportError(null); }}>Cancel</Button>
              <Button onClick={doImportSelectedSheet} disabled={importing}>{importing ? 'Importing...' : 'Import Sheet'}</Button>
            </div>
          </>
        )}
      </Modal>
    </div>
  );
}
