-- 003: Cultural identity fields for AI consultants.
-- Each consultant is trained as a distinct practitioner: faith tradition
-- shapes their metaphors, lineage anchors their school of practice, and
-- native_language grounds their code-switching. All three are injected into
-- the persona contract by persona-engine.ts.

ALTER TABLE ai_consultant ADD COLUMN religion TEXT NOT NULL DEFAULT '';
ALTER TABLE ai_consultant ADD COLUMN lineage TEXT NOT NULL DEFAULT '';
ALTER TABLE ai_consultant ADD COLUMN native_language TEXT NOT NULL DEFAULT '';
