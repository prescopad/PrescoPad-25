-- PrescoPad Migration 002: Doctor & Assistant Profile Tables
-- Separate role-specific data into dedicated tables

-- =========================================================================
-- DOCTOR PROFILES
-- =========================================================================
CREATE TABLE IF NOT EXISTS doctor_profiles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
    specialty VARCHAR(100) DEFAULT '',
    reg_number VARCHAR(100) DEFAULT '',
    education VARCHAR(200) DEFAULT '',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =========================================================================
-- ASSISTANT PROFILES
-- =========================================================================
CREATE TABLE IF NOT EXISTS assistant_profiles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
    qualification VARCHAR(200) DEFAULT '',
    experience_years INTEGER DEFAULT 0,
    address TEXT DEFAULT '',
    city VARCHAR(100) DEFAULT '',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =========================================================================
-- INDEXES
-- =========================================================================
CREATE INDEX IF NOT EXISTS idx_doctor_profiles_user ON doctor_profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_assistant_profiles_user ON assistant_profiles(user_id);

-- =========================================================================
-- TRIGGERS
-- =========================================================================
DROP TRIGGER IF EXISTS update_doctor_profiles_updated_at ON doctor_profiles;
CREATE TRIGGER update_doctor_profiles_updated_at BEFORE UPDATE ON doctor_profiles
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_assistant_profiles_updated_at ON assistant_profiles;
CREATE TRIGGER update_assistant_profiles_updated_at BEFORE UPDATE ON assistant_profiles
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =========================================================================
-- MIGRATE EXISTING DATA
-- =========================================================================
INSERT INTO doctor_profiles (user_id, specialty, reg_number)
SELECT id, COALESCE(specialty, ''), COALESCE(reg_number, '')
FROM users WHERE role = 'doctor'
ON CONFLICT (user_id) DO NOTHING;

INSERT INTO assistant_profiles (user_id)
SELECT id FROM users WHERE role = 'assistant'
ON CONFLICT (user_id) DO NOTHING;
