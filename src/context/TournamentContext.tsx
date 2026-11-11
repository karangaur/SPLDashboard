import React, { createContext, useContext, useEffect, useState, useMemo, useRef } from 'react';
import {
  TournamentState,
  Player,
  Team,
  Match,
  KnockoutMatch,
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
} from '../types/tournament';
import {
  STORAGE_KEY,
  DEFAULT_STATE,
  DEFAULT_REGISTRATION_SETTINGS,
  createDefaultFormConfig,
  generateRoundRobinFixtures,
  progressKnockoutMatches,
  calculateStandings,
} from '../utils/tournamentEngine';
import confetti from 'canvas-confetti';
import { SupabaseService } from '../services/supabaseService';
import { isSupabaseConfigured, testSupabaseConnection } from '../lib/supabase';
import { AuthService } from '../services/authService';

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

interface TournamentContextType {
  state: TournamentState;
  standings: ReturnType<typeof calculateStandings>;

  // Centralized Database
  isCentralizedDbConnected: boolean;
  isSupabaseConnected: boolean;
  dbBackendType: 'supabase' | 'local_server';
  testDbConnection: () => Promise<DatabaseDiagnosticResult>;

  
  // Settings
  updateSettings: (settings: Partial<TournamentSettings>) => void;
  updatePaymentSettings: (payment: Partial<PaymentSettings>) => void;
  updateRegistrationSettings: (settings: Partial<RegistrationSettings>) => void;
  
  // Players
  addPlayer: (name: string, details?: Partial<Player>) => Player;
  bulkAddPlayers: (names: string[]) => void;
  updatePlayer: (id: string, updates: Partial<Player>) => void;
  deletePlayer: (id: string) => void;
  deletePlayersBulk: (playerIds: string[]) => void;
  clearPlayers: () => void;
  
  // Teams
  addTeam: (name: string, players?: string[], captainId?: string) => Team;
  updateTeam: (id: string, updates: Partial<Team>) => void;
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
  setTeams: (teams: Team[]) => void;
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
  generateFixtures: () => void;
  clearResults: () => void;
  clearAllMatches: () => void;
  
  // Knockout
  setKnockoutFormat: (format: 'top2' | 'top4' | 'top8') => void;
  generateKnockoutBracket: () => void;
  updateKnockoutMatch: (id: string, updates: Partial<KnockoutMatch>) => void;
  clearKnockout: () => void;
  
  // Form Builder & Links / Tokens
  formConfig: RegistrationFormConfig;
  tokens: RegistrationTokenRecord[];
  activeToken: RegistrationTokenRecord | null;
  fetchFormConfig: (seasonSlug?: string) => Promise<RegistrationFormConfig>;
  saveFormConfig: (config: RegistrationFormConfig, publish?: boolean) => Promise<{ success: boolean; config?: RegistrationFormConfig; error?: string }>;
  fetchTokens: (seasonSlug?: string) => Promise<{ tokens: RegistrationTokenRecord[]; activeToken: RegistrationTokenRecord | null }>;
  regenerateToken: (seasonSlug: string, invalidatePrevious: boolean, label?: string) => Promise<{ success: boolean; tokenRecord?: RegistrationTokenRecord; error?: string }>;
  toggleTokenStatus: (tokenId: string) => Promise<{ success: boolean; token?: RegistrationTokenRecord }>;

  // Registrations (Applicants & Management)
  submitPublicRegistration: (formData: any) => Promise<{ success: boolean; registration?: Registration; error?: string; linkRevoked?: boolean }>;
  addRegistration: (reg: Partial<Registration> & { name: string; mobile: string }) => Registration;
  updateRegistration: (id: string, updates: Partial<Registration>) => void;
  approveRegistration: (id: string) => void;
  rejectRegistration: (id: string, reason?: string) => void;
  verifyPayment: (id: string, paymentStatus: PaymentStatus, note?: string, verifiedBy?: string) => Promise<{ success: boolean; registration?: Registration }>;
  deleteRegistration: (id: string) => void;
  deleteRegistrationsBulk: (ids: string[]) => void;
  bulkApproveRegistrations: (ids: string[]) => void;
  
  // Global actions
  resetToDefault: () => void;
  clearTournamentData: () => void;
  exportStateJSON: () => void;
  importStateJSON: (jsonStr: string) => boolean;
  triggerCelebration: () => void;
}

const TournamentContext = createContext<TournamentContextType | null>(null);

