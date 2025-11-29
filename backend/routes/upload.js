const express = require('express');
const router = express.Router();
const Warehouse = require('../models/Warehouse');
const InventoryItem = require('../models/InventoryItem');
const Transaction = require('../models/Transaction');
const SparePart = require('../models/SparePart');
const Category = require('../models/Category');
const Task = require('../models/Task');
const { auth } = require('../middleware/auth');

// POST /api/upload - Bulk upload data
router.post('/', auth, async (req, res) => {
  try {
    const { scope, data } = req.body;

    let inserted = 0;
    let updated = 0;
    const errors = [];

    switch (scope) {
      case 'warehouses':
        for (let i = 0; i < data.length; i++) {
          const row = data[i];
          try {
            const existing = await Warehouse.findOne({ name: row.name });
            if (existing) {
              await Warehouse.findByIdAndUpdate(existing._id, {
                district: row.district,
                address: row.address,
                manager: row.manager,
                contact_email: row.contact_email,
                phone: row.contact_phone,
                updatedAt: new Date(),
              });
              updated++;
            } else {
              await Warehouse.create({
                warehouse_id: row.name.toLowerCase().replace(/\s+/g, '_'),
                name: row.name,
                district: row.district,
                address: row.address,
                manager: row.manager,
                contact_email: row.contact_email,
                phone: row.contact_phone,
              });
              inserted++;
            }
          } catch (err) {
            errors.push({ row: i + 1, field: 'general', message: err.message });
          }
        }
        break;

      case 'inventory':
        for (let i = 0; i < data.length; i++) {
          const row = data[i];
          try {
            if (!row.sku || !row.name || !row.warehouse_id) {
              throw new Error('Missing required fields: sku, name, warehouse_id');
            }

            const existing = await InventoryItem.findOne({ sku: row.sku });
            if (existing) {
              await InventoryItem.findByIdAndUpdate(existing._id, {
                name: row.name,
                category_id: row.category_id,
                warehouse_id: row.warehouse_id,
                qty: parseInt(row.qty) || 0,
                unit_price: parseFloat(row.unit_price) || 0,
                reorder_threshold: parseInt(row.reorder_threshold) || 10,
                updatedAt: new Date(),
              });
              updated++;
            } else {
              await InventoryItem.create({
                sku: row.sku,
                name: row.name,
                category_id: row.category_id,
                warehouse_id: row.warehouse_id,
                qty: parseInt(row.qty) || 0,
                unit_price: parseFloat(row.unit_price) || 0,
                reorder_threshold: parseInt(row.reorder_threshold) || 10,
              });
              inserted++;
            }
          } catch (err) {
            errors.push({ row: i + 1, field: 'general', message: err.message });
          }
        }
        break;

      case 'transactions':
        for (let i = 0; i < data.length; i++) {
          const row = data[i];
          try {
            if (!row.warehouse_id || !row.type || !row.source_destination || !row.qty) {
              throw new Error('Missing required fields');
            }

            // Find warehouse by warehouse_id to get ObjectId
            const warehouse = await Warehouse.findOne({ warehouse_id: row.warehouse_id });
            if (!warehouse) {
              throw new Error(`Warehouse with warehouse_id ${row.warehouse_id} not found`);
            }

            await Transaction.create({
              date: row.date || new Date(),
              warehouse_id: warehouse._id,
              type: row.type,
              source_destination: row.source_destination,
              sku: row.sku,
              qty: parseInt(row.qty),
              status: row.status || 'Pending',
              notes: row.notes,
            });
            inserted++;
          } catch (err) {
            errors.push({ row: i + 1, field: 'general', message: err.message });
          }
        }
        break;

      case 'spare_parts':
        for (let i = 0; i < data.length; i++) {
          const row = data[i];
          try {
            const partNumber = row.part_number?.trim()?.toUpperCase();
            if (!partNumber) {
              throw new Error('Part number is required');
            }
            const name = row.name?.trim();
            if (!name) {
              throw new Error('Name is required');
            }
            const categoryName = row.category_name?.trim();
            if (!categoryName) {
              throw new Error('Category name is required');
            }
            let category = await Category.findOne({ name: categoryName, type: 'Spare Parts' });
            if (!category) {
              category = await Category.create({ name: categoryName, type: 'Spare Parts' });
            }
            const existing = await SparePart.findOne({ part_number: partNumber });
            if (existing) {
              await SparePart.findByIdAndUpdate(existing._id, {
                name,
                description: row.description?.trim(),
                category_id: category._id,
                compatibility: row.compatibility?.trim(),
                reorder_threshold: parseInt(row.reorder_threshold) || 5,
                updatedAt: new Date(),
              });
              updated++;
            } else {
              await SparePart.create({
                part_number: partNumber,
                name,
                description: row.description?.trim(),
                category_id: category._id,
                compatibility: row.compatibility?.trim(),
                reorder_threshold: parseInt(row.reorder_threshold) || 5,
              });
              inserted++;
            }
          } catch (err) {
            errors.push({ row: i + 1, field: 'general', message: err.message });
          }
        }
        break;

      case 'tasks':
        for (let i = 0; i < data.length; i++) {
          const row = data[i];
          try {
            await Task.create({
              title: row.title,
              description: row.description,
              assignee: row.assignee,
              due_date: row.due_date,
              status: row.status || 'Pending',
              priority: row.priority || 'Medium',
            });
            inserted++;
          } catch (err) {
            errors.push({ row: i + 1, field: 'general', message: err.message });
          }
        }
        break;

      default:
        return res.status(400).json({ error: 'Invalid scope' });
    }

    res.json({ inserted, updated, errors });
  } catch (error) {
    console.error('Upload API error:', error);
    res.status(500).json({ error: 'Upload failed' });
  }
});

module.exports = router;