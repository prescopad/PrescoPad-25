# PrescoPad - Sync Logic & Wallet System

## Offline Sync Protocol

### Overview
PrescoPad uses WebSocket over LAN for real-time sync between doctor and assistant devices on the same WiFi network.

### Pairing Process
1. Doctor opens "Pair Device" screen
2. App generates QR code containing: `{ deviceId, deviceName, ipAddress, port, role, clinicId }`
3. Assistant scans QR code from their device
4. Assistant's device connects to Doctor's WebSocket server
5. Devices exchange PING/PONG to confirm connection

### Message Types
```typescript
enum SyncAction {
  QUEUE_UPDATE       // Queue was modified (add/remove/status change)
  PATIENT_DATA       // New patient registered or updated
  DOCTOR_STATUS      // Doctor ready/busy indicator
  PRESCRIPTION_STATUS // Prescription completed notification
  PING / PONG        // Connection heartbeat (every 5 seconds)
}
```

### Sync Flow
```
ASSISTANT                          DOCTOR
   │                                 │
   ├── Register Patient ────────────►│ PATIENT_DATA
   │                                 │
   ├── Add to Queue ───────────────►│ QUEUE_UPDATE
   │                                 │
   │◄──────────── Doctor Ready ──────┤ DOCTOR_STATUS
   │                                 │
   │◄──────── Consult Started ───────┤ QUEUE_UPDATE
   │                                 │
   │◄──────── Rx Completed ──────────┤ PRESCRIPTION_STATUS
   │                                 │
```

### Conflict Resolution
- **Doctor always wins**: If both devices modify the same queue item, doctor's version takes precedence
- **Timestamp-based**: sync_log tracks all changes with timestamps
- **Offline queue**: Changes made while disconnected are stored in sync_log and replayed on reconnect

### Fallback (No LAN)
If devices are not on the same WiFi:
1. Assistant registers patient locally
2. Doctor can search patients in local DB
3. Queue management is done on each device independently
4. No real-time sync, but both can operate independently

---

## Wallet System

### Architecture
```
                  ┌─────────────┐
                  │  Cloud DB   │
                  │  (PostgreSQL)│
                  │  wallets    │
                  │  transactions│
                  └──────┬──────┘
                         │
                    REST API
                         │
              ┌──────────┴──────────┐
              │                     │
    ┌─────────┴─────────┐ ┌────────┴────────┐
    │  Doctor Device     │ │ Local Cache     │
    │  Wallet Screen     │ │ (SQLite)        │
    │  Recharge UI       │ │ balance + sync  │
    └───────────────────┘ └─────────────────┘
```

### Rules
1. **Cloud is source of truth** for balance
2. **Local cache** allows offline display and deduction
3. **Cost**: Rs 1 per prescription
4. **Block**: Cannot finalize prescription if balance = 0
5. **Sync**: On app launch and after each transaction, sync with cloud

### Prescription Deduction Flow
```
1. Doctor taps "Sign & Issue"
2. Check local_wallet_cache.balance >= 1
   → NO: Alert "Insufficient balance. Please recharge."
   → YES: Continue
3. Generate PDF (expo-print)
4. Hash PDF (SHA-256)
5. Finalize prescription in SQLite
6. Deduct from local cache (balance - 1)
7. Queue cloud deduction (POST /api/wallet/deduct)
   → Online: Immediate deduction + sync balance
   → Offline: Log to sync_log, sync later
8. Navigate to success screen
```

### Recharge Flow
```
1. Doctor selects amount (₹100/₹500/₹1000/Custom)
2. POST /api/wallet/recharge { amount }
3. Backend creates payment order (dummy → instant credit)
4. Backend credits wallet + creates transaction record
5. Response: new balance + transaction ID
6. Update local_wallet_cache
7. Display updated balance
```

### Auto-Refill
```
1. Doctor configures: threshold (₹10), amount (₹500)
2. On each deduction, backend checks: balance <= threshold?
3. If yes → creates notification_job for auto_refill
4. In production: auto-trigger Razorpay payment
5. Current (demo): notification only, manual recharge
```

### Razorpay Integration (Production)
The backend has a Razorpay-ready architecture:
- `payment.service.ts` has placeholder methods for:
  - `createPaymentOrder()` → Razorpay order creation
  - `verifyPayment()` → Signature verification
  - `processRefund()` → Refund processing
- Replace dummy implementations with Razorpay SDK calls
- Frontend needs Razorpay React Native SDK for checkout UI

---

## Security Measures

### Data Privacy
- Patient data (PHI) is stored ONLY in local SQLite
- Cloud database has NO patient tables
- API routes don't accept patient data
- PDF files stored only on device

### Authentication
- JWT access tokens (7-day expiry)
- JWT refresh tokens (30-day expiry)
- Tokens stored in expo-secure-store (encrypted)
- OTP hashed with bcrypt before storage
- Auto token refresh on 401 response

### PDF Integrity
- Each prescription PDF is hashed with SHA-256
- Hash stored in local DB with prescription record
- Optional: QR code on PDF contains hash for verification
- Tamper detection: re-hash PDF and compare

### API Security
- Helmet.js for HTTP security headers
- CORS configured
- Rate limiting (100 req/15 min per IP)
- Input validation on all endpoints
- Role-based access control (Doctor-only routes)
- SQL injection prevention via parameterized queries
