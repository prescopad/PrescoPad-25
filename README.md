# PrescoPad 2.0 🏥💊

**Offline-First Digital Prescription Management for Indian Clinics**

PrescoPad is a modern, privacy-focused prescription management system built specifically for Indian medical clinics. It combines the power of cloud connectivity with robust offline capabilities, ensuring doctors and assistants can work seamlessly regardless of internet availability.

## ✨ Key Features

### 🔒 Privacy First
- **Patient data stored locally only** - Never uploaded to cloud
- **Secure authentication** with JWT tokens
- **Role-based access** (Doctor/Assistant)
- **Offline demo mode** for testing

### 💰 Built-in Wallet System
- ₹1 per prescription billing
- Razorpay integration (future)
- Transaction history
- Low balance alerts
- Recharge functionality

### 📱 Device Sync (LAN)
- **QR code pairing** for easy device connection
- **WebSocket sync** over local WiFi
- **Real-time updates** between doctor and assistant devices
- **No internet required** for clinic-internal sync

### 📋 Complete Prescription Management
- Patient database (100+ pre-seeded medicines)
- Lab test templates (75+ common tests)
- PDF generation with SHA-256 verification
- Prescription history
- Search and filter capabilities

### 🚀 Modern Tech Stack
- **Frontend**: React Native (Expo SDK 54) + TypeScript
- **Backend**: Node.js + Express + TypeScript
- **Database**: PostgreSQL (Supabase) + SQLite (local)
- **State**: Zustand stores
- **Auth**: JWT with automatic refresh

## 🎯 Quick Start

### Prerequisites
- Node.js 18+ (v25.6.0 recommended)
- npm or yarn
- Expo Go app (for physical device testing)

### 1. Clone and Install
```bash
# Install backend dependencies
cd backend
npm install

# Install frontend dependencies
cd ../frontend
npm install
```

### 2. Start Development Servers

#### Option A: Automated (Recommended)
```bash
# Windows
start-dev.bat

# macOS/Linux
chmod +x start-dev.sh
./start-dev.sh
```

#### Option B: Manual
```bash
# Terminal 1 - Backend
cd backend
npm run dev

# Terminal 2 - Frontend
cd frontend
npm start
```

### 3. Configure for Physical Device (Optional)
```bash
# Auto-detect and configure your IP
node setup-env.js device

# Or specify manually
node setup-env.js 192.168.1.100
```

### 4. Login with Demo Credentials
- **Phone**: `9876543210`
- **OTP**: `123456`
- **Role**: Doctor or Assistant

## 📚 Documentation

| Document | Description |
|----------|-------------|
| [QUICK_START.md](QUICK_START.md) | Get up and running in 5 minutes |
| [BACKEND_FRONTEND_INTEGRATION.md](docs/BACKEND_FRONTEND_INTEGRATION.md) | Comprehensive integration guide |
| [SYNC_AND_WALLET.md](docs/SYNC_AND_WALLET.md) | Device sync & wallet system details |

## 🏗️ Project Structure

```
PrescoPad/
├── backend/                    # Node.js + Express API
│   ├── src/
│   │   ├── config/            # Environment configuration
│   │   ├── db/                # Database connection & migrations
│   │   ├── middleware/        # Auth, error handling, validation
│   │   ├── routes/            # API endpoints
│   │   ├── controllers/       # Business logic
│   │   ├── services/          # Service layer
│   │   └── server.ts          # Entry point
│   ├── .env                   # Environment variables
│   └── package.json
│
├── frontend/                   # React Native + Expo app
│   ├── src/
│   │   ├── components/        # Reusable UI components
│   │   ├── screens/           # App screens
│   │   ├── navigation/        # Navigation setup
│   │   ├── stores/            # Zustand state management
│   │   ├── services/          # API & business logic
│   │   ├── database/          # SQLite schema & queries
│   │   ├── types/             # TypeScript definitions
│   │   ├── constants/         # App configuration
│   │   └── utils/             # Helper functions
│   ├── App.tsx                # App entry point
│   ├── app.json               # Expo configuration
│   └── package.json
│
├── docs/                       # Documentation
├── setup-env.js                # Environment configuration helper
├── start-dev.bat               # Windows startup script
├── start-dev.sh                # macOS/Linux startup script
└── README.md                   # This file
```

## 🔧 Configuration

### Backend (.env)
```env
PORT=3000
NODE_ENV=development
DATABASE_URL=postgresql://...
JWT_SECRET=your-secret-here
OTP_DEMO_MODE=true
OTP_DEMO_CODE=123456
```

