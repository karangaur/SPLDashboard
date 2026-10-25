import React, { useState } from 'react';
import {
  Trophy,
  Share2,
  Copy,
  TrendingUp,
  Award,
  HelpCircle,
  CheckCircle2,
  XCircle,
} from 'lucide-react';
import { useTournament } from '../../context/TournamentContext';

export const StandingsView: React.FC = () => {
  const { state, standings } = useTournament();
  const [copied, setCopied] = useState(false);

  const formatStandingText = () => {
    const lines = [
      `📊 ${state.settings.name} — Official Points Table`,
      `Date: ${state.settings.date} · Venue: ${state.settings.venue}`,
      '----------------------------------------',
      '# | Team | P | W | L | Diff | Pts',
    ];

    standings.forEach((row, idx) => {
      lines.push(
        `${idx + 1}. ${row.team.name} | P:${row.played} W:${row.won} L:${row.lost} Diff:${row.diff > 0 ? `+${row.diff}` : row.diff} | Pts:${row.points}`
      );
    });

    lines.push('----------------------------------------');
    lines.push('🏆 Top 4 qualify for the Knockout Championship Stage');
    return lines.join('\n');
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(formatStandingText());
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {}
  };

  const handleWhatsApp = () => {
    const url = `https://wa.me/?text=${encodeURIComponent(formatStandingText())}`;
    window.open(url, '_blank');
  };

  const medalTrophy = (idx: number) => {
    if (idx === 0) return <span className="text-amber-400 font-bold text-lg">🥇</span>;
    if (idx === 1) return <span className="text-slate-300 font-bold text-lg">🥈</span>;
    if (idx === 2) return <span className="text-amber-700 font-bold text-lg">🥉</span>;
    return <span className="font-mono text-slate-400 font-bold">{idx + 1}</span>;
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Top Title & Share Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-500/20 text-amber-400 font-bold text-xl">
              📊
            </span>
            <h1 className="font-display text-2xl sm:text-3xl font-black text-white">
              Official League Standings
            </h1>
          </div>
          <p className="mt-1 text-xs sm:text-sm text-slate-400">
            Real-time points table. Every completed league and playoff match automatically updates points and differential.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleCopy}
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-200 hover:text-white bg-white/10 hover:bg-white/15 rounded-xl transition-colors border border-white/10"
          >
            <Copy className="w-4 h-4 text-amber-400" />
            <span>{copied ? 'Copied!' : 'Copy Table'}</span>
          </button>

          <button
            onClick={handleWhatsApp}
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-emerald-400 bg-emerald-500/10 hover:bg-emerald-500/20 rounded-xl transition-colors border border-emerald-500/20"
          >
            <Share2 className="w-4 h-4" />
            <span>WhatsApp</span>
          </button>
        </div>
      </div>

      {/* Standings Table Container */}
      {standings.length > 0 ? (
        <div className="rounded-3xl glass-panel border border-white/10 overflow-hidden shadow-2xl">
          {/* Desktop Table View */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-white/10 bg-white/[0.02] text-[11px] uppercase tracking-wider text-slate-400">
                  <th className="py-4 pl-6 w-16">Rank</th>
                  <th className="py-4">Team</th>
                  <th className="py-4 text-center w-16">Played</th>
                  <th className="py-4 text-center w-16">Won</th>
                  <th className="py-4 text-center w-16">Lost</th>
                  <th className="py-4 text-center w-20">PF</th>
                  <th className="py-4 text-center w-20">PA</th>
                  <th className="py-4 text-center w-24">Diff</th>
                  <th className="py-4 text-center w-28">Recent Form</th>
                  <th className="py-4 text-right pr-6 w-20">Points</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {standings.map((row, idx) => {
                  const isTop4 = idx < 4;
                  const isCutoff = idx === 3;
                  const isLeader = idx === 0;

                  return (
                    <React.Fragment key={row.team.id}>
                      <tr
                        className={`transition-colors hover:bg-white/5 ${
                          isLeader
                            ? 'bg-amber-500/[0.04]'
                            : isTop4
                            ? 'bg-blue-500/[0.02]'
                            : ''
                        }`}
                      >
                        {/* Rank */}
                        <td className="py-4 pl-6">
                          <div className="flex items-center gap-2">
                            {medalTrophy(idx)}
                          </div>
                        </td>

                        {/* Team Info */}
                        <td className="py-4 font-semibold text-white">
                          <div className="flex items-center gap-3">
                            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white/5 border border-white/10 text-lg">
                              {row.team.badge || '🏸'}
                            </span>
                            <div>
                              <div className="font-bold text-base text-white flex items-center gap-1.5">
                                <span>{row.team.name}</span>
                                {isLeader && (
                                  <span className="text-[10px] uppercase font-bold text-amber-400 bg-amber-400/10 px-1.5 py-0.5 rounded-full border border-amber-400/20">
                                    Leader
                                  </span>
                                )}
                              </div>
                              <div className="text-xs text-slate-400">
                                {row.team.players.length} Players
                              </div>
                            </div>
                          </div>
                        </td>

                        {/* Played */}
                        <td className="py-4 text-center font-mono tabular-nums text-slate-300 font-medium">
                          {row.played}
                        </td>

                        {/* Won */}
                        <td className="py-4 text-center font-mono tabular-nums text-emerald-400 font-bold">
                          {row.won}
                        </td>

                        {/* Lost */}
                        <td className="py-4 text-center font-mono tabular-nums text-rose-400/80 font-medium">
                          {row.lost}
                        </td>

                        {/* Points For */}
                        <td className="py-4 text-center font-mono tabular-nums text-slate-300">
                          {row.pointsFor}
                        </td>

                        {/* Points Against */}
                        <td className="py-4 text-center font-mono tabular-nums text-slate-400">
                          {row.pointsAgainst}
                        </td>

                        {/* Net Differential */}
                        <td className="py-4 text-center font-mono tabular-nums font-semibold">
                          <span
                            className={
                              row.diff > 0
                                ? 'text-emerald-400'
                                : row.diff < 0
                                ? 'text-rose-400'
                                : 'text-slate-400'
                            }
                          >
                            {row.diff > 0 ? `+${row.diff}` : row.diff}
                          </span>
                        </td>

                        {/* Form */}
                        <td className="py-4 text-center">
                          <div className="flex items-center justify-center gap-1">
                            {row.form.length > 0 ? (
                              row.form.map((f, fIdx) => (
                                <span
                                  key={fIdx}
                                  className={`w-5 h-5 rounded-md flex items-center justify-center text-[10px] font-bold text-white ${
                                    f === 'W'
                                      ? 'bg-emerald-500'
                                      : 'bg-rose-500'
                                  }`}
                                  title={f === 'W' ? 'Won' : 'Lost'}
                                >
                                  {f}
                                </span>
                              ))
                            ) : (
                              <span className="text-xs text-slate-500">—</span>
                            )}
                          </div>
                        </td>

                        {/* Total Points */}
                        <td className="py-4 text-right pr-6 font-mono text-xl font-black text-amber-400 tabular-nums">
                          {row.points}
                        </td>
                      </tr>

                      {/* Playoff qualification boundary line after #4 */}
                      {isCutoff && standings.length > 4 && (
                        <tr className="border-b-2 border-dashed border-amber-500/40 bg-amber-500/[0.03]">
                          <td colSpan={10} className="py-1 px-6 text-center text-[11px] font-bold uppercase tracking-wider text-amber-400">
                            ▲ Top 4 Playoff & Knockout Championship Qualification Line ▲
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Mobile Card-Based Standings Presentation */}
          <div className="md:hidden divide-y divide-white/5">
            {standings.map((row, idx) => {
              const isTop4 = idx < 4;
              return (
                <div
                  key={row.team.id}
                  className={`p-4 space-y-3 ${
                    idx === 0
                      ? 'bg-amber-500/5'
                      : isTop4
                      ? 'bg-blue-500/[0.02]'
                      : ''
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <div className="flex items-center justify-center w-7 h-7 rounded-lg bg-white/5 font-mono text-sm font-bold">
                        {idx + 1}
                      </div>
                      <span className="text-xl">{row.team.badge || '🏸'}</span>
                      <div>
                        <h4 className="font-bold text-white text-base leading-tight">
                          {row.team.name}
                        </h4>
                        <div className="text-[11px] text-slate-400">
                          {idx === 0 ? 'Tournament Leader' : isTop4 ? 'Playoff Zone' : 'Challenger'}
                        </div>
                      </div>
                    </div>

                    <div className="text-right">
                      <div className="font-mono text-2xl font-black text-amber-400 tabular-nums">
                        {row.points} <span className="text-xs font-normal text-slate-400">pts</span>
                      </div>
                    </div>
                  </div>

                  {/* Mobile Stats Row */}
                  <div className="grid grid-cols-4 gap-2 text-center bg-black/30 rounded-xl p-2.5 text-xs font-mono">
                    <div>
                      <span className="block text-[10px] text-slate-400 uppercase">P</span>
                      <span className="font-bold text-white">{row.played}</span>
                    </div>
                    <div>
                      <span className="block text-[10px] text-slate-400 uppercase">W</span>
                      <span className="font-bold text-emerald-400">{row.won}</span>
                    </div>
                    <div>
                      <span className="block text-[10px] text-slate-400 uppercase">L</span>
                      <span className="font-bold text-rose-400">{row.lost}</span>
                    </div>
                    <div>
                      <span className="block text-[10px] text-slate-400 uppercase">Diff</span>
                      <span
                        className={`font-bold ${
                          row.diff > 0
                            ? 'text-emerald-400'
                            : row.diff < 0
                            ? 'text-rose-400'
                            : 'text-slate-400'
                        }`}
                      >
                        {row.diff > 0 ? `+${row.diff}` : row.diff}
                      </span>
                    </div>
                  </div>

                  {/* Form */}
                  <div className="flex items-center justify-between text-xs text-slate-400 pt-1">
                    <span>Recent Form:</span>
                    <div className="flex items-center gap-1">
                      {row.form.length > 0 ? (
                        row.form.map((f, fIdx) => (
                          <span
                            key={fIdx}
                            className={`w-4 h-4 rounded text-[9px] font-bold text-white flex items-center justify-center ${
                              f === 'W' ? 'bg-emerald-500' : 'bg-rose-500'
                            }`}
                          >
                            {f}
                          </span>
                        ))
                      ) : (
                        <span>—</span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Footer Rule Explanations */}
          <div className="border-t border-white/10 bg-white/[0.01] p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-slate-400">
            <div className="flex items-center gap-2">
              <HelpCircle className="w-4 h-4 text-amber-400 shrink-0" />
              <span>
                Scoring Rule: 2 Pts per Win, 0 Pts per Loss. Point Diff is points scored minus points conceded.
              </span>
            </div>
            <div className="flex items-center gap-1.5 font-semibold text-amber-400">
              <Award className="w-4 h-4" />
              <span>Top 4 Teams Qualify for Knockout Championship</span>
            </div>
          </div>
        </div>
      ) : (
        <div className="rounded-3xl glass-card p-12 text-center border border-dashed border-white/10 space-y-3">
          <span className="text-5xl">🏆</span>
          <h3 className="text-lg font-bold text-white">No Standings Available</h3>
          <p className="text-xs text-slate-400 max-w-sm mx-auto">
            Once teams are registered and matches are played, the live points table and run rate will automatically calculate here.
          </p>
        </div>
      )}
    </div>
  );
};
