import { supabase, isSupabaseConfigured } from '../lib/supabase';
import {
  Player,
  Team,
  Match,
  KnockoutData,
  KnockoutMatch,
  PlayoffRoundType,
  Registration,
  RegistrationFormConfig,
  RegistrationTokenRecord,
  PaymentStatus,
  StandingsRecord,
  TournamentSettings,
  PaymentSettings,
  HeroConfig,
  HeroVersionRecord,
  YouTubeLiveConfig,
  TournamentSeason,
  TournamentSeasonStatus,
  SeasonSummaryCounts,
  SeasonActivationCheckResult,
  SeasonArchiveSnapshot,
  CreateSeasonInput,
  UpdateSeasonInput,
  ActivateSeasonResult,
  PredefinedTeam,
} from '../types/tournament';
import { calculateRegistrationStats, createDefaultFormConfig } from '../utils/tournamentEngine';
import {
  DEFAULT_HERO_CONFIG,
  normalizeHeroConfig,
  cloneHeroConfig,
  buildSeasonInitialHeroConfig,
} from '../utils/heroDefaults';
import {
  DEFAULT_YOUTUBE_LIVE_CONFIG,
  normalizeYouTubeLiveConfig,
  extractYouTubeVideoId,
} from '../utils/youtube';
import {
  DEFAULT_PLAYOFF_SETTINGS,
  inferPlayoffRound,
  normalizePlayoffSettings,
} from '../utils/playoffEngine';
import { AuthService } from './authService';
import {
  parseMatchScheduleTime,
  sortMatchesByScheduleOrder,
} from '../utils/scheduleEditorEngine';
import {
  DbPlayer,
  DbTeam,
  DbMatch,
  DbRegistration,
  DbRegistrationFormConfig,
  DbRegistrationToken,
  DbTournamentSeason,
} from '../types/database.types';

export class SupabaseService {
  private static seasonsTableAvailable: boolean | null = null;
  private static seasonIdColumnSupport = new Map<string, boolean>();

  static isAvailable(): boolean {
    return isSupabaseConfigured();
  }

  private static isMissingRelationOrColumnError(err: any, columnName?: string): boolean {
    const code = String(err?.code || '');
    const msg = String(err?.message || '').toLowerCase();
    if (code === 'PGRST205' || code === '42P01' || msg.includes('does not exist') && msg.includes('relation')) {
      return true;
    }
    if (columnName && (code === '42703' || code === 'PGRST204' || msg.includes(columnName.toLowerCase()))) {
      return true;
    }
    return false;
  }

  static async hasTournamentSeasonsTable(): Promise<boolean> {
    if (!this.isAvailable()) return false;
    if (this.seasonsTableAvailable !== null) return this.seasonsTableAvailable;
    try {
      const { error } = await (supabase.from('tournament_seasons' as any) as any)
        .select('id')
        .limit(1);
      if (error && this.isMissingRelationOrColumnError(error)) {
        this.seasonsTableAvailable = false;
        return false;
      }
      this.seasonsTableAvailable = !error;
      return this.seasonsTableAvailable;
    } catch {
      this.seasonsTableAvailable = false;
      return false;
    }
  }

  static async hasSeasonIdColumn(tableName: string): Promise<boolean> {
    if (!this.isAvailable()) return false;
    const cached = this.seasonIdColumnSupport.get(tableName);
    if (cached !== undefined) return cached;
    try {
      const { error } = await (supabase.from(tableName as any) as any)
        .select('season_id')
        .limit(1);
      if (error && this.isMissingRelationOrColumnError(error, 'season_id')) {
        this.seasonIdColumnSupport.set(tableName, false);
        return false;
      }
      const supported = !error;
      this.seasonIdColumnSupport.set(tableName, supported);
      return supported;
    } catch {
      this.seasonIdColumnSupport.set(tableName, false);
      return false;
    }
  }

  private static inferSeasonNumberFromText(text?: string | null, fallback = '3.0'): string {
    const raw = String(text || '');
    const decimalMatch = raw.match(/\b(\d+\.\d+)\b/);
    if (decimalMatch) return decimalMatch[1];
    if (/\bseason\s*iv\b/i.test(raw) && !/\b4\.0\b/.test(raw)) return '3.0';
    if (/\bseason\s*iii\b/i.test(raw)) return '3.0';
    if (/\bseason\s*v\b/i.test(raw)) return '5.0';
    return fallback;
  }

  private static mapDbSeason(row: DbTournamentSeason | any): TournamentSeason {
    const settingsJson = (row.settings_json && typeof row.settings_json === 'object' ? row.settings_json : {}) as Record<string, any>;
    const status = (row.status || (row.is_active ? 'active' : 'upcoming')) as TournamentSeasonStatus;
    return {
      id: String(row.id),
      leagueName: String(row.league_name || 'SMASH PREMIER LEAGUE'),
      leagueShortName: String(row.league_short_name || 'SPL'),
      seasonNumber: String(row.season_number || '3.0'),
      editionName: String(row.edition_name || 'CHAMPION EDITION'),
      seasonTitle: String(row.season_title || settingsJson.seasonTitle || `Season ${row.season_number || '3.0'} (${row.edition_name || 'Edition'})`),
      seasonSlug: String(row.season_slug || 'season-4'),
      tournamentYear: Number(row.tournament_year || new Date().getFullYear()),
      status,
      isActive: Boolean(row.is_active),
      isLocked: Boolean(row.is_locked || status === 'archived'),
      entryFee: Number(row.entry_fee ?? settingsJson.entryFee ?? 500),
      maxSlots: Number(row.max_slots ?? settingsJson.maxSlots ?? 32),
      courtsCount: Number(row.courts_count ?? settingsJson.courts ?? 2),
      courtNames: Array.isArray(settingsJson.courtNames) ? settingsJson.courtNames : undefined,
      venue: row.venue || settingsJson.venue || undefined,
      organizer: row.organizer || settingsJson.organizer || undefined,
      date: row.date || settingsJson.date || undefined,
      startDate: settingsJson.startDate || undefined,
      endDate: settingsJson.endDate || undefined,
      description: settingsJson.description || undefined,
      announcement: settingsJson.announcement || undefined,
      scoringRules: settingsJson.scoringRules || undefined,
      playoffSettings: settingsJson.playoffSettings ? normalizePlayoffSettings(settingsJson.playoffSettings) : undefined,
      registrationEnabled: settingsJson.registrationEnabled !== undefined ? Boolean(settingsJson.registrationEnabled) : true,
      historicalSummary: settingsJson.historicalSummary || undefined,
      createdAt: row.created_at ? new Date(row.created_at).getTime() : undefined,
      updatedAt: row.updated_at ? new Date(row.updated_at).getTime() : undefined,
    };
  }

  static synthesizeSeasonFromFormConfig(row?: DbRegistrationFormConfig | null): TournamentSeason {
    const appJson = (row?.appearance_json as any) || {};
    const tSettings = appJson.tournamentSettings || {};
    const slug = row?.season_slug || 'season-4';
    const seasonTitle = row?.season_title || tSettings.season || 'Season IV (Championship Edition)';
    const inferredNumber =
      String(appJson.seasonNumber || '').trim() ||
      (slug === 'season-4' ? '3.0' : this.inferSeasonNumberFromText(seasonTitle, '3.0'));
    const editionName =
      String(appJson.editionName || '').trim() ||
      (inferredNumber === '3.0' ? 'CHAMPION EDITION' : 'To Be Announced');
    const yearMatch = String(row?.date || '').match(/\b(20\d{2})\b/);
    const tournamentYear = Number(appJson.tournamentYear) || (yearMatch ? Number(yearMatch[1]) : 2026);
    const resolvedDate = row?.date || tSettings.date || (slug === 'season-4' ? '2026-10-25' : undefined);

    return {
      id: String(row?.season_id || row?.id || slug),
      leagueName: 'SMASH PREMIER LEAGUE',
      leagueShortName: 'SPL',
      seasonNumber: inferredNumber,
      editionName,
      seasonTitle,
      seasonSlug: slug,
      tournamentYear,
      status: (appJson.seasonStatus as TournamentSeasonStatus) || (slug === 'season-4' ? 'active' : 'upcoming'),
      isActive: slug === 'season-4',
      isLocked: appJson.seasonStatus === 'archived',
      entryFee: Number(row?.entry_fee ?? tSettings.entryFee ?? 500),
      maxSlots: Number(row?.max_slots ?? tSettings.slotLimit ?? 32),
      courtsCount: Number(appJson.courts ?? tSettings.courts ?? 2),
      courtNames: Array.isArray(appJson.courtNames) ? appJson.courtNames : Array.isArray(tSettings.courtNames) ? tSettings.courtNames : undefined,
      venue: row?.venue || tSettings.venue || 'Maharajganj Indoor Badminton Stadium',
      organizer: tSettings.organizer || 'SPL Tournament Committee',
      date: resolvedDate,
      announcement: tSettings.announcement || undefined,
      scoringRules: tSettings.scoringRules || undefined,
      playoffSettings: tSettings.playoffSettings ? normalizePlayoffSettings(tSettings.playoffSettings) : undefined,
      registrationEnabled: row?.enabled !== false,
      historicalSummary:
        appJson.historicalSummary ||
        (slug === 'season-4'
          ? {
              champions: 'Karan & Saptrishi',
              championTeam: 'Team Karan',
              runnersUp: 'Alok & Ravi',
              runnerUpTeam: 'Team Alok',
            }
          : undefined),
      createdAt: row?.created_at ? new Date(row.created_at).getTime() : undefined,
      updatedAt: row?.updated_at ? new Date(row.updated_at).getTime() : undefined,
    };
  }

  static getDefaultFallbackSeason(): TournamentSeason {
    return this.synthesizeSeasonFromFormConfig(null);
  }

  static async fetchSeasons(): Promise<TournamentSeason[]> {
    if (!this.isAvailable()) {
      return [this.getDefaultFallbackSeason()];
    }
    try {
      const hasTable = await this.hasTournamentSeasonsTable();
      if (hasTable) {
        const { data, error } = await (supabase.from('tournament_seasons' as any) as any)
          .select('*')
          .order('tournament_year', { ascending: false })
          .order('created_at', { ascending: false });
        if (!error && Array.isArray(data) && data.length > 0) {
          return data.map((row: any) => this.mapDbSeason(row));
        }
      }

      // Fallback before Phase 2 migration: derive seasons from registration_form_config
      const { data: formRows } = await supabase
        .from('registration_form_config')
        .select('*')
        .order('updated_at', { ascending: false });
      if (Array.isArray(formRows) && formRows.length > 0) {
        return (formRows as DbRegistrationFormConfig[]).map((r) => this.synthesizeSeasonFromFormConfig(r));
      }
    } catch {}
    return [this.getDefaultFallbackSeason()];
  }

  static async fetchActiveSeason(): Promise<TournamentSeason> {
    if (!this.isAvailable()) {
      return this.getDefaultFallbackSeason();
    }
    try {
      const hasTable = await this.hasTournamentSeasonsTable();
      if (hasTable) {
        const { data: activeRow, error } = await (supabase.from('tournament_seasons' as any) as any)
          .select('*')
          .eq('is_active', true)
          .order('updated_at', { ascending: false })
          .limit(1)
          .maybeSingle();
        if (!error && activeRow) {
          return this.mapDbSeason(activeRow);
        }

        const { data: firstRow } = await (supabase.from('tournament_seasons' as any) as any)
          .select('*')
          .order('tournament_year', { ascending: false })
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();
        if (firstRow) {
          return this.mapDbSeason(firstRow);
        }
      }

      const row = await this.fetchFormConfigRow('season-4', { allowFallback: true });
      return this.synthesizeSeasonFromFormConfig(row);
    } catch {
      return this.getDefaultFallbackSeason();
    }
  }

  static async resolveSeasonContext(seasonSlugOrId?: string): Promise<TournamentSeason> {
    if (!seasonSlugOrId) return this.fetchActiveSeason();
    const seasons = await this.fetchSeasons();
    const matched = seasons.find(
      (s) => s.seasonSlug === seasonSlugOrId || s.id === seasonSlugOrId || s.seasonNumber === seasonSlugOrId
    );
    if (matched) return matched;
    if (this.isAvailable()) {
      const row = await this.fetchFormConfigRow(seasonSlugOrId, { allowFallback: false });
      if (row) return this.synthesizeSeasonFromFormConfig(row);
    }
    return this.fetchActiveSeason();
  }

  static async fetchSeasonSummaries(
    seasonsList?: TournamentSeason[]
  ): Promise<Record<string, SeasonSummaryCounts>> {
    const out: Record<string, SeasonSummaryCounts> = {};
    try {
      const res = await fetch(`/api/seasons/summaries?t=${Date.now()}`, { cache: 'no-store' });
      if (res.ok) {
        const data = await res.json().catch(() => null);
        if (data?.summaries && typeof data.summaries === 'object') {
          Object.assign(out, data.summaries);
        }
      }
    } catch {}

    if (this.isAvailable()) {
      try {
        const list = seasonsList && seasonsList.length > 0 ? seasonsList : await this.fetchSeasons();
        await Promise.all(
          list.map(async (s) => {
            const slug = s.seasonSlug;
            const prev = out[slug] || {
              seasonSlug: slug,
              seasonId: s.id,
              registeredPlayers: 0,
              rosterPlayers: 0,
              teamsCount: 0,
              matchesCount: 0,
              liveMatchesCount: 0,
            };
            const [regRes, teamRes, matchRes] = await Promise.all([
              supabase.from('registrations').select('id', { count: 'exact', head: true }).eq('season_slug', slug),
              supabase.from('teams').select('id', { count: 'exact', head: true }).eq('season_slug', slug),
              supabase.from('matches').select('id, status').eq('tournament_season', slug),
            ]);
            const matchesArr = Array.isArray(matchRes.data) ? matchRes.data : [];
            const liveInDb = matchesArr.filter(
              (m: any) => m.status === 'live' || m.status === 'paused'
            ).length;
            out[slug] = {
              seasonSlug: slug,
              seasonId: s.id,
              registeredPlayers: Math.max(prev.registeredPlayers, regRes.count || 0),
              rosterPlayers: Math.max(prev.rosterPlayers, 0),
              teamsCount: Math.max(prev.teamsCount, teamRes.count || 0),
              matchesCount: Math.max(prev.matchesCount, matchesArr.length),
              liveMatchesCount: Math.max(prev.liveMatchesCount, liveInDb),
            };
          })
        );
      } catch {}
    }
    return out;
  }

  static async switchGlobalActiveSeason(seasonSlugOrId: string): Promise<TournamentSeason | null> {
    if (!this.isAvailable() || !seasonSlugOrId) return null;
    try {
      const hasTable = await this.hasTournamentSeasonsTable();
      if (!hasTable) {
        return await this.resolveSeasonContext(seasonSlugOrId);
      }
      const seasons = await this.fetchSeasons();
      const target = seasons.find((s) => s.id === seasonSlugOrId || s.seasonSlug === seasonSlugOrId);
      if (!target) return null;
      const prevActive = seasons.find((s) => s.isActive);

      const nowIso = new Date().toISOString();
      const { error: clearErr } = await (supabase.from('tournament_seasons' as any) as any)
        .update({ is_active: false, updated_at: nowIso })
        .neq('id', target.id);
      if (clearErr) return null;

      const nextStatus: TournamentSeasonStatus =
        target.status === 'archived' || target.status === 'completed' ? target.status : 'active';
      const { data: updated, error } = await (supabase.from('tournament_seasons' as any) as any)
        .update({ is_active: true, status: nextStatus, updated_at: nowIso })
        .eq('id', target.id)
        .select('*')
        .single();

      if (error || !updated) {
        // Atomic rollback to previous active season
        if (prevActive) {
          await (supabase.from('tournament_seasons' as any) as any)
            .update({ is_active: true, updated_at: nowIso })
            .eq('id', prevActive.id);
        }
        return null;
      }
      void this.logAudit('season_switched_active', 'tournament_seasons', target.id, {
        seasonSlug: target.seasonSlug,
        seasonNumber: target.seasonNumber,
      }, undefined, target.id);
      return this.mapDbSeason(updated);
    } catch {
      return null;
    }
  }

  static async activateSeasonSafely(
    seasonIdOrSlug: string,
    options?: { checkOngoingMatches?: boolean; force?: boolean }
  ): Promise<ActivateSeasonResult> {
    if (!seasonIdOrSlug) {
      return { success: false, error: 'Target season is required.' };
    }
    const checkOngoingMatches = options?.checkOngoingMatches !== false;
    const force = Boolean(options?.force);

    try {
      if (this.isAvailable()) {
        // Phase 5 Verification Gate: never report Supabase activation success if tournament_seasons table is missing
        this.seasonsTableAvailable = null;
        const hasTable = await this.hasTournamentSeasonsTable();
        if (!hasTable) {
          return {
            success: false,
            error:
              'Database migration required: public.tournament_seasons table was not found in Supabase. Run supabase/migrations/20261117_multi_season_schema.sql in Supabase SQL Editor before activating globally.',
          };
        }

        if (checkOngoingMatches && !force) {
          const currentActive = await this.fetchActiveSeason();
          if (
            currentActive &&
            currentActive.seasonSlug !== seasonIdOrSlug &&
            currentActive.id !== seasonIdOrSlug
          ) {
            const { data: liveRows } = await supabase
              .from('matches')
              .select('id, status')
              .eq('tournament_season', currentActive.seasonSlug)
              .in('status', ['live', 'paused', 'postponed']);
            const liveCount = Array.isArray(liveRows) ? liveRows.length : 0;
            if (liveCount > 0) {
              return {
                success: false,
                requiresConfirmation: true,
                liveMatchesCount: liveCount,
                error: `${liveCount} live or paused match(es) are in progress in SPL ${currentActive.seasonNumber}.`,
              };
            }
          }
        }
      }

      const apiRes = await fetch('/api/seasons/active', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...AuthService.getAuthHeader() },
        body: JSON.stringify({
          seasonIdOrSlug,
          checkOngoingMatches,
          force,
        }),
      }).catch(() => null);

      if (apiRes) {
        const apiData = await apiRes.json().catch(() => ({}));
        if (apiRes.status === 409 && apiData?.requiresConfirmation) {
          return {
            success: false,
            requiresConfirmation: true,
            liveMatchesCount: Number(apiData.liveMatchesCount || 1),
            error: apiData.error || 'Live matches are currently in progress.',
          };
        }
        if (!apiRes.ok) {
          if (!this.isAvailable()) {
            return { success: false, error: apiData?.error || 'Failed to activate season.' };
          }
        } else if (apiData?.activeSeason && !this.isAvailable()) {
          return { success: true, activeSeason: apiData.activeSeason };
        }
      }

      if (this.isAvailable()) {
        const switched = await this.switchGlobalActiveSeason(seasonIdOrSlug);
        if (!switched) {
          return { success: false, error: 'Failed to switch active season in Supabase.' };
        }
        return { success: true, activeSeason: switched };
      }

