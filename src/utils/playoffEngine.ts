import {
  KnockoutData,
  KnockoutMatch,
  Match,
  Player,
  PlayoffAuditEntry,
  PlayoffConflictWarning,
  PlayoffFormat,
  PlayoffQualifiedSeed,
  PlayoffRoundType,
  PlayoffSettings,
  PlayoffTiebreakerCriterion,
  Team,
} from '../types/tournament';

export const DEFAULT_TIEBREAKER_ORDER: PlayoffTiebreakerCriterion[] = [
  'points',
  'win_diff',
  'set_diff',
  'point_diff',
  'head_to_head',
  'admin_override',
];

export const DEFAULT_PLAYOFF_SETTINGS: PlayoffSettings = {
  enabled: true,
  format: 'ipl_top4',
  qualifyingTeamsCount: 4,
  autoQualifyFromStandings: true,
  allowManualOverride: true,
  requireLeagueCompletion: false,
  requireAdminConfirmation: true,
  showOnPublicHomepage: true,
  allowMatchScheduleEditing: true,
  courtAssignmentMode: 'auto',
  tieBreakerOrder: [...DEFAULT_TIEBREAKER_ORDER],
  includeKnockoutInStandings: true,
};

export function normalizePlayoffSettings(raw?: Partial<PlayoffSettings> | null): PlayoffSettings {
  const validCriteria = new Set<PlayoffTiebreakerCriterion>(DEFAULT_TIEBREAKER_ORDER);
  const incomingOrder = Array.isArray(raw?.tieBreakerOrder)
    ? raw!.tieBreakerOrder.filter((c): c is PlayoffTiebreakerCriterion => validCriteria.has(c))
    : [];
  const mergedOrder: PlayoffTiebreakerCriterion[] = [
    ...incomingOrder,
    ...DEFAULT_TIEBREAKER_ORDER.filter((c) => !incomingOrder.includes(c)),
  ];

  const rawFormat = raw?.format;
  const format: PlayoffFormat =
    rawFormat === 'ipl_top4' || rawFormat === 'top2' || rawFormat === 'top4' || rawFormat === 'top8'
      ? rawFormat
      : DEFAULT_PLAYOFF_SETTINGS.format;

  return {
    enabled: raw?.enabled !== undefined ? Boolean(raw.enabled) : DEFAULT_PLAYOFF_SETTINGS.enabled,
    format,
    qualifyingTeamsCount: format === 'ipl_top4' ? 4 : Math.max(2, Number(raw?.qualifyingTeamsCount) || 4),
    autoQualifyFromStandings:
      raw?.autoQualifyFromStandings !== undefined
        ? Boolean(raw.autoQualifyFromStandings)
        : DEFAULT_PLAYOFF_SETTINGS.autoQualifyFromStandings,
    allowManualOverride:
      raw?.allowManualOverride !== undefined
        ? Boolean(raw.allowManualOverride)
        : DEFAULT_PLAYOFF_SETTINGS.allowManualOverride,
    requireLeagueCompletion:
      raw?.requireLeagueCompletion !== undefined
        ? Boolean(raw.requireLeagueCompletion)
        : DEFAULT_PLAYOFF_SETTINGS.requireLeagueCompletion,
    requireAdminConfirmation:
      raw?.requireAdminConfirmation !== undefined
        ? Boolean(raw.requireAdminConfirmation)
        : DEFAULT_PLAYOFF_SETTINGS.requireAdminConfirmation,
    showOnPublicHomepage:
      raw?.showOnPublicHomepage !== undefined
        ? Boolean(raw.showOnPublicHomepage)
        : DEFAULT_PLAYOFF_SETTINGS.showOnPublicHomepage,
    allowMatchScheduleEditing:
      raw?.allowMatchScheduleEditing !== undefined
        ? Boolean(raw.allowMatchScheduleEditing)
        : DEFAULT_PLAYOFF_SETTINGS.allowMatchScheduleEditing,
    courtAssignmentMode: raw?.courtAssignmentMode === 'manual' ? 'manual' : 'auto',
    tieBreakerOrder: mergedOrder,
    includeKnockoutInStandings:
      raw?.includeKnockoutInStandings !== undefined
        ? Boolean(raw.includeKnockoutInStandings)
        : DEFAULT_PLAYOFF_SETTINGS.includeKnockoutInStandings ?? true,
  };
}

export const TIEBREAKER_LABELS: Record<PlayoffTiebreakerCriterion, { label: string; description: string }> = {
  points: {
    label: 'Total League Points',
    description: '2 points per match win',
  },
  win_diff: {
    label: 'Match-Win Difference',
    description: 'Net wins minus losses across completed matches',
  },
  set_diff: {
    label: 'Game / Set Difference',
    description: 'Sets won minus sets lost across multi-set matches',
  },
  point_diff: {
    label: 'Point Difference',
    description: 'Total rally points scored minus conceded',
  },
  head_to_head: {
    label: 'Head-to-Head Result',
    description: 'Direct fixture winner between tied teams',
  },
  admin_override: {
    label: 'Admin Tie Resolution',
    description: 'Manual seed order set by tournament committee',
  },
};

