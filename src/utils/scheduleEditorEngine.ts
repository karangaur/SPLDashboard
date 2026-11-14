import { KnockoutMatch, Match, Team } from '../types/tournament';

export interface ParsedMatchScheduleTime {
  date?: string;
  startTime?: string;
  isCustomSchedule: boolean;
}

const ISO_DATE_REGEX = /\b(\d{4}-\d{2}-\d{2})\b/;
const TIME_24_OR_12_REGEX = /\b(\d{1,2}:\d{2}(?:\s*[APap][Mm])?)\b/;

/**
 * Parses `date` (YYYY-MM-DD) and `startTime` (HH:MM or hh:mm AM/PM) from a Match `time` string.
 * Allows structured date & time to persist in Supabase `public.matches.time` without schema changes.
 */
export function parseMatchScheduleTime(timeStr?: string): ParsedMatchScheduleTime {
  if (!timeStr || typeof timeStr !== 'string') {
    return { isCustomSchedule: false };
  }
  const trimmed = timeStr.trim();
  if (!trimmed) {
    return { isCustomSchedule: false };
  }

  const dateMatch = trimmed.match(ISO_DATE_REGEX);
  const timeMatch = trimmed.match(TIME_24_OR_12_REGEX);

  const date = dateMatch ? dateMatch[1] : undefined;
  const startTime = timeMatch ? timeMatch[1].trim() : undefined;

  if (date || startTime) {
    return {
      date,
      startTime,
      isCustomSchedule: true,
    };
  }

  // Check if it's a default auto-generated label like "Round 1 · Slot 1 · Court 1" or "Round 1 · Court 1"
  const isAutoLabel = /^Round\s+\d+/i.test(trimmed);
  return {
    startTime: isAutoLabel ? undefined : trimmed,
    isCustomSchedule: !isAutoLabel,
  };
}

/**
 * Formats a Match `time` string from optional `date` and `startTime`, falling back to round/court metadata.
 */
export function formatMatchScheduleTime(params: {
  date?: string;
  startTime?: string;
  round: number;
  court: number;
  courtName?: string;
  courtSlot?: number;
  existingTime?: string;
}): string {
  const cleanDate = params.date?.trim() || '';
  const cleanTime = params.startTime?.trim() || '';

  if (cleanDate && cleanTime) {
    return `${cleanDate} · ${cleanTime}`;
  }
  if (cleanDate) {
    return cleanDate;
  }
  if (cleanTime) {
    return cleanTime;
  }

  const courtLabel = params.courtName?.trim() || `Court ${params.court || 1}`;
  if (params.courtSlot) {
    return `Round ${params.round || 1} · Slot ${params.courtSlot} · ${courtLabel}`;
  }
  return `Round ${params.round || 1} · ${courtLabel}`;
}

export function resolveCourtDisplayName(courtNum: number, courtNames?: string[]): string {
  const idx = Math.max(0, (courtNum || 1) - 1);
  const custom = courtNames?.[idx]?.trim();
  return custom && custom.length > 0 ? custom : `Court ${courtNum || 1}`;
}

/**
 * Normalizes match sequence numbers (`courtSlot`, `slot`, `matchNumber` = 1..N),
 * court names, and parsed `date` / `startTime` fields while preserving all match IDs and scores.
 */
export function normalizeScheduleSequence(
  matches: Match[],
  courtNames?: string[]
): Match[] {
  return (matches || []).map((m, idx) => {
    const seqNum = idx + 1;
    const courtNum = Math.max(1, Number(m.court) || 1);
    const courtName = resolveCourtDisplayName(courtNum, courtNames);
    const parsed = parseMatchScheduleTime(m.time);
    const date = m.date !== undefined ? m.date : parsed.date;
    const startTime = m.startTime !== undefined ? m.startTime : parsed.startTime;

    const formattedTime = formatMatchScheduleTime({
      date,
      startTime,
      round: m.round || 1,
      court: courtNum,
      courtName,
      courtSlot: seqNum,
      existingTime: m.time,
    });

    return {
      ...m,
      round: Math.max(1, Number(m.round) || 1),
      court: courtNum,
      courtName,
      courtSlot: seqNum,
      slot: seqNum,
      matchNumber: seqNum,
      date: date || undefined,
      startTime: startTime || undefined,
      time: formattedTime,
    };
  });
}

