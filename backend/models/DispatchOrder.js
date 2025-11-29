const mongoose = require('mongoose');

const dispatchItemSchema = new mongoose.Schema({
  sku: {
    type: String,
    required: true,
    trim: true,
    uppercase: true
  },
  qty: {
    type: Number,
    required: true,
    min: 1
  },
  unit_price: {
    type: Number,
    required: true,
    min: 0
  }
});

const dispatchOrderSchema = new mongoose.Schema({
  order_number: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    uppercase: true
  },
  warehouse_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Warehouse',
    required: true
  },
  customer_name: {
    type: String,
    required: true,
    trim: true
  },
  customer_contact: {
    type: String,
    trim: true
  },
  destination: {
    type: String,
    required: true,
    trim: true
  },
  status: {
    type: String,
    required: true,
    enum: ['Pending', 'Dispatched', 'Completed', 'In Transit'],
    default: 'Pending'
  },
  dispatch_date: {
    type: Date
  },
  total_value: {
    type: Number,
    required: true,
    min: 0
  },
  items: [dispatchItemSchema]
}, {
  timestamps: true
});

module.exports = mongoose.model('DispatchOrder', dispatchOrderSchema);