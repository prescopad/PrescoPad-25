-- Database Reset Script
-- This script truncates all data tables while preserving the schema
-- Execute this during development to start with a clean slate
-- WARNING: This will DELETE ALL DATA. Use with caution!

-- Truncate all data tables in reverse dependency order
-- CASCADE ensures foreign key constraints are handled properly

TRUNCATE TABLE notification_jobs CASCADE;
TRUNCATE TABLE transactions CASCADE;
TRUNCATE TABLE wallets CASCADE;
TRUNCATE TABLE custom_lab_tests CASCADE;
TRUNCATE TABLE custom_medicines CASCADE;
TRUNCATE TABLE queue CASCADE;
TRUNCATE TABLE prescription_lab_tests CASCADE;
TRUNCATE TABLE prescription_medicines CASCADE;
TRUNCATE TABLE prescriptions CASCADE;
TRUNCATE TABLE patients CASCADE;
TRUNCATE TABLE connection_requests CASCADE;
TRUNCATE TABLE assistant_profiles CASCADE;
TRUNCATE TABLE doctor_profiles CASCADE;
TRUNCATE TABLE users CASCADE;
TRUNCATE TABLE clinics CASCADE;

-- Note: Migrations table is NOT truncated to preserve schema version
-- Note: UUID sequences don't need reset as they're generated on demand