/**
 * Sorts matches loaded from database or state by their explicit manual sequence (`courtSlot` / `slot`),
 * preserving original array order when slots are equal.
 */
export function sortMatchesByScheduleOrder(matches: Match[]): Match[] {
  return matches
    .map((m, idx) => ({ m, idx }))
    .sort((a, b) => {
      const slotA = a.m.matchNumber ?? a.m.courtSlot ?? a.m.slot;
      const slotB = b.m.matchNumber ?? b.m.courtSlot ?? b.m.slot;
      if (slotA != null && slotB != null && slotA !== slotB) {
        return slotA - slotB;
      }
      if (slotA != null && slotB == null) return -1;
      if (slotA == null && slotB != null) return 1;
      return a.idx - b.idx;
    })
    .map((entry) => entry.m);
}

/**
 * Moves a match from `fromIndex` to `toIndex` (0-indexed) and recalculates sequential match numbers (1..N)
 * without regenerating fixtures or resetting any match scores.
 */
export function reorderScheduleMatches(
  matches: Match[],
  fromIndex: number,
  toIndex: number,
  courtNames?: string[]
): Match[] {
  if (
    fromIndex < 0 ||
    fromIndex >= matches.length ||
    toIndex < 0 ||
    toIndex >= matches.length ||
    fromIndex === toIndex
  ) {
    return normalizeScheduleSequence(matches, courtNames);
  }
  const next = [...matches];
  const [moved] = next.splice(fromIndex, 1);
  next.splice(toIndex, 0, moved);
  return normalizeScheduleSequence(next, courtNames);
}

/**
 * Swaps two matches at `indexA` and `indexB` (0-indexed) and recalculates sequential match numbers (1..N).
 */
export function swapScheduleMatches(
  matches: Match[],
  indexA: number,
  indexB: number,
  courtNames?: string[]
): Match[] {
  if (
    indexA < 0 ||
    indexA >= matches.length ||
    indexB < 0 ||
    indexB >= matches.length ||
    indexA === indexB
  ) {
    return normalizeScheduleSequence(matches, courtNames);
  }
  const next = [...matches];
  const temp = next[indexA];
  next[indexA] = next[indexB];
  next[indexB] = temp;
  return normalizeScheduleSequence(next, courtNames);
}

/**
 * Reorders matches within a specific court or moves a match to another court at a specific court-local index.
 */
export function moveMatchAcrossOrWithinCourt(
  matches: Match[],
  matchId: string,
  targetCourt: number,
  targetCourtLocalIndex?: number,
  courtNames?: string[]
): Match[] {
  const sourceIdx = matches.findIndex((m) => m.id === matchId);
  if (sourceIdx === -1) return normalizeScheduleSequence(matches, courtNames);

  const validCourt = Math.max(1, Number(targetCourt) || 1);
  const updatedMatches = matches.map((m) =>
    m.id === matchId
      ? {
          ...m,
          court: validCourt,
          courtName: resolveCourtDisplayName(validCourt, courtNames),
        }
      : { ...m }
  );

  if (targetCourtLocalIndex === undefined) {
    return normalizeScheduleSequence(updatedMatches, courtNames);
  }

  const targetMatch = updatedMatches[sourceIdx];
  const remaining = updatedMatches.filter((m) => m.id !== matchId);
  const targetCourtMatches = remaining.filter((m) => m.court === validCourt);

  const clampedLocalIdx = Math.max(0, Math.min(targetCourtMatches.length, targetCourtLocalIndex));

  let globalInsertIdx = remaining.length;
  if (targetCourtMatches.length === 0) {
    globalInsertIdx = remaining.length;
  } else if (clampedLocalIdx >= targetCourtMatches.length) {
    const lastCourtMatch = targetCourtMatches[targetCourtMatches.length - 1];
    globalInsertIdx = remaining.findIndex((m) => m.id === lastCourtMatch.id) + 1;
  } else {
    const anchorMatch = targetCourtMatches[clampedLocalIdx];
    globalInsertIdx = remaining.findIndex((m) => m.id === anchorMatch.id);
  }

  remaining.splice(globalInsertIdx, 0, targetMatch);
  return normalizeScheduleSequence(remaining, courtNames);
}

export interface UpdateDraftMatchResult {
  success: boolean;
  error?: string;
  matches: Match[];
}

/**
 * Updates an individual match inside the Schedule Editor draft while protecting live & completed match integrity.
 */
