-- ============================================================================
-- SMASH PREMIER LEAGUE (SPL) — IPL-STYLE PLAYOFF & KNOCKOUT SYSTEM MIGRATION
-- Additive, non-destructive PostgreSQL schema update.
-- Preserves all existing players, teams, matches, registrations, and history.
-- ============================================================================

-- 1. Safely widen public.matches.stage CHECK constraint to support IPL rounds
DO $$
DECLARE
  v_constraint_name TEXT;
BEGIN
  SELECT conname
  INTO v_constraint_name
  FROM pg_constraint
  WHERE conrelid = 'public.matches'::regclass
    AND contype = 'c'
    AND pg_get_constraintdef(oid) ILIKE '%stage%';

  IF v_constraint_name IS NOT NULL THEN
    EXECUTE format('ALTER TABLE public.matches DROP CONSTRAINT %I', v_constraint_name);
  END IF;

  ALTER TABLE public.matches
    ADD CONSTRAINT matches_stage_check
    CHECK (stage IS NULL OR stage IN ('ELIM', 'QF', 'SF', 'F', 'Q1', 'Q2'));
EXCEPTION
  WHEN undefined_table THEN
    NULL;
  WHEN duplicate_object THEN
    NULL;
END $$;

-- 2. Normalized Playoff Brackets Table (Season/Tournament-Scoped)
CREATE TABLE IF NOT EXISTS public.playoff_brackets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  season_slug TEXT NOT NULL UNIQUE,
  format TEXT NOT NULL DEFAULT 'ipl_top4' CHECK (format IN ('ipl_top4', 'top2', 'top4', 'top8')),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('draft', 'active', 'completed', 'archived')),
  published BOOLEAN NOT NULL DEFAULT TRUE,
  show_on_public_homepage BOOLEAN NOT NULL DEFAULT TRUE,
  qualified_teams_json JSONB NOT NULL DEFAULT '[]'::jsonb,
  disqualified_team_ids_json JSONB NOT NULL DEFAULT '[]'::jsonb,
  manual_tie_break_order_json JSONB NOT NULL DEFAULT '[]'::jsonb,
  settings_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  audit_logs_json JSONB NOT NULL DEFAULT '[]'::jsonb,
  champion_team_id UUID REFERENCES public.teams(id) ON DELETE SET NULL,
  runner_up_team_id UUID REFERENCES public.teams(id) ON DELETE SET NULL,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. Normalized Playoff Matches Table (Q1, ELIM, Q2, F)
CREATE TABLE IF NOT EXISTS public.playoff_matches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bracket_id UUID NOT NULL REFERENCES public.playoff_brackets(id) ON DELETE CASCADE,
  season_slug TEXT NOT NULL DEFAULT 'season-4',
  match_type TEXT NOT NULL CHECK (match_type IN ('Q1', 'ELIM', 'Q2', 'F')),
  match_label TEXT NOT NULL,
  slot INTEGER NOT NULL DEFAULT 1,
  round_order INTEGER NOT NULL DEFAULT 1,
  team_a_id UUID REFERENCES public.teams(id) ON DELETE SET NULL,
  team_b_id UUID REFERENCES public.teams(id) ON DELETE SET NULL,
  participant_a_source TEXT,
  participant_b_source TEXT,
  winner_id UUID REFERENCES public.teams(id) ON DELETE SET NULL,
  loser_id UUID REFERENCES public.teams(id) ON DELETE SET NULL,
  score_a INTEGER,
  score_b INTEGER,
  sets_json JSONB DEFAULT '[]'::jsonb,
  court INTEGER NOT NULL DEFAULT 1,
  court_name TEXT,
  scheduled_date TEXT,
  scheduled_time TEXT,
  time_label TEXT,
  umpire_name TEXT,
  mvp_player_id UUID REFERENCES public.players(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'upcoming' CHECK (status IN ('upcoming', 'live', 'paused', 'completed', 'postponed')),
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT playoff_matches_unique_round UNIQUE (bracket_id, match_type, slot)
);

-- 4. Indexes for instant bracket & public homepage lookups
CREATE INDEX IF NOT EXISTS idx_playoff_brackets_season ON public.playoff_brackets (season_slug);
CREATE INDEX IF NOT EXISTS idx_playoff_matches_bracket ON public.playoff_matches (bracket_id, round_order, slot);
CREATE INDEX IF NOT EXISTS idx_playoff_matches_season_status ON public.playoff_matches (season_slug, status);

-- 5. Updated-at triggers
CREATE OR REPLACE FUNCTION public.set_playoff_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_playoff_brackets_updated_at ON public.playoff_brackets;
CREATE TRIGGER trg_playoff_brackets_updated_at
  BEFORE UPDATE ON public.playoff_brackets
  FOR EACH ROW
  EXECUTE FUNCTION public.set_playoff_updated_at();

DROP TRIGGER IF EXISTS trg_playoff_matches_updated_at ON public.playoff_matches;
CREATE TRIGGER trg_playoff_matches_updated_at
  BEFORE UPDATE ON public.playoff_matches
  FOR EACH ROW
  EXECUTE FUNCTION public.set_playoff_updated_at();

-- 6. Row-Level Security (Public read, Authenticated Admin write)
ALTER TABLE public.playoff_brackets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.playoff_matches ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public read playoff brackets" ON public.playoff_brackets;
CREATE POLICY "Public read playoff brackets"
  ON public.playoff_brackets FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Admin write playoff brackets" ON public.playoff_brackets;
CREATE POLICY "Admin write playoff brackets"
  ON public.playoff_brackets FOR ALL
  USING (auth.role() = 'authenticated' OR auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'authenticated' OR auth.role() = 'service_role');

DROP POLICY IF EXISTS "Public read playoff matches" ON public.playoff_matches;
CREATE POLICY "Public read playoff matches"
  ON public.playoff_matches FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Admin write playoff matches" ON public.playoff_matches;
CREATE POLICY "Admin write playoff matches"
  ON public.playoff_matches FOR ALL
  USING (auth.role() = 'authenticated' OR auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'authenticated' OR auth.role() = 'service_role');

-- 7. Enable Supabase Realtime replication safely
DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.playoff_brackets;
EXCEPTION
  WHEN duplicate_object THEN NULL;
  WHEN undefined_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.playoff_matches;
EXCEPTION
  WHEN duplicate_object THEN NULL;
  WHEN undefined_object THEN NULL;
END $$;
