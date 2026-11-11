import { Player, PredefinedTeam, Team } from '../types/tournament';

export const TOKEN_LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');

export const GRADIENT_PALETTES = [
  'from-rose-500 to-pink-600',
  'from-amber-500 to-orange-600',
  'from-emerald-500 to-green-600',
  'from-sky-500 to-blue-600',
  'from-violet-500 to-purple-600',
  'from-fuchsia-500 to-pink-600',
  'from-teal-500 to-cyan-600',
  'from-indigo-500 to-blue-600',
];

export const getTokenLabel = (index: number): string =>
  index < TOKEN_LETTERS.length ? TOKEN_LETTERS[index] : `${index + 1}`;

// Unbiased Fisher-Yates shuffle returning a new array
export function shuffleArray<T>(items: readonly T[]): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

// Canonical signature of teammate combinations (order-independent across teams and within teams)
export function getPairingSignature(teams: readonly { players: string[] }[]): string {
  return teams
    .map((t) => [...t.players].sort().join('+'))
    .sort()
    .join('|');
}

// Canonical signature of specific team-to-roster assignments
export function getRosterSignature(teams: readonly { id: string; players: string[] }[]): string {
  return teams
    .map((t) => `${t.id}:${[...t.players].sort().join(',')}`)
    .join('|');
}

// Canonical signature of team-to-token assignments
export function getTokenSignature(teams: readonly { id: string; token?: string; players: string[] }[]): string {
  return teams
    .map((t) => `${t.id || [...t.players].sort().join(',')}:${t.token || ''}`)
    .join('|');
}

export interface LotteryDrawInput {
  mode: 'random' | 'predefined' | 'mixed';
  players: Player[];
  existingTeams: Team[];
  predefinedTeams: PredefinedTeam[];
  playersPerTeam: number;
  numTeamsRequested: number;
  selectedCaptains?: string[];
}

export interface LotteryDrawOutput {
  success: boolean;
  teams: Team[];
  protectedTeamIds: string[];
  lockedTokenTeamIds: string[];
  unlockedPlayerPoolIds: string[];
  error?: string;
  noAlternativeReason?: string;
}

/**
 * Assigns 1 unique lottery token (A, B, C...) to each team in `teamsList`.
 * - Preserves explicitly locked tokens on teams in `lockedTokenTeamIds`.
 * - Shuffles available tokens across all other teams.
 * - Guarantees a different token assignment from `previousTeams` whenever 2+ teams have unlocked tokens.
 */
