import React, { useEffect, useState, useMemo } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'motion/react';
import { Lock, Crown, FastForward, CheckCircle2, Dices, ShieldCheck } from 'lucide-react';
import { Player, PredefinedTeam, Team } from '../../types/tournament';
import { GRADIENT_PALETTES, getTokenLabel } from '../../utils/lotteryShuffleEngine';

export type DrawAnimationPhase =
  | 'idle'
  | 'preparation'
  | 'shuffle'
  | 'slowdown'
  | 'reveal'
  | 'completion';

interface LotteryDrawAnimationStageProps {
  mode: 'random' | 'predefined' | 'mixed';
  phase: DrawAnimationPhase;
  committedTeams: Team[];
  protectedTeamIds: string[];
  lockedTokenTeamIds: string[];
  unlockedPlayerPoolIds: string[];
  playerById: Map<string, Player>;
  lockedPairByPlayerId: Map<string, PredefinedTeam>;
  revealedCount: number;
  onSkipAnimation: () => void;
}

export const LotteryDrawAnimationStage: React.FC<LotteryDrawAnimationStageProps> = ({
  mode,
  phase,
  committedTeams,
  protectedTeamIds,
  lockedTokenTeamIds,
  unlockedPlayerPoolIds,
  playerById,
  lockedPairByPlayerId,
  revealedCount,
  onSkipAnimation,
}) => {
  const prefersReducedMotion = useReducedMotion();
  const [tick, setTick] = useState(0);

  const protectedSet = useMemo(() => new Set(protectedTeamIds), [protectedTeamIds]);
  const lockedTokenSet = useMemo(() => new Set(lockedTokenTeamIds), [lockedTokenTeamIds]);

  // All token labels in this draw
  const allTokens = useMemo(
    () => committedTeams.map((t, i) => t.token || getTokenLabel(i)),
    [committedTeams]
  );

  // Unlocked tokens that can cycle in Animation B & C
  const cyclingTokenPool = useMemo(() => {
    const unlocked = committedTeams
      .filter((t) => !lockedTokenSet.has(t.id))
      .map((t, i) => t.token || getTokenLabel(i));
    return unlocked.length > 0 ? unlocked : allTokens;
  }, [committedTeams, lockedTokenSet, allTokens]);

  // Unlocked player IDs that can cycle in Animation A & C
  const cyclingPlayerIds = useMemo(() => {
    if (unlockedPlayerPoolIds.length > 0) return unlockedPlayerPoolIds;
    const ids: string[] = [];
    committedTeams.forEach((t) => {
      if (!protectedSet.has(t.id)) {
        t.players.forEach((pid) => ids.push(pid));
      }
    });
    return ids;
  }, [unlockedPlayerPoolIds, committedTeams, protectedSet]);

  // Adaptive ticker speed: fast in 'shuffle' (95ms), decelerating in 'slowdown' (210ms)
  useEffect(() => {
    if (prefersReducedMotion) return;
    if (phase !== 'shuffle' && phase !== 'slowdown') return;

    const intervalMs = phase === 'shuffle' ? 95 : 210;
    const timer = setInterval(() => {
      setTick((prev) => prev + 1);
    }, intervalMs);

    return () => clearInterval(timer);
  }, [phase, prefersReducedMotion]);

  if (phase === 'idle' || committedTeams.length === 0) return null;

  // Mode-specific headline & subtitle
  const modeHeadline =
    mode === 'random'
      ? phase === 'preparation'
        ? 'Preparing Random Player Pool...'
        : phase === 'shuffle'
        ? 'Shuffling Players...'
        : phase === 'slowdown'
        ? 'Locking Generated Doubles Pairs...'
        : phase === 'reveal'
        ? 'Revealing Official Pairs & Tokens...'
        : 'Official Random Draw Complete'
      : mode === 'predefined'
      ? phase === 'preparation'
        ? 'Verifying Pre-Decided Squads...'
        : phase === 'shuffle'
        ? 'Drawing Team Tokens...'
        : phase === 'slowdown'
        ? 'Decelerating Token Drum...'
        : phase === 'reveal'
        ? 'Assigning Official Lottery Tokens...'
        : 'Official Token Draw Complete'
      : phase === 'preparation'
      ? 'Locking Protected Pairs & Preparing Pool...'
      : phase === 'shuffle'
      ? 'Shuffling Teams & Drawing Tokens...'
      : phase === 'slowdown'
      ? 'Forming New Squads & Allocating Tokens...'
      : phase === 'reveal'
      ? 'Revealing Merged Tournament Draw...'
      : 'Official Mixed Mode Draw Complete';

  const modeBadgeText =
    mode === 'random'
      ? 'Random Formation Draw'
      : mode === 'predefined'
      ? 'Pre-Decided Teams Token Draw'
      : 'Mixed Mode Protected + Random Draw';

  const progressPercent =
    phase === 'preparation'
      ? 12
      : phase === 'shuffle'
      ? 48
      : phase === 'slowdown'
      ? 72
      : phase === 'reveal'
      ? 92
      : 100;

  // Separate protected vs newly shuffled teams for Mixed Mode visual clarity
  const protectedTeamsList = committedTeams.filter((t) => protectedSet.has(t.id));
  const dynamicTeamsList = committedTeams.filter((t) => !protectedSet.has(t.id));

  const renderTeamCard = (team: Team, globalIndex: number, isProtectedCard: boolean) => {
    const isCardRevealed =
      phase === 'completion' ||
      (phase === 'reveal' && globalIndex < revealedCount) ||
      Boolean(prefersReducedMotion);

    const isTokenExplicitlyLocked = lockedTokenSet.has(team.id);
    const finalToken = team.token || getTokenLabel(globalIndex);

    // Determine displayed token during animation
    const displayedToken =
      isCardRevealed || isTokenExplicitlyLocked
        ? finalToken
        : cyclingTokenPool[(tick + globalIndex * 2) % Math.max(1, cyclingTokenPool.length)] ||
          finalToken;

    const gradient = team.avatarColor || GRADIENT_PALETTES[globalIndex % GRADIENT_PALETTES.length];
    const lockedPlayersInTeam = new Set(team.lockedPlayerIds || []);

    return (
      <motion.div
        key={team.id}
        layout={!prefersReducedMotion}
        initial={{ opacity: 0, y: 12, scale: 0.97 }}
        animate={{
          opacity: 1,
          y: 0,
          scale: isCardRevealed && phase === 'reveal' ? [0.98, 1.02, 1] : 1,
        }}
        transition={{
          duration: 0.28,
          ease: [0.16, 1, 0.3, 1],
        }}
        className={`rounded-2xl glass-card overflow-hidden transition-shadow duration-300 border ${
          isCardRevealed
            ? 'border-amber-400/50 shadow-lg shadow-amber-500/15'
            : isProtectedCard
            ? 'border-emerald-400/35 shadow-md'
            : 'border-white/10 shadow'
        }`}
      >
        {/* Top Header Strip with Digital Token Drum */}
        <div className={`p-3.5 bg-gradient-to-r ${gradient} text-white`}>
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5 min-w-0">
              {isProtectedCard ? (
                <span className="inline-flex items-center gap-1 text-[11px] font-bold tracking-wide text-white/95 truncate">
                  <Lock className="w-3 h-3 shrink-0" />
                  <span>Protected Squad</span>
                </span>
              ) : (
                <span className="text-[11px] font-bold tracking-wide text-white/90 truncate">
                  Squad #{globalIndex + 1}
                </span>
              )}
            </div>

            {/* Animated Digital Token Slot */}
            <div className="flex items-center gap-1.5 shrink-0">
              <motion.div
                key={
                  isCardRevealed || isTokenExplicitlyLocked
                    ? `final-${finalToken}`
                    : `spin-${tick}-${displayedToken}`
                }
                initial={
                  prefersReducedMotion || isTokenExplicitlyLocked
                    ? false
                    : { y: -8, opacity: 0.35, scale: 0.92 }
                }
                animate={{ y: 0, opacity: 1, scale: 1 }}
                transition={{ duration: 0.12 }}
                className={`px-2.5 py-0.5 rounded-lg font-mono font-black text-xs tabular-nums flex items-center gap-1 ${
                  isCardRevealed || isTokenExplicitlyLocked
                    ? 'bg-slate-950/90 text-amber-300 border border-amber-300/50 shadow-sm'
                    : 'bg-slate-950/55 text-white/90 border border-white/20'
                }`}
              >
                <span>TOKEN {displayedToken}</span>
                {isTokenExplicitlyLocked && <Lock className="w-2.5 h-2.5 text-amber-300" />}
              </motion.div>
            </div>
          </div>

          <h4 className="font-display font-black text-base text-white truncate mt-1">
            {isCardRevealed || mode === 'predefined' || isProtectedCard
              ? team.name
              : `Drawing Squad ${globalIndex + 1}...`}
          </h4>
        </div>

        {/* Team Roster Rows */}
        <div className="p-3.5 space-y-2 text-xs bg-slate-950/40">
          {team.players.map((actualPid, slotIdx) => {
            const lockedPair = lockedPairByPlayerId.get(actualPid);
            const isPlayerFixed =
              mode === 'predefined' ||
              isProtectedCard ||
              Boolean(team.locked) ||
              lockedPlayersInTeam.has(actualPid) ||
              Boolean(lockedPair);

            // In Pre-Decided Teams mode or for protected/locked players, NEVER animate players swapping teams!
            // In Random or Mixed mode unlocked slots during 'shuffle'/'slowdown', cycle through unlocked pool
            // before locking onto `actualPid` (the real committed player) on reveal!
            const showActualPlayer =
              isPlayerFixed ||
              isCardRevealed ||
              phase === 'preparation' ||
              cyclingPlayerIds.length <= 1;

            const displayPid = showActualPlayer
              ? actualPid
              : cyclingPlayerIds[
                  (tick * 2 + globalIndex * 3 + slotIdx) % cyclingPlayerIds.length
                ] || actualPid;

            const playerObj = playerById.get(displayPid);
            const isCaptain = showActualPlayer && team.captainId === actualPid;

            return (
              <motion.div
                key={`${team.id}-slot-${slotIdx}`}
                animate={
                  !showActualPlayer && !prefersReducedMotion
                    ? {
                        x: (tick + slotIdx) % 2 === 0 ? [-2, 2, 0] : [2, -2, 0],
                        opacity: phase === 'shuffle' ? 0.85 : 0.95,
                      }
                    : { x: 0, opacity: 1 }
                }
                transition={{ duration: 0.12 }}
                className={`flex items-center justify-between p-2 rounded-xl border transition-colors ${
                  isPlayerFixed
                    ? 'bg-emerald-500/10 border-emerald-500/30'
                    : isCardRevealed
                    ? 'bg-amber-500/10 border-amber-500/30'
                    : 'bg-white/5 border-white/10'
                } ${!showActualPlayer && phase === 'shuffle' ? 'blur-[0.35px]' : ''}`}
              >
                <div className="flex items-center gap-2 min-w-0">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-white/10 font-mono font-bold text-[10px] text-white tabular-nums">
                    {playerObj?.name.slice(0, 2).toUpperCase() || '??'}
                  </span>
                  <div className="min-w-0">
                    <span className="font-semibold text-white truncate block">
                      {playerObj?.name || 'Player'}
                    </span>
                    {lockedPair && isPlayerFixed && (
                      <span className="text-[10px] text-emerald-300 truncate block">
                        Locked Pair · {lockedPair.name}
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-1 shrink-0">
                  {isCaptain && (
                    <span className="text-[10px] font-bold text-amber-400 flex items-center gap-0.5">
                      <Crown className="w-3 h-3 text-amber-400" />
                      <span>C</span>
                    </span>
                  )}
                  {isPlayerFixed && (
                    <span
                      className="text-emerald-300 p-0.5"
                      title="Protected player / pair position"
                    >
                      <Lock className="w-3 h-3" />
                    </span>
                  )}
                </div>
              </motion.div>
            );
          })}
        </div>
      </motion.div>
    );
  };

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key="lottery-draw-stage"
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -8 }}
        transition={{ duration: 0.2 }}
        className="rounded-2xl glass-card p-5 sm:p-6 border border-amber-500/40 shadow-2xl space-y-5"
        role="region"
        aria-live="polite"
        aria-label="Official Tournament Lottery Draw Stage"
      >
        {/* Stage Header Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-white/10">
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-xs text-amber-400 font-semibold">
              <Dices
                className={`w-4 h-4 ${
                  phase === 'shuffle' || phase === 'slowdown' ? 'animate-spin' : ''
                }`}
              />
              <span>{modeBadgeText}</span>
              <span aria-hidden="true">·</span>
              <span className="font-mono tabular-nums">
                {committedTeams.length} Official Squads
              </span>
            </div>
            <h3 className="font-display text-lg sm:text-xl font-black text-white flex items-center gap-2">
              {phase === 'completion' && (
                <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
              )}
              <span>{modeHeadline}</span>
            </h3>
          </div>

          <div className="flex items-center gap-3 self-start sm:self-auto">
            {phase !== 'completion' && (
              <button
                type="button"
                onClick={onSkipAnimation}
                className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-slate-950 bg-amber-400 hover:bg-amber-300 rounded-xl transition-colors shadow whitespace-nowrap shrink-0"
              >
                <FastForward className="w-3.5 h-3.5" />
                <span>Skip Animation</span>
              </button>
            )}
          </div>
        </div>

        {/* Smooth Progress Timeline Bar */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-[11px] text-slate-400 font-medium">
            <span>
              {mode === 'predefined'
                ? 'Pairs locked · Allocating official tournament tokens'
                : mode === 'mixed'
                ? `${protectedTeamsList.length} protected squad(s) · ${dynamicTeamsList.length} newly shuffled squad(s)`
                : `Shuffling ${committedTeams.reduce((acc, t) => acc + t.players.length, 0)} eligible players across ${committedTeams.length} squads`}
            </span>
            <span className="font-mono tabular-nums text-amber-300">{progressPercent}%</span>
          </div>
          <div className="h-1.5 w-full rounded-full bg-slate-900 overflow-hidden border border-white/5">
            <motion.div
              className="h-full bg-gradient-to-r from-amber-400 via-amber-500 to-emerald-400"
              initial={{ width: '8%' }}
              animate={{ width: `${progressPercent}%` }}
              transition={{ duration: 0.25, ease: 'easeOut' }}
            />
          </div>
        </div>

        {/* Mode C (Mixed Mode): Distinct Protected Pairs Section + Live Unlocked Shuffle Section */}
        {mode === 'mixed' && protectedTeamsList.length > 0 ? (
          <div className="space-y-5">
            {/* Protected Pairs & Pre-Decided Teams Section */}
            <div className="space-y-2.5">
              <div className="flex items-center gap-2 text-xs font-bold text-emerald-300">
                <ShieldCheck className="w-4 h-4 shrink-0" />
                <span>
                  Protected Pairs &amp; Locked Teams ({protectedTeamsList.length}) — Teammates Stay Together
                </span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {protectedTeamsList.map((team) => {
                  const globalIdx = committedTeams.findIndex((ct) => ct.id === team.id);
                  return renderTeamCard(team, globalIdx >= 0 ? globalIdx : 0, true);
                })}
              </div>
            </div>

            {/* Newly Shuffled Teams from Remaining Unlocked Players */}
            {dynamicTeamsList.length > 0 && (
              <div className="space-y-2.5 pt-2 border-t border-white/10">
                <div className="flex items-center gap-2 text-xs font-bold text-amber-300">
                  <Dices className="w-4 h-4 shrink-0" />
                  <span>
                    Newly Shuffled Squads from Remaining Eligible Players ({dynamicTeamsList.length})
                  </span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  {dynamicTeamsList.map((team) => {
                    const globalIdx = committedTeams.findIndex((ct) => ct.id === team.id);
                    return renderTeamCard(team, globalIdx >= 0 ? globalIdx : 0, false);
                  })}
                </div>
              </div>
            )}
          </div>
        ) : (
          /* Mode A (Random Formation) & Mode B (Pre-Decided Teams) Unified Grid */
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {committedTeams.map((team, idx) =>
              renderTeamCard(team, idx, protectedSet.has(team.id))
            )}
          </div>
        )}
      </motion.div>
    </AnimatePresence>
  );
};
