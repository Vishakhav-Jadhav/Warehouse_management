const mongoose = require('mongoose');

const settingsSchema = new mongoose.Schema({
  currency: {
    type: String,
    default: 'USD',
    enum: ['USD', 'EUR', 'GBP', 'JPY']
  },
  timezone: {
    type: String,
    default: 'UTC',
    enum: ['UTC', 'EST', 'PST', 'CST']
  },
  itemsPerPage: {
    type: Number,
    default: 20,
    min: 10,
    max: 100
  },
  mapsApiKey: {
    type: String,
    default: ''
  }
}, {
  timestamps: true
});

// Ensure only one settings document exists
settingsSchema.pre('save', async function(next) {
  if (this.isNew) {
    const existing = await this.constructor.findOne();
    if (existing) {
      throw new Error('Only one settings document can exist');
    }
  }
  next();
});

module.exports = mongoose.model('Settings', settingsSchema);