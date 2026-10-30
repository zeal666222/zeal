-- Add gender column to ai_consultant for gender-conscious voice
ALTER TABLE ai_consultant ADD COLUMN gender TEXT DEFAULT NULL;
