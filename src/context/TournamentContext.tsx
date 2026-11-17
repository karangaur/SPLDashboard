import React, { createContext, useContext, useEffect, useState, useMemo, useRef, useCallback } from 'react';
import {
  TournamentState,
  Player,
  Team,
  Match,
  KnockoutData,
  KnockoutMatch,
  CustomKnockoutStageConfig,
  PlayoffFormat,
  QualificationMode,
  KnockoutBracketSnapshot,
  PlayoffAuditEntry,
  PlayoffQualifiedSeed,
  Registration,
  RegistrationSettings,
  TournamentSettings,
  PaymentSettings,
  PredefinedTeam,
  RegistrationFormField,
  RegistrationFormConfig,
  FormAppearance,
  RegistrationTokenRecord,
  PaymentStatus,
  HeroConfig,
  HeroVersionRecord,
  YouTubeLiveConfig,
  TournamentSeason,
  TournamentSeasonStatus,
  SeasonSummaryCounts,
  CreateSeasonInput,
  UpdateSeasonInput,
  ActivateSeasonResult,
  ActiveSeasonContextValue,
} from '../types/tournament';
import {
  STORAGE_KEY,
  getSeasonStorageKey,
  DEFAULT_STATE,
  DEFAULT_REGISTRATION_SETTINGS,
  createDefaultFormConfig,
  generateRoundRobinFixtures,
  progressKnockoutMatches,
  calculateStandings,
} from '../utils/tournamentEngine';
import {
  DEFAULT_PLAYOFF_SETTINGS,
  normalizePlayoffSettings,
  resolveFormatQualifyingCount,
  getFormatDisplayTitle,
  calculatePlayoffLeagueStandings,
  evaluatePlayoffGenerationEligibility,
  generateIPLPlayoffBracket,
  generateFlexibleKnockoutBracket,
  validateCustomKnockoutStageConfig,
  materializeCustomKnockoutMatches,
  canStartOrScorePlayoffMatch,
  progressIPLPlayoffs,
  progressKnockoutBracket,
  findDownstreamDependentMatches,
  validateKnockoutBracketConfig,
  createPlayoffAuditEntry,
  inferPlayoffRound,
  extractCompletedMatchStats,
} from '../utils/playoffEngine';
import {
  DEFAULT_HERO_CONFIG,
  DEFAULT_HERO_VERSION_COLOR,
  normalizeHeroConfig,
  cloneHeroConfig,
  sanitizeHexColor,
  buildSeasonInitialHeroConfig,
} from '../utils/heroDefaults';
import {
  DEFAULT_YOUTUBE_LIVE_CONFIG,
  normalizeYouTubeLiveConfig,
} from '../utils/youtube';
import { SupabaseService } from '../services/supabaseService';
import { isSupabaseConfigured, testSupabaseConnection } from '../lib/supabase';
import { AuthService } from '../services/authService';
import {
  computeManualTeamEdit,
  ManualTeamEditInput,
  ManualTeamEditPreviewResult,
} from '../utils/manualTeamEditEngine';
import {
  normalizeScheduleSequence,
  parseMatchScheduleTime,
  ScheduleValidationReport,
  sortMatchesByScheduleOrder,
  validateScheduleDraft,
} from '../utils/scheduleEditorEngine';

export interface DatabaseDiagnosticResult {
  connected: boolean;
  message: string;
  serverStatus?: {
    active: boolean;
    storage: string;
    registeredPlayers?: number;
    rosterPlayers?: number;
    teamsCount?: number;
    matchesCount?: number;
    realtimeSyncActive?: boolean;
  };
  supabaseStatus?: {
    configured: boolean;
    connected: boolean;
    message: string;
    hint?: string;
  };
}

export type RealtimeConnectionStatus = 'connecting' | 'connected' | 'reconnecting' | 'offline';

interface TournamentContextType {
  state: TournamentState;
  standings: ReturnType<typeof calculateStandings>;

  // Active Season Context
  activeSeason: TournamentSeason;
  seasons: TournamentSeason[];
  seasonSummaries: Record<string, SeasonSummaryCounts>;
  seasonLoading: boolean;
  seasonError: string | null;
  isSeasonLocked: boolean;
  refreshSeason: () => Promise<void>;
  refreshSeasonSummaries: (seasonsList?: TournamentSeason[]) => Promise<Record<string, SeasonSummaryCounts>>;
  switchActiveSeason: (seasonIdOrSlug: string, options?: { persistGlobal?: boolean }) => Promise<boolean>;
  activateSeasonSafely: (seasonIdOrSlug: string, options?: { force?: boolean }) => Promise<ActivateSeasonResult>;
  createSeason: (input: CreateSeasonInput) => Promise<{ success: boolean; season?: TournamentSeason; error?: string }>;
  updateSeason: (seasonIdOrSlug: string, updates: UpdateSeasonInput) => Promise<{ success: boolean; season?: TournamentSeason; error?: string }>;
  updateSeasonStatus: (seasonIdOrSlug: string, status: TournamentSeasonStatus) => Promise<boolean>;

  // Centralized Database & Realtime Status
  isCentralizedDbConnected: boolean;
  isSupabaseConnected: boolean;
  dbBackendType: 'supabase' | 'local_server';
  realtimeStatus: RealtimeConnectionStatus;
  reconnectRealtime: () => void;
  testDbConnection: () => Promise<DatabaseDiagnosticResult>;

  
  // Settings
  updateSettings: (settings: Partial<TournamentSettings>) => Promise<{ success: boolean; error?: string }>;
  updatePaymentSettings: (payment: Partial<PaymentSettings>) => Promise<{ success: boolean; error?: string }>;
  saveAllSettings: (
    settings: Partial<TournamentSettings>,
    payment?: Partial<PaymentSettings>
  ) => Promise<{ success: boolean; error?: string }>;
  updateRegistrationSettings: (settings: Partial<RegistrationSettings>) => void;
  
  // Players
  addPlayer: (name: string, details?: Partial<Player>) => Player;
  bulkAddPlayers: (names: string[]) => void;
  updatePlayer: (id: string, updates: Partial<Player>) => void;
  deletePlayer: (id: string) => void;
  deletePlayersBulk: (playerIds: string[]) => void;
  clearPlayers: () => void;
  
  // Teams
  addTeam: (name: string, players?: string[], captainId?: string, badge?: string) => Team;
  updateTeam: (id: string, updates: Partial<Team>) => Promise<boolean>;
  deleteTeam: (id: string) => void;
  deleteTeamsBulk: (teamIds: string[]) => void;
  renameTeam: (id: string, newName: string) => void;
  toggleTeamLock: (id: string) => void;
  togglePlayerLockInTeam: (teamId: string, playerId: string) => void;
  setTeamCaptain: (teamId: string, captainId: string) => void;
  setCaptainsBulk: (assignments: { teamId: string; captainId: string }[]) => void;
  setTeamPlayer: (teamId: string, playerIndex: number, newPlayerId: string) => void;
  assignPlayerToTeam: (teamId: string, playerId: string) => void;
  removePlayerFromTeam: (teamId: string, playerId: string) => void;
  saveManualTeamEdit: (
    input: ManualTeamEditInput
  ) => Promise<{
    success: boolean;
    conflict?: boolean;
    error?: string;
    code?: string;
    preview?: ManualTeamEditPreviewResult;
  }>;
  setTeams: (teams: Team[]) => Promise<boolean>;
  clearTeams: () => void;
  
  // Pre-decided & formation
  setTeamFormationMode: (mode: 'random' | 'predefined' | 'mixed') => void;
  addPredefinedTeam: (name: string, p1: string, p2: string) => void;
  updatePredefinedTeam: (id: string, updates: Partial<PredefinedTeam>) => void;
  deletePredefinedTeam: (id: string) => void;
  clearPredefinedTeams: () => void;
  
  // Matches & Fixtures
  updateMatch: (id: string, updates: Partial<Match>) => void;
  setMatches: (matches: Match[]) => void;
  saveEditedSchedule: (
    draftMatches: Match[]
  ) => Promise<{
    success: boolean;
    conflict?: boolean;
    error?: string;
    report?: ScheduleValidationReport;
  }>;
  generateFixtures: (courtConfig?: { courts: number; courtNames?: string[] }) => Promise<{ success: boolean; count?: number; error?: string }>;
  deleteMatch: (id: string) => Promise<boolean>;
  clearResults: () => void;
  clearAllMatches: () => void;
  
  // Knockout & Playoff Management
  setKnockoutFormat: (format: PlayoffFormat, customQualifyingCount?: number) => void;
  configureKnockoutQualification: (params: {
    format?: PlayoffFormat;
    qualifyingTeamsCount?: number;
    qualificationMode?: QualificationMode;
    manualSelectedTeamIds?: string[];
    customStageConfig?: CustomKnockoutStageConfig;
  }) => void;
  generateKnockoutBracket: (options?: {
    format?: PlayoffFormat;
    qualifyingTeamsCount?: number;
    qualificationMode?: QualificationMode;
    manualTeamIds?: string[];
    overrideTop4Ids?: string[];
    customStageConfig?: CustomKnockoutStageConfig;
    saveAsDraft?: boolean;
  }) => { success: boolean; error?: string };
  updateKnockoutMatch: (
    id: string,
    updates: Partial<KnockoutMatch>,
    options?: { forceCascadeDownstream?: boolean }
  ) => {
    success: boolean;
    error?: string;
    dependencyWarning?: boolean;
    dependentMatches?: KnockoutMatch[];
  };
  saveKnockoutDraft: (
    draftMatches?: KnockoutMatch[],
    customStageConfig?: CustomKnockoutStageConfig
  ) => { success: boolean; error?: string; warnings?: string[] };
  rollbackKnockoutVersion: (versionId: string) => { success: boolean; error?: string };
  resetSingleKnockoutMatch: (
    matchId: string,
    forceCascade?: boolean
  ) => {
    success: boolean;
    error?: string;
    dependencyWarning?: boolean;
    dependentMatches?: KnockoutMatch[];
  };
  clearKnockout: () => void;
  resetPlayoffs: () => void;
  deletePlayoffs: () => void;
  publishPlayoffs: (published: boolean) => { success: boolean; error?: string };
  overridePlayoffQualifiedTeams: (top4Ids: [string, string, string, string]) => { success: boolean; error?: string };
  setPlayoffTieBreakOrder: (teamIdsOrder: string[]) => void;
  toggleTeamPlayoffDisqualification: (teamId: string) => void;
  recalculatePlayoffStandings: () => void;
  
  // Form Builder & Links / Tokens
  formConfig: RegistrationFormConfig;
  isRegistrationOpen: boolean;
  isRegistrationStatusHydrated: boolean;
  tokens: RegistrationTokenRecord[];
  activeToken: RegistrationTokenRecord | null;
  fetchFormConfig: (seasonSlug?: string) => Promise<RegistrationFormConfig>;
  saveFormConfig: (config: RegistrationFormConfig, publish?: boolean) => Promise<{ success: boolean; config?: RegistrationFormConfig; error?: string }>;
  toggleRegistrationStatus: (
    nextEnabled: boolean,
    closedNotice?: string
  ) => Promise<{ success: boolean; enabled: boolean; error?: string }>;
  fetchTokens: (seasonSlug?: string) => Promise<{ tokens: RegistrationTokenRecord[]; activeToken: RegistrationTokenRecord | null }>;
  regenerateToken: (seasonSlug: string, invalidatePrevious: boolean, label?: string) => Promise<{ success: boolean; tokenRecord?: RegistrationTokenRecord; error?: string }>;
  toggleTokenStatus: (tokenId: string) => Promise<{ success: boolean; token?: RegistrationTokenRecord }>;

  // Registrations (Applicants & Management)
  isRegistrationsLoading: boolean;
  registrationsSyncError: string | null;
  refreshRegistrations: () => Promise<void>;
  submitPublicRegistration: (formData: any) => Promise<{ success: boolean; registration?: Registration; error?: string; linkRevoked?: boolean; registrationClosed?: boolean }>;
  addRegistration: (reg: Partial<Registration> & { name: string; mobile: string }) => Registration;
  updateRegistration: (id: string, updates: Partial<Registration>) => void;
  approveRegistration: (id: string) => void;
  rejectRegistration: (id: string, reason?: string) => void;
  verifyPayment: (
    id: string,
    paymentStatus: PaymentStatus,
    note?: string,
    verifiedBy?: string,
    paidAmount?: number
  ) => Promise<{ success: boolean; registration?: Registration; error?: string }>;
  deleteRegistration: (id: string) => void;
  deleteRegistrationsBulk: (ids: string[]) => void;
  bulkApproveRegistrations: (ids: string[]) => void;
  
  // Hero Section Customization & Season Design Studio Actions
  publishedHeroConfig: HeroConfig;
  fetchAdminHeroState: () => Promise<{ published: HeroConfig; draft: HeroConfig; versions: HeroVersionRecord[] }>;
  fetchHeroStateForSeason: (seasonSlug?: string) => Promise<{ published: HeroConfig; draft: HeroConfig; versions: HeroVersionRecord[] }>;
  saveHeroDraft: (draft: HeroConfig) => Promise<{ success: boolean; draft?: HeroConfig; error?: string }>;
  saveHeroDraftForSeason: (draft: HeroConfig, seasonSlug?: string) => Promise<{ success: boolean; draft?: HeroConfig; error?: string }>;
  publishHeroConfig: (
    config: HeroConfig,
    summary?: string,
    action?: 'publish' | 'restore'
  ) => Promise<{ success: boolean; published?: HeroConfig; version?: HeroVersionRecord; error?: string }>;
  publishHeroConfigForSeason: (
    config: HeroConfig,
    summary?: string,
    action?: 'publish' | 'restore',
    seasonSlug?: string
  ) => Promise<{ success: boolean; published?: HeroConfig; version?: HeroVersionRecord; error?: string }>;
  saveHeroVersionColor: (
    versionColor: string
  ) => Promise<{ success: boolean; published?: HeroConfig; version?: HeroVersionRecord; error?: string }>;
  restoreHeroVersion: (
    versionRecord: HeroVersionRecord
  ) => Promise<{ success: boolean; published?: HeroConfig; version?: HeroVersionRecord; error?: string }>;
  restoreHeroVersionForSeason: (
    versionRecord: HeroVersionRecord,
    seasonSlug?: string
  ) => Promise<{ success: boolean; published?: HeroConfig; version?: HeroVersionRecord; error?: string }>;

  // YouTube Live Streaming Integration
  youtubeLiveConfig: YouTubeLiveConfig;
  saveYouTubeLiveConfig: (
    config: YouTubeLiveConfig
  ) => Promise<{ success: boolean; config?: YouTubeLiveConfig; error?: string }>;
  refreshYouTubeLiveConfig: () => Promise<YouTubeLiveConfig | null>;

  // Global actions
  resetToDefault: () => void;
  clearTournamentData: () => void;
  exportStateJSON: () => void;
  importStateJSON: (jsonStr: string) => boolean;
  triggerCelebration: () => void;
}

const TournamentContext = createContext<TournamentContextType | null>(null);
const ActiveSeasonContext = createContext<ActiveSeasonContextValue | null>(null);

const SEASON_OVERRIDE_STORAGE_KEY = 'spl_active_season_override';

function buildSeasonDefaultState(season: TournamentSeason): TournamentState {
  const isSpl3 = season.seasonSlug === 'season-4' || season.seasonNumber === '3.0';
  return {
    ...DEFAULT_STATE,
    settings: {
      ...DEFAULT_STATE.settings,
      name: 'Smash Premier League',
      season: season.seasonTitle || `Season ${season.seasonNumber} (${season.editionName})`,
      date: season.date ?? (isSpl3 ? DEFAULT_STATE.settings.date : ''),
      venue: season.venue || DEFAULT_STATE.settings.venue,
      organizer: season.organizer || DEFAULT_STATE.settings.organizer,
      courts: season.courtsCount || DEFAULT_STATE.settings.courts,
      courtNames: season.courtNames || DEFAULT_STATE.settings.courtNames,
      entryFee: season.entryFee ?? DEFAULT_STATE.settings.entryFee,
      slotLimit: season.maxSlots ?? DEFAULT_STATE.settings.slotLimit,
      announcement: season.announcement ?? (isSpl3 ? DEFAULT_STATE.settings.announcement : ''),
      scoringRules: season.scoringRules || DEFAULT_STATE.settings.scoringRules,
      playoffSettings: season.playoffSettings || DEFAULT_STATE.settings.playoffSettings,
    },
    registrationSettings: {
      ...DEFAULT_REGISTRATION_SETTINGS,
      seasonSlug: season.seasonSlug,
      seasonTitle: season.seasonTitle || `Smash Premier League — Season ${season.seasonNumber}`,
      maxSlots: season.maxSlots ?? DEFAULT_REGISTRATION_SETTINGS.maxSlots,
      enabled: season.registrationEnabled !== false,
    },
  };
}

// Audio synthesizer using shared lazy Web Audio API context (prevents AudioContext leaks across long matches)
let sharedAudioContext: AudioContext | null = null;
const getSharedAudioContext = (): AudioContext | null => {
  if (typeof window === 'undefined') return null;
  try {
    if (!sharedAudioContext || sharedAudioContext.state === 'closed') {
      const AudioCtor = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtor) return null;
      sharedAudioContext = new AudioCtor();
    }
    if (sharedAudioContext.state === 'suspended') {
      void sharedAudioContext.resume().catch(() => {});
    }
    return sharedAudioContext;
  } catch {
    return null;
  }
};

export const sportsAudio = {
  playScorePing: () => {
    try {
      const ctx = getSharedAudioContext();
      if (!ctx) return;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(587.33, ctx.currentTime); // D5
      osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.08); // A5
      gain.gain.setValueAtTime(0.12, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.12);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.12);
    } catch {}
  },
  playFanfare: () => {
    try {
      const ctx = getSharedAudioContext();
      if (!ctx) return;
      const notes = [523.25, 659.25, 783.99, 1046.5];
      notes.forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        const start = ctx.currentTime + idx * 0.1;
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, start);
        gain.gain.setValueAtTime(0.15, start);
        gain.gain.exponentialRampToValueAtTime(0.001, start + 0.35);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(start);
        osc.stop(start + 0.35);
      });
    } catch {}
  },
  playButtonClick: () => {
    try {
      const ctx = getSharedAudioContext();
      if (!ctx) return;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(440, ctx.currentTime);
      gain.gain.setValueAtTime(0.08, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.05);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.05);
    } catch {}
  },
  playTrash: () => {
    try {
      const ctx = getSharedAudioContext();
      if (!ctx) return;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(220, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(110, ctx.currentTime + 0.15);
      gain.gain.setValueAtTime(0.1, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.15);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.15);
    } catch {}
  },
};

