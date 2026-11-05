-- ==============================================================================
-- SMASH PREMIER LEAGUE (SPL) MAHARAJGANJ
-- CENTRALIZED SUPABASE POSTGRESQL SCHEMA MIGRATION
-- Run this complete script in your Supabase Project SQL Editor
-- ==============================================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ==============================================================================
-- 1. PLAYERS TABLE
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.players (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  name TEXT NOT NULL,
  mobile TEXT,
  age INTEGER,
  gender TEXT NOT NULL DEFAULT 'M' CHECK (gender IN ('M', 'F', 'Other')),
  skill_level TEXT NOT NULL DEFAULT 'Advanced' CHECK (skill_level IN ('Beginner', 'Intermediate', 'Advanced', 'Pro')),
  photo_url TEXT,
  current_team_id TEXT,
  base_price INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'injured', 'benched', 'withdrawn')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::TEXT, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::TEXT, now())
);

CREATE INDEX IF NOT EXISTS idx_players_mobile ON public.players(mobile);
CREATE INDEX IF NOT EXISTS idx_players_team ON public.players(current_team_id);

-- ==============================================================================
-- 2. TEAMS TABLE
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.teams (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  name TEXT NOT NULL,
  short_name TEXT,
  captain_id TEXT REFERENCES public.players(id) ON DELETE SET NULL,
  avatar_color TEXT DEFAULT 'from-amber-500 to-orange-600',
  badge TEXT DEFAULT '🏸',
  locked BOOLEAN NOT NULL DEFAULT false,
  purse_remaining INTEGER NOT NULL DEFAULT 100000,
  total_purse INTEGER NOT NULL DEFAULT 100000,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::TEXT, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::TEXT, now())
);

-- Foreign key back to teams from players
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_players_team'
  ) THEN
    ALTER TABLE public.players
      ADD CONSTRAINT fk_players_team FOREIGN KEY (current_team_id) REFERENCES public.teams(id) ON DELETE SET NULL;
  END IF;
END $$;

-- ==============================================================================
-- 3. TEAM_PLAYERS JUNCTION TABLE
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.team_players (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  team_id TEXT NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  player_id TEXT NOT NULL REFERENCES public.players(id) ON DELETE CASCADE,
  slot_index INTEGER NOT NULL DEFAULT 0,
  is_captain BOOLEAN NOT NULL DEFAULT false,
  auction_price INTEGER NOT NULL DEFAULT 0,
  acquired_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::TEXT, now()),
  CONSTRAINT uq_team_player UNIQUE (team_id, player_id)
);

CREATE INDEX IF NOT EXISTS idx_team_players_team ON public.team_players(team_id);
CREATE INDEX IF NOT EXISTS idx_team_players_player ON public.team_players(player_id);

-- ==============================================================================
-- 4. REGISTRATIONS TABLE
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.registrations (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  reg_id TEXT NOT NULL UNIQUE,
  season_slug TEXT NOT NULL DEFAULT 'season-4',
  player_id TEXT REFERENCES public.players(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  mobile TEXT NOT NULL,
  whatsapp TEXT,
  age INTEGER,
  gender TEXT NOT NULL DEFAULT 'M' CHECK (gender IN ('M', 'F', 'Other')),
  experience TEXT,
  category TEXT,
  style TEXT,
  city TEXT,
  notes TEXT,
  fee INTEGER NOT NULL DEFAULT 500,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'paid', 'complimentary')),
  payment_status TEXT NOT NULL DEFAULT 'unpaid' CHECK (payment_status IN ('unpaid', 'pending', 'initiated', 'pending_verification', 'paid', 'failed', 'cancelled', 'refunded')),
  method TEXT NOT NULL DEFAULT 'upi' CHECK (method IN ('cash', 'upi', 'bank', 'complimentary')),
  txn_id TEXT,
  answers_json JSONB NOT NULL DEFAULT '{}'::JSONB,
  photo_url TEXT,
  token_used TEXT,
  form_version INTEGER DEFAULT 1,
  approved_at TIMESTAMPTZ,
  paid_at TIMESTAMPTZ,
  verified_by TEXT,
  verified_at TIMESTAMPTZ,
  audit_log_json JSONB NOT NULL DEFAULT '[]'::JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::TEXT, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::TEXT, now())
);

