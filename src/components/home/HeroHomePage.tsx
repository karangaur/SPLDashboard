import React, { useState } from 'react';
import {
  Trophy,
  Swords,
  Users,
  MapPin,
  Calendar,
  Sparkles,
  ArrowRight,
  ExternalLink,
  Flame,
  CheckCircle2,
  Clock,
  Share2,
  Copy,
  ChevronDown,
  Activity,
  Shield,
  Star,
  PlusCircle,
  LogIn,
  X,
  Play,
  Sliders,
} from 'lucide-react';
import { useTournament } from '../../context/TournamentContext';
import { BadmintonHeroVisual } from './BadmintonHeroVisual';
import { LiveMatchHero } from './LiveMatchHero';
import { Match, Team, Player } from '../../types/tournament';
import { AuthService } from '../../services/authService';

const SPL_LOGO_SRC = '/assets/aistudio/7fdef8a3-3175-4f56-903d-bb6551369ac1_16fe4ad8.png';

interface HeroHomePageProps {
  onOpenLogin: () => void;
  onOpenPublicRegister: () => void;
  onGoToAdmin: () => void;
}

export const HeroHomePage: React.FC<HeroHomePageProps> = ({
  onOpenLogin,
  onOpenPublicRegister,
  onGoToAdmin,
}) => {
  const { state, standings } = useTournament();
  const isAdmin = AuthService.isAuthenticated();

  const [activeMatchFilter, setActiveMatchFilter] = useState<'all' | 'live' | 'upcoming' | 'completed'>('all');
  const [selectedCourtFilter, setSelectedCourtFilter] = useState<number | 'all'>('all');
  const [detailMatch, setDetailMatch] = useState<Match | null>(null);
  const [copiedStandings, setCopiedStandings] = useState(false);

  // Helper lookups
  const getTeam = (teamId?: string) => state.teams.find((t) => t.id === teamId);
  const getPlayer = (playerId?: string) => state.players.find((p) => p.id === playerId);

  // Filtered matches for schedule showcase
  const filteredMatches = state.matches.filter((m) => {
    if (activeMatchFilter !== 'all' && m.status !== activeMatchFilter) return false;
    if (selectedCourtFilter !== 'all' && m.court !== selectedCourtFilter) return false;
    return true;
  });

  const liveMatchesCount = state.matches.filter((m) => m.status === 'live').length;
  const completedCount = state.matches.filter((m) => m.status === 'completed').length;
  const upcomingCount = state.matches.filter((m) => m.status === 'upcoming').length;

  const scrollToSection = (id: string) => {
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth' });
    }
  };

  const copyStandingsText = () => {
    const lines = [
      `🏸 ${state.settings.name || 'Smash Premier League Maharajganj'} — Points Table`,
      `Venue: ${state.settings.venue || 'Maharajganj Indoor Badminton Stadium'}`,
      '---------------------------------------',
      '# | Team | P | W | L | Diff | Pts',
    ];
    standings.forEach((r, idx) => {
      lines.push(`${idx + 1}. ${r.team.name} | P:${r.played} W:${r.won} L:${r.lost} Diff:${r.diff > 0 ? `+${r.diff}` : r.diff} | Pts:${r.points}`);
    });
    lines.push('---------------------------------------');
    navigator.clipboard.writeText(lines.join('\n'));
    setCopiedStandings(true);
    setTimeout(() => setCopiedStandings(false), 2000);
  };

  return (
    <div className="min-h-screen bg-[#04060e] text-slate-100 selection:bg-amber-400 selection:text-slate-950 font-sans relative overflow-x-hidden">
      
      {/* Dynamic Background Badminton Arena Ambience with Blue & Gold Accents */}
      <div className="fixed inset-0 pointer-events-none z-0">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[1100px] h-[600px] bg-gradient-to-b from-blue-600/15 via-indigo-600/10 to-transparent blur-3xl opacity-75" />
        <div className="absolute top-[300px] -right-40 w-[600px] h-[600px] bg-amber-500/10 blur-3xl rounded-full" />
        <div className="absolute top-[800px] -left-40 w-[600px] h-[600px] bg-sky-500/8 blur-3xl rounded-full" />
        <div className="absolute top-[1600px] -right-40 w-[600px] h-[600px] bg-amber-500/8 blur-3xl rounded-full" />
      </div>

      {/* 1. HEADER / NAVIGATION BAR */}
      <header className="sticky top-0 z-40 w-full border-b border-white/10 bg-[#060813]/90 backdrop-blur-md">
        <div className="mx-auto flex h-16 sm:h-20 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
          
          {/* Brand Wordmark with Official 3D Logo */}
          <div className="flex items-center gap-3">
            <button
              onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
              className="flex items-center gap-3 text-left group"
            >
              <img
                src={SPL_LOGO_SRC}
                alt="Smash Premier League Logo"
                className="h-10 sm:h-12 w-auto object-contain shrink-0 drop-shadow-[0_2px_10px_rgba(59,130,246,0.5)] group-hover:scale-105 transition-transform"
              />
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-display text-base sm:text-lg font-black tracking-tight text-white uppercase">
                    Smash Premier League
                  </span>
                  <span className="hidden sm:inline px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider bg-amber-400 text-slate-950 font-mono">
                    Maharajganj
                  </span>
                </div>
                <span className="block text-xs font-semibold text-slate-400 -mt-0.5">
                  Official Badminton Championship
                </span>
              </div>
            </button>
          </div>

          {/* Center Navigation Links (Desktop) */}
          <nav className="hidden md:flex items-center gap-1 lg:gap-2 text-xs sm:text-sm font-semibold text-slate-300">
            <button
              onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
              className="px-3 py-1.5 rounded-lg hover:text-white hover:bg-white/5 transition-colors"
            >
              Home
            </button>
            <button
              onClick={() => scrollToSection('live-match')}
              className="px-3 py-1.5 rounded-lg hover:text-white hover:bg-white/5 transition-colors flex items-center gap-1.5 text-amber-300 font-bold"
            >
              <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse" />
              <span>Live Match</span>
            </button>
            <button
              onClick={() => scrollToSection('matches-schedule')}
              className="px-3 py-1.5 rounded-lg hover:text-white hover:bg-white/5 transition-colors"
            >
              Matches
            </button>
            <button
              onClick={() => scrollToSection('teams-roster')}
              className="px-3 py-1.5 rounded-lg hover:text-white hover:bg-white/5 transition-colors"
            >
              Teams
            </button>
            <button
              onClick={() => scrollToSection('standings-table')}
              className="px-3 py-1.5 rounded-lg hover:text-white hover:bg-white/5 transition-colors"
            >
              Standings
            </button>
            <button
              onClick={() => scrollToSection('tournament-info')}
              className="px-3 py-1.5 rounded-lg hover:text-white hover:bg-white/5 transition-colors"
            >
              Venue & Rules
            </button>
          </nav>

          {/* Right Action Buttons */}
          <div className="flex items-center gap-2 sm:gap-3">
            {/* Athlete Registration Button */}
            <button
              onClick={onOpenPublicRegister}
              className="hidden sm:flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-slate-950 bg-gradient-to-r from-amber-400 via-amber-300 to-yellow-400 hover:from-amber-300 hover:to-yellow-300 rounded-xl shadow-md shadow-amber-400/20 transition-all active:scale-95"
            >
              <PlusCircle className="w-3.5 h-3.5" />
              <span>Register Player</span>
            </button>

            {/* Authentication Connection Button */}
            {isAdmin ? (
              <button
                onClick={onGoToAdmin}
                className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-emerald-300 bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/40 rounded-xl shadow-sm transition-all"
              >
                <Shield className="w-3.5 h-3.5 text-emerald-400" />
                <span className="hidden sm:inline">Admin Panel</span>
                <span className="sm:hidden">Admin</span>
              </button>
            ) : (
              <button
                onClick={onOpenLogin}
                className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-slate-200 hover:text-white bg-white/5 hover:bg-white/10 border border-white/15 rounded-xl transition-all"
              >
                <LogIn className="w-3.5 h-3.5 text-amber-400" />
                <span>LOGIN</span>
              </button>
            )}
          </div>

        </div>
      </header>

      {/* Main Content Sections */}
      <main className="relative z-10 space-y-16 sm:space-y-24 pb-20">
        
        {/* 2. HERO SECTION */}
        <section className="relative pt-8 sm:pt-14 lg:pt-20">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-8 items-center">
              
              {/* LEFT Column: Tournament Identity & CTAs */}
              <div className="lg:col-span-7 space-y-6 sm:space-y-8 text-center lg:text-left">
                
                <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-blue-500/10 border border-blue-400/30 text-sky-300 text-xs font-black uppercase tracking-wider">
                  <span className="w-2 h-2 rounded-full bg-sky-400 animate-ping" />
                  <span>Maharajganj Badminton Association Presents</span>
                </div>

                <div className="space-y-3">
                  <h1 className="text-4xl sm:text-6xl lg:text-7xl font-black font-display tracking-tight text-white uppercase leading-[1.05]">
                    Smash Premier <br />
                    <span className="bg-gradient-to-r from-sky-400 via-blue-400 to-amber-300 bg-clip-text text-transparent">
                      League
                    </span>
                  </h1>

                  <p className="text-xl sm:text-3xl font-extrabold uppercase tracking-wide text-slate-200 font-display">
                    Maharajganj Badminton Championship
                  </p>

                  <p className="text-2xl sm:text-3xl lg:text-4xl font-black text-amber-400 italic tracking-tight drop-shadow-sm">
                    “Every Smash. Every Point. Every Victory.”
                  </p>

                  <p className="text-base sm:text-lg text-slate-300 max-w-xl mx-auto lg:mx-0 font-normal leading-relaxed pt-1">
                    The premier tournament uniting Maharajganj’s top shuttlers. Follow the teams, track live court scores, and watch the championship unfold in real time.
                  </p>
                </div>

                {/* Hero Action Buttons */}
                <div className="flex flex-wrap items-center justify-center lg:justify-start gap-3 sm:gap-4 pt-2">
                  <button
                    onClick={() => scrollToSection('live-match')}
                    className="flex items-center gap-2 px-6 py-3.5 rounded-2xl font-display font-black text-sm uppercase tracking-wider text-slate-950 bg-gradient-to-r from-rose-500 via-rose-400 to-amber-400 hover:from-rose-400 hover:to-amber-300 shadow-xl shadow-rose-500/25 transition-all active:scale-95 cursor-pointer"
                  >
                    <span className="w-2.5 h-2.5 rounded-full bg-slate-950 animate-ping" />
                    <span>View Live Matches</span>
                  </button>

                  <button
                    onClick={() => scrollToSection('standings-table')}
                    className="flex items-center gap-2 px-6 py-3.5 rounded-2xl font-display font-bold text-sm uppercase tracking-wider text-white bg-blue-600/20 hover:bg-blue-600/30 border border-blue-400/30 transition-all cursor-pointer"
                  >
                    <Trophy className="w-4 h-4 text-amber-400" />
                    <span>Tournament Standings</span>
                  </button>

                  <button
                    onClick={onOpenPublicRegister}
                    className="flex items-center gap-2 px-5 py-3.5 rounded-2xl font-display font-bold text-sm uppercase tracking-wider text-slate-950 bg-gradient-to-r from-amber-400 to-yellow-400 hover:from-amber-300 hover:to-yellow-300 shadow-lg shadow-amber-400/20 transition-all cursor-pointer"
                  >
                    <PlusCircle className="w-4 h-4 text-slate-950" />
                    <span>Register to Play</span>
                  </button>
                </div>

                {/* Athletic Live Highlight Strip */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-4 border-t border-white/10 text-left">
                  <div className="p-3 rounded-xl bg-white/[0.03] border border-white/5">
                    <span className="text-[11px] text-slate-400 font-semibold uppercase block">Competing Teams</span>
                    <span className="text-xl sm:text-2xl font-black text-white font-mono">{state.teams.length} Teams</span>
                  </div>
                  <div className="p-3 rounded-xl bg-white/[0.03] border border-white/5">
                    <span className="text-[11px] text-slate-400 font-semibold uppercase block">Total Fixtures</span>
                    <span className="text-xl sm:text-2xl font-black text-lime-400 font-mono">{state.matches.length} Matches</span>
                  </div>
                  <div className="p-3 rounded-xl bg-white/[0.03] border border-white/5">
                    <span className="text-[11px] text-slate-400 font-semibold uppercase block">Championship Venue</span>
                    <span className="text-xs sm:text-sm font-bold text-slate-200 truncate block mt-1">Indoor Stadium</span>
                  </div>
                  <div className="p-3 rounded-xl bg-white/[0.03] border border-white/5">
                    <span className="text-[11px] text-slate-400 font-semibold uppercase block">Match Rules</span>
                    <span className="text-xs sm:text-sm font-bold text-amber-400 truncate block mt-1">BWF 21 Rally</span>
                  </div>
                </div>

              </div>

              {/* RIGHT Column: Badminton Action Hero Visual */}
              <div className="lg:col-span-5 flex justify-center">
                <BadmintonHeroVisual />
              </div>

            </div>
          </div>
        </section>

        {/* 3. LIVE MATCH — THE MAIN FEATURE SECTION */}
        <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <span className="text-xs font-bold uppercase tracking-wider text-lime-400 block">
                Court Action Center
              </span>
              <h2 className="text-2xl sm:text-3xl font-black text-white font-display uppercase tracking-tight">
                Live Match Broadcast
              </h2>
            </div>
            {liveMatchesCount > 0 && (
              <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-rose-500/20 text-rose-400 border border-rose-500/40 text-xs font-bold">
                <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse" />
                <span>{liveMatchesCount} Match{liveMatchesCount > 1 ? 'es' : ''} in Progress</span>
              </div>
            )}
          </div>

          <LiveMatchHero
            matches={state.matches}
            teams={state.teams}
            players={state.players}
            onOpenMatchModal={(m) => setDetailMatch(m)}
            onGoToFixtures={() => scrollToSection('matches-schedule')}
          />
        </section>

        {/* 4. MATCH DASHBOARD / FIXTURES SCHEDULE */}
        <section id="matches-schedule" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 scroll-mt-24">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-8">
            <div>
              <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-lime-400">
                <Swords className="w-4 h-4" />
                <span>Tournament Match Center</span>
              </div>
              <h2 className="text-3xl sm:text-4xl font-black text-white font-display uppercase tracking-tight mt-1">
                Fixtures & Results
              </h2>
              <p className="text-sm text-slate-400 mt-1 max-w-xl">
                Real-time match schedule across Court 1 and Court 2. All points and game winners are updated live from the scorer’s desk.
              </p>
            </div>

            {/* Filter Tabs */}
            <div className="flex flex-wrap items-center gap-2">
              <div className="inline-flex rounded-xl bg-slate-900 border border-white/10 p-1">
                <button
                  onClick={() => setActiveMatchFilter('all')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                    activeMatchFilter === 'all'
                      ? 'bg-lime-400 text-slate-950 shadow'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  All ({state.matches.length})
                </button>
                <button
                  onClick={() => setActiveMatchFilter('live')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                    activeMatchFilter === 'live'
                      ? 'bg-rose-500 text-white shadow'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Live ({liveMatchesCount})
                </button>
                <button
                  onClick={() => setActiveMatchFilter('upcoming')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                    activeMatchFilter === 'upcoming'
                      ? 'bg-amber-400 text-slate-950 shadow'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Upcoming ({upcomingCount})
                </button>
                <button
                  onClick={() => setActiveMatchFilter('completed')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                    activeMatchFilter === 'completed'
                      ? 'bg-emerald-500 text-white shadow'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Results ({completedCount})
                </button>
              </div>

              {/* Court filter */}
              <div className="inline-flex rounded-xl bg-slate-900 border border-white/10 p-1">
                <button
                  onClick={() => setSelectedCourtFilter('all')}
                  className={`px-2.5 py-1.5 rounded-lg text-xs font-bold ${
                    selectedCourtFilter === 'all' ? 'bg-white/10 text-white' : 'text-slate-400'
                  }`}
                >
                  Both Courts
                </button>
                <button
                  onClick={() => setSelectedCourtFilter(1)}
                  className={`px-2.5 py-1.5 rounded-lg text-xs font-bold ${
                    selectedCourtFilter === 1 ? 'bg-white/10 text-lime-400' : 'text-slate-400'
                  }`}
                >
                  Court 1
                </button>
                <button
                  onClick={() => setSelectedCourtFilter(2)}
                  className={`px-2.5 py-1.5 rounded-lg text-xs font-bold ${
                    selectedCourtFilter === 2 ? 'bg-white/10 text-cyan-400' : 'text-slate-400'
                  }`}
                >
                  Court 2
                </button>
              </div>
            </div>
          </div>

          {/* Matches Grid */}
          {filteredMatches.length === 0 ? (
            <div className="p-12 text-center rounded-3xl bg-slate-900/60 border border-white/10">
              <span className="text-4xl">🏸</span>
              <h3 className="text-lg font-bold text-white mt-3">No Matches in this Category</h3>
              <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
                No fixtures match your current filter. Switch back to &ldquo;All Matches&rdquo; to see the entire tournament schedule.
              </p>
              <button
                onClick={() => {
                  setActiveMatchFilter('all');
                  setSelectedCourtFilter('all');
                }}
                className="mt-4 px-4 py-2 rounded-xl text-xs font-bold bg-white/10 hover:bg-white/15 text-white"
              >
                Reset Filters
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredMatches.map((m) => {
                const tA = getTeam(m.teamA);
                const tB = getTeam(m.teamB);
                const sA = m.scoreA ?? 0;
                const sB = m.scoreB ?? 0;
                const isLive = m.status === 'live';
                const isDone = m.status === 'completed';

                return (
                  <div
                    key={m.id}
                    onClick={() => setDetailMatch(m)}
                    className="p-5 rounded-2xl bg-slate-900/80 border border-white/10 hover:border-lime-400/40 transition-all flex flex-col justify-between cursor-pointer group shadow-lg hover:-translate-y-0.5"
                  >
                    <div>
                      {/* Top Badges */}
                      <div className="flex items-center justify-between pb-3 border-b border-white/5 text-xs">
                        <span className="font-mono text-slate-400 font-semibold">
                          Round {m.round} · Court {m.court}
                        </span>
                        {isLive ? (
                          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-rose-500/20 text-rose-300 border border-rose-500/40">
                            <span className="w-1.5 h-1.5 rounded-full bg-rose-400 animate-pulse" />
                            Live
                          </span>
                        ) : isDone ? (
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-emerald-500/20 text-emerald-300">
                            Final
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-amber-500/20 text-amber-300">
                            Upcoming
                          </span>
                        )}
                      </div>

                      {/* Teams & Scores Row */}
                      <div className="py-4 space-y-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2.5 min-w-0">
                            <span className="text-xl">{tA?.badge || '🏸'}</span>
                            <span
                              className={`font-display font-bold text-sm truncate ${
                                m.winner === m.teamA ? 'text-lime-400 font-black' : 'text-white'
                              }`}
                            >
                              {tA?.name || 'Team A'}
                            </span>
                          </div>
                          <span
                            className={`font-mono text-xl font-black ${
                              isDone || isLive ? 'text-white' : 'text-slate-600'
                            }`}
                          >
                            {isDone || isLive ? sA : '-'}
                          </span>
                        </div>

                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2.5 min-w-0">
                            <span className="text-xl">{tB?.badge || '🏸'}</span>
                            <span
                              className={`font-display font-bold text-sm truncate ${
                                m.winner === m.teamB ? 'text-lime-400 font-black' : 'text-white'
                              }`}
                            >
                              {tB?.name || 'Team B'}
                            </span>
                          </div>
                          <span
                            className={`font-mono text-xl font-black ${
                              isDone || isLive ? 'text-white' : 'text-slate-600'
                            }`}
                          >
                            {isDone || isLive ? sB : '-'}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Bottom Action Footer */}
                    <div className="pt-3 border-t border-white/5 flex items-center justify-between text-xs text-slate-400 group-hover:text-lime-400 transition-colors">
                      <span>View Match Details</span>
                      <ArrowRight className="w-3.5 h-3.5 transform group-hover:translate-x-1 transition-transform" />
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Quick link to admin dashboard for full scoring */}
          {isAdmin && (
            <div className="mt-8 p-4 rounded-2xl bg-slate-900 border border-white/10 flex flex-col sm:flex-row items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-lime-400/10 text-lime-400">
                  <Sliders className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-sm font-bold text-white">Administrator Match Management</p>
                  <p className="text-xs text-slate-400">Update scores, change serving order, and advance knockout brackets.</p>
                </div>
              </div>
              <button
                onClick={onGoToAdmin}
                className="px-4 py-2 rounded-xl text-xs font-bold text-slate-950 bg-lime-400 hover:bg-lime-300 transition-all shrink-0"
              >
                Open Admin Scorer Desk
              </button>
            </div>
          )}
        </section>

        {/* 5. THE TEAMS SECTION */}
        <section id="teams-roster" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 scroll-mt-24">
          <div className="text-center max-w-2xl mx-auto mb-10 space-y-2">
            <span className="text-xs font-bold uppercase tracking-wider text-lime-400 block">
              Championship Roster
            </span>
            <h2 className="text-3xl sm:text-5xl font-black text-white font-display uppercase tracking-tight">
              The Teams
            </h2>
            <p className="text-sm sm:text-base text-slate-300">
              Meet the teams competing for the Smash Premier League title. Every player, every captain, and their league record.
            </p>
          </div>

          {state.teams.length === 0 ? (
            <div className="p-12 text-center rounded-3xl bg-slate-900/60 border border-white/10 max-w-xl mx-auto">
              <span className="text-5xl">🏸</span>
              <h3 className="text-lg font-bold text-white mt-4">Draft Stage in Progress</h3>
              <p className="text-xs text-slate-400 mt-1">
                Teams for this season are currently being drafted. Register your entry to get assigned to a team.
              </p>
              <button
                onClick={onOpenPublicRegister}
                className="mt-5 px-5 py-2.5 rounded-xl text-xs font-bold bg-lime-400 hover:bg-lime-300 text-slate-950 transition-all shadow-md"
              >
                Register as an Athlete
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
              {state.teams.map((team, idx) => {
                const teamPlayers = team.players?.map(getPlayer).filter(Boolean) as Player[] || [];
                const captain = getPlayer(team.captainId);
                const standingRecord = standings.find((s) => s.team.id === team.id);

                return (
                  <div
                    key={team.id}
                    className="p-5 rounded-3xl bg-gradient-to-b from-slate-900 via-[#0a0f1d] to-slate-950 border border-white/10 hover:border-lime-400/40 transition-all shadow-xl flex flex-col justify-between group"
                  >
                    <div>
                      {/* Card Header: Avatar & Badge */}
                      <div className="flex items-center justify-between pb-3 border-b border-white/5">
                        <div className="flex items-center gap-3">
                          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-tr from-lime-400 to-emerald-500 text-slate-950 font-black text-xl shadow-md">
                            <span>{team.badge || '🏸'}</span>
                          </div>
                          <div>
                            <h3 className="font-display font-black text-base text-white group-hover:text-lime-400 transition-colors">
                              {team.name}
                            </h3>
                            <span className="text-[11px] text-slate-400">Team #{idx + 1}</span>
                          </div>
                        </div>

                        {/* Rank Badge if in standings */}
                        {standingRecord && (
                          <div className="text-right">
                            <span className="text-[10px] uppercase font-bold text-slate-400 block">Rank</span>
                            <span className="text-sm font-black text-lime-400 font-mono">
                              #{standings.findIndex((s) => s.team.id === team.id) + 1}
                            </span>
                          </div>
                        )}
                      </div>

                      {/* Players Roster */}
                      <div className="py-4 space-y-2.5">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                          Athletes Roster
                        </span>
                        {teamPlayers.length === 0 ? (
                          <p className="text-xs text-slate-400 italic">No players drafted yet</p>
                        ) : (
                          <div className="space-y-1.5">
                            {teamPlayers.map((p) => {
                              const isCaptain = team.captainId === p.id;
                              return (
                                <div
                                  key={p.id}
                                  className="flex items-center justify-between p-2 rounded-xl bg-white/[0.03] border border-white/5 text-xs"
                                >
                                  <div className="flex items-center gap-2 min-w-0">
                                    <span className="w-1.5 h-1.5 rounded-full bg-lime-400" />
                                    <span className="font-semibold text-white truncate">{p.name}</span>
                                  </div>
                                  {isCaptain && (
                                    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-black uppercase bg-amber-400/20 text-amber-300 border border-amber-400/40">
                                      <Star className="w-2.5 h-2.5 fill-current" />
                                      <span>Captain</span>
                                    </span>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Team Record Strip */}
                    {standingRecord && (
                      <div className="pt-3 border-t border-white/10 grid grid-cols-3 gap-2 text-center text-[11px]">
                        <div className="p-1.5 rounded-lg bg-white/[0.02]">
                          <span className="text-slate-400 block text-[9px] uppercase">Played</span>
                          <span className="font-bold text-white font-mono">{standingRecord.played}</span>
                        </div>
                        <div className="p-1.5 rounded-lg bg-white/[0.02]">
                          <span className="text-slate-400 block text-[9px] uppercase">W - L</span>
                          <span className="font-bold text-emerald-400 font-mono">
                            {standingRecord.won} - {standingRecord.lost}
                          </span>
                        </div>
                        <div className="p-1.5 rounded-lg bg-white/[0.02]">
                          <span className="text-slate-400 block text-[9px] uppercase">Points</span>
                          <span className="font-black text-lime-400 font-mono">{standingRecord.points}</span>
                        </div>
                      </div>
                    )}

                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* 6. LIVE STANDINGS TABLE */}
        <section id="standings-table" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 scroll-mt-24">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-8">
            <div>
              <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-amber-400">
                <Trophy className="w-4 h-4" />
                <span>Leaderboard</span>
              </div>
              <h2 className="text-3xl sm:text-4xl font-black text-white font-display uppercase tracking-tight mt-1">
                Official League Standings
              </h2>
              <p className="text-sm text-slate-400 mt-1">
                Top 4 teams at the conclusion of group play advance directly to the Knockout Semifinals.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={copyStandingsText}
                className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-slate-300 hover:text-white bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl transition-all"
              >
                <Copy className="w-3.5 h-3.5 text-lime-400" />
                <span>{copiedStandings ? 'Copied Table!' : 'Share Standings'}</span>
              </button>
            </div>
          </div>

          {standings.length === 0 ? (
            <div className="p-12 text-center rounded-3xl bg-slate-900/60 border border-white/10">
              <Trophy className="w-8 h-8 text-slate-500 mx-auto" />
              <p className="text-sm text-slate-400 mt-2">Standings will populate once teams and matches are loaded.</p>
            </div>
          ) : (
            <div className="rounded-3xl border border-white/10 bg-slate-900/80 shadow-2xl overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm text-slate-300">
                  <thead className="text-[11px] uppercase font-bold text-slate-400 bg-slate-950/80 border-b border-white/10 tracking-wider">
                    <tr>
                      <th scope="col" className="px-5 py-4 w-16 text-center">Rank</th>
                      <th scope="col" className="px-5 py-4">Team</th>
                      <th scope="col" className="px-3 py-4 text-center">P</th>
                      <th scope="col" className="px-3 py-4 text-center">W</th>
                      <th scope="col" className="px-3 py-4 text-center">L</th>
                      <th scope="col" className="px-3 py-4 text-center">Diff</th>
                      <th scope="col" className="px-5 py-4 text-center font-black text-lime-400">PTS</th>
                      <th scope="col" className="px-5 py-4 text-center">Recent Form</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5 font-mono text-xs">
                    {standings.map((row, idx) => {
                      const isTop4 = idx < 4;
                      return (
                        <tr
                          key={row.team.id}
                          className={`hover:bg-white/[0.04] transition-colors ${
                            idx === 3 ? 'border-b-2 border-lime-400/40' : ''
                          }`}
                        >
                          <td className="px-5 py-4 text-center font-bold">
                            {idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : idx + 1}
                          </td>

                          <td className="px-5 py-4 font-sans font-bold text-white">
                            <div className="flex items-center gap-2.5">
                              <span className="text-lg">{row.team.badge || '🏸'}</span>
                              <span>{row.team.name}</span>
                              {isTop4 && (
                                <span className="hidden sm:inline px-1.5 py-0.5 rounded text-[9px] font-black uppercase tracking-wider bg-lime-400/15 text-lime-400 border border-lime-400/30">
                                  Playoff
                                </span>
                              )}
                            </div>
                          </td>

                          <td className="px-3 py-4 text-center">{row.played}</td>
                          <td className="px-3 py-4 text-center text-emerald-400 font-bold">{row.won}</td>
                          <td className="px-3 py-4 text-center text-rose-400">{row.lost}</td>
                          <td className="px-3 py-4 text-center">
                            {row.diff > 0 ? `+${row.diff}` : row.diff}
                          </td>
                          <td className="px-5 py-4 text-center font-black text-base text-lime-400">
                            {row.points}
                          </td>

                          <td className="px-5 py-4 text-center">
                            {row.form && row.form.length > 0 ? (
                              <div className="flex items-center justify-center gap-1">
                                {row.form.slice(-5).map((f, i) => (
                                  <span
                                    key={i}
                                    className={`w-5 h-5 rounded flex items-center justify-center text-[10px] font-black ${
                                      f === 'W' ? 'bg-emerald-500 text-slate-950' : 'bg-rose-500/30 text-rose-300'
                                    }`}
                                  >
                                    {f}
                                  </span>
                                ))}
                              </div>
                            ) : (
                              <span className="text-slate-400">-</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Table Footer Cutoff Note */}
              <div className="px-6 py-3.5 bg-slate-950/90 border-t border-white/5 flex flex-col sm:flex-row items-center justify-between text-xs text-slate-400 gap-2">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-lime-400" />
                  <span>Green line signifies Top 4 Knockout Qualification Cutoff</span>
                </div>
                <span>BWF Badminton Standard Tiebreak Applied</span>
              </div>
            </div>
          )}
        </section>

        {/* 7. TOURNAMENT VENUE & MAHARAJGANJ COMMUNITY SECTION */}
        <section id="tournament-info" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 scroll-mt-24">
          <div className="rounded-3xl border border-white/15 bg-gradient-to-br from-slate-900 via-[#0a0f1d] to-[#04060e] p-6 sm:p-10 shadow-2xl relative overflow-hidden">
            
            {/* Background Floodlight Beam */}
            <div className="absolute top-0 right-0 w-96 h-96 bg-lime-400/10 rounded-full blur-3xl pointer-events-none" />

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
              
              <div className="lg:col-span-8 space-y-4">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-400/10 border border-amber-400/30 text-amber-400 text-xs font-bold uppercase tracking-wider">
                  <MapPin className="w-3.5 h-3.5" />
                  <span>Official Venue & Match Location</span>
                </div>

                <h2 className="text-3xl sm:text-4xl font-black text-white font-display uppercase tracking-tight">
                  Maharajganj Indoor Badminton Stadium
                </h2>

                <p className="text-sm sm:text-base text-slate-300 leading-relaxed max-w-2xl">
                  Featuring two tournament-grade synthetic badminton courts, calibrated arena lighting, referee observation towers, and live audience seating.
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-4">
                  <div className="p-3.5 rounded-2xl bg-white/[0.03] border border-white/5">
                    <span className="text-[11px] text-slate-400 font-bold uppercase block">Official Date</span>
                    <span className="text-sm font-bold text-white mt-1 block">
                      {state.settings.date || 'Championship Season 2026'}
                    </span>
                  </div>
                  <div className="p-3.5 rounded-2xl bg-white/[0.03] border border-white/5">
                    <span className="text-[11px] text-slate-400 font-bold uppercase block">Courts In Action</span>
                    <span className="text-sm font-bold text-lime-400 mt-1 block">
                      Court 1 & Court 2 (Synthetic)
                    </span>
                  </div>
                  <div className="p-3.5 rounded-2xl bg-white/[0.03] border border-white/5">
                    <span className="text-[11px] text-slate-400 font-bold uppercase block">Entry & Spot Inquiry</span>
                    <span className="text-sm font-bold text-emerald-400 mt-1 block">
                      ₹{state.settings.entryFee || 500} per Athlete
                    </span>
                  </div>
                </div>
              </div>

              {/* Call to action card */}
              <div className="lg:col-span-4 p-6 rounded-2xl bg-slate-950/80 border border-white/10 text-center space-y-4 shadow-xl">
                <span className="text-4xl">🏆</span>
                <h3 className="font-display font-black text-lg text-white uppercase">
                  Ready to Compete?
                </h3>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Join the official athlete draft of Smash Premier League Maharajganj. Open to singles and doubles competitors.
                </p>
                <button
                  onClick={onOpenPublicRegister}
                  className="w-full py-3 px-4 rounded-xl font-display font-black uppercase tracking-wider text-xs text-slate-950 bg-gradient-to-r from-lime-400 to-emerald-400 hover:from-lime-300 hover:to-emerald-300 shadow-lg shadow-lime-400/25 active:scale-95 transition-all"
                >
                  Register as an Athlete Now
                </button>
              </div>

            </div>
          </div>
        </section>

      </main>

      {/* 8. FOOTER */}
      <footer className="relative z-10 w-full border-t border-white/10 bg-[#03050c] text-xs text-slate-400 py-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <img
                src={SPL_LOGO_SRC}
                alt="Smash Premier League Logo"
                className="h-10 w-auto object-contain shrink-0 drop-shadow-md"
              />
              <div>
                <span className="font-display font-black text-white text-base uppercase block">
                  Smash Premier League Maharajganj
                </span>
                <span className="text-slate-400 text-xs">
                  Official Badminton Tournament Portal · Season IV
                </span>
              </div>
            </div>

            <div className="flex items-center gap-4">
              <button
                onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
                className="hover:text-lime-400 transition-colors"
              >
                Back to Top ↑
              </button>
              <span>•</span>
              <button onClick={onOpenPublicRegister} className="hover:text-lime-400 transition-colors">
                Athlete Entry Form
              </button>
              <span>•</span>
              {isAdmin ? (
                <button onClick={onGoToAdmin} className="text-emerald-400 hover:underline font-bold">
                  Admin Console
                </button>
              ) : (
                <button onClick={onOpenLogin} className="hover:text-lime-400 transition-colors">
                  Organizer Login
                </button>
              )}
            </div>
          </div>

          <div className="pt-6 border-t border-white/5 flex flex-col sm:flex-row items-center justify-between gap-2 text-[11px] text-slate-400">
            <span>© 2026 Smash Premier League Maharajganj. All rights reserved.</span>
            <span>BWF Badminton Rally Scoring System • Maharajganj Sports Arena</span>
          </div>
        </div>
      </footer>

      {/* 9. MATCH DETAIL MODAL */}
      {detailMatch && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-md animate-fade-in">
          <div className="w-full max-w-lg bg-slate-900 border border-white/15 rounded-3xl p-6 sm:p-8 shadow-2xl relative">
            <button
              onClick={() => setDetailMatch(null)}
              className="absolute top-5 right-5 p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-lime-400 mb-1">
              <span>Match Center Card</span>
              <span>•</span>
              <span>Court {detailMatch.court}</span>
            </div>

            <h3 className="text-xl font-black text-white font-display uppercase tracking-tight">
              Round {detailMatch.round} Fixture Breakdown
            </h3>

            {/* Scorecard Body */}
            <div className="mt-6 p-5 rounded-2xl bg-slate-950 border border-white/10 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-bold text-white text-base">{getTeam(detailMatch.teamA)?.name || 'Team A'}</p>
                  <p className="text-xs text-slate-400 mt-0.5">
                    {(getTeam(detailMatch.teamA)?.players?.map(getPlayer).filter((p): p is Player => Boolean(p)).map((p) => p.name).join(' & ')) || 'Doubles Pair'}
                  </p>
                </div>
                <span className="text-3xl font-black font-mono text-lime-400">
                  {detailMatch.scoreA ?? 0}
                </span>
              </div>

              <div className="py-1 border-t border-b border-white/10 text-center">
                <span className="text-xs font-bold text-slate-400 uppercase">
                  {detailMatch.status === 'live' ? '🔴 Live in Progress' : detailMatch.status === 'completed' ? 'Final Match Result' : 'Scheduled Match'}
                </span>
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <p className="font-bold text-white text-base">{getTeam(detailMatch.teamB)?.name || 'Team B'}</p>
                  <p className="text-xs text-slate-400 mt-0.5">
                    {(getTeam(detailMatch.teamB)?.players?.map(getPlayer).filter((p): p is Player => Boolean(p)).map((p) => p.name).join(' & ')) || 'Doubles Pair'}
                  </p>
                </div>
                <span className="text-3xl font-black font-mono text-white">
                  {detailMatch.scoreB ?? 0}
                </span>
              </div>
            </div>

            {/* Winner notice */}
            {detailMatch.winner && (
              <div className="mt-4 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 text-xs flex items-center gap-2">
                <Trophy className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>Winner: <strong>{getTeam(detailMatch.winner)?.name}</strong></span>
              </div>
            )}

            <div className="mt-6 flex justify-end">
              <button
                onClick={() => setDetailMatch(null)}
                className="px-5 py-2.5 rounded-xl text-xs font-bold bg-white/10 hover:bg-white/15 text-white transition-colors"
              >
                Close Scorecard
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
