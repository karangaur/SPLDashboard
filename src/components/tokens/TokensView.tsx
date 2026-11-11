import React, { useState, useRef, useEffect, useMemo } from 'react';
import {
  Dices,
  Crown,
  Lock,
  Unlock,
  Volume2,
  VolumeX,
  Share2,
  Copy,
  Trash2,
} from 'lucide-react';
import { useTournament, sportsAudio } from '../../context/TournamentContext';
import { ConfirmModal } from '../common/ConfirmModal';
import { RandomCaptainsModal } from '../common/RandomCaptainsModal';
import { Team, PredefinedTeam } from '../../types/tournament';

const TOKEN_LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');
const GRADIENT_PALETTES = [
  'from-rose-500 to-pink-600',
  'from-amber-500 to-orange-600',
  'from-emerald-500 to-green-600',
  'from-sky-500 to-blue-600',
  'from-violet-500 to-purple-600',
  'from-fuchsia-500 to-pink-600',
  'from-teal-500 to-cyan-600',
  'from-indigo-500 to-blue-600',
];

const getTokenLabel = (index: number): string =>
  index < TOKEN_LETTERS.length ? TOKEN_LETTERS[index] : `${index + 1}`;

// Unbiased Fisher-Yates shuffle returning a new array
function shuffleArray<T>(items: readonly T[]): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

// Canonical signature of teammate combinations (order-independent across teams and within teams)
function getPairingSignature(teams: readonly { players: string[] }[]): string {
  return teams
    .map((t) => [...t.players].sort().join('+'))
    .sort()
    .join('|');
}

// Canonical signature of specific team-to-roster assignments
function getRosterSignature(teams: readonly { id: string; players: string[] }[]): string {
  return teams
    .map((t) => `${t.id}:${[...t.players].sort().join(',')}`)
    .join('|');
}