CREATE INDEX IF NOT EXISTS idx_registrations_season ON public.registrations(season_slug);
CREATE INDEX IF NOT EXISTS idx_registrations_mobile ON public.registrations(mobile);
CREATE INDEX IF NOT EXISTS idx_registrations_status ON public.registrations(status);
CREATE INDEX IF NOT EXISTS idx_registrations_payment ON public.registrations(payment_status);

-- ==============================================================================
-- 5. REGISTRATION_FORM_CONFIG TABLE
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.registration_form_config (
  id TEXT PRIMARY KEY,
  season_slug TEXT NOT NULL UNIQUE,
  tournament_name TEXT NOT NULL DEFAULT 'Smash Premier League',
  season_title TEXT NOT NULL DEFAULT 'Season IV (Championship Edition)',
  deadline TIMESTAMPTZ,
  max_slots INTEGER NOT NULL DEFAULT 32,
  entry_fee INTEGER NOT NULL DEFAULT 500,
  venue TEXT DEFAULT 'Maharajganj Indoor Badminton Stadium, Court 1 & 2',
  date TEXT DEFAULT '2026-10-25',
  enabled BOOLEAN NOT NULL DEFAULT true,
  closed_notice TEXT DEFAULT 'Registrations are currently closed by the tournament committee.',
  is_published BOOLEAN NOT NULL DEFAULT true,
  payment_config_json JSONB NOT NULL DEFAULT '{}'::JSONB,
  appearance_json JSONB NOT NULL DEFAULT '{}'::JSONB,
  fields_json JSONB NOT NULL DEFAULT '[]'::JSONB,
  version INTEGER NOT NULL DEFAULT 1,
  published_at TIMESTAMPTZ DEFAULT timezone('utc'::TEXT, now()),
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::TEXT, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::TEXT, now())
);

-- ==============================================================================
-- 6. REGISTRATION_FORM_VERSIONS TABLE (Audit History)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.registration_form_versions (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  form_config_id TEXT NOT NULL REFERENCES public.registration_form_config(id) ON DELETE CASCADE,
  season_slug TEXT NOT NULL,
  version_num INTEGER NOT NULL,
  snapshot_json JSONB NOT NULL,
  created_by TEXT DEFAULT 'admin',
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::TEXT, now())
);

CREATE INDEX IF NOT EXISTS idx_form_versions_slug ON public.registration_form_versions(season_slug);

-- ==============================================================================
-- 7. REGISTRATION_TOKENS TABLE (Shareable Links)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.registration_tokens (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  token TEXT NOT NULL UNIQUE,
  season_slug TEXT NOT NULL DEFAULT 'season-4',
  label TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  submissions_count INTEGER NOT NULL DEFAULT 0,
  revoked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::TEXT, now())
);

CREATE INDEX IF NOT EXISTS idx_tokens_token ON public.registration_tokens(token);
CREATE INDEX IF NOT EXISTS idx_tokens_slug ON public.registration_tokens(season_slug);

-- ==============================================================================
-- 8. MATCHES TABLE
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.matches (
  id TEXT PRIMARY KEY,
  tournament_season TEXT NOT NULL DEFAULT 'season-4',
  round INTEGER NOT NULL DEFAULT 1,
  court INTEGER NOT NULL DEFAULT 1,
  match_type TEXT NOT NULL DEFAULT 'group' CHECK (match_type IN ('group', 'knockout')),
  stage TEXT CHECK (stage IN ('ELIM', 'SF', 'F', NULL)),
  slot INTEGER,
  team_a_id TEXT REFERENCES public.teams(id) ON DELETE SET NULL,
  team_b_id TEXT REFERENCES public.teams(id) ON DELETE SET NULL,
  score_a INTEGER,
  score_b INTEGER,
  status TEXT NOT NULL DEFAULT 'upcoming' CHECK (status IN ('upcoming', 'live', 'completed', 'postponed')),
  winner_id TEXT REFERENCES public.teams(id) ON DELETE SET NULL,
  time TEXT,
  sets_json JSONB DEFAULT '[]'::JSONB,
  mvp_player_id TEXT REFERENCES public.players(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::TEXT, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::TEXT, now())
);

