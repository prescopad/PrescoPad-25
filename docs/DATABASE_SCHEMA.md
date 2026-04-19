# PrescoPad - Database Schema Documentation

## Local Database (SQLite)

All patient and prescription data stays on the device. This is the PRIMARY data store.

### doctors
| Column | Type | Description |
|--------|------|-------------|
| id | TEXT PK | Unique identifier |
| name | TEXT | Doctor's full name |
| phone | TEXT | Phone number |
| specialty | TEXT | Medical specialty |
| reg_number | TEXT | Medical registration number |
| signature_base64 | TEXT | Digital signature image (base64) |
| cloud_id | TEXT | Linked cloud user ID |
| created_at | TEXT | ISO timestamp |
| updated_at | TEXT | ISO timestamp |

### assistants
| Column | Type | Description |
|--------|------|-------------|
| id | TEXT PK | Unique identifier |
| name | TEXT | Assistant's full name |
| phone | TEXT | Phone number |
| cloud_id | TEXT | Linked cloud user ID |

### clinic
| Column | Type | Description |
|--------|------|-------------|
| id | TEXT PK | Unique identifier |
| name | TEXT | Clinic name |
| address | TEXT | Full address |
| phone | TEXT | Contact number |
| email | TEXT | Email address |
| logo_base64 | TEXT | Clinic logo (base64) |
| doctor_id | TEXT | Owner doctor's local ID |

### patients
| Column | Type | Description |
|--------|------|-------------|
| id | TEXT PK | Unique identifier |
| name | TEXT | Patient's full name |
| age | INTEGER | Age in years |
| gender | TEXT | male/female/other |
| weight | REAL | Weight in kg (nullable) |
| phone | TEXT | Contact number |
| address | TEXT | Address |
| blood_group | TEXT | A+, A-, B+, B-, AB+, AB-, O+, O- |
| allergies | TEXT | Known allergies |
| created_at | TEXT | ISO timestamp |
| updated_at | TEXT | ISO timestamp |

### queue
| Column | Type | Description |
|--------|------|-------------|
| id | TEXT PK | Unique identifier |
| patient_id | TEXT FK | References patients(id) |
| status | TEXT | waiting/in_progress/completed/cancelled |
| added_by | TEXT | User ID who added |
| notes | TEXT | Additional notes |
| token_number | INTEGER | Daily token number (auto-incremented per day) |
| added_at | TEXT | ISO timestamp |
| started_at | TEXT | When consultation started |
| completed_at | TEXT | When consultation ended |

### prescriptions
| Column | Type | Description |
|--------|------|-------------|
| id | TEXT PK | Format: RX-XXXXXX |
| patient_id | TEXT FK | References patients(id) |
| patient_name | TEXT | Denormalized for PDF |
| patient_age | INTEGER | Denormalized for PDF |
| patient_gender | TEXT | Denormalized for PDF |
| patient_phone | TEXT | Denormalized for PDF |
| doctor_id | TEXT | Doctor's local ID |
| diagnosis | TEXT | Clinical diagnosis |
| advice | TEXT | Additional advice |
| follow_up_date | TEXT | Follow-up date (nullable) |
| pdf_path | TEXT | Local file path to generated PDF |
| pdf_hash | TEXT | SHA-256 hash of PDF |
| signature | TEXT | Digital signature (base64) |
| status | TEXT | draft/finalized |
| wallet_deducted | INTEGER | 0 or 1 |
| created_at | TEXT | ISO timestamp |

### prescription_medicines
| Column | Type | Description |
|--------|------|-------------|
| id | TEXT PK | Unique identifier |
| prescription_id | TEXT FK | References prescriptions(id) CASCADE |
| medicine_name | TEXT | Medicine name |
| type | TEXT | Tablet/Capsule/Syrup/etc. |
| dosage | TEXT | e.g., "500mg" |
| frequency | TEXT | e.g., "1-0-1" |
| duration | TEXT | e.g., "5 days" |
| timing | TEXT | Before Food/After Food/etc. |
| notes | TEXT | Additional instructions |

### prescription_lab_tests
| Column | Type | Description |
|--------|------|-------------|
| id | TEXT PK | Unique identifier |
| prescription_id | TEXT FK | References prescriptions(id) CASCADE |
| test_name | TEXT | Lab test name |
| category | TEXT | Blood/Urine/Imaging/etc. |
| notes | TEXT | Specific instructions |