export interface CompletedMatchStats {
  id: string;
  teamA: string;
  teamB: string;
  winnerId: string;
  loserId: string;
  pointsA: number;
  pointsB: number;
  setsA: number;
  setsB: number;
  isKnockout: boolean;
}

export function isKnockoutOrPlayoffMatch(m?: Partial<Match & KnockoutMatch> | null): boolean {
  if (!m) return false;
  return Boolean(
    m.matchType === 'knockout' ||
      m.stage ||
      m.playoffRound ||
      m.isPlayoff ||
      m.participantASource ||
      m.participantBSource
  );
}

/**
 * Extracts validated, deterministic statistics from a completed league or knockout match.
 * Returns null if the match is not completed, lacks valid distinct teams, or has no valid result.
 */
export function extractCompletedMatchStats(
  m?: Partial<Match & KnockoutMatch> | null
): CompletedMatchStats | null {
  if (!m || m.status !== 'completed') return null;
  if (!m.teamA || !m.teamB || m.teamA === m.teamB) return null;
  if (m.teamA === 'TBD' || m.teamB === 'TBD' || m.teamA === '__BYE__' || m.teamB === '__BYE__') {
    return null;
  }

  const isKnockout = isKnockoutOrPlayoffMatch(m);
  let setsA = 0;
  let setsB = 0;
  let totalPtsA = 0;
  let totalPtsB = 0;

  if (Array.isArray(m.sets) && m.sets.length > 1) {
    for (const s of m.sets) {
      const sa = Number(s?.scoreA ?? 0);
      const sb = Number(s?.scoreB ?? 0);
      if (sa === 0 && sb === 0 && !s?.winner) continue;
      totalPtsA += sa;
      totalPtsB += sb;
      if (s?.winner === 'A' || sa > sb) setsA += 1;
      else if (s?.winner === 'B' || sb > sa) setsB += 1;
    }
    if (totalPtsA === 0 && totalPtsB === 0 && (m.scoreA != null || m.scoreB != null)) {
      totalPtsA = Number(m.scoreA ?? 0);
      totalPtsB = Number(m.scoreB ?? 0);
      if (totalPtsA > totalPtsB) setsA = 1;
      else if (totalPtsB > totalPtsA) setsB = 1;
    }
  } else {
    const hasTopLevelScore =
      m.scoreA != null && m.scoreB != null && (Number(m.scoreA) > 0 || Number(m.scoreB) > 0);
    const sa = hasTopLevelScore
      ? Number(m.scoreA ?? 0)
      : m.sets?.[0]?.scoreA != null
      ? Number(m.sets[0].scoreA)
      : Number(m.scoreA ?? 0);
    const sb = hasTopLevelScore
      ? Number(m.scoreB ?? 0)
      : m.sets?.[0]?.scoreB != null
      ? Number(m.sets[0].scoreB)
      : Number(m.scoreB ?? 0);
    totalPtsA = Number.isFinite(sa) ? sa : 0;
    totalPtsB = Number.isFinite(sb) ? sb : 0;
    if (totalPtsA > totalPtsB) setsA = 1;
    else if (totalPtsB > totalPtsA) setsB = 1;
  }

  const explicitWinner =
    m.winner === m.teamA || m.winner === m.teamB ? m.winner : undefined;
  const scoreWinner =
    setsA > setsB
      ? m.teamA
      : setsB > setsA
      ? m.teamB
      : totalPtsA > totalPtsB
      ? m.teamA
      : totalPtsB > totalPtsA
      ? m.teamB
      : undefined;

  const winnerId = explicitWinner ?? scoreWinner;
  if (!winnerId) return null;

  // Ensure sets reflect at least 1 set won for the declared winner if tied on sets (e.g. walkover)
  if (setsA === 0 && setsB === 0) {
    if (winnerId === m.teamA) setsA = 1;
    else setsB = 1;
  }

  const loserId = winnerId === m.teamA ? m.teamB : m.teamA;
  const matchId =
    m.id ||
    `${isKnockout ? 'ko' : 'lg'}:${m.stage || ''}:${m.playoffRound || ''}:${m.round ?? 0}:${m.slot ?? 0}:${m.teamA}:${m.teamB}`;

  return {
    id: matchId,
    teamA: m.teamA,
    teamB: m.teamB,
    winnerId,
    loserId,
    pointsA: totalPtsA,
    pointsB: totalPtsB,
    setsA,
    setsB,
    isKnockout,
  };
}

export function buildDeduplicatedMatchesForStandings(
  matches: Match[] = [],
  knockoutMatches: KnockoutMatch[] = [],
  includeKnockoutInStandings = true
): CompletedMatchStats[] {
  const rawById = new Map<string, Partial<Match & KnockoutMatch>>();

  for (let i = 0; i < matches.length; i++) {
    const m = matches[i];
    if (!m) continue;
    const key = m.id || `match-idx-${i}-${m.teamA}-${m.teamB}`;
    rawById.set(key, m);
  }

  // Always overlay knockoutMatches by ID so that updated/reset knockout matches supersede any copy in matches
  for (let i = 0; i < knockoutMatches.length; i++) {
    const km = knockoutMatches[i];
    if (!km) continue;
    const key = km.id || `ko-idx-${i}-${km.stage}-${km.slot}`;
    rawById.set(key, {
      ...rawById.get(key),
      ...km,
      matchType: 'knockout',
    });
  }

  const results: CompletedMatchStats[] = [];
  for (const raw of rawById.values()) {
    if (!includeKnockoutInStandings && isKnockoutOrPlayoffMatch(raw)) {
      continue;
    }
    const stats = extractCompletedMatchStats(raw);
    if (stats) {
      results.push(stats);
    }
  }

  return results;
}

