const express = require('express');
const router = express.Router();
const InventoryItem = require('../models/InventoryItem');
const Transaction = require('../models/Transaction');
const Warehouse = require('../models/Warehouse');
const Category = require('../models/Category');
const SparePart = require('../models/SparePart');
const { auth } = require('../middleware/auth');

// GET /api/search?query=term&type=inventory
router.get('/', auth, async (req, res) => {
  try {
    const { query, type } = req.query;

    if (!query || !type) {
      return res.status(400).json({ error: 'Query and type parameters are required' });
    }

    const searchRegex = new RegExp(query, 'i'); // Case insensitive regex

    let results = [];

    switch (type) {
      case 'inventory':
        results = await InventoryItem.find({
          $or: [
            { name: searchRegex },
            { sku: searchRegex },
            { category_id: searchRegex },
            { warehouse_id: searchRegex },
            { rack_id: searchRegex },
            { part_number: searchRegex }
          ]
        }).limit(50);
        break;

      case 'warehouse':
        results = await Warehouse.find({
          $or: [
            { name: searchRegex },
            { district: searchRegex },
            { address: searchRegex },
            { warehouse_id: searchRegex }
          ]
        }).limit(50);
        break;

      case 'spareParts':
        results = await SparePart.find({
          $or: [
            { part_number: searchRegex },
            { name: searchRegex },
            { category: searchRegex }
          ]
        }).populate('category', 'name').limit(50);
        break;

      case 'dashboard':
        // For dashboard, filter inventory data and recalculate charts
        const filteredInventory = await InventoryItem.find({
          $or: [
            { name: searchRegex },
            { sku: searchRegex },
            { category_id: searchRegex },
            { warehouse_id: searchRegex }
          ]
        });

        // Recalculate totals
        const totalStockQty = filteredInventory.reduce((sum, item) => sum + item.qty, 0);
        const totalStockValue = filteredInventory.reduce((sum, item) => sum + (item.qty * item.unit_price), 0);
        const reorderItems = filteredInventory.filter(item => item.qty <= item.reorder_threshold).length;

        // Get unique warehouse and category IDs
        const warehouseIds = [...new Set(filteredInventory.map(item => item.warehouse_id).filter(id => id))];
        const categoryIds = [...new Set(filteredInventory.map(item => item.category_id).filter(id => id))];

        // Fetch warehouses and categories
        let warehouses = [];
        try {
          warehouses = await Warehouse.find({ warehouse_id: { $in: warehouseIds } }).select('name warehouse_id');
        } catch (err) {
          warehouses = [];
        }
        const categories = await Category.find({ _id: { $in: categoryIds } }).select('name');

        // Create maps
        const warehouseNameMap = new Map(warehouses.map(w => [w.warehouse_id, w.name]));
        warehouseIds.forEach(id => {
          if (!warehouseNameMap.has(id)) {
            warehouseNameMap.set(id, id);
          }
        });
        const categoryNameMap = new Map(categories.map(c => [c._id.toString(), c.name]));

        // Stock by Warehouse
        const warehouseMap = new Map();
        filteredInventory.forEach(item => {
          const warehouseName = warehouseNameMap.get(item.warehouse_id) || 'Unknown';
          warehouseMap.set(warehouseName, (warehouseMap.get(warehouseName) || 0) + item.qty);
        });

        // Category Breakdown
        const categoryMap = new Map();
        filteredInventory.forEach(item => {
          const categoryName = categoryNameMap.get(item.category_id) || 'Unknown';
          categoryMap.set(categoryName, (categoryMap.get(categoryName) || 0) + (item.qty * item.unit_price));
        });

        // Stock by Item
        const itemMap = new Map();
        filteredInventory.forEach(item => {
          itemMap.set(item.name, (itemMap.get(item.name) || 0) + item.qty);
        });

        // Get total counts
        const totalWarehouses = await Warehouse.countDocuments();
        const totalCategories = await Category.countDocuments();

        results = {
          totals: {
            totalStockQty,
            totalStockValue,
            reorderItems,
            totalWarehouses,
            totalCategories,
            lowStockItems: reorderItems,
          },
          chartData: {
            stockByItem: Array.from(itemMap.entries()).map(([name, value]) => ({ name, value })),
            stockByWarehouse: Array.from(warehouseMap.entries()).map(([name, value]) => ({ name, value })),
            categoryBreakdown: Array.from(categoryMap.entries()).map(([name, value]) => ({ name, value })),
          },
          recentTransactions: [], // Could filter transactions too
          recentSpareParts: [],
        };
        break;

      default:
        return res.status(400).json({ error: 'Invalid type parameter' });
    }

    res.json({ results, type });
  } catch (error) {
    console.error('Search API error:', error);
    res.status(500).json({ error: 'Failed to perform search' });
  }
});

module.exports = router;