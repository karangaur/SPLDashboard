import React, { useEffect } from 'react';
import {
  Trophy,
  Crown,
  Medal,
  Star,
  Sparkles,
  Award,
  Users,
  Volume2,
} from 'lucide-react';
import { useTournament, sportsAudio } from '../../context/TournamentContext';

export const ChampionView: React.FC = () => {
  const { state, standings, triggerCelebration } = useTournament();

  const totalMatches = state.matches.length;
  const completedMatches = state.matches.filter((m) => m.status === 'completed').length;
  const isTournamentFinished = totalMatches > 0 && completedMatches === totalMatches;

  // Auto trigger celebratory fanfare when viewing ceremony
  useEffect(() => {
    triggerCelebration();
  }, []);

  const championKnockout = state.knockout.matches.find(
    (m) => m.stage === 'F' && m.status === 'completed'
  );

  const championTeam = championKnockout?.winner
    ? state.teams.find((t) => t.id === championKnockout.winner)
    : standings[0]?.team;

  const runnerUpTeam =
    championKnockout?.winner && championKnockout.teamA && championKnockout.teamB
      ? state.teams.find(
          (t) =>
            t.id ===
            (championKnockout.winner === championKnockout.teamA
              ? championKnockout.teamB
              : championKnockout.teamA)
        )
      : standings[1]?.team;

  const thirdPlaceTeam = standings[2]?.team;

  const championStanding = championTeam
    ? standings.find((s) => s.team.id === championTeam.id)
    : standings[0];

  const mvpPlayer = championTeam?.captainId
    ? state.players.find((p) => p.id === championTeam.captainId)
    : state.players[0];

  return (
    <div className="max-w-5xl mx-auto space-y-10 animate-fade-in pb-12">
      {/* Header Banner */}
      <div className="text-center space-y-3">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-amber-500/10 text-amber-400 border border-amber-500/20">
          <Sparkles className="w-3.5 h-3.5" />
          <span>Official Award Presentation</span>
        </div>
        <h1 className="font-display text-4xl sm:text-5xl lg:text-6xl font-black text-white tracking-tight">
          <span className="gradient-gold-text">Champion Ceremony</span>
        </h1>
        <p className="text-sm text-slate-400 max-w-lg mx-auto">
          Honoring the champions, podium finishers, and most valuable players of {state.settings.name}.
        </p>
      </div>

      {/* Main Champion Spotlight Card */}
      {championTeam ? (
        <div className="rounded-3xl glass-panel p-8 sm:p-12 border border-amber-500/40 text-center space-y-6 relative overflow-hidden shadow-2xl gold-glow">
          <div className="pointer-events-none absolute -top-32 left-1/2 -translate-x-1/2 h-96 w-96 rounded-full bg-amber-400/20 blur-3xl" />

          {/* Trophy Icon */}
          <div className="relative inline-block">
            <div className="flex h-28 w-28 items-center justify-center rounded-3xl bg-gradient-to-tr from-amber-500/30 via-amber-400/20 to-amber-600/30 border border-amber-500/40 text-6xl shadow-2xl mx-auto">
              🏆
            </div>
            <div className="absolute -top-3 -right-2">
              <Crown className="w-8 h-8 text-amber-300 drop-shadow" />
            </div>
          </div>

          <div className="space-y-2">
            <span className="text-xs font-bold uppercase tracking-[0.3em] text-amber-400">
              League Champion & Cup Winner
            </span>
            <h2 className="font-display text-3xl sm:text-5xl font-black text-white">
              {championTeam.name}
            </h2>
            <p className="text-sm text-slate-300 max-w-md mx-auto">
              Demonstrated unmatched agility, tactical shot selection, and tournament resilience on the court.
            </p>
          </div>

          {/* Key Champion Stats */}
          {championStanding && (
            <div className="flex flex-wrap items-center justify-center gap-6 pt-2 font-mono">
              <div className="text-center">
                <span className="block text-2xl font-black text-white tabular-nums">
                  {championStanding.won}
                </span>
                <span className="text-[11px] text-slate-400 uppercase tracking-wider font-sans">
                  Victories
                </span>
              </div>
              <div className="h-8 w-px bg-white/10" />
              <div className="text-center">
                <span className="block text-2xl font-black text-amber-400 tabular-nums">
                  {championStanding.points}
                </span>
                <span className="text-[11px] text-slate-400 uppercase tracking-wider font-sans">
                  Points
                </span>
              </div>
              <div className="h-8 w-px bg-white/10" />
              <div className="text-center">
                <span className="block text-2xl font-black text-emerald-400 tabular-nums">
                  +{championStanding.diff}
                </span>
                <span className="text-[11px] text-slate-400 uppercase tracking-wider font-sans">
                  Net Diff
                </span>
              </div>
            </div>
          )}

          {/* Celebration Button */}
          <div className="pt-2">
            <button
              onClick={() => {
                triggerCelebration();
                sportsAudio.playFanfare();
              }}
              className="px-6 py-2.5 text-xs font-bold bg-amber-400 hover:bg-amber-300 text-slate-950 rounded-xl transition-all shadow-lg active:scale-95 inline-flex items-center gap-2"
            >
              <Sparkles className="w-4 h-4" />
              <span>Trigger Fanfare & Confetti</span>
            </button>
          </div>
        </div>
      ) : (
        <div className="p-12 text-center text-slate-400">No champion decided yet.</div>
      )}

      {/* Podium Cards: Runner-Up, Third Place, MVP */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Runner-Up */}
        <div className="rounded-3xl glass-card p-6 border border-white/10 text-center space-y-3">
          <span className="text-5xl block">🥈</span>
          <span className="text-xs font-bold uppercase tracking-wider text-slate-400 block">
            Runner-Up (2nd Place)
          </span>
          <h3 className="font-display text-2xl font-black text-white">
            {runnerUpTeam?.name || 'TBD'}
          </h3>
          <p className="text-xs text-slate-400">Silver Medalist Finalist</p>
        </div>

        {/* Third Place */}
        <div className="rounded-3xl glass-card p-6 border border-white/10 text-center space-y-3">
          <span className="text-5xl block">🥉</span>
          <span className="text-xs font-bold uppercase tracking-wider text-slate-400 block">
            Third Place (Bronze)
          </span>
          <h3 className="font-display text-2xl font-black text-white">
            {thirdPlaceTeam?.name || 'TBD'}
          </h3>
          <p className="text-xs text-slate-400">Podium Bronze Finish</p>
        </div>

        {/* Tournament MVP */}
        <div className="rounded-3xl glass-card p-6 border border-amber-500/20 bg-amber-500/5 text-center space-y-3">
          <div className="flex justify-center">
            <Award className="w-12 h-12 text-amber-400" />
          </div>
          <span className="text-xs font-bold uppercase tracking-wider text-amber-400 block">
            Most Valuable Player (MVP)
          </span>
          <h3 className="font-display text-2xl font-black text-white">
            {mvpPlayer?.name || 'Tournament MVP'}
          </h3>
          <p className="text-xs text-slate-400">Leading Scorer & Court Impact</p>
        </div>
      </div>
    </div>
  );
};
