-- 004: Birth timezone on the seeker profile.
--
-- The worker now charts the kundali itself (src/kundali/service.ts, on the
-- shared @zeal/astrology ephemeris). A wall-clock birth time is meaningless
-- without the zone it was read in: "14:35" in Mumbai is 09:05 UTC, in
-- Kathmandu 08:50. Until now the zone lived only in the web app, so a chart
-- computed in the worker had to guess it from longitude.
--
-- SQLite has no `ADD COLUMN IF NOT EXISTS`, so this file is applied exactly
-- once. Re-running it fails with "duplicate column name: timezone".

ALTER TABLE seeker_profile ADD COLUMN timezone TEXT;
