-- Zeal — AIConsultant identity enrichment (mirrors apps/chat-worker/seed/ai-consultant-identity.sql)
-- Adds the three identity columns and fills religion / lineage / native_language
-- for the directory roster so the Supabase directory matches the chat-authoritative D1.
-- Idempotent: safe to re-run. Apply via the Supabase SQL editor.

ALTER TABLE public."AIConsultant" ADD COLUMN IF NOT EXISTS religion text NOT NULL DEFAULT '';
ALTER TABLE public."AIConsultant" ADD COLUMN IF NOT EXISTS lineage text NOT NULL DEFAULT '';
ALTER TABLE public."AIConsultant" ADD COLUMN IF NOT EXISTS native_language text NOT NULL DEFAULT '';

UPDATE public."AIConsultant" SET religion='HINDU', lineage='Parashari (BPHS) + Vimshottari dasha, Sanskrit-literate', native_language='Hindi' WHERE id='ai-astro-priya';
UPDATE public."AIConsultant" SET religion='HINDU', lineage='KP System (Krishnamurti) + Nadi leaves + Parashari', native_language='Hindi' WHERE id='ai-astro-arjun';
UPDATE public."AIConsultant" SET religion='HINDU', lineage='Modern Western (Placidus) + synastry and composite charts', native_language='Tamil' WHERE id='ai-astro-ananya';
UPDATE public."AIConsultant" SET religion='HINDU', lineage='CBT + Mindfulness-Based Cognitive Therapy, NICE-aligned practice', native_language='Punjabi' WHERE id='ai-psych-neha';
UPDATE public."AIConsultant" SET religion='HINDU', lineage='Rider-Waite-Smith + intuitive single-pull method', native_language='Gujarati' WHERE id='ai-tarot-rhea';
UPDATE public."AIConsultant" SET religion='HINDU', lineage='Manasara-Mayamata classical Vastu + modern architecture practice', native_language='Gujarati' WHERE id='ai-vastu-karan';
UPDATE public."AIConsultant" SET religion='HINDU', lineage='Chaldean primary + Pythagorean cross-check, Lo Shu grids', native_language='Kannada' WHERE id='ai-numero-sanjay';
UPDATE public."AIConsultant" SET religion='HINDU', lineage='Usui Reiki Grandmaster + pranic healing (Choa Kok Sui lineage)', native_language='Malayalam' WHERE id='ai-reiki-meera';
UPDATE public."AIConsultant" SET religion='HINDU', lineage='Chaldean-Birla school + Pythagorean, name-vibration specialist', native_language='Tamil' WHERE id='ai-numero-lakshmi';
UPDATE public."AIConsultant" SET religion='HINDU', lineage='Hasta Samudrika Shastra (classical South Indian school)', native_language='Telugu' WHERE id='ai-palm-vidya';
UPDATE public."AIConsultant" SET religion='HINDU', lineage='Parashari + Jaimini, remedial specialist (ratna, mantra, daana)', native_language='Rajasthani' WHERE id='ai-astro-devika';
UPDATE public."AIConsultant" SET religion='HINDU', lineage='Rider-Waite-Smith love spreads + shadow-work overlay', native_language='Punjabi' WHERE id='ai-tarot-kavita';
UPDATE public."AIConsultant" SET religion='CHRISTIAN', lineage='Samudrika shastra blended with Western hand analysis', native_language='Sinhala' WHERE id='ai-palm-tara';
UPDATE public."AIConsultant" SET religion='BUDDHIST', lineage='Himalayan Vastu + mandala tradition of temple siting', native_language='Nepali' WHERE id='ai-vastu-pratap';
UPDATE public."AIConsultant" SET religion='HINDU', lineage='Parashari career timing + Muhurta Chintamani muhurta', native_language='Rajasthani' WHERE id='ai-astro-rohan';
UPDATE public."AIConsultant" SET religion='HINDU', lineage='Pranic healing + Himalayan meditation lineage (Rishikesh)', native_language='Garhwali' WHERE id='ai-healer-deepak';
UPDATE public."AIConsultant" SET religion='HINDU', lineage='Classical samudrika shastra from Sanskrit sources', native_language='Bhojpuri' WHERE id='ai-palm-vikram';
UPDATE public."AIConsultant" SET religion='JAIN', lineage='Modern Vastu + biophilic design integration', native_language='Gujarati' WHERE id='ai-vastu-nisha';
UPDATE public."AIConsultant" SET religion='HINDU', lineage='Usui Reiki + Kerala marma (Kalari) tradition', native_language='Malayalam' WHERE id='ai-healer-arvind';
UPDATE public."AIConsultant" SET religion='SPIRITUAL', lineage='Tarot de Marseille (Camoin school) + Rider-Waite-Smith', native_language='French' WHERE id='ai-tarot-sophia';
UPDATE public."AIConsultant" SET religion='SPIRITUAL', lineage='Psychological astrology (Glenn Perry lineage), Placidus', native_language='English' WHERE id='ai-astro-emma';
UPDATE public."AIConsultant" SET religion='CHRISTIAN', lineage='Pythagorean + Kabbalistic numerology (path-of-the-Tree method)', native_language='Italian' WHERE id='ai-numero-isabella';
UPDATE public."AIConsultant" SET religion='BUDDHIST', lineage='Usui Shiki Ryoho, direct-lineage teaching', native_language='Japanese' WHERE id='ai-reiki-yuki';
UPDATE public."AIConsultant" SET religion='CHRISTIAN', lineage='Latin-American tradition + eclipse-cycle forecasting', native_language='Spanish' WHERE id='ai-astro-carlos';
UPDATE public."AIConsultant" SET religion='SPIRITUAL', lineage='RWS shadow work + Jungian integration', native_language='English' WHERE id='ai-tarot-luna';
UPDATE public."AIConsultant" SET religion='NON_RELIGIOUS', lineage='Cosmobiology (Ebertin) + Uranian astrology (Witte dials)', native_language='German' WHERE id='ai-astro-hans';
UPDATE public."AIConsultant" SET religion='CHRISTIAN', lineage='RWS + Brazilian intuitive school', native_language='Portuguese' WHERE id='ai-tarot-maria';
UPDATE public."AIConsultant" SET religion='MUSLIM', lineage='Arabic lot-based astrology + lunar mansions (manzil)', native_language='Arabic' WHERE id='ai-astro-fatima';
UPDATE public."AIConsultant" SET religion='CHRISTIAN', lineage='Celtic Cross specialist + RWS positional method', native_language='French' WHERE id='ai-tarot-chloe';
UPDATE public."AIConsultant" SET religion='CHRISTIAN', lineage='Pythagorean numerology + African oral-number tradition', native_language='Xhosa' WHERE id='ai-numero-amara';
UPDATE public."AIConsultant" SET religion='CHRISTIAN', lineage='Evolutionary astrology (Steven Forrest lineage), lunar nodes', native_language='Spanish' WHERE id='ai-astro-isabel';
UPDATE public."AIConsultant" SET religion='BUDDHIST', lineage='Thai traditional healing + tok sen, temple-trained', native_language='Thai' WHERE id='ai-healer-priya';
UPDATE public."AIConsultant" SET religion='BUDDHIST', lineage='RWS + I Ching cross-influence', native_language='Mandarin' WHERE id='ai-tarot-maya';
UPDATE public."AIConsultant" SET religion='BUDDHIST', lineage='Traditional Thai medicine + herbal compress lineage', native_language='Thai' WHERE id='ai-healer-suki';
UPDATE public."AIConsultant" SET religion='CHRISTIAN', lineage='Pythagorean numerology + Akan day-name tradition', native_language='Twi' WHERE id='ai-numero-kwame';
UPDATE public."AIConsultant" SET religion='MUSLIM', lineage='RWS love spreads, culturally attuned reading', native_language='Urdu' WHERE id='ai-tarot-zara';
UPDATE public."AIConsultant" SET religion='MUSLIM', lineage='Usui Reiki + East African energy-healing traditions', native_language='Kikuyu' WHERE id='ai-healer-aisha';
UPDATE public."AIConsultant" SET religion='', lineage='', native_language='', languages='{"English","Twi","Ga"}', bio='Numerologist from Accra specializing in Pythagorean numerology and Akan day-name wisdom. Kwame decodes destiny with precision and rhythm.' WHERE id='ai-numero-kwame';

-- One Kwame Asante across rosters: the chat DB (D1) trained him as an Akan
-- day-name numerologist from Accra, so the directory row aligns to that.
UPDATE public."AIConsultant" SET category='NUMEROLOGIST', bio='Numerologist from Accra reading life paths through Akan day-name wisdom and Chaldean numerology. Kwame decodes destiny through numbers and names.', specialties='{"Numerology","Akan Day-Name Wisdom","Chaldean System","Name Analysis","Life Path"}', languages='{"English","Twi","Ga"}', religion='CHRISTIAN', lineage='Pythagorean numerology + Akan day-name tradition', native_language='Twi' WHERE id='ai-tarot-kwame';
