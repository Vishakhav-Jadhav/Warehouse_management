const express = require('express');
const router = express.Router();
const InventoryItem = require('../models/InventoryItem');
const Transaction = require('../models/Transaction');
const Warehouse = require('../models/Warehouse');
const DispatchOrder = require('../models/DispatchOrder');
const { auth } = require('../middleware/auth');

// GET /api/reports/inventory - Inventory summary report
router.get('/inventory', auth, async (req, res) => {
  try {
    const { warehouse, category, format = 'json' } = req.query;

    let query = {};
    if (warehouse) query.warehouse_id = warehouse;
    if (category) query.category_id = category;

    const items = await InventoryItem.find(query)
      .populate('warehouse_id', 'name')
      .populate('category_id', 'name')
      .sort({ warehouse_id: 1, name: 1 });

    const report = {
      generatedAt: new Date(),
      totalItems: items.length,
      totalValue: items.reduce((sum, item) => sum + (item.qty * item.unit_price), 0),
      lowStockItems: items.filter(item => item.qty <= item.reorder_threshold).length,
      data: items.map(item => ({
        sku: item.sku,
        name: item.name,
        category: item.category_id?.name || 'Uncategorized',
        warehouse: item.warehouse_id?.name || 'Unknown',
        quantity: item.qty,
        unitPrice: item.unit_price,
        totalValue: item.qty * item.unit_price,
        reorderThreshold: item.reorder_threshold,
        status: item.qty <= item.reorder_threshold ? 'Low Stock' : 'In Stock'
      }))
    };

    if (format === 'csv') {
      const csv = [
        'SKU,Name,Category,Warehouse,Quantity,Unit Price,Total Value,Reorder Threshold,Status',
        ...report.data.map(row =>
          `"${row.sku}","${row.name}","${row.category}","${row.warehouse}",${row.quantity},${row.unitPrice},${row.totalValue},${row.reorderThreshold},"${row.status}"`
        )
      ].join('\n');

      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename="inventory-report.csv"');
      return res.send(csv);
    }

    res.json(report);
  } catch (error) {
    console.error('Error generating inventory report:', error);
    res.status(500).json({ error: 'Failed to generate inventory report' });
  }
});

// GET /api/reports/transactions - Transaction history report
router.get('/transactions', auth, async (req, res) => {
  try {
    const { from, to, warehouse, type, format = 'json' } = req.query;

    let query = {};
    if (warehouse) query.warehouse_id = warehouse;
    if (type) query.type = type;
    if (from || to) {
      query.date = {};
      if (from) query.date.$gte = new Date(from);
      if (to) query.date.$lte = new Date(to);
    }

    const transactions = await Transaction.find(query)
      .populate('warehouse_id', 'name')
      .sort({ date: -1 });

    const report = {
      generatedAt: new Date(),
      totalTransactions: transactions.length,
      totalIn: transactions.filter(t => t.type.includes('In')).reduce((sum, t) => sum + t.qty, 0),
      totalOut: transactions.filter(t => t.type.includes('Out')).reduce((sum, t) => sum + t.qty, 0),
      data: transactions.map(t => ({
        id: t._id,
        type: t.type,
        warehouse: t.warehouse_id?.name || 'Unknown',
        sku: t.sku,
        quantity: t.qty,
        date: t.date,
        sourceDestination: t.source_destination,
        status: t.status,
        notes: t.notes
      }))
    };

    if (format === 'csv') {
      const csv = [
        'ID,Type,Warehouse,SKU,Quantity,Date,Source/Destination,Status,Notes',
        ...report.data.map(row =>
          `"${row.id}","${row.type}","${row.warehouse}","${row.sku}",${row.quantity},"${row.date}","${row.sourceDestination}","${row.status}","${row.notes || ''}"`
        )
      ].join('\n');

      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename="transactions-report.csv"');
      return res.send(csv);
    }

    res.json(report);
  } catch (error) {
    console.error('Error generating transactions report:', error);
    res.status(500).json({ error: 'Failed to generate transactions report' });
  }
});

// GET /api/reports/dispatch - Dispatch orders report
router.get('/dispatch', auth, async (req, res) => {
  try {
    const { status, from, to, format = 'json' } = req.query;

    let query = {};
    if (status) query.status = status;
    if (from || to) {
      query.createdAt = {};
      if (from) query.createdAt.$gte = new Date(from);
      if (to) query.createdAt.$lte = new Date(to);
    }

    const orders = await DispatchOrder.find(query)
      .populate('warehouse_id', 'name')
      .sort({ createdAt: -1 });

    const report = {
      generatedAt: new Date(),
      totalOrders: orders.length,
      totalValue: orders.reduce((sum, order) => sum + order.total_value, 0),
      pendingOrders: orders.filter(o => o.status === 'Pending').length,
      completedOrders: orders.filter(o => o.status === 'Completed').length,
      data: orders.map(order => ({
        orderNumber: order.order_number,
        customerName: order.customer_name,
        destination: order.destination,
        warehouse: order.warehouse_id?.name || 'Unknown',
        status: order.status,
        totalValue: order.total_value,
        dispatchDate: order.dispatch_date,
        createdAt: order.createdAt,
        items: order.items.map(item => ({
          sku: item.sku,
          quantity: item.qty,
          unitPrice: item.unit_price,
          total: item.qty * item.unit_price
        }))
      }))
    };

    if (format === 'csv') {
      const csv = [
        'Order Number,Customer Name,Destination,Warehouse,Status,Total Value,Dispatched Date,Created Date',
        ...report.data.map(row =>
          `"${row.orderNumber}","${row.customerName}","${row.destination}","${row.warehouse}","${row.status}",${row.totalValue},"${row.dispatchDate || ''}","${row.createdAt}"`
        )
      ].join('\n');

      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename="dispatch-report.csv"');
      return res.send(csv);
    }

    res.json(report);
  } catch (error) {
    console.error('Error generating dispatch report:', error);
    res.status(500).json({ error: 'Failed to generate dispatch report' });
  }
});

module.exports = router;