export function updateMatchInDraft(
  matches: Match[],
  matchId: string,
  updates: {
    matchNumber?: number;
    teamA?: string;
    teamB?: string;
    court?: number;
    round?: number;
    date?: string;
    startTime?: string;
    status?: Match['status'];
  },
  courtNames?: string[]
): UpdateDraftMatchResult {
  const currentIdx = matches.findIndex((m) => m.id === matchId);
  if (currentIdx === -1) {
    return { success: false, error: 'Match not found in schedule.', matches };
  }

  const existing = matches[currentIdx];
  const isCompleted = existing.status === 'completed';
  const isLiveOrPaused = existing.status === 'live' || existing.status === 'paused';

  // Protect Completed Matches from team replacement or unauthorized status regression in Schedule Editor
  if (isCompleted) {
    if (
      (updates.teamA !== undefined && updates.teamA !== existing.teamA) ||
      (updates.teamB !== undefined && updates.teamB !== existing.teamB)
    ) {
      return {
        success: false,
        error:
          'Completed matches cannot have their participating teams changed because historical scores and standings depend on them.',
        matches,
      };
    }
    if (updates.status !== undefined && updates.status !== 'completed') {
      return {
        success: false,
        error:
          'Completed match status is protected in the Schedule Editor. Use the Match Center Reset Score control if you intend to clear a finished result.',
        matches,
      };
    }
  }

  // Protect Live Matches from team replacement while active on court
  if (isLiveOrPaused) {
    if (
      (updates.teamA !== undefined && updates.teamA !== existing.teamA) ||
      (updates.teamB !== undefined && updates.teamB !== existing.teamB)
    ) {
      return {
        success: false,
        error:
          'Cannot replace teams on a match that is currently LIVE or PAUSED on court.',
        matches,
      };
    }
  }

  const nextTeamA = updates.teamA !== undefined ? updates.teamA : existing.teamA;
  const nextTeamB = updates.teamB !== undefined ? updates.teamB : existing.teamB;

  if (!nextTeamA || !nextTeamB) {
    return {
      success: false,
      error: 'Both Team A and Team B must be selected.',
      matches,
    };
  }

  if (nextTeamA === nextTeamB) {
    return {
      success: false,
      error: 'A team cannot play against itself. Please select two different teams.',
      matches,
    };
  }

  const nextCourt =
    updates.court !== undefined ? Math.max(1, Number(updates.court) || 1) : existing.court;
  const nextRound =
    updates.round !== undefined ? Math.max(1, Number(updates.round) || 1) : existing.round;
  const nextDate = updates.date !== undefined ? updates.date : existing.date;
  const nextStartTime = updates.startTime !== undefined ? updates.startTime : existing.startTime;
  const nextStatus = updates.status !== undefined ? updates.status : existing.status;

  // Validate status transition in Schedule Editor: cannot mark 'completed' without a winning score
  if (nextStatus === 'completed' && existing.status !== 'completed') {
    const sA = existing.scoreA ?? 0;
    const sB = existing.scoreB ?? 0;
    if (sA === sB) {
      return {
        success: false,
        error:
          'Cannot set match status to Completed while the score is tied (0 - 0). Record the match score in the Umpire Console first.',
        matches,
      };
    }
  }

  const updatedMatch: Match = {
    ...existing,
    teamA: nextTeamA,
    teamB: nextTeamB,
    court: nextCourt,
    courtName: resolveCourtDisplayName(nextCourt, courtNames),
    round: nextRound,
    date: nextDate ? nextDate.trim() : undefined,
    startTime: nextStartTime ? nextStartTime.trim() : undefined,
    status: nextStatus,
  };

  let working = matches.map((m, idx) => (idx === currentIdx ? updatedMatch : m));

  // If matchNumber (1-based sequence position) was explicitly changed, move match to that position
  if (
    updates.matchNumber !== undefined &&
    Number.isFinite(updates.matchNumber) &&
    updates.matchNumber !== currentIdx + 1
  ) {
    const targetIdx = Math.max(0, Math.min(working.length - 1, Math.round(updates.matchNumber) - 1));
    working = reorderScheduleMatches(working, currentIdx, targetIdx, courtNames);
  } else {
    working = normalizeScheduleSequence(working, courtNames);
  }

  return {
    success: true,
    matches: working,
  };
}

/**
 * Adds a new upcoming match to the draft schedule at the specified sequence position (or end of list).
 */
