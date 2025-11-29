const mongoose = require('mongoose');

const sparePartSchema = new mongoose.Schema({
  part_number: {
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
  description: {
    type: String,
    trim: true
  },
  category_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Category',
    required: true
  },
  compatibility: {
    type: String,
    trim: true
  },
  reorder_threshold: {
    type: Number,
    required: true,
    default: 5,
    min: 0
  },
  image_url: {
    type: String,
    trim: true
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('SparePart', sparePartSchema);