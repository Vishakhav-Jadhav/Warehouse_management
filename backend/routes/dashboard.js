const express = require('express');
const router = express.Router();
const InventoryItem = require('../models/InventoryItem');
const Transaction = require('../models/Transaction');
const Warehouse = require('../models/Warehouse');
const Category = require('../models/Category');
const SparePart = require('../models/SparePart');
const { auth } = require('../middleware/auth');

// GET /api/dashboard - Get dashboard data
router.get('/', auth, async (req, res) => {
  try {
    const { district, warehouse: warehouseId, from, to } = req.query;

    // Build match conditions for inventory aggregation
    let matchConditions = {};
    let warehouseObjectId = null;
    if (warehouseId) {
      matchConditions.warehouse_id = warehouseId;
      // Find the warehouse ObjectId for transactions
      const warehouse = await Warehouse.findOne({ warehouse_id: warehouseId });
      if (warehouse) {
        warehouseObjectId = warehouse._id;
      }
    }

    // Aggregation pipeline for inventory totals and charts
    const inventoryPipeline = [
      { $match: matchConditions },
      {
        $group: {
          _id: null,
          totalStockQty: { $sum: '$qty' },
          totalStockValue: { $sum: { $multiply: ['$qty', '$unit_price'] } },
          reorderItems: {
            $sum: {
              $cond: [{ $lte: ['$qty', '$reorder_threshold'] }, 1, 0]
            }
          },
          items: { $push: '$$ROOT' }
        }
      },
      {
        $project: {
          _id: 0,
          totalStockQty: 1,
          totalStockValue: 1,
          reorderItems: 1,
          items: 1
        }
      }
    ];

    const inventoryResult = await InventoryItem.aggregate(inventoryPipeline);
    const inventoryData = inventoryResult[0] || { totalStockQty: 0, totalStockValue: 0, reorderItems: 0, items: [] };

    // Stock by Item aggregation
    const stockByItemPipeline = [
      { $match: matchConditions },
      {
        $group: {
          _id: '$name',
          value: { $sum: '$qty' }
        }
      },
      {
        $project: {
          _id: 0,
          name: '$_id',
          value: 1
        }
      },
      { $sort: { value: -1 } },
      { $limit: 10 }
    ];

    const stockByItem = await InventoryItem.aggregate(stockByItemPipeline);

    // Stock by Warehouse aggregation with lookup
    const stockByWarehousePipeline = [
      { $match: matchConditions },
      {
        $group: {
          _id: '$warehouse_id',
          value: { $sum: '$qty' }
        }
      },
      {
        $lookup: {
          from: 'warehouses',
          localField: '_id',
          foreignField: 'warehouse_id',
          as: 'warehouse'
        }
      },
      {
        $unwind: {
          path: '$warehouse',
          preserveNullAndEmptyArrays: true
        }
      },
      {
        $project: {
          _id: 0,
          name: { $ifNull: ['$warehouse.name', '$_id'] },
          value: 1
        }
      },
      { $sort: { value: -1 } }
    ];

    const stockByWarehouse = await InventoryItem.aggregate(stockByWarehousePipeline);

    // Category Breakdown aggregation with lookup
    const categoryBreakdownPipeline = [
      { $match: matchConditions },
      {
        $group: {
          _id: '$category_id',
          value: { $sum: { $multiply: ['$qty', '$unit_price'] } }
        }
      },
      {
        $lookup: {
          from: 'categories',
          localField: '_id',
          foreignField: '_id',
          as: 'category'
        }
      },
      {
        $unwind: {
          path: '$category',
          preserveNullAndEmptyArrays: true
        }
      },
      {
        $project: {
          _id: 0,
          name: { $ifNull: ['$category.name', '$_id'] },
          value: 1
        }
      },
      { $sort: { value: -1 } }
    ];

    const categoryBreakdown = await InventoryItem.aggregate(categoryBreakdownPipeline);

    // Get total counts
    const totalWarehouses = await Warehouse.countDocuments();
    const totalCategories = await Category.countDocuments();

    // Recent Transactions
    let transactionMatch = {};
    if (warehouseObjectId) {
      transactionMatch.warehouse_id = warehouseObjectId;
    }
    if (from) {
      transactionMatch.date = { ...transactionMatch.date, $gte: new Date(from) };
    }
    if (to) {
      transactionMatch.date = { ...transactionMatch.date, $lte: new Date(to) };
    }

    const recentTransactions = await Transaction.find(transactionMatch)
      .populate('warehouse', 'name')
      .sort({ date: -1 })
      .limit(10)
      .select('type qty warehouse date created_at');

    // Recent Spare Parts
    const recentSpareParts = await SparePart.find()
      .populate('category', 'name')
      .sort({ createdAt: -1 })
      .limit(10)
      .select('name part_number category created_at');

    // Calculate lowStockItems (same as reorderItems for now)
    const lowStockItems = inventoryData.reorderItems;

    res.json({
      totals: {
        totalStockQty: inventoryData.totalStockQty,
        totalStockValue: inventoryData.totalStockValue,
        reorderItems: inventoryData.reorderItems,
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
  } catch (error) {
    console.error('Dashboard API error:', error);
    res.status(500).json({
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
    });
  }
});

module.exports = router;