      return { success: false, error: 'Unable to activate selected season.' };
    } catch (err: any) {
      return { success: false, error: err?.message || 'Activation failed.' };
    }
  }

  static async createSeason(
    input: CreateSeasonInput
  ): Promise<{ success: boolean; season?: TournamentSeason; error?: string }> {
    if (!this.isAvailable()) {
      return { success: false, error: 'Supabase not configured.' };
    }
    const cleanSlug = input.seasonSlug.trim().toLowerCase().replace(/[^a-z0-9-]/g, '-');
    const cleanNumber = input.seasonNumber.trim();
    const cleanEdition = input.editionName.trim();
    const seasonTitle = (input.seasonTitle || `Smash Premier League — Season ${cleanNumber} (${cleanEdition})`).trim();
    const year = input.tournamentYear || new Date().getFullYear();
    const entryFee = input.entryFee ?? 500;
    const maxSlots = input.maxSlots ?? 32;
    const nowIso = new Date().toISOString();

    try {
      let sourceSeason: TournamentSeason | null = null;
      let sourceFormRow: DbRegistrationFormConfig | null = null;
      if (input.copySettingsFromSeasonSlug) {
        const allSeasons = await this.fetchSeasons();
        sourceSeason =
          allSeasons.find((s) => s.seasonSlug === input.copySettingsFromSeasonSlug) || null;
        sourceFormRow = await this.fetchFormConfigRow(input.copySettingsFromSeasonSlug, {
          allowFallback: false,
        });
      }

      const resolvedStatus: TournamentSeasonStatus = input.activateNow
        ? 'active'
        : input.status && ['upcoming', 'active'].includes(input.status)
          ? input.status
          : 'upcoming';

      const hasTable = await this.hasTournamentSeasonsTable();
      let createdSeason: TournamentSeason | null = null;
      let seasonId = cleanSlug;

      const resolvedVenue =
        input.venue || sourceSeason?.venue || 'Maharajganj Indoor Badminton Stadium';
      const resolvedOrganizer =
        input.organizer || sourceSeason?.organizer || 'SPL Tournament Committee';
      const resolvedCourts = input.courtsCount ?? sourceSeason?.courtsCount ?? 2;
      const resolvedCourtNames =
        input.courtNames || sourceSeason?.courtNames || ['Court 1', 'Court 2'];
      const resolvedRegistrationEnabled =
        input.registrationEnabled !== undefined ? Boolean(input.registrationEnabled) : true;
      const resolvedDate = (input.date || input.startDate || '').trim();

      const settingsJsonPayload: Record<string, any> = {
        description: input.description || '',
        startDate: input.startDate || '',
        endDate: input.endDate || '',
        courtNames: resolvedCourtNames,
        registrationEnabled: resolvedRegistrationEnabled,
        ...(input.historicalSummary ? { historicalSummary: input.historicalSummary } : {}),
        ...(sourceSeason?.scoringRules ? { scoringRules: sourceSeason.scoringRules } : {}),
        ...(sourceSeason?.playoffSettings ? { playoffSettings: sourceSeason.playoffSettings } : {}),
      };

      if (hasTable) {
        if (input.activateNow) {
          await (supabase.from('tournament_seasons' as any) as any)
            .update({ is_active: false, updated_at: nowIso })
            .neq('season_slug', cleanSlug);
        }

        const payload = {
          league_name: 'SMASH PREMIER LEAGUE',
          league_short_name: 'SPL',
          season_number: cleanNumber,
          edition_name: cleanEdition,
          season_title: seasonTitle,
          season_slug: cleanSlug,
          tournament_year: year,
          status: resolvedStatus,
          is_active: Boolean(input.activateNow),
          is_locked: false,
          entry_fee: entryFee,
          max_slots: maxSlots,
          courts_count: resolvedCourts,
          venue: resolvedVenue,
          organizer: resolvedOrganizer,
          date: resolvedDate || null,
          settings_json: settingsJsonPayload,
          updated_at: nowIso,
        };

        const { data: row, error } = await (supabase.from('tournament_seasons' as any) as any)
          .upsert(payload, { onConflict: 'season_slug' })
          .select('*')
          .single();

        if (error || !row) {
          return { success: false, error: error?.message || 'Failed to create season row.' };
        }
        createdSeason = this.mapDbSeason(row);
        seasonId = createdSeason.id;
      }

      // Bootstrap isolated registration_form_config & season Hero branding (never cloning players/teams/matches/registrations)
      const existingForm = await this.fetchFormConfigRow(cleanSlug, { allowFallback: false });
      if (!existingForm) {
        const defaultForm = createDefaultFormConfig(cleanSlug, 'Smash Premier League', seasonTitle);
        defaultForm.entryFee = entryFee;
        defaultForm.maxSlots = maxSlots;
        defaultForm.venue = resolvedVenue;
        defaultForm.date = resolvedDate;
        defaultForm.enabled = resolvedRegistrationEnabled;

        if (sourceFormRow) {
          if (Array.isArray(sourceFormRow.fields_json) && sourceFormRow.fields_json.length > 0) {
            defaultForm.fields = sourceFormRow.fields_json as any;
          }
          if (sourceFormRow.payment_config_json && typeof sourceFormRow.payment_config_json === 'object') {
            defaultForm.payment = {
              ...(defaultForm.payment as any),
              ...(sourceFormRow.payment_config_json as any),
              baseFee: entryFee,
            };
          }
        }

        const initialHero = buildSeasonInitialHeroConfig({
          seasonNumber: cleanNumber,
          editionName: cleanEdition,
          leagueName: 'SMASH PREMIER LEAGUE',
          seasonSlug: cleanSlug,
        });

        (defaultForm.appearance as any).seasonNumber = cleanNumber;
        (defaultForm.appearance as any).editionName = cleanEdition;
        (defaultForm.appearance as any).tournamentYear = year;
        (defaultForm.appearance as any).seasonStatus = resolvedStatus;
        (defaultForm.appearance as any).heroPublished = { ...initialHero, status: 'published' };
        (defaultForm.appearance as any).heroDraft = { ...initialHero, status: 'draft' };

        await this.saveFormConfig(defaultForm, true, seasonId);
      }

      const resolved = createdSeason || (await this.resolveSeasonContext(cleanSlug));
      return { success: true, season: resolved };
    } catch (err: any) {
      return { success: false, error: err?.message || 'Failed creating tournament season.' };
    }
  }

  static async updateSeason(
    seasonIdOrSlug: string,
    updates: UpdateSeasonInput
  ): Promise<{ success: boolean; season?: TournamentSeason; error?: string }> {
    if (!seasonIdOrSlug) return { success: false, error: 'Season identifier required.' };
    try {
      let updatedSeason: TournamentSeason | undefined;
      if (this.isAvailable()) {
        const hasTable = await this.hasTournamentSeasonsTable();
        const seasons = await this.fetchSeasons();
        const current = seasons.find(
          (s) => s.id === seasonIdOrSlug || s.seasonSlug === seasonIdOrSlug
        );
        if (current) {
          const nextStatus = updates.status || current.status;
          if (current.isLocked && updates.status === undefined) {
            return { success: false, error: 'Archived season is read-only. Unarchive it first to edit.' };
          }
          const nextNumber =
            updates.seasonNumber !== undefined ? updates.seasonNumber.trim() : current.seasonNumber;
          const nextEdition =
            updates.editionName !== undefined ? updates.editionName.trim() : current.editionName;
          const nextTitle =
            updates.seasonTitle !== undefined
              ? updates.seasonTitle.trim()
              : updates.seasonNumber !== undefined || updates.editionName !== undefined
                ? `Smash Premier League — Season ${nextNumber} (${nextEdition})`
                : current.seasonTitle;

          if (hasTable) {
            const { data: existingRow } = await (supabase.from('tournament_seasons' as any) as any)
              .select('settings_json')
              .eq('id', current.id)
              .maybeSingle();
            const existingSettings =
              (existingRow?.settings_json && typeof existingRow.settings_json === 'object'
                ? existingRow.settings_json
                : {}) as Record<string, any>;

            const mergedSettings = {
              ...existingSettings,
              ...(updates.description !== undefined ? { description: updates.description.trim() } : {}),
              ...(updates.startDate !== undefined ? { startDate: updates.startDate.trim() } : {}),
              ...(updates.endDate !== undefined ? { endDate: updates.endDate.trim() } : {}),
              ...(Array.isArray(updates.courtNames) ? { courtNames: updates.courtNames } : {}),
              ...(updates.registrationEnabled !== undefined ? { registrationEnabled: updates.registrationEnabled } : {}),
              ...(updates.historicalSummary !== undefined ? { historicalSummary: updates.historicalSummary } : {}),
            };

            const nowIso = new Date().toISOString();
            const { data: updatedRow, error } = await (supabase.from('tournament_seasons' as any) as any)
              .update({
                season_number: nextNumber || current.seasonNumber,
                edition_name: nextEdition || current.editionName,
                season_title: nextTitle || current.seasonTitle,
                tournament_year: updates.tournamentYear ?? current.tournamentYear,
                entry_fee: updates.entryFee ?? current.entryFee,
                max_slots: updates.maxSlots ?? current.maxSlots,
                courts_count: updates.courtsCount ?? current.courtsCount,
                venue: updates.venue !== undefined ? updates.venue.trim() : current.venue,
                organizer: updates.organizer !== undefined ? updates.organizer.trim() : current.organizer,
                date: updates.date !== undefined ? (updates.date.trim() || null) : (current.date || null),
                status: nextStatus,
                is_locked: nextStatus === 'archived',
                settings_json: mergedSettings,
                updated_at: nowIso,
              })
              .eq('id', current.id)
              .select('*')
              .single();

            if (error || !updatedRow) {
              return { success: false, error: error?.message || 'Failed to update season in database.' };
            }
            updatedSeason = this.mapDbSeason(updatedRow);
          }

          // Also sync form_config metadata & auto-generated hero texts if edition/number changed
          const formRow = await this.fetchFormConfigRow(current.seasonSlug, { allowFallback: false });
          if (formRow) {
            const app = ((formRow.appearance_json as any) || {}) as Record<string, any>;
            const patchHero = (rawHero: any) => {
              if (!rawHero || typeof rawHero !== 'object') return rawHero;
              const copy = cloneHeroConfig(normalizeHeroConfig(rawHero));
              if (copy.text.kickerText.toUpperCase() === current.editionName.toUpperCase()) {
                copy.text.kickerText = nextEdition.toUpperCase();
              }
              if (
                copy.logo.subtitle.toUpperCase() ===
                `SPL ${current.seasonNumber} · ${current.editionName}`.toUpperCase()
              ) {
                copy.logo.subtitle = `SPL ${nextNumber} · ${nextEdition.toUpperCase()}`;
              }
              if (copy.text.mainHeading.text.includes(current.seasonNumber)) {
                copy.text.mainHeading.text = copy.text.mainHeading.text.replace(
                  current.seasonNumber,
                  nextNumber
                );
              }
              return copy;
            };
            const nextApp = {
              ...app,
              seasonNumber: nextNumber,
              editionName: nextEdition,
              tournamentYear: updates.tournamentYear ?? current.tournamentYear,
              seasonStatus: nextStatus,
              ...(app.heroPublished ? { heroPublished: patchHero(app.heroPublished) } : {}),
              ...(app.heroDraft ? { heroDraft: patchHero(app.heroDraft) } : {}),
            };
            await (supabase.from('registration_form_config') as any)
              .update({
                season_title: nextTitle,
                entry_fee: updates.entryFee ?? current.entryFee,
                max_slots: updates.maxSlots ?? current.maxSlots,
                venue: updates.venue !== undefined ? updates.venue.trim() : current.venue,
                date: updates.date !== undefined ? updates.date.trim() : current.date,
                appearance_json: nextApp,
                updated_at: new Date().toISOString(),
              })
              .eq('id', formRow.id);
          }
        }
      }

      const apiRes = await fetch(`/api/seasons/${encodeURIComponent(seasonIdOrSlug)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', ...AuthService.getAuthHeader() },
        body: JSON.stringify(updates),
      }).catch(() => null);
      if (apiRes) {
        const apiData = await apiRes.json().catch(() => ({}));
        if (!apiRes.ok && !updatedSeason) {
          return { success: false, error: apiData?.error || 'Failed to update season.' };
        }
        if (apiData?.season && !updatedSeason) {
          updatedSeason = apiData.season;
        }
      }

      if (!updatedSeason) {
        return { success: false, error: 'Unable to update season metadata.' };
      }
      return { success: true, season: updatedSeason };
    } catch (err: any) {
      return { success: false, error: err?.message || 'Error updating season.' };
    }
  }

  static async updateSeasonStatus(
    seasonIdOrSlug: string,
    status: TournamentSeasonStatus
  ): Promise<boolean> {
    if (!this.isAvailable() || !seasonIdOrSlug) return false;
    try {
      const hasTable = await this.hasTournamentSeasonsTable();
      const nowIso = new Date().toISOString();
      if (hasTable) {
        const isLocked = status === 'archived';
        const { error } = await (supabase.from('tournament_seasons' as any) as any)
          .update({ status, is_locked: isLocked, updated_at: nowIso })
          .or(`id.eq.${seasonIdOrSlug},season_slug.eq.${seasonIdOrSlug}`);
        return !error;
      }
      const row = await this.fetchFormConfigRow(seasonIdOrSlug, { allowFallback: false });
      if (!row) return false;
      const app = (row.appearance_json as any) || {};
      const { error } = await (supabase.from('registration_form_config') as any)
        .update({
          appearance_json: { ...app, seasonStatus: status },
          updated_at: nowIso,
        })
        .eq('id', row.id);
      return !error;
    } catch {
      return false;
    }
  }

  static async checkSeasonActivationReadiness(
    targetSeasonSlug: string
  ): Promise<SeasonActivationCheckResult> {
    const blockers: string[] = [];
    const warnings: string[] = [];
    let dbMigrationReady = true;
    let historicalDataVerified = false;
    let liveMatchesCount = 0;
    let designConfigReady = false;
    let targetSeasonExists = false;
    let currentActiveSlug = 'season-4';
    let spl3Summary: SeasonActivationCheckResult['spl3Summary'];

    try {
      const seasons = await this.fetchSeasons();
      const active = seasons.find((s) => s.isActive) || seasons[0];
      if (active) currentActiveSlug = active.seasonSlug;

      const target = seasons.find(
        (s) => s.seasonSlug === targetSeasonSlug || s.id === targetSeasonSlug
      );
      targetSeasonExists = Boolean(target);
      if (!targetSeasonExists) {
        blockers.push(`Target season "${targetSeasonSlug}" does not exist yet.`);
      }

      if (this.isAvailable()) {
        this.seasonsTableAvailable = null;
        dbMigrationReady = await this.hasTournamentSeasonsTable();
        if (!dbMigrationReady) {
          blockers.push(
            'Supabase database migration pending: public.tournament_seasons table is missing. Execute supabase/migrations/20261117_multi_season_schema.sql in Supabase SQL Editor.'
          );
        }

        const [spl3Players, spl3Teams, spl3Matches, spl3Regs, activeMatchesRes] = await Promise.all([
          this.fetchPlayers('season-4'),
          this.fetchTeams('season-4'),
          this.fetchMatches('season-4'),
          this.fetchRegistrations('season-4'),
          supabase
            .from('matches')
            .select('id, status')
            .eq('tournament_season', currentActiveSlug)
            .in('status', ['live', 'paused', 'postponed']),
        ]);

        liveMatchesCount = Array.isArray(activeMatchesRes.data) ? activeMatchesRes.data.length : 0;
        const regsArr = spl3Regs || [];
        const revenueStats = calculateRegistrationStats(regsArr);
        spl3Summary = {
          players: (spl3Players || []).length,
          teams: (spl3Teams || []).length,
          matches:
            ((spl3Matches?.matches || []).length) + ((spl3Matches?.knockout || []).length),
          registrations: regsArr.length,
          revenue: revenueStats.collected,
        };
        historicalDataVerified =
          spl3Summary.players > 0 || spl3Summary.teams > 0 || spl3Summary.registrations > 0;
        if (!historicalDataVerified) {
          warnings.push('Historical SPL 3.0 summary counts could not be verified from Supabase.');
        }

        if (target) {
          const hero = await this.fetchPublishedHeroConfig(target.seasonSlug);
          designConfigReady = Boolean(
            hero?.text?.mainHeading?.text?.includes(target.seasonNumber)
          );
        }
      } else {
        // Local Express server mode verification
        const [sumRes, snapRes] = await Promise.all([
          fetch(`/api/seasons/summaries?t=${Date.now()}`, { cache: 'no-store' }).catch(() => null),
          fetch(`/api/seasons/season-4/snapshot?t=${Date.now()}`, {
            headers: { ...AuthService.getAuthHeader() },
            cache: 'no-store',
          }).catch(() => null),
        ]);
        if (sumRes?.ok) {
          const sd = await sumRes.json().catch(() => null);
          const curSum = sd?.summaries?.[currentActiveSlug];
          if (curSum) liveMatchesCount = Number(curSum.liveMatchesCount || 0);
        }
        if (snapRes?.ok) {
          const snap = await snapRes.json().catch(() => null);
          if (snap) {
            spl3Summary = {
              players: Array.isArray(snap.players) ? snap.players.length : 0,
              teams: Array.isArray(snap.teams) ? snap.teams.length : 0,
              matches:
                (Array.isArray(snap.matches) ? snap.matches.length : 0) +
                (Array.isArray(snap.knockout?.matches) ? snap.knockout.matches.length : 0),
              registrations: Array.isArray(snap.registrations) ? snap.registrations.length : 0,
              revenue: Number(snap.revenueCollected || 0),
            };
            historicalDataVerified = true;
          }
        } else {
          historicalDataVerified = seasons.some((s) => s.seasonSlug === 'season-4');
        }
        if (target) {
          const hero = await this.fetchPublishedHeroConfig(target.seasonSlug);
          designConfigReady = Boolean(
            hero?.text?.mainHeading?.text?.includes(target.seasonNumber)
          );
        }
      }

      if (liveMatchesCount > 0) {
        warnings.push(`${liveMatchesCount} live or paused match(es) detected in active season.`);
      }
      if (target && !designConfigReady) {
        warnings.push(`Target season Hero heading should display SPL ${target.seasonNumber}.`);
      }
    } catch (err: any) {
      blockers.push(err?.message || 'Unable to verify activation readiness.');
    }

    const zeroLiveMatches = liveMatchesCount === 0;
    const seasonIsolationReady = targetSeasonExists;
    const ready = dbMigrationReady && targetSeasonExists && blockers.length === 0;

    return {
      ready,
      dbMigrationReady,
      historicalDataVerified,
      zeroLiveMatches,
      liveMatchesCount,
      designConfigReady,
      seasonIsolationReady,
      blockers,
      warnings,
      targetSeasonExists,
      currentActiveSlug,
      spl3Summary,
    };
  }

  static async fetchSeasonArchiveSnapshot(
    seasonSlug: string,
    seasonId?: string
  ): Promise<SeasonArchiveSnapshot | null> {
    if (!seasonSlug) return null;
    try {
      const seasons = await this.fetchSeasons();
      const matchedSeason =
        seasons.find((s) => s.seasonSlug === seasonSlug || s.id === seasonId) ||
        (await this.resolveSeasonContext(seasonSlug));

      if (!this.isAvailable()) {
        const res = await fetch(
          `/api/seasons/${encodeURIComponent(seasonSlug)}/snapshot?t=${Date.now()}`,
          {
            headers: { ...AuthService.getAuthHeader() },
            cache: 'no-store',
          }
        ).catch(() => null);
        if (res?.ok) {
          const data = await res.json().catch(() => null);
          if (data) return data as SeasonArchiveSnapshot;
        }
        return null;
      }

      const [players, teams, matchBundle, regs, dbStandings] = await Promise.all([
        this.fetchPlayers(matchedSeason.seasonSlug, matchedSeason.id),
        this.fetchTeams(matchedSeason.seasonSlug, matchedSeason.id),
        this.fetchMatches(matchedSeason.seasonSlug, matchedSeason.id),
        this.fetchRegistrations(matchedSeason.seasonSlug, matchedSeason.id),
        this.fetchStandings(matchedSeason.seasonSlug, matchedSeason.id),
      ]);

      const registrations = regs || [];
      const stats = calculateRegistrationStats(registrations);
      const matches = matchBundle?.matches || [];
      const koMatches = matchBundle?.knockout || [];

      return {
        season: matchedSeason,
        players: players || [],
        teams: teams || [],
        matches,
        knockout: {
          format: matchedSeason.playoffSettings?.format || 'top4',
          published: true,
          showOnPublicHomepage: true,
          matches: koMatches,
        },
        standings: dbStandings || [],
        registrations,
        revenueCollected: stats.collected,
        paidCount: stats.paidCount,
      };
    } catch {
      return null;
    }
  }

  // ============================================================================
  // 1. PLAYERS
  // ============================================================================
  private static mapDbPlayerRow(p: any, seasonSlug?: string, seasonId?: string): Player {
    return {
      id: p.id,
      name: p.name,
      mobile: p.mobile || undefined,
      age: p.age || undefined,
      gender: p.gender,
      skillLevel: p.skill_level === 'Pro' ? 'Pro' : p.skill_level === 'Intermediate' ? 'Intermediate' : 'Advanced',
      photoUrl: p.photo_url || undefined,
      registrationStatus: p.registration_status || 'direct',
      registrationId: p.registration_id || undefined,
      city: p.city || undefined,
      category: p.category || undefined,
      style: p.style || undefined,
      seasonId: seasonId || p.season_id || undefined,
      seasonSlug: seasonSlug || undefined,
    };
  }

  static async fetchPlayers(seasonSlug?: string, seasonId?: string): Promise<Player[] | null> {
    if (!this.isAvailable()) return null;
    try {
      if (!seasonSlug) {
        const { data, error } = await supabase
          .from('players')
          .select('*')
          .order('name', { ascending: true });
        if (error || !data) return null;
        return (data as DbPlayer[]).map((p) => this.mapDbPlayerRow(p));
      }

      // Season-scoped player resolution: collect player IDs belonging to this season's registrations and teams
      const [seasons, hasTeamSeasonCol, seasonTeams] = await Promise.all([
        this.fetchSeasons(),
        this.hasSeasonIdColumn('teams'),
        this.fetchTeams(seasonSlug, seasonId),
      ]);

      let regQuery = supabase
        .from('registrations')
        .select('player_id, reg_id, status')
        .eq('season_slug', seasonSlug);
      if (seasonId && (await this.hasSeasonIdColumn('registrations'))) {
        regQuery = (regQuery as any).or(`season_slug.eq.${seasonSlug},season_id.eq.${seasonId}`);
      }
      const { data: seasonRegs } = await regQuery;

      const seasonPlayerIds = new Set<string>();
      const regByPlayerId = new Map<string, { regId?: string; status?: string }>();

      for (const r of (seasonRegs || []) as any[]) {
        if (r.player_id) {
          seasonPlayerIds.add(String(r.player_id));
          regByPlayerId.set(String(r.player_id), {
            regId: r.reg_id || undefined,
            status: r.status || undefined,
          });
        }
      }
      for (const t of seasonTeams || []) {
        for (const pid of t.players || []) {
          if (pid) seasonPlayerIds.add(pid);
        }
        if (t.captainId) seasonPlayerIds.add(t.captainId);
      }

      const hasPlayerSeasonCol = await this.hasSeasonIdColumn('players');
      if (hasPlayerSeasonCol && seasonId) {
        const { data: directSeasonPlayers } = await (supabase.from('players') as any)
          .select('id')
          .eq('season_id', seasonId);
        for (const p of directSeasonPlayers || []) {
          if (p?.id) seasonPlayerIds.add(String(p.id));
        }
      }

      // Also inspect explicit seasonPlayerIds saved on form config appearance_json (direct-added players)
      const formRow = await this.fetchFormConfigRow(seasonSlug, { allowFallback: false });
      const trackedDirectIds: string[] = Array.isArray((formRow?.appearance_json as any)?.seasonPlayerIds)
        ? (formRow?.appearance_json as any).seasonPlayerIds
        : [];
      for (const pid of trackedDirectIds) {
        if (pid) seasonPlayerIds.add(String(pid));
      }

      // Single-season legacy compatibility: if only 1 season exists and team_players/registrations haven't tracked direct players yet
      const isSingleLegacySeason =
        seasons.length <= 1 && !hasTeamSeasonCol && seasons[0]?.seasonSlug === seasonSlug;

      if (seasonPlayerIds.size === 0 && !isSingleLegacySeason) {
        return [];
      }

      let playerQuery = supabase.from('players').select('*').order('name', { ascending: true });
      if (!isSingleLegacySeason || seasonPlayerIds.size > 0) {
        if (isSingleLegacySeason && trackedDirectIds.length === 0) {
          // Return all legacy players in single-season mode while enriching registration links
        } else {
          playerQuery = playerQuery.in('id', Array.from(seasonPlayerIds));
        }
      }

      const { data, error } = await playerQuery;
      if (error || !data) return null;

      return (data as DbPlayer[]).map((p) => {
        const mapped = this.mapDbPlayerRow(p, seasonSlug, seasonId);
        const regMeta = regByPlayerId.get(mapped.id);
        if (regMeta) {
          mapped.registrationId = regMeta.regId || mapped.registrationId;
          mapped.registrationStatus = (regMeta.status as any) || mapped.registrationStatus;
        }
        return mapped;
      });
    } catch {
      return null;
    }
  }

  static async findPlayerByMobileGlobal(mobile: string): Promise<Player | null> {
    if (!this.isAvailable()) return null;
    const clean = String(mobile || '').replace(/\D/g, '');
    if (!clean) return null;
    try {
      const { data, error } = await supabase
        .from('players')
        .select('*')
        .eq('mobile', clean)
        .limit(1)
        .maybeSingle();
      if (error || !data) return null;
      return this.mapDbPlayerRow(data);
    } catch {
      return null;
    }
  }

  static async upsertPlayer(player: Player, seasonSlug?: string, seasonId?: string): Promise<boolean> {
    if (!this.isAvailable()) return false;
    try {
      const hasSeasonCol = seasonId ? await this.hasSeasonIdColumn('players') : false;
      const payload: Record<string, any> = {
        id: player.id,
        name: player.name.trim(),
        mobile: player.mobile ? String(player.mobile).trim() : null,
        age: player.age ? Number(player.age) : null,
        gender: player.gender || 'M',
        skill_level: player.skillLevel === 'Pro' ? 'Pro' : player.skillLevel === 'Intermediate' ? 'Intermediate' : 'Advanced',
        photo_url: player.photoUrl || null,
        status: 'active',
        updated_at: new Date().toISOString(),
        ...(hasSeasonCol && seasonId ? { season_id: seasonId } : {}),
      };

      const { error } = await supabase.from('players').upsert(payload as any);
      if (error) {
        console.error('Supabase upsertPlayer error:', error.message);
        return false;
      }

      if (seasonSlug) {
        void this.trackSeasonEntityIds(seasonSlug, 'seasonPlayerIds', [player.id], 'merge');
      }
      return true;
    } catch (e: any) {
      console.error('Supabase upsertPlayer exception:', e?.message);
      return false;
    }
  }

  static async upsertPlayersBulk(players: Player[], seasonSlug?: string, seasonId?: string): Promise<boolean> {
    if (!this.isAvailable() || players.length === 0) return false;
    try {
      const hasSeasonCol = seasonId ? await this.hasSeasonIdColumn('players') : false;
      const rows = players.map((player) => ({
        id: player.id,
        name: player.name.trim(),
        mobile: player.mobile ? String(player.mobile).trim() : null,
        age: player.age ? Number(player.age) : null,
        gender: player.gender || 'M',
        skill_level: player.skillLevel === 'Pro' ? 'Pro' : player.skillLevel === 'Intermediate' ? 'Intermediate' : 'Advanced',
        photo_url: player.photoUrl || null,
        status: 'active',
        updated_at: new Date().toISOString(),
        ...(hasSeasonCol && seasonId ? { season_id: seasonId } : {}),
      }));

      const { error } = await supabase.from('players').upsert(rows as any);
      if (error) {
        console.error('Supabase upsertPlayersBulk error:', error.message);
        return false;
      }
      if (seasonSlug) {
        void this.trackSeasonEntityIds(
          seasonSlug,
          'seasonPlayerIds',
          players.map((p) => p.id).filter(Boolean),
          'merge'
        );
      }
      return true;
    } catch (e: any) {
      console.error('Supabase upsertPlayersBulk exception:', e?.message);
      return false;
    }
  }

  static async deletePlayer(id: string, seasonSlug?: string, seasonId?: string): Promise<boolean> {
    if (!this.isAvailable()) return false;
    try {
      if (seasonSlug) {
        // Scope removal to current season first; delete athlete row only if unreferenced in other seasons
        const seasonTeams = (await this.fetchTeams(seasonSlug, seasonId)) || [];
        const seasonTeamIds = seasonTeams.map((t) => t.id).filter(Boolean);
        if (seasonTeamIds.length > 0) {
          await (supabase.from('teams') as any)
            .update({ captain_id: null })
            .in('id', seasonTeamIds)
            .eq('captain_id', id);
          await supabase.from('team_players').delete().in('team_id', seasonTeamIds).eq('player_id', id);
        }
        await (supabase.from('registrations') as any)
          .update({ player_id: null })
          .eq('season_slug', seasonSlug)
          .eq('player_id', id);

        await this.trackSeasonEntityIds(seasonSlug, 'seasonPlayerIds', [id], 'remove');

        const [{ data: otherTeamRefs }, { data: otherRegRefs }] = await Promise.all([
          supabase.from('team_players').select('id').eq('player_id', id).limit(1),
          supabase.from('registrations').select('id').eq('player_id', id).limit(1),
        ]);
        if ((otherTeamRefs && otherTeamRefs.length > 0) || (otherRegRefs && otherRegRefs.length > 0)) {
          return true;
        }
      } else {
        await (supabase.from('teams') as any).update({ captain_id: null }).eq('captain_id', id);
        await supabase.from('team_players').delete().eq('player_id', id);
      }

      const { error } = await supabase.from('players').delete().eq('id', id);
      if (error) {
        console.error('Supabase deletePlayer error:', error.message);
        return false;
      }
      return true;
    } catch {
      return false;
    }
  }

  static async deletePlayersBulk(ids: string[], seasonSlug?: string, seasonId?: string): Promise<boolean> {
    if (!this.isAvailable() || ids.length === 0) return false;
    try {
      if (seasonSlug) {
        const seasonTeams = (await this.fetchTeams(seasonSlug, seasonId)) || [];
        const seasonTeamIds = seasonTeams.map((t) => t.id).filter(Boolean);
        if (seasonTeamIds.length > 0) {
          await (supabase.from('teams') as any)
            .update({ captain_id: null })
            .in('id', seasonTeamIds)
            .in('captain_id', ids);
          await supabase.from('team_players').delete().in('team_id', seasonTeamIds).in('player_id', ids);
        }
        await (supabase.from('registrations') as any)
          .update({ player_id: null })
          .eq('season_slug', seasonSlug)
          .in('player_id', ids);
        await this.trackSeasonEntityIds(seasonSlug, 'seasonPlayerIds', ids, 'remove');

        const [{ data: remainingTeamRefs }, { data: remainingRegRefs }] = await Promise.all([
          supabase.from('team_players').select('player_id').in('player_id', ids),
          supabase.from('registrations').select('player_id').in('player_id', ids),
        ]);
        const stillReferenced = new Set<string>([
          ...((remainingTeamRefs || []).map((r: any) => String(r.player_id))),
          ...((remainingRegRefs || []).map((r: any) => String(r.player_id))),
        ]);
        const deletableIds = ids.filter((pid) => !stillReferenced.has(pid));
        if (deletableIds.length === 0) return true;
        const { error } = await supabase.from('players').delete().in('id', deletableIds);
        return !error;
      }

      await (supabase.from('teams') as any).update({ captain_id: null }).in('captain_id', ids);
      await supabase.from('team_players').delete().in('player_id', ids);
      const { error } = await supabase.from('players').delete().in('id', ids);
      if (error) {
        console.error('Supabase deletePlayersBulk error:', error.message);
        return false;
      }
      return true;
    } catch {
      return false;
    }
  }

  static async clearPlayers(seasonSlug?: string, seasonId?: string): Promise<boolean> {
    if (!this.isAvailable()) return false;
    try {
      const targetSlug = seasonSlug || 'season-4';
      const seasonPlayers = (await this.fetchPlayers(targetSlug, seasonId)) || [];
      const playerIds = seasonPlayers.map((p) => p.id).filter(Boolean);
      const seasonTeams = (await this.fetchTeams(targetSlug, seasonId)) || [];
      const seasonTeamIds = seasonTeams.map((t) => t.id).filter(Boolean);

      if (seasonTeamIds.length > 0) {
        await (supabase.from('teams') as any)
          .update({ captain_id: null })
          .in('id', seasonTeamIds);
        await supabase.from('team_players').delete().in('team_id', seasonTeamIds);
      }

      await (supabase.from('registrations') as any)
        .update({ player_id: null })
        .eq('season_slug', targetSlug);
      await this.trackSeasonEntityIds(targetSlug, 'seasonPlayerIds', [], 'replace');

      if (playerIds.length === 0) return true;

      // Only delete athlete rows that have zero references remaining in other seasons
      const [{ data: otherTeamRefs }, { data: otherRegRefs }] = await Promise.all([
        supabase.from('team_players').select('player_id').in('player_id', playerIds),
        supabase.from('registrations').select('player_id').in('player_id', playerIds),
      ]);
      const referencedElsewhere = new Set<string>([
        ...((otherTeamRefs || []).map((r: any) => String(r.player_id))),
        ...((otherRegRefs || []).map((r: any) => String(r.player_id))),
      ]);
      const orphanPlayerIds = playerIds.filter((pid) => !referencedElsewhere.has(pid));
      if (orphanPlayerIds.length === 0) return true;

      const { error } = await supabase.from('players').delete().in('id', orphanPlayerIds);
      return !error;
    } catch {
      return false;
    }
  }

  private static async trackSeasonEntityIds(
    seasonSlug: string,
    key: 'seasonTeamIds' | 'seasonPlayerIds',
    ids: string[],
    mode: 'replace' | 'merge' | 'remove'
  ): Promise<void> {
    if (!this.isAvailable() || !seasonSlug) return;
    try {
      const row = await this.fetchFormConfigRow(seasonSlug, { allowFallback: false });
      if (!row) return;
      const app = (row.appearance_json as any) || {};
      const existing: string[] = Array.isArray(app[key]) ? app[key].map(String) : [];
      let next: string[];
      if (mode === 'replace') {
        next = Array.from(new Set(ids.filter(Boolean)));
      } else if (mode === 'merge') {
        next = Array.from(new Set([...existing, ...ids.filter(Boolean)]));
      } else {
        const removeSet = new Set(ids);
        next = existing.filter((x) => !removeSet.has(x));
      }
      await (supabase.from('registration_form_config') as any)
        .update({
          appearance_json: { ...app, [key]: next },
          updated_at: new Date().toISOString(),
        })
        .eq('id', row.id);
    } catch {}
  }

  private static encodeShortName(token?: string, lockedPlayerIds?: string[]): string | null {
    const cleanLocked = Array.from(new Set((lockedPlayerIds || []).filter(Boolean)));
    if (cleanLocked.length > 0) {
      return `${token || ''}::LOCKED:${cleanLocked.join(',')}`;
    }
    return token || null;
  }

  static decodeShortName(shortName?: string | null): {
    token?: string;
    lockedPlayerIds: string[];
  } {
    if (!shortName) return { token: undefined, lockedPlayerIds: [] };
    if (shortName.includes('::LOCKED:')) {
      const [tokPart, lockedPart] = shortName.split('::LOCKED:');
      return {
        token: tokPart ? tokPart : undefined,
        lockedPlayerIds: lockedPart ? lockedPart.split(',').filter(Boolean) : [],
      };
    }
    return { token: shortName, lockedPlayerIds: [] };
  }

  // ============================================================================
  // 2. TEAMS & ROSTERS
  // ============================================================================
  static async fetchTeams(seasonSlug?: string, seasonId?: string): Promise<Team[] | null> {
    if (!this.isAvailable()) return null;
    try {
      const hasTeamSeasonId = seasonId ? await this.hasSeasonIdColumn('teams') : false;
      let teamsQuery = supabase
        .from('teams')
        .select('*')
        .order('created_at', { ascending: true });

      if (hasTeamSeasonId && seasonId) {
        teamsQuery = teamsQuery.eq('season_id', seasonId);
      }

      const { data: teamsData, error: teamsErr } = await teamsQuery;
      if (teamsErr || !teamsData) return null;

      let filteredTeamsData = teamsData as DbTeam[];

      // Pre-Phase-2 fallback scoping when teams table doesn't yet have season_id
      if (seasonSlug && !hasTeamSeasonId) {
        const [seasons, formRow] = await Promise.all([
          this.fetchSeasons(),
          this.fetchFormConfigRow(seasonSlug, { allowFallback: false }),
        ]);
        const trackedTeamIds: string[] | undefined = Array.isArray((formRow?.appearance_json as any)?.seasonTeamIds)
          ? (formRow?.appearance_json as any).seasonTeamIds
          : undefined;

        if (trackedTeamIds) {
          const trackedSet = new Set(trackedTeamIds.map(String));
          filteredTeamsData = filteredTeamsData.filter((t) => trackedSet.has(t.id));
        } else if (seasons.length > 1) {
          // If multiple seasons exist without season_id column, check matches/standings belonging to this season
          const [{ data: seasonMatches }, { data: seasonStandings }] = await Promise.all([
            supabase.from('matches').select('team_a_id, team_b_id').eq('tournament_season', seasonSlug),
            supabase.from('tournament_standings').select('team_id').eq('season_slug', seasonSlug),
          ]);
          const ownedIds = new Set<string>();
          for (const m of (seasonMatches || []) as any[]) {
            if (m.team_a_id) ownedIds.add(String(m.team_a_id));
            if (m.team_b_id) ownedIds.add(String(m.team_b_id));
          }
          for (const s of (seasonStandings || []) as any[]) {
            if (s.team_id) ownedIds.add(String(s.team_id));
          }
          // Only claim untagged legacy teams for the first/default season when no explicit season_id exists
          const primaryLegacySlug = seasons[seasons.length - 1]?.seasonSlug || 'season-4';
          if (seasonSlug !== primaryLegacySlug) {
            filteredTeamsData = filteredTeamsData.filter((t) => ownedIds.has(t.id));
          }
        }
      }

      const teamIds = filteredTeamsData.map((t) => t.id).filter(Boolean);
      const rosterMap = new Map<string, string[]>();
      if (teamIds.length > 0) {
        const { data: rostersData } = await supabase
          .from('team_players')
          .select('*')
          .in('team_id', teamIds)
          .order('slot_index', { ascending: true });

        if (rostersData) {
          for (const item of rostersData as any[]) {
            const list = rosterMap.get(item.team_id) || [];
            list.push(item.player_id);
            rosterMap.set(item.team_id, list);
          }
        }
      }

      const seenIds = new Set<string>();
      const uniqueTeams: Team[] = [];
      for (const t of filteredTeamsData) {
        if (!t.id || seenIds.has(t.id)) continue;
        seenIds.add(t.id);
        const decoded = this.decodeShortName(t.short_name);
        uniqueTeams.push({
          id: t.id,
          name: t.name,
          token: decoded.token,
          lockedPlayerIds: decoded.lockedPlayerIds,
          captainId: t.captain_id || undefined,
          avatarColor: t.avatar_color || 'from-amber-500 to-orange-600',
          badge: t.badge || '🏸',
          locked: t.locked,
          players: rosterMap.get(t.id) || [],
          seasonId: seasonId || t.season_id || undefined,
          seasonSlug: seasonSlug || t.season_slug || undefined,
        });
      }
      return uniqueTeams;
    } catch {
      return null;
    }
  }

  static async updateTeamMetadata(
    id: string,
    updates: Partial<Team>,
    fallbackTeam?: Team
  ): Promise<boolean> {
    if (!this.isAvailable() || !id) return false;
    try {
      const patchPayload: Record<string, any> = {
        updated_at: new Date().toISOString(),
      };

      if (updates.name !== undefined) {
        patchPayload.name = updates.name.trim() || fallbackTeam?.name || 'Team';
      }
      if (updates.badge !== undefined) {
        patchPayload.badge = updates.badge || '🏸';
      }
      if (updates.avatarColor !== undefined) {
        patchPayload.avatar_color = updates.avatarColor || 'from-amber-500 to-orange-600';
      }
      if (updates.locked !== undefined) {
        patchPayload.locked = Boolean(updates.locked);
      }
      if (updates.captainId !== undefined) {
        patchPayload.captain_id = updates.captainId || null;
      }
      if (updates.token !== undefined || updates.lockedPlayerIds !== undefined) {
        const nextToken = updates.token !== undefined ? updates.token : fallbackTeam?.token;
        const nextLockedPlayers =
          updates.lockedPlayerIds !== undefined
            ? updates.lockedPlayerIds
            : fallbackTeam?.lockedPlayerIds;
        patchPayload.short_name = this.encodeShortName(nextToken, nextLockedPlayers);
      }

      let { data: updatedRows, error } = await (supabase.from('teams') as any)
        .update(patchPayload)
        .eq('id', id)
        .select('id');

      // Retry without captain_id if foreign key reference is not yet synced in players
      if (error && patchPayload.captain_id) {
        const retryRes = await (supabase.from('teams') as any)
          .update({ ...patchPayload, captain_id: null })
          .eq('id', id)
          .select('id');
        updatedRows = retryRes.data;
        error = retryRes.error;
      }

      if (error) {
        console.error('Supabase updateTeamMetadata error:', error.message);
      }

      // If the team row does not exist yet in Supabase, upsert the full team record safely
      if ((!updatedRows || updatedRows.length === 0) && fallbackTeam) {
        return await this.saveTeam(
          { ...fallbackTeam, ...updates, id },
          fallbackTeam.seasonSlug,
          fallbackTeam.seasonId
        );
      }

      // Only touch team_players if roster array was explicitly included in updates
      if (updates.players !== undefined) {
        await supabase.from('team_players').delete().eq('team_id', id);
        if (updates.players.length > 0) {
          const uniquePlayers = Array.from(new Set(updates.players.filter(Boolean)));
          const effectiveCaptain =
            updates.captainId !== undefined ? updates.captainId : fallbackTeam?.captainId;
          const resolvedSeasonId = fallbackTeam?.seasonId;
          const hasTpSeasonCol = resolvedSeasonId ? await this.hasSeasonIdColumn('team_players') : false;
          const rows = uniquePlayers.map((playerId, idx) => ({
            team_id: id,
            player_id: playerId,
            slot_index: idx,
            is_captain: effectiveCaptain === playerId,
            ...(hasTpSeasonCol && resolvedSeasonId ? { season_id: resolvedSeasonId } : {}),
          }));
          await supabase.from('team_players').insert(rows as any);
        }
      }

      return !error && Boolean(updatedRows && updatedRows.length > 0);
    } catch {
      return false;
    }
  }

  static async saveTeam(team: Team, seasonSlug?: string, seasonId?: string): Promise<boolean> {
    if (!this.isAvailable() || !team?.id) return false;
    try {
      const resolvedSeasonId = seasonId || team.seasonId;
      const resolvedSeasonSlug = seasonSlug || team.seasonSlug;
      const [hasTeamSeasonId, hasTpSeasonId] = resolvedSeasonId
        ? await Promise.all([
            this.hasSeasonIdColumn('teams'),
            this.hasSeasonIdColumn('team_players'),
          ])
        : [false, false];

      const teamPayload = {
        id: team.id,
        name: team.name,
        short_name: this.encodeShortName(team.token, team.lockedPlayerIds),
        captain_id: team.captainId || null,
        avatar_color: team.avatarColor || 'from-amber-500 to-orange-600',
        badge: team.badge || '🏸',
        locked: Boolean(team.locked),
        updated_at: new Date().toISOString(),
        ...(hasTeamSeasonId && resolvedSeasonId ? { season_id: resolvedSeasonId } : {}),
      };

      let { error } = await supabase
        .from('teams')
        .upsert(teamPayload as any, { onConflict: 'id' });

      if (error && teamPayload.captain_id) {
        const retry = await supabase
          .from('teams')
          .upsert({ ...teamPayload, captain_id: null } as any, { onConflict: 'id' });
        error = retry.error;
      }

      if (error) {
        console.error('Supabase saveTeam error:', error.message);
        return false;
      }

      await supabase.from('team_players').delete().eq('team_id', team.id);

      if (team.players && team.players.length > 0) {
        const uniquePlayers = Array.from(new Set(team.players.filter(Boolean)));
        const rows = uniquePlayers.map((playerId, idx) => ({
          team_id: team.id,
          player_id: playerId,
          slot_index: idx,
          is_captain: team.captainId === playerId,
          ...(hasTpSeasonId && resolvedSeasonId ? { season_id: resolvedSeasonId } : {}),
        }));
        await supabase.from('team_players').insert(rows as any);
      }

      if (resolvedSeasonSlug) {
        void this.trackSeasonEntityIds(resolvedSeasonSlug, 'seasonTeamIds', [team.id], 'merge');
      }
      return true;
    } catch {
      return false;
    }
  }

  static async saveTeamsBulk(teams: Team[], seasonSlug?: string, seasonId?: string): Promise<boolean> {
    if (!this.isAvailable()) return false;
    try {
      const uniqueMap = new Map<string, Team>();
      for (const t of teams) {
        if (t && t.id) {
          uniqueMap.set(t.id, t);
        }
      }
      const uniqueTeams = Array.from(uniqueMap.values());
      const targetSlug = seasonSlug || uniqueTeams[0]?.seasonSlug || 'season-4';
      const targetSeasonId = seasonId || uniqueTeams[0]?.seasonId;

      if (uniqueTeams.length === 0) {
        return await this.clearTeams(targetSlug, targetSeasonId);
      }

      const [hasTeamSeasonId, hasTpSeasonId, existingSeasonTeams] = await Promise.all([
        targetSeasonId ? this.hasSeasonIdColumn('teams') : Promise.resolve(false),
        targetSeasonId ? this.hasSeasonIdColumn('team_players') : Promise.resolve(false),
        this.fetchTeams(targetSlug, targetSeasonId),
      ]);

      const keepIds = uniqueTeams.map((t) => t.id);
      const keepIdSet = new Set(keepIds);
      const nowIso = new Date().toISOString();

      const teamPayloads = uniqueTeams.map((team) => ({
        id: team.id,
        name: team.name,
        short_name: this.encodeShortName(team.token, team.lockedPlayerIds),
        captain_id: team.captainId || null,
        avatar_color: team.avatarColor || 'from-amber-500 to-orange-600',
        badge: team.badge || '🏸',
        locked: Boolean(team.locked),
        updated_at: nowIso,
        ...(hasTeamSeasonId && targetSeasonId ? { season_id: targetSeasonId } : {}),
      }));

      const allRosterRows: Record<string, any>[] = [];

      for (const t of uniqueTeams) {
        if (t.players && t.players.length > 0) {
          const uniquePlayers = Array.from(new Set(t.players.filter(Boolean)));
          uniquePlayers.forEach((playerId, idx) => {
            allRosterRows.push({
              team_id: t.id,
              player_id: playerId,
              slot_index: idx,
              is_captain: t.captainId === playerId,
              ...(hasTpSeasonId && targetSeasonId ? { season_id: targetSeasonId } : {}),
            });
          });
        }
      }

      const upsertRes = await supabase.from('teams').upsert(teamPayloads as any, { onConflict: 'id' });
      if (upsertRes.error) {
        const safeTeamPayloads = teamPayloads.map((tp) => ({ ...tp, captain_id: null }));
        await supabase.from('teams').upsert(safeTeamPayloads as any, { onConflict: 'id' });
      }

      await supabase.from('team_players').delete().in('team_id', keepIds);
      if (allRosterRows.length > 0) {
        await supabase.from('team_players').insert(allRosterRows as any);
      }

      // Clean up ONLY stale teams belonging strictly to THIS season (never touch other seasons!)
      const staleSeasonIds = (existingSeasonTeams || [])
        .map((t) => t.id)
        .filter((id) => id && !keepIdSet.has(id));
      if (staleSeasonIds.length > 0) {
        await supabase.from('team_players').delete().in('team_id', staleSeasonIds);
        await supabase.from('teams').delete().in('id', staleSeasonIds);
      }

      await this.trackSeasonEntityIds(targetSlug, 'seasonTeamIds', keepIds, 'replace');
      return true;
    } catch {
      return false;
    }
  }

  static async saveManualTeamRosterEdit(params: {
    affectedTeams: Team[];
    baselineRostersByTeamId?: Record<string, string[]>;
    auditDetails?: Record<string, any>;
    seasonSlug?: string;
    seasonId?: string;
  }): Promise<{ success: boolean; conflict?: boolean; error?: string }> {
    const { affectedTeams, baselineRostersByTeamId, auditDetails, seasonSlug, seasonId } = params;
    if (!this.isAvailable()) {
      return { success: true };
    }
    if (!affectedTeams || affectedTeams.length === 0) {
      return { success: false, error: 'No affected teams provided.' };
    }

    try {
      const targetSlug = seasonSlug || affectedTeams[0]?.seasonSlug;
      const targetSeasonId = seasonId || affectedTeams[0]?.seasonId;
      const seasonTeams = targetSlug ? (await this.fetchTeams(targetSlug, targetSeasonId)) || [] : [];
      const seasonTeamIds = seasonTeams.map((t) => t.id).filter(Boolean);
      const seasonTeamIdSet = new Set(seasonTeamIds);

      const affectedTeamIds = affectedTeams.map((t) => t.id).filter(Boolean);
      const affectedTeamIdSet = new Set(affectedTeamIds);
      const proposedPlayerIds = Array.from(
        new Set(affectedTeams.flatMap((t) => (t.players || []).filter(Boolean)))
      );

      const [hasTeamSeasonCol, hasTpSeasonCol] = targetSeasonId
        ? await Promise.all([this.hasSeasonIdColumn('teams'), this.hasSeasonIdColumn('team_players')])
        : [false, false];

      // 1. Concurrency check against authoritative Supabase state (scoped to this season's teams)
      if (baselineRostersByTeamId && Object.keys(baselineRostersByTeamId).length > 0) {
        const [{ data: currentTeamRosters }, { data: currentPlayerBindings }] = await Promise.all([
          supabase
            .from('team_players')
            .select('team_id, player_id, slot_index')
            .in('team_id', affectedTeamIds)
            .order('slot_index', { ascending: true }),
          proposedPlayerIds.length > 0
            ? seasonTeamIds.length > 0
              ? supabase
                  .from('team_players')
                  .select('team_id, player_id')
                  .in('player_id', proposedPlayerIds)
                  .in('team_id', seasonTeamIds)
              : Promise.resolve({ data: [] as any[] })
            : Promise.resolve({ data: [] as any[] }),
        ]);

        if (currentTeamRosters && currentTeamRosters.length > 0) {
          const dbRosterByTeam = new Map<string, string[]>();
          for (const row of currentTeamRosters as any[]) {
            const list = dbRosterByTeam.get(row.team_id) || [];
            list.push(row.player_id);
            dbRosterByTeam.set(row.team_id, list);
          }

          for (const teamId of affectedTeamIds) {
            const expected = baselineRostersByTeamId[teamId];
            const actual = dbRosterByTeam.get(teamId);
            if (expected && actual && actual.length > 0) {
              const expectedSorted = [...expected].sort().join(',');
              const actualSorted = [...actual].sort().join(',');
              if (expectedSorted !== actualSorted) {
                return {
                  success: false,
                  conflict: true,
                  error:
                    'Concurrent edit detected: Another admin modified one of these teams since you opened the editor. Latest rosters have been synced.',
                };
              }
            }
          }
        }

        if (currentPlayerBindings && currentPlayerBindings.length > 0) {
          for (const row of currentPlayerBindings as any[]) {
            if (row.team_id && !affectedTeamIdSet.has(row.team_id) && (!targetSlug || seasonTeamIdSet.has(row.team_id))) {
              return {
                success: false,
                conflict: true,
                error:
                  'Concurrent edit detected: One of the selected players was just assigned to another team by another admin.',
              };
            }
          }
        }
      }

      const nowIso = new Date().toISOString();
      const teamPayloads = affectedTeams.map((team) => ({
        id: team.id,
        name: team.name,
        short_name: this.encodeShortName(team.token, team.lockedPlayerIds),
        captain_id: team.captainId || null,
        avatar_color: team.avatarColor || 'from-amber-500 to-orange-600',
        badge: team.badge || '🏸',
        locked: Boolean(team.locked),
        updated_at: nowIso,
        ...(hasTeamSeasonCol && targetSeasonId ? { season_id: targetSeasonId } : {}),
      }));

      let { error: teamUpsertErr } = await supabase
        .from('teams')
        .upsert(teamPayloads as any, { onConflict: 'id' });

      if (teamUpsertErr) {
        const safePayloads = teamPayloads.map((tp) => ({ ...tp, captain_id: null }));
        const retryRes = await supabase
          .from('teams')
          .upsert(safePayloads as any, { onConflict: 'id' });
        teamUpsertErr = retryRes.error;
      }

      if (teamUpsertErr) {
        console.error('[SupabaseService] saveManualTeamRosterEdit team upsert error:', teamUpsertErr.message);
        return { success: false, error: teamUpsertErr.message };
      }

      // 3. Remove previous player bindings for affected teams AND stale bindings ONLY within the same season
      await supabase.from('team_players').delete().in('team_id', affectedTeamIds);
      if (proposedPlayerIds.length > 0) {
        if (targetSlug) {
          if (seasonTeamIds.length > 0) {
            await supabase
              .from('team_players')
              .delete()
              .in('player_id', proposedPlayerIds)
              .in('team_id', seasonTeamIds);
          }
        } else {
          await supabase.from('team_players').delete().in('player_id', proposedPlayerIds);
        }
      }

      // 4. Insert updated team_players rows for affected teams
      const rosterRows: Record<string, any>[] = [];

      for (const team of affectedTeams) {
        const uniquePlayers = Array.from(new Set((team.players || []).filter(Boolean)));
        uniquePlayers.forEach((playerId, idx) => {
          rosterRows.push({
            team_id: team.id,
            player_id: playerId,
            slot_index: idx,
            is_captain: team.captainId === playerId,
            ...(hasTpSeasonCol && targetSeasonId ? { season_id: targetSeasonId } : {}),
          });
        });
      }

      if (rosterRows.length > 0) {
        const { error: rosterInsertErr } = await supabase
          .from('team_players')
          .insert(rosterRows as any);

        if (rosterInsertErr) {
          console.error('[SupabaseService] saveManualTeamRosterEdit roster insert error:', rosterInsertErr.message);
          return { success: false, error: rosterInsertErr.message };
        }
      }

      if (targetSlug) {
        void this.trackSeasonEntityIds(targetSlug, 'seasonTeamIds', affectedTeamIds, 'merge');
      }

      if (auditDetails) {
        void this.logAudit('team_manual_edit', 'team', affectedTeams[0]?.id, auditDetails, undefined, targetSeasonId);
      }

      return { success: true };
    } catch (err: any) {
      console.error('[SupabaseService] saveManualTeamRosterEdit exception:', err);
      return { success: false, error: err?.message || 'Failed to save manual team edit' };
    }
  }

  static async deleteTeam(id: string, seasonSlug?: string): Promise<boolean> {
    if (!this.isAvailable()) return false;
    try {
      await supabase.from('team_players').delete().eq('team_id', id);
      const { error } = await supabase.from('teams').delete().eq('id', id);
      if (!error && seasonSlug) {
        void this.trackSeasonEntityIds(seasonSlug, 'seasonTeamIds', [id], 'remove');
      }
      return !error;
    } catch {
      return false;
    }
  }

  static async deleteTeamsBulk(ids: string[], seasonSlug?: string): Promise<boolean> {
    if (!this.isAvailable() || ids.length === 0) return false;
    try {
      await supabase.from('team_players').delete().in('team_id', ids);
      const { error } = await supabase.from('teams').delete().in('id', ids);
      if (!error && seasonSlug) {
        void this.trackSeasonEntityIds(seasonSlug, 'seasonTeamIds', ids, 'remove');
      }
      return !error;
    } catch {
      return false;
    }
  }

  static async clearTeams(seasonSlug?: string, seasonId?: string): Promise<boolean> {
    if (!this.isAvailable()) return false;
    try {
      const targetSlug = seasonSlug || 'season-4';
      const seasonTeams = (await this.fetchTeams(targetSlug, seasonId)) || [];
      const seasonTeamIds = seasonTeams.map((t) => t.id).filter(Boolean);
      if (seasonTeamIds.length > 0) {
        await supabase.from('team_players').delete().in('team_id', seasonTeamIds);
        const { error } = await supabase.from('teams').delete().in('id', seasonTeamIds);
        if (error) return false;
      }
      await this.trackSeasonEntityIds(targetSlug, 'seasonTeamIds', [], 'replace');
      return true;
    } catch {
      return false;
    }
  }

  static async assignPlayerToTeam(teamId: string, playerId: string, seasonSlug?: string, seasonId?: string): Promise<boolean> {
    if (!this.isAvailable()) return false;
    try {
      const hasTpSeasonCol = seasonId ? await this.hasSeasonIdColumn('team_players') : false;
      if (seasonSlug) {
        const seasonTeams = (await this.fetchTeams(seasonSlug, seasonId)) || [];
        const seasonTeamIds = seasonTeams.map((t) => t.id).filter(Boolean);
        if (seasonTeamIds.length > 0) {
          await supabase
            .from('team_players')
            .delete()
            .eq('player_id', playerId)
            .in('team_id', seasonTeamIds);
        }
      } else {
        await supabase.from('team_players').delete().eq('player_id', playerId);
      }
      const { data } = await supabase
        .from('team_players')
        .select('slot_index')
        .eq('team_id', teamId)
        .order('slot_index', { ascending: false })
        .limit(1);
      const nextSlot = data && data[0] ? ((data[0] as any).slot_index + 1) : 0;

      const { error } = await supabase.from('team_players').insert({
        team_id: teamId,
        player_id: playerId,
        slot_index: nextSlot,
        is_captain: false,
        ...(hasTpSeasonCol && seasonId ? { season_id: seasonId } : {}),
      } as any);

      return !error;
    } catch {
      return false;
    }
  }

  static async removePlayerFromTeam(teamId: string, playerId: string): Promise<boolean> {
    if (!this.isAvailable()) return false;
    try {
      const { error } = await supabase
        .from('team_players')
        .delete()
        .eq('team_id', teamId)
        .eq('player_id', playerId);
      return !error;
    } catch {
      return false;
    }
  }

  // ============================================================================
  // 3. MATCHES & REAL-TIME SCORES
  // ============================================================================
  static async fetchMatches(season = 'season-4', seasonId?: string): Promise<{ matches: Match[]; knockout: KnockoutMatch[] } | null> {
    if (!this.isAvailable()) return null;
    try {
      const hasMatchSeasonId = seasonId ? await this.hasSeasonIdColumn('matches') : false;
      let query = supabase
        .from('matches')
        .select('*')
        .order('created_at', { ascending: true });

      if (hasMatchSeasonId && seasonId) {
        query = (query as any).or(`tournament_season.eq.${season},season_id.eq.${seasonId}`);
      } else {
        query = query.eq('tournament_season', season);
      }

      const { data, error } = await query;

      if (error || !data) return null;

      const groupMatches: Match[] = [];
      const koMatches: KnockoutMatch[] = [];

      const stageOrder: Record<string, number> = { ELIM: 1, QF: 1, SF: 2, F: 3 };

      for (const m of data as DbMatch[]) {
        const normalizedStatus =
          (m.status as any) === 'paused' || m.status === 'postponed'
            ? 'paused'
            : m.status === 'live'
            ? 'live'
            : m.status === 'completed'
            ? 'completed'
            : 'upcoming';
        const parsedCourt =
          typeof m.court === 'number'
            ? m.court
            : parseInt(String(m.court || '').replace(/\D/g, '') || '1', 10) || 1;

        if (m.match_type === 'knockout') {
          const timeStr = String(m.time || '');
          const dbStage = String(m.stage || 'SF');
          let inferredPlayoffRound: PlayoffRoundType | undefined;
          let normalizedStage: KnockoutMatch['stage'] = (m.stage as any) || 'SF';

          if (dbStage === 'Q1' || (dbStage === 'SF' && m.slot === 1 && timeStr.toLowerCase().includes('qualifier 1'))) {
            inferredPlayoffRound = 'Q1';
            normalizedStage = 'SF';
          } else if (dbStage === 'Q2' || (dbStage === 'SF' && (m.slot === 3 || timeStr.toLowerCase().includes('qualifier 2')))) {
            inferredPlayoffRound = 'Q2';
            normalizedStage = 'SF';
          } else if ((dbStage === 'ELIM' || dbStage === 'QF') && timeStr.toLowerCase().includes('eliminator')) {
            inferredPlayoffRound = 'ELIM';
            normalizedStage = 'ELIM';
          } else if (dbStage === 'F' && timeStr.toLowerCase().includes('grand final')) {
            inferredPlayoffRound = 'F';
            normalizedStage = 'F';
          }

          koMatches.push({
            id: m.id,
            stage: normalizedStage,
            playoffRound: inferredPlayoffRound,
            isPlayoff: Boolean(inferredPlayoffRound),
            slot: m.slot || 1,
            court: parsedCourt,
            time: m.time || undefined,
            teamA: m.team_a_id || undefined,
            teamB: m.team_b_id || undefined,
            scoreA: m.score_a != null ? m.score_a : undefined,
            scoreB: m.score_b != null ? m.score_b : undefined,
            status: normalizedStatus,
            winner: m.winner_id || undefined,
            loserId:
              normalizedStatus === 'completed' && m.winner_id && m.team_a_id && m.team_b_id
                ? m.winner_id === m.team_a_id
                  ? m.team_b_id
                  : m.team_a_id
                : undefined,
            sets: m.sets_json || undefined,
            mvpPlayerId: m.mvp_player_id || undefined,
            seasonId: seasonId || m.season_id || undefined,
            seasonSlug: m.tournament_season || season,
          });
        } else {
          const parsedTime = parseMatchScheduleTime(m.time || undefined);
          groupMatches.push({
            id: m.id,
            round: m.round,
            court: parsedCourt,
            courtSlot: m.slot != null ? m.slot : undefined,
            slot: m.slot != null ? m.slot : undefined,
            matchNumber: m.slot != null ? m.slot : undefined,
            teamA: m.team_a_id || '',
            teamB: m.team_b_id || '',
            scoreA: m.score_a != null ? m.score_a : undefined,
            scoreB: m.score_b != null ? m.score_b : undefined,
            status: normalizedStatus,
            winner: m.winner_id || undefined,
            time: m.time || undefined,
            date: parsedTime.date,
            startTime: parsedTime.startTime,
            sets: m.sets_json || undefined,
            mvpPlayerId: m.mvp_player_id || undefined,
            seasonId: seasonId || m.season_id || undefined,
            seasonSlug: m.tournament_season || season,
          });
        }
      }

      const orderedGroupMatches = sortMatchesByScheduleOrder(groupMatches);

      koMatches.sort((a, b) => {
        const sa = stageOrder[a.stage] ?? 9;
        const sb = stageOrder[b.stage] ?? 9;
        if (sa !== sb) return sa - sb;
        return (a.slot || 1) - (b.slot || 1);
      });

      return { matches: orderedGroupMatches, knockout: koMatches };
    } catch {
      return null;
    }
  }

  // Per-match tail-coalescing write queue prevents out-of-order HTTP races on rapid +1/-1 clicks
  // while keeping independent courts running concurrently.
  private static matchScoreInFlight = new Set<string>();
  private static matchScorePending = new Map<
    string,
    { payload: Record<string, any>; season: string; resolvers: ((ok: boolean) => void)[] }
  >();

  private static async flushMatchScoreQueue(matchId: string): Promise<void> {
    if (this.matchScoreInFlight.has(matchId)) return;
    this.matchScoreInFlight.add(matchId);

    try {
      while (true) {
        const pending = this.matchScorePending.get(matchId);
        if (!pending) break;
        this.matchScorePending.delete(matchId);

        let success = false;
        try {
          const { error } = await supabase
            .from('matches')
            .upsert({ id: matchId, tournament_season: pending.season, ...pending.payload } as any);
          success = !error;
          if (error) {
            console.error('[SupabaseService] updateMatchScore failed:', error.message);
          }
        } catch (err) {
          console.error('[SupabaseService] updateMatchScore exception:', err);
          success = false;
        }

        for (const resolve of pending.resolvers) {
          resolve(success);
        }
      }
    } finally {
      this.matchScoreInFlight.delete(matchId);
      // Guard against a write queued right before finally ran
      if (this.matchScorePending.has(matchId)) {
        void this.flushMatchScoreQueue(matchId);
      }
    }
  }

  static async updateMatchScore(
    matchId: string,
    updates: Partial<Match | KnockoutMatch>,
    isKnockout = false,
    season = 'season-4',
    seasonId?: string
  ): Promise<boolean> {
    if (!this.isAvailable()) return false;
    try {
      const hasSeasonCol = seasonId ? await this.hasSeasonIdColumn('matches') : false;
      const payload: Record<string, any> = {
        updated_at: new Date().toISOString(),
        ...(hasSeasonCol && seasonId ? { season_id: seasonId } : {}),
      };

      if ('scoreA' in updates) payload.score_a = updates.scoreA ?? null;
      if ('scoreB' in updates) payload.score_b = updates.scoreB ?? null;
      if (updates.status !== undefined) {
        payload.status = updates.status === 'paused' ? 'postponed' : updates.status;
      }
      if ('winner' in updates) payload.winner_id = updates.winner || null;
      if ('sets' in updates) payload.sets_json = updates.sets ?? null;
      if ('teamA' in updates) payload.team_a_id = updates.teamA || null;
      if ('teamB' in updates) payload.team_b_id = updates.teamB || null;
      if ('court' in updates && updates.court != null) {
        payload.court =
          typeof updates.court === 'number'
            ? updates.court
            : parseInt(String(updates.court).replace(/\D/g, '') || '1', 10) || 1;
      }
      if ('time' in updates) payload.time = updates.time || null;
      if ('mvpPlayerId' in updates) payload.mvp_player_id = updates.mvpPlayerId || null;
      if ('stage' in updates && (updates as any).stage) {
        const st = String((updates as any).stage);
        const pr = (updates as any).playoffRound;
        if (pr === 'Q1' || st === 'Q1') payload.stage = 'SF';
        else if (pr === 'Q2' || st === 'Q2') payload.stage = 'SF';
        else if (pr === 'ELIM') payload.stage = 'ELIM';
        else if (pr === 'F') payload.stage = 'F';
        else payload.stage = st === 'QF' ? 'ELIM' : st;
      }
      if ('slot' in updates && (updates as any).slot != null) payload.slot = (updates as any).slot;
      if (isKnockout) {
        payload.match_type = 'knockout';
        payload.round = 99;
      }

      return await new Promise<boolean>((resolve) => {
        const existing = this.matchScorePending.get(matchId);
        if (existing) {
          existing.payload = { ...existing.payload, ...payload };
          existing.season = season;
          existing.resolvers.push(resolve);
        } else {
          this.matchScorePending.set(matchId, {
            payload,
            season,
            resolvers: [resolve],
          });
        }
        void this.flushMatchScoreQueue(matchId);
      });
    } catch {
      return false;
    }
  }

  static async replaceSeasonMatches(
    newMatches: Match[],
    season = 'season-4',
    courtSettings?: { courts: number; courtNames?: string[] },
    seasonId?: string
  ): Promise<{ success: boolean; error?: string }> {
    if (!this.isAvailable()) return { success: true };
    try {
      const hasSeasonCol = seasonId ? await this.hasSeasonIdColumn('matches') : false;

      const { data: existingMatches } = await supabase
        .from('matches')
        .select('id')
        .eq('tournament_season', season)
        .eq('match_type', 'group');

      const existingIds = (existingMatches || []).map((m: any) => m.id);

      if (existingIds.length > 0) {
        await supabase
          .from('match_scores')
          .delete()
          .in('match_id', existingIds);
      }

      const { error: delError } = await supabase
        .from('matches')
        .delete()
        .eq('tournament_season', season)
        .eq('match_type', 'group');

      if (delError) {
        console.error('Failed to delete existing matches in Supabase:', delError);
        return { success: false, error: delError.message };
      }

      if (newMatches.length > 0) {
        const rows = newMatches.map((m) => ({
          id: m.id,
          tournament_season: season,
          ...(hasSeasonCol && seasonId ? { season_id: seasonId } : {}),
          round: m.round,
          court: typeof m.court === 'number' ? m.court : parseInt(String(m.court || '').replace(/\D/g, '') || '1', 10),
          match_type: 'group' as const,
          slot: m.courtSlot || null,
          team_a_id: m.teamA || null,
          team_b_id: m.teamB || null,
          score_a: m.scoreA != null ? m.scoreA : null,
          score_b: m.scoreB != null ? m.scoreB : null,
          status: m.status || 'upcoming',
          winner_id: m.winner || null,
          time: m.time || (m.courtName ? `Round ${m.round} · ${m.courtName}` : `Round ${m.round} · Court ${m.court}`),
          sets_json: m.sets || null,
          mvp_player_id: m.mvpPlayerId || null,
          updated_at: new Date().toISOString(),
        }));

        const { error: insError } = await supabase.from('matches').insert(rows as any);
        if (insError) {
          console.error('Failed to insert new matches in Supabase:', insError);
          return { success: false, error: insError.message };
        }
      }

      if (courtSettings) {
        const { data: currentForm } = await (supabase
          .from('registration_form_config') as any)
          .select('appearance_json')
          .eq('season_slug', season)
          .maybeSingle();

        const appearance = (currentForm as any)?.appearance_json || {};
        await (supabase
          .from('registration_form_config') as any)
          .update({
            appearance_json: {
              ...appearance,
              courts: courtSettings.courts,
              courtNames: courtSettings.courtNames,
            },
            updated_at: new Date().toISOString(),
          })
          .eq('season_slug', season);
      }

      await this.logAudit('matches_schedule_regenerated', 'matches', season, {
        seasonSlug: season,
        matchesCount: newMatches.length,
        courts: courtSettings?.courts || 1,
      }, undefined, seasonId);
      return { success: true };
    } catch (err: any) {
      console.error('Exception in replaceSeasonMatches:', err);
      return { success: false, error: err?.message || 'Failed to replace match schedule' };
    }
  }

  static async batchSaveMatches(
    matches: Match[],
    season = 'season-4',
    seasonId?: string
  ): Promise<boolean> {
    if (!this.isAvailable()) return false;
    try {
      const hasSeasonCol = seasonId ? await this.hasSeasonIdColumn('matches') : false;
      const rows = matches.map((m, idx) => ({
        id: m.id,
        tournament_season: season,
        ...(hasSeasonCol && seasonId ? { season_id: seasonId } : {}),
        round: m.round || 1,
        court: typeof m.court === 'number' ? m.court : parseInt(String(m.court || '').replace(/\D/g, '') || '1', 10),
        match_type: 'group' as const,
        slot: m.matchNumber ?? m.courtSlot ?? m.slot ?? idx + 1,
        team_a_id: m.teamA || null,
        team_b_id: m.teamB || null,
        score_a: m.scoreA != null ? m.scoreA : null,
        score_b: m.scoreB != null ? m.scoreB : null,
        status: m.status === 'paused' ? 'postponed' : m.status || 'upcoming',
        winner_id: m.winner || null,
        time: m.time || null,
        sets_json: m.sets || null,
        mvp_player_id: m.mvpPlayerId || null,
        updated_at: new Date().toISOString(),
      }));

      const { error } = await supabase.from('matches').upsert(rows as any);
      return !error;
    } catch {
      return false;
    }
  }

  static async saveEditedSchedule(params: {
    draftMatches: Match[];
    removedMatchIds: string[];
    season?: string;
    seasonId?: string;
    auditDetails?: Record<string, any>;
  }): Promise<{
    success: boolean;
    conflict?: boolean;
    error?: string;
    matches?: Match[];
  }> {
    const { draftMatches, removedMatchIds = [], season = 'season-4', seasonId, auditDetails } = params;
    if (!this.isAvailable()) {
      return { success: true, matches: draftMatches };
    }

    try {
      const hasSeasonCol = seasonId ? await this.hasSeasonIdColumn('matches') : false;
      // 1. Fetch authoritative current group matches from Supabase to protect concurrent live/completed updates
      const { data: currentDbRows, error: fetchErr } = await supabase
        .from('matches')
        .select('*')
        .eq('tournament_season', season)
        .eq('match_type', 'group');

      if (fetchErr) {
        console.error('[SupabaseService] saveEditedSchedule fetch error:', fetchErr.message);
        return { success: false, error: fetchErr.message };
      }

      const dbMatchMap = new Map<string, DbMatch>();
      for (const row of (currentDbRows || []) as DbMatch[]) {
        if (row && row.id) dbMatchMap.set(row.id, row);
      }

      // 2. Verify none of the removedMatchIds became live or completed concurrently
      const safeRemovedIds: string[] = [];
      for (const remId of removedMatchIds) {
        const dbRow = dbMatchMap.get(remId);
        if (!dbRow) continue;
        if (dbRow.status === 'live' || dbRow.status === 'completed' || dbRow.status === 'postponed') {
          return {
            success: false,
            conflict: true,
            error:
              'Concurrent update detected: A match you attempted to remove is now active or completed in the database. Latest schedule has been synced.',
          };
        }
        safeRemovedIds.push(remId);
      }

      // 3. Merge authoritative live/completed scores from DB so schedule rearrangements never overwrite live points
      const nowIso = new Date().toISOString();
      const mergedDraftMatches: Match[] = draftMatches.map((m, idx) => {
        const seqSlot = idx + 1;
        const dbRow = dbMatchMap.get(m.id);
        if (dbRow && (dbRow.status === 'live' || dbRow.status === 'completed' || dbRow.status === 'postponed')) {
          const normalizedDbStatus: Match['status'] =
            dbRow.status === 'postponed' ? 'paused' : dbRow.status;
          return {
            ...m,
            courtSlot: seqSlot,
            slot: seqSlot,
            matchNumber: seqSlot,
            scoreA: dbRow.score_a != null ? dbRow.score_a : m.scoreA,
            scoreB: dbRow.score_b != null ? dbRow.score_b : m.scoreB,
            status: normalizedDbStatus,
            winner: dbRow.winner_id || m.winner,
            sets: dbRow.sets_json || m.sets,
            mvpPlayerId: dbRow.mvp_player_id || m.mvpPlayerId,
          };
        }
        return {
          ...m,
          courtSlot: seqSlot,
          slot: seqSlot,
          matchNumber: seqSlot,
        };
      });

      // 4. Delete only explicitly removed upcoming matches
      if (safeRemovedIds.length > 0) {
        await supabase.from('match_scores').delete().in('match_id', safeRemovedIds);
        const { error: delErr } = await supabase
          .from('matches')
          .delete()
          .in('id', safeRemovedIds)
          .eq('tournament_season', season);

        if (delErr) {
          console.error('[SupabaseService] saveEditedSchedule delete error:', delErr.message);
          return { success: false, error: delErr.message };
        }
      }

      // 5. Upsert all draft matches preserving IDs, scores, and 1-based slot order
      if (mergedDraftMatches.length > 0) {
        const rows = mergedDraftMatches.map((m, idx) => ({
          id: m.id,
          tournament_season: season,
          ...(hasSeasonCol && seasonId ? { season_id: seasonId } : {}),
          round: Math.max(1, Number(m.round) || 1),
          court:
            typeof m.court === 'number'
              ? m.court
              : parseInt(String(m.court || '').replace(/\D/g, '') || '1', 10) || 1,
          match_type: 'group' as const,
          slot: idx + 1,
          team_a_id: m.teamA || null,
          team_b_id: m.teamB || null,
          score_a: m.scoreA != null ? m.scoreA : null,
          score_b: m.scoreB != null ? m.scoreB : null,
          status: m.status === 'paused' ? 'postponed' : m.status || 'upcoming',
          winner_id: m.winner || null,
          time: m.time || null,
          sets_json: m.sets || null,
          mvp_player_id: m.mvpPlayerId || null,
          updated_at: nowIso,
        }));

        const { error: upsertErr } = await supabase
          .from('matches')
          .upsert(rows as any, { onConflict: 'id' });

        if (upsertErr) {
          console.error('[SupabaseService] saveEditedSchedule upsert error:', upsertErr.message);
          return { success: false, error: upsertErr.message };
        }
      }

      if (auditDetails) {
        void this.logAudit(
          'schedule_manual_edit',
          'matches',
          `Edited schedule (${mergedDraftMatches.length} fixtures)`,
          auditDetails,
          undefined,
          seasonId
        );
      }

      return {
        success: true,
        matches: mergedDraftMatches,
      };
    } catch (err: any) {
      console.error('[SupabaseService] saveEditedSchedule exception:', err);
      return {
        success: false,
        error: err?.message || 'Failed to save schedule changes to Supabase.',
      };
    }
  }

  static async deleteMatch(id: string): Promise<boolean> {
    if (!this.isAvailable()) return false;
    try {
      await supabase.from('match_scores').delete().eq('match_id', id);
      const { error } = await supabase.from('matches').delete().eq('id', id);
      return !error;
    } catch {
      return false;
    }
  }

  static async clearSeasonMatches(season = 'season-4'): Promise<boolean> {
    if (!this.isAvailable()) return false;
    try {
      const { data: existing } = await supabase
        .from('matches')
        .select('id')
        .eq('tournament_season', season)
        .eq('match_type', 'group');

      const ids = (existing || []).map((m: any) => m.id);
      if (ids.length > 0) {
        await supabase.from('match_scores').delete().in('match_id', ids);
      }
      const { error } = await supabase.from('matches').delete().eq('tournament_season', season).eq('match_type', 'group');
      return !error;
    } catch {
      return false;
    }
  }

  static async batchSaveKnockoutMatches(matches: KnockoutMatch[], season = 'season-4', seasonId?: string): Promise<boolean> {
    if (!this.isAvailable() || matches.length === 0) return false;
    try {
      const hasSeasonCol = seasonId ? await this.hasSeasonIdColumn('matches') : false;
      const rows = matches.map((m) => {
        const pr = inferPlayoffRound(m);
        const safeDbStage =
          pr === 'Q1' || pr === 'Q2'
            ? 'SF'
            : pr === 'ELIM' || pr === 'PRELIM'
            ? 'ELIM'
            : pr === 'F'
            ? 'F'
            : m.stage === 'QF'
            ? 'ELIM'
            : m.stage || 'SF';
        const isIplElim =
          pr === 'ELIM' &&
          (m.matchCode === 'ELIM' ||
            (m.matchLabel && m.matchLabel.trim().toLowerCase() === 'eliminator'));
        const safeSlot =
          pr === 'Q1'
            ? 1
            : isIplElim
            ? 2
            : pr === 'Q2'
            ? 3
            : pr === 'F'
            ? 1
            : m.slot || 1;
        return {
          id: m.id,
          tournament_season: season,
          ...(hasSeasonCol && seasonId ? { season_id: seasonId } : {}),
          round: 99,
          court: typeof m.court === 'number' ? m.court : parseInt(String(m.court || '').replace(/\D/g, '') || '1', 10) || 1,
          match_type: 'knockout' as const,
          stage: safeDbStage,
          slot: safeSlot,
          team_a_id: m.teamA || null,
          team_b_id: m.teamB || null,
          score_a: m.scoreA != null ? m.scoreA : null,
          score_b: m.scoreB != null ? m.scoreB : null,
          status: m.status === 'paused' ? 'postponed' : m.status || 'upcoming',
          winner_id: m.winner || null,
          time: m.time || null,
          sets_json: m.sets || null,
          mvp_player_id: m.mvpPlayerId || null,
          updated_at: new Date().toISOString(),
        };
      });
      const { error } = await supabase.from('matches').upsert(rows as any);
      return !error;
    } catch {
      return false;
    }
  }

  static async replaceKnockoutMatches(matches: KnockoutMatch[], season = 'season-4', seasonId?: string): Promise<boolean> {
    if (!this.isAvailable()) return false;
    try {
      await this.clearKnockoutMatches(season);
      if (matches.length === 0) return true;
      return await this.batchSaveKnockoutMatches(matches, season, seasonId);
    } catch {
      return false;
    }
  }

  static async clearKnockoutMatches(season = 'season-4'): Promise<boolean> {
    if (!this.isAvailable()) return false;
    try {
      const { data: existing } = await supabase
        .from('matches')
        .select('id')
        .eq('tournament_season', season)
        .eq('match_type', 'knockout');

      const ids = (existing || []).map((m: any) => m.id);
      if (ids.length > 0) {
        await supabase.from('match_scores').delete().in('match_id', ids);
      }
      const { error } = await supabase
        .from('matches')
        .delete()
        .eq('tournament_season', season)
        .eq('match_type', 'knockout');
      return !error;
    } catch {
      return false;
    }
  }

  static async recordScoreEvent(
    matchId: string,
    setNumber: number,
    scoreA: number,
    scoreB: number,
    isCompleted = false,
    winnerTeamId?: string,
    recordedBy = 'Umpire'
  ): Promise<boolean> {
    if (!this.isAvailable()) return false;
    try {
      const { error } = await supabase.from('match_scores').insert({
        match_id: matchId,
        set_number: setNumber,
        score_a: scoreA,
        score_b: scoreB,
        is_completed: isCompleted,
        winner_team_id: winnerTeamId || null,
        recorded_by: recordedBy,
        recorded_at: new Date().toISOString(),
      } as any);
      return !error;
    } catch {
      return false;
    }
  }

  // ============================================================================
  // 4. REGISTRATIONS & APPLICANTS
  // ============================================================================
  static mapDbRegistration(r: any): Registration {
    const rawAnswers = (r.answers_json && typeof r.answers_json === 'object' ? r.answers_json : {}) as Record<string, any>;
    const rawPaidAmount = rawAnswers._paidAmount;
    const feeVal = typeof r.fee === 'number' && Number.isFinite(r.fee) ? Math.max(0, Math.round(r.fee)) : 0;
    const paidAmount =
      typeof rawPaidAmount === 'number' && Number.isFinite(rawPaidAmount)
        ? Math.min(feeVal, Math.max(0, Math.round(rawPaidAmount)))
        : undefined;

    return {
      id: r.id,
      regId: r.reg_id,
      playerId: r.player_id || undefined,
      name: r.name,
      mobile: r.mobile,
      whatsapp: r.whatsapp || undefined,
      age: r.age || undefined,
      gender: r.gender,
      experience: r.experience || undefined,
      category: r.category || undefined,
      style: r.style || undefined,
      city: r.city || undefined,
      notes: r.notes || undefined,
      fee: feeVal,
      paidAmount,
      status: r.status,
      paymentStatus: r.payment_status,
      method: r.method,
      txnId: r.txn_id || undefined,
      season: r.season_slug,
      seasonSlug: r.season_slug,
      seasonId: r.season_id || undefined,
      createdAt: r.created_at ? new Date(r.created_at).getTime() : Date.now(),
      paidAt: r.paid_at ? new Date(r.paid_at).getTime() : undefined,
      approvedAt: r.approved_at ? new Date(r.approved_at).getTime() : undefined,
      verifiedBy: r.verified_by || undefined,
      verifiedAt: r.verified_at ? new Date(r.verified_at).getTime() : undefined,
      auditLog: Array.isArray(r.audit_log_json) ? r.audit_log_json : [],
      answers: rawAnswers,
      photoUrl: r.photo_url || undefined,
      tokenUsed: r.token_used || undefined,
      formVersion: r.form_version || 1,
    };
  }

  static async fetchRegistrations(season = 'season-4', seasonId?: string): Promise<Registration[] | null> {
    if (!this.isAvailable()) return null;
    try {
      const targetSeason = !season || season === 'all' || season === 'any'
        ? (await this.fetchActiveSeason()).seasonSlug
        : season;
      const hasSeasonCol = seasonId ? await this.hasSeasonIdColumn('registrations') : false;

      let query = supabase
        .from('registrations')
        .select('*')
        .order('created_at', { ascending: false });

      if (hasSeasonCol && seasonId) {
        query = (query as any).or(`season_slug.eq.${targetSeason},season_id.eq.${seasonId}`);
      } else {
        query = query.eq('season_slug', targetSeason);
      }

      const { data, error } = await query;

      if (error || !data) return null;

      return (data as DbRegistration[]).map((r) => this.mapDbRegistration(r));
    } catch {
      return null;
    }
  }

  static async fetchTournamentRevenue(seasonSlug = 'season-4', seasonId?: string) {
    const regs = (await this.fetchRegistrations(seasonSlug, seasonId)) || [];
    return calculateRegistrationStats(regs);
  }

  static async checkDuplicateRegistration(
    mobile: string,
    seasonSlug = 'season-4',
    seasonId?: string
  ): Promise<{ isDuplicate: boolean; regId?: string } | null> {
    if (!this.isAvailable()) return null;
    try {
      const clean = mobile.replace(/\D/g, '');
      const hasSeasonCol = seasonId ? await this.hasSeasonIdColumn('registrations') : false;
      let query = supabase
        .from('registrations')
        .select('id, reg_id, status')
        .eq('mobile', clean)
        .neq('status', 'rejected');

      if (hasSeasonCol && seasonId) {
        query = (query as any).or(`season_slug.eq.${seasonSlug},season_id.eq.${seasonId}`);
      } else {
        query = query.eq('season_slug', seasonSlug);
      }

      const { data, error } = await query.maybeSingle();

      if (error || !data) return { isDuplicate: false };
      return { isDuplicate: true, regId: (data as any).reg_id };
    } catch {
      return null;
    }
  }

  static async generateCollisionFreeRegId(prefix = 'SPL-2026', seasonSlug?: string): Promise<string> {
    try {
      let query = supabase.from('registrations').select('*', { count: 'exact', head: true });
      if (seasonSlug) {
        query = query.eq('season_slug', seasonSlug);
      }
      const { count } = await query;
      const seq = String((count || 0) + 1).padStart(3, '0');
      const salt = Math.floor(100 + Math.random() * 900);
      return `${prefix}-${seq}-${salt}`;
    } catch {
      const fallbackSeq = String(Math.floor(1 + Math.random() * 999)).padStart(3, '0');
      const salt = Math.floor(100 + Math.random() * 900);
      return `${prefix}-${fallbackSeq}-${salt}`;
    }
  }

  static async saveRegistration(reg: Registration, seasonId?: string): Promise<boolean> {
    const res = await this.saveRegistrationWithDetail(reg, seasonId);
    return res.success;
  }

  static async saveRegistrationWithDetail(
    reg: Registration,
    seasonId?: string
  ): Promise<{ success: boolean; error?: string; registrationClosed?: boolean }> {
    if (!this.isAvailable()) return { success: false, error: 'Supabase credentials not configured' };
    try {
      const targetSeason = reg.seasonSlug || reg.season || 'season-4';
      const resolvedSeasonId = reg.seasonId || seasonId;
      const cfgRow = await this.fetchFormConfigRow(targetSeason, { allowFallback: false });
      if (cfgRow && cfgRow.enabled === false) {
        return {
          success: false,
          registrationClosed: true,
          error:
            cfgRow.closed_notice ||
            `Registration for ${cfgRow.tournament_name || 'Smash Premier League'} (${cfgRow.season_title || targetSeason}) is currently closed.`,
        };
      }

      const rawGender = String(reg.gender || '').trim().toLowerCase();
      let normalizedGender: 'M' | 'F' | 'Other' = 'M';
      if (rawGender === 'm' || rawGender === 'male') {
        normalizedGender = 'M';
      } else if (rawGender === 'f' || rawGender === 'female') {
        normalizedGender = 'F';
      } else if (rawGender === 'other') {
        normalizedGender = 'Other';
      }

      const validStatuses = ['pending', 'approved', 'rejected', 'paid', 'complimentary'];
      const normalizedStatus = validStatuses.includes(reg.status) ? reg.status : 'pending';

      const validPaymentStatuses = [
        'unpaid',
        'pending',
        'initiated',
        'pending_verification',
        'paid',
        'failed',
        'cancelled',
        'refunded',
      ];
      const normalizedPaymentStatus = validPaymentStatuses.includes(reg.paymentStatus as any)
        ? (reg.paymentStatus as any)
        : 'unpaid';

      const validMethods = ['cash', 'upi', 'bank', 'complimentary'];
      const normalizedMethod = validMethods.includes(reg.method as any) ? (reg.method as any) : 'upi';

      const resolvedFee =
        reg.fee != null && !Number.isNaN(Number(reg.fee)) ? Math.max(0, Math.round(Number(reg.fee))) : 250;
      const nextAnswers: Record<string, any> = { ...(reg.answers || {}) };
      if (normalizedPaymentStatus === 'paid') {
        nextAnswers._paidAmount = resolvedFee;
      } else if (typeof reg.paidAmount === 'number' && Number.isFinite(reg.paidAmount) && reg.paidAmount > 0 && normalizedPaymentStatus !== 'failed' && normalizedPaymentStatus !== 'cancelled' && normalizedPaymentStatus !== 'refunded') {
        nextAnswers._paidAmount = Math.min(resolvedFee, Math.max(0, Math.round(reg.paidAmount)));
      } else {
        delete nextAnswers._paidAmount;
      }

      const hasSeasonCol = resolvedSeasonId ? await this.hasSeasonIdColumn('registrations') : false;

      const payload = {
        id: reg.id,
        reg_id: reg.regId,
        season_slug: targetSeason,
        ...(hasSeasonCol && resolvedSeasonId ? { season_id: resolvedSeasonId } : {}),
        player_id: reg.playerId || null,
        name: reg.name.trim(),
        mobile: reg.mobile.replace(/\D/g, ''),
        whatsapp: reg.whatsapp ? reg.whatsapp.replace(/\D/g, '') : null,
        age: typeof reg.age === 'number' && !isNaN(reg.age) ? Math.round(reg.age) : null,
        gender: normalizedGender,
        experience: reg.experience || null,
        category: reg.category || null,
        style: reg.style || null,
        city: reg.city || null,
        notes: reg.notes || null,
        fee: resolvedFee,
        status: normalizedStatus,
        payment_status: normalizedPaymentStatus,
        method: normalizedMethod,
        txn_id: reg.txnId || null,
        answers_json: nextAnswers,
        photo_url: reg.photoUrl || null,
        token_used: reg.tokenUsed || null,
        form_version: reg.formVersion || 1,
        approved_at: reg.approvedAt ? new Date(reg.approvedAt).toISOString() : null,
        paid_at: normalizedPaymentStatus === 'paid' && reg.paidAt ? new Date(reg.paidAt).toISOString() : null,
        verified_by: reg.verifiedBy || null,
        verified_at: reg.verifiedAt ? new Date(reg.verifiedAt).toISOString() : null,
        audit_log_json: reg.auditLog || [],
        created_at: new Date(reg.createdAt).toISOString(),
        updated_at: new Date().toISOString(),
      };

      const { error } = await supabase.from('registrations').upsert(payload as any);
      if (error) {
        console.error('Supabase saveRegistration error:', error.message, error.details);
        return { success: false, error: error.message };
      }
      return { success: true };
    } catch (e: any) {
      console.error('Supabase saveRegistration exception:', e?.message);
      return { success: false, error: e?.message || 'Database error recording registration' };
    }
  }

  /**
   * Authoritatively update a registration's payment status directly in Supabase PostgreSQL.
   * Reads fresh row state before applying patch so concurrent updates cannot clobber unrelated fields.
   */
  static async verifyRegistrationPaymentAtomic(params: {
    id: string;
    paymentStatus: Registration['paymentStatus'];
    verifiedBy?: string;
    note?: string;
    paidAmount?: number;
    method?: Registration['method'];
  }): Promise<{ success: boolean; registration?: Registration; error?: string }> {
    if (!this.isAvailable()) {
      return { success: false, error: 'Supabase credentials not configured' };
    }
    try {
      const validPaymentStatuses = [
        'unpaid',
        'pending',
        'initiated',
        'pending_verification',
        'paid',
        'failed',
        'cancelled',
        'refunded',
      ];
      const nextStatus = validPaymentStatuses.includes(params.paymentStatus as any)
        ? (params.paymentStatus as string)
        : 'unpaid';

      const { data: existingRow, error: fetchErr } = await supabase
        .from('registrations')
        .select('*')
        .eq('id', params.id)
        .maybeSingle();

      if (fetchErr) {
        return { success: false, error: fetchErr.message };
      }
      if (!existingRow) {
        return { success: false, error: 'Registration record not found in Supabase.' };
      }

      const existing = existingRow as any;
      const nowMs = Date.now();
      const nowIso = new Date(nowMs).toISOString();
      const feeVal = typeof existing.fee === 'number' && Number.isFinite(existing.fee) ? Math.max(0, Math.round(existing.fee)) : 0;
      const verifier = (params.verifiedBy || 'Tournament Director').trim() || 'Tournament Director';
      const prevPaymentStatus = existing.payment_status || (existing.status === 'paid' ? 'paid' : 'unpaid');

      const existingAnswers =
        existing.answers_json && typeof existing.answers_json === 'object' ? { ...existing.answers_json } : {};

      let resolvedPaidAt: string | null = null;
      if (nextStatus === 'paid') {
        resolvedPaidAt = existing.paid_at || nowIso;
        existingAnswers._paidAmount = feeVal;
      } else if (
        typeof params.paidAmount === 'number' &&
        Number.isFinite(params.paidAmount) &&
        params.paidAmount > 0 &&
        nextStatus !== 'failed' &&
        nextStatus !== 'cancelled' &&
        nextStatus !== 'refunded'
      ) {
        const clampedPartial = Math.min(feeVal, Math.max(0, Math.round(params.paidAmount)));
        existingAnswers._paidAmount = clampedPartial;
        resolvedPaidAt = clampedPartial >= feeVal ? existing.paid_at || nowIso : null;
      } else {
        // Explicit reversal / unpaid / pending / failed / cancelled / refunded clears partial/paid markers
        delete existingAnswers._paidAmount;
        resolvedPaidAt = null;
      }

      const auditEntry = {
        action: nextStatus === 'paid' ? 'verify_payment' : prevPaymentStatus === 'paid' ? 'reverse_payment' : 'update_payment_status',
        by: verifier,
        at: nowMs,
        fromStatus: prevPaymentStatus,
        toStatus: nextStatus,
        ...(params.note ? { note: params.note } : {}),
        ...(typeof params.paidAmount === 'number' ? { paidAmount: params.paidAmount } : {}),
      };

      const nextAuditLog = Array.isArray(existing.audit_log_json)
        ? [...existing.audit_log_json, auditEntry]
        : [auditEntry];

      const validMethods = ['cash', 'upi', 'bank', 'complimentary'];
      const nextMethod =
        params.method && validMethods.includes(params.method) ? params.method : existing.method || 'upi';

      // Auto-promote admission status from 'pending' -> 'approved' when verified as paid (preserve already approved/rejected otherwise)
      const nextRegStatus =
        nextStatus === 'paid' && existing.status === 'pending'
          ? 'approved'
          : existing.status === 'paid' && nextStatus !== 'paid'
          ? 'approved'
          : existing.status;

      const patch: Record<string, any> = {
        payment_status: nextStatus,
        status: nextRegStatus,
        method: nextMethod,
        paid_at: resolvedPaidAt,
        verified_by: verifier,
        verified_at: nowIso,
        answers_json: existingAnswers,
        audit_log_json: nextAuditLog,
        updated_at: nowIso,
      };
      if (nextRegStatus === 'approved' && !existing.approved_at) {
        patch.approved_at = nowIso;
      }
      if (params.note !== undefined && params.note !== existing.notes) {
        patch.notes = params.note || null;
      }

      const { data: updatedRow, error: updateErr } = await (supabase.from('registrations') as any)
        .update(patch)
        .eq('id', params.id)
        .select('*')
        .single();

      if (updateErr || !updatedRow) {
        return { success: false, error: updateErr?.message || 'Failed to persist payment update.' };
      }

      const mapped = this.mapDbRegistration(updatedRow);
      this.logAudit(
        nextStatus === 'paid' ? 'payment_verified' : 'payment_status_updated',
        'registration',
        params.id,
        {
          regId: mapped.regId,
          playerName: mapped.name,
          fee: mapped.fee,
          fromStatus: prevPaymentStatus,
          toStatus: nextStatus,
          paidAmount: mapped.paidAmount,
          verifiedBy: verifier,
          note: params.note,
        }
      ).catch(() => {});

      return { success: true, registration: mapped };
    } catch (e: any) {
      return { success: false, error: e?.message || 'Database error verifying payment.' };
    }
  }

  /**
   * Partial column-scoped update so admission approval / profile edits never overwrite concurrent payment updates.
   */
  static async updateRegistrationFieldsAtomic(
    id: string,
    updates: Partial<Registration>
  ): Promise<{ success: boolean; registration?: Registration; error?: string }> {
    if (!this.isAvailable()) return { success: false, error: 'Supabase not configured' };
    try {
      const nowIso = new Date().toISOString();
      const patch: Record<string, any> = { updated_at: nowIso };

      if (updates.name !== undefined) patch.name = updates.name.trim();
      if (updates.mobile !== undefined) patch.mobile = updates.mobile.replace(/\D/g, '');
      if (updates.whatsapp !== undefined) patch.whatsapp = updates.whatsapp ? updates.whatsapp.replace(/\D/g, '') : null;
      if (updates.age !== undefined) patch.age = typeof updates.age === 'number' && !isNaN(updates.age) ? Math.round(updates.age) : null;
      if (updates.gender !== undefined) patch.gender = updates.gender;
      if (updates.experience !== undefined) patch.experience = updates.experience || null;
      if (updates.category !== undefined) patch.category = updates.category || null;
      if (updates.style !== undefined) patch.style = updates.style || null;
      if (updates.city !== undefined) patch.city = updates.city || null;
      if (updates.notes !== undefined) patch.notes = updates.notes || null;
      if (updates.playerId !== undefined) patch.player_id = updates.playerId || null;
      if (updates.fee !== undefined && !Number.isNaN(Number(updates.fee))) {
        patch.fee = Math.max(0, Math.round(Number(updates.fee)));
      }
      if (updates.status !== undefined) {
        patch.status = updates.status;
        if (updates.status === 'approved') {
          patch.approved_at = updates.approvedAt ? new Date(updates.approvedAt).toISOString() : nowIso;
        }
      }
      if (updates.paymentStatus !== undefined) {
        patch.payment_status = updates.paymentStatus;
        patch.paid_at = updates.paymentStatus === 'paid' ? (updates.paidAt ? new Date(updates.paidAt).toISOString() : nowIso) : null;
      }
      if (updates.method !== undefined) patch.method = updates.method;
      if (updates.txnId !== undefined) patch.txn_id = updates.txnId || null;

      const { data: updatedRow, error } = await (supabase.from('registrations') as any)
        .update(patch)
        .eq('id', id)
        .select('*')
        .single();

      if (error || !updatedRow) {
        return { success: false, error: error?.message || 'Failed updating registration' };
      }
      return { success: true, registration: this.mapDbRegistration(updatedRow) };
    } catch (e: any) {
      return { success: false, error: e?.message || 'Database update exception' };
    }
  }

  static async deleteRegistration(id: string): Promise<boolean> {
    if (!this.isAvailable()) return false;
    try {
      const { error } = await supabase.from('registrations').delete().eq('id', id);
      return !error;
    } catch {
      return false;
    }
  }

  static async deleteRegistrationsBulk(ids: string[]): Promise<boolean> {
    if (!this.isAvailable() || ids.length === 0) return false;
    try {
      const { error } = await supabase.from('registrations').delete().in('id', ids);
      return !error;
    } catch {
      return false;
    }
  }

  // ============================================================================
  // 5. REGISTRATION FORM CONFIG, TOURNAMENT SETTINGS & VERSIONS
  // ============================================================================
  static mapDbFormRow(row: DbRegistrationFormConfig): RegistrationFormConfig {
    const appJson = (row.appearance_json as any) || {};
    const customUrlSlug = appJson.customUrlSlug || undefined;

    return {
      seasonSlug: row.season_slug,
      customUrlSlug,
      tournamentName: row.tournament_name,
      seasonTitle: row.season_title,
      deadline: row.deadline || undefined,
      maxSlots: row.max_slots,
      entryFee: row.entry_fee,
      venue: row.venue || undefined,
      date: row.date || undefined,
      enabled: row.enabled,
      closedNotice: row.closed_notice || undefined,
      isPublished: row.is_published,
      version: row.version || 1,
      publishedAt: row.published_at ? new Date(row.published_at).getTime() : undefined,
      lastUpdatedAt: new Date(row.updated_at).getTime(),
      payment: row.payment_config_json as any,
      appearance: appJson,
      fields: row.fields_json || [],
    };
  }

  static extractTournamentSettingsFromConfig(
    config: RegistrationFormConfig | null
  ): { settings?: Partial<TournamentSettings>; payment?: Partial<PaymentSettings> } {
    if (!config) return {};
    const appAny = (config.appearance as any) || {};
    const embedded: Partial<TournamentSettings> = appAny.tournamentSettings || {};

    const settings: Partial<TournamentSettings> = {
      ...embedded,
      ...(config.tournamentName ? { name: config.tournamentName } : {}),
      ...(config.seasonTitle ? { season: config.seasonTitle } : {}),
      ...(config.venue !== undefined ? { venue: config.venue } : {}),
      ...(config.date !== undefined ? { date: config.date } : {}),
      ...(config.entryFee != null && !Number.isNaN(Number(config.entryFee))
        ? { entryFee: Number(config.entryFee) }
        : {}),
      ...(config.maxSlots != null && !Number.isNaN(Number(config.maxSlots))
        ? { slotLimit: Number(config.maxSlots) }
        : {}),
      ...(embedded.playoffSettings
        ? { playoffSettings: normalizePlayoffSettings(embedded.playoffSettings) }
        : {}),
    };

    const rawPay = (config.payment as any) || null;
    const payment: Partial<PaymentSettings> | undefined = rawPay
      ? {
          ...(rawPay.enabled !== undefined ? { enabled: Boolean(rawPay.enabled) } : {}),
          ...(rawPay.isMandatory !== undefined ? { isMandatory: Boolean(rawPay.isMandatory) } : {}),
          ...(rawPay.upiId !== undefined ? { upiId: String(rawPay.upiId) } : {}),
          ...(rawPay.accountName !== undefined ? { accountName: String(rawPay.accountName) } : {}),
          ...(rawPay.note !== undefined ? { note: String(rawPay.note) } : {}),
          ...(rawPay.instructions !== undefined ? { instructions: String(rawPay.instructions) } : {}),
          ...(rawPay.buttonText !== undefined ? { buttonText: String(rawPay.buttonText) } : {}),
          ...(rawPay.categoryFees !== undefined ? { categoryFees: rawPay.categoryFees } : {}),
        }
      : undefined;

    return { settings, payment };
  }

  static extractPlayoffStateFromConfig(config: RegistrationFormConfig | null): {
    format?: KnockoutData['format'];
    qualifyingTeamsCount?: number;
    qualificationMode?: KnockoutData['qualificationMode'];
    manualSelectedTeamIds?: string[];
    customStageConfig?: KnockoutData['customStageConfig'];
    bracketId?: string;
    published?: boolean;
    publishedAt?: number;
    publishedSnapshot?: KnockoutData['publishedSnapshot'];
    versionHistory?: KnockoutData['versionHistory'];
    showOnPublicHomepage?: boolean;
    status?: KnockoutData['status'];
    qualifiedTeams?: KnockoutData['qualifiedTeams'];
    disqualifiedTeamIds?: string[];
    manualTieBreakOrder?: string[];
    championTeamId?: string;
    runnerUpTeamId?: string;
    completedAt?: number;
    updatedAt?: number;
    auditLogs?: KnockoutData['auditLogs'];
    matchMetaById?: Record<string, Partial<KnockoutMatch>>;
  } | null {
    const raw = (config?.appearance as any)?.playoffState;
    if (!raw || typeof raw !== 'object') return null;
    return raw;
  }

  static extractTeamFormationFromConfig(
    config: RegistrationFormConfig | null
  ): {
    teamFormationMode?: 'random' | 'predefined' | 'mixed';
    predefinedTeams?: PredefinedTeam[];
  } {
    const raw = (config?.appearance as any)?.teamFormation;
    if (!raw || typeof raw !== 'object') return {};
    const mode =
      raw.mode === 'predefined' || raw.mode === 'mixed' || raw.mode === 'random'
        ? raw.mode
        : undefined;
    const predefinedTeams = Array.isArray(raw.predefinedTeams) ? raw.predefinedTeams : undefined;
    return { teamFormationMode: mode, predefinedTeams };
  }

  static async saveTeamFormationConfig(
    seasonSlug = 'season-4',
    teamFormationMode: 'random' | 'predefined' | 'mixed',
    predefinedTeams: PredefinedTeam[],
    seasonId?: string
  ): Promise<boolean> {
    if (!this.isAvailable()) return false;
    try {
      const targetSlug = seasonSlug || 'season-4';
      const nowIso = new Date().toISOString();
      const existingRow = await this.fetchFormConfigRow(targetSlug, { allowFallback: false });
      const snapshot = {
        mode: teamFormationMode,
        predefinedTeams: Array.isArray(predefinedTeams) ? predefinedTeams : [],
        updatedAt: Date.now(),
      };

      if (existingRow) {
        const existingApp = (existingRow.appearance_json as any) || {};
        const { error } = await (supabase.from('registration_form_config') as any)
          .update({
            appearance_json: {
              ...existingApp,
              teamFormation: snapshot,
            },
            updated_at: nowIso,
          })
          .eq('id', existingRow.id);
        return !error;
      }

      const defaultForm = createDefaultFormConfig(targetSlug);
      (defaultForm.appearance as any).teamFormation = snapshot;
      return await this.saveFormConfig(defaultForm, false, seasonId);
    } catch {
      return false;
    }
  }

  static async savePlayoffState(
    seasonSlug = 'season-4',
    knockout: KnockoutData,
    seasonId?: string
  ): Promise<boolean> {
    if (!this.isAvailable()) return false;
    try {
      const targetSlug = seasonSlug || 'season-4';
      const nowIso = new Date().toISOString();
      const existingRow = await this.fetchFormConfigRow(targetSlug, { allowFallback: false });

      const matchMetaById: Record<string, Partial<KnockoutMatch>> = {};
      for (const m of knockout.matches || []) {
        if (!m?.id) continue;
        matchMetaById[m.id] = {
          stage: m.stage,
          slot: m.slot,
          matchCode: m.matchCode,
          roundOrder: m.roundOrder,
          playoffRound: inferPlayoffRound(m, knockout.format),
          matchLabel: m.matchLabel,
          courtName: m.courtName,
          scheduledDate: m.scheduledDate,
          scheduledTime: m.scheduledTime,
          assignedUmpire: m.assignedUmpire,
          participantASource: m.participantASource,
          participantBSource: m.participantBSource,
          seedA: m.seedA,
          seedB: m.seedB,
          nextMatchCode: m.nextMatchCode,
          nextMatchSlot: m.nextMatchSlot,
          loserId: m.loserId,
          completedAt: m.completedAt,
          bracketId: m.bracketId || knockout.bracketId,
          isPlayoff: Boolean(m.isPlayoff || m.playoffRound),
          manual: m.manual,
        };
      }

      const playoffStateSnapshot = {
        format: knockout.format || DEFAULT_PLAYOFF_SETTINGS.format,
        qualifyingTeamsCount: knockout.qualifyingTeamsCount,
        qualificationMode: knockout.qualificationMode || 'auto',
        manualSelectedTeamIds: Array.isArray(knockout.manualSelectedTeamIds) ? knockout.manualSelectedTeamIds : [],
        customStageConfig: knockout.customStageConfig,
        bracketId: knockout.bracketId,
        published: knockout.published !== false,
        publishedAt: knockout.publishedAt,
        publishedSnapshot: Array.isArray(knockout.publishedSnapshot) ? knockout.publishedSnapshot : undefined,
        versionHistory: Array.isArray(knockout.versionHistory) ? knockout.versionHistory.slice(-15) : [],
        showOnPublicHomepage: knockout.showOnPublicHomepage !== false,
        status: knockout.status || 'active',
        qualifiedTeams: Array.isArray(knockout.qualifiedTeams) ? knockout.qualifiedTeams : [],
        disqualifiedTeamIds: Array.isArray(knockout.disqualifiedTeamIds) ? knockout.disqualifiedTeamIds : [],
        manualTieBreakOrder: Array.isArray(knockout.manualTieBreakOrder) ? knockout.manualTieBreakOrder : [],
        championTeamId: knockout.championTeamId,
        runnerUpTeamId: knockout.runnerUpTeamId,
        completedAt: knockout.completedAt,
        updatedAt: knockout.updatedAt || Date.now(),
        auditLogs: Array.isArray(knockout.auditLogs) ? knockout.auditLogs.slice(-50) : [],
        matchMetaById,
      };

      if (existingRow) {
        const existingApp = (existingRow.appearance_json as any) || {};
        await (supabase.from('registration_form_config') as any)
          .update({
            appearance_json: {
              ...existingApp,
              playoffState: playoffStateSnapshot,
            },
            updated_at: nowIso,
          })
          .eq('id', existingRow.id);
      }

      // Also sync cleanly to normalized playoff_brackets + playoff_matches if migration was applied
      try {
        if (knockout.matches && knockout.matches.length > 0) {
          const bracketId = knockout.bracketId || crypto.randomUUID();
          await (supabase.from('playoff_brackets') as any).upsert(
            {
              id: bracketId,
              season_slug: targetSlug,
              format: knockout.format || 'ipl_top4',
              status: knockout.status || 'active',
              published: knockout.published !== false,
              show_on_public_homepage: knockout.showOnPublicHomepage !== false,
              qualified_teams_json: playoffStateSnapshot.qualifiedTeams,
              disqualified_team_ids_json: playoffStateSnapshot.disqualifiedTeamIds,
              manual_tie_break_order_json: playoffStateSnapshot.manualTieBreakOrder,
              audit_logs_json: playoffStateSnapshot.auditLogs,
              champion_team_id: knockout.championTeamId || null,
              runner_up_team_id: knockout.runnerUpTeamId || null,
              completed_at: knockout.completedAt ? new Date(knockout.completedAt).toISOString() : null,
              updated_at: nowIso,
            },
            { onConflict: 'season_slug' }
          );

          const pmRows = knockout.matches
            .filter((m) => Boolean(inferPlayoffRound(m, knockout.format)))
            .map((m) => {
              const pr = inferPlayoffRound(m, knockout.format)!;
              const roundOrder = pr === 'Q1' ? 1 : pr === 'ELIM' ? 2 : pr === 'Q2' ? 3 : 4;
              return {
                id: m.id,
                bracket_id: bracketId,
                season_slug: targetSlug,
                match_type: pr,
                match_label: m.matchLabel || pr,
                slot: m.slot || roundOrder,
                round_order: roundOrder,
                team_a_id: m.teamA || null,
                team_b_id: m.teamB || null,
                participant_a_source: m.participantASource || null,
                participant_b_source: m.participantBSource || null,
                winner_id: m.winner || null,
                loser_id: m.loserId || null,
                score_a: m.scoreA != null ? m.scoreA : null,
                score_b: m.scoreB != null ? m.scoreB : null,
                sets_json: m.sets || [],
                court: typeof m.court === 'number' ? m.court : 1,
                court_name: m.courtName || null,
                scheduled_date: m.scheduledDate || null,
                scheduled_time: m.scheduledTime || null,
                time_label: m.time || null,
                umpire_name: m.assignedUmpire || null,
                mvp_player_id: m.mvpPlayerId || null,
                status: m.status === 'paused' ? 'postponed' : m.status || 'upcoming',
                completed_at: m.completedAt ? new Date(m.completedAt).toISOString() : null,
                updated_at: nowIso,
              };
            });

          if (pmRows.length > 0) {
            await (supabase.from('playoff_matches') as any).upsert(pmRows, { onConflict: 'id' });
          }
        } else {
          await (supabase.from('playoff_brackets') as any).delete().eq('season_slug', targetSlug);
        }
      } catch {
        // Optional normalized playoff tables may not be migrated yet; matches + appearance_json carry full state
      }

      return true;
    } catch {
      return false;
    }
  }

  static async fetchFormConfigRow(
    seasonSlug = 'season-4',
    options?: { allowFallback?: boolean }
  ): Promise<DbRegistrationFormConfig | null> {
    if (!this.isAvailable()) return null;
    try {
      const { data, error } = await supabase
        .from('registration_form_config')
        .select('*')
        .eq('season_slug', seasonSlug)
        .maybeSingle();

      if (!error && data) {
        return data as DbRegistrationFormConfig;
      }

      if (!options?.allowFallback) {
        return null;
      }

      const { data: fallbackData } = await supabase
        .from('registration_form_config')
        .select('*')
        .eq('is_published', true)
        .order('updated_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (fallbackData) {
        return fallbackData as DbRegistrationFormConfig;
      }

      const { data: anyRow } = await supabase
        .from('registration_form_config')
        .select('*')
        .order('updated_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      return (anyRow as unknown as DbRegistrationFormConfig) || null;
    } catch {
      return null;
    }
  }

  static async fetchFormConfig(
    seasonSlug = 'season-4',
    allowFallback = false
  ): Promise<RegistrationFormConfig | null> {
    const row = await this.fetchFormConfigRow(seasonSlug, { allowFallback });
    if (!row) return null;
    return this.mapDbFormRow(row);
  }

  static async saveFormConfig(
    config: RegistrationFormConfig,
    publish = false,
    seasonId?: string
  ): Promise<boolean> {
    if (!this.isAvailable()) return false;
    try {
      const slug = config.seasonSlug || 'season-4';
      const now = new Date().toISOString();

      const [{ data }, hasFormSeasonCol] = await Promise.all([
        supabase
          .from('registration_form_config')
          .select('id, version, appearance_json, published_at')
          .eq('season_slug', slug)
          .maybeSingle(),
        seasonId ? this.hasSeasonIdColumn('registration_form_config') : Promise.resolve(false),
      ]);

      const existing = data as any;
      const existingId = existing?.id || slug;
      const nextVersion = existing ? (existing.version || 1) + 1 : 1;

      // Preserve persisted tournamentSettings, teamFormation, Hero Section & Playoff metadata inside appearance_json
      const existingApp = (existing?.appearance_json as any) || {};
      const existingTournamentSettings = existingApp.tournamentSettings;
      const incomingTournamentSettings = (config.appearance as any)?.tournamentSettings;
      const mergedAppearance: Record<string, any> = {
        ...(config.appearance || {}),
        ...(existingApp.heroPublished ? { heroPublished: existingApp.heroPublished } : {}),
        ...(existingApp.heroDraft ? { heroDraft: existingApp.heroDraft } : {}),
        ...(existingApp.heroLastPublishedAt ? { heroLastPublishedAt: existingApp.heroLastPublishedAt } : {}),
        ...(existingApp.heroPublishedBy ? { heroPublishedBy: existingApp.heroPublishedBy } : {}),
        ...(existingApp.youtubeLive ? { youtubeLive: existingApp.youtubeLive } : {}),
        ...(existingApp.playoffState ? { playoffState: existingApp.playoffState } : {}),
        ...(existingApp.teamFormation ? { teamFormation: existingApp.teamFormation } : {}),
        ...(existingApp.seasonTeamIds ? { seasonTeamIds: existingApp.seasonTeamIds } : {}),
        ...(existingApp.seasonPlayerIds ? { seasonPlayerIds: existingApp.seasonPlayerIds } : {}),
        ...(existingApp.seasonNumber && !(config.appearance as any)?.seasonNumber ? { seasonNumber: existingApp.seasonNumber } : {}),
        ...(existingApp.editionName && !(config.appearance as any)?.editionName ? { editionName: existingApp.editionName } : {}),
        ...(existingApp.seasonStatus && !(config.appearance as any)?.seasonStatus ? { seasonStatus: existingApp.seasonStatus } : {}),
        ...(existingTournamentSettings || incomingTournamentSettings
          ? {
              tournamentSettings: {
                ...(existingTournamentSettings || {}),
                ...(incomingTournamentSettings || {}),
              },
            }
          : {}),
      };

      const payload: Record<string, any> = {
        id: existingId,
        season_slug: slug,
        ...(hasFormSeasonCol && seasonId ? { season_id: seasonId } : {}),
        tournament_name: config.tournamentName,
        season_title: config.seasonTitle,
        deadline: config.deadline ? new Date(config.deadline).toISOString() : null,
        max_slots: config.maxSlots ?? 32,
        entry_fee: config.entryFee ?? 500,
        venue: config.venue || null,
        date: config.date || null,
        enabled: config.enabled ?? true,
        closed_notice: config.closedNotice || null,
        is_published: publish ? true : config.isPublished,
        payment_config_json: config.payment || {},
        appearance_json: mergedAppearance,
        fields_json: config.fields || [],
        version: nextVersion,
        updated_at: now,
      };

      if (publish) {
        payload.published_at = now;
      } else if (existing?.published_at) {
        payload.published_at = existing.published_at;
      }

      const formTable = supabase.from('registration_form_config') as any;
      const { error } = existing
        ? await formTable.update(payload).eq('id', existingId)
        : await formTable.upsert(payload, { onConflict: 'season_slug' });

      if (!error) {
        await supabase.from('registration_form_versions').insert({
          form_config_id: existingId,
          season_slug: slug,
          version_num: nextVersion,
          snapshot_json: config as any,
          created_by: 'admin',
          created_at: now,
        } as any);
      }

      return !error;
    } catch {
      return false;
    }
  }

  static async fetchRegistrationOpenStatus(
    seasonSlug = 'season-4'
  ): Promise<{ enabled: boolean; closedNotice?: string } | null> {
    if (!this.isAvailable()) return null;
    try {
      const row = await this.fetchFormConfigRow(seasonSlug);
      if (!row) return null;
      return {
        enabled: row.enabled !== false,
        closedNotice: row.closed_notice || undefined,
      };
    } catch {
      return null;
    }
  }

  static async setRegistrationOpenStatus(
    seasonSlug = 'season-4',
    enabled: boolean,
    closedNotice?: string
  ): Promise<{ success: boolean; config?: RegistrationFormConfig; error?: string }> {
    if (!this.isAvailable()) {
      return { success: false, error: 'Supabase credentials are not configured.' };
    }
    try {
      const targetSlug = seasonSlug || 'season-4';
      const now = new Date().toISOString();
      const existingRow = await this.fetchFormConfigRow(targetSlug);

      if (existingRow) {
        const updatePayload: Record<string, any> = {
          enabled: Boolean(enabled),
          updated_at: now,
        };
        if (closedNotice !== undefined) {
          updatePayload.closed_notice = closedNotice || null;
        }
        const { data: savedRow, error } = await (supabase.from('registration_form_config') as any)
          .update(updatePayload)
          .eq('id', existingRow.id)
          .select('*')
          .single();

        if (error || !savedRow) {
          return {
            success: false,
            error: error?.message || 'Failed to update registration status in Supabase.',
          };
        }
        return {
          success: true,
          config: this.mapDbFormRow(savedRow as DbRegistrationFormConfig),
        };
      }

      const defaultForm = createDefaultFormConfig(targetSlug);
      const insertPayload = {
        id: targetSlug,
        season_slug: targetSlug,
        tournament_name: defaultForm.tournamentName,
        season_title: defaultForm.seasonTitle,
        deadline: defaultForm.deadline ? new Date(defaultForm.deadline).toISOString() : null,
        max_slots: defaultForm.maxSlots ?? 32,
        entry_fee: defaultForm.entryFee ?? 500,
        venue: defaultForm.venue || null,
        date: defaultForm.date || null,
        enabled: Boolean(enabled),
        closed_notice: closedNotice ?? defaultForm.closedNotice ?? null,
        is_published: true,
        payment_config_json: defaultForm.payment || {},
        appearance_json: defaultForm.appearance || {},
        fields_json: defaultForm.fields || [],
        version: 1,
        published_at: now,
        updated_at: now,
      };

      const { data: savedRow, error } = await supabase
        .from('registration_form_config')
        .upsert(insertPayload as any, { onConflict: 'season_slug' })
        .select('*')
        .single();

      if (error || !savedRow) {
        return {
          success: false,
          error: error?.message || 'Failed to persist registration status in Supabase.',
        };
      }

      return {
        success: true,
        config: this.mapDbFormRow(savedRow as DbRegistrationFormConfig),
      };
    } catch (e: any) {
      return {
        success: false,
        error: e?.message || 'Unexpected error updating registration status in Supabase.',
      };
    }
  }

  static async saveTournamentConfig(
    seasonSlug = 'season-4',
    settingsUpdate?: Partial<TournamentSettings>,
    paymentUpdate?: Partial<PaymentSettings>
  ): Promise<{
    success: boolean;
    error?: string;
    config?: RegistrationFormConfig;
    settings?: Partial<TournamentSettings>;
    payment?: Partial<PaymentSettings>;
  }> {
    if (!this.isAvailable()) {
      return { success: false, error: 'Supabase credentials are not configured.' };
    }

    try {
      const targetSlug = seasonSlug || 'season-4';
      const existingRow = await this.fetchFormConfigRow(targetSlug);
      const existingConfig = existingRow ? this.mapDbFormRow(existingRow) : null;
      const existingExtracted = this.extractTournamentSettingsFromConfig(existingConfig);
      const defaultForm = createDefaultFormConfig(targetSlug);
      const now = new Date().toISOString();

      const mergedSettings: Partial<TournamentSettings> = {
        ...(existingExtracted.settings || {}),
        ...(settingsUpdate || {}),
      };

      const existingPayment = (existingRow?.payment_config_json as any) || defaultForm.payment || {};
      const mergedPaymentConfig = paymentUpdate
        ? {
            ...existingPayment,
            ...paymentUpdate,
            baseFee:
              mergedSettings.entryFee != null
                ? Number(mergedSettings.entryFee)
                : existingPayment.baseFee ?? 500,
          }
        : {
            ...existingPayment,
            ...(mergedSettings.entryFee != null ? { baseFee: Number(mergedSettings.entryFee) } : {}),
          };

      const existingAppearance = (existingRow?.appearance_json as any) || defaultForm.appearance || {};
      const mergedAppearance = {
        ...existingAppearance,
        tournamentSettings: mergedSettings,
      };

      const resolvedName =
        (mergedSettings.name !== undefined ? String(mergedSettings.name).trim() : '') ||
        existingRow?.tournament_name ||
        defaultForm.tournamentName;
      const resolvedSeason =
        mergedSettings.season !== undefined
          ? String(mergedSettings.season)
          : existingRow?.season_title || defaultForm.seasonTitle;
      const resolvedVenue =
        mergedSettings.venue !== undefined
          ? String(mergedSettings.venue)
          : existingRow?.venue || defaultForm.venue || null;
      const resolvedDate =
        mergedSettings.date !== undefined
          ? String(mergedSettings.date)
          : existingRow?.date || defaultForm.date || null;
      const resolvedEntryFee =
        mergedSettings.entryFee != null && !Number.isNaN(Number(mergedSettings.entryFee))
          ? Math.max(0, Math.round(Number(mergedSettings.entryFee)))
          : existingRow?.entry_fee ?? 500;
      const resolvedMaxSlots =
        mergedSettings.slotLimit != null && !Number.isNaN(Number(mergedSettings.slotLimit))
          ? Math.max(2, Math.round(Number(mergedSettings.slotLimit)))
          : existingRow?.max_slots ?? 32;

      mergedSettings.name = resolvedName;
      mergedSettings.season = resolvedSeason;
      mergedSettings.venue = resolvedVenue || '';
      mergedSettings.date = resolvedDate || '';
      mergedSettings.entryFee = resolvedEntryFee;
      mergedSettings.slotLimit = resolvedMaxSlots;

      if (existingRow) {
        const updatePayload = {
          tournament_name: resolvedName,
          season_title: resolvedSeason,
          venue: resolvedVenue,
          date: resolvedDate,
          entry_fee: resolvedEntryFee,
          max_slots: resolvedMaxSlots,
          payment_config_json: mergedPaymentConfig,
          appearance_json: mergedAppearance,
          updated_at: now,
        };

        const { data: savedRow, error } = await (supabase.from('registration_form_config') as any)
          .update(updatePayload)
          .eq('id', existingRow.id)
          .select('*')
          .single();

        if (error || !savedRow) {
          return {
            success: false,
            error: error?.message || 'Failed to persist tournament settings in Supabase.',
          };
        }

        const savedConfig = this.mapDbFormRow(savedRow as DbRegistrationFormConfig);
        const extracted = this.extractTournamentSettingsFromConfig(savedConfig);
        return {
          success: true,
          config: savedConfig,
          settings: extracted.settings,
          payment: extracted.payment,
        };
      } else {
        const insertPayload = {
          id: targetSlug,
          season_slug: targetSlug,
          tournament_name: resolvedName,
          season_title: resolvedSeason,
          deadline: defaultForm.deadline ? new Date(defaultForm.deadline).toISOString() : null,
          max_slots: resolvedMaxSlots,
          entry_fee: resolvedEntryFee,
          venue: resolvedVenue,
          date: resolvedDate,
          enabled: true,
          closed_notice: defaultForm.closedNotice || null,
          is_published: true,
          payment_config_json: mergedPaymentConfig,
          appearance_json: mergedAppearance,
          fields_json: defaultForm.fields || [],
          version: 1,
          published_at: now,
          updated_at: now,
        };

        const { data: savedRow, error } = await supabase
          .from('registration_form_config')
          .upsert(insertPayload as any, { onConflict: 'season_slug' })
          .select('*')
          .single();

        if (error || !savedRow) {
          return {
            success: false,
            error: error?.message || 'Failed to create tournament settings record in Supabase.',
          };
        }

        const savedConfig = this.mapDbFormRow(savedRow as DbRegistrationFormConfig);
        const extracted = this.extractTournamentSettingsFromConfig(savedConfig);
        return {
          success: true,
          config: savedConfig,
          settings: extracted.settings,
          payment: extracted.payment,
        };
      }
    } catch (e: any) {
      return {
        success: false,
        error: e?.message || 'Unexpected error persisting settings to Supabase.',
      };
    }
  }

  static async updateTournamentSettings(
    seasonSlug = 'season-4',
    settingsUpdate?: Partial<{ tournamentName: string; seasonTitle: string; venue: string; date: string; maxSlots: number; entryFee: number; status: string }>,
    paymentUpdate?: any
  ): Promise<boolean> {
    const mappedSettings: Partial<TournamentSettings> | undefined = settingsUpdate
      ? {
          ...(settingsUpdate.tournamentName !== undefined ? { name: settingsUpdate.tournamentName } : {}),
          ...(settingsUpdate.seasonTitle !== undefined ? { season: settingsUpdate.seasonTitle } : {}),
          ...(settingsUpdate.venue !== undefined ? { venue: settingsUpdate.venue } : {}),
          ...(settingsUpdate.date !== undefined ? { date: settingsUpdate.date } : {}),
          ...(settingsUpdate.maxSlots !== undefined ? { slotLimit: settingsUpdate.maxSlots } : {}),
          ...(settingsUpdate.entryFee !== undefined ? { entryFee: settingsUpdate.entryFee } : {}),
        }
      : undefined;

    const res = await this.saveTournamentConfig(seasonSlug, mappedSettings, paymentUpdate);
    return res.success;
  }

  static async saveCustomUrlSlug(slug: string, seasonSlug = 'season-4'): Promise<boolean> {
    if (!this.isAvailable()) return false;
    try {
      const existing = await this.fetchFormConfig(seasonSlug);
      if (!existing) return false;
      const cleanSlug = slug.toLowerCase().trim().replace(/[^a-z0-9-]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
      const updatedConfig: RegistrationFormConfig = {
        ...existing,
        customUrlSlug: cleanSlug || 'register',
        appearance: {
          ...existing.appearance,
          customUrlSlug: cleanSlug || 'register',
        },
      };
      return await this.saveFormConfig(updatedConfig, false);
    } catch {
      return false;
    }
  }

  // ============================================================================
  // 6. REGISTRATION TOKENS (Shareable Links)
  // ============================================================================
  static async fetchTokens(seasonSlug = 'season-4'): Promise<{ tokens: RegistrationTokenRecord[]; activeToken: RegistrationTokenRecord | null } | null> {
    if (!this.isAvailable()) return null;
    try {
      const { data, error } = await supabase
        .from('registration_tokens')
        .select('*')
        .eq('season_slug', seasonSlug)
        .order('created_at', { ascending: false });

      if (error || !data) return null;

      const tokenRecords: RegistrationTokenRecord[] = (data as DbRegistrationToken[]).map((t) => ({
        id: t.id,
        token: t.token,
        seasonSlug: t.season_slug,
        label: t.label || undefined,
        createdAt: new Date(t.created_at).getTime(),
        isActive: t.is_active,
        revokedAt: t.revoked_at ? new Date(t.revoked_at).getTime() : undefined,
        submissionsCount: t.submissions_count || 0,
      }));

      const active = tokenRecords.find((t) => t.isActive) || tokenRecords[0] || null;
      return { tokens: tokenRecords, activeToken: active };
    } catch {
      return null;
    }
  }

  static async saveToken(tokenRecord: RegistrationTokenRecord): Promise<boolean> {
    if (!this.isAvailable()) return false;
    try {
      const payload = {
        id: tokenRecord.id,
        token: tokenRecord.token,
        season_slug: tokenRecord.seasonSlug,
        label: tokenRecord.label || null,
        is_active: tokenRecord.isActive,
        submissions_count: tokenRecord.submissionsCount || 0,
        revoked_at: tokenRecord.revokedAt ? new Date(tokenRecord.revokedAt).toISOString() : null,
        created_at: new Date(tokenRecord.createdAt).toISOString(),
      };

      const { error } = await supabase.from('registration_tokens').upsert(payload as any);
      return !error;
    } catch {
      return false;
    }
  }

  static async incrementTokenSubmission(token: string): Promise<boolean> {
    if (!this.isAvailable()) return false;
    try {
      const { data } = await supabase
        .from('registration_tokens')
        .select('*')
        .eq('token', token)
        .maybeSingle();

      if (!data) return false;
      const count = ((data as any).submissions_count || 0) + 1;
      const { error } = await (supabase.from('registration_tokens') as any)
        .update({ submissions_count: count })
        .eq('token', token);
      return !error;
    } catch {
      return false;
    }
  }

  // ============================================================================
  // 7. TOURNAMENT STANDINGS
  // ============================================================================
  static async syncStandings(season = 'season-4', standings: StandingsRecord[], seasonId?: string): Promise<boolean> {
    if (!this.isAvailable()) return false;
    try {
      const hasSeasonCol = seasonId ? await this.hasSeasonIdColumn('tournament_standings') : false;
      const rows = standings.map((s, idx) => ({
        season_slug: season,
        ...(hasSeasonCol && seasonId ? { season_id: seasonId } : {}),
        team_id: s.team.id,
        played: s.played,
        won: s.won,
        lost: s.lost,
        tied: 0,
        no_result: 0,
        points: s.points,
        points_for: s.pointsFor,
        points_against: s.pointsAgainst,
        net_run_rate: s.diff,
        form: s.form || [],
        rank: idx + 1,
        updated_at: new Date().toISOString(),
      }));

      const { error } = await supabase
        .from('tournament_standings')
        .upsert(rows as any, { onConflict: 'season_slug,team_id' });

      return !error;
    } catch {
      return false;
    }
  }

  static async fetchStandings(season = 'season-4', seasonId?: string): Promise<StandingsRecord[] | null> {
    if (!this.isAvailable()) return null;
    try {
      const hasSeasonCol = seasonId ? await this.hasSeasonIdColumn('tournament_standings') : false;
      let query = supabase
        .from('tournament_standings')
        .select('*, teams(*)')
        .order('rank', { ascending: true });

      if (hasSeasonCol && seasonId) {
        query = (query as any).or(`season_slug.eq.${season},season_id.eq.${seasonId}`);
      } else {
        query = query.eq('season_slug', season);
      }

      const { data, error } = await query;
      if (error || !data) return null;
      return (data as any[]).map((r) => ({
        team: {
          id: r.team_id,
          name: r.teams?.name || r.team_id,
          avatarColor: r.teams?.avatar_color || 'from-amber-500 to-orange-600',
          badge: r.teams?.badge || '🏸',
          players: [],
        },
        played: r.played,
        won: r.won,
        lost: r.lost,
        points: r.points,
        diff: r.net_run_rate || 0,
        pointsFor: r.points_for || 0,
        pointsAgainst: r.points_against || 0,
        form: r.form || [],
      }));
    } catch {
      return null;
    }
  }

  // ============================================================================
  // 8. AUDIT LOGGING
  // ============================================================================
  static async logAudit(action: string, entityType: string, entityId?: string, details?: any, user?: any, seasonId?: string): Promise<void> {
    if (!this.isAvailable()) return;
    try {
      const hasSeasonCol = seasonId ? await this.hasSeasonIdColumn('audit_logs') : false;
      await supabase.from('audit_logs').insert({
        action,
        entity_type: entityType,
        entity_id: entityId || null,
        user_id: user?.id || null,
        user_email: user?.email || null,
        details_json: details || {},
        ...(hasSeasonCol && seasonId ? { season_id: seasonId } : {}),
        created_at: new Date().toISOString(),
      } as any);
    } catch {}
  }

  // ============================================================================
  // 9. SUPABASE REALTIME LIVE SCORE & REGISTRATION SUBSCRIPTIONS
  // ============================================================================
  private static cleanupExistingChannels(channelName: string) {
    try {
      const existingChannels = supabase.getChannels?.() || [];
      for (const ch of existingChannels) {
        const topic = (ch as any)?.topic || '';
        if (topic === channelName || topic === `realtime:${channelName}`) {
          void supabase.removeChannel(ch);
        }
      }
    } catch {}
  }

  static subscribeLiveMatches(onMatchChange: (payload: any) => void) {
    if (!this.isAvailable()) return () => {};
    try {
      const channelName = 'spl-live-matches-channel';
      this.cleanupExistingChannels(channelName);
      const channel = supabase
        .channel(channelName)
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'matches' },
          (payload) => {
            onMatchChange(payload);
          }
        )
        .subscribe();

      return () => {
        try {
          void supabase.removeChannel(channel);
        } catch {}
      };
    } catch {
      return () => {};
    }
  }

  static subscribeRegistrations(onRegChange: (payload: any) => void) {
    if (!this.isAvailable()) return () => {};
    try {
      const channelName = 'spl-live-registrations-channel';
      this.cleanupExistingChannels(channelName);
      const channel = supabase
        .channel(channelName)
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'registrations' },
          (payload) => {
            onRegChange(payload);
          }
        )
        .subscribe();

      return () => {
        try {
          void supabase.removeChannel(channel);
        } catch {}
      };
    } catch {
      return () => {};
    }
  }

  static subscribePlayers(onPlayerChange: (payload: any) => void) {
    if (!this.isAvailable()) return () => {};
    try {
      const channelName = 'spl-live-players-channel';
      this.cleanupExistingChannels(channelName);
      const channel = supabase
        .channel(channelName)
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'players' },
          (payload) => {
            onPlayerChange(payload);
          }
        )
        .subscribe();

      return () => {
        try {
          void supabase.removeChannel(channel);
        } catch {}
      };
    } catch {
      return () => {};
    }
  }

  static subscribeTournamentMaster(handlers: TournamentRealtimeHandlers): () => void {
    if (!this.isAvailable()) return () => {};
    let disposed = false;
    try {
      const channelName = handlers.seasonSlug
        ? `spl-master-realtime-${handlers.seasonSlug}`
        : 'spl-master-realtime-channel';
      this.cleanupExistingChannels(channelName);

      const channel = supabase
        .channel(channelName)
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'matches' },
          (payload: any) => {
            if (!disposed) handlers.onMatchChange?.(payload);
          }
        )
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'players' },
          (payload: any) => {
            if (!disposed) handlers.onPlayerChange?.(payload);
          }
        )
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'teams' },
          (payload: any) => {
            if (!disposed) handlers.onTeamChange?.(payload);
          }
        )
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'team_players' },
          (payload: any) => {
            if (!disposed) handlers.onTeamPlayerChange?.(payload);
          }
        )
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'registrations' },
          (payload: any) => {
            if (!disposed) handlers.onRegistrationChange?.(payload);
          }
        )
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'tournament_standings' },
          (payload: any) => {
            if (!disposed) handlers.onStandingsChange?.(payload);
          }
        )
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'registration_form_config' },
          (payload: any) => {
            if (!disposed) handlers.onFormConfigChange?.(payload);
          }
        )
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'playoff_brackets' },
          (payload: any) => {
            if (!disposed) handlers.onPlayoffChange?.(payload);
          }
        )
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'playoff_matches' },
          (payload: any) => {
            if (!disposed) handlers.onPlayoffChange?.(payload);
          }
        )
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'tournament_seasons' },
          (payload: any) => {
            if (!disposed) handlers.onSeasonChange?.(payload);
          }
        )
        .subscribe((status) => {
          if (!disposed) handlers.onStatusChange?.(status);
        });

      return () => {
        disposed = true;
        try {
          void supabase.removeChannel(channel);
        } catch {}
      };
    } catch {
      return () => {};
    }
  }

  // ============================================================================
  // 8. HERO SECTION CUSTOMIZATION (DRAFT, PUBLISH, VERSIONS, MEDIA)
  // ============================================================================
  static extractPublishedHeroFromConfig(config: RegistrationFormConfig | null): HeroConfig {
    const rawHero = (config?.appearance as any)?.heroPublished;
    if (rawHero && typeof rawHero === 'object') {
      const normalized = normalizeHeroConfig(rawHero);
      normalized.status = 'published';
      return normalized;
    }
    return cloneHeroConfig(DEFAULT_HERO_CONFIG);
  }

  static extractPublishedHeroFromRow(row: DbRegistrationFormConfig | null): HeroConfig {
    const rawHero = (row?.appearance_json as any)?.heroPublished;
    if (rawHero && typeof rawHero === 'object') {
      const normalized = normalizeHeroConfig(rawHero);
      normalized.status = 'published';
      return normalized;
    }
    return cloneHeroConfig(DEFAULT_HERO_CONFIG);
  }

  static async fetchPublishedHeroConfig(seasonSlug = 'season-4'): Promise<HeroConfig> {
    if (this.isAvailable()) {
      try {
        const row = await this.fetchFormConfigRow(seasonSlug);
        const appJson = (row?.appearance_json as any) || {};
        if (appJson.heroPublished && typeof appJson.heroPublished === 'object') {
          const normalized = normalizeHeroConfig(appJson.heroPublished);
          normalized.status = 'published';
          return normalized;
        }
      } catch {}
    }

    try {
      const res = await fetch(`/api/hero/published?season=${encodeURIComponent(seasonSlug)}&t=${Date.now()}`, {
        cache: 'no-store',
      });
      if (res.ok) {
        const data = await res.json().catch(() => null);
        if (data?.heroConfig) {
          const normalized = normalizeHeroConfig(data.heroConfig);
          normalized.status = 'published';
          return normalized;
        }
      }
    } catch {}

    if (seasonSlug && seasonSlug !== 'season-4') {
      const seasonMeta = await this.resolveSeasonContext(seasonSlug).catch(() => null);
      if (seasonMeta && seasonMeta.seasonSlug === seasonSlug) {
        return buildSeasonInitialHeroConfig(seasonMeta);
      }
    }

    return cloneHeroConfig(DEFAULT_HERO_CONFIG);
  }

  static async fetchHeroVersions(seasonSlug = 'season-4'): Promise<HeroVersionRecord[]> {
    if (!this.isAvailable()) return [];
    try {
      const { data, error } = await supabase
        .from('registration_form_versions')
        .select('*')
        .eq('season_slug', seasonSlug)
        .order('created_at', { ascending: false })
        .limit(40);

      if (error || !Array.isArray(data)) return [];

      return (data as any[])
        .filter((row) => row?.snapshot_json?.kind === 'hero_version' && row?.snapshot_json?.heroConfig)
        .slice(0, 20)
        .map((row) => ({
          id: row.id,
          versionNum: Number(row.version_num) || 1,
          action: row.snapshot_json.action === 'restore' ? 'restore' : 'publish',
          createdBy: String(row.created_by || 'admin').replace(/^hero:/, ''),
          createdAt: row.created_at ? new Date(row.created_at).getTime() : Date.now(),
          summary: String(row.snapshot_json.summary || `Published v${row.version_num}`),
          config: normalizeHeroConfig(row.snapshot_json.heroConfig),
        }));
    } catch {
      return [];
    }
  }

  static async fetchAdminHeroState(seasonSlug = 'season-4'): Promise<{
    published: HeroConfig;
    draft: HeroConfig;
    versions: HeroVersionRecord[];
  }> {
    try {
      const res = await fetch(`/api/hero/admin/state?season=${encodeURIComponent(seasonSlug)}&t=${Date.now()}`, {
        headers: { ...AuthService.getAuthHeader() },
        cache: 'no-store',
      });
      if (res.ok) {
        const data = await res.json().catch(() => null);
        if (data?.published && data?.draft) {
          return {
            published: normalizeHeroConfig({ ...data.published, status: 'published' }),
            draft: normalizeHeroConfig({ ...data.draft, status: 'draft' }),
            versions: Array.isArray(data.versions)
              ? data.versions.map((v: any) => ({
                  ...v,
                  config: normalizeHeroConfig(v.config),
                }))
              : [],
          };
        }
      }
    } catch {}

    const published = await this.fetchPublishedHeroConfig(seasonSlug);
    let draft = cloneHeroConfig({ ...published, status: 'draft' });
    if (this.isAvailable()) {
      const row = await this.fetchFormConfigRow(seasonSlug);
      const rawDraft = (row?.appearance_json as any)?.heroDraft;
      if (rawDraft && typeof rawDraft === 'object') {
        draft = normalizeHeroConfig({ ...rawDraft, status: 'draft' });
      }
    }
    const versions = await this.fetchHeroVersions(seasonSlug);
    return { published, draft, versions };
  }

  static async saveHeroDraft(
    draftConfig: HeroConfig,
    author = 'Tournament Director',
    seasonSlug = 'season-4'
  ): Promise<{ success: boolean; draft?: HeroConfig; error?: string }> {
    const cleanDraft = normalizeHeroConfig({
      ...draftConfig,
      status: 'draft',
      updatedAt: Date.now(),
      updatedBy: author,
    });

    try {
      const res = await fetch('/api/hero/draft', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...AuthService.getAuthHeader(),
        },
        body: JSON.stringify({ config: cleanDraft, author, seasonSlug }),
      });

      const data = await res.json().catch(() => ({}));
      if (res.ok && data?.success) {
        return {
          success: true,
          draft: normalizeHeroConfig({ ...(data.draft || cleanDraft), status: 'draft' }),
        };
      }
      if (res.status === 401 || res.status === 403 || res.status === 400) {
        return { success: false, error: data?.error || 'Authorization or validation error' };
      }
    } catch {}

    // Direct Supabase fallback when server route is unreachable (only if authorized organizer)
    if (!AuthService.canManageTournament()) {
      return { success: false, error: 'Unauthorized: Tournament Director or Super Admin required.' };
    }
    if (!this.isAvailable()) {
      return { success: false, error: 'Unable to save draft: database connection unavailable.' };
    }

    try {
      const existingRow = await this.fetchFormConfigRow(seasonSlug);
      if (!existingRow) return { success: false, error: 'Configuration record not found.' };
      const existingAppearance = (existingRow.appearance_json as any) || {};
      const mergedAppearance = {
        ...existingAppearance,
        heroDraft: cleanDraft,
      };
      const { error } = await (supabase.from('registration_form_config') as any)
        .update({
          appearance_json: mergedAppearance,
          updated_at: new Date().toISOString(),
        })
        .eq('id', existingRow.id);

      if (error) return { success: false, error: error.message };
      return { success: true, draft: cleanDraft };
    } catch (e: any) {
      return { success: false, error: e?.message || 'Failed to save draft.' };
    }
  }

  static async publishHeroConfig(
    config: HeroConfig,
    author = 'Tournament Director',
    summary = 'Hero customization published',
    action: 'publish' | 'restore' = 'publish',
    seasonSlug = 'season-4'
  ): Promise<{
    success: boolean;
    published?: HeroConfig;
    version?: HeroVersionRecord;
    error?: string;
  }> {
    const sanitized = normalizeHeroConfig(config);

    try {
      const res = await fetch('/api/hero/publish', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...AuthService.getAuthHeader(),
        },
        body: JSON.stringify({ config: sanitized, author, summary, action, seasonSlug }),
      });

      const data = await res.json().catch(() => ({}));
      if (res.ok && data?.success) {
        return {
          success: true,
          published: normalizeHeroConfig({ ...(data.published || sanitized), status: 'published' }),
          version: data.version
            ? { ...data.version, config: normalizeHeroConfig(data.version.config) }
            : undefined,
        };
      }
      if (res.status === 401 || res.status === 403 || res.status === 400) {
        return { success: false, error: data?.error || 'Unauthorized or invalid hero configuration' };
      }
    } catch {}

    if (!AuthService.canManageTournament()) {
      return { success: false, error: 'Unauthorized: Tournament Director or Super Admin required.' };
    }
    if (!this.isAvailable()) {
      return { success: false, error: 'Unable to publish: database connection unavailable.' };
    }

    try {
      const existingRow = await this.fetchFormConfigRow(seasonSlug);
      if (!existingRow) return { success: false, error: 'Configuration record not found.' };

      const existingApp = (existingRow.appearance_json as any) || {};
      const currentVersion = Number(existingApp.heroPublished?.version || 0);
      const nextVersionNum = Math.max(1, currentVersion + 1);
      const nowMs = Date.now();
      const nowIso = new Date(nowMs).toISOString();

      const publishedConfig: HeroConfig = {
        ...sanitized,
        version: nextVersionNum,
        status: 'published',
        updatedAt: nowMs,
        updatedBy: author,
        publishedAt: nowMs,
        publishedBy: author,
      };

      const draftMirror: HeroConfig = { ...publishedConfig, status: 'draft' };

      const mergedAppearance = {
        ...existingApp,
        heroPublished: publishedConfig,
        heroDraft: draftMirror,
        heroLastPublishedAt: nowIso,
        heroPublishedBy: author,
      };

      const { error } = await (supabase.from('registration_form_config') as any)
        .update({
          appearance_json: mergedAppearance,
          updated_at: nowIso,
        })
        .eq('id', existingRow.id);

      if (error) return { success: false, error: error.message };

      const versionId = crypto.randomUUID();
      await supabase.from('registration_form_versions').insert({
        id: versionId,
        form_config_id: existingRow.id,
        season_slug: existingRow.season_slug || seasonSlug,
        version_num: nextVersionNum,
        snapshot_json: {
          kind: 'hero_version',
          action,
          summary,
          heroConfig: publishedConfig,
        } as any,
        created_by: `hero:${author}`,
        created_at: nowIso,
      } as any);

      void this.logAudit('hero_published', 'hero_config', existingRow.id, {
        version: nextVersionNum,
        action,
        summary,
      });

      return {
        success: true,
        published: publishedConfig,
        version: {
          id: versionId,
          versionNum: nextVersionNum,
          action,
          createdBy: author,
          createdAt: nowMs,
          summary,
          config: publishedConfig,
        },
      };
    } catch (e: any) {
      return { success: false, error: e?.message || 'Failed to publish Hero configuration.' };
    }
  }

  static async uploadHeroMediaFile(
    file: File,
    kind: 'logo' | 'image' | 'video'
  ): Promise<{
    success: boolean;
    url?: string;
    storagePath?: string;
    mimeType?: string;
    size?: number;
    provider?: 'supabase' | 'server';
    error?: string;
  }> {
    const maxBytes =
      kind === 'logo' ? 3 * 1024 * 1024 : kind === 'image' ? 10 * 1024 * 1024 : 50 * 1024 * 1024;
    if (file.size > maxBytes) {
      const mbLimit = Math.round(maxBytes / (1024 * 1024));
      return { success: false, error: `File exceeds the ${mbLimit}MB limit for Hero ${kind} uploads.` };
    }

    try {
      const res = await fetch('/api/hero/media/upload', {
        method: 'POST',
        headers: {
          'Content-Type': file.type || 'application/octet-stream',
          'X-File-Name': encodeURIComponent(file.name),
          'X-Media-Kind': kind,
          ...AuthService.getAuthHeader(),
        },
        body: file,
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data?.success && data?.url) {
        return {
          success: true,
          url: data.url,
          storagePath: data.storagePath,
          mimeType: data.mimeType,
          size: data.size,
          provider: data.provider || 'server',
        };
      }
      return {
        success: false,
        error: data?.error || `Upload failed with status ${res.status}`,
      };
    } catch (e: any) {
      return { success: false, error: e?.message || 'Media upload network error.' };
    }
  }

  // ============================================================================
  // 10. YOUTUBE LIVE STREAMING MANAGEMENT (SUPABASE PERSISTENCE + RBAC)
  // ============================================================================
  static extractYouTubeLiveFromRow(row: DbRegistrationFormConfig | null): YouTubeLiveConfig | null {
    const raw = (row?.appearance_json as any)?.youtubeLive;
    if (!raw || typeof raw !== 'object') return null;
    return normalizeYouTubeLiveConfig(raw);
  }

  static extractYouTubeLiveFromConfig(cfg: RegistrationFormConfig | null): YouTubeLiveConfig | null {
    const raw = (cfg?.appearance as any)?.youtubeLive;
    if (!raw || typeof raw !== 'object') return null;
    return normalizeYouTubeLiveConfig(raw);
  }

  static async fetchYouTubeLiveConfig(seasonSlug = 'season-4'): Promise<YouTubeLiveConfig> {
    if (this.isAvailable()) {
      try {
        const row = await this.fetchFormConfigRow(seasonSlug);
        const extracted = this.extractYouTubeLiveFromRow(row);
        if (extracted) return extracted;
      } catch {}
    }

    try {
      const res = await fetch(`/api/livestream?season=${encodeURIComponent(seasonSlug)}&t=${Date.now()}`, {
        cache: 'no-store',
      });
      if (res.ok) {
        const data = await res.json().catch(() => null);
        if (data?.config) {
          return normalizeYouTubeLiveConfig(data.config);
        }
      }
    } catch {}

    return { ...DEFAULT_YOUTUBE_LIVE_CONFIG };
  }

  static async saveYouTubeLiveConfig(
    input: Partial<YouTubeLiveConfig>,
    author = 'Tournament Director',
    seasonSlug = 'season-4'
  ): Promise<{ success: boolean; config?: YouTubeLiveConfig; error?: string }> {
    const rawUrl = typeof input.videoUrl === 'string' ? input.videoUrl.trim() : '';
    const parsedUrl = rawUrl ? extractYouTubeVideoId(rawUrl) : null;

    if (rawUrl && (!parsedUrl || !parsedUrl.valid)) {
      return {
        success: false,
        error: parsedUrl?.error || 'Please enter a valid YouTube URL or 11-character Video ID.',
      };
    }

    if (input.enabled && !parsedUrl?.valid) {
      return {
        success: false,
        error: 'Provide a valid YouTube live stream URL before enabling the public Watch Live button.',
      };
    }

    const sanitized = normalizeYouTubeLiveConfig({
      ...input,
      videoUrl: parsedUrl?.valid ? parsedUrl.normalizedUrl : '',
      videoId: parsedUrl?.valid ? parsedUrl.videoId : '',
      updatedAt: Date.now(),
      updatedBy: author,
    });

    try {
      const res = await fetch('/api/livestream', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...AuthService.getAuthHeader(),
        },
        body: JSON.stringify({ config: sanitized, author, seasonSlug }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data?.success && data?.config) {
        return { success: true, config: normalizeYouTubeLiveConfig(data.config) };
      }
      if (res.status === 400 || res.status === 401 || res.status === 403) {
        return { success: false, error: data?.error || 'Unauthorized or invalid YouTube stream settings.' };
      }
    } catch {}

    if (!AuthService.canManageTournament()) {
      return { success: false, error: 'Unauthorized: Tournament Director or Super Admin required.' };
    }
    if (!this.isAvailable()) {
      return { success: false, error: 'Unable to save YouTube Live settings: database unreachable.' };
    }

    try {
      const existingRow = await this.fetchFormConfigRow(seasonSlug);
      if (!existingRow) {
        return { success: false, error: 'Tournament configuration record not found in Supabase.' };
      }
      const nowIso = new Date().toISOString();
      const existingApp = (existingRow.appearance_json as any) || {};
      const mergedAppearance = {
        ...existingApp,
        youtubeLive: sanitized,
      };
      const { error } = await (supabase.from('registration_form_config') as any)
        .update({
          appearance_json: mergedAppearance,
          updated_at: nowIso,
        })
        .eq('id', existingRow.id);

      if (error) {
        return { success: false, error: error.message };
      }

      void this.logAudit('youtube_live_updated', 'livestream_config', existingRow.id, {
        status: sanitized.status,
        enabled: sanitized.enabled,
        videoId: sanitized.videoId,
        allowReplay: sanitized.allowReplay,
      });

      return { success: true, config: sanitized };
    } catch (e: any) {
      return { success: false, error: e?.message || 'Failed to save YouTube Live settings.' };
    }
  }
}

export interface RealtimeChangeEvent<T = any> {
  eventType: 'INSERT' | 'UPDATE' | 'DELETE';
  new: T;
  old: T;
  table: string;
  schema: string;
  commit_timestamp?: string;
  errors?: any[];
}

export interface TournamentRealtimeHandlers {
  seasonSlug?: string;
  seasonId?: string;
  onMatchChange?: (payload: RealtimeChangeEvent) => void;
  onPlayerChange?: (payload: RealtimeChangeEvent) => void;
  onTeamChange?: (payload: RealtimeChangeEvent) => void;
  onTeamPlayerChange?: (payload: RealtimeChangeEvent) => void;
  onRegistrationChange?: (payload: RealtimeChangeEvent) => void;
  onFormConfigChange?: (payload: RealtimeChangeEvent) => void;
  onStandingsChange?: (payload: RealtimeChangeEvent) => void;
  onPlayoffChange?: (payload: RealtimeChangeEvent) => void;
  onSeasonChange?: (payload: RealtimeChangeEvent) => void;
  onStatusChange?: (status: string) => void;
}
