const express = require('express');
const router = express.Router();
const Settings = require('../models/Settings');
const Category = require('../models/Category');
const { auth } = require('../middleware/auth');

// Get general settings
router.get('/general', auth, async (req, res) => {
  try {
    let settings = await Settings.findOne();
    if (!settings) {
      settings = new Settings();
      await settings.save();
    }
    res.json({
      currency: settings.currency,
      timezone: settings.timezone,
      itemsPerPage: settings.itemsPerPage
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Update general settings
router.post('/general', auth, async (req, res) => {
  try {
    console.log('POST /api/settings/general called');
    console.log('Request body:', req.body);
    const { currency, timezone, itemsPerPage } = req.body;
    let settings = await Settings.findOne();
    if (!settings) {
      settings = new Settings();
      console.log('Created new settings document');
    }
    settings.currency = currency;
    settings.timezone = timezone;
    settings.itemsPerPage = itemsPerPage;
    await settings.save();
    console.log('Settings saved successfully:', {
      currency: settings.currency,
      timezone: settings.timezone,
      itemsPerPage: settings.itemsPerPage
    });
    res.json({
      currency: settings.currency,
      timezone: settings.timezone,
      itemsPerPage: settings.itemsPerPage
    });
  } catch (error) {
    console.error('Error saving general settings:', error);
    res.status(500).json({ message: error.message });
  }
});

// Get categories
router.get('/categories', auth, async (req, res) => {
  try {
    const categories = await Category.find();
    res.json(categories);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Create category
router.post('/categories', auth, async (req, res) => {
  try {
    const { name, type } = req.body;
    const category = new Category({ name, type });
    await category.save();
    res.status(201).json(category);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Update category
router.put('/categories/:id', auth, async (req, res) => {
  console.log('Updating category:', req.params.id, req.body);
  try {
    const { name, type } = req.body;
    const category = await Category.findByIdAndUpdate(
      req.params.id,
      { name, type },
      { new: true }
    );
    console.log('Updated category:', category);
    if (!category) {
      return res.status(404).json({ message: 'Category not found' });
    }
    res.json(category);
  } catch (error) {
    console.error('Update category error:', error);
    res.status(500).json({ message: error.message });
  }
});

// Delete category
router.delete('/categories/:id', auth, async (req, res) => {
  try {
    const category = await Category.findByIdAndDelete(req.params.id);
    if (!category) {
      return res.status(404).json({ message: 'Category not found' });
    }
    res.json({ message: 'Category deleted' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Get API config
router.get('/api-config', auth, async (req, res) => {
  try {
    let settings = await Settings.findOne();
    if (!settings) {
      settings = new Settings();
      await settings.save();
    }
    res.json({ mapsApiKey: settings.mapsApiKey });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Update API config
router.post('/api-config', auth, async (req, res) => {
  try {
    console.log('POST /api/settings/api-config called');
    console.log('Request body:', req.body);
    const { mapsApiKey } = req.body;
    let settings = await Settings.findOne();
    if (!settings) {
      settings = new Settings();
      console.log('Created new settings document for API config');
    }
    settings.mapsApiKey = mapsApiKey;
    await settings.save();
    console.log('API config saved successfully:', { mapsApiKey: settings.mapsApiKey });
    res.json({ mapsApiKey: settings.mapsApiKey });
  } catch (error) {
    console.error('Error saving API config:', error);
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;