export const TokensView: React.FC = () => {
  const {
    state,
    setTeams,
    clearTeams,
    setTeamFormationMode,
    addPredefinedTeam,
    deletePredefinedTeam,
    toggleTeamLock,
    togglePlayerLockInTeam,
    setCaptainsBulk,
    generateFixtures,
    triggerCelebration,
  } = useTournament();

  // Always keep a ref to the latest tournament state so setInterval callbacks never read stale closures
  const stateRef = useRef(state);
  stateRef.current = state;

  // Deduplicated existing registered teams (authoritative eligible team list)
  const existingTeams = useMemo(() => {
    const map = new Map<string, Team>();
    for (const t of state.teams) {
      if (t && t.id && !map.has(t.id)) {
        map.set(t.id, t);
      }
    }
    return Array.from(map.values());
  }, [state.teams]);

  const [soundEnabled, setSoundEnabled] = useState(true);
  const [playersPerTeam, setPlayersPerTeam] = useState(2);
  const [isDrawing, setIsDrawing] = useState(false);
  const [spinningSlotNames, setSpinningSlotNames] = useState<string[]>([]);
  const [showClearConfirm, setShowClearConfirm] = useState(false);

  const eligiblePlayers = state.players;
  const maxPossibleTeams = Math.max(1, Math.floor(eligiblePlayers.length / playersPerTeam) || 4);

  // Smart default team count:
  // 1. If teams already exist in state.teams, match existingTeams.length
  // 2. Else if predefined pairs exist, match predefinedTeams.length
  // 3. Else if players exist, calculate from players / playersPerTeam
  // 4. Fallback to 4 so it is never stuck at 0
  const calculatedTeamCount = useMemo(() => {
    if (existingTeams.length > 0) return existingTeams.length;
    if (state.predefinedTeams.length > 0) return state.predefinedTeams.length;
    if (eligiblePlayers.length >= playersPerTeam) {
      return Math.max(1, Math.floor(eligiblePlayers.length / playersPerTeam));
    }
    if (eligiblePlayers.length > 0) return eligiblePlayers.length;
    return 4;
  }, [existingTeams.length, state.predefinedTeams.length, eligiblePlayers.length, playersPerTeam]);

  const [numTeams, setNumTeams] = useState<number>(calculatedTeamCount);

  // Synchronous ref locks to prevent duplicate/concurrent spin executions
  const isSpinningRef = useRef(false);
  const spinIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Keep numTeams synchronized when existingTeams or player pool changes
  useEffect(() => {
    setNumTeams(calculatedTeamCount);
  }, [calculatedTeamCount]);

  // Cleanup any active spin interval on unmount
  useEffect(() => {
    return () => {
      if (spinIntervalRef.current) {
        clearInterval(spinIntervalRef.current);
        spinIntervalRef.current = null;
      }
      isSpinningRef.current = false;
    };
  }, []);

  // Pre-decided pairs form
  const [pairName, setPairName] = useState('');
  const [pairP1, setPairP1] = useState('');
  const [pairP2, setPairP2] = useState('');

  // Captain slots & selection modal
  const [selectedCaptains, setSelectedCaptains] = useState<string[]>([]);
  const [isCaptainModalOpen, setIsCaptainModalOpen] = useState(false);
  const [toastMsg, setToastMsg] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  const showNotice = (text: string, type: 'success' | 'error' = 'error') => {
    setToastMsg({ text, type });
    setTimeout(() => setToastMsg(null), 4000);
  };

  // O(1) Player lookup map to avoid repeated O(N) array scans
  const playerById = useMemo(() => {
    const map = new Map<string, (typeof state.players)[number]>();
    for (const p of state.players) {
      if (p && p.id) map.set(p.id, p);
    }
    return map;
  }, [state.players]);

  // Set of player IDs that belong to a locked pair in state.predefinedTeams
  const lockedPairByPlayerId = useMemo(() => {
    const map = new Map<string, PredefinedTeam>();
    for (const pt of state.predefinedTeams) {
      for (const pid of pt.players) {
        if (pid) map.set(pid, pt);
      }
    }
    return map;
  }, [state.predefinedTeams]);

  // Open interactive Random Captains Modal with preview, draw again, and edit controls
  const handleRandomCaptains = () => {
    const requiredCaptains = existingTeams.length > 0 ? existingTeams.length : numTeams;
    if (eligiblePlayers.length < requiredCaptains) {
      showNotice(
        `Need at least ${requiredCaptains} registered players to draw captains, but only ${eligiblePlayers.length} are available.`,
        'error'
      );
      return;
    }
    setIsCaptainModalOpen(true);
  };

  const handleConfirmCaptainsFromModal = (assignments: { teamId: string; captainId: string }[]) => {
    if (existingTeams.length > 0) {
      setCaptainsBulk(assignments);
      showNotice(`Updated captains for ${assignments.length} registered team(s).`, 'success');
    }
    setSelectedCaptains(assignments.map((a) => a.captainId));
    setIsCaptainModalOpen(false);
  };

  // Assign 1 unique shuffled token to each team without changing team count or IDs
  const assignUniqueTokensToTeams = (teamsList: Team[]): Team[] => {
    const count = teamsList.length;
    if (count === 0) return [];

    const allTokens = Array.from({ length: count }, (_, idx) => getTokenLabel(idx));
    const validTokenSet = new Set(allTokens);

    const hasUnlockedTeams = teamsList.some((t) => !t.locked);
    const reservedTokens = new Set<string>();
    const lockedTokenByTeamId = new Map<string, string>();

    if (hasUnlockedTeams) {
      for (const t of teamsList) {
        if (t.locked && t.token && validTokenSet.has(t.token) && !reservedTokens.has(t.token)) {
          reservedTokens.add(t.token);
          lockedTokenByTeamId.set(t.id, t.token);
        }
      }
    }

    const availableTokens = shuffleArray(allTokens.filter((tok) => !reservedTokens.has(tok)));

    // Ensure regeneration produces a fresh token order when 2+ teams are unlocked
    if (availableTokens.length > 1) {
      const unlockedTeams = teamsList.filter((t) => !lockedTokenByTeamId.has(t.id));
      const isIdentical = unlockedTeams.every((t, i) => t.token && t.token === availableTokens[i]);
      if (isIdentical) {
        const first = availableTokens.shift()!;
        availableTokens.push(first);
      }
    }

    let cursor = 0;
    return teamsList.map((team, idx) => {
      const assignedToken = lockedTokenByTeamId.get(team.id) || availableTokens[cursor++];
      const tokenIndex = Math.max(0, TOKEN_LETTERS.indexOf(assignedToken));
      return {
        ...team,
        id: team.id,
        name: team.name,
        players: [...team.players],
        captainId: team.captainId,
        locked: Boolean(team.locked),
        lockedPlayerIds: Array.isArray(team.lockedPlayerIds) ? [...team.lockedPlayerIds] : [],
        badge: team.badge || '🏸',
        avatarColor:
          team.avatarColor ||
          GRADIENT_PALETTES[(tokenIndex >= 0 ? tokenIndex : idx) % GRADIENT_PALETTES.length],
        token: assignedToken,
      };
    });
  };

  // Run snappy lottery draw & immediate randomization
  const handleRunLotteryDraw = () => {
    if (isSpinningRef.current || isDrawing) {
      return;
    }

    const latestState = stateRef.current;
    const latestTeams = latestState.teams;
    const latestPlayers = latestState.players;

    if (latestState.teamFormationMode === 'predefined') {
      if (latestState.predefinedTeams.length === 0 && latestTeams.length === 0) {
        showNotice('Please lock at least one doubles pair or create teams first.', 'error');
        return;
      }
    } else {
      if (
        latestTeams.length === 0 &&
        latestPlayers.length === 0 &&
        latestState.predefinedTeams.length === 0
      ) {
        showNotice(
          'No registered teams or players found. Please add players or create teams first.',
          'error'
        );
        return;
      }
    }

    isSpinningRef.current = true;
    setIsDrawing(true);
    if (soundEnabled) sportsAudio.playScorePing();

    const activeCount =
      latestTeams.length > 0
        ? latestTeams.length
        : latestState.teamFormationMode === 'predefined' && latestState.predefinedTeams.length > 0
        ? latestState.predefinedTeams.length
        : numTeams;

    const tokenPool = Array.from({ length: Math.max(1, activeCount) }, (_, i) => getTokenLabel(i));
    const slotCount = Math.min(4, Math.max(2, activeCount));

    const buildPreview = (step: number) =>
      Array.from({ length: slotCount }).map((_, idx) => {
        const randTok = tokenPool[(step + idx) % tokenPool.length] || getTokenLabel(idx);
        if (latestPlayers.length > 0) {
          const p = latestPlayers[(step * 3 + idx) % latestPlayers.length];
          return `Token ${randTok} · ${p?.name || 'Player'}`;
        }
        if (latestTeams.length > 0) {
          const t = latestTeams[(step + idx) % latestTeams.length];
          return `Token ${randTok} · ${t?.name || 'Team'}`;
        }
        return `Token ${randTok}`;
      });

    setSpinningSlotNames(buildPreview(1));

    if (spinIntervalRef.current) {
      clearInterval(spinIntervalRef.current);
    }

    // Fast 160ms visual transition (2 crisp ticks at 80ms instead of 18 slow ticks)
    let iterations = 0;
    spinIntervalRef.current = setInterval(() => {
      iterations++;
      if (iterations < 2) {
        setSpinningSlotNames(buildPreview(iterations + 1));
      } else {
        if (spinIntervalRef.current) {
          clearInterval(spinIntervalRef.current);
          spinIntervalRef.current = null;
        }
        finalizeTokenAssignment();
      }
    }, 80);
  };

  // Finalize lottery draw: genuinely reshuffle unlocked players while strictly preserving
  // locked teams, locked pairs (state.predefinedTeams), and locked players (team.lockedPlayerIds).
  const finalizeTokenAssignment = () => {
    try {
      const currentState = stateRef.current;
      const currentPlayers = currentState.players;
      const currentPredefinedPairs = currentState.predefinedTeams;
      const mode = currentState.teamFormationMode;

      // Build O(1) lookup map for current players
      const fastPlayerMap = new Map<string, (typeof currentPlayers)[number]>();
      for (const p of currentPlayers) {
        if (p && p.id) fastPlayerMap.set(p.id, p);
      }

      // Deduplicate current teams by ID
      const currentTeamsMap = new Map<string, Team>();
      for (const t of currentState.teams) {
        if (t && t.id && !currentTeamsMap.has(t.id)) {
          currentTeamsMap.set(t.id, t);
        }
      }
      const currentTeams = Array.from(currentTeamsMap.values());

      // Helper to resolve player's first name for auto-named teams in O(1)
      const getAutoTeamName = (
        existingName: string | undefined,
        oldCaptainId: string | undefined,
        newCaptainId: string | undefined,
        fallbackIndex: number
      ): string => {
        const newCap = newCaptainId ? fastPlayerMap.get(newCaptainId) : undefined;
        const oldCap = oldCaptainId ? fastPlayerMap.get(oldCaptainId) : undefined;
        const trimmed = (existingName || '').trim();
        const isGeneric =
          !trimmed ||
          /^Team\s+[A-Z0-9]+$/i.test(trimmed) ||
          (oldCap && trimmed.toLowerCase() === `team ${oldCap.name.split(' ')[0].toLowerCase()}`);
        if (isGeneric && newCap) {
          return `Team ${newCap.name.split(' ')[0]}`;
        }
        return trimmed || (newCap ? `Team ${newCap.name.split(' ')[0]}` : `Team ${getTokenLabel(fallbackIndex)}`);
      };

      // =========================================================================
      // MODE 1: PRE-DECIDED TEAMS ONLY ('predefined')
      // =========================================================================
      if (mode === 'predefined') {
        if (currentPredefinedPairs.length > 0) {
          const baseTeams: Team[] = currentPredefinedPairs.map((pt, idx) => {
            const existingMatch = currentTeams.find(
              (t) =>
                t.id === pt.id ||
                (t.players.length === pt.players.length &&
                  pt.players.every((pid) => t.players.includes(pid)))
            );
            return {
              id: existingMatch?.id || pt.id,
              name: pt.name || existingMatch?.name || `Team ${getTokenLabel(idx)}`,
              players: [...pt.players],
              captainId: existingMatch?.captainId || pt.players[0],
              locked: true,
              lockedPlayerIds: [...pt.players],
              badge: existingMatch?.badge || '🏸',
              avatarColor:
                existingMatch?.avatarColor || GRADIENT_PALETTES[idx % GRADIENT_PALETTES.length],
              token: existingMatch?.token,
            };
          });
          const withTokens = assignUniqueTokensToTeams(baseTeams);
          setTeams(withTokens);
          triggerCelebration();
          showNotice(
            `Generated ${withTokens.length} unique token(s) for ${withTokens.length} pre-decided team(s).`,
            'success'
          );
          return;
        }

        if (currentTeams.length > 0) {
          const withTokens = assignUniqueTokensToTeams(currentTeams);
          setTeams(withTokens);
          triggerCelebration();
          showNotice(
            `Generated ${withTokens.length} unique token(s) for ${withTokens.length} existing team(s).`,
            'success'
          );
          return;
        }
      }

      // =========================================================================
      // MODE 2 & 3: RANDOM OR MIXED SHUFFLE (WITH OR WITHOUT EXISTING TEAMS)
      // =========================================================================
      // Build valid locked pairs from state.predefinedTeams (pairs of 2 valid players)
      const validPlayerIdSet = new Set(currentPlayers.map((p) => p.id));
      const activeLockedPairs: { id: string; name: string; players: [string, string] }[] = [];
      const pairedPlayerIds = new Set<string>();

      for (const pt of currentPredefinedPairs) {
        const [p1, p2] = pt.players;
        if (
          p1 &&
          p2 &&
          p1 !== p2 &&
          !pairedPlayerIds.has(p1) &&
          !pairedPlayerIds.has(p2) &&
          (validPlayerIdSet.size === 0 || (validPlayerIdSet.has(p1) && validPlayerIdSet.has(p2)))
        ) {
          activeLockedPairs.push({ id: pt.id, name: pt.name, players: [p1, p2] });
          pairedPlayerIds.add(p1);
          pairedPlayerIds.add(p2);
        }
      }

      // Determine the target team templates:
      // If currentTeams already exist, we strictly preserve the exact number of teams and their IDs.
      // If no teams exist yet, we create the initial team shells for the draw.
      const targetTeamCount =
        currentTeams.length > 0
          ? currentTeams.length
          : Math.max(
              activeLockedPairs.length,
              numTeams > 0 ? numTeams : calculatedTeamCount
            );

      const teamShells: Team[] =
        currentTeams.length > 0
          ? currentTeams.map((t) => ({
              ...t,
              players: [...t.players],
              lockedPlayerIds: Array.isArray(t.lockedPlayerIds) ? [...t.lockedPlayerIds] : [],
            }))
          : Array.from({ length: targetTeamCount }, (_, idx) => ({
              id: crypto.randomUUID(),
              name: `Team ${getTokenLabel(idx)}`,
              players: [],
              captainId: undefined,
              locked: false,
              lockedPlayerIds: [],
              badge: '🏸',
              avatarColor: GRADIENT_PALETTES[idx % GRADIENT_PALETTES.length],
            }));

      // Step 1: Identify strictly locked teams (`team.locked === true`)
      // Wait: if a team was marked `locked: true` ONLY because it held a predefined pair, or manually locked by admin,
      // `team.locked === true` keeps that entire team 100% untouched.
      const reservedPlayerIds = new Set<string>();
      const lockedTeamIds = new Set<string>();

      for (const team of teamShells) {
        if (team.locked) {
          lockedTeamIds.add(team.id);
          team.players.forEach((pid) => reservedPlayerIds.add(pid));
        }
      }

      // Step 2: Identify locked pairs that are NOT already inside a locked team
      const remainingLockedPairs = activeLockedPairs.filter(
        (pair) => !reservedPlayerIds.has(pair.players[0]) && !reservedPlayerIds.has(pair.players[1])
      );
      for (const pair of remainingLockedPairs) {
        reservedPlayerIds.add(pair.players[0]);
        reservedPlayerIds.add(pair.players[1]);
      }

      // Step 3: For each unlocked team, determine its fixed/locked players (`team.lockedPlayerIds`)
      // Note: if a player in `team.lockedPlayerIds` is part of a `remainingLockedPairs`, the pair rule keeps them with their partner.
      const fixedPlayersByTeamId = new Map<string, string[]>();
      const pairAssignedToTeamId = new Map<string, { id: string; name: string; players: [string, string] }>();

      // First, if an unlocked team ALREADY contains both members of a remainingLockedPair, keep that pair on that team
      const unassignedPairsPool: { id: string; name: string; players: [string, string] }[] = [];
      for (const pair of remainingLockedPairs) {
        const matchingUnlockedTeam = teamShells.find(
          (t) =>
            !lockedTeamIds.has(t.id) &&
            !pairAssignedToTeamId.has(t.id) &&
            pair.players.every((pid) => t.players.includes(pid))
        );
        if (matchingUnlockedTeam) {
          pairAssignedToTeamId.set(matchingUnlockedTeam.id, pair);
        } else {
          unassignedPairsPool.push(pair);
        }
      }

      // Next, record individual locked players (`lockedPlayerIds`) on unlocked teams that don't have a full pair assigned
      for (const team of teamShells) {
        if (lockedTeamIds.has(team.id)) continue;
        if (pairAssignedToTeamId.has(team.id)) {
          fixedPlayersByTeamId.set(team.id, [...pairAssignedToTeamId.get(team.id)!.players]);
          continue;
        }
        const pinned = (team.lockedPlayerIds || []).filter(
          (pid) =>
            pid &&
            team.players.includes(pid) &&
            !reservedPlayerIds.has(pid)
        );
        pinned.forEach((pid) => reservedPlayerIds.add(pid));
        fixedPlayersByTeamId.set(team.id, pinned);
      }

      // If there are still unassigned locked pairs, assign them to unlocked teams that have 0 pinned players
      const emptyUnlockedTeams = teamShells.filter(
        (t) =>
          !lockedTeamIds.has(t.id) &&
          !pairAssignedToTeamId.has(t.id) &&
          (fixedPlayersByTeamId.get(t.id)?.length || 0) === 0
      );
      for (const pair of unassignedPairsPool) {
        const targetShell = emptyUnlockedTeams.shift();
        if (targetShell) {
          pairAssignedToTeamId.set(targetShell.id, pair);
          fixedPlayersByTeamId.set(targetShell.id, [...pair.players]);
        }
      }

      // Step 4: Collect the pool of all eligible UNLOCKED players
      // Priority:
      // - All unlocked players currently on unlocked teams
      // - Plus any unassigned players in `currentPlayers` so every eligible player can participate
      const unlockedPoolSet = new Set<string>();

      for (const team of teamShells) {
        if (lockedTeamIds.has(team.id)) continue;
        for (const pid of team.players) {
          if (pid && !reservedPlayerIds.has(pid)) {
            unlockedPoolSet.add(pid);
          }
        }
      }

      for (const p of currentPlayers) {
        if (p.id && !reservedPlayerIds.has(p.id)) {
          unlockedPoolSet.add(p.id);
        }
      }

      const unlockedPool = Array.from(unlockedPoolSet);

      // Calculate how many open player slots exist across unlocked teams
      let totalOpenSlots = 0;
      for (const team of teamShells) {
        if (lockedTeamIds.has(team.id)) continue;
        const fixedCount = fixedPlayersByTeamId.get(team.id)?.length || 0;
        const cap = Math.max(playersPerTeam, team.players.length || playersPerTeam);
        totalOpenSlots += Math.max(0, cap - fixedCount);
      }

      // Edge Case A: All teams/players are locked (0 open slots or 0 unlocked players)
      if (totalOpenSlots === 0 || unlockedPool.length === 0) {
        const preservedTeams = teamShells.map((team, idx) => {
          const assignedPair = pairAssignedToTeamId.get(team.id);
          if (assignedPair) {
            return {
              ...team,
              name: assignedPair.name || team.name,
              players: [...assignedPair.players],
              captainId: team.captainId || assignedPair.players[0],
              token: team.token || getTokenLabel(idx),
            };
          }
          return {
            ...team,
            token: team.token || getTokenLabel(idx),
          };
        });
        setTeams(preservedTeams);
        showNotice(
          'All teams or player positions are currently locked. Unlock at least two players or teams to reshuffle.',
          'error'
        );
        return;
      }

      // Step 5: Build candidate team arrangements using unbiased Fisher-Yates shuffle
      // and guarantee that consecutive spins produce a genuinely different arrangement
      // whenever more than 1 valid arrangement exists.
      const prevPairingSig = currentTeams.length > 0 ? getPairingSignature(currentTeams) : '';
      const prevRosterSig = currentTeams.length > 0 ? getRosterSignature(currentTeams) : '';

      const buildCandidateTeams = (shuffledUnlocked: string[]): Team[] => {
        const poolCopy = [...shuffledUnlocked];

        // If creating initial teams and user pre-selected captains via "Draw Random Captains",
        // place those captains into unlocked teams first if they aren't already fixed.
        const activeSelectedCaptains =
          currentTeams.length === 0
            ? shuffleArray(selectedCaptains.filter((cid) => poolCopy.includes(cid)))
            : [];

        return teamShells.map((team, idx) => {
          // 1. Locked team: preserve 100% unchanged
          if (lockedTeamIds.has(team.id)) {
            return {
              ...team,
              players: [...team.players],
              lockedPlayerIds: Array.isArray(team.lockedPlayerIds) ? [...team.lockedPlayerIds] : [],
            };
          }

          // 2. Team with a locked pair: keep the pair together
          const assignedPair = pairAssignedToTeamId.get(team.id);
          if (assignedPair) {
            const pairRoster = [...assignedPair.players];
            while (pairRoster.length < playersPerTeam && poolCopy.length > 0) {
              pairRoster.push(poolCopy.shift()!);
            }
            return {
              ...team,
              name: assignedPair.name || team.name,
              players: pairRoster,
              captainId:
                team.captainId && pairRoster.includes(team.captainId)
                  ? team.captainId
                  : pairRoster[0],
              lockedPlayerIds: Array.isArray(team.lockedPlayerIds) ? [...team.lockedPlayerIds] : [],
            };
          }

          // 3. Unlocked team: start with any individually locked players (`lockedPlayerIds`),
          // then fill remaining slots from the freshly shuffled unlocked pool.
          const fixedPlayers = [...(fixedPlayersByTeamId.get(team.id) || [])];
          const roster = [...fixedPlayers];

          if (roster.length === 0 && activeSelectedCaptains.length > 0) {
            const chosenCap = activeSelectedCaptains.shift()!;
            const poolIdx = poolCopy.indexOf(chosenCap);
            if (poolIdx !== -1) {
              poolCopy.splice(poolIdx, 1);
              roster.push(chosenCap);
            }
          }

          const targetSize = Math.max(playersPerTeam, fixedPlayers.length);
          while (roster.length < targetSize && poolCopy.length > 0) {
            roster.push(poolCopy.shift()!);
          }

          // Determine captain: if previous captain is locked to this team, keep them;
          // otherwise the first player in the new roster leads the team.
          const newCaptainId =
            team.captainId && fixedPlayers.includes(team.captainId)
              ? team.captainId
              : roster[0];

          return {
            ...team,
            name: getAutoTeamName(team.name, team.captainId, newCaptainId, idx),
            players: roster,
            captainId: newCaptainId,
            locked: false,
            lockedPlayerIds: fixedPlayers,
          };
        });
      };

      let bestCandidate: Team[] = buildCandidateTeams(shuffleArray(unlockedPool));
      let foundDifferentPairing = false;
      let foundDifferentRoster = false;

      if (prevPairingSig) {
        // Run up to 12 fast Fisher-Yates trials to find a genuinely new teammate pairing
        for (let attempt = 0; attempt < 12; attempt++) {
          const candidate = buildCandidateTeams(shuffleArray(unlockedPool));
          const pairingSig = getPairingSignature(candidate);
          const rosterSig = getRosterSignature(candidate);

          if (pairingSig !== prevPairingSig) {
            bestCandidate = candidate;
            foundDifferentPairing = true;
            foundDifferentRoster = true;
            break;
          }
          if (!foundDifferentRoster && rosterSig !== prevRosterSig) {
            bestCandidate = candidate;
            foundDifferentRoster = true;
          }
        }

        // Deterministic fallback swap if random draws happened to collide with previous pairing
        if (!foundDifferentPairing) {
          const unlockedTeamIndices = bestCandidate
            .map((t, i) =>
              !lockedTeamIds.has(t.id) && !pairAssignedToTeamId.has(t.id) ? i : -1
            )
            .filter((i) => i !== -1);

          if (unlockedTeamIndices.length >= 2) {
            outerSwap: for (let a = 0; a < unlockedTeamIndices.length; a++) {
              for (let b = a + 1; b < unlockedTeamIndices.length; b++) {
                const idxA = unlockedTeamIndices[a];
                const idxB = unlockedTeamIndices[b];
                const teamA = bestCandidate[idxA];
                const teamB = bestCandidate[idxB];
                const fixedA = new Set(fixedPlayersByTeamId.get(teamA.id) || []);
                const fixedB = new Set(fixedPlayersByTeamId.get(teamB.id) || []);

                const movableIndicesA = teamA.players
                  .map((pid, pIdx) => (!fixedA.has(pid) ? pIdx : -1))
                  .filter((pIdx) => pIdx !== -1);
                const movableIndicesB = teamB.players
                  .map((pid, pIdx) => (!fixedB.has(pid) ? pIdx : -1))
                  .filter((pIdx) => pIdx !== -1);

                for (const mA of movableIndicesA) {
                  for (const mB of movableIndicesB) {
                    const swapped = bestCandidate.map((t, tIdx) => ({
                      ...t,
                      players: [...t.players],
                    }));
                    const temp = swapped[idxA].players[mA];
                    swapped[idxA].players[mA] = swapped[idxB].players[mB];
                    swapped[idxB].players[mB] = temp;

                    // Update captains/names for swapped teams if captain slot changed
                    for (const changedIdx of [idxA, idxB]) {
                      const origTeam = teamShells[changedIdx];
                      const fixedSet = new Set(fixedPlayersByTeamId.get(origTeam.id) || []);
                      const nextCap =
                        origTeam.captainId && fixedSet.has(origTeam.captainId)
                          ? origTeam.captainId
                          : swapped[changedIdx].players[0];
                      swapped[changedIdx].captainId = nextCap;
                      swapped[changedIdx].name = getAutoTeamName(
                        origTeam.name,
                        origTeam.captainId,
                        nextCap,
                        changedIdx
                      );
                    }

                    const newPSig = getPairingSignature(swapped);
                    const newRSig = getRosterSignature(swapped);
                    if (newPSig !== prevPairingSig) {
                      bestCandidate = swapped;
                      foundDifferentPairing = true;
                      foundDifferentRoster = true;
                      break outerSwap;
                    }
                    if (!foundDifferentRoster && newRSig !== prevRosterSig) {
                      bestCandidate = swapped;
                      foundDifferentRoster = true;
                    }
                  }
                }
              }
            }
          }
        }
      }

      const finalTeamsWithTokens = assignUniqueTokensToTeams(bestCandidate);
      setTeams(finalTeamsWithTokens);
      triggerCelebration();

      if (prevPairingSig && !foundDifferentPairing && !foundDifferentRoster) {
        showNotice(
          `Only 1 valid player arrangement exists with current locks. Assigned fresh tokens to ${finalTeamsWithTokens.length} team(s).`,
          'success'
        );
      } else {
        const lockedCount = lockedTeamIds.size + pairAssignedToTeamId.size;
        showNotice(
          `Shuffled unlocked players into ${finalTeamsWithTokens.length} team${
            finalTeamsWithTokens.length === 1 ? '' : 's'
          }${lockedCount > 0 ? ` (${lockedCount} locked team/pair preserved)` : ''}!`,
          'success'
        );
      }
    } catch (err) {
      showNotice('Failed to generate tokens. Please try again.', 'error');
    } finally {
      setIsDrawing(false);
      isSpinningRef.current = false;
    }
  };

  // Apply Pre-Decided Locked Pairs without creating duplicate teams
  const handleApplyLockedPairs = () => {
    if (state.predefinedTeams.length === 0) {
      showNotice('No locked pairs to apply.', 'error');
      return;
    }

    const baseTeams: Team[] = state.predefinedTeams.map((pt, idx) => {
      const existingMatch = existingTeams.find(
        (t) =>
          t.id === pt.id ||
          (t.players.length === pt.players.length &&
            pt.players.every((pid) => t.players.includes(pid)))
      );
      return {
        id: existingMatch?.id || pt.id,
        name: pt.name || existingMatch?.name || `Team ${getTokenLabel(idx)}`,
        players: [...pt.players],
        captainId: existingMatch?.captainId || pt.players[0],
        locked: true,
        lockedPlayerIds: [...pt.players],
        badge: existingMatch?.badge || '🏸',
        avatarColor: existingMatch?.avatarColor || GRADIENT_PALETTES[idx % GRADIENT_PALETTES.length],
        token: existingMatch?.token || getTokenLabel(idx),
      };
    });

    const updatedTeams = assignUniqueTokensToTeams(baseTeams);
    setTeams(updatedTeams);
    triggerCelebration();
    showNotice(
      `Applied ${updatedTeams.length} locked pair${updatedTeams.length === 1 ? '' : 's'} with ${
        updatedTeams.length
      } assigned token${updatedTeams.length === 1 ? '' : 's'}.`,
      'success'
    );
  };

  const handleAddPredefinedPair = (e: React.FormEvent) => {
    e.preventDefault();
    if (!pairP1 || !pairP2) {
      showNotice('Please select both players for the doubles pair.', 'error');
      return;
    }
    if (pairP1 === pairP2) {
      showNotice('A player cannot pair with themselves.', 'error');
      return;
    }

    const p1Name = state.players.find((p) => p.id === pairP1)?.name.split(' ')[0] || 'P1';
    const p2Name = state.players.find((p) => p.id === pairP2)?.name.split(' ')[0] || 'P2';
    const autoName = pairName.trim() || `${p1Name} & ${p2Name}`;

    addPredefinedTeam(autoName, pairP1, pairP2);
    setPairName('');
    setPairP1('');
    setPairP2('');
  };

  const formatTeamsShareText = () => {
    const lines = [
      `🏸 ${state.settings.name} — Official Token Draw Teams`,
      `Date: ${state.settings.date}`,
      '----------------------------------------',
    ];

    existingTeams.forEach((t, idx) => {
      const pNames = t.players
        .map((pid) => {
          const p = state.players.find((item) => item.id === pid);
          return `${p?.name || 'Unknown'}${t.captainId === pid ? ' 👑 (Captain)' : ''}`;
        })
        .join(' + ');

      const tokenLabel = t.token || getTokenLabel(idx);
      lines.push(`Token ${tokenLabel}: ${t.name}`);
      lines.push(`  Squad: ${pNames || 'Unassigned'}`);
    });

    return lines.join('\n');
  };

  const handleShare = () => {
    const text = formatTeamsShareText();
    const url = `https://wa.me/?text=${encodeURIComponent(text)}`;
    window.open(url, '_blank');
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(formatTeamsShareText());
      showNotice('Teams copied to clipboard!', 'success');
    } catch {}
  };

  const displayTeamCount = existingTeams.length > 0 ? existingTeams.length : numTeams;

  return (
    <div className="space-y-6 animate-fade-in">
      {toastMsg && (
        <div
          role="status"
          className={`flex items-center justify-between gap-3 px-4 py-3 rounded-xl text-xs font-semibold animate-fade-in border ${
            toastMsg.type === 'success'
              ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-300'
              : 'bg-rose-500/15 border-rose-500/30 text-rose-300'
          }`}
        >
          <span>{toastMsg.text}</span>
          <button
            onClick={() => setToastMsg(null)}
            className="text-current opacity-75 hover:opacity-100 px-1"
            aria-label="Dismiss notification"
          >
            ✕
          </button>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-500/20 text-amber-400 font-bold text-xl">
              🎲
            </span>
            <h1 className="font-display text-2xl sm:text-3xl font-black text-white">
              Token Lottery Draw
            </h1>
          </div>
          <p className="mt-1 text-xs sm:text-sm text-slate-400">
            Automated doubles team draw, captain selection, and pre-decided pairs locking.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setSoundEnabled((s) => !s)}
            className="p-2 text-slate-400 hover:text-white bg-white/5 hover:bg-white/10 rounded-xl transition-colors border border-white/5"
            title={soundEnabled ? 'Mute Sound Effects' : 'Enable Sound Effects'}
            aria-label={soundEnabled ? 'Mute Sound Effects' : 'Enable Sound Effects'}
          >
            {soundEnabled ? <Volume2 className="w-4 h-4 text-amber-400" /> : <VolumeX className="w-4 h-4" />}
          </button>

          {existingTeams.length > 0 && (
            <>
              <button
                onClick={handleCopy}
                className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-200 hover:text-white bg-white/10 hover:bg-white/15 rounded-xl transition-colors border border-white/10"
              >
                <Copy className="w-4 h-4 text-amber-400" />
                <span>Copy</span>
              </button>
              <button
                onClick={handleShare}
                className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-emerald-400 bg-emerald-500/10 hover:bg-emerald-500/20 rounded-xl transition-colors border border-emerald-500/20"
              >
                <Share2 className="w-4 h-4" />
                <span>WhatsApp</span>
              </button>
              <button
                onClick={() => setShowClearConfirm(true)}
                className="p-2 text-slate-400 hover:text-rose-400 bg-white/5 hover:bg-rose-500/10 rounded-xl transition-colors border border-white/5"
                title="Clear Teams"
                aria-label="Clear Teams"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </>
          )}
        </div>
      </div>

      {/* Mode Selector Tabs */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-2 rounded-2xl glass-panel">
        {[
          {
            id: 'random',
            label: 'Random Formation',
            desc: 'Draw balanced pairs randomly from the pool',
            icon: '🎲',
          },
          {
            id: 'predefined',
            label: 'Pre-Decided Teams',
            desc: 'Use locked pairs only (no random shuffle)',
            icon: '🔒',
          },
          {
            id: 'mixed',
            label: 'Mixed Mode',
            desc: 'Lock designated pairs + shuffle remaining',
            icon: '⚡',
          },
        ].map((m) => (
          <button
            key={m.id}
            onClick={() => setTeamFormationMode(m.id as any)}
            className={`text-left p-3.5 rounded-xl transition-all border ${
              state.teamFormationMode === m.id
                ? 'bg-amber-500/15 border-amber-500/40 shadow-md'
                : 'bg-white/5 border-transparent hover:bg-white/10'
            }`}
          >
            <div className="flex items-center gap-2 mb-1">
              <span className="text-lg">{m.icon}</span>
              <span className="font-bold text-sm text-white">{m.label}</span>
            </div>
            <p className="text-xs text-slate-400 leading-relaxed">{m.desc}</p>
          </button>
        ))}
      </div>

      {/* Mode 1: Random Draw Control Center */}
      {state.teamFormationMode === 'random' && (
        <div className="rounded-2xl glass-card p-6 border border-white/10 space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
            {/* Number of Teams */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-1.5">
                {existingTeams.length > 0 ? 'Registered Eligible Teams' : 'Number of Teams'}
              </label>
              <input
                type="number"
                min={1}
                max={32}
                value={numTeams}
                onChange={(e) => setNumTeams(Math.max(1, parseInt(e.target.value, 10) || 1))}
                className="w-full bg-slate-900 border border-white/10 rounded-xl px-3 py-2 text-white font-mono font-bold"
              />
              <div className="flex flex-wrap gap-1.5 mt-2">
                {existingTeams.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setNumTeams(existingTeams.length)}
                    className={`px-2 py-0.5 text-xs rounded-lg transition-colors font-mono ${
                      numTeams === existingTeams.length
                        ? 'bg-amber-400 text-slate-950 font-bold'
                        : 'bg-white/5 text-amber-400 hover:text-amber-300'
                    }`}
                  >
                    Existing ({existingTeams.length})
                  </button>
                )}
                {[2, 3, 4, 6, 8].map((count) => (
                  <button
                    key={count}
                    type="button"
                    onClick={() => setNumTeams(count)}
                    className={`px-2 py-0.5 text-xs rounded-lg transition-colors font-mono ${
                      numTeams === count
                        ? 'bg-amber-400 text-slate-950 font-bold'
                        : 'bg-white/5 text-slate-400 hover:text-white'
                    }`}
                  >
                    {count}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => setNumTeams(maxPossibleTeams)}
                  className="px-2 py-0.5 text-xs rounded-lg bg-white/5 text-amber-400 hover:text-amber-300 font-mono"
                >
                  Max ({maxPossibleTeams})
                </button>
              </div>
            </div>

            {/* Players Per Team */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-1.5">
                Players Per Team
              </label>
              <select
                value={playersPerTeam}
                onChange={(e) => setPlayersPerTeam(parseInt(e.target.value, 10) || 2)}
                className="w-full bg-slate-900 border border-white/10 rounded-xl px-3 py-2 text-white text-sm"
              >
                <option value={2}>2 (Standard Doubles)</option>
                <option value={3}>3 (Triples Squad)</option>
              </select>
              <p className="text-[11px] text-slate-400 mt-2">
                {existingTeams.length > 0
                  ? `${existingTeams.length} existing team${existingTeams.length === 1 ? '' : 's'} · Unlocked players reshuffle on every spin`
                  : `Target: ${numTeams} team${numTeams === 1 ? '' : 's'} · ${eligiblePlayers.length} players available`}
              </p>
            </div>

            {/* Draw Actions */}
            <div className="flex flex-col justify-end gap-2">
              <button
                type="button"
                onClick={handleRandomCaptains}
                disabled={isDrawing}
                className="w-full py-2 px-3 text-xs font-semibold text-slate-200 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl transition-colors flex items-center justify-center gap-1.5 disabled:opacity-50"
              >
                <Crown className="w-3.5 h-3.5 text-amber-400" />
                <span>Draw Random Captains</span>
              </button>

              <button
                type="button"
                onClick={handleRunLotteryDraw}
                disabled={isDrawing}
                className="w-full py-2.5 px-4 text-sm font-bold text-slate-950 bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 rounded-xl shadow-lg shadow-amber-500/25 active:scale-95 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
              >
                <Dices className={`w-4 h-4 ${isDrawing ? 'animate-spin' : ''}`} />
                <span>
                  {isDrawing
                    ? `Drawing ${displayTeamCount} Token${displayTeamCount === 1 ? '' : 's'}...`
                    : 'Spin & Generate Tokens'}
                </span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Mode 2: Pre-Decided Pairs */}
      {(state.teamFormationMode === 'predefined' || state.teamFormationMode === 'mixed') && (
        <div className="rounded-2xl glass-card p-6 border border-white/10 space-y-6">
          <div className="flex items-center justify-between pb-3 border-b border-white/10">
            <div>
              <h3 className="font-bold text-white text-base">Lock Pre-Decided Doubles Pairs</h3>
              <p className="text-xs text-slate-400">
                Fixed doubles pairs will stay together and never be separated during any spin.
              </p>
            </div>
          </div>

          <form onSubmit={handleAddPredefinedPair} className="grid grid-cols-1 sm:grid-cols-4 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1">Pair Name (Optional)</label>
              <input
                type="text"
                placeholder="e.g. Falcon Duo"
                value={pairName}
                onChange={(e) => setPairName(e.target.value)}
                className="w-full bg-slate-900 border border-white/10 rounded-xl px-3 py-2 text-xs text-white"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1">Player 1</label>
              <select
                value={pairP1}
                onChange={(e) => setPairP1(e.target.value)}
                className="w-full bg-slate-900 border border-white/10 rounded-xl px-3 py-2 text-xs text-white"
                required
              >
                <option value="">Select Player 1</option>
                {state.players.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1">Player 2</label>
              <select
                value={pairP2}
                onChange={(e) => setPairP2(e.target.value)}
                className="w-full bg-slate-900 border border-white/10 rounded-xl px-3 py-2 text-xs text-white"
                required
              >
                <option value="">Select Player 2</option>
                {state.players
                  .filter((p) => p.id !== pairP1)
                  .map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
              </select>
            </div>
            <div className="flex items-end">
              <button
                type="submit"
                className="w-full py-2 px-3 text-xs font-bold bg-emerald-500 hover:bg-emerald-400 text-slate-950 rounded-xl transition-all shadow"
              >
                + Lock Pair
              </button>
            </div>
          </form>

          {/* Locked Pairs List */}
          <div className="space-y-2">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
              Locked Pairs ({state.predefinedTeams.length})
            </span>
            {state.predefinedTeams.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {state.predefinedTeams.map((pt) => {
                  const p1 = state.players.find((p) => p.id === pt.players[0]);
                  const p2 = state.players.find((p) => p.id === pt.players[1]);

                  return (
                    <div
                      key={pt.id}
                      className="rounded-xl bg-white/5 border border-white/10 p-3 flex items-center justify-between"
                    >
                      <div className="min-w-0">
                        <span className="font-bold text-white text-xs truncate block">{pt.name}</span>
                        <span className="text-[11px] text-slate-400 truncate block">
                          {p1?.name || 'P1'} + {p2?.name || 'P2'}
                        </span>
                      </div>
                      <button
                        onClick={() => deletePredefinedTeam(pt.id)}
                        className="text-slate-500 hover:text-rose-400 p-1"
                        title="Remove locked pair"
                      >
                        ✕
                      </button>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-xs text-slate-500 italic">No locked pairs yet.</p>
            )}

            <div className="pt-3 flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={handleApplyLockedPairs}
                disabled={state.predefinedTeams.length === 0 || isDrawing}
                className="px-5 py-2.5 text-xs font-bold text-slate-950 bg-amber-400 hover:bg-amber-300 rounded-xl shadow transition-all disabled:opacity-50"
              >
                Apply Locked Pairs as Tournament Teams
              </button>

              <button
                type="button"
                onClick={handleRunLotteryDraw}
                disabled={isDrawing}
                className="px-5 py-2.5 text-xs font-bold text-slate-950 bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 rounded-xl shadow transition-all flex items-center gap-2 disabled:opacity-50"
              >
                <Dices className={`w-4 h-4 ${isDrawing ? 'animate-spin' : ''}`} />
                <span>
                  {isDrawing
                    ? `Drawing ${displayTeamCount} Token${displayTeamCount === 1 ? '' : 's'}...`
                    : 'Spin & Generate Tokens'}
                </span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Lottery Spinning Machine Display during initial draw */}
      {isDrawing && existingTeams.length === 0 && (
        <div className="rounded-3xl glass-card p-6 border border-amber-500/40 text-center space-y-3 gold-glow animate-pulse">
          <span className="text-xs font-bold uppercase tracking-[0.25em] text-amber-400 block">
            Spinning Tournament Lottery Wheels ({displayTeamCount} Team{displayTeamCount === 1 ? '' : 's'})
          </span>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 max-w-xl mx-auto">
            {spinningSlotNames.map((name, idx) => (
              <div
                key={idx}
                className="p-3 rounded-2xl bg-amber-500/20 border border-amber-500/40 text-white font-bold text-sm truncate shadow"
              >
                <div className="text-xl mb-1">🏸</div>
                {name}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Generated Teams Grid (stays mounted during subsequent spins for zero layout shift & instant rendering) */}
      {existingTeams.length > 0 && (
        <div
          className={`space-y-4 transition-opacity duration-150 ${
            isDrawing ? 'opacity-75 pointer-events-none' : 'opacity-100'
          }`}
        >
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <h3 className="font-display text-xl font-bold text-white flex items-center gap-2">
                <span>🏸</span>
                <span>Generated Tournament Tokens ({existingTeams.length} Teams)</span>
              </h3>
              <p className="text-[11px] text-slate-400 mt-0.5">
                Lock an entire team or click the lock icon next to any player to keep them in place during the next Spin &amp; Generate Tokens draw.
              </p>
            </div>
            <button
              onClick={() => {
                generateFixtures();
                showNotice('Round-robin match schedule auto-generated for these teams!', 'success');
              }}
              className="text-xs font-bold text-amber-400 hover:underline self-start sm:self-auto"
            >
              Generate Match Schedule from These Teams →
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {existingTeams.map((team, idx) => {
              const letter = team.token || getTokenLabel(idx);
              const gradient = team.avatarColor || GRADIENT_PALETTES[idx % GRADIENT_PALETTES.length];
              const lockedPlayersSet = new Set(team.lockedPlayerIds || []);

              return (
                <div
                  key={team.id}
                  className="rounded-2xl glass-card border border-white/10 overflow-hidden shadow-xl space-y-3"
                >
                  {/* Card Header Strip */}
                  <div className={`p-4 bg-gradient-to-r ${gradient} text-white space-y-1`}>
                    <div className="flex items-center justify-between text-[11px] font-bold uppercase tracking-wider opacity-85">
                      <span>Token {letter}</span>
                      <span>{team.badge || '🏸'}</span>
                    </div>
                    <h4 className="font-display font-black text-lg truncate">{team.name}</h4>
                  </div>

                  {/* Player Roster */}
                  <div className="p-4 pt-1 space-y-2 text-xs">
                    {team.players.map((pid) => {
                      const p = playerById.get(pid);
                      const isCap = team.captainId === pid;
                      const lockedPair = lockedPairByPlayerId.get(pid);
                      const isPlayerLocked = Boolean(
                        team.locked || lockedPlayersSet.has(pid) || lockedPair
                      );

                      return (
                        <div
                          key={pid}
                          className={`flex items-center justify-between p-2 rounded-xl border ${
                            isPlayerLocked
                              ? 'bg-amber-500/10 border-amber-500/30'
                              : isCap
                              ? 'bg-white/10 border-white/15'
                              : 'bg-white/5 border-transparent'
                          }`}
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-white/10 font-bold text-[10px] text-white">
                              {p?.name.slice(0, 2).toUpperCase() || '??'}
                            </span>
                            <div className="min-w-0">
                              <span className="font-semibold text-white truncate block">
                                {p?.name || 'Unnamed Player'}
                              </span>
                              {lockedPair && (
                                <span className="text-[10px] text-amber-300/90 block truncate">
                                  🔒 Pair: {lockedPair.name}
                                </span>
                              )}
                            </div>
                          </div>

                          <div className="flex items-center gap-1.5 shrink-0">
                            {isCap && (
                              <span
                                className="text-[10px] font-bold text-amber-400 flex items-center gap-0.5"
                                title="Team Captain"
                              >
                                <Crown className="w-3 h-3 text-amber-400" />
                                <span>C</span>
                              </span>
                            )}
                            <button
                              type="button"
                              onClick={() => togglePlayerLockInTeam(team.id, pid)}
                              disabled={Boolean(team.locked || lockedPair)}
                              title={
                                team.locked
                                  ? 'Entire team is locked'
                                  : lockedPair
                                  ? `Locked as part of pair "${lockedPair.name}"`
                                  : lockedPlayersSet.has(pid)
                                  ? 'Unlock player from this team'
                                  : 'Lock player to this team'
                              }
                              className={`p-1 rounded-lg transition-colors ${
                                isPlayerLocked
                                  ? 'text-amber-400 bg-amber-500/15 hover:bg-amber-500/25'
                                  : 'text-slate-500 hover:text-slate-300 hover:bg-white/5'
                              } disabled:opacity-60`}
                            >
                              {isPlayerLocked ? (
                                <Lock className="w-3 h-3" />
                              ) : (
                                <Unlock className="w-3 h-3" />
                              )}
                            </button>
                          </div>
                        </div>
                      );
                    })}

                    <div className="pt-2 flex items-center justify-between text-[11px] text-slate-400">
                      <button
                        type="button"
                        onClick={() => toggleTeamLock(team.id)}
                        className={`flex items-center gap-1 font-semibold ${
                          team.locked ? 'text-amber-400' : 'text-slate-500 hover:text-slate-300'
                        }`}
                      >
                        {team.locked ? <Lock className="w-3 h-3" /> : <Unlock className="w-3 h-3" />}
                        <span>{team.locked ? 'Team Locked' : 'Team Unlocked'}</span>
                      </button>

                      {lockedPlayersSet.size > 0 && !team.locked && (
                        <span className="text-[10px] text-amber-400/90 font-semibold">
                          {lockedPlayersSet.size} player{lockedPlayersSet.size === 1 ? '' : 's'} locked
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Clear Confirmation */}
      <ConfirmModal
        isOpen={showClearConfirm}
        title="Clear Generated Teams"
        message="Are you sure you want to clear all tournament teams? Players and registrations will not be affected."
        confirmLabel="Clear Teams"
        variant="danger"
        onConfirm={() => {
          clearTeams();
          setShowClearConfirm(false);
        }}
        onCancel={() => setShowClearConfirm(false)}
      />

      {/* Random Captains Modal */}
      <RandomCaptainsModal
        isOpen={isCaptainModalOpen}
        onClose={() => setIsCaptainModalOpen(false)}
        teams={state.teams}
        players={eligiblePlayers}
        numTeamsFallback={numTeams}
        onConfirmCaptains={handleConfirmCaptainsFromModal}
      />
    </div>
  );
};
