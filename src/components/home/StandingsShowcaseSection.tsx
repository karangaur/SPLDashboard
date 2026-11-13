import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowDown,
  ArrowRight,
  ArrowUp,
  Award,
  CheckCircle2,
  ChevronDown,
  Copy,
  Crown,
  Medal,
  Shield,
  Trophy,
  XCircle,
} from 'lucide-react';
import {
  KnockoutData,
  KnockoutMatch,
  Match,
  Player,
  StandingsRecord,
  Team,
} from '../../types/tournament';

export interface StandingsShowcaseSectionProps {
  standings: StandingsRecord[];
  teams: Team[];
  players: Player[];
  matches: Match[];
  knockout?: KnockoutData;
  copiedStandings: boolean;
  onCopyStandings: () => void;
  onSelectTeam?: (teamId: string) => void;
}

type InspectSortKey = 'official' | 'won' | 'diff' | 'pointsFor';

type OfficialTeamStatus =
  | 'CHAMPION'
  | 'QUALIFIED'
  | 'LEAGUE LEADER'
  | 'IN QUALIFICATION ZONE'
  | 'ELIMINATED'
  | null;

interface EnrichedStandingRow {
  record: StandingsRecord;
  officialRank: number;
  status: OfficialTeamStatus;
  inQualificationCut: boolean;
  playerNames: string;
  winPct: number | null;
}

const STANDINGS_AMBIENT_PARTICLES = [
  { left: '8%', top: '16%', size: 'w-1 h-1', color: 'bg-amber-300' },
  { left: '24%', top: '10%', size: 'w-1.5 h-1.5', color: 'bg-yellow-200' },
  { left: '52%', top: '12%', size: 'w-1 h-1', color: 'bg-amber-400' },
  { left: '76%', top: '14%', size: 'w-1.5 h-1.5', color: 'bg-purple-300' },
  { left: '91%', top: '20%', size: 'w-1 h-1', color: 'bg-amber-200' },
];

function getKnockoutWinnerId(ko: KnockoutMatch): string | undefined {
  if (ko.status !== 'completed') return undefined;
  if (ko.winner) return ko.winner;
  if (ko.scoreA != null && ko.scoreB != null && ko.scoreA !== ko.scoreB) {
    return ko.scoreA > ko.scoreB ? ko.teamA : ko.teamB;
  }
  return undefined;
}

function getQualificationCut(format?: KnockoutData['format']): number {
  if (format === 'top8') return 8;
  if (format === 'top2') return 2;
  return 4;
}

function getStatusDisplay(status: OfficialTeamStatus): {
  label: string;
  textClass: string;
  dotClass: string;
  icon: React.ReactNode;
} | null {
  switch (status) {
    case 'CHAMPION':
      return {
        label: 'CHAMPION',
        textClass: 'text-amber-300',
        dotClass: 'bg-amber-400',
        icon: <Crown className="w-3 h-3 text-amber-300 shrink-0" />,
      };
    case 'QUALIFIED':
      return {
        label: 'QUALIFIED',
        textClass: 'text-emerald-300',
        dotClass: 'bg-emerald-400',
        icon: <CheckCircle2 className="w-3 h-3 text-emerald-400 shrink-0" />,
      };
    case 'LEAGUE LEADER':
      return {
        label: 'LEAGUE LEADER',
        textClass: 'text-amber-300',
        dotClass: 'bg-amber-400',
        icon: <Trophy className="w-3 h-3 text-amber-300 shrink-0" />,
      };
    case 'IN QUALIFICATION ZONE':
      return {
        label: 'IN QUALIFICATION ZONE',
        textClass: 'text-emerald-300/90',
        dotClass: 'bg-emerald-400/80',
        icon: <Shield className="w-3 h-3 text-emerald-400/90 shrink-0" />,
      };
    case 'ELIMINATED':
      return {
        label: 'ELIMINATED',
        textClass: 'text-slate-400',
        dotClass: 'bg-slate-600',
        icon: <XCircle className="w-3 h-3 text-red-400/75 shrink-0" />,
      };
    default:
      return null;
  }
}

interface PodiumCardProps {
  entry: EnrichedStandingRow;
  podiumSlot: 1 | 2 | 3;
  hasSingleEntry: boolean;
  hasTwoEntries: boolean;
  isUpdated: boolean;
  onSelectTeam?: (teamId: string) => void;
}

