import React from 'react';
import {
  BarChart3,
  TrendingUp,
  Award,
  Zap,
  Target,
  Users,
  Shield,
  Activity,
} from 'lucide-react';
import { useTournament } from '../../context/TournamentContext';

export const StatisticsView: React.FC = () => {
  const { state, standings } = useTournament();

  const completedMatches = state.matches.filter((m) => m.status === 'completed');
  const totalPointsScored = completedMatches.reduce(
    (sum, m) => sum + (m.scoreA || 0) + (m.scoreB || 0),
    0
  );
  const avgPointsPerMatch =
    completedMatches.length > 0 ? (totalPointsScored / completedMatches.length).toFixed(1) : '0';

  // Court distribution
  const court1Matches = state.matches.filter((m) => m.court === 1).length;
  const court2Matches = state.matches.filter((m) => m.court === 2).length;

  // Best offense (most points scored)
  const topOffense = [...standings].sort((a, b) => b.pointsFor - a.pointsFor);

  // Best defense (least points conceded)
  const topDefense = [...standings]
    .filter((s) => s.played > 0)
    .sort((a, b) => a.pointsAgainst - b.pointsAgainst);

  // Win percentage leaderboard
  const topWinRate = [...standings]
    .filter((s) => s.played > 0)
    .sort((a, b) => b.won / b.played - a.won / a.played);

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2.5">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-500/20 text-blue-400 font-bold text-xl">
            📊
          </span>
          <h1 className="font-display text-2xl sm:text-3xl font-black text-white">
            Tournament Statistics & Analytics
          </h1>
        </div>
        <p className="mt-1 text-xs sm:text-sm text-slate-400">
          Comprehensive performance breakdown for {state.settings.name}.
        </p>
      </div>

      {/* Aggregate Metrics Strip */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="rounded-2xl glass-card p-5 border border-white/5 space-y-1">
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-400 block">
            Total Points Scored
          </span>
          <div className="font-mono text-3xl font-black text-white tabular-nums">
            {totalPointsScored}
          </div>
          <span className="text-[11px] text-slate-400">Across all completed sets</span>
        </div>

        <div className="rounded-2xl glass-card p-5 border border-white/5 space-y-1">
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-400 block">
            Avg Points / Match
          </span>
          <div className="font-mono text-3xl font-black text-amber-400 tabular-nums">
            {avgPointsPerMatch}
          </div>
          <span className="text-[11px] text-slate-400">Target game cap: {state.settings.format}</span>
        </div>

        <div className="rounded-2xl glass-card p-5 border border-white/5 space-y-1">
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-400 block">
            Courts Utilization
          </span>
          <div className="font-mono text-xl font-bold text-white tabular-nums pt-1">
            C1: {court1Matches} · C2: {court2Matches}
          </div>
          <span className="text-[11px] text-slate-400">Balanced load scheduling</span>
        </div>

        <div className="rounded-2xl glass-card p-5 border border-white/5 space-y-1">
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-400 block">
            Player Pool
          </span>
          <div className="font-mono text-3xl font-black text-blue-400 tabular-nums">
            {state.players.length}
          </div>
          <span className="text-[11px] text-slate-400">{state.teams.length} distinct teams</span>
        </div>
      </div>

      {/* Leaderboard Rankings Columns */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Top Scoring Teams (Offense) */}
        <div className="rounded-3xl glass-panel p-5 sm:p-6 border border-white/10 space-y-4">
          <div className="flex items-center gap-2 pb-2 border-b border-white/10">
            <Zap className="w-5 h-5 text-amber-400" />
            <h3 className="font-bold text-white text-base">Top Scoring Teams</h3>
          </div>

          <div className="space-y-3">
            {topOffense.slice(0, 5).map((row, idx) => (
              <div
                key={row.team.id}
                className="flex items-center justify-between p-3 rounded-xl bg-white/5"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <span className="font-mono font-bold text-xs text-slate-400 w-4">
                    {idx + 1}
                  </span>
                  <span className="text-lg">{row.team.badge || '🏸'}</span>
                  <span className="font-bold text-sm text-white truncate max-w-[140px]">
                    {row.team.name}
                  </span>
                </div>
                <div className="text-right">
                  <span className="font-mono font-black text-sm text-amber-400 tabular-nums">
                    {row.pointsFor}
                  </span>
                  <span className="text-[10px] text-slate-400 block">points</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Best Defense */}
        <div className="rounded-3xl glass-panel p-5 sm:p-6 border border-white/10 space-y-4">
          <div className="flex items-center gap-2 pb-2 border-b border-white/10">
            <Shield className="w-5 h-5 text-emerald-400" />
            <h3 className="font-bold text-white text-base">Least Points Conceded</h3>
          </div>

          <div className="space-y-3">
            {topDefense.slice(0, 5).map((row, idx) => (
              <div
                key={row.team.id}
                className="flex items-center justify-between p-3 rounded-xl bg-white/5"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <span className="font-mono font-bold text-xs text-slate-400 w-4">
                    {idx + 1}
                  </span>
                  <span className="text-lg">{row.team.badge || '🏸'}</span>
                  <span className="font-bold text-sm text-white truncate max-w-[140px]">
                    {row.team.name}
                  </span>
                </div>
                <div className="text-right">
                  <span className="font-mono font-black text-sm text-emerald-400 tabular-nums">
                    {row.pointsAgainst}
                  </span>
                  <span className="text-[10px] text-slate-400 block">conceded</span>
                </div>
              </div>
            ))}
            {topDefense.length === 0 && (
              <div className="p-6 text-center text-xs text-slate-500 italic">
                Awaiting completed matches.
              </div>
            )}
          </div>
        </div>

        {/* Highest Win Rate */}
        <div className="rounded-3xl glass-panel p-5 sm:p-6 border border-white/10 space-y-4">
          <div className="flex items-center gap-2 pb-2 border-b border-white/10">
            <Target className="w-5 h-5 text-blue-400" />
            <h3 className="font-bold text-white text-base">Win Efficiency</h3>
          </div>

          <div className="space-y-3">
            {topWinRate.slice(0, 5).map((row, idx) => {
              const winPct = row.played > 0 ? Math.round((row.won / row.played) * 100) : 0;
              return (
                <div
                  key={row.team.id}
                  className="flex items-center justify-between p-3 rounded-xl bg-white/5"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span className="font-mono font-bold text-xs text-slate-400 w-4">
                      {idx + 1}
                    </span>
                    <span className="text-lg">{row.team.badge || '🏸'}</span>
                    <span className="font-bold text-sm text-white truncate max-w-[140px]">
                      {row.team.name}
                    </span>
                  </div>
                  <div className="text-right">
                    <span className="font-mono font-black text-sm text-blue-400 tabular-nums">
                      {winPct}%
                    </span>
                    <span className="text-[10px] text-slate-400 block">
                      {row.won}W / {row.lost}L
                    </span>
                  </div>
                </div>
              );
            })}
            {topWinRate.length === 0 && (
              <div className="p-6 text-center text-xs text-slate-500 italic">
                Awaiting completed matches.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
