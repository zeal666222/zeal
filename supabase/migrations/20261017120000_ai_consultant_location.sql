-- Add location and country columns to AIConsultant table
-- These store the consultant's city and country for display

ALTER TABLE "AIConsultant"
  ADD COLUMN IF NOT EXISTS location text,
  ADD COLUMN IF NOT EXISTS country text;

-- Add index for faster filtering by country
CREATE INDEX IF NOT EXISTS idx_ai_consultant_country ON "AIConsultant"(country);