export function inferPlayoffRound(
  match?: Partial<KnockoutMatch | Match> | null,
  format?: PlayoffFormat
): PlayoffRoundType | undefined {
  if (!match) return undefined;
  const explicit = (match as any).playoffRound as PlayoffRoundType | undefined;
  if (explicit === 'Q1' || explicit === 'ELIM' || explicit === 'Q2' || explicit === 'F') {
    return explicit;
  }

  const label = String((match as any).matchLabel || (match as any).stageLabel || (match as any).time || '').toLowerCase();
  if (label.includes('qualifier 1') || label.startsWith('q1 ')) return 'Q1';
  if (label.includes('qualifier 2') || label.startsWith('q2 ')) return 'Q2';
  if (label.includes('eliminator')) return 'ELIM';

  const isIplContext = format === 'ipl_top4' || Boolean((match as any).isPlayoff) || Boolean((match as any).participantASource);
  if (!isIplContext) return undefined;

  if (match.stage === 'F') return 'F';
  if (match.stage === 'ELIM' || match.stage === 'QF') return 'ELIM';
  if (match.stage === 'SF') {
    return (match.slot || 1) >= 3 ? 'Q2' : 'Q1';
  }
  return undefined;
}

export function getPlayoffMatchDisplayLabel(
  match?: Partial<KnockoutMatch | Match> | null,
  format?: PlayoffFormat
): {
  shortCode: string;
  title: string;
  subtitle: string;
  playoffRound?: PlayoffRoundType;
} {
  const pr = inferPlayoffRound(match, format);
  if (pr === 'Q1') {
    return {
      playoffRound: 'Q1',
      shortCode: 'Q1',
      title: 'Qualifier 1',
      subtitle: 'Rank #1 vs Rank #2 · Winner → Final, Loser → Q2',
    };
  }
  if (pr === 'ELIM') {
    return {
      playoffRound: 'ELIM',
      shortCode: 'ELIM',
      title: 'Eliminator',
      subtitle: 'Rank #3 vs Rank #4 · Winner → Q2, Loser Eliminated',
    };
  }
  if (pr === 'Q2') {
    return {
      playoffRound: 'Q2',
      shortCode: 'Q2',
      title: 'Qualifier 2',
      subtitle: 'Q1 Loser vs Eliminator Winner · Winner → Grand Final',
    };
  }
  if (pr === 'F') {
    return {
      playoffRound: 'F',
      shortCode: 'FINAL',
      title: 'Grand Final',
      subtitle: 'Q1 Winner vs Q2 Winner · Championship Title',
    };
  }

  if (match?.stage === 'F') {
    return {
      shortCode: 'FINAL',
      title: 'Grand Final',
      subtitle: 'Championship Match',
    };
  }
  if (match?.stage === 'SF') {
    return {
      shortCode: `SF${match.slot || 1}`,
      title: `Semi-Final ${match.slot || 1}`,
      subtitle: 'Knockout Semi-Final',
    };
  }
  if (match?.stage === 'ELIM' || match?.stage === 'QF') {
    return {
      shortCode: `QF${match.slot || 1}`,
      title: `Quarter-Final ${match.slot || 1}`,
      subtitle: 'Knockout Quarter-Final',
    };
  }
  return {
    shortCode: 'KO',
    title: (match as any)?.matchLabel || (match as any)?.stageLabel || 'Playoff Match',
    subtitle: 'Knockout Stage',
  };
}

export interface PlayoffStandingRow {
  team: Team;
  rank: number;
  played: number;
  won: number;
  lost: number;
  matchWinDiff: number;
  setsWon: number;
  setsLost: number;
  setDiff: number;
  pointsFor: number;
  pointsAgainst: number;
  pointDiff: number;
  points: number;
  form: ('W' | 'L')[];
  isDisqualified: boolean;
  playerNames: string[];
  headToHead: Record<string, { won: number; lost: number; netPoints: number }>;
}

export interface StandingsTieGroup {
  tiedTeamIds: string[];
  tiedTeamNames: string[];
  rankStart: number;
  rankEnd: number;
  affectsTop4Cutoff: boolean;
  reason: string;
}

