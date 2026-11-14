import React, { useState } from 'react';
import {
  Calendar,
  Clock,
  RefreshCw,
  Plus,
  Trash2,
  Share2,
  CheckCircle,
  Play,
  Pause,
  RotateCcw,
  SlidersHorizontal,
  Maximize2,
} from 'lucide-react';
import { useTournament, sportsAudio } from '../../context/TournamentContext';
import { Match } from '../../types/tournament';
import { ConfirmModal } from '../common/ConfirmModal';
import { LiveMatchScoringModal } from '../admin/LiveMatchScoringModal';
import { GenerateScheduleModal } from './GenerateScheduleModal';
import { ScheduleEditorPanel } from './ScheduleEditorPanel';
import { evaluateSetStatus } from '../../utils/badmintonEngine';
import {
  normalizeScheduleSequence,
  parseMatchScheduleTime,
} from '../../utils/scheduleEditorEngine';
import { AuthService } from '../../services/authService';

export const FixturesView: React.FC = () => {
  const {
    state,
    updateMatch,
    clearResults,
    setMatches,
    saveEditedSchedule,
    deleteMatch,
    clearAllMatches,
  } = useTournament();

  const [filterStatus, setFilterStatus] = useState<'all' | 'live' | 'upcoming' | 'completed'>('all');
  const [selectedCourt, setSelectedCourt] = useState<number | 'all'>('all');
  const [isScheduleEditMode, setIsScheduleEditMode] = useState(false);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [showClearAllMatchesConfirm, setShowClearAllMatchesConfirm] = useState(false);
  const [generateModalOpen, setGenerateModalOpen] = useState(false);
  const [deleteConfirmMatchId, setDeleteConfirmMatchId] = useState<string | null>(null);
  const [manualModalOpen, setManualModalOpen] = useState(false);
  const [liveScoringMatchId, setLiveScoringMatchId] = useState(null as string | null);

  const currentUser = AuthService.getCurrentUser();
  const canEditSchedule =
    !currentUser || currentUser.role === 'tournament_director';

  // Manual Match creation state
  const [manualTeamA, setManualTeamA] = useState('');
  const [manualTeamB, setManualTeamB] = useState('');
  const [manualCourt, setManualCourt] = useState(1);
  const [manualRound, setManualRound] = useState(1);
  const [toastMsg, setToastMsg] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  const showToast = (text: string, type: 'success' | 'error' = 'success') => {
    setToastMsg({ text, type });
    setTimeout(() => setToastMsg(null), 3500);
  };

  const courtsCount = Math.max(1, state.settings.courts || 1);
  const courtsList = Array.from({ length: courtsCount }, (_, i) => i + 1);

  const getCourtDisplayName = (courtNum: number) => {
    return state.settings.courtNames?.[courtNum - 1]?.trim() || `Court ${courtNum}`;
  };

  const sequencedMatches = normalizeScheduleSequence(
    state.matches,
    state.settings.courtNames
  );

  const filteredMatches = sequencedMatches.filter((m) => {
    if (filterStatus !== 'all' && m.status !== filterStatus) return false;
    if (selectedCourt !== 'all' && m.court !== selectedCourt) return false;
    return true;
  });

  const getTeam = (teamId: string) => state.teams.find((t) => t.id === teamId);
  const getPlayer = (playerId: string) => state.players.find((p) => p.id === playerId);

  const handleScoreChange = (matchId: string, teamKey: 'A' | 'B', delta: number) => {
    const match = state.matches.find((m) => m.id === matchId);
    if (!match) return;

    sportsAudio.playScorePing();
    const curA = match.scoreA ?? 0;
    const curB = match.scoreB ?? 0;
    const nextA = teamKey === 'A' ? Math.max(0, curA + delta) : curA;
    const nextB = teamKey === 'B' ? Math.max(0, curB + delta) : curB;

    const rules = state.settings.scoringRules || {
      pointTarget: parseInt(state.settings.format || '21', 10) || 21,
      setsToWin: 1,
      deuceEnabled: true,
      maxPointCap: 30,
      changeEndsAtInterval: true,
    };

    const evalResult = evaluateSetStatus(nextA, nextB, rules);
    let status: Match['status'] = match.status === 'upcoming' ? 'live' : match.status;
    let winner: string | undefined = match.winner;

    if (rules.setsToWin === 1 && evalResult.isFinished && evalResult.winner) {
      status = 'completed';
      winner = evalResult.winner === 'A' ? match.teamA : match.teamB;
      sportsAudio.playFanfare();
    }

    updateMatch(matchId, {
      scoreA: nextA,
      scoreB: nextB,
      status,
      winner,
      sets: match.sets && match.sets.length > 0 ? match.sets : [{ scoreA: nextA, scoreB: nextB }],
    });
  };

  const handleMarkComplete = (match: Match) => {
    const curA = match.scoreA ?? 0;
    const curB = match.scoreB ?? 0;
    if (curA === curB) {
      showToast('Match cannot end in a tie. Please record the winning point.', 'error');
      return;
    }
    updateMatch(match.id, {
      status: 'completed',
      winner: curA > curB ? match.teamA : match.teamB,
    });
    showToast('Match marked as completed!', 'success');
  };

  const handleResetMatch = (matchId: string) => {
    updateMatch(matchId, {
      scoreA: undefined,
      scoreB: undefined,
      status: 'upcoming',
      winner: undefined,
      sets: [],
    });
    showToast('Match score reset to 0 - 0.', 'success');
  };

  const handleShareSchedule = () => {
    const lines = [
      `🏸 ${state.settings.name} — Match Centre Schedule`,
      `Date: ${state.settings.date} · Venue: ${state.settings.venue}`,
      '',
    ];

    sequencedMatches.forEach((m, idx) => {
      const tA = getTeam(m.teamA)?.name || 'Team A';
      const tB = getTeam(m.teamB)?.name || 'Team B';
      const scoreStr = m.status === 'completed' ? `(${m.scoreA} - ${m.scoreB})` : `[${m.status.toUpperCase()}]`;
      const parsedTime = parseMatchScheduleTime(m.time);
      const timeTag = [m.date || parsedTime.date, m.startTime || parsedTime.startTime]
        .filter(Boolean)
        .join(' ');
      lines.push(
        `M#${m.matchNumber ?? idx + 1} · R${m.round} · ${m.courtName || `Court ${m.court}`}${
          timeTag ? ` (${timeTag})` : ''
        }: ${tA} vs ${tB} ${scoreStr}`
      );
    });

    const text = lines.join('\n');
    if (navigator.clipboard) {
      navigator.clipboard.writeText(text);
      showToast('Match schedule copied to clipboard!', 'success');
    }
  };

  const handleCreateManualMatch = (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualTeamA || !manualTeamB) {
      showToast('Please select two distinct teams.', 'error');
      return;
    }
    if (manualTeamA === manualTeamB) {
      showToast('Team A and Team B must be different.', 'error');
      return;
    }

    const courtName = getCourtDisplayName(manualCourt);
    const nextSeq = state.matches.length + 1;
    const newMatch: Match = {
      id: crypto.randomUUID(),
      round: manualRound,
      court: manualCourt,
      courtName,
      courtSlot: nextSeq,
      matchNumber: nextSeq,
      teamA: manualTeamA,
      teamB: manualTeamB,
      status: 'upcoming',
      time: `Round ${manualRound} · ${courtName}`,
    };

    setMatches([...state.matches, newMatch]);
    setManualModalOpen(false);
    setManualTeamA('');
    setManualTeamB('');
    showToast('Custom match added to schedule.', 'success');
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {toastMsg && (
        <div
          role="status"
          aria-live="polite"
          className={`p-3.5 rounded-2xl border text-xs font-bold flex items-center justify-between animate-fade-in ${
            toastMsg.type === 'error'
              ? 'bg-rose-500/15 border-rose-500/30 text-rose-300'
              : 'bg-emerald-500/15 border-emerald-500/30 text-emerald-300'
          }`}
        >
          <span>{toastMsg.text}</span>
          <button
            type="button"
            onClick={() => setToastMsg(null)}
            aria-label="Dismiss notification"
            className="ml-3 opacity-70 hover:opacity-100"
          >
            ✕
          </button>
        </div>
      )}

      {/* Top Header & Action Strip */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-500/20 text-amber-400 font-bold text-xl shrink-0">
              🏸
            </span>
            <h1 className="font-display text-2xl sm:text-3xl font-black text-white">
              Match Centre & Live Scores
            </h1>
          </div>
          <p className="mt-1 text-xs sm:text-sm text-slate-400">
            Real-time scoring, live court feeds, and round-robin scheduling for {state.settings.name}.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 sm:gap-2.5">
          <button
            onClick={() => {
              const liveOrFirst = state.matches.find((m) => m.status === 'live') || state.matches[0];
              if (liveOrFirst) setLiveScoringMatchId(liveOrFirst.id);
            }}
            className="flex items-center gap-1.5 px-3.5 py-2 min-h-[38px] text-xs font-bold text-slate-950 bg-gradient-to-r from-emerald-400 to-lime-400 hover:from-emerald-300 rounded-xl shadow-md transition-all active:scale-95"
            title="Open Live Badminton Scoreboard and Umpire Console"
          >
            <SlidersHorizontal className="w-4 h-4 shrink-0" />
            <span>Live Umpire Console</span>
          </button>

          <button
            onClick={() => setGenerateModalOpen(true)}
            className="flex items-center gap-1.5 px-3.5 py-2 min-h-[38px] text-xs font-bold text-slate-950 bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 rounded-xl shadow-md transition-all active:scale-95"
          >
            <RefreshCw className="w-4 h-4 shrink-0" />
            <span>Generate Schedule</span>
          </button>

          {state.matches.length > 0 && canEditSchedule && (
            <button
              type="button"
              onClick={() => setIsScheduleEditMode((prev) => !prev)}
              className={`flex items-center gap-1.5 px-3.5 py-2 min-h-[38px] text-xs font-bold rounded-xl shadow-md transition-all active:scale-95 border ${
                isScheduleEditMode
                  ? 'bg-amber-400 text-slate-950 border-amber-300 ring-2 ring-amber-400/40'
                  : 'bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 border-amber-500/35'
              }`}
              title="Manually edit, reorder, or customize generated tournament fixtures"
            >
              <span aria-hidden="true">✏️</span>
              <span>{isScheduleEditMode ? 'Editing Schedule' : 'Edit Schedule'}</span>
            </button>
          )}

          <button
            onClick={() => setManualModalOpen(true)}
            className="flex items-center gap-1.5 px-3 py-2 min-h-[38px] text-xs font-semibold text-white bg-white/10 hover:bg-white/15 rounded-xl transition-colors border border-white/10"
          >
            <Plus className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>Add Match</span>
          </button>

          <button
            onClick={handleShareSchedule}
            className="p-2 min-w-[38px] min-h-[38px] flex items-center justify-center text-slate-300 hover:text-white bg-white/5 hover:bg-white/10 rounded-xl transition-colors border border-white/5"
            title="Share Schedule"
            aria-label="Share Schedule"
          >
            <Share2 className="w-4 h-4" />
          </button>

          <button
            onClick={() => setShowClearConfirm(true)}
            className="p-2 min-w-[38px] min-h-[38px] flex items-center justify-center text-slate-400 hover:text-amber-400 bg-white/5 hover:bg-amber-500/10 rounded-xl transition-colors border border-white/5"
            title="Reset All Match Scores to 0-0"
            aria-label="Reset All Match Scores to 0-0"
          >
            <RotateCcw className="w-4 h-4" />
          </button>

          <button
            onClick={() => setShowClearAllMatchesConfirm(true)}
            className="p-2 min-w-[38px] min-h-[38px] flex items-center justify-center text-slate-400 hover:text-rose-400 bg-white/5 hover:bg-rose-500/10 rounded-xl transition-colors border border-white/5"
            title="Delete All Matches Permanently"
            aria-label="Delete All Matches Permanently"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Manual Schedule Editor Panel */}
      {isScheduleEditMode && state.matches.length > 0 && canEditSchedule && (
        <ScheduleEditorPanel
          baselineMatches={state.matches}
          teams={state.teams}
          courtsCount={courtsCount}
          courtNames={state.settings.courtNames}
          defaultTournamentDate={state.settings.date}
          knockoutMatches={state.knockout?.matches || []}
          onSaveSchedule={saveEditedSchedule}
          onCancelEditMode={() => setIsScheduleEditMode(false)}
          onNotify={(text, type) => showToast(text, type)}
        />
      )}

      {/* Interactive Filters: Status segmented control + Court filter */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 p-2 rounded-2xl glass-panel">
        {/* Status Tabs */}
        <div className="flex items-center gap-1 p-1 bg-white/5 rounded-xl overflow-x-auto no-scrollbar">
          {(['all', 'live', 'upcoming', 'completed'] as const).map((st) => {
            const count =
              st === 'all'
                ? state.matches.length
                : state.matches.filter((m) => m.status === st).length;
            const labels = {
              all: 'All Matches',
              live: 'Live Now',
              upcoming: 'Upcoming',
              completed: 'Completed',
            };

            return (
              <button
                key={st}
                onClick={() => setFilterStatus(st)}
                className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap shrink-0 flex items-center gap-1.5 ${
                  filterStatus === st
                    ? 'bg-amber-400 text-slate-950 shadow-sm'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <span>{labels[st]}</span>
                <span className="font-mono text-[11px] opacity-80">({count})</span>
              </button>
            );
          })}
        </div>

        {/* Court Filter */}
        <div className="flex items-center gap-2 px-1 sm:px-2 overflow-x-auto no-scrollbar">
          <span className="text-xs font-medium text-slate-400 shrink-0">Court:</span>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setSelectedCourt('all')}
              className={`px-2.5 py-1 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap ${
                selectedCourt === 'all'
                  ? 'bg-white/20 text-white font-bold'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              All
            </button>
            {courtsList.map((c) => (
              <button
                key={c}
                onClick={() => setSelectedCourt(c)}
                className={`px-2.5 py-1 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap ${
                  selectedCourt === c
                    ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                {getCourtDisplayName(c)}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Matches Grid */}
      {filteredMatches.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredMatches.map((match) => {
            const tA = getTeam(match.teamA);
            const tB = getTeam(match.teamB);
            const isLive = match.status === 'live';
            const isCompleted = match.status === 'completed';
            const isAWinner = match.winner === match.teamA;
            const isBWinner = match.winner === match.teamB;
            const parsedSchedule = parseMatchScheduleTime(match.time);
            const displayDate = match.date || parsedSchedule.date;
            const displayStartTime = match.startTime || parsedSchedule.startTime;

            return (
              <div
                key={match.id}
                className={`rounded-2xl glass-card p-3.5 sm:p-5 border transition-all space-y-3.5 sm:space-y-4 ${
                  isLive
                    ? 'border-amber-500/40 royal-glow bg-amber-500/5'
                    : isCompleted
                    ? 'border-white/10'
                    : 'border-white/5'
                }`}
              >
                {/* Match Header info */}
                <div className="flex flex-wrap items-center justify-between gap-2 text-xs pb-3 border-b border-white/10">
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className={`h-2 w-2 rounded-full shrink-0 ${
                        isLive
                          ? 'bg-rose-500 animate-ping'
                          : isCompleted
                          ? 'bg-emerald-400'
                          : 'bg-slate-500'
                      }`}
                    />
                    <span className="px-2 py-0.5 rounded-md bg-amber-500/15 border border-amber-500/30 text-[10px] font-mono font-black text-amber-300">
                      #{String(match.matchNumber ?? match.courtSlot ?? 1).padStart(2, '0')}
                    </span>
                    <span className="font-bold uppercase tracking-wider text-slate-300">
                      Round {match.round} · {match.courtName || getCourtDisplayName(match.court)}
                    </span>
                    {(displayDate || displayStartTime) && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-white/5 border border-white/10 text-[10px] font-semibold text-slate-300">
                        {displayDate && (
                          <span className="inline-flex items-center gap-1">
                            <Calendar className="w-2.5 h-2.5 text-amber-400" />
                            {displayDate}
                          </span>
                        )}
                        {displayStartTime && (
                          <span className="inline-flex items-center gap-1">
                            <Clock className="w-2.5 h-2.5 text-emerald-400" />
                            {displayStartTime}
                          </span>
                        )}
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-1.5 sm:gap-2">
                    <button
                      onClick={() => setLiveScoringMatchId(match.id)}
                      className="flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-bold text-amber-300 bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/30 transition-all active:scale-95"
                      title="Open full badminton umpire scoring console"
                    >
                      <Maximize2 className="w-3 h-3 shrink-0" />
                      <span>Umpire</span>
                    </button>
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                        isLive
                          ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                          : match.status === 'paused'
                          ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                          : isCompleted
                          ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                          : 'bg-white/5 text-slate-400'
                      }`}
                    >
                      {match.status}
                    </span>
                    <button
                      onClick={() => handleResetMatch(match.id)}
                      title="Reset score"
                      aria-label="Reset match score"
                      className="text-slate-500 hover:text-amber-300 p-1 rounded transition-colors"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => setDeleteConfirmMatchId(match.id)}
                      title="Delete this match permanently from Supabase"
                      aria-label="Delete this match permanently"
                      className="text-slate-500 hover:text-rose-400 p-1 rounded transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Scoreboard Layout */}
                <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2 sm:gap-3">
                  {/* Team A */}
                  <div className={`space-y-1 min-w-0 ${isAWinner ? 'text-amber-400' : 'text-white'}`}>
                    <div className="flex items-center gap-1.5 sm:gap-2 min-w-0">
                      <span className="text-lg sm:text-xl shrink-0">{tA?.badge || '🏸'}</span>
                      <span className="font-bold text-xs sm:text-base truncate block">
                        {tA?.name || 'Team A'}
                      </span>
                    </div>
                    {tA?.captainId && (
                      <p className="text-[10px] sm:text-[11px] text-slate-400 truncate">
                        C: {getPlayer(tA.captainId)?.name || 'Captain'}
                      </p>
                    )}
                  </div>

                  {/* Score Display */}
                  <div className="text-center px-1 sm:px-2 shrink-0">
                    <div className="flex items-center justify-center gap-1.5 sm:gap-2 bg-black/50 px-3 sm:px-4 py-1.5 sm:py-2 rounded-xl border border-white/10 shadow-inner">
                      <span
                        className={`font-mono text-xl sm:text-3xl font-black tabular-nums ${
                          isAWinner ? 'text-amber-400' : 'text-white'
                        }`}
                      >
                        {match.scoreA ?? 0}
                      </span>
                      <span className="text-slate-500 font-bold text-xs sm:text-sm">-</span>
                      <span
                        className={`font-mono text-xl sm:text-3xl font-black tabular-nums ${
                          isBWinner ? 'text-amber-400' : 'text-white'
                        }`}
                      >
                        {match.scoreB ?? 0}
                      </span>
                    </div>
                    <span className="block text-[9px] sm:text-[10px] text-slate-400 uppercase tracking-widest mt-1">
                      Target: {state.settings.format}
                    </span>
                  </div>

                  {/* Team B */}
                  <div className={`space-y-1 min-w-0 text-right ${isBWinner ? 'text-amber-400' : 'text-white'}`}>
                    <div className="flex items-center justify-end gap-1.5 sm:gap-2 min-w-0">
                      <span className="font-bold text-xs sm:text-base truncate block">
                        {tB?.name || 'Team B'}
                      </span>
                      <span className="text-lg sm:text-xl shrink-0">{tB?.badge || '🏸'}</span>
                    </div>
                    {tB?.captainId && (
                      <p className="text-[10px] sm:text-[11px] text-slate-400 truncate">
                        C: {getPlayer(tB.captainId)?.name || 'Captain'}
                      </p>
                    )}
                  </div>
                </div>

                {/* Live Scoring Clicker Controls */}
                <div className="pt-2.5 border-t border-white/5 flex flex-wrap items-center justify-between gap-2">
                  {/* Team A controls */}
                  <div className="flex items-center gap-1.5">
                    <span className="text-[11px] sm:text-xs text-slate-400 font-medium mr-0.5 truncate max-w-[56px]">
                      {tA?.name?.split(' ')[0]}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleScoreChange(match.id, 'A', -1)}
                      aria-label={`Decrease score for ${tA?.name || 'Team A'}`}
                      className="w-8 h-8 flex items-center justify-center rounded-lg bg-white/5 hover:bg-white/10 text-slate-300 font-bold text-sm"
                    >
                      -
                    </button>
                    <button
                      type="button"
                      onClick={() => handleScoreChange(match.id, 'A', 1)}
                      aria-label={`Add point for ${tA?.name || 'Team A'}`}
                      className="px-2.5 h-8 flex items-center justify-center rounded-lg bg-amber-400 text-slate-950 font-bold text-xs hover:bg-amber-300 active:scale-95 transition-all shadow"
                    >
                      +1 Pt
                    </button>
                  </div>

                  {/* Status / Complete action */}
                  <div className="flex items-center gap-1.5">
                    {match.status === 'upcoming' && (
                      <button
                        type="button"
                        onClick={() => updateMatch(match.id, { status: 'live' })}
                        className="px-2.5 py-1.5 text-[11px] font-bold text-slate-950 bg-emerald-400 hover:bg-emerald-300 rounded-lg flex items-center gap-1 transition-all shadow-sm active:scale-95"
                        title="Start match"
                      >
                        <Play className="w-3 h-3 fill-current" />
                        <span>Start</span>
                      </button>
                    )}
                    {match.status === 'live' && (
                      <button
                        type="button"
                        onClick={() => updateMatch(match.id, { status: 'paused' })}
                        className="px-2.5 py-1.5 text-[11px] font-bold text-amber-300 bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/30 rounded-lg flex items-center gap-1 transition-all active:scale-95"
                        title="Pause match"
                      >
                        <Pause className="w-3 h-3" />
                        <span>Pause</span>
                      </button>
                    )}
                    {match.status === 'paused' && (
                      <button
                        type="button"
                        onClick={() => updateMatch(match.id, { status: 'live' })}
                        className="px-2.5 py-1.5 text-[11px] font-bold text-emerald-300 bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-500/30 rounded-lg flex items-center gap-1 transition-all active:scale-95"
                        title="Resume match"
                      >
                        <Play className="w-3 h-3 fill-current" />
                        <span>Resume</span>
                      </button>
                    )}

                    {!isCompleted ? (
                      <button
                        onClick={() => handleMarkComplete(match)}
                        className="px-2.5 py-1.5 text-xs font-semibold text-emerald-400 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/20 rounded-lg transition-colors"
                      >
                        Finish
                      </button>
                    ) : (
                      <span className="text-xs font-bold text-emerald-400 flex items-center gap-1 truncate max-w-[140px]">
                        <CheckCircle className="w-3.5 h-3.5 shrink-0" />
                        <span className="truncate">{isAWinner ? tA?.name : tB?.name}</span>
                      </span>
                    )}
                  </div>

                  {/* Team B controls */}
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => handleScoreChange(match.id, 'B', 1)}
                      aria-label={`Add point for ${tB?.name || 'Team B'}`}
                      className="px-2.5 h-8 flex items-center justify-center rounded-lg bg-blue-500 text-white font-bold text-xs hover:bg-blue-400 active:scale-95 transition-all shadow"
                    >
                      +1 Pt
                    </button>
                    <button
                      type="button"
                      onClick={() => handleScoreChange(match.id, 'B', -1)}
                      aria-label={`Decrease score for ${tB?.name || 'Team B'}`}
                      className="w-8 h-8 flex items-center justify-center rounded-lg bg-white/5 hover:bg-white/10 text-slate-300 font-bold text-sm"
                    >
                      -
                    </button>
                    <span className="text-[11px] sm:text-xs text-slate-400 font-medium ml-0.5 truncate max-w-[56px]">
                      {tB?.name?.split(' ')[0]}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="rounded-2xl glass-card p-12 text-center border border-dashed border-white/10 space-y-4">
          <div className="flex justify-center">
            <span className="text-5xl">🏸</span>
          </div>
          <h3 className="text-lg font-bold text-white">No Matches Found</h3>
          <p className="text-xs text-slate-400 max-w-sm mx-auto">
            {state.teams.length < 2
              ? 'Please make sure at least 2 teams exist before generating a round-robin schedule.'
              : 'Generate an automatic round-robin tournament schedule or create a custom match above.'}
          </p>
          {state.teams.length >= 2 && (
            <button
              onClick={() => setGenerateModalOpen(true)}
              className="px-4 py-2 text-xs font-bold bg-amber-400 text-slate-950 rounded-xl hover:bg-amber-300 shadow transition-all"
            >
              Generate Round-Robin Schedule
            </button>
          )}
        </div>
      )}

      {/* Manual Match Creation Modal */}
      {manualModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-md rounded-2xl glass-panel p-6 shadow-2xl border border-white/10 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-white/10">
              <h3 className="font-bold text-white text-lg">Add Custom Match</h3>
              <button
                onClick={() => setManualModalOpen(false)}
                className="text-slate-400 hover:text-white"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateManualMatch} className="space-y-4 text-sm">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Team 1
                </label>
                <select
                  value={manualTeamA}
                  onChange={(e) => setManualTeamA(e.target.value)}
                  className="w-full bg-slate-900 border border-white/10 rounded-xl px-3 py-2 text-white"
                  required
                >
                  <option value="">Select Team 1</option>
                  {state.teams.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Team 2
                </label>
                <select
                  value={manualTeamB}
                  onChange={(e) => setManualTeamB(e.target.value)}
                  className="w-full bg-slate-900 border border-white/10 rounded-xl px-3 py-2 text-white"
                  required
                >
                  <option value="">Select Team 2</option>
                  {state.teams
                    .filter((t) => t.id !== manualTeamA)
                    .map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name}
                      </option>
                    ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Badminton Court
                  </label>
                  <select
                    value={manualCourt}
                    onChange={(e) => setManualCourt(parseInt(e.target.value, 10) || 1)}
                    className="w-full bg-slate-900 border border-white/10 rounded-xl px-3 py-2 text-white text-xs font-medium"
                  >
                    {courtsList.map((c) => (
                      <option key={c} value={c}>
                        {getCourtDisplayName(c)}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Round
                  </label>
                  <input
                    type="number"
                    min={1}
                    value={manualRound}
                    onChange={(e) => setManualRound(parseInt(e.target.value, 10) || 1)}
                    className="w-full bg-slate-900 border border-white/10 rounded-xl px-3 py-2 text-white"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setManualModalOpen(false)}
                  className="px-4 py-2 text-xs font-medium text-slate-400 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-xs font-bold bg-amber-400 text-slate-950 rounded-xl hover:bg-amber-300"
                >
                  Create Match
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Multi-Court Generate Schedule Modal with Real-Time Preview & Replacement */}
      <GenerateScheduleModal
        isOpen={generateModalOpen}
        onClose={() => setGenerateModalOpen(false)}
        onSuccess={(count) => {
          showToast(`Tournament schedule regenerated with ${count} matches.`, 'success');
        }}
      />

      {/* Confirm Delete Single Match Permanently */}
      <ConfirmModal
        isOpen={Boolean(deleteConfirmMatchId)}
        title="Delete Match Permanently"
        message="Are you sure you want to permanently delete this match? It will be removed from Supabase and the live schedule."
        confirmLabel="Delete Match"
        variant="danger"
        onConfirm={async () => {
          if (deleteConfirmMatchId) {
            const success = await deleteMatch(deleteConfirmMatchId);
            setDeleteConfirmMatchId(null);
            if (success) {
              showToast('Match permanently deleted.', 'success');
            } else {
              showToast('Failed to delete match.', 'error');
            }
          }
        }}
        onCancel={() => setDeleteConfirmMatchId(null)}
      />

      {/* Confirm Reset Scores Only (Scores to 0-0) */}
      <ConfirmModal
        isOpen={showClearConfirm}
        title="Reset All Match Scores"
        message="Are you sure you want to clear all scores and winners? Scheduled fixtures will remain intact, but all scores will return to 0 - 0."
        confirmLabel="Reset Scores"
        variant="warning"
        onConfirm={() => {
          clearResults();
          setShowClearConfirm(false);
          showToast('All match scores reset to 0 - 0.', 'success');
        }}
        onCancel={() => setShowClearConfirm(false)}
      />

      {/* Confirm Delete All Matches Permanently */}
      <ConfirmModal
        isOpen={showClearAllMatchesConfirm}
        title="Delete All Matches from Database"
        message="Are you sure you want to permanently delete all match fixtures and scores for this tournament? This will completely clear the schedule."
        confirmLabel="Delete All Matches"
        variant="danger"
        onConfirm={() => {
          clearAllMatches();
          setShowClearAllMatchesConfirm(false);
          showToast('All tournament matches deleted.', 'success');
        }}
        onCancel={() => setShowClearAllMatchesConfirm(false)}
      />

      {/* Live Badminton Scoring Modal (Umpire Console) */}
      <LiveMatchScoringModal
        isOpen={Boolean(liveScoringMatchId)}
        onClose={() => setLiveScoringMatchId(null)}
        initialMatchId={liveScoringMatchId || undefined}
        isKnockout={false}
      />
    </div>
  );
};