export function addMatchToDraft(
  matches: Match[],
  newMatchInput: {
    teamA: string;
    teamB: string;
    court: number;
    round: number;
    date?: string;
    startTime?: string;
    insertAtMatchNumber?: number;
  },
  courtNames?: string[]
): UpdateDraftMatchResult {
  const { teamA, teamB, court, round, date, startTime, insertAtMatchNumber } = newMatchInput;

  if (!teamA || !teamB) {
    return { success: false, error: 'Please select both Team A and Team B.', matches };
  }
  if (teamA === teamB) {
    return {
      success: false,
      error: 'A team cannot play against itself. Please select two distinct teams.',
      matches,
    };
  }

  const validCourt = Math.max(1, Number(court) || 1);
  const validRound = Math.max(1, Number(round) || 1);
  const courtName = resolveCourtDisplayName(validCourt, courtNames);

  const created: Match = {
    id: crypto.randomUUID(),
    round: validRound,
    court: validCourt,
    courtName,
    teamA,
    teamB,
    status: 'upcoming',
    date: date?.trim() || undefined,
    startTime: startTime?.trim() || undefined,
    version: 1,
  };

  const next = [...matches];
  if (
    insertAtMatchNumber !== undefined &&
    Number.isFinite(insertAtMatchNumber) &&
    insertAtMatchNumber >= 1 &&
    insertAtMatchNumber <= next.length + 1
  ) {
    next.splice(Math.round(insertAtMatchNumber) - 1, 0, created);
  } else {
    next.push(created);
  }

  return {
    success: true,
    matches: normalizeScheduleSequence(next, courtNames),
  };
}

/**
 * Removes an individual upcoming match from the draft schedule while strictly protecting live & completed matches.
 */
export function removeMatchFromDraft(
  matches: Match[],
  matchId: string,
  courtNames?: string[]
): UpdateDraftMatchResult {
  const target = matches.find((m) => m.id === matchId);
  if (!target) {
    return { success: false, error: 'Match not found in schedule.', matches };
  }

  if (target.status === 'completed') {
    return {
      success: false,
      error: 'Completed matches cannot be removed in Schedule Editing Mode to preserve match history and standings.',
      matches,
    };
  }

  if (target.status === 'live' || target.status === 'paused') {
    return {
      success: false,
      error: 'Live or paused matches cannot be removed while in progress.',
      matches,
    };
  }

  const next = matches.filter((m) => m.id !== matchId);
  return {
    success: true,
    matches: normalizeScheduleSequence(next, courtNames),
  };
}

export interface ScheduleValidationIssue {
  code:
    | 'SELF_PLAY'
    | 'INVALID_TEAM'
    | 'DUPLICATE_MATCH_ID'
    | 'INVALID_COURT'
    | 'INVALID_ROUND'
    | 'PROTECTED_MATCH_MODIFIED'
    | 'COURT_TIME_CONFLICT'
    | 'TEAM_SIMULTANEOUS_CONFLICT'
    | 'KNOCKOUT_DEPENDENCY_WARNING'
    | 'DUPLICATE_PAIRING_ADVISORY';
  matchId?: string;
  matchNumber?: number;
  message: string;
}

export interface ScheduleValidationReport {
  valid: boolean;
  errors: ScheduleValidationIssue[];
  warnings: ScheduleValidationIssue[];
  hasChanges: boolean;
  changedMatchIds: string[];
  addedMatchIds: string[];
  removedMatchIds: string[];
}

/**
 * Validates the entire draft schedule against tournament integrity rules, court/time overlaps,
 * team simultaneous match conflicts, and protected live/completed match history.
 */
