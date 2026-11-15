import React from 'react';
import {
  Award,
  Calendar,
  CheckCircle2,
  Clock,
  Crown,
  Edit3,
  Flame,
  Lock,
  Maximize2,
  ShieldCheck,
  Sparkles,
  Swords,
  Trophy,
  UserCheck,
  AlertTriangle,
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
}

function toPublicMatchShape(
  km: KnockoutMatch,
  courtNames?: string[]
): Match {
  const cNum = km.court || 1;
  const cName = km.courtName || courtNames?.[cNum - 1]?.trim() || `Court ${cNum}`;
  const label = getPlayoffMatchDisplayLabel(km, 'ipl_top4');
  return {
    id: km.id,
    round: label.playoffRound === 'F' ? 999 : label.playoffRound === 'Q2' ? 998 : 997,
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
}) => {
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
  const q1 = matches.find((m) => inferPlayoffRound(m, knockout.format) === 'Q1');
  const elim = matches.find((m) => inferPlayoffRound(m, knockout.format) === 'ELIM');
  const q2 = matches.find((m) => inferPlayoffRound(m, knockout.format) === 'Q2');
  const finalMatch = matches.find((m) => inferPlayoffRound(m, knockout.format) === 'F');

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

  const qualifiedSeeds = (knockout.qualifiedTeams || []).slice(0, 4);

  const renderMatchCard = (km: KnockoutMatch | undefined, round: PlayoffRoundType) => {
    if (!km) {
      return (
        <div className="rounded-2xl border border-dashed border-white/10 bg-slate-900/40 p-4 text-center text-xs text-slate-500">
          {round} fixture not initialized
        </div>
      );
    }

    const meta = getPlayoffMatchDisplayLabel(km, 'ipl_top4');
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

    const guard = canStartOrScorePlayoffMatch(km, matches, 'ipl_top4');
    const warnings = conflictWarnings.filter((w) => w.matchId === km.id);

    const placeholderA =
      round === 'Q1'
        ? 'Rank #1 Seed'
        : round === 'ELIM'
        ? 'Rank #3 Seed'
        : round === 'Q2'
        ? 'Qualifier 1 Loser'
        : 'Qualifier 1 Winner';

    const placeholderB =
      round === 'Q1'
        ? 'Rank #2 Seed'
        : round === 'ELIM'
        ? 'Rank #4 Seed'
        : round === 'Q2'
        ? 'Eliminator Winner'
        : 'Qualifier 2 Winner';

    const roundAccent =
      round === 'F'
        ? 'border-amber-400/60 bg-gradient-to-br from-[#191104] via-[#120d05] to-[#080603]'
        : round === 'Q2'
        ? 'border-violet-400/45 bg-gradient-to-br from-[#110c28] via-[#0c0a1c] to-[#07060f]'
        : round === 'ELIM'
        ? 'border-rose-400/40 bg-gradient-to-br from-[#1a0b11] via-[#100912] to-[#07070c]'
        : 'border-sky-400/45 bg-gradient-to-br from-[#091529] via-[#0a0f1f] to-[#060912]';

    const badgeColor =
      round === 'F'
        ? 'bg-amber-400/20 text-amber-300 border-amber-400/40'
        : round === 'Q2'
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
        onSelectMatch(toPublicMatchShape(km, courtNames));
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
            <span className={`px-2 py-0.5 rounded-md text-[10px] font-mono font-black uppercase border shrink-0 ${badgeColor}`}>
              {meta.shortCode}
            </span>
            <div className="min-w-0">
              <h4 className="font-display font-black text-sm text-white uppercase tracking-wide truncate">
                {meta.title}
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
            ) : !guard.allowed && (round === 'Q2' || round === 'F') ? (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-slate-800/90 border border-white/10 text-[10px] font-bold uppercase text-slate-400">
                <Lock className="w-2.5 h-2.5" />
                LOCKED
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
              <span className="text-lg shrink-0">{teamA?.badge || '🏸'}</span>
              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <span
                    className={`text-xs sm:text-sm font-bold truncate ${
                      isWinnerA ? 'text-amber-300 font-black' : teamA ? 'text-white' : 'text-slate-400 italic'
                    }`}
                  >
                    {teamA?.name || placeholderA}
                  </span>
                  {isWinnerA && <Crown className="w-3.5 h-3.5 text-amber-400 shrink-0" />}
                </div>
                <span className="block text-[10px] text-slate-400 truncate">
                  {getTeamPlayersText(teamA, placeholderA)}
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
              <span className="text-lg shrink-0">{teamB?.badge || '🏸'}</span>
              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <span
                    className={`text-xs sm:text-sm font-bold truncate ${
                      isWinnerB ? 'text-amber-300 font-black' : teamB ? 'text-white' : 'text-slate-400 italic'
                    }`}
                  >
                    {teamB?.name || placeholderB}
                  </span>
                  {isWinnerB && <Crown className="w-3.5 h-3.5 text-amber-400 shrink-0" />}
                </div>
                <span className="block text-[10px] text-slate-400 truncate">
                  {getTeamPlayersText(teamB, placeholderB)}
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
                {getTeam(winnerId)?.name}{' '}
                {round === 'Q1'
                  ? '→ Grand Final'
                  : round === 'ELIM'
                  ? '→ Qualifier 2'
                  : round === 'Q2'
                  ? '→ Grand Final'
                  : '· SPL Champion!'}
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

            {!guard.allowed && guard.reason && (round === 'Q2' || round === 'F') && (
              <p className="text-[11px] text-slate-400 flex items-center gap-1.5">
                <Lock className="w-3 h-3 text-slate-500 shrink-0" />
                <span>{guard.reason}</span>
              </p>
            )}

            <div className="flex flex-wrap items-center gap-1.5">
              {allowScheduleEditing && onEditSchedule && (
                <button
                  type="button"
                  onClick={() => onEditSchedule(km)}
                  className="px-2.5 py-1.5 rounded-lg text-[11px] font-semibold text-slate-200 bg-white/5 hover:bg-white/10 border border-white/10 flex items-center gap-1 transition-colors"
                >
                  <Edit3 className="w-3 h-3 text-amber-300" />
                  <span>Schedule &amp; Court</span>
                </button>
              )}

              {guard.allowed && km.status === 'upcoming' && onGoLive && (
                <button
                  type="button"
                  onClick={() => onGoLive(km.id)}
                  className="px-2.5 py-1.5 rounded-lg text-[11px] font-black text-slate-950 bg-emerald-400 hover:bg-emerald-300 flex items-center gap-1 transition-colors"
                >
                  <Flame className="w-3 h-3" />
                  <span>Go Live</span>
                </button>
              )}

              {guard.allowed && onOpenUmpire && (
                <button
                  type="button"
                  onClick={() => onOpenUmpire(km.id)}
                  className="ml-auto px-2.5 py-1.5 rounded-lg text-[11px] font-bold text-amber-300 bg-amber-500/15 hover:bg-amber-500/25 border border-amber-400/35 flex items-center gap-1 transition-colors"
                >
                  <Maximize2 className="w-3 h-3" />
                  <span>{isCompleted ? 'Correct / View' : 'Umpire Mode'}</span>
                </button>
              )}
            </div>
          </div>
        )}
      </WrapperTag>
    );
  };

  return (
    <div className="space-y-6 min-w-0 overflow-x-hidden">
      {/* Top 4 Qualified Seed Cards */}
      {qualifiedSeeds.length > 0 && (
        <div className="grid grid-cols-1 xs:grid-cols-2 lg:grid-cols-4 gap-3">
          {qualifiedSeeds.map((seed) => {
            const teamObj = getTeam(seed.teamId);
            const playerLine =
              seed.playerNames && seed.playerNames.length > 0
                ? seed.playerNames.join(' & ')
                : getTeamPlayersText(teamObj, 'Doubles Pair');
            const seedDestination = seed.rank <= 2 ? 'Qualifier 1' : 'Eliminator';
            return (
              <div
                key={seed.teamId}
                className={`p-3 rounded-2xl border flex items-center justify-between gap-2.5 min-w-0 ${
                  seed.rank <= 2
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
                  <span className="block text-[9px] font-bold uppercase tracking-wider text-slate-400">
                    {seedDestination}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Connected 3-Stage SPL Playoff Flow */}
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
                Eliminator · Do or Die
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
    </div>
  );
};
