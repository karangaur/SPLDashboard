import { KnockoutMatch, Match, Player, PredefinedTeam, Team } from '../types/tournament';

function getAutoTeamName(captainName: string | undefined, fallbackToken: string): string {
  const first = (captainName || '').trim().split(/\s+/)[0] || '';
  return first ? `Team ${first}` : `Team ${fallbackToken}`;
}

export interface ManualTeamEditInput {
  primaryTeamId: string;
  proposedPlayers: string[];
  proposedCaptainId?: string;
  proposedTeamName?: string;
  lockAction?: 'keep' | 'unlock';
  authorizeLockedEdit?: boolean;
  acknowledgeFixtureWarning?: boolean;
}

export interface ManualTeamEditStateSnapshot {
  teams: Team[];
  players: Player[];
  predefinedTeams: PredefinedTeam[];
  teamFormationMode: 'random' | 'predefined' | 'mixed';
  matches: Match[];
  knockoutMatches: KnockoutMatch[];
}

export interface TeamSwapDetail {
  slotIndex: number;
  outgoingPlayerId: string;
  outgoingPlayerName: string;
  incomingPlayerId: string;
  incomingPlayerName: string;
  counterpartTeamId: string;
  counterpartTeamName: string;
  counterpartTeamToken?: string;
  counterpartSlotIndex: number;
}

export interface FixtureConflictSummary {
  hasFixtures: boolean;
  hasLiveOrPaused: boolean;
  hasCompleted: boolean;
  hasUpcoming: boolean;
  liveMatches: (Match | KnockoutMatch)[];
  completedMatches: (Match | KnockoutMatch)[];
  upcomingMatches: (Match | KnockoutMatch)[];
  affectedTeamNames: string[];
}

export interface LockProtectionSummary {
  isProtected: boolean;
  primaryTeamLocked: boolean;
  primaryLockedPlayerIds: string[];
  primaryPredefinedPair: PredefinedTeam | null;
  counterpartLocks: {
    teamId: string;
    teamName: string;
    teamToken?: string;
    teamLocked: boolean;
    playerId: string;
    playerName: string;
    playerLocked: boolean;
    predefinedPair: PredefinedTeam | null;
  }[];
  warnings: string[];
}

export interface ManualTeamEditPreviewResult {
  valid: boolean;
  hasChanges: boolean;
  code?:
    | 'NO_CHANGES'
    | 'TEAM_NOT_FOUND'
    | 'INVALID_PLAYER_COUNT'
    | 'DUPLICATE_IN_SAME_TEAM'
    | 'UNKNOWN_PLAYER'
    | 'SWAP_CONFLICT'
    | 'DUPLICATE_ACROSS_TEAMS'
    | 'LOCK_AUTH_REQUIRED'
    | 'LIVE_MATCH_CONFLICT'
    | 'FIXTURE_CONFIRM_REQUIRED';
  error?: string;
  isSwap: boolean;
  swaps: TeamSwapDetail[];
  replacements: {
    slotIndex: number;
    outgoingPlayerId: string;
    outgoingPlayerName: string;
    incomingPlayerId: string;
    incomingPlayerName: string;
  }[];
  primaryTeamBefore: Team | null;
  primaryTeamAfter: Team | null;
  counterpartTeamsBefore: Team[];
  counterpartTeamsAfter: Team[];
  affectedTeamIds: string[];
  nextTeams: Team[];
  nextPredefinedTeams: PredefinedTeam[];
  lockProtection: LockProtectionSummary;
  fixtureConflict: FixtureConflictSummary;
}

function findPredefinedPairForTeam(
  team: Team,
  predefinedTeams: PredefinedTeam[]
): PredefinedTeam | null {
  if (!team || !Array.isArray(team.players) || team.players.length < 2) return null;
  const set = new Set(team.players);
  return (
    predefinedTeams.find(
      (pt) =>
        Array.isArray(pt.players) &&
        pt.players.length === 2 &&
        set.has(pt.players[0]) &&
        set.has(pt.players[1])
    ) || null
  );
}

