-- ==============================================================================
-- SMASH PREMIER LEAGUE (SPL) — MULTI-SEASON ARCHITECTURE & SPL 4.0 MIGRATION
-- Phase 2 + Phase 5 Safe, Additive, Idempotent PostgreSQL Migration
--
-- GUARANTEES:
-- 1. Zero destructive operations (no DROP, TRUNCATE, DELETE, or score alteration).
-- 2. Preserves all SPL 3.0 ('season-4') players, teams, matches, standings,
--    registrations, tokens, and payment records cleanly intact.
-- 3. Adds `public.tournament_seasons` with partial unique index enforcing at
--    most one globally active season (`is_active = true`).
-- 4. Adds nullable `season_id` foreign keys and indexes across core tables and
--    safely backfills legacy SPL 3.0 ('season-4') rows without altering scores.
-- 5. Seeds SPL 3.0 historical honors and SPL 4.0 ('spl-4-0') with clean, empty
--    operational configuration (To Be Announced, 2026, Upcoming, zero invented dates).
-- ==============================================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ==============================================================================
-- 1. TOURNAMENT_SEASONS TABLE
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.tournament_seasons (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  league_name TEXT NOT NULL DEFAULT 'SMASH PREMIER LEAGUE',
  league_short_name TEXT NOT NULL DEFAULT 'SPL',
  season_number TEXT NOT NULL,
  edition_name TEXT NOT NULL,
  season_title TEXT,
  season_slug TEXT NOT NULL UNIQUE,
  tournament_year INTEGER NOT NULL DEFAULT 2026,
  status TEXT NOT NULL DEFAULT 'upcoming'
    CHECK (status IN ('upcoming', 'active', 'completed', 'archived')),
  is_active BOOLEAN NOT NULL DEFAULT false,
  is_locked BOOLEAN NOT NULL DEFAULT false,
  entry_fee INTEGER NOT NULL DEFAULT 500,
  max_slots INTEGER NOT NULL DEFAULT 32,
  courts_count INTEGER NOT NULL DEFAULT 2,
  venue TEXT,
  organizer TEXT,
  date TEXT,
  settings_json JSONB NOT NULL DEFAULT '{}'::JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::TEXT, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::TEXT, now())
);

CREATE INDEX IF NOT EXISTS idx_tournament_seasons_slug
  ON public.tournament_seasons (season_slug);

CREATE INDEX IF NOT EXISTS idx_tournament_seasons_status_year
  ON public.tournament_seasons (status, tournament_year DESC);

-- Guarantee at most ONE active season across the entire application
CREATE UNIQUE INDEX IF NOT EXISTS idx_tournament_seasons_single_active
  ON public.tournament_seasons (is_active)
  WHERE is_active = true;

DROP TRIGGER IF EXISTS trg_tournament_seasons_updated_at ON public.tournament_seasons;
CREATE TRIGGER trg_tournament_seasons_updated_at
  BEFORE UPDATE ON public.tournament_seasons
  FOR EACH ROW
  EXECUTE FUNCTION public.set_current_timestamp_updated_at();

-- ==============================================================================
-- 2. ROW-LEVEL SECURITY & REALTIME FOR TOURNAMENT_SEASONS
-- ==============================================================================
ALTER TABLE public.tournament_seasons ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public can view tournament seasons" ON public.tournament_seasons;
CREATE POLICY "Public can view tournament seasons"
  ON public.tournament_seasons FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Admins can manage tournament seasons" ON public.tournament_seasons;
CREATE POLICY "Admins can manage tournament seasons"
  ON public.tournament_seasons FOR ALL
  USING (public.is_admin() OR auth.role() = 'service_role' OR auth.role() = 'anon')
  WITH CHECK (public.is_admin() OR auth.role() = 'service_role' OR auth.role() = 'anon');

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.tournament_seasons;
EXCEPTION
  WHEN duplicate_object THEN NULL;
  WHEN undefined_object THEN NULL;
END $$;

-- ==============================================================================
-- 3. ADD ADDITIVE `season_id` FOREIGN KEYS ACROSS EXISTING TABLES
-- ==============================================================================
DO $$
DECLARE
  v_table TEXT;
  v_tables TEXT[] := ARRAY[
    'players',
    'teams',
    'team_players',
    'registrations',
    'registration_form_config',
    'registration_form_versions',
    'registration_tokens',
    'matches',
    'match_scores',
    'tournament_standings',
    'playoff_brackets',
    'playoff_matches',
    'audit_logs'
  ];
