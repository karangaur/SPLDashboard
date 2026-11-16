import React, { useState } from 'react';
import {
  AlertTriangle,
  ArrowLeftRight,
  Award,
  Calendar,
  CheckCircle2,
  Clock,
  Crown,
  Edit3,
  Flame,
  Lock,
  Maximize2,
  RotateCcw,
  Sliders,
  Sparkles,
  Swords,
  Trophy,
  UserCheck,
} from 'lucide-react';
import {
  KnockoutData,
  KnockoutMatch,
  Match,
  Player,
  PlayoffConflictWarning,
  PlayoffRoundType,
  Team,
} from '../../types/tournament';
import {
  canStartOrScorePlayoffMatch,
  formatParticipantSourceLabel,
  getPlayoffMatchDisplayLabel,
  inferPlayoffRound,
} from '../../utils/playoffEngine';

export interface IPLPlayoffBracketProps {
  mode: 'admin' | 'public';
  knockout: KnockoutData;
  teams: Team[];
  players: Player[];
  courtNames?: string[];
  seasonLabel?: string;
  allowScheduleEditing?: boolean;
  conflictWarnings?: PlayoffConflictWarning[];
  onSelectMatch?: (match: Match) => void;
  onGoLive?: (matchId: string) => void;
  onOpenUmpire?: (matchId: string) => void;
  onEditSchedule?: (match: KnockoutMatch) => void;
  onEditMatchup?: (match: KnockoutMatch) => void;
  onSwapTeams?: (match: KnockoutMatch) => void;
  onResetMatch?: (match: KnockoutMatch) => void;
}

function toPublicMatchShape(
  km: KnockoutMatch,
  format: KnockoutData['format'],
  courtNames?: string[]
): Match {
  const cNum = km.court || 1;
  const cName = km.courtName || courtNames?.[cNum - 1]?.trim() || `Court ${cNum}`;
  const label = getPlayoffMatchDisplayLabel(km, format);
  return {
    id: km.id,
    round: label.playoffRound === 'F' ? 999 : label.playoffRound === 'Q2' || label.playoffRound === 'SF' ? 998 : 997,
    court: cNum,
    courtName: cName,
    teamA: km.teamA || '',
    teamB: km.teamB || '',
    scoreA: km.scoreA,
    scoreB: km.scoreB,
    status: km.status,
    winner: km.winner,
    time: km.scheduledTime
      ? `${km.scheduledDate ? `${km.scheduledDate} ` : ''}${km.scheduledTime}`
      : km.time || `${label.title} · ${cName}`,
    date: km.scheduledDate,
    startTime: km.scheduledTime,
    sets: km.sets,
    mvpPlayerId: km.mvpPlayerId,
    version: km.version,
    matchType: 'knockout',
    stage: km.stage,
    playoffRound: label.playoffRound,
    slot: km.slot,
    stageLabel: label.title,
  };
}

