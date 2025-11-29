'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { FileText, Download, Calendar } from 'lucide-react';
import apiClient from '@/lib/apiClient';

const reportTypes = [
  {
    id: 'inventory',
    name: 'Inventory Summary',
    description: 'Complete inventory across all warehouses',
    icon: '📦',
  },
  {
    id: 'movements',
    name: 'Movement Logs',
    description: 'Track all inventory movements',
    icon: '🔄',
  },
  {
    id: 'valuation',
    name: 'Stock Valuation',
    description: 'Current value of all inventory',
    icon: '💰',
  },
  {
    id: 'low-stock',
    name: 'Low Stock Alert',
    description: 'Items below reorder threshold',
    icon: '⚠️',
  },
  {
    id: 'dispatch',
    name: 'Dispatch Report',
    description: 'All dispatch orders and status',
    icon: '🚚',
  },
  {
    id: 'transactions',
    name: 'Transaction History',
    description: 'Complete transaction history',
    icon: '📊',
  },
];

export default function ReportsPage() {
  const [loading, setLoading] = useState<string | null>(null);

  const downloadReport = async (reportType: string, format: 'json' | 'csv' = 'csv') => {
    setLoading(reportType);
    try {
      let data;
      switch (reportType) {
        case 'inventory':
          data = await apiClient.getInventoryReport({ format });
          break;
        case 'transactions':
          data = await apiClient.getTransactionsReport({ format });
          break;
        case 'dispatch':
          data = await apiClient.getDispatchReport({ format });
          break;
        default:
          throw new Error('Unknown report type');
      }

      if (format === 'csv' && typeof data === 'string') {
        // For CSV, create a download link
        const blob = new Blob([data], { type: 'text/csv' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${reportType}-report.csv`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
      } else {
        // For JSON, show in console or download
        console.log(`${reportType} report:`, data);
        alert(`${reportType} report generated. Check console for data.`);
      }
    } catch (error: any) {
      console.error('Failed to generate report:', error);
      alert('Failed to generate report: ' + error.message);
    } finally {
      setLoading(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Reports</h1>
          <p className="mt-1 text-sm text-slate-600">
            Generate and export reports
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        {reportTypes.map((report) => (
          <Card key={report.id}>
            <CardContent className="p-6">
              <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-lg bg-slate-100 text-3xl">
                {report.icon}
              </div>
              <h3 className="text-lg font-semibold text-slate-900">{report.name}</h3>
              <p className="mt-1 text-sm text-slate-600">{report.description}</p>
              <div className="mt-4 flex gap-2">
                <Button size="sm" variant="outline" className="flex-1">
                  <Calendar className="mr-2 h-4 w-4" />
                  Configure
                </Button>
                <Button
                  size="sm"
                  className="flex-1"
                  onClick={() => downloadReport(report.id)}
                  disabled={loading === report.id}
                >
                  <Download className="mr-2 h-4 w-4" />
                  {loading === report.id ? 'Generating...' : 'Export'}
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Recent Reports</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center text-slate-500 py-8">
            No reports generated yet. Configure and export a report to get started.
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
