import {
  CustomKnockoutMatchDraft,
  CustomKnockoutStageConfig,
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
  QualificationMode,
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

export const VALID_PLAYOFF_FORMATS: PlayoffFormat[] = [
  'ipl_top4',
  'top2',
  'top3',
  'top4',
  'top5',
  'top6',
  'top7',
  'top8',
  'custom',
];

export const DEFAULT_PLAYOFF_SETTINGS: PlayoffSettings = {
  enabled: true,
  format: 'top4',
  qualifyingTeamsCount: 4,
  qualificationMode: 'auto',
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

export function resolveFormatQualifyingCount(
  format?: PlayoffFormat | string | null,
  customCount?: number | null
): number {
  switch (format) {
    case 'top2':
      return 2;
    case 'top3':
      return 3;
    case 'top4':
    case 'ipl_top4':
      return 4;
    case 'top5':
      return 5;
    case 'top6':
      return 6;
    case 'top7':
      return 7;
    case 'top8':
      return 8;
    case 'custom': {
      const n = Number(customCount);
      return Number.isFinite(n) && n >= 2 ? Math.min(32, Math.floor(n)) : 4;
    }
    default: {
      const n = Number(customCount);
      return Number.isFinite(n) && n >= 2 ? Math.min(32, Math.floor(n)) : 4;
    }
  }
}

export function formatFromQualifyingCount(
  count: number,
  preferPageantTop4 = false
): PlayoffFormat {
  const n = Math.max(2, Math.floor(Number(count) || 4));
  if (n === 2) return 'top2';
  if (n === 3) return 'top3';
  if (n === 4) return preferPageantTop4 ? 'ipl_top4' : 'top4';
  if (n === 5) return 'top5';
  if (n === 6) return 'top6';
  if (n === 7) return 'top7';
  if (n === 8) return 'top8';
  return 'custom';
}

export function getFormatDisplayTitle(format?: PlayoffFormat, customCount?: number): string {
  const count = resolveFormatQualifyingCount(format, customCount);
  if (format === 'ipl_top4') return 'Top 4 · Qualifier & Eliminator Playoff';
  if (format === 'top2') return 'Top 2 · Direct Grand Final';
  if (format === 'top3') return 'Top 3 · 1 Eliminator + Grand Final';
  if (format === 'top4') return 'Top 4 · 2 Semi Finals + Grand Final';
  if (format === 'top5') return 'Top 5 · 1 Eliminator + 2 Semi Finals + Final';
  if (format === 'top6') return 'Top 6 · 2 Eliminators + 2 Semi Finals + Final';
  if (format === 'top7') return 'Top 7 · 3 Eliminators (#1 Bye) + 2 Semi Finals + Final';
  if (format === 'top8') return 'Top 8 · 4 Quarter Finals + 2 Semi Finals + Final';
  return `Top ${count} · Custom Single-Elimination Bracket`;
}

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
    rawFormat && VALID_PLAYOFF_FORMATS.includes(rawFormat)
      ? rawFormat
      : DEFAULT_PLAYOFF_SETTINGS.format;

  const qualifyingTeamsCount = resolveFormatQualifyingCount(format, raw?.qualifyingTeamsCount);
  const qualificationMode: QualificationMode =
    raw?.qualificationMode === 'manual'
      ? 'manual'
      : raw?.autoQualifyFromStandings === false
      ? 'manual'
      : 'auto';

  return {
    enabled: raw?.enabled !== undefined ? Boolean(raw.enabled) : DEFAULT_PLAYOFF_SETTINGS.enabled,
    format,
    qualifyingTeamsCount,
    qualificationMode,
    autoQualifyFromStandings:
      raw?.autoQualifyFromStandings !== undefined
        ? Boolean(raw.autoQualifyFromStandings)
        : qualificationMode === 'auto',
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
      m.participantBSource ||
      m.matchCode
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

export function normalizeMatchStatus(
  status?: string | null
): 'live' | 'paused' | 'completed' | 'upcoming' {
  const s = String(status || '').trim().toLowerCase();
  if (s === 'live') return 'live';
  if (s === 'paused' || s === 'postponed' || s === 'pause') return 'paused';
  if (s === 'completed' || s === 'complete' || s === 'finished') return 'completed';
  return 'upcoming';
}

export function getMatchStatusDisplayLabel(
  status?: string | null,
  options?: { uppercase?: boolean; upcomingLabel?: string }
): string {
  const normalized = normalizeMatchStatus(status);
  const upper = options?.uppercase !== false;
  if (normalized === 'live') return upper ? 'LIVE' : 'Live';
  if (normalized === 'paused') return upper ? 'PAUSE' : 'Pause';
  if (normalized === 'completed') return upper ? 'COMPLETED' : 'Completed';
  const fallback = options?.upcomingLabel || 'Scheduled';
  return upper ? fallback.toUpperCase() : fallback;
}

export function getKnockoutProgressionOrder(m?: Partial<Match & KnockoutMatch> | null): number {
  if (!m) return 99;
  if (typeof m.roundOrder === 'number' && m.roundOrder >= 1 && m.roundOrder <= 10) {
    return m.roundOrder;
  }
  const code = String(m.matchCode || '').toUpperCase();
  if (code.startsWith('P')) return 1;
  if (code === 'Q1') return 1;
  if (code.startsWith('E') || code.startsWith('QF')) return 2;
  if (code === 'Q2' || code.startsWith('SF')) return 3;
  if (code === 'FINAL' || code === 'F') return 4;

  const pr = inferPlayoffRound(m);
  if (pr === 'PRELIM') return 1;
  if (pr === 'Q1') return 1;
  if (pr === 'ELIM' || pr === 'QF') return 2;
  if (pr === 'Q2' || pr === 'SF') return 3;
  if (pr === 'F') return 4;

  if (m.stage === 'ELIM' || m.stage === 'QF') return 2;
  if (m.stage === 'SF') return 3;
  if (m.stage === 'F') return 4;
  return 5;
}

export function buildDeduplicatedMatchesForStandings(
  matches: Match[] = [],
  knockoutMatches: KnockoutMatch[] = [],
  includeKnockoutInStandings = true
): CompletedMatchStats[] {
  const rawById = new Map<string, { raw: Partial<Match & KnockoutMatch>; seq: number }>();
  let seqCounter = 0;

  for (let i = 0; i < matches.length; i++) {
    const m = matches[i];
    if (!m) continue;
    const key = m.id || `match-idx-${i}-${m.teamA}-${m.teamB}`;
    rawById.set(key, { raw: m, seq: seqCounter++ });
  }

  for (let i = 0; i < knockoutMatches.length; i++) {
    const km = knockoutMatches[i];
    if (!km) continue;
    const key = km.id || `ko-idx-${i}-${km.stage}-${km.slot}`;
    const existing = rawById.get(key);
    rawById.set(key, {
      raw: {
        ...(existing?.raw || {}),
        ...km,
        matchType: 'knockout',
      },
      seq: existing ? existing.seq : seqCounter++,
    });
  }

  const orderedEntries = Array.from(rawById.values()).sort((entryA, entryB) => {
    const a = entryA.raw;
    const b = entryB.raw;
    const aKo = isKnockoutOrPlayoffMatch(a);
    const bKo = isKnockoutOrPlayoffMatch(b);
    if (aKo !== bKo) return aKo ? 1 : -1;

    if (!aKo) {
      const roundA = Number(a.round ?? 1);
      const roundB = Number(b.round ?? 1);
      if (roundA !== roundB) return roundA - roundB;

      const slotA = Number(a.matchNumber ?? a.courtSlot ?? a.slot ?? 0);
      const slotB = Number(b.matchNumber ?? b.courtSlot ?? b.slot ?? 0);
      if (slotA !== slotB) return slotA - slotB;

      const courtA = Number(a.court ?? 1);
      const courtB = Number(b.court ?? 1);
      if (courtA !== courtB) return courtA - courtB;

      return entryA.seq - entryB.seq;
    }

    const stageA = getKnockoutProgressionOrder(a);
    const stageB = getKnockoutProgressionOrder(b);
    if (stageA !== stageB) return stageA - stageB;

    const koSlotA = Number(a.slot ?? 1);
    const koSlotB = Number(b.slot ?? 1);
    if (koSlotA !== koSlotB) return koSlotA - koSlotB;

    return entryA.seq - entryB.seq;
  });

  const results: CompletedMatchStats[] = [];
  for (const { raw } of orderedEntries) {
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
  if (
    explicit === 'PRELIM' ||
    explicit === 'Q1' ||
    explicit === 'ELIM' ||
    explicit === 'QF' ||
    explicit === 'Q2' ||
    explicit === 'SF' ||
    explicit === 'F'
  ) {
    return explicit;
  }

  const code = String((match as any).matchCode || '').toUpperCase();
  if (code.startsWith('P')) return 'PRELIM';
  if (code === 'Q1') return 'Q1';
  if (code === 'Q2') return 'Q2';
  if (code.startsWith('E')) return 'ELIM';
  if (code.startsWith('QF')) return 'QF';
  if (code.startsWith('SF')) return 'SF';
  if (code === 'FINAL' || code === 'F') return 'F';

  const label = String(
    (match as any).matchLabel || (match as any).stageLabel || (match as any).time || ''
  ).toLowerCase();
  if (label.includes('prelim')) return 'PRELIM';
  if (label.includes('qualifier 1') || label.startsWith('q1 ')) return 'Q1';
  if (label.includes('qualifier 2') || label.startsWith('q2 ')) return 'Q2';
  if (label.includes('eliminator')) return 'ELIM';
  if (label.includes('quarter')) return 'QF';
  if (label.includes('semi')) return 'SF';
  if (label.includes('final')) return 'F';

  const isIplContext =
    format === 'ipl_top4' ||
    Boolean((match as any).participantASource === 'Q1_LOSER' || (match as any).participantASource === 'Q1_WINNER');
  if (isIplContext) {
    if (match.stage === 'F') return 'F';
    if (match.stage === 'ELIM' || match.stage === 'QF') return 'ELIM';
    if (match.stage === 'SF') {
      return (match.slot || 1) >= 3 ? 'Q2' : 'Q1';
    }
  }

  if (match.stage === 'F') return 'F';
  if (match.stage === 'SF') return 'SF';
  if (match.stage === 'QF') return 'QF';
  if (match.stage === 'ELIM') return 'ELIM';
  return undefined;
}

export function formatParticipantSourceLabel(
  source?: string | null,
  optionsOrMatches?:
    | {
        teams?: Team[];
        qualifiedTeams?: PlayoffQualifiedSeed[];
        matches?: KnockoutMatch[];
        short?: boolean;
        fallback?: string;
      }
    | KnockoutMatch[],
  qualifiedTeamsArg?: PlayoffQualifiedSeed[],
  teamsArg?: Team[],
  fallbackArg?: string
): string {
  const options = Array.isArray(optionsOrMatches)
    ? {
        matches: optionsOrMatches,
        qualifiedTeams: qualifiedTeamsArg,
        teams: teamsArg,
        fallback: fallbackArg,
      }
    : optionsOrMatches;
  const fallback = options?.fallback || 'Awaiting Qualification';
  if (!source) return fallback;
  const s = source.trim();
  if (!s) return fallback;

  if (s === 'Q1_WINNER') return options?.short ? 'Winner Q1' : 'Winner of Qualifier 1';
  if (s === 'Q1_LOSER') return options?.short ? 'Loser Q1' : 'Loser of Qualifier 1';
  if (s === 'ELIM_WINNER') return options?.short ? 'Winner ELIM' : 'Winner of Eliminator';
  if (s === 'Q2_WINNER') return options?.short ? 'Winner Q2' : 'Winner of Qualifier 2';

  if (s.startsWith('RANK_')) {
    const rankNum = parseInt(s.replace('RANK_', ''), 10);
    if (Number.isFinite(rankNum) && rankNum > 0) {
      const seedObj = options?.qualifiedTeams?.find((q) => q.rank === rankNum);
      if (seedObj && !options?.short) {
        return `Rank #${rankNum} (${seedObj.teamName})`;
      }
      return `Rank #${rankNum}`;
    }
  }

  if (s.startsWith('TEAM:')) {
    const tid = s.slice(5);
    const team = options?.teams?.find((t) => t.id === tid);
    return team?.name || 'Selected Team';
  }

  if (s.startsWith('WINNER:')) {
    const ref = s.slice(7).toUpperCase();
    if (ref.startsWith('E')) {
      const num = ref.slice(1) || '1';
      return options?.short ? `Winner E${num}` : `Winner of Eliminator ${num}`;
    }
    if (ref.startsWith('QF')) {
      const num = ref.slice(2) || '1';
      return options?.short ? `Winner QF${num}` : `Winner of Quarter Final ${num}`;
    }
    if (ref.startsWith('SF')) {
      const num = ref.slice(2) || '1';
      return options?.short ? `Winner SF${num}` : `Winner of Semi Final ${num}`;
    }
    if (ref.startsWith('P')) {
      const num = ref.slice(1) || '1';
      return options?.short ? `Winner P${num}` : `Winner of Prelim ${num}`;
    }
    const refMatch = options?.matches?.find((m) => m.id === s.slice(7) || m.matchCode === ref);
    if (refMatch?.matchLabel) {
      return options?.short ? `Winner ${refMatch.matchCode || ref}` : `Winner of ${refMatch.matchLabel}`;
    }
    return `Winner of ${ref}`;
  }

  if (s.startsWith('LOSER:')) {
    const ref = s.slice(6).toUpperCase();
    return options?.short ? `Loser ${ref}` : `Loser of ${ref}`;
  }

  return s;
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
  if (!match) {
    return {
      shortCode: 'KO',
      title: 'Knockout Match',
      subtitle: 'Knockout Stage',
    };
  }

  const pr = inferPlayoffRound(match, format);
  const km = match as Partial<KnockoutMatch>;
  const explicitLabel = km.matchLabel || (match as Partial<Match>).stageLabel;
  const explicitCode = km.matchCode;

  if (pr === 'Q1') {
    return {
      playoffRound: 'Q1',
      shortCode: 'Q1',
      title: explicitLabel || 'Qualifier 1',
      subtitle: 'Rank #1 vs Rank #2 · Winner → Grand Final, Loser → Qualifier 2',
    };
  }
  if (pr === 'Q2') {
    return {
      playoffRound: 'Q2',
      shortCode: 'Q2',
      title: explicitLabel || 'Qualifier 2',
      subtitle: 'Qualifier 1 Loser vs Eliminator Winner · Winner → Grand Final',
    };
  }
  if (pr === 'ELIM' && format === 'ipl_top4') {
    return {
      playoffRound: 'ELIM',
      shortCode: 'ELIM',
      title: explicitLabel || 'Eliminator',
      subtitle: 'Rank #3 vs Rank #4 · Winner → Qualifier 2, Loser Eliminated',
    };
  }

  const srcA = km.participantASource ? formatParticipantSourceLabel(km.participantASource, { short: true }) : undefined;
  const srcB = km.participantBSource ? formatParticipantSourceLabel(km.participantBSource, { short: true }) : undefined;
  const pairingDesc = srcA && srcB ? `${srcA} vs ${srcB}` : undefined;
  const nextDesc = km.nextMatchCode
    ? km.nextMatchCode === 'FINAL'
      ? 'Winner → Grand Final'
      : `Winner → ${km.nextMatchCode}`
    : undefined;

  if (pr === 'F' || match.stage === 'F') {
    return {
      playoffRound: 'F',
      shortCode: 'FINAL',
      title: explicitLabel || 'Grand Final',
      subtitle: [pairingDesc || 'Semi Final Winners', 'Championship Title Match'].filter(Boolean).join(' · '),
    };
  }

  if (pr === 'SF' || match.stage === 'SF') {
    const slotNum = match.slot || 1;
    return {
      playoffRound: 'SF',
      shortCode: explicitCode || `SF${slotNum}`,
      title: explicitLabel || `Semi Final ${slotNum}`,
      subtitle: [pairingDesc, nextDesc || 'Winner → Grand Final'].filter(Boolean).join(' · ') || 'Knockout Semi Final',
    };
  }

  if (pr === 'PRELIM') {
    const slotNum = match.slot || 1;
    return {
      playoffRound: 'PRELIM',
      shortCode: explicitCode || `P${slotNum}`,
      title: explicitLabel || `Preliminary ${slotNum}`,
      subtitle: [pairingDesc, nextDesc || 'Winner Advances'].filter(Boolean).join(' · ') || 'Preliminary Knockout Round',
    };
  }

  if (pr === 'ELIM' || pr === 'QF' || match.stage === 'ELIM' || match.stage === 'QF') {
    const slotNum = match.slot || 1;
    const isQf = pr === 'QF' || (explicitLabel && explicitLabel.toLowerCase().includes('quarter'));
    return {
      playoffRound: isQf ? 'QF' : 'ELIM',
      shortCode: explicitCode || (isQf ? `QF${slotNum}` : `E${slotNum}`),
      title: explicitLabel || (isQf ? `Quarter Final ${slotNum}` : `Eliminator ${slotNum}`),
      subtitle: [pairingDesc, nextDesc || 'Winner → Semi Final'].filter(Boolean).join(' · ') || 'Knockout Eliminator',
    };
  }

  return {
    shortCode: explicitCode || 'KO',
    title: explicitLabel || 'Knockout Match',
    subtitle: [pairingDesc, nextDesc].filter(Boolean).join(' · ') || 'Knockout Stage',
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
  qualifyingCutoff?: number;
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
    qualifyingCutoff = 4,
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
          if (diffWins !== 0) return -diffWins;
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

  const cutoff = Math.max(2, qualifyingCutoff || 4);
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
        const affectsCutoff = rankStart <= cutoff && rankEnd >= cutoff;
        const withinQualified = rankStart <= cutoff;
        if (!allHaveManualOrder && (affectsCutoff || withinQualified)) {
          unresolvedTies.push({
            tiedTeamIds: group.map((g) => g.team.id),
            tiedTeamNames: group.map((g) => g.team.name),
            rankStart,
            rankEnd,
            affectsTop4Cutoff: affectsCutoff,
            reason: affectsCutoff
              ? `Teams tied across the Top ${cutoff} qualification cutoff (Ranks ${rankStart}–${rankEnd})`
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
  requiredTeamsCount: number;
  leagueTotalMatches: number;
  leagueCompletedMatches: number;
  isLeagueComplete: boolean;
  hasExistingBracket: boolean;
  hasStartedKnockoutMatches: boolean;
  blockingReasons: string[];
  warnings: string[];
}

export function evaluatePlayoffGenerationEligibility(params: {
  rankedActiveCount: number;
  leagueMatches: Match[];
  knockout: KnockoutData;
  playoffSettings: PlayoffSettings;
  unresolvedTies?: StandingsTieGroup[];
  qualifyingTeamsCount?: number;
  requiredTeamsCount?: number;
}): PlayoffEligibilityResult {
  const {
    rankedActiveCount,
    leagueMatches,
    knockout,
    playoffSettings,
    unresolvedTies = [],
    qualifyingTeamsCount,
    requiredTeamsCount,
  } = params;

  const groupMatches = leagueMatches.filter((m) => m.matchType !== 'knockout' && !m.stage);
  const completedCount = groupMatches.filter((m) => m.status === 'completed').length;
  const isLeagueComplete = groupMatches.length > 0 && completedCount === groupMatches.length;

  const requiredTeams = resolveFormatQualifyingCount(
    knockout.format || playoffSettings.format,
    qualifyingTeamsCount ??
      requiredTeamsCount ??
      knockout.qualifyingTeamsCount ??
      playoffSettings.qualifyingTeamsCount
  );

  const blockingReasons: string[] = [];
  const warnings: string[] = [];

  if (!playoffSettings.enabled) {
    blockingReasons.push('Knockout stage is currently disabled in Tournament Settings.');
  }

  if (rankedActiveCount < requiredTeams) {
    blockingReasons.push(
      `At least ${requiredTeams} active eligible teams are required for a Top ${requiredTeams} knockout bracket (currently ${rankedActiveCount} eligible).`
    );
  }

  if (playoffSettings.requireLeagueCompletion && !isLeagueComplete) {
    blockingReasons.push(
      groupMatches.length === 0
        ? 'League fixtures have not been generated yet (Require League Completion is enabled).'
        : `All league matches must be completed before generating knockouts (${completedCount}/${groupMatches.length} completed).`
    );
  } else if (!isLeagueComplete && groupMatches.length > 0) {
    warnings.push(
      `${groupMatches.length - completedCount} league match(es) are still pending; current standings will be used if you generate now.`
    );
  }

  if (unresolvedTies.some((t) => t.affectsTop4Cutoff)) {
    warnings.push(
      `One or more teams are tied at the Top ${requiredTeams} qualification cutoff. Review tie resolution before locking.`
    );
  }

  const hasExistingBracket = (knockout?.matches?.length || 0) > 0;
  const hasStartedKnockoutMatches = (knockout?.matches || []).some(
    (m) => m.status === 'live' || m.status === 'paused' || m.status === 'completed'
  );

  if (hasStartedKnockoutMatches) {
    warnings.push(
      'One or more knockout matches are already LIVE or COMPLETED. Regenerating requires explicit admin confirmation.'
    );
  } else if (hasExistingBracket) {
    warnings.push('An active knockout bracket already exists. Regenerating will replace existing draft/upcoming fixtures.');
  }

  return {
    canGenerate: blockingReasons.length === 0,
    eligibleTeamsCount: rankedActiveCount,
    requiredTeamsCount: requiredTeams,
    leagueTotalMatches: groupMatches.length,
    leagueCompletedMatches: completedCount,
    isLeagueComplete,
    hasExistingBracket,
    hasStartedKnockoutMatches,
    blockingReasons,
    warnings,
  };
}

/**
 * Generates standard power-of-two seed pairings for bracket size P (e.g. P=4 -> [[1,4],[2,3]]; P=8 -> [[1,8],[4,5],[2,7],[3,6]])
 */
function buildStandardSeedOrder(bracketSize: number): number[] {
  let seeds = [1, 2];
  while (seeds.length < bracketSize) {
    const nextSize = seeds.length * 2 + 1;
    const expanded: number[] = [];
    for (const s of seeds) {
      expanded.push(s);
      expanded.push(nextSize - s);
    }
    seeds = expanded;
  }
  return seeds;
}

/**
 * Generates the SPL Pageant Top 4 Playoff Bracket (Qualifier 1, Eliminator, Qualifier 2, Grand Final)
 */
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
    throw new Error('Exactly 4 distinct qualified teams are required to generate Top 4 playoffs.');
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
      matchCode: 'Q1',
      roundOrder: 1,
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
      seedA: 1,
      seedB: 2,
      nextMatchCode: 'FINAL',
      nextMatchSlot: 'A',
      teamA: top4TeamIds[0],
      teamB: top4TeamIds[1],
      status: 'upcoming',
      version: 1,
    },
    {
      id: crypto.randomUUID(),
      bracketId,
      matchCode: 'ELIM',
      roundOrder: 2,
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
      seedA: 3,
      seedB: 4,
      nextMatchCode: 'Q2',
      nextMatchSlot: 'B',
      teamA: top4TeamIds[2],
      teamB: top4TeamIds[3],
      status: 'upcoming',
      version: 1,
    },
    {
      id: crypto.randomUUID(),
      bracketId,
      matchCode: 'Q2',
      roundOrder: 3,
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
      nextMatchCode: 'FINAL',
      nextMatchSlot: 'B',
      teamA: undefined,
      teamB: undefined,
      status: 'upcoming',
      version: 1,
    },
    {
      id: crypto.randomUUID(),
      bracketId,
      matchCode: 'FINAL',
      roundOrder: 4,
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

/**
 * Generates any flexible single-elimination or preconfigured SPL knockout bracket:
 * Supports Top 2, Top 3, Top 4 (Format A), Top 5 (Format B), Top 6 (Format C),
 * Top 7 (Format D), Top 8 (Format D), Custom N (Format D), and SPL Pageant Top 4 ('ipl_top4').
 */
export function generateFlexibleKnockoutBracket(params: {
  format: PlayoffFormat;
  qualifiedTeamIds: string[];
  courtsCount?: number;
  courtNames?: string[];
  tournamentDate?: string;
  bracketId?: string;
  showOnPublicHomepage?: boolean;
  customQualifyingCount?: number;
}): KnockoutMatch[] {
  const {
    format,
    qualifiedTeamIds,
    courtsCount = 2,
    courtNames,
    tournamentDate,
    bracketId = crypto.randomUUID(),
  } = params;

  const uniqueIds = Array.from(new Set(qualifiedTeamIds.filter(Boolean)));
  const count = uniqueIds.length;
  if (count < 2) {
    throw new Error('At least 2 distinct qualified teams are required to generate a knockout bracket.');
  }

  if (format === 'ipl_top4' && count >= 4) {
    return generateIPLPlayoffBracket({
      top4TeamIds: [uniqueIds[0], uniqueIds[1], uniqueIds[2], uniqueIds[3]],
      courtsCount,
      courtNames,
      tournamentDate,
      bracketId,
    });
  }

  const safeCourts = Math.max(1, Number(courtsCount) || 1);
  const getCourt = (idx: number) => ((idx) % safeCourts) + 1;
  const getCourtName = (c: number) => courtNames?.[c - 1]?.trim() || `Court ${c}`;
  const getTeamByRank = (r: number) => uniqueIds[r - 1];

  const makeMatch = (cfg: {
    matchCode: string;
    stage: KnockoutMatch['stage'];
    playoffRound: PlayoffRoundType;
    roundOrder: number;
    matchLabel: string;
    slot: number;
    courtIdx: number;
    participantASource: string;
    participantBSource: string;
    nextMatchCode?: string;
    nextMatchSlot?: 'A' | 'B';
  }): KnockoutMatch => {
    const court = getCourt(cfg.courtIdx);
    const courtName = getCourtName(court);
    const rankA = cfg.participantASource.startsWith('RANK_')
      ? parseInt(cfg.participantASource.replace('RANK_', ''), 10)
      : undefined;
    const rankB = cfg.participantBSource.startsWith('RANK_')
      ? parseInt(cfg.participantBSource.replace('RANK_', ''), 10)
      : undefined;
    const teamA = rankA ? getTeamByRank(rankA) : undefined;
    const teamB = rankB ? getTeamByRank(rankB) : undefined;

    return {
      id: crypto.randomUUID(),
      bracketId,
      matchCode: cfg.matchCode,
      stage: cfg.stage,
      playoffRound: cfg.playoffRound,
      roundOrder: cfg.roundOrder,
      matchLabel: cfg.matchLabel,
      slot: cfg.slot,
      court,
      courtName,
      scheduledDate: tournamentDate || undefined,
      time: `${cfg.matchLabel} · ${courtName}`,
      participantASource: cfg.participantASource,
      participantBSource: cfg.participantBSource,
      seedA: rankA,
      seedB: rankB,
      nextMatchCode: cfg.nextMatchCode,
      nextMatchSlot: cfg.nextMatchSlot,
      teamA,
      teamB,
      status: 'upcoming',
      isPlayoff: true,
      version: 1,
    };
  };

  // TOP 2: Direct Grand Final (Rank 1 vs Rank 2)
  if (count === 2) {
    return [
      makeMatch({
        matchCode: 'FINAL',
        stage: 'F',
        playoffRound: 'F',
        roundOrder: 4,
        matchLabel: 'Grand Final',
        slot: 1,
        courtIdx: 0,
        participantASource: 'RANK_1',
        participantBSource: 'RANK_2',
      }),
    ];
  }

  // TOP 3: Eliminator 1 (Rank 2 vs Rank 3) -> Grand Final (Rank 1 vs Winner E1)
  if (count === 3) {
    return [
      makeMatch({
        matchCode: 'E1',
        stage: 'ELIM',
        playoffRound: 'ELIM',
        roundOrder: 2,
        matchLabel: 'Eliminator 1',
        slot: 1,
        courtIdx: 0,
        participantASource: 'RANK_2',
        participantBSource: 'RANK_3',
        nextMatchCode: 'FINAL',
        nextMatchSlot: 'B',
      }),
      makeMatch({
        matchCode: 'FINAL',
        stage: 'F',
        playoffRound: 'F',
        roundOrder: 4,
        matchLabel: 'Grand Final',
        slot: 1,
        courtIdx: 0,
        participantASource: 'RANK_1',
        participantBSource: 'WINNER:E1',
      }),
    ];
  }

  // FORMAT A — TOP 4 TEAMS:
  // Semi Final 1: Rank 1 vs Rank 4
  // Semi Final 2: Rank 2 vs Rank 3
  // Grand Final: Winner SF1 vs Winner SF2
  if (count === 4) {
    return [
      makeMatch({
        matchCode: 'SF1',
        stage: 'SF',
        playoffRound: 'SF',
        roundOrder: 3,
        matchLabel: 'Semi Final 1',
        slot: 1,
        courtIdx: 0,
        participantASource: 'RANK_1',
        participantBSource: 'RANK_4',
        nextMatchCode: 'FINAL',
        nextMatchSlot: 'A',
      }),
      makeMatch({
        matchCode: 'SF2',
        stage: 'SF',
        playoffRound: 'SF',
        roundOrder: 3,
        matchLabel: 'Semi Final 2',
        slot: 2,
        courtIdx: 1,
        participantASource: 'RANK_2',
        participantBSource: 'RANK_3',
        nextMatchCode: 'FINAL',
        nextMatchSlot: 'B',
      }),
      makeMatch({
        matchCode: 'FINAL',
        stage: 'F',
        playoffRound: 'F',
        roundOrder: 4,
        matchLabel: 'Grand Final',
        slot: 1,
        courtIdx: 0,
        participantASource: 'WINNER:SF1',
        participantBSource: 'WINNER:SF2',
      }),
    ];
  }

  // FORMAT B — TOP 5 TEAMS:
  // Eliminator 1: Rank 4 vs Rank 5
  // Semi Final 1: Rank 1 vs Winner Eliminator 1
  // Semi Final 2: Rank 2 vs Rank 3
  // Grand Final: Winner Semi Final 1 vs Winner Semi Final 2
  if (count === 5) {
    return [
      makeMatch({
        matchCode: 'E1',
        stage: 'ELIM',
        playoffRound: 'ELIM',
        roundOrder: 2,
        matchLabel: 'Eliminator 1',
        slot: 1,
        courtIdx: 0,
        participantASource: 'RANK_4',
        participantBSource: 'RANK_5',
        nextMatchCode: 'SF1',
        nextMatchSlot: 'B',
      }),
      makeMatch({
        matchCode: 'SF1',
        stage: 'SF',
        playoffRound: 'SF',
        roundOrder: 3,
        matchLabel: 'Semi Final 1',
        slot: 1,
        courtIdx: 0,
        participantASource: 'RANK_1',
        participantBSource: 'WINNER:E1',
        nextMatchCode: 'FINAL',
        nextMatchSlot: 'A',
      }),
      makeMatch({
        matchCode: 'SF2',
        stage: 'SF',
        playoffRound: 'SF',
        roundOrder: 3,
        matchLabel: 'Semi Final 2',
        slot: 2,
        courtIdx: 1,
        participantASource: 'RANK_2',
        participantBSource: 'RANK_3',
        nextMatchCode: 'FINAL',
        nextMatchSlot: 'B',
      }),
      makeMatch({
        matchCode: 'FINAL',
        stage: 'F',
        playoffRound: 'F',
        roundOrder: 4,
        matchLabel: 'Grand Final',
        slot: 1,
        courtIdx: 0,
        participantASource: 'WINNER:SF1',
        participantBSource: 'WINNER:SF2',
      }),
    ];
  }

  // FORMAT C — TOP 6 TEAMS:
  // Eliminator 1: Rank 3 vs Rank 6
  // Eliminator 2: Rank 4 vs Rank 5
  // Semi Final 1: Rank 1 vs Winner Eliminator 2
  // Semi Final 2: Rank 2 vs Winner Eliminator 1
  // Grand Final: Winner Semi Final 1 vs Winner Semi Final 2
  if (count === 6) {
    return [
      makeMatch({
        matchCode: 'E1',
        stage: 'ELIM',
        playoffRound: 'ELIM',
        roundOrder: 2,
        matchLabel: 'Eliminator 1',
        slot: 1,
        courtIdx: 0,
        participantASource: 'RANK_3',
        participantBSource: 'RANK_6',
        nextMatchCode: 'SF2',
        nextMatchSlot: 'B',
      }),
      makeMatch({
        matchCode: 'E2',
        stage: 'ELIM',
        playoffRound: 'ELIM',
        roundOrder: 2,
        matchLabel: 'Eliminator 2',
        slot: 2,
        courtIdx: 1,
        participantASource: 'RANK_4',
        participantBSource: 'RANK_5',
        nextMatchCode: 'SF1',
        nextMatchSlot: 'B',
      }),
      makeMatch({
        matchCode: 'SF1',
        stage: 'SF',
        playoffRound: 'SF',
        roundOrder: 3,
        matchLabel: 'Semi Final 1',
        slot: 1,
        courtIdx: 0,
        participantASource: 'RANK_1',
        participantBSource: 'WINNER:E2',
        nextMatchCode: 'FINAL',
        nextMatchSlot: 'A',
      }),
      makeMatch({
        matchCode: 'SF2',
        stage: 'SF',
        playoffRound: 'SF',
        roundOrder: 3,
        matchLabel: 'Semi Final 2',
        slot: 2,
        courtIdx: 1,
        participantASource: 'RANK_2',
        participantBSource: 'WINNER:E1',
        nextMatchCode: 'FINAL',
        nextMatchSlot: 'B',
      }),
      makeMatch({
        matchCode: 'FINAL',
        stage: 'F',
        playoffRound: 'F',
        roundOrder: 4,
        matchLabel: 'Grand Final',
        slot: 1,
        courtIdx: 0,
        participantASource: 'WINNER:SF1',
        participantBSource: 'WINNER:SF2',
      }),
    ];
  }

  // FORMAT D — TOP 7 TEAMS (8-slot structure with 1 bye for Rank 1):
  // Eliminator 1: Rank 4 vs Rank 5 -> SF1
  // Eliminator 2: Rank 2 vs Rank 7 -> SF2 (Slot A)
  // Eliminator 3: Rank 3 vs Rank 6 -> SF2 (Slot B)
  // Semi Final 1: Rank 1 vs Winner Eliminator 1
  // Semi Final 2: Winner Eliminator 2 vs Winner Eliminator 3
  // Grand Final: Winner Semi Final 1 vs Winner Semi Final 2
  if (count === 7) {
    return [
      makeMatch({
        matchCode: 'E1',
        stage: 'ELIM',
        playoffRound: 'ELIM',
        roundOrder: 2,
        matchLabel: 'Eliminator 1',
        slot: 1,
        courtIdx: 0,
        participantASource: 'RANK_4',
        participantBSource: 'RANK_5',
        nextMatchCode: 'SF1',
        nextMatchSlot: 'B',
      }),
      makeMatch({
        matchCode: 'E2',
        stage: 'ELIM',
        playoffRound: 'ELIM',
        roundOrder: 2,
        matchLabel: 'Eliminator 2',
        slot: 2,
        courtIdx: 1,
        participantASource: 'RANK_2',
        participantBSource: 'RANK_7',
        nextMatchCode: 'SF2',
        nextMatchSlot: 'A',
      }),
      makeMatch({
        matchCode: 'E3',
        stage: 'ELIM',
        playoffRound: 'ELIM',
        roundOrder: 2,
        matchLabel: 'Eliminator 3',
        slot: 3,
        courtIdx: 0,
        participantASource: 'RANK_3',
        participantBSource: 'RANK_6',
        nextMatchCode: 'SF2',
        nextMatchSlot: 'B',
      }),
      makeMatch({
        matchCode: 'SF1',
        stage: 'SF',
        playoffRound: 'SF',
        roundOrder: 3,
        matchLabel: 'Semi Final 1',
        slot: 1,
        courtIdx: 0,
        participantASource: 'RANK_1',
        participantBSource: 'WINNER:E1',
        nextMatchCode: 'FINAL',
        nextMatchSlot: 'A',
      }),
      makeMatch({
        matchCode: 'SF2',
        stage: 'SF',
        playoffRound: 'SF',
        roundOrder: 3,
        matchLabel: 'Semi Final 2',
        slot: 2,
        courtIdx: 1,
        participantASource: 'WINNER:E2',
        participantBSource: 'WINNER:E3',
        nextMatchCode: 'FINAL',
        nextMatchSlot: 'B',
      }),
      makeMatch({
        matchCode: 'FINAL',
        stage: 'F',
        playoffRound: 'F',
        roundOrder: 4,
        matchLabel: 'Grand Final',
        slot: 1,
        courtIdx: 0,
        participantASource: 'WINNER:SF1',
        participantBSource: 'WINNER:SF2',
      }),
    ];
  }

  // FORMAT D — TOP 8 TEAMS (Four opening matches + two Semi Finals + Grand Final):
  // Eliminator 1: Rank 1 vs Rank 8 -> SF1 (A)
  // Eliminator 2: Rank 4 vs Rank 5 -> SF1 (B)
  // Eliminator 3: Rank 2 vs Rank 7 -> SF2 (A)
  // Eliminator 4: Rank 3 vs Rank 6 -> SF2 (B)
  // Semi Final 1: Winner E1 vs Winner E2 -> FINAL (A)
  // Semi Final 2: Winner E3 vs Winner E4 -> FINAL (B)
  // Grand Final: Winner SF1 vs Winner SF2
  if (count === 8) {
    return [
      makeMatch({
        matchCode: 'E1',
        stage: 'ELIM',
        playoffRound: 'ELIM',
        roundOrder: 2,
        matchLabel: 'Eliminator 1',
        slot: 1,
        courtIdx: 0,
        participantASource: 'RANK_1',
        participantBSource: 'RANK_8',
        nextMatchCode: 'SF1',
        nextMatchSlot: 'A',
      }),
      makeMatch({
        matchCode: 'E2',
        stage: 'ELIM',
        playoffRound: 'ELIM',
        roundOrder: 2,
        matchLabel: 'Eliminator 2',
        slot: 2,
        courtIdx: 1,
        participantASource: 'RANK_4',
        participantBSource: 'RANK_5',
        nextMatchCode: 'SF1',
        nextMatchSlot: 'B',
      }),
      makeMatch({
        matchCode: 'E3',
        stage: 'ELIM',
        playoffRound: 'ELIM',
        roundOrder: 2,
        matchLabel: 'Eliminator 3',
        slot: 3,
        courtIdx: 0,
        participantASource: 'RANK_2',
        participantBSource: 'RANK_7',
        nextMatchCode: 'SF2',
        nextMatchSlot: 'A',
      }),
      makeMatch({
        matchCode: 'E4',
        stage: 'ELIM',
        playoffRound: 'ELIM',
        roundOrder: 2,
        matchLabel: 'Eliminator 4',
        slot: 4,
        courtIdx: 1,
        participantASource: 'RANK_3',
        participantBSource: 'RANK_6',
        nextMatchCode: 'SF2',
        nextMatchSlot: 'B',
      }),
      makeMatch({
        matchCode: 'SF1',
        stage: 'SF',
        playoffRound: 'SF',
        roundOrder: 3,
        matchLabel: 'Semi Final 1',
        slot: 1,
        courtIdx: 0,
        participantASource: 'WINNER:E1',
        participantBSource: 'WINNER:E2',
        nextMatchCode: 'FINAL',
        nextMatchSlot: 'A',
      }),
      makeMatch({
        matchCode: 'SF2',
        stage: 'SF',
        playoffRound: 'SF',
        roundOrder: 3,
        matchLabel: 'Semi Final 2',
        slot: 2,
        courtIdx: 1,
        participantASource: 'WINNER:E3',
        participantBSource: 'WINNER:E4',
        nextMatchCode: 'FINAL',
        nextMatchSlot: 'B',
      }),
      makeMatch({
        matchCode: 'FINAL',
        stage: 'F',
        playoffRound: 'F',
        roundOrder: 4,
        matchLabel: 'Grand Final',
        slot: 1,
        courtIdx: 0,
        participantASource: 'WINNER:SF1',
        participantBSource: 'WINNER:SF2',
      }),
    ];
  }

  // FORMAT D — CUSTOM N > 8 (Power-of-two bracket with protected top-seed byes)
  const bracketSize = Math.pow(2, Math.ceil(Math.log2(count))); // e.g. 16 for 9..16
  const seedOrder = buildStandardSeedOrder(bracketSize);
  const prelimMatches: KnockoutMatch[] = [];
  const quarterSources: string[] = [];
  let prelimCounter = 1;

  // Group into pairs for the opening round of the power-of-two bracket
  // For bracketSize = 16, there are 8 opening pairs feeding into 4 Quarter-Finals (E1..E4)
  const pairCount = bracketSize / 2;
  for (let i = 0; i < pairCount; i++) {
    const sA = seedOrder[i * 2];
    const sB = seedOrder[i * 2 + 1];
    const hasA = sA <= count;
    const hasB = sB <= count;

    if (hasA && hasB) {
      const pCode = `P${prelimCounter}`;
      const targetQfIdx = Math.floor(i / 2) + 1;
      const targetSlot: 'A' | 'B' = i % 2 === 0 ? 'A' : 'B';
      prelimMatches.push(
        makeMatch({
          matchCode: pCode,
          stage: 'ELIM',
          playoffRound: 'PRELIM',
          roundOrder: 1,
          matchLabel: `Preliminary ${prelimCounter}`,
          slot: prelimCounter,
          courtIdx: prelimCounter - 1,
          participantASource: `RANK_${sA}`,
          participantBSource: `RANK_${sB}`,
          nextMatchCode: `E${targetQfIdx}`,
          nextMatchSlot: targetSlot,
        })
      );
      quarterSources.push(`WINNER:${pCode}`);
      prelimCounter++;
    } else if (hasA) {
      quarterSources.push(`RANK_${sA}`);
    } else if (hasB) {
      quarterSources.push(`RANK_${sB}`);
    }
  }

  // Now reduce quarterSources down to 4 Quarter-Finals (E1..E4), 2 Semi-Finals (SF1..SF2), and 1 Grand Final
  const elimMatches: KnockoutMatch[] = [];
  for (let q = 0; q < 4; q++) {
    const srcA = quarterSources[q * 2] || `RANK_${q * 2 + 1}`;
    const srcB = quarterSources[q * 2 + 1] || `RANK_${q * 2 + 2}`;
    const sfTarget = q < 2 ? 'SF1' : 'SF2';
    const sfSlot: 'A' | 'B' = q % 2 === 0 ? 'A' : 'B';
    elimMatches.push(
      makeMatch({
        matchCode: `E${q + 1}`,
        stage: 'ELIM',
        playoffRound: 'ELIM',
        roundOrder: 2,
        matchLabel: `Eliminator ${q + 1}`,
        slot: prelimMatches.length + q + 1,
        courtIdx: q,
        participantASource: srcA,
        participantBSource: srcB,
        nextMatchCode: sfTarget,
        nextMatchSlot: sfSlot,
      })
    );
  }

  const sfMatches: KnockoutMatch[] = [
    makeMatch({
      matchCode: 'SF1',
      stage: 'SF',
      playoffRound: 'SF',
      roundOrder: 3,
      matchLabel: 'Semi Final 1',
      slot: 1,
      courtIdx: 0,
      participantASource: 'WINNER:E1',
      participantBSource: 'WINNER:E2',
      nextMatchCode: 'FINAL',
      nextMatchSlot: 'A',
    }),
    makeMatch({
      matchCode: 'SF2',
      stage: 'SF',
      playoffRound: 'SF',
      roundOrder: 3,
      matchLabel: 'Semi Final 2',
      slot: 2,
      courtIdx: 1,
      participantASource: 'WINNER:E3',
      participantBSource: 'WINNER:E4',
      nextMatchCode: 'FINAL',
      nextMatchSlot: 'B',
    }),
  ];

  const finalMatch = makeMatch({
    matchCode: 'FINAL',
    stage: 'F',
    playoffRound: 'F',
    roundOrder: 4,
    matchLabel: 'Grand Final',
    slot: 1,
    courtIdx: 0,
    participantASource: 'WINNER:SF1',
    participantBSource: 'WINNER:SF2',
  });

  return [...prelimMatches, ...elimMatches, ...sfMatches, finalMatch];
}

/**
 * Resolves a single participant source string ('RANK_1', 'TEAM:<id>', 'WINNER:E1', 'Q1_LOSER', etc.)
 * strictly from completed upstream matches or qualified seeds.
 */
export function resolveKnockoutParticipantSource(
  source: string | undefined,
  currentTeamId: string | undefined,
  isManualMatch: boolean | undefined,
  matchesByCode: Map<string, KnockoutMatch>,
  matchesById: Map<string, KnockoutMatch>,
  rankToTeamId: Map<number, string>
): { teamId?: string; seed?: number; isFromUpstream: boolean } {
  if (!source) {
    return { teamId: currentTeamId, isFromUpstream: false };
  }

  const s = source.trim();
  if (s.startsWith('RANK_')) {
    const rankNum = parseInt(s.replace('RANK_', ''), 10);
    const resolvedTeam = rankToTeamId.get(rankNum) || currentTeamId;
    return { teamId: resolvedTeam, seed: Number.isFinite(rankNum) ? rankNum : undefined, isFromUpstream: false };
  }

  if (s.startsWith('TEAM:')) {
    const tid = s.slice(5).trim();
    let seed: number | undefined;
    for (const [r, t] of rankToTeamId.entries()) {
      if (t === tid) {
        seed = r;
        break;
      }
    }
    return { teamId: tid || currentTeamId, seed, isFromUpstream: false };
  }

  // Legacy IPL source aliases
  if (s === 'Q1_WINNER' || s === 'Q1_LOSER' || s === 'ELIM_WINNER' || s === 'Q2_WINNER') {
    const targetCode = s.startsWith('Q1_') ? 'Q1' : s.startsWith('ELIM_') ? 'ELIM' : 'Q2';
    const wantLoser = s === 'Q1_LOSER';
    const up = matchesByCode.get(targetCode);
    if (!up || up.status !== 'completed' || !up.winner || (up.winner !== up.teamA && up.winner !== up.teamB)) {
      return { teamId: isManualMatch ? currentTeamId : undefined, isFromUpstream: true };
    }
    const resolvedId = wantLoser ? (up.winner === up.teamA ? up.teamB : up.teamA) : up.winner;
    let seed: number | undefined;
    for (const [r, t] of rankToTeamId.entries()) {
      if (t === resolvedId) {
        seed = r;
        break;
      }
    }
    return { teamId: resolvedId, seed, isFromUpstream: true };
  }

  if (s.startsWith('WINNER:') || s.startsWith('LOSER:')) {
    const wantLoser = s.startsWith('LOSER:');
    const ref = s.slice(wantLoser ? 6 : 7).trim();
    const up = matchesByCode.get(ref.toUpperCase()) || matchesById.get(ref);
    if (!up || up.status !== 'completed' || !up.winner || (up.winner !== up.teamA && up.winner !== up.teamB)) {
      return { teamId: isManualMatch ? currentTeamId : undefined, isFromUpstream: true };
    }
    const resolvedId = wantLoser ? (up.winner === up.teamA ? up.teamB : up.teamA) : up.winner;
    let seed: number | undefined;
    for (const [r, t] of rankToTeamId.entries()) {
      if (t === resolvedId) {
        seed = r;
        break;
      }
    }
    return { teamId: resolvedId, seed, isFromUpstream: true };
  }

  return { teamId: currentTeamId, isFromUpstream: false };
}

/**
 * Ensures every match in a bracket has a canonical matchCode and roundOrder
 */
export function ensureCanonicalMatchMetadata(
  matches: KnockoutMatch[],
  format?: PlayoffFormat
): KnockoutMatch[] {
  if (!matches || matches.length === 0) return [];

  const isIpl =
    format === 'ipl_top4' ||
    matches.some((m) => m.playoffRound === 'Q1' || m.playoffRound === 'Q2' || m.participantASource === 'Q1_LOSER');

  return matches.map((m) => {
    const pr = inferPlayoffRound(m, isIpl ? 'ipl_top4' : format);
    let matchCode = m.matchCode;
    let roundOrder = m.roundOrder;

    if (!matchCode) {
      if (pr === 'Q1') matchCode = 'Q1';
      else if (pr === 'Q2') matchCode = 'Q2';
      else if (pr === 'ELIM' && isIpl) matchCode = 'ELIM';
      else if (pr === 'PRELIM') matchCode = `P${m.slot || 1}`;
      else if (pr === 'ELIM' || pr === 'QF' || m.stage === 'ELIM' || m.stage === 'QF') matchCode = `E${m.slot || 1}`;
      else if (pr === 'SF' || m.stage === 'SF') matchCode = `SF${m.slot || 1}`;
      else if (pr === 'F' || m.stage === 'F') matchCode = 'FINAL';
      else matchCode = `KO${m.slot || 1}`;
    }

    if (!roundOrder) {
      if (pr === 'PRELIM' || matchCode.startsWith('P')) roundOrder = 1;
      else if (pr === 'Q1') roundOrder = 1;
      else if (pr === 'ELIM' || pr === 'QF' || m.stage === 'ELIM' || m.stage === 'QF') roundOrder = 2;
      else if (pr === 'Q2' || pr === 'SF' || m.stage === 'SF') roundOrder = 3;
      else if (pr === 'F' || m.stage === 'F' || matchCode === 'FINAL') roundOrder = 4;
      else roundOrder = 2;
    }

    return {
      ...m,
      matchCode,
      roundOrder,
      playoffRound: pr,
    };
  });
}

/**
 * Universal Knockout Progression Engine supporting Top 2..8, Custom, and SPL Pageant Top 4
 */
export function progressKnockoutBracket(
  matches: KnockoutMatch[],
  format?: PlayoffFormat,
  qualifiedSeeds?: PlayoffQualifiedSeed[]
): {
  matches: KnockoutMatch[];
  championTeamId?: string;
  runnerUpTeamId?: string;
  isCompleted: boolean;
} {
  if (!matches || matches.length === 0) {
    return { matches: [], isCompleted: false };
  }

  const canonical = ensureCanonicalMatchMetadata(matches, format);

  // Build rank -> teamId map from qualifiedSeeds if available
  const rankToTeamId = new Map<number, string>();
  if (Array.isArray(qualifiedSeeds)) {
    for (const q of qualifiedSeeds) {
      if (q && q.rank > 0 && q.teamId) {
        rankToTeamId.set(q.rank, q.teamId);
      }
    }
  }

  // First normalize each match's own winner/loser status
  for (const m of canonical) {
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

  // Sort in topological round order (1 -> 2 -> 3 -> 4) and slot
  canonical.sort((a, b) => {
    const ra = a.roundOrder ?? getKnockoutProgressionOrder(a);
    const rb = b.roundOrder ?? getKnockoutProgressionOrder(b);
    if (ra !== rb) return ra - rb;
    return (a.slot || 1) - (b.slot || 1);
  });

  const matchesByCode = new Map<string, KnockoutMatch>();
  const matchesById = new Map<string, KnockoutMatch>();
  for (const m of canonical) {
    if (m.matchCode) matchesByCode.set(m.matchCode.toUpperCase(), m);
    if (m.id) matchesById.set(m.id, m);
  }

  // Legacy fallback for brackets without explicit participantASource/participantBSource
  const hasAnyExplicitSources = canonical.some((m) => Boolean(m.participantASource || m.participantBSource));
  if (!hasAnyExplicitSources) {
    const elims = canonical.filter((m) => m.stage === 'ELIM' || m.stage === 'QF').sort((a, b) => a.slot - b.slot);
    const sfs = canonical.filter((m) => m.stage === 'SF').sort((a, b) => a.slot - b.slot);
    const fin = canonical.find((m) => m.stage === 'F');
    if (elims.length >= 4 && sfs.length >= 2) {
      sfs[0].participantASource = `WINNER:${elims[0].matchCode || elims[0].id}`;
      sfs[0].participantBSource = `WINNER:${elims[1].matchCode || elims[1].id}`;
      sfs[1].participantASource = `WINNER:${elims[2].matchCode || elims[2].id}`;
      sfs[1].participantBSource = `WINNER:${elims[3].matchCode || elims[3].id}`;
    }
    if (sfs.length >= 2 && fin) {
      fin.participantASource = `WINNER:${sfs[0].matchCode || sfs[0].id}`;
      fin.participantBSource = `WINNER:${sfs[1].matchCode || sfs[1].id}`;
    }
  }

  // Resolve participants in topological order
  for (const m of canonical) {
    const prevA = m.teamA;
    const prevB = m.teamB;

    if (m.participantASource) {
      const resA = resolveKnockoutParticipantSource(
        m.participantASource,
        m.teamA,
        m.manual,
        matchesByCode,
        matchesById,
        rankToTeamId
      );
      if (resA.isFromUpstream || resA.teamId) {
        m.teamA = resA.teamId;
      }
      if (resA.seed !== undefined) m.seedA = resA.seed;
    }

    if (m.participantBSource) {
      const resB = resolveKnockoutParticipantSource(
        m.participantBSource,
        m.teamB,
        m.manual,
        matchesByCode,
        matchesById,
        rankToTeamId
      );
      if (resB.isFromUpstream || resB.teamId) {
        m.teamB = resB.teamId;
      }
      if (resB.seed !== undefined) m.seedB = resB.seed;
    }

    // If participants changed on a downstream match, clear stale scores/results
    const changed = prevA !== m.teamA || prevB !== m.teamB;
    if (changed && !m.manual) {
      const hadResultOrScores =
        m.status !== 'upcoming' ||
        m.winner !== undefined ||
        m.scoreA !== undefined ||
        m.scoreB !== undefined ||
        (m.sets && m.sets.length > 0);

      if (hadResultOrScores) {
        m.status = 'upcoming';
        m.winner = undefined;
        m.loserId = undefined;
        m.scoreA = undefined;
        m.scoreB = undefined;
        m.sets = undefined;
        m.completedAt = undefined;
      }
    }
  }

  const finalMatch = canonical.find((m) => m.stage === 'F' || m.playoffRound === 'F' || m.matchCode === 'FINAL');
  const finalCompleted = Boolean(
    finalMatch &&
      finalMatch.status === 'completed' &&
      finalMatch.winner &&
      (finalMatch.winner === finalMatch.teamA || finalMatch.winner === finalMatch.teamB)
  );

  const championTeamId = finalCompleted ? finalMatch!.winner : undefined;
  const runnerUpTeamId = finalCompleted
    ? finalMatch!.winner === finalMatch!.teamA
      ? finalMatch!.teamB
      : finalMatch!.teamA
    : undefined;

  return {
    matches: canonical,
    championTeamId,
    runnerUpTeamId,
    isCompleted: Boolean(finalCompleted && championTeamId),
  };
}

export function progressIPLPlayoffs(matches: KnockoutMatch[]): {
  matches: KnockoutMatch[];
  championTeamId?: string;
  runnerUpTeamId?: string;
  isCompleted: boolean;
} {
  return progressKnockoutBracket(matches, 'ipl_top4');
}

export function canStartOrScorePlayoffMatch(
  match: KnockoutMatch,
  allKoMatches: KnockoutMatch[],
  format?: PlayoffFormat
): { allowed: boolean; reason?: string } {
  const canonicalAll = ensureCanonicalMatchMetadata(allKoMatches, format);
  const byCode = new Map<string, KnockoutMatch>();
  const byId = new Map<string, KnockoutMatch>();
  for (const m of canonicalAll) {
    if (m.matchCode) byCode.set(m.matchCode.toUpperCase(), m);
    if (m.id) byId.set(m.id, m);
  }

  const checkSourceReady = (src?: string): { ready: boolean; reason?: string } => {
    if (!src) return { ready: true };
    const s = src.trim();
    if (s === 'Q1_WINNER' || s === 'Q1_LOSER') {
      const q1 = byCode.get('Q1');
      if (!q1 || q1.status !== 'completed' || !q1.winner) {
        return {
          ready: false,
          reason: `${getPlayoffMatchDisplayLabel(match, format).title} cannot start until Qualifier 1 is completed.`,
        };
      }
    } else if (s === 'ELIM_WINNER') {
      const elim = byCode.get('ELIM');
      if (!elim || elim.status !== 'completed' || !elim.winner) {
        return {
          ready: false,
          reason: `${getPlayoffMatchDisplayLabel(match, format).title} cannot start until the Eliminator match is completed.`,
        };
      }
    } else if (s === 'Q2_WINNER') {
      const q2 = byCode.get('Q2');
      if (!q2 || q2.status !== 'completed' || !q2.winner) {
        return {
          ready: false,
          reason: `${getPlayoffMatchDisplayLabel(match, format).title} cannot start until Qualifier 2 is completed.`,
        };
      }
    } else if (s.startsWith('WINNER:') || s.startsWith('LOSER:')) {
      const ref = s.slice(s.startsWith('LOSER:') ? 6 : 7).trim();
      const up = byCode.get(ref.toUpperCase()) || byId.get(ref);
      if (!up || up.status !== 'completed' || !up.winner) {
        const upTitle = up ? getPlayoffMatchDisplayLabel(up, format).title : ref;
        return {
          ready: false,
          reason: `${getPlayoffMatchDisplayLabel(match, format).title} cannot start until ${upTitle} is completed.`,
        };
      }
    }
    return { ready: true };
  };

  const checkA = checkSourceReady(match.participantASource);
  if (!checkA.ready) return { allowed: false, reason: checkA.reason };

  const checkB = checkSourceReady(match.participantBSource);
  if (!checkB.ready) return { allowed: false, reason: checkB.reason };

  if (!match.teamA || !match.teamB) {
    return {
      allowed: false,
      reason: 'Both participant slots must be resolved before starting or scoring this knockout match.',
    };
  }
  if (match.teamA === match.teamB) {
    return { allowed: false, reason: 'Invalid pairing: Team A and Team B cannot be the same team.' };
  }

  return { allowed: true };
}

/**
 * Finds all downstream matches that depend directly or transitively on a given match.
 */
export function findDownstreamDependentMatches(
  matchId: string,
  allMatches: KnockoutMatch[]
): {
  allDownstream: KnockoutMatch[];
  startedOrCompletedDownstream: KnockoutMatch[];
} {
  const canonical = ensureCanonicalMatchMetadata(allMatches);
  const target = canonical.find((m) => m.id === matchId);
  if (!target) return { allDownstream: [], startedOrCompletedDownstream: [] };

  const dependentIds = new Set<string>();
  const allDownstream: KnockoutMatch[] = [];

  const referencesMatch = (candidate: KnockoutMatch, upstream: KnockoutMatch): boolean => {
    const code = (upstream.matchCode || '').toUpperCase();
    const id = upstream.id;
    const sources = [candidate.participantASource || '', candidate.participantBSource || ''];
    for (const raw of sources) {
      const s = raw.trim().toUpperCase();
      if (!s) continue;
      if (code && (s === `WINNER:${code}` || s === `LOSER:${code}`)) return true;
      if (id && (raw.trim() === `WINNER:${id}` || raw.trim() === `LOSER:${id}`)) return true;
      if (code === 'Q1' && (s === 'Q1_WINNER' || s === 'Q1_LOSER')) return true;
      if (code === 'ELIM' && s === 'ELIM_WINNER') return true;
      if (code === 'Q2' && s === 'Q2_WINNER') return true;
    }
    if (upstream.nextMatchCode && candidate.matchCode?.toUpperCase() === upstream.nextMatchCode.toUpperCase()) {
      return true;
    }
    return false;
  };

  const queue: KnockoutMatch[] = [target];
  while (queue.length > 0) {
    const curr = queue.shift()!;
    for (const m of canonical) {
      if (m.id === curr.id || dependentIds.has(m.id)) continue;
      if (referencesMatch(m, curr)) {
        dependentIds.add(m.id);
        allDownstream.push(m);
        queue.push(m);
      }
    }
  }

  const startedOrCompletedDownstream = allDownstream.filter(
    (m) => m.status === 'live' || m.status === 'paused' || m.status === 'completed'
  );

  return { allDownstream, startedOrCompletedDownstream };
}

/**
 * Validates that a knockout bracket configuration is structurally sound before saving or publishing.
 */
export function validateKnockoutBracketConfig(
  matchesOrParams:
    | KnockoutMatch[]
    | {
        matches: KnockoutMatch[];
        qualifiedTeams?: PlayoffQualifiedSeed[];
        qualifiedSeeds?: PlayoffQualifiedSeed[];
        teams?: Team[];
      },
  qualifiedSeedsArg?: PlayoffQualifiedSeed[],
  teamsArg?: Team[]
): {
  valid: boolean;
  errors: string[];
  warnings: string[];
} {
  const matches = Array.isArray(matchesOrParams) ? matchesOrParams : matchesOrParams?.matches || [];
  const qualifiedSeeds = Array.isArray(matchesOrParams)
    ? qualifiedSeedsArg
    : matchesOrParams?.qualifiedTeams || matchesOrParams?.qualifiedSeeds;
  const teams = Array.isArray(matchesOrParams) ? teamsArg : matchesOrParams?.teams;

  const errors: string[] = [];
  const warnings: string[] = [];

  if (!matches || matches.length === 0) {
    errors.push('Knockout bracket has no fixtures configured.');
    return { valid: false, errors, warnings };
  }

  const canonical = ensureCanonicalMatchMetadata(matches);
  const byCode = new Map<string, KnockoutMatch>();
  const byId = new Map<string, KnockoutMatch>();
  for (const m of canonical) {
    if (m.matchCode) byCode.set(m.matchCode.toUpperCase(), m);
    if (m.id) byId.set(m.id, m);
  }

  const finals = canonical.filter((m) => m.stage === 'F' || m.playoffRound === 'F' || m.matchCode === 'FINAL');
  if (finals.length === 0) {
    errors.push('Bracket must include a Grand Final match.');
  } else if (finals.length > 1) {
    errors.push('Bracket cannot contain multiple Grand Final matches.');
  }

  const directTeamAppearances = new Map<string, string[]>();
  const directSourceAppearances = new Map<string, string[]>();

  for (const m of canonical) {
    const label = getPlayoffMatchDisplayLabel(m).title;

    if (m.teamA && m.teamB && m.teamA === m.teamB) {
      const tName = teams?.find((t) => t.id === m.teamA)?.name || m.teamA;
      errors.push(`${label}: ${tName} cannot be assigned as both Team A and Team B.`);
    }

    if (
      m.participantASource &&
      m.participantBSource &&
      m.participantASource.trim().toUpperCase() === m.participantBSource.trim().toUpperCase()
    ) {
      errors.push(`${label}: Participant A and Participant B cannot share the same source (${m.participantASource}).`);
    }

    // Check direct team / rank appearances to prevent a team from qualifying through multiple direct paths
    for (const src of [m.participantASource, m.participantBSource]) {
      if (!src) continue;
      const clean = src.trim().toUpperCase();
      if (clean.startsWith('RANK_') || clean.startsWith('TEAM:')) {
        const list = directSourceAppearances.get(clean) || [];
        list.push(label);
        directSourceAppearances.set(clean, list);
      } else if (clean.startsWith('WINNER:') || clean.startsWith('LOSER:')) {
        const ref = clean.slice(clean.startsWith('LOSER:') ? 6 : 7).trim();
        const up = byCode.get(ref) || byId.get(src.slice(clean.startsWith('LOSER:') ? 6 : 7).trim());
        if (!up) {
          errors.push(`${label} references non-existent match "${ref}".`);
        } else if ((up.roundOrder || 1) >= (m.roundOrder || 4)) {
          errors.push(`${label} cannot depend on a match in the same or later round (${up.matchLabel || ref}).`);
        }
      }
    }

    // For opening matches where both teams are directly assigned without upstream sources
    const isDirectA = !m.participantASource || m.participantASource.startsWith('RANK_') || m.participantASource.startsWith('TEAM:');
    const isDirectB = !m.participantBSource || m.participantBSource.startsWith('RANK_') || m.participantBSource.startsWith('TEAM:');
    if (isDirectA && m.teamA) {
      const list = directTeamAppearances.get(m.teamA) || [];
      list.push(label);
      directTeamAppearances.set(m.teamA, list);
    }
    if (isDirectB && m.teamB) {
      const list = directTeamAppearances.get(m.teamB) || [];
      list.push(label);
      directTeamAppearances.set(m.teamB, list);
    }
  }

  for (const [src, labels] of directSourceAppearances.entries()) {
    if (labels.length > 1) {
      errors.push(
        `Duplicate seed path: ${formatParticipantSourceLabel(src, { qualifiedTeams: qualifiedSeeds, teams })} is assigned directly in multiple matches (${labels.join(', ')}).`
      );
    }
  }

  for (const [tid, labels] of directTeamAppearances.entries()) {
    if (labels.length > 1) {
      const tName = teams?.find((t) => t.id === tid)?.name || tid;
      errors.push(
        `Duplicate team assignment: "${tName}" is directly placed in multiple knockout matches (${labels.join(', ')}).`
      );
    }
  }

  // Ensure every non-final match advances its winner to a valid downstream match
  for (const m of canonical) {
    if (m.stage === 'F' || m.playoffRound === 'F' || m.matchCode === 'FINAL') continue;
    const code = (m.matchCode || '').toUpperCase();
    const label = getPlayoffMatchDisplayLabel(m).title;
    const consumers = canonical.filter((cand) => {
      if (cand.id === m.id) return false;
      const sources = [cand.participantASource || '', cand.participantBSource || ''].map((s) =>
        s.trim().toUpperCase()
      );
      if (code && sources.includes(`WINNER:${code}`)) return true;
      if (m.id && sources.includes(`WINNER:${m.id.toUpperCase()}`)) return true;
      if (code === 'Q1' && sources.includes('Q1_WINNER')) return true;
      if (code === 'ELIM' && sources.includes('ELIM_WINNER')) return true;
      if (code === 'Q2' && sources.includes('Q2_WINNER')) return true;
      return false;
    });
    if (consumers.length === 0) {
      errors.push(
        `Unassigned winner destination: Winner of ${label} does not advance to any Semi Final or Grand Final slot.`
      );
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

export interface CustomRecommendedStructure {
  qualifyingTeamsCount: number;
  eliminatorsCount: number;
  semiFinalsCount: number;
  grandFinalCount: number;
  directSemiFinalByes: number;
  directFinalByes: number;
  totalMatches: number;
  summary: string;
}

export function getRecommendedCustomCounts(qualifyingTeamsCount: number): CustomRecommendedStructure {
  const n = Math.max(2, Math.floor(Number(qualifyingTeamsCount) || 4));
  if (n === 2) {
    return {
      qualifyingTeamsCount: 2,
      eliminatorsCount: 0,
      semiFinalsCount: 0,
      grandFinalCount: 1,
      directSemiFinalByes: 0,
      directFinalByes: 2,
      totalMatches: 1,
      summary: '2 Teams: 0 Eliminators · 0 Semi Finals · 1 Grand Final (Rank #1 vs Rank #2)',
    };
  }
  if (n === 3) {
    return {
      qualifyingTeamsCount: 3,
      eliminatorsCount: 1,
      semiFinalsCount: 0,
      grandFinalCount: 1,
      directSemiFinalByes: 0,
      directFinalByes: 1,
      totalMatches: 2,
      summary: '3 Teams: 1 Eliminator (Rank #2 vs #3) · 0 Semi Finals · 1 Grand Final (Rank #1 Bye vs Winner E1)',
    };
  }
  const eliminatorsCount = Math.max(0, n - 4);
  const semiFinalsCount = 2;
  const directSemiFinalByes = Math.max(0, 4 - eliminatorsCount);
  return {
    qualifyingTeamsCount: n,
    eliminatorsCount,
    semiFinalsCount,
    grandFinalCount: 1,
    directSemiFinalByes,
    directFinalByes: 0,
    totalMatches: eliminatorsCount + semiFinalsCount + 1,
    summary:
      directSemiFinalByes > 0
        ? `${n} Teams: ${eliminatorsCount} Eliminator${eliminatorsCount === 1 ? '' : 's'} · 2 Semi Finals (${directSemiFinalByes} Direct Semi-Final Bye${directSemiFinalByes === 1 ? '' : 's'}) · 1 Grand Final`
        : `${n} Teams: ${eliminatorsCount} Eliminators · 2 Semi Finals · 1 Grand Final (${n - 1} total matches)`,
  };
}

/**
 * Generates or resizes a CustomKnockoutStageConfig for (qualifyingTeamsCount, eliminatorsCount, semiFinalsCount).
 * - Does NOT silently add or remove matches beyond the administrator's requested counts.
 * - Pre-fills sensible seedings when useSmartDefaults is true or when creating new cards.
 */
export function buildCustomKnockoutStageConfig(params: {
  qualifyingTeamsCount: number;
  eliminatorsCount: number;
  semiFinalsCount: number;
  existingConfig?: CustomKnockoutStageConfig | null;
  courtsCount?: number;
  courtNames?: string[];
  tournamentDate?: string;
  useSmartDefaults?: boolean;
}): CustomKnockoutStageConfig {
  const n = Math.max(2, Math.floor(Number(params.qualifyingTeamsCount) || 6));
  const eCount = Math.max(0, Math.floor(Number(params.eliminatorsCount) ?? Math.max(0, n - 4)));
  const sCount = Math.max(0, Math.floor(Number(params.semiFinalsCount) ?? (n >= 4 ? 2 : 0)));
  const safeCourts = Math.max(1, Number(params.courtsCount) || 2);
  const getCourt = (idx: number) => (idx % safeCourts) + 1;
  const getCourtName = (c: number) => params.courtNames?.[c - 1]?.trim() || `Court ${c}`;
  const prevByCode = new Map<string, CustomKnockoutMatchDraft>();
  if (!params.useSmartDefaults && params.existingConfig?.matches) {
    for (const m of params.existingConfig.matches) {
      prevByCode.set(m.matchCode.toUpperCase(), m);
    }
  }

  // Canonical smart default templates for standard single-elimination structures
  const defaultMap = new Map<
    string,
    { a: string; b: string; nextCode?: string; nextSlot?: 'A' | 'B' }
  >();

  if (n === 2 && eCount === 0 && sCount === 0) {
    defaultMap.set('FINAL', { a: 'RANK_1', b: 'RANK_2' });
  } else if (n === 3 && eCount === 1 && sCount === 0) {
    defaultMap.set('E1', { a: 'RANK_2', b: 'RANK_3', nextCode: 'FINAL', nextSlot: 'B' });
    defaultMap.set('FINAL', { a: 'RANK_1', b: 'WINNER:E1' });
  } else if (n === 3 && eCount === 0 && sCount === 1) {
    defaultMap.set('SF1', { a: 'RANK_2', b: 'RANK_3', nextCode: 'FINAL', nextSlot: 'B' });
    defaultMap.set('FINAL', { a: 'RANK_1', b: 'WINNER:SF1' });
  } else if (n === 4 && eCount === 0 && sCount === 2) {
    defaultMap.set('SF1', { a: 'RANK_1', b: 'RANK_4', nextCode: 'FINAL', nextSlot: 'A' });
    defaultMap.set('SF2', { a: 'RANK_2', b: 'RANK_3', nextCode: 'FINAL', nextSlot: 'B' });
    defaultMap.set('FINAL', { a: 'WINNER:SF1', b: 'WINNER:SF2' });
  } else if (n === 4 && eCount === 1 && sCount === 1) {
    defaultMap.set('E1', { a: 'RANK_3', b: 'RANK_4', nextCode: 'SF1', nextSlot: 'B' });
    defaultMap.set('SF1', { a: 'RANK_2', b: 'WINNER:E1', nextCode: 'FINAL', nextSlot: 'B' });
    defaultMap.set('FINAL', { a: 'RANK_1', b: 'WINNER:SF1' });
  } else if (n === 5 && eCount === 1 && sCount === 2) {
    defaultMap.set('E1', { a: 'RANK_4', b: 'RANK_5', nextCode: 'SF1', nextSlot: 'B' });
    defaultMap.set('SF1', { a: 'RANK_1', b: 'WINNER:E1', nextCode: 'FINAL', nextSlot: 'A' });
    defaultMap.set('SF2', { a: 'RANK_2', b: 'RANK_3', nextCode: 'FINAL', nextSlot: 'B' });
    defaultMap.set('FINAL', { a: 'WINNER:SF1', b: 'WINNER:SF2' });
  } else if (n === 6 && eCount === 2 && sCount === 2) {
    defaultMap.set('E1', { a: 'RANK_3', b: 'RANK_6', nextCode: 'SF2', nextSlot: 'B' });
    defaultMap.set('E2', { a: 'RANK_4', b: 'RANK_5', nextCode: 'SF1', nextSlot: 'B' });
    defaultMap.set('SF1', { a: 'RANK_1', b: 'WINNER:E2', nextCode: 'FINAL', nextSlot: 'A' });
    defaultMap.set('SF2', { a: 'RANK_2', b: 'WINNER:E1', nextCode: 'FINAL', nextSlot: 'B' });
    defaultMap.set('FINAL', { a: 'WINNER:SF1', b: 'WINNER:SF2' });
  } else if (n === 7 && eCount === 3 && sCount === 2) {
    defaultMap.set('E1', { a: 'RANK_4', b: 'RANK_5', nextCode: 'SF1', nextSlot: 'B' });
    defaultMap.set('E2', { a: 'RANK_2', b: 'RANK_7', nextCode: 'SF2', nextSlot: 'A' });
    defaultMap.set('E3', { a: 'RANK_3', b: 'RANK_6', nextCode: 'SF2', nextSlot: 'B' });
    defaultMap.set('SF1', { a: 'RANK_1', b: 'WINNER:E1', nextCode: 'FINAL', nextSlot: 'A' });
    defaultMap.set('SF2', { a: 'WINNER:E2', b: 'WINNER:E3', nextCode: 'FINAL', nextSlot: 'B' });
    defaultMap.set('FINAL', { a: 'WINNER:SF1', b: 'WINNER:SF2' });
  } else if (n === 8 && eCount === 4 && sCount === 2) {
    defaultMap.set('E1', { a: 'RANK_1', b: 'RANK_8', nextCode: 'SF1', nextSlot: 'A' });
    defaultMap.set('E2', { a: 'RANK_4', b: 'RANK_5', nextCode: 'SF1', nextSlot: 'B' });
    defaultMap.set('E3', { a: 'RANK_2', b: 'RANK_7', nextCode: 'SF2', nextSlot: 'A' });
    defaultMap.set('E4', { a: 'RANK_3', b: 'RANK_6', nextCode: 'SF2', nextSlot: 'B' });
    defaultMap.set('SF1', { a: 'WINNER:E1', b: 'WINNER:E2', nextCode: 'FINAL', nextSlot: 'A' });
    defaultMap.set('SF2', { a: 'WINNER:E3', b: 'WINNER:E4', nextCode: 'FINAL', nextSlot: 'B' });
    defaultMap.set('FINAL', { a: 'WINNER:SF1', b: 'WINNER:SF2' });
  } else {
    // Generic fallback defaults for arbitrary (N, E, S)
    const directSeedsToSemis = Math.max(0, 2 * sCount - eCount);
    let nextRank = directSeedsToSemis + 1;
    for (let i = 1; i <= eCount; i++) {
      const code = `E${i}`;
      const rA = nextRank <= n ? `RANK_${nextRank++}` : '';
      const rB = nextRank <= n ? `RANK_${nextRank++}` : '';
      let nextCode: string | undefined;
      let nextSlot: 'A' | 'B' | undefined;
      if (sCount > 0) {
        const sfIdx = ((i - 1) % sCount) + 1;
        nextCode = `SF${sfIdx}`;
        nextSlot = i <= sCount ? 'B' : 'A';
      } else {
        nextCode = 'FINAL';
        nextSlot = i === 1 ? 'B' : 'A';
      }
      defaultMap.set(code, { a: rA, b: rB, nextCode, nextSlot });
    }
    let byeRank = 1;
    for (let j = 1; j <= sCount; j++) {
      const sfCode = `SF${j}`;
      const feeders: string[] = [];
      for (let i = 1; i <= eCount; i++) {
        const d = defaultMap.get(`E${i}`);
        if (d?.nextCode === sfCode) feeders.push(`WINNER:E${i}`);
      }
      const a = feeders.length >= 2 ? feeders[0] : byeRank <= directSeedsToSemis ? `RANK_${byeRank++}` : feeders[0] || '';
      const b = feeders.length >= 2 ? feeders[1] : feeders[0] && a !== feeders[0] ? feeders[0] : byeRank <= n ? `RANK_${byeRank++}` : '';
      defaultMap.set(sfCode, {
        a,
        b,
        nextCode: 'FINAL',
        nextSlot: j === 1 ? 'A' : 'B',
      });
    }
    defaultMap.set('FINAL', {
      a: sCount >= 1 ? 'WINNER:SF1' : eCount >= 1 ? 'RANK_1' : 'RANK_1',
      b: sCount >= 2 ? 'WINNER:SF2' : sCount === 1 ? 'RANK_1' : eCount >= 1 ? 'WINNER:E1' : 'RANK_2',
    });
  }

  const matches: CustomKnockoutMatchDraft[] = [];
  let courtCounter = 0;

  // 1. Eliminator Matches (E1 .. EeCount)
  for (let i = 1; i <= eCount; i++) {
    const code = `E${i}`;
    const prev = prevByCode.get(code);
    const def = defaultMap.get(code);
    const court = prev?.court || getCourt(courtCounter++);
    matches.push({
      id: prev?.id || crypto.randomUUID(),
      matchCode: code,
      stage: 'ELIM',
      playoffRound: 'ELIM',
      roundOrder: 2,
      slot: i,
      matchLabel: `Eliminator ${i}`,
      participantASource: prev ? prev.participantASource : def?.a || '',
      participantBSource: prev ? prev.participantBSource : def?.b || '',
      nextMatchCode: prev ? prev.nextMatchCode : def?.nextCode,
      nextMatchSlot: prev ? prev.nextMatchSlot : def?.nextSlot,
      court,
      courtName: prev?.courtName || getCourtName(court),
      scheduledDate: prev?.scheduledDate || params.tournamentDate || undefined,
      scheduledTime: prev?.scheduledTime,
      assignedUmpire: prev?.assignedUmpire,
    });
  }

  // 2. Semi Final Matches (SF1 .. SFsCount)
  for (let j = 1; j <= sCount; j++) {
    const code = `SF${j}`;
    const prev = prevByCode.get(code);
    const def = defaultMap.get(code);
    const court = prev?.court || getCourt(courtCounter++);
    matches.push({
      id: prev?.id || crypto.randomUUID(),
      matchCode: code,
      stage: 'SF',
      playoffRound: 'SF',
      roundOrder: 3,
      slot: j,
      matchLabel: `Semi Final ${j}`,
      participantASource: prev ? prev.participantASource : def?.a || '',
      participantBSource: prev ? prev.participantBSource : def?.b || '',
      nextMatchCode: prev ? prev.nextMatchCode : def?.nextCode || 'FINAL',
      nextMatchSlot: prev ? prev.nextMatchSlot : def?.nextSlot || (j === 1 ? 'A' : 'B'),
      court,
      courtName: prev?.courtName || getCourtName(court),
      scheduledDate: prev?.scheduledDate || params.tournamentDate || undefined,
      scheduledTime: prev?.scheduledTime,
      assignedUmpire: prev?.assignedUmpire,
    });
  }

  // 3. Grand Final Match (FINAL)
  const prevFinal = prevByCode.get('FINAL');
  const defFinal = defaultMap.get('FINAL');
  const finalCourt = prevFinal?.court || getCourt(0);
  matches.push({
    id: prevFinal?.id || crypto.randomUUID(),
    matchCode: 'FINAL',
    stage: 'F',
    playoffRound: 'F',
    roundOrder: 4,
    slot: 1,
    matchLabel: 'Grand Final',
    participantASource: prevFinal ? prevFinal.participantASource : defFinal?.a || (sCount >= 1 ? 'WINNER:SF1' : 'RANK_1'),
    participantBSource: prevFinal ? prevFinal.participantBSource : defFinal?.b || (sCount >= 2 ? 'WINNER:SF2' : 'RANK_2'),
    court: finalCourt,
    courtName: prevFinal?.courtName || getCourtName(finalCourt),
    scheduledDate: prevFinal?.scheduledDate || params.tournamentDate || undefined,
    scheduledTime: prevFinal?.scheduledTime,
    assignedUmpire: prevFinal?.assignedUmpire,
  });

  return {
    qualifyingTeamsCount: n,
    eliminatorsCount: eCount,
    semiFinalsCount: sCount,
    grandFinalCount: 1,
    matches,
    updatedAt: Date.now(),
  };
}

/**
 * Updates an upstream match's winner destination (`nextMatchCode` & `nextMatchSlot`)
 * AND automatically synchronizes the downstream match's `participantASource` / `participantBSource`
 * so the two representations never drift apart.
 */
export function setCustomMatchWinnerDestination(
  config: CustomKnockoutStageConfig,
  upstreamMatchCode: string,
  destinationToken: string // e.g. 'SF1:A', 'SF1:B', 'SF2:B', 'FINAL:A', or ''
): CustomKnockoutStageConfig {
  const code = upstreamMatchCode.trim().toUpperCase();
  const winnerToken = `WINNER:${code}`;
  let targetCode: string | undefined;
  let targetSlot: 'A' | 'B' | undefined;

  if (destinationToken && destinationToken.includes(':')) {
    const [tc, ts] = destinationToken.split(':');
    targetCode = tc.trim().toUpperCase();
    targetSlot = ts.trim().toUpperCase() === 'B' ? 'B' : 'A';
  }

  const nextMatches = config.matches.map((m) => {
    const mCode = m.matchCode.toUpperCase();
    if (mCode === code) {
      return {
        ...m,
        nextMatchCode: targetCode,
        nextMatchSlot: targetSlot,
      };
    }

    let nextA = m.participantASource;
    let nextB = m.participantBSource;

    // Clear previous references to `WINNER:${code}` if it was pointing elsewhere
    if (nextA.trim().toUpperCase() === winnerToken && (mCode !== targetCode || targetSlot !== 'A')) {
      nextA = '';
    }
    if (nextB.trim().toUpperCase() === winnerToken && (mCode !== targetCode || targetSlot !== 'B')) {
      nextB = '';
    }

    // Set the new reference on the target match slot
    if (mCode === targetCode) {
      if (targetSlot === 'A') nextA = winnerToken;
      else if (targetSlot === 'B') nextB = winnerToken;
    }

    return {
      ...m,
      participantASource: nextA,
      participantBSource: nextB,
    };
  });

  return {
    ...config,
    matches: nextMatches,
    updatedAt: Date.now(),
  };
}

/**
 * Updates a match's participant source (`A` or `B`) in `CustomKnockoutStageConfig`
 * and synchronizes upstream `nextMatchCode` / `nextMatchSlot` if `WINNER:` is selected or replaced.
 */
export function setCustomMatchParticipantSource(
  config: CustomKnockoutStageConfig,
  matchCode: string,
  slot: 'A' | 'B',
  newSource: string
): CustomKnockoutStageConfig {
  const targetCode = matchCode.trim().toUpperCase();
  const targetMatch = config.matches.find((m) => m.matchCode.toUpperCase() === targetCode);
  const oldSource = targetMatch
    ? (slot === 'A' ? targetMatch.participantASource : targetMatch.participantBSource).trim().toUpperCase()
    : '';
  const cleanNew = newSource.trim();
  const cleanNewUpper = cleanNew.toUpperCase();

  const nextMatches = config.matches.map((m) => {
    const mCode = m.matchCode.toUpperCase();
    let updated = { ...m };

    // If this match is the target match being edited
    if (mCode === targetCode) {
      if (slot === 'A') updated.participantASource = cleanNew;
      else updated.participantBSource = cleanNew;
    } else if (cleanNewUpper.startsWith('WINNER:')) {
      // Ensure the same WINNER: token isn't duplicated in another downstream match slot
      if (updated.participantASource.trim().toUpperCase() === cleanNewUpper) {
        updated.participantASource = '';
      }
      if (updated.participantBSource.trim().toUpperCase() === cleanNewUpper) {
        updated.participantBSource = '';
      }
    }

    // Synchronize upstream match's nextMatchCode / nextMatchSlot
    if (oldSource.startsWith('WINNER:') && oldSource !== cleanNewUpper) {
      const oldUpCode = oldSource.slice('WINNER:'.length).trim();
      if (mCode === oldUpCode && updated.nextMatchCode?.toUpperCase() === targetCode && updated.nextMatchSlot === slot) {
        updated.nextMatchCode = undefined;
        updated.nextMatchSlot = undefined;
      }
    }
    if (cleanNewUpper.startsWith('WINNER:')) {
      const newUpCode = cleanNewUpper.slice('WINNER:'.length).trim();
      if (mCode === newUpCode) {
        updated.nextMatchCode = targetCode;
        updated.nextMatchSlot = slot;
      }
    }

    return updated;
  });

  return {
    ...config,
    matches: nextMatches,
    updatedAt: Date.now(),
  };
}

export interface CustomKnockoutValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
  matchErrors: Record<string, string[]>;
  recommended: CustomRecommendedStructure;
  directQualifiers: { source: string; label: string; destinationLabel: string }[];
  unassignedSeeds: { rank: number; label: string }[];
}

/**
 * PHASE 5 – SMART BRACKET VALIDATION ENGINE (14-Point Structural & Mathematical Validator)
 */
export function validateCustomKnockoutStageConfig(params: {
  config: CustomKnockoutStageConfig;
  qualifiedSeeds?: PlayoffQualifiedSeed[];
  teams?: Team[];
  maxEligibleTeams?: number;
}): CustomKnockoutValidationResult {
  const { config, qualifiedSeeds = [], teams = [], maxEligibleTeams } = params;
  const n = Math.max(2, Number(config.qualifyingTeamsCount) || 2);
  const eCount = Math.max(0, Number(config.eliminatorsCount) || 0);
  const sCount = Math.max(0, Number(config.semiFinalsCount) || 0);
  const totalMatches = config.matches.length;
  const recommended = getRecommendedCustomCounts(n);

  const errors: string[] = [];
  const warnings: string[] = [];
  const matchErrors: Record<string, string[]> = {};
  const addMatchError = (code: string, msg: string) => {
    if (!matchErrors[code]) matchErrors[code] = [];
    if (!matchErrors[code].includes(msg)) matchErrors[code].push(msg);
    if (!errors.includes(msg)) errors.push(msg);
  };

  // 1. Validate qualified team count
  if (n < 2) {
    errors.push('At least 2 qualified teams are required to build a knockout stage.');
  }
  if (maxEligibleTeams !== undefined && maxEligibleTeams > 0 && n > maxEligibleTeams) {
    errors.push(
      `Qualified team count (${n}) exceeds the number of eligible active teams (${maxEligibleTeams}).`
    );
  }

  // 2. Validate Semi Final count terminology & single-elimination mathematics
  if (sCount > 2) {
    errors.push(
      `Invalid Semi Final count (${sCount}): A single-elimination bracket has at most 2 Semi Final matches producing the 2 Grand Finalists. Do not label Quarter-Finals or Preliminary matches as Semi Finals—configure ${recommended.eliminatorsCount} Eliminator(s) and 2 Semi Finals instead.`
    );
  } else if (n >= 4 && sCount === 1) {
    warnings.push(
      `Single Semi Final configured for ${n} teams: Conventional brackets use 2 Semi Finals, or require 1 Direct Grand Final Bye.`
    );
  } else if (n >= 4 && sCount === 0) {
    errors.push(
      `Invalid configuration: ${n} qualified teams with 0 Semi Finals cannot feed a single Grand Final without Semi Final rounds. Recommended: ${recommended.eliminatorsCount} Eliminator(s) and ${recommended.semiFinalsCount} Semi Finals.`
    );
  }

  // Check if Eliminator winners + direct qualifiers exceed Semi Final capacity
  const remainingAfterElims = n - eCount; // Each Eliminator eliminates 1 team
  const directByesCount = n - 2 * eCount;
  if (sCount === 2 && eCount + Math.max(0, directByesCount) !== 4) {
    if (eCount === 3 && n === 6) {
      errors.push(
        'Invalid configuration: 3 Eliminator matches with 6 qualified teams leaves only 3 Eliminator winners for 2 Semi Finals (4 slots required) with 0 byes. For 6 teams with no additional teams, use 2 Eliminators + 2 Semi Finals (Top 2 seeds receive Direct Semi-Final Byes).'
      );
    } else if (eCount >= 3 && directByesCount >= 3) {
      errors.push(
        'Invalid configuration: Three Eliminator winners and three direct qualifiers cannot all fit into two Semi Finals. Please adjust the progression.'
      );
    }
  }

  // Every match in single elimination eliminates 1 team -> N - 1 matches required
  const expectedTotalMatches = n - 1;
  if (totalMatches !== expectedTotalMatches) {
    errors.push(
      `Invalid match count: ${eCount} Eliminator(s) + ${sCount} Semi Final(s) + 1 Grand Final = ${totalMatches} matches, but ${n} qualified teams in single elimination require exactly ${expectedTotalMatches} matches (N − 1 = ${expectedTotalMatches}). Recommended: ${recommended.summary}.`
    );
  }

  const byCode = new Map<string, CustomKnockoutMatchDraft>();
  for (const m of config.matches) {
    byCode.set(m.matchCode.toUpperCase(), m);
  }

  const finalMatches = config.matches.filter((m) => m.stage === 'F' || m.matchCode.toUpperCase() === 'FINAL');
  if (finalMatches.length !== 1) {
    errors.push('Grand Final requires exactly one Championship Final match.');
  }

  // Track direct appearances of each seed/team and winner consumers
  const directSlotAppearances = new Map<string, string[]>(); // key: canonical teamId or RANK_k -> match labels
  const winnerConsumers = new Map<string, string[]>(); // key: upstream matchCode -> downstream match labels
  const directQualifiers: { source: string; label: string; destinationLabel: string }[] = [];

  const resolveCanonicalTeamKey = (src: string): { key: string; display: string; rank?: number } | null => {
    const clean = src.trim();
    const upper = clean.toUpperCase();
    if (upper.startsWith('RANK_')) {
      const r = parseInt(upper.replace('RANK_', ''), 10);
      const seedObj = qualifiedSeeds.find((s) => s.rank === r);
      const teamName = seedObj?.teamName || teams.find((t) => t.id === seedObj?.teamId)?.name;
      return {
        key: seedObj?.teamId ? `TEAM:${seedObj.teamId}` : `RANK_${r}`,
        display: teamName ? `Rank #${r} (${teamName})` : `Rank #${r}`,
        rank: r,
      };
    }
    if (upper.startsWith('TEAM:')) {
      const tid = clean.slice(5);
      const seedObj = qualifiedSeeds.find((s) => s.teamId === tid);
      const teamName = teams.find((t) => t.id === tid)?.name || seedObj?.teamName || tid;
      return {
        key: `TEAM:${tid}`,
        display: seedObj ? `Rank #${seedObj.rank} (${teamName})` : teamName,
        rank: seedObj?.rank,
      };
    }
    return null;
  };

  const assignedRanks = new Set<number>();

  for (const m of config.matches) {
    const code = m.matchCode.toUpperCase();
    const srcA = (m.participantASource || '').trim();
    const srcB = (m.participantBSource || '').trim();

    // 4. Each match must have two valid participant sources
    if (!srcA || !srcB) {
      if (code === 'FINAL') {
        addMatchError(code, 'Grand Final requires exactly two valid participant sources.');
      } else {
        addMatchError(
          code,
          `${m.matchLabel} (${code}) requires two valid participant sources (currently ${!srcA && !srcB ? 'both slots unassigned' : !srcA ? 'Slot A unassigned' : 'Slot B unassigned'}).`
        );
      }
    } else if (srcA.toUpperCase() === srcB.toUpperCase()) {
      addMatchError(code, `${m.matchLabel}: Participant A and Participant B cannot be the same source.`);
    }

    for (const [slotSide, rawSrc] of [
      ['Slot A', srcA],
      ['Slot B', srcB],
    ] as const) {
      if (!rawSrc) continue;
      const upper = rawSrc.toUpperCase();

      // 8. No eliminated team advances in custom single-elimination
      if (upper.startsWith('LOSER:') || upper.endsWith('_LOSER')) {
        addMatchError(
          code,
          `${m.matchLabel} (${slotSide}): Eliminated teams (${rawSrc}) cannot advance in a single-elimination bracket.`
        );
        continue;
      }

      if (upper.startsWith('WINNER:')) {
        const upCode = upper.slice('WINNER:'.length).trim();
        // 6. No match references itself
        if (upCode === code) {
          addMatchError(code, `${m.matchLabel} cannot reference its own winner.`);
          continue;
        }
        const upMatch = byCode.get(upCode);
        if (!upMatch) {
          addMatchError(code, `${m.matchLabel} (${slotSide}) references non-existent match "${upCode}".`);
          continue;
        }
        // 13. All scheduled matches depend only on earlier rounds
        if (upMatch.roundOrder >= m.roundOrder && !(upMatch.stage === 'ELIM' && m.stage === 'ELIM' && upMatch.slot < m.slot)) {
          addMatchError(
            code,
            `${m.matchLabel} cannot depend on ${upMatch.matchLabel} (${upCode}) from the same or later stage.`
          );
        }
        const list = winnerConsumers.get(upCode) || [];
        list.push(`${m.matchLabel} (${slotSide})`);
        winnerConsumers.set(upCode, list);
      } else {
        const resolved = resolveCanonicalTeamKey(rawSrc);
        if (resolved) {
          if (resolved.rank !== undefined) {
            if (resolved.rank < 1 || resolved.rank > n) {
              addMatchError(
                code,
                `${m.matchLabel} (${slotSide}): ${resolved.display} is outside the Top ${n} qualified team pool.`
              );
            } else {
              assignedRanks.add(resolved.rank);
            }
          }
          const list = directSlotAppearances.get(resolved.key) || [];
          list.push(`${m.matchLabel} (${slotSide})`);
          directSlotAppearances.set(resolved.key, list);

          if (m.stage === 'SF' || m.stage === 'F') {
            directQualifiers.push({
              source: rawSrc,
              label: resolved.display,
              destinationLabel: `${m.matchLabel} (${slotSide})`,
            });
          }
        }
      }
    }
  }

  // 3. No team enters multiple independent opening bracket paths
  for (const [key, appearances] of directSlotAppearances.entries()) {
    if (appearances.length > 1) {
      const sampleLabel =
        key.startsWith('TEAM:')
          ? teams.find((t) => t.id === key.slice(5))?.name || key.slice(5)
          : key.replace('RANK_', 'Rank #');
      errors.push(
        `The selected team is already assigned to another opening match: ${sampleLabel} is placed in ${appearances.join(' and ')}.`
      );
    }
  }

  // Check if any qualified seed (Rank #1 .. #N) is omitted
  const unassignedSeeds: { rank: number; label: string }[] = [];
  for (let r = 1; r <= n; r++) {
    const seedObj = qualifiedSeeds.find((s) => s.rank === r);
    const seedTeamKey = seedObj?.teamId ? `TEAM:${seedObj.teamId}` : `RANK_${r}`;
    const isAssigned =
      assignedRanks.has(r) ||
      directSlotAppearances.has(seedTeamKey) ||
      directSlotAppearances.has(`RANK_${r}`);
    if (!isAssigned) {
      const label = seedObj?.teamName ? `Rank #${r} (${seedObj.teamName})` : `Rank #${r}`;
      unassignedSeeds.push({ rank: r, label });
    }
  }
  if (unassignedSeeds.length > 0) {
    errors.push(
      `Unassigned qualified team(s): ${unassignedSeeds.map((u) => u.label).join(', ')} must be assigned to an Eliminator or Direct Bye slot.`
    );
  }

  // Check if three Eliminator winners + three direct qualifiers are trying to fit into two Semi Finals
  if (sCount === 2 && eCount >= 3 && directQualifiers.filter((d) => d.destinationLabel.startsWith('Semi Final')).length >= 3) {
    const msg =
      'Invalid configuration: Three Eliminator winners and three direct qualifiers cannot all fit into two Semi Finals. Please adjust the progression.';
    if (!errors.includes(msg)) errors.unshift(msg);
  }

  // 5 & 11. Every Eliminator and Semi Final winner advances to a valid downstream match (no unassigned winner, no duplicate winner consumption)
  for (const m of config.matches) {
    const code = m.matchCode.toUpperCase();
    if (code === 'FINAL' || m.stage === 'F') continue;
    const consumers = winnerConsumers.get(code) || [];
    if (consumers.length === 0) {
      addMatchError(
        code,
        `Unassigned winner destination: Winner of ${m.matchLabel} (${code}) is not assigned to any Semi Final or Grand Final slot.`
      );
    } else if (consumers.length > 1) {
      addMatchError(
        code,
        `Duplicate winner progression: Winner of ${m.matchLabel} (${code}) cannot advance to multiple slots (${consumers.join(', ')}).`
      );
    }
  }

  // 7 & 9. Cycle detection and verification that every match path reaches GRAND FINAL
  const findDownstreamCodes = (startCode: string): string[] => {
    const out: string[] = [];
    for (const m of config.matches) {
      const c = m.matchCode.toUpperCase();
      const sA = (m.participantASource || '').trim().toUpperCase();
      const sB = (m.participantBSource || '').trim().toUpperCase();
      if (sA === `WINNER:${startCode}` || sB === `WINNER:${startCode}`) {
        out.push(c);
      }
    }
    return out;
  };

  for (const m of config.matches) {
    const startCode = m.matchCode.toUpperCase();
    if (startCode === 'FINAL') continue;
    const visited = new Set<string>();
    const queue = [startCode];
    let reachesFinal = false;
    let hasCycle = false;

    while (queue.length > 0) {
      const curr = queue.shift()!;
      if (curr === 'FINAL') {
        reachesFinal = true;
        break;
      }
      if (visited.has(curr)) {
        hasCycle = true;
        break;
      }
      visited.add(curr);
      const nexts = findDownstreamCodes(curr);
      for (const nx of nexts) {
        if (nx === startCode) {
          hasCycle = true;
          break;
        }
        queue.push(nx);
      }
    }

    if (hasCycle) {
      addMatchError(startCode, `Circular progression detected involving ${m.matchLabel} (${startCode}).`);
    } else if (!reachesFinal && (winnerConsumers.get(startCode)?.length || 0) > 0) {
      addMatchError(
        startCode,
        `Progression path from ${m.matchLabel} (${startCode}) does not reach the Grand Final.`
      );
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    matchErrors,
    recommended,
    directQualifiers,
    unassignedSeeds,
  };
}

/**
 * Converts a validated CustomKnockoutStageConfig into live KnockoutMatch[] fixtures,
 * preserving any already-completed or live match records when updating drafts.
 */
export function materializeCustomKnockoutMatches(params: {
  config: CustomKnockoutStageConfig;
  qualifiedTeamIds: string[];
  qualifiedSeeds?: PlayoffQualifiedSeed[];
  existingMatches?: KnockoutMatch[];
  courtsCount?: number;
  courtNames?: string[];
  tournamentDate?: string;
  bracketId?: string;
}): KnockoutMatch[] {
  const {
    config,
    qualifiedTeamIds,
    qualifiedSeeds = [],
    existingMatches = [],
    courtsCount = 2,
    courtNames,
    tournamentDate,
    bracketId = crypto.randomUUID(),
  } = params;

  const safeCourts = Math.max(1, Number(courtsCount) || 2);
  const getCourt = (idx: number) => (idx % safeCourts) + 1;
  const getCourtName = (c: number) => courtNames?.[c - 1]?.trim() || `Court ${c}`;
  const existingByCode = new Map<string, KnockoutMatch>();
  for (const em of existingMatches) {
    if (em.matchCode) existingByCode.set(em.matchCode.toUpperCase(), em);
  }

  const resolveDirectTeam = (src?: string): { teamId?: string; seed?: number } => {
    if (!src) return {};
    const clean = src.trim();
    const upper = clean.toUpperCase();
    if (upper.startsWith('RANK_')) {
      const rank = parseInt(upper.replace('RANK_', ''), 10);
      const seedEntry = qualifiedSeeds.find((q) => q.rank === rank);
      const teamId = seedEntry?.teamId || qualifiedTeamIds[rank - 1];
      return { teamId, seed: rank };
    }
    if (upper.startsWith('TEAM:')) {
      const teamId = clean.slice(5);
      const seedEntry = qualifiedSeeds.find((q) => q.teamId === teamId);
      const idx = qualifiedTeamIds.indexOf(teamId);
      return { teamId, seed: seedEntry?.rank || (idx !== -1 ? idx + 1 : undefined) };
    }
    return {};
  };

  const rawMatches: KnockoutMatch[] = config.matches.map((draft, idx) => {
    const code = draft.matchCode.toUpperCase();
    const prev = existingByCode.get(code);
    const court = draft.court || prev?.court || getCourt(idx);
    const courtName = draft.courtName || prev?.courtName || getCourtName(court);
    const resA = resolveDirectTeam(draft.participantASource);
    const resB = resolveDirectTeam(draft.participantBSource);

    // Preserve completed/live state if the match already completed/started with the same participants
    const canPreserveState =
      prev &&
      (prev.status === 'completed' || prev.status === 'live' || prev.status === 'paused') &&
      (!resA.teamId || prev.teamA === resA.teamId) &&
      (!resB.teamId || prev.teamB === resB.teamId);

    return {
      id: prev?.id || draft.id || crypto.randomUUID(),
      bracketId: prev?.bracketId || bracketId,
      matchCode: code,
      stage: draft.stage,
      playoffRound: draft.playoffRound,
      roundOrder: draft.roundOrder,
      matchLabel: draft.matchLabel,
      slot: draft.slot,
      court,
      courtName,
      scheduledDate: draft.scheduledDate || prev?.scheduledDate || tournamentDate || undefined,
      scheduledTime: draft.scheduledTime || prev?.scheduledTime,
      assignedUmpire: draft.assignedUmpire || prev?.assignedUmpire,
      time: [draft.matchLabel, courtName, draft.scheduledTime || prev?.scheduledTime].filter(Boolean).join(' · '),
      participantASource: draft.participantASource,
      participantBSource: draft.participantBSource,
      seedA: resA.seed,
      seedB: resB.seed,
      nextMatchCode: draft.nextMatchCode,
      nextMatchSlot: draft.nextMatchSlot,
      teamA: canPreserveState ? prev.teamA : resA.teamId,
      teamB: canPreserveState ? prev.teamB : resB.teamId,
      scoreA: canPreserveState ? prev.scoreA : undefined,
      scoreB: canPreserveState ? prev.scoreB : undefined,
      sets: canPreserveState ? prev.sets : undefined,
      winner: canPreserveState ? prev.winner : undefined,
      loserId: canPreserveState ? prev.loserId : undefined,
      completedAt: canPreserveState ? prev.completedAt : undefined,
      status: canPreserveState ? prev.status : 'upcoming',
      isPlayoff: true,
      manual: Boolean(
        draft.participantASource?.startsWith('TEAM:') || draft.participantBSource?.startsWith('TEAM:')
      ),
      version: (prev?.version || 0) + 1,
    };
  });

  const seedsToUse: PlayoffQualifiedSeed[] =
    qualifiedSeeds.length > 0
      ? qualifiedSeeds
      : qualifiedTeamIds.map((tid, i) => ({
          rank: i + 1,
          teamId: tid,
          teamName: tid,
          playerNames: [],
          points: 0,
          won: 0,
          lost: 0,
          played: 0,
          pointDiff: 0,
          setDiff: 0,
          matchWinDiff: 0,
          status: 'qualified',
        }));

  return progressKnockoutBracket(rawMatches, 'custom', seedsToUse).matches;
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
          message: `Court conflict: ${getPlayoffMatchDisplayLabel(m).title} shares ${courtLabel} at ${m.scheduledTime} with another knockout match.`,
        });
      }
    }
  }

  // 2. Prerequisite date/time ordering validation across all upstream/downstream dependencies
  const toTimestamp = (m?: KnockoutMatch): number | null => {
    if (!m?.scheduledTime) return null;
    const datePart = m.scheduledDate || '2026-01-01';
    const timePart = m.scheduledTime.trim();
    const parsed = Date.parse(`${datePart}T${timePart}`);
    return Number.isNaN(parsed) ? null : parsed;
  };

  const canonical = ensureCanonicalMatchMetadata(matches);
  for (const m of canonical) {
    const mTs = toTimestamp(m);
    if (mTs === null) continue;
    const { allDownstream } = findDownstreamDependentMatches(m.id, canonical);
    for (const down of allDownstream) {
      const downTs = toTimestamp(down);
      if (downTs !== null && downTs <= mTs) {
        warnings.push({
          matchId: down.id,
          type: 'dependency_schedule_conflict',
          message: `${getPlayoffMatchDisplayLabel(down).title} must be scheduled after ${getPlayoffMatchDisplayLabel(m).title} completes.`,
        });
      }
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

