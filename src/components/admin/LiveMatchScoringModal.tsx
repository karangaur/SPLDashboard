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
  const teamAPlayers = teamA?.players?.map(getPlayer).filter(Boolean) as Player[] || [];
  const teamBPlayers = teamB?.players?.map(getPlayer).filter(Boolean) as Player[] || [];

  // Rules Configuration Drawer State
  const [showRulesConfig, setShowRulesConfig] = useState(false);
  const [tempRules, setTempRules] = useState<BadmintonScoringRules>(rules);

  // Server state
  const [serverSide, setServerSide] = useState<'A' | 'B'>('A');

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
  const serviceCourt = activeServingScore % 2 === 0 ? 'Right Service Court (Even)' : 'Left Service Court (Odd)';

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
    if (!window.confirm('Reset score to 0 - 0 for this match?')) return;
    const payload = {
      scoreA: 0,
      scoreB: 0,
      status: 'upcoming' as const,
      winner: undefined,
      sets: [],
    };
    if (isKnockout) updateKnockoutMatch(currentMatch.id, payload);
    else updateMatch(currentMatch.id, payload);
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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-slate-950/85 backdrop-blur-md overflow-y-auto">
      <div className="relative w-full max-w-4xl bg-gradient-to-b from-[#0a0f24] via-[#070b1a] to-[#04060f] border border-amber-500/30 rounded-3xl shadow-2xl shadow-amber-500/10 overflow-hidden my-auto animate-fade-in">
        
        {/* Top Control Bar */}
        <div className="flex flex-wrap items-center justify-between gap-3 p-4 sm:p-6 border-b border-white/10 bg-white/[0.02]">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-amber-500/20 text-amber-400 font-bold text-2xl shadow-inner">
              🏸
            </span>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg sm:text-xl font-black text-white font-display">
                  Official Live Scoreboard
                </h2>
                <span className="px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider bg-amber-500/20 text-amber-300 border border-amber-500/30">
                  Umpire Mode
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Smash Premier League · Court {courtNum} · Point-by-point live transmission
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Match Switcher Dropdown */}
            <div className="relative">
              <select
                value={selectedId}
                onChange={(e) => setSelectedId(e.target.value)}
                className="appearance-none pl-3 pr-8 py-1.5 rounded-xl text-xs font-bold text-slate-200 bg-white/10 border border-white/15 focus:outline-none focus:border-amber-400 cursor-pointer"
              >
                {allMatches.map((m) => {
                  const tA = state.teams.find((t) => t.id === m.teamA)?.name || 'Team A';
                  const tB = state.teams.find((t) => t.id === m.teamB)?.name || 'Team B';
                  const cLabel = 'court' in m && m.court ? `C${m.court}` : 'KO';
                  return (
                    <option key={m.id} value={m.id} className="bg-slate-900 text-white">
                      {cLabel}: {tA} vs {tB} [{m.status.toUpperCase()}]
                    </option>
                  );
                })}
              </select>
              <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>

            {/* Rules button */}
            <button
              onClick={() => setShowRulesConfig(!showRulesConfig)}
              className={`p-2 rounded-xl border transition-all ${
                showRulesConfig
                  ? 'bg-amber-400 text-slate-950 border-amber-400 font-bold'
                  : 'bg-white/5 hover:bg-white/10 text-slate-300 border-white/10'
              }`}
              title="Configure Badminton Rules"
            >
              <Sliders className="w-4 h-4" />
            </button>

            {/* Close */}
            <button
              onClick={onClose}
              className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white border border-white/10 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Rules Config Drawer (Collapsible) */}
        {showRulesConfig && (
          <form
            onSubmit={handleSaveScoringRules}
            className="p-4 sm:p-5 bg-black/40 border-b border-amber-500/20 text-xs text-slate-300 space-y-4 animate-fade-in"
          >
            <div className="flex items-center justify-between pb-2 border-b border-white/10">
              <span className="font-bold text-amber-400 uppercase tracking-wider flex items-center gap-1.5">
                <Sliders className="w-3.5 h-3.5" />
                Badminton Tournament Scoring Rules
              </span>
              <span className="text-[11px] text-slate-400">
                Configurable per tournament regulations
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
              <div>
                <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                  Point Target (Per Set)
                </label>
                <select
                  value={tempRules.pointTarget}
                  onChange={(e) =>
                    setTempRules({ ...tempRules, pointTarget: Number(e.target.value) })
                  }
                  className="w-full px-3 py-2 rounded-xl bg-white/5 border border-white/15 text-white font-bold"
                >
                  <option value={21} className="bg-slate-900">21 Points (Standard BWF)</option>
                  <option value={15} className="bg-slate-900">15 Points (Fast Format)</option>
                  <option value={30} className="bg-slate-900">30 Points (Single Golden Game)</option>
                  <option value={11} className="bg-slate-900">11 Points (Short Sprint)</option>
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
                  className="w-full px-3 py-2 rounded-xl bg-white/5 border border-white/15 text-white font-bold"
                >
                  <option value={1} className="bg-slate-900">1 Set (Single Frame Sprint)</option>
                  <option value={2} className="bg-slate-900">Best of 3 Sets (Win 2)</option>
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
                  className="w-full px-3 py-2 rounded-xl bg-white/5 border border-white/15 text-white font-bold"
                >
                  <option value="yes" className="bg-slate-900">Enabled (Must lead by 2)</option>
                  <option value="no" className="bg-slate-900">Sudden Death (First to Target)</option>
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
                  className="w-full px-3 py-2 rounded-xl bg-white/5 border border-white/15 text-white font-bold"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowRulesConfig(false)}
                className="px-3 py-1.5 rounded-lg text-slate-400 hover:text-white"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-1.5 rounded-xl font-bold bg-amber-400 text-slate-950 hover:bg-amber-300 shadow"
              >
                Apply Rules
              </button>
            </div>
          </form>
        )}

        {/* Live Match Status Strip */}
        <div className="flex flex-wrap items-center justify-between gap-3 px-6 py-3 bg-white/[0.03] border-b border-white/5 text-xs">
          <div className="flex items-center gap-2.5">
            {isLive ? (
              <span className="flex items-center gap-2 px-3 py-1 rounded-full bg-rose-500/20 text-rose-300 border border-rose-500/40 font-black uppercase text-[11px] shadow-sm">
                <span className="w-2 h-2 rounded-full bg-rose-500 animate-ping" />
                <span>LIVE MATCH IN PROGRESS</span>
              </span>
            ) : isPaused ? (
              <span className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40 font-black uppercase text-[11px]">
                <Pause className="w-3.5 h-3.5" />
                <span>MATCH PAUSED / TIMEOUT</span>
              </span>
            ) : isCompleted ? (
              <span className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 font-black uppercase text-[11px]">
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>MATCH COMPLETED · WINNER DECLARED</span>
              </span>
            ) : (
              <span className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-500/20 text-slate-300 border border-slate-500/40 font-black uppercase text-[11px]">
                <Clock className="w-3.5 h-3.5" />
                <span>UPCOMING MATCH</span>
              </span>
            )}

            <span className="text-slate-400 font-mono hidden sm:inline">
              Target: {rules.pointTarget} pts · {rules.setsToWin > 1 ? `Best of ${rules.setsToWin * 2 - 1}` : 'Single Set'}
            </span>
          </div>

          {/* Action buttons: Start, Pause, Finish */}
          <div className="flex items-center gap-2">
            {!isLive && !isCompleted && (
              <button
                onClick={handleStartMatch}
                className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl font-black text-xs bg-emerald-500 hover:bg-emerald-400 text-slate-950 transition-all shadow-md active:scale-95"
              >
                <Play className="w-3.5 h-3.5 fill-current" />
                <span>Start Match</span>
              </button>
            )}

            {isLive && (
              <button
                onClick={handlePauseMatch}
                className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl font-bold text-xs bg-amber-500/20 text-amber-300 hover:bg-amber-500/30 border border-amber-500/30 transition-all"
              >
                <Pause className="w-3.5 h-3.5" />
                <span>Pause</span>
              </button>
            )}

            {isPaused && (
              <button
                onClick={handleStartMatch}
                className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl font-bold text-xs bg-emerald-500 hover:bg-emerald-400 text-slate-950 transition-all"
              >
                <Play className="w-3.5 h-3.5 fill-current" />
                <span>Resume</span>
              </button>
            )}

            {!isCompleted ? (
              <button
                onClick={() => handleCompleteMatch()}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-bold text-xs bg-lime-400 text-slate-950 hover:bg-lime-300 transition-all shadow-md"
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Declare Winner</span>
              </button>
            ) : (
              <button
                onClick={handleResetCurrentSet}
                className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs text-slate-400 hover:text-white bg-white/5 hover:bg-white/10"
                title="Reset Match"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Reset</span>
              </button>
            )}
          </div>
        </div>

        {/* Main Stadium Tactical Scoreboard */}
        <div className="p-5 sm:p-8">
          <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-center">
            
            {/* Team A Side */}
            <div className="md:col-span-5 p-5 sm:p-6 rounded-3xl bg-gradient-to-b from-amber-500/10 via-white/[0.02] to-transparent border border-amber-500/20 shadow-xl space-y-4">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-tr from-amber-500 to-amber-400 text-slate-950 font-black text-2xl shadow-lg shadow-amber-500/20">
                    <span>{teamA?.badge || '🏸'}</span>
                  </div>
                  <div className="min-w-0">
                    <h3 className="text-lg font-black text-white font-display truncate">
                      {teamA?.name || 'Team A'}
                    </h3>
                    <p className="text-xs text-slate-400 truncate">
                      {teamAPlayers.length > 0
                        ? teamAPlayers.map((p) => p.name).join(' & ')
                        : 'Doubles Pair'}
                    </p>
                  </div>
                </div>

                {/* Serving shuttle indicator */}
                <button
                  onClick={() => setServerSide('A')}
                  className={`p-1.5 rounded-xl border text-xs font-bold flex items-center gap-1 transition-all ${
                    serverSide === 'A'
                      ? 'bg-amber-400 text-slate-950 border-amber-400 shadow-md'
                      : 'bg-white/5 text-slate-400 border-white/5 hover:bg-white/10'
                  }`}
                  title="Mark Team A as Server"
                >
                  <span>🏸</span>
                  <span className="hidden sm:inline">Serve</span>
                </button>
              </div>

              {/* Massive Score Display & Increment / Decrement Clickers */}
              <div className="flex items-center justify-between gap-4 py-2">
                <div className="space-y-1">
                  <div className="font-mono text-6xl sm:text-7xl font-black text-amber-400 tracking-tight drop-shadow-[0_0_20px_rgba(251,191,36,0.3)]">
                    {scoreA}
                  </div>
                  {currentSetStatus.isGamePointA && (
                    <span className="inline-block px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase bg-amber-500/20 text-amber-300 border border-amber-500/30">
                      🔥 GAME POINT
                    </span>
                  )}
                  {currentMatch.winner === currentMatch.teamA && (
                    <span className="inline-block px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                      👑 MATCH WINNER
                    </span>
                  )}
                </div>

                {/* Tactile Score Controls */}
                <div className="flex flex-col gap-2">
                  <button
                    onClick={() => handleScoreChange('A', 1)}
                    disabled={isCompleted}
                    className="w-20 h-14 rounded-2xl bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 text-slate-950 font-black text-xl shadow-lg shadow-amber-500/20 active:scale-95 transition-all flex items-center justify-center cursor-pointer disabled:opacity-50"
                  >
                    +1
                  </button>
                  <button
                    onClick={() => handleScoreChange('A', -1)}
                    disabled={scoreA === 0 || isCompleted}
                    className="w-20 h-9 rounded-xl bg-white/10 hover:bg-white/20 text-slate-300 font-bold text-sm active:scale-95 transition-all flex items-center justify-center cursor-pointer disabled:opacity-30"
                  >
                    -1 Undo
                  </button>
                </div>
              </div>
            </div>

            {/* Middle Match Broadcast Status & VS Divider */}
            <div className="md:col-span-2 flex flex-col items-center justify-center text-center space-y-3 py-2">
              <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-white/5 border border-white/10 text-slate-400 font-black text-sm font-mono shadow-inner">
                VS
              </div>
              <div className="space-y-1">
                <span className="text-xs font-black uppercase tracking-wider text-slate-200 block font-display">
                  {currentSetStatus.isDeuce
                    ? '⚡ DEUCE · 20-ALL'
                    : `SET 0${sets.length + 1}`}
                </span>
                <span className="text-[11px] text-lime-400 font-semibold block px-2">
                  {currentSetStatus.leadText}
                </span>
              </div>

              {/* Current Serving Court Direction */}
              <div className="p-2 rounded-xl bg-white/[0.04] border border-white/5 text-[10px] text-slate-400 space-y-0.5">
                <span className="block text-slate-500 uppercase tracking-widest font-bold">Service Position</span>
                <span className="text-slate-300 font-medium block">{serviceCourt}</span>
              </div>

              {/* Next Set Button (For Best of 3 Formats) */}
              {rules.setsToWin > 1 && currentSetStatus.isFinished && !matchOverall.isMatchCompleted && (
                <button
                  onClick={handleNextSet}
                  className="px-3 py-1.5 rounded-xl font-bold text-xs bg-lime-400 text-slate-950 hover:bg-lime-300 shadow-md active:scale-95 transition-all"
                >
                  Start Next Set →
                </button>
              )}
            </div>

            {/* Team B Side */}
            <div className="md:col-span-5 p-5 sm:p-6 rounded-3xl bg-gradient-to-b from-blue-500/10 via-white/[0.02] to-transparent border border-blue-500/20 shadow-xl space-y-4">
              <div className="flex items-center justify-between gap-3">
                {/* Serving shuttle indicator */}
                <button
                  onClick={() => setServerSide('B')}
                  className={`p-1.5 rounded-xl border text-xs font-bold flex items-center gap-1 transition-all ${
                    serverSide === 'B'
                      ? 'bg-blue-400 text-slate-950 border-blue-400 shadow-md'
                      : 'bg-white/5 text-slate-400 border-white/5 hover:bg-white/10'
                  }`}
                  title="Mark Team B as Server"
                >
                  <span>🏸</span>
                  <span className="hidden sm:inline">Serve</span>
                </button>

                <div className="flex items-center justify-end gap-3 min-w-0 text-right">
                  <div className="min-w-0">
                    <h3 className="text-lg font-black text-white font-display truncate">
                      {teamB?.name || 'Team B'}
                    </h3>
                    <p className="text-xs text-slate-400 truncate">
                      {teamBPlayers.length > 0
                        ? teamBPlayers.map((p) => p.name).join(' & ')
                        : 'Doubles Pair'}
                    </p>
                  </div>
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-tr from-cyan-500 to-blue-500 text-white font-black text-2xl shadow-lg shadow-blue-500/20">
                    <span>{teamB?.badge || '🏸'}</span>
                  </div>
                </div>
              </div>

              {/* Massive Score Display & Increment / Decrement Clickers */}
              <div className="flex items-center justify-between gap-4 py-2">
                {/* Tactile Score Controls */}
                <div className="flex flex-col gap-2">
                  <button
                    onClick={() => handleScoreChange('B', 1)}
                    disabled={isCompleted}
                    className="w-20 h-14 rounded-2xl bg-gradient-to-r from-cyan-400 to-blue-500 hover:from-cyan-300 hover:to-blue-400 text-white font-black text-xl shadow-lg shadow-cyan-500/20 active:scale-95 transition-all flex items-center justify-center cursor-pointer disabled:opacity-50"
                  >
                    +1
                  </button>
                  <button
                    onClick={() => handleScoreChange('B', -1)}
                    disabled={scoreB === 0 || isCompleted}
                    className="w-20 h-9 rounded-xl bg-white/10 hover:bg-white/20 text-slate-300 font-bold text-sm active:scale-95 transition-all flex items-center justify-center cursor-pointer disabled:opacity-30"
                  >
                    -1 Undo
                  </button>
                </div>

                <div className="space-y-1 text-right">
                  <div className="font-mono text-6xl sm:text-7xl font-black text-cyan-400 tracking-tight drop-shadow-[0_0_20px_rgba(6,182,212,0.3)]">
                    {scoreB}
                  </div>
                  {currentSetStatus.isGamePointB && (
                    <span className="inline-block px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
                      🔥 GAME POINT
                    </span>
                  )}
                  {currentMatch.winner === currentMatch.teamB && (
                    <span className="inline-block px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                      👑 MATCH WINNER
                    </span>
                  )}
                </div>
              </div>
            </div>

          </div>
        </div>

        {/* Set History Breakdown Table (if multiple sets exist) */}
        {sets.length > 0 && (
          <div className="px-6 pb-6 border-t border-white/5 pt-4">
            <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider mb-2 flex items-center gap-1.5">
              <Layers className="w-3.5 h-3.5 text-amber-400" />
              Game Sets Breakdown
            </h4>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
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
                    {s.scoreA > s.scoreB ? 'Team A' : 'Team B'}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

      </div>
    </div>
  );
};
