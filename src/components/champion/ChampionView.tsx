import React, { useEffect } from 'react';
import {
  Crown,
  Sparkles,
  Award,
  Trophy,
} from 'lucide-react';
import { useTournament, sportsAudio } from '../../context/TournamentContext';

export const ChampionView: React.FC = () => {
  const { state, standings, triggerCelebration } = useTournament();

  useEffect(() => {
    triggerCelebration();
  }, []);

  const championKnockout = state.knockout.matches.find(
    (m) => m.stage === 'F' && m.status === 'completed'
  );

  const championTeam = championKnockout?.winner
    ? state.teams.find((t) => t.id === championKnockout.winner)
    : state.knockout.championTeamId
    ? state.teams.find((t) => t.id === state.knockout.championTeamId)
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
      : state.knockout.runnerUpTeamId
      ? state.teams.find((t) => t.id === state.knockout.runnerUpTeamId)
      : standings[1]?.team;

  const thirdPlaceTeam = standings[2]?.team;

  const getTeamPlayerNames = (teamId?: string) => {
    const team = teamId ? state.teams.find((t) => t.id === teamId) : undefined;
    if (!team) return '';
    return (team.players || [])
      .map((pid) => state.players.find((p) => p.id === pid)?.name)
      .filter((n): n is string => Boolean(n))
      .join(' & ');
  };

  const championPlayers = getTeamPlayerNames(championTeam?.id);
  const runnerUpPlayers = getTeamPlayerNames(runnerUpTeam?.id);

  const championStanding = championTeam
    ? standings.find((s) => s.team.id === championTeam.id)
    : standings[0];

  const mvpPlayer = championKnockout?.mvpPlayerId
    ? state.players.find((p) => p.id === championKnockout.mvpPlayerId)
    : championTeam?.captainId
    ? state.players.find((p) => p.id === championTeam.captainId)
    : state.players[0];

  return (
    <div className="max-w-5xl mx-auto space-y-10 animate-fade-in motion-reduce:animate-none pb-12">
      {/* Header Banner */}
      <div className="text-center space-y-3">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-amber-500/10 text-amber-400 border border-amber-500/20">
          <Sparkles className="w-3.5 h-3.5" />
          <span>{state.settings.season || 'SPL 3.0 Champion Edition'} · Official Award Presentation</span>
        </div>
        <h1 className="font-display text-4xl sm:text-5xl lg:text-6xl font-black text-white tracking-tight">
          <span className="gradient-gold-text">Champion Ceremony</span>
        </h1>
        <p className="text-sm text-slate-400 max-w-lg mx-auto">
          Honoring the champions, podium finishers, and standout athletes of {state.settings.name}.
        </p>
      </div>

      {/* Main Champion Spotlight Card */}
      {championTeam ? (
        <div className="rounded-3xl glass-panel p-8 sm:p-12 border border-amber-500/40 text-center space-y-6 relative overflow-hidden shadow-2xl gold-glow">
          <div className="pointer-events-none absolute -top-32 left-1/2 -translate-x-1/2 h-96 w-96 rounded-full bg-amber-400/20 blur-3xl" />

          {/* Trophy Icon */}
          <div className="relative inline-block">
            <div className="flex h-28 w-28 items-center justify-center rounded-3xl bg-gradient-to-tr from-amber-500/30 via-amber-400/20 to-amber-600/30 border border-amber-500/40 text-6xl shadow-2xl mx-auto">
              {championTeam.badge || '🏆'}
            </div>
            <div className="absolute -top-3 -right-2">
              <Crown className="w-8 h-8 text-amber-300 drop-shadow" />
            </div>
          </div>

          <div className="space-y-2">
            <span className="text-xs font-bold uppercase tracking-[0.3em] text-amber-400">
              {championKnockout ? 'Smash Premier League Grand Final Champion' : 'League Leader & Championship Contender'}
            </span>
            <h2 className="font-display text-3xl sm:text-5xl font-black text-white">
              {championTeam.name}
            </h2>
            {championPlayers && (
              <p className="text-sm sm:text-base font-bold text-amber-200">
                Doubles Champions: {championPlayers}
              </p>
            )}
            <p className="text-sm text-slate-300 max-w-md mx-auto">
              Demonstrated unmatched agility, tactical shot selection, and tournament resilience on the court.
            </p>
          </div>

          {/* Grand Final Score Summary if completed */}
          {championKnockout && (
            <div className="inline-flex flex-col items-center gap-1 px-5 py-3 rounded-2xl bg-black/40 border border-amber-400/30 font-mono">
              <span className="text-[10px] uppercase tracking-widest text-amber-300 font-bold flex items-center gap-1.5">
                <Trophy className="w-3.5 h-3.5" />
                Grand Final Score
              </span>
              <span className="text-xl sm:text-2xl font-black text-white tabular-nums">
                {state.teams.find((t) => t.id === championKnockout.teamA)?.name || 'Finalist A'}{' '}
                <span className="text-amber-300">
                  {championKnockout.scoreA ?? 0} – {championKnockout.scoreB ?? 0}
                </span>{' '}
                {state.teams.find((t) => t.id === championKnockout.teamB)?.name || 'Finalist B'}
              </span>
              {championKnockout.sets && championKnockout.sets.length > 1 && (
                <div className="flex flex-wrap items-center justify-center gap-1.5 text-[11px] text-slate-300 pt-1">
                  {championKnockout.sets.map((s, idx) => (
                    <span key={idx} className="px-2 py-0.5 rounded bg-white/10">
                      Set {idx + 1}: {s.scoreA}-{s.scoreB}
                    </span>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Key Champion Stats */}
          {championStanding && (
            <div className="flex flex-wrap items-center justify-center gap-6 pt-2 font-mono">
              <div className="text-center">
                <span className="block text-2xl font-black text-white tabular-nums">
                  {championStanding.won}
                </span>
                <span className="text-[11px] text-slate-400 uppercase tracking-wider font-sans">
                  League Wins
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
                  {championStanding.diff > 0 ? `+${championStanding.diff}` : championStanding.diff}
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
              type="button"
              onClick={() => {
                triggerCelebration();
                sportsAudio.playFanfare();
              }}
              className="px-6 py-2.5 text-xs font-bold bg-amber-400 hover:bg-amber-300 text-slate-950 rounded-xl transition-all shadow-lg active:scale-95 inline-flex items-center gap-2"
            >
              <Sparkles className="w-4 h-4" />
              <span>Trigger Fanfare &amp; Confetti</span>
            </button>
          </div>
        </div>
      ) : (
        <div className="p-12 text-center text-slate-400">No champion decided yet.</div>
      )}

      {/* Podium Cards: Runner-Up, Third Place, MVP */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Runner-Up */}
        <div className="rounded-3xl glass-card p-6 border border-white/10 text-center space-y-2.5">
          <span className="text-5xl block">🥈</span>
          <span className="text-xs font-bold uppercase tracking-wider text-slate-400 block">
            Runner-Up (2nd Place)
          </span>
          <h3 className="font-display text-2xl font-black text-white">
            {runnerUpTeam?.name || 'TBD'}
          </h3>
          {runnerUpPlayers && (
            <p className="text-xs font-semibold text-amber-200/80">{runnerUpPlayers}</p>
          )}
          <p className="text-xs text-slate-400">Silver Medalist Finalist</p>
        </div>

        {/* Third Place */}
        <div className="rounded-3xl glass-card p-6 border border-white/10 text-center space-y-2.5">
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
        <div className="rounded-3xl glass-card p-6 border border-amber-500/20 bg-amber-500/5 text-center space-y-2.5">
          <div className="flex justify-center">
            <Award className="w-12 h-12 text-amber-400" />
          </div>
          <span className="text-xs font-bold uppercase tracking-wider text-amber-400 block">
            Most Valuable Player (MVP)
          </span>
          <h3 className="font-display text-2xl font-black text-white">
            {mvpPlayer?.name || 'Tournament MVP'}
          </h3>
          <p className="text-xs text-slate-400">Leading Scorer &amp; Court Impact</p>
        </div>
      </div>
    </div>
  );
};
