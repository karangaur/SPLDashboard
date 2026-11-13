import React, { useMemo, useRef, useState } from 'react';
import {
  ArrowRight,
  CheckCircle2,
  Clock,
  Crown,
  Flame,
  Swords,
  Trophy,
  Zap,
} from 'lucide-react';
import {
  BadmintonScoringRules,
  KnockoutData,
  Match,
  Player,
  Team,
} from '../../types/tournament';

export interface FixturesShowcaseSectionProps {
  allPublicMatches: Match[];
  knockout?: KnockoutData;
  teams: Team[];
  players: Player[];
  courtNames?: string[];
  courtsCount: number;
  courtsListLabel: string;
  scoringRules?: BadmintonScoringRules;
  onOpenMatchModal: (match: Match) => void;
}

type FixtureFilterTab = 'all' | 'upcoming' | 'live' | 'completed' | 'knockout';

type MatchStageTier = 'grand_final' | 'semi_final' | 'quarter_final' | 'league';

function isCrownBracketMatch(m: Match): boolean {
  if (m.matchType === 'knockout') return true;
  if (m.stage === 'F' || m.stage === 'SF' || m.stage === 'QF' || m.stage === 'ELIM') return true;
  const lbl = (m.stageLabel || '').toLowerCase();
  return (
    lbl.includes('semi-final') ||
    lbl.includes('semi final') ||
    lbl.includes('grand final') ||
    lbl.includes('quarter-final') ||
    lbl.includes('quarter final')
  );
}

function getStageTier(m: Match): MatchStageTier {
  if (isCrownBracketMatch(m)) {
    if (
      m.stage === 'F' ||
      (m.stageLabel?.toLowerCase().includes('final') &&
        !m.stageLabel?.toLowerCase().includes('semi') &&
        !m.stageLabel?.toLowerCase().includes('quarter'))
    ) {
      return 'grand_final';
    }
    if (m.stage === 'SF' || m.stageLabel?.toLowerCase().includes('semi')) {
      return 'semi_final';
    }
    return 'quarter_final';
  }
  return 'league';
}

function getConfirmedWinnerId(m: Match): string | undefined {
  if (m.status !== 'completed' || !m.winner) return undefined;
  return m.winner === m.teamA || m.winner === m.teamB ? m.winner : undefined;
}

function getBracketStatusRank(m: Match): number {
  const statusScore =
    m.status === 'completed' ? 4 : m.status === 'live' ? 3 : m.status === 'paused' ? 2 : 1;
  const teamScore = (m.teamA ? 1 : 0) + (m.teamB ? 1 : 0);
  const pointScore = (m.scoreA || 0) + (m.scoreB || 0) > 0 ? 1 : 0;
  return statusScore * 10 + teamScore * 2 + pointScore;
}

