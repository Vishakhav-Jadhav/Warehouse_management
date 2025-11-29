const express = require('express');
const router = express.Router();
const Category = require('../models/Category');
const { auth } = require('../middleware/auth');

// GET /api/categories - Get all categories
router.get('/', auth, async (req, res) => {
  try {
    const { type } = req.query;
    const query = type ? { type } : {};

    const categories = await Category.find(query).sort({ name: 1 });
    res.json({
      data: categories,
      pagination: {
        page: 1,
        limit: categories.length,
        total: categories.length,
        pages: 1,
      },
    });
  } catch (error) {
    console.error('Error fetching categories:', error);
    res.status(500).json({ error: 'Failed to fetch categories' });
  }
});

// POST /api/categories - Create a new category
router.post('/', auth, async (req, res) => {
  try {
    const category = new Category({
      name: req.body.name,
      type: req.body.type || 'Inventory',
      description: req.body.description
    });
    const savedCategory = await category.save();
    res.status(201).json(savedCategory);
  } catch (error) {
    console.error('Error creating category:', error);
    if (error.code === 11000) {
      res.status(400).json({ error: 'Category name already exists' });
    } else {
      res.status(500).json({ error: 'Failed to create category' });
    }
  }
});

// GET /api/categories/:id - Get category by ID
router.get('/:id', auth, async (req, res) => {
  try {
    const category = await Category.findById(req.params.id);
    if (!category) {
      return res.status(404).json({ error: 'Category not found' });
    }
    res.json(category);
  } catch (error) {
    console.error('Error fetching category:', error);
    res.status(500).json({ error: 'Failed to fetch category' });
  }
});

// PUT /api/categories/:id - Update category
router.put('/:id', auth, async (req, res) => {
  try {
    const updateData = {};
    if (req.body.name !== undefined) updateData.name = req.body.name;
    if (req.body.type !== undefined) updateData.type = req.body.type;
    if (req.body.description !== undefined) updateData.description = req.body.description;

    const updated = await Category.findByIdAndUpdate(
      req.params.id,
      updateData,
      { new: true, runValidators: true }
    );

    if (!updated) {
      return res.status(404).json({ error: 'Category not found' });
    }

    res.json({ success: true, category: updated });
  } catch (error) {
    console.error('Update category error:', error);
    res.status(500).json({ error: 'Failed to update category' });
  }
});

// DELETE /api/categories/:id - Delete category
router.delete('/:id', auth, async (req, res) => {
  try {
    const category = await Category.findById(req.params.id);
    if (!category) {
      return res.status(404).json({ success: false, message: 'Category not found' });
    }

    // Check if category is being used
    const InventoryItem = require('../models/InventoryItem');
    const SparePart = require('../models/SparePart');

    const inventoryCount = await InventoryItem.countDocuments({ category_id: req.params.id });
    const sparePartCount = await SparePart.countDocuments({ category_id: req.params.id });

    if (inventoryCount > 0 || sparePartCount > 0) {
      return res.status(400).json({
        success: false,
        message: 'Cannot delete category that is being used by inventory items or spare parts'
      });
    }

    await Category.findByIdAndDelete(req.params.id);
    res.json({ success: true, message: 'Category deleted' });
  } catch (error) {
    console.error('Error deleting category:', error);
    res.status(500).json({ success: false, message: 'Failed to delete category' });
  }
});

module.exports = router;