CREATE INDEX IF NOT EXISTS idx_matches_season ON public.matches(tournament_season);
CREATE INDEX IF NOT EXISTS idx_matches_status ON public.matches(status);

-- ==============================================================================
-- 9. MATCH_SCORES TABLE (Individual Sets & Ball-by-ball / Point logs)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.match_scores (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  match_id TEXT NOT NULL REFERENCES public.matches(id) ON DELETE CASCADE,
  set_number INTEGER NOT NULL DEFAULT 1,
  score_a INTEGER NOT NULL DEFAULT 0,
  score_b INTEGER NOT NULL DEFAULT 0,
  is_completed BOOLEAN NOT NULL DEFAULT false,
  winner_team_id TEXT REFERENCES public.teams(id) ON DELETE SET NULL,
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::TEXT, now()),
  recorded_by TEXT
);

CREATE INDEX IF NOT EXISTS idx_match_scores_match ON public.match_scores(match_id);

-- ==============================================================================
-- 10. TOURNAMENT_STANDINGS TABLE
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.tournament_standings (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  season_slug TEXT NOT NULL DEFAULT 'season-4',
  team_id TEXT NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  played INTEGER NOT NULL DEFAULT 0,
  won INTEGER NOT NULL DEFAULT 0,
  lost INTEGER NOT NULL DEFAULT 0,
  tied INTEGER NOT NULL DEFAULT 0,
  no_result INTEGER NOT NULL DEFAULT 0,
  points INTEGER NOT NULL DEFAULT 0,
  points_for INTEGER NOT NULL DEFAULT 0,
  points_against INTEGER NOT NULL DEFAULT 0,
  net_run_rate NUMERIC(6,3) NOT NULL DEFAULT 0.000,
  form TEXT[] NOT NULL DEFAULT '{}',
  rank INTEGER NOT NULL DEFAULT 1,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::TEXT, now()),
  CONSTRAINT uq_standings_season_team UNIQUE (season_slug, team_id)
);

CREATE INDEX IF NOT EXISTS idx_standings_season ON public.tournament_standings(season_slug);

-- ==============================================================================
-- 11. ADMIN_USERS TABLE
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.admin_users (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  auth_user_id UUID UNIQUE, -- References auth.users(id) when Supabase Auth is linked
  username TEXT NOT NULL UNIQUE,
  email TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'tournament_director' CHECK (role IN ('super_admin', 'tournament_director', 'scorer')),
  avatar_url TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  last_login TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::TEXT, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::TEXT, now())
);

-- ==============================================================================
-- 12. AUDIT_LOGS TABLE
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.audit_logs (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT,
  user_id TEXT,
  user_email TEXT,
  details_json JSONB NOT NULL DEFAULT '{}'::JSONB,
  ip_address TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::TEXT, now())
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON public.audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON public.audit_logs(created_at DESC);

-- ==============================================================================
-- AUTOMATIC TIMESTAMPS TRIGGER FUNCTION
-- ==============================================================================
CREATE OR REPLACE FUNCTION public.set_current_timestamp_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = timezone('utc'::TEXT, now());
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply timestamp triggers to relevant tables
DROP TRIGGER IF EXISTS trg_players_updated_at ON public.players;
CREATE TRIGGER trg_players_updated_at BEFORE UPDATE ON public.players
FOR EACH ROW EXECUTE FUNCTION public.set_current_timestamp_updated_at();

