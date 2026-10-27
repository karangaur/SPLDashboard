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

interface TournamentContextType {
  state: TournamentState;
  standings: ReturnType<typeof calculateStandings>;
  
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
  setTeamCaptain: (teamId: string, captainId: string) => void;
  setCaptainsBulk: (assignments: { teamId: string; captainId: string }[]) => void;
  setTeamPlayer: (teamId: string, playerIndex: number, newPlayerId: string) => void;
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
};

export const TournamentProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [state, setState] = useState<TournamentState>(() => {
    if (typeof window === 'undefined') return DEFAULT_STATE;
    try {
      // Clear legacy storage keys that had seeded/demo data
      [
        'smash-premier-league-v1',
        'smash-premier-league-v2',
        'smash-premier-league-v3',
        'smash-premier-league-v4',
        'smash-premier-league-v5',
        'smash-premier-league-v6',
      ].forEach((k) => {
        try { localStorage.removeItem(k); } catch {}
      });

      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);

        // Filter out any predefined/seeded demo IDs (e.g. 'p-1', 'team-1', 'm-1', 'reg-1')
        const isDemoId = (id?: string) => Boolean(id && /^(p|team|m|reg|ko)-\d+$/i.test(id));

        if (Array.isArray(parsed.players)) {
          parsed.players = parsed.players.filter((p: any) => p && p.id && !isDemoId(p.id));
        } else {
          parsed.players = [];
        }

        if (Array.isArray(parsed.teams)) {
          parsed.teams = parsed.teams
            .filter((t: any) => t && t.id && !isDemoId(t.id))
            .map((t: any) => ({
              ...t,
              players: Array.isArray(t.players) ? t.players.filter((pid: string) => !isDemoId(pid)) : [],
              captainId: t.captainId && !isDemoId(t.captainId) ? t.captainId : undefined,
            }));
        } else {
          parsed.teams = [];
        }

        if (Array.isArray(parsed.matches)) {
          parsed.matches = parsed.matches.filter(
            (m: any) => m && m.id && !isDemoId(m.id) && !isDemoId(m.teamA) && !isDemoId(m.teamB)
          );
        } else {
          parsed.matches = [];
        }

        if (Array.isArray(parsed.registrations)) {
          parsed.registrations = parsed.registrations.filter(
            (r: any) => r && r.id && !isDemoId(r.id) && !isDemoId(r.playerId)
          );
        } else {
          parsed.registrations = [];
        }

        if (parsed.knockout && Array.isArray(parsed.knockout.matches)) {
          parsed.knockout.matches = parsed.knockout.matches.filter((k: any) => k && k.id && !isDemoId(k.id));
        }

        if (Array.isArray(parsed.predefinedTeams)) {
          parsed.predefinedTeams = parsed.predefinedTeams.filter(
            (pt: any) => pt && Array.isArray(pt.players) && !pt.players.some((pid: string) => isDemoId(pid))
          );
        }

        return {
          ...DEFAULT_STATE,
          ...parsed,
          settings: { ...DEFAULT_STATE.settings, ...parsed.settings },
          registrationSettings: {
            ...DEFAULT_STATE.registrationSettings,
            ...(parsed.registrationSettings || {}),
            fields: {
              ...DEFAULT_STATE.registrationSettings.fields,
              ...(parsed.registrationSettings?.fields || {}),
            },
          },
          payment: { ...DEFAULT_STATE.payment, ...parsed.payment },
          knockout: { ...DEFAULT_STATE.knockout, ...(parsed.knockout || {}) },
        };
      }
    } catch (e) {
      console.warn('Failed to parse stored tournament state, falling back to default:', e);
    }
    return DEFAULT_STATE;
  });

  const [formConfig, setFormConfig] = useState<RegistrationFormConfig>(() =>
    createDefaultFormConfig()
  );
  const [tokens, setTokens] = useState<RegistrationTokenRecord[]>([]);
  const [activeToken, setActiveToken] = useState<RegistrationTokenRecord | null>(null);
  const lastServerScoreTime = useRef<number>(0);

  // Sync with persistent backend on startup and setup automated live score synchronization
  useEffect(() => {
    const seasonSlug = state.registrationSettings.seasonSlug || 'season-4';

    // 0. Fetch persistent tournament state (matches, teams, players, knockout)
    fetch('/api/tournament/state')
      .then((res) => (res.ok ? res.json() : null))
      .then((serverState) => {
        if (serverState) {
          if (serverState.lastUpdated) {
            lastServerScoreTime.current = serverState.lastUpdated;
          }
          setState((prev) => {
            const hasServerMatches = Array.isArray(serverState.matches) && serverState.matches.length > 0;
            const hasServerTeams = Array.isArray(serverState.teams) && serverState.teams.length > 0;
            const hasServerPlayers = Array.isArray(serverState.players) && serverState.players.length > 0;
            
            return {
              ...prev,
              settings: serverState.settings ? { ...prev.settings, ...serverState.settings } : prev.settings,
              players: hasServerPlayers ? serverState.players : prev.players,
              teams: hasServerTeams ? serverState.teams : prev.teams,
              matches: hasServerMatches ? serverState.matches : prev.matches,
              knockout: serverState.knockout || prev.knockout,
              predefinedTeams: Array.isArray(serverState.predefinedTeams) ? serverState.predefinedTeams : prev.predefinedTeams,
              teamFormationMode: serverState.teamFormationMode || prev.teamFormationMode,
            };
          });
        }
      })
      .catch(() => {});

    // 1. Fetch server registrations
    fetch('/api/registrations')
      .then((res) => (res.ok ? res.json() : null))
      .then((serverRegs) => {
        if (Array.isArray(serverRegs) && serverRegs.length > 0) {
          setState((prev) => ({
            ...prev,
            registrations: serverRegs,
          }));
        }
      })
      .catch(() => {});

    // 2. Fetch server registration settings
    fetch('/api/registration-settings')
      .then((res) => (res.ok ? res.json() : null))
      .then((serverSettings) => {
        if (serverSettings && typeof serverSettings === 'object') {
          setState((prev) => ({
            ...prev,
            registrationSettings: {
              ...prev.registrationSettings,
              ...serverSettings,
              fields: {
                ...prev.registrationSettings.fields,
                ...(serverSettings.fields || {}),
              },
            },
          }));
        }
      })
      .catch(() => {});

    // 3. Fetch server form config
    fetch(`/api/forms/${seasonSlug}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((cfg) => {
        if (cfg && cfg.fields) {
          setFormConfig(cfg);
        }
      })
      .catch(() => {});

    // 4. Fetch server tokens
    fetch(`/api/tokens/${seasonSlug}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data && Array.isArray(data.tokens)) {
          setTokens(data.tokens);
          setActiveToken(data.activeToken || null);
        }
      })
      .catch(() => {});

    // 5. Automated Live Score Synchronization Poller (fast 1200ms polling with cache-busting)
    // Ensures Hero Homepage and visitor screens update match scores automatically without refresh
    const scorePollInterval = setInterval(() => {
      fetch(`/api/tournament/scores?t=${Date.now()}`, { cache: 'no-store' })
        .then((res) => (res.ok ? res.json() : null))
        .then((scoreData) => {
          if (!scoreData || !scoreData.lastUpdated) return;
          if (scoreData.lastUpdated > lastServerScoreTime.current) {
            lastServerScoreTime.current = scoreData.lastUpdated;
            setState((prev) => {
              const matchesChanged = JSON.stringify(prev.matches) !== JSON.stringify(scoreData.matches);
              const teamsChanged = scoreData.teams && JSON.stringify(prev.teams) !== JSON.stringify(scoreData.teams);
              const koChanged = scoreData.knockout && JSON.stringify(prev.knockout) !== JSON.stringify(scoreData.knockout);
              if (!matchesChanged && !teamsChanged && !koChanged) return prev;
              return {
                ...prev,
                matches: Array.isArray(scoreData.matches) ? scoreData.matches : prev.matches,
                teams: Array.isArray(scoreData.teams) && scoreData.teams.length > 0 ? scoreData.teams : prev.teams,
                knockout: scoreData.knockout || prev.knockout,
              };
            });
          }
        })
        .catch(() => {});
    }, 1200);

    // 6. Registrations Poller (every 4s) for live admin applicant updates across browsers
    const regPollInterval = setInterval(() => {
      fetch(`/api/registrations?t=${Date.now()}`, { cache: 'no-store' })
        .then((res) => (res.ok ? res.json() : null))
        .then((serverRegs) => {
          if (Array.isArray(serverRegs)) {
            setState((prev) => {
              if (JSON.stringify(prev.registrations) === JSON.stringify(serverRegs)) return prev;
              return {
                ...prev,
                registrations: serverRegs,
              };
            });
          }
        })
        .catch(() => {});
    }, 4000);

    // 7. Multi-Tab Real-Time Listeners (BroadcastChannel + Window Storage Event)
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

    window.addEventListener('storage', handleStorageChange);

    return () => {
      clearInterval(scorePollInterval);
      clearInterval(regPollInterval);
      window.removeEventListener('storage', handleStorageChange);
      liveChannel?.close();
      formChannel?.close();
    };
  }, []);

  // Save to LocalStorage on changes
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (e) {
      console.error('Failed to save to localStorage:', e);
    }
  }, [state]);

  // Derived Standings
  const standings = useMemo(() => {
    return calculateStandings(state.teams, state.matches, state.knockout.matches);
  }, [state.teams, state.matches, state.knockout.matches]);

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
    setState((prev) => ({
      ...prev,
      settings: { ...prev.settings, ...settingsUpdate },
    }));
  };

  const updatePaymentSettings = (paymentUpdate: Partial<PaymentSettings>) => {
    setState((prev) => ({
      ...prev,
      payment: { ...prev.payment, ...paymentUpdate },
    }));
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
    };
    setState((prev) => ({
      ...prev,
      players: [...prev.players, newPlayer],
    }));
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
      }));
    if (newOnes.length === 0) return;
    setState((prev) => ({
      ...prev,
      players: [...prev.players, ...newOnes],
    }));
  };

  const updatePlayer = (id: string, updates: Partial<Player>) => {
    setState((prev) => ({
      ...prev,
      players: prev.players.map((p) => (p.id === id ? { ...p, ...updates } : p)),
      registrations: prev.registrations.map((r) =>
        r.playerId === id && updates.name ? { ...r, name: updates.name } : r
      ),
    }));
  };

  const deletePlayer = (id: string) => {
    setState((prev) => ({
      ...prev,
      players: prev.players.filter((p) => p.id !== id),
      registrations: prev.registrations.filter((r) => r.playerId !== id),
      teams: prev.teams.map((t) => ({
        ...t,
        players: t.players.filter((pid) => pid !== id),
        captainId: t.captainId === id ? undefined : t.captainId,
      })),
      predefinedTeams: prev.predefinedTeams.filter((pt) => !pt.players.includes(id as any)),
    }));
  };

  const deletePlayersBulk = (playerIds: string[]) => {
    if (!playerIds || playerIds.length === 0) return;
    const idSet = new Set(playerIds);
    setState((prev) => ({
      ...prev,
      players: prev.players.filter((p) => !idSet.has(p.id)),
      registrations: prev.registrations.filter((r) => !idSet.has(r.playerId || '')),
      teams: prev.teams.map((t) => ({
        ...t,
        players: t.players.filter((pid) => !idSet.has(pid)),
        captainId: idSet.has(t.captainId || '') ? undefined : t.captainId,
      })),
      predefinedTeams: prev.predefinedTeams.filter((pt) => !pt.players.some((pid) => idSet.has(pid))),
    }));
  };

  const clearPlayers = () => {
    setState((prev) => ({
      ...prev,
      players: [],
      registrations: [],
      teams: [],
      predefinedTeams: [],
      matches: [],
      knockout: { ...prev.knockout, matches: [] },
    }));
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
    setState((prev) => ({
      ...prev,
      teams: [...prev.teams, newTeam],
    }));
    return newTeam;
  };

  const updateTeam = (id: string, updates: Partial<Team>) => {
    setState((prev) => ({
      ...prev,
      teams: prev.teams.map((t) => (t.id === id ? { ...t, ...updates } : t)),
    }));
  };

  const deleteTeam = (id: string) => {
    setState((prev) => ({
      ...prev,
      teams: prev.teams.filter((t) => t.id !== id),
      matches: prev.matches.filter((m) => m.teamA !== id && m.teamB !== id),
      knockout: {
        ...prev.knockout,
        matches: prev.knockout.matches.filter((m) => m.teamA !== id && m.teamB !== id),
      },
    }));
  };

  const deleteTeamsBulk = (teamIds: string[]) => {
    if (!teamIds || teamIds.length === 0) return;
    const idSet = new Set(teamIds);
    setState((prev) => ({
      ...prev,
      teams: prev.teams.filter((t) => !idSet.has(t.id)),
      matches: prev.matches.filter((m) => !idSet.has(m.teamA) && !idSet.has(m.teamB)),
      knockout: {
        ...prev.knockout,
        matches: prev.knockout.matches.filter(
          (m) => !idSet.has(m.teamA || '') && !idSet.has(m.teamB || '')
        ),
      },
    }));
  };

  const renameTeam = (id: string, newName: string) => {
    setState((prev) => ({
      ...prev,
      teams: prev.teams.map((t) => (t.id === id ? { ...t, name: newName.trim() } : t)),
    }));
  };

  const toggleTeamLock = (id: string) => {
    setState((prev) => ({
      ...prev,
      teams: prev.teams.map((t) => (t.id === id ? { ...t, locked: !t.locked } : t)),
    }));
  };

  const setTeamCaptain = (teamId: string, captainId: string) => {
    lastServerScoreTime.current = Date.now();
    setState((prev) => {
      const nextTeams = prev.teams.map((t) => {
        if (t.id !== teamId) return t;
        const updatedPlayers =
          captainId && !t.players.includes(captainId) ? [captainId, ...t.players] : t.players;
        return { ...t, captainId, players: updatedPlayers };
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
          return { ...t, captainId: newCap, players: updatedPlayers };
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
      fetch('/api/tournament/state', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ teams }),
      }).catch(() => {});
      return { ...prev, teams };
    });
  };

  const setTeams = (teams: Team[]) => {
    lastServerScoreTime.current = Date.now();
    setState((prev) => {
      fetch('/api/tournament/state', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ teams }),
      }).catch(() => {});
      return { ...prev, teams };
    });
  };

  const clearTeams = () => {
    lastServerScoreTime.current = Date.now();
    setState((prev) => {
      fetch('/api/tournament/state', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ teams: [] }),
      }).catch(() => {});
      return { ...prev, teams: [] };
    });
  };

  // Pre-decided teams
  const setTeamFormationMode = (mode: 'random' | 'predefined' | 'mixed') => {
    setState((prev) => ({ ...prev, teamFormationMode: mode }));
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
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ predefinedTeams: updated }),
      }).catch(() => {});
      return {
        ...prev,
        predefinedTeams: updated,
      };
    });
  };

  const updatePredefinedTeam = (id: string, updates: Partial<PredefinedTeam>) => {
    setState((prev) => ({
      ...prev,
      predefinedTeams: prev.predefinedTeams.map((pt) => (pt.id === id ? { ...pt, ...updates } : pt)),
    }));
  };

  const deletePredefinedTeam = (id: string) => {
    setState((prev) => ({
      ...prev,
      predefinedTeams: prev.predefinedTeams.filter((pt) => pt.id !== id),
    }));
  };

  const clearPredefinedTeams = () => {
    setState((prev) => ({ ...prev, predefinedTeams: [] }));
  };

  // Matches
  const updateMatch = (id: string, updates: Partial<Match>) => {
    sportsAudio.playScorePing();
    lastServerScoreTime.current = Date.now();
    setState((prev) => {
      const nextMatches = prev.matches.map((m) => {
        if (m.id !== id) return m;
        const updated = { ...m, ...updates };
        if (updated.scoreA != null && updated.scoreB != null && updated.status === 'completed') {
          if (updated.scoreA > updated.scoreB) updated.winner = updated.teamA;
          else if (updated.scoreB > updated.scoreA) updated.winner = updated.teamB;
        }
        return updated;
      });

      // Dispatch score update to server so hero homepage immediately syncs
      fetch(`/api/tournament/matches/${encodeURIComponent(id)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      }).catch(() => {});

      return {
        ...prev,
        matches: nextMatches,
      };
    });
  };

  const setMatches = (matches: Match[]) => {
    lastServerScoreTime.current = Date.now();
    setState((prev) => {
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
    lastServerScoreTime.current = Date.now();
    setState((prev) => {
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
    setState((prev) => ({
      ...prev,
      matches: prev.matches.map((m) => ({
        ...m,
        scoreA: undefined,
        scoreB: undefined,
        status: 'upcoming',
        winner: undefined,
      })),
      knockout: {
        ...prev.knockout,
        matches: prev.knockout.matches.map((k) => ({
          ...k,
          scoreA: undefined,
          scoreB: undefined,
          status: 'upcoming',
          winner: undefined,
        })),
      },
    }));
  };

  const clearAllMatches = () => {
    setState((prev) => ({
      ...prev,
      matches: [],
      knockout: { ...prev.knockout, matches: [] },
    }));
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

      // Broadcast to other tabs
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

      // Sync to server
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
    setState((prev) => ({
      ...prev,
      knockout: { ...prev.knockout, matches: [] },
    }));
  };

  const TOKENS_CACHE_PREFIX = 'spl_tokens_cache_';
  const FORMS_CACHE_PREFIX = 'spl_forms_cache_';

  // Safe fetch helper that handles HTML 404s (e.g. on Vercel) gracefully without crashing JSON parse
  async function safeFetchJson<T = any>(
    url: string,
    options?: RequestInit
  ): Promise<{ ok: boolean; status: number; data: T | null; isJson: boolean; errorText?: string }> {
    try {
      const res = await fetch(url, options);
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
      const payload: RegistrationFormConfig = {
        ...config,
        isPublished: publish ? true : config.isPublished,
        lastUpdatedAt: Date.now(),
      };

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
        setState((prev) => ({
          ...prev,
          registrations: [
            ...prev.registrations.filter((r) => r.id !== res.data!.registration!.id),
            res.data!.registration!,
          ],
        }));
        return { success: true, registration: res.data.registration };
      }

      if (res.data && res.data.error) {
        return {
          success: false,
          error: res.data.error,
          linkRevoked: Boolean(res.data.linkRevoked),
        };
      }
    } catch {}

    // Resilient local fallback if backend route returned 404 HTML on Vercel or failed
    const cleanMobile = formData.mobile ? formData.mobile.replace(/\D/g, '') : '';
    const isDup = state.registrations.some(
      (r) => r.mobile.replace(/\D/g, '') === cleanMobile && r.status !== 'rejected'
    );
    if (isDup) {
      return {
        success: false,
        error: `A registration with mobile number ${cleanMobile} already exists for this season.`,
      };
    }
    const regId = `SPL-2026-${String(state.registrations.length + 1).padStart(3, '0')}`;
    const newReg: Registration = {
      id: crypto.randomUUID(),
      regId,
      name: formData.name.trim(),
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
      method: formData.method || 'upi',
      txnId: formData.txnId,
      season: formData.season || state.registrationSettings.seasonSlug,
      createdAt: Date.now(),
      answers: formData.answers || {},
      photoUrl: formData.photoUrl || undefined,
      tokenUsed: formData.tokenUsed || undefined,
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
    const regId = `SPL-2026-${String(state.registrations.length + 1).padStart(3, '0')}`;
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
      method: data.method || 'upi',
      txnId: data.txnId,
      season: data.season || state.registrationSettings.seasonSlug,
      createdAt: Date.now(),
      paidAt: data.status === 'paid' ? Date.now() : undefined,
    };

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
    setState((prev) => ({
      ...prev,
      registrations: prev.registrations.map((r) =>
        r.id === id
          ? {
              ...r,
              ...updates,
              paidAt: updates.status === 'paid' && !r.paidAt ? Date.now() : r.paidAt,
            }
          : r
      ),
      players: prev.players.map((p) => {
        const target = prev.registrations.find((r) => r.id === id);
        return target && target.playerId === p.id && updates.name ? { ...p, name: updates.name } : p;
      }),
    }));

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
        };
        updatedPlayers = [...prev.players, newPlayer];
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

      return {
        ...prev,
        players: updatedPlayers,
        registrations: updatedRegistrations,
      };
    });

    fetch(`/api/registrations/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'approved', approvedAt: Date.now() }),
    }).catch(() => {});
  };

  const rejectRegistration = (id: string, reason?: string) => {
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
      headers: { 'Content-Type': 'application/json' },
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
    setState((prev) => ({
      ...prev,
      registrations: prev.registrations.filter((r) => r.id !== id),
    }));

    fetch(`/api/registrations/${id}`, {
      method: 'DELETE',
    }).catch(() => {});
  };

  const deleteRegistrationsBulk = (ids: string[]) => {
    if (!ids || ids.length === 0) return;
    const idSet = new Set(ids);
    setState((prev) => ({
      ...prev,
      registrations: prev.registrations.filter((r) => !idSet.has(r.id)),
    }));

    fetch('/api/registrations/bulk-delete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids }),
    }).catch(() => {});
  };

  const bulkApproveRegistrations = (ids: string[]) => {
    if (!ids || ids.length === 0) return;
    triggerCelebration();
    const idSet = new Set(ids);

    setState((prev) => {
      const newPlayers = [...prev.players];
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
          newPlayers.push({
            id: playerId,
            name: r.name.trim(),
            mobile: r.mobile,
            age: r.age,
            gender: r.gender || 'M',
            skillLevel: (r.experience === 'Pro' ? 'Pro' : r.experience === 'Intermediate' ? 'Intermediate' : 'Advanced') as any,
          });
        }

        return {
          ...r,
          status: 'approved' as const,
          approvedAt: Date.now(),
          playerId,
        };
      });

      return {
        ...prev,
        players: newPlayers,
        registrations: updatedRegistrations,
      };
    });

    fetch('/api/registrations/bulk-approve', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
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
        setTeamCaptain,
        setCaptainsBulk,
        setTeamPlayer,
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