export function calculatePlayoffLeagueStandings(params: {
  teams: Team[];
  players: Player[];
  matches: Match[];
  knockoutMatches?: KnockoutMatch[];
  includeKnockoutInStandings?: boolean;
  tieBreakerOrder?: PlayoffTiebreakerCriterion[];
  disqualifiedTeamIds?: string[];
  manualTieBreakOrder?: string[];
}): {
  rankedActive: PlayoffStandingRow[];
  disqualified: PlayoffStandingRow[];
  allRows: PlayoffStandingRow[];
  unresolvedTies: StandingsTieGroup[];
} {
  const {
    teams,
    players,
    matches,
    knockoutMatches = [],
    includeKnockoutInStandings = false,
    tieBreakerOrder = DEFAULT_TIEBREAKER_ORDER,
    disqualifiedTeamIds = [],
    manualTieBreakOrder = [],
  } = params;

  const disqualifiedSet = new Set(disqualifiedTeamIds);
  const manualRankMap = new Map<string, number>();
  manualTieBreakOrder.forEach((tid, idx) => manualRankMap.set(tid, idx));

  const playerMap = new Map<string, string>();
  for (const p of players) {
    if (p?.id) playerMap.set(p.id, p.name);
  }

  const rowMap = new Map<string, PlayoffStandingRow>();
  for (const team of teams) {
    if (!team?.id) continue;
    const playerNames = (team.players || [])
      .map((pid) => playerMap.get(pid))
      .filter((n): n is string => Boolean(n));

    rowMap.set(team.id, {
      team,
      rank: 0,
      played: 0,
      won: 0,
      lost: 0,
      matchWinDiff: 0,
      setsWon: 0,
      setsLost: 0,
      setDiff: 0,
      pointsFor: 0,
      pointsAgainst: 0,
      pointDiff: 0,
      points: 0,
      form: [],
      isDisqualified: disqualifiedSet.has(team.id),
      playerNames,
      headToHead: {},
    });
  }

  const completedMatches = buildDeduplicatedMatchesForStandings(
    matches,
    knockoutMatches,
    includeKnockoutInStandings
  );

  for (const m of completedMatches) {
    const rowA = rowMap.get(m.teamA);
    const rowB = rowMap.get(m.teamB);
    if (!rowA || !rowB) continue;

    const totalPtsA = m.pointsA;
    const totalPtsB = m.pointsB;
    const setsA = m.setsA;
    const setsB = m.setsB;
    const aWon = m.winnerId === m.teamA;

    rowA.played += 1;
    rowB.played += 1;
    rowA.pointsFor += totalPtsA;
    rowA.pointsAgainst += totalPtsB;
    rowB.pointsFor += totalPtsB;
    rowB.pointsAgainst += totalPtsA;

    rowA.setsWon += setsA;
    rowA.setsLost += setsB;
    rowB.setsWon += setsB;
    rowB.setsLost += setsA;

    if (aWon) {
      rowA.won += 1;
      rowA.points += 2;
      rowB.lost += 1;
      rowA.form.push('W');
      rowB.form.push('L');
    } else {
      rowB.won += 1;
      rowB.points += 2;
      rowA.lost += 1;
      rowB.form.push('W');
      rowA.form.push('L');
    }

    if (!rowA.headToHead[m.teamB]) rowA.headToHead[m.teamB] = { won: 0, lost: 0, netPoints: 0 };
    if (!rowB.headToHead[m.teamA]) rowB.headToHead[m.teamA] = { won: 0, lost: 0, netPoints: 0 };
    rowA.headToHead[m.teamB].won += aWon ? 1 : 0;
    rowA.headToHead[m.teamB].lost += aWon ? 0 : 1;
    rowA.headToHead[m.teamB].netPoints += totalPtsA - totalPtsB;
    rowB.headToHead[m.teamA].won += aWon ? 0 : 1;
    rowB.headToHead[m.teamA].lost += aWon ? 1 : 0;
    rowB.headToHead[m.teamA].netPoints += totalPtsB - totalPtsA;
  }

  for (const row of rowMap.values()) {
    row.matchWinDiff = row.won - row.lost;
    row.setDiff = row.setsWon - row.setsLost;
    row.pointDiff = row.pointsFor - row.pointsAgainst;
  }

  const compareRows = (a: PlayoffStandingRow, b: PlayoffStandingRow, includeManualOverride = true): number => {
    for (const criterion of tieBreakerOrder) {
      if (criterion === 'points') {
        if (b.points !== a.points) return b.points - a.points;
      } else if (criterion === 'win_diff') {
        if (b.matchWinDiff !== a.matchWinDiff) return b.matchWinDiff - a.matchWinDiff;
        if (b.won !== a.won) return b.won - a.won;
      } else if (criterion === 'set_diff') {
        if (b.setDiff !== a.setDiff) return b.setDiff - a.setDiff;
      } else if (criterion === 'point_diff') {
        if (b.pointDiff !== a.pointDiff) return b.pointDiff - a.pointDiff;
        if (b.pointsFor !== a.pointsFor) return b.pointsFor - a.pointsFor;
      } else if (criterion === 'head_to_head') {
        const h2hA = a.headToHead[b.team.id];
        if (h2hA) {
          const diffWins = h2hA.won - h2hA.lost;
          if (diffWins !== 0) return -diffWins; // positive won => A comes first
          if (h2hA.netPoints !== 0) return -h2hA.netPoints;
        }
      } else if (criterion === 'admin_override' && includeManualOverride) {
        const idxA = manualRankMap.get(a.team.id);
        const idxB = manualRankMap.get(b.team.id);
        if (idxA !== undefined && idxB !== undefined && idxA !== idxB) {
          return idxA - idxB;
        }
        if (idxA !== undefined && idxB === undefined) return -1;
        if (idxB !== undefined && idxA === undefined) return 1;
      }
    }
    return a.team.name.localeCompare(b.team.name);
  };

  const activeRows = Array.from(rowMap.values()).filter((r) => !r.isDisqualified);
  const disqualifiedRows = Array.from(rowMap.values()).filter((r) => r.isDisqualified);

  activeRows.sort((a, b) => compareRows(a, b, true));
  activeRows.forEach((row, idx) => {
    row.rank = idx + 1;
  });

  disqualifiedRows.sort((a, b) => a.team.name.localeCompare(b.team.name));
  disqualifiedRows.forEach((row) => {
    row.rank = 0;
  });

  // Detect statistical ties (before admin_override & alphabetical fallback) that still exist when stats+H2H match
  const unresolvedTies: StandingsTieGroup[] = [];
  if (activeRows.length >= 2) {
    let i = 0;
    while (i < activeRows.length) {
      let j = i + 1;
      while (j < activeRows.length) {
        const cmpNoOverride = compareWithoutAdminOrName(activeRows[i], activeRows[j], tieBreakerOrder);
        if (cmpNoOverride !== 0) break;
        j++;
      }
      if (j - i > 1) {
        const group = activeRows.slice(i, j);
        const allHaveManualOrder = group.every((g) => manualRankMap.has(g.team.id));
        const rankStart = i + 1;
        const rankEnd = j;
        const affectsTop4Cutoff = rankStart <= 4 && rankEnd >= 4;
        const withinTop4 = rankStart <= 4;
        // Surface tie if unresolved by manual admin order AND (within Top 4 seeding OR spans Rank 4 cutoff)
        if (!allHaveManualOrder && (affectsTop4Cutoff || withinTop4)) {
          unresolvedTies.push({
            tiedTeamIds: group.map((g) => g.team.id),
            tiedTeamNames: group.map((g) => g.team.name),
            rankStart,
            rankEnd,
            affectsTop4Cutoff,
            reason: affectsTop4Cutoff
              ? `Teams tied across the Top 4 qualification cutoff (Ranks ${rankStart}–${rankEnd})`
              : `Teams tied on all league criteria & head-to-head (Ranks ${rankStart}–${rankEnd})`,
          });
        }
      }
      i = j;
    }
  }

  return {
    rankedActive: activeRows,
    disqualified: disqualifiedRows,
    allRows: [...activeRows, ...disqualifiedRows],
    unresolvedTies,
  };
}

