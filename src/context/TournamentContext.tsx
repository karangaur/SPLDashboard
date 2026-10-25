import React, { createContext, useContext, useEffect, useState, useMemo } from 'react';
import {
  TournamentState,
  Player,
  Team,
  Match,
  KnockoutMatch,
  Registration,
  TournamentSettings,
  PaymentSettings,
  PredefinedTeam,
} from '../types/tournament';
import {
  STORAGE_KEY,
  DEFAULT_STATE,
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
  
  // Players
  addPlayer: (name: string, details?: Partial<Player>) => Player;
  bulkAddPlayers: (names: string[]) => void;
  updatePlayer: (id: string, updates: Partial<Player>) => void;
  deletePlayer: (id: string) => void;
  clearPlayers: () => void;
  
  // Teams
  addTeam: (name: string, players?: string[], captainId?: string) => Team;
  updateTeam: (id: string, updates: Partial<Team>) => void;
  deleteTeam: (id: string) => void;
  renameTeam: (id: string, newName: string) => void;
  toggleTeamLock: (id: string) => void;
  setTeamCaptain: (teamId: string, captainId: string) => void;
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
  
  // Registrations
  addRegistration: (reg: Omit<Registration, 'id' | 'playerId' | 'regId' | 'createdAt'>) => Registration;
  updateRegistration: (id: string, updates: Partial<Registration>) => void;
  deleteRegistration: (id: string) => void;
  
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
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        return {
          ...DEFAULT_STATE,
          ...parsed,
          settings: { ...DEFAULT_STATE.settings, ...parsed.settings },
          payment: { ...DEFAULT_STATE.payment, ...parsed.payment },
          knockout: { ...DEFAULT_STATE.knockout, ...parsed.knockout },
        };
      }
    } catch (e) {
      console.warn('Failed to parse stored tournament state, falling back to default:', e);
    }
    return DEFAULT_STATE;
  });

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
      teams: prev.teams.map((t) => (t.id === teamId ? { ...t, captainId } : t)),
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

  // Registrations
  const addRegistration = (
    data: Omit<Registration, 'id' | 'playerId' | 'regId' | 'createdAt'>
  ): Registration => {
    const pId = crypto.randomUUID();
    const regId = `SPL-${new Date().getFullYear()}-${String(state.registrations.length + 1).padStart(3, '0')}`;
    const newReg: Registration = {
      ...data,
      id: crypto.randomUUID(),
      playerId: pId,
      regId,
      createdAt: Date.now(),
      paidAt: data.status === 'paid' ? Date.now() : undefined,
    };

    const newPlayer: Player = {
      id: pId,
      name: data.name,
      mobile: data.mobile,
      age: data.age,
      gender: data.gender,
      skillLevel: 'Advanced',
    };

    setState((prev) => ({
      ...prev,
      registrations: [...prev.registrations, newReg],
      players: [...prev.players, newPlayer],
    }));

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
  };

  const deleteRegistration = (id: string) => {
    setState((prev) => {
      const reg = prev.registrations.find((r) => r.id === id);
      return {
        ...prev,
        registrations: prev.registrations.filter((r) => r.id !== id),
        players: reg ? prev.players.filter((p) => p.id !== reg.playerId) : prev.players,
      };
    });
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
        addPlayer,
        bulkAddPlayers,
        updatePlayer,
        deletePlayer,
        clearPlayers,
        addTeam,
        updateTeam,
        deleteTeam,
        renameTeam,
        toggleTeamLock,
        setTeamCaptain,
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
        addRegistration,
        updateRegistration,
        deleteRegistration,
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