### Frontend (config.ts)
```typescript
api: {
  baseUrl: 'http://localhost:3000/api',  // Emulator
  // baseUrl: 'http://192.168.1.100:3000/api',  // Physical device
  timeout: 10000,
}
```

## 🌐 API Endpoints

### Authentication
- `POST /api/auth/send-otp` - Request OTP
- `POST /api/auth/verify-otp` - Verify OTP & login
- `POST /api/auth/login` - Password login
- `POST /api/auth/refresh-token` - Refresh access token
- `GET /api/auth/me` - Get current user
- `PUT /api/auth/profile` - Update profile

### Wallet
- `GET /api/wallet/balance` - Get balance
- `POST /api/wallet/recharge` - Recharge wallet
- `GET /api/wallet/transactions` - Transaction history
- `POST /api/wallet/deduct` - Deduct for prescription

### Clinic
- `GET /api/clinic/profile` - Get clinic profile
- `PUT /api/clinic/profile` - Update clinic profile

### Notifications
- `GET /api/notifications` - Get notifications
- `PUT /api/notifications/:id/read` - Mark as read

## 🧪 Testing

### Backend Health Check
```bash
curl http://localhost:3000/api/health
```

### Test Authentication
```bash
# Send OTP
curl -X POST http://localhost:3000/api/auth/send-otp \
  -H "Content-Type: application/json" \
  -d '{"phone":"9876543210","role":"doctor"}'

# Verify OTP
curl -X POST http://localhost:3000/api/auth/verify-otp \
  -H "Content-Type: application/json" \
  -d '{"phone":"9876543210","otp":"123456","role":"doctor"}'
```

## 🐛 Troubleshooting

### Backend won't start
```bash
# Windows - Kill process on port 3000
netstat -ano | findstr :3000
taskkill /PID <PID> /F

# macOS/Linux
lsof -ti:3000 | xargs kill -9
```

### Frontend can't connect
1. Verify backend is running: `curl http://localhost:3000/api/health`
2. For physical device: Use computer's IP (not localhost)
3. Check firewall: Allow port 3000
4. Ensure same WiFi network

### npm install fails
```bash
cd frontend
npm cache clean --force
rm -rf node_modules package-lock.json
npm install
```

## 📊 Data Storage Strategy

| Data Type | Storage Location | Reason |
|-----------|-----------------|--------|
| Patient Records | Local SQLite | Privacy - never leave device |
| Prescriptions | Local SQLite | Privacy & offline access |
| Medicines Database | Local SQLite | Offline functionality |
| Lab Tests | Local SQLite | Offline functionality |
| Auth Tokens | SecureStore | Security |
| Wallet Balance | Cloud + Cache | Billing requires sync |
| Transactions | Cloud | Audit trail |
| Clinic Profile | Cloud + Cache | Multi-device sync |

## 🚀 Production Deployment

### Backend Hosting
- Railway, Render, or Heroku
- Set production environment variables
- Disable OTP demo mode
- Use strong JWT secrets
- Enable SSL/HTTPS

### Frontend Build
```bash
# Android APK
eas build --platform android

# iOS IPA
eas build --platform ios
```

### Pre-Production Checklist
- [ ] Update JWT secrets
- [ ] Disable OTP_DEMO_MODE
- [ ] Configure Razorpay keys
- [ ] Restrict CORS origins
- [ ] Enable rate limiting
- [ ] Set up monitoring
- [ ] Configure error tracking
- [ ] Update API baseUrl in frontend

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## 📄 License

This project is private and proprietary.

## 🔐 Security

- Never commit `.env` files
- Rotate JWT secrets regularly
- Use environment variables for secrets
- Enable HTTPS in production
- Regular dependency updates
- Security audit logs

## 💡 Features Roadmap

- [ ] SMS OTP integration
- [ ] Razorpay payment gateway
- [ ] Advanced analytics dashboard
- [ ] Multi-clinic support
- [ ] Template prescriptions
- [ ] Voice-to-text prescription entry
- [ ] Patient appointment scheduling
- [ ] Inventory management
- [ ] Report generation

## 📞 Support

For issues, questions, or feature requests:
- Check [QUICK_START.md](QUICK_START.md)
- Review [BACKEND_FRONTEND_INTEGRATION.md](docs/BACKEND_FRONTEND_INTEGRATION.md)
- Check troubleshooting section above

## 👏 Acknowledgments

Built with modern web technologies for the Indian healthcare ecosystem.

---

**Version**: 2.0.0
**Last Updated**: February 2026
**Status**: Development Ready ✅