const express = require('express');
const router = express.Router();
const DispatchOrder = require('../models/DispatchOrder');
const { auth } = require('../middleware/auth');

// GET /api/dispatch-orders - Get all dispatch orders
router.get('/', auth, async (req, res) => {
  try {
    const { page = 1, limit = 20, status, warehouse } = req.query;

    let query = {};
    if (status) query.status = status;
    if (warehouse) query.warehouse_id = warehouse;

    const orders = await DispatchOrder.find(query)
      .populate('warehouse_id', 'name district')
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await DispatchOrder.countDocuments(query);

    res.json({
      data: orders,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error('Error fetching dispatch orders:', error);
    res.status(500).json({ error: 'Failed to fetch dispatch orders' });
  }
});

// POST /api/dispatch-orders - Create dispatch order
router.post('/', auth, async (req, res) => {
  try {
    const order = new DispatchOrder(req.body);
    const savedOrder = await order.save();
    await savedOrder.populate('warehouse_id', 'name district');
    res.status(201).json(savedOrder);
  } catch (error) {
    console.error('Error creating dispatch order:', error);
    res.status(500).json({ error: 'Failed to create dispatch order' });
  }
});

// PUT /api/dispatch-orders/:id - Update dispatch order
router.put('/:id', auth, async (req, res) => {
  try {
    const order = await DispatchOrder.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    ).populate('warehouse_id', 'name district');

    if (!order) {
      return res.status(404).json({ error: 'Dispatch order not found' });
    }
    res.json(order);
  } catch (error) {
    console.error('Error updating dispatch order:', error);
    res.status(500).json({ error: 'Failed to update dispatch order' });
  }
});

// DELETE /api/dispatch-orders/:id - Delete dispatch order
router.delete('/:id', auth, async (req, res) => {
  try {
    const order = await DispatchOrder.findByIdAndDelete(req.params.id);
    if (!order) {
      return res.status(404).json({ error: 'Dispatch order not found' });
    }
    res.json({ message: 'Dispatch order deleted successfully' });
  } catch (error) {
    console.error('Error deleting dispatch order:', error);
    res.status(500).json({ error: 'Failed to delete dispatch order' });
  }
});

module.exports = router;