# PrescoPad Backend-Frontend Integration Guide

## Overview
This guide explains how to properly set up and run the PrescoPad application with both backend and frontend working together.

## Architecture

### Backend (Node.js + Express + PostgreSQL)
- **Port**: 3000
- **Base URL**: `http://localhost:3000/api`
- **Database**: PostgreSQL (Supabase hosted)
- **Key Features**:
  - JWT authentication with refresh tokens
  - OTP demo mode for offline testing
  - Wallet transactions
  - Rate limiting & security middleware
  - WebSocket support for device sync

### Frontend (React Native + Expo)
- **Framework**: Expo SDK 54
- **State Management**: Zustand (7 stores)
- **Local Database**: expo-sqlite
- **Key Features**:
  - Offline-first architecture
  - Auto token refresh
  - Health check for online/offline detection
  - Demo mode when backend unavailable

## Prerequisites

### Backend Requirements
- Node.js 18+ (you have v25.6.0 ✓)
- npm or yarn
- PostgreSQL database (Supabase configured ✓)

### Frontend Requirements
- Node.js 18+
- Expo CLI
- Android Studio (for Android development)
- Xcode (for iOS development - macOS only)
- Physical device or emulator

## Setup Instructions

### 1. Backend Setup

#### Install Dependencies
```bash
cd backend
npm install
```

#### Environment Configuration
The backend uses `.env` file (already configured):
```env
PORT=3000
NODE_ENV=development

# Database (Supabase)
DATABASE_URL=postgresql://...
DB_HOST=aws-1-ap-southeast-2.pooler.supabase.com
DB_PORT=5432
DB_NAME=postgres
DB_USER=postgres.bqhnrurtopzmakyntacl
DB_PASSWORD=Pr@tik_1213

# JWT
JWT_SECRET=prescopad-jwt-secret-change-in-production
JWT_EXPIRES_IN=7d
JWT_REFRESH_SECRET=prescopad-refresh-secret-change-in-production
JWT_REFRESH_EXPIRES_IN=30d

# OTP Demo Mode (for offline testing)
OTP_DEMO_MODE=true
OTP_DEMO_CODE=123456

# Rate Limiting
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX=100
```

#### Start Backend Server
```bash
cd backend
npm run dev
```

Expected output:
```
PrescoPad API running on port 3000
Environment: development
Health check: http://localhost:3000/api/health
```

#### Verify Backend
Test the health endpoint:
```bash
curl http://localhost:3000/api/health
```

Should return:
```json
{
  "status": "ok",
  "service": "PrescoPad API",
  "version": "2.0.0",
  "timestamp": "2026-02-05T..."
}
```

### 2. Frontend Setup

#### Install Dependencies
```bash
cd frontend
npm install
```

**Note**: If you encounter npm cache issues, run:
```bash
npm cache clean --force
rm -rf node_modules package-lock.json
npm install
```

#### Configuration
The frontend is configured in `frontend/src/constants/config.ts`:

```typescript
api: {
  baseUrl: 'http://localhost:3000/api',  // For emulator
  timeout: 10000,
}
```

**Important for Physical Devices**:
- `localhost` only works in emulator
- For physical devices, use your computer's IP address
- Example: `http://192.168.1.100:3000/api`

#### Start Frontend
```bash
cd frontend
npm start
```

This will start Expo Dev Server. You'll see:
```
Metro waiting on exp://...
› Press a │ open Android
› Press i │ open iOS simulator
› Press w │ open web
```

### 3. Running on Different Platforms

#### Android Emulator
```bash
cd frontend
npm run android
```

- Uses `http://localhost:3000/api` ✓
- No configuration change needed

#### iOS Simulator (macOS only)
```bash
cd frontend
npm run ios
```

- Uses `http://localhost:3000/api` ✓
- No configuration change needed

#### Physical Android/iOS Device
1. **Find Your Computer's IP Address**:
   - Windows: `ipconfig` (look for IPv4 Address)
   - macOS/Linux: `ifconfig` or `ip addr`
   - Example: `192.168.1.100`