export const TournamentProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const fallbackSeason = useMemo(() => SupabaseService.getDefaultFallbackSeason(), []);
  const [seasons, setSeasons] = useState<TournamentSeason[]>([fallbackSeason]);
  const [activeSeason, setActiveSeason] = useState<TournamentSeason>(() => {
    try {
      if (typeof window !== 'undefined') {
        const params = new URLSearchParams(window.location.search);
        const urlSlug = params.get('season');
        if (urlSlug) {
          return { ...fallbackSeason, seasonSlug: urlSlug };
        }
        const savedSlug = sessionStorage.getItem(SEASON_OVERRIDE_STORAGE_KEY);
        if (savedSlug) {
          return { ...fallbackSeason, seasonSlug: savedSlug };
        }
      }
    } catch {}
    return fallbackSeason;
  });
  const [seasonSummaries, setSeasonSummaries] = useState<Record<string, SeasonSummaryCounts>>({});
  const [seasonLoading, setSeasonLoading] = useState<boolean>(true);
  const [seasonError, setSeasonError] = useState<string | null>(null);
  const seasonsRef = useRef<TournamentSeason[]>(seasons);
  seasonsRef.current = seasons;
  const activeSeasonRef = useRef<TournamentSeason>(activeSeason);
  activeSeasonRef.current = activeSeason;
  const globalActiveSeason = useMemo(
    () => seasons.find((s) => s.isActive) || activeSeason,
    [seasons, activeSeason]
  );
  const isInspectingHistorical = Boolean(
    seasons.length > 0 && activeSeason.seasonSlug !== globalActiveSeason.seasonSlug
  );
  const isSeasonLocked = Boolean(
    activeSeason.isLocked ||
      activeSeason.status === 'archived' ||
      activeSeason.status === 'completed' ||
      isInspectingHistorical
  );

  const [state, setState] = useState<TournamentState>(() => buildSeasonDefaultState(activeSeason));

  const [formConfig, setFormConfig] = useState<RegistrationFormConfig>(() =>
    createDefaultFormConfig(
      activeSeason.seasonSlug,
      activeSeason.leagueName || 'Smash Premier League',
      activeSeason.seasonTitle
    )
  );
  const [publishedHeroConfig, setPublishedHeroConfig] = useState<HeroConfig>(() => {
    try {
      const cached = localStorage.getItem(
        getSeasonStorageKey('spl_hero_published_cache', activeSeason.seasonSlug)
      );
      if (cached) {
        const parsed = JSON.parse(cached);
        if (parsed && typeof parsed === 'object') {
          return normalizeHeroConfig({ ...parsed, status: 'published' });
        }
      }
    } catch {}
    return buildSeasonInitialHeroConfig(activeSeason);
  });
  const heroPublishGuardRef = useRef<number>(0);

  const applyPublishedHeroConfig = useCallback(
    (rawConfig: Partial<HeroConfig> | null | undefined, targetSlug?: string) => {
      if (!rawConfig || typeof rawConfig !== 'object') return;
      const slug = targetSlug || activeSeasonRef.current.seasonSlug || 'season-4';
      const normalized = normalizeHeroConfig({ ...rawConfig, status: 'published' });
      setPublishedHeroConfig(normalized);
      try {
        localStorage.setItem(
          getSeasonStorageKey('spl_hero_published_cache', slug),
          JSON.stringify(normalized)
        );
      } catch {}
    },
    []
  );

  const [youtubeLiveConfig, setYoutubeLiveConfig] = useState<YouTubeLiveConfig>(() => {
    try {
      const cached = localStorage.getItem(
        getSeasonStorageKey('spl_youtube_live_cache', activeSeason.seasonSlug)
      );
      if (cached) {
        const parsed = JSON.parse(cached);
        if (parsed && typeof parsed === 'object') {
          return normalizeYouTubeLiveConfig(parsed);
        }
      }
    } catch {}
    return { ...DEFAULT_YOUTUBE_LIVE_CONFIG };
  });
  const youtubeGuardRef = useRef<number>(0);

  const applyYoutubeLiveConfig = useCallback(
    (rawConfig: Partial<YouTubeLiveConfig> | null | undefined, targetSlug?: string) => {
      if (!rawConfig || typeof rawConfig !== 'object') return;
      const slug = targetSlug || activeSeasonRef.current.seasonSlug || 'season-4';
      const normalized = normalizeYouTubeLiveConfig(rawConfig);
      setYoutubeLiveConfig(normalized);
      try {
        localStorage.setItem(
          getSeasonStorageKey('spl_youtube_live_cache', slug),
          JSON.stringify(normalized)
        );
      } catch {}
    },
    []
  );
  const [isRegistrationStatusHydrated, setIsRegistrationStatusHydrated] = useState<boolean>(false);
  const [isRegistrationsLoading, setIsRegistrationsLoading] = useState<boolean>(true);
  const [registrationsSyncError, setRegistrationsSyncError] = useState<string | null>(null);
  const [tokens, setTokens] = useState<RegistrationTokenRecord[]>([]);
  const [activeToken, setActiveToken] = useState<RegistrationTokenRecord | null>(null);
  const [isCentralizedDbConnected, setIsCentralizedDbConnected] = useState<boolean>(true); // Persistent Express server storage is always active
  const [isSupabaseConnected, setIsSupabaseConnected] = useState<boolean>(() => isSupabaseConfigured());
  const dbBackendType: 'supabase' | 'local_server' = isSupabaseConfigured() ? 'supabase' : 'local_server';
  const [realtimeStatus, setRealtimeStatus] = useState<RealtimeConnectionStatus>(() => {
    if (typeof navigator !== 'undefined' && navigator.onLine === false) return 'offline';
    return isSupabaseConfigured() ? 'connecting' : 'connected';
  });
  const lastServerScoreTime = useRef<number>(0);
  const lastLocalTeamMutationTime = useRef<number>(0);
  const localMatchGuardRef = useRef<
    Map<string, { updatedAt: number; scoreA?: number; scoreB?: number; status?: string; court?: number }>
  >(new Map());
  const regToggleGuardRef = useRef<{ seq: number; enabled: boolean; updatedAt: number }>({
    seq: 0,
    enabled: true,
    updatedAt: 0,
  });
  const regToggleChainRef = useRef<Promise<any>>(Promise.resolve());
  const formConfigRef = useRef<RegistrationFormConfig>(formConfig);
  formConfigRef.current = formConfig;
  const reconnectTriggerRef = useRef<(() => void) | null>(null);
  const stateRef = useRef<TournamentState>(state);
  stateRef.current = state;

  const isRegistrationOpen =
    formConfig.enabled !== false && state.registrationSettings.enabled !== false;

  const applySeasonReset = useCallback((targetSeason: TournamentSeason) => {
    const prevSlug = activeSeasonRef.current.seasonSlug;
    activeSeasonRef.current = targetSeason;
    setActiveSeason(targetSeason);

    if (prevSlug !== targetSeason.seasonSlug) {
      localMatchGuardRef.current.clear();
      lastServerScoreTime.current = 0;
      lastLocalTeamMutationTime.current = 0;
      setState(buildSeasonDefaultState(targetSeason));
      setTokens([]);
      setActiveToken(null);
      setIsRegistrationsLoading(true);
      setIsRegistrationStatusHydrated(false);
      setRegistrationsSyncError(null);

      try {
        const cachedForm = localStorage.getItem(
          getSeasonStorageKey('spl_forms_cache', targetSeason.seasonSlug)
        );
        if (cachedForm) {
          const parsedForm = JSON.parse(cachedForm);
          if (parsedForm && Array.isArray(parsedForm.fields)) {
            setFormConfig(parsedForm);
          } else {
            setFormConfig(
              createDefaultFormConfig(
                targetSeason.seasonSlug,
                targetSeason.leagueName || 'Smash Premier League',
                targetSeason.seasonTitle
              )
            );
          }
        } else {
          setFormConfig(
            createDefaultFormConfig(
              targetSeason.seasonSlug,
              targetSeason.leagueName || 'Smash Premier League',
              targetSeason.seasonTitle
            )
          );
        }
      } catch {
        setFormConfig(
          createDefaultFormConfig(
            targetSeason.seasonSlug,
            targetSeason.leagueName || 'Smash Premier League',
            targetSeason.seasonTitle
          )
        );
      }

      try {
        const cachedHero = localStorage.getItem(
          getSeasonStorageKey('spl_hero_published_cache', targetSeason.seasonSlug)
        );
        setPublishedHeroConfig(
          cachedHero
            ? normalizeHeroConfig({ ...JSON.parse(cachedHero), status: 'published' })
            : buildSeasonInitialHeroConfig(targetSeason)
        );
      } catch {
        setPublishedHeroConfig(buildSeasonInitialHeroConfig(targetSeason));
      }

      try {
        const cachedYt = localStorage.getItem(
          getSeasonStorageKey('spl_youtube_live_cache', targetSeason.seasonSlug)
        );
        setYoutubeLiveConfig(
          cachedYt
            ? normalizeYouTubeLiveConfig(JSON.parse(cachedYt))
            : { ...DEFAULT_YOUTUBE_LIVE_CONFIG }
        );
      } catch {
        setYoutubeLiveConfig({ ...DEFAULT_YOUTUBE_LIVE_CONFIG });
      }
    } else {
      setState((prev) => ({
        ...prev,
        registrationSettings: {
          ...prev.registrationSettings,
          seasonSlug: targetSeason.seasonSlug,
          seasonTitle: targetSeason.seasonTitle || prev.registrationSettings.seasonTitle,
        },
      }));
    }
  }, []);

  const refreshSeason = useCallback(async () => {
    setSeasonLoading(true);
    setSeasonError(null);
    try {
      let urlSeason: string | null = null;
      let storedPreviewSlug: string | null = null;
      if (typeof window !== 'undefined') {
        try {
          urlSeason = new URLSearchParams(window.location.search).get('season');
          storedPreviewSlug = sessionStorage.getItem(SEASON_OVERRIDE_STORAGE_KEY);
        } catch {}
      }

      if (SupabaseService.isAvailable()) {
        const [allSeasons, dbActive] = await Promise.all([
          SupabaseService.fetchSeasons(),
          SupabaseService.fetchActiveSeason(),
        ]);
        const list = allSeasons && allSeasons.length > 0 ? allSeasons : [dbActive];
        setSeasons(list);
        const preferredSlug = urlSeason || storedPreviewSlug;
        const resolved =
          (preferredSlug &&
            list.find((s) => s.seasonSlug === preferredSlug || s.id === preferredSlug)) ||
          dbActive;
        applySeasonReset(resolved);
      } else {
        const res = await fetch(`/api/seasons?t=${Date.now()}`, { cache: 'no-store' }).catch(() => null);
        if (res && res.ok) {
          const data = await res.json().catch(() => null);
          const list: TournamentSeason[] =
            Array.isArray(data?.seasons) && data.seasons.length > 0
              ? data.seasons
              : [fallbackSeason];
          setSeasons(list);
          const preferredSlug = urlSeason || storedPreviewSlug;
          const resolved =
            (preferredSlug &&
              list.find((s) => s.seasonSlug === preferredSlug || s.id === preferredSlug)) ||
            list.find((s) => s.isActive) ||
            data?.activeSeason ||
            list[0];
          if (resolved) {
            applySeasonReset(resolved);
          }
        }
      }
    } catch (err: any) {
      setSeasonError(err?.message || 'Unable to load tournament seasons.');
    } finally {
      setSeasonLoading(false);
    }
  }, [applySeasonReset, fallbackSeason]);

  const refreshSeasonSummaries = useCallback(
    async (seasonsList?: TournamentSeason[]): Promise<Record<string, SeasonSummaryCounts>> => {
      try {
        const targetList = seasonsList && seasonsList.length > 0 ? seasonsList : seasonsRef.current;
        const map = await SupabaseService.fetchSeasonSummaries(targetList);
        if (map && Object.keys(map).length > 0) {
          setSeasonSummaries(map);
        }
        return map || {};
      } catch {
        return {};
      }
    },
    []
  );

  useEffect(() => {
    void refreshSeason();
  }, [refreshSeason]);

  useEffect(() => {
    if (seasons.length > 0) {
      void refreshSeasonSummaries(seasons);
    }
  }, [seasons, refreshSeasonSummaries]);

  const switchActiveSeason = useCallback(
    async (seasonIdOrSlug: string, options?: { persistGlobal?: boolean }): Promise<boolean> => {
      if (!seasonIdOrSlug) return false;
      try {
        setSeasonLoading(true);
        setSeasonError(null);
        let resolved: TournamentSeason | null =
          seasons.find((s) => s.id === seasonIdOrSlug || s.seasonSlug === seasonIdOrSlug) || null;

        if (options?.persistGlobal) {
          if (SupabaseService.isAvailable()) {
            const globalSwitched = await SupabaseService.switchGlobalActiveSeason(seasonIdOrSlug);
            if (globalSwitched) resolved = globalSwitched;
          }
          await fetch('/api/seasons/active', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', ...AuthService.getAuthHeader() },
            body: JSON.stringify({ seasonIdOrSlug: resolved?.seasonSlug || seasonIdOrSlug, force: true }),
          }).catch(() => {});
          try {
            sessionStorage.removeItem(SEASON_OVERRIDE_STORAGE_KEY);
          } catch {}
        } else {
          if (!resolved && SupabaseService.isAvailable()) {
            resolved = await SupabaseService.resolveSeasonContext(seasonIdOrSlug);
          }
          if (resolved && typeof window !== 'undefined') {
            try {
              sessionStorage.setItem(SEASON_OVERRIDE_STORAGE_KEY, resolved.seasonSlug);
            } catch {}
          }
        }

        if (!resolved) {
          setSeasonError('Selected tournament season not found.');
          return false;
        }

        const updatedList = SupabaseService.isAvailable()
          ? await SupabaseService.fetchSeasons()
          : seasons.map((s) =>
              options?.persistGlobal
                ? { ...s, isActive: s.seasonSlug === resolved!.seasonSlug }
                : s
            );
        setSeasons(updatedList);
        applySeasonReset(resolved);
        void refreshSeasonSummaries(updatedList);
        return true;
      } catch (err: any) {
        setSeasonError(err?.message || 'Failed to switch active season.');
        return false;
      } finally {
        setSeasonLoading(false);
      }
    },
    [applySeasonReset, seasons, refreshSeasonSummaries]
  );

  const activateSeasonSafely = useCallback(
    async (
      seasonIdOrSlug: string,
      options?: { force?: boolean }
    ): Promise<ActivateSeasonResult> => {
      if (!seasonIdOrSlug) {
        return { success: false, error: 'Target season is required.' };
      }
      setSeasonLoading(true);
      setSeasonError(null);
      try {
        // Also check in-memory live matches in case local state has an unpersisted live match
        if (!options?.force) {
          const liveLocalCount =
            stateRef.current.matches.filter((m) => m.status === 'live' || m.status === 'paused').length +
            stateRef.current.knockout.matches.filter((m) => m.status === 'live' || m.status === 'paused').length;
          const currentlyActive = seasonsRef.current.find((s) => s.isActive);
          if (
            liveLocalCount > 0 &&
            currentlyActive &&
            currentlyActive.seasonSlug === activeSeasonRef.current.seasonSlug &&
            currentlyActive.seasonSlug !== seasonIdOrSlug &&
            currentlyActive.id !== seasonIdOrSlug
          ) {
            return {
              success: false,
              requiresConfirmation: true,
              liveMatchesCount: liveLocalCount,
              error: `${liveLocalCount} live or paused match(es) are currently in progress in SPL ${currentlyActive.seasonNumber}.`,
            };
          }
        }

        const res = await SupabaseService.activateSeasonSafely(seasonIdOrSlug, {
          checkOngoingMatches: true,
          force: Boolean(options?.force),
        });
        if (!res.success) {
          if (res.error && !res.requiresConfirmation) setSeasonError(res.error);
          return res;
        }

        try {
          sessionStorage.removeItem(SEASON_OVERRIDE_STORAGE_KEY);
        } catch {}

        let updatedList: TournamentSeason[] = seasonsRef.current;
        if (SupabaseService.isAvailable()) {
          updatedList = await SupabaseService.fetchSeasons();
        } else {
          const sRes = await fetch(`/api/seasons?t=${Date.now()}`, { cache: 'no-store' }).catch(() => null);
          if (sRes?.ok) {
            const sData = await sRes.json().catch(() => null);
            if (Array.isArray(sData?.seasons)) updatedList = sData.seasons;
          }
        }

        const nextActive =
          res.activeSeason ||
          updatedList.find((s) => s.isActive || s.seasonSlug === seasonIdOrSlug || s.id === seasonIdOrSlug);

        setSeasons(updatedList);
        if (nextActive) {
          applySeasonReset(nextActive);
        }
        void refreshSeasonSummaries(updatedList);
        return { success: true, activeSeason: nextActive };
      } catch (err: any) {
        const msg = err?.message || 'Failed to activate selected season.';
        setSeasonError(msg);
        return { success: false, error: msg };
      } finally {
        setSeasonLoading(false);
      }
    },
    [applySeasonReset, refreshSeasonSummaries]
  );

  const createSeason = useCallback(
    async (input: CreateSeasonInput): Promise<{ success: boolean; season?: TournamentSeason; error?: string }> => {
      try {
        setSeasonError(null);
        if (SupabaseService.isAvailable()) {
          const res = await SupabaseService.createSeason(input);
          if (!res.success || !res.season) {
            setSeasonError(res.error || 'Failed to create season.');
            return res;
          }
          await fetch('/api/seasons', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', ...AuthService.getAuthHeader() },
            body: JSON.stringify({ ...input, season: res.season }),
          }).catch(() => {});
          const allSeasons = await SupabaseService.fetchSeasons();
          setSeasons(allSeasons);
          void refreshSeasonSummaries(allSeasons);
          if (input.activateNow) {
            try {
              sessionStorage.removeItem(SEASON_OVERRIDE_STORAGE_KEY);
            } catch {}
            applySeasonReset(res.season);
          }
          return res;
        }

        const apiRes = await fetch('/api/seasons', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...AuthService.getAuthHeader() },
          body: JSON.stringify(input),
        });
        const data = await apiRes.json().catch(() => ({}));
        if (!apiRes.ok || !data?.season) {
          return { success: false, error: data?.error || 'Failed to create season.' };
        }
        if (Array.isArray(data.seasons)) {
          setSeasons(data.seasons);
          void refreshSeasonSummaries(data.seasons);
        }
        if (input.activateNow) {
          try {
            sessionStorage.removeItem(SEASON_OVERRIDE_STORAGE_KEY);
          } catch {}
          applySeasonReset(data.season);
        }
        return { success: true, season: data.season };
      } catch (err: any) {
        return { success: false, error: err?.message || 'Error creating season.' };
      }
    },
    [applySeasonReset, refreshSeasonSummaries]
  );

  const updateSeason = useCallback(
    async (
      seasonIdOrSlug: string,
      updates: UpdateSeasonInput
    ): Promise<{ success: boolean; season?: TournamentSeason; error?: string }> => {
      try {
        setSeasonError(null);
        const res = await SupabaseService.updateSeason(seasonIdOrSlug, updates);
        if (!res.success || !res.season) {
          if (res.error) setSeasonError(res.error);
          return res;
        }
        const updated = res.season;
        setSeasons((prev) =>
          prev.map((s) =>
            s.id === updated.id || s.seasonSlug === updated.seasonSlug ? updated : s
          )
        );
        if (
          activeSeasonRef.current.id === updated.id ||
          activeSeasonRef.current.seasonSlug === updated.seasonSlug
        ) {
          setActiveSeason(updated);
          setState((prev) => ({
            ...prev,
            settings: {
              ...prev.settings,
              season: updated.seasonTitle,
              date: updated.date !== undefined ? updated.date : prev.settings.date,
              venue: updated.venue || prev.settings.venue,
              organizer: updated.organizer || prev.settings.organizer,
              entryFee: updated.entryFee,
              slotLimit: updated.maxSlots,
              courts: updated.courtsCount,
              courtNames: updated.courtNames || prev.settings.courtNames,
            },
          }));
        }
        return res;
      } catch (err: any) {
        return { success: false, error: err?.message || 'Error updating season.' };
      }
    },
    []
  );

  const updateSeasonStatus = useCallback(
    async (seasonIdOrSlug: string, status: TournamentSeasonStatus): Promise<boolean> => {
      try {
        let ok = false;
        if (SupabaseService.isAvailable()) {
          ok = await SupabaseService.updateSeasonStatus(seasonIdOrSlug, status);
        }
        const serverRes = await fetch(`/api/seasons/${encodeURIComponent(seasonIdOrSlug)}/status`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json', ...AuthService.getAuthHeader() },
          body: JSON.stringify({ status }),
        }).catch(() => null);
        if (serverRes?.ok) ok = true;

        if (ok) {
          const isLocked = status === 'archived';
          setSeasons((prev) =>
            prev.map((s) =>
              s.id === seasonIdOrSlug || s.seasonSlug === seasonIdOrSlug
                ? { ...s, status, isLocked }
                : s
            )
          );
          if (
            activeSeasonRef.current.id === seasonIdOrSlug ||
            activeSeasonRef.current.seasonSlug === seasonIdOrSlug
          ) {
            setActiveSeason((prev) => ({ ...prev, status, isLocked }));
          }
        }
        return ok;
      } catch {
        return false;
      }
    },
    []
  );

  const syncRegistrationEnabledState = useCallback(
    (enabled: boolean, closedNotice?: string, markHydrated = true, targetSlug?: string) => {
      const normalizedEnabled = Boolean(enabled);
      const fallbackSlug = targetSlug || activeSeasonRef.current.seasonSlug || 'season-4';
      setFormConfig((prev) => {
        const next: RegistrationFormConfig = {
          ...prev,
          enabled: normalizedEnabled,
          ...(closedNotice !== undefined ? { closedNotice } : {}),
        };
        try {
          const slug = next.seasonSlug || fallbackSlug;
          localStorage.setItem(getSeasonStorageKey('spl_forms_cache', slug), JSON.stringify(next));
        } catch {}
        return next;
      });
      setState((prev) => ({
        ...prev,
        registrationSettings: {
          ...prev.registrationSettings,
          enabled: normalizedEnabled,
          ...(closedNotice !== undefined ? { closedNotice } : {}),
        },
      }));
      if (markHydrated) {
        setIsRegistrationStatusHydrated(true);
      }
    },
    []
  );

  const reconnectRealtime = useCallback(() => {
    reconnectTriggerRef.current?.();
  }, []);

  const broadcastRegistrationsSync = useCallback(
    (action: 'upsert' | 'delete' | 'bulk_delete' | 'refresh', payload?: any) => {
      if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
        try {
          const ch = new BroadcastChannel('spl_registrations_channel');
          ch.postMessage({
            type: 'REGISTRATION_SYNC',
            seasonSlug: activeSeasonRef.current.seasonSlug,
            seasonId: activeSeasonRef.current.id,
            action,
            payload,
            at: Date.now(),
          });
          ch.close();
        } catch {}
      }
    },
    []
  );

  const refreshRegistrations = useCallback(async () => {
    const seasonSlug = activeSeasonRef.current.seasonSlug || 'season-4';
    const seasonId = activeSeasonRef.current.id;
    try {
      setIsRegistrationsLoading(true);
      if (SupabaseService.isAvailable()) {
        const regs = await SupabaseService.fetchRegistrations(seasonSlug, seasonId);
        if (regs !== null) {
          setState((prev) => ({ ...prev, registrations: regs }));
          setRegistrationsSyncError(null);
        } else {
          setRegistrationsSyncError('Unable to fetch latest payment & registration records from Supabase.');
        }
      } else {
        const res = await fetch(
          `/api/registrations?season=${encodeURIComponent(seasonSlug)}&t=${Date.now()}`,
          {
            cache: 'no-store',
            headers: { ...AuthService.getAuthHeader() },
          }
        );
        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data)) {
            setState((prev) => ({ ...prev, registrations: data }));
            setRegistrationsSyncError(null);
          }
        } else {
          setRegistrationsSyncError('Unable to refresh registration ledger from server.');
        }
      }
    } catch (err: any) {
      setRegistrationsSyncError(err?.message || 'Registration sync error.');
    } finally {
      setIsRegistrationsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (typeof document !== 'undefined' && state.settings?.name) {
      document.title = state.settings.season
        ? `${state.settings.name} — ${state.settings.season}`
        : state.settings.name;
    }
  }, [state.settings?.name, state.settings?.season]);

  const testDbConnection = async (): Promise<DatabaseDiagnosticResult> => {
    let serverData: any = null;
    try {
      const serverRes = await fetch('/api/database/status');
      if (serverRes.ok) {
        const rawText = await serverRes.text().catch(() => '');
        if (rawText && rawText.trim()) {
          try {
            serverData = JSON.parse(rawText);
          } catch {}
        }
      }
    } catch (e) {
      console.warn('Could not ping server database status:', e);
    }

    const supabaseRes = await testSupabaseConnection();
    setIsSupabaseConnected(supabaseRes.connected);
    setIsCentralizedDbConnected(Boolean(serverData?.connected ?? true));

    const result: DatabaseDiagnosticResult = {
      connected: Boolean(serverData?.connected ?? true),
      message: supabaseRes.configured && supabaseRes.connected
        ? 'Connected to centralized Supabase PostgreSQL database & SPL server.'
        : 'Centralized SPL Server Database is active & healthy. All registrations, teams, matches, and real-time live scores are persisted.',
      serverStatus: serverData?.server || {
        active: true,
        storage: 'persistent_disk',
        registeredPlayers: state.registrations.length,
        rosterPlayers: state.players.length,
        teamsCount: state.teams.length,
        matchesCount: state.matches.length,
        realtimeSyncActive: true,
      },
      supabaseStatus: {
        configured: supabaseRes.configured,
        connected: supabaseRes.connected,
        message: supabaseRes.message,
        hint: supabaseRes.hint,
      },
    };

    return result;
  };

  // Sync with persistent backend & Supabase on startup and setup automated live score synchronization
  // Master Real-Time Synchronization (Supabase Realtime + SSE Stream + Tab Reconciliation)
  useEffect(() => {
    const seasonSlug = activeSeason.seasonSlug || 'season-4';
    const seasonId = activeSeason.id;
    let isDisposed = false;
    let unsubMaster: (() => void) | undefined;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    let fallbackPollInterval: ReturnType<typeof setInterval> | null = null;
    let reconnectAttempt = 0;
    let currentChannelHealthy = !SupabaseService.isAvailable();
    let reconcileInFlight: Promise<void> | null = null;
    let hasStartedInitialReconcile = false;
    let needsReconcileOnSubscribe = false;

    const clearFallbackPolling = () => {
      if (fallbackPollInterval) {
        clearInterval(fallbackPollInterval);
        fallbackPollInterval = null;
      }
    };

    const resolveCourtName = (courtNum: number, customNames?: string[]): string =>
      customNames?.[courtNum - 1]?.trim() || `Court ${courtNum}`;

    // Authoritative Data Reconciliation Function (deduplicated & optimistic-write-safe)
    const reconcileAuthoritativeData = async () => {
      if (reconcileInFlight) return reconcileInFlight;
      reconcileInFlight = (async () => {
        try {
          if (SupabaseService.isAvailable()) {
            // Immediately kick off authoritative registration_form_config fetch in parallel with connection check
            // so registration open/closed status hydrates from Supabase without waiting on other tables
            const earlyFormConfigPromise = SupabaseService.fetchFormConfig(seasonSlug, false).then((earlyCfg) => {
              if (!isDisposed && earlyCfg !== null) {
                const isRegGuardActiveEarly = Date.now() - regToggleGuardRef.current.updatedAt < 2500;
                const earlyEnabled = isRegGuardActiveEarly
                  ? regToggleGuardRef.current.enabled
                  : earlyCfg.enabled !== false;
                if (Array.isArray(earlyCfg.fields) && earlyCfg.fields.length > 0) {
                  setFormConfig({ ...earlyCfg, enabled: earlyEnabled });
                }
                syncRegistrationEnabledState(earlyEnabled, earlyCfg.closedNotice, true, seasonSlug);
              }
              return earlyCfg;
            });

            const testRes = await testSupabaseConnection();
            if (isDisposed) return;
            setIsCentralizedDbConnected(testRes.connected);
            setIsSupabaseConnected(testRes.connected);

            // Fetch Players, Teams, Matches, Registrations, FormConfig, Tokens strictly scoped to active season
            const [players, teams, matchData, regs, cfg, tokData] = await Promise.all([
              SupabaseService.fetchPlayers(seasonSlug, seasonId),
              SupabaseService.fetchTeams(seasonSlug, seasonId),
              SupabaseService.fetchMatches(seasonSlug, seasonId),
              SupabaseService.fetchRegistrations(seasonSlug, seasonId),
              earlyFormConfigPromise,
              SupabaseService.fetchTokens(seasonSlug),
            ]);

            if (isDisposed) return;

            if (regs !== null) {
              setRegistrationsSyncError(null);
            } else {
              setRegistrationsSyncError('Failed to retrieve registrations from Supabase.');
            }
            setIsRegistrationsLoading(false);

            const extractedFromSupabase = SupabaseService.extractTournamentSettingsFromConfig(cfg);
            const extractedFormation = SupabaseService.extractTeamFormationFromConfig(cfg);
            const isHeroGuardActive = Date.now() - heroPublishGuardRef.current < 2500;
            if (!isHeroGuardActive && (cfg?.appearance as any)?.heroPublished) {
              applyPublishedHeroConfig((cfg?.appearance as any).heroPublished, seasonSlug);
            } else if (!isHeroGuardActive && !cfg) {
              fetch(`/api/hero/published?season=${encodeURIComponent(seasonSlug)}&t=${Date.now()}`, { cache: 'no-store' })
                .then((r) => (r.ok ? r.json() : null))
                .then((d) => {
                  if (d?.heroConfig && !isDisposed) applyPublishedHeroConfig(d.heroConfig, seasonSlug);
                })
                .catch(() => {});
            }

            const isYoutubeGuardActive = Date.now() - youtubeGuardRef.current < 2500;
            if (!isYoutubeGuardActive && (cfg?.appearance as any)?.youtubeLive) {
              applyYoutubeLiveConfig((cfg?.appearance as any).youtubeLive, seasonSlug);
            } else if (!isYoutubeGuardActive && !cfg) {
              fetch(`/api/livestream?season=${encodeURIComponent(seasonSlug)}&t=${Date.now()}`, { cache: 'no-store' })
                .then((r) => (r.ok ? r.json() : null))
                .then((d) => {
                  if (d?.config && !isDisposed) applyYoutubeLiveConfig(d.config, seasonSlug);
                })
                .catch(() => {});
            }
            const isRegGuardActive = Date.now() - regToggleGuardRef.current.updatedAt < 2500;
            const resolvedEnabled =
              isRegGuardActive
                ? regToggleGuardRef.current.enabled
                : cfg !== null
                ? cfg.enabled !== false
                : undefined;

            if (cfg !== null && Array.isArray(cfg.fields) && cfg.fields.length > 0) {
              const nextCfg =
                resolvedEnabled !== undefined ? { ...cfg, enabled: resolvedEnabled } : cfg;
              setFormConfig(nextCfg);
              setIsRegistrationStatusHydrated(true);
              try {
                localStorage.setItem(
                  getSeasonStorageKey('spl_forms_cache', seasonSlug),
                  JSON.stringify(nextCfg)
                );
              } catch {}
            } else if (cfg !== null && resolvedEnabled !== undefined) {
              syncRegistrationEnabledState(resolvedEnabled, cfg.closedNotice, true, seasonSlug);
            }
            if (tokData !== null) {
              setTokens(tokData.tokens);
              setActiveToken(tokData.activeToken);
            }

            setState((prev) => {
              const nowTs = Date.now();
              const guardActive = (id: string) => {
                const g = localMatchGuardRef.current.get(id);
                return Boolean(g && nowTs - g.updatedAt < 1800);
              };

              const courtNames = extractedFromSupabase.settings?.courtNames || prev.settings.courtNames;

              const nextMatches =
                matchData !== null
                  ? matchData.matches.map((dbM) => {
                      if (guardActive(dbM.id)) {
                        const localM = prev.matches.find((lm) => lm.id === dbM.id);
                        if (localM) return localM;
                      }
                      return {
                        ...dbM,
                        courtName: dbM.courtName || resolveCourtName(dbM.court || 1, courtNames),
                      };
                    })
                  : prev.matches;

              const playoffMeta = SupabaseService.extractPlayoffStateFromConfig(cfg);
              const metaById = playoffMeta?.matchMetaById || {};

              const nextKoMatchesRaw =
                matchData !== null
                  ? matchData.knockout.map((dbK) => {
                      if (guardActive(dbK.id)) {
                        const localK = prev.knockout.matches.find((lk) => lk.id === dbK.id);
                        if (localK) return localK;
                      }
                      const mMeta = metaById[dbK.id] || {};
                      return {
                        ...dbK,
                        ...mMeta,
                        status: dbK.status && dbK.status !== 'upcoming' ? dbK.status : (mMeta.status || dbK.status || 'upcoming'),
                        scoreA: dbK.scoreA !== undefined ? dbK.scoreA : mMeta.scoreA,
                        scoreB: dbK.scoreB !== undefined ? dbK.scoreB : mMeta.scoreB,
                        winner: dbK.winner || mMeta.winner,
                        teamA: dbK.teamA || mMeta.teamA,
                        teamB: dbK.teamB || mMeta.teamB,
                        courtName: mMeta.courtName || dbK.courtName || resolveCourtName(dbK.court || 1, courtNames),
                      };
                    })
                  : prev.knockout.matches;

              const inferredFormat: PlayoffFormat =
                playoffMeta?.format ||
                (matchData !== null
                  ? nextKoMatchesRaw.some((k) => k.playoffRound === 'Q1' || k.playoffRound === 'Q2' || k.isPlayoff)
                    ? 'ipl_top4'
                    : nextKoMatchesRaw.some((k) => k.stage === 'ELIM' || k.stage === 'QF')
                    ? 'top8'
                    : nextKoMatchesRaw.some((k) => k.stage === 'SF')
                    ? 'top4'
                    : nextKoMatchesRaw.length === 1 && nextKoMatchesRaw[0].stage === 'F'
                    ? 'top2'
                    : prev.knockout.format
                  : prev.knockout.format);

              const effectiveQualified =
                playoffMeta?.qualifiedTeams ?? prev.knockout.qualifiedTeams;

              const bracketProg =
                matchData !== null && nextKoMatchesRaw.length > 0
                  ? progressKnockoutBracket(nextKoMatchesRaw, inferredFormat, effectiveQualified)
                  : null;

              const progressedKoMatches = bracketProg
                ? bracketProg.matches
                : matchData !== null
                ? progressKnockoutMatches(nextKoMatchesRaw, inferredFormat)
                : prev.knockout.matches;

              const dbSettings = extractedFromSupabase.settings;
              const dbPayment = extractedFromSupabase.payment;

              return {
                ...prev,
                players: players !== null ? players : prev.players,
                teams: teams !== null ? teams : prev.teams,
                matches: sortMatchesByScheduleOrder(nextMatches),
                knockout: {
                  ...prev.knockout,
                  ...(playoffMeta
                    ? {
                        qualifyingTeamsCount:
                          playoffMeta.qualifyingTeamsCount ?? prev.knockout.qualifyingTeamsCount,
                        qualificationMode:
                          playoffMeta.qualificationMode ?? prev.knockout.qualificationMode,
                        manualSelectedTeamIds:
                          playoffMeta.manualSelectedTeamIds ?? prev.knockout.manualSelectedTeamIds,
                        customStageConfig:
                          playoffMeta.customStageConfig ?? prev.knockout.customStageConfig,
                        bracketId: playoffMeta.bracketId ?? prev.knockout.bracketId,
                        published: playoffMeta.published ?? prev.knockout.published,
                        publishedAt: playoffMeta.publishedAt ?? prev.knockout.publishedAt,
                        publishedSnapshot:
                          playoffMeta.publishedSnapshot ?? prev.knockout.publishedSnapshot,
                        versionHistory:
                          playoffMeta.versionHistory ?? prev.knockout.versionHistory,
                        showOnPublicHomepage:
                          playoffMeta.showOnPublicHomepage ?? prev.knockout.showOnPublicHomepage,
                        qualifiedTeams: playoffMeta.qualifiedTeams ?? prev.knockout.qualifiedTeams,
                        disqualifiedTeamIds:
                          playoffMeta.disqualifiedTeamIds ?? prev.knockout.disqualifiedTeamIds,
                        manualTieBreakOrder:
                          playoffMeta.manualTieBreakOrder ?? prev.knockout.manualTieBreakOrder,
                        auditLogs: playoffMeta.auditLogs ?? prev.knockout.auditLogs,
                      }
                    : {}),
                  format: inferredFormat,
                  matches: progressedKoMatches,
                  championTeamId:
                    bracketProg?.championTeamId ??
                    playoffMeta?.championTeamId ??
                    prev.knockout.championTeamId,
                  runnerUpTeamId:
                    bracketProg?.runnerUpTeamId ??
                    playoffMeta?.runnerUpTeamId ??
                    prev.knockout.runnerUpTeamId,
                  status: bracketProg?.isCompleted
                    ? 'completed'
                    : progressedKoMatches.length > 0
                    ? playoffMeta?.published === false
                      ? 'draft'
                      : 'active'
                    : 'draft',
                },
                registrations: regs !== null ? regs : prev.registrations,
                registrationSettings: {
                  ...prev.registrationSettings,
                  ...(resolvedEnabled !== undefined ? { enabled: resolvedEnabled } : {}),
                  ...(cfg?.closedNotice !== undefined ? { closedNotice: cfg.closedNotice } : {}),
                },
                settings: dbSettings
                  ? {
                      ...prev.settings,
                      ...dbSettings,
                      scoringRules: dbSettings.scoringRules
                        ? { ...prev.settings.scoringRules, ...dbSettings.scoringRules }
                        : prev.settings.scoringRules,
                      playoffSettings: dbSettings.playoffSettings
                        ? normalizePlayoffSettings(dbSettings.playoffSettings)
                        : prev.settings.playoffSettings,
                    }
                  : prev.settings,
                payment: dbPayment ? { ...prev.payment, ...dbPayment } : prev.payment,
                predefinedTeams: extractedFormation.predefinedTeams ?? prev.predefinedTeams,
                teamFormationMode: extractedFormation.teamFormationMode ?? prev.teamFormationMode,
              };
            });

            // Reconcile predefinedTeams & teamFormationMode from backend state (and hydrate legacy fields if not yet in Supabase)
            fetch(`/api/tournament/state?season=${encodeURIComponent(seasonSlug)}&t=${Date.now()}`, { cache: 'no-store' })
              .then(async (res) => {
                if (!res.ok) return null;
                const text = await res.text().catch(() => '');
                try { return text ? JSON.parse(text) : null; } catch { return null; }
              })
              .then((serverState) => {
                if (serverState && !isDisposed) {
                  const hasEmbeddedSettings = Boolean((cfg?.appearance as any)?.tournamentSettings);
                  const hasEmbeddedFormation = Boolean((cfg?.appearance as any)?.teamFormation);
                  const dbSettings = extractedFromSupabase.settings;
                  const dbPayment = extractedFromSupabase.payment;
                  setState((prev) => ({
                    ...prev,
                    settings: hasEmbeddedSettings
                      ? prev.settings
                      : serverState.settings
                      ? {
                          ...prev.settings,
                          ...serverState.settings,
                          ...(dbSettings?.name ? { name: dbSettings.name } : {}),
                          ...(dbSettings?.season ? { season: dbSettings.season } : {}),
                          ...(dbSettings?.venue !== undefined ? { venue: dbSettings.venue } : {}),
                          ...(dbSettings?.date !== undefined ? { date: dbSettings.date } : {}),
                          ...(dbSettings?.entryFee != null ? { entryFee: dbSettings.entryFee } : {}),
                          ...(dbSettings?.slotLimit != null ? { slotLimit: dbSettings.slotLimit } : {}),
                        }
                      : prev.settings,
                    payment:
                      hasEmbeddedSettings || dbPayment
                        ? prev.payment
                        : serverState.payment
                        ? { ...prev.payment, ...serverState.payment }
                        : prev.payment,
                    predefinedTeams:
                      hasEmbeddedFormation && Array.isArray(extractedFormation.predefinedTeams)
                        ? extractedFormation.predefinedTeams
                        : Array.isArray(serverState.predefinedTeams)
                        ? serverState.predefinedTeams
                        : prev.predefinedTeams,
                    teamFormationMode:
                      (hasEmbeddedFormation && extractedFormation.teamFormationMode) ||
                      serverState.teamFormationMode ||
                      prev.teamFormationMode,
                  }));
                }
              })
              .catch(() => {});

            if (!cfg) {
              fetch(`/api/forms/${encodeURIComponent(seasonSlug)}?t=${Date.now()}`, { cache: 'no-store' })
                .then(async (res) => {
                  if (!res.ok) return null;
                  const text = await res.text().catch(() => '');
                  try { return text ? JSON.parse(text) : null; } catch { return null; }
                })
                .then((serverForm) => {
                  if (serverForm && serverForm.fields && !isDisposed) {
                    const isRegGuardActive = Date.now() - regToggleGuardRef.current.updatedAt < 2500;
                    const effectiveEnabled = isRegGuardActive
                      ? regToggleGuardRef.current.enabled
                      : serverForm.enabled !== false;
                    setFormConfig({ ...serverForm, enabled: effectiveEnabled });
                    setState((prev) => ({
                      ...prev,
                      registrationSettings: {
                        ...prev.registrationSettings,
                        seasonSlug,
                        enabled: effectiveEnabled,
                        ...(serverForm.closedNotice !== undefined ? { closedNotice: serverForm.closedNotice } : {}),
                      },
                    }));
                  }
                })
                .catch(() => {})
                .finally(() => {
                  if (!isDisposed) setIsRegistrationStatusHydrated(true);
                });
            }
          } else {
            // Fallback to local server state only if Supabase is not configured
            fetch(`/api/tournament/state?season=${encodeURIComponent(seasonSlug)}&t=${Date.now()}`, { cache: 'no-store' })
              .then(async (res) => {
                if (!res.ok) return null;
                const text = await res.text().catch(() => '');
                try { return text ? JSON.parse(text) : null; } catch { return null; }
              })
              .then((serverState) => {
                if (serverState && !isDisposed) {
                  if (serverState.lastUpdated) {
                    lastServerScoreTime.current = serverState.lastUpdated;
                  }
                  setState((prev) => ({
                    ...prev,
                    settings: serverState.settings ? { ...prev.settings, ...serverState.settings } : prev.settings,
                    payment: serverState.payment ? { ...prev.payment, ...serverState.payment } : prev.payment,
                    players: Array.isArray(serverState.players) ? serverState.players : prev.players,
                    teams: Array.isArray(serverState.teams) ? serverState.teams : prev.teams,
                    matches: Array.isArray(serverState.matches) ? serverState.matches : prev.matches,
                    knockout: serverState.knockout || prev.knockout,
                    predefinedTeams: Array.isArray(serverState.predefinedTeams) ? serverState.predefinedTeams : prev.predefinedTeams,
                    teamFormationMode: serverState.teamFormationMode || prev.teamFormationMode,
                  }));
                }
              })
              .catch(() => {});

            fetch(`/api/registrations?season=${encodeURIComponent(seasonSlug)}&t=${Date.now()}`, {
              cache: 'no-store',
              headers: { ...AuthService.getAuthHeader() },
            })
              .then((res) => (res.ok ? res.json() : null))
              .then((data) => {
                if (Array.isArray(data) && !isDisposed) {
                  setState((prev) => ({ ...prev, registrations: data }));
                  setRegistrationsSyncError(null);
                }
              })
              .catch(() => {})
              .finally(() => {
                if (!isDisposed) setIsRegistrationsLoading(false);
              });

            fetch(`/api/hero/published?season=${encodeURIComponent(seasonSlug)}&t=${Date.now()}`, { cache: 'no-store' })
              .then((res) => (res.ok ? res.json() : null))
              .then((data) => {
                if (data?.heroConfig && !isDisposed && Date.now() - heroPublishGuardRef.current >= 2500) {
                  applyPublishedHeroConfig(data.heroConfig, seasonSlug);
                }
              })
              .catch(() => {});

            fetch(`/api/livestream?season=${encodeURIComponent(seasonSlug)}&t=${Date.now()}`, { cache: 'no-store' })
              .then((res) => (res.ok ? res.json() : null))
              .then((data) => {
                if (data?.config && !isDisposed && Date.now() - youtubeGuardRef.current >= 2500) {
                  applyYoutubeLiveConfig(data.config, seasonSlug);
                }
              })
              .catch(() => {});

            fetch(`/api/forms/${encodeURIComponent(seasonSlug)}?t=${Date.now()}`, { cache: 'no-store' })
              .then(async (res) => {
                if (!res.ok) return null;
                const text = await res.text().catch(() => '');
                try { return text ? JSON.parse(text) : null; } catch { return null; }
              })
              .then((serverForm) => {
                if (serverForm && serverForm.fields && !isDisposed) {
                  const isRegGuardActive = Date.now() - regToggleGuardRef.current.updatedAt < 2500;
                  const effectiveEnabled = isRegGuardActive
                    ? regToggleGuardRef.current.enabled
                    : serverForm.enabled !== false;
                  setFormConfig({ ...serverForm, enabled: effectiveEnabled });
                  setState((prev) => ({
                    ...prev,
                    registrationSettings: {
                      ...prev.registrationSettings,
                      seasonSlug,
                      enabled: effectiveEnabled,
                      ...(serverForm.closedNotice !== undefined ? { closedNotice: serverForm.closedNotice } : {}),
                    },
                  }));
                }
              })
              .catch(() => {})
              .finally(() => {
                if (!isDisposed) setIsRegistrationStatusHydrated(true);
              });
          }

          fetch(`/api/tokens/${seasonSlug}`)
            .then(async (res) => {
              if (!res.ok) return null;
              const text = await res.text().catch(() => '');
              try { return text ? JSON.parse(text) : null; } catch { return null; }
            })
            .then((tok) => {
              if (tok && Array.isArray(tok.tokens) && !isDisposed) {
                setTokens(tok.tokens);
                setActiveToken(tok.activeToken || null);
              }
            })
            .catch(() => {});
        } finally {
          reconcileInFlight = null;
        }
      })();
      return reconcileInFlight;
    };

    const startFallbackRecoveryPolling = () => {
      // Avoid polling completely whenever Realtime is healthy or browser is offline
      if (currentChannelHealthy || fallbackPollInterval || (typeof navigator !== 'undefined' && !navigator.onLine)) {
        return;
      }
      fallbackPollInterval = setInterval(() => {
        if (typeof document !== 'undefined' && document.visibilityState === 'hidden') {
          return;
        }
        if (!isDisposed && !currentChannelHealthy && (typeof navigator === 'undefined' || navigator.onLine)) {
          void reconcileAuthoritativeData();
        } else {
          clearFallbackPolling();
        }
      }, 5000);
    };

    const normalizeStatus = (s: any): KnockoutMatch['status'] =>
      s === 'paused' || s === 'postponed'
        ? 'paused'
        : s === 'live'
        ? 'live'
        : s === 'completed'
        ? 'completed'
        : 'upcoming';

    const parseCourtNum = (c: any): number =>
      typeof c === 'number' ? c : parseInt(String(c || '').replace(/\D/g, '') || '1', 10) || 1;

    const shouldIgnoreStaleRemoteMatchUpdate = (matchId: string, incomingUpdatedAt?: string | number, incomingScoreA?: number, incomingScoreB?: number, incomingStatus?: string): boolean => {
      const guard = localMatchGuardRef.current.get(matchId);
      if (!guard) return false;
      const ageMs = Date.now() - guard.updatedAt;
      if (ageMs > 1500) {
        localMatchGuardRef.current.delete(matchId);
        return false;
      }
      if (incomingUpdatedAt) {
        const remoteTs = typeof incomingUpdatedAt === 'number' ? incomingUpdatedAt : new Date(incomingUpdatedAt).getTime();
        if (!Number.isNaN(remoteTs) && remoteTs < guard.updatedAt - 300) {
          return true;
        }
      }
      // If echo exactly mirrors our latest optimistic update, skip duplicate processing
      if (
        incomingScoreA === guard.scoreA &&
        incomingScoreB === guard.scoreB &&
        incomingStatus === guard.status
      ) {
        return true;
      }
      return false;
    };

    // =========================================================================
    // 1. SUPABASE REALTIME MASTER SUBSCRIPTION (with auto-reconnect on drop)
    // =========================================================================
    const subscribeRealtime = () => {
      if (isDisposed || !SupabaseService.isAvailable()) return;
      if (reconnectTimer) {
        clearTimeout(reconnectTimer);
        reconnectTimer = null;
      }
      if (unsubMaster) {
        unsubMaster();
        unsubMaster = undefined;
      }

      unsubMaster = SupabaseService.subscribeTournamentMaster({
        seasonSlug,
        seasonId,
        onSeasonChange: () => {
          if (!isDisposed) {
            void refreshSeason();
          }
        },
        onMatchChange: (payload) => {
          const eventRow = payload.new || payload.old;
          if (eventRow?.tournament_season && eventRow.tournament_season !== seasonSlug) {
            return;
          }
          if (eventRow?.season_id && seasonId && eventRow.season_id !== seasonId) {
            return;
          }

          if (payload.eventType === 'INSERT' && payload.new) {
            const m = payload.new;
            const nextStatus = normalizeStatus(m.status);
            const cNum = parseCourtNum(m.court);
            const cName = resolveCourtName(cNum, stateRef.current.settings.courtNames);

            if (m.match_type === 'knockout') {
              const timeStr = String(m.time || '');
              const dbStage = String(m.stage || 'SF');
              const inferredPr =
                dbStage === 'Q1' || (dbStage === 'SF' && m.slot === 1 && timeStr.toLowerCase().includes('qualifier 1'))
                  ? 'Q1'
                  : dbStage === 'Q2' || (dbStage === 'SF' && (m.slot === 3 || timeStr.toLowerCase().includes('qualifier 2')))
                  ? 'Q2'
                  : (dbStage === 'ELIM' || dbStage === 'QF') && timeStr.toLowerCase().includes('eliminator')
                  ? 'ELIM'
                  : dbStage === 'F' && timeStr.toLowerCase().includes('grand final')
                  ? 'F'
                  : undefined;

              const koMatch: KnockoutMatch = {
                id: m.id,
                stage: dbStage === 'Q1' || dbStage === 'Q2' ? 'SF' : m.stage === 'ELIM' ? 'ELIM' : m.stage || 'SF',
                playoffRound: inferredPr,
                isPlayoff: Boolean(inferredPr),
                slot: m.slot || 1,
                court: cNum,
                courtName: cName,
                time: m.time || undefined,
                teamA: m.team_a_id || undefined,
                teamB: m.team_b_id || undefined,
                scoreA: m.score_a != null ? m.score_a : undefined,
                scoreB: m.score_b != null ? m.score_b : undefined,
                status: nextStatus,
                winner: m.winner_id || undefined,
                sets: m.sets_json || undefined,
                mvpPlayerId: m.mvp_player_id || undefined,
                seasonId: m.season_id || seasonId,
                seasonSlug: m.tournament_season || seasonSlug,
              };
              setState((prev) => {
                const exists = prev.knockout.matches.some((k) => k.id === koMatch.id);
                const nextKo = exists
                  ? prev.knockout.matches.map((k) => (k.id === koMatch.id ? { ...k, ...koMatch } : k))
                  : [...prev.knockout.matches, koMatch];
                return {
                  ...prev,
                  matches: prev.matches.filter((existing) => existing.id !== koMatch.id),
                  knockout: {
                    ...prev.knockout,
                    matches: progressKnockoutMatches(nextKo, prev.knockout.format),
                  },
                };
              });
            } else {
              const parsedTime = parseMatchScheduleTime(m.time || undefined);
              const groupMatch: Match = {
                id: m.id,
                round: m.round || 1,
                court: cNum,
                courtName: cName,
                courtSlot: m.slot != null ? m.slot : undefined,
                slot: m.slot != null ? m.slot : undefined,
                matchNumber: m.slot != null ? m.slot : undefined,
                teamA: m.team_a_id || '',
                teamB: m.team_b_id || '',
                scoreA: m.score_a != null ? m.score_a : undefined,
                scoreB: m.score_b != null ? m.score_b : undefined,
                status: nextStatus,
                winner: m.winner_id || undefined,
                time: m.time || undefined,
                date: parsedTime.date,
                startTime: parsedTime.startTime,
                sets: m.sets_json || undefined,
                mvpPlayerId: m.mvp_player_id || undefined,
                seasonId: m.season_id || seasonId,
                seasonSlug: m.tournament_season || seasonSlug,
              };
              setState((prev) => {
                const exists = prev.matches.some((existing) => existing.id === groupMatch.id);
                const merged = exists
                  ? prev.matches.map((existing) => (existing.id === groupMatch.id ? { ...existing, ...groupMatch } : existing))
                  : [...prev.matches, groupMatch];
                return {
                  ...prev,
                  matches: sortMatchesByScheduleOrder(merged),
                  knockout: {
                    ...prev.knockout,
                    matches: prev.knockout.matches.filter((k) => k.id !== groupMatch.id),
                  },
                };
              });
            }
          } else if (payload.eventType === 'UPDATE' && payload.new) {
            const updated = payload.new;
            const nextStatus = normalizeStatus(updated.status);
            const incomingScoreA = updated.score_a !== undefined ? (updated.score_a ?? undefined) : undefined;
            const incomingScoreB = updated.score_b !== undefined ? (updated.score_b ?? undefined) : undefined;

            if (shouldIgnoreStaleRemoteMatchUpdate(updated.id, updated.updated_at, incomingScoreA, incomingScoreB, nextStatus)) {
              return;
            }

            setState((prev) => {
              let scoreChanged = false;
              let isLiveMatch = false;
              const resolvedCourt = updated.court ? parseCourtNum(updated.court) : undefined;
              const resolvedCourtName = resolvedCourt
                ? resolveCourtName(resolvedCourt, prev.settings.courtNames)
                : undefined;

              // Check regular matches
              const nextMatches = prev.matches.map((m) => {
                if (m.id === updated.id) {
                  const newScoreA = updated.score_a !== undefined ? (updated.score_a ?? undefined) : m.scoreA;
                  const newScoreB = updated.score_b !== undefined ? (updated.score_b ?? undefined) : m.scoreB;
                  if (newScoreA !== m.scoreA || newScoreB !== m.scoreB) {
                    scoreChanged = true;
                  }
                  if (nextStatus === 'live' || m.status === 'live') {
                    isLiveMatch = true;
                  }
                  const nextSlot = updated.slot !== undefined ? (updated.slot ?? undefined) : m.courtSlot;
                  const nextTime = updated.time !== undefined ? (updated.time || undefined) : m.time;
                  const parsedNextTime = parseMatchScheduleTime(nextTime);
                  return {
                    ...m,
                    teamA: updated.team_a_id !== undefined ? (updated.team_a_id || '') : m.teamA,
                    teamB: updated.team_b_id !== undefined ? (updated.team_b_id || '') : m.teamB,
                    scoreA: newScoreA,
                    scoreB: newScoreB,
                    status: nextStatus || m.status,
                    winner: updated.winner_id !== undefined ? (updated.winner_id || undefined) : m.winner,
                    court: resolvedCourt ?? m.court,
                    courtName: resolvedCourtName ?? m.courtName,
                    courtSlot: nextSlot,
                    slot: nextSlot,
                    matchNumber: nextSlot,
                    round: updated.round || m.round,
                    time: nextTime,
                    date: parsedNextTime.date,
                    startTime: parsedNextTime.startTime,
                    sets: updated.sets_json !== undefined ? (updated.sets_json || undefined) : m.sets,
                    mvpPlayerId: updated.mvp_player_id !== undefined ? (updated.mvp_player_id || undefined) : m.mvpPlayerId,
                  };
                }
                return m;
              });

              // Check knockout matches
              let foundInKo = false;
              let nextKnockoutMatches = prev.knockout.matches.map((k) => {
                if (k.id === updated.id) {
                  foundInKo = true;
                  const newScoreA = updated.score_a !== undefined ? (updated.score_a ?? undefined) : k.scoreA;
                  const newScoreB = updated.score_b !== undefined ? (updated.score_b ?? undefined) : k.scoreB;
                  if (newScoreA !== k.scoreA || newScoreB !== k.scoreB) {
                    scoreChanged = true;
                  }
                  if (nextStatus === 'live' || k.status === 'live') {
                    isLiveMatch = true;
                  }
                  return {
                    ...k,
                    stage: updated.stage || k.stage,
                    slot: updated.slot || k.slot,
                    court: resolvedCourt ?? k.court,
                    courtName: resolvedCourtName ?? k.courtName,
                    time: updated.time !== undefined ? (updated.time || undefined) : k.time,
                    scoreA: newScoreA,
                    scoreB: newScoreB,
                    status: nextStatus || k.status,
                    winner: updated.winner_id !== undefined ? (updated.winner_id || undefined) : k.winner,
                    teamA: updated.team_a_id !== undefined ? (updated.team_a_id || undefined) : k.teamA,
                    teamB: updated.team_b_id !== undefined ? (updated.team_b_id || undefined) : k.teamB,
                    sets: updated.sets_json !== undefined ? (updated.sets_json || undefined) : k.sets,
                    mvpPlayerId: updated.mvp_player_id !== undefined ? (updated.mvp_player_id || undefined) : k.mvpPlayerId,
                  };
                }
                return k;
              });

              if (!foundInKo && updated.match_type === 'knockout') {
                if (nextStatus === 'live') isLiveMatch = true;
                const koCourt = parseCourtNum(updated.court);
                nextKnockoutMatches = [
                  ...nextKnockoutMatches,
                  {
                    id: updated.id,
                    stage: updated.stage || 'SF',
                    slot: updated.slot || 1,
                    court: koCourt,
                    courtName: resolveCourtName(koCourt, prev.settings.courtNames),
                    time: updated.time || undefined,
                    teamA: updated.team_a_id || undefined,
                    teamB: updated.team_b_id || undefined,
                    scoreA: updated.score_a != null ? updated.score_a : undefined,
                    scoreB: updated.score_b != null ? updated.score_b : undefined,
                    status: nextStatus,
                    winner: updated.winner_id || undefined,
                    sets: updated.sets_json || undefined,
                    mvpPlayerId: updated.mvp_player_id || undefined,
                  },
                ];
              }

              if (scoreChanged && isLiveMatch) {
                sportsAudio.playScorePing();
              }
              if (nextStatus === 'completed' && updated.winner_id) {
                sportsAudio.playFanfare();
              }

              const cleanedMatches =
                updated.match_type === 'knockout'
                  ? nextMatches.filter((m) => m.id !== updated.id)
                  : sortMatchesByScheduleOrder(nextMatches);

              const cleanedKnockoutMatches =
                updated.match_type && updated.match_type !== 'knockout'
                  ? nextKnockoutMatches.filter((k) => k.id !== updated.id)
                  : nextKnockoutMatches;

              const bracketProg =
                cleanedKnockoutMatches.length > 0
                  ? progressKnockoutBracket(
                      cleanedKnockoutMatches,
                      prev.knockout.format,
                      prev.knockout.qualifiedTeams
                    )
                  : null;

              return {
                ...prev,
                matches: cleanedMatches,
                knockout: {
                  ...prev.knockout,
                  matches: bracketProg ? bracketProg.matches : cleanedKnockoutMatches,
                  championTeamId: bracketProg ? bracketProg.championTeamId : prev.knockout.championTeamId,
                  runnerUpTeamId: bracketProg ? bracketProg.runnerUpTeamId : prev.knockout.runnerUpTeamId,
                  status: bracketProg
                    ? bracketProg.isCompleted
                      ? 'completed'
                      : prev.knockout.published === false
                      ? 'draft'
                      : 'active'
                    : prev.knockout.status,
                },
              };
            });
          } else if (payload.eventType === 'DELETE' && payload.old) {
            const deletedId = payload.old.id;
            localMatchGuardRef.current.delete(deletedId);
            setState((prev) => {
              const remainingKo = prev.knockout.matches.filter((k) => k.id !== deletedId);
              const bracketProg =
                remainingKo.length > 0
                  ? progressKnockoutBracket(remainingKo, prev.knockout.format, prev.knockout.qualifiedTeams)
                  : null;
              return {
                ...prev,
                matches: prev.matches.filter((m) => m.id !== deletedId),
                knockout: {
                  ...prev.knockout,
                  matches: bracketProg ? bracketProg.matches : remainingKo,
                  championTeamId: bracketProg ? bracketProg.championTeamId : undefined,
                  runnerUpTeamId: bracketProg ? bracketProg.runnerUpTeamId : undefined,
                },
              };
            });
          }
        },

        onPlayerChange: (payload) => {
          const eventRow = payload.new || payload.old;
          if (eventRow?.season_id && seasonId && eventRow.season_id !== seasonId) {
            return;
          }
          if (payload.eventType === 'INSERT' && payload.new) {
            const p = payload.new;
            const mappedPlayer: Player = {
              id: p.id,
              name: p.name,
              mobile: p.mobile || undefined,
              age: p.age || undefined,
              gender: p.gender,
              skillLevel: p.skill_level === 'Pro' ? 'Pro' : p.skill_level === 'Intermediate' ? 'Intermediate' : 'Advanced',
              registrationStatus: p.registration_status || 'direct',
              registrationId: p.registration_id || undefined,
              city: p.city || undefined,
              category: p.category || undefined,
              style: p.style || undefined,
              photoUrl: p.photo_url || undefined,
              seasonId: p.season_id || seasonId,
              seasonSlug,
            };
            setState((prev) => {
              if (prev.players.some((existing) => existing.id === mappedPlayer.id)) return prev;
              return { ...prev, players: [...prev.players, mappedPlayer] };
            });
          } else if (payload.eventType === 'UPDATE' && payload.new) {
            const p = payload.new;
            setState((prev) => ({
              ...prev,
              players: prev.players.map((existing) =>
                existing.id === p.id
                  ? {
                      ...existing,
                      name: p.name,
                      mobile: p.mobile || undefined,
                      age: p.age || undefined,
                      gender: p.gender,
                      skillLevel: p.skill_level,
                      city: p.city || existing.city,
                      category: p.category || existing.category,
                      style: p.style || existing.style,
                      photoUrl: p.photo_url !== undefined ? p.photo_url || undefined : existing.photoUrl,
                      registrationStatus: p.registration_status || existing.registrationStatus,
                    }
                  : existing
              ),
            }));
          } else if (payload.eventType === 'DELETE' && payload.old) {
            const oldId = payload.old.id;
            setState((prev) => ({
              ...prev,
              players: prev.players.filter((p) => p.id !== oldId),
              teams: prev.teams.map((t) => ({
                ...t,
                players: t.players.filter((pid) => pid !== oldId),
                captainId: t.captainId === oldId ? undefined : t.captainId,
              })),
            }));
          }
        },

        onTeamChange: (payload) => {
          const eventRow = payload?.new || payload?.old;
          if (eventRow?.season_id && seasonId && eventRow.season_id !== seasonId) {
            return;
          }
          // Only ignore immediate self-echoes from local TEAM mutations (never block on score updates!)
          if (Date.now() - lastLocalTeamMutationTime.current < 1800) return;

          if (payload?.eventType === 'UPDATE' && payload.new?.id) {
            const row = payload.new;
            const decoded = SupabaseService.decodeShortName(row.short_name);
            setState((prev) => {
              const exists = prev.teams.some((t) => t.id === row.id);
              if (!exists) return prev;
              return {
                ...prev,
                teams: prev.teams.map((t) =>
                  t.id === row.id
                    ? {
                        ...t,
                        name: row.name || t.name,
                        badge: row.badge || t.badge || '🏸',
                        avatarColor: row.avatar_color || t.avatarColor,
                        locked: typeof row.locked === 'boolean' ? row.locked : t.locked,
                        captainId: row.captain_id !== undefined ? row.captain_id || undefined : t.captainId,
                        token: decoded.token || t.token,
                        lockedPlayerIds:
                          decoded.lockedPlayerIds.length > 0 ? decoded.lockedPlayerIds : t.lockedPlayerIds,
                      }
                    : t
                ),
              };
            });
            return;
          }

          if (payload?.eventType === 'DELETE' && payload.old?.id) {
            const delId = payload.old.id;
            setState((prev) => ({
              ...prev,
              teams: prev.teams.filter((t) => t.id !== delId),
            }));
            return;
          }

          SupabaseService.fetchTeams(seasonSlug, seasonId).then((teams) => {
            if (isDisposed || Date.now() - lastLocalTeamMutationTime.current < 1800) return;
            if (teams && teams.length >= 0) {
              setState((prev) => {
                const prevTokenMap = new Map(prev.teams.map((t) => [t.id, t.token]));
                const prevLockedPlayersMap = new Map(prev.teams.map((t) => [t.id, t.lockedPlayerIds]));
                const merged = teams.map((t) => ({
                  ...t,
                  token: t.token || prevTokenMap.get(t.id),
                  lockedPlayerIds:
                    t.lockedPlayerIds && t.lockedPlayerIds.length > 0
                      ? t.lockedPlayerIds
                      : prevLockedPlayersMap.get(t.id) || [],
                }));
                return { ...prev, teams: merged };
              });
            }
          });
        },

        onTeamPlayerChange: (payload) => {
          const eventRow = payload?.new || payload?.old;
          if (eventRow?.season_id && seasonId && eventRow.season_id !== seasonId) {
            return;
          }
          if (Date.now() - lastLocalTeamMutationTime.current < 1800) return;
          SupabaseService.fetchTeams(seasonSlug, seasonId).then((teams) => {
            if (isDisposed || Date.now() - lastLocalTeamMutationTime.current < 1800) return;
            if (teams && teams.length >= 0) {
              setState((prev) => {
                const prevTokenMap = new Map(prev.teams.map((t) => [t.id, t.token]));
                const prevLockedPlayersMap = new Map(prev.teams.map((t) => [t.id, t.lockedPlayerIds]));
                const merged = teams.map((t) => ({
                  ...t,
                  token: t.token || prevTokenMap.get(t.id),
                  lockedPlayerIds:
                    t.lockedPlayerIds && t.lockedPlayerIds.length > 0
                      ? t.lockedPlayerIds
                      : prevLockedPlayersMap.get(t.id) || [],
                }));
                return { ...prev, teams: merged };
              });
            }
          });
        },

        onRegistrationChange: (payload) => {
          const eventRow = payload.new || payload.old;
          if (eventRow?.season_slug && eventRow.season_slug !== seasonSlug) {
            return;
          }
          if (eventRow?.season_id && seasonId && eventRow.season_id !== seasonId) {
            return;
          }
          if (payload.eventType === 'INSERT' && payload.new) {
            const mapped = SupabaseService.mapDbRegistration(payload.new);
            setState((prev) => {
              const filtered = prev.registrations.filter((r) => r.id !== mapped.id);
              return { ...prev, registrations: [mapped, ...filtered] };
            });
            setRegistrationsSyncError(null);
          } else if (payload.eventType === 'UPDATE' && payload.new) {
            const mapped = SupabaseService.mapDbRegistration(payload.new);
            setState((prev) => {
              const exists = prev.registrations.some((r) => r.id === mapped.id);
              const nextRegs = exists
                ? prev.registrations.map((r) => (r.id === mapped.id ? mapped : r))
                : [mapped, ...prev.registrations];
              return { ...prev, registrations: nextRegs };
            });
            setRegistrationsSyncError(null);
          } else if (payload.eventType === 'DELETE' && payload.old) {
            const delId = payload.old.id;
            setState((prev) => ({
              ...prev,
              registrations: prev.registrations.filter((r) => r.id !== delId),
            }));
          }
        },

        onFormConfigChange: (payload) => {
          const row = payload?.new || payload?.old;
          if (!row) return;
          if (row.season_slug && row.season_slug !== seasonSlug) return;
          if (row.season_id && seasonId && row.season_id !== seasonId) return;
          const isRegGuardActive = Date.now() - regToggleGuardRef.current.updatedAt < 2500;
          if (typeof row.enabled === 'boolean' && !isRegGuardActive) {
            const incomingEnabled = row.enabled !== false;
            const incomingNotice = row.closed_notice !== undefined ? row.closed_notice || undefined : undefined;
            syncRegistrationEnabledState(incomingEnabled, incomingNotice, true, seasonSlug);
          }

          if (
            Date.now() - heroPublishGuardRef.current >= 2500 &&
            (row.appearance_json as any)?.heroPublished
          ) {
            applyPublishedHeroConfig((row.appearance_json as any).heroPublished, seasonSlug);
          }

          if (
            Date.now() - youtubeGuardRef.current >= 2500 &&
            (row.appearance_json as any)?.youtubeLive
          ) {
            const incomingYt = normalizeYouTubeLiveConfig((row.appearance_json as any).youtubeLive);
            applyYoutubeLiveConfig(incomingYt, seasonSlug);
            if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
              try {
                const ych = new BroadcastChannel('spl_livestream_channel');
                ych.postMessage({ type: 'LIVESTREAM_UPDATED', config: incomingYt, seasonSlug });
                ych.close();
              } catch {}
            }
          }

          SupabaseService.fetchFormConfig(seasonSlug, false).then((cfg) => {
            if (!cfg || isDisposed) return;
            if (Date.now() - heroPublishGuardRef.current >= 2500 && (cfg.appearance as any)?.heroPublished) {
              applyPublishedHeroConfig((cfg.appearance as any).heroPublished, seasonSlug);
            }
            if (Date.now() - youtubeGuardRef.current >= 2500 && (cfg.appearance as any)?.youtubeLive) {
              applyYoutubeLiveConfig((cfg.appearance as any).youtubeLive, seasonSlug);
            }
            const guardStillActive = Date.now() - regToggleGuardRef.current.updatedAt < 2500;
            const resolvedEnabled = guardStillActive ? regToggleGuardRef.current.enabled : cfg.enabled !== false;
            const normalizedCfg: RegistrationFormConfig = {
              ...cfg,
              enabled: resolvedEnabled,
            };
            if (Array.isArray(normalizedCfg.fields) && normalizedCfg.fields.length > 0) {
              setFormConfig(normalizedCfg);
              try {
                localStorage.setItem(
                  getSeasonStorageKey('spl_forms_cache', seasonSlug),
                  JSON.stringify(normalizedCfg)
                );
              } catch {}
            }
            setIsRegistrationStatusHydrated(true);

            // Broadcast across open browser tabs immediately
            if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
              try {
                const fch = new BroadcastChannel('spl_form_config_channel');
                fch.postMessage({ type: 'FORM_PUBLISHED', config: normalizedCfg, seasonSlug });
                fch.close();
              } catch {}
            }

            const extracted = SupabaseService.extractTournamentSettingsFromConfig(normalizedCfg);
            const extractedFormation = SupabaseService.extractTeamFormationFromConfig(normalizedCfg);
            const playoffMeta = SupabaseService.extractPlayoffStateFromConfig(normalizedCfg);
            setState((prev) => {
              const metaById = playoffMeta?.matchMetaById || {};
              const nextKoMatches =
                playoffMeta && prev.knockout.matches.length > 0
                  ? prev.knockout.matches.map((k) => {
                      const mMeta = metaById[k.id] || {};
                      return {
                        ...k,
                        ...mMeta,
                        status: k.status && k.status !== 'upcoming' ? k.status : (mMeta.status || k.status || 'upcoming'),
                        scoreA: k.scoreA !== undefined ? k.scoreA : mMeta.scoreA,
                        scoreB: k.scoreB !== undefined ? k.scoreB : mMeta.scoreB,
                        winner: k.winner || mMeta.winner,
                        teamA: k.teamA || mMeta.teamA,
                        teamB: k.teamB || mMeta.teamB,
                      };
                    })
                  : prev.knockout.matches;

              return {
                ...prev,
                registrationSettings: {
                  ...prev.registrationSettings,
                  seasonSlug,
                  enabled: resolvedEnabled,
                  ...(normalizedCfg.closedNotice !== undefined ? { closedNotice: normalizedCfg.closedNotice } : {}),
                },
                knockout: playoffMeta
                  ? {
                      ...prev.knockout,
                      format: playoffMeta.format ?? prev.knockout.format,
                      qualifyingTeamsCount:
                        playoffMeta.qualifyingTeamsCount ?? prev.knockout.qualifyingTeamsCount,
                      qualificationMode:
                        playoffMeta.qualificationMode ?? prev.knockout.qualificationMode,
                      manualSelectedTeamIds:
                        playoffMeta.manualSelectedTeamIds ?? prev.knockout.manualSelectedTeamIds,
                      customStageConfig:
                        playoffMeta.customStageConfig ?? prev.knockout.customStageConfig,
                      bracketId: playoffMeta.bracketId ?? prev.knockout.bracketId,
                      published: playoffMeta.published ?? prev.knockout.published,
                      publishedAt: playoffMeta.publishedAt ?? prev.knockout.publishedAt,
                      publishedSnapshot:
                        playoffMeta.publishedSnapshot ?? prev.knockout.publishedSnapshot,
                      versionHistory:
                        playoffMeta.versionHistory ?? prev.knockout.versionHistory,
                      showOnPublicHomepage: playoffMeta.showOnPublicHomepage ?? prev.knockout.showOnPublicHomepage,
                      qualifiedTeams: playoffMeta.qualifiedTeams ?? prev.knockout.qualifiedTeams,
                      disqualifiedTeamIds: playoffMeta.disqualifiedTeamIds ?? prev.knockout.disqualifiedTeamIds,
                      manualTieBreakOrder: playoffMeta.manualTieBreakOrder ?? prev.knockout.manualTieBreakOrder,
                      auditLogs: playoffMeta.auditLogs ?? prev.knockout.auditLogs,
                      championTeamId: playoffMeta.championTeamId ?? prev.knockout.championTeamId,
                      runnerUpTeamId: playoffMeta.runnerUpTeamId ?? prev.knockout.runnerUpTeamId,
                      status: playoffMeta.status ?? prev.knockout.status,
                      matches: nextKoMatches,
                    }
                  : prev.knockout,
                settings: extracted.settings
                  ? {
                      ...prev.settings,
                      ...extracted.settings,
                      scoringRules: extracted.settings.scoringRules
                        ? { ...prev.settings.scoringRules, ...extracted.settings.scoringRules }
                        : prev.settings.scoringRules,
                      playoffSettings: extracted.settings.playoffSettings
                        ? normalizePlayoffSettings(extracted.settings.playoffSettings)
                        : prev.settings.playoffSettings,
                    }
                  : prev.settings,
                payment: extracted.payment
                  ? { ...prev.payment, ...extracted.payment }
                  : prev.payment,
                predefinedTeams: extractedFormation.predefinedTeams ?? prev.predefinedTeams,
                teamFormationMode: extractedFormation.teamFormationMode ?? prev.teamFormationMode,
              };
            });
          });
        },

        onPlayoffChange: (payload) => {
          const row = payload?.new || payload?.old;
          if (row?.season_slug && row.season_slug !== seasonSlug) return;
          if (row?.season_id && seasonId && row.season_id !== seasonId) return;
          if (!isDisposed) {
            void reconcileAuthoritativeData();
          }
        },

        onStatusChange: (status) => {
          if (isDisposed) return;
          if (status === 'SUBSCRIBED') {
            const shouldReconcile = needsReconcileOnSubscribe || !hasStartedInitialReconcile;
            needsReconcileOnSubscribe = false;
            currentChannelHealthy = true;
            reconnectAttempt = 0;
            clearFallbackPolling();
            if (reconnectTimer) {
              clearTimeout(reconnectTimer);
              reconnectTimer = null;
            }
            setRealtimeStatus('connected');
            if (shouldReconcile) {
              hasStartedInitialReconcile = true;
              void reconcileAuthoritativeData();
            }
          } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
            currentChannelHealthy = false;
            needsReconcileOnSubscribe = true;
            const online = typeof navigator === 'undefined' || navigator.onLine;
            setRealtimeStatus(online ? 'reconnecting' : 'offline');
            if (online) {
              startFallbackRecoveryPolling();
              if (!reconnectTimer) {
                const delay = Math.min(5000, 1500 * Math.pow(1.6, reconnectAttempt));
                reconnectAttempt += 1;
                reconnectTimer = setTimeout(() => {
                  reconnectTimer = null;
                  if (!isDisposed && (typeof navigator === 'undefined' || navigator.onLine)) {
                    subscribeRealtime();
                  }
                }, delay);
              }
            }
          }
        },
      });
    };

    // Initial reconciliation + subscribe (deduplicated so initial SUBSCRIBED does not double-fetch)
    hasStartedInitialReconcile = true;
    void reconcileAuthoritativeData();
    subscribeRealtime();

    reconnectTriggerRef.current = () => {
      if (isDisposed) return;
      const online = typeof navigator === 'undefined' || navigator.onLine;
      if (!online) {
        setRealtimeStatus('offline');
        return;
      }
      setRealtimeStatus('reconnecting');
      reconnectAttempt = 0;
      if (SupabaseService.isAvailable()) {
        subscribeRealtime();
      } else {
        setRealtimeStatus('connected');
      }
      void reconcileAuthoritativeData();
    };

    // =========================================================================
    // 2. REAL-TIME SERVER-SENT EVENTS (SSE) STREAM (Season-Scoped)
    // =========================================================================
    let eventSource: EventSource | null = null;
    try {
      eventSource = new EventSource(`/api/tournament/stream?season=${encodeURIComponent(seasonSlug)}`);

      eventSource.onopen = () => {
        if (!SupabaseService.isAvailable() && !isDisposed) {
          currentChannelHealthy = true;
          setRealtimeStatus('connected');
        }
      };

      eventSource.onerror = () => {
        if (!SupabaseService.isAvailable() && !isDisposed) {
          currentChannelHealthy = false;
          const online = typeof navigator === 'undefined' || navigator.onLine;
          setRealtimeStatus(online ? 'reconnecting' : 'offline');
        }
      };

      eventSource.addEventListener('match_score', (event: MessageEvent) => {
        try {
          const data = JSON.parse(event.data);
          if (data?.seasonSlug && data.seasonSlug !== seasonSlug) return;
          if (data && data.match) {
            if (
              shouldIgnoreStaleRemoteMatchUpdate(
                data.match.id,
                data.lastUpdated,
                data.match.scoreA,
                data.match.scoreB,
                data.match.status
              )
            ) {
              return;
            }
            lastServerScoreTime.current = data.lastUpdated || Date.now();
            setState((prev) => {
              let scoreChanged = false;
              let isLiveMatch = false;
              const matches = prev.matches.map((m) => {
                if (m.id === data.match.id) {
                  if (m.scoreA !== data.match.scoreA || m.scoreB !== data.match.scoreB) {
                    scoreChanged = true;
                  }
                  if (m.status === 'live' || data.match.status === 'live') {
                    isLiveMatch = true;
                  }
                  return { ...m, ...data.match };
                }
                return m;
              });

              if (scoreChanged && isLiveMatch) {
                sportsAudio.playScorePing();
              }
              if (data.match.status === 'completed' && data.match.winner) {
                sportsAudio.playFanfare();
              }

              return { ...prev, matches };
            });
          }
        } catch {}
      });

      eventSource.addEventListener('knockout_score', (event: MessageEvent) => {
        try {
          const data = JSON.parse(event.data);
          if (data?.seasonSlug && data.seasonSlug !== seasonSlug) return;
          if (data && data.match) {
            if (
              shouldIgnoreStaleRemoteMatchUpdate(
                data.match.id,
                data.lastUpdated,
                data.match.scoreA,
                data.match.scoreB,
                data.match.status
              )
            ) {
              return;
            }
            lastServerScoreTime.current = data.lastUpdated || Date.now();
            setState((prev) => {
              let scoreChanged = false;
              let exists = false;
              let matches = prev.knockout.matches.map((k) => {
                if (k.id === data.match.id) {
                  exists = true;
                  if (k.scoreA !== data.match.scoreA || k.scoreB !== data.match.scoreB) {
                    scoreChanged = true;
                  }
                  return { ...k, ...data.match };
                }
                return k;
              });

              if (!exists) {
                matches = [...matches, data.match];
              }

              const bracketProg =
                matches.length > 0
                  ? progressKnockoutBracket(
                      matches,
                      prev.knockout.format,
                      prev.knockout.qualifiedTeams
                    )
                  : null;

              if (scoreChanged) {
                sportsAudio.playScorePing();
              }
              if (data.match.status === 'completed' && data.match.winner) {
                sportsAudio.playFanfare();
              }

              return {
                ...prev,
                knockout: {
                  ...prev.knockout,
                  matches: bracketProg ? bracketProg.matches : matches,
                  championTeamId: bracketProg
                    ? bracketProg.championTeamId
                    : prev.knockout.championTeamId,
                  runnerUpTeamId: bracketProg
                    ? bracketProg.runnerUpTeamId
                    : prev.knockout.runnerUpTeamId,
                  status: bracketProg
                    ? bracketProg.isCompleted
                      ? 'completed'
                      : matches.length > 0
                      ? prev.knockout.published === false
                        ? 'draft'
                        : 'active'
                      : 'draft'
                    : prev.knockout.status,
                },
              };
            });
          }
        } catch {}
      });

      eventSource.addEventListener('tournament_state', (event: MessageEvent) => {
        try {
          const data = JSON.parse(event.data);
          if (data?.seasonSlug && data.seasonSlug !== seasonSlug) return;
          if (data) {
            if (data.lastUpdated) lastServerScoreTime.current = data.lastUpdated;
            setState((prev) => ({
              ...prev,
              matches: Array.isArray(data.matches) ? data.matches : prev.matches,
              teams: Array.isArray(data.teams) && data.teams.length > 0 ? data.teams : prev.teams,
              knockout: data.knockout || prev.knockout,
              settings: data.settings ? { ...prev.settings, ...data.settings } : prev.settings,
              payment: data.payment ? { ...prev.payment, ...data.payment } : prev.payment,
              predefinedTeams: Array.isArray(data.predefinedTeams) ? data.predefinedTeams : prev.predefinedTeams,
              teamFormationMode: data.teamFormationMode || prev.teamFormationMode,
            }));
          }
        } catch {}
      });

      eventSource.addEventListener('settings_updated', (event: MessageEvent) => {
        try {
          const data = JSON.parse(event.data);
          if (data?.seasonSlug && data.seasonSlug !== seasonSlug) return;
          if (data) {
            if (data.lastUpdated) lastServerScoreTime.current = data.lastUpdated;
            setState((prev) => ({
              ...prev,
              settings: data.settings ? { ...prev.settings, ...data.settings } : prev.settings,
              payment: data.payment ? { ...prev.payment, ...data.payment } : prev.payment,
            }));
          }
        } catch {}
      });

      eventSource.addEventListener('teams_update', (event: MessageEvent) => {
        try {
          const data = JSON.parse(event.data);
          if (data?.seasonSlug && data.seasonSlug !== seasonSlug) return;
          if (data && Array.isArray(data.teams)) {
            setState((prev) => ({ ...prev, teams: data.teams }));
          }
        } catch {}
      });

      eventSource.addEventListener('team_updated', (event: MessageEvent) => {
        try {
          const data = JSON.parse(event.data);
          if (data?.seasonSlug && data.seasonSlug !== seasonSlug) return;
          if (data && data.team && data.team.id) {
            if (data.lastUpdated) lastServerScoreTime.current = data.lastUpdated;
            setState((prev) => {
              const exists = prev.teams.some((t) => t.id === data.team.id);
              const nextTeams = exists
                ? prev.teams.map((t) => (t.id === data.team.id ? { ...t, ...data.team } : t))
                : [...prev.teams, data.team];
              return { ...prev, teams: nextTeams };
            });
          }
        } catch {}
      });

      eventSource.addEventListener('hero_published', (event: MessageEvent) => {
        try {
          const data = JSON.parse(event.data);
          if (data?.seasonSlug && data.seasonSlug !== seasonSlug) return;
          if (data?.heroConfig && Date.now() - heroPublishGuardRef.current >= 2500) {
            applyPublishedHeroConfig(data.heroConfig, seasonSlug);
          }
        } catch {}
      });

      eventSource.addEventListener('livestream_updated', (event: MessageEvent) => {
        try {
          const data = JSON.parse(event.data);
          if (data?.seasonSlug && data.seasonSlug !== seasonSlug) return;
          if (data?.config && Date.now() - youtubeGuardRef.current >= 2500) {
            applyYoutubeLiveConfig(data.config, seasonSlug);
          }
        } catch {}
      });

      eventSource.addEventListener('form_published', (event: MessageEvent) => {
        try {
          const data = JSON.parse(event.data);
          const incomingSlug = data?.seasonSlug || data?.config?.seasonSlug;
          if (incomingSlug && incomingSlug !== seasonSlug) return;
          if (data && data.config) {
            if ((data.config.appearance as any)?.heroPublished && Date.now() - heroPublishGuardRef.current >= 2500) {
              applyPublishedHeroConfig((data.config.appearance as any).heroPublished, seasonSlug);
            }
            if ((data.config.appearance as any)?.youtubeLive && Date.now() - youtubeGuardRef.current >= 2500) {
              applyYoutubeLiveConfig((data.config.appearance as any).youtubeLive, seasonSlug);
            }
            const isRegGuardActive = Date.now() - regToggleGuardRef.current.updatedAt < 2500;
            const effectiveEnabled = isRegGuardActive
              ? regToggleGuardRef.current.enabled
              : data.config.enabled !== false;
            setFormConfig({ ...data.config, enabled: effectiveEnabled });
            setIsRegistrationStatusHydrated(true);
            setState((prev) => ({
              ...prev,
              registrationSettings: {
                ...prev.registrationSettings,
                seasonSlug,
                enabled: effectiveEnabled,
                ...(data.config.closedNotice !== undefined ? { closedNotice: data.config.closedNotice } : {}),
              },
            }));
          }
        } catch {}
      });

      eventSource.addEventListener('registration_created', (event: MessageEvent) => {
        try {
          const data = JSON.parse(event.data);
          const rSeason = data?.seasonSlug || data?.registration?.season;
          if (rSeason && rSeason !== seasonSlug) return;
          if (data && data.registration) {
            setState((prev) => {
              if (prev.registrations.some((r) => r.id === data.registration.id)) return prev;
              return { ...prev, registrations: [data.registration, ...prev.registrations] };
            });
          }
        } catch {}
      });

      eventSource.addEventListener('registration_updated', (event: MessageEvent) => {
        try {
          const data = JSON.parse(event.data);
          const rSeason = data?.seasonSlug || data?.registration?.season;
          if (rSeason && rSeason !== seasonSlug) return;
          if (data && data.registration) {
            setState((prev) => ({
              ...prev,
              registrations: prev.registrations.map((r) =>
                r.id === data.registration.id ? { ...r, ...data.registration } : r
              ),
            }));
          }
        } catch {}
      });

      eventSource.addEventListener('registration_deleted', (event: MessageEvent) => {
        try {
          const data = JSON.parse(event.data);
          if (data?.seasonSlug && data.seasonSlug !== seasonSlug) return;
          if (data && data.id) {
            setState((prev) => ({
              ...prev,
              registrations: prev.registrations.filter((r) => r.id !== data.id),
            }));
          }
        } catch {}
      });

      eventSource.addEventListener('registrations_bulk_deleted', (event: MessageEvent) => {
        try {
          const data = JSON.parse(event.data);
          if (data?.seasonSlug && data.seasonSlug !== seasonSlug) return;
          if (data && Array.isArray(data.ids)) {
            const delSet = new Set(data.ids);
            setState((prev) => ({
              ...prev,
              registrations: prev.registrations.filter((r) => !delSet.has(r.id)),
            }));
          }
        } catch {}
      });

      eventSource.addEventListener('registrations_bulk_approved', (event: MessageEvent) => {
        try {
          const data = JSON.parse(event.data);
          if (data?.seasonSlug && data.seasonSlug !== seasonSlug) return;
          if (data && Array.isArray(data.ids)) {
            const appSet = new Set(data.ids);
            setState((prev) => ({
              ...prev,
              registrations: prev.registrations.map((r) =>
                appSet.has(r.id) ? { ...r, status: 'approved', approvedAt: r.approvedAt || Date.now() } : r
              ),
            }));
          }
        } catch {}
      });

      eventSource.addEventListener('season_changed', () => {
        if (!isDisposed) {
          void refreshSeason();
        }
      });

      eventSource.addEventListener('season_updated', () => {
        if (!isDisposed) {
          void refreshSeason();
        }
      });

      eventSource.addEventListener('season_created', () => {
        if (!isDisposed) {
          void refreshSeason();
        }
      });
    } catch {}

    // =========================================================================
    // 3. MULTI-TAB REAL-TIME LISTENERS (BroadcastChannel + Window Storage)
    // =========================================================================
    let liveChannel: BroadcastChannel | null = null;
    let formChannel: BroadcastChannel | null = null;
    let heroChannel: BroadcastChannel | null = null;
    let livestreamChannel: BroadcastChannel | null = null;
    let regChannel: BroadcastChannel | null = null;

    if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
      liveChannel = new BroadcastChannel('spl_live_scores_channel');
      formChannel = new BroadcastChannel('spl_form_config_channel');
      heroChannel = new BroadcastChannel('spl_hero_config_channel');
      livestreamChannel = new BroadcastChannel('spl_livestream_channel');
      regChannel = new BroadcastChannel('spl_registrations_channel');

      regChannel.onmessage = (event) => {
        if (event.data?.type !== 'REGISTRATION_SYNC') return;
        if (event.data?.seasonSlug && event.data.seasonSlug !== seasonSlug) return;
        const { action, payload } = event.data;
        if (action === 'upsert' && payload?.id) {
          setState((prev) => {
            const exists = prev.registrations.some((r) => r.id === payload.id);
            return {
              ...prev,
              registrations: exists
                ? prev.registrations.map((r) => (r.id === payload.id ? payload : r))
                : [payload, ...prev.registrations],
            };
          });
        } else if (action === 'delete' && payload?.id) {
          setState((prev) => ({
            ...prev,
            registrations: prev.registrations.filter((r) => r.id !== payload.id),
          }));
        } else if (action === 'bulk_delete' && Array.isArray(payload?.ids)) {
          const delSet = new Set(payload.ids);
          setState((prev) => ({
            ...prev,
            registrations: prev.registrations.filter((r) => !delSet.has(r.id)),
          }));
        } else {
          void refreshRegistrations();
        }
      };

      heroChannel.onmessage = (event) => {
        if (event.data?.seasonSlug && event.data.seasonSlug !== seasonSlug) return;
        if (event.data?.type === 'HERO_PUBLISHED' && event.data.heroConfig) {
          applyPublishedHeroConfig(event.data.heroConfig, seasonSlug);
        }
      };

      livestreamChannel.onmessage = (event) => {
        if (event.data?.seasonSlug && event.data.seasonSlug !== seasonSlug) return;
        if (event.data?.type === 'LIVESTREAM_UPDATED' && event.data.config) {
          applyYoutubeLiveConfig(event.data.config, seasonSlug);
        }
      };

      liveChannel.onmessage = (event) => {
        if (event.data?.seasonSlug && event.data.seasonSlug !== seasonSlug) return;
        if (event.data?.type === 'SCORE_UPDATE') {
          const { matches, teams, knockout, lastUpdated } = event.data;
          if (lastUpdated) lastServerScoreTime.current = lastUpdated;
          setState((prev) => ({
            ...prev,
            matches: Array.isArray(matches) ? matches : prev.matches,
            teams: Array.isArray(teams) && teams.length > 0 ? teams : prev.teams,
            knockout: knockout || prev.knockout,
          }));
        } else if (event.data?.type === 'TEAM_UPDATED' && event.data.team?.id) {
          const { team, lastUpdated } = event.data;
          if (lastUpdated) lastServerScoreTime.current = lastUpdated;
          setState((prev) => ({
            ...prev,
            teams: prev.teams.some((t) => t.id === team.id)
              ? prev.teams.map((t) => (t.id === team.id ? { ...t, ...team } : t))
              : [...prev.teams, team],
          }));
        } else if (event.data?.type === 'SCHEDULE_UPDATED' && Array.isArray(event.data.matches)) {
          const { matches, lastUpdated } = event.data;
          if (lastUpdated) lastServerScoreTime.current = lastUpdated;
          setState((prev) => ({
            ...prev,
            matches: sortMatchesByScheduleOrder(matches),
          }));
        } else if (event.data?.type === 'SETTINGS_UPDATED') {
          const { settings, payment, lastUpdated } = event.data;
          if (lastUpdated) lastServerScoreTime.current = lastUpdated;
          setState((prev) => ({
            ...prev,
            settings: settings ? { ...prev.settings, ...settings } : prev.settings,
            payment: payment ? { ...prev.payment, ...payment } : prev.payment,
          }));
        }
      };

      formChannel.onmessage = (event) => {
        const incomingSlug = event.data?.seasonSlug || event.data?.config?.seasonSlug;
        if (incomingSlug && incomingSlug !== seasonSlug) return;
        if (event.data?.type === 'FORM_PUBLISHED' && event.data.config) {
          const nextCfg = event.data.config as RegistrationFormConfig;
          if ((nextCfg.appearance as any)?.heroPublished) {
            applyPublishedHeroConfig((nextCfg.appearance as any).heroPublished, seasonSlug);
          }
          setFormConfig(nextCfg);
          setIsRegistrationStatusHydrated(true);
          if (typeof nextCfg.enabled === 'boolean') {
            setState((prev) => ({
              ...prev,
              registrationSettings: {
                ...prev.registrationSettings,
                seasonSlug,
                enabled: nextCfg.enabled !== false,
                ...(nextCfg.closedNotice !== undefined ? { closedNotice: nextCfg.closedNotice } : {}),
              },
            }));
          }
        }
      };
    }

    const seasonStateKey = getSeasonStorageKey(STORAGE_KEY, seasonSlug);
    const seasonFormKey = getSeasonStorageKey('spl_forms_cache', seasonSlug);

    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === seasonStateKey && e.newValue) {
        try {
          const parsed = JSON.parse(e.newValue);
          if (parsed && Array.isArray(parsed.matches)) {
            setState((prev) => ({
              ...prev,
              matches: parsed.matches,
              teams: Array.isArray(parsed.teams) ? parsed.teams : prev.teams,
              knockout: parsed.knockout || prev.knockout,
              settings: parsed.settings ? { ...prev.settings, ...parsed.settings } : prev.settings,
            }));
          }
        } catch {}
      } else if (e.key === seasonFormKey && e.newValue) {
        try {
          const parsedForm = JSON.parse(e.newValue);
          if (parsedForm && Array.isArray(parsedForm.fields)) {
            setFormConfig(parsedForm);
            setIsRegistrationStatusHydrated(true);
            if (typeof parsedForm.enabled === 'boolean') {
              setState((prev) => ({
                ...prev,
                registrationSettings: {
                  ...prev.registrationSettings,
                  seasonSlug,
                  enabled: parsedForm.enabled !== false,
                  ...(parsedForm.closedNotice !== undefined ? { closedNotice: parsedForm.closedNotice } : {}),
                },
              }));
            }
          }
        } catch {}
      }
    };

    // =========================================================================
    // 4. AUTO-RECONNECTION & MOBILE/TAB RESUME RECONCILIATION
    // =========================================================================
    const handleOffline = () => {
      if (isDisposed) return;
      currentChannelHealthy = false;
      clearFallbackPolling();
      if (reconnectTimer) {
        clearTimeout(reconnectTimer);
        reconnectTimer = null;
      }
      setRealtimeStatus('offline');
    };

    const handleOnline = () => {
      if (isDisposed) return;
      reconnectAttempt = 0;
      if (SupabaseService.isAvailable()) {
        setRealtimeStatus('reconnecting');
        subscribeRealtime();
      } else {
        setRealtimeStatus('connected');
      }
      void reconcileAuthoritativeData();
    };

    let lastResumeSyncAt = 0;
    const handleVisibilityOrResume = () => {
      if (isDisposed || document.visibilityState !== 'visible') return;
      const nowTs = Date.now();
      if (nowTs - lastResumeSyncAt < 1500) return;
      lastResumeSyncAt = nowTs;

      if (typeof navigator !== 'undefined' && !navigator.onLine) {
        setRealtimeStatus('offline');
        return;
      }

      if (SupabaseService.isAvailable() && !currentChannelHealthy) {
        setRealtimeStatus('reconnecting');
        subscribeRealtime();
      }
      void reconcileAuthoritativeData();
    };

    window.addEventListener('offline', handleOffline);
    window.addEventListener('online', handleOnline);
    window.addEventListener('pageshow', handleVisibilityOrResume);
    document.addEventListener('visibilitychange', handleVisibilityOrResume);
    window.addEventListener('storage', handleStorageChange);

    return () => {
      isDisposed = true;
      reconnectTriggerRef.current = null;
      clearFallbackPolling();
      if (reconnectTimer) {
        clearTimeout(reconnectTimer);
        reconnectTimer = null;
      }
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('pageshow', handleVisibilityOrResume);
      document.removeEventListener('visibilitychange', handleVisibilityOrResume);
      window.removeEventListener('storage', handleStorageChange);
      eventSource?.close();
      liveChannel?.close();
      formChannel?.close();
      heroChannel?.close();
      livestreamChannel?.close();
      regChannel?.close();
      unsubMaster?.();
    };
  }, [
    activeSeason.seasonSlug,
    activeSeason.id,
    applyPublishedHeroConfig,
    applyYoutubeLiveConfig,
    refreshRegistrations,
    refreshSeason,
    syncRegistrationEnabledState,
  ]);

  // Derived Standings (pure computation — no network side-effects inside useMemo)
  const standings = useMemo(() => {
    const playoffSettings = normalizePlayoffSettings(state.settings.playoffSettings);
    return calculateStandings(state.teams, state.matches, state.knockout.matches, {
      includeKnockoutInStandings: playoffSettings.includeKnockoutInStandings ?? true,
      tieBreakerOrder: playoffSettings.tieBreakerOrder,
      manualTieBreakOrder: state.knockout.manualTieBreakOrder,
    });
  }, [
    state.teams,
    state.matches,
    state.knockout.matches,
    state.settings.playoffSettings,
    state.knockout.manualTieBreakOrder,
  ]);

  // Debounced persistence of standings strictly when completed match results, knockout results, or teams change
  const completedStandingsSignature = useMemo(() => {
    const playoffSettings = normalizePlayoffSettings(state.settings.playoffSettings);
    const completedGroup = state.matches
      .filter((m) => m.status === 'completed')
      .map(
        (m) =>
          `${m.id}:${m.teamA}-${m.teamB}:${m.winner || ''}:${m.scoreA ?? 0}-${m.scoreB ?? 0}:${JSON.stringify(
            m.sets || []
          )}`
      )
      .join('|');
    const completedKo = state.knockout.matches
      .filter((k) => k.status === 'completed')
      .map(
        (k) =>
          `${k.id}:${k.teamA || ''}-${k.teamB || ''}:${k.winner || ''}:${k.scoreA ?? 0}-${k.scoreB ?? 0}:${JSON.stringify(
            k.sets || []
          )}`
      )
      .join('|');
    return `${state.teams.map((t) => `${t.id}:${t.name}`).join(',')}::${
      playoffSettings.includeKnockoutInStandings ?? true
    }::${playoffSettings.tieBreakerOrder.join(',')}::${(state.knockout.manualTieBreakOrder || []).join(
      ','
    )}::${completedGroup}::${completedKo}`;
  }, [
    state.teams,
    state.matches,
    state.knockout.matches,
    state.settings.playoffSettings,
    state.knockout.manualTieBreakOrder,
  ]);

  useEffect(() => {
    if (!SupabaseService.isAvailable() || stateRef.current.teams.length === 0) return;
    const timer = setTimeout(() => {
      const seasonSlug = activeSeasonRef.current.seasonSlug || stateRef.current.registrationSettings.seasonSlug || 'season-4';
      const seasonId = activeSeasonRef.current.id;
      const playoffSettings = normalizePlayoffSettings(stateRef.current.settings.playoffSettings);
      const currentStandings = calculateStandings(
        stateRef.current.teams,
        stateRef.current.matches,
        stateRef.current.knockout.matches,
        {
          includeKnockoutInStandings: playoffSettings.includeKnockoutInStandings ?? true,
          tieBreakerOrder: playoffSettings.tieBreakerOrder,
          manualTieBreakOrder: stateRef.current.knockout.manualTieBreakOrder,
        }
      );
      SupabaseService.syncStandings(seasonSlug, currentStandings, seasonId).catch(() => {});
    }, 300);
    return () => clearTimeout(timer);
  }, [completedStandingsSignature, activeSeason.seasonSlug, activeSeason.id]);


  // Confetti trigger (lazy-loaded and respects prefers-reduced-motion)
  const triggerCelebration = useCallback(() => {
    sportsAudio.playFanfare();
    if (typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
      return;
    }
    void import('canvas-confetti')
      .then(({ default: confetti }) => {
        const isMobileViewport = typeof window !== 'undefined' && window.innerWidth < 640;
        confetti({
          particleCount: isMobileViewport ? 60 : 120,
          spread: 90,
          origin: { y: 0.6 },
          colors: ['#fbbf24', '#f59e0b', '#3b82f6', '#10b981', '#ffffff'],
          disableForReducedMotion: true,
        });
        setTimeout(() => {
          confetti({
            particleCount: isMobileViewport ? 30 : 60,
            angle: 60,
            spread: 60,
            origin: { x: 0.1, y: 0.7 },
            disableForReducedMotion: true,
          });
        }, 200);
        setTimeout(() => {
          confetti({
            particleCount: isMobileViewport ? 30 : 60,
            angle: 120,
            spread: 60,
            origin: { x: 0.9, y: 0.7 },
            disableForReducedMotion: true,
          });
        }, 400);
      })
      .catch(() => {});
  }, []);

  const getActiveSeasonCtx = useCallback(
    () => ({
      seasonSlug:
        activeSeasonRef.current.seasonSlug ||
        stateRef.current.registrationSettings.seasonSlug ||
        'season-4',
      seasonId: activeSeasonRef.current.id,
      isLocked: Boolean(activeSeasonRef.current.isLocked || activeSeasonRef.current.status === 'archived'),
    }),
    []
  );

  // Settings (Atomic Supabase + Server Persistence & Multi-Device Broadcast)
  const saveAllSettings = async (
    settingsUpdate: Partial<TournamentSettings>,
    paymentUpdate?: Partial<PaymentSettings>
  ): Promise<{ success: boolean; error?: string }> => {
    const { seasonSlug, seasonId, isLocked } = getActiveSeasonCtx();
    if (isLocked) {
      return { success: false, error: 'This season is archived and locked for edits.' };
    }
    const current = stateRef.current;

    const nextSettings: TournamentSettings = {
      ...current.settings,
      ...settingsUpdate,
      scoringRules: settingsUpdate.scoringRules
        ? { ...(current.settings.scoringRules || { pointTarget: 21, setsToWin: 1, deuceEnabled: true, maxPointCap: 30, changeEndsAtInterval: true }), ...settingsUpdate.scoringRules }
        : current.settings.scoringRules,
    };

    const nextPayment: PaymentSettings = paymentUpdate
      ? { ...current.payment, ...paymentUpdate }
      : current.payment;

    // 1. Persist atomically to Supabase PostgreSQL first when configured
    let savedConfigFromDb: RegistrationFormConfig | undefined;
    if (SupabaseService.isAvailable()) {
      const sbRes = await SupabaseService.saveTournamentConfig(
        seasonSlug,
        nextSettings,
        paymentUpdate ? nextPayment : undefined
      );
      if (!sbRes.success) {
        return {
          success: false,
          error: sbRes.error || 'Failed to save tournament settings to Supabase database.',
        };
      }
      savedConfigFromDb = sbRes.config;
      SupabaseService.logAudit(
        'settings_updated',
        'settings',
        seasonSlug,
        {
          settings: settingsUpdate,
          hasPaymentUpdate: Boolean(paymentUpdate),
        },
        undefined,
        seasonId
      ).catch(() => {});
    }

    // 2. Sync to centralized Express backend & SSE broadcast
    let serverError: string | undefined;
    try {
      const res = await fetch(`/api/tournament/state?season=${encodeURIComponent(seasonSlug)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...AuthService.getAuthHeader() },
        body: JSON.stringify({
          seasonSlug,
          settings: nextSettings,
          ...(paymentUpdate ? { payment: nextPayment } : {}),
        }),
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => null);
        serverError = errData?.error || `Server returned status ${res.status}`;
      }
    } catch (err: any) {
      serverError = err?.message || 'Network error saving to backend server';
    }

    // If Supabase isn't configured, backend persistence is mandatory
    if (!SupabaseService.isAvailable() && serverError) {
      return { success: false, error: serverError };
    }

    const now = Date.now();
    lastServerScoreTime.current = now;

    // 3. Update local React state only after confirmed DB persistence
    setState((prev) => ({
      ...prev,
      settings: nextSettings,
      payment: nextPayment,
    }));

    setFormConfig((prev) => {
      if (savedConfigFromDb) return savedConfigFromDb;
      return {
        ...prev,
        tournamentName: nextSettings.name || prev.tournamentName,
        seasonTitle: nextSettings.season ?? prev.seasonTitle,
        venue: nextSettings.venue ?? prev.venue,
        date: nextSettings.date ?? prev.date,
        entryFee: nextSettings.entryFee ?? prev.entryFee,
        maxSlots: nextSettings.slotLimit ?? prev.maxSlots,
        appearance: {
          ...prev.appearance,
          tournamentSettings: nextSettings,
        } as any,
        payment: {
          ...(prev.payment || {}),
          enabled: nextPayment.enabled ?? prev.payment?.enabled ?? true,
          isMandatory: nextPayment.isMandatory ?? prev.payment?.isMandatory ?? true,
          baseFee: nextSettings.entryFee ?? prev.payment?.baseFee ?? 500,
          upiId: nextPayment.upiId ?? prev.payment?.upiId ?? 'karan-hdfc@ybl',
          accountName: nextPayment.accountName ?? prev.payment?.accountName ?? 'Smash Premier League (Karan Gaur)',
          note: nextPayment.note ?? prev.payment?.note ?? 'SPL Tournament Entry Fee',
        },
      };
    });

    // 4. Broadcast instantaneously to other tabs on this browser
    if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
      try {
        const ch = new BroadcastChannel('spl_live_scores_channel');
        ch.postMessage({
          type: 'SETTINGS_UPDATED',
          seasonSlug,
          settings: nextSettings,
          payment: nextPayment,
          lastUpdated: now,
        });
        ch.close();
      } catch {}
    }

    return { success: true };
  };

  const updateSettings = (settingsUpdate: Partial<TournamentSettings>) => {
    return saveAllSettings(settingsUpdate, undefined);
  };

  const updatePaymentSettings = (paymentUpdate: Partial<PaymentSettings>) => {
    return saveAllSettings({}, paymentUpdate);
  };

  const updateRegistrationSettings = (settingsUpdate: Partial<RegistrationSettings>) => {
    const { seasonSlug, isLocked } = getActiveSeasonCtx();
    if (isLocked) return;
    if (typeof settingsUpdate.enabled === 'boolean') {
      regToggleGuardRef.current = {
        seq: regToggleGuardRef.current.seq + 1,
        enabled: settingsUpdate.enabled,
        updatedAt: Date.now(),
      };
      setFormConfig((prev) => ({
        ...prev,
        enabled: settingsUpdate.enabled as boolean,
        ...(settingsUpdate.closedNotice !== undefined ? { closedNotice: settingsUpdate.closedNotice } : {}),
      }));
    }
    setState((prev) => {
      const nextSettings = {
        ...prev.registrationSettings,
        ...settingsUpdate,
        seasonSlug,
        fields: {
          ...prev.registrationSettings.fields,
          ...(settingsUpdate.fields || {}),
        },
      };

      // Asynchronously sync with backend
      fetch(`/api/registration-settings?season=${encodeURIComponent(seasonSlug)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...AuthService.getAuthHeader() },
        body: JSON.stringify(nextSettings),
      }).catch(() => {});

      return {
        ...prev,
        registrationSettings: nextSettings,
      };
    });
  };

  // Players
  const addPlayer = (name: string, details?: Partial<Player>): Player => {
    const { seasonSlug, seasonId, isLocked } = getActiveSeasonCtx();
    const newPlayer: Player = {
      id: crypto.randomUUID(),
      name: name.trim(),
      mobile: details?.mobile,
      age: details?.age,
      gender: details?.gender || 'M',
      skillLevel: details?.skillLevel || 'Advanced',
      city: details?.city,
      category: details?.category,
      style: details?.style,
      registrationStatus: details?.registrationStatus || 'direct',
      registrationId: details?.registrationId,
      photoUrl: details?.photoUrl,
      seasonId,
      seasonSlug,
    };
    if (isLocked) return newPlayer;

    if (SupabaseService.isAvailable()) {
      SupabaseService.upsertPlayer(newPlayer, seasonSlug, seasonId).catch(() => {});
      SupabaseService.logAudit('player_created', 'player', newPlayer.id, { name: newPlayer.name, seasonSlug }, undefined, seasonId).catch(() => {});
    }

    setState((prev) => {
      const updatedPlayers = [...prev.players, newPlayer];
      fetch(`/api/tournament/state?season=${encodeURIComponent(seasonSlug)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...AuthService.getAuthHeader() },
        body: JSON.stringify({ seasonSlug, players: updatedPlayers }),
      }).catch(() => {});
      return {
        ...prev,
        players: updatedPlayers,
      };
    });
    return newPlayer;
  };

  const bulkAddPlayers = (names: string[]) => {
    const { seasonSlug, seasonId, isLocked } = getActiveSeasonCtx();
    if (isLocked) return;
    const newOnes: Player[] = names
      .map((n) => n.trim())
      .filter(Boolean)
      .map((name) => ({
        id: crypto.randomUUID(),
        name,
        gender: 'M',
        skillLevel: 'Advanced',
        registrationStatus: 'direct' as const,
        seasonId,
        seasonSlug,
      }));
    if (newOnes.length === 0) return;

    if (SupabaseService.isAvailable()) {
      SupabaseService.upsertPlayersBulk(newOnes, seasonSlug, seasonId).catch(() => {});
      SupabaseService.logAudit('players_bulk_created', 'player', undefined, { count: newOnes.length, seasonSlug }, undefined, seasonId).catch(() => {});
    }

    setState((prev) => {
      const updatedPlayers = [...prev.players, ...newOnes];
      fetch(`/api/tournament/state?season=${encodeURIComponent(seasonSlug)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...AuthService.getAuthHeader() },
        body: JSON.stringify({ seasonSlug, players: updatedPlayers }),
      }).catch(() => {});
      return {
        ...prev,
        players: updatedPlayers,
      };
    });
  };

  const updatePlayer = (id: string, updates: Partial<Player>) => {
    const { seasonSlug, seasonId, isLocked } = getActiveSeasonCtx();
    if (isLocked) return;
    setState((prev) => {
      const target = prev.players.find((p) => p.id === id);
      if (target && SupabaseService.isAvailable()) {
        SupabaseService.upsertPlayer({ ...target, ...updates }, seasonSlug, seasonId).catch(() => {});
        SupabaseService.logAudit('player_updated', 'player', id, updates, undefined, seasonId).catch(() => {});
      }

      const updatedPlayers = prev.players.map((p) => (p.id === id ? { ...p, ...updates } : p));
      fetch(`/api/tournament/state?season=${encodeURIComponent(seasonSlug)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...AuthService.getAuthHeader() },
        body: JSON.stringify({ seasonSlug, players: updatedPlayers }),
      }).catch(() => {});

      return {
        ...prev,
        players: updatedPlayers,
        registrations: prev.registrations.map((r) =>
          r.playerId === id && updates.name ? { ...r, name: updates.name } : r
        ),
      };
    });
  };

  const deletePlayer = (id: string) => {
    const { seasonSlug, seasonId, isLocked } = getActiveSeasonCtx();
    if (isLocked) return;
    if (SupabaseService.isAvailable()) {
      SupabaseService.deletePlayer(id, seasonSlug, seasonId).catch(() => {});
      SupabaseService.logAudit('player_deleted', 'player', id, { seasonSlug }, undefined, seasonId).catch(() => {});
    }

    setState((prev) => {
      const updatedPlayers = prev.players.filter((p) => p.id !== id);
      const updatedTeams = prev.teams.map((t) => ({
        ...t,
        players: t.players.filter((pid) => pid !== id),
        captainId: t.captainId === id ? undefined : t.captainId,
      }));

      fetch(`/api/tournament/state?season=${encodeURIComponent(seasonSlug)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...AuthService.getAuthHeader() },
        body: JSON.stringify({ seasonSlug, players: updatedPlayers, teams: updatedTeams }),
      }).catch(() => {});

      return {
        ...prev,
        players: updatedPlayers,
        registrations: prev.registrations.filter((r) => r.playerId !== id),
        teams: updatedTeams,
        predefinedTeams: prev.predefinedTeams.filter((pt) => !pt.players.includes(id as any)),
      };
    });
  };

  const deletePlayersBulk = (playerIds: string[]) => {
    const { seasonSlug, seasonId, isLocked } = getActiveSeasonCtx();
    if (isLocked || !playerIds || playerIds.length === 0) return;
    const idSet = new Set(playerIds);

    if (SupabaseService.isAvailable()) {
      SupabaseService.deletePlayersBulk(playerIds, seasonSlug, seasonId).catch(() => {});
      SupabaseService.logAudit('players_bulk_deleted', 'player', undefined, { count: playerIds.length, seasonSlug }, undefined, seasonId).catch(() => {});
    }

    setState((prev) => {
      const updatedPlayers = prev.players.filter((p) => !idSet.has(p.id));
      const updatedTeams = prev.teams.map((t) => ({
        ...t,
        players: t.players.filter((pid) => !idSet.has(pid)),
        captainId: idSet.has(t.captainId || '') ? undefined : t.captainId,
      }));

      fetch(`/api/tournament/state?season=${encodeURIComponent(seasonSlug)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...AuthService.getAuthHeader() },
        body: JSON.stringify({ seasonSlug, players: updatedPlayers, teams: updatedTeams }),
      }).catch(() => {});

      return {
        ...prev,
        players: updatedPlayers,
        registrations: prev.registrations.filter((r) => !idSet.has(r.playerId || '')),
        teams: updatedTeams,
        predefinedTeams: prev.predefinedTeams.filter((pt) => !pt.players.some((pid) => idSet.has(pid))),
      };
    });
  };

  const clearPlayers = () => {
    const { seasonSlug, seasonId, isLocked } = getActiveSeasonCtx();
    if (isLocked) return;
    if (SupabaseService.isAvailable()) {
      SupabaseService.clearPlayers(seasonSlug, seasonId).catch(() => {});
      SupabaseService.logAudit('players_cleared', 'player', undefined, { seasonSlug }, undefined, seasonId).catch(() => {});
    }
    setState((prev) => {
      fetch(`/api/tournament/state?season=${encodeURIComponent(seasonSlug)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...AuthService.getAuthHeader() },
        body: JSON.stringify({ seasonSlug, players: [], teams: [], matches: [] }),
      }).catch(() => {});
      return {
        ...prev,
        players: [],
        registrations: [],
        teams: [],
        predefinedTeams: [],
        matches: [],
        knockout: { ...prev.knockout, matches: [] },
      };
    });
  };

  // Teams
  const addTeam = (
    name: string,
    playerIds: string[] = [],
    captainId?: string,
    badge = '🏸'
  ): Team => {
    const { seasonSlug, seasonId, isLocked } = getActiveSeasonCtx();
    lastLocalTeamMutationTime.current = Date.now();
    lastServerScoreTime.current = Date.now();
    const newTeam: Team = {
      id: crypto.randomUUID(),
      name: name.trim(),
      players: playerIds,
      captainId: captainId || playerIds[0],
      locked: false,
      avatarColor: 'from-amber-500 to-orange-600',
      badge: badge || '🏸',
      seasonId,
      seasonSlug,
    };
    if (isLocked) return newTeam;

    if (SupabaseService.isAvailable()) {
      SupabaseService.saveTeam(newTeam, seasonSlug, seasonId)
        .then(() => {
          lastLocalTeamMutationTime.current = Date.now();
          lastServerScoreTime.current = Date.now();
        })
        .catch(() => {});
      SupabaseService.logAudit('team_created', 'team', newTeam.id, {
        name: newTeam.name,
        badge: newTeam.badge,
        seasonSlug,
      }, undefined, seasonId).catch(() => {});
    }

    setState((prev) => {
      const nextTeams = [...prev.teams, newTeam];
      fetch(`/api/tournament/state?season=${encodeURIComponent(seasonSlug)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...AuthService.getAuthHeader() },
        body: JSON.stringify({ seasonSlug, teams: nextTeams }),
      }).catch(() => {});
      return {
        ...prev,
        teams: nextTeams,
      };
    });
    return newTeam;
  };

  const updateTeam = async (id: string, updates: Partial<Team>): Promise<boolean> => {
    const { seasonSlug, seasonId, isLocked } = getActiveSeasonCtx();
    if (!id || isLocked) return false;
    lastLocalTeamMutationTime.current = Date.now();
    lastServerScoreTime.current = Date.now();

    let updatedTarget: Team | undefined;
    setState((prev) => {
      const updatedTeams = prev.teams.map((t) => {
        if (t.id !== id) return t;
        updatedTarget = {
          ...t,
          ...updates,
          id,
          seasonId: t.seasonId || seasonId,
          seasonSlug: t.seasonSlug || seasonSlug,
          name: updates.name !== undefined ? updates.name.trim() || t.name : t.name,
          badge: updates.badge !== undefined ? updates.badge || '🏸' : t.badge || '🏸',
        };
        return updatedTarget;
      });
      return {
        ...prev,
        teams: updatedTeams,
      };
    });

    // Broadcast immediate per-team update to any open tabs (Public Homepage, Match Center, Umpire Mode)
    if (updatedTarget && typeof window !== 'undefined' && 'BroadcastChannel' in window) {
      try {
        const ch = new BroadcastChannel('spl_live_scores_channel');
        ch.postMessage({
          type: 'TEAM_UPDATED',
          seasonSlug,
          teamId: id,
          team: updatedTarget,
          lastUpdated: Date.now(),
        });
        ch.close();
      } catch {}
    }

    const promises: Promise<boolean>[] = [];
    if (SupabaseService.isAvailable()) {
      promises.push(
        SupabaseService.updateTeamMetadata(id, updates, updatedTarget).catch(() => false)
      );
    }

    promises.push(
      fetch(`/api/tournament/teams/${encodeURIComponent(id)}?season=${encodeURIComponent(seasonSlug)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', ...AuthService.getAuthHeader() },
        body: JSON.stringify({ ...updates, seasonSlug, fullTeam: updatedTarget }),
      })
        .then((res) => res.ok)
        .catch(() => false)
    );

    const results = await Promise.all(promises);
    lastLocalTeamMutationTime.current = Date.now();
    lastServerScoreTime.current = Date.now();
    return results.some(Boolean);
  };

  const deleteTeam = (id: string) => {
    const { seasonSlug, seasonId, isLocked } = getActiveSeasonCtx();
    if (isLocked) return;
    lastLocalTeamMutationTime.current = Date.now();
    lastServerScoreTime.current = Date.now();
    if (SupabaseService.isAvailable()) {
      SupabaseService.deleteTeam(id, seasonSlug).catch(() => {});
      SupabaseService.logAudit('team_deleted', 'team', id, { seasonSlug }, undefined, seasonId).catch(() => {});
    }

    setState((prev) => {
      const nextTeams = prev.teams.filter((t) => t.id !== id);
      fetch(`/api/tournament/state?season=${encodeURIComponent(seasonSlug)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...AuthService.getAuthHeader() },
        body: JSON.stringify({ seasonSlug, teams: nextTeams }),
      }).catch(() => {});

      return {
        ...prev,
        teams: nextTeams,
        matches: prev.matches.filter((m) => m.teamA !== id && m.teamB !== id),
        knockout: {
          ...prev.knockout,
          matches: prev.knockout.matches.filter((m) => m.teamA !== id && m.teamB !== id),
        },
      };
    });
  };

  const deleteTeamsBulk = (teamIds: string[]) => {
    const { seasonSlug, seasonId, isLocked } = getActiveSeasonCtx();
    if (isLocked || !teamIds || teamIds.length === 0) return;
    lastLocalTeamMutationTime.current = Date.now();
    lastServerScoreTime.current = Date.now();
    const idSet = new Set(teamIds);

    if (SupabaseService.isAvailable()) {
      SupabaseService.deleteTeamsBulk(teamIds, seasonSlug).catch(() => {});
      SupabaseService.logAudit('teams_bulk_deleted', 'team', undefined, { count: teamIds.length, seasonSlug }, undefined, seasonId).catch(() => {});
    }

    setState((prev) => {
      const nextTeams = prev.teams.filter((t) => !idSet.has(t.id));
      fetch(`/api/tournament/state?season=${encodeURIComponent(seasonSlug)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...AuthService.getAuthHeader() },
        body: JSON.stringify({ seasonSlug, teams: nextTeams }),
      }).catch(() => {});

      return {
        ...prev,
        teams: nextTeams,
        matches: prev.matches.filter((m) => !idSet.has(m.teamA) && !idSet.has(m.teamB)),
        knockout: {
          ...prev.knockout,
          matches: prev.knockout.matches.filter(
            (m) => !idSet.has(m.teamA || '') && !idSet.has(m.teamB || '')
          ),
        },
      };
    });
  };

  const renameTeam = (id: string, newName: string) => {
    void updateTeam(id, { name: newName.trim() });
  };

  const toggleTeamLock = (id: string) => {
    const target = state.teams.find((t) => t.id === id);
    if (!target) return;
    void updateTeam(id, { locked: !target.locked });
  };

  const togglePlayerLockInTeam = (teamId: string, playerId: string) => {
    const target = state.teams.find((t) => t.id === teamId);
    if (!target) return;
    const currentLocked = Array.isArray(target.lockedPlayerIds) ? target.lockedPlayerIds : [];
    const isLocked = currentLocked.includes(playerId);
    const nextLocked = isLocked
      ? currentLocked.filter((id) => id !== playerId)
      : [...currentLocked, playerId];
    void updateTeam(teamId, { lockedPlayerIds: nextLocked });
  };

  const setTeamCaptain = (teamId: string, captainId: string) => {
    const { seasonSlug, seasonId, isLocked } = getActiveSeasonCtx();
    if (isLocked) return;
    lastLocalTeamMutationTime.current = Date.now();
    lastServerScoreTime.current = Date.now();
    setState((prev) => {
      const nextTeams = prev.teams.map((t) => {
        if (t.id !== teamId) return t;
        const updatedPlayers =
          captainId && !t.players.includes(captainId) ? [captainId, ...t.players] : t.players;
        const updatedTeam = { ...t, captainId, players: updatedPlayers, seasonId, seasonSlug };
        if (SupabaseService.isAvailable()) {
          SupabaseService.saveTeam(updatedTeam, seasonSlug, seasonId).catch(() => {});
        }
        return updatedTeam;
      });

      fetch(`/api/tournament/captains?season=${encodeURIComponent(seasonSlug)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...AuthService.getAuthHeader() },
        body: JSON.stringify({ seasonSlug, assignments: [{ teamId, captainId }] }),
      }).catch(() => {});

      return { ...prev, teams: nextTeams };
    });
  };

  const setCaptainsBulk = (assignments: { teamId: string; captainId: string }[]) => {
    const { seasonSlug, seasonId, isLocked } = getActiveSeasonCtx();
    if (isLocked || !assignments || assignments.length === 0) return;
    const map = new Map(assignments.map((a) => [a.teamId, a.captainId]));
    lastLocalTeamMutationTime.current = Date.now();
    lastServerScoreTime.current = Date.now();
    setState((prev) => {
      const nextTeams = prev.teams.map((t) => {
        if (map.has(t.id)) {
          const newCap = map.get(t.id);
          const updatedPlayers =
            newCap && !t.players.includes(newCap) ? [newCap, ...t.players] : t.players;
          const updatedTeam = { ...t, captainId: newCap, players: updatedPlayers, seasonId, seasonSlug };
          if (SupabaseService.isAvailable()) {
            SupabaseService.saveTeam(updatedTeam, seasonSlug, seasonId).catch(() => {});
          }
          return updatedTeam;
        }
        return t;
      });

      fetch(`/api/tournament/captains?season=${encodeURIComponent(seasonSlug)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...AuthService.getAuthHeader() },
        body: JSON.stringify({ seasonSlug, assignments }),
      }).catch(() => {});

      return { ...prev, teams: nextTeams };
    });
  };

  const setTeamPlayer = (teamId: string, playerIndex: number, newPlayerId: string) => {
    const { seasonSlug, seasonId, isLocked } = getActiveSeasonCtx();
    if (isLocked) return;
    lastLocalTeamMutationTime.current = Date.now();
    lastServerScoreTime.current = Date.now();
    setState((prev) => {
      const teams = prev.teams.map((t) => ({ ...t, players: [...t.players] }));
      const currentTeam = teams.find((t) => t.id === teamId);
      if (!currentTeam) return prev;

      const oldPlayerId = currentTeam.players[playerIndex];
      if (oldPlayerId === newPlayerId) return prev;

      // Swap if already in another team
      for (const t of teams) {
        const foundIdx = t.players.indexOf(newPlayerId);
        if (foundIdx !== -1 && !(t.id === teamId && foundIdx === playerIndex)) {
          t.players[foundIdx] = oldPlayerId;
          break;
        }
      }

      currentTeam.players[playerIndex] = newPlayerId;
      if (SupabaseService.isAvailable()) {
        SupabaseService.saveTeamsBulk(teams, seasonSlug, seasonId).catch(() => {});
      }

      fetch(`/api/tournament/state?season=${encodeURIComponent(seasonSlug)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...AuthService.getAuthHeader() },
        body: JSON.stringify({ seasonSlug, teams }),
      }).catch(() => {});
      return { ...prev, teams };
    });
  };

  // Direct Player to Team Assignment
  const assignPlayerToTeam = (teamId: string, playerId: string) => {
    const { seasonSlug, seasonId, isLocked } = getActiveSeasonCtx();
    if (isLocked) return;
    lastLocalTeamMutationTime.current = Date.now();
    lastServerScoreTime.current = Date.now();
    setState((prev) => {
      const nextTeams = prev.teams.map((t) => {
        if (t.id === teamId) {
          if (t.players.includes(playerId)) return t;
          return { ...t, players: [...t.players, playerId] };
        }
        return {
          ...t,
          players: t.players.filter((pid) => pid !== playerId),
          captainId: t.captainId === playerId ? undefined : t.captainId,
        };
      });

      if (SupabaseService.isAvailable()) {
        SupabaseService.saveTeamsBulk(nextTeams, seasonSlug, seasonId).catch(() => {});
      }
      fetch(`/api/tournament/state?season=${encodeURIComponent(seasonSlug)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...AuthService.getAuthHeader() },
        body: JSON.stringify({ seasonSlug, teams: nextTeams }),
      }).catch(() => {});

      return { ...prev, teams: nextTeams };
    });
  };

  // Direct Player Removal from Team
  const removePlayerFromTeam = (teamId: string, playerId: string) => {
    const { seasonSlug, seasonId, isLocked } = getActiveSeasonCtx();
    if (isLocked) return;
    lastLocalTeamMutationTime.current = Date.now();
    lastServerScoreTime.current = Date.now();
    setState((prev) => {
      const nextTeams = prev.teams.map((t) => {
        if (t.id !== teamId) return t;
        return {
          ...t,
          players: t.players.filter((pid) => pid !== playerId),
          captainId: t.captainId === playerId ? undefined : t.captainId,
        };
      });

      if (SupabaseService.isAvailable()) {
        SupabaseService.saveTeamsBulk(nextTeams, seasonSlug, seasonId).catch(() => {});
      }
      fetch(`/api/tournament/state?season=${encodeURIComponent(seasonSlug)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...AuthService.getAuthHeader() },
        body: JSON.stringify({ seasonSlug, teams: nextTeams }),
      }).catch(() => {});

      return { ...prev, teams: nextTeams };
    });
  };

  const saveManualTeamEdit = async (
    input: ManualTeamEditInput
  ): Promise<{
    success: boolean;
    conflict?: boolean;
    error?: string;
    code?: string;
    preview?: ManualTeamEditPreviewResult;
  }> => {
    const { seasonSlug, seasonId, isLocked } = getActiveSeasonCtx();
    if (isLocked) {
      return { success: false, error: 'This season is archived and locked for edits.' };
    }
    const current = stateRef.current;
    const preview = computeManualTeamEdit(input, {
      teams: current.teams,
      players: current.players,
      predefinedTeams: current.predefinedTeams,
      teamFormationMode: current.teamFormationMode,
      matches: current.matches,
      knockoutMatches: current.knockout?.matches || [],
    });

    if (!preview.valid) {
      return {
        success: false,
        error: preview.error || 'Team validation failed.',
        code: preview.code,
        preview,
      };
    }

    if (!preview.hasChanges) {
      return {
        success: true,
        preview,
      };
    }

    const affectedTeams: Team[] = [];
    if (preview.primaryTeamAfter) {
      affectedTeams.push({ ...preview.primaryTeamAfter, seasonId, seasonSlug });
    }
    for (const ct of preview.counterpartTeamsAfter) {
      affectedTeams.push({ ...ct, seasonId, seasonSlug });
    }

    const baselineRostersByTeamId: Record<string, string[]> = {};
    if (preview.primaryTeamBefore) {
      baselineRostersByTeamId[preview.primaryTeamBefore.id] = [
        ...preview.primaryTeamBefore.players,
      ];
    }
    for (const ctBefore of preview.counterpartTeamsBefore) {
      baselineRostersByTeamId[ctBefore.id] = [...ctBefore.players];
    }

    lastLocalTeamMutationTime.current = Date.now();
    lastServerScoreTime.current = Date.now();

    if (SupabaseService.isAvailable()) {
      const dbRes = await SupabaseService.saveManualTeamRosterEdit({
        affectedTeams,
        baselineRostersByTeamId,
        seasonSlug,
        seasonId,
        auditDetails: {
          mode: current.teamFormationMode,
          primaryTeamId: input.primaryTeamId,
          primaryTeamName: preview.primaryTeamAfter?.name,
          isSwap: preview.isSwap,
          swaps: preview.swaps,
          replacements: preview.replacements,
          lockAction: input.lockAction || 'keep',
          seasonSlug,
        },
      });

      if (dbRes.conflict) {
        const latestTeams = await SupabaseService.fetchTeams(seasonSlug, seasonId);
        if (latestTeams && latestTeams.length > 0) {
          setState((prev) => ({ ...prev, teams: latestTeams }));
        }
        return {
          success: false,
          conflict: true,
          error:
            dbRes.error ||
            'Concurrent edit detected: Another admin modified one of these teams. Latest rosters have been loaded.',
          preview,
        };
      }

      if (!dbRes.success) {
        return {
          success: false,
          error: dbRes.error || 'Failed to save team changes to Supabase database.',
          preview,
        };
      }

      SupabaseService.saveTeamFormationConfig(
        seasonSlug,
        current.teamFormationMode,
        preview.nextPredefinedTeams,
        seasonId
      ).catch(() => {});
    }

    // Apply verified state update locally
    setState((prev) => ({
      ...prev,
      teams: preview.nextTeams,
      predefinedTeams: preview.nextPredefinedTeams,
    }));

    // Broadcast immediate per-team updates across tabs (Public Homepage, Match Center, Umpire Mode, YouTube Live)
    if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
      try {
        const ch = new BroadcastChannel('spl_live_scores_channel');
        for (const updatedTeam of affectedTeams) {
          ch.postMessage({
            type: 'TEAM_UPDATED',
            seasonSlug,
            teamId: updatedTeam.id,
            team: updatedTeam,
            lastUpdated: Date.now(),
          });
        }
        ch.close();
      } catch {}
    }

    // Sync to local Express state backup
    try {
      await fetch(`/api/tournament/state?season=${encodeURIComponent(seasonSlug)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...AuthService.getAuthHeader() },
        body: JSON.stringify({
          seasonSlug,
          teams: preview.nextTeams,
          predefinedTeams: preview.nextPredefinedTeams,
        }),
      });
    } catch {}

    lastLocalTeamMutationTime.current = Date.now();
    lastServerScoreTime.current = Date.now();

    return {
      success: true,
      preview,
    };
  };

  const setTeams = async (teams: Team[]): Promise<boolean> => {
    const { seasonSlug, seasonId, isLocked } = getActiveSeasonCtx();
    if (isLocked) return false;
    lastLocalTeamMutationTime.current = Date.now();
    lastServerScoreTime.current = Date.now();
    const uniqueMap = new Map<string, Team>();
    for (const t of teams) {
      if (t && t.id && !uniqueMap.has(t.id)) {
        uniqueMap.set(t.id, { ...t, seasonId: t.seasonId || seasonId, seasonSlug: t.seasonSlug || seasonSlug });
      }
    }
    const uniqueTeams = Array.from(uniqueMap.values());

    setState((prev) => ({ ...prev, teams: uniqueTeams }));

    try {
      const promises: Promise<boolean>[] = [];
      if (SupabaseService.isAvailable()) {
        promises.push(SupabaseService.saveTeamsBulk(uniqueTeams, seasonSlug, seasonId).catch(() => false));
      }
      promises.push(
        fetch(`/api/tournament/state?season=${encodeURIComponent(seasonSlug)}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...AuthService.getAuthHeader() },
          body: JSON.stringify({ seasonSlug, teams: uniqueTeams }),
        })
          .then((res) => res.ok)
          .catch(() => false)
      );

      const results = await Promise.all(promises);
      lastLocalTeamMutationTime.current = Date.now();
      lastServerScoreTime.current = Date.now();
      return results.some(Boolean);
    } catch {
      return false;
    }
  };

  const clearTeams = () => {
    const { seasonSlug, seasonId, isLocked } = getActiveSeasonCtx();
    if (isLocked) return;
    lastLocalTeamMutationTime.current = Date.now();
    lastServerScoreTime.current = Date.now();
    if (SupabaseService.isAvailable()) {
      SupabaseService.clearTeams(seasonSlug, seasonId).catch(() => {});
      SupabaseService.logAudit('teams_cleared', 'team', undefined, { seasonSlug }, undefined, seasonId).catch(() => {});
    }
    setState((prev) => {
      fetch(`/api/tournament/state?season=${encodeURIComponent(seasonSlug)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...AuthService.getAuthHeader() },
        body: JSON.stringify({ seasonSlug, teams: [] }),
      }).catch(() => {});
      return { ...prev, teams: [] };
    });
  };

  // Pre-decided teams
  const setTeamFormationMode = (mode: 'random' | 'predefined' | 'mixed') => {
    const { seasonSlug, seasonId, isLocked } = getActiveSeasonCtx();
    if (isLocked) return;
    setState((prev) => {
      if (SupabaseService.isAvailable()) {
        SupabaseService.saveTeamFormationConfig(seasonSlug, mode, prev.predefinedTeams, seasonId).catch(() => {});
      }
      fetch(`/api/tournament/state?season=${encodeURIComponent(seasonSlug)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...AuthService.getAuthHeader() },
        body: JSON.stringify({ seasonSlug, teamFormationMode: mode }),
      }).catch(() => {});
      return { ...prev, teamFormationMode: mode };
    });
  };

  const addPredefinedTeam = (name: string, p1: string, p2: string) => {
    const { seasonSlug, seasonId, isLocked } = getActiveSeasonCtx();
    if (isLocked) return;
    setState((prev) => {
      const updated = [
        ...prev.predefinedTeams,
        {
          id: crypto.randomUUID(),
          name: name.trim() || `Pair ${prev.predefinedTeams.length + 1}`,
          players: [p1, p2] as [string, string],
        },
      ];
      if (SupabaseService.isAvailable()) {
        SupabaseService.saveTeamFormationConfig(seasonSlug, prev.teamFormationMode, updated, seasonId).catch(() => {});
      }
      fetch(`/api/tournament/state?season=${encodeURIComponent(seasonSlug)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...AuthService.getAuthHeader() },
        body: JSON.stringify({ seasonSlug, predefinedTeams: updated }),
      }).catch(() => {});
      return {
        ...prev,
        predefinedTeams: updated,
      };
    });
  };

  const updatePredefinedTeam = (id: string, updates: Partial<PredefinedTeam>) => {
    const { seasonSlug, seasonId, isLocked } = getActiveSeasonCtx();
    if (isLocked) return;
    setState((prev) => {
      const updated = prev.predefinedTeams.map((pt) => (pt.id === id ? { ...pt, ...updates } : pt));
      if (SupabaseService.isAvailable()) {
        SupabaseService.saveTeamFormationConfig(seasonSlug, prev.teamFormationMode, updated, seasonId).catch(() => {});
      }
      fetch(`/api/tournament/state?season=${encodeURIComponent(seasonSlug)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...AuthService.getAuthHeader() },
        body: JSON.stringify({ seasonSlug, predefinedTeams: updated }),
      }).catch(() => {});
      return {
        ...prev,
        predefinedTeams: updated,
      };
    });
  };

  const deletePredefinedTeam = (id: string) => {
    const { seasonSlug, seasonId, isLocked } = getActiveSeasonCtx();
    if (isLocked) return;
    setState((prev) => {
      const updated = prev.predefinedTeams.filter((pt) => pt.id !== id);
      if (SupabaseService.isAvailable()) {
        SupabaseService.saveTeamFormationConfig(seasonSlug, prev.teamFormationMode, updated, seasonId).catch(() => {});
      }
      fetch(`/api/tournament/state?season=${encodeURIComponent(seasonSlug)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...AuthService.getAuthHeader() },
        body: JSON.stringify({ seasonSlug, predefinedTeams: updated }),
      }).catch(() => {});
      return {
        ...prev,
        predefinedTeams: updated,
      };
    });
  };

  const clearPredefinedTeams = () => {
    const { seasonSlug, seasonId, isLocked } = getActiveSeasonCtx();
    if (isLocked) return;
    setState((prev) => {
      if (SupabaseService.isAvailable()) {
        SupabaseService.saveTeamFormationConfig(seasonSlug, prev.teamFormationMode, [], seasonId).catch(() => {});
      }
      fetch(`/api/tournament/state?season=${encodeURIComponent(seasonSlug)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...AuthService.getAuthHeader() },
        body: JSON.stringify({ seasonSlug, predefinedTeams: [] }),
      }).catch(() => {});
      return { ...prev, predefinedTeams: [] };
    });
  };

  // Matches (clean optimistic update + serialized Supabase persistence — no side effects in setState)
  const updateMatch = (id: string, updates: Partial<Match>) => {
    const { seasonSlug, seasonId, isLocked } = getActiveSeasonCtx();
    if (isLocked) return;
    sportsAudio.playScorePing();
    const now = Date.now();
    const currentState = stateRef.current;
    lastServerScoreTime.current = now;

    let updatedMatchObj: Match | undefined;
    const nextMatches = currentState.matches.map((m) => {
      if (m.id !== id) return m;
      const resolvedCourt = updates.court ?? m.court ?? 1;
      const resolvedCourtName =
        updates.courtName ??
        (updates.court != null
          ? currentState.settings.courtNames?.[resolvedCourt - 1]?.trim() || `Court ${resolvedCourt}`
          : m.courtName || currentState.settings.courtNames?.[resolvedCourt - 1]?.trim() || `Court ${resolvedCourt}`);

      const updated: Match = {
        ...m,
        ...updates,
        court: resolvedCourt,
        courtName: resolvedCourtName,
        seasonId: m.seasonId || seasonId,
        seasonSlug: m.seasonSlug || seasonSlug,
      };
      if (updates.status !== undefined && updates.status !== 'completed' && !('winner' in updates)) {
        updated.winner = undefined;
      } else if (updated.status === 'completed') {
        if (
          ('scoreA' in updates || 'scoreB' in updates) &&
          !('sets' in updates) &&
          (!updated.sets || updated.sets.length <= 1) &&
          updated.scoreA != null &&
          updated.scoreB != null
        ) {
          updated.sets = [{ scoreA: updated.scoreA, scoreB: updated.scoreB }];
        }
        if ('winner' in updates && (updates.winner === updated.teamA || updates.winner === updated.teamB)) {
          updated.winner = updates.winner;
        } else if (
          updated.scoreA != null &&
          updated.scoreB != null &&
          updated.scoreA !== updated.scoreB &&
          (!updated.sets || updated.sets.length <= 1)
        ) {
          updated.winner = updated.scoreA > updated.scoreB ? updated.teamA : updated.teamB;
        } else {
          const stats = extractCompletedMatchStats({
            ...updated,
            winner: 'winner' in updates ? updates.winner : updated.winner,
          });
          if (stats) updated.winner = stats.winnerId;
        }
      }
      updatedMatchObj = updated;
      return updated;
    });

    if (updatedMatchObj) {
      localMatchGuardRef.current.set(id, {
        updatedAt: now,
        scoreA: updatedMatchObj.scoreA,
        scoreB: updatedMatchObj.scoreB,
        status: updatedMatchObj.status,
        court: updatedMatchObj.court,
      });

      const syncedToSupabase = SupabaseService.isAvailable();

      // 1. Sync to Supabase PostgreSQL Realtime database (serialized per match)
      if (syncedToSupabase) {
        SupabaseService.updateMatchScore(id, updatedMatchObj, false, seasonSlug, seasonId).catch(() => {});
      }

      // 2. Dispatch score update to server for Express SSE / fallback sync
      fetch(`/api/tournament/matches/${encodeURIComponent(id)}?season=${encodeURIComponent(seasonSlug)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', ...AuthService.getAuthHeader() },
        body: JSON.stringify({
          ...updates,
          seasonSlug,
          scoreA: updatedMatchObj.scoreA ?? null,
          scoreB: updatedMatchObj.scoreB ?? null,
          winner: updatedMatchObj.winner ?? null,
          sets: updatedMatchObj.sets ?? [],
          courtName: updatedMatchObj.courtName,
          fullMatch: updatedMatchObj,
          syncedToSupabase,
        }),
      }).catch(() => {});

      // 3. Multi-Tab BroadcastChannel
      if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
        try {
          const ch = new BroadcastChannel('spl_live_scores_channel');
          ch.postMessage({
            type: 'SCORE_UPDATE',
            seasonSlug,
            matchId: id,
            match: updatedMatchObj,
            matches: nextMatches,
            teams: currentState.teams,
            knockout: currentState.knockout,
            lastUpdated: now,
          });
          ch.close();
        } catch {}
      }
    }

    setState((prev) => ({
      ...prev,
      matches: nextMatches,
    }));
  };

  const setMatches = (matches: Match[]) => {
    const { seasonSlug, seasonId, isLocked } = getActiveSeasonCtx();
    if (isLocked) return;
    lastServerScoreTime.current = Date.now();
    setState((prev) => {
      if (SupabaseService.isAvailable()) {
        SupabaseService.batchSaveMatches(matches, seasonSlug, seasonId).catch(() => {});
      }
      fetch(`/api/tournament/state?season=${encodeURIComponent(seasonSlug)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...AuthService.getAuthHeader() },
        body: JSON.stringify({ seasonSlug, matches }),
      }).catch(() => {});
      return { ...prev, matches };
    });
  };

  const saveEditedSchedule = async (
    draftMatches: Match[]
  ): Promise<{
    success: boolean;
    conflict?: boolean;
    error?: string;
    report?: ScheduleValidationReport;
  }> => {
    const { seasonSlug, seasonId, isLocked } = getActiveSeasonCtx();
    if (isLocked) {
      return { success: false, error: 'This season is archived and locked for edits.' };
    }
    const current = stateRef.current;
    const normalizedDraft = normalizeScheduleSequence(
      draftMatches,
      current.settings.courtNames
    );

    const report = validateScheduleDraft({
      draftMatches: normalizedDraft,
      baselineMatches: current.matches,
      teams: current.teams,
      courtsCount: current.settings.courts || 1,
      knockoutMatches: current.knockout?.matches || [],
    });

    if (!report.valid) {
      return {
        success: false,
        error: report.errors[0]?.message || 'Schedule validation failed.',
        report,
      };
    }

    if (!report.hasChanges) {
      return {
        success: true,
        report,
      };
    }

    lastServerScoreTime.current = Date.now();
    let authoritativeMatches = normalizedDraft;

    if (SupabaseService.isAvailable()) {
      const dbRes = await SupabaseService.saveEditedSchedule({
        draftMatches: normalizedDraft,
        removedMatchIds: report.removedMatchIds,
        season: seasonSlug,
        seasonId,
        auditDetails: {
          totalMatches: normalizedDraft.length,
          changedCount: report.changedMatchIds.length,
          addedCount: report.addedMatchIds.length,
          removedCount: report.removedMatchIds.length,
          seasonSlug,
        },
      });

      if (dbRes.conflict) {
        const latest = await SupabaseService.fetchMatches(seasonSlug, seasonId);
        if (latest) {
          setState((prev) => ({
            ...prev,
            matches: latest.matches,
          }));
        }
        return {
          success: false,
          conflict: true,
          error:
            dbRes.error ||
            'Concurrent schedule change detected. Latest schedule has been loaded.',
          report,
        };
      }

      if (!dbRes.success) {
        return {
          success: false,
          error: dbRes.error || 'Failed to save schedule changes to Supabase.',
          report,
        };
      }

      if (dbRes.matches) {
        authoritativeMatches = dbRes.matches;
      }
    }

    const nowTs = Date.now();
    for (const m of authoritativeMatches) {
      localMatchGuardRef.current.set(m.id, {
        updatedAt: nowTs,
        scoreA: m.scoreA,
        scoreB: m.scoreB,
        status: m.status,
        court: m.court,
      });
    }

    setState((prev) => ({
      ...prev,
      matches: authoritativeMatches,
    }));

    if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
      try {
        const ch = new BroadcastChannel('spl_live_scores_channel');
        ch.postMessage({
          type: 'SCHEDULE_UPDATED',
          seasonSlug,
          matches: authoritativeMatches,
          lastUpdated: nowTs,
        });
        ch.close();
      } catch {}
    }

    try {
      await fetch(`/api/tournament/state?season=${encodeURIComponent(seasonSlug)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...AuthService.getAuthHeader() },
        body: JSON.stringify({
          seasonSlug,
          matches: authoritativeMatches,
        }),
      });
    } catch {}

    lastServerScoreTime.current = Date.now();

    return {
      success: true,
      report,
    };
  };

  const generateFixtures = async (
    courtConfig?: { courts: number; courtNames?: string[] }
  ): Promise<{ success: boolean; count?: number; error?: string }> => {
    const { seasonSlug, seasonId, isLocked } = getActiveSeasonCtx();
    if (isLocked) {
      return { success: false, error: 'This season is archived and locked for edits.' };
    }
    if (state.teams.length < 2) {
      return { success: false, error: 'At least 2 teams are required to generate a match schedule.' };
    }

    const courts = courtConfig?.courts || state.settings.courts || 1;
    const courtNames =
      courtConfig?.courtNames ||
      state.settings.courtNames ||
      Array.from({ length: courts }, (_, i) => `Court ${i + 1}`);

    const fixtures = generateRoundRobinFixtures(state.teams, courts, courtNames).map((m) => ({
      ...m,
      seasonId,
      seasonSlug,
    }));
    lastServerScoreTime.current = Date.now();

    try {
      // 1. Direct Supabase atomic replacement (delete old, insert new)
      if (SupabaseService.isAvailable()) {
        const supRes = await SupabaseService.replaceSeasonMatches(
          fixtures,
          seasonSlug,
          { courts, courtNames },
          seasonId
        );
        if (!supRes.success) {
          console.warn('Supabase schedule replacement error:', supRes.error);
        }
      }

      // 2. Centralized server atomic replacement & SSE broadcast
      const serverRes = await fetch('/api/tournament/schedule/replace', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...AuthService.getAuthHeader() },
        body: JSON.stringify({
          seasonSlug,
          matches: fixtures,
          courts,
          courtNames,
        }),
      }).catch((err) => {
        console.warn('Server schedule replacement call failed:', err);
        return null;
      });

      if (serverRes && !serverRes.ok && !SupabaseService.isAvailable()) {
        const errData = await serverRes.json().catch(() => ({}));
        return { success: false, error: errData.error || 'Failed to replace match schedule on server.' };
      }

      // 3. Update React state immediately
      setState((prev) => ({
        ...prev,
        matches: fixtures,
        settings: {
          ...prev.settings,
          courts,
          courtNames,
        },
      }));

      return { success: true, count: fixtures.length };
    } catch (err: any) {
      console.error('Exception during schedule generation:', err);
      return { success: false, error: err?.message || 'Unexpected error generating schedule' };
    }
  };

  const deleteMatch = async (matchId: string): Promise<boolean> => {
    const { seasonSlug, seasonId, isLocked } = getActiveSeasonCtx();
    if (isLocked) return false;
    try {
      localMatchGuardRef.current.delete(matchId);
      if (SupabaseService.isAvailable()) {
        await SupabaseService.deleteMatch(matchId);
      }
      await fetch(`/api/tournament/matches/${matchId}?season=${encodeURIComponent(seasonSlug)}`, {
        method: 'DELETE',
        headers: { ...AuthService.getAuthHeader() },
      }).catch(() => {});

      setState((prev) => {
        const nextMatches = prev.matches.filter((m) => m.id !== matchId);
        const remainingKo = prev.knockout.matches.filter((m) => m.id !== matchId);
        const wasKoMatch = remainingKo.length !== prev.knockout.matches.length;
        const progressedKo = wasKoMatch
          ? progressKnockoutMatches(remainingKo, prev.knockout.format)
          : remainingKo;
        const isIplKo =
          prev.knockout.format === 'ipl_top4' ||
          progressedKo.some((m) => Boolean(inferPlayoffRound(m, prev.knockout.format)));
        const iplProgression = isIplKo && progressedKo.length > 0 ? progressIPLPlayoffs(progressedKo) : null;
        const nextKnockout: KnockoutData = {
          ...prev.knockout,
          matches: iplProgression ? iplProgression.matches : progressedKo,
          championTeamId: iplProgression ? iplProgression.championTeamId : undefined,
          runnerUpTeamId: iplProgression ? iplProgression.runnerUpTeamId : undefined,
          status: iplProgression
            ? iplProgression.isCompleted
              ? 'completed'
              : progressedKo.length > 0
              ? 'active'
              : 'draft'
            : progressedKo.length > 0
            ? prev.knockout.status
            : 'draft',
          updatedAt: Date.now(),
        };
        if (wasKoMatch && SupabaseService.isAvailable()) {
          SupabaseService.savePlayoffState(seasonSlug, nextKnockout, seasonId).catch(() => {});
        }
        return {
          ...prev,
          matches: nextMatches,
          knockout: nextKnockout,
        };
      });
      return true;
    } catch (err) {
      console.error('Error deleting match:', err);
      return false;
    }
  };

  const clearResults = () => {
    const { seasonSlug, seasonId, isLocked } = getActiveSeasonCtx();
    if (isLocked) return;
    setState((prev) => {
      const clearedMatches = prev.matches.map((m) => ({
        ...m,
        scoreA: undefined,
        scoreB: undefined,
        status: 'upcoming' as const,
        winner: undefined,
      }));
      const clearedKnockoutMatches = prev.knockout.matches.map((k) => ({
        ...k,
        scoreA: undefined,
        scoreB: undefined,
        status: 'upcoming' as const,
        winner: undefined,
      }));

      if (SupabaseService.isAvailable()) {
        SupabaseService.batchSaveMatches(clearedMatches, seasonSlug, seasonId).catch(() => {});
      }
      fetch(`/api/tournament/state?season=${encodeURIComponent(seasonSlug)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...AuthService.getAuthHeader() },
        body: JSON.stringify({ seasonSlug, matches: clearedMatches, knockout: { ...prev.knockout, matches: clearedKnockoutMatches } }),
      }).catch(() => {});

      return {
        ...prev,
        matches: clearedMatches,
        knockout: {
          ...prev.knockout,
          matches: clearedKnockoutMatches,
        },
      };
    });
  };

  const clearAllMatches = () => {
    const { seasonSlug, seasonId, isLocked } = getActiveSeasonCtx();
    if (isLocked) return;
    if (SupabaseService.isAvailable()) {
      SupabaseService.clearSeasonMatches(seasonSlug).catch(() => {});
      SupabaseService.clearKnockoutMatches(seasonSlug).catch(() => {});
      SupabaseService.logAudit('matches_cleared', 'matches', undefined, { seasonSlug }, undefined, seasonId).catch(() => {});
    }
    setState((prev) => {
      fetch(`/api/tournament/state?season=${encodeURIComponent(seasonSlug)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...AuthService.getAuthHeader() },
        body: JSON.stringify({ seasonSlug, matches: [], knockout: { ...prev.knockout, matches: [] } }),
      }).catch(() => {});
      return {
        ...prev,
        matches: [],
        knockout: { ...prev.knockout, matches: [] },
      };
    });
  };

  // Helper to persist full knockout / IPL playoff state cleanly across Supabase, Express SSE & BroadcastChannel
  const persistKnockoutState = (nextKnockout: KnockoutData, replaceMatchesInDb = false) => {
    const { seasonSlug, seasonId, isLocked } = getActiveSeasonCtx();
    if (isLocked) return;
    const now = Date.now();
    lastServerScoreTime.current = now;

    if (SupabaseService.isAvailable()) {
      if (replaceMatchesInDb) {
        if (nextKnockout.matches.length === 0) {
          SupabaseService.clearKnockoutMatches(seasonSlug).catch(() => {});
        } else {
          SupabaseService.replaceKnockoutMatches(nextKnockout.matches, seasonSlug, seasonId).catch(() => {});
        }
      }
      SupabaseService.savePlayoffState(seasonSlug, nextKnockout, seasonId).catch(() => {});
    }

    fetch(`/api/tournament/state?season=${encodeURIComponent(seasonSlug)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...AuthService.getAuthHeader() },
      body: JSON.stringify({ seasonSlug, knockout: nextKnockout }),
    }).catch(() => {});

    if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
      try {
        const ch = new BroadcastChannel('spl_live_scores_channel');
        ch.postMessage({
          type: 'SCORE_UPDATE',
          seasonSlug,
          matches: stateRef.current.matches,
          teams: stateRef.current.teams,
          knockout: nextKnockout,
          lastUpdated: now,
        });
        ch.close();
      } catch {}
    }

    setState((prev) => ({
      ...prev,
      knockout: nextKnockout,
    }));
  };

  // Knockout Bracket & Advanced Flexible Knockout Engine
  const setKnockoutFormat = (format: PlayoffFormat, customQualifyingCount?: number) => {
    if (getActiveSeasonCtx().isLocked) return;
    const currentState = stateRef.current;
    const resolvedCount = resolveFormatQualifyingCount(
      format,
      customQualifyingCount ?? currentState.knockout.qualifyingTeamsCount
    );
    const hasStartedBracket = (currentState.knockout.matches || []).some(
      (m) => m.status === 'live' || m.status === 'paused' || m.status === 'completed'
    );
    const nextKnockout: KnockoutData = {
      ...currentState.knockout,
      format,
      qualifyingTeamsCount: resolvedCount,
      publishedSnapshot: hasStartedBracket
        ? currentState.knockout.publishedSnapshot
        : undefined,
      updatedAt: Date.now(),
    };
    persistKnockoutState(nextKnockout, false);
  };

  const configureKnockoutQualification = (params: {
    format?: PlayoffFormat;
    qualifyingTeamsCount?: number;
    qualificationMode?: QualificationMode;
    manualSelectedTeamIds?: string[];
    customStageConfig?: CustomKnockoutStageConfig;
  }) => {
    if (getActiveSeasonCtx().isLocked) return;
    const currentState = stateRef.current;
    const nextFormat = params.format ?? currentState.knockout.format;
    const nextCount = resolveFormatQualifyingCount(
      nextFormat,
      params.qualifyingTeamsCount ??
        params.customStageConfig?.qualifyingTeamsCount ??
        currentState.knockout.qualifyingTeamsCount
    );
    const hasStartedBracket = (currentState.knockout.matches || []).some(
      (m) => m.status === 'live' || m.status === 'paused' || m.status === 'completed'
    );
    const nextKnockout: KnockoutData = {
      ...currentState.knockout,
      format: nextFormat,
      qualifyingTeamsCount: nextCount,
      qualificationMode: params.qualificationMode ?? currentState.knockout.qualificationMode ?? 'auto',
      manualSelectedTeamIds:
        params.manualSelectedTeamIds !== undefined
          ? params.manualSelectedTeamIds
          : currentState.knockout.manualSelectedTeamIds,
      customStageConfig:
        params.customStageConfig !== undefined
          ? params.customStageConfig
          : currentState.knockout.customStageConfig,
      publishedSnapshot: hasStartedBracket
        ? currentState.knockout.publishedSnapshot
        : undefined,
      updatedAt: Date.now(),
    };
    persistKnockoutState(nextKnockout, false);
  };

  const generateKnockoutBracket = (options?: {
    format?: PlayoffFormat;
    qualifyingTeamsCount?: number;
    qualificationMode?: QualificationMode;
    manualTeamIds?: string[];
    overrideTop4Ids?: string[];
    customStageConfig?: CustomKnockoutStageConfig;
    saveAsDraft?: boolean;
  }): { success: boolean; error?: string } => {
    const { seasonId, isLocked } = getActiveSeasonCtx();
    if (isLocked) {
      return { success: false, error: 'Archived season is read-only. Cannot generate knockout bracket.' };
    }
    const currentState = stateRef.current;
    const playoffSettings = normalizePlayoffSettings(currentState.settings.playoffSettings);
    const activeFormat: PlayoffFormat =
      options?.format || currentState.knockout.format || playoffSettings.format || 'top4';
    const effectiveCustomConfig =
      options?.customStageConfig ??
      (activeFormat === 'custom' ? currentState.knockout.customStageConfig : undefined);
    const required = resolveFormatQualifyingCount(
      activeFormat,
      options?.qualifyingTeamsCount ??
        effectiveCustomConfig?.qualifyingTeamsCount ??
        currentState.knockout.qualifyingTeamsCount ??
        playoffSettings.qualifyingTeamsCount
    );

    const activeQualificationMode: QualificationMode =
      options?.qualificationMode ||
      (options?.overrideTop4Ids || options?.manualTeamIds ? 'manual' : undefined) ||
      currentState.knockout.qualificationMode ||
      'auto';

    const disqualifiedIds = currentState.knockout.disqualifiedTeamIds || [];
    const manualTieBreakOrder = currentState.knockout.manualTieBreakOrder || [];

    const leagueStandings = calculatePlayoffLeagueStandings({
      teams: currentState.teams,
      players: currentState.players,
      matches: currentState.matches,
      tieBreakerOrder: playoffSettings.tieBreakerOrder,
      disqualifiedTeamIds: disqualifiedIds,
      manualTieBreakOrder,
    });

    const explicitManualList =
      options?.manualTeamIds ||
      options?.overrideTop4Ids ||
      (activeQualificationMode === 'manual' ? currentState.knockout.manualSelectedTeamIds : undefined);

    let selectedTeamIds: string[] = [];

    if (activeQualificationMode === 'manual' && explicitManualList && explicitManualList.length > 0) {
      const uniqueIds = Array.from(new Set(explicitManualList.filter(Boolean)));
      if (uniqueIds.length < required) {
        return {
          success: false,
          error: `Please select ${required} distinct teams for ${getFormatDisplayTitle(activeFormat, required)} (currently ${uniqueIds.length} selected).`,
        };
      }
      const validIds = uniqueIds
        .slice(0, required)
        .filter((tid) => currentState.teams.some((t) => t.id === tid));
      if (validIds.length < required) {
        return {
          success: false,
          error: `All ${required} manually selected teams must exist in the tournament roster.`,
        };
      }
      selectedTeamIds = validIds;
    } else {
      const eligibility = evaluatePlayoffGenerationEligibility({
        rankedActiveCount: leagueStandings.rankedActive.length,
        leagueMatches: currentState.matches,
        knockout: {
          ...currentState.knockout,
          format: activeFormat,
          qualifyingTeamsCount: required,
          qualificationMode: 'auto',
        },
        playoffSettings: {
          ...playoffSettings,
          format: activeFormat,
          qualifyingTeamsCount: required,
        },
        unresolvedTies: leagueStandings.unresolvedTies,
        requiredTeamsCount: required,
      });

      if (!eligibility.canGenerate) {
        return {
          success: false,
          error:
            eligibility.blockingReasons[0] ||
            `At least ${required} eligible teams are required in League Standings to generate ${getFormatDisplayTitle(activeFormat, required)}.`,
        };
      }

      selectedTeamIds = leagueStandings.rankedActive.slice(0, required).map((r) => r.team.id);
    }

    const courtsCount = Math.max(1, currentState.settings.courts || 1);
    const actorName = AuthService.getCurrentUser()?.name || 'Tournament Admin';
    const bracketId = currentState.knockout.bracketId || crypto.randomUUID();
    const shouldPublish = options?.saveAsDraft ? false : currentState.knockout.published ?? true;

    const qualifiedSeeds: PlayoffQualifiedSeed[] = selectedTeamIds.map((tid, idx) => {
      const standingRow = leagueStandings.allRows.find((r) => r.team.id === tid);
      const teamObj = currentState.teams.find((t) => t.id === tid);
      const isOverride =
        activeQualificationMode === 'manual' ||
        leagueStandings.rankedActive[idx]?.team.id !== tid;
      return {
        rank: idx + 1,
        teamId: tid,
        teamName: standingRow?.team.name || teamObj?.name || `Team ${idx + 1}`,
        playerNames: standingRow?.playerNames || [],
        points: standingRow?.points ?? 0,
        played: standingRow?.played ?? 0,
        won: standingRow?.won ?? 0,
        lost: standingRow?.lost ?? 0,
        matchWinDiff: standingRow?.matchWinDiff ?? 0,
        setDiff: standingRow?.setDiff ?? 0,
        pointDiff: standingRow?.pointDiff ?? 0,
        isManualOverride: isOverride,
        status: 'qualified',
      };
    });

    let bracketMatches: KnockoutMatch[] = [];

    if (activeFormat === 'custom' && effectiveCustomConfig) {
      const customVal = validateCustomKnockoutStageConfig({
        config: effectiveCustomConfig,
        qualifiedSeeds,
        teams: currentState.teams,
        maxEligibleTeams:
          activeQualificationMode === 'manual'
            ? currentState.teams.length
            : leagueStandings.rankedActive.length,
      });
      if (!customVal.valid) {
        return {
          success: false,
          error: customVal.errors[0] || 'Custom knockout stage configuration is invalid.',
        };
      }

      bracketMatches = materializeCustomKnockoutMatches({
        config: effectiveCustomConfig,
        qualifiedTeamIds: selectedTeamIds,
        qualifiedSeeds,
        existingMatches: options?.saveAsDraft ? currentState.knockout.matches : [],
        courtsCount,
        courtNames: currentState.settings.courtNames,
        tournamentDate: currentState.settings.date,
        bracketId,
      });
    } else {
      bracketMatches = generateFlexibleKnockoutBracket({
        format: activeFormat,
        qualifiedTeamIds: selectedTeamIds,
        courtsCount,
        courtNames: currentState.settings.courtNames,
        tournamentDate: currentState.settings.date,
        bracketId,
        showOnPublicHomepage: playoffSettings.showOnPublicHomepage,
      });
    }

    const formatTitle = getFormatDisplayTitle(activeFormat, required);
    const auditEntry = createPlayoffAuditEntry(
      activeQualificationMode === 'manual' ? 'qualification_overridden' : 'playoffs_generated',
      activeQualificationMode === 'manual'
        ? `Generated ${formatTitle} with manual team seeding (${qualifiedSeeds.map((q) => `#${q.rank} ${q.teamName}`).join(', ')})`
        : `Generated ${formatTitle} from Official League Standings (${qualifiedSeeds.map((q) => `#${q.rank} ${q.teamName}`).join(', ')})`,
      actorName
    );

    const nowTs = Date.now();
    const snapshotEntry: KnockoutBracketSnapshot = {
      id: crypto.randomUUID(),
      version: (currentState.knockout.versionHistory?.length || 0) + 1,
      label: `${formatTitle} (${shouldPublish ? 'Published' : 'Draft'})`,
      createdAt: nowTs,
      createdBy: actorName,
      format: activeFormat,
      qualifyingTeamsCount: required,
      qualificationMode: activeQualificationMode,
      published: shouldPublish,
      qualifiedTeams: qualifiedSeeds,
      customStageConfig: effectiveCustomConfig,
      matches: bracketMatches.map((m) => ({ ...m })),
    };

    const nextKnockout: KnockoutData = {
      ...currentState.knockout,
      format: activeFormat,
      qualifyingTeamsCount: required,
      qualificationMode: activeQualificationMode,
      manualSelectedTeamIds:
        activeQualificationMode === 'manual'
          ? selectedTeamIds
          : currentState.knockout.manualSelectedTeamIds,
      customStageConfig: effectiveCustomConfig ?? currentState.knockout.customStageConfig,
      bracketId,
      published: shouldPublish,
      publishedAt: shouldPublish ? nowTs : currentState.knockout.publishedAt,
      publishedSnapshot: shouldPublish ? qualifiedSeeds : currentState.knockout.publishedSnapshot,
      versionHistory: [...(currentState.knockout.versionHistory || []).slice(-14), snapshotEntry],
      showOnPublicHomepage: shouldPublish,
      status: shouldPublish ? 'active' : 'draft',
      qualifiedTeams: qualifiedSeeds,
      championTeamId: undefined,
      runnerUpTeamId: undefined,
      completedAt: undefined,
      updatedAt: nowTs,
      auditLogs: [...(currentState.knockout.auditLogs || []).slice(-49), auditEntry],
      matches: bracketMatches,
    };

    persistKnockoutState(nextKnockout, true);
    if (SupabaseService.isAvailable()) {
      SupabaseService.logAudit(
        auditEntry.action,
        'playoffs',
        bracketId,
        {
          format: activeFormat,
          qualifyingTeamsCount: required,
          qualificationMode: activeQualificationMode,
          qualifiedSeeds: qualifiedSeeds.map((q) => ({
            rank: q.rank,
            teamId: q.teamId,
            teamName: q.teamName,
          })),
        },
        undefined,
        seasonId
      ).catch(() => {});
    }
    return { success: true };
  };

  const updateKnockoutMatch = (
    id: string,
    updates: Partial<KnockoutMatch>,
    options?: { forceCascadeDownstream?: boolean }
  ): {
    success: boolean;
    error?: string;
    dependencyWarning?: boolean;
    dependentMatches?: KnockoutMatch[];
  } => {
    const { seasonSlug, seasonId, isLocked } = getActiveSeasonCtx();
    if (isLocked) {
      return { success: false, error: 'Archived season is read-only. Cannot update knockout matches.' };
    }
    const now = Date.now();
    const currentState = stateRef.current;
    const targetMatch = currentState.knockout.matches.find((m) => m.id === id);
    if (!targetMatch) return { success: false, error: 'Knockout match not found.' };

    // Protect downstream dependencies when editing participants/winner or resetting a match
    const isAlteringOutcomeOrParticipants =
      ('teamA' in updates && updates.teamA !== targetMatch.teamA) ||
      ('teamB' in updates && updates.teamB !== targetMatch.teamB) ||
      ('participantASource' in updates && updates.participantASource !== targetMatch.participantASource) ||
      ('participantBSource' in updates && updates.participantBSource !== targetMatch.participantBSource) ||
      ('winner' in updates && updates.winner !== targetMatch.winner && targetMatch.status === 'completed') ||
      (updates.status === 'upcoming' && targetMatch.status === 'completed');

    const { startedOrCompletedDownstream: activeDownstream } = findDownstreamDependentMatches(
      id,
      currentState.knockout.matches
    );

    if (isAlteringOutcomeOrParticipants && activeDownstream.length > 0 && !options?.forceCascadeDownstream) {
      const names = activeDownstream.map((dm) => dm.matchLabel || dm.matchCode || dm.stage).join(', ');
      return {
        success: false,
        dependencyWarning: true,
        dependentMatches: activeDownstream,
        error: `Downstream match (${names}) has already started or completed. Confirm cascade update to reset dependent downstream matches.`,
      };
    }

    const isScoringOrStarting =
      updates.status === 'live' ||
      updates.status === 'completed' ||
      updates.scoreA !== undefined ||
      updates.scoreB !== undefined ||
      updates.sets !== undefined ||
      updates.winner !== undefined;

    if (isScoringOrStarting) {
      const simulatedTarget: KnockoutMatch = { ...targetMatch, ...updates };
      if (!simulatedTarget.teamA || !simulatedTarget.teamB) {
        return {
          success: false,
          error: 'Both competing teams must be assigned or qualified before starting or scoring this knockout match.',
        };
      }
      if (simulatedTarget.teamA === simulatedTarget.teamB) {
        return {
          success: false,
          error: 'A team cannot play against itself in a knockout match.',
        };
      }
      if (
        currentState.knockout.format === 'ipl_top4' ||
        targetMatch.playoffRound === 'Q1' ||
        targetMatch.playoffRound === 'Q2'
      ) {
        const eligibility = canStartOrScorePlayoffMatch(
          simulatedTarget,
          currentState.knockout.matches,
          currentState.knockout.format
        );
        if (!eligibility.allowed) {
          return {
            success: false,
            error: eligibility.reason || 'Prerequisite knockout match is not completed yet.',
          };
        }
      }
    }

    sportsAudio.playScorePing();
    lastServerScoreTime.current = now;

    const actorName = AuthService.getCurrentUser()?.name || 'Tournament Admin';
    const wasCompleted = targetMatch.status === 'completed';
    const cascadeIds = new Set(
      options?.forceCascadeDownstream ? activeDownstream.map((dm) => dm.id) : []
    );

    let updatedKoMatch: KnockoutMatch | undefined;
    const updatedMatches = currentState.knockout.matches.map((m) => {
      if (cascadeIds.has(m.id)) {
        return {
          ...m,
          scoreA: undefined,
          scoreB: undefined,
          sets: undefined,
          winner: undefined,
          loserId: undefined,
          completedAt: undefined,
          status: 'upcoming' as const,
        };
      }
      if (m.id !== id) return m;
      const resolvedCourt = updates.court ?? m.court ?? 1;
      const resolvedCourtName =
        updates.courtName ??
        (updates.court != null
          ? currentState.settings.courtNames?.[resolvedCourt - 1]?.trim() || `Court ${resolvedCourt}`
          : m.courtName || currentState.settings.courtNames?.[resolvedCourt - 1]?.trim() || `Court ${resolvedCourt}`);

      const current: KnockoutMatch = {
        ...m,
        ...updates,
        court: resolvedCourt,
        courtName: resolvedCourtName,
      };
      if (updates.status !== undefined && updates.status !== 'completed' && !('winner' in updates)) {
        current.winner = undefined;
        current.loserId = undefined;
        current.completedAt = undefined;
      } else if (current.status === 'completed') {
        if (
          ('scoreA' in updates || 'scoreB' in updates) &&
          !('sets' in updates) &&
          (!current.sets || current.sets.length <= 1) &&
          current.scoreA != null &&
          current.scoreB != null
        ) {
          current.sets = [{ scoreA: current.scoreA, scoreB: current.scoreB }];
        }
        if ('winner' in updates && (updates.winner === current.teamA || updates.winner === current.teamB)) {
          current.winner = updates.winner;
        } else if (
          current.scoreA != null &&
          current.scoreB != null &&
          current.scoreA !== current.scoreB &&
          (!current.sets || current.sets.length <= 1)
        ) {
          current.winner = current.scoreA > current.scoreB ? current.teamA : current.teamB;
        } else {
          const stats = extractCompletedMatchStats({
            ...current,
            winner: 'winner' in updates ? updates.winner : current.winner,
          });
          if (stats) current.winner = stats.winnerId;
        }
        if (current.winner && (current.winner === current.teamA || current.winner === current.teamB)) {
          current.loserId = current.winner === current.teamA ? current.teamB : current.teamA;
          current.completedAt = current.completedAt || now;
        } else {
          current.winner = undefined;
          current.loserId = undefined;
        }
      }
      updatedKoMatch = current;
      return current;
    });

    const bracketProg = progressKnockoutBracket(
      updatedMatches,
      currentState.knockout.format,
      currentState.knockout.qualifiedTeams
    );
    const progressed = bracketProg.matches;
    const championTeamId = bracketProg.championTeamId;
    const runnerUpTeamId = bracketProg.runnerUpTeamId;
    const playoffStatus: KnockoutData['status'] = bracketProg.isCompleted
      ? 'completed'
      : progressed.length > 0
      ? currentState.knockout.published === false
        ? 'draft'
        : 'active'
      : 'draft';
    const completedAt = bracketProg.isCompleted
      ? currentState.knockout.completedAt || now
      : undefined;

    const auditLogs: PlayoffAuditEntry[] = [...(currentState.knockout.auditLogs || [])];
    if (updatedKoMatch) {
      const label = updatedKoMatch.matchLabel || updatedKoMatch.matchCode || updatedKoMatch.playoffRound || updatedKoMatch.stage;
      if (updatedKoMatch.status === 'completed' && !wasCompleted) {
        const winTeam = currentState.teams.find((t) => t.id === updatedKoMatch?.winner)?.name || 'Winner';
        auditLogs.push(
          createPlayoffAuditEntry(
            'match_completed',
            `${label} completed: ${winTeam} won (${updatedKoMatch.scoreA ?? 0}-${updatedKoMatch.scoreB ?? 0})`,
            actorName,
            id
          )
        );
      } else if (wasCompleted && updates.winner && updates.winner !== targetMatch.winner) {
        const winTeam = currentState.teams.find((t) => t.id === updatedKoMatch?.winner)?.name || 'Winner';
        auditLogs.push(
          createPlayoffAuditEntry(
            'result_corrected',
            `${label} result corrected by admin: ${winTeam} awarded victory; downstream slots synchronized.`,
            actorName,
            id
          )
        );
      } else if (
        'teamA' in updates ||
        'teamB' in updates ||
        'participantASource' in updates ||
        'participantBSource' in updates
      ) {
        auditLogs.push(
          createPlayoffAuditEntry(
            'bracket_match_edited',
            `${label} matchup participants updated by admin.`,
            actorName,
            id
          )
        );
      } else if (updates.scheduledDate !== undefined || updates.scheduledTime !== undefined) {
        auditLogs.push(
          createPlayoffAuditEntry(
            'match_scheduled',
            `${label} schedule updated (${updatedKoMatch.scheduledDate || ''} ${updatedKoMatch.scheduledTime || ''})`.trim(),
            actorName,
            id
          )
        );
      } else if (updates.court !== undefined) {
        auditLogs.push(
          createPlayoffAuditEntry(
            'court_assigned',
            `${label} assigned to ${updatedKoMatch.courtName || `Court ${updatedKoMatch.court}`}`,
            actorName,
            id
          )
        );
      } else if (updates.assignedUmpire !== undefined) {
        auditLogs.push(
          createPlayoffAuditEntry(
            'umpire_assigned',
            `${label} umpire assigned: ${updatedKoMatch.assignedUmpire || 'Unassigned'}`,
            actorName,
            id
          )
        );
      }
    }

    const nextKnockout: KnockoutData = {
      ...currentState.knockout,
      matches: progressed,
      championTeamId,
      runnerUpTeamId,
      status: playoffStatus,
      completedAt,
      updatedAt: now,
      auditLogs: auditLogs.slice(-50),
    };

    // Detect any downstream bracket slots updated via progression
    const progressedUpdates = progressed.filter((pm) => {
      if (pm.id === id) return false;
      const prevMatch = currentState.knockout.matches.find((orig) => orig.id === pm.id);
      return (
        prevMatch &&
        (prevMatch.teamA !== pm.teamA ||
          prevMatch.teamB !== pm.teamB ||
          prevMatch.status !== pm.status ||
          prevMatch.winner !== pm.winner ||
          prevMatch.scoreA !== pm.scoreA ||
          prevMatch.scoreB !== pm.scoreB)
      );
    });

    if (updatedKoMatch) {
      localMatchGuardRef.current.set(id, {
        updatedAt: now,
        scoreA: updatedKoMatch.scoreA,
        scoreB: updatedKoMatch.scoreB,
        status: updatedKoMatch.status,
        court: updatedKoMatch.court,
      });
    }

    const syncedToSupabase = SupabaseService.isAvailable();

    // 1. Sync to Supabase (target match + any progressed downstream matches + playoff metadata)
    if (syncedToSupabase && updatedKoMatch) {
      SupabaseService.updateMatchScore(id, updatedKoMatch, true, seasonSlug, seasonId).catch(() => {});
      for (const downstream of progressedUpdates) {
        localMatchGuardRef.current.set(downstream.id, {
          updatedAt: now,
          scoreA: downstream.scoreA,
          scoreB: downstream.scoreB,
          status: downstream.status,
          court: downstream.court,
        });
        SupabaseService.updateMatchScore(downstream.id, downstream, true, seasonSlug, seasonId).catch(() => {});
      }
      SupabaseService.savePlayoffState(seasonSlug, nextKnockout, seasonId).catch(() => {});
    }

    // 2. Broadcast to other tabs
    if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
      try {
        const ch = new BroadcastChannel('spl_live_scores_channel');
        ch.postMessage({
          type: 'SCORE_UPDATE',
          seasonSlug,
          matchId: id,
          match: updatedKoMatch,
          matches: currentState.matches,
          teams: currentState.teams,
          knockout: nextKnockout,
          lastUpdated: now,
        });
        ch.close();
      } catch {}
    }

    // 3. Sync to server & SSE stream
    fetch(`/api/tournament/matches/${encodeURIComponent(id)}?season=${encodeURIComponent(seasonSlug)}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', ...AuthService.getAuthHeader() },
      body: JSON.stringify({
        ...updates,
        seasonSlug,
        scoreA: updatedKoMatch?.scoreA ?? null,
        scoreB: updatedKoMatch?.scoreB ?? null,
        winner: updatedKoMatch?.winner ?? null,
        loserId: updatedKoMatch?.loserId ?? null,
        sets: updatedKoMatch?.sets ?? [],
        courtName: updatedKoMatch?.courtName,
        isKnockout: true,
        fullMatch: updatedKoMatch,
        syncedToSupabase,
      }),
    }).catch(() => {});

    for (const downstream of progressedUpdates) {
      fetch(`/api/tournament/matches/${encodeURIComponent(downstream.id)}?season=${encodeURIComponent(seasonSlug)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', ...AuthService.getAuthHeader() },
        body: JSON.stringify({
          seasonSlug,
          teamA: downstream.teamA ?? null,
          teamB: downstream.teamB ?? null,
          status: downstream.status,
          winner: downstream.winner ?? null,
          loserId: downstream.loserId ?? null,
          scoreA: downstream.scoreA ?? null,
          scoreB: downstream.scoreB ?? null,
          sets: downstream.sets ?? [],
          isKnockout: true,
          fullMatch: downstream,
          syncedToSupabase,
        }),
      }).catch(() => {});
    }

    // Also persist bracket metadata on /api/tournament/state
    if (
      updates.scheduledDate !== undefined ||
      updates.scheduledTime !== undefined ||
      updates.assignedUmpire !== undefined ||
      updates.court !== undefined ||
      'teamA' in updates ||
      'teamB' in updates ||
      'participantASource' in updates ||
      'participantBSource' in updates ||
      progressedUpdates.length > 0 ||
      updatedKoMatch?.status === 'completed'
    ) {
      fetch(`/api/tournament/state?season=${encodeURIComponent(seasonSlug)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...AuthService.getAuthHeader() },
        body: JSON.stringify({ seasonSlug, knockout: nextKnockout }),
      }).catch(() => {});
    }

    setState((prev) => ({
      ...prev,
      knockout: nextKnockout,
    }));

    return { success: true };
  };

  const saveKnockoutDraft = (
    draftMatches?: KnockoutMatch[],
    customStageConfig?: CustomKnockoutStageConfig
  ): { success: boolean; error?: string; warnings?: string[] } => {
    if (getActiveSeasonCtx().isLocked) {
      return { success: false, error: 'Archived season is read-only. Cannot save knockout draft.' };
    }
    const currentState = stateRef.current;
    const effectiveCustomConfig = customStageConfig ?? currentState.knockout.customStageConfig;
    const matchesToValidate = draftMatches || currentState.knockout.matches;
    const validation = validateKnockoutBracketConfig({
      matches: matchesToValidate,
      qualifiedTeams: currentState.knockout.qualifiedTeams,
    });
    if (!validation.valid) {
      return {
        success: false,
        error: validation.errors[0] || 'Invalid knockout bracket configuration.',
        warnings: validation.warnings,
      };
    }

    const progressed = progressKnockoutBracket(
      matchesToValidate,
      currentState.knockout.format,
      currentState.knockout.qualifiedTeams
    );
    const actorName = AuthService.getCurrentUser()?.name || 'Tournament Admin';
    const nowTs = Date.now();
    const auditEntry = createPlayoffAuditEntry(
      'bracket_draft_saved',
      `Saved knockout bracket configuration draft (${progressed.matches.length} fixtures).`,
      actorName
    );
    const snapshotEntry: KnockoutBracketSnapshot = {
      id: crypto.randomUUID(),
      version: (currentState.knockout.versionHistory?.length || 0) + 1,
      label: `Draft Snapshot · ${getFormatDisplayTitle(currentState.knockout.format, currentState.knockout.qualifyingTeamsCount)}`,
      createdAt: nowTs,
      createdBy: actorName,
      format: currentState.knockout.format,
      qualifyingTeamsCount: currentState.knockout.qualifyingTeamsCount,
      qualificationMode: currentState.knockout.qualificationMode,
      published: false,
      qualifiedTeams: currentState.knockout.qualifiedTeams,
      customStageConfig: effectiveCustomConfig,
      matches: progressed.matches.map((m) => ({ ...m })),
    };

    const nextKnockout: KnockoutData = {
      ...currentState.knockout,
      customStageConfig: effectiveCustomConfig,
      published: false,
      showOnPublicHomepage: false,
      status: progressed.isCompleted ? 'completed' : 'draft',
      matches: progressed.matches,
      championTeamId: progressed.championTeamId,
      runnerUpTeamId: progressed.runnerUpTeamId,
      versionHistory: [...(currentState.knockout.versionHistory || []).slice(-14), snapshotEntry],
      updatedAt: nowTs,
      auditLogs: [...(currentState.knockout.auditLogs || []).slice(-49), auditEntry],
    };

    persistKnockoutState(nextKnockout, true);
    return { success: true, warnings: validation.warnings };
  };

  const rollbackKnockoutVersion = (versionId: string): { success: boolean; error?: string } => {
    if (getActiveSeasonCtx().isLocked) {
      return { success: false, error: 'Archived season is read-only. Cannot roll back bracket.' };
    }
    const currentState = stateRef.current;
    const snapshot = (currentState.knockout.versionHistory || []).find((v) => v.id === versionId);
    if (!snapshot) {
      return { success: false, error: 'Selected bracket snapshot version was not found.' };
    }
    const hasLive = currentState.knockout.matches.some((m) => m.status === 'live');
    if (hasLive) {
      return {
        success: false,
        error: 'Cannot roll back bracket while a knockout match is currently LIVE.',
      };
    }

    const actorName = AuthService.getCurrentUser()?.name || 'Tournament Admin';
    const progressed = progressKnockoutBracket(
      snapshot.matches,
      snapshot.format,
      snapshot.qualifiedTeams
    );
    const auditEntry = createPlayoffAuditEntry(
      'bracket_rolled_back',
      `Rolled back knockout bracket to Version v${snapshot.version} (${snapshot.label}).`,
      actorName
    );

    const nextKnockout: KnockoutData = {
      ...currentState.knockout,
      format: snapshot.format,
      qualifyingTeamsCount: snapshot.qualifyingTeamsCount,
      qualificationMode: snapshot.qualificationMode,
      qualifiedTeams: snapshot.qualifiedTeams,
      customStageConfig: snapshot.customStageConfig ?? currentState.knockout.customStageConfig,
      matches: progressed.matches,
      championTeamId: progressed.championTeamId,
      runnerUpTeamId: progressed.runnerUpTeamId,
      status: progressed.isCompleted
        ? 'completed'
        : currentState.knockout.published
        ? 'active'
        : 'draft',
      updatedAt: Date.now(),
      auditLogs: [...(currentState.knockout.auditLogs || []).slice(-49), auditEntry],
    };

    persistKnockoutState(nextKnockout, true);
    return { success: true };
  };

  const resetSingleKnockoutMatch = (
    matchId: string,
    forceCascade = false
  ): {
    success: boolean;
    error?: string;
    dependencyWarning?: boolean;
    dependentMatches?: KnockoutMatch[];
  } => {
    return updateKnockoutMatch(
      matchId,
      {
        status: 'upcoming',
        scoreA: undefined,
        scoreB: undefined,
        sets: undefined,
        winner: undefined,
        loserId: undefined,
        completedAt: undefined,
      },
      { forceCascadeDownstream: forceCascade }
    );
  };

  const resetPlayoffs = () => {
    if (getActiveSeasonCtx().isLocked) return;
    const currentState = stateRef.current;
    const actorName = AuthService.getCurrentUser()?.name || 'Tournament Admin';
    const resetRaw = currentState.knockout.matches.map((m) => {
      const hasUpstreamSourceA = Boolean(
        m.participantASource &&
          (m.participantASource.startsWith('WINNER:') ||
            m.participantASource.startsWith('LOSER:') ||
            m.participantASource.endsWith('_WINNER') ||
            m.participantASource.endsWith('_LOSER'))
      );
      const hasUpstreamSourceB = Boolean(
        m.participantBSource &&
          (m.participantBSource.startsWith('WINNER:') ||
            m.participantBSource.startsWith('LOSER:') ||
            m.participantBSource.endsWith('_WINNER') ||
            m.participantBSource.endsWith('_LOSER'))
      );
      return {
        ...m,
        teamA: hasUpstreamSourceA && !m.manual ? undefined : m.teamA,
        teamB: hasUpstreamSourceB && !m.manual ? undefined : m.teamB,
        scoreA: undefined,
        scoreB: undefined,
        sets: undefined,
        winner: undefined,
        loserId: undefined,
        completedAt: undefined,
        status: 'upcoming' as const,
      };
    });

    const progressed = progressKnockoutBracket(
      resetRaw,
      currentState.knockout.format,
      currentState.knockout.qualifiedTeams
    );

    const auditEntry = createPlayoffAuditEntry(
      'playoffs_reset',
      'Knockout scores and downstream pairings reset to scheduled (league matches & standings preserved).',
      actorName
    );

    const nextKnockout: KnockoutData = {
      ...currentState.knockout,
      status: progressed.matches.length > 0 ? (currentState.knockout.published ? 'active' : 'draft') : 'draft',
      championTeamId: undefined,
      runnerUpTeamId: undefined,
      completedAt: undefined,
      updatedAt: Date.now(),
      auditLogs: [...(currentState.knockout.auditLogs || []).slice(-49), auditEntry],
      matches: progressed.matches,
    };

    persistKnockoutState(nextKnockout, true);
  };

  const deletePlayoffs = () => {
    if (getActiveSeasonCtx().isLocked) return;
    const currentState = stateRef.current;
    const actorName = AuthService.getCurrentUser()?.name || 'Tournament Admin';
    const auditEntry = createPlayoffAuditEntry(
      'playoffs_deleted',
      'Deleted current tournament knockout bracket & knockout matches (league matches & standings preserved).',
      actorName
    );

    const nextKnockout: KnockoutData = {
      ...currentState.knockout,
      bracketId: undefined,
      status: 'draft',
      qualifiedTeams: undefined,
      publishedSnapshot: undefined,
      championTeamId: undefined,
      runnerUpTeamId: undefined,
      completedAt: undefined,
      updatedAt: Date.now(),
      auditLogs: [...(currentState.knockout.auditLogs || []).slice(-49), auditEntry],
      matches: [],
    };

    persistKnockoutState(nextKnockout, true);
  };

  const clearKnockout = () => {
    deletePlayoffs();
  };

  const publishPlayoffs = (published: boolean): { success: boolean; error?: string } => {
    if (getActiveSeasonCtx().isLocked) {
      return { success: false, error: 'Archived season is read-only. Cannot change playoff publication.' };
    }
    const currentState = stateRef.current;
    if (published) {
      const validation = validateKnockoutBracketConfig({
        matches: currentState.knockout.matches,
        qualifiedTeams: currentState.knockout.qualifiedTeams,
      });
      if (!validation.valid) {
        return {
          success: false,
          error: validation.errors[0] || 'Cannot publish knockout bracket due to validation errors.',
        };
      }
    }

    const nowTs = Date.now();
    const actorName = AuthService.getCurrentUser()?.name || 'Tournament Admin';
    const auditEntry = createPlayoffAuditEntry(
      published ? 'bracket_published' : 'bracket_unpublished',
      published
        ? 'Knockout bracket published to Public Website & Match Center.'
        : 'Knockout bracket switched to Unpublished Draft mode.',
      actorName
    );

    const snapshotEntry: KnockoutBracketSnapshot | undefined = published
      ? {
          id: crypto.randomUUID(),
          version: (currentState.knockout.versionHistory?.length || 0) + 1,
          label: `Published · ${getFormatDisplayTitle(currentState.knockout.format, currentState.knockout.qualifyingTeamsCount)}`,
          createdAt: nowTs,
          createdBy: actorName,
          format: currentState.knockout.format,
          qualifyingTeamsCount: currentState.knockout.qualifyingTeamsCount,
          qualificationMode: currentState.knockout.qualificationMode,
          published: true,
          qualifiedTeams: currentState.knockout.qualifiedTeams,
          customStageConfig: currentState.knockout.customStageConfig,
          matches: currentState.knockout.matches.map((m) => ({ ...m })),
        }
      : undefined;

    const nextKnockout: KnockoutData = {
      ...currentState.knockout,
      published,
      publishedAt: published ? nowTs : currentState.knockout.publishedAt,
      publishedSnapshot: published
        ? currentState.knockout.qualifiedTeams
        : currentState.knockout.publishedSnapshot,
      versionHistory: snapshotEntry
        ? [...(currentState.knockout.versionHistory || []).slice(-14), snapshotEntry]
        : currentState.knockout.versionHistory,
      showOnPublicHomepage: published,
      status:
        currentState.knockout.status === 'completed'
          ? 'completed'
          : published && currentState.knockout.matches.length > 0
          ? 'active'
          : 'draft',
      updatedAt: nowTs,
      auditLogs: [...(currentState.knockout.auditLogs || []).slice(-49), auditEntry],
    };
    persistKnockoutState(nextKnockout, false);
    return { success: true };
  };

  const overridePlayoffQualifiedTeams = (top4Ids: [string, string, string, string]): { success: boolean; error?: string } => {
    return generateKnockoutBracket({ overrideTop4Ids: top4Ids, qualificationMode: 'manual', manualTeamIds: top4Ids });
  };

  const setPlayoffTieBreakOrder = (teamIdsOrder: string[]) => {
    if (getActiveSeasonCtx().isLocked) return;
    const currentState = stateRef.current;
    const actorName = AuthService.getCurrentUser()?.name || 'Tournament Admin';
    const auditEntry = createPlayoffAuditEntry(
      'tie_break_resolved',
      'Updated manual tie-breaker resolution order.',
      actorName
    );
    const nextKnockout: KnockoutData = {
      ...currentState.knockout,
      manualTieBreakOrder: teamIdsOrder,
      updatedAt: Date.now(),
      auditLogs: [...(currentState.knockout.auditLogs || []).slice(-49), auditEntry],
    };
    persistKnockoutState(nextKnockout, false);
  };

  const toggleTeamPlayoffDisqualification = (teamId: string) => {
    if (getActiveSeasonCtx().isLocked) return;
    const currentState = stateRef.current;
    const existing = currentState.knockout.disqualifiedTeamIds || [];
    const isCurrentlyDq = existing.includes(teamId);
    const nextDq = isCurrentlyDq
      ? existing.filter((id) => id !== teamId)
      : [...existing, teamId];
    const teamName = currentState.teams.find((t) => t.id === teamId)?.name || teamId;
    const actorName = AuthService.getCurrentUser()?.name || 'Tournament Admin';
    const auditEntry = createPlayoffAuditEntry(
      isCurrentlyDq ? 'team_restored' : 'team_disqualified',
      isCurrentlyDq
        ? `Restored ${teamName} to knockout eligibility.`
        : `Excluded ${teamName} from knockout qualification.`,
      actorName
    );
    const nextKnockout: KnockoutData = {
      ...currentState.knockout,
      disqualifiedTeamIds: nextDq,
      updatedAt: Date.now(),
      auditLogs: [...(currentState.knockout.auditLogs || []).slice(-49), auditEntry],
    };
    persistKnockoutState(nextKnockout, false);
  };

  const recalculatePlayoffStandings = () => {
    if (getActiveSeasonCtx().isLocked) return;
    const currentState = stateRef.current;
    const playoffSettings = normalizePlayoffSettings(currentState.settings.playoffSettings);
    const recalculated = calculatePlayoffLeagueStandings({
      teams: currentState.teams,
      players: currentState.players,
      matches: currentState.matches,
      tieBreakerOrder: playoffSettings.tieBreakerOrder,
      disqualifiedTeamIds: currentState.knockout.disqualifiedTeamIds || [],
      manualTieBreakOrder: currentState.knockout.manualTieBreakOrder || [],
    });
    const actorName = AuthService.getCurrentUser()?.name || 'Tournament Admin';
    const auditEntry = createPlayoffAuditEntry(
      'standings_recalculated',
      `Recalculated league standings & qualification preview (${recalculated.rankedActive.length} active teams).`,
      actorName
    );
    const nextKnockout: KnockoutData = {
      ...currentState.knockout,
      updatedAt: Date.now(),
      auditLogs: [...(currentState.knockout.auditLogs || []).slice(-49), auditEntry],
    };
    persistKnockoutState(nextKnockout, false);
  };

  const TOKENS_CACHE_PREFIX = 'spl_tokens_cache_';
  const FORMS_CACHE_PREFIX = 'spl_forms_cache_';

  // Safe fetch helper that handles HTML 404s (e.g. on Vercel) gracefully without crashing JSON parse
  async function safeFetchJson<T = any>(
    url: string,
    options?: RequestInit
  ): Promise<{ ok: boolean; status: number; data: T | null; isJson: boolean; errorText?: string }> {
    try {
      const authHeaders = AuthService.getAuthHeader();
      const mergedOptions: RequestInit = {
        ...options,
        headers: {
          ...authHeaders,
          ...(options?.headers || {}),
        },
      };
      const res = await fetch(url, mergedOptions);
      const contentType = res.headers.get('content-type') || '';
      const text = await res.text();
      if (contentType.includes('application/json') || text.trim().startsWith('{') || text.trim().startsWith('[')) {
        try {
          const json = JSON.parse(text);
          return { ok: res.ok, status: res.status, data: json, isJson: true };
        } catch {
          return { ok: false, status: res.status, data: null, isJson: false, errorText: text };
        }
      }
      return { ok: false, status: res.status, data: null, isJson: false, errorText: text };
    } catch (err: any) {
      return { ok: false, status: 0, data: null, isJson: false, errorText: err?.message };
    }
  }

  // Form Customizer & Token Link Handlers
  const fetchFormConfig = async (seasonSlug?: string): Promise<RegistrationFormConfig> => {
    const slug = seasonSlug || getActiveSeasonCtx().seasonSlug;
    const cacheKey = getSeasonStorageKey('spl_forms_cache', slug);

    let localForm: RegistrationFormConfig | null = null;
    try {
      const cached = localStorage.getItem(cacheKey);
      if (cached) localForm = JSON.parse(cached);
    } catch {}

    const res = await safeFetchJson<RegistrationFormConfig>(`/api/forms/${encodeURIComponent(slug)}`);
    if (res.ok && res.data) {
      setFormConfig(res.data);
      try {
        localStorage.setItem(cacheKey, JSON.stringify(res.data));
      } catch {}
      return res.data;
    }

    if (localForm) {
      setFormConfig(localForm);
      return localForm;
    }

    return formConfig;
  };

  const saveFormConfig = async (
    config: RegistrationFormConfig,
    publish = false
  ): Promise<{ success: boolean; config?: RegistrationFormConfig; error?: string }> => {
    const { seasonSlug: activeSlug, seasonId, isLocked } = getActiveSeasonCtx();
    const slug = config.seasonSlug || activeSlug;
    if (isLocked && slug === activeSlug) {
      return { success: false, error: 'Archived season is read-only. Registration form cannot be edited.' };
    }
    const cacheKey = getSeasonStorageKey('spl_forms_cache', slug);
    try {
      const currentVersion = config.version || formConfig.version || 1;
      const nextVersion = publish ? currentVersion + 1 : currentVersion;
      const nextEnabled = config.enabled !== undefined ? Boolean(config.enabled) : formConfig.enabled !== false;

      regToggleGuardRef.current = {
        seq: regToggleGuardRef.current.seq + 1,
        enabled: nextEnabled,
        updatedAt: Date.now(),
      };

      const payload: RegistrationFormConfig = {
        ...config,
        seasonSlug: slug,
        enabled: nextEnabled,
        version: nextVersion,
        isPublished: publish ? true : config.isPublished,
        lastUpdatedAt: Date.now(),
        publishedAt: publish ? Date.now() : (config.publishedAt || Date.now()),
      };

      // Always ensure exact required submit button text
      if (payload.appearance) {
        payload.appearance.submitButtonText = 'Submit Registration';
      }

      // Synchronize registrationSettings.enabled, state.payment, and state.settings.entryFee
      setState((prev) => ({
        ...prev,
        registrationSettings: {
          ...prev.registrationSettings,
          seasonSlug: slug,
          enabled: nextEnabled,
          ...(payload.closedNotice !== undefined ? { closedNotice: payload.closedNotice } : {}),
        },
        settings: config.payment
          ? {
              ...prev.settings,
              entryFee: config.entryFee != null ? config.entryFee : prev.settings.entryFee,
            }
          : prev.settings,
        payment: config.payment
          ? {
              ...prev.payment,
              enabled: config.payment?.enabled ?? prev.payment.enabled,
              upiId: config.payment?.upiId || prev.payment.upiId,
              accountName: config.payment?.accountName || prev.payment.accountName,
              note: config.payment?.note || prev.payment.note,
            }
          : prev.payment,
      }));
      setFormConfig(payload);
      setIsRegistrationStatusHydrated(true);

      // Save locally first so UI is instantly updated (strictly season-scoped)
      try {
        localStorage.setItem(cacheKey, JSON.stringify(payload));
      } catch {}

      // Broadcast form configuration immediately across all open tabs
      if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
        try {
          const fch = new BroadcastChannel('spl_form_config_channel');
          fch.postMessage({ type: 'FORM_PUBLISHED', config: payload, seasonSlug: slug });
          fch.close();
        } catch {}
      }

      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('spl-form-published', { detail: payload }));
      }

      // Synchronize to centralized Supabase backend directly
      if (SupabaseService.isAvailable()) {
        await SupabaseService.saveFormConfig(payload, publish, seasonId);
        SupabaseService.logAudit(
          publish ? 'form_published' : 'form_draft_saved',
          'form',
          slug,
          { version: nextVersion, fieldsCount: payload.fields.length, enabled: nextEnabled },
          undefined,
          seasonId
        ).catch(() => {});
      }

      const res = await safeFetchJson<RegistrationFormConfig>(`/api/forms/${encodeURIComponent(slug)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...AuthService.getAuthHeader() },
        body: JSON.stringify(payload),
      });

      if (res.ok && res.data) {
        const synced = { ...res.data, enabled: nextEnabled };
        setFormConfig(synced);
        if (publish) {
          triggerCelebration();
        }
        return { success: true, config: synced };
      }

      setFormConfig(payload);
      if (publish) {
        triggerCelebration();
      }
      return { success: true, config: payload };
    } catch {
      setFormConfig(config);
      return { success: true, config };
    }
  };

  const toggleRegistrationStatus = (
    nextEnabled: boolean,
    closedNotice?: string
  ): Promise<{ success: boolean; enabled: boolean; error?: string }> => {
    const task = regToggleChainRef.current.then(async () => {
      const { seasonSlug: activeSlug, seasonId, isLocked } = getActiveSeasonCtx();
      const prevEnabled =
        formConfigRef.current.enabled !== false &&
        stateRef.current.registrationSettings.enabled !== false;
      if (isLocked) {
        return { success: false, enabled: prevEnabled, error: 'Archived season is read-only.' };
      }
      const normalizedNext = Boolean(nextEnabled);
      const slug = formConfigRef.current.seasonSlug || activeSlug;
      const cacheKey = getSeasonStorageKey('spl_forms_cache', slug);
      const seq = regToggleGuardRef.current.seq + 1;
      regToggleGuardRef.current = { seq, enabled: normalizedNext, updatedAt: Date.now() };

      const optimisticConfig: RegistrationFormConfig = {
        ...formConfigRef.current,
        seasonSlug: slug,
        enabled: normalizedNext,
        ...(closedNotice !== undefined ? { closedNotice } : {}),
        lastUpdatedAt: Date.now(),
      };

      // Optimistic local state + multi-tab broadcast
      syncRegistrationEnabledState(normalizedNext, closedNotice, true, slug);

      if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
        try {
          const fch = new BroadcastChannel('spl_form_config_channel');
          fch.postMessage({ type: 'FORM_PUBLISHED', config: optimisticConfig, seasonSlug: slug });
          fch.close();
        } catch {}
      }
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('spl-form-published', { detail: optimisticConfig }));
      }

      try {
        if (SupabaseService.isAvailable()) {
          const sbRes = await SupabaseService.setRegistrationOpenStatus(slug, normalizedNext, closedNotice);
          if (!sbRes.success) {
            if (regToggleGuardRef.current.seq === seq) {
              regToggleGuardRef.current = { seq: seq + 1, enabled: prevEnabled, updatedAt: Date.now() };
              syncRegistrationEnabledState(prevEnabled, undefined, true, slug);
            }
            return {
              success: false,
              enabled: prevEnabled,
              error: sbRes.error || 'Could not update registration status in Supabase.',
            };
          }
          if (sbRes.config && regToggleGuardRef.current.seq === seq) {
            setFormConfig(sbRes.config);
            try {
              localStorage.setItem(cacheKey, JSON.stringify(sbRes.config));
            } catch {}
          }
          SupabaseService.logAudit(
            normalizedNext ? 'registration_opened' : 'registration_closed',
            'form',
            slug,
            { enabled: normalizedNext },
            undefined,
            seasonId
          ).catch(() => {});
        }

        // Mirror to local Express server when present (non-fatal on static hosting)
        await Promise.allSettled([
          safeFetchJson(`/api/registration-settings?season=${encodeURIComponent(slug)}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', ...AuthService.getAuthHeader() },
            body: JSON.stringify({
              ...stateRef.current.registrationSettings,
              seasonSlug: slug,
              enabled: normalizedNext,
              ...(closedNotice !== undefined ? { closedNotice } : {}),
            }),
          }),
          safeFetchJson(`/api/forms/${encodeURIComponent(slug)}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', ...AuthService.getAuthHeader() },
            body: JSON.stringify({
              ...optimisticConfig,
              isPublished: true,
            }),
          }),
        ]);

        return { success: true, enabled: normalizedNext };
      } catch (err: any) {
        if (regToggleGuardRef.current.seq === seq) {
          regToggleGuardRef.current = { seq: seq + 1, enabled: prevEnabled, updatedAt: Date.now() };
          syncRegistrationEnabledState(prevEnabled, undefined, true, slug);
        }
        return {
          success: false,
          enabled: prevEnabled,
          error: err?.message || 'Failed to update registration status.',
        };
      }
    });

    regToggleChainRef.current = task.catch(() => undefined);
    return task;
  };


  const fetchTokens = async (
    seasonSlug?: string
  ): Promise<{ tokens: RegistrationTokenRecord[]; activeToken: RegistrationTokenRecord | null }> => {
    const slug = seasonSlug || getActiveSeasonCtx().seasonSlug;
    const cacheKey = getSeasonStorageKey('spl_tokens_cache', slug);

    let cachedTokens: RegistrationTokenRecord[] = [];
    try {
      const cached = localStorage.getItem(cacheKey);
      if (cached) cachedTokens = JSON.parse(cached);
    } catch {}

    const res = await safeFetchJson<{ tokens: RegistrationTokenRecord[]; activeToken: RegistrationTokenRecord | null }>(
      `/api/tokens/${encodeURIComponent(slug)}`
    );

    if (res.ok && res.data && Array.isArray(res.data.tokens)) {
      setTokens(res.data.tokens);
      setActiveToken(res.data.activeToken || null);
      try {
        localStorage.setItem(cacheKey, JSON.stringify(res.data.tokens));
      } catch {}
      return { tokens: res.data.tokens, activeToken: res.data.activeToken || null };
    }

    if (cachedTokens.length > 0) {
      const active = cachedTokens.find((t) => t.isActive) || cachedTokens[0] || null;
      setTokens(cachedTokens);
      setActiveToken(active);
      return { tokens: cachedTokens, activeToken: active };
    }

    return { tokens, activeToken };
  };

  const regenerateToken = async (
    seasonSlug: string,
    invalidatePrevious: boolean,
    label?: string
  ): Promise<{ success: boolean; tokenRecord?: RegistrationTokenRecord; error?: string }> => {
    const { seasonSlug: activeSlug, isLocked } = getActiveSeasonCtx();
    const slug = seasonSlug || activeSlug;
    if (isLocked && slug === activeSlug) {
      return { success: false, error: 'Archived season is read-only. Cannot regenerate token.' };
    }
    const cacheKey = getSeasonStorageKey('spl_tokens_cache', slug);

    try {
      // 1. Try server endpoint
      const res = await safeFetchJson<{
        success: boolean;
        tokenRecord?: RegistrationTokenRecord;
        tokens?: RegistrationTokenRecord[];
        error?: string;
      }>('/api/tokens/regenerate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...AuthService.getAuthHeader() },
        body: JSON.stringify({ seasonSlug: slug, invalidatePrevious, label }),
      });

      if (res.ok && res.data && res.data.tokenRecord) {
        setActiveToken(res.data.tokenRecord);
        setTokens(res.data.tokens || [res.data.tokenRecord]);
        try {
          localStorage.setItem(
            cacheKey,
            JSON.stringify(res.data.tokens || [res.data.tokenRecord])
          );
        } catch {}
        triggerCelebration();
        return { success: true, tokenRecord: res.data.tokenRecord };
      }
    } catch {}

    // 2. Resilient Client-Side Fallback (for Vercel static deployments or offline environments)
    const chars = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
    let rand = '';
    for (let i = 0; i < 6; i++) {
      rand += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    const tokenStr = `SPL-${slug.replace(/[^a-zA-Z0-9]/g, '').toUpperCase()}-${rand}`;
    const now = Date.now();

    const newTokenRecord: RegistrationTokenRecord = {
      id: crypto.randomUUID(),
      token: tokenStr,
      seasonSlug: slug,
      label: label || `Generated ${new Date().toLocaleDateString('en-IN')}`,
      createdAt: now,
      isActive: true,
      submissionsCount: 0,
    };

    let existingTokens: RegistrationTokenRecord[] = [];
    try {
      const cached = localStorage.getItem(cacheKey);
      if (cached) existingTokens = JSON.parse(cached);
    } catch {}

    if (existingTokens.length === 0 && tokens.length > 0) {
      existingTokens = [...tokens];
    }

    if (invalidatePrevious) {
      existingTokens = existingTokens.map((t) =>
        t.seasonSlug === slug && t.isActive ? { ...t, isActive: false, revokedAt: now } : t
      );
    }

    const updatedTokens = [newTokenRecord, ...existingTokens.filter((t) => t.id !== newTokenRecord.id)];
    setTokens(updatedTokens);
    setActiveToken(newTokenRecord);
    try {
      localStorage.setItem(cacheKey, JSON.stringify(updatedTokens));
    } catch {}

    triggerCelebration();
    return { success: true, tokenRecord: newTokenRecord };
  };

  const toggleTokenStatus = async (
    tokenId: string
  ): Promise<{ success: boolean; token?: RegistrationTokenRecord }> => {
    const { seasonSlug: slug, isLocked } = getActiveSeasonCtx();
    if (isLocked) return { success: false };
    const cacheKey = getSeasonStorageKey('spl_tokens_cache', slug);

    try {
      const res = await safeFetchJson<{ success: boolean; token?: RegistrationTokenRecord }>(
        `/api/tokens/${encodeURIComponent(tokenId)}/toggle-status?season=${encodeURIComponent(slug)}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...AuthService.getAuthHeader() },
          body: JSON.stringify({ seasonSlug: slug }),
        }
      );

      if (res.ok && res.data && res.data.token) {
        const updated = res.data.token;
        setTokens((prev) => {
          const next = prev.map((t) => (t.id === tokenId ? updated : t));
          try {
            localStorage.setItem(cacheKey, JSON.stringify(next));
          } catch {}
          return next;
        });
        if (activeToken && activeToken.id === tokenId) {
          setActiveToken(updated);
        }
        return { success: true, token: updated };
      }
    } catch {}

    // Resilient local toggle fallback
    let toggled: RegistrationTokenRecord | undefined;
    setTokens((prev) => {
      const next = prev.map((t) => {
        if (t.id === tokenId) {
          const isAct = !t.isActive;
          toggled = { ...t, isActive: isAct, revokedAt: isAct ? undefined : Date.now() };
          return toggled;
        }
        return t;
      });
      try {
        localStorage.setItem(cacheKey, JSON.stringify(next));
      } catch {}
      return next;
    });

    if (activeToken && activeToken.id === tokenId && toggled) {
      setActiveToken(toggled);
    }

    return { success: true, token: toggled };
  };

  // Registrations (Public submissions & Admin vetting)
  const submitPublicRegistration = async (
    formData: any
  ): Promise<{ success: boolean; registration?: Registration; error?: string; linkRevoked?: boolean; registrationClosed?: boolean }> => {
    const cleanMobile = formData.mobile ? formData.mobile.replace(/\D/g, '') : '';
    const { seasonSlug: activeSlug, seasonId: activeSeasonId, isLocked } = getActiveSeasonCtx();
    const targetSeason = formData.season || activeSlug;
    const targetSeasonObj =
      seasons.find((s) => s.seasonSlug === targetSeason) ||
      (targetSeason === activeSlug ? activeSeasonRef.current : undefined);
    const targetSeasonId = targetSeasonObj?.id || (targetSeason === activeSlug ? activeSeasonId : undefined);
    const seasonDisplayTitle =
      targetSeasonObj?.seasonTitle ||
      activeSeasonRef.current.seasonTitle ||
      `Smash Premier League ${targetSeasonObj?.seasonNumber || activeSeasonRef.current.seasonNumber}`;
    const regPrefix = `SPL-${targetSeasonObj?.tournamentYear || activeSeasonRef.current.tournamentYear || new Date().getFullYear()}`;

    if (targetSeasonObj?.status === 'archived' || (targetSeason === activeSlug && isLocked)) {
      return {
        success: false,
        registrationClosed: true,
        error: `Registration for ${seasonDisplayTitle} is closed (archived season).`,
      };
    }

    // 1. Primary path: Supabase PostgreSQL direct database persistence
    if (SupabaseService.isAvailable()) {
      try {
        // Authoritative Registration Open/Closed enforcement before any submission
        const liveStatus = await SupabaseService.fetchRegistrationOpenStatus(targetSeason);
        if (liveStatus && !liveStatus.enabled) {
          syncRegistrationEnabledState(false, liveStatus.closedNotice, true, targetSeason);
          return {
            success: false,
            registrationClosed: true,
            error:
              liveStatus.closedNotice ||
              `Registration for ${seasonDisplayTitle} is currently closed.`,
          };
        }

        // Direct duplicate mobile check in Supabase strictly scoped to targetSeason
        const dupCheck = await SupabaseService.checkDuplicateRegistration(cleanMobile, targetSeason);
        if (dupCheck?.isDuplicate) {
          return {
            success: false,
            error: `A registration with mobile number ${cleanMobile} already exists for this season (Reg ID: ${dupCheck.regId || 'existing'}).`,
          };
        }

        // Generate guaranteed collision-free registration ID
        const regId = await SupabaseService.generateCollisionFreeRegId(regPrefix, targetSeason);

        const initialPaymentStatus: PaymentStatus = formData.txnId ? 'pending_verification' : 'unpaid';

        const rawGen = String(formData.gender || '').trim().toLowerCase();
        const normGen: 'M' | 'F' | 'Other' =
          rawGen === 'm' || rawGen === 'male' ? 'M' : rawGen === 'f' || rawGen === 'female' ? 'F' : 'Other';

        const newReg: Registration = {
          id: crypto.randomUUID(),
          regId,
          seasonId: targetSeasonId,
          seasonSlug: targetSeason,
          name: (formData.name || '').trim(),
          mobile: cleanMobile,
          whatsapp: formData.whatsapp ? String(formData.whatsapp).trim() : undefined,
          age: formData.age ? Number(formData.age) : undefined,
          gender: normGen,
          experience: formData.experience || undefined,
          category: formData.category || undefined,
          style: formData.style || undefined,
          city: formData.city ? String(formData.city).trim() : undefined,
          notes: formData.notes ? String(formData.notes).trim() : undefined,
          fee: formData.fee ?? (formConfig.payment?.baseFee ?? formConfig.entryFee ?? state.settings.entryFee ?? 250),
          status: 'pending',
          paymentStatus: initialPaymentStatus,
          method: formData.method || 'upi',
          txnId: formData.txnId ? String(formData.txnId).trim() : undefined,
          season: targetSeason,
          createdAt: Date.now(),
          answers: formData.answers || {},
          photoUrl: formData.photoUrl || undefined,
          tokenUsed: formData.tokenUsed || undefined,
          formVersion: formData.formVersion || formConfig.version || 1,
          auditLog: [
            {
              action: 'created',
              by: 'Player Submission',
              at: Date.now(),
              toStatus: initialPaymentStatus,
              note: formData.txnId ? `Submitted UPI Ref: ${formData.txnId}` : undefined,
            },
          ],
        };

        const saveRes = await SupabaseService.saveRegistrationWithDetail(newReg, targetSeasonId);
        if (!saveRes.success) {
          if (saveRes.registrationClosed) {
            syncRegistrationEnabledState(false, saveRes.error, true, targetSeason);
            return {
              success: false,
              registrationClosed: true,
              error:
                saveRes.error ||
                `Registration for ${seasonDisplayTitle} is currently closed.`,
            };
          }
          // Retry once with alternative salt in case of any rare ID collision
          const altSalt = Math.floor(1000 + Math.random() * 9000);
          newReg.regId = `${regPrefix}-${Date.now().toString(36).toUpperCase().slice(-3)}-${altSalt}`;
          const retryRes = await SupabaseService.saveRegistrationWithDetail(newReg, targetSeasonId);
          if (!retryRes.success) {
            if (retryRes.registrationClosed) {
              syncRegistrationEnabledState(false, retryRes.error, true, targetSeason);
              return {
                success: false,
                registrationClosed: true,
                error:
                  retryRes.error ||
                  `Registration for ${seasonDisplayTitle} is currently closed.`,
              };
            }
            return {
              success: false,
              error: `Database insertion error: ${retryRes.error || saveRes.error || 'Could not record registration in Supabase.'}`,
            };
          }
        }

        // Increment token submission counter if link token was attached
        if (formData.tokenUsed) {
          SupabaseService.incrementTokenSubmission(formData.tokenUsed).catch(() => {});
        }

        // Record audit trail in Supabase
        SupabaseService.logAudit(
          'registration_submitted',
          'registration',
          newReg.id,
          {
            name: newReg.name,
            regId: newReg.regId,
            mobile: newReg.mobile,
            season: newReg.season,
            version: newReg.formVersion,
          },
          undefined,
          targetSeasonId
        ).catch(() => {});

        // Safely notify local full-stack dev server in background if running
        safeFetchJson(`/api/registrations?season=${encodeURIComponent(targetSeason)}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(newReg),
        }).catch(() => {});

        // Update local React state only if submitting into the currently active season
        if (targetSeason === activeSlug) {
          setState((prev) => ({
            ...prev,
            registrations: [
              newReg,
              ...prev.registrations.filter((r) => r.id !== newReg.id),
            ],
          }));
          broadcastRegistrationsSync('upsert', newReg);
        }

        return { success: true, registration: newReg };
      } catch (err: any) {
        console.error('Supabase registration submission error:', err);
        return {
          success: false,
          error: err?.message || 'Database error processing registration. Please try again.',
        };
      }
    }

    // 2. Fallback when Supabase credentials are not configured (local dev server):
    if (!isRegistrationOpen) {
      return {
        success: false,
        registrationClosed: true,
        error:
          formConfig.closedNotice ||
          state.registrationSettings.closedNotice ||
          `Registration for ${seasonDisplayTitle} is currently closed.`,
      };
    }

    try {
      const res = await safeFetchJson<{
        success: boolean;
        registration?: Registration;
        error?: string;
        linkRevoked?: boolean;
      }>(`/api/registrations?season=${encodeURIComponent(targetSeason)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...formData, season: targetSeason }),
      });

      if (res.ok && res.data && res.data.registration) {
        const savedReg = res.data.registration;
        if (targetSeason === activeSlug) {
          setState((prev) => ({
            ...prev,
            registrations: [
              ...prev.registrations.filter((r) => r.id !== savedReg.id),
              savedReg,
            ],
          }));
        }
        return { success: true, registration: savedReg };
      }

      if (res.data && res.data.error) {
        if ((res.data as any).registrationClosed) {
          syncRegistrationEnabledState(false, res.data.error, true, targetSeason);
        }
        return {
          success: false,
          error: res.data.error,
          linkRevoked: Boolean(res.data.linkRevoked),
          registrationClosed: Boolean((res.data as any).registrationClosed),
        };
      }
    } catch {}

    // Resilient local memory fallback
    const isDup = state.registrations.some(
      (r) =>
        r.mobile.replace(/\D/g, '') === cleanMobile &&
        r.status !== 'rejected' &&
        (r.season || activeSlug) === targetSeason
    );
    if (isDup) {
      return {
        success: false,
        error: `A registration with mobile number ${cleanMobile} already exists for this season.`,
      };
    }
    const regSeq = String(state.registrations.length + 1).padStart(3, '0');
    const regSalt = Math.floor(100 + Math.random() * 900);
    const regId = `${regPrefix}-${regSeq}-${regSalt}`;
    const newReg: Registration = {
      id: crypto.randomUUID(),
      regId,
      seasonId: targetSeasonId,
      seasonSlug: targetSeason,
      name: (formData.name || '').trim(),
      mobile: cleanMobile,
      whatsapp: formData.whatsapp,
      age: formData.age ? Number(formData.age) : undefined,
      gender: formData.gender || 'M',
      experience: formData.experience,
      category: formData.category,
      style: formData.style,
      city: formData.city,
      notes: formData.notes,
      fee: formData.fee || state.settings.entryFee || 500,
      status: 'pending',
      paymentStatus: formData.txnId ? 'pending_verification' : 'unpaid',
      method: formData.method || 'upi',
      txnId: formData.txnId,
      season: targetSeason,
      createdAt: Date.now(),
      answers: formData.answers || {},
      photoUrl: formData.photoUrl || undefined,
      tokenUsed: formData.tokenUsed || undefined,
      formVersion: formData.formVersion || formConfig.version || 1,
    };

    if (targetSeason === activeSlug) {
      setState((prev) => ({
        ...prev,
        registrations: [...prev.registrations, newReg],
      }));
    }
    return { success: true, registration: newReg };
  };

  const addRegistration = (
    data: Partial<Registration> & { name: string; mobile: string }
  ): Registration => {
    const { seasonSlug, seasonId, isLocked } = getActiveSeasonCtx();
    const targetSeason = data.season || seasonSlug;
    const regPrefix = `SPL-${activeSeasonRef.current.tournamentYear || new Date().getFullYear()}`;
    const regSeq = String(state.registrations.length + 1).padStart(3, '0');
    const regSalt = Math.floor(100 + Math.random() * 900);
    const regId = `${regPrefix}-${regSeq}-${regSalt}`;
    const newReg: Registration = {
      id: crypto.randomUUID(),
      regId,
      seasonId,
      seasonSlug: targetSeason,
      name: data.name.trim(),
      mobile: data.mobile.replace(/\D/g, ''),
      whatsapp: data.whatsapp,
      age: data.age,
      gender: data.gender || 'M',
      experience: data.experience,
      category: data.category,
      style: data.style,
      city: data.city,
      notes: data.notes,
      fee: data.fee || state.settings.entryFee || 500,
      status: (data.status as any) || 'pending',
      paymentStatus: (data.paymentStatus as any) || (data.status === 'paid' ? 'paid' : 'unpaid'),
      method: data.method || 'upi',
      txnId: data.txnId,
      season: targetSeason,
      createdAt: Date.now(),
      paidAt: data.status === 'paid' ? Date.now() : undefined,
    };

    if (isLocked) return newReg;

    if (SupabaseService.isAvailable()) {
      SupabaseService.saveRegistration(newReg, seasonId).catch(() => {});
    }

    setState((prev) => ({
      ...prev,
      registrations: [...prev.registrations, newReg],
    }));

    // Post to backend
    fetch(`/api/registrations?season=${encodeURIComponent(targetSeason)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...AuthService.getAuthHeader() },
      body: JSON.stringify(newReg),
    }).catch(() => {});

    return newReg;
  };

  const updateRegistration = (id: string, updates: Partial<Registration>) => {
    const { seasonSlug, isLocked } = getActiveSeasonCtx();
    if (isLocked) return;
    setState((prev) => {
      const updated = prev.registrations.map((r) =>
        r.id === id
          ? {
              ...r,
              ...updates,
              paidAt:
                updates.paymentStatus === 'paid' || updates.status === 'paid'
                  ? r.paidAt || Date.now()
                  : updates.paymentStatus
                  ? undefined
                  : r.paidAt,
            }
          : r
      );
      const item = updated.find((r) => r.id === id);
      if (item) {
        broadcastRegistrationsSync('upsert', item);
      }
      return {
        ...prev,
        registrations: updated,
        players: prev.players.map((p) => {
          const target = prev.registrations.find((r) => r.id === id);
          return target && target.playerId === p.id && updates.name ? { ...p, name: updates.name } : p;
        }),
      };
    });

    if (SupabaseService.isAvailable()) {
      SupabaseService.updateRegistrationFieldsAtomic(id, updates)
        .then((res) => {
          if (res.success && res.registration) {
            setState((prev) => ({
              ...prev,
              registrations: prev.registrations.map((r) => (r.id === id ? res.registration! : r)),
            }));
            broadcastRegistrationsSync('upsert', res.registration);
          }
        })
        .catch(() => {});
    }

    fetch(`/api/registrations/${encodeURIComponent(id)}?season=${encodeURIComponent(seasonSlug)}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', ...AuthService.getAuthHeader() },
      body: JSON.stringify(updates),
    }).catch(() => {});
  };

  const approveRegistration = (id: string) => {
    const { seasonSlug, seasonId, isLocked } = getActiveSeasonCtx();
    if (isLocked) return;
    const reg = stateRef.current.registrations.find((r) => r.id === id);
    if (!reg) return;
    triggerCelebration();
    const nowTs = Date.now();
    const cleanMobile = reg.mobile ? reg.mobile.replace(/\D/g, '') : '';

    const finalizeApproval = (existingPlayer: Player | undefined) => {
      const targetPlayerId = existingPlayer ? existingPlayer.id : (reg.playerId || crypto.randomUUID());

      if (!existingPlayer) {
        const newPlayer: Player = {
          id: targetPlayerId,
          seasonId,
          seasonSlug,
          name: reg.name.trim(),
          mobile: reg.mobile,
          age: reg.age,
          gender: reg.gender || 'M',
          skillLevel: (reg.experience === 'Pro' ? 'Pro' : reg.experience === 'Intermediate' ? 'Intermediate' : 'Advanced') as any,
          registrationId: reg.regId,
          registrationStatus: 'approved',
          city: reg.city,
          category: reg.category,
          style: reg.style,
          photoUrl: reg.photoUrl,
        };
        if (SupabaseService.isAvailable()) {
          SupabaseService.upsertPlayer(newPlayer, seasonSlug, seasonId).catch(() => {});
        }
        setState((prev) => ({
          ...prev,
          players: prev.players.some((p) => p.id === targetPlayerId)
            ? prev.players
            : [...prev.players, newPlayer],
          registrations: prev.registrations.map((r) =>
            r.id === id
              ? { ...r, status: 'approved' as const, approvedAt: r.approvedAt || nowTs, playerId: targetPlayerId }
              : r
          ),
        }));
      } else {
        // Canonical repeat athlete (e.g. from SPL 3.0): reuse canonical players.id and include in active season roster without duplicating row
        const linkedPlayer: Player = {
          ...existingPlayer,
          registrationId: reg.regId,
          registrationStatus: 'approved',
        };
        setState((prev) => ({
          ...prev,
          players: prev.players.some((p) => p.id === targetPlayerId)
            ? prev.players
            : [...prev.players, linkedPlayer],
          registrations: prev.registrations.map((r) =>
            r.id === id
              ? { ...r, status: 'approved' as const, approvedAt: r.approvedAt || nowTs, playerId: targetPlayerId }
              : r
          ),
        }));
      }

      broadcastRegistrationsSync('upsert', {
        ...reg,
        status: 'approved',
        approvedAt: reg.approvedAt || nowTs,
        playerId: targetPlayerId,
      });

      if (SupabaseService.isAvailable()) {
        SupabaseService.updateRegistrationFieldsAtomic(id, {
          status: 'approved',
          approvedAt: nowTs,
          playerId: targetPlayerId,
        })
          .then((res) => {
            if (res.success && res.registration) {
              setState((prev) => ({
                ...prev,
                registrations: prev.registrations.map((r) => (r.id === id ? res.registration! : r)),
              }));
              broadcastRegistrationsSync('upsert', res.registration);
            }
            SupabaseService.logAudit(
              'registration_approved',
              'registration',
              id,
              { playerId: targetPlayerId, seasonSlug },
              undefined,
              seasonId
            ).catch(() => {});
          })
          .catch(() => {});
      }

      fetch(`/api/registrations/${encodeURIComponent(id)}?season=${encodeURIComponent(seasonSlug)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', ...AuthService.getAuthHeader() },
        body: JSON.stringify({ status: 'approved', approvedAt: nowTs, playerId: targetPlayerId }),
      }).catch(() => {});
    };

    const existingLocalPlayer = stateRef.current.players.find(
      (p) =>
        (cleanMobile && p.mobile && p.mobile.replace(/\D/g, '') === cleanMobile) ||
        p.name.trim().toLowerCase() === reg.name.trim().toLowerCase()
    );

    if (existingLocalPlayer || !cleanMobile || !SupabaseService.isAvailable()) {
      finalizeApproval(existingLocalPlayer);
    } else {
      void SupabaseService.findPlayerByMobileGlobal(cleanMobile)
        .then((globalMatch) => {
          finalizeApproval(globalMatch || undefined);
        })
        .catch(() => finalizeApproval(undefined));
    }
  };

  const rejectRegistration = (id: string, reason?: string) => {
    const { seasonSlug, seasonId, isLocked } = getActiveSeasonCtx();
    if (isLocked) return;
    const existingReg = stateRef.current.registrations.find((r) => r.id === id);
    const nextNotes = reason ? `${existingReg?.notes || ''} [Rejected: ${reason}]`.trim() : existingReg?.notes;

    if (SupabaseService.isAvailable()) {
      SupabaseService.updateRegistrationFieldsAtomic(id, {
        status: 'rejected',
        ...(nextNotes !== undefined ? { notes: nextNotes } : {}),
      })
        .then((res) => {
          if (res.success && res.registration) {
            setState((prev) => ({
              ...prev,
              registrations: prev.registrations.map((r) => (r.id === id ? res.registration! : r)),
            }));
            broadcastRegistrationsSync('upsert', res.registration);
          }
          SupabaseService.logAudit(
            'registration_rejected',
            'registration',
            id,
            { reason, seasonSlug },
            undefined,
            seasonId
          ).catch(() => {});
        })
        .catch(() => {});
    }

    setState((prev) => ({
      ...prev,
      registrations: prev.registrations.map((r) =>
        r.id === id
          ? {
              ...r,
              status: 'rejected' as const,
              notes: reason ? `${r.notes || ''} [Rejected: ${reason}]`.trim() : r.notes,
            }
          : r
      ),
    }));

    fetch(`/api/registrations/${encodeURIComponent(id)}?season=${encodeURIComponent(seasonSlug)}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', ...AuthService.getAuthHeader() },
      body: JSON.stringify({ status: 'rejected', ...(nextNotes !== undefined ? { notes: nextNotes } : {}) }),
    }).catch(() => {});
  };

  const verifyPayment = async (
    id: string,
    paymentStatus: PaymentStatus,
    note?: string,
    verifiedBy = 'Tournament Director',
    paidAmount?: number
  ): Promise<{ success: boolean; registration?: Registration; error?: string }> => {
    const { seasonSlug, isLocked } = getActiveSeasonCtx();
    if (isLocked) {
      return { success: false, error: 'Archived season is read-only. Payment status cannot be modified.' };
    }
    // 1. Primary path when Supabase client is configured: atomic DB update directly on PostgreSQL
    if (SupabaseService.isAvailable()) {
      const atomicRes = await SupabaseService.verifyRegistrationPaymentAtomic({
        id,
        paymentStatus,
        verifiedBy,
        note,
        paidAmount,
      });

      if (atomicRes.success && atomicRes.registration) {
        const authoritative = atomicRes.registration;
        setState((prev) => ({
          ...prev,
          registrations: prev.registrations.map((r) => (r.id === id ? authoritative : r)),
        }));
        setRegistrationsSyncError(null);
        broadcastRegistrationsSync('upsert', authoritative);

        // Mirror update cleanly to Express backend SSE stream (best-effort)
        safeFetchJson(`/api/registrations/${encodeURIComponent(id)}/verify-payment?season=${encodeURIComponent(seasonSlug)}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...AuthService.getAuthHeader() },
          body: JSON.stringify({ paymentStatus, verifiedBy, note, paidAmount }),
        }).catch(() => {});

        if (paymentStatus === 'paid') {
          triggerCelebration();
        }
        return { success: true, registration: authoritative };
      }

      // If direct Supabase call failed (e.g. RLS/network), try authenticated Express backend API which persists to Supabase + mirrors SSE
      try {
        const apiRes = await safeFetchJson<{ success: boolean; registration?: Registration; error?: string }>(
          `/api/registrations/${encodeURIComponent(id)}/verify-payment?season=${encodeURIComponent(seasonSlug)}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', ...AuthService.getAuthHeader() },
            body: JSON.stringify({ paymentStatus, verifiedBy, note, paidAmount }),
          }
        );
        if (apiRes.ok && apiRes.data?.registration) {
          const updated = apiRes.data.registration;
          setState((prev) => ({
            ...prev,
            registrations: prev.registrations.map((r) => (r.id === id ? updated : r)),
          }));
          setRegistrationsSyncError(null);
          broadcastRegistrationsSync('upsert', updated);
          if (paymentStatus === 'paid') triggerCelebration();
          return { success: true, registration: updated };
        }
      } catch {}

      return {
        success: false,
        error: atomicRes.error || 'Could not save payment status to Supabase database.',
      };
    }

    // 2. Express server mode (when Supabase env is not set)
    try {
      const res = await safeFetchJson<{ success: boolean; registration?: Registration; error?: string }>(
        `/api/registrations/${encodeURIComponent(id)}/verify-payment?season=${encodeURIComponent(seasonSlug)}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...AuthService.getAuthHeader() },
          body: JSON.stringify({ paymentStatus, verifiedBy, note, paidAmount }),
        }
      );

      if (res.ok && res.data && res.data.registration) {
        const updated = res.data.registration;
        setState((prev) => ({
          ...prev,
          registrations: prev.registrations.map((r) => (r.id === id ? updated : r)),
        }));
        broadcastRegistrationsSync('upsert', updated);
        if (paymentStatus === 'paid') {
          triggerCelebration();
        }
        return { success: true, registration: updated };
      }
      return { success: false, error: res.data?.error || res.errorText || 'Server rejected payment update.' };
    } catch (err: any) {
      return { success: false, error: err?.message || 'Failed to update payment status.' };
    }
  };

  const deleteRegistration = (id: string) => {
    const { seasonSlug, seasonId, isLocked } = getActiveSeasonCtx();
    if (isLocked) return;
    if (SupabaseService.isAvailable()) {
      SupabaseService.deleteRegistration(id)
        .then((ok) => {
          if (ok) void refreshRegistrations();
        })
        .catch(() => {});
      SupabaseService.logAudit('registration_deleted', 'registration', id, { seasonSlug }, undefined, seasonId).catch(() => {});
    }

    setState((prev) => ({
      ...prev,
      registrations: prev.registrations.filter((r) => r.id !== id),
    }));
    broadcastRegistrationsSync('delete', { id });

    fetch(`/api/registrations/${encodeURIComponent(id)}?season=${encodeURIComponent(seasonSlug)}`, {
      method: 'DELETE',
      headers: { ...AuthService.getAuthHeader() },
    }).catch(() => {});
  };

  const deleteRegistrationsBulk = (ids: string[]) => {
    const { seasonSlug, seasonId, isLocked } = getActiveSeasonCtx();
    if (isLocked || !ids || ids.length === 0) return;
    const idSet = new Set(ids);

    if (SupabaseService.isAvailable()) {
      SupabaseService.deleteRegistrationsBulk(ids)
        .then((ok) => {
          if (ok) void refreshRegistrations();
        })
        .catch(() => {});
      SupabaseService.logAudit(
        'registrations_bulk_deleted',
        'registration',
        undefined,
        { count: ids.length, seasonSlug },
        undefined,
        seasonId
      ).catch(() => {});
    }

    setState((prev) => ({
      ...prev,
      registrations: prev.registrations.filter((r) => !idSet.has(r.id)),
    }));
    broadcastRegistrationsSync('bulk_delete', { ids });

    fetch(`/api/registrations/bulk-delete?season=${encodeURIComponent(seasonSlug)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...AuthService.getAuthHeader() },
      body: JSON.stringify({ ids, seasonSlug }),
    }).catch(() => {});
  };

  const bulkApproveRegistrations = (ids: string[]) => {
    const { seasonSlug, seasonId, isLocked } = getActiveSeasonCtx();
    if (isLocked || !ids || ids.length === 0) return;
    triggerCelebration();
    const idSet = new Set(ids);
    const nowTs = Date.now();

    const runBulkApproval = async () => {
      const currentPlayers = [...stateRef.current.players];
      const currentRegs = stateRef.current.registrations;
      const newlyCreatedPlayers: Player[] = [];
      const globalReuseCache = new Map<string, Player>();

      if (SupabaseService.isAvailable()) {
        for (const r of currentRegs) {
          if (!idSet.has(r.id)) continue;
          const cleanMobile = r.mobile ? r.mobile.replace(/\D/g, '') : '';
          const alreadyLocal = currentPlayers.some(
            (p) =>
              (cleanMobile && p.mobile && p.mobile.replace(/\D/g, '') === cleanMobile) ||
              p.name.trim().toLowerCase() === r.name.trim().toLowerCase()
          );
          if (!alreadyLocal && cleanMobile && !globalReuseCache.has(cleanMobile)) {
            const globalMatch = await SupabaseService.findPlayerByMobileGlobal(cleanMobile).catch(() => null);
            if (globalMatch) {
              globalReuseCache.set(cleanMobile, globalMatch);
            }
          }
        }
      }

      const newPlayers = [...currentPlayers];
      const updatedRegistrations = currentRegs.map((r) => {
        if (!idSet.has(r.id)) return r;

        const cleanMobile = r.mobile ? r.mobile.replace(/\D/g, '') : '';
        const existingLocal = newPlayers.find(
          (p) =>
            (cleanMobile && p.mobile && p.mobile.replace(/\D/g, '') === cleanMobile) ||
            p.name.trim().toLowerCase() === r.name.trim().toLowerCase()
        );
        const globalMatch = cleanMobile ? globalReuseCache.get(cleanMobile) : undefined;
        const resolvedExisting = existingLocal || globalMatch;

        const playerId = resolvedExisting ? resolvedExisting.id : (r.playerId || crypto.randomUUID());

        if (!resolvedExisting) {
          const np: Player = {
            id: playerId,
            seasonId,
            seasonSlug,
            name: r.name.trim(),
            mobile: r.mobile,
            age: r.age,
            gender: r.gender || 'M',
            skillLevel: (r.experience === 'Pro' ? 'Pro' : r.experience === 'Intermediate' ? 'Intermediate' : 'Advanced') as any,
          };
          newPlayers.push(np);
          newlyCreatedPlayers.push(np);
        } else if (!existingLocal) {
          newPlayers.push({
            ...resolvedExisting,
            registrationId: r.regId,
            registrationStatus: 'approved',
          });
        }

        const approvedReg: Registration = {
          ...r,
          status: 'approved' as const,
          approvedAt: r.approvedAt || nowTs,
          playerId,
        };

        if (SupabaseService.isAvailable()) {
          SupabaseService.updateRegistrationFieldsAtomic(r.id, {
            status: 'approved',
            approvedAt: approvedReg.approvedAt,
            playerId,
          }).catch(() => {});
        }

        return approvedReg;
      });

      if (SupabaseService.isAvailable() && newlyCreatedPlayers.length > 0) {
        SupabaseService.upsertPlayersBulk(newlyCreatedPlayers, seasonSlug, seasonId).catch(() => {});
      }

      setState((prev) => ({
        ...prev,
        players: newPlayers,
        registrations: updatedRegistrations,
      }));
      broadcastRegistrationsSync('refresh');

      fetch(`/api/registrations/bulk-approve?season=${encodeURIComponent(seasonSlug)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...AuthService.getAuthHeader() },
        body: JSON.stringify({ ids, seasonSlug }),
      }).catch(() => {});
    };

    void runBulkApproval();
  };

  // Global resets & export
  const resetToDefault = () => {
    if (getActiveSeasonCtx().isLocked) return;
    setState(buildSeasonDefaultState(activeSeasonRef.current));
  };

  const clearTournamentData = () => {
    if (getActiveSeasonCtx().isLocked) return;
    setState((prev) => ({
      ...prev,
      matches: [],
      knockout: { ...prev.knockout, matches: [] },
    }));
  };

  const exportStateJSON = () => {
    const json = JSON.stringify(state, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `spl-tournament-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const importStateJSON = (jsonStr: string): boolean => {
    try {
      const parsed = JSON.parse(jsonStr);
      if (parsed && parsed.settings && Array.isArray(parsed.players)) {
        setState({
          ...DEFAULT_STATE,
          ...parsed,
          settings: { ...DEFAULT_STATE.settings, ...parsed.settings },
        });
        return true;
      }
    } catch (e) {
      console.error('Import failed:', e);
    }
    return false;
  };

  // Hero Section Manager & Cross-Season Design Studio Actions
  const fetchHeroStateForSeason = useCallback(
    async (seasonSlug?: string) => {
      const targetSlug = seasonSlug || getActiveSeasonCtx().seasonSlug;
      return SupabaseService.fetchAdminHeroState(targetSlug);
    },
    [getActiveSeasonCtx]
  );

  const fetchAdminHeroState = useCallback(async () => {
    return fetchHeroStateForSeason();
  }, [fetchHeroStateForSeason]);

  const saveHeroDraftForSeason = useCallback(
    async (draft: HeroConfig, seasonSlug?: string) => {
      const targetSlug = seasonSlug || getActiveSeasonCtx().seasonSlug;
      const targetMeta = seasonsRef.current.find((s) => s.seasonSlug === targetSlug);
      const targetLocked = targetMeta
        ? Boolean(targetMeta.isLocked || targetMeta.status === 'archived')
        : getActiveSeasonCtx().isLocked;
      if (targetLocked) {
        return { success: false, error: 'Archived season is read-only. Cannot save Hero draft.' };
      }
      const currentUser = AuthService.getCurrentUser();
      const author = currentUser?.name || currentUser?.username || 'Tournament Director';
      return SupabaseService.saveHeroDraft(draft, author, targetSlug);
    },
    [getActiveSeasonCtx]
  );

  const saveHeroDraft = useCallback(
    async (draft: HeroConfig) => saveHeroDraftForSeason(draft),
    [saveHeroDraftForSeason]
  );

  const publishHeroConfigForSeason = useCallback(
    async (
      config: HeroConfig,
      summary = 'Hero customization published',
      action: 'publish' | 'restore' = 'publish',
      seasonSlug?: string
    ) => {
      const targetSlug = seasonSlug || getActiveSeasonCtx().seasonSlug;
      const targetMeta = seasonsRef.current.find((s) => s.seasonSlug === targetSlug);
      const targetLocked = targetMeta
        ? Boolean(targetMeta.isLocked || targetMeta.status === 'archived')
        : getActiveSeasonCtx().isLocked;
      if (targetLocked) {
        return { success: false, error: 'Archived season is read-only. Cannot publish Hero configuration.' };
      }
      const currentUser = AuthService.getCurrentUser();
      const author = currentUser?.name || currentUser?.username || 'Tournament Director';
      if (targetSlug === activeSeasonRef.current.seasonSlug) {
        heroPublishGuardRef.current = Date.now();
      }
      const res = await SupabaseService.publishHeroConfig(
        config,
        author,
        summary,
        action,
        targetSlug
      );
      if (res.success && res.published) {
        if (targetSlug === activeSeasonRef.current.seasonSlug) {
          applyPublishedHeroConfig(res.published, targetSlug);
        } else {
          try {
            localStorage.setItem(
              getSeasonStorageKey('spl_hero_published_cache', targetSlug),
              JSON.stringify(res.published)
            );
          } catch {}
        }
        if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
          try {
            const hch = new BroadcastChannel('spl_hero_config_channel');
            hch.postMessage({ type: 'HERO_PUBLISHED', heroConfig: res.published, seasonSlug: targetSlug });
            hch.close();
          } catch {}
        }
      }
      return res;
    },
    [applyPublishedHeroConfig, getActiveSeasonCtx]
  );

  const publishHeroConfig = useCallback(
    async (
      config: HeroConfig,
      summary = 'Hero customization published',
      action: 'publish' | 'restore' = 'publish'
    ) => publishHeroConfigForSeason(config, summary, action),
    [publishHeroConfigForSeason]
  );

  const saveHeroVersionColor = useCallback(
    async (versionColor: string) => {
      if (!AuthService.canManageTournament()) {
        return { success: false, error: 'Unauthorized: Tournament Director or Super Admin required.' };
      }
      const { seasonSlug, isLocked } = getActiveSeasonCtx();
      if (isLocked) return { success: false, error: 'Archived season is read-only. Cannot update Hero color.' };
      const cleanColor = sanitizeHexColor(versionColor, DEFAULT_HERO_VERSION_COLOR);
      const seasonVerLabel = activeSeasonRef.current.seasonNumber || '3.0';

      // Fetch latest published & draft state so we never overwrite or reset other Hero settings
      const adminState = await SupabaseService.fetchAdminHeroState(seasonSlug).catch(() => ({
        published: publishedHeroConfig,
        draft: { ...publishedHeroConfig, status: 'draft' as const },
        versions: [],
      }));

      const nextSeasonBranding = {
        ...(adminState.published.seasonBranding || DEFAULT_HERO_CONFIG.seasonBranding!),
        presetId: cleanColor === DEFAULT_HERO_VERSION_COLOR ? ('spl-3-original' as const) : ('custom' as const),
        useGradient: cleanColor === DEFAULT_HERO_VERSION_COLOR,
        textColor: cleanColor,
      };

      const nextPublished = normalizeHeroConfig({
        ...adminState.published,
        text: {
          ...adminState.published.text,
          versionColor: cleanColor,
        },
        seasonBranding: nextSeasonBranding,
      });

      const summary =
        cleanColor === DEFAULT_HERO_VERSION_COLOR
          ? `Restored default Hero "${seasonVerLabel}" text color`
          : `Updated Hero "${seasonVerLabel}" text color to ${cleanColor.toUpperCase()}`;

      const res = await publishHeroConfig(nextPublished, summary, 'publish');

      // Preserve any unrelated draft customizations while syncing versionColor on draft
      if (res.success && adminState.draft) {
        const currentAuthor = AuthService.getCurrentUser();
        const author = currentAuthor?.name || currentAuthor?.username || 'Tournament Director';
        const hasOtherDraftChanges =
          JSON.stringify({ ...adminState.draft, text: { ...adminState.draft.text, versionColor: cleanColor }, status: 'published', version: adminState.published.version, updatedAt: 0, updatedBy: '', publishedAt: 0, publishedBy: '' }) !==
          JSON.stringify({ ...adminState.published, text: { ...adminState.published.text, versionColor: cleanColor }, status: 'published', version: adminState.published.version, updatedAt: 0, updatedBy: '', publishedAt: 0, publishedBy: '' });

        if (hasOtherDraftChanges) {
          void SupabaseService.saveHeroDraft(
            {
              ...adminState.draft,
              text: { ...adminState.draft.text, versionColor: cleanColor },
              seasonBranding: {
                ...(adminState.draft.seasonBranding || DEFAULT_HERO_CONFIG.seasonBranding!),
                presetId: cleanColor === DEFAULT_HERO_VERSION_COLOR ? 'spl-3-original' : 'custom',
                useGradient: cleanColor === DEFAULT_HERO_VERSION_COLOR,
                textColor: cleanColor,
              },
            },
            author,
            seasonSlug
          );
        }
      }

      return res;
    },
    [publishHeroConfig, publishedHeroConfig, getActiveSeasonCtx]
  );

  const restoreHeroVersionForSeason = useCallback(
    async (versionRecord: HeroVersionRecord, seasonSlug?: string) => {
      return publishHeroConfigForSeason(
        versionRecord.config,
        `Restored Version v${versionRecord.versionNum}`,
        'restore',
        seasonSlug
      );
    },
    [publishHeroConfigForSeason]
  );

  const restoreHeroVersion = useCallback(
    async (versionRecord: HeroVersionRecord) => restoreHeroVersionForSeason(versionRecord),
    [restoreHeroVersionForSeason]
  );

  const refreshYouTubeLiveConfig = useCallback(async () => {
    const { seasonSlug } = getActiveSeasonCtx();
    try {
      const latest = await SupabaseService.fetchYouTubeLiveConfig(seasonSlug);
      applyYoutubeLiveConfig(latest, seasonSlug);
      return latest;
    } catch {
      return null;
    }
  }, [applyYoutubeLiveConfig, getActiveSeasonCtx]);

  const saveYouTubeLiveConfig = useCallback(
    async (config: YouTubeLiveConfig) => {
      const { seasonSlug, isLocked } = getActiveSeasonCtx();
      if (isLocked) return { success: false, error: 'Archived season is read-only. Cannot update YouTube Live settings.' };
      const currentUser = AuthService.getCurrentUser();
      const author = currentUser?.name || currentUser?.username || 'Tournament Director';
      youtubeGuardRef.current = Date.now();
      const res = await SupabaseService.saveYouTubeLiveConfig(config, author, seasonSlug);
      if (res.success && res.config) {
        applyYoutubeLiveConfig(res.config, seasonSlug);
        if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
          try {
            const ych = new BroadcastChannel('spl_livestream_channel');
            ych.postMessage({ type: 'LIVESTREAM_UPDATED', config: res.config, seasonSlug });
            ych.close();
          } catch {}
        }
      }
      return res;
    },
    [applyYoutubeLiveConfig, getActiveSeasonCtx]
  );

  const activeSeasonContextValue = useMemo<ActiveSeasonContextValue>(
    () => ({
      activeSeason,
      seasons,
      seasonSummaries,
      seasonId: activeSeason.id,
      seasonSlug: activeSeason.seasonSlug,
      seasonNumber: activeSeason.seasonNumber,
      editionName: activeSeason.editionName,
      seasonStatus: activeSeason.status,
      tournamentYear: activeSeason.tournamentYear,
      isSeasonLocked,
      seasonLoading,
      seasonError,
      refreshSeason,
      refreshSeasonSummaries,
      switchActiveSeason,
      activateSeasonSafely,
      createSeason,
      updateSeason,
      updateSeasonStatus,
    }),
    [
      activeSeason,
      seasons,
      seasonSummaries,
      isSeasonLocked,
      seasonLoading,
      seasonError,
      refreshSeason,
      refreshSeasonSummaries,
      switchActiveSeason,
      activateSeasonSafely,
      createSeason,
      updateSeason,
      updateSeasonStatus,
    ]
  );

  return (
    <ActiveSeasonContext.Provider value={activeSeasonContextValue}>
      <TournamentContext.Provider
        value={{
          state,
          standings,
          activeSeason,
          seasons,
          seasonSummaries,
          seasonLoading,
          seasonError,
          isSeasonLocked,
          refreshSeason,
          refreshSeasonSummaries,
          switchActiveSeason,
          activateSeasonSafely,
          createSeason,
          updateSeason,
          updateSeasonStatus,
          isCentralizedDbConnected,
          isSupabaseConnected,
          dbBackendType,
          realtimeStatus,
          reconnectRealtime,
          testDbConnection,
          updateSettings,
          updatePaymentSettings,
          saveAllSettings,
          updateRegistrationSettings,
          addPlayer,
          bulkAddPlayers,
          updatePlayer,
          deletePlayer,
          deletePlayersBulk,
          clearPlayers,
          addTeam,
          updateTeam,
          deleteTeam,
          deleteTeamsBulk,
          renameTeam,
          toggleTeamLock,
          togglePlayerLockInTeam,
          setTeamCaptain,
          setCaptainsBulk,
          setTeamPlayer,
          assignPlayerToTeam,
          removePlayerFromTeam,
          saveManualTeamEdit,
          setTeams,
          clearTeams,
          setTeamFormationMode,
          addPredefinedTeam,
          updatePredefinedTeam,
          deletePredefinedTeam,
          clearPredefinedTeams,
          updateMatch,
          setMatches,
          saveEditedSchedule,
          generateFixtures,
          deleteMatch,
          clearResults,
          clearAllMatches,
          setKnockoutFormat,
          configureKnockoutQualification,
          generateKnockoutBracket,
          updateKnockoutMatch,
          saveKnockoutDraft,
          rollbackKnockoutVersion,
          resetSingleKnockoutMatch,
          clearKnockout,
          resetPlayoffs,
          deletePlayoffs,
          publishPlayoffs,
          overridePlayoffQualifiedTeams,
          setPlayoffTieBreakOrder,
          toggleTeamPlayoffDisqualification,
          recalculatePlayoffStandings,
          formConfig,
          isRegistrationOpen,
          isRegistrationStatusHydrated,
          tokens,
          activeToken,
          fetchFormConfig,
          saveFormConfig,
          toggleRegistrationStatus,
          fetchTokens,
          regenerateToken,
          toggleTokenStatus,
          isRegistrationsLoading,
          registrationsSyncError,
          refreshRegistrations,
          submitPublicRegistration,
          addRegistration,
          updateRegistration,
          approveRegistration,
          rejectRegistration,
          verifyPayment,
          deleteRegistration,
          deleteRegistrationsBulk,
          bulkApproveRegistrations,
          resetToDefault,
          clearTournamentData,
          exportStateJSON,
          importStateJSON,
          triggerCelebration,
          publishedHeroConfig,
          fetchAdminHeroState,
          fetchHeroStateForSeason,
          saveHeroDraft,
          saveHeroDraftForSeason,
          publishHeroConfig,
          publishHeroConfigForSeason,
          saveHeroVersionColor,
          restoreHeroVersion,
          restoreHeroVersionForSeason,
          youtubeLiveConfig,
          saveYouTubeLiveConfig,
          refreshYouTubeLiveConfig,
        }}
      >
        {children}
      </TournamentContext.Provider>
    </ActiveSeasonContext.Provider>
  );
};