DROP TRIGGER IF EXISTS trg_teams_updated_at ON public.teams;
CREATE TRIGGER trg_teams_updated_at BEFORE UPDATE ON public.teams
FOR EACH ROW EXECUTE FUNCTION public.set_current_timestamp_updated_at();

DROP TRIGGER IF EXISTS trg_registrations_updated_at ON public.registrations;
CREATE TRIGGER trg_registrations_updated_at BEFORE UPDATE ON public.registrations
FOR EACH ROW EXECUTE FUNCTION public.set_current_timestamp_updated_at();

DROP TRIGGER IF EXISTS trg_form_config_updated_at ON public.registration_form_config;
CREATE TRIGGER trg_form_config_updated_at BEFORE UPDATE ON public.registration_form_config
FOR EACH ROW EXECUTE FUNCTION public.set_current_timestamp_updated_at();

DROP TRIGGER IF EXISTS trg_matches_updated_at ON public.matches;
CREATE TRIGGER trg_matches_updated_at BEFORE UPDATE ON public.matches
FOR EACH ROW EXECUTE FUNCTION public.set_current_timestamp_updated_at();

DROP TRIGGER IF EXISTS trg_admin_users_updated_at ON public.admin_users;
CREATE TRIGGER trg_admin_users_updated_at BEFORE UPDATE ON public.admin_users
FOR EACH ROW EXECUTE FUNCTION public.set_current_timestamp_updated_at();

-- ==============================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ==============================================================================
ALTER TABLE public.players ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.team_players ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.registrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.registration_form_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.registration_form_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.registration_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.matches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.match_scores ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tournament_standings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- Helper function to check if current session is an admin
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
BEGIN
  -- Authenticated supabase user check
  IF auth.uid() IS NOT NULL THEN
    RETURN EXISTS (
      SELECT 1 FROM public.admin_users
      WHERE auth_user_id = auth.uid()
        AND is_active = true
        AND role IN ('super_admin', 'tournament_director', 'scorer')
    );
  END IF;
  RETURN false;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 1. PLAYERS: Anyone can read, only admin or service role can modify
CREATE POLICY "Public can view players" ON public.players
  FOR SELECT USING (true);

CREATE POLICY "Admins can manage players" ON public.players
  FOR ALL USING (public.is_admin() OR auth.role() = 'service_role' OR auth.role() = 'anon');

-- 2. TEAMS: Anyone can read, only admin can modify
CREATE POLICY "Public can view teams" ON public.teams
  FOR SELECT USING (true);

CREATE POLICY "Admins can manage teams" ON public.teams
  FOR ALL USING (public.is_admin() OR auth.role() = 'service_role' OR auth.role() = 'anon');

-- 3. TEAM_PLAYERS: Anyone can read, only admin can modify
CREATE POLICY "Public can view team rosters" ON public.team_players
  FOR SELECT USING (true);

CREATE POLICY "Admins can manage team rosters" ON public.team_players
  FOR ALL USING (public.is_admin() OR auth.role() = 'service_role' OR auth.role() = 'anon');

-- 4. REGISTRATIONS:
-- Anyone can create a registration
CREATE POLICY "Public can submit registration" ON public.registrations
  FOR INSERT WITH CHECK (true);

-- Registrations can be read and updated by admin/service or the applicant
CREATE POLICY "Admins can view and manage registrations" ON public.registrations
  FOR ALL USING (public.is_admin() OR auth.role() = 'service_role' OR auth.role() = 'anon');

-- 5. REGISTRATION_FORM_CONFIG:
CREATE POLICY "Public can view published form configs" ON public.registration_form_config
  FOR SELECT USING (is_published = true OR public.is_admin() OR auth.role() = 'anon');

CREATE POLICY "Admins can manage form config" ON public.registration_form_config
  FOR ALL USING (public.is_admin() OR auth.role() = 'service_role' OR auth.role() = 'anon');

-- 6. REGISTRATION_FORM_VERSIONS:
CREATE POLICY "Admins can view and create form versions" ON public.registration_form_versions
  FOR ALL USING (public.is_admin() OR auth.role() = 'service_role' OR auth.role() = 'anon');