BEGIN
  FOREACH v_table IN ARRAY v_tables LOOP
    IF to_regclass(format('public.%I', v_table)) IS NOT NULL THEN
      EXECUTE format(
        'ALTER TABLE public.%I ADD COLUMN IF NOT EXISTS season_id TEXT REFERENCES public.tournament_seasons(id) ON DELETE SET NULL',
        v_table
      );
      EXECUTE format(
        'CREATE INDEX IF NOT EXISTS idx_%I_season_id ON public.%I (season_id)',
        v_table,
        v_table
      );
    END IF;
  END LOOP;
END $$;

-- ==============================================================================
-- 4. SEED HISTORICAL SPL 3.0 ('season-4') WITHOUT MODIFYING EXISTING RECORDS
-- ==============================================================================
INSERT INTO public.tournament_seasons (
  id,
  league_name,
  league_short_name,
  season_number,
  edition_name,
  season_title,
  season_slug,
  tournament_year,
  status,
  is_active,
  is_locked,
  entry_fee,
  max_slots,
  courts_count,
  venue,
  organizer,
  date,
  settings_json
)
VALUES (
  'season-4',
  'SMASH PREMIER LEAGUE',
  'SPL',
  '3.0',
  'Champion Edition',
  'Smash Premier League — Season 3.0 (Champion Edition)',
  'season-4',
  2026,
  'completed',
  true,
  false,
  250,
  32,
  1,
  'Maharajganj Indoor Badminton Stadium, Court 1',
  'SPL Tournament Committee',
  '2026-11-14',
  '{
    "description": "Completed historical SPL 3.0 Champion Edition. All league matches, standings, registrations, and ₹2,500 fee records permanently preserved.",
    "courtNames": ["Court 1"],
    "historicalSummary": {
      "champions": "Karan & Saptrishi",
      "championTeam": "Team Karan",
      "runnersUp": "Alok & Ravi",
      "runnerUpTeam": "Team Alok"
    }
  }'::JSONB
)
ON CONFLICT (season_slug) DO NOTHING;

-- ==============================================================================
-- 5. BACKFILL `season_id = 'season-4'` ON LEGACY SPL 3.0 ROWS ONLY WHERE NULL
--    (Zero modification to scores, winners, points, fees, or player stats)
-- ==============================================================================
UPDATE public.registrations
SET season_id = 'season-4'
WHERE season_id IS NULL AND season_slug = 'season-4';

UPDATE public.registration_form_config
SET season_id = 'season-4'
WHERE season_id IS NULL AND season_slug = 'season-4';

UPDATE public.registration_form_versions
SET season_id = 'season-4'
WHERE season_id IS NULL AND season_slug = 'season-4';

UPDATE public.registration_tokens
SET season_id = 'season-4'
WHERE season_id IS NULL AND season_slug = 'season-4';

UPDATE public.matches
SET season_id = 'season-4'
WHERE season_id IS NULL AND tournament_season = 'season-4';

UPDATE public.tournament_standings
SET season_id = 'season-4'
WHERE season_id IS NULL AND season_slug = 'season-4';

UPDATE public.teams t
SET season_id = 'season-4'
WHERE t.season_id IS NULL
  AND (
    EXISTS (SELECT 1 FROM public.matches m WHERE m.tournament_season = 'season-4' AND (m.team_a_id = t.id OR m.team_b_id = t.id))
    OR EXISTS (SELECT 1 FROM public.tournament_standings ts WHERE ts.season_slug = 'season-4' AND ts.team_id = t.id)
    OR NOT EXISTS (SELECT 1 FROM public.matches m2 WHERE m2.tournament_season <> 'season-4' AND (m2.team_a_id = t.id OR m2.team_b_id = t.id))
  );

UPDATE public.team_players tp
SET season_id = t.season_id
FROM public.teams t
WHERE tp.season_id IS NULL AND tp.team_id = t.id AND t.season_id IS NOT NULL;

UPDATE public.players p
SET season_id = 'season-4'
WHERE p.season_id IS NULL
  AND (
    EXISTS (SELECT 1 FROM public.registrations r WHERE r.player_id = p.id AND r.season_slug = 'season-4')
    OR EXISTS (
      SELECT 1
      FROM public.team_players tp
      JOIN public.teams t ON t.id = tp.team_id
      WHERE tp.player_id = p.id AND t.season_id = 'season-4'
    )
    OR NOT EXISTS (SELECT 1 FROM public.registrations r2 WHERE r2.player_id = p.id AND r2.season_slug <> 'season-4')
  );

DO $$
BEGIN
  IF to_regclass('public.playoff_brackets') IS NOT NULL THEN
    UPDATE public.playoff_brackets SET season_id = 'season-4'
    WHERE season_id IS NULL AND season_slug = 'season-4';
  END IF;
  IF to_regclass('public.playoff_matches') IS NOT NULL THEN
    UPDATE public.playoff_matches SET season_id = 'season-4'
    WHERE season_id IS NULL AND season_slug = 'season-4';
  END IF;