function compareWithoutAdminOrName(
  a: PlayoffStandingRow,
  b: PlayoffStandingRow,
  tieBreakerOrder: PlayoffTiebreakerCriterion[]
): number {
  for (const criterion of tieBreakerOrder) {
    if (criterion === 'points') {
      if (b.points !== a.points) return b.points - a.points;
    } else if (criterion === 'win_diff') {
      if (b.matchWinDiff !== a.matchWinDiff) return b.matchWinDiff - a.matchWinDiff;
      if (b.won !== a.won) return b.won - a.won;
    } else if (criterion === 'set_diff') {
      if (b.setDiff !== a.setDiff) return b.setDiff - a.setDiff;
    } else if (criterion === 'point_diff') {
      if (b.pointDiff !== a.pointDiff) return b.pointDiff - a.pointDiff;
      if (b.pointsFor !== a.pointsFor) return b.pointsFor - a.pointsFor;
    } else if (criterion === 'head_to_head') {
      const h2hA = a.headToHead[b.team.id];
      if (h2hA) {
        const diffWins = h2hA.won - h2hA.lost;
        if (diffWins !== 0) return -diffWins;
        if (h2hA.netPoints !== 0) return -h2hA.netPoints;
      }
    }
  }
  return 0;
}

export interface PlayoffEligibilityResult {
  canGenerate: boolean;
  eligibleTeamsCount: number;
  leagueTotalMatches: number;
  leagueCompletedMatches: number;
  isLeagueComplete: boolean;
  hasExistingBracket: boolean;
  blockingReasons: string[];
  warnings: string[];
}