export function validateScheduleDraft(params: {
  draftMatches: Match[];
  baselineMatches: Match[];
  teams: Team[];
  courtsCount: number;
  knockoutMatches?: KnockoutMatch[];
}): ScheduleValidationReport {
  const { draftMatches, baselineMatches, teams, courtsCount, knockoutMatches = [] } = params;
  const errors: ScheduleValidationIssue[] = [];
  const warnings: ScheduleValidationIssue[] = [];

  const validTeamsMap = new Map<string, Team>();
  for (const t of teams || []) {
    if (t && t.id) validTeamsMap.set(t.id, t);
  }

  const maxAllowedCourt = Math.max(16, courtsCount || 1);
  const seenIds = new Set<string>();

  // Track simultaneous slot keys: (date + startTime) -> court & team usage
  const courtTimeMap = new Map<string, { matchId: string; matchNumber: number; court: number }>();
  const teamTimeMap = new Map<
    string,
    { matchId: string; matchNumber: number; teamId: string; court: number }
  >();

  const pairingCountMap = new Map<string, number[]>();

  draftMatches.forEach((m, idx) => {
    const matchNum = idx + 1;

    // 1. Unique Match ID check
    if (!m.id || seenIds.has(m.id)) {
      errors.push({
        code: 'DUPLICATE_MATCH_ID',
        matchId: m.id,
        matchNumber: matchNum,
        message: `Match #${matchNum} has a duplicate or missing match identifier.`,
      });
    } else {
      seenIds.add(m.id);
    }

    // 2. Valid participating teams check
    if (!m.teamA || !validTeamsMap.has(m.teamA)) {
      errors.push({
        code: 'INVALID_TEAM',
        matchId: m.id,
        matchNumber: matchNum,
        message: `Match #${matchNum} has an invalid or deleted Team A selection.`,
      });
    }
    if (!m.teamB || !validTeamsMap.has(m.teamB)) {
      errors.push({
        code: 'INVALID_TEAM',
        matchId: m.id,
        matchNumber: matchNum,
        message: `Match #${matchNum} has an invalid or deleted Team B selection.`,
      });
    }

    // 3. Prevent a team from playing against itself
    if (m.teamA && m.teamB && m.teamA === m.teamB) {
      const tName = validTeamsMap.get(m.teamA)?.name || m.teamA;
      errors.push({
        code: 'SELF_PLAY',
        matchId: m.id,
        matchNumber: matchNum,
        message: `Match #${matchNum}: ${tName} cannot play against itself.`,
      });
    }

    // 4. Court & Round range validation
    if (!Number.isFinite(m.court) || m.court < 1 || m.court > maxAllowedCourt) {
      errors.push({
        code: 'INVALID_COURT',
        matchId: m.id,
        matchNumber: matchNum,
        message: `Match #${matchNum} is assigned to an invalid court (${m.court}).`,
      });
    }
    if (!Number.isFinite(m.round) || m.round < 1) {
      errors.push({
        code: 'INVALID_ROUND',
        matchId: m.id,
        matchNumber: matchNum,
        message: `Match #${matchNum} has an invalid round number (${m.round}).`,
      });
    }

    // 5. Check overlapping scheduled start times on the same court or simultaneous matches for the same team
    const parsed = parseMatchScheduleTime(m.time);
    const effDate = (m.date || parsed.date || 'default-date').trim();
    const effStart = (m.startTime || parsed.startTime || '').trim().toLowerCase();

    if (effStart && m.status !== 'completed') {
      const courtSlotKey = `${effDate}|${effStart}|court:${m.court}`;
      const existingOnCourt = courtTimeMap.get(courtSlotKey);
      if (existingOnCourt && existingOnCourt.matchId !== m.id) {
        errors.push({
          code: 'COURT_TIME_CONFLICT',
          matchId: m.id,
          matchNumber: matchNum,
          message: `Court ${m.court} conflict: Match #${existingOnCourt.matchNumber} and Match #${matchNum} are both scheduled at ${m.startTime || parsed.startTime}${m.date ? ` on ${m.date}` : ''}.`,
        });
      } else {
        courtTimeMap.set(courtSlotKey, { matchId: m.id, matchNumber: matchNum, court: m.court });
      }

      for (const tid of [m.teamA, m.teamB]) {
        if (!tid) continue;
        const teamSlotKey = `${effDate}|${effStart}|team:${tid}`;
        const existingForTeam = teamTimeMap.get(teamSlotKey);
        if (existingForTeam && existingForTeam.matchId !== m.id) {
          const tName = validTeamsMap.get(tid)?.name || tid;
          errors.push({
            code: 'TEAM_SIMULTANEOUS_CONFLICT',
            matchId: m.id,
            matchNumber: matchNum,
            message: `Simultaneous match conflict: ${tName} is scheduled in both Match #${existingForTeam.matchNumber} (Court ${existingForTeam.court}) and Match #${matchNum} (Court ${m.court}) at ${m.startTime || parsed.startTime}.`,
          });
        } else {
          teamTimeMap.set(teamSlotKey, {
            matchId: m.id,
            matchNumber: matchNum,
            teamId: tid,
            court: m.court,
          });
        }
      }
    }

    // Track duplicate head-to-head pairings as an informational warning
    if (m.teamA && m.teamB && m.teamA !== m.teamB) {
      const pairKey = [m.teamA, m.teamB].sort().join('::');
      const list = pairingCountMap.get(pairKey) || [];
      list.push(matchNum);
      pairingCountMap.set(pairKey, list);
    }
  });

  // 6. Verify that all baseline completed & live matches are preserved with intact scores/teams
  const draftById = new Map<string, Match>(draftMatches.map((m) => [m.id, m]));
  for (const base of baselineMatches) {
    if (base.status === 'completed' || base.status === 'live' || base.status === 'paused') {
      const inDraft = draftById.get(base.id);
      if (!inDraft) {
        errors.push({
          code: 'PROTECTED_MATCH_MODIFIED',
          matchId: base.id,
          message: `Protected ${base.status} match (${validTeamsMap.get(base.teamA)?.name || 'Team A'} vs ${validTeamsMap.get(base.teamB)?.name || 'Team B'}) cannot be deleted in Schedule Editing Mode.`,
        });
      } else {
        if (inDraft.teamA !== base.teamA || inDraft.teamB !== base.teamB) {
          errors.push({
            code: 'PROTECTED_MATCH_MODIFIED',
            matchId: base.id,
            message: `Cannot replace teams on ${base.status} match (${validTeamsMap.get(base.teamA)?.name || 'Team A'} vs ${validTeamsMap.get(base.teamB)?.name || 'Team B'}).`,
          });
        }
        if (
          base.status === 'completed' &&
          (inDraft.scoreA !== base.scoreA ||
            inDraft.scoreB !== base.scoreB ||
            inDraft.winner !== base.winner)
        ) {
          errors.push({
            code: 'PROTECTED_MATCH_MODIFIED',
            matchId: base.id,
            message: `Completed match scores and winner for ${validTeamsMap.get(base.teamA)?.name || 'Team A'} vs ${validTeamsMap.get(base.teamB)?.name || 'Team B'} must remain unchanged.`,
          });
        }
      }
    }
  }

  // Advisory warnings for repeated pairings or active knockout bracket
  for (const [pairKey, matchNums] of pairingCountMap.entries()) {
    if (matchNums.length > 1) {
      const [idA, idB] = pairKey.split('::');
      const nameA = validTeamsMap.get(idA)?.name || idA;
      const nameB = validTeamsMap.get(idB)?.name || idB;
      warnings.push({
        code: 'DUPLICATE_PAIRING_ADVISORY',
        message: `${nameA} vs ${nameB} appears ${matchNums.length} times in the schedule (Matches ${matchNums.map((n) => `#${n}`).join(', ')}).`,
      });
    }
  }

  const baselineById = new Map<string, Match>(baselineMatches.map((m) => [m.id, m]));
  const addedMatchIds = draftMatches
    .filter((m) => !baselineById.has(m.id))
    .map((m) => m.id);
  const removedMatchIds = baselineMatches
    .filter((m) => !draftById.has(m.id))
    .map((m) => m.id);

  const changedMatchIds: string[] = [];
  draftMatches.forEach((m, idx) => {
    const base = baselineById.get(m.id);
    const baseIdx = baselineMatches.findIndex((b) => b.id === m.id);
    if (!base) {
      changedMatchIds.push(m.id);
      return;
    }
    if (
      baseIdx !== idx ||
      base.teamA !== m.teamA ||
      base.teamB !== m.teamB ||
      base.court !== m.court ||
      base.round !== m.round ||
      base.status !== m.status ||
      (base.time || '') !== (m.time || '')
    ) {
      changedMatchIds.push(m.id);
    }
  });

  const hasChanges =
    addedMatchIds.length > 0 || removedMatchIds.length > 0 || changedMatchIds.length > 0;

  if (
    hasChanges &&
    knockoutMatches.some((k) => k.status === 'live' || k.status === 'completed')
  ) {
    warnings.push({
      code: 'KNOCKOUT_DEPENDENCY_WARNING',
      message:
        'Knockout Stage matches are already underway. Modifying league fixtures will not overwrite completed knockout bracket progressions.',
    });
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    hasChanges,
    changedMatchIds,
    addedMatchIds,
    removedMatchIds,
  };
}
