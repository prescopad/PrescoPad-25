# PrescoPad - Architecture Documentation

## System Overview

PrescoPad is an offline-first digital prescription application for small clinics in India. The system consists of two main components:

1. **Mobile App** (React Native + TypeScript) - Primary interface for doctors and assistants
2. **Backend API** (Node.js + Express + PostgreSQL) - Minimal cloud services for auth, wallet, and sync

## Architecture Principles

- **Offline-First**: Local SQLite database is the primary data store. App works 100% without internet.
- **Privacy-First**: Patient medical data NEVER leaves the device. Cloud only stores auth, wallet, and clinic metadata.
- **Role-Based**: Doctor and Assistant have completely separate navigation flows and permissions.
- **Minimal Cloud**: Backend is used only for authentication, wallet management, and transaction logging.

## Tech Stack

| Layer | Technology | Purpose |
|-------|-----------|---------|
| Mobile Framework | React Native 0.81.5 + Expo SDK 54 | Cross-platform mobile app |
| Language | TypeScript | Type safety |
| State Management | Zustand | Lightweight, hook-based state |
| Local Database | expo-sqlite (SQLite) | Offline patient data, prescriptions |
| Cloud Database | PostgreSQL | Auth, wallet, transactions |
| Backend | Express.js | REST API server |
| Auth | JWT + OTP | Token-based authentication |
| PDF | expo-print | Prescription PDF generation |
| Navigation | React Navigation 7 | Role-based navigation |

## Directory Structure

```
Prescopad/
├── frontend/                    # React Native mobile app
│   ├── App.tsx                  # Root component with splash screen
│   ├── index.ts                 # Entry point
│   ├── app.json                 # Expo configuration
│   ├── package.json             # Dependencies
│   ├── tsconfig.json            # TypeScript config
│   ├── assets/                  # Images, icons
│   └── src/
│       ├── types/               # TypeScript interfaces (9 files)
│       ├── constants/           # Theme, config (2 files)
│       ├── database/            # SQLite schema, queries (8 files)
│       ├── store/               # Zustand stores (7 files)
│       ├── services/            # API, PDF, share, sync (9 files)
│       ├── navigation/          # React Navigation setup (4 files)
│       └── screens/             # UI screens (17 files)
│           ├── auth/            # Landing, Login, OTP
│           ├── doctor/          # Dashboard, Consult, Rx flow
│           ├── assistant/       # Queue, Patient management
│           └── shared/          # Wallet, Settings, Pairing
│
├── backend/                     # Node.js API server
│   ├── package.json
│   ├── tsconfig.json
│   ├── .env.example
│   └── src/
│       ├── server.ts            # Express app entry
│       ├── config/              # Database, environment (2 files)
│       ├── middleware/          # Auth, validation (4 files)
│       ├── routes/              # API routes (4 files)
│       ├── controllers/         # Route handlers (4 files)
│       ├── services/            # Business logic (4 files)
│       ├── db/migrations/       # SQL migrations
│       └── utils/               # JWT, hashing (2 files)
│
└── docs/                        # Documentation
```

## Data Flow

### Authentication Flow
```
App Launch → Splash Screen → Check SecureStore for token
  → Token found → Restore session → Role-based navigator
  → No token → Auth Stack → Landing → Login → OTP → Backend verifies → JWT issued → SecureStore
```

### Prescription Flow (Doctor)
```
Queue → Select Patient → Consult Screen → Add Medicines/Tests → Preview
  → Sign & Issue → Check Wallet → Generate PDF → Hash PDF (SHA-256)
  → Finalize in SQLite → Deduct Wallet → Share (WhatsApp/PDF/SMS)
```

### Patient Flow (Assistant)
```
Add Patient → Register in SQLite → Add to Queue → Sync to Doctor via LAN
  → Doctor sees patient in queue → Start consult
```

### Wallet Flow
```
Cloud manages balance → Local cache for offline display
  → On prescription: deduct from cache → sync to cloud when online
  → Block prescription if cache balance = 0
  → Recharge via dummy payment → Cloud credits → Sync to cache
```

## Offline Sync Protocol

Devices sync via WebSocket over local network (same WiFi):

1. **Pairing**: Doctor device shows QR code with IP:PORT. Assistant scans to connect.
2. **Communication**: WebSocket bidirectional messaging.
3. **Message Types**: QUEUE_UPDATE, PATIENT_DATA, DOCTOR_STATUS, PRESCRIPTION_STATUS, PING/PONG
4. **Conflict Resolution**: Doctor device is authoritative (doctor always wins).
5. **Fallback**: If LAN unavailable, assistant pre-fills data locally.

## Security Measures

- JWT tokens stored in expo-secure-store (encrypted)
- PDF integrity verified via SHA-256 hash
- Patient data (PHI) never uploaded to cloud
- API protected with helmet, CORS, rate limiting
- Passwords hashed with bcrypt (12 rounds)
- OTP hashed before storage
