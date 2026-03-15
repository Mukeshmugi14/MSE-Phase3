-- Comprehensive Clinical Workflow Expansion
-- This migration ensures all fields required for Phase 1-7 are present in the database.

-- 1. Patients Table Expansion (Phases 1 & 2)
ALTER TABLE patients ADD COLUMN IF NOT EXISTS referral_source text;
ALTER TABLE patients ADD COLUMN IF NOT EXISTS past_psychiatric_history text;
ALTER TABLE patients ADD COLUMN IF NOT EXISTS past_medical_history text;
ALTER TABLE patients ADD COLUMN IF NOT EXISTS substance_use text;
ALTER TABLE patients ADD COLUMN IF NOT EXISTS family_history text;
ALTER TABLE patients ADD COLUMN IF NOT EXISTS education text;
ALTER TABLE patients ADD COLUMN IF NOT EXISTS occupation text;
ALTER TABLE patients ADD COLUMN IF NOT EXISTS consent_obtained boolean DEFAULT false;
ALTER TABLE patients ADD COLUMN IF NOT EXISTS digital_consent_timestamp timestamptz;
ALTER TABLE patients ADD COLUMN IF NOT EXISTS eligibility_status text DEFAULT 'pending' CHECK (eligibility_status IN ('pending', 'eligible', 'ineligible'));
ALTER TABLE patients ADD COLUMN IF NOT EXISTS ehr_id text;
ALTER TABLE patients ADD COLUMN IF NOT EXISTS current_stressors text;
ALTER TABLE patients ADD COLUMN IF NOT EXISTS collateral_information text;
ALTER TABLE patients ADD COLUMN IF NOT EXISTS living_situation text;
ALTER TABLE patients ADD COLUMN IF NOT EXISTS legal_history text;

-- 2. MSE Sessions Table Expansion (Phases 4-7)
ALTER TABLE mse_sessions ADD COLUMN IF NOT EXISTS validated_domains text[] DEFAULT '{}';
ALTER TABLE mse_sessions ADD COLUMN IF NOT EXISTS clinician_notes text;
ALTER TABLE mse_sessions ADD COLUMN IF NOT EXISTS diagnostic_impression text;
ALTER TABLE mse_sessions ADD COLUMN IF NOT EXISTS intervention_plan jsonb DEFAULT '{}';
ALTER TABLE mse_sessions ADD COLUMN IF NOT EXISTS status text DEFAULT 'recording' CHECK (status IN ('recording', 'transcribing', 'assessing', 'complete', 'error'));
