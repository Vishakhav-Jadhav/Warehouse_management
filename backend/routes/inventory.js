const express = require('express');
const router = express.Router();
const InventoryItem = require('../models/InventoryItem');
const Transaction = require('../models/Transaction');
const Warehouse = require('../models/Warehouse');
const { auth } = require('../middleware/auth');

// GET /api/inventory - Get all inventory items
router.get('/', auth, async (req, res) => {
  try {
    const { warehouse, category, page = 1, limit = 20 } = req.query;

    let query = {};
    if (warehouse) query.warehouse_id = warehouse;
    if (category) query.category_id = category;

    const items = await InventoryItem.find(query)
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await InventoryItem.countDocuments(query);

    res.json({
      data: items,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error('Error fetching inventory:', error);
    res.status(500).json({ error: 'Failed to fetch inventory' });
  }
});

// POST /api/inventory/adjust - Adjust inventory quantity
router.post('/adjust', auth, async (req, res) => {
  const session = await InventoryItem.startSession();
  session.startTransaction();

  try {
    const { sku, warehouseId, delta, reason } = req.body;

    if (!sku || !warehouseId || delta === undefined) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const item = await InventoryItem.findOne({ sku, warehouse_id: warehouseId }).session(session);
    if (!item) {
      await session.abortTransaction();
      return res.status(404).json({ error: 'Item not found' });
    }

    const newQty = item.qty + delta;
    if (newQty < 0) {
      await session.abortTransaction();
      return res.status(400).json({ error: 'Insufficient stock' });
    }

    item.qty = newQty;
    item.updatedAt = new Date();
    await item.save({ session });

    const transactionType = delta > 0 ? 'Spare In' : 'Spare Out';
    const transaction = new Transaction({
      warehouse_id: warehouseId,
      type: transactionType,
      source_destination: reason || 'Manual adjustment',
      sku,
      qty: Math.abs(delta),
      status: 'Completed',
      notes: reason,
    });
    await transaction.save({ session });

    await session.commitTransaction();
    res.json(item);
  } catch (error) {
    await session.abortTransaction();
    console.error('Error adjusting inventory:', error);
    res.status(500).json({ error: 'Failed to adjust inventory' });
  } finally {
    session.endSession();
  }
});

// POST /api/inventory/import - Bulk import inventory items
router.post('/import', auth, async (req, res) => {
  try {
    const items = req.body;

    if (!Array.isArray(items)) {
      return res.status(400).json({ error: 'Request body must be an array of inventory items' });
    }

    let inserted = 0;
    let skipped = 0;
    const errors = [];

    // Process each item
    for (let i = 0; i < items.length; i++) {
      const item = items[i];

      try {
        // Validate required fields
        if (!item.sku || !item.name) {
          skipped++;
          errors.push({ row: i + 1, error: 'Missing required fields: sku, name' });
          continue;
        }

        // Convert warehouse_id and rack_id to ObjectIds if they exist
        let warehouseObjectId = null;
        let rackObjectId = null;

        if (item.warehouse_id) {
          const warehouse = await Warehouse.findOne({ warehouse_id: item.warehouse_id });
          if (warehouse) {
            warehouseObjectId = warehouse._id;
          }
        }

        // For now, rack_id is kept as string since we don't have a Rack model
        // In the future, you might want to create a Rack model and convert rack_id to ObjectId

        // Prepare the data
        const itemData = {
          sku: item.sku,
          name: item.name,
          category_id: item.category || null,
          warehouse_id: item.warehouse_id || null, // Keep as string for InventoryItem model
          rack_id: item.rack_id || null,
          qty: parseInt(item.qty) || 0,
          unit_price: parseFloat(item.unit_price) || 0,
          reorder_threshold: parseInt(item.reorder_threshold) || 10,
        };

        // Check if item already exists (by sku and warehouse_id)
        const existing = await InventoryItem.findOne({
          sku: itemData.sku,
          warehouse_id: itemData.warehouse_id
        });

        if (existing) {
          // Update existing item
          await InventoryItem.findByIdAndUpdate(existing._id, {
            ...itemData,
            updatedAt: new Date(),
          });
          inserted++; // Count as inserted (updated)
        } else {
          // Create new item
          await InventoryItem.create(itemData);
          inserted++;
        }

      } catch (error) {
        skipped++;
        errors.push({ row: i + 1, error: error.message });
      }
    }

    res.json({
      success: true,
      inserted,
      skipped,
      errors: errors.length > 0 ? errors : undefined,
    });

  } catch (error) {
    console.error('Error importing inventory:', error);
    res.status(500).json({ error: 'Failed to import inventory items' });
  }
});

// POST /api/inventory - Create inventory item
router.post('/', auth, async (req, res) => {
  console.log('Creating inventory item:', req.body);
  try {
    const { category, ...itemData } = req.body;
    const finalData = {
      ...itemData,
      category_id: category
    };
    const item = new InventoryItem(finalData);
    const savedItem = await item.save();
    console.log('Item saved:', savedItem._id);
    res.status(201).json(savedItem);
  } catch (error) {
    console.error('Error creating inventory item:', error);
    if (error.code === 11000) {
      res.status(400).json({ error: 'Item with this SKU already exists in this warehouse' });
    } else {
      res.status(500).json({ error: 'Failed to create inventory item', details: error.message });
    }
  }
});

// PUT /api/inventory/:sku - Update inventory item
router.put('/:sku', auth, async (req, res) => {
  try {
    const query = { sku: req.params.sku };
    if (req.body.warehouse_id) {
      query.warehouse_id = req.body.warehouse_id;
    }
    const item = await InventoryItem.findOneAndUpdate(
      query,
      req.body,
      { new: true, runValidators: true }
    );

    if (!item) {
      return res.status(404).json({ error: 'Inventory item not found' });
    }
    res.json(item);
  } catch (error) {
    console.error('Error updating inventory item:', error);
    res.status(500).json({ error: 'Failed to update inventory item' });
  }
});

// DELETE /api/inventory/:sku - Delete inventory item
router.delete('/:sku', auth, async (req, res) => {
  try {
    const item = await InventoryItem.findOneAndDelete({ sku: req.params.sku });
    if (!item) {
      return res.status(404).json({ error: 'Inventory item not found' });
    }
    res.json({ message: 'Inventory item deleted successfully' });
  } catch (error) {
    console.error('Error deleting inventory item:', error);
    res.status(500).json({ error: 'Failed to delete inventory item' });
  }
});

module.exports = router;