export const useActiveSeason = (): ActiveSeasonContextValue => {
  const ctx = useContext(ActiveSeasonContext);
  if (ctx) return ctx;
  const tournamentCtx = useContext(TournamentContext);
  if (tournamentCtx) {
    return {
      activeSeason: tournamentCtx.activeSeason,
      seasons: tournamentCtx.seasons,
      seasonSummaries: tournamentCtx.seasonSummaries,
      seasonId: tournamentCtx.activeSeason.id,
      seasonSlug: tournamentCtx.activeSeason.seasonSlug,
      seasonNumber: tournamentCtx.activeSeason.seasonNumber,
      editionName: tournamentCtx.activeSeason.editionName,
      seasonStatus: tournamentCtx.activeSeason.status,
      tournamentYear: tournamentCtx.activeSeason.tournamentYear,
      isSeasonLocked: tournamentCtx.isSeasonLocked,
      seasonLoading: tournamentCtx.seasonLoading,
      seasonError: tournamentCtx.seasonError,
      refreshSeason: tournamentCtx.refreshSeason,
      refreshSeasonSummaries: tournamentCtx.refreshSeasonSummaries,
      switchActiveSeason: tournamentCtx.switchActiveSeason,
      activateSeasonSafely: tournamentCtx.activateSeasonSafely,
      createSeason: tournamentCtx.createSeason,
      updateSeason: tournamentCtx.updateSeason,
      updateSeasonStatus: tournamentCtx.updateSeasonStatus,
    };
  }
  throw new Error('useActiveSeason must be used within a TournamentProvider');
};

export const useTournament = () => {
  const context = useContext(TournamentContext);
  if (!context) {
    throw new Error('useTournament must be used within a TournamentProvider');
  }
  return context;
};
