import dotenv from 'dotenv';
dotenv.config();

export const ENV = {
  port: parseInt(process.env.PORT || '3000', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  isDev: process.env.NODE_ENV !== 'production',

  db: {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432', 10),
    name: process.env.DB_NAME || 'prescopad',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'postgres',
    url: process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/prescopad',
  },

  jwt: {
    secret: process.env.JWT_SECRET || 'prescopad-jwt-secret-change-in-production',
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
    refreshSecret: process.env.JWT_REFRESH_SECRET || 'prescopad-refresh-secret-change-in-production',
    refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '30d',
  },

  otp: {
    demoMode: process.env.OTP_DEMO_MODE === 'true',
    demoCode: process.env.OTP_DEMO_CODE || '123456',
  },

  fast2sms: {
    apiKey: process.env.FAST2SMS_API_KEY || 'KCrl685IyQWHdhtALsXeJNqP40YxRFVk1ozgOfBEMDnp7bmuS3QmEfiGOT74lFCeDXrKkY2Zn0oLI3pw',
  },

  razorpay: {
    keyId: process.env.RAZORPAY_KEY_ID || '',
    keySecret: process.env.RAZORPAY_KEY_SECRET || '',
  },

  rateLimit: {
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000', 10),
    max: parseInt(process.env.RATE_LIMIT_MAX || '100', 10),
  },
} as const;