export const FixturesShowcaseSection: React.FC<FixturesShowcaseSectionProps> = React.memo(({
  allPublicMatches,
  knockout,
  teams,
  players,
  courtNames,
  courtsCount,
  courtsListLabel,
  scoringRules,
  onOpenMatchModal,
}) => {
  const [activeTab, setActiveTab] = useState<FixtureFilterTab>('all');
  const [selectedCourt, setSelectedCourt] = useState<number | 'all'>('all');
  const bracketRef = useRef<HTMLDivElement | null>(null);

  const teamMap = useMemo(() => new Map(teams.map((t) => [t.id, t])), [teams]);
  const playerMap = useMemo(() => new Map(players.map((p) => [p.id, p])), [players]);
  const getTeam = (id?: string) => (id ? teamMap.get(id) : undefined);

  const getPlayerNamesSummary = (team?: Team): string => {
    if (!team) return 'Awaiting Draw';
    const names = (team.players || [])
      .map((pid) => playerMap.get(pid)?.name)
      .filter((n): n is string => Boolean(n));
    return names.length > 0 ? names.join(' & ') : 'Doubles Pair';
  };

  const resolveCourtLabel = (m: Match) => {
    const cNum = m.court || 1;
    return m.courtName || courtNames?.[cNum - 1]?.trim() || `Court ${cNum}`;
  };

  const pointTarget = scoringRules?.pointTarget || 21;

  // Deduplicate all incoming matches strictly by database match ID
  const deduplicatedMatches = useMemo(() => {
    const byId = new Map<string, Match>();
    for (const m of allPublicMatches) {
      if (!m?.id) continue;
      if (!byId.has(m.id)) {
        byId.set(m.id, m);
      }
    }
    return Array.from(byId.values());
  }, [allPublicMatches]);

  // Regular League Stage matches ONLY (strictly excludes Semi-Finals, Grand Final & Crown bracket nodes)
  const leagueMatches = useMemo(
    () => deduplicatedMatches.filter((m) => !isCrownBracketMatch(m)),
    [deduplicatedMatches]
  );

  // Deduplicate Knockout Stage matches cleanly by ID and canonical (stage, slot) so SF1, SF2, GF appear at most once each
  const knockoutNormalized = useMemo(() => {
    const bySlot = new Map<string, Match>();
    for (const m of deduplicatedMatches) {
      if (!isCrownBracketMatch(m)) continue;
      const canonicalStage =
        m.stage === 'F'
          ? 'F'
          : m.stage === 'SF'
          ? 'SF'
          : m.stage === 'ELIM' || m.stage === 'QF'
          ? 'QF'
          : getStageTier(m) === 'grand_final'
          ? 'F'
          : getStageTier(m) === 'semi_final'
          ? 'SF'
          : 'QF';
      const slotKey = `${canonicalStage}:${m.slot || 1}`;
      const existing = bySlot.get(slotKey);
      if (!existing || getBracketStatusRank(m) > getBracketStatusRank(existing)) {
        bySlot.set(slotKey, m);
      }
    }
    return Array.from(bySlot.values());
  }, [deduplicatedMatches]);

  // Derived filter counts: Regular tabs count League Stage matches; Knockout Stage tab counts unique Crown matches
  const counts = useMemo(() => {
    let live = 0;
    let upcoming = 0;
    let completed = 0;
    for (const m of leagueMatches) {
      if (m.status === 'live') live++;
      else if (m.status === 'upcoming' || m.status === 'paused') upcoming++;
      else if (m.status === 'completed') completed++;
    }
    return {
      all: leagueMatches.length,
      live,
      upcoming,
      completed,
      knockout: knockoutNormalized.length,
    };
  }, [leagueMatches, knockoutNormalized.length]);

  // Filtered Regular League Stage matches (Live first, then Paused, Upcoming, Completed, ordered by Round)
  const orderedFilteredLeagueMatches = useMemo(() => {
    if (activeTab === 'knockout') return [];

    const filtered = leagueMatches.filter((m) => {
      if (selectedCourt !== 'all' && m.court !== selectedCourt) return false;
      switch (activeTab) {
        case 'live':
          return m.status === 'live';
        case 'upcoming':
          return m.status === 'upcoming' || m.status === 'paused';
        case 'completed':
          return m.status === 'completed';
        case 'all':
        default:
          return true;
      }
    });

    const statusWeight = (s: Match['status']) =>
      s === 'live' ? 0 : s === 'paused' ? 1 : s === 'upcoming' ? 2 : 3;

    return [...filtered].sort((a, b) => {
      const sw = statusWeight(a.status) - statusWeight(b.status);
      if (sw !== 0) return sw;
      if ((a.round || 0) !== (b.round || 0)) return (a.round || 0) - (b.round || 0);
      return (a.slot || a.courtSlot || 0) - (b.slot || b.courtSlot || 0);
    });
  }, [leagueMatches, activeTab, selectedCourt]);

  // Map match ID -> friendly sequential match number in League Stage
  const matchNumberMap = useMemo(() => {
    const map = new Map<string, string>();
    let leagueIdx = 1;
    for (const m of leagueMatches) {
      map.set(m.id, `Match #${String(leagueIdx++).padStart(2, '0')}`);
    }
    return map;
  }, [leagueMatches]);

  const bracketStages = useMemo(() => {
    const qfs = knockoutNormalized
      .filter((m) => m.stage === 'ELIM' || m.stage === 'QF' || getStageTier(m) === 'quarter_final')
      .sort((a, b) => (a.slot || 1) - (b.slot || 1));
    const sfs = knockoutNormalized
      .filter((m) => m.stage === 'SF' || getStageTier(m) === 'semi_final')
      .sort((a, b) => (a.slot || 1) - (b.slot || 1));
    const finals = knockoutNormalized
      .filter((m) => m.stage === 'F' || getStageTier(m) === 'grand_final')
      .sort((a, b) => (a.slot || 1) - (b.slot || 1));
    return {
      hasBracket: knockoutNormalized.length > 0 && ((knockout?.matches?.length || 0) > 0 || knockoutNormalized.length > 0),
      qfs,
      sfs,
      finals,
    };
  }, [knockoutNormalized, knockout?.matches?.length]);

  const handleSelectTab = (tabId: FixtureFilterTab) => {
    setActiveTab(tabId);
    if (tabId === 'knockout') {
      requestAnimationFrame(() => {
        bracketRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      });
    }
  };



  return (
    <section
      id="matches-schedule"
      aria-label="Fixtures and Results Match Centre"
      className="relative overflow-hidden bg-[#05060b] border-y border-white/10 py-14 sm:py-20 scroll-mt-20"
    >
      {/* Subtle Championship Arena Ambient Glows & Court Perspective Overlay */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden spl-broadcast-layer">
        <div className="absolute -top-24 right-1/4 w-[28rem] h-72 rounded-full bg-red-600/10 blur-3xl" />
        <div className="absolute -bottom-24 left-1/4 w-[28rem] h-72 rounded-full bg-amber-500/10 blur-3xl" />
        <svg
          className="hidden md:block absolute inset-0 w-full h-full opacity-[0.04] text-amber-200"
          viewBox="0 0 1200 700"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.4"
          preserveAspectRatio="xMidYMid slice"
        >
          <rect x="80" y="60" width="1040" height="580" />
          <line x1="600" y1="60" x2="600" y2="640" strokeDasharray="8 6" />
          <line x1="220" y1="60" x2="220" y2="640" />
          <line x1="980" y1="60" x2="980" y2="640" />
        </svg>
      </div>

      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8 sm:space-y-10">
        {/* PHASE 5: Section Header & Filter Controls */}
        <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6">
          <div className="space-y-2 max-w-2xl">
            <div className="flex items-center gap-2 text-xs font-display font-black uppercase tracking-[0.24em] text-amber-400">
              <Swords className="w-4 h-4 shrink-0 text-amber-400" />
              <span>TOURNAMENT MATCH CENTRE</span>
              <span className="text-slate-600">·</span>
              <span className="text-slate-300 truncate">{courtsListLabel}</span>
            </div>

            <h2 className="text-[clamp(1.9rem,4vw,3.15rem)] font-black text-white font-display uppercase tracking-tight leading-[1.06] text-balance">
              FIXTURES &{' '}
              <span className="bg-gradient-to-r from-amber-200 via-amber-400 to-orange-500 bg-clip-text text-transparent">
                RESULTS
              </span>
            </h2>

            <p className="text-sm sm:text-base text-slate-300 font-medium">
              “Follow Every Battle. Witness Every Victory.”
            </p>
          </div>

          {/* Navigation Filter Tabs & Court Selector */}
          <div className="flex flex-col sm:items-end gap-2.5">
            {/* Primary Match Category Tabs */}
            <div
              role="tablist"
              aria-label="Filter tournament fixtures"
              className="flex items-center gap-1 p-1 rounded-xl bg-[#0b0e18] border border-white/10 overflow-x-auto max-w-full no-scrollbar"
            >
              {(
                [
                  { id: 'all', label: `All Matches (${counts.all})` },
                  { id: 'upcoming', label: `Upcoming (${counts.upcoming})` },
                  { id: 'live', label: `Live (${counts.live})`, hasLiveDot: counts.live > 0 },
                  { id: 'completed', label: `Completed (${counts.completed})` },
                  { id: 'knockout', label: `Knockout Stage (${counts.knockout})` },
                ] as { id: FixtureFilterTab; label: string; hasLiveDot?: boolean }[]
              ).map((tab) => {
                const isActive = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    role="tab"
                    aria-selected={isActive}
                    onClick={() => handleSelectTab(tab.id)}
                    className={`px-3 py-2 min-h-[40px] rounded-lg text-xs font-display font-bold uppercase tracking-wider whitespace-nowrap flex items-center gap-1.5 transition-colors cursor-pointer shrink-0 ${
                      isActive
                        ? tab.id === 'live'
                          ? 'bg-red-600 text-white shadow-md shadow-red-600/30'
                          : tab.id === 'knockout'
                          ? 'bg-gradient-to-r from-violet-500 to-purple-600 text-white shadow-md shadow-purple-600/30'
                          : 'bg-gradient-to-r from-amber-300 via-amber-400 to-orange-500 text-slate-950 font-black shadow-md shadow-amber-500/25'
                        : 'text-slate-300 hover:text-white hover:bg-white/[0.06]'
                    }`}
                  >
                    {tab.hasLiveDot && (
                      <span
                        className={`w-1.5 h-1.5 rounded-full animate-pulse shrink-0 ${
                          isActive ? 'bg-white' : 'bg-red-500'
                        }`}
                      />
                    )}
                    <span>{tab.label}</span>
                  </button>
                );
              })}
            </div>

            {/* Court Filter Pills */}
            {courtsCount > 1 && (
              <div className="flex items-center gap-1 p-1 rounded-xl bg-[#0b0e18] border border-white/10 overflow-x-auto max-w-full no-scrollbar">
                <button
                  type="button"
                  onClick={() => setSelectedCourt('all')}
                  className={`px-3 py-1.5 min-h-[36px] rounded-lg text-[11px] font-bold whitespace-nowrap transition-colors cursor-pointer ${
                    selectedCourt === 'all'
                      ? 'bg-white/15 text-white'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  All Courts
                </button>
                {Array.from({ length: Math.max(1, courtsCount) }, (_, i) => i + 1).map((c) => {
                  const cName = courtNames?.[c - 1]?.trim() || `Court ${c}`;
                  const isActive = selectedCourt === c;
                  return (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setSelectedCourt(c)}
                      className={`px-3 py-1.5 min-h-[36px] rounded-lg text-[11px] font-bold whitespace-nowrap transition-colors cursor-pointer ${
                        isActive
                          ? 'bg-amber-400/20 text-amber-300 border border-amber-400/35'
                          : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      {cName}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* REGULAR LEAGUE STAGE FIXTURES & RESULTS ONLY (No Knockout Cards Here) */}
        {activeTab !== 'knockout' && (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2 text-xs font-display font-black uppercase tracking-[0.2em] text-slate-300">
                <span className="w-2 h-2 rounded-full bg-amber-400 shrink-0" />
                <span>League Stage Fixtures &amp; Results</span>
              </div>
              <span className="text-[11px] font-mono text-slate-400 tabular-nums">
                Showing {orderedFilteredLeagueMatches.length} of {leagueMatches.length} League{' '}
                {leagueMatches.length === 1 ? 'Match' : 'Matches'}
              </span>
            </div>

            {orderedFilteredLeagueMatches.length === 0 ? (
              <div className="p-10 sm:p-14 text-center rounded-3xl bg-[#0a0d17] border border-white/10 max-w-xl mx-auto">
                <Trophy className="w-10 h-10 text-amber-400/80 mx-auto" />
                <h3 className="text-lg font-display font-black text-white uppercase mt-4">
                  No League Fixtures in this Category
                </h3>
                <p className="text-xs sm:text-sm text-slate-400 mt-1.5">
                  No League Stage matches currently match this filter. Knockout matches appear exclusively in Road to the SPL 3.0 Crown below.
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setActiveTab('all');
                    setSelectedCourt('all');
                  }}
                  className="mt-5 px-5 py-2.5 min-h-[44px] rounded-xl text-xs font-display font-bold uppercase tracking-wider bg-amber-400 hover:bg-amber-300 text-slate-950 transition-colors cursor-pointer"
                >
                  Show All Matches
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5 items-stretch">
                {orderedFilteredLeagueMatches.map((m) => {
                  const tA = getTeam(m.teamA);
                  const tB = getTeam(m.teamB);
                  const sA = m.scoreA ?? 0;
                  const sB = m.scoreB ?? 0;
                  const hasStartedScore =
                    m.status === 'live' || m.status === 'paused' || m.status === 'completed';
                  const isLive = m.status === 'live';
                  const isPaused = m.status === 'paused';
                  const isDone = m.status === 'completed';
                  const winnerId = getConfirmedWinnerId(m);
                  const isWinnerA = Boolean(winnerId && winnerId === m.teamA);
                  const isWinnerB = Boolean(winnerId && winnerId === m.teamB);
                  const winnerTeam = winnerId ? getTeam(winnerId) : undefined;
                  const courtLabel = resolveCourtLabel(m);
                  const matchNumLabel = matchNumberMap.get(m.id) || `Match #${m.round}`;
                  const stageHeading = `League · Round ${m.round}`;
                  const cleanScheduleNote =
                    m.time && !m.time.includes(courtLabel) ? m.time : null;

                  const cardTheme = isLive
                    ? 'bg-gradient-to-b from-[#1a0b0e] via-[#0b0d17] to-[#06070c] border-red-500/60 hover:border-red-400 shadow-[0_16px_42px_-16px_rgba(239,68,68,0.3)]'
                    : 'bg-gradient-to-b from-[#101422] via-[#0a0d17] to-[#06070c] border-white/12 hover:border-amber-400/45 shadow-[0_16px_38px_-18px_rgba(0,0,0,0.9)]';

                  const topBarGrad = isLive
                    ? 'from-red-500 via-orange-500 to-amber-400'
                    : isDone
                    ? 'from-emerald-400/80 to-amber-400/80'
                    : 'from-slate-600 to-slate-500';

                  return (
                    <div
                      key={m.id}
                      role="button"
                      tabIndex={0}
                      onClick={() => onOpenMatchModal(m)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          onOpenMatchModal(m);
                        }
                      }}
                      aria-label={`${stageHeading}: ${tA?.name || 'TBD'} versus ${tB?.name || 'TBD'}`}
                      className={`group relative h-full flex flex-col justify-between rounded-2xl border overflow-hidden text-left transition-all duration-200 hover:-translate-y-1 cursor-pointer focus-visible:outline-2 focus-visible:outline-amber-400 ${cardTheme}`}
                    >
                      {/* Top Stage Metallic Accent Line */}
                      <div aria-hidden="true" className={`h-[3px] w-full bg-gradient-to-r ${topBarGrad}`} />

                      <div className="p-4 sm:p-5 flex-1 flex flex-col justify-between space-y-4">
                        {/* CARD HEADER */}
                        <div className="flex items-start justify-between gap-2 pb-3 border-b border-white/10">
                          <div className="min-w-0 space-y-0.5">
                            <div className="flex flex-wrap items-center gap-1.5 text-[11px] font-display font-bold uppercase tracking-wider">
                              <span className="text-amber-300/90">{stageHeading}</span>
                              <span className="text-slate-600" aria-hidden="true">·</span>
                              <span className="font-mono text-slate-400">{matchNumLabel}</span>
                            </div>
                            <div className="flex flex-wrap items-center gap-1.5 text-[11px] font-mono text-slate-400">
                              <span>{courtLabel}</span>
                              {cleanScheduleNote && (
                                <>
                                  <span aria-hidden="true">·</span>
                                  <span className="truncate">{cleanScheduleNote}</span>
                                </>
                              )}
                            </div>
                          </div>

                          {/* Explicit Text + Icon Status */}
                          <div className="shrink-0">
                            {isLive ? (
                              <span className="inline-flex items-center gap-1.5 text-[11px] font-display font-black uppercase tracking-[0.14em] text-red-400">
                                <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                                <span>LIVE</span>
                              </span>
                            ) : isPaused ? (
                              <span className="inline-flex items-center gap-1 text-[11px] font-display font-black uppercase tracking-wider text-amber-300">
                                <Clock className="w-3.5 h-3.5" />
                                <span>PAUSED</span>
                              </span>
                            ) : isDone ? (
                              <span className="inline-flex items-center gap-1 text-[11px] font-display font-black uppercase tracking-wider text-emerald-400">
                                <CheckCircle2 className="w-3.5 h-3.5" />
                                <span>FINAL</span>
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-[11px] font-display font-bold uppercase tracking-wider text-sky-300">
                                <Clock className="w-3.5 h-3.5" />
                                <span>UPCOMING</span>
                              </span>
                            )}
                          </div>
                        </div>

                        {/* MAIN MATCH AREA: Left Team 1 | Center Score / VS | Right Team 2 */}
                        <div className="grid grid-cols-12 gap-2 items-center py-1">
                          {/* LEFT: Team 1 */}
                          <div className="col-span-5 flex flex-col items-center text-center min-w-0 space-y-1.5">
                            <div
                              className={`w-11 h-11 sm:w-12 sm:h-12 rounded-xl flex items-center justify-center text-xl sm:text-2xl shadow-md ring-1 ${
                                isWinnerA
                                  ? 'bg-gradient-to-br from-amber-300 via-amber-400 to-orange-500 text-slate-950 ring-amber-200'
                                  : 'bg-white/[0.06] text-white ring-white/15'
                              }`}
                            >
                              <span role="img" aria-hidden="true">{tA?.badge || '🏸'}</span>
                            </div>
                            <div className="w-full min-w-0">
                              <div className="flex items-center justify-center gap-1">
                                {isWinnerA && <Trophy className="w-3 h-3 text-amber-300 shrink-0" />}
                                <h3
                                  title={tA?.name || 'Awaiting Team'}
                                  className={`font-display font-black text-xs sm:text-sm leading-tight line-clamp-2 ${
                                    isWinnerA ? 'text-amber-300' : 'text-white'
                                  }`}
                                >
                                  {tA?.name || 'Awaiting Team'}
                                </h3>
                              </div>
                              <p className="text-[10px] text-slate-400 truncate mt-0.5">
                                {getPlayerNamesSummary(tA)}
                              </p>
                            </div>
                          </div>

                          {/* CENTRE: Score Display or VS */}
                          <div className="col-span-2 flex flex-col items-center justify-center text-center min-w-0">
                            {hasStartedScore ? (
                              <div className="space-y-0.5">
                                <div
                                  className={`font-mono font-black text-base sm:text-xl tracking-tight tabular-nums whitespace-nowrap ${
                                    isLive
                                      ? 'text-red-300 drop-shadow-[0_0_12px_rgba(239,68,68,0.55)]'
                                      : 'text-white'
                                  }`}
                                >
                                  {sA}
                                  <span className="mx-0.5 text-slate-500">:</span>
                                  {sB}
                                </div>
                                <span className="block text-[9px] font-display font-bold uppercase tracking-widest text-slate-400">
                                  {isLive ? 'Points' : 'Final'}
                                </span>
                              </div>
                            ) : (
                              <div className="w-9 h-9 rounded-xl bg-white/[0.05] border border-white/15 flex items-center justify-center font-display font-black italic text-xs text-amber-300">
                                VS
                              </div>
                            )}
                          </div>

                          {/* RIGHT: Team 2 */}
                          <div className="col-span-5 flex flex-col items-center text-center min-w-0 space-y-1.5">
                            <div
                              className={`w-11 h-11 sm:w-12 sm:h-12 rounded-xl flex items-center justify-center text-xl sm:text-2xl shadow-md ring-1 ${
                                isWinnerB
                                  ? 'bg-gradient-to-br from-amber-300 via-amber-400 to-orange-500 text-slate-950 ring-amber-200'
                                  : 'bg-white/[0.06] text-white ring-white/15'
                              }`}
                            >
                              <span role="img" aria-hidden="true">{tB?.badge || '🏸'}</span>
                            </div>
                            <div className="w-full min-w-0">
                              <div className="flex items-center justify-center gap-1">
                                {isWinnerB && <Trophy className="w-3 h-3 text-amber-300 shrink-0" />}
                                <h3
                                  title={tB?.name || 'Awaiting Team'}
                                  className={`font-display font-black text-xs sm:text-sm leading-tight line-clamp-2 ${
                                    isWinnerB ? 'text-amber-300' : 'text-white'
                                  }`}
                                >
                                  {tB?.name || 'Awaiting Team'}
                                </h3>
                              </div>
                              <p className="text-[10px] text-slate-400 truncate mt-0.5">
                                {getPlayerNamesSummary(tB)}
                              </p>
                            </div>
                          </div>
                        </div>

                        {/* BOTTOM AREA: Sets, Winner Callout & Details Link */}
                        <div className="pt-3 border-t border-white/10 space-y-2">
                          {m.sets && m.sets.length > 1 && (
                            <div className="flex flex-wrap items-center justify-center gap-1.5 text-[10px] font-mono text-slate-300 tabular-nums">
                              {m.sets.map((s, sIdx) => (
                                <span key={sIdx} className="px-1.5 py-0.5 rounded bg-white/[0.05]">
                                  S{sIdx + 1}: {s.scoreA}-{s.scoreB}
                                </span>
                              ))}
                            </div>
                          )}

                          <div className="flex items-center justify-between gap-2 text-xs">
                            {isDone && winnerTeam ? (
                              <span className="inline-flex items-center gap-1.5 font-bold text-amber-300 truncate min-w-0">
                                <Trophy className="w-3.5 h-3.5 shrink-0 text-amber-400" />
                                <span className="truncate">{winnerTeam.name} Won</span>
                              </span>
                            ) : isLive ? (
                              <span className="inline-flex items-center gap-1.5 font-semibold text-red-300 truncate">
                                <Flame className="w-3.5 h-3.5 shrink-0 text-red-400" />
                                <span>Live scoring active</span>
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1.5 font-medium text-slate-400 truncate">
                                <span>BWF {pointTarget}-Pt Rally</span>
                              </span>
                            )}

                            <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-300 group-hover:text-amber-300 shrink-0 transition-colors">
                              <span>Details</span>
                              <ArrowRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-0.5" />
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ROAD TO THE SPL 3.0 CROWN — SINGLE OFFICIAL KNOCKOUT BRACKET LOCATION */}
        {bracketStages.hasBracket ? (
          <div
            ref={bracketRef}
            id="road-to-crown-bracket"
            aria-label="Road to the SPL 3.0 Crown Knockout Bracket"
            className={`rounded-3xl border bg-gradient-to-br from-[#0b0e19] via-[#090a13] to-[#110c06] p-4 sm:p-6 shadow-2xl scroll-mt-24 transition-all ${
              activeTab === 'knockout'
                ? 'border-amber-400/70 ring-2 ring-amber-400/35'
                : 'border-amber-400/25'
            }`}
          >
            <div className="flex flex-wrap items-center justify-between gap-2 pb-4 border-b border-white/10">
              <div className="flex items-center gap-2 text-xs sm:text-sm font-display font-black uppercase tracking-[0.2em] text-amber-300">
                <Crown className="w-4 h-4 text-amber-400 shrink-0" />
                <span>Road to the SPL 3.0 Crown</span>
              </div>
              <span className="text-[11px] font-mono text-slate-400">
                Official Knockout Bracket · Tap any fixture to inspect scorecard
              </span>
            </div>

            <div className="pt-5 grid grid-cols-1 lg:grid-cols-3 gap-4 lg:gap-6 items-start">
              {/* Quarter-Finals Column (only when Top 8 / ELIM configured) */}
              {bracketStages.qfs.length > 0 && (
                <div className="space-y-3">
                  <span className="block text-[10px] font-display font-black uppercase tracking-[0.2em] text-sky-300">
                    Quarter-Finals
                  </span>
                  <div className="space-y-2.5">
                    {bracketStages.qfs.map((m) => {
                      const tA = getTeam(m.teamA);
                      const tB = getTeam(m.teamB);
                      const winId = getConfirmedWinnerId(m);
                      const winTeam = winId ? getTeam(winId) : undefined;
                      const isLive = m.status === 'live';
                      const isDone = m.status === 'completed';
                      const courtDimmed = selectedCourt !== 'all' && m.court !== selectedCourt;
                      return (
                        <button
                          key={m.id}
                          type="button"
                          onClick={() => onOpenMatchModal(m)}
                          className={`w-full text-left p-3 rounded-xl bg-[#0a1324]/90 border border-sky-400/30 hover:border-sky-300/60 transition-all space-y-1.5 cursor-pointer ${
                            courtDimmed ? 'opacity-55' : ''
                          }`}
                        >
                          <div className="flex items-center justify-between text-[10px] font-mono text-sky-300">
                            <span>QF-{m.slot || 1} · {resolveCourtLabel(m)}</span>
                            {isLive ? (
                              <span className="inline-flex items-center gap-1 text-red-400 font-bold">
                                <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
                                LIVE
                              </span>
                            ) : isDone ? (
                              <span className="text-emerald-400 font-bold">COMPLETED</span>
                            ) : (
                              <span>{m.status.toUpperCase()}</span>
                            )}
                          </div>
                          <div className="flex items-center justify-between text-xs font-bold">
                            <span className={`truncate ${winId === m.teamA ? 'text-amber-300' : 'text-white'}`}>
                              {tA?.badge || '🏸'} {tA?.name || 'TBD'}
                            </span>
                            <span className="font-mono tabular-nums text-slate-300 pl-2">
                              {m.status === 'upcoming' ? '—' : m.scoreA ?? 0}
                            </span>
                          </div>
                          <div className="flex items-center justify-between text-xs font-bold">
                            <span className={`truncate ${winId === m.teamB ? 'text-amber-300' : 'text-white'}`}>
                              {tB?.badge || '🏸'} {tB?.name || 'TBD'}
                            </span>
                            <span className="font-mono tabular-nums text-slate-300 pl-2">
                              {m.status === 'upcoming' ? '—' : m.scoreB ?? 0}
                            </span>
                          </div>
                          {winTeam && (
                            <div className="pt-1.5 border-t border-sky-400/20 flex items-center gap-1.5 text-[10px] font-bold text-amber-300">
                              <Trophy className="w-3 h-3 shrink-0" />
                              <span className="truncate">Winner: {winTeam.name}</span>
                            </div>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Semi-Finals Column (Semi-Final 1 & Semi-Final 2 — rendered strictly once each) */}
              {bracketStages.sfs.length > 0 && (
                <div className={`space-y-3 ${bracketStages.qfs.length === 0 ? 'lg:col-span-2' : ''}`}>
                  <div className="flex items-center gap-1.5 text-[10px] font-display font-black uppercase tracking-[0.2em] text-violet-300">
                    <Zap className="w-3.5 h-3.5 text-violet-400 shrink-0" />
                    <span>Semi-Finals · Battle for the Final</span>
                  </div>
                  <div className={`grid gap-3 ${bracketStages.qfs.length === 0 ? 'grid-cols-1 sm:grid-cols-2' : 'grid-cols-1'}`}>
                    {bracketStages.sfs.map((m) => {
                      const tA = getTeam(m.teamA);
                      const tB = getTeam(m.teamB);
                      const winId = getConfirmedWinnerId(m);
                      const winTeam = winId ? getTeam(winId) : undefined;
                      const isLive = m.status === 'live';
                      const isPaused = m.status === 'paused';
                      const isDone = m.status === 'completed';
                      const courtDimmed = selectedCourt !== 'all' && m.court !== selectedCourt;
                      return (
                        <button
                          key={m.id}
                          type="button"
                          onClick={() => onOpenMatchModal(m)}
                          className={`w-full text-left p-4 rounded-2xl bg-gradient-to-br from-[#120d2d] to-[#1a0d38] border transition-all space-y-2.5 cursor-pointer ${
                            isLive
                              ? 'border-red-400/75 shadow-[0_0_24px_-8px_rgba(239,68,68,0.45)]'
                              : 'border-violet-400/40 hover:border-violet-300/75'
                          } ${courtDimmed ? 'opacity-55' : ''}`}
                        >
                          <div className="flex items-center justify-between gap-2 text-[10px] font-mono text-violet-200 pb-2 border-b border-white/10">
                            <span className="font-bold tracking-wider">
                              SEMI-FINAL {m.slot || 1} · {resolveCourtLabel(m)}
                            </span>
                            {isLive ? (
                              <span className="inline-flex items-center gap-1 text-red-400 font-black uppercase tracking-wider shrink-0">
                                <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
                                <span>LIVE</span>
                              </span>
                            ) : isPaused ? (
                              <span className="text-amber-300 font-bold uppercase shrink-0">PAUSED</span>
                            ) : isDone ? (
                              <span className="inline-flex items-center gap-1 text-emerald-400 font-bold uppercase shrink-0">
                                <CheckCircle2 className="w-3 h-3" />
                                <span>COMPLETED</span>
                              </span>
                            ) : (
                              <span className="text-sky-300 font-bold uppercase shrink-0">UPCOMING</span>
                            )}
                          </div>

                          <div className="space-y-2">
                            <div className="flex items-center justify-between gap-2 text-xs sm:text-sm font-bold">
                              <div className="min-w-0">
                                <span className={`block truncate ${winId === m.teamA ? 'text-amber-300 font-black' : 'text-white'}`}>
                                  {tA?.badge || '🏸'} {tA?.name || 'Awaiting Qualifier'}
                                </span>
                                {tA && (
                                  <span className="block text-[10px] font-normal text-slate-400 truncate">
                                    {getPlayerNamesSummary(tA)}
                                  </span>
                                )}
                              </div>
                              <span className="font-mono text-base sm:text-lg font-black tabular-nums text-white pl-2 shrink-0">
                                {m.status === 'upcoming' ? '—' : m.scoreA ?? 0}
                              </span>
                            </div>

                            <div className="flex items-center justify-between gap-2 text-xs sm:text-sm font-bold">
                              <div className="min-w-0">
                                <span className={`block truncate ${winId === m.teamB ? 'text-amber-300 font-black' : 'text-white'}`}>
                                  {tB?.badge || '🏸'} {tB?.name || 'Awaiting Qualifier'}
                                </span>
                                {tB && (
                                  <span className="block text-[10px] font-normal text-slate-400 truncate">
                                    {getPlayerNamesSummary(tB)}
                                  </span>
                                )}
                              </div>
                              <span className="font-mono text-base sm:text-lg font-black tabular-nums text-white pl-2 shrink-0">
                                {m.status === 'upcoming' ? '—' : m.scoreB ?? 0}
                              </span>
                            </div>
                          </div>

                          {m.sets && m.sets.length > 1 && (
                            <div className="flex flex-wrap items-center gap-1.5 text-[10px] font-mono text-violet-200 tabular-nums">
                              {m.sets.map((s, sIdx) => (
                                <span key={sIdx} className="px-1.5 py-0.5 rounded bg-white/[0.06]">
                                  S{sIdx + 1}: {s.scoreA}-{s.scoreB}
                                </span>
                              ))}
                            </div>
                          )}

                          {winTeam && (
                            <div className="pt-2 border-t border-violet-400/25 flex items-center gap-1.5 text-[11px] font-display font-bold text-amber-300">
                              <Trophy className="w-3.5 h-3.5 shrink-0 text-amber-400" />
                              <span className="truncate">Winner: {winTeam.name}</span>
                            </div>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Grand Final Column (rendered strictly once) */}
              {bracketStages.finals.length > 0 && (
                <div className={`space-y-3 ${bracketStages.sfs.length === 0 && bracketStages.qfs.length === 0 ? 'lg:col-span-3' : ''}`}>
                  <span className="block text-[10px] font-display font-black uppercase tracking-[0.2em] text-amber-300">
                    The Grand Final · Championship Match
                  </span>
                  {bracketStages.finals.map((m) => {
                    const tA = getTeam(m.teamA);
                    const tB = getTeam(m.teamB);
                    const winId = getConfirmedWinnerId(m);
                    const champ = winId ? getTeam(winId) : undefined;
                    const isLive = m.status === 'live';
                    const isPaused = m.status === 'paused';
                    const isDone = m.status === 'completed';
                    const courtDimmed = selectedCourt !== 'all' && m.court !== selectedCourt;
                    return (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() => onOpenMatchModal(m)}
                        className={`w-full text-left p-4 rounded-2xl bg-gradient-to-br from-[#191104] via-[#120d05] to-[#080603] border transition-all space-y-2.5 cursor-pointer ${
                          isLive
                            ? 'border-red-400 shadow-[0_0_32px_-8px_rgba(239,68,68,0.5)]'
                            : 'border-amber-400/65 hover:border-amber-300 shadow-[0_0_28px_-10px_rgba(245,158,11,0.45)]'
                        } ${courtDimmed ? 'opacity-55' : ''}`}
                      >
                        <div className="flex items-center justify-between gap-2 text-[10px] font-display font-black uppercase tracking-wider text-amber-300 pb-2 border-b border-amber-400/20">
                          <span className="inline-flex items-center gap-1.5 min-w-0 truncate">
                            <Trophy className="w-3.5 h-3.5 shrink-0" />
                            <span className="truncate">GRAND FINAL · {resolveCourtLabel(m)}</span>
                          </span>
                          {isLive ? (
                            <span className="inline-flex items-center gap-1 text-red-400 font-black shrink-0">
                              <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
                              <span>LIVE</span>
                            </span>
                          ) : isPaused ? (
                            <span className="text-amber-300 shrink-0">PAUSED</span>
                          ) : isDone ? (
                            <span className="inline-flex items-center gap-1 text-emerald-400 shrink-0">
                              <CheckCircle2 className="w-3 h-3" />
                              <span>COMPLETED</span>
                            </span>
                          ) : (
                            <span className="text-amber-200 shrink-0">UPCOMING</span>
                          )}
                        </div>

                        <div className="space-y-2">
                          <div className="flex items-center justify-between gap-2 text-xs sm:text-sm font-black">
                            <div className="min-w-0">
                              <span className={`block truncate ${winId === m.teamA ? 'text-amber-300' : 'text-white'}`}>
                                {tA?.badge || '🏆'} {tA?.name || 'Winner of Semi-Final 1'}
                              </span>
                              {tA && (
                                <span className="block text-[10px] font-normal text-slate-400 truncate">
                                  {getPlayerNamesSummary(tA)}
                                </span>
                              )}
                            </div>
                            <span className="font-mono text-base sm:text-lg font-black tabular-nums text-amber-300 pl-2 shrink-0">
                              {m.status === 'upcoming' ? '—' : m.scoreA ?? 0}
                            </span>
                          </div>

                          <div className="flex items-center justify-between gap-2 text-xs sm:text-sm font-black">
                            <div className="min-w-0">
                              <span className={`block truncate ${winId === m.teamB ? 'text-amber-300' : 'text-white'}`}>
                                {tB?.badge || '🏆'} {tB?.name || 'Winner of Semi-Final 2'}
                              </span>
                              {tB && (
                                <span className="block text-[10px] font-normal text-slate-400 truncate">
                                  {getPlayerNamesSummary(tB)}
                                </span>
                              )}
                            </div>
                            <span className="font-mono text-base sm:text-lg font-black tabular-nums text-amber-300 pl-2 shrink-0">
                              {m.status === 'upcoming' ? '—' : m.scoreB ?? 0}
                            </span>
                          </div>
                        </div>

                        {m.sets && m.sets.length > 1 && (
                          <div className="flex flex-wrap items-center gap-1.5 text-[10px] font-mono text-amber-200/90 tabular-nums">
                            {m.sets.map((s, sIdx) => (
                              <span key={sIdx} className="px-1.5 py-0.5 rounded bg-amber-400/10">
                                S{sIdx + 1}: {s.scoreA}-{s.scoreB}
                              </span>
                            ))}
                          </div>
                        )}

                        {champ && (
                          <div className="pt-2 border-t border-amber-400/25 flex items-center gap-1.5 text-[11px] font-display font-black uppercase tracking-wider text-amber-300">
                            <Crown className="w-3.5 h-3.5 shrink-0" />
                            <span className="truncate">Champions: {champ.name}</span>
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        ) : activeTab === 'knockout' ? (
          <div
            ref={bracketRef}
            id="road-to-crown-bracket"
            className="p-10 sm:p-14 text-center rounded-3xl bg-[#0a0d17] border border-amber-400/25 max-w-xl mx-auto"
          >
            <Crown className="w-10 h-10 text-amber-400/80 mx-auto" />
            <h3 className="text-lg font-display font-black text-white uppercase mt-4">
              Road to the SPL 3.0 Crown Awaiting Bracket
            </h3>
            <p className="text-xs sm:text-sm text-slate-400 mt-1.5">
              Semi-Final and Grand Final matchups will appear here automatically once the Knockout Stage bracket is generated.
            </p>
            <button
              type="button"
              onClick={() => setActiveTab('all')}
              className="mt-5 px-5 py-2.5 min-h-[44px] rounded-xl text-xs font-display font-bold uppercase tracking-wider bg-amber-400 hover:bg-amber-300 text-slate-950 transition-colors cursor-pointer"
            >
              View League Fixtures
            </button>
          </div>
        ) : null}
      </div>
    </section>
  );
});
