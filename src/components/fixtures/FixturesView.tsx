import React, { useState } from 'react';
import {
  Calendar,
  Clock,
  Swords,
  RefreshCw,
  Plus,
  Trash2,
  Share2,
  CheckCircle,
  Play,
  RotateCcw,
  Edit2,
  SlidersHorizontal,
} from 'lucide-react';
import { useTournament, sportsAudio } from '../../context/TournamentContext';
import { Match } from '../../types/tournament';
import { ConfirmModal } from '../common/ConfirmModal';

export const FixturesView: React.FC = () => {
  const { state, updateMatch, generateFixtures, clearResults, setMatches } = useTournament();

  const [filterStatus, setFilterStatus] = useState<'all' | 'live' | 'upcoming' | 'completed'>('all');
  const [selectedCourt, setSelectedCourt] = useState<number | 'all'>('all');
  const [editingMatch, setEditingMatch] = useState<Match | null>(null);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [showGenerateConfirm, setShowGenerateConfirm] = useState(false);
  const [manualModalOpen, setManualModalOpen] = useState(false);

  // Manual Match creation state
  const [manualTeamA, setManualTeamA] = useState('');
  const [manualTeamB, setManualTeamB] = useState('');
  const [manualCourt, setManualCourt] = useState(1);
  const [manualRound, setManualRound] = useState(1);

  const courtsList = Array.from({ length: state.settings.courts || 2 }, (_, i) => i + 1);

  const filteredMatches = state.matches.filter((m) => {
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

    const targetFormat = parseInt(state.settings.format || '21', 10);
    let status: Match['status'] = 'live';
    let winner: string | undefined = undefined;

    // Standard badminton winning rule: >= targetFormat and ahead by >= 2 or reached cap (e.g. 30)
    const isOverTarget = nextA >= targetFormat || nextB >= targetFormat;
    const diff = Math.abs(nextA - nextB);
    if (isOverTarget && (diff >= 2 || Math.max(nextA, nextB) >= 30)) {
      status = 'completed';
      winner = nextA > nextB ? match.teamA : match.teamB;
    }

    updateMatch(matchId, {
      scoreA: nextA,
      scoreB: nextB,
      status,
      winner,
      sets: [{ scoreA: nextA, scoreB: nextB }],
    });
  };

  const handleMarkComplete = (match: Match) => {
    const curA = match.scoreA ?? 0;
    const curB = match.scoreB ?? 0;
    if (curA === curB) {
      alert("Match cannot end in a tie. Please record the winning point.");
      return;
    }
    updateMatch(match.id, {
      status: 'completed',
      winner: curA > curB ? match.teamA : match.teamB,
    });
  };

  const handleResetMatch = (matchId: string) => {
    updateMatch(matchId, {
      scoreA: undefined,
      scoreB: undefined,
      status: 'upcoming',
      winner: undefined,
      sets: [],
    });
  };

  const handleShareSchedule = () => {
    const lines = [
      `🏸 ${state.settings.name} — Match Centre Schedule`,
      `Date: ${state.settings.date} · Venue: ${state.settings.venue}`,
      '',
    ];

    state.matches.forEach((m) => {
      const tA = getTeam(m.teamA)?.name || 'Team A';
      const tB = getTeam(m.teamB)?.name || 'Team B';
      const scoreStr = m.status === 'completed' ? `(${m.scoreA} - ${m.scoreB})` : `[${m.status.toUpperCase()}]`;
      lines.push(`R${m.round} · Court ${m.court}: ${tA} vs ${tB} ${scoreStr}`);
    });

    const text = lines.join('\n');
    if (navigator.clipboard) {
      navigator.clipboard.writeText(text);
      alert('Match schedule copied to clipboard!');
    }
  };

  const handleCreateManualMatch = (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualTeamA || !manualTeamB) {
      alert('Please select two distinct teams.');
      return;
    }
    if (manualTeamA === manualTeamB) {
      alert('Team A and Team B must be different.');
      return;
    }

    const newMatch: Match = {
      id: crypto.randomUUID(),
      round: manualRound,
      court: manualCourt,
      teamA: manualTeamA,
      teamB: manualTeamB,
      status: 'upcoming',
      time: `Round ${manualRound} · Court ${manualCourt}`,
    };

    setMatches([...state.matches, newMatch]);
    setManualModalOpen(false);
    setManualTeamA('');
    setManualTeamB('');
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Top Header & Action Strip */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-500/20 text-amber-400 font-bold text-xl">
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

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            onClick={() => setShowGenerateConfirm(true)}
            className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-slate-950 bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 rounded-xl shadow-md transition-all active:scale-95"
          >
            <RefreshCw className="w-4 h-4" />
            <span>Generate Schedule</span>
          </button>

          <button
            onClick={() => setManualModalOpen(true)}
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-white bg-white/10 hover:bg-white/15 rounded-xl transition-colors border border-white/10"
          >
            <Plus className="w-4 h-4 text-emerald-400" />
            <span>Add Match</span>
          </button>

          <button
            onClick={handleShareSchedule}
            className="p-2 text-slate-300 hover:text-white bg-white/5 hover:bg-white/10 rounded-xl transition-colors border border-white/5"
            title="Share Schedule"
            aria-label="Share Schedule"
          >
            <Share2 className="w-4 h-4" />
          </button>

          <button
            onClick={() => setShowClearConfirm(true)}
            className="p-2 text-slate-400 hover:text-rose-400 bg-white/5 hover:bg-rose-500/10 rounded-xl transition-colors border border-white/5"
            title="Clear All Match Scores"
            aria-label="Clear All Match Scores"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Interactive Filters: Status segmented control + Court filter */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 p-2 rounded-2xl glass-panel">
        {/* Status Tabs */}
        <div className="flex items-center gap-1 p-1 bg-white/5 rounded-xl overflow-x-auto">
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
        <div className="flex items-center gap-2 px-2">
          <span className="text-xs font-medium text-slate-400 shrink-0">Court:</span>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setSelectedCourt('all')}
              className={`px-2.5 py-1 text-xs font-semibold rounded-lg transition-colors ${
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
                className={`px-2.5 py-1 text-xs font-semibold rounded-lg transition-colors ${
                  selectedCourt === c
                    ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Court {c}
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

            return (
              <div
                key={match.id}
                className={`rounded-2xl glass-card p-5 border transition-all space-y-4 ${
                  isLive
                    ? 'border-amber-500/40 royal-glow bg-amber-500/5'
                    : isCompleted
                    ? 'border-white/10'
                    : 'border-white/5'
                }`}
              >
                {/* Match Header info */}
                <div className="flex items-center justify-between text-xs pb-3 border-b border-white/10">
                  <div className="flex items-center gap-2">
                    <span
                      className={`h-2 w-2 rounded-full ${
                        isLive
                          ? 'bg-rose-500 animate-ping'
                          : isCompleted
                          ? 'bg-emerald-400'
                          : 'bg-slate-500'
                      }`}
                    />
                    <span className="font-bold uppercase tracking-wider text-slate-300">
                      Round {match.round} · Court {match.court}
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                        isLive
                          ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
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
                      className="text-slate-500 hover:text-slate-300 p-0.5 rounded transition-colors"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Scoreboard Layout */}
                <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3">
                  {/* Team A */}
                  <div className={`space-y-1.5 ${isAWinner ? 'text-amber-400' : 'text-white'}`}>
                    <div className="flex items-center gap-2">
                      <span className="text-xl">{tA?.badge || '🏸'}</span>
                      <span className="font-bold text-sm sm:text-base truncate block max-w-[130px] sm:max-w-[160px]">
                        {tA?.name || 'Team A'}
                      </span>
                    </div>
                    {tA?.captainId && (
                      <p className="text-[11px] text-slate-400 truncate">
                        C: {getPlayer(tA.captainId)?.name || 'Captain'}
                      </p>
                    )}
                  </div>

                  {/* Score Display */}
                  <div className="text-center px-3">
                    <div className="flex items-center justify-center gap-2 bg-black/50 px-4 py-2 rounded-xl border border-white/10 shadow-inner">
                      <span
                        className={`font-mono text-2xl sm:text-3xl font-black tabular-nums ${
                          isAWinner ? 'text-amber-400' : 'text-white'
                        }`}
                      >
                        {match.scoreA ?? 0}
                      </span>
                      <span className="text-slate-500 font-bold text-sm">-</span>
                      <span
                        className={`font-mono text-2xl sm:text-3xl font-black tabular-nums ${
                          isBWinner ? 'text-amber-400' : 'text-white'
                        }`}
                      >
                        {match.scoreB ?? 0}
                      </span>
                    </div>
                    <span className="block text-[10px] text-slate-400 uppercase tracking-widest mt-1">
                      Target: {state.settings.format}
                    </span>
                  </div>

                  {/* Team B */}
                  <div className={`space-y-1.5 text-right ${isBWinner ? 'text-amber-400' : 'text-white'}`}>
                    <div className="flex items-center justify-end gap-2">
                      <span className="font-bold text-sm sm:text-base truncate block max-w-[130px] sm:max-w-[160px]">
                        {tB?.name || 'Team B'}
                      </span>
                      <span className="text-xl">{tB?.badge || '🏸'}</span>
                    </div>
                    {tB?.captainId && (
                      <p className="text-[11px] text-slate-400 truncate">
                        C: {getPlayer(tB.captainId)?.name || 'Captain'}
                      </p>
                    )}
                  </div>
                </div>

                {/* Live Scoring Clicker Controls */}
                <div className="pt-2 border-t border-white/5 flex flex-wrap items-center justify-between gap-2">
                  {/* Team A controls */}
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs text-slate-400 font-medium mr-1 truncate max-w-[60px]">
                      {tA?.name?.split(' ')[0]}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleScoreChange(match.id, 'A', -1)}
                      className="w-7 h-7 flex items-center justify-center rounded-lg bg-white/5 hover:bg-white/10 text-slate-300 font-bold text-sm"
                    >
                      -
                    </button>
                    <button
                      type="button"
                      onClick={() => handleScoreChange(match.id, 'A', 1)}
                      className="px-2.5 h-7 flex items-center justify-center rounded-lg bg-amber-400 text-slate-950 font-bold text-xs hover:bg-amber-300 active:scale-95 transition-all shadow"
                    >
                      +1 Pt
                    </button>
                  </div>

                  {/* Status / Complete action */}
                  <div>
                    {!isCompleted ? (
                      <button
                        onClick={() => handleMarkComplete(match)}
                        className="px-2.5 py-1 text-xs font-semibold text-emerald-400 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/20 rounded-lg transition-colors"
                      >
                        Finish Match
                      </button>
                    ) : (
                      <span className="text-xs font-bold text-emerald-400 flex items-center gap-1">
                        <CheckCircle className="w-3.5 h-3.5" />
                        <span>Winner: {isAWinner ? tA?.name : tB?.name}</span>
                      </span>
                    )}
                  </div>

                  {/* Team B controls */}
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => handleScoreChange(match.id, 'B', 1)}
                      className="px-2.5 h-7 flex items-center justify-center rounded-lg bg-blue-500 text-white font-bold text-xs hover:bg-blue-400 active:scale-95 transition-all shadow"
                    >
                      +1 Pt
                    </button>
                    <button
                      type="button"
                      onClick={() => handleScoreChange(match.id, 'B', -1)}
                      className="w-7 h-7 flex items-center justify-center rounded-lg bg-white/5 hover:bg-white/10 text-slate-300 font-bold text-sm"
                    >
                      -
                    </button>
                    <span className="text-xs text-slate-400 font-medium ml-1 truncate max-w-[60px]">
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
              onClick={() => setShowGenerateConfirm(true)}
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
                    Court Number
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={state.settings.courts || 4}
                    value={manualCourt}
                    onChange={(e) => setManualCourt(parseInt(e.target.value, 10) || 1)}
                    className="w-full bg-slate-900 border border-white/10 rounded-xl px-3 py-2 text-white"
                  />
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

      {/* Confirm Schedule Generation */}
      <ConfirmModal
        isOpen={showGenerateConfirm}
        title="Generate Round-Robin Schedule"
        message={`This will generate round-robin fixtures for all ${state.teams.length} teams across ${state.settings.courts} courts. Any existing league match scores will be reset.`}
        confirmLabel="Generate Schedule"
        variant="warning"
        onConfirm={() => {
          generateFixtures();
          setShowGenerateConfirm(false);
        }}
        onCancel={() => setShowGenerateConfirm(false)}
      />

      {/* Confirm Clear Results */}
      <ConfirmModal
        isOpen={showClearConfirm}
        title="Reset All Match Results"
        message="Are you sure you want to clear all scores and winners? Fixtures will remain scheduled but all scores will return to 0-0."
        confirmLabel="Reset Results"
        variant="danger"
        onConfirm={() => {
          clearResults();
          setShowClearConfirm(false);
        }}
        onCancel={() => setShowClearConfirm(false)}
      />
    </div>
  );
};