export function evaluatePlayoffGenerationEligibility(params: {
  rankedActiveCount: number;
  leagueMatches: Match[];
  knockout: KnockoutData;
  playoffSettings: PlayoffSettings;
  unresolvedTies?: StandingsTieGroup[];
}): PlayoffEligibilityResult {
  const {
    rankedActiveCount,
    leagueMatches,
    knockout,
    playoffSettings,
    unresolvedTies = [],
  } = params;

  const groupMatches = leagueMatches.filter((m) => m.matchType !== 'knockout' && !m.stage);
  const completedCount = groupMatches.filter((m) => m.status === 'completed').length;
  const isLeagueComplete = groupMatches.length > 0 && completedCount === groupMatches.length;

  const requiredTeams =
    playoffSettings.format === 'top2' ? 2 : playoffSettings.format === 'top8' ? 8 : 4;

  const blockingReasons: string[] = [];
  const warnings: string[] = [];

  if (!playoffSettings.enabled) {
    blockingReasons.push('Playoffs are currently disabled in Tournament Settings.');
  }

  if (rankedActiveCount < requiredTeams) {
    blockingReasons.push(
      `At least ${requiredTeams} active eligible teams are required to generate ${
        playoffSettings.format === 'ipl_top4' ? 'SPL Championship Top 4' : playoffSettings.format.toUpperCase()
      } playoffs (currently ${rankedActiveCount} eligible).`
    );
  }

  if (playoffSettings.requireLeagueCompletion && !isLeagueComplete) {
    blockingReasons.push(
      groupMatches.length === 0
        ? 'League fixtures have not been generated yet (Require League Completion is enabled).'
        : `All league matches must be completed before generating playoffs (${completedCount}/${groupMatches.length} completed).`
    );
  } else if (!isLeagueComplete && groupMatches.length > 0) {
    warnings.push(
      `${groupMatches.length - completedCount} league match(es) are still pending; current standings will be used if you generate now.`
    );
  }

  if (unresolvedTies.some((t) => t.affectsTop4Cutoff)) {
    warnings.push('One or more teams are tied at the Top 4 qualification cutoff. Review tie resolution before locking.');
  }

  const hasExistingBracket = (knockout?.matches?.length || 0) > 0;
  if (hasExistingBracket) {
    warnings.push('An active playoff bracket already exists. Regenerating will replace existing playoff fixtures.');
  }

  return {
    canGenerate: blockingReasons.length === 0,
    eligibleTeamsCount: rankedActiveCount,
    leagueTotalMatches: groupMatches.length,
    leagueCompletedMatches: completedCount,
    isLeagueComplete,
    hasExistingBracket,
    blockingReasons,
    warnings,
  };
}

export function generateIPLPlayoffBracket(params: {
  top4TeamIds: [string, string, string, string];
  courtsCount: number;
  courtNames?: string[];
  tournamentDate?: string;
  bracketId?: string;
  showOnPublicHomepage?: boolean;
}): KnockoutMatch[] {
  const {
    top4TeamIds,
    courtsCount,
    courtNames,
    tournamentDate,
    bracketId = crypto.randomUUID(),
  } = params;

  const uniqueTop4 = Array.from(new Set(top4TeamIds.filter(Boolean)));
  if (uniqueTop4.length !== 4) {
    throw new Error('Exactly 4 distinct qualified teams are required to generate SPL Championship Top 4 playoffs.');
  }

  const safeCourts = Math.max(1, Number(courtsCount) || 1);
  const getCourtName = (c: number) => courtNames?.[c - 1]?.trim() || `Court ${c}`;

  const q1Court = 1;
  const elimCourt = safeCourts >= 2 ? 2 : 1;
  const q2Court = 1;
  const finalCourt = 1;

  return [
    {
      id: crypto.randomUUID(),
      bracketId,
      isPlayoff: true,
      stage: 'SF',
      playoffRound: 'Q1',
      matchLabel: 'Qualifier 1',
      slot: 1,
      court: q1Court,
      courtName: getCourtName(q1Court),
      scheduledDate: tournamentDate || undefined,
      time: `Qualifier 1 · ${getCourtName(q1Court)}`,
      participantASource: 'RANK_1',
      participantBSource: 'RANK_2',
      teamA: top4TeamIds[0],
      teamB: top4TeamIds[1],
      status: 'upcoming',
      version: 1,
    },
    {
      id: crypto.randomUUID(),
      bracketId,
      isPlayoff: true,
      stage: 'ELIM',
      playoffRound: 'ELIM',
      matchLabel: 'Eliminator',
      slot: 2,
      court: elimCourt,
      courtName: getCourtName(elimCourt),
      scheduledDate: tournamentDate || undefined,
      time: `Eliminator · ${getCourtName(elimCourt)}`,
      participantASource: 'RANK_3',
      participantBSource: 'RANK_4',
      teamA: top4TeamIds[2],
      teamB: top4TeamIds[3],
      status: 'upcoming',
      version: 1,
    },
    {
      id: crypto.randomUUID(),
      bracketId,
      isPlayoff: true,
      stage: 'SF',
      playoffRound: 'Q2',
      matchLabel: 'Qualifier 2',
      slot: 3,
      court: q2Court,
      courtName: getCourtName(q2Court),
      scheduledDate: tournamentDate || undefined,
      time: `Qualifier 2 · ${getCourtName(q2Court)}`,
      participantASource: 'Q1_LOSER',
      participantBSource: 'ELIM_WINNER',
      teamA: undefined,
      teamB: undefined,
      status: 'upcoming',
      version: 1,
    },
    {
      id: crypto.randomUUID(),
      bracketId,
      isPlayoff: true,
      stage: 'F',
      playoffRound: 'F',
      matchLabel: 'Grand Final',
      slot: 1,
      court: finalCourt,
      courtName: getCourtName(finalCourt),
      scheduledDate: tournamentDate || undefined,
      time: `Grand Final · ${getCourtName(finalCourt)}`,
      participantASource: 'Q1_WINNER',
      participantBSource: 'Q2_WINNER',
      teamA: undefined,
      teamB: undefined,
      status: 'upcoming',
      version: 1,
    },
  ];
}

