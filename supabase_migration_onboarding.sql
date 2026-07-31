-- Migration: onboarding state
ALTER TABLE instances
  ADD COLUMN IF NOT EXISTS onboarding_step int NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS onboarding_completed boolean NOT NULL DEFAULT false;

-- Usuários já configurados não veem o onboarding
UPDATE instances
SET onboarding_completed = true, onboarding_step = 4
WHERE persona_name IS NOT NULL AND persona_name != '';