export const IPLPlayoffBracket: React.FC<IPLPlayoffBracketProps> = ({
  mode,
  knockout,
  teams,
  players,
  courtNames,
  seasonLabel = 'SPL 3.0 Champion Edition',
  allowScheduleEditing = true,
  conflictWarnings = [],
  onSelectMatch,
  onGoLive,
  onOpenUmpire,
  onEditSchedule,
  onEditMatchup,
  onSwapTeams,
  onResetMatch,
}) => {
  const [mobileStageFilter, setMobileStageFilter] = useState<string>('ALL');

  const teamMap = React.useMemo(() => new Map(teams.map((t) => [t.id, t])), [teams]);
  const playerMap = React.useMemo(() => new Map(players.map((p) => [p.id, p])), [players]);

  const getTeam = (id?: string) => (id ? teamMap.get(id) : undefined);
  const getTeamPlayersText = (team?: Team, fallback = 'Awaiting Qualification') => {
    if (!team) return fallback;
    const names = (team.players || [])
      .map((pid) => playerMap.get(pid)?.name)
      .filter((n): n is string => Boolean(n));
    return names.length > 0 ? names.join(' & ') : 'Doubles Pair';
  };

  const resolveCourt = (km?: KnockoutMatch) => {
    if (!km) return 'Court 1';
    const cNum = km.court || 1;
    return km.courtName || courtNames?.[cNum - 1]?.trim() || `Court ${cNum}`;
  };

  const matches = knockout?.matches || [];
  const format = knockout?.format || 'top4';
  const qualifiedSeeds = knockout?.qualifiedTeams || [];

  const seedRankByTeamId = React.useMemo(() => {
    const map = new Map<string, number>();
    for (const s of qualifiedSeeds) {
      map.set(s.teamId, s.rank);
    }
    return map;
  }, [qualifiedSeeds]);

  const isIplFormat =
    format === 'ipl_top4' ||
    matches.some((m) => m.playoffRound === 'Q1' || m.playoffRound === 'Q2');

  const q1 = matches.find((m) => inferPlayoffRound(m, format) === 'Q1');
  const elim = matches.find((m) => inferPlayoffRound(m, format) === 'ELIM');
  const q2 = matches.find((m) => inferPlayoffRound(m, format) === 'Q2');
  const finalMatch =
    matches.find((m) => inferPlayoffRound(m, format) === 'F' || m.stage === 'F') ||
    matches[matches.length - 1];

  const prelimMatches = React.useMemo(
    () =>
      matches
        .filter((m) => m.playoffRound === 'PRELIM')
        .sort((a, b) => (a.slot || 1) - (b.slot || 1)),
    [matches]
  );

  const elimMatches = React.useMemo(
    () =>
      matches
        .filter(
          (m) =>
            !isIplFormat &&
            m.playoffRound !== 'PRELIM' &&
            (m.stage === 'ELIM' || m.stage === 'QF' || m.playoffRound === 'ELIM')
        )
        .sort((a, b) => (a.slot || 1) - (b.slot || 1)),
    [matches, isIplFormat]
  );

  const sfMatches = React.useMemo(
    () =>
      matches
        .filter(
          (m) =>
            !isIplFormat &&
            (m.stage === 'SF' || m.playoffRound === 'SF') &&
            m.playoffRound !== 'Q1' &&
            m.playoffRound !== 'Q2'
        )
        .sort((a, b) => (a.slot || 1) - (b.slot || 1)),
    [matches, isIplFormat]
  );

  const championTeam =
    finalMatch?.status === 'completed' && finalMatch.winner
      ? getTeam(finalMatch.winner)
      : knockout.championTeamId
      ? getTeam(knockout.championTeamId)
      : undefined;

  const runnerUpTeam =
    finalMatch?.status === 'completed' && finalMatch.winner && finalMatch.teamA && finalMatch.teamB
      ? getTeam(finalMatch.winner === finalMatch.teamA ? finalMatch.teamB : finalMatch.teamA)
      : knockout.runnerUpTeamId
      ? getTeam(knockout.runnerUpTeamId)
      : undefined;

  // Determine where each seed enters the bracket for the Seed Summary Banner
  const getSeedEntryLabel = (rank: number, teamId: string): string => {
    const rankToken = `RANK_${rank}`;
    const directMatch = matches.find(
      (m) =>
        m.participantASource === rankToken ||
        m.participantBSource === rankToken ||
        m.teamA === teamId ||
        m.teamB === teamId
    );
    if (!directMatch) return 'Qualified Seed';
    if (directMatch.stage === 'F' || directMatch.playoffRound === 'F') {
      return format === 'top3' ? 'Direct Grand Final (Bye)' : 'Grand Final';
    }
    if (directMatch.playoffRound === 'Q1') return 'Qualifier 1';
    if (directMatch.playoffRound === 'Q2') return 'Qualifier 2';
    if (directMatch.stage === 'SF' || directMatch.playoffRound === 'SF') {
      const hasElimRound = elimMatches.length > 0 || prelimMatches.length > 0;
      return hasElimRound
        ? `Direct ${directMatch.matchLabel || `Semi-Final ${directMatch.slot || 1}`} (Bye)`
        : directMatch.matchLabel || `Semi-Final ${directMatch.slot || 1}`;
    }
    return directMatch.matchLabel || `Eliminator ${directMatch.slot || 1}`;
  };

  // Resolve next stage destination text for a match
  const getNextProgressionText = (km: KnockoutMatch, round: PlayoffRoundType): string => {
    if (round === 'F' || km.stage === 'F') return '· SPL Champion!';
    if (km.nextMatchCode) {
      const target = matches.find((m) => m.matchCode === km.nextMatchCode);
      if (target) {
        return `→ ${target.matchLabel || target.matchCode}`;
      }
      if (km.nextMatchCode === 'FINAL' || km.nextMatchCode === 'F') return '→ Grand Final';
      if (km.nextMatchCode.startsWith('SF')) return `→ Semi-Final ${km.nextMatchCode.replace('SF', '')}`;
    }
    if (round === 'Q1') return '→ Grand Final';
    if (round === 'ELIM' && isIplFormat) return '→ Qualifier 2';
    if (round === 'Q2' || round === 'SF' || km.stage === 'SF') return '→ Grand Final';
    return '→ Next Round';
  };

  const renderMatchCard = (km: KnockoutMatch | undefined, roundOverride?: PlayoffRoundType) => {
    if (!km) {
      return (
        <div className="rounded-2xl border border-dashed border-white/10 bg-slate-900/40 p-4 text-center text-xs text-slate-500">
          Fixture not initialized
        </div>
      );
    }

    const round: PlayoffRoundType =
      roundOverride ||
      km.playoffRound ||
      inferPlayoffRound(km, format) ||
      (km.stage === 'F' ? 'F' : km.stage === 'SF' ? 'SF' : 'ELIM');

    const meta = getPlayoffMatchDisplayLabel(km, format);
    const teamA = getTeam(km.teamA);
    const teamB = getTeam(km.teamB);
    const isCompleted = km.status === 'completed';
    const isLive = km.status === 'live';
    const isPaused = km.status === 'paused' || km.status === 'postponed';
    const hasStarted = isLive || isPaused || isCompleted;

    const winnerId =
      isCompleted && km.winner && (km.winner === km.teamA || km.winner === km.teamB)
        ? km.winner
        : undefined;
    const isWinnerA = Boolean(winnerId && winnerId === km.teamA);
    const isWinnerB = Boolean(winnerId && winnerId === km.teamB);

    const bothAssigned = Boolean(km.teamA && km.teamB && km.teamA !== km.teamB);
    const iplGuard = isIplFormat
      ? canStartOrScorePlayoffMatch(km, matches, 'ipl_top4')
      : {
          allowed: bothAssigned,
          reason: bothAssigned
            ? undefined
            : 'Waiting for upstream knockout match completion or team assignment.',
        };

    const warnings = conflictWarnings.filter((w) => w.matchId === km.id);

    const placeholderA = formatParticipantSourceLabel(
      km.participantASource,
      matches,
      qualifiedSeeds,
      teams,
      round === 'Q1'
        ? 'Rank #1 Seed'
        : round === 'ELIM' && isIplFormat
        ? 'Rank #3 Seed'
        : round === 'Q2'
        ? 'Qualifier 1 Loser'
        : round === 'F'
        ? isIplFormat
          ? 'Qualifier 1 Winner'
          : 'Winner of Semi-Final 1'
        : 'TBD Participant A'
    );

    const placeholderB = formatParticipantSourceLabel(
      km.participantBSource,
      matches,
      qualifiedSeeds,
      teams,
      round === 'Q1'
        ? 'Rank #2 Seed'
        : round === 'ELIM' && isIplFormat
        ? 'Rank #4 Seed'
        : round === 'Q2'
        ? 'Eliminator Winner'
        : round === 'F'
        ? isIplFormat
          ? 'Qualifier 2 Winner'
          : 'Winner of Semi-Final 2'
        : 'TBD Participant B'
    );

    const seedA =
      km.seedA ||
      (km.teamA ? seedRankByTeamId.get(km.teamA) : undefined) ||
      (km.participantASource?.startsWith('RANK_')
        ? parseInt(km.participantASource.replace('RANK_', ''), 10)
        : undefined);

    const seedB =
      km.seedB ||
      (km.teamB ? seedRankByTeamId.get(km.teamB) : undefined) ||
      (km.participantBSource?.startsWith('RANK_')
        ? parseInt(km.participantBSource.replace('RANK_', ''), 10)
        : undefined);

    const roundAccent =
      round === 'F'
        ? 'border-amber-400/60 bg-gradient-to-br from-[#191104] via-[#120d05] to-[#080603]'
        : round === 'Q2' || round === 'SF'
        ? 'border-violet-400/45 bg-gradient-to-br from-[#110c28] via-[#0c0a1c] to-[#07060f]'
        : round === 'ELIM'
        ? 'border-rose-400/40 bg-gradient-to-br from-[#1a0b11] via-[#100912] to-[#07070c]'
        : 'border-sky-400/45 bg-gradient-to-br from-[#091529] via-[#0a0f1f] to-[#060912]';

    const badgeColor =
      round === 'F'
        ? 'bg-amber-400/20 text-amber-300 border-amber-400/40'
        : round === 'Q2' || round === 'SF'
        ? 'bg-violet-500/20 text-violet-300 border-violet-400/40'
        : round === 'ELIM'
        ? 'bg-rose-500/20 text-rose-300 border-rose-400/40'
        : 'bg-sky-500/20 text-sky-300 border-sky-400/40';

    const scheduleStr =
      km.scheduledDate || km.scheduledTime
        ? [km.scheduledDate, km.scheduledTime].filter(Boolean).join(' · ')
        : undefined;

    const handleCardClick = () => {
      if (mode === 'public' && onSelectMatch) {
        onSelectMatch(toPublicMatchShape(km, format, courtNames));
      }
    };

    const WrapperTag = mode === 'public' && onSelectMatch ? 'button' : 'div';
    const wrapperProps =
      mode === 'public' && onSelectMatch
        ? { type: 'button' as const, onClick: handleCardClick }
        : {};

    return (
      <WrapperTag
        {...wrapperProps}
        className={`w-full text-left rounded-2xl border p-4 transition-all space-y-3 min-w-0 ${roundAccent} ${
          isLive
            ? 'ring-2 ring-rose-500/50 shadow-[0_0_28px_-8px_rgba(244,63,94,0.45)]'
            : mode === 'public' && onSelectMatch
            ? 'hover:border-amber-300/70 cursor-pointer'
            : ''
        }`}
      >
        {/* Header Bar */}
        <div className="flex flex-wrap items-center justify-between gap-2 pb-2.5 border-b border-white/10">
          <div className="flex items-center gap-2 min-w-0">
            <span
              className={`px-2 py-0.5 rounded-md text-[10px] font-mono font-black uppercase border shrink-0 ${badgeColor}`}
            >
              {km.matchCode || meta.shortCode}
            </span>
            <div className="min-w-0">
              <h4 className="font-display font-black text-sm text-white uppercase tracking-wide truncate">
                {km.matchLabel || meta.title}
              </h4>
              <p className="text-[10px] text-slate-400 truncate">{resolveCourt(km)}</p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            {isLive ? (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-rose-500/20 border border-rose-400/50 text-[10px] font-black uppercase text-rose-300">
                <span className="w-1.5 h-1.5 rounded-full bg-rose-400 animate-pulse motion-reduce:animate-none" />
                LIVE
              </span>
            ) : isPaused ? (
              <span className="px-2 py-0.5 rounded-full bg-amber-500/20 border border-amber-400/40 text-[10px] font-black uppercase text-amber-300">
                PAUSE
              </span>
            ) : isCompleted ? (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-400/35 text-[10px] font-black uppercase text-emerald-300">
                <CheckCircle2 className="w-3 h-3" />
                COMPLETED
              </span>
            ) : !iplGuard.allowed ? (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-slate-800/90 border border-white/10 text-[10px] font-bold uppercase text-slate-400">
                <Lock className="w-2.5 h-2.5" />
                AWAITING TEAMS
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-sky-500/15 border border-sky-400/30 text-[10px] font-bold uppercase text-sky-300">
                <Clock className="w-2.5 h-2.5" />
                SCHEDULED
              </span>
            )}
          </div>
        </div>

        {/* Subtitle & Schedule / Umpire Metadata */}
        <div className="space-y-1">
          <p className="text-[11px] text-slate-400 leading-snug">{meta.subtitle}</p>
          {(scheduleStr || km.assignedUmpire) && (
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] font-mono text-slate-300 pt-0.5">
              {scheduleStr && (
                <span className="inline-flex items-center gap-1 text-amber-200/90">
                  <Calendar className="w-3 h-3 text-amber-400 shrink-0" />
                  <span>{scheduleStr}</span>
                </span>
              )}
              {km.assignedUmpire && (
                <span className="inline-flex items-center gap-1 text-slate-300">
                  <UserCheck className="w-3 h-3 text-emerald-400 shrink-0" />
                  <span>Umpire: {km.assignedUmpire}</span>
                </span>
              )}
            </div>
          )}
        </div>

        {/* Team A & Team B Rows */}
        <div className="space-y-2">
          {/* Team A */}
          <div
            className={`flex items-center justify-between gap-2 p-2.5 rounded-xl border transition-colors ${
              isWinnerA
                ? 'bg-emerald-500/12 border-emerald-400/45'
                : 'bg-white/[0.04] border-white/5'
            }`}
          >
            <div className="flex items-center gap-2 min-w-0">
              {seedA ? (
                <span className="w-6 h-6 rounded-lg bg-amber-400/15 border border-amber-400/35 text-amber-300 font-mono font-black text-[10px] flex items-center justify-center shrink-0">
                  #{seedA}
                </span>
              ) : (
                <span className="text-lg shrink-0">{teamA?.badge || '🏸'}</span>
              )}
              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  {seedA && teamA?.badge && (
                    <span className="text-sm shrink-0">{teamA.badge}</span>
                  )}
                  <span
                    className={`text-xs sm:text-sm font-bold truncate ${
                      isWinnerA
                        ? 'text-amber-300 font-black'
                        : teamA
                        ? 'text-white'
                        : 'text-slate-400 italic'
                    }`}
                  >
                    {teamA?.name || placeholderA}
                  </span>
                  {isWinnerA && <Crown className="w-3.5 h-3.5 text-amber-400 shrink-0" />}
                </div>
                <span className="block text-[10px] text-slate-400 truncate">
                  {teamA ? getTeamPlayersText(teamA, placeholderA) : placeholderA}
                </span>
              </div>
            </div>
            <span className="font-mono font-black text-lg tabular-nums text-white pl-2 shrink-0">
              {hasStarted ? km.scoreA ?? 0 : '—'}
            </span>
          </div>

          {/* Team B */}
          <div
            className={`flex items-center justify-between gap-2 p-2.5 rounded-xl border transition-colors ${
              isWinnerB
                ? 'bg-emerald-500/12 border-emerald-400/45'
                : 'bg-white/[0.04] border-white/5'
            }`}
          >
            <div className="flex items-center gap-2 min-w-0">
              {seedB ? (
                <span className="w-6 h-6 rounded-lg bg-amber-400/15 border border-amber-400/35 text-amber-300 font-mono font-black text-[10px] flex items-center justify-center shrink-0">
                  #{seedB}
                </span>
              ) : (
                <span className="text-lg shrink-0">{teamB?.badge || '🏸'}</span>
              )}
              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  {seedB && teamB?.badge && (
                    <span className="text-sm shrink-0">{teamB.badge}</span>
                  )}
                  <span
                    className={`text-xs sm:text-sm font-bold truncate ${
                      isWinnerB
                        ? 'text-amber-300 font-black'
                        : teamB
                        ? 'text-white'
                        : 'text-slate-400 italic'
                    }`}
                  >
                    {teamB?.name || placeholderB}
                  </span>
                  {isWinnerB && <Crown className="w-3.5 h-3.5 text-amber-400 shrink-0" />}
                </div>
                <span className="block text-[10px] text-slate-400 truncate">
                  {teamB ? getTeamPlayersText(teamB, placeholderB) : placeholderB}
                </span>
              </div>
            </div>
            <span className="font-mono font-black text-lg tabular-nums text-white pl-2 shrink-0">
              {hasStarted ? km.scoreB ?? 0 : '—'}
            </span>
          </div>
        </div>

        {/* Multi-set pills if present */}
        {km.sets && km.sets.length > 1 && (
          <div className="flex flex-wrap items-center gap-1.5 text-[10px] font-mono text-slate-300 tabular-nums">
            {km.sets.map((s, idx) => (
              <span key={idx} className="px-1.5 py-0.5 rounded bg-white/10">
                S{idx + 1}: {s.scoreA}-{s.scoreB}
              </span>
            ))}
          </div>
        )}

        {/* Progression Callout when completed */}
        {isCompleted && winnerId && (
          <div className="pt-2 border-t border-white/10 flex flex-wrap items-center justify-between gap-2 text-[10px] font-bold">
            <span className="text-emerald-300 flex items-center gap-1 min-w-0">
              <Trophy className="w-3 h-3 text-amber-400 shrink-0" />
              <span className="truncate">
                {getTeam(winnerId)?.name} {getNextProgressionText(km, round)}
              </span>
            </span>
            {km.loserId && (
              <span className="text-slate-400 shrink-0">
                {getTeam(km.loserId)?.name}{' '}
                {round === 'Q1' ? '→ Qualifier 2' : round === 'F' ? '(Runner-Up)' : 'Eliminated'}
              </span>
            )}
          </div>
        )}

        {/* Admin Conflict Warnings & Action Buttons (strictly admin mode only) */}
        {mode === 'admin' && (
          <div className="pt-2.5 border-t border-white/10 space-y-2">
            {warnings.map((w, idx) => (
              <div
                key={idx}
                className="flex items-start gap-1.5 px-2.5 py-1.5 rounded-lg bg-amber-500/15 border border-amber-400/35 text-[11px] text-amber-200"
              >
                <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
                <span>{w.message}</span>
              </div>
            ))}

            {!iplGuard.allowed && iplGuard.reason && (
              <p className="text-[11px] text-slate-400 flex items-center gap-1.5">
                <Lock className="w-3 h-3 text-slate-500 shrink-0" />
                <span>{iplGuard.reason}</span>
              </p>
            )}

            <div className="flex flex-wrap items-center gap-1.5">
              {onEditMatchup && km.status !== 'live' && (
                <button
                  type="button"
                  onClick={() => onEditMatchup(km)}
                  className="px-2.5 py-1.5 min-h-[36px] rounded-xl text-[11px] font-semibold text-sky-200 bg-sky-500/10 hover:bg-sky-500/20 border border-sky-400/30 flex items-center gap-1.5 transition-colors cursor-pointer"
                  title="Edit teams or qualification sources for this match"
                >
                  <Sliders className="w-3.5 h-3.5 text-sky-400 shrink-0" />
                  <span>Teams</span>
                </button>
              )}

              {onSwapTeams && km.status === 'upcoming' && (
                <button
                  type="button"
                  onClick={() => onSwapTeams(km)}
                  className="px-2.5 py-1.5 min-h-[36px] rounded-xl text-[11px] font-semibold text-slate-200 bg-white/5 hover:bg-white/10 border border-white/10 flex items-center gap-1 transition-colors cursor-pointer"
                  title="Swap Team A and Team B"
                >
                  <ArrowLeftRight className="w-3.5 h-3.5 text-slate-300 shrink-0" />
                  <span>Swap</span>
                </button>
              )}

              {allowScheduleEditing && onEditSchedule && (
                <button
                  type="button"
                  onClick={() => onEditSchedule(km)}
                  className="px-2.5 py-1.5 min-h-[36px] rounded-xl text-[11px] font-semibold text-slate-200 bg-white/5 hover:bg-white/10 border border-white/10 flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <Edit3 className="w-3.5 h-3.5 text-amber-300 shrink-0" />
                  <span>Schedule</span>
                </button>
              )}

              {onResetMatch && hasStarted && km.status !== 'live' && (
                <button
                  type="button"
                  onClick={() => onResetMatch(km)}
                  className="px-2.5 py-1.5 min-h-[36px] rounded-xl text-[11px] font-semibold text-rose-200 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-400/30 flex items-center gap-1 transition-colors cursor-pointer"
                  title="Reset match result"
                >
                  <RotateCcw className="w-3 h-3 text-rose-300 shrink-0" />
                  <span>Reset</span>
                </button>
              )}

              {iplGuard.allowed && km.status === 'upcoming' && onGoLive && (
                <button
                  type="button"
                  onClick={() => onGoLive(km.id)}
                  className="px-2.5 py-1.5 min-h-[36px] rounded-xl text-[11px] font-black text-slate-950 bg-emerald-400 hover:bg-emerald-300 flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <Flame className="w-3.5 h-3.5 shrink-0" />
                  <span>Go Live</span>
                </button>
              )}

              {iplGuard.allowed && onOpenUmpire && (
                <button
                  type="button"
                  onClick={() => onOpenUmpire(km.id)}
                  className="ml-auto px-2.5 py-1.5 min-h-[36px] rounded-xl text-[11px] font-bold text-amber-300 bg-amber-500/15 hover:bg-amber-500/25 border border-amber-400/35 flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <Maximize2 className="w-3.5 h-3.5 shrink-0" />
                  <span>{isCompleted ? 'Correct / View' : 'Umpire Mode'}</span>
                </button>
              )}
            </div>
          </div>
        )}
      </WrapperTag>
    );
  };

  // Build stage columns for flexible single-elimination formats
  const flexibleColumns = React.useMemo(() => {
    if (isIplFormat) return [];
    const cols: {
      key: string;
      title: string;
      subtitle: string;
      accentText: string;
      round: PlayoffRoundType;
      matches: KnockoutMatch[];
    }[] = [];

    if (prelimMatches.length > 0) {
      cols.push({
        key: 'PRELIM',
        title: 'Preliminary Round',
        subtitle: `${prelimMatches.length} Play-In ${prelimMatches.length === 1 ? 'Match' : 'Matches'}`,
        accentText: 'text-sky-300',
        round: 'PRELIM',
        matches: prelimMatches,
      });
    }
    if (elimMatches.length > 0) {
      cols.push({
        key: 'ELIM',
        title: 'Eliminators',
        subtitle: `${elimMatches.length} Knockout ${elimMatches.length === 1 ? 'Tie' : 'Ties'}`,
        accentText: 'text-rose-300',
        round: 'ELIM',
        matches: elimMatches,
      });
    }
    if (sfMatches.length > 0) {
      cols.push({
        key: 'SF',
        title: 'Semi Finals',
        subtitle: `${sfMatches.length} Championship ${sfMatches.length === 1 ? 'Semi-Final' : 'Semi-Finals'}`,
        accentText: 'text-violet-300',
        round: 'SF',
        matches: sfMatches,
      });
    }
    if (finalMatch) {
      cols.push({
        key: 'F',
        title: 'Grand Final',
        subtitle: 'Championship Title Match',
        accentText: 'text-amber-300',
        round: 'F',
        matches: [finalMatch],
      });
    }
    return cols;
  }, [isIplFormat, prelimMatches, elimMatches, sfMatches, finalMatch]);

  return (
    <div className="space-y-6 min-w-0 overflow-x-hidden">
      {/* Qualified Seed Cards (Supports Top 2 through Custom N teams) */}
      {qualifiedSeeds.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {qualifiedSeeds.map((seed) => {
            const teamObj = getTeam(seed.teamId);
            const playerLine =
              seed.playerNames && seed.playerNames.length > 0
                ? seed.playerNames.join(' & ')
                : getTeamPlayersText(teamObj, 'Doubles Pair');
            const seedDestination = isIplFormat
              ? seed.rank <= 2
                ? 'Qualifier 1'
                : 'Eliminator'
              : getSeedEntryLabel(seed.rank, seed.teamId);
            const isTopSeed = seed.rank <= 2;

            return (
              <div
                key={`${seed.rank}-${seed.teamId}`}
                className={`p-3 rounded-2xl border flex items-center justify-between gap-2.5 min-w-0 ${
                  isTopSeed
                    ? 'bg-amber-500/[0.06] border-amber-400/30'
                    : 'bg-white/[0.03] border-white/10'
                }`}
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <div
                    className={`w-8 h-8 rounded-xl font-mono font-black text-xs flex items-center justify-center shrink-0 ${
                      seed.rank === 1
                        ? 'bg-amber-400 text-slate-950'
                        : seed.rank === 2
                        ? 'bg-slate-200 text-slate-950'
                        : 'bg-white/10 text-amber-300'
                    }`}
                  >
                    #{seed.rank}
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="shrink-0">{teamObj?.badge || '🏸'}</span>
                      <span className="font-bold text-xs sm:text-sm text-white truncate">
                        {teamObj?.name || seed.teamName}
                      </span>
                    </div>
                    <span className="block text-[10px] text-slate-400 truncate">{playerLine}</span>
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <span className="block font-mono font-bold text-xs text-amber-300 tabular-nums">
                    {seed.points} pts
                  </span>
                  <span className="block text-[9px] font-bold uppercase tracking-wider text-slate-400 max-w-[130px] truncate">
                    {seedDestination}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Layout A: Connected 3-Stage SPL Top-4 Qualifier / Eliminator Flow */}
      {isIplFormat ? (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 lg:gap-4 items-center">
          {/* Stage 1 (Col 1–4): Qualifier 1 + Eliminator */}
          <div className="lg:col-span-4 space-y-4 min-w-0">
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-[10px] font-display font-black uppercase tracking-[0.18em] text-sky-300">
                <span className="flex items-center gap-1.5">
                  <Swords className="w-3.5 h-3.5 text-sky-400" />
                  Qualifier 1 · Top 2 Clash
                </span>
                <span className="font-mono text-slate-400">#1 vs #2</span>
              </div>
              {renderMatchCard(q1, 'Q1')}
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-[10px] font-display font-black uppercase tracking-[0.18em] text-rose-300">
                <span className="flex items-center gap-1.5">
                  <Flame className="w-3.5 h-3.5 text-rose-400" />
                  Eliminator · Knockout Tie
                </span>
                <span className="font-mono text-slate-400">#3 vs #4</span>
              </div>
              {renderMatchCard(elim, 'ELIM')}
            </div>
          </div>

          {/* Desktop Connector Arrow 1 */}
          <div className="hidden lg:flex lg:col-span-1 flex-col items-center justify-center text-slate-500 select-none">
            <svg viewBox="0 0 60 220" className="w-12 h-52 text-amber-400/35" fill="none" aria-hidden="true">
              <path d="M0 40 C30 40, 28 95, 58 95" stroke="currentColor" strokeWidth="2" strokeDasharray="4 3" />
              <path d="M0 180 C30 180, 28 125, 58 125" stroke="currentColor" strokeWidth="2" />
              <circle cx="56" cy="95" r="3" fill="currentColor" />
              <circle cx="56" cy="125" r="3" fill="currentColor" />
            </svg>
          </div>

          {/* Stage 2 (Col 6–8): Qualifier 2 */}
          <div className="lg:col-span-3 space-y-2 min-w-0">
            <div className="flex items-center justify-between text-[10px] font-display font-black uppercase tracking-[0.18em] text-violet-300">
              <span className="flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-violet-400" />
                Qualifier 2 · Semi-Final
              </span>
              <span className="font-mono text-slate-400">Second Chance</span>
            </div>
            {renderMatchCard(q2, 'Q2')}
          </div>

          {/* Desktop Connector Arrow 2 */}
          <div className="hidden lg:flex lg:col-span-1 flex-col items-center justify-center text-amber-400/40 select-none">
            <svg viewBox="0 0 60 120" className="w-12 h-28" fill="none" aria-hidden="true">
              <path d="M0 60 L56 60" stroke="currentColor" strokeWidth="2.5" />
              <path d="M48 52 L58 60 L48 68" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>

          {/* Stage 3 (Col 10–12): Grand Final + Champion Crest */}
          <div className="lg:col-span-3 space-y-3 min-w-0">
            <div className="flex items-center justify-between text-[10px] font-display font-black uppercase tracking-[0.18em] text-amber-300">
              <span className="flex items-center gap-1.5">
                <Trophy className="w-3.5 h-3.5 text-amber-400" />
                Grand Final
              </span>
              <span className="font-mono text-amber-200/80">Title Match</span>
            </div>
            {renderMatchCard(finalMatch, 'F')}

            {championTeam && (
              <div className="rounded-2xl border border-amber-400/50 bg-gradient-to-br from-amber-500/20 via-amber-600/10 to-slate-950 p-4 text-center space-y-1.5 shadow-[0_0_28px_-10px_rgba(245,158,11,0.5)]">
                <div className="inline-flex items-center gap-1.5 text-[10px] font-black uppercase tracking-[0.2em] text-amber-300">
                  <Award className="w-3.5 h-3.5" />
                  <span>SPL Champion · {seasonLabel}</span>
                </div>
                <div className="text-lg font-display font-black text-white truncate">
                  {championTeam.badge || '🏆'} {championTeam.name}
                </div>
                <p className="text-[11px] text-amber-100/90 truncate">
                  {getTeamPlayersText(championTeam, 'Championship Pair')}
                </p>
                {runnerUpTeam && (
                  <p className="text-[10px] text-slate-400 truncate">
                    Runner-Up: {runnerUpTeam.name}
                  </p>
                )}
              </div>
            )}
          </div>
        </div>
      ) : (
        /* Layout B: Multi-Stage Flexible Knockout Bracket (Top 2 / 3 / 4 / 5 / 6 / 7 / 8 / Custom) */
        <div className="space-y-4">
          {/* Mobile Round Filter Bar */}
          {flexibleColumns.length > 1 && (
            <div className="flex lg:hidden items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar">
              <button
                type="button"
                onClick={() => setMobileStageFilter('ALL')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold uppercase tracking-wider shrink-0 border transition-colors cursor-pointer ${
                  mobileStageFilter === 'ALL'
                    ? 'bg-amber-400 text-slate-950 border-amber-300'
                    : 'bg-white/5 text-slate-300 border-white/10'
                }`}
              >
                All Rounds ({matches.length})
              </button>
              {flexibleColumns.map((col) => (
                <button
                  key={col.key}
                  type="button"
                  onClick={() => setMobileStageFilter(col.key)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold uppercase tracking-wider shrink-0 border transition-colors cursor-pointer ${
                    mobileStageFilter === col.key
                      ? 'bg-amber-400 text-slate-950 border-amber-300'
                      : 'bg-white/5 text-slate-300 border-white/10'
                  }`}
                >
                  {col.title} ({col.matches.length})
                </button>
              ))}
            </div>
          )}

          {/* Connected Multi-Column Bracket Grid */}
          <div
            className={`grid grid-cols-1 gap-5 items-center ${
              flexibleColumns.length === 1
                ? 'lg:grid-cols-1 max-w-xl mx-auto'
                : flexibleColumns.length === 2
                ? 'lg:grid-cols-2'
                : flexibleColumns.length === 3
                ? 'lg:grid-cols-3'
                : 'lg:grid-cols-4'
            }`}
          >
            {flexibleColumns.map((col) => {
              const hiddenOnMobile =
                mobileStageFilter !== 'ALL' && mobileStageFilter !== col.key;
              return (
                <div
                  key={col.key}
                  className={`${hiddenOnMobile ? 'hidden lg:block' : 'block'} space-y-4 min-w-0`}
                >
                  <div className="flex items-center justify-between px-1 pb-1 border-b border-white/10">
                    <span
                      className={`flex items-center gap-1.5 text-[11px] font-display font-black uppercase tracking-[0.18em] ${col.accentText}`}
                    >
                      {col.key === 'F' ? (
                        <Trophy className="w-3.5 h-3.5 text-amber-400" />
                      ) : col.key === 'SF' ? (
                        <Sparkles className="w-3.5 h-3.5 text-violet-400" />
                      ) : (
                        <Swords className="w-3.5 h-3.5 text-rose-400" />
                      )}
                      {col.title}
                    </span>
                    <span className="font-mono text-[10px] text-slate-400">{col.subtitle}</span>
                  </div>

                  <div className="space-y-4">
                    {col.matches.map((m) => (
                      <div key={m.id}>{renderMatchCard(m, col.round)}</div>
                    ))}
                  </div>

                  {/* Champion Banner under Grand Final column */}
                  {col.key === 'F' && championTeam && (
                    <div className="rounded-2xl border border-amber-400/50 bg-gradient-to-br from-amber-500/20 via-amber-600/10 to-slate-950 p-4 text-center space-y-1.5 shadow-[0_0_28px_-10px_rgba(245,158,11,0.5)]">
                      <div className="inline-flex items-center gap-1.5 text-[10px] font-black uppercase tracking-[0.2em] text-amber-300">
                        <Award className="w-3.5 h-3.5" />
                        <span>SPL Champion · {seasonLabel}</span>
                      </div>
                      <div className="text-lg font-display font-black text-white truncate">
                        {championTeam.badge || '🏆'} {championTeam.name}
                      </div>
                      <p className="text-[11px] text-amber-100/90 truncate">
                        {getTeamPlayersText(championTeam, 'Championship Pair')}
                      </p>
                      {runnerUpTeam && (
                        <p className="text-[10px] text-slate-400 truncate">
                          Runner-Up: {runnerUpTeam.name}
                        </p>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
