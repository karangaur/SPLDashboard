import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import {
  Dices,
  Crown,
  Lock,
  Unlock,
  Volume2,
  VolumeX,
  Share2,
  Copy,
  Trash2,
  ShieldCheck,
} from 'lucide-react';
import { useReducedMotion } from 'motion/react';
import { useTournament, sportsAudio } from '../../context/TournamentContext';
import { ConfirmModal } from '../common/ConfirmModal';
import { RandomCaptainsModal } from '../common/RandomCaptainsModal';
import { Team, PredefinedTeam } from '../../types/tournament';
import {
  executeLotteryDraw,
  GRADIENT_PALETTES,
  getTokenLabel,
  LotteryDrawOutput,
} from '../../utils/lotteryShuffleEngine';
import {
  LotteryDrawAnimationStage,
  DrawAnimationPhase,
} from './LotteryDrawAnimationStage';

export const TokensView: React.FC = () => {
  const {
    state,
    setTeams,
    clearTeams,
    setTeamFormationMode,
    addPredefinedTeam,
    deletePredefinedTeam,
    toggleTeamLock,
    togglePlayerLockInTeam,
    setCaptainsBulk,
    generateFixtures,
    triggerCelebration,
  } = useTournament();

  const prefersReducedMotion = useReducedMotion();

  // Always keep a ref to the latest tournament state so callbacks never read stale closures
  const stateRef = useRef(state);
  stateRef.current = state;

  // Deduplicated existing registered teams (authoritative eligible team list)
  const existingTeams = useMemo(() => {
    const map = new Map<string, Team>();
    for (const t of state.teams) {
      if (t && t.id && !map.has(t.id)) {
        map.set(t.id, t);
      }
    }
    return Array.from(map.values());
  }, [state.teams]);

  const [soundEnabled, setSoundEnabled] = useState(true);
  const [playersPerTeam, setPlayersPerTeam] = useState(2);
  const [showClearConfirm, setShowClearConfirm] = useState(false);

  // Animation state
  const [animationPhase, setAnimationPhase] = useState<DrawAnimationPhase>('idle');
  const [activeDrawOutput, setActiveDrawOutput] = useState<LotteryDrawOutput | null>(null);
  const [revealedCount, setRevealedCount] = useState(0);

  const isDrawing = animationPhase !== 'idle';

  const eligiblePlayers = state.players;
  const maxPossibleTeams = Math.max(1, Math.floor(eligiblePlayers.length / playersPerTeam) || 4);

  // Calculate total expected teams without ever letting 1 locked pair shrink the total team count:
  // Takes the maximum of existing teams, player-derived teams, and predefined pairs.
  const calculatedTeamCount = useMemo(() => {
    const playerDerivedTeams =
      eligiblePlayers.length >= playersPerTeam
        ? Math.floor(eligiblePlayers.length / playersPerTeam)
        : eligiblePlayers.length;
    const maxCount = Math.max(
      existingTeams.length,
      playerDerivedTeams,
      state.predefinedTeams.length
    );
    return maxCount > 0 ? maxCount : 4;
  }, [existingTeams.length, state.predefinedTeams.length, eligiblePlayers.length, playersPerTeam]);

  const [numTeams, setNumTeams] = useState<number>(calculatedTeamCount);

  // Synchronous ref locks & timer tracking to prevent duplicate/concurrent spin executions
  const isSpinningRef = useRef(false);
  const phaseTimersRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  const activeDrawIdRef = useRef(0);

  const clearAllAnimationTimers = useCallback(() => {
    for (const timer of phaseTimersRef.current) {
      clearTimeout(timer);
    }
    phaseTimersRef.current = [];
  }, []);

  // Keep numTeams synchronized when player pool or existing teams change
  useEffect(() => {
    setNumTeams(calculatedTeamCount);
  }, [calculatedTeamCount]);

  // Cleanup any active animation timers on unmount
  useEffect(() => {
    return () => {
      clearAllAnimationTimers();
      isSpinningRef.current = false;
    };
  }, [clearAllAnimationTimers]);

  // Pre-decided pairs form
  const [pairName, setPairName] = useState('');
  const [pairP1, setPairP1] = useState('');
  const [pairP2, setPairP2] = useState('');

  // Captain slots & selection modal
  const [selectedCaptains, setSelectedCaptains] = useState<string[]>([]);
  const [isCaptainModalOpen, setIsCaptainModalOpen] = useState(false);
  const [toastMsg, setToastMsg] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  const showNotice = useCallback((text: string, type: 'success' | 'error' = 'error') => {
    setToastMsg({ text, type });
    setTimeout(() => setToastMsg(null), 4500);
  }, []);

  // O(1) Player lookup map
  const playerById = useMemo(() => {
    const map = new Map<string, (typeof state.players)[number]>();
    for (const p of state.players) {
      if (p && p.id) map.set(p.id, p);
    }
    return map;
  }, [state.players]);

  // Set of player IDs that belong to a locked pair in state.predefinedTeams
  const lockedPairByPlayerId = useMemo(() => {
    const map = new Map<string, PredefinedTeam>();
    for (const pt of state.predefinedTeams) {
      for (const pid of pt.players) {
        if (pid) map.set(pid, pt);
      }
    }
    return map;
  }, [state.predefinedTeams]);

  // Open interactive Random Captains Modal
  const handleRandomCaptains = () => {
    const requiredCaptains = existingTeams.length > 0 ? existingTeams.length : numTeams;
    if (eligiblePlayers.length < requiredCaptains) {
      showNotice(
        `Need at least ${requiredCaptains} registered players to draw captains, but only ${eligiblePlayers.length} are available.`,
        'error'
      );
      return;
    }
    setIsCaptainModalOpen(true);
  };

  const handleConfirmCaptainsFromModal = (assignments: { teamId: string; captainId: string }[]) => {
    if (existingTeams.length > 0) {
      setCaptainsBulk(assignments);
      showNotice(`Updated captains for ${assignments.length} registered team(s).`, 'success');
    }
    setSelectedCaptains(assignments.map((a) => a.captainId));
    setIsCaptainModalOpen(false);
  };

  // Finish & commit reveal UI state (never re-randomizes or alters the committed draw)
  const finishDrawPresentation = useCallback(
    (drawOutput: LotteryDrawOutput, mode: 'random' | 'predefined' | 'mixed') => {
      clearAllAnimationTimers();
      setRevealedCount(drawOutput.teams.length);
      setAnimationPhase('idle');
      setActiveDrawOutput(null);
      isSpinningRef.current = false;
      triggerCelebration();

      const totalPlayersCount = drawOutput.teams.reduce((sum, t) => sum + t.players.length, 0);
      if (mode === 'predefined') {
        showNotice(
          `Allocated ${drawOutput.teams.length} official lottery token(s) across all ${drawOutput.teams.length} pre-decided team(s).`,
          'success'
        );
      } else if (mode === 'mixed') {
        showNotice(
          `Mixed Mode Draw complete: ${drawOutput.protectedTeamIds.length} protected squad(s) preserved + ${
            drawOutput.teams.length - drawOutput.protectedTeamIds.length
          } newly shuffled squad(s) (${totalPlayersCount} players total).`,
          'success'
        );
      } else {
        showNotice(
          `Random Formation Draw complete: ${drawOutput.teams.length} squad(s) formed (${totalPlayersCount} players) with unique tokens!`,
          'success'
        );
      }
    },
    [clearAllAnimationTimers, showNotice, triggerCelebration]
  );

  // Skip animation button handler: immediately reveals the already validated & committed draw
  const handleSkipAnimation = useCallback(() => {
    if (!activeDrawOutput) return;
    finishDrawPresentation(activeDrawOutput, stateRef.current.teamFormationMode);
  }, [activeDrawOutput, finishDrawPresentation]);

  // Execute the complete lottery draw with real validation, atomic persistence, and 5-phase animation
  const handleRunLotteryDraw = async () => {
    if (isSpinningRef.current || isDrawing) {
      return;
    }

    const latestState = stateRef.current;
    const mode = latestState.teamFormationMode;
    const previousTeamsSnapshot = latestState.teams.map((t) => ({
      ...t,
      players: [...t.players],
      lockedPlayerIds: Array.isArray(t.lockedPlayerIds) ? [...t.lockedPlayerIds] : [],
    }));

    // 1. Generate and validate the real draw before starting animation
    const drawOutput = executeLotteryDraw({
      mode,
      players: latestState.players,
      existingTeams: latestState.teams,
      predefinedTeams: latestState.predefinedTeams,
      playersPerTeam,
      numTeamsRequested: numTeams,
      selectedCaptains,
    });

    if (!drawOutput.success) {
      showNotice(drawOutput.error || 'Unable to generate lottery draw.', 'error');
      return;
    }

    // 2. If no alternative arrangement exists (e.g., all teams/tokens/players locked),
    // show a clear message instead of displaying a misleading shuffle animation.
    if (drawOutput.noAlternativeReason) {
      if (drawOutput.teams.length > 0) {
        await setTeams(drawOutput.teams);
      }
      showNotice(drawOutput.noAlternativeReason, 'error');
      return;
    }

    // 3. Lock spin state and start atomic database save
    isSpinningRef.current = true;
    const currentDrawId = ++activeDrawIdRef.current;
    clearAllAnimationTimers();

    // Respect prefers-reduced-motion: commit immediately and skip multi-second motion
    if (prefersReducedMotion) {
      const savedOk = await setTeams(drawOutput.teams);
      if (!savedOk) {
        await setTeams(previousTeamsSnapshot);
        isSpinningRef.current = false;
        showNotice('Database save failed. Could not commit lottery draw.', 'error');
        return;
      }
      finishDrawPresentation(drawOutput, mode);
      return;
    }

    // 4. Start 5-phase tournament lottery animation using the exact validated draw result:
    // Preparation (0.3s) -> Shuffle (1.5s) -> Slowdown (0.8s) -> Reveal (1.0s) -> Completion (0.4s)
    setActiveDrawOutput(drawOutput);
    setRevealedCount(0);
    setAnimationPhase('preparation');
    if (soundEnabled) sportsAudio.playScorePing();

    // Schedule phase transitions
    const tShuffle = setTimeout(() => {
      if (activeDrawIdRef.current !== currentDrawId) return;
      setAnimationPhase('shuffle');
      if (soundEnabled) sportsAudio.playScorePing();
    }, 300);

    const tSlowdown = setTimeout(() => {
      if (activeDrawIdRef.current !== currentDrawId) return;
      setAnimationPhase('slowdown');
      if (soundEnabled) sportsAudio.playScorePing();
    }, 1800);

    const tRevealStart = setTimeout(() => {
      if (activeDrawIdRef.current !== currentDrawId) return;
      setAnimationPhase('reveal');
      const totalTeams = drawOutput.teams.length;
      const stepMs = Math.max(90, Math.floor(950 / Math.max(1, totalTeams)));

      for (let i = 1; i <= totalTeams; i++) {
        const tCard = setTimeout(() => {
          if (activeDrawIdRef.current !== currentDrawId) return;
          setRevealedCount(i);
          if (soundEnabled && i <= 4) sportsAudio.playScorePing();
        }, (i - 1) * stepMs);
        phaseTimersRef.current.push(tCard);
      }
    }, 2600);

    const tCompletion = setTimeout(() => {
      if (activeDrawIdRef.current !== currentDrawId) return;
      setAnimationPhase('completion');
      setRevealedCount(drawOutput.teams.length);
    }, 3600);

    const tFinish = setTimeout(() => {
      if (activeDrawIdRef.current !== currentDrawId) return;
      finishDrawPresentation(drawOutput, mode);
    }, 4000);

    phaseTimersRef.current.push(tShuffle, tSlowdown, tRevealStart, tCompletion, tFinish);

    // 5. Atomically persist the validated draw to Supabase and backend state in parallel with the animation.
    // If saving fails, immediately abort the animation and restore previous teams.
    const savedOk = await setTeams(drawOutput.teams);
    if (!savedOk && activeDrawIdRef.current === currentDrawId) {
      clearAllAnimationTimers();
      setAnimationPhase('idle');
      setActiveDrawOutput(null);
      isSpinningRef.current = false;
      await setTeams(previousTeamsSnapshot);
      showNotice(
        'Failed to save the lottery draw to Supabase. Reverted to previous committed state.',
        'error'
      );
    }
  };

  // Merge Pre-Decided Locked Pairs with all existing teams & remaining eligible players
  // so locking a pair NEVER deletes or hides the rest of the tournament teams!
  const handleApplyLockedPairs = async () => {
    if (state.predefinedTeams.length === 0) {
      showNotice('No locked pairs to apply.', 'error');
      return;
    }

    const latestState = stateRef.current;
    const drawOutput = executeLotteryDraw({
      mode: 'predefined',
      players: latestState.players,
      existingTeams: latestState.teams,
      predefinedTeams: latestState.predefinedTeams,
      playersPerTeam,
      numTeamsRequested: numTeams,
      selectedCaptains,
    });

    if (!drawOutput.success) {
      showNotice(drawOutput.error || 'Failed to apply locked pairs.', 'error');
      return;
    }

    const saved = await setTeams(drawOutput.teams);
    if (!saved) {
      showNotice('Failed to save teams to database.', 'error');
      return;
    }

    triggerCelebration();
    showNotice(
      `Synchronized ${state.predefinedTeams.length} locked pair(s) across all ${drawOutput.teams.length} tournament team(s).`,
      'success'
    );
  };

  const handleAddPredefinedPair = (e: React.FormEvent) => {
    e.preventDefault();
    if (!pairP1 || !pairP2) {
      showNotice('Please select both players for the doubles pair.', 'error');
      return;
    }
    if (pairP1 === pairP2) {
      showNotice('A player cannot pair with themselves.', 'error');
      return;
    }

    const p1Name = playerById.get(pairP1)?.name.split(' ')[0] || 'P1';
    const p2Name = playerById.get(pairP2)?.name.split(' ')[0] || 'P2';
    const autoName = pairName.trim() || `${p1Name} & ${p2Name}`;

    addPredefinedTeam(autoName, pairP1, pairP2);
    setPairName('');
    setPairP1('');
    setPairP2('');
    showNotice(`Locked pair "${autoName}" (${p1Name} + ${p2Name}).`, 'success');
  };

  const formatTeamsShareText = () => {
    const lines = [
      `🏸 ${state.settings.name} — Official Token Draw Teams`,
      `Date: ${state.settings.date}`,
      '----------------------------------------',
    ];

    existingTeams.forEach((t, idx) => {
      const pNames = t.players
        .map((pid) => {
          const p = playerById.get(pid);
          return `${p?.name || 'Unknown'}${t.captainId === pid ? ' 👑 (Captain)' : ''}`;
        })
        .join(' + ');

      const tokenLabel = t.token || getTokenLabel(idx);
      lines.push(`Token ${tokenLabel}: ${t.name}`);
      lines.push(`  Squad: ${pNames || 'Unassigned'}`);
    });

    return lines.join('\n');
  };

  const handleShare = () => {
    const text = formatTeamsShareText();
    const url = `https://wa.me/?text=${encodeURIComponent(text)}`;
    window.open(url, '_blank');
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(formatTeamsShareText());
      showNotice('Teams copied to clipboard!', 'success');
    } catch {}
  };

  const displayTeamCount = Math.max(existingTeams.length, calculatedTeamCount, numTeams);

  return (
    <div className="space-y-6 animate-fade-in">
      {toastMsg && (
        <div
          role="status"
          className={`flex items-center justify-between gap-3 px-4 py-3 rounded-xl text-xs font-semibold animate-fade-in border ${
            toastMsg.type === 'success'
              ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-300'
              : 'bg-rose-500/15 border-rose-500/30 text-rose-300'
          }`}
        >
          <span>{toastMsg.text}</span>
          <button
            onClick={() => setToastMsg(null)}
            className="text-current opacity-75 hover:opacity-100 px-1"
            aria-label="Dismiss notification"
          >
            ✕
          </button>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-500/20 text-amber-400 font-bold text-xl">
              🎲
            </span>
            <h1 className="font-display text-2xl sm:text-3xl font-black text-white">
              Token Lottery Draw
            </h1>
          </div>
          <p className="mt-1 text-xs sm:text-sm text-slate-400">
            Official doubles team draw, captain selection, pre-decided pairs locking, and live lottery token allocation.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setSoundEnabled((s) => !s)}
            className="p-2 text-slate-400 hover:text-white bg-white/5 hover:bg-white/10 rounded-xl transition-colors border border-white/5"
            title={soundEnabled ? 'Mute Sound Effects' : 'Enable Sound Effects'}
            aria-label={soundEnabled ? 'Mute Sound Effects' : 'Enable Sound Effects'}
          >
            {soundEnabled ? (
              <Volume2 className="w-4 h-4 text-amber-400" />
            ) : (
              <VolumeX className="w-4 h-4" />
            )}
          </button>

          {existingTeams.length > 0 && (
            <>
              <button
                onClick={handleCopy}
                className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-200 hover:text-white bg-white/10 hover:bg-white/15 rounded-xl transition-colors border border-white/10"
              >
                <Copy className="w-4 h-4 text-amber-400" />
                <span>Copy</span>
              </button>
              <button
                onClick={handleShare}
                className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-emerald-400 bg-emerald-500/10 hover:bg-emerald-500/20 rounded-xl transition-colors border border-emerald-500/20"
              >
                <Share2 className="w-4 h-4" />
                <span>WhatsApp</span>
              </button>
              <button
                onClick={() => setShowClearConfirm(true)}
                className="p-2 text-slate-400 hover:text-rose-400 bg-white/5 hover:bg-rose-500/10 rounded-xl transition-colors border border-white/5"
                title="Clear Teams"
                aria-label="Clear Teams"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </>
          )}
        </div>
      </div>

      {/* Mode Selector Tabs */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-2 rounded-2xl glass-panel">
        {[
          {
            id: 'random',
            label: 'Random Formation',
            desc: 'Draw balanced pairs randomly from the pool',
            icon: '🎲',
          },
          {
            id: 'predefined',
            label: 'Pre-Decided Teams',
            desc: 'Preserve all pre-decided teams & draw lottery tokens',
            icon: '🔒',
          },
          {
            id: 'mixed',
            label: 'Mixed Mode',
            desc: 'Lock designated pairs + shuffle remaining players',
            icon: '⚡',
          },
        ].map((m) => (
          <button
            key={m.id}
            disabled={isDrawing}
            onClick={() => setTeamFormationMode(m.id as any)}
            className={`text-left p-3.5 rounded-xl transition-all border ${
              state.teamFormationMode === m.id
                ? 'bg-amber-500/15 border-amber-500/40 shadow-md'
                : 'bg-white/5 border-transparent hover:bg-white/10'
            } disabled:opacity-60`}
          >
            <div className="flex items-center gap-2 mb-1">
              <span className="text-lg">{m.icon}</span>
              <span className="font-bold text-sm text-white">{m.label}</span>
            </div>
            <p className="text-xs text-slate-400 leading-relaxed">{m.desc}</p>
          </button>
        ))}
      </div>

      {/* Mode 1: Random Draw Control Center */}
      {state.teamFormationMode === 'random' && (
        <div className="rounded-2xl glass-card p-6 border border-white/10 space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
            {/* Number of Teams */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-1.5">
                {existingTeams.length > 0 ? 'Registered Eligible Teams' : 'Number of Teams'}
              </label>
              <input
                type="number"
                min={1}
                max={32}
                value={numTeams}
                onChange={(e) => setNumTeams(Math.max(1, parseInt(e.target.value, 10) || 1))}
                className="w-full bg-slate-900 border border-white/10 rounded-xl px-3 py-2 text-white font-mono font-bold tabular-nums"
              />
              <div className="flex flex-wrap gap-1.5 mt-2">
                {existingTeams.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setNumTeams(existingTeams.length)}
                    className={`px-2 py-0.5 text-xs rounded-lg transition-colors font-mono tabular-nums ${
                      numTeams === existingTeams.length
                        ? 'bg-amber-400 text-slate-950 font-bold'
                        : 'bg-white/5 text-amber-400 hover:text-amber-300'
                    }`}
                  >
                    Existing ({existingTeams.length})
                  </button>
                )}
                {[2, 3, 4, 6, 8].map((count) => (
                  <button
                    key={count}
                    type="button"
                    onClick={() => setNumTeams(count)}
                    className={`px-2 py-0.5 text-xs rounded-lg transition-colors font-mono tabular-nums ${
                      numTeams === count
                        ? 'bg-amber-400 text-slate-950 font-bold'
                        : 'bg-white/5 text-slate-400 hover:text-white'
                    }`}
                  >
                    {count}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => setNumTeams(maxPossibleTeams)}
                  className="px-2 py-0.5 text-xs rounded-lg bg-white/5 text-amber-400 hover:text-amber-300 font-mono tabular-nums"
                >
                  Max ({maxPossibleTeams})
                </button>
              </div>
            </div>

            {/* Players Per Team */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-1.5">
                Players Per Team
              </label>
              <select
                value={playersPerTeam}
                onChange={(e) => setPlayersPerTeam(parseInt(e.target.value, 10) || 2)}
                className="w-full bg-slate-900 border border-white/10 rounded-xl px-3 py-2 text-white text-sm"
              >
                <option value={2}>2 (Standard Doubles)</option>
                <option value={3}>3 (Triples Squad)</option>
              </select>
              <p className="text-[11px] text-slate-400 mt-2">
                {existingTeams.length > 0
                  ? `${existingTeams.length} existing team${
                      existingTeams.length === 1 ? '' : 's'
                    } · Unlocked players reshuffle on every spin`
                  : `Target: ${numTeams} team${numTeams === 1 ? '' : 's'} · ${
                      eligiblePlayers.length
                    } players available`}
              </p>
            </div>

            {/* Draw Actions */}
            <div className="flex flex-col justify-end gap-2">
              <button
                type="button"
                onClick={handleRandomCaptains}
                disabled={isDrawing}
                className="w-full py-2 px-3 text-xs font-semibold text-slate-200 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl transition-colors flex items-center justify-center gap-1.5 disabled:opacity-50"
              >
                <Crown className="w-3.5 h-3.5 text-amber-400" />
                <span>Draw Random Captains</span>
              </button>

              <button
                type="button"
                onClick={handleRunLotteryDraw}
                disabled={isDrawing}
                className="w-full py-2.5 px-4 text-sm font-bold text-slate-950 bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 rounded-xl shadow-lg shadow-amber-500/25 active:scale-95 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
              >
                <Dices className={`w-4 h-4 ${isDrawing ? 'animate-spin' : ''}`} />
                <span>
                  {isDrawing
                    ? 'Shuffling Players...'
                    : 'Spin & Generate Tokens'}
                </span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Mode 2 & 3: Pre-Decided Pairs & Mixed Mode Control Panel */}
      {(state.teamFormationMode === 'predefined' || state.teamFormationMode === 'mixed') && (
        <div className="rounded-2xl glass-card p-6 border border-white/10 space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-white/10">
            <div>
              <h3 className="font-bold text-white text-base">
                {state.teamFormationMode === 'predefined'
                  ? 'Pre-Decided Teams & Locked Doubles Pairs'
                  : 'Mixed Mode: Lock Protected Pairs + Shuffle Remaining Players'}
              </h3>
              <p className="text-xs text-slate-400">
                {state.teamFormationMode === 'predefined'
                  ? 'All pre-decided teams (locked and unlocked) stay intact while Spin & Generate Tokens randomizes eligible lottery tokens.'
                  : `Protected pairs stay together while all remaining ${Math.max(
                      0,
                      eligiblePlayers.length - state.predefinedTeams.length * 2
                    )} eligible player(s) reshuffle into fresh teams on every spin.`}
              </p>
            </div>
            <div className="text-xs text-slate-300 font-mono tabular-nums shrink-0">
              <span>{state.predefinedTeams.length} Locked Pair(s)</span>
              <span aria-hidden="true"> · </span>
              <span>{displayTeamCount} Total Squad(s)</span>
            </div>
          </div>

          <form onSubmit={handleAddPredefinedPair} className="grid grid-cols-1 sm:grid-cols-4 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1">
                Pair Name (Optional)
              </label>
              <input
                type="text"
                placeholder="e.g. Falcon Duo"
                value={pairName}
                onChange={(e) => setPairName(e.target.value)}
                className="w-full bg-slate-900 border border-white/10 rounded-xl px-3 py-2 text-xs text-white"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1">Player 1</label>
              <select
                value={pairP1}
                onChange={(e) => setPairP1(e.target.value)}
                className="w-full bg-slate-900 border border-white/10 rounded-xl px-3 py-2 text-xs text-white"
                required
              >
                <option value="">Select Player 1</option>
                {state.players.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1">Player 2</label>
              <select
                value={pairP2}
                onChange={(e) => setPairP2(e.target.value)}
                className="w-full bg-slate-900 border border-white/10 rounded-xl px-3 py-2 text-xs text-white"
                required
              >
                <option value="">Select Player 2</option>
                {state.players
                  .filter((p) => p.id !== pairP1)
                  .map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
              </select>
            </div>
            <div className="flex items-end">
              <button
                type="submit"
                disabled={isDrawing}
                className="w-full py-2 px-3 text-xs font-bold bg-emerald-500 hover:bg-emerald-400 text-slate-950 rounded-xl transition-all shadow disabled:opacity-50"
              >
                + Lock Pair
              </button>
            </div>
          </form>

          {/* Locked Pairs List */}
          <div className="space-y-2">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
              Locked Pairs ({state.predefinedTeams.length})
            </span>
            {state.predefinedTeams.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {state.predefinedTeams.map((pt) => {
                  const p1 = playerById.get(pt.players[0]);
                  const p2 = playerById.get(pt.players[1]);

                  return (
                    <div
                      key={pt.id}
                      className="rounded-xl bg-emerald-500/10 border border-emerald-500/30 p-3 flex items-center justify-between"
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <Lock className="w-3 h-3 text-emerald-400 shrink-0" />
                          <span className="font-bold text-white text-xs truncate block">
                            {pt.name}
                          </span>
                        </div>
                        <span className="text-[11px] text-slate-300 truncate block mt-0.5">
                          {p1?.name || 'P1'} + {p2?.name || 'P2'}
                        </span>
                      </div>
                      <button
                        type="button"
                        disabled={isDrawing}
                        onClick={() => deletePredefinedTeam(pt.id)}
                        className="text-slate-400 hover:text-rose-400 p-1 disabled:opacity-50"
                        title="Remove locked pair"
                      >
                        ✕
                      </button>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-xs text-slate-500 italic">
                No locked pairs yet. Select two players above to lock a protected pair.
              </p>
            )}

            <div className="pt-3 flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={handleApplyLockedPairs}
                disabled={state.predefinedTeams.length === 0 || isDrawing}
                className="px-5 py-2.5 text-xs font-bold text-slate-950 bg-amber-400 hover:bg-amber-300 rounded-xl shadow transition-all disabled:opacity-50"
              >
                Apply Locked Pairs &amp; Preserve All Teams
              </button>

              <button
                type="button"
                onClick={handleRunLotteryDraw}
                disabled={isDrawing}
                className="px-5 py-2.5 text-xs font-bold text-slate-950 bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 rounded-xl shadow transition-all flex items-center gap-2 disabled:opacity-50"
              >
                <Dices className={`w-4 h-4 ${isDrawing ? 'animate-spin' : ''}`} />
                <span>
                  {isDrawing
                    ? state.teamFormationMode === 'predefined'
                      ? 'Drawing Team Tokens...'
                      : 'Shuffling Teams & Drawing Tokens...'
                    : 'Spin & Generate Tokens'}
                </span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Official Tournament Lottery Animation Stage (All 3 Modes) */}
      {isDrawing && activeDrawOutput && (
        <LotteryDrawAnimationStage
          mode={state.teamFormationMode}
          phase={animationPhase}
          committedTeams={activeDrawOutput.teams}
          protectedTeamIds={activeDrawOutput.protectedTeamIds}
          lockedTokenTeamIds={activeDrawOutput.lockedTokenTeamIds}
          unlockedPlayerPoolIds={activeDrawOutput.unlockedPlayerPoolIds}
          playerById={playerById}
          lockedPairByPlayerId={lockedPairByPlayerId}
          revealedCount={revealedCount}
          onSkipAnimation={handleSkipAnimation}
        />
      )}

      {/* Generated Teams Grid (Displayed when animation completes or is skipped) */}
      {existingTeams.length > 0 && !isDrawing && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <h3 className="font-display text-xl font-bold text-white flex items-center gap-2">
                <span>🏸</span>
                <span>Generated Tournament Tokens ({existingTeams.length} Teams)</span>
              </h3>
              <p className="text-[11px] text-slate-400 mt-0.5">
                {state.teamFormationMode === 'predefined'
                  ? 'Pre-Decided Teams Mode: Team rosters stay fixed. Lock a team card to freeze its assigned token number, or leave unlocked to redraw tokens.'
                  : 'Lock an entire team or click the lock icon next to any player to keep them in place during the next Spin & Generate Tokens draw.'}
              </p>
            </div>
            <button
              onClick={() => {
                generateFixtures();
                showNotice('Round-robin match schedule auto-generated for these teams!', 'success');
              }}
              className="text-xs font-bold text-amber-400 hover:underline self-start sm:self-auto"
            >
              Generate Match Schedule from These Teams →
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {existingTeams.map((team, idx) => {
              const letter = team.token || getTokenLabel(idx);
              const gradient = team.avatarColor || GRADIENT_PALETTES[idx % GRADIENT_PALETTES.length];
              const lockedPlayersSet = new Set(team.lockedPlayerIds || []);
              const isPairProtected = team.players.some((pid) => lockedPairByPlayerId.has(pid));

              return (
                <div
                  key={team.id}
                  className={`rounded-2xl glass-card border overflow-hidden shadow-xl space-y-3 ${
                    team.locked || isPairProtected
                      ? 'border-amber-500/35'
                      : 'border-white/10'
                  }`}
                >
                  {/* Card Header Strip */}
                  <div className={`p-4 bg-gradient-to-r ${gradient} text-white space-y-1`}>
                    <div className="flex items-center justify-between text-[11px] font-bold uppercase tracking-wider opacity-90">
                      <span className="flex items-center gap-1 font-mono tabular-nums">
                        <span>Token {letter}</span>
                        {team.locked && <Lock className="w-3 h-3" />}
                      </span>
                      <span>{team.badge || '🏸'}</span>
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <h4 className="font-display font-black text-lg truncate">{team.name}</h4>
                      {isPairProtected && (
                        <span
                          className="inline-flex items-center gap-1 text-[10px] font-bold text-white/95 shrink-0"
                          title="Protected Doubles Pair"
                        >
                          <ShieldCheck className="w-3.5 h-3.5" />
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Player Roster */}
                  <div className="p-4 pt-1 space-y-2 text-xs">
                    {team.players.map((pid) => {
                      const p = playerById.get(pid);
                      const isCap = team.captainId === pid;
                      const lockedPair = lockedPairByPlayerId.get(pid);
                      const isPlayerLocked = Boolean(
                        team.locked || lockedPlayersSet.has(pid) || lockedPair
                      );

                      return (
                        <div
                          key={pid}
                          className={`flex items-center justify-between p-2 rounded-xl border ${
                            isPlayerLocked
                              ? 'bg-amber-500/10 border-amber-500/30'
                              : isCap
                              ? 'bg-white/10 border-white/15'
                              : 'bg-white/5 border-transparent'
                          }`}
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-white/10 font-mono font-bold text-[10px] text-white tabular-nums">
                              {p?.name.slice(0, 2).toUpperCase() || '??'}
                            </span>
                            <div className="min-w-0">
                              <span className="font-semibold text-white truncate block">
                                {p?.name || 'Unnamed Player'}
                              </span>
                              {lockedPair && (
                                <span className="text-[10px] text-amber-300/90 block truncate">
                                  🔒 Pair: {lockedPair.name}
                                </span>
                              )}
                            </div>
                          </div>

                          <div className="flex items-center gap-1.5 shrink-0">
                            {isCap && (
                              <span
                                className="text-[10px] font-bold text-amber-400 flex items-center gap-0.5"
                                title="Team Captain"
                              >
                                <Crown className="w-3 h-3 text-amber-400" />
                                <span>C</span>
                              </span>
                            )}
                            <button
                              type="button"
                              onClick={() => togglePlayerLockInTeam(team.id, pid)}
                              disabled={Boolean(team.locked || lockedPair)}
                              title={
                                team.locked
                                  ? 'Entire team is locked'
                                  : lockedPair
                                  ? `Locked as part of pair "${lockedPair.name}"`
                                  : lockedPlayersSet.has(pid)
                                  ? 'Unlock player from this team'
                                  : 'Lock player to this team'
                              }
                              className={`p-1 rounded-lg transition-colors ${
                                isPlayerLocked
                                  ? 'text-amber-400 bg-amber-500/15 hover:bg-amber-500/25'
                                  : 'text-slate-500 hover:text-slate-300 hover:bg-white/5'
                              } disabled:opacity-60`}
                            >
                              {isPlayerLocked ? (
                                <Lock className="w-3 h-3" />
                              ) : (
                                <Unlock className="w-3 h-3" />
                              )}
                            </button>
                          </div>
                        </div>
                      );
                    })}

                    <div className="pt-2 flex items-center justify-between text-[11px] text-slate-400">
                      <button
                        type="button"
                        onClick={() => toggleTeamLock(team.id)}
                        className={`flex items-center gap-1 font-semibold ${
                          team.locked ? 'text-amber-400' : 'text-slate-500 hover:text-slate-300'
                        }`}
                      >
                        {team.locked ? <Lock className="w-3 h-3" /> : <Unlock className="w-3 h-3" />}
                        <span>
                          {state.teamFormationMode === 'predefined'
                            ? team.locked
                              ? 'Token & Team Locked'
                              : 'Token Unlocked'
                            : team.locked
                            ? 'Team Locked'
                            : 'Team Unlocked'}
                        </span>
                      </button>

                      {lockedPlayersSet.size > 0 && !team.locked && (
                        <span className="text-[10px] text-amber-400/90 font-semibold">
                          {lockedPlayersSet.size} player{lockedPlayersSet.size === 1 ? '' : 's'} locked
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Clear Confirmation */}
      <ConfirmModal
        isOpen={showClearConfirm}
        title="Clear Generated Teams"
        message="Are you sure you want to clear all tournament teams? Players and registrations will not be affected."
        confirmLabel="Clear Teams"
        variant="danger"
        onConfirm={() => {
          clearTeams();
          setShowClearConfirm(false);
        }}
        onCancel={() => setShowClearConfirm(false)}
      />

      {/* Random Captains Modal */}
      <RandomCaptainsModal
        isOpen={isCaptainModalOpen}
        onClose={() => setIsCaptainModalOpen(false)}
        teams={state.teams}
        players={eligiblePlayers}
        numTeamsFallback={numTeams}
        onConfirmCaptains={handleConfirmCaptainsFromModal}
      />
    </div>
  );
};
