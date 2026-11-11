import React, { useState, useMemo } from 'react';
import {
  Trophy,
  Activity,
  Users,
  LogOut,
  User,
  ShieldCheck,
  Search,
  Filter,
  CheckCircle2,
  Clock,
  Play,
  Pause,
  Award,
  Plus,
  Minus,
  RefreshCw,
  Phone,
  Eye,
  Lock,
  Flame,
  Swords,
  ChevronRight,
  Shield,
  Sparkles,
  ExternalLink,
} from 'lucide-react';
import { useTournament } from '../../context/TournamentContext';
import { AuthService, AdminUser } from '../../services/authService';
import { MyAccountModal } from '../auth/MyAccountModal';
import { Match, KnockoutMatch, Player } from '../../types/tournament';
import { sportsAudio } from '../../context/TournamentContext';

interface ScoreOperatorDashboardProps {
  user: AdminUser;
  onLogout: () => void;
  onViewPublicHome?: () => void;
}

export const ScoreOperatorDashboard: React.FC<ScoreOperatorDashboardProps> = ({
  user,
  onLogout,
  onViewPublicHome,
}) => {
  const { state, updateMatch, updateKnockoutMatch } = useTournament();

  const [activeTab, setActiveTab] = useState<'scoring' | 'players'>('scoring');
  const [matchTypeFilter, setMatchTypeFilter] = useState<'all' | 'live' | 'upcoming' | 'completed' | 'knockout'>('all');
  const [selectedMatchId, setSelectedMatchId] = useState<string | null>(null);
  const [isAccountModalOpen, setIsAccountModalOpen] = useState(false);

  // Player directory state
  const [playerSearch, setPlayerSearch] = useState('');
  const [playerCategoryFilter, setPlayerCategoryFilter] = useState('all');

  // Combined matches list
  const matches = useMemo(() => {
    return state.matches || [];
  }, [state.matches]);

  const knockoutMatches = useMemo(() => {
    return state.knockout?.matches || [];
  }, [state.knockout?.matches]);

  // Filtered matches
  const filteredMatches = useMemo(() => {
    if (matchTypeFilter === 'knockout') {
      return knockoutMatches.map((km) => ({
        ...km,
        isKnockout: true,
        round: km.stage === 'F' ? 99 : km.stage === 'SF' ? 90 : 80,
        court: 1,
      }));
    }

    return matches.filter((m) => {
      if (matchTypeFilter === 'live') return m.status === 'live';
      if (matchTypeFilter === 'upcoming') return m.status === 'upcoming';
      if (matchTypeFilter === 'completed') return m.status === 'completed';
      return true;
    });
  }, [matches, knockoutMatches, matchTypeFilter]);

  // Selected match for live scoring
  const activeMatch = useMemo(() => {
    if (!selectedMatchId) {
      // Auto-select first live match, or first match overall
      const live = matches.find((m) => m.status === 'live');
      if (live) return live;
      return matches[0] || null;
    }
    const foundGroup = matches.find((m) => m.id === selectedMatchId);
    if (foundGroup) return foundGroup;
    const foundKo = knockoutMatches.find((m) => m.id === selectedMatchId);
    if (foundKo) {
      return {
        ...foundKo,
        isKnockout: true,
        round: foundKo.stage === 'F' ? 99 : foundKo.stage === 'SF' ? 90 : 80,
        court: 1,
      } as any;
    }
    return matches[0] || null;
  }, [matches, knockoutMatches, selectedMatchId]);

  // Helpers to get team info
  const getTeamName = (teamId?: string) => {
    if (!teamId) return 'TBD';
    const team = state.teams.find((t) => t.id === teamId);
    return team?.name || teamId;
  };

  const getTeamPlayers = (teamId?: string): Player[] => {
    if (!teamId) return [];
    const team = state.teams.find((t) => t.id === teamId);
    if (!team || !Array.isArray(team.players)) return [];
    return state.players.filter((p) => team.players.includes(p.id));
  };

  // Score adjustments
  const handleScoreChange = (team: 'A' | 'B', delta: number) => {
    if (!activeMatch) return;
    const isKo = (activeMatch as any).isKnockout;
    const currentScore = team === 'A' ? (activeMatch.scoreA ?? 0) : (activeMatch.scoreB ?? 0);
    const newScore = Math.max(0, currentScore + delta);

    if (delta > 0) {
      sportsAudio.playScorePing();
    } else {
      sportsAudio.playButtonClick();
    }

    if (isKo) {
      updateKnockoutMatch(activeMatch.id, {
        [team === 'A' ? 'scoreA' : 'scoreB']: newScore,
        status: 'live',
      });
    } else {
      updateMatch(activeMatch.id, {
        [team === 'A' ? 'scoreA' : 'scoreB']: newScore,
        status: 'live',
      });
    }
  };

  // Set status
  const handleSetStatus = (status: Match['status']) => {
    if (!activeMatch) return;
    const isKo = (activeMatch as any).isKnockout;

    if (status === 'completed') {
      sportsAudio.playFanfare();
    } else {
      sportsAudio.playButtonClick();
    }

    if (isKo) {
      updateKnockoutMatch(activeMatch.id, { status: status as any });
    } else {
      updateMatch(activeMatch.id, { status });
    }
  };

  // Reset current match score
  const handleResetScores = () => {
    if (!activeMatch) return;
    const isKo = (activeMatch as any).isKnockout;
    if (confirm('Reset scores for this match to 0-0?')) {
      sportsAudio.playButtonClick();
      if (isKo) {
        updateKnockoutMatch(activeMatch.id, { scoreA: 0, scoreB: 0, status: 'live' });
      } else {
        updateMatch(activeMatch.id, { scoreA: 0, scoreB: 0, status: 'live' });
      }
    }
  };

  // Filtered players for read-only directory
  const filteredPlayers = useMemo(() => {
    return state.players.filter((p) => {
      if (playerCategoryFilter !== 'all' && p.category?.toLowerCase() !== playerCategoryFilter.toLowerCase()) {
        return false;
      }
      if (playerSearch.trim()) {
        const q = playerSearch.toLowerCase().trim();
        const team = state.teams.find((t) => t.players.includes(p.id));
        const teamName = team ? team.name.toLowerCase() : '';
        return (
          p.name.toLowerCase().includes(q) ||
          teamName.includes(q) ||
          (p.city && p.city.toLowerCase().includes(q))
        );
      }
      return true;
    });
  }, [state.players, state.teams, playerSearch, playerCategoryFilter]);

  // Mask mobile number for privacy: e.g. 9812345678 -> 98••••5678
  const maskPhone = (phone?: string) => {
    if (!phone) return '—';
    const clean = phone.replace(/\D/g, '');
    if (clean.length < 8) return '••••' + clean.slice(-4);
    return clean.slice(0, 2) + '••••' + clean.slice(-4);
  };

  return (
    <div className="min-h-screen bg-[#04060d] text-slate-100 flex flex-col font-sans selection:bg-cyan-400 selection:text-slate-950">
      {/* TOP HEADER */}
      <header className="sticky top-0 z-40 bg-slate-950/90 border-b border-white/10 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3.5 flex items-center justify-between">
          {/* Logo & Court Branding */}
          <div className="flex items-center gap-3">
            <img
              src="/assets/aistudio/7fdef8a3-3175-4f56-903d-bb6551369ac1_16fe4ad8.png"
              alt="SPL Logo"
              className="h-10 sm:h-11 w-auto object-contain drop-shadow"
            />
            <div>
              <div className="flex items-center gap-2">
                <span className="font-display text-base sm:text-lg font-black tracking-tight text-white uppercase">
                  Smash Premier League
                </span>
                <span className="px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider bg-cyan-400 text-slate-950 font-mono flex items-center gap-1">
                  <Activity className="w-3 h-3" />
                  <span>SCORE OPERATOR</span>
                </span>
              </div>
              <p className="text-[11px] text-slate-400">Court Scoring Console • Season IV Championship</p>
            </div>
          </div>

          {/* User info & Actions */}
          <div className="flex items-center gap-2 sm:gap-3">
            {onViewPublicHome && (
              <button
                type="button"
                onClick={onViewPublicHome}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-lime-400/10 hover:bg-lime-400/20 text-lime-400 border border-lime-400/30 text-xs font-semibold transition-colors"
                title="View Public Tournament Home"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Public Site</span>
              </button>
            )}

            {/* Operator Account Button */}
            <button
              type="button"
              onClick={() => setIsAccountModalOpen(true)}
              className="flex items-center gap-2 px-3 py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-semibold text-slate-200 transition-colors"
              title="My Account & Security"
            >
              <div className="w-6 h-6 rounded-lg bg-cyan-400/20 text-cyan-400 font-bold flex items-center justify-center text-xs">
                {user.name.charAt(0).toUpperCase()}
              </div>
              <span className="hidden sm:inline">{user.name}</span>
            </button>

            {/* Logout Button */}
            <button
              type="button"
              onClick={onLogout}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/20 text-xs font-semibold transition-colors"
              title="Sign Out"
            >
              <LogOut className="w-4 h-4" />
              <span className="hidden sm:inline">Sign Out</span>
            </button>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 border-t border-white/5 flex gap-2">
          <button
            type="button"
            onClick={() => setActiveTab('scoring')}
            className={`flex items-center gap-2 py-3 px-4 text-xs font-bold border-b-2 transition-all ${
              activeTab === 'scoring'
                ? 'border-cyan-400 text-cyan-400 bg-cyan-400/5'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Activity className="w-4 h-4" />
            <span>Live Match Scoring</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('players')}
            className={`flex items-center gap-2 py-3 px-4 text-xs font-bold border-b-2 transition-all ${
              activeTab === 'players'
                ? 'border-cyan-400 text-cyan-400 bg-cyan-400/5'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Users className="w-4 h-4" />
            <span>Player Directory (Read-Only)</span>
          </button>
        </div>
      </header>

      {/* MAIN CONTENT AREA */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 space-y-6">
        {activeTab === 'scoring' ? (
          /* TAB 1: LIVE MATCH SCORING CONSOLE */
          <div className="space-y-6">
            {/* Real-time synchronization notice */}
            <div className="p-3 rounded-2xl bg-cyan-500/10 border border-cyan-500/20 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 text-xs text-cyan-300">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-cyan-400 animate-ping shrink-0" />
                <span className="font-semibold">Court Scoring Console Active:</span>
                <span className="text-slate-300">
                  All score changes save directly to Supabase and broadcast to the public stadium display.
                </span>
              </div>
              <div className="flex items-center gap-1.5 text-[11px] font-mono text-cyan-400 bg-cyan-500/20 px-2.5 py-1 rounded-lg">
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Supabase Realtime Live</span>
              </div>
            </div>

            {/* Match Filter & Match Selector Pills */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Select Active Match:</p>
                <div className="flex items-center gap-1.5">
                  {(['all', 'live', 'upcoming', 'completed', 'knockout'] as const).map((filterKey) => (
                    <button
                      key={filterKey}
                      type="button"
                      onClick={() => setMatchTypeFilter(filterKey)}
                      className={`px-2.5 py-1 rounded-lg text-[11px] font-bold uppercase tracking-wider transition-colors ${
                        matchTypeFilter === filterKey
                          ? 'bg-cyan-400 text-slate-950'
                          : 'bg-white/5 hover:bg-white/10 text-slate-400'
                      }`}
                    >
                      {filterKey}
                    </button>
                  ))}
                </div>
              </div>

              {/* Match Pills Scrollable List */}
              <div className="flex gap-2.5 overflow-x-auto pb-2 scrollbar-thin">
                {filteredMatches.length === 0 ? (
                  <p className="text-xs text-slate-500 italic py-2">No matches found for this filter.</p>
                ) : (
                  filteredMatches.map((m) => {
                    const isSelected = activeMatch?.id === m.id;
                    const teamAName = getTeamName(m.teamA);
                    const teamBName = getTeamName(m.teamB);

                    return (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() => setSelectedMatchId(m.id)}
                        className={`p-3 rounded-2xl border text-left shrink-0 transition-all min-w-[220px] ${
                          isSelected
                            ? 'bg-cyan-950/60 border-cyan-400 shadow-lg shadow-cyan-500/10 scale-[1.02]'
                            : 'bg-slate-900/60 border-white/5 hover:border-white/20'
                        }`}
                      >
                        <div className="flex items-center justify-between text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-1.5">
                          <span>Court {m.court || 1} • Round {m.round}</span>
                          <span
                            className={`px-1.5 py-0.5 rounded text-[9px] font-black uppercase ${
                              m.status === 'live'
                                ? 'bg-rose-500 text-white animate-pulse'
                                : m.status === 'completed'
                                ? 'bg-emerald-500/20 text-emerald-400'
                                : 'bg-slate-800 text-slate-400'
                            }`}
                          >
                            {m.status}
                          </span>
                        </div>
                        <div className="text-xs font-bold text-white flex items-center justify-between">
                          <span className="truncate max-w-[90px]">{teamAName}</span>
                          <span className="font-mono text-cyan-300 px-1 bg-black/40 rounded">
                            {m.scoreA ?? 0} - {m.scoreB ?? 0}
                          </span>
                          <span className="truncate max-w-[90px] text-right">{teamBName}</span>
                        </div>
                      </button>
                    );
                  })
                )}
              </div>
            </div>

            {/* MAIN TOUCH-FRIENDLY SCOREBOARD CONSOLE */}
            {activeMatch ? (
              <div className="rounded-3xl bg-slate-900/80 border border-white/10 p-6 sm:p-8 space-y-6 shadow-2xl backdrop-blur-xl">
                {/* Court Info & Status Switcher */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-white/10">
                  <div className="flex items-center gap-3">
                    <div className="p-3 rounded-2xl bg-gradient-to-br from-cyan-400/20 to-blue-500/20 border border-cyan-400/30 text-cyan-400">
                      <Trophy className="w-6 h-6" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold uppercase tracking-wider text-cyan-400 font-mono">
                          Court {activeMatch.court || 1}
                        </span>
                        <span className="text-slate-600">•</span>
                        <span className="text-xs font-semibold text-slate-400">
                          {(activeMatch as any).isKnockout
                            ? `Knockout ${(activeMatch as any).stage}`
                            : `Round ${activeMatch.round}`}
                        </span>
                      </div>
                      <h2 className="text-xl sm:text-2xl font-black font-display text-white tracking-tight uppercase">
                        {getTeamName(activeMatch.teamA)} vs {getTeamName(activeMatch.teamB)}
                      </h2>
                    </div>
                  </div>

                  {/* Status Toggle Buttons */}
                  <div className="flex items-center gap-2">
                    {activeMatch.status !== 'live' && (
                      <button
                        type="button"
                        onClick={() => handleSetStatus('live')}
                        className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-rose-500 hover:bg-rose-600 text-white font-bold text-xs shadow-lg shadow-rose-500/20 transition-all"
                      >
                        <Play className="w-3.5 h-3.5 fill-current" />
                        <span>Go Live</span>
                      </button>
                    )}

                    {activeMatch.status === 'live' && (
                      <button
                        type="button"
                        onClick={() => handleSetStatus('paused')}
                        className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs transition-all"
                      >
                        <Pause className="w-3.5 h-3.5 fill-current" />
                        <span>Pause</span>
                      </button>
                    )}

                    {activeMatch.status !== 'completed' && (
                      <button
                        type="button"
                        onClick={() => handleSetStatus('completed')}
                        className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white font-bold text-xs shadow-lg shadow-emerald-500/20 transition-all"
                      >
                        <Award className="w-3.5 h-3.5" />
                        <span>Complete Match</span>
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={handleResetScores}
                      className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white transition-colors"
                      title="Reset match scores to 0-0"
                    >
                      <RefreshCw className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* BIG SCOREBOARD CONTROLS */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-stretch">
                  {/* TEAM A CARD */}
                  <div className="rounded-3xl bg-slate-950/80 border border-white/10 p-6 flex flex-col justify-between space-y-6">
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-[11px] font-bold uppercase tracking-widest text-cyan-400">Team A</span>
                        {activeMatch.winner === activeMatch.teamA && (
                          <span className="px-2 py-0.5 rounded text-[10px] font-black uppercase bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                            Winner
                          </span>
                        )}
                      </div>
                      <h3 className="text-2xl sm:text-3xl font-black font-display text-white uppercase tracking-tight">
                        {getTeamName(activeMatch.teamA)}
                      </h3>
                      {/* Team A Roster players */}
                      <div className="mt-2 text-xs text-slate-400 space-y-0.5">
                        {getTeamPlayers(activeMatch.teamA).map((p) => (
                          <div key={p.id} className="flex items-center gap-1.5">
                            <span className="w-1.5 h-1.5 rounded-full bg-cyan-400" />
                            <span>{p.name}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Score Counter & Touch Controls */}
                    <div className="space-y-4">
                      {/* Big Score Display */}
                      <div className="py-6 rounded-2xl bg-gradient-to-b from-cyan-950/40 to-slate-900/60 border border-cyan-500/30 text-center">
                        <span className="text-7xl sm:text-8xl font-black font-mono tracking-tight text-white drop-shadow">
                          {activeMatch.scoreA ?? 0}
                        </span>
                        <p className="text-[10px] font-bold uppercase tracking-wider text-cyan-300 mt-1">Current Points</p>
                      </div>

                      {/* Large Touch Scoring Buttons */}
                      <div className="grid grid-cols-4 gap-3">
                        <button
                          type="button"
                          onClick={() => handleScoreChange('A', -1)}
                          disabled={(activeMatch.scoreA ?? 0) <= 0}
                          className="col-span-1 py-4 rounded-2xl bg-white/5 hover:bg-white/10 active:bg-white/20 border border-white/10 text-slate-300 font-bold text-lg flex items-center justify-center transition-all disabled:opacity-30 disabled:cursor-not-allowed"
                          title="Decrease point"
                        >
                          <Minus className="w-6 h-6" />
                        </button>

                        <button
                          type="button"
                          onClick={() => handleScoreChange('A', 1)}
                          className="col-span-3 py-4 rounded-2xl bg-cyan-400 hover:bg-cyan-300 active:scale-95 text-slate-950 font-black text-xl flex items-center justify-center gap-2 shadow-xl shadow-cyan-400/20 transition-all"
                        >
                          <Plus className="w-7 h-7" />
                          <span>+1 POINT</span>
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* TEAM B CARD */}
                  <div className="rounded-3xl bg-slate-950/80 border border-white/10 p-6 flex flex-col justify-between space-y-6">
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-[11px] font-bold uppercase tracking-widest text-lime-400">Team B</span>
                        {activeMatch.winner === activeMatch.teamB && (
                          <span className="px-2 py-0.5 rounded text-[10px] font-black uppercase bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                            Winner
                          </span>
                        )}
                      </div>
                      <h3 className="text-2xl sm:text-3xl font-black font-display text-white uppercase tracking-tight">
                        {getTeamName(activeMatch.teamB)}
                      </h3>
                      {/* Team B Roster players */}
                      <div className="mt-2 text-xs text-slate-400 space-y-0.5">
                        {getTeamPlayers(activeMatch.teamB).map((p) => (
                          <div key={p.id} className="flex items-center gap-1.5">
                            <span className="w-1.5 h-1.5 rounded-full bg-lime-400" />
                            <span>{p.name}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Score Counter & Touch Controls */}
                    <div className="space-y-4">
                      {/* Big Score Display */}
                      <div className="py-6 rounded-2xl bg-gradient-to-b from-lime-950/40 to-slate-900/60 border border-lime-500/30 text-center">
                        <span className="text-7xl sm:text-8xl font-black font-mono tracking-tight text-white drop-shadow">
                          {activeMatch.scoreB ?? 0}
                        </span>
                        <p className="text-[10px] font-bold uppercase tracking-wider text-lime-300 mt-1">Current Points</p>
                      </div>

                      {/* Large Touch Scoring Buttons */}
                      <div className="grid grid-cols-4 gap-3">
                        <button
                          type="button"
                          onClick={() => handleScoreChange('B', -1)}
                          disabled={(activeMatch.scoreB ?? 0) <= 0}
                          className="col-span-1 py-4 rounded-2xl bg-white/5 hover:bg-white/10 active:bg-white/20 border border-white/10 text-slate-300 font-bold text-lg flex items-center justify-center transition-all disabled:opacity-30 disabled:cursor-not-allowed"
                          title="Decrease point"
                        >
                          <Minus className="w-6 h-6" />
                        </button>

                        <button
                          type="button"
                          onClick={() => handleScoreChange('B', 1)}
                          className="col-span-3 py-4 rounded-2xl bg-lime-400 hover:bg-lime-300 active:scale-95 text-slate-950 font-black text-xl flex items-center justify-center gap-2 shadow-xl shadow-lime-400/20 transition-all"
                        >
                          <Plus className="w-7 h-7" />
                          <span>+1 POINT</span>
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="py-16 text-center space-y-3 rounded-3xl bg-slate-900/40 border border-white/5">
                <Activity className="w-10 h-10 text-slate-600 mx-auto" />
                <p className="text-sm font-semibold text-slate-300">No match selected</p>
                <p className="text-xs text-slate-500">Pick a match above to operate live points and sets</p>
              </div>
            )}
          </div>
        ) : (
          /* TAB 2: PLAYER INFORMATION (READ-ONLY) */
          <div className="space-y-6">
            {/* Read-only restriction notice */}
            <div className="p-4 rounded-2xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-between gap-3 text-xs text-blue-200">
              <div className="flex items-center gap-2.5">
                <Shield className="w-5 h-5 text-blue-400 shrink-0" />
                <div>
                  <p className="font-bold text-white">Read-Only Player Roster Access</p>
                  <p className="text-blue-300">
                    You have view-only access to verify athlete eligibility and tournament roster information. Phone numbers are protected.
                  </p>
                </div>
              </div>
              <span className="text-[10px] font-bold uppercase tracking-wider bg-blue-500/20 text-blue-400 px-2.5 py-1 rounded-lg shrink-0">
                Data Protected
              </span>
            </div>

            {/* Search & Filter Bar */}
            <div className="p-4 rounded-2xl bg-slate-900/40 border border-white/5 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={playerSearch}
                  onChange={(e) => setPlayerSearch(e.target.value)}
                  placeholder="Search players by name, team or city..."
                  className="w-full pl-10 pr-4 py-2 bg-slate-950 border border-white/10 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-400"
                />
              </div>

              <div className="flex items-center gap-2">
                <Filter className="w-3.5 h-3.5 text-slate-400" />
                <select
                  value={playerCategoryFilter}
                  onChange={(e) => setPlayerCategoryFilter(e.target.value)}
                  className="px-3 py-2 bg-slate-950 border border-white/10 rounded-xl text-xs text-slate-200 focus:outline-none"
                >
                  <option value="all">All Categories</option>
                  <option value="singles">Singles</option>
                  <option value="doubles">Doubles</option>
                  <option value="mixed">Mixed Doubles</option>
                </select>
              </div>
            </div>

            {/* Players Table */}
            <div className="rounded-2xl bg-slate-900/40 border border-white/10 overflow-hidden">
              {filteredPlayers.length === 0 ? (
                <div className="py-16 text-center space-y-2">
                  <Users className="w-8 h-8 text-slate-600 mx-auto" />
                  <p className="text-sm font-semibold text-slate-300">No players found</p>
                  <p className="text-xs text-slate-500">Try adjusting your search criteria</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-white/5 border-b border-white/10 text-slate-400 font-bold uppercase tracking-wider text-[10px]">
                      <tr>
                        <th className="py-3.5 px-4">Player Details</th>
                        <th className="py-3.5 px-4">Assigned Team</th>
                        <th className="py-3.5 px-4">Category</th>
                        <th className="py-3.5 px-4">Contact (Masked)</th>
                        <th className="py-3.5 px-4">City / State</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                      {filteredPlayers.map((player) => {
                        const team = state.teams.find((t) => t.players.includes(player.id));
                        const teamName = team?.name || 'Unassigned';
                        const isCaptain = team?.captainId === player.id;

                        return (
                          <tr key={player.id} className="hover:bg-white/[0.02] transition-colors">
                            <td className="py-3.5 px-4">
                              <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-xl bg-cyan-400/20 text-cyan-400 border border-cyan-400/30 flex items-center justify-center font-bold text-xs shrink-0">
                                  {player.name.charAt(0).toUpperCase()}
                                </div>
                                <div>
                                  <span className="font-bold text-white text-sm">{player.name}</span>
                                  {isCaptain && (
                                    <span className="ml-2 px-1.5 py-0.5 rounded text-[9px] font-bold uppercase bg-amber-400/20 text-amber-400">
                                      Captain
                                    </span>
                                  )}
                                  <p className="text-[10px] text-slate-500">ID: {player.id}</p>
                                </div>
                              </div>
                            </td>

                            <td className="py-3.5 px-4">
                              <span className="font-semibold text-slate-200">{teamName}</span>
                            </td>

                            <td className="py-3.5 px-4">
                              <span className="px-2 py-0.5 rounded-lg text-[10px] font-bold uppercase bg-white/5 text-slate-300">
                                {player.category || 'Standard'}
                              </span>
                            </td>

                            <td className="py-3.5 px-4">
                              <div className="flex items-center gap-1.5 text-slate-400 font-mono text-[11px]">
                                <Lock className="w-3 h-3 text-slate-500" />
                                <span>{maskPhone(player.mobile)}</span>
                              </div>
                            </td>

                            <td className="py-3.5 px-4 text-slate-400">
                              <span>{player.city || 'Maharajganj'}</span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}
      </main>

      {/* MY ACCOUNT & SECURITY MODAL */}
      <MyAccountModal
        isOpen={isAccountModalOpen}
        onClose={() => setIsAccountModalOpen(false)}
        onUserUpdated={() => {
          setIsAccountModalOpen(false);
        }}
      />
    </div>
  );
};