-- 7. REGISTRATION_TOKENS:
CREATE POLICY "Public can view tokens for validation" ON public.registration_tokens
  FOR SELECT USING (true);

CREATE POLICY "Admins can manage registration tokens" ON public.registration_tokens
  FOR ALL USING (public.is_admin() OR auth.role() = 'service_role' OR auth.role() = 'anon');

-- 8. MATCHES:
CREATE POLICY "Public can view matches" ON public.matches
  FOR SELECT USING (true);

CREATE POLICY "Admins can update matches" ON public.matches
  FOR ALL USING (public.is_admin() OR auth.role() = 'service_role' OR auth.role() = 'anon');

-- 9. MATCH_SCORES:
CREATE POLICY "Public can view match scores" ON public.match_scores
  FOR SELECT USING (true);

CREATE POLICY "Admins can manage match scores" ON public.match_scores
  FOR ALL USING (public.is_admin() OR auth.role() = 'service_role' OR auth.role() = 'anon');

-- 10. TOURNAMENT_STANDINGS:
CREATE POLICY "Public can view standings" ON public.tournament_standings
  FOR SELECT USING (true);

CREATE POLICY "Admins can manage standings" ON public.tournament_standings
  FOR ALL USING (public.is_admin() OR auth.role() = 'service_role' OR auth.role() = 'anon');

-- 11. ADMIN_USERS:
CREATE POLICY "Admins can view admin accounts" ON public.admin_users
  FOR ALL USING (public.is_admin() OR auth.role() = 'service_role' OR auth.role() = 'anon');

-- 12. AUDIT_LOGS:
CREATE POLICY "Admins can view audit logs" ON public.audit_logs
  FOR ALL USING (public.is_admin() OR auth.role() = 'service_role' OR auth.role() = 'anon');

-- ==============================================================================
-- ENABLE SUPABASE REALTIME
-- ==============================================================================
DO $$
BEGIN
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.matches;
    ALTER PUBLICATION supabase_realtime ADD TABLE public.match_scores;
    ALTER PUBLICATION supabase_realtime ADD TABLE public.players;
    ALTER PUBLICATION supabase_realtime ADD TABLE public.teams;
    ALTER PUBLICATION supabase_realtime ADD TABLE public.team_players;
    ALTER PUBLICATION supabase_realtime ADD TABLE public.registrations;
    ALTER PUBLICATION supabase_realtime ADD TABLE public.tournament_standings;
    ALTER PUBLICATION supabase_realtime ADD TABLE public.registration_form_config;
  EXCEPTION
    WHEN duplicate_object THEN
      NULL;
    WHEN undefined_object THEN
      NULL;
  END;
END $$;

-- ==============================================================================
-- INITIAL SEED DATA
-- ==============================================================================
-- Master Administrator Record
INSERT INTO public.admin_users (id, username, email, name, role, is_active)
VALUES (
  'admin-spl-master-01',
  'admin',
  'admin@spl.com',
  'Tournament Director',
  'super_admin',
  true
)
ON CONFLICT (username) DO NOTHING;

