-- Add to mse_sessions table Phase 2 data columns
ALTER TABLE mse_sessions ADD COLUMN IF NOT EXISTS facs_data jsonb;
ALTER TABLE mse_sessions ADD COLUMN IF NOT EXISTS prosody_data jsonb;
ALTER TABLE mse_sessions ADD COLUMN IF NOT EXISTS cognitive_data jsonb;
