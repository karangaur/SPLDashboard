import React, { createContext, useContext, useEffect, useState, useMemo } from 'react';
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

  // Sync with persistent backend on startup
  useEffect(() => {
    const seasonSlug = state.registrationSettings.seasonSlug || 'season-4';

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
        enabled: paymentUpdate.enabled ?? prev.payment?.enabled ?? true,
        upiId: paymentUpdate.upiId ?? prev.payment?.upiId ?? 'smashleague@icici',
        accountName: paymentUpdate.accountName ?? prev.payment?.accountName ?? 'Smash Premier League Tournament',
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
    setState((prev) => ({
      ...prev,
      teams: prev.teams.map((t) => {
        if (t.id !== teamId) return t;
        const updatedPlayers =
          captainId && !t.players.includes(captainId) ? [...t.players, captainId] : t.players;
        return { ...t, captainId, players: updatedPlayers };
      }),
    }));
  };

  const setCaptainsBulk = (assignments: { teamId: string; captainId: string }[]) => {
    if (!assignments || assignments.length === 0) return;
    const map = new Map(assignments.map((a) => [a.teamId, a.captainId]));
    setState((prev) => ({
      ...prev,
      teams: prev.teams.map((t) => {
        if (map.has(t.id)) {
          const newCap = map.get(t.id);
          const updatedPlayers =
            newCap && !t.players.includes(newCap) ? [...t.players, newCap] : t.players;
          return { ...t, captainId: newCap, players: updatedPlayers };
        }
        return t;
      }),
    }));
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
      return { ...prev, teams };
    });
  };

  const setTeams = (teams: Team[]) => {
    setState((prev) => ({ ...prev, teams }));
  };

  const clearTeams = () => {
    setState((prev) => ({ ...prev, teams: [] }));
  };

  // Pre-decided teams
  const setTeamFormationMode = (mode: 'random' | 'predefined' | 'mixed') => {
    setState((prev) => ({ ...prev, teamFormationMode: mode }));
  };

  const addPredefinedTeam = (name: string, p1: string, p2: string) => {
    setState((prev) => ({
      ...prev,
      predefinedTeams: [
        ...prev.predefinedTeams,
        {
          id: crypto.randomUUID(),
          name: name.trim() || `Pair ${prev.predefinedTeams.length + 1}`,
          players: [p1, p2],
        },
      ],
    }));
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
    setState((prev) => ({
      ...prev,
      matches: prev.matches.map((m) => {
        if (m.id !== id) return m;
        const updated = { ...m, ...updates };
        if (updated.scoreA != null && updated.scoreB != null && updated.status === 'completed') {
          if (updated.scoreA > updated.scoreB) updated.winner = updated.teamA;
          else if (updated.scoreB > updated.scoreA) updated.winner = updated.teamB;
        }
        return updated;
      }),
    }));
  };

  const setMatches = (matches: Match[]) => {
    setState((prev) => ({ ...prev, matches }));
  };

  const generateFixtures = () => {
    if (state.teams.length < 2) return;
    const fixtures = generateRoundRobinFixtures(state.teams, state.settings.courts);
    setState((prev) => ({
      ...prev,
      matches: fixtures,
    }));
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
    setState((prev) => {
      const updatedMatches = prev.knockout.matches.map((m) => {
        if (m.id !== id) return m;
        const current = { ...m, ...updates };
        if (current.scoreA != null && current.scoreB != null && current.status === 'completed') {
          if (current.scoreA > current.scoreB) current.winner = current.teamA;
          else if (current.scoreB > current.scoreA) current.winner = current.teamB;
        }
        return current;
      });

      const progressed = progressKnockoutMatches(updatedMatches, prev.knockout.format);
      return {
        ...prev,
        knockout: {
          ...prev.knockout,
          matches: progressed,
        },
      };
    });
  };

  const clearKnockout = () => {
    setState((prev) => ({
      ...prev,
      knockout: { ...prev.knockout, matches: [] },
    }));
  };

  // Form Customizer & Token Link Handlers
  const fetchFormConfig = async (seasonSlug?: string): Promise<RegistrationFormConfig> => {
    const slug = seasonSlug || state.registrationSettings.seasonSlug || 'season-4';
    try {
      const res = await fetch(`/api/forms/${slug}`);
      if (res.ok) {
        const data = await res.json();
        setFormConfig(data);
        return data;
      }
    } catch (e) {
      console.warn('Failed to fetch form config from server:', e);
    }
    return formConfig;
  };

  const saveFormConfig = async (
    config: RegistrationFormConfig,
    publish = false
  ): Promise<{ success: boolean; config?: RegistrationFormConfig; error?: string }> => {
    try {
      const payload = {
        ...config,
        isPublished: publish ? true : config.isPublished,
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

      const res = await fetch(`/api/forms/${config.seasonSlug || 'season-4'}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        const saved = await res.json();
        setFormConfig(saved);
        if (publish) {
          triggerCelebration();
        }
        return { success: true, config: saved };
      }
      return { success: false, error: 'Server returned error saving form configuration' };
    } catch (e: any) {
      setFormConfig(config);
      return { success: true, config };
    }
  };

  const fetchTokens = async (
    seasonSlug?: string
  ): Promise<{ tokens: RegistrationTokenRecord[]; activeToken: RegistrationTokenRecord | null }> => {
    const slug = seasonSlug || state.registrationSettings.seasonSlug || 'season-4';
    try {
      const res = await fetch(`/api/tokens/${slug}`);
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.tokens)) {
          setTokens(data.tokens);
          setActiveToken(data.activeToken || null);
          return { tokens: data.tokens, activeToken: data.activeToken || null };
        }
      }
    } catch (e) {
      console.warn('Failed to fetch tokens from server:', e);
    }
    return { tokens, activeToken };
  };

  const regenerateToken = async (
    seasonSlug: string,
    invalidatePrevious: boolean,
    label?: string
  ): Promise<{ success: boolean; tokenRecord?: RegistrationTokenRecord; error?: string }> => {
    try {
      const res = await fetch('/api/tokens/regenerate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ seasonSlug, invalidatePrevious, label }),
      });
      const data = await res.json();
      if (res.ok && data.tokenRecord) {
        setActiveToken(data.tokenRecord);
        setTokens(data.tokens || []);
        triggerCelebration();
        return { success: true, tokenRecord: data.tokenRecord };
      }
      return { success: false, error: data.error || 'Failed to regenerate token' };
    } catch (e: any) {
      return { success: false, error: e?.message || 'Network error while regenerating link' };
    }
  };

  const toggleTokenStatus = async (
    tokenId: string
  ): Promise<{ success: boolean; token?: RegistrationTokenRecord }> => {
    try {
      const res = await fetch(`/api/tokens/${tokenId}/toggle-status`, {
        method: 'POST',
      });
      const data = await res.json();
      if (res.ok && data.token) {
        setTokens((prev) => prev.map((t) => (t.id === tokenId ? data.token : t)));
        if (activeToken && activeToken.id === tokenId) {
          setActiveToken(data.token);
        }
        return { success: true, token: data.token };
      }
    } catch (e) {}
    return { success: false };
  };

  // Registrations (Public submissions & Admin vetting)
  const submitPublicRegistration = async (
    formData: any
  ): Promise<{ success: boolean; registration?: Registration; error?: string; linkRevoked?: boolean }> => {
    try {
      const res = await fetch('/api/registrations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });
      const data = await res.json();
      if (!res.ok) {
        return {
          success: false,
          error: data.error || 'Failed to submit registration',
          linkRevoked: Boolean(data.linkRevoked),
        };
      }
      if (data.registration) {
        setState((prev) => ({
          ...prev,
          registrations: [
            ...prev.registrations.filter((r) => r.id !== data.registration.id),
            data.registration,
          ],
        }));
      }
      return { success: true, registration: data.registration };
    } catch (err: any) {
      console.warn('Backend API unavailable, using resilient local storage:', err);
      // Local fallback
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
    }
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
