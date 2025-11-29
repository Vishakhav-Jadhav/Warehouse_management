const mongoose = require('mongoose');

const inventoryItemSchema = new mongoose.Schema({
  sku: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    uppercase: true
  },
  name: {
    type: String,
    required: true,
    trim: true
  },
  category_id: {
    type: String,
    required: true
  },
  warehouse_id: {
    type: String,
    required: true
  },
  qty: {
    type: Number,
    required: true,
    default: 0,
    min: 0
  },
  unit_price: {
    type: Number,
    required: true,
    default: 0,
    min: 0
  },
  reorder_threshold: {
    type: Number,
    required: true,
    default: 10,
    min: 0
  },
  image_url: {
    type: String,
    trim: true
  }
}, {
  timestamps: true
});

// Compound index for sku and warehouse_id to ensure uniqueness per warehouse
inventoryItemSchema.index({ sku: 1, warehouse_id: 1 }, { unique: true });

module.exports = mongoose.model('InventoryItem', inventoryItemSchema);