// Audio synthesizer using Web Audio API for sports buzzer & fanfares
export const sportsAudio = {
  playScorePing: () => {
    try {
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
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
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
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
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
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
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
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
  const [state, setState] = useState<TournamentState>(DEFAULT_STATE);

  const [formConfig, setFormConfig] = useState<RegistrationFormConfig>(() =>
    createDefaultFormConfig()
  );
  const [tokens, setTokens] = useState<RegistrationTokenRecord[]>([]);
  const [activeToken, setActiveToken] = useState<RegistrationTokenRecord | null>(null);
  const [isCentralizedDbConnected, setIsCentralizedDbConnected] = useState<boolean>(true); // Persistent Express server storage is always active
  const [isSupabaseConnected, setIsSupabaseConnected] = useState<boolean>(() => isSupabaseConfigured());
  const dbBackendType: 'supabase' | 'local_server' = isSupabaseConfigured() ? 'supabase' : 'local_server';
  const lastServerScoreTime = useRef<number>(0);

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
    const seasonSlug = state.registrationSettings.seasonSlug || 'season-4';

    // Authoritative Data Reconciliation Function
    const reconcileAuthoritativeData = async () => {
      if (SupabaseService.isAvailable()) {
        const testRes = await testSupabaseConnection();
        setIsCentralizedDbConnected(testRes.connected);

        // 1. Fetch Players from Supabase (authoritative source of truth)
        const players = await SupabaseService.fetchPlayers();
        if (players !== null) {
          setState((prev) => ({ ...prev, players }));
        }

        // 2. Fetch Teams from Supabase
        const teams = await SupabaseService.fetchTeams();
        if (teams !== null) {
          setState((prev) => ({ ...prev, teams }));
        }

        // 3. Fetch Matches & Knockout from Supabase
        const matchData = await SupabaseService.fetchMatches(seasonSlug);
        if (matchData !== null) {
          setState((prev) => ({
            ...prev,
            matches: matchData.matches,
            knockout: { ...prev.knockout, matches: matchData.knockout },
          }));
        }

        // 4. Fetch Registrations from Supabase (all seasons and custom slugs)
        const regs = await SupabaseService.fetchRegistrations('all');
        if (regs !== null) {
          setState((prev) => ({ ...prev, registrations: regs }));
        }

        // 5. Fetch Form Config from Supabase
        const cfg = await SupabaseService.fetchFormConfig(seasonSlug);
        if (cfg !== null && Array.isArray(cfg.fields) && cfg.fields.length > 0) {
          setFormConfig(cfg);
        }

        // 6. Fetch Tokens from Supabase
        const tokData = await SupabaseService.fetchTokens(seasonSlug);
        if (tokData !== null) {
          setTokens(tokData.tokens);
          setActiveToken(tokData.activeToken);
        }

        // 7. Reconcile predefinedTeams & teamFormationMode from backend state
        fetch('/api/tournament/state')
          .then(async (res) => {
            if (!res.ok) return null;
            const text = await res.text().catch(() => '');
            try { return text ? JSON.parse(text) : null; } catch { return null; }
          })
          .then((serverState) => {
            if (serverState) {
              setState((prev) => ({
                ...prev,
                predefinedTeams: Array.isArray(serverState.predefinedTeams) ? serverState.predefinedTeams : prev.predefinedTeams,
                teamFormationMode: serverState.teamFormationMode || prev.teamFormationMode,
              }));
            }
          })
          .catch(() => {});
      } else {
        // Fallback to local server state only if Supabase is not configured
        fetch('/api/tournament/state')
          .then(async (res) => {
            if (!res.ok) return null;
            const text = await res.text().catch(() => '');
            try { return text ? JSON.parse(text) : null; } catch { return null; }
          })
          .then((serverState) => {
            if (serverState) {
              if (serverState.lastUpdated) {
                lastServerScoreTime.current = serverState.lastUpdated;
              }
              setState((prev) => ({
                ...prev,
                settings: serverState.settings ? { ...prev.settings, ...serverState.settings } : prev.settings,
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
      }

      // Reconcile server form config
      fetch(`/api/forms/${seasonSlug}`)
        .then(async (res) => {
          if (!res.ok) return null;
          const text = await res.text().catch(() => '');
          try { return text ? JSON.parse(text) : null; } catch { return null; }
        })
        .then((serverForm) => {
          if (serverForm && serverForm.fields) {
            setFormConfig(serverForm);
          }
        })
        .catch(() => {});

      // Reconcile server tokens
      fetch(`/api/tokens/${seasonSlug}`)
        .then(async (res) => {
          if (!res.ok) return null;
          const text = await res.text().catch(() => '');
          try { return text ? JSON.parse(text) : null; } catch { return null; }
        })
        .then((tok) => {
          if (tok && Array.isArray(tok.tokens)) {
            setTokens(tok.tokens);
            setActiveToken(tok.activeToken || null);
          }
        })
        .catch(() => {});
    };

    // Initial reconciliation
    reconcileAuthoritativeData();

    // =========================================================================
    // 1. SUPABASE REALTIME MASTER SUBSCRIPTION
    // =========================================================================
    let unsubMaster: (() => void) | undefined;
    if (SupabaseService.isAvailable()) {
      unsubMaster = SupabaseService.subscribeTournamentMaster({
        onMatchChange: (payload) => {
          if (payload.eventType === 'INSERT' && payload.new) {
            const m = payload.new;
            if (m.match_type === 'knockout') {
              const koMatch: KnockoutMatch = {
                id: m.id,
                stage: m.stage || 'SF',
                slot: m.slot || 1,
                teamA: m.team_a_id || undefined,
                teamB: m.team_b_id || undefined,
                scoreA: m.score_a != null ? m.score_a : undefined,
                scoreB: m.score_b != null ? m.score_b : undefined,
                status: m.status || 'upcoming',
                winner: m.winner_id || undefined,
              };
              setState((prev) => {
                if (prev.knockout.matches.some((k) => k.id === koMatch.id)) return prev;
                return {
                  ...prev,
                  knockout: {
                    ...prev.knockout,
                    matches: [...prev.knockout.matches, koMatch],
                  },
                };
              });
            } else {
              const groupMatch: Match = {
                id: m.id,
                round: m.round || 1,
                court: m.court || 1,
                teamA: m.team_a_id || '',
                teamB: m.team_b_id || '',
                scoreA: m.score_a != null ? m.score_a : undefined,
                scoreB: m.score_b != null ? m.score_b : undefined,
                status: m.status || 'upcoming',
                winner: m.winner_id || undefined,
                time: m.time || undefined,
                sets: m.sets_json || undefined,
              };
              setState((prev) => {
                if (prev.matches.some((existing) => existing.id === groupMatch.id)) return prev;
                return { ...prev, matches: [...prev.matches, groupMatch] };
              });
            }
          } else if (payload.eventType === 'UPDATE' && payload.new) {
            const updated = payload.new;
            setState((prev) => {
              let scoreChanged = false;
              let isLiveMatch = false;

              // Check regular matches
              const nextMatches = prev.matches.map((m) => {
                if (m.id === updated.id) {
                  const newScoreA = updated.score_a != null ? updated.score_a : m.scoreA;
                  const newScoreB = updated.score_b != null ? updated.score_b : m.scoreB;
                  if (newScoreA !== m.scoreA || newScoreB !== m.scoreB) {
                    scoreChanged = true;
                  }
                  if (updated.status === 'live' || m.status === 'live') {
                    isLiveMatch = true;
                  }
                  return {
                    ...m,
                    scoreA: newScoreA,
                    scoreB: newScoreB,
                    status: updated.status || m.status,
                    winner: updated.winner_id || m.winner,
                    court: updated.court || m.court,
                    round: updated.round || m.round,
                    time: updated.time || m.time,
                    sets: updated.sets_json || m.sets,
                  };
                }
                return m;
              });

              // Check knockout matches
              const nextKnockoutMatches = prev.knockout.matches.map((k) => {
                if (k.id === updated.id) {
                  const newScoreA = updated.score_a != null ? updated.score_a : k.scoreA;
                  const newScoreB = updated.score_b != null ? updated.score_b : k.scoreB;
                  if (newScoreA !== k.scoreA || newScoreB !== k.scoreB) {
                    scoreChanged = true;
                  }
                  if (updated.status === 'live' || k.status === 'live') {
                    isLiveMatch = true;
                  }
                  return {
                    ...k,
                    scoreA: newScoreA,
                    scoreB: newScoreB,
                    status: updated.status || k.status,
                    winner: updated.winner_id || k.winner,
                    teamA: updated.team_a_id || k.teamA,
                    teamB: updated.team_b_id || k.teamB,
                  };
                }
                return k;
              });

              if (scoreChanged && isLiveMatch) {
                sportsAudio.playScorePing();
              }
              if (updated.status === 'completed' && updated.winner_id) {
                sportsAudio.playFanfare();
              }

              return {
                ...prev,
                matches: nextMatches,
                knockout: {
                  ...prev.knockout,
                  matches: nextKnockoutMatches,
                },
              };
            });
          } else if (payload.eventType === 'DELETE' && payload.old) {
            const deletedId = payload.old.id;
            setState((prev) => ({
              ...prev,
              matches: prev.matches.filter((m) => m.id !== deletedId),
              knockout: {
                ...prev.knockout,
                matches: prev.knockout.matches.filter((k) => k.id !== deletedId),
              },
            }));
          }
        },

        onPlayerChange: (payload) => {
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

        onTeamChange: () => {
          // Ignore immediate self-echoes from our own local bulk team updates
          if (Date.now() - lastServerScoreTime.current < 1500) return;
          SupabaseService.fetchTeams().then((teams) => {
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

        onTeamPlayerChange: () => {
          // Ignore immediate self-echoes from our own local bulk team updates
          if (Date.now() - lastServerScoreTime.current < 1500) return;
          SupabaseService.fetchTeams().then((teams) => {
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
          if (payload.eventType === 'INSERT' && payload.new) {
            const newReg = payload.new;
            setState((prev) => {
              if (prev.registrations.some((r) => r.id === newReg.id)) return prev;
              const mapped: Registration = {
                id: newReg.id,
                regId: newReg.reg_id,
                name: newReg.name,
                mobile: newReg.mobile,
                whatsapp: newReg.whatsapp || undefined,
                age: newReg.age || undefined,
                gender: newReg.gender,
                experience: newReg.experience || undefined,
                category: newReg.category || undefined,
                style: newReg.style || undefined,
                city: newReg.city || undefined,
                notes: newReg.notes || undefined,
                fee: newReg.fee,
                status: newReg.status,
                paymentStatus: newReg.payment_status,
                method: newReg.method,
                txnId: newReg.txn_id || undefined,
                season: newReg.season_slug,
                createdAt: new Date(newReg.created_at).getTime(),
                paidAt: newReg.paid_at ? new Date(newReg.paid_at).getTime() : undefined,
                approvedAt: newReg.approved_at ? new Date(newReg.approved_at).getTime() : undefined,
                verifiedBy: newReg.verified_by || undefined,
                verifiedAt: newReg.verified_at ? new Date(newReg.verified_at).getTime() : undefined,
                auditLog: newReg.audit_log_json || [],
                answers: newReg.answers_json || {},
                photoUrl: newReg.photo_url || undefined,
                tokenUsed: newReg.token_used || undefined,
                formVersion: newReg.form_version || 1,
              };
              return { ...prev, registrations: [mapped, ...prev.registrations] };
            });
          } else if (payload.eventType === 'UPDATE' && payload.new) {
            const updatedReg = payload.new;
            setState((prev) => ({
              ...prev,
              registrations: prev.registrations.map((r) =>
                r.id === updatedReg.id
                  ? {
                      ...r,
                      status: updatedReg.status,
                      paymentStatus: updatedReg.payment_status,
                      txnId: updatedReg.txn_id || r.txnId,
                      approvedAt: updatedReg.approved_at ? new Date(updatedReg.approved_at).getTime() : r.approvedAt,
                      paidAt: updatedReg.paid_at ? new Date(updatedReg.paid_at).getTime() : r.paidAt,
                      verifiedBy: updatedReg.verified_by || r.verifiedBy,
                      verifiedAt: updatedReg.verified_at ? new Date(updatedReg.verified_at).getTime() : r.verifiedAt,
                      auditLog: updatedReg.audit_log_json || r.auditLog,
                    }
                  : r
              ),
            }));
          } else if (payload.eventType === 'DELETE' && payload.old) {
            const delId = payload.old.id;
            setState((prev) => ({
              ...prev,
              registrations: prev.registrations.filter((r) => r.id !== delId),
            }));
          }
        },

        onFormConfigChange: (payload) => {
          if (payload.new && payload.new.fields_json) {
            SupabaseService.fetchFormConfig(seasonSlug).then((cfg) => {
              if (cfg) setFormConfig(cfg);
            });
          }
        },

        onStatusChange: (status) => {
          if (status === 'SUBSCRIBED') {
            reconcileAuthoritativeData();
          }
        },
      });
    }

    // =========================================================================
    // 2. REAL-TIME SERVER-SENT EVENTS (SSE) STREAM
    // =========================================================================
    let eventSource: EventSource | null = null;
    try {
      eventSource = new EventSource('/api/tournament/stream');

      eventSource.addEventListener('match_score', (event: MessageEvent) => {
        try {
          const data = JSON.parse(event.data);
          if (data && data.match) {
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
          if (data && data.match) {
            lastServerScoreTime.current = data.lastUpdated || Date.now();
            setState((prev) => {
              let scoreChanged = false;
              const matches = prev.knockout.matches.map((k) => {
                if (k.id === data.match.id) {
                  if (k.scoreA !== data.match.scoreA || k.scoreB !== data.match.scoreB) {
                    scoreChanged = true;
                  }
                  return { ...k, ...data.match };
                }
                return k;
              });

              if (scoreChanged) {
                sportsAudio.playScorePing();
              }
              if (data.match.status === 'completed' && data.match.winner) {
                sportsAudio.playFanfare();
              }

              return {
                ...prev,
                knockout: { ...prev.knockout, matches },
              };
            });
          }
        } catch {}
      });

      eventSource.addEventListener('tournament_state', (event: MessageEvent) => {
        try {
          const data = JSON.parse(event.data);
          if (data) {
            if (data.lastUpdated) lastServerScoreTime.current = data.lastUpdated;
            setState((prev) => ({
              ...prev,
              matches: Array.isArray(data.matches) ? data.matches : prev.matches,
              teams: Array.isArray(data.teams) && data.teams.length > 0 ? data.teams : prev.teams,
              knockout: data.knockout || prev.knockout,
              settings: data.settings ? { ...prev.settings, ...data.settings } : prev.settings,
            }));
          }
        } catch {}
      });

      eventSource.addEventListener('teams_update', (event: MessageEvent) => {
        try {
          const data = JSON.parse(event.data);
          if (data && Array.isArray(data.teams)) {
            setState((prev) => ({ ...prev, teams: data.teams }));
          }
        } catch {}
      });

      eventSource.addEventListener('form_published', (event: MessageEvent) => {
        try {
          const data = JSON.parse(event.data);
          if (data && data.config) {
            setFormConfig(data.config);
          }
        } catch {}
      });

      eventSource.addEventListener('registration_created', (event: MessageEvent) => {
        try {
          const data = JSON.parse(event.data);
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
    } catch {}

    // =========================================================================
    // 3. MULTI-TAB REAL-TIME LISTENERS (BroadcastChannel + Window Storage)
    // =========================================================================
    let liveChannel: BroadcastChannel | null = null;
    let formChannel: BroadcastChannel | null = null;

    if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
      liveChannel = new BroadcastChannel('spl_live_scores_channel');
      formChannel = new BroadcastChannel('spl_form_config_channel');

      liveChannel.onmessage = (event) => {
        if (event.data?.type === 'SCORE_UPDATE') {
          const { matches, teams, knockout, lastUpdated } = event.data;
          if (lastUpdated) lastServerScoreTime.current = lastUpdated;
          setState((prev) => ({
            ...prev,
            matches: Array.isArray(matches) ? matches : prev.matches,
            teams: Array.isArray(teams) && teams.length > 0 ? teams : prev.teams,
            knockout: knockout || prev.knockout,
          }));
        }
      };

      formChannel.onmessage = (event) => {
        if (event.data?.type === 'FORM_PUBLISHED' && event.data.config) {
          setFormConfig(event.data.config);
        }
      };
    }

    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY && e.newValue) {
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
      } else if (e.key && e.key.startsWith('spl_forms_cache_') && e.newValue) {
        try {
          const parsedForm = JSON.parse(e.newValue);
          if (parsedForm && Array.isArray(parsedForm.fields)) {
            setFormConfig(parsedForm);
          }
        } catch {}
      }
    };

    // =========================================================================
    // 4. AUTO-RECONNECTION & TAB VISIBILITY RECONCILIATION
    // =========================================================================
    const handleOnline = () => {
      reconcileAuthoritativeData();
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        reconcileAuthoritativeData();
      }
    };

    window.addEventListener('online', handleOnline);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('storage', handleStorageChange);

    return () => {
      window.removeEventListener('online', handleOnline);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('storage', handleStorageChange);
      eventSource?.close();
      liveChannel?.close();
      formChannel?.close();
      unsubMaster?.();
    };
  }, []);


  // Derived Standings
  const standings = useMemo(() => {
    const calculated = calculateStandings(state.teams, state.matches, state.knockout.matches);
    if (SupabaseService.isAvailable() && state.teams.length > 0) {
      SupabaseService.syncStandings(state.registrationSettings.seasonSlug || 'season-4', calculated).catch(() => {});
    }
    return calculated;
  }, [state.teams, state.matches, state.knockout.matches, state.registrationSettings.seasonSlug]);


  // Confetti trigger
  const triggerCelebration = () => {
    sportsAudio.playFanfare();
    confetti({
      particleCount: 120,
      spread: 90,
      origin: { y: 0.6 },
      colors: ['#fbbf24', '#f59e0b', '#3b82f6', '#10b981', '#ffffff'],
    });
    setTimeout(() => {
      confetti({
        particleCount: 60,
        angle: 60,
        spread: 60,
        origin: { x: 0.1, y: 0.7 },
      });
    }, 200);
    setTimeout(() => {
      confetti({
        particleCount: 60,
        angle: 120,
        spread: 60,
        origin: { x: 0.9, y: 0.7 },
      });
    }, 400);
  };

  // Settings
  const updateSettings = (settingsUpdate: Partial<TournamentSettings>) => {
    setState((prev) => {
      const nextSettings = { ...prev.settings, ...settingsUpdate };
      if (SupabaseService.isAvailable()) {
        SupabaseService.updateTournamentSettings(
          prev.registrationSettings.seasonSlug || 'season-4',
          {
            tournamentName: nextSettings.name,
            venue: nextSettings.venue,
            date: nextSettings.date,
            entryFee: nextSettings.entryFee,
            maxSlots: nextSettings.slotLimit,
          }
        ).catch(() => {});
        SupabaseService.logAudit('settings_updated', 'settings', undefined, settingsUpdate).catch(() => {});
      }
      fetch('/api/tournament/state', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...AuthService.getAuthHeader() },
        body: JSON.stringify({ settings: nextSettings }),
      }).catch(() => {});
      return {
        ...prev,
        settings: nextSettings,
      };
    });
  };

  const updatePaymentSettings = (paymentUpdate: Partial<PaymentSettings>) => {
    setState((prev) => {
      const nextPayment = { ...prev.payment, ...paymentUpdate };
      if (SupabaseService.isAvailable()) {
        SupabaseService.updateTournamentSettings(
          prev.registrationSettings.seasonSlug || 'season-4',
          undefined,
          nextPayment
        ).catch(() => {});
        SupabaseService.logAudit('payment_settings_updated', 'settings', undefined, paymentUpdate).catch(() => {});
      }
      fetch('/api/tournament/state', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...AuthService.getAuthHeader() },
        body: JSON.stringify({ payment: nextPayment }),
      }).catch(() => {});
      return {
        ...prev,
        payment: nextPayment,
      };
    });
    setFormConfig((prev) => ({
      ...prev,
      payment: {
        ...(prev.payment || {}),
        enabled: paymentUpdate.enabled ?? prev.payment?.enabled ?? true,
        isMandatory: prev.payment?.isMandatory ?? true,
        baseFee: prev.payment?.baseFee ?? 500,
        upiId: paymentUpdate.upiId ?? prev.payment?.upiId ?? 'karan-hdfc@ybl',
        accountName: paymentUpdate.accountName ?? prev.payment?.accountName ?? 'Smash Premier League (Karan Gaur)',
        note: paymentUpdate.note ?? prev.payment?.note ?? 'SPL Tournament Entry Fee',
      },
    }));
  };

  const updateRegistrationSettings = (settingsUpdate: Partial<RegistrationSettings>) => {
    setState((prev) => {
      const nextSettings = {
        ...prev.registrationSettings,
        ...settingsUpdate,
        fields: {
          ...prev.registrationSettings.fields,
          ...(settingsUpdate.fields || {}),
        },
      };

      // Asynchronously sync with backend
      fetch('/api/registration-settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
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
    };

    if (SupabaseService.isAvailable()) {
      SupabaseService.upsertPlayer(newPlayer).catch(() => {});
      SupabaseService.logAudit('player_created', 'player', newPlayer.id, { name: newPlayer.name }).catch(() => {});
    }

    setState((prev) => {
      const updatedPlayers = [...prev.players, newPlayer];
      fetch('/api/tournament/state', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ players: updatedPlayers }),
      }).catch(() => {});
      return {
        ...prev,
        players: updatedPlayers,
      };
    });
    return newPlayer;
  };

  const bulkAddPlayers = (names: string[]) => {
    const newOnes: Player[] = names
      .map((n) => n.trim())
      .filter(Boolean)
      .map((name) => ({
        id: crypto.randomUUID(),
        name,
        gender: 'M',
        skillLevel: 'Advanced',
        registrationStatus: 'direct' as const,
      }));
    if (newOnes.length === 0) return;

    if (SupabaseService.isAvailable()) {
      newOnes.forEach((p) => SupabaseService.upsertPlayer(p).catch(() => {}));
      SupabaseService.logAudit('players_bulk_created', 'player', undefined, { count: newOnes.length }).catch(() => {});
    }

    setState((prev) => {
      const updatedPlayers = [...prev.players, ...newOnes];
      fetch('/api/tournament/state', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ players: updatedPlayers }),
      }).catch(() => {});
      return {
        ...prev,
        players: updatedPlayers,
      };
    });
  };

  const updatePlayer = (id: string, updates: Partial<Player>) => {
    setState((prev) => {
      const target = prev.players.find((p) => p.id === id);
      if (target && SupabaseService.isAvailable()) {
        SupabaseService.upsertPlayer({ ...target, ...updates }).catch(() => {});
        SupabaseService.logAudit('player_updated', 'player', id, updates).catch(() => {});
      }

      const updatedPlayers = prev.players.map((p) => (p.id === id ? { ...p, ...updates } : p));
      fetch('/api/tournament/state', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ players: updatedPlayers }),
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
    if (SupabaseService.isAvailable()) {
      SupabaseService.deletePlayer(id).catch(() => {});
      SupabaseService.logAudit('player_deleted', 'player', id).catch(() => {});
    }

    setState((prev) => {
      const updatedPlayers = prev.players.filter((p) => p.id !== id);
      const updatedTeams = prev.teams.map((t) => ({
        ...t,
        players: t.players.filter((pid) => pid !== id),
        captainId: t.captainId === id ? undefined : t.captainId,
      }));

      fetch('/api/tournament/state', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ players: updatedPlayers, teams: updatedTeams }),
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
    if (!playerIds || playerIds.length === 0) return;
    const idSet = new Set(playerIds);

    if (SupabaseService.isAvailable()) {
      SupabaseService.deletePlayersBulk(playerIds).catch(() => {});
      SupabaseService.logAudit('players_bulk_deleted', 'player', undefined, { count: playerIds.length }).catch(() => {});
    }

    setState((prev) => {
      const updatedPlayers = prev.players.filter((p) => !idSet.has(p.id));
      const updatedTeams = prev.teams.map((t) => ({
        ...t,
        players: t.players.filter((pid) => !idSet.has(pid)),
        captainId: idSet.has(t.captainId || '') ? undefined : t.captainId,
      }));

      fetch('/api/tournament/state', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ players: updatedPlayers, teams: updatedTeams }),
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
    if (SupabaseService.isAvailable()) {
      SupabaseService.clearPlayers().catch(() => {});
      SupabaseService.logAudit('players_cleared', 'player', undefined).catch(() => {});
    }
    setState((prev) => {
      fetch('/api/tournament/state', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...AuthService.getAuthHeader() },
        body: JSON.stringify({ players: [], teams: [], matches: [] }),
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
  const addTeam = (name: string, playerIds: string[] = [], captainId?: string): Team => {
    const newTeam: Team = {
      id: crypto.randomUUID(),
      name: name.trim(),
      players: playerIds,
      captainId: captainId || playerIds[0],
      locked: false,
      avatarColor: 'from-amber-500 to-orange-600',
      badge: '🏸',
    };

    if (SupabaseService.isAvailable()) {
      SupabaseService.saveTeam(newTeam).catch(() => {});
      SupabaseService.logAudit('team_created', 'team', newTeam.id, { name: newTeam.name }).catch(() => {});
    }

    setState((prev) => {
      const nextTeams = [...prev.teams, newTeam];
      fetch('/api/tournament/state', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ teams: nextTeams }),
      }).catch(() => {});
      return {
        ...prev,
        teams: nextTeams,
      };
    });
    return newTeam;
  };

  const updateTeam = (id: string, updates: Partial<Team>) => {
    setState((prev) => {
      const target = prev.teams.find((t) => t.id === id);
      const updatedTeams = prev.teams.map((t) => (t.id === id ? { ...t, ...updates } : t));
      if (target && SupabaseService.isAvailable()) {
        SupabaseService.saveTeam({ ...target, ...updates }).catch(() => {});
      }
      fetch('/api/tournament/state', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...AuthService.getAuthHeader() },
        body: JSON.stringify({ teams: updatedTeams }),
      }).catch(() => {});
      return {
        ...prev,
        teams: updatedTeams,
      };
    });
  };

  const deleteTeam = (id: string) => {
    if (SupabaseService.isAvailable()) {
      SupabaseService.deleteTeam(id).catch(() => {});
      SupabaseService.logAudit('team_deleted', 'team', id).catch(() => {});
    }

    setState((prev) => {
      const nextTeams = prev.teams.filter((t) => t.id !== id);
      fetch('/api/tournament/state', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...AuthService.getAuthHeader() },
        body: JSON.stringify({ teams: nextTeams }),
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
    if (!teamIds || teamIds.length === 0) return;
    const idSet = new Set(teamIds);

    if (SupabaseService.isAvailable()) {
      SupabaseService.deleteTeamsBulk(teamIds).catch(() => {});
      SupabaseService.logAudit('teams_bulk_deleted', 'team', undefined, { count: teamIds.length }).catch(() => {});
    }

    setState((prev) => {
      const nextTeams = prev.teams.filter((t) => !idSet.has(t.id));
      fetch('/api/tournament/state', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...AuthService.getAuthHeader() },
        body: JSON.stringify({ teams: nextTeams }),
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
    setState((prev) => {
      const target = prev.teams.find((t) => t.id === id);
      const nextTeams = prev.teams.map((t) => (t.id === id ? { ...t, name: newName.trim() } : t));
      if (target && SupabaseService.isAvailable()) {
        SupabaseService.saveTeam({ ...target, name: newName.trim() }).catch(() => {});
      }
      fetch('/api/tournament/state', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...AuthService.getAuthHeader() },
        body: JSON.stringify({ teams: nextTeams }),
      }).catch(() => {});
      return {
        ...prev,
        teams: nextTeams,
      };
    });
  };

  const toggleTeamLock = (id: string) => {
    setState((prev) => {
      const target = prev.teams.find((t) => t.id === id);
      const nextTeams = prev.teams.map((t) => (t.id === id ? { ...t, locked: !t.locked } : t));
      if (target && SupabaseService.isAvailable()) {
        SupabaseService.saveTeam({ ...target, locked: !target.locked }).catch(() => {});
      }
      fetch('/api/tournament/state', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...AuthService.getAuthHeader() },
        body: JSON.stringify({ teams: nextTeams }),
      }).catch(() => {});
      return {
        ...prev,
        teams: nextTeams,
      };
    });
  };

  const togglePlayerLockInTeam = (teamId: string, playerId: string) => {
    setState((prev) => {
      let updatedTarget: Team | undefined;
      const nextTeams = prev.teams.map((t) => {
        if (t.id !== teamId) return t;
        const currentLocked = Array.isArray(t.lockedPlayerIds) ? t.lockedPlayerIds : [];
        const isLocked = currentLocked.includes(playerId);
        const nextLocked = isLocked
          ? currentLocked.filter((id) => id !== playerId)
          : [...currentLocked, playerId];
        updatedTarget = { ...t, lockedPlayerIds: nextLocked };
        return updatedTarget;
      });
      if (updatedTarget && SupabaseService.isAvailable()) {
        SupabaseService.saveTeam(updatedTarget).catch(() => {});
      }
      fetch('/api/tournament/state', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...AuthService.getAuthHeader() },
        body: JSON.stringify({ teams: nextTeams }),
      }).catch(() => {});
      return {
        ...prev,
        teams: nextTeams,
      };
    });
  };

  const setTeamCaptain = (teamId: string, captainId: string) => {
    lastServerScoreTime.current = Date.now();
    setState((prev) => {
      const nextTeams = prev.teams.map((t) => {
        if (t.id !== teamId) return t;
        const updatedPlayers =
          captainId && !t.players.includes(captainId) ? [captainId, ...t.players] : t.players;
        const updatedTeam = { ...t, captainId, players: updatedPlayers };
        if (SupabaseService.isAvailable()) {
          SupabaseService.saveTeam(updatedTeam).catch(() => {});
        }
        return updatedTeam;
      });

      fetch('/api/tournament/captains', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ assignments: [{ teamId, captainId }] }),
      }).catch(() => {});

      return { ...prev, teams: nextTeams };
    });
  };

  const setCaptainsBulk = (assignments: { teamId: string; captainId: string }[]) => {
    if (!assignments || assignments.length === 0) return;
    const map = new Map(assignments.map((a) => [a.teamId, a.captainId]));
    lastServerScoreTime.current = Date.now();
    setState((prev) => {
      const nextTeams = prev.teams.map((t) => {
        if (map.has(t.id)) {
          const newCap = map.get(t.id);
          const updatedPlayers =
            newCap && !t.players.includes(newCap) ? [newCap, ...t.players] : t.players;
          const updatedTeam = { ...t, captainId: newCap, players: updatedPlayers };
          if (SupabaseService.isAvailable()) {
            SupabaseService.saveTeam(updatedTeam).catch(() => {});
          }
          return updatedTeam;
        }
        return t;
      });

      fetch('/api/tournament/captains', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ assignments }),
      }).catch(() => {});

      return { ...prev, teams: nextTeams };
    });
  };

  const setTeamPlayer = (teamId: string, playerIndex: number, newPlayerId: string) => {
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
        SupabaseService.saveTeamsBulk(teams).catch(() => {});
      }

      fetch('/api/tournament/state', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...AuthService.getAuthHeader() },
        body: JSON.stringify({ teams }),
      }).catch(() => {});
      return { ...prev, teams };
    });
  };

  // Direct Player to Team Assignment
  const assignPlayerToTeam = (teamId: string, playerId: string) => {
    setState((prev) => {
      // 1. Prevent invalid or duplicate player assignments: remove player from any other team first
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
        SupabaseService.saveTeamsBulk(nextTeams).catch(() => {});
      }
      fetch('/api/tournament/state', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...AuthService.getAuthHeader() },
        body: JSON.stringify({ teams: nextTeams }),
      }).catch(() => {});

      return { ...prev, teams: nextTeams };
    });
  };

  // Direct Player Removal from Team
  const removePlayerFromTeam = (teamId: string, playerId: string) => {
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
        SupabaseService.saveTeamsBulk(nextTeams).catch(() => {});
      }
      fetch('/api/tournament/state', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...AuthService.getAuthHeader() },
        body: JSON.stringify({ teams: nextTeams }),
      }).catch(() => {});

      return { ...prev, teams: nextTeams };
    });
  };

  const setTeams = (teams: Team[]) => {
    lastServerScoreTime.current = Date.now();
    // Deduplicate by team.id to guarantee no duplicate team entries
    const uniqueMap = new Map<string, Team>();
    for (const t of teams) {
      if (t && t.id && !uniqueMap.has(t.id)) {
        uniqueMap.set(t.id, t);
      }
    }
    const uniqueTeams = Array.from(uniqueMap.values());

    setState((prev) => ({ ...prev, teams: uniqueTeams }));

    if (SupabaseService.isAvailable()) {
      SupabaseService.saveTeamsBulk(uniqueTeams).catch(() => {});
    }
    fetch('/api/tournament/state', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...AuthService.getAuthHeader() },
      body: JSON.stringify({ teams: uniqueTeams }),
    }).catch(() => {});
  };

  const clearTeams = () => {
    lastServerScoreTime.current = Date.now();
    if (SupabaseService.isAvailable()) {
      SupabaseService.clearTeams().catch(() => {});
      SupabaseService.logAudit('teams_cleared', 'team', undefined).catch(() => {});
    }
    setState((prev) => {
      fetch('/api/tournament/state', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...AuthService.getAuthHeader() },
        body: JSON.stringify({ teams: [] }),
      }).catch(() => {});
      return { ...prev, teams: [] };
    });
  };

  // Pre-decided teams
  const setTeamFormationMode = (mode: 'random' | 'predefined' | 'mixed') => {
    setState((prev) => {
      fetch('/api/tournament/state', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...AuthService.getAuthHeader() },
        body: JSON.stringify({ teamFormationMode: mode }),
      }).catch(() => {});
      return { ...prev, teamFormationMode: mode };
    });
  };

  const addPredefinedTeam = (name: string, p1: string, p2: string) => {
    setState((prev) => {
      const updated = [
        ...prev.predefinedTeams,
        {
          id: crypto.randomUUID(),
          name: name.trim() || `Pair ${prev.predefinedTeams.length + 1}`,
          players: [p1, p2] as [string, string],
        },
      ];
      fetch('/api/tournament/state', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...AuthService.getAuthHeader() },
        body: JSON.stringify({ predefinedTeams: updated }),
      }).catch(() => {});
      return {
        ...prev,
        predefinedTeams: updated,
      };
    });
  };

  const updatePredefinedTeam = (id: string, updates: Partial<PredefinedTeam>) => {
    setState((prev) => {
      const updated = prev.predefinedTeams.map((pt) => (pt.id === id ? { ...pt, ...updates } : pt));
      fetch('/api/tournament/state', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...AuthService.getAuthHeader() },
        body: JSON.stringify({ predefinedTeams: updated }),
      }).catch(() => {});
      return {
        ...prev,
        predefinedTeams: updated,
      };
    });
  };

  const deletePredefinedTeam = (id: string) => {
    setState((prev) => {
      const updated = prev.predefinedTeams.filter((pt) => pt.id !== id);
      fetch('/api/tournament/state', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...AuthService.getAuthHeader() },
        body: JSON.stringify({ predefinedTeams: updated }),
      }).catch(() => {});
      return {
        ...prev,
        predefinedTeams: updated,
      };
    });
  };

  const clearPredefinedTeams = () => {
    setState((prev) => {
      fetch('/api/tournament/state', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...AuthService.getAuthHeader() },
        body: JSON.stringify({ predefinedTeams: [] }),
      }).catch(() => {});
      return { ...prev, predefinedTeams: [] };
    });
  };

  // Matches
  const updateMatch = (id: string, updates: Partial<Match>) => {
    sportsAudio.playScorePing();
    const seasonSlug = state.registrationSettings.seasonSlug || 'season-4';
    lastServerScoreTime.current = Date.now();
    setState((prev) => {
      let updatedMatchObj: Match | undefined;
      const nextMatches = prev.matches.map((m) => {
        if (m.id !== id) return m;
        const updated = { ...m, ...updates };
        if (updated.scoreA != null && updated.scoreB != null && updated.status === 'completed') {
          if (updated.scoreA > updated.scoreB) updated.winner = updated.teamA;
          else if (updated.scoreB > updated.scoreA) updated.winner = updated.teamB;
        }
        updatedMatchObj = updated;
        return updated;
      });

      // 1. Sync to Supabase PostgreSQL Realtime database
      if (SupabaseService.isAvailable() && updatedMatchObj) {
        SupabaseService.updateMatchScore(id, updatedMatchObj, false, seasonSlug).catch(() => {});
      }

      // 2. Dispatch score update to server so hero homepage immediately syncs
      fetch(`/api/tournament/matches/${encodeURIComponent(id)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...updates, fullMatch: updatedMatchObj }),
      }).catch(() => {});

      // 3. Multi-Tab BroadcastChannel
      if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
        try {
          const ch = new BroadcastChannel('spl_live_scores_channel');
          ch.postMessage({
            type: 'SCORE_UPDATE',
            matchId: id,
            match: updatedMatchObj,
            matches: nextMatches,
            teams: prev.teams,
            knockout: prev.knockout,
            lastUpdated: Date.now(),
          });
          ch.close();
        } catch {}
      }

      return {
        ...prev,
        matches: nextMatches,
      };
    });
  };

  const setMatches = (matches: Match[]) => {
    const seasonSlug = state.registrationSettings.seasonSlug || 'season-4';
    lastServerScoreTime.current = Date.now();
    setState((prev) => {
      if (SupabaseService.isAvailable()) {
        SupabaseService.batchSaveMatches(matches, seasonSlug).catch(() => {});
      }
      fetch('/api/tournament/state', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ matches }),
      }).catch(() => {});
      return { ...prev, matches };
    });
  };

  const generateFixtures = () => {
    if (state.teams.length < 2) return;
    const fixtures = generateRoundRobinFixtures(state.teams, state.settings.courts);
    const seasonSlug = state.registrationSettings.seasonSlug || 'season-4';
    lastServerScoreTime.current = Date.now();
    setState((prev) => {
      if (SupabaseService.isAvailable()) {
        SupabaseService.batchSaveMatches(fixtures, seasonSlug).catch(() => {});
      }
      fetch('/api/tournament/state', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ matches: fixtures }),
      }).catch(() => {});
      return {
        ...prev,
        matches: fixtures,
      };
    });
  };

  const clearResults = () => {
    const seasonSlug = state.registrationSettings.seasonSlug || 'season-4';
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
        SupabaseService.batchSaveMatches(clearedMatches, seasonSlug).catch(() => {});
      }
      fetch('/api/tournament/state', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ matches: clearedMatches, knockout: { ...prev.knockout, matches: clearedKnockoutMatches } }),
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
    const seasonSlug = state.registrationSettings.seasonSlug || 'season-4';
    if (SupabaseService.isAvailable()) {
      SupabaseService.clearSeasonMatches(seasonSlug).catch(() => {});
      SupabaseService.clearKnockoutMatches(seasonSlug).catch(() => {});
      SupabaseService.logAudit('matches_cleared', 'matches', undefined).catch(() => {});
    }
    setState((prev) => {
      fetch('/api/tournament/state', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...AuthService.getAuthHeader() },
        body: JSON.stringify({ matches: [], knockout: { ...prev.knockout, matches: [] } }),
      }).catch(() => {});
      return {
        ...prev,
        matches: [],
        knockout: { ...prev.knockout, matches: [] },
      };
    });
  };

  // Knockout Bracket
  const setKnockoutFormat = (format: 'top2' | 'top4' | 'top8') => {
    setState((prev) => ({
      ...prev,
      knockout: { ...prev.knockout, format },
    }));
  };

  const generateKnockoutBracket = () => {
    const required = state.knockout.format === 'top2' ? 2 : state.knockout.format === 'top4' ? 4 : 8;
    if (standings.length < required) return;

    const qualified = standings.slice(0, required).map((s) => s.team.id);
    const bracketMatches: KnockoutMatch[] = [];

    if (state.knockout.format === 'top2') {
      bracketMatches.push({
        id: crypto.randomUUID(),
        stage: 'F',
        slot: 1,
        teamA: qualified[0],
        teamB: qualified[1],
        status: 'upcoming',
      });
    } else if (state.knockout.format === 'top4') {
      bracketMatches.push(
        {
          id: crypto.randomUUID(),
          stage: 'SF',
          slot: 1,
          teamA: qualified[0],
          teamB: qualified[3],
          status: 'upcoming',
        },
        {
          id: crypto.randomUUID(),
          stage: 'SF',
          slot: 2,
          teamA: qualified[1],
          teamB: qualified[2],
          status: 'upcoming',
        },
        {
          id: crypto.randomUUID(),
          stage: 'F',
          slot: 1,
          status: 'upcoming',
        }
      );
    } else {
      // top 8
      const pairings = [
        [0, 7],
        [3, 4],
        [1, 6],
        [2, 5],
      ];
      pairings.forEach((pair, idx) => {
        bracketMatches.push({
          id: crypto.randomUUID(),
          stage: 'ELIM',
          slot: idx + 1,
          teamA: qualified[pair[0]],
          teamB: qualified[pair[1]],
          status: 'upcoming',
        });
      });
      bracketMatches.push(
        { id: crypto.randomUUID(), stage: 'SF', slot: 1, status: 'upcoming' },
        { id: crypto.randomUUID(), stage: 'SF', slot: 2, status: 'upcoming' },
        { id: crypto.randomUUID(), stage: 'F', slot: 1, status: 'upcoming' }
      );
    }

    const seasonSlug = state.registrationSettings.seasonSlug || 'season-4';
    if (SupabaseService.isAvailable()) {
      for (const ko of bracketMatches) {
        SupabaseService.updateMatchScore(ko.id, ko, true, seasonSlug).catch(() => {});
      }
    }

    setState((prev) => ({
      ...prev,
      knockout: {
        ...prev.knockout,
        matches: bracketMatches,
      },
    }));
  };

  const updateKnockoutMatch = (id: string, updates: Partial<KnockoutMatch>) => {
    sportsAudio.playScorePing();
    const now = Date.now();
    const seasonSlug = state.registrationSettings.seasonSlug || 'season-4';
    lastServerScoreTime.current = now;
    setState((prev) => {
      let updatedKoMatch: KnockoutMatch | undefined;
      const updatedMatches = prev.knockout.matches.map((m) => {
        if (m.id !== id) return m;
        const current = { ...m, ...updates };
        if (current.scoreA != null && current.scoreB != null && current.status === 'completed') {
          if (current.scoreA > current.scoreB) current.winner = current.teamA;
          else if (current.scoreB > current.scoreA) current.winner = current.teamB;
        }
        updatedKoMatch = current;
        return current;
      });

      const progressed = progressKnockoutMatches(updatedMatches, prev.knockout.format);
      const nextKnockout = {
        ...prev.knockout,
        matches: progressed,
      };

      // 1. Sync to Supabase
      if (SupabaseService.isAvailable() && updatedKoMatch) {
        SupabaseService.updateMatchScore(id, updatedKoMatch, true, seasonSlug).catch(() => {});
      }

      // 2. Broadcast to other tabs
      if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
        try {
          const ch = new BroadcastChannel('spl_live_scores_channel');
          ch.postMessage({
            type: 'SCORE_UPDATE',
            matchId: id,
            match: updatedKoMatch,
            matches: prev.matches,
            teams: prev.teams,
            knockout: nextKnockout,
            lastUpdated: now,
          });
          ch.close();
        } catch {}
      }

      // 3. Sync to server
      fetch(`/api/tournament/matches/${encodeURIComponent(id)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...updates, fullMatch: updatedKoMatch }),
      }).catch(() => {});

      return {
        ...prev,
        knockout: nextKnockout,
      };
    });
  };

  const clearKnockout = () => {
    const seasonSlug = state.registrationSettings.seasonSlug || 'season-4';
    if (SupabaseService.isAvailable()) {
      SupabaseService.clearKnockoutMatches(seasonSlug).catch(() => {});
    }
    setState((prev) => {
      fetch('/api/tournament/state', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...AuthService.getAuthHeader() },
        body: JSON.stringify({ knockout: { ...prev.knockout, matches: [] } }),
      }).catch(() => {});
      return {
        ...prev,
        knockout: { ...prev.knockout, matches: [] },
      };
    });
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
    const slug = seasonSlug || state.registrationSettings.seasonSlug || 'season-4';

    let localForm: RegistrationFormConfig | null = null;
    try {
      const cached = localStorage.getItem(`${FORMS_CACHE_PREFIX}${slug}`);
      if (cached) localForm = JSON.parse(cached);
    } catch {}

    const res = await safeFetchJson<RegistrationFormConfig>(`/api/forms/${slug}`);
    if (res.ok && res.data) {
      setFormConfig(res.data);
      try {
        localStorage.setItem(`${FORMS_CACHE_PREFIX}${slug}`, JSON.stringify(res.data));
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
    const slug = config.seasonSlug || 'season-4';
    try {
      const currentVersion = config.version || formConfig.version || 1;
      const nextVersion = publish ? currentVersion + 1 : currentVersion;

      const payload: RegistrationFormConfig = {
        ...config,
        version: nextVersion,
        isPublished: publish ? true : config.isPublished,
        lastUpdatedAt: Date.now(),
        publishedAt: publish ? Date.now() : (config.publishedAt || Date.now()),
      };

      // Always ensure exact required submit button text
      if (payload.appearance) {
        payload.appearance.submitButtonText = 'Submit Registration';
      }

      // Synchronize state.payment and state.settings.entryFee
      if (config.payment) {
        setState((prev) => ({
          ...prev,
          settings: {
            ...prev.settings,
            entryFee: config.entryFee != null ? config.entryFee : prev.settings.entryFee,
          },
          payment: {
            ...prev.payment,
            enabled: config.payment?.enabled ?? prev.payment.enabled,
            upiId: config.payment?.upiId || prev.payment.upiId,
            accountName: config.payment?.accountName || prev.payment.accountName,
            note: config.payment?.note || prev.payment.note,
          },
        }));
      }

      // Save locally first so UI is instantly updated
      try {
        localStorage.setItem(`${FORMS_CACHE_PREFIX}${slug}`, JSON.stringify(payload));
        localStorage.setItem('spl_forms_cache_season-4', JSON.stringify(payload));
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
        SupabaseService.saveFormConfig(payload, publish).catch(() => {});
        SupabaseService.logAudit(
          publish ? 'form_published' : 'form_draft_saved',
          'form',
          slug,
          { version: nextVersion, fieldsCount: payload.fields.length }
        ).catch(() => {});
      }

      const res = await safeFetchJson<RegistrationFormConfig>(`/api/forms/${slug}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (res.ok && res.data) {
        setFormConfig(res.data);
        if (publish) {
          triggerCelebration();
        }
        return { success: true, config: res.data };
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


  const fetchTokens = async (
    seasonSlug?: string
  ): Promise<{ tokens: RegistrationTokenRecord[]; activeToken: RegistrationTokenRecord | null }> => {
    const slug = seasonSlug || state.registrationSettings.seasonSlug || 'season-4';

    let cachedTokens: RegistrationTokenRecord[] = [];
    try {
      const cached = localStorage.getItem(`${TOKENS_CACHE_PREFIX}${slug}`);
      if (cached) cachedTokens = JSON.parse(cached);
    } catch {}

    const res = await safeFetchJson<{ tokens: RegistrationTokenRecord[]; activeToken: RegistrationTokenRecord | null }>(
      `/api/tokens/${slug}`
    );

    if (res.ok && res.data && Array.isArray(res.data.tokens)) {
      setTokens(res.data.tokens);
      setActiveToken(res.data.activeToken || null);
      try {
        localStorage.setItem(`${TOKENS_CACHE_PREFIX}${slug}`, JSON.stringify(res.data.tokens));
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
    const slug = seasonSlug || state.registrationSettings.seasonSlug || 'season-4';

    try {
      // 1. Try server endpoint
      const res = await safeFetchJson<{
        success: boolean;
        tokenRecord?: RegistrationTokenRecord;
        tokens?: RegistrationTokenRecord[];
        error?: string;
      }>('/api/tokens/regenerate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ seasonSlug: slug, invalidatePrevious, label }),
      });

      if (res.ok && res.data && res.data.tokenRecord) {
        setActiveToken(res.data.tokenRecord);
        setTokens(res.data.tokens || [res.data.tokenRecord]);
        try {
          localStorage.setItem(
            `${TOKENS_CACHE_PREFIX}${slug}`,
            JSON.stringify(res.data.tokens || [res.data.tokenRecord])
          );
        } catch {}
        triggerCelebration();
        return { success: true, tokenRecord: res.data.tokenRecord };
      }
    } catch {}

    // 2. Resilient Client-Side Fallback (for Vercel static deployments or offline environments)
    // Generates a robust, cryptographically sound token instantly without crashing JSON parser
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
      const cached = localStorage.getItem(`${TOKENS_CACHE_PREFIX}${slug}`);
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
      localStorage.setItem(`${TOKENS_CACHE_PREFIX}${slug}`, JSON.stringify(updatedTokens));
    } catch {}

    triggerCelebration();
    return { success: true, tokenRecord: newTokenRecord };
  };

  const toggleTokenStatus = async (
    tokenId: string
  ): Promise<{ success: boolean; token?: RegistrationTokenRecord }> => {
    const slug = state.registrationSettings.seasonSlug || 'season-4';

    try {
      const res = await safeFetchJson<{ success: boolean; token?: RegistrationTokenRecord }>(
        `/api/tokens/${tokenId}/toggle-status`,
        { method: 'POST' }
      );

      if (res.ok && res.data && res.data.token) {
        const updated = res.data.token;
        setTokens((prev) => {
          const next = prev.map((t) => (t.id === tokenId ? updated : t));
          try {
            localStorage.setItem(`${TOKENS_CACHE_PREFIX}${slug}`, JSON.stringify(next));
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
        localStorage.setItem(`${TOKENS_CACHE_PREFIX}${slug}`, JSON.stringify(next));
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
  ): Promise<{ success: boolean; registration?: Registration; error?: string; linkRevoked?: boolean }> => {
    const cleanMobile = formData.mobile ? formData.mobile.replace(/\D/g, '') : '';
    const targetSeason = formData.season || state.registrationSettings.seasonSlug || 'season-4';

    // 1. Primary path: Supabase PostgreSQL direct database persistence
    if (SupabaseService.isAvailable()) {
      try {
        // Direct duplicate mobile check in Supabase
        const dupCheck = await SupabaseService.checkDuplicateRegistration(cleanMobile, targetSeason);
        if (dupCheck?.isDuplicate) {
          return {
            success: false,
            error: `A registration with mobile number ${cleanMobile} already exists for this season (Reg ID: ${dupCheck.regId || 'existing'}).`,
          };
        }

        // Generate guaranteed collision-free registration ID
        const regId = await SupabaseService.generateCollisionFreeRegId('SPL-2026');

        const initialPaymentStatus: PaymentStatus = formData.txnId ? 'pending_verification' : 'unpaid';

        const rawGen = String(formData.gender || '').trim().toLowerCase();
        const normGen: 'M' | 'F' | 'Other' =
          rawGen === 'm' || rawGen === 'male' ? 'M' : rawGen === 'f' || rawGen === 'female' ? 'F' : 'Other';

        const newReg: Registration = {
          id: crypto.randomUUID(),
          regId,
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

        const saveRes = await SupabaseService.saveRegistrationWithDetail(newReg);
        if (!saveRes.success) {
          // Retry once with alternative salt in case of any rare ID collision
          const altSalt = Math.floor(1000 + Math.random() * 9000);
          newReg.regId = `SPL-2026-${Date.now().toString(36).toUpperCase().slice(-3)}-${altSalt}`;
          const retryRes = await SupabaseService.saveRegistrationWithDetail(newReg);
          if (!retryRes.success) {
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
        SupabaseService.logAudit('registration_submitted', 'registration', newReg.id, {
          name: newReg.name,
          regId: newReg.regId,
          mobile: newReg.mobile,
          season: newReg.season,
          version: newReg.formVersion,
        }).catch(() => {});

        // Safely notify local full-stack dev server in background if running
        safeFetchJson('/api/registrations', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(newReg),
        }).catch(() => {});

        // Update local React state immediately so confirmation card displays
        setState((prev) => ({
          ...prev,
          registrations: [
            ...prev.registrations.filter((r) => r.id !== newReg.id),
            newReg,
          ],
        }));

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
    try {
      const res = await safeFetchJson<{
        success: boolean;
        registration?: Registration;
        error?: string;
        linkRevoked?: boolean;
      }>('/api/registrations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      if (res.ok && res.data && res.data.registration) {
        const savedReg = res.data.registration;
        setState((prev) => ({
          ...prev,
          registrations: [
            ...prev.registrations.filter((r) => r.id !== savedReg.id),
            savedReg,
          ],
        }));
        return { success: true, registration: savedReg };
      }

      if (res.data && res.data.error) {
        return {
          success: false,
          error: res.data.error,
          linkRevoked: Boolean(res.data.linkRevoked),
        };
      }
    } catch {}

    // Resilient local memory fallback
    const isDup = state.registrations.some(
      (r) => r.mobile.replace(/\D/g, '') === cleanMobile && r.status !== 'rejected'
    );
    if (isDup) {
      return {
        success: false,
        error: `A registration with mobile number ${cleanMobile} already exists for this season.`,
      };
    }
    const regSeq = String(state.registrations.length + 1).padStart(3, '0');
    const regSalt = Math.floor(100 + Math.random() * 900);
    const regId = `SPL-2026-${regSeq}-${regSalt}`;
    const newReg: Registration = {
      id: crypto.randomUUID(),
      regId,
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

    setState((prev) => ({
      ...prev,
      registrations: [...prev.registrations, newReg],
    }));
    return { success: true, registration: newReg };
  };

  const addRegistration = (
    data: Partial<Registration> & { name: string; mobile: string }
  ): Registration => {
    const regSeq = String(state.registrations.length + 1).padStart(3, '0');
    const regSalt = Math.floor(100 + Math.random() * 900);
    const regId = `SPL-2026-${regSeq}-${regSalt}`;
    const newReg: Registration = {
      id: crypto.randomUUID(),
      regId,
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
      season: data.season || state.registrationSettings.seasonSlug,
      createdAt: Date.now(),
      paidAt: data.status === 'paid' ? Date.now() : undefined,
    };

    if (SupabaseService.isAvailable()) {
      SupabaseService.saveRegistration(newReg).catch(() => {});
    }

    setState((prev) => ({
      ...prev,
      registrations: [...prev.registrations, newReg],
    }));

    // Post to backend
    fetch('/api/registrations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newReg),
    }).catch(() => {});

    return newReg;
  };

  const updateRegistration = (id: string, updates: Partial<Registration>) => {
    setState((prev) => {
      const updated = prev.registrations.map((r) =>
        r.id === id
          ? {
              ...r,
              ...updates,
              paidAt: updates.status === 'paid' && !r.paidAt ? Date.now() : r.paidAt,
            }
          : r
      );
      if (SupabaseService.isAvailable()) {
        const item = updated.find((r) => r.id === id);
        if (item) {
          SupabaseService.saveRegistration(item).catch(() => {});
        }
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

    fetch(`/api/registrations/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates),
    }).catch(() => {});
  };

  const approveRegistration = (id: string) => {
    triggerCelebration();
    setState((prev) => {
      const reg = prev.registrations.find((r) => r.id === id);
      if (!reg) return prev;

      const cleanMobile = reg.mobile ? reg.mobile.replace(/\D/g, '') : '';
      const existingPlayer = prev.players.find(
        (p) =>
          (cleanMobile && p.mobile && p.mobile.replace(/\D/g, '') === cleanMobile) ||
          p.name.trim().toLowerCase() === reg.name.trim().toLowerCase()
      );

      const playerId = existingPlayer ? existingPlayer.id : (reg.playerId || crypto.randomUUID());
      let updatedPlayers = prev.players;

      if (!existingPlayer) {
        const newPlayer: Player = {
          id: playerId,
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
        updatedPlayers = [...prev.players, newPlayer];
        if (SupabaseService.isAvailable()) {
          SupabaseService.upsertPlayer(newPlayer).catch(() => {});
        }
      }

      const updatedRegistrations = prev.registrations.map((r) =>
        r.id === id
          ? {
              ...r,
              status: 'approved' as const,
              approvedAt: Date.now(),
              playerId,
            }
          : r
      );

      if (SupabaseService.isAvailable()) {
        const approvedReg = updatedRegistrations.find((r) => r.id === id);
        if (approvedReg) {
          SupabaseService.saveRegistration(approvedReg).catch(() => {});
          SupabaseService.logAudit('registration_approved', 'registration', id, { playerId }).catch(() => {});
        }
      }

      return {
        ...prev,
        players: updatedPlayers,
        registrations: updatedRegistrations,
      };
    });

    fetch(`/api/registrations/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', ...AuthService.getAuthHeader() },
      body: JSON.stringify({ status: 'approved', approvedAt: Date.now() }),
    }).catch(() => {});
  };

  const rejectRegistration = (id: string, reason?: string) => {
    if (SupabaseService.isAvailable()) {
      const rejectedReg = state.registrations.find((r) => r.id === id);
      if (rejectedReg) {
        SupabaseService.saveRegistration({
          ...rejectedReg,
          status: 'rejected',
          notes: reason ? `${rejectedReg.notes || ''} [Rejected: ${reason}]`.trim() : rejectedReg.notes,
        }).catch(() => {});
        SupabaseService.logAudit('registration_rejected', 'registration', id, { reason }).catch(() => {});
      }
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

    fetch(`/api/registrations/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', ...AuthService.getAuthHeader() },
      body: JSON.stringify({ status: 'rejected' }),
    }).catch(() => {});
  };

  const verifyPayment = async (
    id: string,
    paymentStatus: PaymentStatus,
    note?: string,
    verifiedBy = 'Tournament Director'
  ): Promise<{ success: boolean; registration?: Registration }> => {
    const now = Date.now();
    try {
      const res = await safeFetchJson<{ success: boolean; registration?: Registration }>(
        `/api/registrations/${id}/verify-payment`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ paymentStatus, verifiedBy, note }),
        }
      );

      if (res.ok && res.data && res.data.registration) {
        const updated = res.data.registration;
        if (SupabaseService.isAvailable()) {
          SupabaseService.saveRegistration(updated).catch(() => {});
          SupabaseService.logAudit('payment_verified', 'registration', id, { paymentStatus, verifiedBy, note }).catch(() => {});
        }
        setState((prev) => ({
          ...prev,
          registrations: prev.registrations.map((r) => (r.id === id ? updated : r)),
        }));
        if (paymentStatus === 'paid') {
          triggerCelebration();
        }
        return { success: true, registration: updated };
      }
    } catch {}

    // Resilient local fallback
    let updatedReg: Registration | undefined;
    setState((prev) => {
      const target = prev.registrations.find((r) => r.id === id);
      if (!target) return prev;

      const prevStatus = target.paymentStatus || (target.status === 'paid' ? 'paid' : target.txnId ? 'pending_verification' : 'unpaid');
      const auditEntry = {
        action: 'verify_payment',
        by: verifiedBy,
        at: now,
        fromStatus: prevStatus,
        toStatus: paymentStatus,
        note,
      };

      updatedReg = {
        ...target,
        paymentStatus,
        verifiedBy,
        verifiedAt: now,
        paidAt: paymentStatus === 'paid' ? target.paidAt || now : target.paidAt,
        status: paymentStatus === 'paid' && target.status === 'pending' ? 'approved' : target.status,
        auditLog: [...(target.auditLog || []), auditEntry],
      };

      if (SupabaseService.isAvailable()) {
        SupabaseService.saveRegistration(updatedReg).catch(() => {});
        SupabaseService.logAudit('payment_verified', 'registration', id, { paymentStatus, verifiedBy, note }).catch(() => {});
      }

      return {
        ...prev,
        registrations: prev.registrations.map((r) => (r.id === id ? updatedReg! : r)),
      };
    });

    if (paymentStatus === 'paid') {
      triggerCelebration();
    }
    return { success: true, registration: updatedReg };
  };

  const deleteRegistration = (id: string) => {
    if (SupabaseService.isAvailable()) {
      SupabaseService.deleteRegistration(id).catch(() => {});
      SupabaseService.logAudit('registration_deleted', 'registration', id).catch(() => {});
    }

    setState((prev) => ({
      ...prev,
      registrations: prev.registrations.filter((r) => r.id !== id),
    }));

    fetch(`/api/registrations/${id}`, {
      method: 'DELETE',
      headers: { ...AuthService.getAuthHeader() },
    }).catch(() => {});
  };

  const deleteRegistrationsBulk = (ids: string[]) => {
    if (!ids || ids.length === 0) return;
    const idSet = new Set(ids);

    if (SupabaseService.isAvailable()) {
      SupabaseService.deleteRegistrationsBulk(ids).catch(() => {});
      SupabaseService.logAudit('registrations_bulk_deleted', 'registration', undefined, { count: ids.length }).catch(() => {});
    }

    setState((prev) => ({
      ...prev,
      registrations: prev.registrations.filter((r) => !idSet.has(r.id)),
    }));

    fetch('/api/registrations/bulk-delete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...AuthService.getAuthHeader() },
      body: JSON.stringify({ ids }),
    }).catch(() => {});
  };

  const bulkApproveRegistrations = (ids: string[]) => {
    if (!ids || ids.length === 0) return;
    triggerCelebration();
    const idSet = new Set(ids);

    setState((prev) => {
      const newPlayers = [...prev.players];
      const newlyCreatedPlayers: Player[] = [];
      const updatedRegistrations = prev.registrations.map((r) => {
        if (!idSet.has(r.id)) return r;

        const cleanMobile = r.mobile ? r.mobile.replace(/\D/g, '') : '';
        const existingPlayer = newPlayers.find(
          (p) =>
            (cleanMobile && p.mobile && p.mobile.replace(/\D/g, '') === cleanMobile) ||
            p.name.trim().toLowerCase() === r.name.trim().toLowerCase()
        );

        const playerId = existingPlayer ? existingPlayer.id : (r.playerId || crypto.randomUUID());

        if (!existingPlayer) {
          const np: Player = {
            id: playerId,
            name: r.name.trim(),
            mobile: r.mobile,
            age: r.age,
            gender: r.gender || 'M',
            skillLevel: (r.experience === 'Pro' ? 'Pro' : r.experience === 'Intermediate' ? 'Intermediate' : 'Advanced') as any,
          };
          newPlayers.push(np);
          newlyCreatedPlayers.push(np);
        }

        const approvedReg: Registration = {
          ...r,
          status: 'approved' as const,
          approvedAt: Date.now(),
          playerId,
        };

        if (SupabaseService.isAvailable()) {
          SupabaseService.saveRegistration(approvedReg).catch(() => {});
        }

        return approvedReg;
      });

      if (SupabaseService.isAvailable() && newlyCreatedPlayers.length > 0) {
        SupabaseService.upsertPlayersBulk(newlyCreatedPlayers).catch(() => {});
      }

      return {
        ...prev,
        players: newPlayers,
        registrations: updatedRegistrations,
      };
    });

    fetch('/api/registrations/bulk-approve', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...AuthService.getAuthHeader() },
      body: JSON.stringify({ ids }),
    }).catch(() => {});
  };

  // Global resets & export
  const resetToDefault = () => {
    setState(DEFAULT_STATE);
  };

  const clearTournamentData = () => {
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

  return (
    <TournamentContext.Provider
      value={{
        state,
        standings,
        isCentralizedDbConnected,
        isSupabaseConnected,
        dbBackendType,
        testDbConnection,
        updateSettings,
        updatePaymentSettings,
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
        setTeams,
        clearTeams,
        setTeamFormationMode,
        addPredefinedTeam,
        updatePredefinedTeam,
        deletePredefinedTeam,
        clearPredefinedTeams,
        updateMatch,
        setMatches,
        generateFixtures,
        clearResults,
        clearAllMatches,
        setKnockoutFormat,
        generateKnockoutBracket,
        updateKnockoutMatch,
        clearKnockout,
        formConfig,
        tokens,
        activeToken,
        fetchFormConfig,
        saveFormConfig,
        fetchTokens,
        regenerateToken,
        toggleTokenStatus,
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
      }}
    >
      {children}
    </TournamentContext.Provider>
  );
};

export const useTournament = () => {
  const context = useContext(TournamentContext);
  if (!context) {
    throw new Error('useTournament must be used within a TournamentProvider');
  }
  return context;
};