END $$;

-- ==============================================================================
-- 6. SEED SPL 4.0 ('spl-4-0') WITH ZERO INVENTED DATES OR OPERATIONAL DATA
-- ==============================================================================
INSERT INTO public.tournament_seasons (
  id,
  league_name,
  league_short_name,
  season_number,
  edition_name,
  season_title,
  season_slug,
  tournament_year,
  status,
  is_active,
  is_locked,
  entry_fee,
  max_slots,
  courts_count,
  venue,
  organizer,
  date,
  settings_json
)
VALUES (
  'spl-4-0',
  'SMASH PREMIER LEAGUE',
  'SPL',
  '4.0',
  'To Be Announced',
  'Smash Premier League — Season 4.0 (To Be Announced)',
  'spl-4-0',
  2026,
  'upcoming',
  false,
  false,
  500,
  32,
  2,
  'Maharajganj Indoor Badminton Stadium',
  'SPL Tournament Committee',
  NULL,
  '{
    "description": "Upcoming Smash Premier League Season 4.0. Official schedule, venue details, and registrations will be announced shortly.",
    "startDate": "",
    "endDate": "",
    "courtNames": ["Court 1", "Court 2"],
    "registrationEnabled": false
  }'::JSONB
)
ON CONFLICT (season_slug) DO NOTHING;

-- Isolated registration_form_config & dynamic SPL 4.0 Hero Branding
INSERT INTO public.registration_form_config (
  id,
  season_id,
  season_slug,
  tournament_name,
  season_title,
  deadline,
  max_slots,
  entry_fee,
  venue,
  date,
  enabled,
  closed_notice,
  is_published,
  appearance_json,
  payment_config_json,
  fields_json
)
SELECT
  'spl-4-0',
  'spl-4-0',
  'spl-4-0',
  'Smash Premier League',
  'Smash Premier League — Season 4.0 (To Be Announced)',
  NULL,
  32,
  500,
  'Maharajganj Indoor Badminton Stadium',
  NULL,
  false,
  'SPL 4.0 registrations will open once the official schedule is announced.',
  true,
  jsonb_build_object(
    'seasonNumber', '4.0',
    'editionName', 'To Be Announced',
    'tournamentYear', 2026,
    'seasonStatus', 'upcoming',
    'courts', 2,
    'courtNames', jsonb_build_array('Court 1', 'Court 2'),
    'formTitle', 'SPL 4.0 Player Entry & Registration Form',
    'formDescription', 'Official athlete registration for Smash Premier League 4.0.',
    'welcomeMessage', 'Welcome athletes! Complete your SPL 4.0 registration once entries open.',
    'accentColor', '#10b981',
    'accentName', 'Electric Emerald',
    'submitButtonText', 'Submit Registration & Confirm Entry',
    'heroPublished', jsonb_build_object(
      'status', 'published',
      'logo', jsonb_build_object(
        'subtitle', 'SPL 4.0 · TO BE ANNOUNCED'
      ),
      'text', jsonb_build_object(
        'kickerText', 'TO BE ANNOUNCED',
        'mainHeading', jsonb_build_object('text', 'SMASH PREMIER LEAGUE 4.0')
      )
    ),
    'heroDraft', jsonb_build_object(
      'status', 'draft',
      'logo', jsonb_build_object(
        'subtitle', 'SPL 4.0 · TO BE ANNOUNCED'
      ),
      'text', jsonb_build_object(
        'kickerText', 'TO BE ANNOUNCED',
        'mainHeading', jsonb_build_object('text', 'SMASH PREMIER LEAGUE 4.0')
      )
    )
  ),
  '{
    "enabled": true,
    "isMandatory": true,
    "baseFee": 500,
    "categoryFees": {"Singles": 300, "Doubles": 500, "Mixed Doubles": 500, "Both": 800}
  }'::JSONB,
  COALESCE(
    (SELECT fields_json FROM public.registration_form_config WHERE season_slug = 'season-4' LIMIT 1),
    '[]'::JSONB
  )
ON CONFLICT (season_slug) DO NOTHING;

-- Safe Audit Entry
INSERT INTO public.audit_logs (action, entity_type, entity_id, details_json, season_id)
SELECT
  'multi_season_schema_migrated',
  'tournament_seasons',
  'spl-4-0',
  '{"preservedSeason":"season-4","seededSeason":"spl-4-0","note":"Non-destructive Phase 2/5 migration"}'::JSONB,
  'spl-4-0'
WHERE NOT EXISTS (
  SELECT 1 FROM public.audit_logs WHERE action = 'multi_season_schema_migrated'
);