2. **Update Frontend Config**:
   Edit `frontend/src/constants/config.ts`:
   ```typescript
   api: {
     baseUrl: 'http://192.168.1.100:3000/api',  // Your IP
     timeout: 10000,
   }
   ```

3. **Ensure Same Network**:
   - Computer and phone must be on same WiFi network
   - Check firewall settings (allow port 3000)

4. **Run App**:
   ```bash
   cd frontend
   npm start
   ```
   - Scan QR code with Expo Go app

## API Endpoints

### Authentication (`/api/auth`)
- `POST /send-otp` - Request OTP for phone number
- `POST /verify-otp` - Verify OTP and get tokens
- `POST /login` - Login with password
- `POST /refresh-token` - Refresh access token
- `GET /me` - Get current user profile
- `PUT /profile` - Update user profile

### Wallet (`/api/wallet`)
- `GET /balance` - Get wallet balance
- `POST /recharge` - Initiate recharge
- `GET /transactions` - Get transaction history
- `POST /deduct` - Deduct credits for prescription

### Clinic (`/api/clinic`)
- `GET /profile` - Get clinic profile
- `PUT /profile` - Update clinic profile

### Notifications (`/api/notifications`)
- `GET /` - Get notifications
- `PUT /:id/read` - Mark notification as read

## Offline Mode

### Demo Authentication
When backend is unavailable:
- **Phone**: `9876543210`
- **OTP**: `123456`
- **Roles**: Doctor or Assistant

The app will:
1. Detect backend is offline (health check fails)
2. Allow demo login with hardcoded credentials
3. Store data locally in SQLite
4. Show "Offline Mode" indicator
5. Sync when backend becomes available

### Data Storage
- **Local Only**: Patient data, prescriptions, medicines, lab tests
- **Cloud + Local**: Auth tokens, wallet balance, clinic profile
- **Cloud Only**: Transactions, notifications

## WebSocket Sync (Device-to-Device)

For multi-device sync within same clinic (over LAN):
- **Port**: 8765
- **Protocol**: WebSocket
- **Pairing**: QR code
- **Data**: Prescriptions, patient updates

This allows a doctor and assistant to sync data in real-time without cloud.

## Troubleshooting

### Backend Issues

#### Database Connection Error
```
Error: connect ECONNREFUSED
```
**Solution**: Check DATABASE_URL in `.env`, ensure Supabase is accessible

#### Port Already in Use
```
Error: listen EADDRINUSE: address already in use :::3000
```
**Solution**: Kill process on port 3000 or change port in `.env`
```bash
# Windows
netstat -ano | findstr :3000
taskkill /PID <PID> /F

# macOS/Linux
lsof -ti:3000 | xargs kill -9
```

### Frontend Issues

#### Cannot Connect to Backend
**Symptoms**: Login fails, shows offline mode immediately

**Solutions**:
1. Verify backend is running: `curl http://localhost:3000/api/health`
2. Check baseUrl in `frontend/src/constants/config.ts`
3. If on physical device, use computer's IP address
4. Check firewall (allow port 3000)
5. Ensure same WiFi network

#### expo-file-system Missing
**Error**: `Cannot find module 'expo-file-system'`

**Solution**:
```bash
cd frontend
npm install expo-file-system@~19.0.21
```

#### SQLite Database Error
**Error**: `SQLite database failed to open`

**Solution**: Clear app data and reinstall
```bash
expo start --clear
```

#### Token Refresh Loop
**Symptoms**: App keeps logging out

**Solutions**:
1. Clear SecureStore tokens
2. Check JWT_SECRET matches between backend .env and any hardcoded values
3. Verify token expiry times

### Network Issues

#### Physical Device Can't Reach Backend
1. **Check IP Address**: Use `ipconfig`/`ifconfig`, update config.ts
2. **Check Firewall**: Allow port 3000
3. **Check WiFi**: Same network for both devices
4. **Test Connection**:
   ```bash
   curl http://<YOUR_IP>:3000/api/health
   ```

