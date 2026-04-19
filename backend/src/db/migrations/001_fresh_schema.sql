-- PrescoPad Fresh Schema v3.0
-- Consolidated migration for online-only architecture

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =========================================================================
-- TRIGGER FUNCTION
-- =========================================================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- =========================================================================
-- DOCTOR CODE GENERATOR
-- =========================================================================
CREATE OR REPLACE FUNCTION generate_doctor_code()
RETURNS TEXT AS $$
DECLARE
    chars TEXT := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    code TEXT := '';
    i INTEGER;
BEGIN
    LOOP
        code := '';
        FOR i IN 1..6 LOOP
            code := code || substr(chars, floor(random() * length(chars) + 1)::int, 1);
        END LOOP;
        EXIT WHEN NOT EXISTS (SELECT 1 FROM users WHERE doctor_code = code);
    END LOOP;
    RETURN code;
END;
$$ LANGUAGE plpgsql;

-- =========================================================================
-- USERS
-- =========================================================================
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    phone VARCHAR(15) NOT NULL UNIQUE,
    role VARCHAR(20) NOT NULL CHECK (role IN ('doctor', 'assistant')),
    name VARCHAR(100) NOT NULL DEFAULT '',
    specialty VARCHAR(100) DEFAULT '',
    reg_number VARCHAR(100) DEFAULT '',
    doctor_code VARCHAR(6) UNIQUE,
    password_hash VARCHAR(255),
    otp_hash VARCHAR(255),
    otp_expires_at TIMESTAMP WITH TIME ZONE,
    clinic_id UUID,
    is_profile_complete BOOLEAN DEFAULT false,
    is_active BOOLEAN DEFAULT true,
    last_active_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =========================================================================