### medicines (Catalog - 100+ pre-seeded)
| Column | Type | Description |
|--------|------|-------------|
| id | TEXT PK | Unique identifier |
| name | TEXT | Medicine name with strength |
| type | TEXT | Tablet/Capsule/Syrup/Injection/etc. |
| strength | TEXT | Dosage strength |
| manufacturer | TEXT | Pharma company |
| is_custom | INTEGER | 0=predefined, 1=custom |
| usage_count | INTEGER | Frequency of use (for sorting) |

### lab_tests (Catalog - 75+ pre-seeded)
| Column | Type | Description |
|--------|------|-------------|
| id | TEXT PK | Unique identifier |
| name | TEXT | Test name |
| category | TEXT | Blood/Urine/Imaging/Cardiac/etc. |
| is_custom | INTEGER | 0=predefined, 1=custom |
| usage_count | INTEGER | Frequency of use |

### local_wallet_cache
| Column | Type | Description |
|--------|------|-------------|
| id | INTEGER PK | Always 1 (single row) |
| balance | REAL | Cached wallet balance |
| last_synced_at | TEXT | Last cloud sync timestamp |

### sync_log
| Column | Type | Description |
|--------|------|-------------|
| id | TEXT PK | Unique identifier |
| action | TEXT | Action performed |
| entity_type | TEXT | patients/queue/prescriptions |
| entity_id | TEXT | Entity identifier |
| payload | TEXT | JSON data |
| timestamp | TEXT | ISO timestamp |
| synced | INTEGER | 0=pending, 1=synced |

---

## Cloud Database (PostgreSQL)

Cloud stores ONLY auth, wallet, transactions, clinic profiles. NO patient medical data.

### users
| Column | Type | Description |
|--------|------|-------------|
| id | UUID PK | Auto-generated |
| phone | VARCHAR(15) UNIQUE | Phone number |
| role | VARCHAR(20) | doctor/assistant |
| name | VARCHAR(100) | User's name |
| password_hash | VARCHAR(255) | Bcrypt hash |
| otp_hash | VARCHAR(255) | Current OTP hash |
| otp_expires_at | TIMESTAMP | OTP expiry |
| clinic_id | UUID FK | References clinics |
| is_active | BOOLEAN | Account status |
| created_at | TIMESTAMP | Auto-set |
| updated_at | TIMESTAMP | Auto-updated via trigger |

### clinics
| Column | Type | Description |
|--------|------|-------------|
| id | UUID PK | Auto-generated |
| name | VARCHAR(200) | Clinic name |
| address | TEXT | Full address |
| phone | VARCHAR(15) | Contact |
| email | VARCHAR(100) | Email |
| logo_url | VARCHAR(500) | Logo storage URL |
| owner_id | UUID FK | References users |

### wallets
| Column | Type | Description |
|--------|------|-------------|
| id | UUID PK | Auto-generated |
| user_id | UUID FK UNIQUE | One wallet per user |
| balance | DECIMAL(10,2) | Current balance in INR |
| auto_refill | BOOLEAN | Auto-refill enabled |
| auto_refill_amount | DECIMAL(10,2) | Amount to auto-refill |
| auto_refill_threshold | DECIMAL(10,2) | Trigger threshold |

### transactions
| Column | Type | Description |
|--------|------|-------------|
| id | UUID PK | Auto-generated |
| wallet_id | UUID FK | References wallets |
| type | VARCHAR(10) | credit/debit |
| amount | DECIMAL(10,2) | Transaction amount |
| description | VARCHAR(255) | Human-readable description |
| reference_id | VARCHAR(100) | Prescription ID or recharge ID |
| created_at | TIMESTAMP | Auto-set |

### notification_jobs
| Column | Type | Description |
|--------|------|-------------|
| id | UUID PK | Auto-generated |
| user_id | UUID FK | References users |
| type | VARCHAR(50) | low_balance/auto_refill/follow_up |
| payload | JSONB | Job data |
| scheduled_at | TIMESTAMP | When to send |
| sent_at | TIMESTAMP | When actually sent |
| status | VARCHAR(20) | pending/sent/failed |
