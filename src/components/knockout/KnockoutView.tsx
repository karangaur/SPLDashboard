import React, { useState } from 'react';
import {
  Trophy,
  Flame,
  Swords,
  Crown,
  Share2,
  Copy,
  RefreshCw,
  Edit2,
  Trash2,
  CheckCircle2,
  ArrowUp,
  ArrowDown,
} from 'lucide-react';
import { useTournament, sportsAudio } from '../../context/TournamentContext';
import { KnockoutMatch } from '../../types/tournament';
import { ConfirmModal } from '../common/ConfirmModal';

export const KnockoutView: React.FC = () => {
  const {
    state,
    standings,
    setKnockoutFormat,
    generateKnockoutBracket,
    updateKnockoutMatch,
    clearKnockout,
    triggerCelebration,
  } = useTournament();

  const [editMode, setEditMode] = useState(false);
  const [copied, setCopied] = useState(false);
  const [showClearConfirm, setShowClearConfirm] = useState(false);

  const requiredTeams =
    state.knockout.format === 'top2' ? 2 : state.knockout.format === 'top4' ? 4 : 8;
  const isQualifiedReady = standings.length >= requiredTeams;

  const getTeam = (teamId?: string) => (teamId ? state.teams.find((t) => t.id === teamId) : undefined);
  const getPlayer = (playerId?: string) =>
    playerId ? state.players.find((p) => p.id === playerId) : undefined;

  const elimMatches = state.knockout.matches
    .filter((m) => m.stage === 'ELIM')
    .sort((a, b) => a.slot - b.slot);
  const sfMatches = state.knockout.matches
    .filter((m) => m.stage === 'SF')
    .sort((a, b) => a.slot - b.slot);
  const finalMatch = state.knockout.matches.find((m) => m.stage === 'F');

  const grandChampion = finalMatch?.winner ? getTeam(finalMatch.winner) : undefined;
  const runnerUp =
    finalMatch?.winner && finalMatch.teamA && finalMatch.teamB
      ? getTeam(finalMatch.winner === finalMatch.teamA ? finalMatch.teamB : finalMatch.teamA)
      : undefined;

  const handleScoreChange = (
    matchId: string,
    scoreAVal: string,
    scoreBVal: string
  ) => {
    const sA = parseInt(scoreAVal, 10);
    const sB = parseInt(scoreBVal, 10);
    if (isNaN(sA) || isNaN(sB)) return;

    if (sA === sB) {
      alert("A knockout match cannot end in a tie!");
      return;
    }

    const match = state.knockout.matches.find((m) => m.id === matchId);
    if (!match || !match.teamA || !match.teamB) return;

    const winnerId = sA > sB ? match.teamA : match.teamB;
    updateKnockoutMatch(matchId, {
      scoreA: sA,
      scoreB: sB,
      winner: winnerId,
      status: 'completed',
    });

    if (match.stage === 'F') {
      triggerCelebration();
    }
  };

  const formatBracketText = () => {
    const lines = [
      `🏆 ${state.settings.name} — Knockout Stage Bracket`,
      `Format: ${state.knockout.format.toUpperCase()}`,
      '',
    ];

    if (elimMatches.length > 0) {
      lines.push('🔥 Eliminator Round:');
      elimMatches.forEach((m, idx) => {
        const tA = getTeam(m.teamA)?.name || 'TBD';
        const tB = getTeam(m.teamB)?.name || 'TBD';
        const win = m.winner ? ` → Winner: ${getTeam(m.winner)?.name}` : '';
        lines.push(`  Match ${idx + 1}: ${tA} (${m.scoreA ?? '-'}) vs (${m.scoreB ?? '-'}) ${tB}${win}`);
      });
      lines.push('');
    }

    if (sfMatches.length > 0) {
      lines.push('⚔️ Semi Finals:');
      sfMatches.forEach((m, idx) => {
        const tA = getTeam(m.teamA)?.name || 'TBD';
        const tB = getTeam(m.teamB)?.name || 'TBD';
        const win = m.winner ? ` → Winner: ${getTeam(m.winner)?.name}` : '';
        lines.push(`  SF ${idx + 1}: ${tA} (${m.scoreA ?? '-'}) vs (${m.scoreB ?? '-'}) ${tB}${win}`);
      });
      lines.push('');
    }

    if (finalMatch) {
      const tA = getTeam(finalMatch.teamA)?.name || 'TBD';
      const tB = getTeam(finalMatch.teamB)?.name || 'TBD';
      const win = finalMatch.winner ? ` → 🏆 CHAMPION: ${getTeam(finalMatch.winner)?.name}` : '';
      lines.push(`🏆 Grand Final: ${tA} (${finalMatch.scoreA ?? '-'}) vs (${finalMatch.scoreB ?? '-'}) ${tB}${win}`);
    }

    return lines.join('\n');
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(formatBracketText());
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {}
  };

  const handleWhatsApp = () => {
    const url = `https://wa.me/?text=${encodeURIComponent(formatBracketText())}`;
    window.open(url, '_blank');
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-500/20 text-amber-400 font-bold text-xl">
              🏆
            </span>
            <h1 className="font-display text-2xl sm:text-3xl font-black text-white">
              Knockout Championship Stage
            </h1>
          </div>
          <p className="mt-1 text-xs sm:text-sm text-slate-400">
            Eliminators → Semi Finals → Grand Final tournament bracket.
          </p>
        </div>

        {state.knockout.matches.length > 0 && (
          <div className="flex items-center gap-2">
            <button
              onClick={handleCopy}
              className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-200 hover:text-white bg-white/10 hover:bg-white/15 rounded-xl transition-colors border border-white/10"
            >
              <Copy className="w-4 h-4 text-amber-400" />
              <span>{copied ? 'Copied' : 'Copy Bracket'}</span>
            </button>

            <button
              onClick={handleWhatsApp}
              className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-emerald-400 bg-emerald-500/10 hover:bg-emerald-500/20 rounded-xl transition-colors border border-emerald-500/20"
            >
              <Share2 className="w-4 h-4" />
              <span>WhatsApp</span>
            </button>
          </div>
        )}
      </div>

      {/* Format Selector & Bracket Generator Toolbar */}
      <div className="rounded-2xl glass-panel p-5 border border-white/10 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1.5">
          <label className="block text-xs font-bold uppercase tracking-wider text-slate-400">
            Championship Qualification Format
          </label>
          <div className="flex flex-wrap gap-2">
            {[
              { id: 'top2', label: 'Top 2 (Grand Final Only)' },
              { id: 'top4', label: 'Top 4 (Semi Finals + Final)' },
              { id: 'top8', label: 'Top 8 (Eliminators + Semis + Final)' },
            ].map((f) => (
              <button
                key={f.id}
                onClick={() => setKnockoutFormat(f.id as any)}
                className={`px-3.5 py-1.5 text-xs font-semibold rounded-xl transition-all ${
                  state.knockout.format === f.id
                    ? 'bg-amber-400 text-slate-950 font-bold shadow'
                    : 'bg-white/5 text-slate-300 hover:text-white hover:bg-white/10'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            onClick={() => {
              generateKnockoutBracket();
              triggerCelebration();
            }}
            disabled={!isQualifiedReady}
            className={`flex items-center gap-1.5 px-4 py-2.5 text-xs font-bold rounded-xl shadow transition-all ${
              isQualifiedReady
                ? 'bg-gradient-to-r from-amber-400 to-amber-500 text-slate-950 hover:from-amber-300 active:scale-95'
                : 'bg-white/10 text-slate-500 cursor-not-allowed'
            }`}
          >
            <RefreshCw className="w-4 h-4" />
            <span>
              {state.knockout.matches.length > 0 ? 'Regenerate Bracket' : 'Seed & Generate Bracket'}
            </span>
          </button>

          {state.knockout.matches.length > 0 && (
            <>
              <button
                onClick={() => setEditMode((prev) => !prev)}
                className={`flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-xl transition-colors border ${
                  editMode
                    ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                    : 'bg-white/5 text-slate-300 border-white/10 hover:bg-white/10'
                }`}
              >
                <Edit2 className="w-3.5 h-3.5" />
                <span>{editMode ? 'Done Editing' : 'Edit Pairings'}</span>
              </button>

              <button
                onClick={() => setShowClearConfirm(true)}
                className="px-3 py-2 text-xs font-semibold text-rose-400 hover:text-rose-300 bg-rose-500/10 hover:bg-rose-500/20 rounded-xl transition-colors border border-rose-500/20"
              >
                Clear Bracket
              </button>
            </>
          )}
        </div>
      </div>

      {/* Qualified Teams Ribbon */}
      <div className="rounded-2xl glass-card p-4 border border-white/5 space-y-2">
        <div className="flex items-center justify-between text-xs">
          <span className="font-bold uppercase tracking-wider text-slate-300">
            Top {requiredTeams} Qualified Teams (Seeded from Standings)
          </span>
          <span className="font-mono text-slate-400">
            {standings.length} / {requiredTeams} teams ready
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2 pt-1">
          {Array.from({ length: requiredTeams }).map((_, idx) => {
            const teamRow = standings[idx];
            return (
              <div
                key={idx}
                className={`p-2.5 rounded-xl border text-center space-y-0.5 ${
                  teamRow
                    ? 'bg-amber-500/10 border-amber-500/30'
                    : 'bg-white/5 border-dashed border-white/10'
                }`}
              >
                <span className="text-[10px] font-mono font-bold text-amber-400 block">
                  Seed #{idx + 1}
                </span>
                <span className="font-bold text-xs text-white truncate block">
                  {teamRow?.team.name || 'Waiting...'}
                </span>
                {teamRow && (
                  <span className="text-[10px] text-slate-400 font-mono block">
                    {teamRow.points} pts · {teamRow.won}W
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Grand Champion Celebration Card if Grand Final is complete */}
      {grandChampion && (
        <div className="rounded-3xl p-8 border border-amber-500/40 bg-gradient-to-r from-amber-500/20 via-amber-600/15 to-orange-500/20 text-center space-y-3 relative overflow-hidden shadow-2xl gold-glow">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-amber-400/20 via-transparent to-transparent" />
          <Crown className="w-16 h-16 text-amber-400 mx-auto animate-bounce drop-shadow" />
          <span className="text-xs font-bold uppercase tracking-[0.25em] text-amber-300 block">
            Smash Premier League Champion
          </span>
          <h2 className="font-display text-4xl sm:text-5xl font-black text-white">
            {grandChampion.name}
          </h2>
          {runnerUp && (
            <p className="text-sm text-slate-300">
              Runner-Up: <span className="font-bold text-white">{runnerUp.name}</span>
            </p>
          )}
        </div>
      )}

      {/* Visual Bracket Grid */}
      {state.knockout.matches.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Column 1: Eliminator Round (if top 8) */}
          {elimMatches.length > 0 && (
            <div className="space-y-4">
              <div className="flex items-center gap-2 pb-1 border-b border-white/10">
                <Flame className="w-4 h-4 text-amber-500" />
                <h3 className="font-display font-bold text-base text-white uppercase tracking-wider">
                  Eliminator Round
                </h3>
              </div>

              <div className="space-y-3">
                {elimMatches.map((m, idx) => (
                  <KnockoutMatchCard
                    key={m.id}
                    match={m}
                    matchLabel={`Eliminator ${idx + 1}`}
                    onScoreSubmit={handleScoreChange}
                    editMode={editMode}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Column 2: Semi Finals */}
          {sfMatches.length > 0 && (
            <div className="space-y-4">
              <div className="flex items-center gap-2 pb-1 border-b border-white/10">
                <Swords className="w-4 h-4 text-blue-400" />
                <h3 className="font-display font-bold text-base text-white uppercase tracking-wider">
                  Semi Finals
                </h3>
              </div>

              <div className="space-y-3">
                {sfMatches.map((m, idx) => (
                  <KnockoutMatchCard
                    key={m.id}
                    match={m}
                    matchLabel={`Semi Final ${idx + 1}`}
                    onScoreSubmit={handleScoreChange}
                    editMode={editMode}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Column 3: Grand Final */}
          {finalMatch && (
            <div className="space-y-4">
              <div className="flex items-center gap-2 pb-1 border-b border-white/10">
                <Trophy className="w-4 h-4 text-amber-400" />
                <h3 className="font-display font-bold text-base text-amber-400 uppercase tracking-wider">
                  Grand Final
                </h3>
              </div>

              <KnockoutMatchCard
                match={finalMatch}
                matchLabel="Championship Final"
                isFinal
                onScoreSubmit={handleScoreChange}
                editMode={editMode}
              />
            </div>
          )}
        </div>
      ) : (
        <div className="rounded-3xl glass-card p-12 text-center border border-dashed border-white/10 space-y-4">
          <Trophy className="w-12 h-12 text-slate-600 mx-auto" />
          <h3 className="text-lg font-bold text-white">Championship Bracket Not Yet Formed</h3>
          <p className="text-xs text-slate-400 max-w-sm mx-auto">
            Once league stages produce qualified teams, click below to generate the playoff bracket.
          </p>
          <button
            onClick={() => {
              generateKnockoutBracket();
              triggerCelebration();
            }}
            disabled={!isQualifiedReady}
            className={`px-5 py-2.5 text-xs font-bold rounded-xl shadow transition-all ${
              isQualifiedReady
                ? 'bg-amber-400 text-slate-950 hover:bg-amber-300'
                : 'bg-white/10 text-slate-500 cursor-not-allowed'
            }`}
          >
            Generate Playoff Bracket
          </button>
        </div>
      )}

      {/* Clear Confirmation */}
      <ConfirmModal
        isOpen={showClearConfirm}
        title="Clear Knockout Bracket"
        message="Are you sure you want to clear the entire playoff bracket and all knockout scores?"
        confirmLabel="Clear Bracket"
        variant="danger"
        onConfirm={() => {
          clearKnockout();
          setShowClearConfirm(false);
        }}
        onCancel={() => setShowClearConfirm(false)}
      />
    </div>
  );
};

interface KnockoutMatchCardProps {
  match: KnockoutMatch;
  matchLabel: string;
  isFinal?: boolean;
  editMode?: boolean;
  onScoreSubmit: (matchId: string, sA: string, sB: string) => void;
}

const KnockoutMatchCard: React.FC<KnockoutMatchCardProps> = ({
  match,
  matchLabel,
  isFinal,
  onScoreSubmit,
}) => {
  const { state } = useTournament();
  const [scoreA, setScoreA] = useState(match.scoreA?.toString() ?? '');
  const [scoreB, setScoreB] = useState(match.scoreB?.toString() ?? '');

  const teamA = match.teamA ? state.teams.find((t) => t.id === match.teamA) : undefined;
  const teamB = match.teamB ? state.teams.find((t) => t.id === match.teamB) : undefined;

  const isAWinner = match.winner === match.teamA;
  const isBWinner = match.winner === match.teamB;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onScoreSubmit(match.id, scoreA, scoreB);
  };

  return (
    <div
      className={`rounded-2xl glass-card p-4 border transition-all space-y-3 ${
        isFinal
          ? 'border-amber-500/40 gold-glow bg-amber-500/5'
          : match.status === 'completed'
          ? 'border-white/15'
          : 'border-white/5'
      }`}
    >
      <div className="flex items-center justify-between text-xs pb-2 border-b border-white/10">
        <span className="font-bold text-slate-400 uppercase tracking-wider">{matchLabel}</span>
        {match.status === 'completed' && (
          <span className="text-[10px] font-bold text-emerald-400 flex items-center gap-1">
            <CheckCircle2 className="w-3 h-3" /> Completed
          </span>
        )}
      </div>

      {/* Team A */}
      <div
        className={`flex items-center justify-between p-2.5 rounded-xl border transition-colors ${
          isAWinner
            ? 'bg-emerald-500/10 border-emerald-500/30 text-white font-bold'
            : 'bg-white/5 border-transparent text-slate-300'
        }`}
      >
        <div className="flex items-center gap-2 truncate">
          <span>{teamA?.badge || '🏸'}</span>
          <span className="truncate">{teamA?.name || 'Awaiting Winner...'}</span>
        </div>
        {isAWinner && <Crown className="w-4 h-4 text-amber-400 shrink-0" />}
      </div>

      <div className="text-center text-[10px] font-bold uppercase tracking-wider text-slate-500">
        VS
      </div>

      {/* Team B */}
      <div
        className={`flex items-center justify-between p-2.5 rounded-xl border transition-colors ${
          isBWinner
            ? 'bg-emerald-500/10 border-emerald-500/30 text-white font-bold'
            : 'bg-white/5 border-transparent text-slate-300'
        }`}
      >
        <div className="flex items-center gap-2 truncate">
          <span>{teamB?.badge || '🏸'}</span>
          <span className="truncate">{teamB?.name || 'Awaiting Winner...'}</span>
        </div>
        {isBWinner && <Crown className="w-4 h-4 text-amber-400 shrink-0" />}
      </div>

      {/* Score input form */}
      {teamA && teamB && (
        <form onSubmit={handleSubmit} className="pt-2 border-t border-white/5 flex items-center gap-2">
          <input
            type="number"
            min={0}
            placeholder="Score A"
            value={scoreA}
            onChange={(e) => setScoreA(e.target.value)}
            className="w-16 bg-slate-900 border border-white/10 rounded-lg p-1.5 text-center font-mono text-xs text-white"
            required
          />
          <span className="text-slate-500 text-xs font-bold">-</span>
          <input
            type="number"
            min={0}
            placeholder="Score B"
            value={scoreB}
            onChange={(e) => setScoreB(e.target.value)}
            className="w-16 bg-slate-900 border border-white/10 rounded-lg p-1.5 text-center font-mono text-xs text-white"
            required
          />
          <button
            type="submit"
            className="ml-auto px-3 py-1.5 text-xs font-bold bg-amber-400 text-slate-950 rounded-lg hover:bg-amber-300 transition-colors"
          >
            Save Result
          </button>
        </form>
      )}
    </div>
  );
};