function findPredefinedPairForPlayer(
  playerId: string,
  predefinedTeams: PredefinedTeam[]
): PredefinedTeam | null {
  if (!playerId) return null;
  return (
    predefinedTeams.find(
      (pt) => Array.isArray(pt.players) && pt.players.includes(playerId)
    ) || null
  );
}

function isAutoDerivedCaptainTeamName(team: Team, playersById: Map<string, Player>): boolean {
  const trimmed = (team.name || '').trim();
  if (!trimmed) return true;
  if (/^Team\s+[A-Z0-9]+$/i.test(trimmed)) return true;
  for (const pid of team.players) {
    const p = playersById.get(pid);
    if (p) {
      const expected = getAutoTeamName(p.name, team.token || 'A');
      if (trimmed.toLowerCase() === expected.toLowerCase()) {
        return true;
      }
    }
  }
  return false;
}

/**
 * Computes and validates a proposed manual team edit or cross-team player swap.
 * Pure, deterministic function used by both the Edit Team modal preview and the
 * authoritative persistence pipeline.
 */
export function computeManualTeamEdit(
  input: ManualTeamEditInput,
  snapshot: ManualTeamEditStateSnapshot
): ManualTeamEditPreviewResult {
  const playersById = new Map<string, Player>();
  for (const p of snapshot.players || []) {
    if (p && p.id) playersById.set(p.id, p);
  }

  const getPlayerName = (id: string) => playersById.get(id)?.name || 'Unknown Player';

  const currentTeams = (snapshot.teams || []).map((t) => ({
    ...t,
    players: [...(t.players || [])],
    lockedPlayerIds: Array.isArray(t.lockedPlayerIds) ? [...t.lockedPlayerIds] : [],
  }));

  const primaryTeamBefore = currentTeams.find((t) => t.id === input.primaryTeamId) || null;

  const emptyLockProtection: LockProtectionSummary = {
    isProtected: false,
    primaryTeamLocked: false,
    primaryLockedPlayerIds: [],
    primaryPredefinedPair: null,
    counterpartLocks: [],
    warnings: [],
  };

  const emptyFixtureConflict: FixtureConflictSummary = {
    hasFixtures: false,
    hasLiveOrPaused: false,
    hasCompleted: false,
    hasUpcoming: false,
    liveMatches: [],
    completedMatches: [],
    upcomingMatches: [],
    affectedTeamNames: [],
  };

  if (!primaryTeamBefore) {
    return {
      valid: false,
      hasChanges: false,
      code: 'TEAM_NOT_FOUND',
      error: 'The selected team could not be found.',
      isSwap: false,
      swaps: [],
      replacements: [],
      primaryTeamBefore: null,
      primaryTeamAfter: null,
      counterpartTeamsBefore: [],
      counterpartTeamsAfter: [],
      affectedTeamIds: [],
      nextTeams: currentTeams,
      nextPredefinedTeams: snapshot.predefinedTeams || [],
      lockProtection: emptyLockProtection,
      fixtureConflict: emptyFixtureConflict,
    };
  }

  const expectedSlotCount = Math.max(2, primaryTeamBefore.players.length || 2);
  const proposedPlayers = (input.proposedPlayers || []).map((id) => (id || '').trim()).filter(Boolean);

  if (proposedPlayers.length !== expectedSlotCount) {
    return {
      valid: false,
      hasChanges: false,
      code: 'INVALID_PLAYER_COUNT',
      error: `A valid team must contain exactly ${expectedSlotCount} players. Empty player slots are not allowed.`,
      isSwap: false,
      swaps: [],
      replacements: [],
      primaryTeamBefore,
      primaryTeamAfter: null,
      counterpartTeamsBefore: [],
      counterpartTeamsAfter: [],
      affectedTeamIds: [primaryTeamBefore.id],
      nextTeams: currentTeams,
      nextPredefinedTeams: snapshot.predefinedTeams || [],
      lockProtection: emptyLockProtection,
      fixtureConflict: emptyFixtureConflict,
    };
  }

  const uniqueProposed = new Set(proposedPlayers);
  if (uniqueProposed.size !== proposedPlayers.length) {
    return {
      valid: false,
      hasChanges: false,
      code: 'DUPLICATE_IN_SAME_TEAM',
      error: 'A player cannot be assigned to both positions on the same team.',
      isSwap: false,
      swaps: [],
      replacements: [],
      primaryTeamBefore,
      primaryTeamAfter: null,
      counterpartTeamsBefore: [],
      counterpartTeamsAfter: [],
      affectedTeamIds: [primaryTeamBefore.id],
      nextTeams: currentTeams,
      nextPredefinedTeams: snapshot.predefinedTeams || [],
      lockProtection: emptyLockProtection,
      fixtureConflict: emptyFixtureConflict,
    };
  }

  for (const pid of proposedPlayers) {
    if (!playersById.has(pid)) {
      return {
        valid: false,
        hasChanges: false,
        code: 'UNKNOWN_PLAYER',
        error: `Selected player (${pid}) does not exist in the registered players list.`,
        isSwap: false,
        swaps: [],
        replacements: [],
        primaryTeamBefore,
        primaryTeamAfter: null,
        counterpartTeamsBefore: [],
        counterpartTeamsAfter: [],
        affectedTeamIds: [primaryTeamBefore.id],
        nextTeams: currentTeams,
        nextPredefinedTeams: snapshot.predefinedTeams || [],
        lockProtection: emptyLockProtection,
        fixtureConflict: emptyFixtureConflict,
      };
    }
  }

  // Determine slot changes on the primary team
  const swaps: TeamSwapDetail[] = [];
  const replacements: {
    slotIndex: number;
    outgoingPlayerId: string;
    outgoingPlayerName: string;
    incomingPlayerId: string;
    incomingPlayerName: string;
  }[] = [];

  // Map each team for working mutations
  const nextTeamsMap = new Map<string, Team>();
  for (const t of currentTeams) {
    nextTeamsMap.set(t.id, {
      ...t,
      players: [...t.players],
      lockedPlayerIds: Array.isArray(t.lockedPlayerIds) ? [...t.lockedPlayerIds] : [],
    });
  }

  const workingPrimary = nextTeamsMap.get(primaryTeamBefore.id)!;
  const counterpartBeforeMap = new Map<string, Team>();

  // If the two players on the primary team were simply reordered within the same team, handle cleanly
  const sameRosterSet =
    primaryTeamBefore.players.length === proposedPlayers.length &&
    primaryTeamBefore.players.every((id) => proposedPlayers.includes(id));

  if (!sameRosterSet) {
    for (let slotIdx = 0; slotIdx < expectedSlotCount; slotIdx++) {
      const oldPlayerId = primaryTeamBefore.players[slotIdx];
      const newPlayerId = proposedPlayers[slotIdx];

      if (oldPlayerId === newPlayerId) continue;

      // If newPlayerId was already on primaryTeamBefore at another slot, determine which player actually left
      const actualOutgoingPlayerId = !proposedPlayers.includes(oldPlayerId)
        ? oldPlayerId
        : primaryTeamBefore.players.find((id) => !proposedPlayers.includes(id)) || oldPlayerId;

      // Check if newPlayerId belongs to another team
      const otherTeamOrig = currentTeams.find(
        (t) => t.id !== primaryTeamBefore.id && t.players.includes(newPlayerId)
      );

      if (otherTeamOrig) {
        if (!counterpartBeforeMap.has(otherTeamOrig.id)) {
          counterpartBeforeMap.set(otherTeamOrig.id, {
            ...otherTeamOrig,
            players: [...otherTeamOrig.players],
            lockedPlayerIds: Array.isArray(otherTeamOrig.lockedPlayerIds)
              ? [...otherTeamOrig.lockedPlayerIds]
              : [],
          });
        }

        const workingOther = nextTeamsMap.get(otherTeamOrig.id)!;
        const otherSlotIdx = workingOther.players.indexOf(newPlayerId);

        if (otherSlotIdx === -1) {
          return {
            valid: false,
            hasChanges: true,
            code: 'SWAP_CONFLICT',
            error: `Could not locate ${getPlayerName(newPlayerId)} in ${otherTeamOrig.name} for swapping.`,
            isSwap: true,
            swaps: [],
            replacements: [],
            primaryTeamBefore,
            primaryTeamAfter: null,
            counterpartTeamsBefore: Array.from(counterpartBeforeMap.values()),
            counterpartTeamsAfter: [],
            affectedTeamIds: [primaryTeamBefore.id, otherTeamOrig.id],
            nextTeams: currentTeams,
            nextPredefinedTeams: snapshot.predefinedTeams || [],
            lockProtection: emptyLockProtection,
            fixtureConflict: emptyFixtureConflict,
          };
        }

        // Perform 1-for-1 swap in workingOther
        workingOther.players[otherSlotIdx] = actualOutgoingPlayerId;

        // Update captain on counterpart team if the swapped-out player was captain
        if (workingOther.captainId === newPlayerId || !workingOther.players.includes(workingOther.captainId || '')) {
          const newOtherCapId = workingOther.players[0] || actualOutgoingPlayerId;
          const wasAutoNamed = isAutoDerivedCaptainTeamName(otherTeamOrig, playersById);
          workingOther.captainId = newOtherCapId;
          if (wasAutoNamed) {
            const newCapPlayer = playersById.get(newOtherCapId);
            if (newCapPlayer) {
              workingOther.name = getAutoTeamName(newCapPlayer.name, workingOther.token || 'A');
            }
          }
        }

        // Update lockedPlayerIds on counterpart team if lock is preserved
        if (Array.isArray(workingOther.lockedPlayerIds) && workingOther.lockedPlayerIds.includes(newPlayerId)) {
          workingOther.lockedPlayerIds = workingOther.lockedPlayerIds.map((id) =>
            id === newPlayerId ? actualOutgoingPlayerId : id
          );
        }

        swaps.push({
          slotIndex: slotIdx,
          outgoingPlayerId: actualOutgoingPlayerId,
          outgoingPlayerName: getPlayerName(actualOutgoingPlayerId),
          incomingPlayerId: newPlayerId,
          incomingPlayerName: getPlayerName(newPlayerId),
          counterpartTeamId: otherTeamOrig.id,
          counterpartTeamName: otherTeamOrig.name,
          counterpartTeamToken: otherTeamOrig.token,
          counterpartSlotIndex: otherSlotIdx,
        });
      } else {
        replacements.push({
          slotIndex: slotIdx,
          outgoingPlayerId: actualOutgoingPlayerId,
          outgoingPlayerName: getPlayerName(actualOutgoingPlayerId),
          incomingPlayerId: newPlayerId,
          incomingPlayerName: getPlayerName(newPlayerId),
        });
      }
    }
  }

  // Update primary team players, captain, name, and locks
  workingPrimary.players = [...proposedPlayers];

  const desiredCaptainId =
    input.proposedCaptainId && proposedPlayers.includes(input.proposedCaptainId)
      ? input.proposedCaptainId
      : workingPrimary.captainId && proposedPlayers.includes(workingPrimary.captainId)
      ? workingPrimary.captainId
      : proposedPlayers[0];

  const primaryWasAutoNamed = isAutoDerivedCaptainTeamName(primaryTeamBefore, playersById);
  workingPrimary.captainId = desiredCaptainId;

  if (input.proposedTeamName && input.proposedTeamName.trim()) {
    workingPrimary.name = input.proposedTeamName.trim();
  } else if (primaryWasAutoNamed && desiredCaptainId) {
    const capPlayer = playersById.get(desiredCaptainId);
    if (capPlayer) {
      workingPrimary.name = getAutoTeamName(capPlayer.name, workingPrimary.token || 'A');
    }
  }

  // Evaluate lock protection before mutating lock state
  const predefinedTeams = snapshot.predefinedTeams || [];
  const primaryPredefinedPair = findPredefinedPairForTeam(primaryTeamBefore, predefinedTeams);
  const primaryLockedPlayerIds = (primaryTeamBefore.lockedPlayerIds || []).filter((id) =>
    primaryTeamBefore.players.includes(id)
  );
  const changedPrimaryPlayerIds = primaryTeamBefore.players.filter(
    (id) => !proposedPlayers.includes(id)
  );
  const touchedPrimaryLockedPlayers = primaryLockedPlayerIds.filter((id) =>
    changedPrimaryPlayerIds.includes(id)
  );

  const counterpartLocks: LockProtectionSummary['counterpartLocks'] = [];
  for (const s of swaps) {
    const otherBefore = counterpartBeforeMap.get(s.counterpartTeamId);
    if (!otherBefore) continue;
    const otherPlayerLocked = (otherBefore.lockedPlayerIds || []).includes(s.incomingPlayerId);
    const otherPredefined =
      findPredefinedPairForTeam(otherBefore, predefinedTeams) ||
      findPredefinedPairForPlayer(s.incomingPlayerId, predefinedTeams);
    if (otherBefore.locked || otherPlayerLocked || otherPredefined) {
      counterpartLocks.push({
        teamId: otherBefore.id,
        teamName: otherBefore.name,
        teamToken: otherBefore.token,
        teamLocked: Boolean(otherBefore.locked),
        playerId: s.incomingPlayerId,
        playerName: s.incomingPlayerName,
        playerLocked: otherPlayerLocked,
        predefinedPair: otherPredefined,
      });
    }
  }

  const rosterChanged = !sameRosterSet;
  const isPredefinedMode = snapshot.teamFormationMode === 'predefined';
  const primaryHasLock =
    Boolean(primaryTeamBefore.locked) ||
    touchedPrimaryLockedPlayers.length > 0 ||
    Boolean(primaryPredefinedPair) ||
    (isPredefinedMode && rosterChanged);

  const lockWarnings: string[] = [];
  if (rosterChanged) {
    if (primaryTeamBefore.locked) {
      lockWarnings.push(
        `${primaryTeamBefore.name}${primaryTeamBefore.token ? ` (Token ${primaryTeamBefore.token})` : ''} is currently locked against shuffle changes.`
      );
    }
    if (primaryPredefinedPair) {
      lockWarnings.push(
        `${primaryTeamBefore.name} is a Pre-Decided locked pair (${primaryPredefinedPair.name}).`
      );
    } else if (isPredefinedMode) {
      lockWarnings.push(
        `Tournament is in Pre-Decided Teams mode; modifying this team changes a fixed pair.`
      );
    }
    if (touchedPrimaryLockedPlayers.length > 0) {
      const names = touchedPrimaryLockedPlayers.map(getPlayerName).join(', ');
      lockWarnings.push(`Locked player(s) on ${primaryTeamBefore.name} will be replaced: ${names}.`);
    }
    for (const cl of counterpartLocks) {
      lockWarnings.push(
        `${cl.playerName} belongs to locked team/pair ${cl.teamName}${cl.teamToken ? ` (Token ${cl.teamToken})` : ''}.`
      );
    }
  }

  const lockProtection: LockProtectionSummary = {
    isProtected: rosterChanged && (primaryHasLock || counterpartLocks.length > 0),
    primaryTeamLocked: Boolean(primaryTeamBefore.locked),
    primaryLockedPlayerIds,
    primaryPredefinedPair,
    counterpartLocks,
    warnings: lockWarnings,
  };

  // Apply lockAction ('keep' by default, 'unlock' only if explicitly chosen)
  const lockAction = input.lockAction || 'keep';
  let nextPredefinedTeams = predefinedTeams.map((pt) => ({
    ...pt,
    players: [...pt.players] as [string, string],
  }));

  if (lockAction === 'unlock') {
    workingPrimary.locked = false;
    workingPrimary.lockedPlayerIds = [];
    if (primaryPredefinedPair) {
      nextPredefinedTeams = nextPredefinedTeams.filter((pt) => pt.id !== primaryPredefinedPair.id);
    }
  } else {
    // Keep lock state: map any replaced lockedPlayerIds to their corresponding new player in the same slot
    if (Array.isArray(primaryTeamBefore.lockedPlayerIds) && primaryTeamBefore.lockedPlayerIds.length > 0) {
      const updatedLockedIds: string[] = [];
      for (let i = 0; i < expectedSlotCount; i++) {
        const oldPid = primaryTeamBefore.players[i];
        const newPid = proposedPlayers[i];
        if (primaryTeamBefore.lockedPlayerIds.includes(oldPid) && newPid) {
          updatedLockedIds.push(newPid);
        }
      }
      workingPrimary.lockedPlayerIds = Array.from(new Set(updatedLockedIds));
    }

    // Update predefinedTeams entry for primary team if it had one
    if (primaryPredefinedPair && proposedPlayers.length >= 2) {
      nextPredefinedTeams = nextPredefinedTeams.map((pt) =>
        pt.id === primaryPredefinedPair.id
          ? {
              ...pt,
              name: workingPrimary.name || pt.name,
              players: [proposedPlayers[0], proposedPlayers[1]] as [string, string],
            }
          : pt
      );
    }

    // Also update any predefinedTeams entry for swapped counterpart teams so locked pairs stay in sync
    for (const s of swaps) {
      const otherBefore = counterpartBeforeMap.get(s.counterpartTeamId);
      const otherAfter = nextTeamsMap.get(s.counterpartTeamId);
      if (otherBefore && otherAfter && otherAfter.players.length >= 2) {
        const otherPair = findPredefinedPairForTeam(otherBefore, nextPredefinedTeams);
        if (otherPair) {
          nextPredefinedTeams = nextPredefinedTeams.map((pt) =>
            pt.id === otherPair.id
              ? {
                  ...pt,
                  name: otherAfter.name || pt.name,
                  players: [otherAfter.players[0], otherAfter.players[1]] as [string, string],
                }
              : pt
          );
        }
      }
    }
  }

  const affectedTeamIds = [
    primaryTeamBefore.id,
    ...Array.from(counterpartBeforeMap.keys()),
  ];
  const affectedIdSet = new Set(affectedTeamIds);

  // Check if anything actually changed
  const primaryChanged =
    workingPrimary.name !== primaryTeamBefore.name ||
    workingPrimary.captainId !== primaryTeamBefore.captainId ||
    Boolean(workingPrimary.locked) !== Boolean(primaryTeamBefore.locked) ||
    JSON.stringify(workingPrimary.players) !== JSON.stringify(primaryTeamBefore.players) ||
    JSON.stringify(workingPrimary.lockedPlayerIds || []) !==
      JSON.stringify(primaryTeamBefore.lockedPlayerIds || []);

  const hasChanges = primaryChanged || swaps.length > 0 || replacements.length > 0;

  // Evaluate Fixture & Match Conflicts for affected teams
  const allGroupMatches = snapshot.matches || [];
  const allKoMatches = snapshot.knockoutMatches || [];

  const affectedGroupMatches = allGroupMatches.filter(
    (m) => affectedIdSet.has(m.teamA) || affectedIdSet.has(m.teamB)
  );
  const affectedKoMatches = allKoMatches.filter(
    (m) => (m.teamA && affectedIdSet.has(m.teamA)) || (m.teamB && affectedIdSet.has(m.teamB))
  );
  const allAffectedMatches: (Match | KnockoutMatch)[] = [
    ...affectedGroupMatches,
    ...affectedKoMatches,
  ];

  const liveMatches = allAffectedMatches.filter(
    (m) => m.status === 'live' || m.status === 'paused'
  );
  const completedMatches = allAffectedMatches.filter((m) => m.status === 'completed');
  const upcomingMatches = allAffectedMatches.filter((m) => m.status === 'upcoming');

  const affectedTeamNames = affectedTeamIds
    .map((id) => currentTeams.find((t) => t.id === id)?.name || '')
    .filter(Boolean);

  const fixtureConflict: FixtureConflictSummary = {
    hasFixtures: allAffectedMatches.length > 0,
    hasLiveOrPaused: liveMatches.length > 0,
    hasCompleted: completedMatches.length > 0,
    hasUpcoming: upcomingMatches.length > 0,
    liveMatches,
    completedMatches,
    upcomingMatches,
    affectedTeamNames,
  };

  const nextTeams = currentTeams.map((t) => nextTeamsMap.get(t.id) || t);
  const counterpartTeamsBefore = Array.from(counterpartBeforeMap.values());
  const counterpartTeamsAfter = counterpartTeamsBefore
    .map((t) => nextTeamsMap.get(t.id))
    .filter((t): t is Team => Boolean(t));

  // Global duplicate check across ALL teams
  const seenPlayers = new Map<string, string>();
  for (const t of nextTeams) {
    const teamUnique = new Set(t.players);
    if (teamUnique.size !== t.players.length) {
      return {
        valid: false,
        hasChanges,
        code: 'DUPLICATE_IN_SAME_TEAM',
        error: `Team "${t.name}" contains duplicate players.`,
        isSwap: swaps.length > 0,
        swaps,
        replacements,
        primaryTeamBefore,
        primaryTeamAfter: workingPrimary,
        counterpartTeamsBefore,
        counterpartTeamsAfter,
        affectedTeamIds,
        nextTeams,
        nextPredefinedTeams,
        lockProtection,
        fixtureConflict,
      };
    }
    for (const pid of t.players) {
      const existingTeamName = seenPlayers.get(pid);
      if (existingTeamName) {
        return {
          valid: false,
          hasChanges,
          code: 'DUPLICATE_ACROSS_TEAMS',
          error: `${getPlayerName(pid)} cannot belong to both "${existingTeamName}" and "${t.name}".`,
          isSwap: swaps.length > 0,
          swaps,
          replacements,
          primaryTeamBefore,
          primaryTeamAfter: workingPrimary,
          counterpartTeamsBefore,
          counterpartTeamsAfter,
          affectedTeamIds,
          nextTeams,
          nextPredefinedTeams,
          lockProtection,
          fixtureConflict,
        };
      }
      seenPlayers.set(pid, t.name);
    }
  }

  // Block roster mutations if a team is currently playing a LIVE or PAUSED match
  if (rosterChanged && fixtureConflict.hasLiveOrPaused) {
    return {
      valid: false,
      hasChanges,
      code: 'LIVE_MATCH_CONFLICT',
      error: `Cannot replace or swap players while ${affectedTeamNames.join(' / ')} has an active LIVE or PAUSED match on court.`,
      isSwap: swaps.length > 0,
      swaps,
      replacements,
      primaryTeamBefore,
      primaryTeamAfter: workingPrimary,
      counterpartTeamsBefore,
      counterpartTeamsAfter,
      affectedTeamIds,
      nextTeams,
      nextPredefinedTeams,
      lockProtection,
      fixtureConflict,
    };
  }

  // Require explicit admin authorization if modifying a locked team/player/pre-decided pair
  if (lockProtection.isProtected && !input.authorizeLockedEdit) {
    return {
      valid: false,
      hasChanges,
      code: 'LOCK_AUTH_REQUIRED',
      error: 'Please confirm authorization to modify this locked team / pre-decided pair before saving.',
      isSwap: swaps.length > 0,
      swaps,
      replacements,
      primaryTeamBefore,
      primaryTeamAfter: workingPrimary,
      counterpartTeamsBefore,
      counterpartTeamsAfter,
      affectedTeamIds,
      nextTeams,
      nextPredefinedTeams,
      lockProtection,
      fixtureConflict,
    };
  }

  // Require explicit confirmation if affected teams already have scheduled or completed fixtures
  if (rosterChanged && fixtureConflict.hasFixtures && !input.acknowledgeFixtureWarning) {
    return {
      valid: false,
      hasChanges,
      code: 'FIXTURE_CONFIRM_REQUIRED',
      error: 'Please acknowledge the existing match fixture warning before saving team member changes.',
      isSwap: swaps.length > 0,
      swaps,
      replacements,
      primaryTeamBefore,
      primaryTeamAfter: workingPrimary,
      counterpartTeamsBefore,
      counterpartTeamsAfter,
      affectedTeamIds,
      nextTeams,
      nextPredefinedTeams,
      lockProtection,
      fixtureConflict,
    };
  }

  return {
    valid: true,
    hasChanges,
    isSwap: swaps.length > 0,
    swaps,
    replacements,
    primaryTeamBefore,
    primaryTeamAfter: workingPrimary,
    counterpartTeamsBefore,
    counterpartTeamsAfter,
    affectedTeamIds,
    nextTeams,
    nextPredefinedTeams,
    lockProtection,
    fixtureConflict,
  };
}
