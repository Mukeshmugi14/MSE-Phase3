-- Phase 1 & 2 Workflow Expansion
-- Adds Eligibility, Deep Psychosocial, and EHR integrational placeholder columns

-- Phase 1: Eligibility and EHR Tracking
ALTER TABLE patients ADD COLUMN IF NOT EXISTS eligibility_status text default 'pending' check (eligibility_status in ('pending', 'eligible', 'ineligible'));
ALTER TABLE patients ADD COLUMN IF NOT EXISTS ehr_id text;
ALTER TABLE patients ADD COLUMN IF NOT EXISTS digital_consent_timestamp timestamptz;

-- Phase 2: Psychosocial Expansion
ALTER TABLE patients ADD COLUMN IF NOT EXISTS current_stressors text;
ALTER TABLE patients ADD COLUMN IF NOT EXISTS collateral_information text;
ALTER TABLE patients ADD COLUMN IF NOT EXISTS living_situation text;
ALTER TABLE patients ADD COLUMN IF NOT EXISTS legal_history text;

-- Add Clinical Formulations and Interventions directly to MSE sessions as structured data
ALTER TABLE mse_sessions ADD COLUMN IF NOT EXISTS intervention_plan jsonb;
