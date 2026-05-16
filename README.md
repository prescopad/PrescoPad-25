# PrescoPad 2.0

A clinic management app for doctors and assistants — handles patient queues, prescriptions, wallet billing, and AI-powered consultation recording. Built with React Native (Expo) on the frontend and Python FastAPI on the backend, using MongoDB Atlas as the cloud database.

---

## Table of Contents

- [Features](#features)
- [Tech Stack](#tech-stack)
- [Project Structure](#project-structure)
- [Getting Started](#getting-started)
- [Environment Variables](#environment-variables)
- [Backend API Reference](#backend-api-reference)
- [Database Schema](#database-schema)
- [Frontend Architecture](#frontend-architecture)
- [AI Transcription Feature](#ai-transcription-feature)
- [Roles & Access](#roles--access)
- [Build & Deployment](#build--deployment)

---

## Features

- **Patient Queue Management** — assistants add patients, doctors consult in order
- **Digital Prescriptions** — medicines, lab tests, diagnosis, advice, follow-up date
- **PDF Generation & Sharing** — generate prescription PDF and share via WhatsApp
- **Wallet Billing** — ₹1 deducted per prescription; recharge via admin
- **Doctor–Assistant Linking** — doctor shares a code; assistant joins the clinic
- **Custom Medicine & Lab Test Database** — per-clinic custom entries on top of the seeded 500+ medicines
- **Analytics Dashboard** — prescription count, revenue, top medicines, patient trends
- **AI Consultation Recording** — record the doctor–patient conversation, auto-transcribe via Groq Whisper, extract diagnosis/medicines/lab tests via LLaMA, and auto-fill the prescription form
- **Transcript History** — per-patient searchable transcript archive with diarized speaker segments
- **Offline-first local data** — SQLite on device for medicines and prescriptions
- **OTP + Password Authentication** — phone-based OTP login with demo mode for development

---

## Tech Stack

| Layer | Technology |
|---|---|
| Mobile frontend | React Native 0.81, Expo ~54, TypeScript 5.9 |
| State management | Zustand 5 |
| Local database | Expo SQLite (WAL mode) |
| Navigation | React Navigation 7 (stack + bottom tabs) |
| HTTP client | Axios with JWT interceptor |
| Token storage | Expo SecureStore |
| Backend framework | FastAPI 0.115, Python 3.13 |
| Async DB driver | Motor 3.5 (AsyncIOMotorClient) |
| Cloud database | MongoDB Atlas |
| Authentication | JWT (python-jose) + bcrypt (passlib) |
| AI transcription | Groq API — Whisper large-v3-turbo + LLaMA 4 Scout |
| Audio recording | expo-av |
| PDF & sharing | expo-print, expo-sharing |
| TLS/SSL | certifi (required for Python 3.13 + Atlas) |

---

## Project Structure

```
PrescoPad-25/
├── frontend/                        # Expo React Native app
│   ├── src/
│   │   ├── screens/
│   │   │   ├── auth/                # Landing, Login, OTP, Registration
│   │   │   ├── doctor/              # Dashboard, Consult, AITranscription,
│   │   │   │                        # TranscriptHistory, MedicinePicker,
│   │   │   │                        # LabTestPicker, PrescriptionPreview,
│   │   │   │                        # RxSuccess, PatientHistory, Analytics
│   │   │   ├── assistant/           # Dashboard, AddPatient, PatientSearch,
│   │   │   │                        # PatientDetail
│   │   │   ├── shared/              # PatientForm, PrescriptionView, Wallet,
│   │   │   │                        # Settings, ClinicProfile, Connection
│   │   │   └── settings/            # MedicineTestManagement
│   │   ├── navigation/
│   │   │   ├── RootNavigator.tsx    # Auth check → role-based routing
│   │   │   ├── AuthStack.tsx
│   │   │   ├── DoctorTabNavigator.tsx
│   │   │   └── AssistantTabNavigator.tsx
│   │   ├── store/
│   │   │   ├── useAuthStore.ts
│   │   │   ├── usePrescriptionStore.ts
│   │   │   ├── usePatientStore.ts
│   │   │   ├── useClinicStore.ts
│   │   │   ├── useWalletStore.ts
│   │   │   ├── useQueueStore.ts
│   │   │   └── useAnalyticsStore.ts
│   │   ├── services/
│   │   │   ├── api.ts               # Axios instance + token refresh interceptor
│   │   │   ├── authService.ts
│   │   │   ├── dataService.ts
│   │   │   ├── transcriptionService.ts
│   │   │   ├── walletService.ts
│   │   │   ├── pdfService.ts
│   │   │   ├── shareService.ts
│   │   │   ├── connectionService.ts
│   │   │   └── analyticsService.ts
│   │   ├── database/
│   │   │   ├── database.ts          # SQLite init, schema, migrations
│   │   │   └── seed.ts              # 500+ medicines, lab test templates
│   │   ├── types/                   # TypeScript interfaces
│   │   └── constants/
│   │       ├── config.ts            # Backend URL, wallet limits, OTP config
│   │       └── theme.ts             # Colors, spacing, shadows, typography
│   ├── App.tsx
│   ├── app.config.ts
│   ├── eas.json
│   └── package.json
│
├── backend_python/                  # FastAPI backend
│   ├── app/
│   │   ├── main.py                  # FastAPI app, CORS, lifespan
│   │   ├── config/
│   │   │   ├── settings.py          # Pydantic Settings (reads .env)
│   │   │   └── database.py          # Motor connection + index creation
│   │   ├── routes/
│   │   │   ├── auth.py
│   │   │   ├── data.py              # Patients, prescriptions, queue
│   │   │   ├── wallet.py
│   │   │   ├── clinic.py
│   │   │   ├── connection.py
│   │   │   ├── notification.py
│   │   │   ├── analytics.py
│   │   │   └── transcription.py
│   │   ├── services/
│   │   │   ├── auth_service.py
│   │   │   ├── data_service.py
│   │   │   ├── wallet_service.py
│   │   │   ├── clinic_service.py
│   │   │   ├── connection_service.py
│   │   │   ├── notification_service.py
│   │   │   ├── analytics_service.py
│   │   │   └── transcription_service.py
│   │   ├── models/                  # Pydantic request/response schemas
│   │   │   ├── user.py
│   │   │   ├── data.py
│   │   │   ├── wallet.py
│   │   │   ├── clinic.py
│   │   │   ├── connection.py
│   │   │   └── common.py
│   │   ├── middleware/
│   │   │   └── auth.py              # JWT verification, get_current_user()
│   │   └── utils/
│   │       ├── jwt.py
│   │       ├── hash.py
│   │       ├── otp.py
│   │       └── response.py
│   ├── main.py                      # Uvicorn entry point
│   ├── requirements.txt
│   └── .env                         # Not committed — see Environment Variables
│
├── docs/
│   ├── API_SPEC.md
│   ├── ARCHITECTURE.md
│   ├── BACKEND_FRONTEND_INTEGRATION.md
│   ├── DATABASE_SCHEMA.md
│   └── SYNC_AND_WALLET.md
├── medical_transcriber.py           # Standalone transcription utility
└── README.md
```

---

## Getting Started

### Prerequisites

- Python 3.10+ (3.13 recommended)
- Node.js 18+ and npm
- MongoDB Atlas cluster (or local MongoDB)
- Expo Go app on your phone (for development)

### 1 — Backend Setup

```bash
cd backend_python

# Create and activate virtual environment
python -m venv .venv

# Windows (PowerShell)
.\.venv\Scripts\Activate.ps1
# macOS / Linux
source .venv/bin/activate

# Install dependencies
python -m pip install -r requirements.txt

# Create .env file (see Environment Variables section below)
copy .env.example .env   # Windows
cp .env.example .env     # macOS/Linux

# Start the server
python -m uvicorn app.main:app --host 0.0.0.0 --port 3000 --reload
```

API is now running at `http://localhost:3000`. Health check: `GET /api/health`.

### 2 — Frontend Setup

```bash
cd frontend

# Install dependencies
npm install

# Start Expo dev server
npx expo start
```

Scan the QR code with Expo Go (Android) or the Camera app (iOS). For physical device testing, the app auto-detects your LAN IP — make sure your phone and computer are on the same Wi-Fi network.

---

## Environment Variables

Create `backend_python/.env` with the following:

```env
# Server
PORT=3000
NODE_ENV=development

# MongoDB Atlas
MONGODB_URI=mongodb+srv://<user>:<password>@<cluster>.mongodb.net/?appName=<AppName>
MONGODB_DB_NAME=prescopad

# JWT
JWT_SECRET=change-this-in-production
JWT_EXPIRES_IN=7
JWT_REFRESH_SECRET=change-this-refresh-secret
JWT_REFRESH_EXPIRES_IN=30

# OTP
OTP_DEMO_MODE=true       # set false in production (uses Fast2SMS)
OTP_DEMO_CODE=123456
FAST2SMS_API_KEY=        # required when OTP_DEMO_MODE=false

# CORS (comma-separated origins, leave empty to allow all in dev)
ALLOWED_ORIGINS=

# Groq AI — required for AI Consultation Recording feature
GROQ_API_KEY=your_groq_api_key_here
```

> **Never commit `.env` to version control.**

---

## Backend API Reference

Base URL: `http://<server-ip>:3000`

All protected routes require `Authorization: Bearer <access_token>` header.

### Auth — `/api/auth`

| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/send-otp` | No | Send OTP to phone number |
| POST | `/verify-otp` | No | Verify OTP, returns tokens + user |
| POST | `/login` | No | Phone + password login |
| POST | `/refresh-token` | No | Refresh access token |
| GET | `/me` | Yes | Get current user profile |
| POST | `/complete-registration` | Yes | Set name, role, PIN |
| PUT | `/profile` | Yes | Update profile fields |

### Data — `/api/data`

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/patients` | Yes | List clinic patients |
| POST | `/patients` | Yes | Create patient |
| PUT | `/patients/:id` | Yes | Update patient |
| GET | `/queue` | Yes | Get current queue |
| POST | `/queue` | Yes | Add patient to queue |
| DELETE | `/queue/:id` | Yes | Remove from queue |
| POST | `/prescriptions` | Yes | Save prescription (deducts wallet) |
| GET | `/prescriptions/patient/:id` | Yes | Patient prescription history |
| GET | `/medicines/custom` | Yes | Clinic's custom medicines |
| POST | `/medicines/custom` | Yes | Add custom medicine |
| GET | `/lab-tests/custom` | Yes | Clinic's custom lab tests |
| POST | `/lab-tests/custom` | Yes | Add custom lab test |

### Wallet — `/api/wallet`

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/` | Yes | Get wallet balance + transactions |
| POST | `/recharge` | Yes | Add balance (admin) |

### Clinic — `/api/clinic`

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/` | Yes | Get clinic profile |
| PUT | `/` | Yes | Update clinic profile |

### Connection — `/api/connection`

| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/invite` | Yes | Doctor invites assistant (by phone) |
| POST | `/join` | Yes | Assistant joins clinic (by doctor code) |
| GET | `/members` | Yes | List clinic members |
| DELETE | `/members/:id` | Yes | Remove member |

### Transcription — `/api/transcription`

| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/analyze` | Yes (Doctor) | Upload audio, returns auto-fill data + transcript |
| GET | `/patient/:patient_id` | Yes | All transcripts for a patient |
| GET | `/:transcript_id` | Yes | Single transcript detail |

### Analytics — `/api/analytics`

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/summary` | Yes | Prescription count, revenue, trends |
| GET | `/medicines` | Yes | Top prescribed medicines |

### Health

| Method | Path | Description |
|---|---|---|
| GET | `/api/health` | Server status and version |

---

## Database Schema

MongoDB Atlas — database: `prescopad`

| Collection | Key Indexes |
|---|---|
| `users` | `phone` (unique), `doctor_code` (sparse), `clinic_id` |
| `clinics` | `owner_id` |
| `wallets` | `user_id` (unique) |
| `transactions` | `wallet_id`, `created_at` |
| `patients` | `clinic_id`, `(clinic_id, name)` |
| `prescriptions` | `clinic_id`, `patient_id`, `doctor_id`, `created_at` |
| `queue` | `clinic_id`, `patient_id`, `(clinic_id, added_at)` |
| `connection_requests` | `(doctor_id, assistant_id)`, `clinic_id` |
| `custom_medicines` | `(clinic_id, name)` unique |
| `custom_lab_tests` | `(clinic_id, name)` unique |
| `notification_jobs` | `user_id`, `status` |
| `transcripts` | `clinic_id`, `patient_id`, `doctor_id`, `(clinic_id, patient_id)`, `created_at` |

---

## Frontend Architecture

### Role-based Navigation

```
App
└── RootNavigator
    ├── AuthStack          (not logged in)
    │   ├── Landing
    │   ├── Login
    │   ├── OTP
    │   └── Registration
    ├── DoctorTabNavigator (role = doctor)
    │   ├── Queue Stack
    │   │   ├── DoctorDashboard
    │   │   ├── Consult
    │   │   ├── MedicinePicker
    │   │   ├── LabTestPicker
    │   │   ├── PrescriptionPreview
    │   │   ├── RxSuccess
    │   │   ├── PatientHistory
    │   │   ├── AITranscription      ← AI Recording feature
    │   │   ├── TranscriptHistory
    │   │   ├── EditPatient
    │   │   └── Connection
    │   ├── Wallet
    │   ├── Analytics
    │   └── Settings Stack
    │       ├── Settings
    │       ├── ClinicProfile
    │       ├── ConnectionSettings
    │       └── MedicineTestManagement
    └── AssistantTabNavigator (role = assistant)
        ├── Queue Stack
        │   ├── AssistantDashboard
        │   ├── AddPatient
        │   ├── PatientSearch
        │   └── PatientDetail
        └── Settings Stack
```

### State Management (Zustand)

Each store is domain-scoped and persists tokens in SecureStore:

- **useAuthStore** — current user, access/refresh tokens, login/logout
- **usePrescriptionStore** — active draft (medicines, lab tests, diagnosis, advice, follow-up date), history
- **usePatientStore** — patient list cache
- **useClinicStore** — clinic info + member list
- **useWalletStore** — balance, transaction history
- **useQueueStore** — live queue, add/remove
- **useAnalyticsStore** — summary stats and charts data

### API Contract

The Python backend returns `snake_case` fields. All services normalize responses to `camelCase` for the TypeScript layer. The `api.ts` Axios instance handles automatic token refresh on 401 responses.

---

## AI Transcription Feature

**Flow:**

1. Doctor opens a patient's consultation → taps **AI Consultation Recording**
2. Sets recording duration (3 / 5 / 10 / 15 min) then taps **Start Recording**
3. Records the doctor–patient conversation via device microphone (`expo-av`)
4. Controls available during recording:
   - **Pause / Resume**
   - **+1 min** / **+2 min** time extension (capped at 30 min)
   - **Discard** (cancels and deletes audio)
   - **Stop & Analyze** (sends audio to backend)
5. Backend pipeline:
   - `POST /api/transcription/analyze` receives the audio file (multipart)
   - **Groq Whisper** (`whisper-large-v3-turbo`) transcribes the audio
   - **Groq LLaMA 4 Scout** diarizes segments into Doctor / Patient speakers
   - **Groq LLaMA 4 Scout** extracts structured medical data: diagnosis, prescribed medicines (name, dose, frequency, duration), lab tests, advice, follow-up date
   - Transcript + extraction saved to `transcripts` collection
   - Returns `prescription_autofill` object
6. Frontend auto-fills the prescription draft (medicines, lab tests, diagnosis, advice, follow-up date) and navigates back to the Consult screen
7. Doctor reviews, edits if needed, and saves as usual

**Transcript History** — accessible from any patient's history view; shows all past transcripts with expandable cards, diarized speaker segments, and extracted medical summary.

---

## Roles & Access

| Feature | Doctor | Assistant |
|---|---|---|
| View patient queue | Yes | Yes |
| Add patient to queue | No | Yes |
| Start consultation | Yes | No |
| Write prescription | Yes | No |
| AI Consultation Recording | Yes | No |
| View transcript history | Yes | No |
| View analytics | Yes | No |
| Manage clinic profile | Yes | No |
| View wallet | Yes | Yes |
| Invite / remove members | Yes | No |

---

## Build & Deployment

### EAS Build (Expo Application Services)

```bash
cd frontend

# Install EAS CLI
npm install -g eas-cli

# Login
eas login

# Build Android APK (development)
eas build --platform android --profile development

# Build Android APK (production)
eas build --platform android --profile production
```

EAS project ID is configured in `app.config.ts`. Build profiles are defined in `eas.json`.

### Backend Deployment

The FastAPI backend can be deployed to any Python-capable host (Railway, Render, VPS, etc.):

```bash
# Production start (no --reload)
python -m uvicorn app.main:app --host 0.0.0.0 --port 3000 --workers 2
```

Set all environment variables on the host. Make sure `OTP_DEMO_MODE=false` and real JWT secrets are used in production.

### Important Notes

- Set `ALLOWED_ORIGINS` in production to your app's domain / bundle ID
- MongoDB Atlas IP Access List must include your server's IP (or `0.0.0.0/0` for dev)
- Python 3.13 requires `certifi` for TLS — it is included in `requirements.txt`
- The frontend auto-detects the backend LAN IP in development; set `BACKEND_URL` env var for production builds

---

## Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/your-feature`
3. Make changes and test locally (run backend + Expo)
4. Open a pull request against `main`

Do not commit `.env` files, secrets, or build artifacts.

---

*Last updated: May 2026*
