import React, { useState, useEffect } from 'react';
import {
  Activity,
  Play,
  Trophy,
  ArrowRight,
  Sparkles,
  Flame,
  CheckCircle2,
  Clock,
  ChevronRight,
  Maximize2,
} from 'lucide-react';
import { Match, Team, Player } from '../../types/tournament';

interface LiveMatchHeroProps {
  matches: Match[];
  teams: Team[];
  players: Player[];
  onOpenMatchModal?: (match: Match) => void;
  onGoToFixtures?: () => void;
}

export const LiveMatchHero: React.FC<LiveMatchHeroProps> = ({
  matches,
  teams,
  players,
  onOpenMatchModal,
  onGoToFixtures,
}) => {
  // Find live matches
  const liveMatches = matches.filter((m) => m.status === 'live');
  const upcomingMatches = matches.filter((m) => m.status === 'upcoming');
  const completedMatches = matches.filter((m) => m.status === 'completed');

  // Active match to display: live match or first upcoming or last completed
  const [selectedMatchId, setSelectedMatchId] = useState<string | null>(null);

  const activeMatch =
    (selectedMatchId && matches.find((m) => m.id === selectedMatchId)) ||
    liveMatches[0] ||
    upcomingMatches[0] ||
    completedMatches[completedMatches.length - 1] ||
    null;

  // Helper getters
  const getTeam = (id?: string) => teams.find((t) => t.id === id);
  const getPlayer = (id?: string) => players.find((p) => p.id === id);

  const teamA = getTeam(activeMatch?.teamA);
  const teamB = getTeam(activeMatch?.teamB);

  const teamAPlayers = teamA?.players?.map(getPlayer).filter(Boolean) as Player[] || [];
  const teamBPlayers = teamB?.players?.map(getPlayer).filter(Boolean) as Player[] || [];

  const scoreA = activeMatch?.scoreA ?? 0;
  const scoreB = activeMatch?.scoreB ?? 0;
  const isLive = activeMatch?.status === 'live';
  const isCompleted = activeMatch?.status === 'completed';

  // Lead status calculation
  let leadText = 'Scores Level (0 - 0)';
  if (scoreA > scoreB) {
    leadText = `${teamA?.name || 'Team A'} leads by ${scoreA - scoreB}`;
  } else if (scoreB > scoreA) {
    leadText = `${teamB?.name || 'Team B'} leads by ${scoreB - scoreA}`;
  } else if (scoreA > 0 && scoreA === scoreB) {
    leadText = `Scores tied at ${scoreA} — All`;
  }

  // Badminton match point / game point indicator
  const targetScore = 21;
  const isGamePointA = scoreA >= targetScore - 1 && scoreA > scoreB;
  const isGamePointB = scoreB >= targetScore - 1 && scoreB > scoreA;
  const isDeuce = scoreA >= 20 && scoreB >= 20 && scoreA === scoreB;

  return (
    <section id="live-match" className="relative scroll-mt-24">
      {/* Background Glow */}
      <div className="absolute inset-0 bg-gradient-to-r from-rose-500/10 via-amber-500/5 to-lime-500/10 rounded-3xl blur-2xl pointer-events-none" />

      <div className="relative rounded-3xl border border-white/15 bg-gradient-to-b from-[#0a0e1c] via-[#070a14] to-[#04060d] p-5 sm:p-8 shadow-2xl overflow-hidden">
        
        {/* Subtle Badminton Court Line Watermark */}
        <div className="absolute right-0 top-0 bottom-0 w-1/2 opacity-10 pointer-events-none overflow-hidden">
          <svg className="w-full h-full text-white" viewBox="0 0 400 300" fill="none" stroke="currentColor">
            <rect x="20" y="20" width="360" height="260" strokeWidth="2" />
            <line x1="200" y1="20" x2="200" y2="280" strokeWidth="3" strokeDasharray="6 4" />
            <line x1="120" y1="20" x2="120" y2="280" strokeWidth="1" />
            <line x1="280" y1="20" x2="280" y2="280" strokeWidth="1" />
            <line x1="20" y1="150" x2="380" y2="150" strokeWidth="1" />
          </svg>
        </div>

        {/* Section Top Bar: Status Badges & Court Selector */}
        <div className="flex flex-wrap items-center justify-between gap-3 pb-6 border-b border-white/10">
          <div className="flex items-center gap-3">
            {isLive ? (
              <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-rose-500/20 border border-rose-500/40 text-rose-300 text-xs font-black uppercase tracking-wider shadow-lg shadow-rose-500/20">
                <span className="relative flex h-2.5 w-2.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-rose-500" />
                </span>
                <span>🔴 LIVE COURT {String(activeMatch?.court || 1).padStart(2, '0')}</span>
              </div>
            ) : isCompleted ? (
              <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 text-xs font-black uppercase tracking-wider">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                <span>FINAL RESULT · COURT {String(activeMatch?.court || 1).padStart(2, '0')}</span>
              </div>
            ) : (
              <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/20 border border-amber-500/40 text-amber-300 text-xs font-black uppercase tracking-wider">
                <Clock className="w-3.5 h-3.5 text-amber-400" />
                <span>NEXT ON COURT {String(activeMatch?.court || 1).padStart(2, '0')}</span>
              </div>
            )}

            <span className="text-xs text-slate-400 font-mono hidden sm:inline">
              Round {activeMatch?.round || 1} · Badminton 21-pt Rally Format
            </span>
          </div>

          {/* If there are multiple live/upcoming matches, show quick court switchers */}
          {matches.length > 1 && (
            <div className="flex items-center gap-1.5 overflow-x-auto py-1">
              {matches.slice(0, 4).map((m, idx) => {
                const tA = getTeam(m.teamA);
                const tB = getTeam(m.teamB);
                const isSelected = activeMatch?.id === m.id;
                return (
                  <button
                    key={m.id}
                    onClick={() => setSelectedMatchId(m.id)}
                    className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all whitespace-nowrap flex items-center gap-1.5 ${
                      isSelected
                        ? 'bg-lime-400 text-slate-950 shadow-md'
                        : 'bg-white/5 hover:bg-white/10 text-slate-300 border border-white/5'
                    }`}
                  >
                    {m.status === 'live' && (
                      <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse" />
                    )}
                    <span>
                      C{m.court}: {tA?.name?.slice(0, 8) || 'A'} v {tB?.name?.slice(0, 8) || 'B'}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Main Live Scoreboard Grid */}
        <div className="py-6 sm:py-8">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
            
            {/* Team A Card */}
            <div className="lg:col-span-5 flex items-center justify-between lg:justify-start gap-4 p-4 sm:p-5 rounded-2xl bg-white/[0.03] border border-white/10 hover:border-lime-400/30 transition-all">
              <div className="flex items-center gap-3 min-w-0">
                <div className="relative flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-tr from-amber-500 to-amber-400 text-slate-950 font-black text-2xl shadow-lg shadow-amber-500/20">
                  <span>{teamA?.badge || '🏸'}</span>
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="text-lg sm:text-xl font-black text-white font-display truncate">
                      {teamA?.name || 'Team Alpha'}
                    </h3>
                    {activeMatch?.winner === activeMatch?.teamA && (
                      <span className="px-2 py-0.5 rounded text-[10px] font-black uppercase bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                        Winner
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-slate-400 mt-1 truncate">
                    {teamAPlayers.length > 0
                      ? teamAPlayers.map((p) => p.name).join(' & ')
                      : 'Doubles Pair'}
                  </div>
                  {isGamePointA && (
                    <span className="inline-block mt-1 px-2 py-0.5 text-[10px] font-bold text-amber-300 bg-amber-500/20 rounded">
                      🔥 GAME POINT
                    </span>
                  )}
                </div>
              </div>

              {/* Large Score Digit */}
              <div className="text-right">
                <div
                  className={`text-4xl sm:text-5xl lg:text-6xl font-black font-mono tracking-tight ${
                    scoreA > scoreB ? 'text-lime-400 drop-shadow-[0_0_15px_rgba(163,230,53,0.4)]' : 'text-white'
                  }`}
                >
                  {scoreA}
                </div>
                <span className="text-[10px] uppercase font-bold text-slate-400">Points</span>
              </div>
            </div>

            {/* Middle Match Broadcast Status & VS Divider */}
            <div className="lg:col-span-2 flex flex-col items-center justify-center text-center space-y-2 py-2">
              <div className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-white/5 border border-white/10 text-slate-400 font-black text-xs font-mono">
                VS
              </div>
              <div className="space-y-0.5">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-300 block">
                  {isDeuce ? '⚡ DEUCE (20-ALL)' : isLive ? 'SET 01' : isCompleted ? 'FINAL' : 'UPCOMING'}
                </span>
                <span className="text-[10px] text-lime-400 font-medium block">
                  {leadText}
                </span>
              </div>

              {/* Badminton Shuttlecock Icon in motion */}
              <div className="flex items-center gap-1.5 text-xs text-slate-400 pt-1">
                <span className="text-base animate-bounce">🏸</span>
                <span className="text-[11px] font-mono">Court {activeMatch?.court || 1}</span>
              </div>
            </div>

            {/* Team B Card */}
            <div className="lg:col-span-5 flex items-center justify-between lg:justify-end gap-4 p-4 sm:p-5 rounded-2xl bg-white/[0.03] border border-white/10 hover:border-lime-400/30 transition-all">
              {/* Score Digit (Left on desktop for symmetry) */}
              <div className="text-left order-2 lg:order-1">
                <div
                  className={`text-4xl sm:text-5xl lg:text-6xl font-black font-mono tracking-tight ${
                    scoreB > scoreA ? 'text-lime-400 drop-shadow-[0_0_15px_rgba(163,230,53,0.4)]' : 'text-white'
                  }`}
                >
                  {scoreB}
                </div>
                <span className="text-[10px] uppercase font-bold text-slate-400">Points</span>
              </div>

              <div className="flex items-center gap-3 min-w-0 order-1 lg:order-2 text-left lg:text-right">
                <div className="min-w-0">
                  <div className="flex items-center justify-start lg:justify-end gap-2">
                    {activeMatch?.winner === activeMatch?.teamB && (
                      <span className="px-2 py-0.5 rounded text-[10px] font-black uppercase bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                        Winner
                      </span>
                    )}
                    <h3 className="text-lg sm:text-xl font-black text-white font-display truncate">
                      {teamB?.name || 'Team Beta'}
                    </h3>
                  </div>
                  <div className="text-xs text-slate-400 mt-1 truncate">
                    {teamBPlayers.length > 0
                      ? teamBPlayers.map((p) => p.name).join(' & ')
                      : 'Doubles Pair'}
                  </div>
                  {isGamePointB && (
                    <span className="inline-block mt-1 px-2 py-0.5 text-[10px] font-bold text-amber-300 bg-amber-500/20 rounded">
                      🔥 GAME POINT
                    </span>
                  )}
                </div>

                <div className="relative flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-tr from-cyan-500 to-blue-500 text-white font-black text-2xl shadow-lg shadow-cyan-500/20">
                  <span>{teamB?.badge || '🏸'}</span>
                </div>
              </div>
            </div>

          </div>
        </div>

        {/* Footer Actions Strip: Match Controls & Details */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-5 border-t border-white/10">
          <div className="flex items-center gap-2 text-xs text-slate-400">
            <span className="w-2 h-2 rounded-full bg-emerald-400" />
            <span>Maharajganj Indoor Stadium · Official Referee Monitored</span>
          </div>

          <div className="flex items-center gap-3 w-full sm:w-auto">
            {activeMatch && onOpenMatchModal && (
              <button
                onClick={() => onOpenMatchModal(activeMatch)}
                className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold text-slate-950 bg-lime-400 hover:bg-lime-300 transition-all shadow-md shadow-lime-400/20 cursor-pointer"
              >
                <Maximize2 className="w-3.5 h-3.5" />
                <span>OPEN LIVE MATCH</span>
              </button>
            )}

            {onGoToFixtures && (
              <button
                onClick={onGoToFixtures}
                className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl text-xs font-semibold text-slate-300 hover:text-white bg-white/5 hover:bg-white/10 border border-white/10 transition-colors"
              >
                <span>Full Match Centre</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

      </div>
    </section>
  );
};
