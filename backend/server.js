const express = require('express');
const cors = require('cors');
require('dotenv').config();

const authRoutes = require('./routes/auth');
const clientsRoutes = require('./routes/clients');
const sessionsRoutes = require('./routes/sessions');
const trainingLogsRoutes = require('./routes/trainingLogs');
const subscriptionRoutes = require('./routes/subscriptions');
const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors({
  origin: '*',
  credentials: false
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Request logging middleware (development)
if (process.env.NODE_ENV === 'development') {
  app.use((req, res, next) => {
    console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
    next();
  });
}

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ 
    status: 'healthy',
    timestamp: new Date().toISOString()
  });
});


const { checkReadOnlyMode, checkClientLimit, checkSessionLimit } = require('./middleware/subscription');
app.use('/api', checkReadOnlyMode);
app.use('/api', checkClientLimit);
app.use('/api', checkSessionLimit);


// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/clients', clientsRoutes);
app.use('/api/sessions', sessionsRoutes);
app.use('/api/training-logs', trainingLogsRoutes);
app.use('/api/subscriptions', subscriptionRoutes);


// 404 handler
app.use((req, res) => {
  res.status(404).json({
    error: 'Not Found',
    message: 'The requested resource does not exist'
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Error:', err);
  
  res.status(err.status || 500).json({
    error: err.message || 'Internal Server Error',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`
╔════════════════════════════════════════╗
║     TRENIKO Backend Server Started    ║
╠════════════════════════════════════════╣
║  Port: ${PORT.toString().padEnd(33)}║
║  Environment: ${(process.env.NODE_ENV || 'development').padEnd(24)}║
║  URL: http://localhost:${PORT.toString().padEnd(19)}║
╚════════════════════════════════════════╝
  `);
  console.log('✅ Server is ready to accept requests\n');
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM signal received: closing HTTP server');
  app.close(() => {
    console.log('HTTP server closed');
  });
});
require('./cron');
module.exports = app;
