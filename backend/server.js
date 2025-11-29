const express = require('express');
const cors = require('cors');
const connectDB = require('./config/database');
require('dotenv').config();

const app = express();

// Connect to MongoDB
connectDB();

// Middleware
app.use(cors({
  origin: ['http://localhost:3000', 'http://localhost:3001', 'http://127.0.0.1:3000', 'http://127.0.0.1:3001'],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/warehouses', require('./routes/warehouses'));
app.use('/api/inventory', require('./routes/inventory'));
app.use('/api/dashboard', require('./routes/dashboard'));
app.use('/api/upload', require('./routes/upload'));
app.use('/api/spare-parts', require('./routes/spareParts'));
app.use('/api/tasks', require('./routes/tasks'));
app.use('/api/transactions', require('./routes/transactions'));
app.use('/api/dispatch-orders', require('./routes/dispatchOrders'));
app.use('/api/reports', require('./routes/reports'));
app.use('/api/settings', require('./routes/settings'));
app.use('/api/notifications', require('./routes/notifications'));
app.use('/api/search', require('./routes/search'));
app.use('/api/categories', require('./routes/categories'));

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', message: 'Warehouse Management API is running' });
});

// Error handling middleware
app.use((err, req, res, next) => {
  res.status(500).json({
    error: 'Something went wrong!',
    message: process.env.NODE_ENV === 'development' ? err.message : 'Internal server error'
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

const PORT = process.env.PORT || 5001;

// Function to find an available port
function findAvailablePort(startPort) {
  return new Promise((resolve, reject) => {
    const server = require('net').createServer();
    server.listen(startPort, () => {
      const { port } = server.address();
      server.close(() => resolve(port));
    });
    server.on('error', () => {
      // Port is busy, try next port
      findAvailablePort(startPort + 1).then(resolve).catch(reject);
    });
  });
}

// Start server with error handling and auto port switching
async function startServer() {
  try {
    let port = PORT;

    // If port is busy, find an available one
    if (process.env.NODE_ENV !== 'production') {
      try {
        port = await findAvailablePort(PORT);
      } catch (error) {
        process.exit(1);
      }
    }

    const server = app.listen(port, () => {
      // Server started successfully
    });

    // Handle server errors
    server.on('error', (error) => {
      if (error.code === 'EADDRINUSE') {
        process.exit(1);
      } else {
        process.exit(1);
      }
    });

    // Graceful shutdown
    process.on('SIGINT', () => {
      server.close(() => {
        process.exit(0);
      });
    });

    process.on('SIGTERM', () => {
      server.close(() => {
        process.exit(0);
      });
    });

  } catch (error) {
    process.exit(1);
  }
}

startServer();

module.exports = app;