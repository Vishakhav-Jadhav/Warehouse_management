const mongoose = require('mongoose');

const transactionSchema = new mongoose.Schema({
  date: {
    type: Date,
    required: true,
    default: Date.now
  },
  warehouse_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Warehouse',
    required: true
  },
  type: {
    type: String,
    required: true,
    enum: ['Spare In', 'Spare Out', 'Spare Transfer', 'Spare Return']
  },
  source_destination: {
    type: String,
    required: true,
    trim: true
  },
  sku: {
    type: String,
    trim: true,
    uppercase: true
  },
  qty: {
    type: Number,
    required: true,
    min: 1
  },
  status: {
    type: String,
    required: true,
    enum: ['Pending', 'Completed', 'In Transit', 'Cancelled'],
    default: 'Pending'
  },
  notes: {
    type: String,
    trim: true
  },
  created_by: {
    type: String,
    trim: true
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('Transaction', transactionSchema);