export function canStartOrScorePlayoffMatch(
  match: KnockoutMatch,
  allKoMatches: KnockoutMatch[],
  format?: PlayoffFormat
): { allowed: boolean; reason?: string } {
  const round = inferPlayoffRound(match, format);

  if (!round) {
    if (!match.teamA || !match.teamB) {
      return { allowed: false, reason: 'Both teams must be determined before starting this knockout match.' };
    }
    if (match.teamA === match.teamB) {
      return { allowed: false, reason: 'A team cannot play against itself.' };
    }
    return { allowed: true };
  }

  const findRound = (r: PlayoffRoundType) =>
    allKoMatches.find((m) => inferPlayoffRound(m, format) === r);

  if (round === 'Q2') {
    const q1 = findRound('Q1');
    const elim = findRound('ELIM');
    if (!q1 || q1.status !== 'completed' || !q1.winner) {
      return {
        allowed: false,
        reason: 'Qualifier 2 cannot start until Qualifier 1 is completed and a loser is decided.',
      };
    }
    if (!elim || elim.status !== 'completed' || !elim.winner) {
      return {
        allowed: false,
        reason: 'Qualifier 2 cannot start until the Eliminator match is completed.',
      };
    }
  }

  if (round === 'F') {
    const q1 = findRound('Q1');
    const q2 = findRound('Q2');
    if (!q1 || q1.status !== 'completed' || !q1.winner) {
      return {
        allowed: false,
        reason: 'Grand Final cannot start until Qualifier 1 is completed.',
      };
    }
    if (!q2 || q2.status !== 'completed' || !q2.winner) {
      return {
        allowed: false,
        reason: 'Grand Final cannot start until Qualifier 2 is completed.',
      };
    }
  }

  if (!match.teamA || !match.teamB) {
    return {
      allowed: false,
      reason: 'Both teams must be assigned before starting or scoring this playoff match.',
    };
  }
  if (match.teamA === match.teamB) {
    return { allowed: false, reason: 'Invalid pairing: Team A and Team B cannot be the same team.' };
  }

  return { allowed: true };
}

export function progressIPLPlayoffs(matches: KnockoutMatch[]): {
  matches: KnockoutMatch[];
  championTeamId?: string;
  runnerUpTeamId?: string;
  isCompleted: boolean;
} {
  if (!matches || matches.length === 0) {
    return { matches: [], isCompleted: false };
  }

  const next = matches.map((m) => ({
    ...m,
    playoffRound: inferPlayoffRound(m, 'ipl_top4'),
    isPlayoff: true,
  }));

  const findByRound = (r: PlayoffRoundType) => next.find((m) => m.playoffRound === r);

  const q1 = findByRound('Q1');
  const elim = findByRound('ELIM');
  const q2 = findByRound('Q2');
  const finalMatch = findByRound('F');

  // Reconcile winner / loserId on each match strictly when status === 'completed'
  for (const m of next) {
    if (m.status === 'completed' && m.winner && (m.winner === m.teamA || m.winner === m.teamB)) {
      m.loserId = m.winner === m.teamA ? m.teamB : m.teamA;
      if (!m.completedAt) m.completedAt = Date.now();
    } else if (m.status !== 'completed') {
      m.loserId = undefined;
      m.completedAt = undefined;
      if (m.status === 'upcoming') {
        m.winner = undefined;
      }
    }
  }

  const q1Completed = q1 && q1.status === 'completed' && (q1.winner === q1.teamA || q1.winner === q1.teamB);
  const q1Winner = q1Completed ? q1!.winner : undefined;
  const q1Loser = q1Completed ? q1!.loserId : undefined;

  const elimCompleted =
    elim && elim.status === 'completed' && (elim.winner === elim.teamA || elim.winner === elim.teamB);
  const elimWinner = elimCompleted ? elim!.winner : undefined;

  // Helper to safely assign downstream participants and clear stale results if participants changed
  const applyDownstreamTeams = (
    target: KnockoutMatch | undefined,
    expectedA: string | undefined,
    expectedB: string | undefined
  ) => {
    if (!target || target.manual) return;
    const prevA = target.teamA;
    const prevB = target.teamB;
    const changed = prevA !== expectedA || prevB !== expectedB;
    target.teamA = expectedA;
    target.teamB = expectedB;

    if (changed) {
      // Only reset score/winner if the participants of the downstream match actually changed (e.g. result correction)
      const hadResultOrScores =
        target.status !== 'upcoming' ||
        target.winner !== undefined ||
        target.scoreA !== undefined ||
        target.scoreB !== undefined ||
        (target.sets && target.sets.length > 0);

      if (hadResultOrScores) {
        target.status = 'upcoming';
        target.winner = undefined;
        target.loserId = undefined;
        target.scoreA = undefined;
        target.scoreB = undefined;
        target.sets = undefined;
        target.completedAt = undefined;
      }
    }
  };

  // Q1 Loser vs ELIM Winner -> Qualifier 2
  applyDownstreamTeams(q2, q1Loser, elimWinner);

  const q2Completed = q2 && q2.status === 'completed' && (q2.winner === q2.teamA || q2.winner === q2.teamB);
  const q2Winner = q2Completed ? q2!.winner : undefined;

  // Q1 Winner vs Q2 Winner -> Grand Final
  applyDownstreamTeams(finalMatch, q1Winner, q2Winner);

  const finalCompleted =
    finalMatch &&
    finalMatch.status === 'completed' &&
    (finalMatch.winner === finalMatch.teamA || finalMatch.winner === finalMatch.teamB);

  const championTeamId = finalCompleted ? finalMatch!.winner : undefined;
  const runnerUpTeamId = finalCompleted
    ? finalMatch!.winner === finalMatch!.teamA
      ? finalMatch!.teamB
      : finalMatch!.teamA
    : undefined;

  // Sort consistently: Q1, ELIM, Q2, F
  const order: Record<PlayoffRoundType, number> = { Q1: 1, ELIM: 2, Q2: 3, F: 4 };
  next.sort((a, b) => (order[a.playoffRound || 'F'] || 9) - (order[b.playoffRound || 'F'] || 9));

  return {
    matches: next,
    championTeamId,
    runnerUpTeamId,
    isCompleted: Boolean(finalCompleted && championTeamId),
  };
}

