import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { ENV } from './config/env';
import { errorHandler, notFound } from './middleware/errorHandler';

// Routes
import authRoutes from './routes/auth.routes';
import walletRoutes from './routes/wallet.routes';
import clinicRoutes from './routes/clinic.routes';
import notificationRoutes from './routes/notification.routes';
import dataRoutes from './routes/data.routes';
import connectionRoutes from './routes/connection.routes';
import analyticsRoutes from './routes/analytics.routes';

const app = express();

// Security middleware
app.use(helmet());
app.use(cors({
  origin: ENV.isDev
    ? '*'
    : (process.env.ALLOWED_ORIGINS || '').split(',').filter(Boolean),
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

// Rate limiting (generous for dev/testing)
app.use(rateLimit({
  windowMs: ENV.rateLimit.windowMs,
  max: ENV.isDev ? 1000 : ENV.rateLimit.max,
  message: { error: 'Too many requests, please try again later' },
}));

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Health check
app.get('/api/health', (_req, res) => {
  res.json({
    status: 'ok',
    service: 'PrescoPad API',
    version: '2.0.0',
    timestamp: new Date().toISOString(),
  });
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/wallet', walletRoutes);
app.use('/api/clinic', clinicRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/data', dataRoutes);
app.use('/api/connection', connectionRoutes);
app.use('/api/analytics', analyticsRoutes);

// Error handling
app.use(notFound);
app.use(errorHandler);

// Start server
app.listen(ENV.port, () => {
  console.log(`PrescoPad API running on port ${ENV.port}`);
  console.log(`Environment: ${ENV.nodeEnv}`);
  console.log(`Health check: http://localhost:${ENV.port}/api/health`);
});

export default app;