export function assignUniqueTokens(
  teamsList: Team[],
  lockedTokenTeamIds: Set<string>,
  previousTeams: Team[]
): { teams: Team[]; tokenChanged: boolean } {
  const count = teamsList.length;
  if (count === 0) return { teams: [], tokenChanged: false };

  const allTokens = Array.from({ length: count }, (_, idx) => getTokenLabel(idx));
  const validTokenSet = new Set(allTokens);

  const prevTokenByTeamKey = new Map<string, string>();
  for (const pt of previousTeams) {
    if (pt.token) {
      prevTokenByTeamKey.set(pt.id, pt.token);
      const rosterKey = [...pt.players].sort().join('+');
      if (rosterKey) prevTokenByTeamKey.set(`roster:${rosterKey}`, pt.token);
    }
  }

  const reservedTokens = new Set<string>();
  const fixedTokenByTeamId = new Map<string, string>();

  for (const t of teamsList) {
    if (lockedTokenTeamIds.has(t.id)) {
      const rosterKey = [...t.players].sort().join('+');
      const existingTok =
        t.token || prevTokenByTeamKey.get(t.id) || prevTokenByTeamKey.get(`roster:${rosterKey}`);
      if (existingTok && validTokenSet.has(existingTok) && !reservedTokens.has(existingTok)) {
        reservedTokens.add(existingTok);
        fixedTokenByTeamId.set(t.id, existingTok);
      }
    }
  }

  const unlockedTokenPool = allTokens.filter((tok) => !reservedTokens.has(tok));
  const prevSig = getTokenSignature(
    teamsList.map((t) => {
      const rosterKey = [...t.players].sort().join('+');
      return {
        id: t.id,
        players: t.players,
        token:
          t.token ||
          prevTokenByTeamKey.get(t.id) ||
          prevTokenByTeamKey.get(`roster:${rosterKey}`) ||
          '',
      };
    })
  );

  let chosenAvailableTokens = shuffleArray(unlockedTokenPool);

  if (unlockedTokenPool.length >= 2) {
    // Try up to 20 random permutations to get a distinct token assignment
    for (let attempt = 0; attempt < 20; attempt++) {
      const candidateTokens = shuffleArray(unlockedTokenPool);
      let cursor = 0;
      const candidateTeams = teamsList.map((t) => ({
        id: t.id,
        players: t.players,
        token: fixedTokenByTeamId.get(t.id) || candidateTokens[cursor++],
      }));
      if (getTokenSignature(candidateTeams) !== prevSig) {
        chosenAvailableTokens = candidateTokens;
        break;
      }
    }

    // Deterministic rotation fallback if random draws matched prevSig
    let cursorCheck = 0;
    const checkTeams = teamsList.map((t) => ({
      id: t.id,
      players: t.players,
      token: fixedTokenByTeamId.get(t.id) || chosenAvailableTokens[cursorCheck++],
    }));
    if (getTokenSignature(checkTeams) === prevSig && chosenAvailableTokens.length >= 2) {
      const first = chosenAvailableTokens.shift()!;
      chosenAvailableTokens.push(first);
    }
  }

  let cursor = 0;
  const finalTeams = teamsList.map((team, idx) => {
    const assignedToken = fixedTokenByTeamId.get(team.id) || chosenAvailableTokens[cursor++];
    const tokenIndex = Math.max(0, TOKEN_LETTERS.indexOf(assignedToken));
    return {
      ...team,
      id: team.id,
      name: team.name,
      players: [...team.players],
      captainId: team.captainId || team.players[0],
      locked: Boolean(team.locked),
      lockedPlayerIds: Array.isArray(team.lockedPlayerIds) ? [...team.lockedPlayerIds] : [],
      badge: team.badge || '🏸',
      avatarColor:
        team.avatarColor ||
        GRADIENT_PALETTES[(tokenIndex >= 0 ? tokenIndex : idx) % GRADIENT_PALETTES.length],
      token: assignedToken,
    };
  });

  const nextSig = getTokenSignature(finalTeams);
  return {
    teams: finalTeams,
    tokenChanged: nextSig !== prevSig,
  };
}

/**
 * Validates that the generated draw preserves all locked invariants and contains no duplicate players.
 */
export function validateLotteryDrawResult(
  input: LotteryDrawInput,
  teams: Team[]
): { valid: boolean; error?: string } {
  if (!Array.isArray(teams) || teams.length === 0) {
    return { valid: false, error: 'No teams were generated in the draw.' };
  }

  // 1. Verify no duplicate team IDs and no duplicate tokens
  const seenTeamIds = new Set<string>();
  const seenTokens = new Set<string>();
  const seenPlayers = new Set<string>();

  for (const team of teams) {
    if (!team.id || seenTeamIds.has(team.id)) {
      return { valid: false, error: 'Duplicate or missing team ID detected in draw.' };
    }
    seenTeamIds.add(team.id);

    if (!team.token || seenTokens.has(team.token)) {
      return { valid: false, error: 'Duplicate or missing lottery token detected in draw.' };
    }
    seenTokens.add(team.token);

    for (const pid of team.players) {
      if (!pid) continue;
      if (seenPlayers.has(pid)) {
        return { valid: false, error: `Player ${pid} was assigned to multiple teams.` };
      }
      seenPlayers.add(pid);
    }
  }

  // 2. Verify all valid predefined pairs remain together on the same team
  const validPlayerIds = new Set(input.players.map((p) => p.id));
  const usedInPair = new Set<string>();
  for (const pt of input.predefinedTeams) {
    const [p1, p2] = pt.players;
    if (
      p1 &&
      p2 &&
      p1 !== p2 &&
      !usedInPair.has(p1) &&
      !usedInPair.has(p2) &&
      (validPlayerIds.size === 0 || (validPlayerIds.has(p1) && validPlayerIds.has(p2)))
    ) {
      usedInPair.add(p1);
      usedInPair.add(p2);
      const teamWithP1 = teams.find((t) => t.players.includes(p1));
      if (!teamWithP1 || !teamWithP1.players.includes(p2)) {
        return {
          valid: false,
          error: `Locked pair "${pt.name}" was separated during the draw.`,
        };
      }
    }
  }

  return { valid: true };
}