export function validatePlayoffScheduleAndCourts(
  matches: KnockoutMatch[],
  courtNames?: string[]
): PlayoffConflictWarning[] {
  const warnings: PlayoffConflictWarning[] = [];
  const getCourtLabel = (courtNum: number, explicit?: string) =>
    explicit || courtNames?.[courtNum - 1]?.trim() || `Court ${courtNum}`;

  // 1. Court + Date + Time collision detection
  const slotGroups = new Map<string, KnockoutMatch[]>();
  for (const m of matches) {
    if (!m.scheduledTime || !m.scheduledTime.trim()) continue;
    const dateKey = (m.scheduledDate || 'default-date').trim();
    const timeKey = m.scheduledTime.trim();
    const courtNum = Number(m.court) || 1;
    const key = `${courtNum}::${dateKey}::${timeKey}`;
    const existing = slotGroups.get(key) || [];
    existing.push(m);
    slotGroups.set(key, existing);
  }

  for (const [, group] of slotGroups.entries()) {
    if (group.length > 1) {
      const courtLabel = getCourtLabel(Number(group[0].court) || 1, group[0].courtName);
      for (const m of group) {
        warnings.push({
          matchId: m.id,
          type: 'court_time_conflict',
          message: `Court conflict: ${getPlayoffMatchDisplayLabel(m, 'ipl_top4').title} shares ${courtLabel} at ${m.scheduledTime} with another playoff match.`,
        });
      }
    }
  }

  // 2. Prerequisite date/time ordering validation (Q2 after Q1 & ELIM; F after Q1, ELIM, Q2)
  const toTimestamp = (m?: KnockoutMatch): number | null => {
    if (!m?.scheduledTime) return null;
    const datePart = m.scheduledDate || '2026-01-01';
    const timePart = m.scheduledTime.trim();
    const parsed = Date.parse(`${datePart}T${timePart}`);
    return Number.isNaN(parsed) ? null : parsed;
  };

  const q1 = matches.find((m) => inferPlayoffRound(m, 'ipl_top4') === 'Q1');
  const elim = matches.find((m) => inferPlayoffRound(m, 'ipl_top4') === 'ELIM');
  const q2 = matches.find((m) => inferPlayoffRound(m, 'ipl_top4') === 'Q2');
  const fin = matches.find((m) => inferPlayoffRound(m, 'ipl_top4') === 'F');

  const q1Ts = toTimestamp(q1);
  const elimTs = toTimestamp(elim);
  const q2Ts = toTimestamp(q2);
  const finTs = toTimestamp(fin);

  if (q2 && q2Ts !== null) {
    if (q1Ts !== null && q2Ts <= q1Ts) {
      warnings.push({
        matchId: q2.id,
        type: 'dependency_schedule_conflict',
        message: 'Qualifier 2 must be scheduled after Qualifier 1 completes.',
      });
    }
    if (elimTs !== null && q2Ts <= elimTs) {
      warnings.push({
        matchId: q2.id,
        type: 'dependency_schedule_conflict',
        message: 'Qualifier 2 must be scheduled after the Eliminator completes.',
      });
    }
  }

  if (fin && finTs !== null) {
    if (q1Ts !== null && finTs <= q1Ts) {
      warnings.push({
        matchId: fin.id,
        type: 'dependency_schedule_conflict',
        message: 'Grand Final must be scheduled after Qualifier 1 completes.',
      });
    }
    if (q2Ts !== null && finTs <= q2Ts) {
      warnings.push({
        matchId: fin.id,
        type: 'dependency_schedule_conflict',
        message: 'Grand Final must be scheduled after Qualifier 2 completes.',
      });
    }
  }

  return warnings;
}

export function createPlayoffAuditEntry(
  action: PlayoffAuditEntry['action'],
  message: string,
  actor = 'Admin',
  matchId?: string,
  details?: Record<string, any>
): PlayoffAuditEntry {
  return {
    id: crypto.randomUUID(),
    action,
    message,
    actor,
    at: Date.now(),
    matchId,
    details,
  };
}
