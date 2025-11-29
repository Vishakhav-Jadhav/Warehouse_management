import { NextRequest, NextResponse } from 'next/server';

const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:5001';

export async function GET(request: NextRequest) {
  try {
    // Get token from cookies or headers
    const token = request.cookies.get('token')?.value ||
                  request.headers.get('authorization')?.replace('Bearer ', '');

    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const searchParams = request.nextUrl.searchParams;
    const district = searchParams.get('district');
    const warehouseId = searchParams.get('warehouse');
    const from = searchParams.get('from');
    const to = searchParams.get('to');

    const params = new URLSearchParams();
    if (district) params.append('district', district);
    if (warehouseId) params.append('warehouse', warehouseId);
    if (from) params.append('from', from);
    if (to) params.append('to', to);

    const response = await fetch(`${BACKEND_URL}/api/dashboard?${params}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      throw new Error(`Backend responded with status: ${response.status}`);
    }

    const data = await response.json();
    return NextResponse.json({
      totals: data.totals,
      chartData: data.chartData,
      recentTransactions: data.recentTransactions,
      recentSpareParts: data.recentSpareParts,
    });
  } catch (error) {
    return NextResponse.json({
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
      error: 'Failed to fetch dashboard data'
    }, { status: 500 });
  }
}
