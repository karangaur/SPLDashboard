/**
 * Database schema and interface types for Smash Premier League (SPL)
 * Centralized Supabase PostgreSQL Schema definitions
 */

export interface DbPlayer {
  id: string;
  name: string;
  mobile?: string | null;
  age?: number | null;
  gender: 'M' | 'F' | 'Other';
  skill_level: 'Beginner' | 'Intermediate' | 'Advanced' | 'Pro';
  photo_url?: string | null;
  current_team_id?: string | null;
  base_price: number;
  status: 'active' | 'injured' | 'benched' | 'withdrawn';
  created_at: string;
  updated_at: string;
}

export interface DbTeam {
  id: string;
  name: string;
  short_name?: string | null;
  captain_id?: string | null;
  avatar_color?: string | null;
  badge?: string | null;
  locked: boolean;
  purse_remaining: number;
  total_purse: number;
  created_at: string;
  updated_at: string;
}

export interface DbTeamPlayer {
  id: string;
  team_id: string;
  player_id: string;
  slot_index: number;
  is_captain: boolean;
  auction_price: number;
  acquired_at: string;
}

export interface DbRegistration {
  id: string;
  reg_id: string;
  season_slug: string;
  player_id?: string | null;
  name: string;
  mobile: string;
  whatsapp?: string | null;
  age?: number | null;
  gender: 'M' | 'F' | 'Other';
  experience?: string | null;
  category?: string | null;
  style?: string | null;
  city?: string | null;
  notes?: string | null;
  fee: number;
  status: 'pending' | 'approved' | 'rejected' | 'paid' | 'complimentary';
  payment_status:
    | 'unpaid'
    | 'pending'
    | 'initiated'
    | 'pending_verification'
    | 'paid'
    | 'failed'
    | 'cancelled'
    | 'refunded';
  method: 'cash' | 'upi' | 'bank' | 'complimentary';
  txn_id?: string | null;
  answers_json: Record<string, any>;
  photo_url?: string | null;
  token_used?: string | null;
  form_version?: number | null;
  approved_at?: string | null;
  paid_at?: string | null;
  verified_by?: string | null;
  verified_at?: string | null;
  audit_log_json: any[];
  created_at: string;
  updated_at: string;
}

export interface DbRegistrationFormConfig {
  id: string;
  season_slug: string;
  tournament_name: string;
  season_title: string;
  deadline?: string | null;
  max_slots: number;
  entry_fee: number;
  venue?: string | null;
  date?: string | null;
  enabled: boolean;
  closed_notice?: string | null;
  is_published: boolean;
  payment_config_json: Record<string, any>;
  appearance_json: Record<string, any>;
  fields_json: any[];
  version: number;
  published_at?: string | null;
  created_at: string;
  updated_at: string;
}

export interface DbRegistrationFormVersion {
  id: string;
  form_config_id: string;
  season_slug: string;
  version_num: number;
  snapshot_json: Record<string, any>;
  created_by?: string | null;
  created_at: string;
}

export interface DbMatch {
  id: string;
  tournament_season: string;
  round: number;
  court: number;
  match_type: 'group' | 'knockout';
  stage?: 'ELIM' | 'SF' | 'F' | null;
  slot?: number | null;
  team_a_id?: string | null;
  team_b_id?: string | null;
  score_a?: number | null;
  score_b?: number | null;
  status: 'upcoming' | 'live' | 'completed' | 'postponed';
  winner_id?: string | null;
  time?: string | null;
  sets_json?: { scoreA: number; scoreB: number }[] | null;
  mvp_player_id?: string | null;
  created_at: string;
  updated_at: string;
}

export interface DbMatchScore {
  id: string;
  match_id: string;
  set_number: number;
  score_a: number;
  score_b: number;
  is_completed: boolean;
  winner_team_id?: string | null;
  recorded_at: string;
  recorded_by?: string | null;
}

export interface DbTournamentStanding {
  id: string;
  season_slug: string;
  team_id: string;
  played: number;
  won: number;
  lost: number;
  tied: number;
  no_result: number;
  points: number;
  points_for: number;
  points_against: number;
  net_run_rate: number;
  form: string[];
  rank: number;
  updated_at: string;
}

export interface DbAdminUser {
  id: string;
  auth_user_id?: string | null;
  username: string;
  email: string;
  name: string;
  role: 'super_admin' | 'tournament_director' | 'scorer';
  avatar_url?: string | null;
  is_active: boolean;
  last_login?: string | null;
  created_at: string;
  updated_at: string;
}

export interface DbAuditLog {
  id: string;
  action: string;
  entity_type: string;
  entity_id?: string | null;
  user_id?: string | null;
  user_email?: string | null;
  details_json: Record<string, any>;
  ip_address?: string | null;
  created_at: string;
}

export interface DbRegistrationToken {
  id: string;
  token: string;
  season_slug: string;
  label?: string | null;
  is_active: boolean;
  submissions_count: number;
  revoked_at?: string | null;
  created_at: string;
}

export interface Database {
  public: {
    Tables: {
      players: {
        Row: DbPlayer;
        Insert: Partial<DbPlayer> & { name: string };
        Update: Partial<DbPlayer>;
      };
      teams: {
        Row: DbTeam;
        Insert: Partial<DbTeam> & { name: string };
        Update: Partial<DbTeam>;
      };
      team_players: {
        Row: DbTeamPlayer;
        Insert: Partial<DbTeamPlayer> & { team_id: string; player_id: string };
        Update: Partial<DbTeamPlayer>;
      };
      registrations: {
        Row: DbRegistration;
        Insert: Partial<DbRegistration> & { name: string; mobile: string; reg_id: string };
        Update: Partial<DbRegistration>;
      };
      registration_form_config: {
        Row: DbRegistrationFormConfig;
        Insert: Partial<DbRegistrationFormConfig> & { season_slug: string; tournament_name: string; season_title: string };
        Update: Partial<DbRegistrationFormConfig>;
      };
      registration_form_versions: {
        Row: DbRegistrationFormVersion;
        Insert: Partial<DbRegistrationFormVersion> & { form_config_id: string; season_slug: string; version_num: number; snapshot_json: Record<string, any> };
        Update: Partial<DbRegistrationFormVersion>;
      };
      matches: {
        Row: DbMatch;
        Insert: Partial<DbMatch> & { id: string };
        Update: Partial<DbMatch>;
      };
      match_scores: {
        Row: DbMatchScore;
        Insert: Partial<DbMatchScore> & { match_id: string; set_number: number; score_a: number; score_b: number };
        Update: Partial<DbMatchScore>;
      };
      tournament_standings: {
        Row: DbTournamentStanding;
        Insert: Partial<DbTournamentStanding> & { team_id: string };
        Update: Partial<DbTournamentStanding>;
      };
      admin_users: {
        Row: DbAdminUser;
        Insert: Partial<DbAdminUser> & { username: string; email: string; name: string };
        Update: Partial<DbAdminUser>;
      };
      audit_logs: {
        Row: DbAuditLog;
        Insert: Partial<DbAuditLog> & { action: string; entity_type: string };
        Update: Partial<DbAuditLog>;
      };
      registration_tokens: {
        Row: DbRegistrationToken;
        Insert: Partial<DbRegistrationToken> & { token: string };
        Update: Partial<DbRegistrationToken>;
      };
    };
  };
}