const PodiumCard: React.FC<PodiumCardProps> = React.memo(
  ({ entry, podiumSlot, hasSingleEntry, hasTwoEntries, isUpdated, onSelectTeam }) => {
    const { record, status, playerNames, winPct } = entry;
    const isChampion = status === 'CHAMPION';
    const isLeader = podiumSlot === 1;
    const isSilver = podiumSlot === 2;

    const podiumLabel = isChampion
      ? 'CHAMPION'
      : isLeader
      ? 'LEAGUE LEADER'
      : isSilver
      ? '2ND PLACE'
      : '3RD PLACE';

    const desktopOrderClass = hasSingleEntry
      ? 'md:max-w-md md:mx-auto'
      : hasTwoEntries
      ? podiumSlot === 1
        ? 'md:order-1'
        : 'md:order-2'
      : podiumSlot === 1
      ? 'min-[480px]:col-span-2 md:col-span-1 md:order-2 md:-translate-y-2.5'
      : podiumSlot === 2
      ? 'md:order-1'
      : 'md:order-3';

    const containerThemeClass = isLeader
      ? 'bg-gradient-to-b from-[#1a1407] via-[#0d101b] to-[#070911] border-amber-400/65 shadow-[0_24px_60px_-18px_rgba(245,158,11,0.34)]'
      : isSilver
      ? 'bg-gradient-to-b from-[#131824] via-[#0b0e18] to-[#070911] border-slate-300/45 shadow-[0_20px_48px_-18px_rgba(148,163,184,0.22)]'
      : 'bg-gradient-to-b from-[#18100a] via-[#0b0e18] to-[#070911] border-orange-500/45 shadow-[0_20px_48px_-18px_rgba(234,88,12,0.22)]';

    const accentStripClass = isLeader
      ? 'from-amber-200 via-amber-400 to-yellow-300'
      : isSilver
      ? 'from-slate-100 via-slate-300 to-slate-400'
      : 'from-amber-600 via-orange-400 to-amber-500';

    const crestThemeClass = isLeader
      ? 'from-amber-300 via-amber-400 to-orange-500 text-slate-950 ring-amber-200/50'
      : isSilver
      ? 'from-slate-200 via-slate-300 to-slate-500 text-slate-950 ring-slate-200/40'
      : 'from-orange-400 via-amber-600 to-amber-800 text-white ring-orange-300/40';

    const delayClass = isLeader
      ? 'spl-podium-delay-1'
      : isSilver
      ? 'spl-podium-delay-2'
      : 'spl-podium-delay-3';

    const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
      if (!onSelectTeam) return;
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        onSelectTeam(record.team.id);
      }
    };

    return (
      <div className={`spl-podium-enter ${delayClass} ${desktopOrderClass} h-full`}>
        <div
          role={onSelectTeam ? 'button' : undefined}
          tabIndex={onSelectTeam ? 0 : undefined}
          onClick={() => onSelectTeam?.(record.team.id)}
          onKeyDown={handleKeyDown}
          aria-label={`Rank ${podiumSlot}: ${record.team.name}, ${record.won} wins, ${record.points} points`}
          className={`group relative h-full flex flex-col justify-between rounded-2xl border overflow-hidden transition-transform duration-200 hover:-translate-y-1 ${containerThemeClass} ${
            onSelectTeam ? 'cursor-pointer focus-visible:outline-2 focus-visible:outline-amber-400' : ''
          }`}
        >
          {/* Metallic Top Trim */}
          <div aria-hidden="true" className={`h-[3px] w-full bg-gradient-to-r ${accentStripClass}`} />

          {/* Subtle Radial Crown Lighting */}
          <div
            aria-hidden="true"
            className={`pointer-events-none absolute -top-12 left-1/2 -translate-x-1/2 w-52 h-28 rounded-full blur-2xl opacity-60 group-hover:opacity-90 transition-opacity ${
              isLeader ? 'bg-amber-400/25' : isSilver ? 'bg-slate-300/15' : 'bg-orange-500/15'
            }`}
          />

          <div className={`relative z-10 flex-1 flex flex-col justify-between ${isLeader ? 'p-5 sm:p-6' : 'p-4 sm:p-5'} space-y-4`}>
            {/* Top Rank Header */}
            <div className="flex items-center justify-between gap-2 pb-3 border-b border-white/10">
              <div className="flex items-center gap-2 min-w-0">
                {isLeader ? (
                  <Crown className="w-4 h-4 text-amber-300 shrink-0" />
                ) : isSilver ? (
                  <Medal className="w-4 h-4 text-slate-300 shrink-0" />
                ) : (
                  <Award className="w-4 h-4 text-orange-400 shrink-0" />
                )}
                <span
                  className={`text-[11px] font-display font-black uppercase tracking-[0.18em] truncate ${
                    isLeader ? 'text-amber-300' : isSilver ? 'text-slate-200' : 'text-orange-300'
                  }`}
                >
                  {podiumLabel}
                </span>
              </div>

              <span
                className={`font-mono text-xs font-black tabular-nums shrink-0 ${
                  isLeader ? 'text-amber-300' : isSilver ? 'text-slate-300' : 'text-orange-300'
                }`}
              >
                #{String(podiumSlot).padStart(2, '0')}
              </span>
            </div>

            {/* Team Identity */}
            <div className="flex items-center gap-3.5">
              <div className="relative shrink-0">
                <div
                  className={`w-14 h-14 ${isLeader ? 'sm:w-16 sm:h-16 text-2xl sm:text-3xl' : 'text-2xl'} rounded-2xl flex items-center justify-center shadow-lg ring-1 bg-gradient-to-br transition-transform duration-200 group-hover:scale-105 ${crestThemeClass}`}
                >
                  <span role="img" aria-hidden="true">
                    {record.team.badge || '🏸'}
                  </span>
                </div>
              </div>

              <div className="min-w-0 flex-1">
                <h3
                  title={record.team.name}
                  className={`font-display font-black leading-tight tracking-tight truncate ${
                    isLeader ? 'text-lg sm:text-xl text-white' : 'text-base sm:text-lg text-white'
                  } group-hover:text-amber-200 transition-colors`}
                >
                  {record.team.name}
                </h3>
                <p className="text-xs text-slate-400 truncate mt-0.5">
                  {playerNames || 'Official Championship Squad'}
                </p>
                {status && status !== 'LEAGUE LEADER' && (
                  <p
                    className={`mt-1 text-[10px] font-display font-extrabold uppercase tracking-[0.16em] ${
                      status === 'CHAMPION'
                        ? 'text-amber-300'
                        : status === 'ELIMINATED'
                        ? 'text-slate-400'
                        : 'text-emerald-300'
                    }`}
                  >
                    {status}
                  </p>
                )}
              </div>
            </div>

            {/* Podium Metrics Footer */}
            <div className="grid grid-cols-3 gap-2 pt-3 border-t border-white/10 text-center">
              <div className="py-1.5 px-1 rounded-xl bg-white/[0.03]">
                <span className="block text-[9px] font-display font-bold uppercase tracking-wider text-slate-400">
                  Wins
                </span>
                <span
                  key={isUpdated ? `w-${record.won}` : undefined}
                  className={`text-base sm:text-lg font-mono font-black text-emerald-400 tabular-nums ${
                    isUpdated ? 'spl-stat-flash' : ''
                  }`}
                >
                  {record.won}
                </span>
              </div>

              <div className="py-1.5 px-1 rounded-xl bg-white/[0.03]">
                <span className="block text-[9px] font-display font-bold uppercase tracking-wider text-slate-400">
                  Point Diff
                </span>
                <span
                  key={isUpdated ? `d-${record.diff}` : undefined}
                  className={`text-base sm:text-lg font-mono font-black tabular-nums ${
                    record.diff > 0
                      ? 'text-slate-100'
                      : record.diff < 0
                      ? 'text-red-300'
                      : 'text-slate-400'
                  } ${isUpdated ? 'spl-stat-flash' : ''}`}
                >
                  {record.diff > 0 ? `+${record.diff}` : record.diff}
                </span>
              </div>

              <div className="py-1.5 px-1 rounded-xl bg-white/[0.04]">
                <span className="block text-[9px] font-display font-bold uppercase tracking-wider text-slate-400">
                  Points
                </span>
                <span
                  key={isUpdated ? `pts-${record.points}` : undefined}
                  className={`text-base sm:text-lg font-mono font-black tabular-nums ${
                    isLeader ? 'text-amber-300' : isSilver ? 'text-slate-100' : 'text-orange-300'
                  } ${isUpdated ? 'spl-stat-flash' : ''}`}
                >
                  {record.points}
                </span>
              </div>
            </div>

            {/* Quiet Meta Row */}
            <div className="flex items-center justify-between text-[11px] font-mono text-slate-400">
              <span className="tabular-nums">
                {record.played}P · {record.won}W · {record.lost}L
                {winPct !== null ? ` · ${winPct}%` : ''}
              </span>
              {onSelectTeam && (
                <span className="inline-flex items-center gap-1 font-sans text-[11px] font-semibold text-slate-400 group-hover:text-amber-300 transition-colors">
                  <span>Details</span>
                  <ArrowRight className="w-3 h-3 transition-transform group-hover:translate-x-0.5" />
                </span>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }
);

export const StandingsShowcaseSection: React.FC<StandingsShowcaseSectionProps> = React.memo(
  ({
    standings,
    teams,
    players,
    matches,
    knockout,
    copiedStandings,
    onCopyStandings,
    onSelectTeam,
  }) => {
    const [inspectSort, setInspectSort] = useState<InspectSortKey>('official');
    const [expandedMobileIds, setExpandedMobileIds] = useState<Record<string, boolean>>({});
    const [rankMovements, setRankMovements] = useState<Record<string, number>>({});
    const [updatedTeamIds, setUpdatedTeamIds] = useState<Record<string, boolean>>({});

    // Track previous hydrated official rankings & stats without interpreting initial page load as movement
    const previousSnapshotRef = useRef<
      Map<string, { rank: number; played: number; won: number; points: number; diff: number; pointsFor: number }>
    >(new Map());
    const hasHydratedStandingsRef = useRef(false);
    const movementTimerRef = useRef<number | null>(null);

    const playerNameMap = useMemo(() => {
      const map = new Map<string, string>();
      for (const p of players) {
        map.set(p.id, p.name);
      }
      return map;
    }, [players]);

    const teamMap = useMemo(() => {
      const map = new Map<string, Team>();
      for (const t of teams) {
        map.set(t.id, t);
      }
      return map;
    }, [teams]);

    const qualificationCut = useMemo(
      () => getQualificationCut(knockout?.format),
      [knockout?.format]
    );

    const hasAnyPlayedMatch = useMemo(
      () => standings.some((r) => r.played > 0),
      [standings]
    );

    // Authoritative championship & qualification context derived solely from existing Supabase-synced state
    const tournamentQualificationContext = useMemo(() => {
      const koMatches = knockout?.matches || [];
      const finalMatch = koMatches.find((m) => m.stage === 'F');
      const championId = finalMatch ? getKnockoutWinnerId(finalMatch) : undefined;
      const hasSeededKnockout = koMatches.some((m) => Boolean(m.teamA || m.teamB));
      const allLeagueCompleted =
        matches.length > 0 && matches.every((m) => m.status === 'completed');

      const koByTeam = new Map<string, KnockoutMatch[]>();
      for (const ko of koMatches) {
        if (ko.teamA) {
          const list = koByTeam.get(ko.teamA) || [];
          list.push(ko);
          koByTeam.set(ko.teamA, list);
        }
        if (ko.teamB) {
          const list = koByTeam.get(ko.teamB) || [];
          list.push(ko);
          koByTeam.set(ko.teamB, list);
        }
      }

      return {
        championId,
        hasSeededKnockout,
        allLeagueCompleted,
        koByTeam,
      };
    }, [knockout?.matches, matches]);

    // Build enriched rows strictly preserving official standings ranking order & tiebreaks
    const officialEnrichedRows = useMemo<EnrichedStandingRow[]>(() => {
      const { championId, hasSeededKnockout, allLeagueCompleted, koByTeam } =
        tournamentQualificationContext;
      const seen = new Set<string>();
      const rows: EnrichedStandingRow[] = [];

      standings.forEach((record) => {
        if (!record?.team?.id || seen.has(record.team.id)) return;
        seen.add(record.team.id);

        const officialRank = rows.length + 1;
        const inQualificationCut = officialRank <= qualificationCut;

        // Authoritative status determination
        let status: OfficialTeamStatus = null;
        if (championId && record.team.id === championId) {
          status = 'CHAMPION';
        } else if (hasSeededKnockout) {
          const teamKoMatches = koByTeam.get(record.team.id) || [];
          if (teamKoMatches.length === 0) {
            status = 'ELIMINATED';
          } else {
            const hasActiveKo = teamKoMatches.some(
              (m) => m.status === 'upcoming' || m.status === 'live' || m.status === 'paused'
            );
            if (hasActiveKo) {
              status = 'QUALIFIED';
            } else {
              const lostKo = teamKoMatches.some((m) => {
                const w = getKnockoutWinnerId(m);
                return Boolean(w && w !== record.team.id);
              });
              status = lostKo ? 'ELIMINATED' : 'QUALIFIED';
            }
          }
        } else if (allLeagueCompleted && hasAnyPlayedMatch) {
          status = inQualificationCut ? 'QUALIFIED' : 'ELIMINATED';
        } else if (hasAnyPlayedMatch) {
          if (officialRank === 1) {
            status = 'LEAGUE LEADER';
          } else if (inQualificationCut) {
            status = 'IN QUALIFICATION ZONE';
          }
        }

        const teamObj = teamMap.get(record.team.id) || record.team;
        const playerNames = (teamObj.players || [])
          .map((pid) => playerNameMap.get(pid))
          .filter((name): name is string => Boolean(name))
          .join(' & ');

        const winPct =
          record.played > 0 ? Math.round((record.won / record.played) * 100) : null;

        rows.push({
          record,
          officialRank,
          status,
          inQualificationCut,
          playerNames,
          winPct,
        });
      });

      return rows;
    }, [
      standings,
      qualificationCut,
      tournamentQualificationContext,
      hasAnyPlayedMatch,
      teamMap,
      playerNameMap,
    ]);

    // Detect real-time rank changes and stat updates after initial hydration
    useEffect(() => {
      if (officialEnrichedRows.length === 0) {
        return;
      }

      const nextSnapshot = new Map<
        string,
        { rank: number; played: number; won: number; points: number; diff: number; pointsFor: number }
      >();
      officialEnrichedRows.forEach((row) => {
        nextSnapshot.set(row.record.team.id, {
          rank: row.officialRank,
          played: row.record.played,
          won: row.record.won,
          points: row.record.points,
          diff: row.record.diff,
          pointsFor: row.record.pointsFor,
        });
      });

      if (!hasHydratedStandingsRef.current) {
        previousSnapshotRef.current = nextSnapshot;
        hasHydratedStandingsRef.current = true;
        return;
      }

      const prev = previousSnapshotRef.current;
      const nextMovements: Record<string, number> = {};
      const nextUpdated: Record<string, boolean> = {};
      let hasMeaningfulChange = false;

      officialEnrichedRows.forEach((row) => {
        const oldEntry = prev.get(row.record.team.id);
        if (!oldEntry) return;

        const statsChanged =
          oldEntry.played !== row.record.played ||
          oldEntry.won !== row.record.won ||
          oldEntry.points !== row.record.points ||
          oldEntry.diff !== row.record.diff ||
          oldEntry.pointsFor !== row.record.pointsFor;

        if (statsChanged) {
          nextUpdated[row.record.team.id] = true;
          hasMeaningfulChange = true;
        }

        if (oldEntry.rank !== row.officialRank && (row.record.played > 0 || oldEntry.played > 0)) {
          nextMovements[row.record.team.id] = oldEntry.rank - row.officialRank;
          hasMeaningfulChange = true;
        }
      });

      previousSnapshotRef.current = nextSnapshot;

      if (hasMeaningfulChange) {
        if (Object.keys(nextMovements).length > 0) {
          setRankMovements(nextMovements);
        }
        if (Object.keys(nextUpdated).length > 0) {
          setUpdatedTeamIds(nextUpdated);
        }

        if (movementTimerRef.current !== null) {
          window.clearTimeout(movementTimerRef.current);
        }
        movementTimerRef.current = window.setTimeout(() => {
          setRankMovements({});
          setUpdatedTeamIds({});
          movementTimerRef.current = null;
        }, 7000);
      }
    }, [officialEnrichedRows]);

    useEffect(() => {
      return () => {
        if (movementTimerRef.current !== null) {
          window.clearTimeout(movementTimerRef.current);
        }
      };
    }, []);

    // Inspection-sorted view (NEVER mutates officialRank or official qualification order)
    const displayedRows = useMemo(() => {
      if (inspectSort === 'official') return officialEnrichedRows;
      return [...officialEnrichedRows].sort((a, b) => {
        if (inspectSort === 'won') {
          if (b.record.won !== a.record.won) return b.record.won - a.record.won;
        } else if (inspectSort === 'diff') {
          if (b.record.diff !== a.record.diff) return b.record.diff - a.record.diff;
        } else if (inspectSort === 'pointsFor') {
          if (b.record.pointsFor !== a.record.pointsFor) {
            return b.record.pointsFor - a.record.pointsFor;
          }
        }
        return a.officialRank - b.officialRank;
      });
    }, [officialEnrichedRows, inspectSort]);

    const topThreeEntries = useMemo(() => {
      if (!hasAnyPlayedMatch) return [];
      return officialEnrichedRows.slice(0, 3);
    }, [officialEnrichedRows, hasAnyPlayedMatch]);

    const toggleMobileExpand = useCallback((teamId: string) => {
      setExpandedMobileIds((prev) => ({
        ...prev,
        [teamId]: !prev[teamId],
      }));
    }, []);

    const showQualificationCutoffDivider =
      inspectSort === 'official' &&
      officialEnrichedRows.length > qualificationCut &&
      qualificationCut > 0;

    return (
      <section
        id="standings-table"
        className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 scroll-mt-24"
      >
        <div className="relative rounded-3xl border border-amber-400/20 bg-gradient-to-b from-[#0a0d18] via-[#060811] to-[#04050b] p-4 sm:p-7 lg:p-9 shadow-[0_28px_80px_-24px_rgba(0,0,0,0.95)] overflow-hidden">
          {/* Top Metallic Gold Accent Hairline */}
          <div
            aria-hidden="true"
            className="absolute inset-x-0 top-0 h-[2px] bg-gradient-to-r from-transparent via-amber-400/80 to-transparent"
          />

          {/* Soft Stadium Spotlights & Subtle Court Pattern */}
          <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
            <div className="absolute -top-24 left-1/4 w-[460px] h-[220px] rounded-full bg-amber-500/10 blur-3xl" />
            <div className="absolute -top-20 right-1/5 w-[380px] h-[220px] rounded-full bg-purple-600/10 blur-3xl" />
            <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-[560px] h-[180px] rounded-full bg-red-600/8 blur-3xl" />

            {/* Subtle Badminton Court Line Geometry */}
            <svg
              className="absolute right-4 top-6 w-56 h-56 opacity-[0.045] text-amber-200 hidden md:block"
              viewBox="0 0 200 200"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.2"
            >
              <rect x="16" y="16" width="168" height="168" />
              <rect x="30" y="16" width="140" height="168" />
              <line x1="100" y1="16" x2="100" y2="184" strokeDasharray="5 5" />
              <line x1="16" y1="68" x2="184" y2="68" />
              <line x1="16" y1="132" x2="184" y2="132" />
            </svg>

            {/* Minimal Championship Particles */}
            {STANDINGS_AMBIENT_PARTICLES.map((p, idx) => (
              <span
                key={idx}
                className={`spl-particle-float absolute rounded-full opacity-35 ${p.size} ${p.color} ${
                  p.left === '8%'
                    ? 'left-[8%] top-[16%]'
                    : p.left === '24%'
                    ? 'left-[24%] top-[10%]'
                    : p.left === '52%'
                    ? 'left-[52%] top-[12%]'
                    : p.left === '76%'
                    ? 'left-[76%] top-[14%]'
                    : 'left-[91%] top-[20%]'
                }`}
              />
            ))}
          </div>

          <div className="relative z-10 space-y-7 sm:space-y-9">
            {/* PHASE 1: CHAMPIONSHIP SECTION HEADER */}
            <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-5 pb-6 border-b border-white/10">
              <div className="space-y-2 max-w-2xl">
                <div className="flex items-center gap-2 text-[11px] font-mono font-bold uppercase tracking-[0.2em] text-amber-300/90">
                  <span className="h-px w-6 bg-gradient-to-r from-amber-400 to-red-500" />
                  <span>SPL 3.0 Championship Table</span>
                </div>

                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-2xl bg-gradient-to-br from-amber-300 via-amber-400 to-orange-500 text-slate-950 flex items-center justify-center shadow-lg shadow-amber-500/20 shrink-0">
                    <Trophy className="w-5 h-5 sm:w-6 sm:h-6" />
                  </div>
                  <h2 className="text-2xl sm:text-4xl font-black text-white font-display uppercase tracking-tight leading-none text-balance">
                    Official League{' '}
                    <span className="bg-gradient-to-r from-amber-200 via-amber-400 to-yellow-300 bg-clip-text text-transparent">
                      Standings
                    </span>
                  </h2>
                </div>

                <p className="text-sm text-slate-300 max-w-xl">
                  Every Point Counts. Every Victory Matters.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2.5 shrink-0">
                <span className="text-xs font-mono text-slate-400 tabular-nums mr-1">
                  Top {qualificationCut} Knockout Format
                  {standings.length > 0 ? ` · ${standings.length} Teams` : ''}
                </span>
                <button
                  type="button"
                  onClick={onCopyStandings}
                  className="inline-flex items-center gap-2 px-4 py-2.5 min-h-[44px] rounded-xl text-xs font-display font-bold uppercase tracking-wider text-slate-100 bg-white/[0.06] hover:bg-white/[0.12] border border-white/15 hover:border-amber-400/40 transition-colors cursor-pointer whitespace-nowrap shrink-0"
                >
                  <Copy className="w-3.5 h-3.5 text-amber-300 shrink-0" />
                  <span>{copiedStandings ? 'Copied Table!' : 'Share Standings'}</span>
                </button>
              </div>
            </div>

            {/* EMPTY STATE WHEN NO TEAMS/STANDINGS EXIST */}
            {officialEnrichedRows.length === 0 ? (
              <div className="py-14 px-6 text-center rounded-2xl bg-[#070a14]/90 border border-amber-400/20">
                <div className="w-16 h-16 mx-auto rounded-2xl bg-amber-400/10 border border-amber-400/25 flex items-center justify-center mb-4">
                  <Trophy className="w-8 h-8 text-amber-300" />
                </div>
                <h3 className="text-lg sm:text-2xl font-display font-black uppercase tracking-tight text-white">
                  THE ROAD TO GLORY BEGINS SOON
                </h3>
                <p className="text-xs sm:text-sm text-slate-400 mt-2 max-w-md mx-auto">
                  Official league standings will appear once match results are available.
                </p>
              </div>
            ) : (
              <>
                {/* PHASE 2: TOP THREE LEADERBOARD PODIUM (OR PRE-MATCH BANNER IF ZERO MATCHES PLAYED) */}
                {topThreeEntries.length > 0 ? (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between gap-2 text-xs text-slate-400">
                      <span className="font-display font-bold uppercase tracking-[0.18em] text-amber-300">
                        Championship Podium
                      </span>
                      <span className="font-mono text-[11px] text-slate-400">
                        Official Top {topThreeEntries.length}
                      </span>
                    </div>

                    <div
                      className={`grid gap-4 items-stretch pt-1 ${
                        topThreeEntries.length === 1
                          ? 'grid-cols-1'
                          : topThreeEntries.length === 2
                          ? 'grid-cols-1 sm:grid-cols-2'
                          : 'grid-cols-1 min-[480px]:grid-cols-2 md:grid-cols-3 md:pt-3'
                      }`}
                    >
                      {topThreeEntries.map((entry, idx) => (
                        <PodiumCard
                          key={entry.record.team.id}
                          entry={entry}
                          podiumSlot={(idx + 1) as 1 | 2 | 3}
                          hasSingleEntry={topThreeEntries.length === 1}
                          hasTwoEntries={topThreeEntries.length === 2}
                          isUpdated={Boolean(updatedTeamIds[entry.record.team.id])}
                          onSelectTeam={onSelectTeam}
                        />
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="px-5 py-6 rounded-2xl bg-[#070a14]/90 border border-amber-400/20 text-center">
                    <h3 className="text-sm sm:text-base font-display font-black uppercase tracking-wide text-amber-200">
                      THE ROAD TO GLORY BEGINS SOON
                    </h3>
                    <p className="text-xs text-slate-400 mt-1">
                      Official league standings will appear once match results are available. Teams below are seeded for opening play.
                    </p>
                  </div>
                )}

                {/* PHASE 7: INSPECTION SORT BAR (PRESERVES OFFICIAL POS COLUMN) */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-2 text-xs text-slate-400">
                    <span className="font-display font-bold uppercase tracking-wider text-slate-200">
                      Full League Table
                    </span>
                    <span aria-hidden="true">·</span>
                    <span className="text-slate-400">
                      {inspectSort === 'official'
                        ? 'Official Ranking Order'
                        : 'Metric Inspection · Official POS Preserved'}
                    </span>
                  </div>

                  <div
                    role="group"
                    aria-label="Inspect standings order"
                    className="inline-flex items-center gap-1 p-1 rounded-xl bg-[#0b0f1c] border border-white/10 overflow-x-auto max-w-full no-scrollbar"
                  >
                    {(
                      [
                        { id: 'official', label: 'Official Rank' },
                        { id: 'won', label: 'Wins' },
                        { id: 'diff', label: 'Point Diff' },
                        { id: 'pointsFor', label: 'Points For' },
                      ] as const
                    ).map((opt) => {
                      const active = inspectSort === opt.id;
                      return (
                        <button
                          key={opt.id}
                          type="button"
                          onClick={() => setInspectSort(opt.id)}
                          aria-pressed={active}
                          className={`px-3 py-1.5 min-h-[36px] rounded-lg text-xs font-display font-bold whitespace-nowrap shrink-0 transition-colors cursor-pointer ${
                            active
                              ? 'bg-gradient-to-r from-amber-400 to-amber-500 text-slate-950 shadow-sm'
                              : 'text-slate-300 hover:text-white hover:bg-white/[0.05]'
                          }`}
                        >
                          {opt.label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* PHASE 3 & 6: STANDINGS TABLE CONTAINER */}
                <div className="rounded-2xl border border-white/12 bg-[#070a14]/95 shadow-2xl overflow-hidden">
                  {/* MOBILE VIEW (< 640px) — ZERO OVERFLOW WITH EXPANDABLE BREAKDOWN */}
                  <div className="sm:hidden divide-y divide-white/[0.07]">
                    {/* Mobile Header Row */}
                    <div className="px-3.5 py-2.5 bg-[#0c1020] flex items-center justify-between text-[10px] font-display font-bold uppercase tracking-wider text-amber-300/90 border-b border-white/10">
                      <div className="flex items-center gap-3 min-w-0">
                        <span className="w-8 text-center">POS</span>
                        <span>TEAM</span>
                      </div>
                      <div className="flex items-center gap-3 shrink-0 font-mono">
                        <span className="w-6 text-center">P</span>
                        <span className="w-6 text-center">W</span>
                        <span className="w-9 text-center">PD</span>
                        <span className="w-8 text-right text-amber-300">PTS</span>
                        <span className="w-8" aria-hidden="true" />
                      </div>
                    </div>

                    {displayedRows.map((entry, idx) => {
                      const { record, officialRank, status, inQualificationCut, winPct } = entry;
                      const isEliminated = status === 'ELIMINATED';
                      const statusMeta = getStatusDisplay(status);
                      const movement = rankMovements[record.team.id] || 0;
                      const isUpdated = Boolean(updatedTeamIds[record.team.id]);
                      const isExpanded = Boolean(expandedMobileIds[record.team.id]);
                      const showCutoffBar =
                        showQualificationCutoffDivider && officialRank === qualificationCut;

                      return (
                        <React.Fragment key={record.team.id}>
                          <div
                            className={`transition-colors ${
                              isEliminated
                                ? 'opacity-70 bg-[#05070e]'
                                : officialRank === 1 && hasAnyPlayedMatch
                                ? 'bg-amber-500/[0.05]'
                                : idx % 2 === 1
                                ? 'bg-white/[0.015]'
                                : 'bg-transparent'
                            }`}
                          >
                            <div className="px-3 py-3 flex items-center justify-between gap-2">
                              {/* Left: POS + Qualification Vertical Hairline + Team */}
                              <div className="flex items-center gap-2 min-w-0 flex-1">
                                <div className="flex items-center gap-1.5 w-8 shrink-0">
                                  <span
                                    aria-hidden="true"
                                    className={`w-[3px] h-6 rounded-full shrink-0 ${
                                      status === 'CHAMPION' || officialRank === 1
                                        ? hasAnyPlayedMatch
                                          ? 'bg-amber-400'
                                          : 'bg-white/15'
                                        : inQualificationCut && hasAnyPlayedMatch
                                        ? 'bg-emerald-400/80'
                                        : 'bg-transparent'
                                    }`}
                                  />
                                  <div className="flex flex-col items-center leading-none">
                                    <span
                                      className={`font-mono text-xs font-black tabular-nums ${
                                        officialRank === 1 && hasAnyPlayedMatch
                                          ? 'text-amber-300'
                                          : officialRank === 2 && hasAnyPlayedMatch
                                          ? 'text-slate-200'
                                          : officialRank === 3 && hasAnyPlayedMatch
                                          ? 'text-orange-300'
                                          : 'text-slate-400'
                                      }`}
                                    >
                                      {officialRank}
                                    </span>
                                    {movement !== 0 && (
                                      <span
                                        className={`spl-rank-delta inline-flex items-center text-[9px] font-mono font-bold ${
                                          movement > 0 ? 'text-emerald-400' : 'text-red-400'
                                        }`}
                                      >
                                        {movement > 0 ? (
                                          <ArrowUp className="w-2.5 h-2.5" />
                                        ) : (
                                          <ArrowDown className="w-2.5 h-2.5" />
                                        )}
                                      </span>
                                    )}
                                  </div>
                                </div>

                                <button
                                  type="button"
                                  onClick={() => onSelectTeam?.(record.team.id)}
                                  className={`flex items-center gap-2 min-w-0 text-left flex-1 py-1 ${
                                    onSelectTeam ? 'cursor-pointer' : 'cursor-default'
                                  }`}
                                >
                                  <span className="text-lg shrink-0" aria-hidden="true">
                                    {record.team.badge || '🏸'}
                                  </span>
                                  <div className="min-w-0">
                                    <span className="block text-sm font-display font-bold text-white truncate">
                                      {record.team.name}
                                    </span>
                                    {statusMeta && (
                                      <span
                                        className={`flex items-center gap-1 text-[9px] font-display font-bold uppercase tracking-wider truncate ${statusMeta.textClass}`}
                                      >
                                        {statusMeta.icon}
                                        <span className="truncate">{statusMeta.label}</span>
                                      </span>
                                    )}
                                  </div>
                                </button>
                              </div>

                              {/* Right: Compact Tabular Metrics + Expand Toggle */}
                              <div className="flex items-center gap-2 shrink-0 font-mono text-xs tabular-nums">
                                <span className="w-6 text-center text-slate-300">{record.played}</span>
                                <span className="w-6 text-center font-bold text-emerald-400">
                                  {record.won}
                                </span>
                                <span
                                  className={`w-9 text-center ${
                                    record.diff > 0
                                      ? 'text-slate-200'
                                      : record.diff < 0
                                      ? 'text-red-300'
                                      : 'text-slate-400'
                                  }`}
                                >
                                  {record.diff > 0 ? `+${record.diff}` : record.diff}
                                </span>
                                <span
                                  key={isUpdated ? `mpts-${record.points}` : undefined}
                                  className={`w-8 text-right font-black text-sm text-amber-300 ${
                                    isUpdated ? 'spl-stat-flash' : ''
                                  }`}
                                >
                                  {record.points}
                                </span>

                                <button
                                  type="button"
                                  onClick={() => toggleMobileExpand(record.team.id)}
                                  aria-expanded={isExpanded}
                                  aria-label={`Toggle full stats for ${record.team.name}`}
                                  className="w-9 h-10 min-w-[36px] min-h-[40px] flex items-center justify-center rounded-lg text-slate-400 hover:text-white hover:bg-white/[0.06] cursor-pointer"
                                >
                                  <ChevronDown
                                    className={`w-4 h-4 transition-transform duration-200 ${
                                      isExpanded ? 'rotate-180 text-amber-300' : ''
                                    }`}
                                  />
                                </button>
                              </div>
                            </div>

                            {/* Expandable Mobile Detail Drawer */}
                            {isExpanded && (
                              <div className="px-3.5 pb-3.5 pt-1 space-y-2.5 bg-[#0a0f1d] border-t border-white/[0.06]">
                                <div className="grid grid-cols-4 gap-2 text-center font-mono text-xs pt-2">
                                  <div className="py-1.5 rounded-lg bg-white/[0.03]">
                                    <span className="block text-[9px] font-sans uppercase text-slate-400">
                                      Lost
                                    </span>
                                    <span className="font-bold text-red-400 tabular-nums">
                                      {record.lost}
                                    </span>
                                  </div>
                                  <div className="py-1.5 rounded-lg bg-white/[0.03]">
                                    <span className="block text-[9px] font-sans uppercase text-slate-400">
                                      PF
                                    </span>
                                    <span className="font-bold text-slate-200 tabular-nums">
                                      {record.pointsFor}
                                    </span>
                                  </div>
                                  <div className="py-1.5 rounded-lg bg-white/[0.03]">
                                    <span className="block text-[9px] font-sans uppercase text-slate-400">
                                      PA
                                    </span>
                                    <span className="font-bold text-slate-300 tabular-nums">
                                      {record.pointsAgainst}
                                    </span>
                                  </div>
                                  <div className="py-1.5 rounded-lg bg-white/[0.03]">
                                    <span className="block text-[9px] font-sans uppercase text-slate-400">
                                      Win %
                                    </span>
                                    <span className="font-bold text-amber-300 tabular-nums">
                                      {winPct !== null ? `${winPct}%` : '—'}
                                    </span>
                                  </div>
                                </div>

                                <div className="flex items-center justify-between gap-2 pt-1">
                                  <div className="flex items-center gap-1.5">
                                    <span className="text-[10px] font-display uppercase tracking-wider text-slate-400">
                                      Form:
                                    </span>
                                    {record.form && record.form.length > 0 ? (
                                      <div className="flex items-center gap-1">
                                        {record.form.slice(-5).map((f, fIdx) => (
                                          <span
                                            key={fIdx}
                                            className={`w-5 h-5 rounded flex items-center justify-center text-[10px] font-mono font-black ${
                                              f === 'W'
                                                ? 'bg-emerald-500/90 text-slate-950'
                                                : 'bg-red-500/25 text-red-300'
                                            }`}
                                          >
                                            {f}
                                          </span>
                                        ))}
                                      </div>
                                    ) : (
                                      <span className="text-xs font-mono text-slate-500">—</span>
                                    )}
                                  </div>

                                  {onSelectTeam && (
                                    <button
                                      type="button"
                                      onClick={() => onSelectTeam(record.team.id)}
                                      className="inline-flex items-center gap-1 px-3 py-1.5 min-h-[36px] rounded-lg text-xs font-display font-bold text-amber-300 bg-amber-400/10 hover:bg-amber-400/20 cursor-pointer"
                                    >
                                      <span>Team Profile</span>
                                      <ArrowRight className="w-3 h-3" />
                                    </button>
                                  )}
                                </div>
                              </div>
                            )}
                          </div>

                          {showCutoffBar && (
                            <div className="px-3.5 py-1.5 bg-emerald-500/10 border-y border-emerald-400/35 flex items-center justify-between text-[10px] font-display font-bold uppercase tracking-wider text-emerald-300">
                              <span>Top {qualificationCut} Qualification Cutoff</span>
                              <span>Knockout Line</span>
                            </div>
                          )}
                        </React.Fragment>
                      );
                    })}
                  </div>

                  {/* TABLET & DESKTOP FULL CHAMPIONSHIP TABLE (>= 640px) */}
                  <div className="hidden sm:block overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="bg-[#0c1020] border-b border-amber-400/25 text-[11px] font-display font-bold uppercase tracking-[0.14em] text-amber-300/95">
                          <th
                            scope="col"
                            title="Official Team Ranking"
                            className="py-3.5 pl-4 pr-2 w-20 text-center"
                          >
                            POS
                          </th>
                          <th scope="col" title="Team Crest, Name & Status" className="py-3.5 px-3">
                            TEAM
                          </th>
                          <th scope="col" title="Matches Played" className="py-3.5 px-2.5 text-center w-12">
                            P
                          </th>
                          <th
                            scope="col"
                            title="Matches Won (Click to inspect)"
                            className="py-3.5 px-2.5 text-center w-12"
                          >
                            <button
                              type="button"
                              onClick={() =>
                                setInspectSort((cur) => (cur === 'won' ? 'official' : 'won'))
                              }
                              className={`inline-flex items-center justify-center px-1.5 py-0.5 rounded transition-colors cursor-pointer ${
                                inspectSort === 'won'
                                  ? 'bg-amber-400/20 text-amber-200'
                                  : 'hover:text-white'
                              }`}
                            >
                              W
                            </button>
                          </th>
                          <th scope="col" title="Matches Lost" className="py-3.5 px-2.5 text-center w-12">
                            L
                          </th>
                          <th
                            scope="col"
                            title="Points Scored (Click to inspect)"
                            className="py-3.5 px-2.5 text-center w-14"
                          >
                            <button
                              type="button"
                              onClick={() =>
                                setInspectSort((cur) =>
                                  cur === 'pointsFor' ? 'official' : 'pointsFor'
                                )
                              }
                              className={`inline-flex items-center justify-center px-1.5 py-0.5 rounded transition-colors cursor-pointer ${
                                inspectSort === 'pointsFor'
                                  ? 'bg-amber-400/20 text-amber-200'
                                  : 'hover:text-white'
                              }`}
                            >
                              PF
                            </button>
                          </th>
                          <th
                            scope="col"
                            title="Points Conceded"
                            className="py-3.5 px-2.5 text-center w-14"
                          >
                            PA
                          </th>
                          <th
                            scope="col"
                            title="Point Difference (Click to inspect)"
                            className="py-3.5 px-2.5 text-center w-16"
                          >
                            <button
                              type="button"
                              onClick={() =>
                                setInspectSort((cur) => (cur === 'diff' ? 'official' : 'diff'))
                              }
                              className={`inline-flex items-center justify-center px-1.5 py-0.5 rounded transition-colors cursor-pointer ${
                                inspectSort === 'diff'
                                  ? 'bg-amber-400/20 text-amber-200'
                                  : 'hover:text-white'
                              }`}
                            >
                              PD
                            </button>
                          </th>
                          <th
                            scope="col"
                            title="Official League Points"
                            className="py-3.5 px-3 text-center w-16 text-amber-300 font-black"
                          >
                            PTS
                          </th>
                          <th
                            scope="col"
                            title="Last 5 Completed Matches"
                            className="py-3.5 pl-2 pr-5 text-center hidden lg:table-cell w-36"
                          >
                            FORM
                          </th>
                        </tr>
                      </thead>

                      <tbody className="divide-y divide-white/[0.06] text-sm">
                        {displayedRows.map((entry, idx) => {
                          const {
                            record,
                            officialRank,
                            status,
                            inQualificationCut,
                            playerNames,
                          } = entry;
                          const isEliminated = status === 'ELIMINATED';
                          const statusMeta = getStatusDisplay(status);
                          const movement = rankMovements[record.team.id] || 0;
                          const isUpdated = Boolean(updatedTeamIds[record.team.id]);
                          const showCutoffRow =
                            showQualificationCutoffDivider && officialRank === qualificationCut;

                          return (
                            <React.Fragment key={record.team.id}>
                              <tr
                                className={`group transition-colors ${
                                  isEliminated
                                    ? 'opacity-65 bg-[#05070e] hover:bg-white/[0.03]'
                                    : officialRank === 1 && hasAnyPlayedMatch
                                    ? 'bg-amber-500/[0.045] hover:bg-amber-500/[0.08]'
                                    : idx % 2 === 1
                                    ? 'bg-white/[0.015] hover:bg-white/[0.045]'
                                    : 'hover:bg-white/[0.045]'
                                }`}
                              >
                                {/* POS */}
                                <td className="py-3.5 pl-3 pr-2">
                                  <div className="flex items-center justify-center gap-2">
                                    <span
                                      aria-hidden="true"
                                      className={`w-[3px] h-7 rounded-full shrink-0 ${
                                        status === 'CHAMPION' ||
                                        (officialRank === 1 && hasAnyPlayedMatch)
                                          ? 'bg-amber-400'
                                          : inQualificationCut && hasAnyPlayedMatch
                                          ? 'bg-emerald-400/80'
                                          : 'bg-transparent'
                                      }`}
                                    />
                                    <div className="flex items-center gap-1 min-w-[2.2rem] justify-center font-mono font-black tabular-nums">
                                      {officialRank === 1 && hasAnyPlayedMatch ? (
                                        <span className="inline-flex items-center gap-1 text-amber-300">
                                          <Crown className="w-3.5 h-3.5 shrink-0" />
                                          <span>1</span>
                                        </span>
                                      ) : officialRank === 2 && hasAnyPlayedMatch ? (
                                        <span className="text-slate-200">2</span>
                                      ) : officialRank === 3 && hasAnyPlayedMatch ? (
                                        <span className="text-orange-300">3</span>
                                      ) : (
                                        <span className="text-slate-400">{officialRank}</span>
                                      )}

                                      {movement !== 0 && (
                                        <span
                                          title={
                                            movement > 0
                                              ? `Moved up ${movement}`
                                              : `Moved down ${Math.abs(movement)}`
                                          }
                                          className={`spl-rank-delta inline-flex items-center text-[10px] font-bold ${
                                            movement > 0 ? 'text-emerald-400' : 'text-red-400'
                                          }`}
                                        >
                                          {movement > 0 ? (
                                            <ArrowUp className="w-3 h-3" />
                                          ) : (
                                            <ArrowDown className="w-3 h-3" />
                                          )}
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                </td>

                                {/* TEAM */}
                                <td className="py-3.5 px-3">
                                  <div className="flex items-center justify-between gap-3 min-w-0">
                                    <button
                                      type="button"
                                      onClick={() => onSelectTeam?.(record.team.id)}
                                      className={`flex items-center gap-3 min-w-0 text-left ${
                                        onSelectTeam
                                          ? 'cursor-pointer focus-visible:outline-2 focus-visible:outline-amber-400 rounded-lg'
                                          : 'cursor-default'
                                      }`}
                                    >
                                      <div
                                        className={`w-10 h-10 rounded-xl flex items-center justify-center text-xl shrink-0 border transition-transform duration-150 ${
                                          onSelectTeam ? 'group-hover:scale-105' : ''
                                        } ${
                                          officialRank === 1 && hasAnyPlayedMatch
                                            ? 'bg-amber-400/15 border-amber-400/45'
                                            : officialRank === 2 && hasAnyPlayedMatch
                                            ? 'bg-slate-300/10 border-slate-300/35'
                                            : officialRank === 3 && hasAnyPlayedMatch
                                            ? 'bg-orange-500/15 border-orange-400/35'
                                            : 'bg-white/[0.04] border-white/10'
                                        }`}
                                      >
                                        <span role="img" aria-hidden="true">
                                          {record.team.badge || '🏸'}
                                        </span>
                                      </div>

                                      <div className="min-w-0">
                                        <span
                                          className={`block font-display font-bold text-sm sm:text-[15px] truncate transition-colors ${
                                            isEliminated
                                              ? 'text-slate-300'
                                              : 'text-white group-hover:text-amber-200'
                                          }`}
                                        >
                                          {record.team.name}
                                        </span>
                                        <div className="flex items-center gap-1.5 text-[11px] text-slate-400 truncate">
                                          {playerNames && (
                                            <span className="truncate">{playerNames}</span>
                                          )}
                                          {playerNames && statusMeta && (
                                            <span aria-hidden="true">·</span>
                                          )}
                                          {statusMeta && (
                                            <span
                                              className={`inline-flex items-center gap-1 font-display font-bold uppercase tracking-wider text-[10px] shrink-0 ${statusMeta.textClass}`}
                                            >
                                              {statusMeta.icon}
                                              <span>{statusMeta.label}</span>
                                            </span>
                                          )}
                                        </div>
                                      </div>
                                    </button>
                                  </div>
                                </td>

                                {/* P */}
                                <td className="py-3.5 px-2.5 text-center font-mono text-xs sm:text-sm text-slate-300 tabular-nums">
                                  {record.played}
                                </td>

                                {/* W */}
                                <td className="py-3.5 px-2.5 text-center font-mono text-xs sm:text-sm font-bold text-emerald-400 tabular-nums">
                                  <span
                                    key={isUpdated ? `dw-${record.won}` : undefined}
                                    className={isUpdated ? 'spl-stat-flash' : undefined}
                                  >
                                    {record.won}
                                  </span>
                                </td>

                                {/* L */}
                                <td className="py-3.5 px-2.5 text-center font-mono text-xs sm:text-sm text-red-400/90 tabular-nums">
                                  {record.lost}
                                </td>

                                {/* PF */}
                                <td className="py-3.5 px-2.5 text-center font-mono text-xs sm:text-sm text-slate-300 tabular-nums">
                                  {record.pointsFor}
                                </td>

                                {/* PA */}
                                <td className="py-3.5 px-2.5 text-center font-mono text-xs sm:text-sm text-slate-400 tabular-nums">
                                  {record.pointsAgainst}
                                </td>

                                {/* PD */}
                                <td
                                  className={`py-3.5 px-2.5 text-center font-mono text-xs sm:text-sm font-semibold tabular-nums ${
                                    record.diff > 0
                                      ? 'text-emerald-300'
                                      : record.diff < 0
                                      ? 'text-red-300'
                                      : 'text-slate-400'
                                  }`}
                                >
                                  <span
                                    key={isUpdated ? `dd-${record.diff}` : undefined}
                                    className={isUpdated ? 'spl-stat-flash' : undefined}
                                  >
                                    {record.diff > 0 ? `+${record.diff}` : record.diff}
                                  </span>
                                </td>

                                {/* PTS */}
                                <td className="py-3.5 px-3 text-center font-mono text-base font-black text-amber-300 tabular-nums">
                                  <span
                                    key={isUpdated ? `dpts-${record.points}` : undefined}
                                    className={isUpdated ? 'spl-stat-flash' : undefined}
                                  >
                                    {record.points}
                                  </span>
                                </td>

                                {/* FORM */}
                                <td className="py-3.5 pl-2 pr-5 text-center hidden lg:table-cell">
                                  {record.form && record.form.length > 0 ? (
                                    <div className="flex items-center justify-center gap-1">
                                      {record.form.slice(-5).map((f, fIdx) => (
                                        <span
                                          key={fIdx}
                                          className={`w-5 h-5 rounded flex items-center justify-center text-[10px] font-mono font-black ${
                                            f === 'W'
                                              ? 'bg-emerald-500 text-slate-950'
                                              : 'bg-red-500/25 text-red-300'
                                          }`}
                                        >
                                          {f}
                                        </span>
                                      ))}
                                    </div>
                                  ) : (
                                    <span className="font-mono text-xs text-slate-500">—</span>
                                  )}
                                </td>
                              </tr>

                              {showCutoffRow && (
                                <tr aria-hidden="true">
                                  <td
                                    colSpan={10}
                                    className="px-4 py-1.5 bg-gradient-to-r from-emerald-500/12 via-amber-400/10 to-transparent border-y border-emerald-400/35 text-[10px] font-display font-bold uppercase tracking-[0.18em] text-emerald-300"
                                  >
                                    Top {qualificationCut} Knockout Qualification Cutoff
                                  </td>
                                </tr>
                              )}
                            </React.Fragment>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>

                  {/* LEGEND & EXPLANATORY FOOTER */}
                  <div className="px-4 sm:px-6 py-4 bg-[#0b0f1c] border-t border-white/10 flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs text-slate-400">
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5">
                      <span className="inline-flex items-center gap-1.5 text-slate-300">
                        <span className="w-2 h-2 rounded-full bg-amber-400 shrink-0" />
                        <span>League Leader / Champion</span>
                      </span>
                      <span className="inline-flex items-center gap-1.5 text-slate-300">
                        <span className="w-2 h-2 rounded-full bg-emerald-400 shrink-0" />
                        <span>Top {qualificationCut} Knockout Zone</span>
                      </span>
                      <span className="text-slate-400">
                        P Played · W Won · L Lost · PF Points For · PA Points Against · PD Diff · PTS Points
                      </span>
                    </div>

                    <span className="font-mono text-[11px] text-slate-400 shrink-0">
                      Tiebreak: PTS · Wins · PD · PF
                    </span>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </section>
    );
  }
);
