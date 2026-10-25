import React from 'react';
import {
  Trophy,
  Users,
  Swords,
  Clock,
  ArrowRight,
  TrendingUp,
  MapPin,
  Calendar,
  Sparkles,
  ChevronRight,
  IndianRupee,
  Activity,
} from 'lucide-react';
import { useTournament, sportsAudio } from '../../context/TournamentContext';
import { formatINR, calculateRegistrationStats } from '../../utils/tournamentEngine';
import { NavTab } from '../common/Header';

interface DashboardViewProps {
  onSelectTab: (tab: NavTab) => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({ onSelectTab }) => {
  const { state, standings, updateMatch } = useTournament();

  const totalMatches = state.matches.length;
  const completedMatches = state.matches.filter((m) => m.status === 'completed').length;
  const liveMatches = state.matches.filter((m) => m.status === 'live');
  const upcomingMatches = state.matches.filter((m) => m.status === 'upcoming');
  const recentCompleted = state.matches.filter((m) => m.status === 'completed').slice(-3).reverse();

  const progressPercent = totalMatches > 0 ? Math.round((completedMatches / totalMatches) * 100) : 0;
  const regStats = calculateRegistrationStats(state.registrations);
  const slotsRemaining = Math.max(0, state.settings.slotLimit - regStats.total);
  const regPercent = Math.min(100, Math.round((regStats.total / Math.max(1, state.settings.slotLimit)) * 100));

  const leader = standings[0];
  const championKnockout = state.knockout.matches.find((m) => m.stage === 'F' && m.status === 'completed');
  const championTeam = championKnockout?.winner
    ? state.teams.find((t) => t.id === championKnockout.winner)
    : leader?.team;

  // Active or upcoming featured match
  const featuredMatch = liveMatches[0] || upcomingMatches[0] || state.matches[0];
  const teamA = featuredMatch ? state.teams.find((t) => t.id === featuredMatch.teamA) : undefined;
  const teamB = featuredMatch ? state.teams.find((t) => t.id === featuredMatch.teamB) : undefined;

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Hero Tournament Section */}
      <section className="relative overflow-hidden rounded-3xl glass-panel p-6 sm:p-8 lg:p-10 border border-white/10 shadow-2xl">
        {/* Glow backdrop decorative accent */}
        <div className="pointer-events-none absolute -right-24 -top-24 h-96 w-96 rounded-full bg-amber-500/15 blur-3xl" />
        <div className="pointer-events-none absolute -left-24 -bottom-24 h-96 w-96 rounded-full bg-blue-500/10 blur-3xl" />

        <div className="relative z-10 grid gap-8 lg:grid-cols-[1.2fr_0.8fr] lg:items-center">
          <div className="space-y-5">
            {/* Live event & courts indicator */}
            <div className="flex flex-wrap items-center gap-2.5">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold tracking-wide uppercase bg-rose-500/15 text-rose-400 border border-rose-500/30">
                <span className="h-2 w-2 rounded-full bg-rose-500 animate-pulse" />
                {liveMatches.length > 0 ? `${liveMatches.length} Match Live` : 'Live Tournament'}
              </span>
              <span className="text-xs font-semibold text-slate-400 bg-white/5 px-3 py-1 rounded-full border border-white/5">
                {state.settings.courts} Active Courts
              </span>
              <span className="text-xs font-semibold text-amber-400/90 bg-amber-500/10 px-3 py-1 rounded-full border border-amber-500/20">
                Format: {state.settings.format} Pts
              </span>
            </div>

            {/* Title & Season */}
            <div>
              <h1 className="font-display text-3xl sm:text-4xl lg:text-5xl font-black text-white tracking-tight leading-tight">
                <span className="gradient-gold-text">{state.settings.name}</span>
              </h1>
              <p className="mt-2 text-sm sm:text-base text-slate-300 max-w-xl leading-relaxed">
                {state.settings.announcement || 'Official tournament scoreboard, live courts, round-robin standings & playoff brackets.'}
              </p>
            </div>