/**
 * Executes the complete, mode-specific lottery draw while strictly preserving:
 * - Locked Pairs (`predefinedTeams`)
 * - Locked Teams (`team.locked === true`)
 * - Individually Locked Players (`team.lockedPlayerIds`)
 * - Complete participant inclusion (never dropping unlocked teams or unlocked players)
 */
export function executeLotteryDraw(input: LotteryDrawInput): LotteryDrawOutput {
  const {
    mode,
    players: currentPlayers,
    predefinedTeams: currentPredefinedPairs,
    playersPerTeam = 2,
    numTeamsRequested,
    selectedCaptains = [],
  } = input;

  // Deduplicate existing teams by ID
  const currentTeamsMap = new Map<string, Team>();
  for (const t of input.existingTeams) {
    if (t && t.id && !currentTeamsMap.has(t.id)) {
      currentTeamsMap.set(t.id, t);
    }
  }
  const currentTeams = Array.from(currentTeamsMap.values());

  // Build fast O(1) player map
  const fastPlayerMap = new Map<string, Player>();
  for (const p of currentPlayers) {
    if (p && p.id) fastPlayerMap.set(p.id, p);
  }
  const validPlayerIdSet = new Set(fastPlayerMap.keys());

  // Normalize valid locked pairs from predefinedTeams
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
    return (
      trimmed ||
      (newCap ? `Team ${newCap.name.split(' ')[0]}` : `Team ${getTokenLabel(fallbackIndex)}`)
    );
  };

  // ===========================================================================
  // MODE B: PRE-DECIDED TEAMS MODE ('predefined')
  // ===========================================================================
  // Requirements:
  // - Retrieve ALL pre-decided teams, not only locked pairs.
  // - Preserve every pre-decided team combination, regardless of lock status.
  // - Keep locked pairs together.
  // - Never remove unlocked teams or remaining players from the final results.
  // - Randomize available lottery tokens among eligible teams.
  // - Preserve explicitly locked token assignments.
  if (mode === 'predefined') {
    const completePredecidedTeams: Team[] = [];
    const protectedTeamIds: string[] = [];
    const lockedTokenTeamIds = new Set<string>();
    const assignedPlayerIds = new Set<string>();
    const usedTeamIds = new Set<string>();

    // 1. Place all locked pairs from predefinedTeams first
    activeLockedPairs.forEach((pair, idx) => {
      const existingMatch = currentTeams.find(
        (t) =>
          !usedTeamIds.has(t.id) &&
          (t.id === pair.id ||
            (t.players.length === pair.players.length &&
              pair.players.every((pid) => t.players.includes(pid))))
      );
      const teamId = existingMatch?.id || pair.id;
      usedTeamIds.add(teamId);
      pair.players.forEach((pid) => assignedPlayerIds.add(pid));
      protectedTeamIds.push(teamId);

      // If this team was explicitly locked on its card AND already had a token, preserve its token ONLY if there are other teams to shuffle tokens with
      const isExplicitlyLocked = existingMatch ? Boolean(existingMatch.locked) : true;
      if (existingMatch?.locked && existingMatch?.token) {
        lockedTokenTeamIds.add(teamId);
      }

      completePredecidedTeams.push({
        id: teamId,
        name: pair.name || existingMatch?.name || `Team ${getTokenLabel(idx)}`,
        players: [...pair.players],
        captainId: existingMatch?.captainId || pair.players[0],
        locked: isExplicitlyLocked,
        lockedPlayerIds: [...pair.players],
        badge: existingMatch?.badge || '🏸',
        avatarColor:
          existingMatch?.avatarColor || GRADIENT_PALETTES[idx % GRADIENT_PALETTES.length],
        token: existingMatch?.token,
      });
    });

    // 2. Preserve all remaining existing teams whose players are not already consumed by a newly locked pair
    const fragmentedTeams: Team[] = [];
    for (const team of currentTeams) {
      if (usedTeamIds.has(team.id)) continue;
      const availableRoster = team.players.filter((pid) => pid && !assignedPlayerIds.has(pid));

      if (availableRoster.length === team.players.length && availableRoster.length > 0) {
        usedTeamIds.add(team.id);
        availableRoster.forEach((pid) => assignedPlayerIds.add(pid));
        if (team.locked) {
          protectedTeamIds.push(team.id);
          if (team.token) lockedTokenTeamIds.add(team.id);
        }
        completePredecidedTeams.push({
          ...team,
          players: [...availableRoster],
          captainId:
            team.captainId && availableRoster.includes(team.captainId)
              ? team.captainId
              : availableRoster[0],
          locked: Boolean(team.locked),
          lockedPlayerIds: Array.isArray(team.lockedPlayerIds) ? [...team.lockedPlayerIds] : [],
        });
      } else {
        fragmentedTeams.push(team);
      }
    }

    // 3. Gather any unassigned eligible players in currentPlayers and form the remaining pre-decided teams
    // so that locking 1 pair NEVER causes the other teams or players to disappear!
    const remainingPlayers = currentPlayers
      .map((p) => p.id)
      .filter((pid) => pid && !assignedPlayerIds.has(pid));

    // First refill any fragmented existing teams so their team IDs and names are preserved
    for (const fragTeam of fragmentedTeams) {
      const preservedFromFrag = fragTeam.players.filter(
        (pid) => pid && !assignedPlayerIds.has(pid)
      );
      const roster = [...preservedFromFrag];
      roster.forEach((pid) => {
        assignedPlayerIds.add(pid);
        const rIdx = remainingPlayers.indexOf(pid);
        if (rIdx !== -1) remainingPlayers.splice(rIdx, 1);
      });

      while (roster.length < playersPerTeam && remainingPlayers.length > 0) {
        const nextPid = remainingPlayers.shift()!;
        assignedPlayerIds.add(nextPid);
        roster.push(nextPid);
      }

      if (roster.length > 0) {
        usedTeamIds.add(fragTeam.id);
        completePredecidedTeams.push({
          ...fragTeam,
          name: getAutoTeamName(
            fragTeam.name,
            fragTeam.captainId,
            roster[0],
            completePredecidedTeams.length
          ),
          players: roster,
          captainId:
            fragTeam.captainId && roster.includes(fragTeam.captainId)
              ? fragTeam.captainId
              : roster[0],
          locked: Boolean(fragTeam.locked),
          lockedPlayerIds: Array.isArray(fragTeam.lockedPlayerIds)
            ? fragTeam.lockedPlayerIds.filter((id) => roster.includes(id))
            : [],
        });
      }
    }

    // Next, if there are still remaining unassigned players (e.g. admin added 8 players, locked 1 pair, and spun),
    // form pre-decided teams for all remaining complete groups of `playersPerTeam`
    while (remainingPlayers.length >= playersPerTeam) {
      const roster = remainingPlayers.splice(0, playersPerTeam);
      roster.forEach((pid) => assignedPlayerIds.add(pid));
      const idx = completePredecidedTeams.length;
      const capPlayer = fastPlayerMap.get(roster[0]);
      completePredecidedTeams.push({
        id: crypto.randomUUID(),
        name: capPlayer ? `Team ${capPlayer.name.split(' ')[0]}` : `Team ${getTokenLabel(idx)}`,
        players: roster,
        captainId: roster[0],
        locked: false,
        lockedPlayerIds: [],
        badge: '🏸',
        avatarColor: GRADIENT_PALETTES[idx % GRADIENT_PALETTES.length],
      });
    }

    if (completePredecidedTeams.length === 0) {
      return {
        success: false,
        teams: [],
        protectedTeamIds: [],
        lockedTokenTeamIds: [],
        unlockedPlayerPoolIds: [],
        error: 'No pre-decided teams or players found. Please add teams or lock a doubles pair first.',
      };
    }

    // Note: If ALL teams in Pre-Decided mode were marked `locked` solely because they all came from `predefinedTeams`,
    // allow tokens to shuffle across all of them unless only a subset of teams is locked.
    const unlockedTokenTeamCount = completePredecidedTeams.length - lockedTokenTeamIds.size;
    if (unlockedTokenTeamCount === 0 && completePredecidedTeams.length > 1) {
      // If every single team came from predefinedTeams without unlocked counterparts,
      // unlock token assignment for teams that aren't explicitly locked in existingTeams,
      // OR if all existingTeams were locked by the admin, report that all tokens are locked.
      const allExplicitlyLockedInExisting =
        currentTeams.length === completePredecidedTeams.length &&
        currentTeams.every((t) => t.locked && t.token);

      if (allExplicitlyLockedInExisting) {
        return {
          success: true,
          teams: completePredecidedTeams,
          protectedTeamIds,
          lockedTokenTeamIds: Array.from(lockedTokenTeamIds),
          unlockedPlayerPoolIds: [],
          noAlternativeReason:
            'All pre-decided teams have locked token assignments. Unlock at least two teams to reshuffle tokens.',
        };
      }
      lockedTokenTeamIds.clear();
    } else if (unlockedTokenTeamCount === 1 && lockedTokenTeamIds.size > 0) {
      // If only 1 team has an unlocked token and all other tokens are locked, only 1 valid token assignment exists!
      const { teams: singleOptionTeams } = assignUniqueTokens(
        completePredecidedTeams,
        lockedTokenTeamIds,
        currentTeams
      );
      const hadAllTokensBefore =
        currentTeams.length === singleOptionTeams.length &&
        currentTeams.every((t) => Boolean(t.token));
      if (hadAllTokensBefore) {
        return {
          success: true,
          teams: singleOptionTeams,
          protectedTeamIds,
          lockedTokenTeamIds: Array.from(lockedTokenTeamIds),
          unlockedPlayerPoolIds: [],
          noAlternativeReason:
            'Only one unlocked team token remains, so no alternative token allocation exists. Unlock at least two teams to reshuffle tokens.',
        };
      }
    }

    const { teams: finalPredecidedTeams } = assignUniqueTokens(
      completePredecidedTeams,
      lockedTokenTeamIds,
      currentTeams
    );

    const validation = validateLotteryDrawResult(input, finalPredecidedTeams);
    if (!validation.valid) {
      return {
        success: false,
        teams: [],
        protectedTeamIds: [],
        lockedTokenTeamIds: [],
        unlockedPlayerPoolIds: [],
        error: validation.error,
      };
    }

    return {
      success: true,
      teams: finalPredecidedTeams,
      protectedTeamIds,
      lockedTokenTeamIds: Array.from(lockedTokenTeamIds),
      unlockedPlayerPoolIds: [],
    };
  }

  // ===========================================================================
  // MODE A & MODE C: RANDOM FORMATION ('random') & MIXED MODE ('mixed')
  // ===========================================================================
  // Key requirement for Mixed Mode & Random Formation:
  // - Retrieve all eligible players, pre-decided teams (locked pairs), and lock settings.
  // - Preserve locked pairs (`activeLockedPairs`) and fixed pre-decided teams (`team.locked === true`).
  // - Exclude players already assigned to protected teams from the random pool.
  // - Randomly reshuffle all remaining eligible players to form fresh valid teams.
  // - Merge protected teams and newly generated teams into one complete draw.
  // - Never exclude, duplicate, or lose unlocked players!

  const reservedPlayerIds = new Set<string>();
  const protectedTeamIds = new Set<string>();
  const lockedTokenTeamIds = new Set<string>();

  // 1. Identify all locked pairs from `predefinedTeams` first
  for (const pair of activeLockedPairs) {
    reservedPlayerIds.add(pair.players[0]);
    reservedPlayerIds.add(pair.players[1]);
  }

  // 2. Identify explicitly locked teams (`team.locked === true`) in `currentTeams`
  // whose players don't conflict with a newly created locked pair
  const lockedExistingTeams: Team[] = [];
  const unlockedExistingTeams: Team[] = [];

  for (const team of currentTeams) {
    const hasPairConflict = team.players.some(
      (pid) =>
        pairedPlayerIds.has(pid) &&
        !activeLockedPairs.some(
          (pair) =>
            pair.players.length === team.players.length &&
            pair.players.every((pp) => team.players.includes(pp))
        )
    );

    if (team.locked && !hasPairConflict && team.players.length > 0) {
      lockedExistingTeams.push(team);
      protectedTeamIds.add(team.id);
      if (team.token) lockedTokenTeamIds.add(team.id);
      team.players.forEach((pid) => reservedPlayerIds.add(pid));
    } else {
      unlockedExistingTeams.push(team);
    }
  }

  // 3. Build Protected Team Shells for `activeLockedPairs` not already represented in `lockedExistingTeams`
  const protectedPairTeams: Team[] = [];
  const usedExistingTeamIds = new Set<string>(lockedExistingTeams.map((t) => t.id));

  for (let i = 0; i < activeLockedPairs.length; i++) {
    const pair = activeLockedPairs[i];
    const alreadyInLockedTeams = lockedExistingTeams.find(
      (lt) =>
        lt.players.length === pair.players.length &&
        pair.players.every((pid) => lt.players.includes(pid))
    );
    if (alreadyInLockedTeams) {
      // Update name if pair has a custom name
      if (pair.name) alreadyInLockedTeams.name = pair.name;
      continue;
    }

    // Check if an unlocked existing team matches this pair or pair ID
    const matchingUnlocked = unlockedExistingTeams.find(
      (ut) =>
        !usedExistingTeamIds.has(ut.id) &&
        (ut.id === pair.id ||
          (ut.players.length === pair.players.length &&
            pair.players.every((pid) => ut.players.includes(pid))))
    );

    const teamId = matchingUnlocked?.id || pair.id;
    usedExistingTeamIds.add(teamId);
    protectedTeamIds.add(teamId);

    protectedPairTeams.push({
      id: teamId,
      name: pair.name || matchingUnlocked?.name || `Team ${getTokenLabel(i)}`,
      players: [...pair.players],
      captainId: matchingUnlocked?.captainId || pair.players[0],
      locked: mode === 'mixed' ? true : Boolean(matchingUnlocked?.locked),
      lockedPlayerIds: [...pair.players],
      badge: matchingUnlocked?.badge || '🏸',
      avatarColor:
        matchingUnlocked?.avatarColor || GRADIENT_PALETTES[i % GRADIENT_PALETTES.length],
      token: matchingUnlocked?.token,
    });
  }

  // All protected teams (locked existing teams + locked pair teams)
  const allProtectedTeams: Team[] = [...lockedExistingTeams, ...protectedPairTeams];

  // Remaining unlocked existing team shells that were not turned into protected pair teams
  const reusableUnlockedShells = unlockedExistingTeams.filter(
    (ut) => !usedExistingTeamIds.has(ut.id)
  );

  // 4. Identify individually locked players (`team.lockedPlayerIds`) on reusable unlocked team shells
  const fixedPlayersByTeamId = new Map<string, string[]>();
  for (const shell of reusableUnlockedShells) {
    const pinned = (shell.lockedPlayerIds || []).filter(
      (pid) => pid && shell.players.includes(pid) && !reservedPlayerIds.has(pid)
    );
    pinned.forEach((pid) => reservedPlayerIds.add(pid));
    fixedPlayersByTeamId.set(shell.id, pinned);
  }

  // 5. Collect ALL remaining eligible unlocked players from both existing unlocked teams AND `currentPlayers`
  // so no unlocked player is EVER lost or excluded!
  const unlockedPoolSet = new Set<string>();
  for (const shell of reusableUnlockedShells) {
    for (const pid of shell.players) {
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

  // Count individually pinned players across unlocked shells
  let totalPinnedInUnlocked = 0;
  fixedPlayersByTeamId.forEach((list) => {
    totalPinnedInUnlocked += list.length;
  });

  // Total non-protected players that need unlocked team slots
  const totalPlayersForUnlockedTeams = totalPinnedInUnlocked + unlockedPool.length;
  const neededUnlockedTeamsFromPlayers = Math.floor(
    totalPlayersForUnlockedTeams / playersPerTeam
  );

  // Determine how many unlocked team shells we should have:
  // Never drop existing unlocked teams unless their players were moved into protected pairs,
  // and ALWAYS create enough unlocked teams to hold all remaining eligible players!
  const desiredUnlockedTeamCount =
    totalPlayersForUnlockedTeams > 0
      ? Math.max(
          neededUnlockedTeamsFromPlayers,
          reusableUnlockedShells.length > 0 &&
            reusableUnlockedShells.length <= neededUnlockedTeamsFromPlayers
            ? reusableUnlockedShells.length
            : neededUnlockedTeamsFromPlayers ||
              Math.max(0, (numTeamsRequested || 0) - allProtectedTeams.length)
        )
      : reusableUnlockedShells.length;

  const unlockedTeamShells: Team[] = [];
  for (let i = 0; i < desiredUnlockedTeamCount; i++) {
    const existingShell = reusableUnlockedShells[i];
    if (existingShell) {
      unlockedTeamShells.push({
        ...existingShell,
        locked: false,
        lockedPlayerIds: fixedPlayersByTeamId.get(existingShell.id) || [],
      });
    } else {
      const idx = allProtectedTeams.length + i;
      const newId = crypto.randomUUID();
      fixedPlayersByTeamId.set(newId, []);
      unlockedTeamShells.push({
        id: newId,
        name: `Team ${getTokenLabel(idx)}`,
        players: [],
        captainId: undefined,
        locked: false,
        lockedPlayerIds: [],
        badge: '🏸',
        avatarColor: GRADIENT_PALETTES[idx % GRADIENT_PALETTES.length],
      });
    }
  }

  // Calculate open slots across unlockedTeamShells
  let totalOpenSlots = 0;
  for (const shell of unlockedTeamShells) {
    const pinnedCount = fixedPlayersByTeamId.get(shell.id)?.length || 0;
    totalOpenSlots += Math.max(0, playersPerTeam - pinnedCount);
  }

  // Edge Case: No open slots or no unlocked players
  if (totalOpenSlots === 0 || unlockedPool.length === 0) {
    if (allProtectedTeams.length === 0 && unlockedTeamShells.length === 0) {
      return {
        success: false,
        teams: [],
        protectedTeamIds: [],
        lockedTokenTeamIds: [],
        unlockedPlayerPoolIds: [],
        error: 'No registered teams or eligible players found.',
      };
    }
    const mergedLockedOnly = [...allProtectedTeams, ...unlockedTeamShells];
    const { teams: withTokens } = assignUniqueTokens(
      mergedLockedOnly,
      lockedTokenTeamIds,
      currentTeams
    );
    return {
      success: true,
      teams: withTokens,
      protectedTeamIds: Array.from(protectedTeamIds),
      lockedTokenTeamIds: Array.from(lockedTokenTeamIds),
      unlockedPlayerPoolIds: [],
      noAlternativeReason:
        'All teams and players are currently locked. Unlock at least two players or teams to reshuffle.',
    };
  }

  // 6. Shuffle `unlockedPool` using Fisher-Yates and guarantee a fresh arrangement
  // compared to `currentTeams` whenever more than 1 valid arrangement exists.
  const prevPairingSig = currentTeams.length > 0 ? getPairingSignature(currentTeams) : '';
  const prevRosterSig = currentTeams.length > 0 ? getRosterSignature(currentTeams) : '';

  const buildCandidateUnlockedTeams = (shuffledUnlocked: string[]): Team[] => {
    const poolCopy = [...shuffledUnlocked];
    const activeSelectedCaptains =
      currentTeams.length === 0
        ? shuffleArray(selectedCaptains.filter((cid) => poolCopy.includes(cid)))
        : [];

    return unlockedTeamShells.map((shell, idx) => {
      const fixedPlayers = [...(fixedPlayersByTeamId.get(shell.id) || [])];
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

      const newCaptainId =
        shell.captainId && fixedPlayers.includes(shell.captainId)
          ? shell.captainId
          : roster[0];

      return {
        ...shell,
        name: getAutoTeamName(
          shell.name,
          shell.captainId,
          newCaptainId,
          allProtectedTeams.length + idx
        ),
        players: roster,
        captainId: newCaptainId,
        locked: false,
        lockedPlayerIds: fixedPlayers,
      };
    });
  };

  let bestUnlockedTeams = buildCandidateUnlockedTeams(shuffleArray(unlockedPool));
  let bestMerged = [...allProtectedTeams, ...bestUnlockedTeams];
  let foundDifferentPairing = false;
  let foundDifferentRoster = false;

  if (prevPairingSig) {
    for (let attempt = 0; attempt < 25; attempt++) {
      const candUnlocked = buildCandidateUnlockedTeams(shuffleArray(unlockedPool));
      const candMerged = [...allProtectedTeams, ...candUnlocked];
      const pairingSig = getPairingSignature(candMerged);
      const rosterSig = getRosterSignature(candMerged);

      if (pairingSig !== prevPairingSig) {
        bestUnlockedTeams = candUnlocked;
        bestMerged = candMerged;
        foundDifferentPairing = true;
        foundDifferentRoster = true;
        break;
      }
      if (!foundDifferentRoster && rosterSig !== prevRosterSig) {
        bestUnlockedTeams = candUnlocked;
        bestMerged = candMerged;
        foundDifferentRoster = true;
      }
    }

    // Deterministic swap fallback across unlocked teams if random attempts matched previous pairing
    if (!foundDifferentPairing && bestUnlockedTeams.length >= 2) {
      outerSwap: for (let a = 0; a < bestUnlockedTeams.length; a++) {
        for (let b = a + 1; b < bestUnlockedTeams.length; b++) {
          const teamA = bestUnlockedTeams[a];
          const teamB = bestUnlockedTeams[b];
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
              const swappedUnlocked = bestUnlockedTeams.map((t) => ({
                ...t,
                players: [...t.players],
              }));
              const temp = swappedUnlocked[a].players[mA];
              swappedUnlocked[a].players[mA] = swappedUnlocked[b].players[mB];
              swappedUnlocked[b].players[mB] = temp;

              for (const changedIdx of [a, b]) {
                const origShell = unlockedTeamShells[changedIdx];
                const fixedSet = new Set(fixedPlayersByTeamId.get(origShell.id) || []);
                const nextCap =
                  origShell.captainId && fixedSet.has(origShell.captainId)
                    ? origShell.captainId
                    : swappedUnlocked[changedIdx].players[0];
                swappedUnlocked[changedIdx].captainId = nextCap;
                swappedUnlocked[changedIdx].name = getAutoTeamName(
                  origShell.name,
                  origShell.captainId,
                  nextCap,
                  allProtectedTeams.length + changedIdx
                );
              }

              const candMerged = [...allProtectedTeams, ...swappedUnlocked];
              const newPSig = getPairingSignature(candMerged);
              const newRSig = getRosterSignature(candMerged);

              if (newPSig !== prevPairingSig) {
                bestUnlockedTeams = swappedUnlocked;
                bestMerged = candMerged;
                foundDifferentPairing = true;
                foundDifferentRoster = true;
                break outerSwap;
              }
              if (!foundDifferentRoster && newRSig !== prevRosterSig) {
                bestUnlockedTeams = swappedUnlocked;
                bestMerged = candMerged;
                foundDifferentRoster = true;
              }
            }
          }
        }
      }
    }
  }

  // If currentTeams already existed in a specific order, preserve locked teams in their original positions
  // or merge protected teams + newly shuffled unlocked teams cleanly
  const orderedMergedTeams: Team[] = [];
  if (currentTeams.length === bestMerged.length) {
    const byId = new Map(bestMerged.map((t) => [t.id, t]));
    const remaining = bestMerged.filter((t) => !currentTeams.some((ct) => ct.id === t.id));
    for (const ct of currentTeams) {
      const match = byId.get(ct.id) || remaining.shift();
      if (match) orderedMergedTeams.push(match);
    }
  } else {
    orderedMergedTeams.push(...bestMerged);
  }

  const { teams: finalTeamsWithTokens } = assignUniqueTokens(
    orderedMergedTeams,
    lockedTokenTeamIds,
    currentTeams
  );

  const validation = validateLotteryDrawResult(input, finalTeamsWithTokens);
  if (!validation.valid) {
    return {
      success: false,
      teams: [],
      protectedTeamIds: [],
      lockedTokenTeamIds: [],
      unlockedPlayerPoolIds: [],
      error: validation.error,
    };
  }

  const noAlternativeReason =
    prevPairingSig && !foundDifferentPairing && !foundDifferentRoster
      ? 'Only one valid player arrangement exists with the current lock constraints.'
      : undefined;

  return {
    success: true,
    teams: finalTeamsWithTokens,
    protectedTeamIds: Array.from(protectedTeamIds),
    lockedTokenTeamIds: Array.from(lockedTokenTeamIds),
    unlockedPlayerPoolIds: unlockedPool,
    noAlternativeReason,
  };
}