#### CORS Errors (Web Only)
Backend already configured with CORS for all origins in development:
```typescript
app.use(cors({
  origin: '*',  // Development only
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));
```

## Testing the Integration

### 1. Backend Health Check
```bash
curl http://localhost:3000/api/health
```

Expected: `{"status":"ok","service":"PrescoPad API",...}`

### 2. Test Authentication Flow
```bash
# Send OTP
curl -X POST http://localhost:3000/api/auth/send-otp \
  -H "Content-Type: application/json" \
  -d '{"phone":"9876543210","role":"DOCTOR"}'

# Verify OTP (demo mode)
curl -X POST http://localhost:3000/api/auth/verify-otp \
  -H "Content-Type: application/json" \
  -d '{"phone":"9876543210","otp":"123456","role":"DOCTOR"}'
```

### 3. Test Wallet Endpoint
```bash
# Get balance (requires token)
curl http://localhost:3000/api/wallet/balance \
  -H "Authorization: Bearer <ACCESS_TOKEN>"
```

### 4. Test Frontend Connection
1. Start backend: `cd backend && npm run dev`
2. Start frontend: `cd frontend && npm start`
3. Open in emulator/device
4. Try login with demo credentials
5. Check if "Online Mode" indicator shows
6. Navigate through app screens

## Production Deployment

### Backend
1. Update `.env`:
   - Change `NODE_ENV=production`
   - Update JWT secrets with strong random values
   - Set `OTP_DEMO_MODE=false`
   - Configure real Razorpay keys
   - Restrict CORS to specific domain

2. Deploy to:
   - Railway, Render, or Heroku (Node.js hosting)
   - Configure PostgreSQL connection
   - Set environment variables
   - Enable SSL

3. Update frontend config:
   ```typescript
   api: {
     baseUrl: 'https://your-backend.railway.app/api',
     timeout: 10000,
   }
   ```

### Frontend
1. Build APK/IPA:
   ```bash
   # Android
   eas build --platform android

   # iOS
   eas build --platform ios
   ```

2. Configure app.json for production:
   - Add proper icons
   - Configure bundle identifier
   - Set version numbers
   - Add permissions

3. Submit to stores:
   - Google Play Store (Android)
   - Apple App Store (iOS)

## Security Considerations

### Development
- Demo OTP mode enabled (insecure, dev only)
- CORS allows all origins
- JWT secrets are placeholder values

### Production Must-Dos
1. ✅ Change all JWT secrets to cryptographically random values
2. ✅ Disable OTP demo mode
3. ✅ Restrict CORS to app domain only
4. ✅ Enable HTTPS/SSL
5. ✅ Rate limit API endpoints (already configured)
6. ✅ Sanitize all user inputs
7. ✅ Enable Helmet security headers (already configured)
8. ✅ Regular security audits
9. ✅ Keep dependencies updated

## Support & Resources

- **Documentation**: `/docs` folder
- **API Routes**: See `backend/src/routes/`
- **Frontend Services**: See `frontend/src/services/`
- **Database Schema**: `backend/src/db/migrations/001_initial.sql`
- **Local DB Schema**: `frontend/src/database/schema.ts`

## Quick Reference

### Start Both Services
```bash
# Terminal 1 - Backend
cd backend && npm run dev

# Terminal 2 - Frontend
cd frontend && npm start
```

### Demo Credentials
- **Phone**: 9876543210
- **OTP**: 123456
- **Role**: Doctor or Assistant

### Default Ports
- Backend API: 3000
- WebSocket Sync: 8765
- Expo Dev Server: 8081 (auto-assigned)

### Health Endpoints
- Backend: `http://localhost:3000/api/health`
- Frontend: Check "Online Mode" indicator in app

---

**Last Updated**: February 2026
**Version**: 2.0.0