            {/* Meta details: Date & Venue */}
            <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-xs sm:text-sm text-slate-400">
              <div className="flex items-center gap-1.5">
                <Calendar className="w-4 h-4 text-amber-400" />
                <span>{state.settings.date}</span>
              </div>
              {state.settings.venue && (
                <div className="flex items-center gap-1.5">
                  <MapPin className="w-4 h-4 text-emerald-400" />
                  <span className="truncate max-w-xs">{state.settings.venue}</span>
                </div>
              )}
            </div>

            {/* Tournament Overall Progress Bar */}
            <div className="space-y-2 max-w-md pt-2">
              <div className="flex justify-between text-xs text-slate-400 font-medium">
                <span>Tournament Completion</span>
                <span className="tabular-nums font-bold text-white">
                  {completedMatches} of {totalMatches} Matches ({progressPercent}%)
                </span>
              </div>
              <div className="h-2.5 w-full bg-white/10 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-amber-500 to-amber-300 rounded-full transition-all duration-500"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
            </div>

            {/* Quick CTAs */}
            <div className="flex flex-wrap items-center gap-3 pt-2">
              <button
                onClick={() => onSelectTab('fixtures')}
                className="flex items-center gap-2 px-5 py-2.5 text-sm font-bold text-slate-950 bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 rounded-xl shadow-lg shadow-amber-500/25 active:scale-95 transition-all"
              >
                <Activity className="w-4 h-4" />
                <span>Live Match Centre</span>
              </button>

              <button
                onClick={() => onSelectTab('standings')}
                className="flex items-center gap-2 px-5 py-2.5 text-sm font-semibold text-white bg-white/10 hover:bg-white/15 rounded-xl transition-all border border-white/10"
              >
                <TrendingUp className="w-4 h-4 text-amber-400" />
                <span>View Points Table</span>
              </button>
            </div>
          </div>