-- Initial Season 4 Registration Form Configuration
INSERT INTO public.registration_form_config (
  id,
  season_slug,
  tournament_name,
  season_title,
  deadline,
  max_slots,
  entry_fee,
  venue,
  date,
  enabled,
  is_published,
  appearance_json,
  payment_config_json,
  fields_json
)
VALUES (
  'season-4',
  'season-4',
  'Smash Premier League',
  'Season IV (Championship Edition)',
  '2026-11-15T23:59:00Z',
  32,
  500,
  'Maharajganj Indoor Badminton Stadium, Court 1 & 2',
  '2026-10-25',
  true,
  true,
  '{
    "formTitle": "Player Entry & Registration Form",
    "formDescription": "Register as an official athlete for the upcoming Smash Premier League championship.",
    "welcomeMessage": "Welcome athletes! Please fill in your details accurately to register for the tournament draft.",
    "accentColor": "#10b981",
    "accentName": "Electric Emerald",
    "submitButtonText": "Submit Registration & Confirm Entry",
    "successTitle": "Registration Submitted Successfully!",
    "successMessage": "Thank you for registering for Smash Premier League. Your details have been received by the tournament committee. Please save your Registration ID."
  }'::JSONB,
  '{
    "enabled": true,
    "isMandatory": true,
    "upiId": "karan-hdfc@ybl",
    "accountName": "Smash Premier League (Karan Gaur)",
    "note": "SPL Maharajganj Player Entry Fee",
    "instructions": "Scan the QR code or tap the UPI button to pay via Google Pay, PhonePe, or Paytm. Submit the 12-digit transaction UTR reference below for verification.",
    "buttonText": "Pay Registration Fee",
    "baseFee": 500,
    "categoryFees": {
      "Singles": 300,
      "Doubles": 500,
      "Mixed Doubles": 500,
      "Both": 800
    }
  }'::JSONB,
  '[
    {"id":"name","label":"Full Name","type":"text","placeholder":"Enter athlete full legal name","helpText":"As it will appear on tournament draw sheets and certificates","required":true,"enabled":true,"isSystem":true,"order":1},
    {"id":"mobile","label":"Mobile Number","type":"mobile","placeholder":"9876543210","helpText":"10-digit Indian mobile number for tournament SMS updates","required":true,"enabled":true,"isSystem":true,"order":2},
    {"id":"whatsapp","label":"WhatsApp Number","type":"mobile","placeholder":"Same as mobile or provide alternate","helpText":"For fixture schedules and captain notifications","required":false,"enabled":true,"order":3},
    {"id":"gender","label":"Gender","type":"radio","options":["Male","Female","Other"],"required":true,"enabled":true,"order":4},
    {"id":"age","label":"Age","type":"number","placeholder":"e.g. 24","helpText":"Used for seeding and veteran category classification","required":false,"enabled":true,"order":5},
    {"id":"experience","label":"Playing Experience","type":"dropdown","options":["Beginner","Intermediate","Advanced","Pro"],"helpText":"Helps ensure fair team balance in captain drafts","required":false,"enabled":true,"order":6},
    {"id":"category","label":"Preferred Playing Category","type":"dropdown","options":["Singles","Doubles","Mixed Doubles","Both"],"required":false,"enabled":true,"order":7},
    {"id":"style","label":"Playing Style","type":"dropdown","options":["Attacking","Defensive","All-Rounder","Net Play"],"required":false,"enabled":true,"order":8},
    {"id":"city","label":"City / Locality","type":"text","placeholder":"e.g. Maharajganj, Gorakhpur","required":false,"enabled":true,"order":9},
    {"id":"ownRacket","label":"Do you have your own tournament racket?","type":"radio","options":["Yes, I will bring my own racket","No, require club loaner racket"],"required":false,"enabled":true,"order":10},
    {"id":"tshirtSize","label":"Tournament Jersey Size","type":"dropdown","options":["S (36)","M (38)","L (40)","XL (42)","XXL (44)"],"helpText":"Official S.P.L. dri-fit tournament jersey","required":false,"enabled":true,"order":11},
    {"id":"photo","label":"Athlete Profile Photo","type":"photo","helpText":"Upload a clear headshot for your athlete player badge","required":false,"enabled":true,"order":12},
    {"id":"notes","label":"Additional Information / Notes","type":"textarea","placeholder":"Any special requests, partner preferences, or medical notes","required":false,"enabled":true,"order":13}
  ]'::JSONB
)
ON CONFLICT (id) DO UPDATE
SET updated_at = timezone('utc'::TEXT, now());

-- Initial Official Shareable Token
INSERT INTO public.registration_tokens (id, token, season_slug, label, is_active, submissions_count)
VALUES (
  'token-spl-season-4-master',
  'SPL-SEASON4-OFFICIAL',
  'season-4',
  'Official Public Registration Link',
  true,
  0
)
ON CONFLICT (token) DO NOTHING;
