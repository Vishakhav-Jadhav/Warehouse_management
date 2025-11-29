const express = require('express');
const router = express.Router();
const Warehouse = require('../models/Warehouse');
const InventoryItem = require('../models/InventoryItem');
const { auth } = require('../middleware/auth');

// GET /api/warehouses - Get all warehouses
router.get('/', auth, async (req, res) => {
  try {
    const warehouses = await Warehouse.find().sort({ createdAt: -1 });
    res.json({
      data: warehouses,
      pagination: {
        page: 1,
        limit: warehouses.length,
        total: warehouses.length,
        pages: 1,
      },
    });
  } catch (error) {
    console.error('Error fetching warehouses:', error);
    res.status(500).json({ error: 'Failed to fetch warehouses' });
  }
});

// POST /api/warehouses - Create a new warehouse
router.post('/', auth, async (req, res) => {
  try {
    const warehouse = new Warehouse({
      warehouse_id: req.body.name.toLowerCase().replace(/\s+/g, '_'),
      name: req.body.name,
      district: req.body.district,
      address: req.body.address,
      manager: req.body.manager,
      phone: req.body.phone
    });
    const savedWarehouse = await warehouse.save();
    res.status(201).json(savedWarehouse);
  } catch (error) {
    console.error('Error creating warehouse:', error);
    if (error.code === 11000) {
      res.status(400).json({ error: 'Warehouse name already exists' });
    } else {
      res.status(500).json({ error: 'Failed to create warehouse' });
    }
  }
});

// GET /api/warehouses/:id - Get warehouse by ID
router.get('/:id', auth, async (req, res) => {
  try {
    const warehouse = await Warehouse.findById(req.params.id);
    if (!warehouse) {
      return res.status(404).json({ error: 'Warehouse not found' });
    }
    res.json(warehouse);
  } catch (error) {
    console.error('Error fetching warehouse:', error);
    res.status(500).json({ error: 'Failed to fetch warehouse' });
  }
});

// PUT /api/warehouses/:id - Update warehouse
router.put('/:id', auth, async (req, res) => {
  try {
    const updateData = {};
    if (req.body.name !== undefined) updateData.name = req.body.name;
    if (req.body.district !== undefined) updateData.district = req.body.district;
    if (req.body.address !== undefined) updateData.address = req.body.address;
    if (req.body.manager !== undefined) updateData.manager = req.body.manager;
    if (req.body.phone !== undefined) updateData.phone = req.body.phone;

    const updated = await Warehouse.findByIdAndUpdate(
      req.params.id,
      updateData,
      { new: true, runValidators: true }
    );

    if (!updated) {
      return res.status(404).json({ error: 'Warehouse not found' });
    }

    res.json({ success: true, warehouse: updated });
  } catch (err) {
    console.error('Update warehouse error:', err);
    res.status(500).json({ error: 'Failed to update warehouse' });
  }
});

// PATCH /api/warehouses/:id - Partial update warehouse
router.patch('/:id', auth, async (req, res) => {
  try {
    const updateData = {};
    if (req.body.name !== undefined) updateData.name = req.body.name;
    if (req.body.district !== undefined) updateData.district = req.body.district;
    if (req.body.address !== undefined) updateData.address = req.body.address;
    if (req.body.manager !== undefined) updateData.manager = req.body.manager;
    if (req.body.phone !== undefined) updateData.phone = req.body.phone;

    const warehouse = await Warehouse.findByIdAndUpdate(
      req.params.id,
      updateData,
      { new: true, runValidators: true }
    );
    if (!warehouse) {
      return res.status(404).json({ error: 'Warehouse not found' });
    }
    res.json({ success: true, warehouse });
  } catch (error) {
    console.error('Error updating warehouse:', error);
    if (error.code === 11000) {
      res.status(400).json({ error: 'Warehouse name already exists' });
    } else {
      res.status(500).json({ error: 'Failed to update warehouse' });
    }
  }
});

// DELETE /api/warehouses/:id - Delete warehouse
router.delete('/:id', auth, async (req, res) => {
  try {
    const warehouse = await Warehouse.findById(req.params.id);
    if (!warehouse) {
      return res.status(404).json({ error: 'Warehouse not found' });
    }
    // Invalidate related inventory items
    await InventoryItem.updateMany({ warehouse_id: warehouse.warehouse_id }, { $unset: { warehouse_id: 1 } });
    // Delete the warehouse
    await Warehouse.findByIdAndDelete(req.params.id);
    res.json({ success: true, message: 'Warehouse deleted' });
  } catch (error) {
    console.error('Error deleting warehouse:', error);
    res.status(500).json({ error: 'Failed to delete warehouse' });
  }
});

module.exports = router;