          {/* Featured / Live Match Spotlight Card */}
          {featuredMatch && teamA && teamB ? (
            <div className="rounded-2xl glass-card p-5 border border-white/10 relative overflow-hidden shadow-xl">
              <div className="flex items-center justify-between pb-3 border-b border-white/10 text-xs">
                <div className="flex items-center gap-2">
                  <span className={`h-2 w-2 rounded-full ${featuredMatch.status === 'live' ? 'bg-rose-500 animate-ping' : 'bg-amber-400'}`} />
                  <span className="font-bold uppercase tracking-wider text-slate-200">
                    {featuredMatch.status === 'live' ? 'Live Match' : 'Next Featured Match'}
                  </span>
                </div>
                <span className="font-mono text-slate-400">Court {featuredMatch.court}</span>
              </div>

              <div className="py-5 space-y-4">
                {/* Team A */}
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-amber-500/20 to-amber-600/30 text-amber-300 font-bold border border-amber-500/30">
                      {teamA.badge || '🏸'}
                    </span>
                    <div className="min-w-0">
                      <h4 className="font-bold text-base text-white truncate">{teamA.name}</h4>
                      <p className="text-xs text-slate-400 truncate">
                        {teamA.captainId ? `Captain: ${state.players.find((p) => p.id === teamA.captainId)?.name || 'C'}` : 'Doubles Pair'}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="font-mono text-3xl font-black tabular-nums text-white">
                      {featuredMatch.scoreA ?? 0}
                    </span>
                  </div>
                </div>

                {/* Score Controls for Quick Scoring */}
                <div className="flex items-center justify-center gap-2 py-1">
                  <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">VS</span>
                </div>

                {/* Team B */}
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500/20 to-blue-600/30 text-blue-300 font-bold border border-blue-500/30">
                      {teamB.badge || '🏸'}
                    </span>
                    <div className="min-w-0">
                      <h4 className="font-bold text-base text-white truncate">{teamB.name}</h4>
                      <p className="text-xs text-slate-400 truncate">
                        {teamB.captainId ? `Captain: ${state.players.find((p) => p.id === teamB.captainId)?.name || 'C'}` : 'Doubles Pair'}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="font-mono text-3xl font-black tabular-nums text-white">
                      {featuredMatch.scoreB ?? 0}
                    </span>
                  </div>
                </div>
              </div>

              {/* Quick Inline Score Update buttons */}
              <div className="pt-3 border-t border-white/10 flex items-center justify-between gap-2">
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => {
                      const cur = featuredMatch.scoreA || 0;
                      updateMatch(featuredMatch.id, {
                        scoreA: Math.max(0, cur + 1),
                        status: 'live',
                      });
                    }}
                    className="px-2.5 py-1 text-xs font-semibold bg-white/10 hover:bg-white/20 rounded-lg text-slate-200 transition-colors"
                  >
                    +1 {teamA.name.split(' ')[0]}
                  </button>
                  <button
                    onClick={() => {
                      const cur = featuredMatch.scoreB || 0;
                      updateMatch(featuredMatch.id, {
                        scoreB: Math.max(0, cur + 1),
                        status: 'live',
                      });
                    }}
                    className="px-2.5 py-1 text-xs font-semibold bg-white/10 hover:bg-white/20 rounded-lg text-slate-200 transition-colors"
                  >
                    +1 {teamB.name.split(' ')[0]}
                  </button>
                </div>

                <button
                  onClick={() => onSelectTab('fixtures')}
                  className="text-xs font-semibold text-amber-400 hover:text-amber-300 flex items-center gap-1"
                >
                  <span>Scorecard</span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ) : (
            <div className="rounded-2xl glass-card p-8 border border-white/10 text-center flex flex-col items-center justify-center space-y-3">
              <span className="text-5xl">🏆</span>
              <h3 className="font-bold text-white text-lg">Smash Premier League</h3>
              <p className="text-xs text-slate-400 max-w-xs">
                Tournament ready. Generate token teams or match fixtures to begin live scoring.
              </p>
              <button
                onClick={() => onSelectTab('tokens')}
                className="mt-2 px-4 py-2 text-xs font-bold bg-amber-500 text-slate-950 rounded-xl hover:bg-amber-400 transition-colors"
              >
                Launch Token Draw →
              </button>
            </div>
          )}
        </div>
      </section>

      {/* Primary KPI Metrics Grid */}
      <section className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 sm:gap-4">
        {/* Metric 1: Total Players */}
        <div className="rounded-2xl glass-card p-4 space-y-2 border border-white/5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">Total Players</span>
            <Users className="w-4 h-4 text-blue-400" />
          </div>
          <div className="font-mono text-2xl sm:text-3xl font-black text-white tabular-nums">
            {state.players.length}
          </div>
          <div className="text-[11px] text-slate-400">Rostered in league</div>
        </div>

        {/* Metric 2: Total Teams */}
        <div className="rounded-2xl glass-card p-4 space-y-2 border border-white/5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">Total Teams</span>
            <span className="text-base">🛡️</span>
          </div>
          <div className="font-mono text-2xl sm:text-3xl font-black text-white tabular-nums">
            {state.teams.length}
          </div>
          <div className="text-[11px] text-slate-400">Compete for trophy</div>
        </div>

        {/* Metric 3: Matches Played */}
        <div className="rounded-2xl glass-card p-4 space-y-2 border border-white/5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">Matches Played</span>
            <Swords className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="font-mono text-2xl sm:text-3xl font-black text-white tabular-nums">
            {completedMatches}
          </div>
          <div className="text-[11px] text-slate-400">Official results in</div>
        </div>

        {/* Metric 4: Remaining */}
        <div className="rounded-2xl glass-card p-4 space-y-2 border border-white/5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">Remaining</span>
            <Clock className="w-4 h-4 text-amber-400" />
          </div>
          <div className="font-mono text-2xl sm:text-3xl font-black text-white tabular-nums">
            {Math.max(0, totalMatches - completedMatches)}
          </div>
          <div className="text-[11px] text-slate-400">Fixtures to play</div>
        </div>

        {/* Metric 5: Leader Team */}
        <div className="rounded-2xl glass-card p-4 space-y-2 border border-amber-500/20 bg-amber-500/5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-amber-400">Table Leader</span>
            <Trophy className="w-4 h-4 text-amber-400" />
          </div>
          <div className="font-display text-lg sm:text-xl font-bold text-white truncate">
            {leader?.team.name || 'TBD'}
          </div>
          <div className="text-[11px] text-amber-400/90 font-mono tabular-nums">
            {leader ? `${leader.points} pts · +${leader.diff} diff` : 'Awaiting matches'}
          </div>
        </div>

        {/* Metric 6: Champion */}
        <div className="rounded-2xl glass-card p-4 space-y-2 border border-blue-500/20 bg-blue-500/5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-blue-400">Projected Cup</span>
            <Sparkles className="w-4 h-4 text-blue-400" />
          </div>
          <div className="font-display text-lg sm:text-xl font-bold text-white truncate">
            {championTeam?.name || 'TBD'}
          </div>
          <div className="text-[11px] text-blue-400/90">
            {championKnockout ? 'Grand Champion' : 'Points #1 Seed'}
          </div>
        </div>
      </section>

      {/* Registration & Fees Summary Banner */}
      <section className="rounded-3xl glass-card p-5 sm:p-6 border border-white/10 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-lg">🏸</span>
              <h3 className="font-bold text-white text-lg sm:text-xl">
                Player Registration & Fee Ledger
              </h3>
            </div>
            <p className="text-xs sm:text-sm text-slate-400 mt-0.5">
              {regStats.total} / {state.settings.slotLimit} Players Registered · ₹{state.settings.entryFee} Entry Fee
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => onSelectTab('registered')}
              className="text-xs font-semibold text-slate-300 hover:text-white bg-white/5 hover:bg-white/10 px-3.5 py-2 rounded-xl transition-colors border border-white/5"
            >
              View Roster Ledger
            </button>
            <button
              onClick={() => onSelectTab('registration')}
              className="text-xs font-bold text-slate-950 bg-amber-400 hover:bg-amber-300 px-4 py-2 rounded-xl transition-all shadow-md active:scale-95"
            >
              Register a Player →
            </button>
          </div>
        </div>

        {/* Slots filled progress */}
        <div className="space-y-1.5">
          <div className="flex justify-between text-xs text-slate-400">
            <span>Capacity Utilized: {regPercent}%</span>
            <span>{slotsRemaining} Slots Remaining</span>
          </div>
          <div className="h-2 w-full bg-white/10 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-emerald-500 to-emerald-400 rounded-full transition-all duration-300"
              style={{ width: `${regPercent}%` }}
            />
          </div>
        </div>

        {/* 4 Financial Sub-KPIs */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 pt-2">
          <div className="rounded-xl bg-white/5 p-3">
            <span className="text-xs text-slate-400 block">Total Registered</span>
            <span className="font-mono text-xl font-bold text-white tabular-nums">{regStats.total}</span>
          </div>
          <div className="rounded-xl bg-emerald-500/10 border border-emerald-500/20 p-3">
            <span className="text-xs text-emerald-400 block">Fees Collected</span>
            <span className="font-mono text-xl font-bold text-emerald-300 tabular-nums">
              {formatINR(regStats.collected)}
            </span>
          </div>
          <div className="rounded-xl bg-amber-500/10 border border-amber-500/20 p-3">
            <span className="text-xs text-amber-400 block">Pending Payments</span>
            <span className="font-mono text-xl font-bold text-amber-300 tabular-nums">
              {regStats.pendingCount} ({formatINR(regStats.pendingAmount)})
            </span>
          </div>
          <div className="rounded-xl bg-blue-500/10 border border-blue-500/20 p-3">
            <span className="text-xs text-blue-400 block">Open Slots</span>
            <span className="font-mono text-xl font-bold text-blue-300 tabular-nums">{slotsRemaining}</span>
          </div>
        </div>
      </section>

      {/* Two Column Layout: Standings Preview + Recent Results */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column (7 cols): Standings Preview */}
        <div className="lg:col-span-7 rounded-3xl glass-panel p-5 sm:p-6 border border-white/10 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-lg">📊</span>
              <h3 className="font-bold text-white text-lg">Points Table Snapshot</h3>
            </div>
            <button
              onClick={() => onSelectTab('standings')}
              className="text-xs font-semibold text-amber-400 hover:text-amber-300 flex items-center gap-1"
            >
              <span>Full Standings</span>
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-white/10 text-[11px] uppercase tracking-wider text-slate-400">
                  <th className="pb-3 pl-2 w-10">#</th>
                  <th className="pb-3">Team</th>
                  <th className="pb-3 text-center">P</th>
                  <th className="pb-3 text-center">W</th>
                  <th className="pb-3 text-center">L</th>
                  <th className="pb-3 text-center">Diff</th>
                  <th className="pb-3 text-right pr-2">Pts</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {standings.slice(0, 4).map((row, idx) => {
                  const medalColors = ['text-amber-400', 'text-slate-300', 'text-amber-600'];
                  return (
                    <tr
                      key={row.team.id}
                      onClick={() => onSelectTab('standings')}
                      className="hover:bg-white/5 cursor-pointer transition-colors"
                    >
                      <td className="py-3 pl-2 font-mono font-bold">
                        <span className={medalColors[idx] || 'text-slate-400'}>
                          {idx + 1}
                        </span>
                      </td>
                      <td className="py-3 font-semibold text-white">
                        <div className="flex items-center gap-2">
                          <span>{row.team.badge || '🏸'}</span>
                          <span className="truncate max-w-[140px] sm:max-w-[200px]">{row.team.name}</span>
                        </div>
                      </td>
                      <td className="py-3 text-center font-mono tabular-nums text-slate-300">{row.played}</td>
                      <td className="py-3 text-center font-mono tabular-nums text-emerald-400">{row.won}</td>
                      <td className="py-3 text-center font-mono tabular-nums text-slate-400">{row.lost}</td>
                      <td className="py-3 text-center font-mono tabular-nums text-slate-300">
                        {row.diff > 0 ? `+${row.diff}` : row.diff}
                      </td>
                      <td className="py-3 text-right pr-2 font-mono font-black text-amber-400 text-base tabular-nums">
                        {row.points}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="text-[11px] text-slate-400 pt-1 flex items-center justify-between">
            <span>Win = 2 Pts · Tiebreakers: Pts, Wins, Score Diff</span>
            <span className="text-amber-400 font-medium">Top 4 qualify for playoffs</span>
          </div>
        </div>

        {/* Right Column (5 cols): Recent Results & Next Fixtures */}
        <div className="lg:col-span-5 rounded-3xl glass-panel p-5 sm:p-6 border border-white/10 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-lg">⚔️</span>
              <h3 className="font-bold text-white text-lg">Recent Match Results</h3>
            </div>
            <button
              onClick={() => onSelectTab('fixtures')}
              className="text-xs font-semibold text-amber-400 hover:text-amber-300 flex items-center gap-1"
            >
              <span>Match Centre</span>
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          <div className="space-y-3">
            {recentCompleted.length > 0 ? (
              recentCompleted.map((match) => {
                const tA = state.teams.find((t) => t.id === match.teamA);
                const tB = state.teams.find((t) => t.id === match.teamB);
                const isAWinner = match.winner === match.teamA;
                const isBWinner = match.winner === match.teamB;

                return (
                  <div
                    key={match.id}
                    onClick={() => onSelectTab('fixtures')}
                    className="rounded-2xl glass-card p-3.5 border border-white/5 hover:border-white/15 transition-all cursor-pointer space-y-2"
                  >
                    <div className="flex items-center justify-between text-[11px] text-slate-400">
                      <span>Court {match.court} · Round {match.round}</span>
                      <span className="text-emerald-400 font-semibold">Completed</span>
                    </div>

                    <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
                      <div className={`text-left truncate ${isAWinner ? 'font-bold text-white' : 'text-slate-400'}`}>
                        {tA?.name || 'Team A'}
                      </div>
                      <div className="font-mono text-sm font-black px-2.5 py-1 rounded-lg bg-black/40 tabular-nums">
                        <span className={isAWinner ? 'text-amber-400' : 'text-slate-400'}>{match.scoreA}</span>
                        <span className="text-slate-400 mx-1.5">-</span>
                        <span className={isBWinner ? 'text-amber-400' : 'text-slate-400'}>{match.scoreB}</span>
                      </div>
                      <div className={`text-right truncate ${isBWinner ? 'font-bold text-white' : 'text-slate-400'}`}>
                        {tB?.name || 'Team B'}
                      </div>
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="p-8 text-center text-slate-400 text-xs">
                No completed matches yet.
              </div>
            )}
          </div>

          {/* Quick Match Centre link */}
          <button
            onClick={() => onSelectTab('fixtures')}
            className="w-full py-2.5 text-xs font-semibold text-slate-300 hover:text-white bg-white/5 hover:bg-white/10 rounded-xl transition-colors text-center block"
          >
            Open Live Scorecard & Fixtures Schedule →
          </button>
        </div>
      </section>

      {/* Feature Navigation Cards (from original reference app) */}
      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3.5 sm:gap-4">
        {[
          {
            tab: 'registration' as NavTab,
            title: 'Player Registration',
            desc: 'Register players & collect entry fees',
            icon: '🏸',
            color: 'from-amber-500/20 to-orange-500/20',
          },
          {
            tab: 'registered' as NavTab,
            title: 'Registered Roster',
            desc: 'Payment tracking, CSV export & records',
            icon: '📋',
            color: 'from-emerald-500/20 to-teal-500/20',
          },
          {
            tab: 'tokens' as NavTab,
            title: 'Token Generator',
            desc: 'Live lottery-style team draw & pairs',
            icon: '🎲',
            color: 'from-blue-500/20 to-indigo-500/20',
          },
          {
            tab: 'fixtures' as NavTab,
            title: 'Match Centre',
            desc: 'Courts schedule, live scores & sets',
            icon: '⚔️',
            color: 'from-purple-500/20 to-pink-500/20',
          },
          {
            tab: 'knockout' as NavTab,
            title: 'Knockout Stage',
            desc: 'Eliminators, Semi-Finals & Grand Final',
            icon: '🏆',
            color: 'from-rose-500/20 to-amber-500/20',
          },
        ].map((item) => (
          <button
            key={item.tab}
            onClick={() => onSelectTab(item.tab)}
            className="text-left rounded-2xl glass-card p-4 sm:p-5 border border-white/5 hover:border-white/20 transition-all hover:-translate-y-1 group relative overflow-hidden"
          >
            <div className="flex items-center justify-between mb-3">
              <span className="text-2xl">{item.icon}</span>
              <ArrowRight className="w-4 h-4 text-slate-400 group-hover:text-amber-400 group-hover:translate-x-1 transition-all" />
            </div>
            <h4 className="font-bold text-white text-base group-hover:text-amber-400 transition-colors">
              {item.title}
            </h4>
            <p className="mt-1 text-xs text-slate-400 leading-relaxed">
              {item.desc}
            </p>
          </button>
        ))}
      </section>
    </div>
  );
};