-- CLINICS
-- =========================================================================
CREATE TABLE IF NOT EXISTS clinics (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(200) NOT NULL DEFAULT 'My Clinic',
    address TEXT DEFAULT '',
    phone VARCHAR(15) DEFAULT '',
    email VARCHAR(100) DEFAULT '',
    logo_url VARCHAR(500) DEFAULT '',
    owner_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- FK from users to clinics (added after clinics exists)
DO $$ BEGIN
    ALTER TABLE users ADD CONSTRAINT fk_users_clinic
        FOREIGN KEY (clinic_id) REFERENCES clinics(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- =========================================================================
-- CONNECTION REQUESTS
-- =========================================================================
CREATE TABLE IF NOT EXISTS connection_requests (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    clinic_id UUID NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
    doctor_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    assistant_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    initiated_by VARCHAR(20) NOT NULL CHECK (initiated_by IN ('doctor', 'assistant')),
    status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Only one pending request per doctor-assistant pair at a time
CREATE UNIQUE INDEX IF NOT EXISTS uq_pending_connection
    ON connection_requests(doctor_id, assistant_id) WHERE status = 'pending';

-- =========================================================================
-- WALLETS
-- =========================================================================
CREATE TABLE IF NOT EXISTS wallets (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
    balance DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
    auto_refill BOOLEAN DEFAULT false,
    auto_refill_amount DECIMAL(10, 2) DEFAULT 500.00,
    auto_refill_threshold DECIMAL(10, 2) DEFAULT 10.00,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =========================================================================
-- TRANSACTIONS
-- =========================================================================
CREATE TABLE IF NOT EXISTS transactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    wallet_id UUID NOT NULL REFERENCES wallets(id) ON DELETE CASCADE,
    type VARCHAR(10) NOT NULL CHECK (type IN ('credit', 'debit')),
    amount DECIMAL(10, 2) NOT NULL,
    description VARCHAR(255) NOT NULL DEFAULT '',
    reference_id VARCHAR(100) DEFAULT '',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =========================================================================
-- NOTIFICATION JOBS
-- =========================================================================
CREATE TABLE IF NOT EXISTS notification_jobs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    type VARCHAR(50) NOT NULL,
    payload JSONB DEFAULT '{}',
    scheduled_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    sent_at TIMESTAMP WITH TIME ZONE,
    status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'failed')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =========================================================================
-- PATIENTS
-- =========================================================================
CREATE TABLE IF NOT EXISTS patients (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    clinic_id UUID NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    age INTEGER NOT NULL,
    gender TEXT NOT NULL DEFAULT 'male',
    weight REAL,
    phone TEXT DEFAULT '',
    address TEXT DEFAULT '',
    blood_group TEXT DEFAULT '',
    allergies TEXT DEFAULT '',
    is_deleted BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =========================================================================
-- PRESCRIPTIONS
-- =========================================================================
CREATE TABLE IF NOT EXISTS prescriptions (
    id TEXT PRIMARY KEY,
    clinic_id UUID NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
    patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
    patient_name TEXT NOT NULL,
    patient_age INTEGER NOT NULL,
    patient_gender TEXT NOT NULL,
    patient_phone TEXT DEFAULT '',
    doctor_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    diagnosis TEXT NOT NULL DEFAULT '',
    advice TEXT DEFAULT '',
    follow_up_date TEXT,
    pdf_hash TEXT,
    signature TEXT,
    status TEXT NOT NULL DEFAULT 'draft',
    wallet_deducted INTEGER NOT NULL DEFAULT 0,
    is_deleted BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =========================================================================
-- PRESCRIPTION MEDICINES
-- =========================================================================
CREATE TABLE IF NOT EXISTS prescription_medicines (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    clinic_id UUID NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
    prescription_id TEXT NOT NULL REFERENCES prescriptions(id) ON DELETE CASCADE,
    medicine_name TEXT NOT NULL,
    type TEXT DEFAULT '',
    dosage TEXT DEFAULT '',
    frequency TEXT DEFAULT '',
    duration TEXT DEFAULT '',
    timing TEXT DEFAULT '',
    notes TEXT DEFAULT '',
    is_deleted BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =========================================================================
-- PRESCRIPTION LAB TESTS
-- =========================================================================
CREATE TABLE IF NOT EXISTS prescription_lab_tests (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    clinic_id UUID NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
    prescription_id TEXT NOT NULL REFERENCES prescriptions(id) ON DELETE CASCADE,
    test_name TEXT NOT NULL,
    category TEXT DEFAULT '',
    notes TEXT DEFAULT '',
    is_deleted BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =========================================================================
-- QUEUE
-- =========================================================================
CREATE TABLE IF NOT EXISTS queue (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    clinic_id UUID NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
    patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
    status TEXT NOT NULL DEFAULT 'waiting',
    added_by UUID NOT NULL REFERENCES users(id),
    notes TEXT DEFAULT '',
    token_number INTEGER NOT NULL,
    added_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    started_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE,
    is_deleted BOOLEAN DEFAULT false,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =========================================================================
-- CUSTOM MEDICINES
-- =========================================================================
CREATE TABLE IF NOT EXISTS custom_medicines (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    clinic_id UUID NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    type TEXT NOT NULL DEFAULT 'Tablet',
    strength TEXT DEFAULT '',
    manufacturer TEXT DEFAULT '',
    usage_count INTEGER NOT NULL DEFAULT 0,
    is_deleted BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    CONSTRAINT uq_custom_medicine_name UNIQUE (clinic_id, name)
);

-- =========================================================================
-- CUSTOM LAB TESTS
-- =========================================================================
CREATE TABLE IF NOT EXISTS custom_lab_tests (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    clinic_id UUID NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    category TEXT NOT NULL DEFAULT 'Other',
    usage_count INTEGER NOT NULL DEFAULT 0,
    is_deleted BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    CONSTRAINT uq_custom_lab_test_name UNIQUE (clinic_id, name)
);

-- =========================================================================
-- INDEXES
-- =========================================================================
CREATE INDEX IF NOT EXISTS idx_users_phone ON users(phone);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
CREATE INDEX IF NOT EXISTS idx_users_clinic ON users(clinic_id);
CREATE INDEX IF NOT EXISTS idx_users_doctor_code ON users(doctor_code);
CREATE INDEX IF NOT EXISTS idx_users_last_active ON users(clinic_id, last_active_at);

CREATE INDEX IF NOT EXISTS idx_connection_requests_doctor ON connection_requests(doctor_id, status);
CREATE INDEX IF NOT EXISTS idx_connection_requests_assistant ON connection_requests(assistant_id, status);

CREATE INDEX IF NOT EXISTS idx_wallets_user ON wallets(user_id);
CREATE INDEX IF NOT EXISTS idx_transactions_wallet ON transactions(wallet_id);
CREATE INDEX IF NOT EXISTS idx_transactions_created ON transactions(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_notifications_user ON notification_jobs(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_status ON notification_jobs(status);

CREATE INDEX IF NOT EXISTS idx_patients_clinic ON patients(clinic_id);
CREATE INDEX IF NOT EXISTS idx_patients_updated ON patients(clinic_id, updated_at);

CREATE INDEX IF NOT EXISTS idx_prescriptions_clinic ON prescriptions(clinic_id);
CREATE INDEX IF NOT EXISTS idx_prescriptions_patient ON prescriptions(patient_id);
CREATE INDEX IF NOT EXISTS idx_prescriptions_doctor ON prescriptions(doctor_id);

CREATE INDEX IF NOT EXISTS idx_rx_meds_prescription ON prescription_medicines(prescription_id);
CREATE INDEX IF NOT EXISTS idx_rx_tests_prescription ON prescription_lab_tests(prescription_id);

CREATE INDEX IF NOT EXISTS idx_queue_clinic ON queue(clinic_id);
CREATE INDEX IF NOT EXISTS idx_queue_added_at ON queue(clinic_id, added_at);

CREATE INDEX IF NOT EXISTS idx_custom_meds_clinic ON custom_medicines(clinic_id);
CREATE INDEX IF NOT EXISTS idx_custom_tests_clinic ON custom_lab_tests(clinic_id);

-- =========================================================================
-- TRIGGERS (updated_at auto-update)
-- =========================================================================
DROP TRIGGER IF EXISTS update_users_updated_at ON users;
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_clinics_updated_at ON clinics;
CREATE TRIGGER update_clinics_updated_at BEFORE UPDATE ON clinics
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_connection_requests_updated_at ON connection_requests;
CREATE TRIGGER update_connection_requests_updated_at BEFORE UPDATE ON connection_requests
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_wallets_updated_at ON wallets;
CREATE TRIGGER update_wallets_updated_at BEFORE UPDATE ON wallets
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_patients_updated_at ON patients;
CREATE TRIGGER update_patients_updated_at BEFORE UPDATE ON patients
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_prescriptions_updated_at ON prescriptions;
CREATE TRIGGER update_prescriptions_updated_at BEFORE UPDATE ON prescriptions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_rx_meds_updated_at ON prescription_medicines;
CREATE TRIGGER update_rx_meds_updated_at BEFORE UPDATE ON prescription_medicines
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_rx_tests_updated_at ON prescription_lab_tests;
CREATE TRIGGER update_rx_tests_updated_at BEFORE UPDATE ON prescription_lab_tests
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_queue_updated_at ON queue;
CREATE TRIGGER update_queue_updated_at BEFORE UPDATE ON queue
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_custom_meds_updated_at ON custom_medicines;
CREATE TRIGGER update_custom_meds_updated_at BEFORE UPDATE ON custom_medicines
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_custom_tests_updated_at ON custom_lab_tests;
CREATE TRIGGER update_custom_tests_updated_at BEFORE UPDATE ON custom_lab_tests
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
