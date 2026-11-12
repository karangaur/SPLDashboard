import React, { useState, useEffect } from 'react';
import {
  X,
  Play,
  Pause,
  CheckCircle2,
  RotateCcw,
  Trophy,
  Sliders,
  Flame,
  Clock,
  Sparkles,
  ChevronDown,
  Layers,
  ShieldAlert,
} from 'lucide-react';
import { Match, KnockoutMatch, Team, Player, MatchSet, BadmintonScoringRules } from '../../types/tournament';
import { useTournament, sportsAudio } from '../../context/TournamentContext';
import {
  DEFAULT_BADMINTON_RULES,
  evaluateSetStatus,
  evaluateMatchOverall,
} from '../../utils/badmintonEngine';

interface LiveMatchScoringModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialMatchId?: string;
  isKnockout?: boolean;
}

export const LiveMatchScoringModal: React.FC<LiveMatchScoringModalProps> = ({
  isOpen,
  onClose,
  initialMatchId,
  isKnockout = false,
}) => {
  const { state, updateMatch, updateKnockoutMatch, updateSettings } = useTournament();

  const rules: BadmintonScoringRules = state.settings.scoringRules || {
    pointTarget: parseInt(state.settings.format || '21', 10) || 21,
    setsToWin: 1,
    deuceEnabled: true,
    maxPointCap: 30,
    changeEndsAtInterval: true,
  };

  // Match Selection
  const allMatches = isKnockout ? state.knockout.matches : state.matches;
  const [selectedId, setSelectedId] = useState<string>(
    initialMatchId || allMatches[0]?.id || ''
  );

  useEffect(() => {
    if (initialMatchId) {
      setSelectedId(initialMatchId);
    } else if (!selectedId && allMatches.length > 0) {
      setSelectedId(allMatches[0].id);
    }
  }, [initialMatchId, allMatches]);

  const currentMatch = allMatches.find((m) => m.id === selectedId);

  // Teams & Players
  const teamA = state.teams.find((t) => t.id === currentMatch?.teamA);
  const teamB = state.teams.find((t) => t.id === currentMatch?.teamB);

  const getPlayer = (pid: string) => state.players.find((p) => p.id === pid);
  const teamAPlayers = (teamA?.players?.map(getPlayer).filter(Boolean) as Player[]) || [];
  const teamBPlayers = (teamB?.players?.map(getPlayer).filter(Boolean) as Player[]) || [];

  // Rules Configuration Drawer State
  const [showRulesConfig, setShowRulesConfig] = useState(false);
  const [tempRules, setTempRules] = useState<BadmintonScoringRules>(rules);

  // Server state
  const [serverSide, setServerSide] = useState<'A' | 'B'>('A');
  const [confirmReset, setConfirmReset] = useState(false);

  if (!isOpen || !currentMatch) return null;

  const scoreA = currentMatch.scoreA ?? 0;
  const scoreB = currentMatch.scoreB ?? 0;
  const sets: MatchSet[] = currentMatch.sets || [];
  const status = currentMatch.status;

  const isLive = status === 'live';
  const isPaused = status === 'paused';
  const isCompleted = status === 'completed';
  const isUpcoming = status === 'upcoming';

  // Evaluate badminton set status
  const currentSetStatus = evaluateSetStatus(scoreA, scoreB, rules);
  const matchOverall = evaluateMatchOverall(sets, scoreA, scoreB, rules);

  // Service court determination based on badminton rules
  // Even total score: Right service court; Odd total score: Left service court
  const activeServingScore = serverSide === 'A' ? scoreA : scoreB;
  const serviceCourt = activeServingScore % 2 === 0 ? 'Right Court (Even)' : 'Left Court (Odd)';

  // Atomic score mutation helper
  const handleScoreChange = (team: 'A' | 'B', delta: number) => {
    sportsAudio.playScorePing();
    const curA = currentMatch.scoreA ?? 0;
    const curB = currentMatch.scoreB ?? 0;

    const nextA = team === 'A' ? Math.max(0, curA + delta) : curA;
    const nextB = team === 'B' ? Math.max(0, curB + delta) : curB;

    // Automatically shift server if the receiving team wins a rally
    if (delta > 0) {
      if (team !== serverSide) {
        setServerSide(team);
      }
    }

    const setEvaluation = evaluateSetStatus(nextA, nextB, rules);
    let nextStatus: Match['status'] = status === 'upcoming' ? 'live' : status;
    let nextWinner = currentMatch.winner;

    // Check if match is configured as 1 set sprint or if this completes all sets
    if (rules.setsToWin === 1 && setEvaluation.isFinished && setEvaluation.winner) {
      nextStatus = 'completed';
      nextWinner = setEvaluation.winner === 'A' ? currentMatch.teamA : currentMatch.teamB;
      sportsAudio.playFanfare();
    }

    const payload = {
      scoreA: nextA,
      scoreB: nextB,
      status: nextStatus,
      winner: nextWinner,
      sets: sets.length > 0 ? sets : [{ scoreA: nextA, scoreB: nextB }],
    };

    if (isKnockout) {
      updateKnockoutMatch(currentMatch.id, payload as any);
    } else {
      updateMatch(currentMatch.id, payload as any);
    }
  };

  const handleStartMatch = () => {
    sportsAudio.playScorePing();
    const payload = {
      status: 'live' as const,
      scoreA: currentMatch.scoreA ?? 0,
      scoreB: currentMatch.scoreB ?? 0,
    };
    if (isKnockout) updateKnockoutMatch(currentMatch.id, payload);
    else updateMatch(currentMatch.id, payload);
  };

  const handlePauseMatch = () => {
    const payload = { status: 'paused' as const };
    if (isKnockout) updateKnockoutMatch(currentMatch.id, payload);
    else updateMatch(currentMatch.id, payload);
  };

  const handleCompleteMatch = (forcedWinner?: string) => {
    sportsAudio.playFanfare();
    const curA = currentMatch.scoreA ?? 0;
    const curB = currentMatch.scoreB ?? 0;

    const winnerId = forcedWinner || (curA > curB ? currentMatch.teamA : currentMatch.teamB);

    const payload = {
      status: 'completed' as const,
      winner: winnerId,
      scoreA: curA,
      scoreB: curB,
    };

    if (isKnockout) updateKnockoutMatch(currentMatch.id, payload);
    else updateMatch(currentMatch.id, payload);
  };

  const handleNextSet = () => {
    // Record current set as finished and start set 2 or 3
    const setWinner: 'A' | 'B' = scoreA > scoreB ? 'A' : 'B';
    const archivedSets: MatchSet[] = [
      ...sets,
      { scoreA, scoreB, winner: setWinner, isCompleted: true },
    ];

    const payload = {
      scoreA: 0,
      scoreB: 0,
      sets: archivedSets,
      status: 'live' as const,
    };

    if (isKnockout) updateKnockoutMatch(currentMatch.id, payload);
    else updateMatch(currentMatch.id, payload);
  };

  const handleResetCurrentSet = () => {
    const payload = {
      scoreA: 0,
      scoreB: 0,
      status: 'upcoming' as const,
      winner: undefined,
      sets: [],
    };
    if (isKnockout) updateKnockoutMatch(currentMatch.id, payload);
    else updateMatch(currentMatch.id, payload);
    setConfirmReset(false);
  };

  const handleSaveScoringRules = (e: React.FormEvent) => {
    e.preventDefault();
    updateSettings({
      scoringRules: tempRules,
      format: String(tempRules.pointTarget),
    });
    setShowRulesConfig(false);
  };

  const courtNum = ('court' in currentMatch && currentMatch.court) ? currentMatch.court : 1;
  const courtDisplayName =
    ('courtName' in currentMatch && (currentMatch as any).courtName)
      ? (currentMatch as any).courtName
      : state.settings.courtNames?.[courtNum - 1]?.trim() || `Court ${courtNum}`;

  const matchRoundLabel =
    'round' in currentMatch && currentMatch.round
      ? `Round ${currentMatch.round}`
      : 'stage' in currentMatch && (currentMatch as any).stage
      ? String((currentMatch as any).stage)
      : 'Match';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-1.5 sm:p-4 md:p-6 bg-slate-950/90 backdrop-blur-md overflow-y-auto overscroll-contain">
      <div className="relative w-full max-w-4xl max-h-[96dvh] sm:max-h-[92dvh] overflow-y-auto overflow-x-hidden bg-gradient-to-b from-[#0a0f24] via-[#070b1a] to-[#04060f] border border-amber-500/30 rounded-2xl sm:rounded-3xl shadow-2xl shadow-amber-500/10 my-auto animate-fade-in flex flex-col">
        
        {/* ==================================================================== */}
        {/* SECTION 1: MATCH INFORMATION, COURT NUMBER & HEADER CONTROLS         */}
        {/* ==================================================================== */}
        <header className="px-3.5 py-3 sm:px-6 sm:py-4 border-b border-white/10 bg-white/[0.02] shrink-0 space-y-2.5">
          {/* Top Row: Title, Badge, Action Icons */}
          <div className="flex items-center justify-between gap-2 min-w-0">
            <div className="flex items-center gap-2 sm:gap-3 min-w-0">
              <span className="flex h-8 w-8 sm:h-9 sm:w-9 items-center justify-center rounded-xl bg-amber-500/20 text-amber-400 font-bold text-lg sm:text-xl shadow-inner shrink-0">
                🏸
              </span>
              <div className="min-w-0">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <h1 className="text-sm sm:text-lg font-black text-white font-display truncate">
                    Official Umpire Console
                  </h1>
                  <span className="px-1.5 py-0.5 rounded text-[9px] sm:text-[10px] font-black uppercase tracking-wider bg-amber-500/20 text-amber-300 border border-amber-500/30 shrink-0">
                    Live Scoring
                  </span>
                </div>
                <p className="text-[10px] sm:text-xs text-slate-400 truncate">
                  {state.settings.name} · <span className="text-amber-400 font-semibold">{courtDisplayName}</span> · {matchRoundLabel}
                </p>
              </div>
            </div>

            {/* Quick Actions (Rules Toggle & Close) */}
            <div className="flex items-center gap-1.5 shrink-0">
              <button
                type="button"
                onClick={() => setShowRulesConfig(!showRulesConfig)}
                className={`min-w-[40px] min-h-[40px] sm:min-w-[44px] sm:min-h-[44px] p-2 rounded-xl border flex items-center justify-center transition-all ${
                  showRulesConfig
                    ? 'bg-amber-400 text-slate-950 border-amber-400 font-bold'
                    : 'bg-white/5 hover:bg-white/10 text-slate-300 border-white/10'
                }`}
                title="Configure Badminton Scoring Rules"
                aria-label="Configure Badminton Rules"
              >
                <Sliders className="w-4 h-4" />
              </button>

              <button
                type="button"
                onClick={onClose}
                className="min-w-[40px] min-h-[40px] sm:min-w-[44px] sm:min-h-[44px] p-2 rounded-xl bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white border border-white/10 transition-colors flex items-center justify-center"
                title="Close Umpire Mode"
                aria-label="Close Umpire Mode"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Second Row: Responsive Match Switcher */}
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-[10px] sm:text-xs font-semibold text-slate-400 shrink-0 hidden xs:inline">
              Match:
            </span>
            <div className="relative flex-1 min-w-0">
              <select
                value={selectedId}
                onChange={(e) => setSelectedId(e.target.value)}
                className="w-full appearance-none pl-3 pr-8 py-1.5 min-h-[38px] rounded-xl text-xs font-bold text-slate-200 bg-white/10 border border-white/15 focus:outline-none focus:border-amber-400 cursor-pointer truncate"
              >
                {allMatches.map((m) => {
                  const tA = state.teams.find((t) => t.id === m.teamA)?.name || 'Team A';
                  const tB = state.teams.find((t) => t.id === m.teamB)?.name || 'Team B';
                  const cLabel =
                    'courtName' in m && (m as any).courtName
                      ? (m as any).courtName
                      : 'court' in m && m.court
                      ? `C${m.court}`
                      : 'KO';
                  return (
                    <option key={m.id} value={m.id} className="bg-slate-900 text-white">
                      {cLabel}: {tA} vs {tB} [{m.status.toUpperCase()}]
                    </option>
                  );
                })}
              </select>
              <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>
          </div>
        </header>

        {/* Rules Config Drawer (Collapsible) */}
        {showRulesConfig && (
          <form
            onSubmit={handleSaveScoringRules}
            className="p-3.5 sm:p-5 bg-black/60 border-b border-amber-500/20 text-xs text-slate-300 space-y-3 animate-fade-in shrink-0"
          >
            <div className="flex items-center justify-between pb-2 border-b border-white/10">
              <span className="font-bold text-amber-400 uppercase tracking-wider flex items-center gap-1.5 text-xs">
                <Sliders className="w-3.5 h-3.5" />
                Tournament Scoring Regulations
              </span>
              <span className="text-[10px] text-slate-400">
                Official SPL Rules
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2.5 sm:gap-4">
              <div>
                <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                  Point Target (Per Set)
                </label>
                <select
                  value={tempRules.pointTarget}
                  onChange={(e) =>
                    setTempRules({ ...tempRules, pointTarget: Number(e.target.value) })
                  }
                  className="w-full px-3 py-2 min-h-[42px] rounded-xl bg-slate-900 border border-white/15 text-white font-bold text-xs"
                >
                  <option value={21}>21 Points (Standard BWF)</option>
                  <option value={15}>15 Points (Fast Format)</option>
                  <option value={30}>30 Points (Single Golden Game)</option>
                  <option value={11}>11 Points (Short Sprint)</option>
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                  Match Format (Sets)
                </label>
                <select
                  value={tempRules.setsToWin}
                  onChange={(e) =>
                    setTempRules({ ...tempRules, setsToWin: Number(e.target.value) })
                  }
                  className="w-full px-3 py-2 min-h-[42px] rounded-xl bg-slate-900 border border-white/15 text-white font-bold text-xs"
                >
                  <option value={1}>1 Set (Single Frame Sprint)</option>
                  <option value={2}>Best of 3 Sets (Win 2)</option>
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                  Deuce / 2-Point Clear
                </label>
                <select
                  value={tempRules.deuceEnabled ? 'yes' : 'no'}
                  onChange={(e) =>
                    setTempRules({ ...tempRules, deuceEnabled: e.target.value === 'yes' })
                  }
                  className="w-full px-3 py-2 min-h-[42px] rounded-xl bg-slate-900 border border-white/15 text-white font-bold text-xs"
                >
                  <option value="yes">Enabled (Must lead by 2)</option>
                  <option value="no">Sudden Death (First to Target)</option>
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                  Max Point Cap
                </label>
                <input
                  type="number"
                  min={tempRules.pointTarget}
                  max={50}
                  value={tempRules.maxPointCap}
                  onChange={(e) =>
                    setTempRules({ ...tempRules, maxPointCap: Number(e.target.value) })
                  }
                  className="w-full px-3 py-2 min-h-[42px] rounded-xl bg-slate-900 border border-white/15 text-white font-bold text-xs"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={() => setShowRulesConfig(false)}
                className="px-3.5 py-2 min-h-[40px] rounded-xl text-slate-400 hover:text-white"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-2 min-h-[40px] rounded-xl font-bold bg-amber-400 text-slate-950 hover:bg-amber-300 shadow active:scale-95 transition-transform"
              >
                Apply Rules
              </button>
            </div>
          </form>
        )}

        {/* Live Status & Tactical Indicator Strip */}
        <div className="flex flex-wrap items-center justify-between gap-2 px-3.5 py-2.5 sm:px-6 sm:py-3 bg-white/[0.03] border-b border-white/5 text-[11px] shrink-0">
          <div className="flex items-center gap-2 flex-wrap">
            {isLive ? (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-rose-500/20 text-rose-300 border border-rose-500/40 font-black uppercase text-[10px] shadow-sm">
                <span className="w-2 h-2 rounded-full bg-rose-500 animate-ping" />
                <span>LIVE MATCH</span>
              </span>
            ) : isPaused ? (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40 font-black uppercase text-[10px]">
                <Pause className="w-3 h-3" />
                <span>PAUSED</span>
              </span>
            ) : isCompleted ? (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 font-black uppercase text-[10px]">
                <CheckCircle2 className="w-3 h-3" />
                <span>COMPLETED</span>
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-500/20 text-slate-300 border border-slate-500/40 font-black uppercase text-[10px]">
                <Clock className="w-3 h-3" />
                <span>UPCOMING</span>
              </span>
            )}

            <span className="text-slate-300 font-semibold">
              Set {sets.length + 1}
            </span>
            <span className="text-slate-500 font-mono hidden xs:inline">·</span>
            <span className="text-slate-400 font-mono hidden xs:inline">
              Target: {rules.pointTarget} pts
            </span>
          </div>

          {/* Service Court Direction Pill */}
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white/5 border border-white/5 text-[10px]">
            <span className="text-slate-400 uppercase font-semibold">Service:</span>
            <span className="text-amber-300 font-bold">{serviceCourt}</span>
          </div>
        </div>

        {/* Scrollable Center Content: Teams, Scoreboard & Clickers */}
        <div className="p-3 sm:p-6 md:p-8 space-y-4 sm:space-y-6 overflow-y-auto overflow-x-hidden flex-1">
          
          {/* ==================================================================== */}
          {/* SECTION 2 & 3: TEAMS DETAILS & DUAL LIVE SCOREBOARD                  */}
          {/* ==================================================================== */}
          <div className="rounded-2xl sm:rounded-3xl bg-slate-900/60 border border-white/10 p-3.5 sm:p-6 shadow-xl">
            <div className="grid grid-cols-2 gap-2 sm:gap-6 items-start">
              
              {/* TEAM A CARD */}
              <div className="p-2.5 sm:p-4 rounded-xl sm:rounded-2xl bg-gradient-to-b from-amber-500/10 via-white/[0.02] to-transparent border border-amber-500/20 flex flex-col justify-between space-y-2 sm:space-y-3 min-w-0">
                {/* Team Info & Serve Toggle */}
                <div className="flex items-start justify-between gap-1.5 min-w-0">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-xl sm:text-2xl shrink-0">
                      {teamA?.badge || '🏸'}
                    </span>
                    <div className="min-w-0">
                      <h2 className="text-xs sm:text-base font-black text-white font-display truncate">
                        {teamA?.name || 'Team A'}
                      </h2>
                      <p className="text-[10px] sm:text-xs text-slate-400 truncate">
                        {teamAPlayers.length > 0
                          ? teamAPlayers.map((p) => p.name).join(' & ')
                          : 'Team Pair'}
                      </p>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => setServerSide('A')}
                    className={`min-h-[36px] sm:min-h-[40px] px-2 py-1 rounded-xl border text-[10px] sm:text-xs font-bold flex items-center gap-1 transition-all shrink-0 active:scale-95 ${
                      serverSide === 'A'
                        ? 'bg-amber-400 text-slate-950 border-amber-400 shadow-md font-black ring-2 ring-amber-400/40'
                        : 'bg-white/5 text-slate-400 border-white/10 hover:bg-white/10'
                    }`}
                    title="Set Team A as Serving Team"
                    aria-label="Set Team A as Serving Team"
                  >
                    <span>🏸</span>
                    <span className="hidden sm:inline">Serve</span>
                  </button>
                </div>

                {/* Score Digit Display */}
                <div className="text-center py-1 sm:py-2">
                  <div className="font-mono text-5xl sm:text-7xl font-black text-amber-400 tracking-tight tabular-nums drop-shadow-[0_0_20px_rgba(251,191,36,0.3)]">
                    {scoreA}
                  </div>
                  {currentSetStatus.isGamePointA && (
                    <span className="inline-block mt-1 px-2 py-0.5 rounded-full text-[9px] sm:text-[10px] font-black uppercase bg-amber-500/20 text-amber-300 border border-amber-500/30">
                      🔥 GAME POINT
                    </span>
                  )}
                  {currentMatch.winner === currentMatch.teamA && (
                    <span className="inline-block mt-1 px-2 py-0.5 rounded-full text-[9px] sm:text-[10px] font-black uppercase bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                      👑 WINNER
                    </span>
                  )}
                </div>

                {/* ============================================================== */}
                {/* SECTION 4: TEAM A SCORE INCREASE / DECREASE CONTROLS           */}
                {/* ============================================================== */}
                <div className="pt-2 border-t border-white/10 space-y-2">
                  <button
                    type="button"
                    onClick={() => handleScoreChange('A', 1)}
                    disabled={isCompleted}
                    className="w-full min-h-[48px] sm:min-h-[54px] rounded-xl sm:rounded-2xl bg-gradient-to-r from-amber-400 via-amber-300 to-amber-500 hover:from-amber-300 hover:to-amber-400 text-slate-950 font-black text-base sm:text-xl shadow-lg shadow-amber-500/20 active:scale-95 transition-all flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                    title="Add 1 Point to Team A"
                    aria-label={`Add 1 point for ${teamA?.name || 'Team A'}`}
                  >
                    <span className="text-lg font-black">+1</span>
                    <span className="text-xs sm:text-sm font-black uppercase">Point</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleScoreChange('A', -1)}
                    disabled={scoreA === 0 || isCompleted}
                    className="w-full min-h-[44px] rounded-xl bg-white/10 hover:bg-white/15 text-slate-300 font-bold text-xs sm:text-sm active:scale-95 transition-all flex items-center justify-center gap-1 cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed border border-white/5"
                    title="Undo Last Point for Team A"
                    aria-label={`Undo point for ${teamA?.name || 'Team A'}`}
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>Undo (-1)</span>
                  </button>
                </div>
              </div>

              {/* TEAM B CARD */}
              <div className="p-2.5 sm:p-4 rounded-xl sm:rounded-2xl bg-gradient-to-b from-cyan-500/10 via-white/[0.02] to-transparent border border-cyan-500/20 flex flex-col justify-between space-y-2 sm:space-y-3 min-w-0">
                {/* Team Info & Serve Toggle */}
                <div className="flex items-start justify-between gap-1.5 min-w-0">
                  <button
                    type="button"
                    onClick={() => setServerSide('B')}
                    className={`min-h-[36px] sm:min-h-[40px] px-2 py-1 rounded-xl border text-[10px] sm:text-xs font-bold flex items-center gap-1 transition-all shrink-0 active:scale-95 ${
                      serverSide === 'B'
                        ? 'bg-cyan-400 text-slate-950 border-cyan-400 shadow-md font-black ring-2 ring-cyan-400/40'
                        : 'bg-white/5 text-slate-400 border-white/10 hover:bg-white/10'
                    }`}
                    title="Set Team B as Serving Team"
                    aria-label="Set Team B as Serving Team"
                  >
                    <span>🏸</span>
                    <span className="hidden sm:inline">Serve</span>
                  </button>

                  <div className="flex items-center gap-2 min-w-0 text-right justify-end">
                    <div className="min-w-0">
                      <h2 className="text-xs sm:text-base font-black text-white font-display truncate">
                        {teamB?.name || 'Team B'}
                      </h2>
                      <p className="text-[10px] sm:text-xs text-slate-400 truncate">
                        {teamBPlayers.length > 0
                          ? teamBPlayers.map((p) => p.name).join(' & ')
                          : 'Team Pair'}
                      </p>
                    </div>
                    <span className="text-xl sm:text-2xl shrink-0">
                      {teamB?.badge || '🏸'}
                    </span>
                  </div>
                </div>

                {/* Score Digit Display */}
                <div className="text-center py-1 sm:py-2">
                  <div className="font-mono text-5xl sm:text-7xl font-black text-cyan-400 tracking-tight tabular-nums drop-shadow-[0_0_20px_rgba(6,182,212,0.3)]">
                    {scoreB}
                  </div>
                  {currentSetStatus.isGamePointB && (
                    <span className="inline-block mt-1 px-2 py-0.5 rounded-full text-[9px] sm:text-[10px] font-black uppercase bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
                      🔥 GAME POINT
                    </span>
                  )}
                  {currentMatch.winner === currentMatch.teamB && (
                    <span className="inline-block mt-1 px-2 py-0.5 rounded-full text-[9px] sm:text-[10px] font-black uppercase bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                      👑 WINNER
                    </span>
                  )}
                </div>

                {/* ============================================================== */}
                {/* SECTION 4: TEAM B SCORE INCREASE / DECREASE CONTROLS           */}
                {/* ============================================================== */}
                <div className="pt-2 border-t border-white/10 space-y-2">
                  <button
                    type="button"
                    onClick={() => handleScoreChange('B', 1)}
                    disabled={isCompleted}
                    className="w-full min-h-[48px] sm:min-h-[54px] rounded-xl sm:rounded-2xl bg-gradient-to-r from-cyan-400 via-sky-300 to-blue-500 hover:from-cyan-300 hover:to-blue-400 text-slate-950 font-black text-base sm:text-xl shadow-lg shadow-cyan-500/20 active:scale-95 transition-all flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                    title="Add 1 Point to Team B"
                    aria-label={`Add 1 point for ${teamB?.name || 'Team B'}`}
                  >
                    <span className="text-lg font-black">+1</span>
                    <span className="text-xs sm:text-sm font-black uppercase">Point</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleScoreChange('B', -1)}
                    disabled={scoreB === 0 || isCompleted}
                    className="w-full min-h-[44px] rounded-xl bg-white/10 hover:bg-white/15 text-slate-300 font-bold text-xs sm:text-sm active:scale-95 transition-all flex items-center justify-center gap-1 cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed border border-white/5"
                    title="Undo Last Point for Team B"
                    aria-label={`Undo point for ${teamB?.name || 'Team B'}`}
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>Undo (-1)</span>
                  </button>
                </div>
              </div>

            </div>

            {/* Tactical Game State / Deuce / Lead Indicator Banner */}
            <div className="mt-3 sm:mt-4 pt-3 border-t border-white/10 flex flex-col sm:flex-row items-center justify-between gap-2 text-center text-xs">
              <span className="font-bold uppercase tracking-wider text-amber-300">
                {currentSetStatus.isDeuce
                  ? '⚡ DEUCE · 20-ALL (MUST LEAD BY 2 POINTS)'
                  : currentSetStatus.isGamePointA || currentSetStatus.isGamePointB
                  ? '🔥 GAME POINT DECIDER'
                  : 'Rally Point Transmission Active'}
              </span>
              <span className="font-medium text-emerald-400">
                {currentSetStatus.leadText}
              </span>
            </div>
          </div>

          {/* ==================================================================== */}
          {/* SECTION 5: MATCH ACTIONS & ADDITIONAL CONTROLS                      */}
          {/* ==================================================================== */}
          <div className="p-3.5 sm:p-5 rounded-2xl bg-white/[0.02] border border-white/10 space-y-3">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
              Umpire Match Controls
            </h3>

            <div className="flex flex-wrap items-center gap-2 sm:gap-3">
              {/* Start / Resume */}
              {!isLive && !isCompleted && (
                <button
                  type="button"
                  onClick={handleStartMatch}
                  className="flex-1 min-w-[130px] min-h-[44px] px-4 py-2 rounded-xl font-bold text-xs bg-emerald-500 hover:bg-emerald-400 text-slate-950 transition-all shadow-md active:scale-95 flex items-center justify-center gap-1.5"
                >
                  <Play className="w-4 h-4 fill-current" />
                  <span>Start Match</span>
                </button>
              )}

              {/* Pause */}
              {isLive && (
                <button
                  type="button"
                  onClick={handlePauseMatch}
                  className="flex-1 min-w-[120px] min-h-[44px] px-4 py-2 rounded-xl font-bold text-xs bg-amber-500/20 text-amber-300 hover:bg-amber-500/30 border border-amber-500/30 transition-all active:scale-95 flex items-center justify-center gap-1.5"
                >
                  <Pause className="w-4 h-4" />
                  <span>Pause Time</span>
                </button>
              )}

              {/* Resume */}
              {isPaused && (
                <button
                  type="button"
                  onClick={handleStartMatch}
                  className="flex-1 min-w-[120px] min-h-[44px] px-4 py-2 rounded-xl font-bold text-xs bg-emerald-500 hover:bg-emerald-400 text-slate-950 transition-all active:scale-95 flex items-center justify-center gap-1.5"
                >
                  <Play className="w-4 h-4 fill-current" />
                  <span>Resume Match</span>
                </button>
              )}

              {/* Next Set (For Multi-Set Formats) */}
              {rules.setsToWin > 1 && currentSetStatus.isFinished && !matchOverall.isMatchCompleted && (
                <button
                  type="button"
                  onClick={handleNextSet}
                  className="flex-1 min-w-[140px] min-h-[44px] px-4 py-2 rounded-xl font-black text-xs bg-lime-400 text-slate-950 hover:bg-lime-300 shadow-md active:scale-95 transition-all flex items-center justify-center gap-1.5"
                >
                  <Sparkles className="w-4 h-4" />
                  <span>Start Next Set →</span>
                </button>
              )}

              {/* Finish / Declare Winner */}
              {!isCompleted ? (
                <button
                  type="button"
                  onClick={() => handleCompleteMatch()}
                  className="flex-1 min-w-[140px] min-h-[44px] px-4 py-2 rounded-xl font-bold text-xs bg-emerald-400 text-slate-950 hover:bg-emerald-300 transition-all shadow-md active:scale-95 flex items-center justify-center gap-1.5"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Finish & Declare</span>
                </button>
              ) : confirmReset ? (
                <div className="flex items-center gap-2 flex-1 min-w-[200px]">
                  <button
                    type="button"
                    onClick={handleResetCurrentSet}
                    className="flex-1 min-h-[44px] px-3 py-2 rounded-xl text-xs font-black bg-rose-500 text-white hover:bg-rose-400 transition-colors active:scale-95"
                  >
                    Confirm Reset (0 - 0)
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmReset(false)}
                    className="min-h-[44px] px-3 py-2 rounded-xl text-xs text-slate-400 hover:text-white bg-white/5"
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setConfirmReset(true)}
                  className="min-h-[44px] px-4 py-2 rounded-xl text-xs text-slate-400 hover:text-white bg-white/5 hover:bg-white/10 border border-white/5 transition-all flex items-center justify-center gap-1.5"
                  title="Reset Scores to 0-0"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Reset Scores</span>
                </button>
              )}
            </div>
          </div>

          {/* Set History Breakdown Table (if multiple sets exist) */}
          {sets.length > 0 && (
            <div className="p-3.5 sm:p-5 rounded-2xl bg-white/[0.02] border border-white/5 space-y-2.5">
              <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5 text-amber-400" />
                Game Sets Breakdown
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                {sets.map((s, idx) => (
                  <div
                    key={idx}
                    className="p-3 rounded-xl bg-white/[0.03] border border-white/10 flex items-center justify-between text-xs"
                  >
                    <span className="font-bold text-slate-400">Set {idx + 1}</span>
                    <span className="font-mono font-black text-white">
                      {s.scoreA} — {s.scoreB}
                    </span>
                    <span
                      className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                        s.scoreA > s.scoreB ? 'text-amber-400' : 'text-cyan-400'
                      }`}
                    >
                      {s.scoreA > s.scoreB ? teamA?.name?.slice(0, 8) || 'Team A' : teamB?.name?.slice(0, 8) || 'Team B'}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

        </div>

      </div>
    </div>
  );
};
