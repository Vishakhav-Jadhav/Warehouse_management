const express = require('express');
const router = express.Router();
const SparePart = require('../models/SparePart');
const Category = require('../models/Category');
const { auth } = require('../middleware/auth');

// GET /api/spare-parts - Get all spare parts with optional search
router.get('/', auth, async (req, res) => {
  try {
    const { search } = req.query;

    let query = {};
    if (search) {
      const searchRegex = new RegExp(search, 'i');
      query = {
        $or: [
          { part_number: searchRegex },
          { name: searchRegex },
          { description: searchRegex },
          { compatibility: searchRegex }
        ]
      };
    }

    const spareParts = await SparePart.find(query)
      .populate('category_id', 'name type')
      .sort({ createdAt: -1 });
    res.json(spareParts);
  } catch (error) {
    console.error('Error fetching spare parts:', error);
    res.status(500).json({ error: 'Failed to fetch spare parts' });
  }
});

// POST /api/spare-parts - Create spare part
router.post('/', auth, async (req, res) => {
  try {
    const { category, ...partData } = req.body;

    // Handle category - if string, find or create category
    let categoryId = category;
    if (typeof category === 'string') {
      const Category = require('../models/Category');
      let categoryDoc = await Category.findOne({ name: category });
      if (!categoryDoc) {
        categoryDoc = new Category({
          name: category,
          type: 'Spare Parts' // Default type
        });
        await categoryDoc.save();
      }
      categoryId = categoryDoc._id;
    }

    const sparePart = new SparePart({
      ...partData,
      category_id: categoryId
    });

    const savedSparePart = await sparePart.save();
    await savedSparePart.populate('category_id', 'name type');
    res.status(201).json(savedSparePart);
  } catch (error) {
    console.error('Error creating spare part:', error);
    if (error.code === 11000) {
      res.status(400).json({ error: 'Spare part with this part number already exists' });
    } else {
      res.status(500).json({ error: 'Failed to create spare part' });
    }
  }
});

// PUT /api/spare-parts/:id - Update spare part
router.put('/:id', auth, async (req, res) => {
  try {
    const sparePart = await SparePart.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    ).populate('category_id', 'name type');

    if (!sparePart) {
      return res.status(404).json({ error: 'Spare part not found' });
    }
    res.json(sparePart);
  } catch (error) {
    console.error('Error updating spare part:', error);
    res.status(500).json({ error: 'Failed to update spare part' });
  }
});

// DELETE /api/spare-parts/:id - Delete spare part
router.delete('/:id', auth, async (req, res) => {
  try {
    const id = req.params.id.trim();

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ error: 'Invalid spare part ID' });
    }

    const deleted = await SparePart.findByIdAndDelete(id);

    if (!deleted) {
      return res.status(404).json({ error: 'Spare part not found' });
    }

    return res.json({ success: true });
  } catch (err) {
    console.error('Delete spare part error:', err);
    return res.status(500).json({ error: 'Failed to delete spare part' });
  }
});

// POST /api/spare-parts/import - Bulk import spare parts
router.post('/import', auth, async (req, res) => {
  try {
    const items = req.body;

    if (!Array.isArray(items)) {
      return res.status(400).json({ error: 'Request body must be an array of spare parts' });
    }

    let inserted = 0;
    let skipped = 0;
    const errors = [];

    // Process each item
    for (let i = 0; i < items.length; i++) {
      const item = items[i];

      try {
        // Validate required fields
        if (!item.part_number || !item.name) {
          skipped++;
          errors.push({ row: i + 1, error: 'Missing required fields: part_number, name' });
          continue;
        }

        // Handle category - if string, find or create category
        let categoryId = null;
        if (item.category_name || item.category) {
          const categoryName = item.category_name || item.category;
          let categoryDoc = await Category.findOne({ name: categoryName });
          if (!categoryDoc) {
            categoryDoc = new Category({
              name: categoryName,
              type: 'Spare Parts'
            });
            await categoryDoc.save();
          }
          categoryId = categoryDoc._id;
        }

        // Prepare the data
        const partData = {
          part_number: item.part_number,
          name: item.name,
          description: item.description || null,
          compatibility: item.compatibility || null,
          reorder_threshold: parseInt(item.reorder_threshold) || 5,
          category_id: categoryId,
          rack_id: item.rack_id || null,
        };

        // Check if part already exists (by part_number)
        const existing = await SparePart.findOne({
          part_number: partData.part_number
        });

        if (existing) {
          // Update existing part
          await SparePart.findByIdAndUpdate(existing._id, {
            ...partData,
            updatedAt: new Date(),
          });
          inserted++; // Count as inserted (updated)
        } else {
          // Create new part
          await SparePart.create(partData);
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
    console.error('Error importing spare parts:', error);
    res.status(500).json({ error: 'Failed to import spare parts' });
  }
});

module.exports = router;