# PrescoPad - API Specification

## Base URL
```
http://localhost:3000/api
```

## Authentication
All protected endpoints require a Bearer token in the Authorization header:
```
Authorization: Bearer <access_token>
```

---

## Health Check

### GET /api/health
Returns server status.

**Response:**
```json
{
  "status": "ok",
  "service": "PrescoPad API",
  "version": "2.0.0",
  "timestamp": "2026-02-05T10:00:00.000Z"
}
```

---

## Auth Routes

### POST /api/auth/send-otp
Send OTP to phone number. Auto-registers new users.

**Body:**
```json
{
  "phone": "9876543210",
  "role": "doctor"
}
```

**Response:**
```json
{
  "success": true,
  "message": "OTP sent to 9876543210",
  "otp": "123456"  // Only in demo mode
}
```

### POST /api/auth/verify-otp
Verify OTP and get auth tokens.

**Body:**
```json
{
  "phone": "9876543210",
  "otp": "123456",
  "role": "doctor"
}
```

**Response:**
```json
{
  "success": true,
  "user": {
    "id": "uuid",
    "phone": "9876543210",
    "name": "Doctor",
    "role": "doctor",
    "clinicId": ""
  },
  "accessToken": "jwt_token",
  "refreshToken": "jwt_refresh_token"
}
```

### POST /api/auth/login
Password-based login. First login sets the password.

**Body:**
```json
{
  "phone": "9876543210",
  "password": "mypassword",
  "role": "doctor"
}
```

### POST /api/auth/refresh-token
Refresh an expired access token.

**Body:**
```json
{
  "refreshToken": "jwt_refresh_token"
}
```

**Response:**
```json
{
  "success": true,
  "accessToken": "new_jwt_token"
}
```

### GET /api/auth/me (Protected)
Get current user profile.

### PUT /api/auth/profile (Protected)
Update user name or phone.

**Body:**
```json
{
  "name": "Dr. Sharma"
}
```

---

## Wallet Routes (All Protected)

### GET /api/wallet
Get wallet balance and settings.

**Response:**
```json
{
  "success": true,
  "wallet": {
    "balance": 248.00,
    "autoRefill": false,
    "autoRefillAmount": 500.00,
    "autoRefillThreshold": 10.00
  }
}
```

### POST /api/wallet/recharge (Doctor only)
Add funds to wallet. Uses dummy payment gateway.

**Body:**
```json
{
  "amount": 500
}
```

**Response:**
```json
{
  "success": true,
  "balance": 748.00,
  "transactionId": "uuid",
  "orderId": "order_xxx"
}
```

### POST /api/wallet/deduct (Doctor only)
Deduct amount for prescription.

**Body:**
```json
{
  "amount": 1,
  "description": "Prescription Fee (RX-123456)",
  "referenceId": "RX-123456"
}
```

**Response:**
```json
{
  "success": true,
  "balance": 247.00,
  "transactionId": "uuid"
}
```

**Error (402):**
```json
{
  "error": "Insufficient balance"
}
```

### GET /api/wallet/transactions
Get transaction history.

**Query params:** `?limit=50&offset=0`

**Response:**
```json
{
  "success": true,
  "transactions": [
    {
      "id": "uuid",
      "type": "debit",
      "amount": 1.00,
      "description": "Prescription Fee (RX-123456)",
      "referenceId": "RX-123456",
      "createdAt": "2026-02-05T10:00:00.000Z"
    }
  ]
}
```

### PUT /api/wallet/auto-refill (Doctor only)
Configure auto-refill settings.

**Body:**
```json
{
  "autoRefill": true,
  "autoRefillAmount": 500,
  "autoRefillThreshold": 10
}
```

---

## Clinic Routes (All Protected)

### GET /api/clinic
Get clinic details.

### PUT /api/clinic (Doctor only)
Create or update clinic.

**Body:**
```json
{
  "name": "City Care Clinic",
  "address": "123 Main St, Mumbai",
  "phone": "9876543210",
  "email": "clinic@email.com"
}
```

---

## Notification Routes (All Protected)

### GET /api/notifications
Get pending notifications.

### PUT /api/notifications/:id/read
Mark notification as read.

---

## Error Responses

All errors follow this format:
```json
{
  "error": "Error message",
  "details": ["Validation detail 1", "Validation detail 2"]  // Optional
}
```

| Status Code | Meaning |
|------------|---------|
| 400 | Bad Request / Validation Error |
| 401 | Unauthorized / Invalid Token |
| 402 | Payment Required / Insufficient Balance |
| 403 | Forbidden / Insufficient Permissions |
| 404 | Not Found |
| 429 | Rate Limited |
| 500 | Internal Server Error |

---

## Rate Limiting

- Default: 100 requests per 15 minutes per IP
- Configurable via environment variables
