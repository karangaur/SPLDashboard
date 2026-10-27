import React, { useState, useEffect, useMemo } from 'react';
import {
  Crown,
  X,
  RefreshCw,
  Check,
  AlertCircle,
  CheckCircle2,
  Sparkles,
  Users,
} from 'lucide-react';
import { Team, Player } from '../../types/tournament';
import { sportsAudio } from '../../context/TournamentContext';

export interface CaptainAssignment {
  teamId: string;
  teamName: string;
  captainId: string;
}

interface RandomCaptainsModalProps {
  isOpen: boolean;
  onClose: () => void;
  teams: Team[];
  players: Player[];
  onConfirmCaptains: (assignments: { teamId: string; captainId: string }[]) => void;
  numTeamsFallback?: number;
}

export const RandomCaptainsModal: React.FC<RandomCaptainsModalProps> = ({
  isOpen,
  onClose,
  teams,
  players,
  onConfirmCaptains,
  numTeamsFallback = 4,
}) => {
  const [assignments, setAssignments] = useState<CaptainAssignment[]>([]);
  const [editingTeamId, setEditingTeamId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Teams to assign: either configured teams, or virtual slots if teams haven't been formed yet
  const targetTeams = useMemo(() => {
    if (teams.length > 0) {
      return teams.map((t) => ({ id: t.id, name: t.name, badge: t.badge || '🏸' }));
    }
    const count = Math.max(2, numTeamsFallback);
    const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');
    return Array.from({ length: count }).map((_, idx) => ({
      id: `virtual-team-${idx}`,
      name: `Team ${letters[idx] || idx + 1}`,
      badge: '🏸',
    }));
  }, [teams, numTeamsFallback]);

  // Fisher-Yates unbiased random shuffle and assignment
  const drawRandomCaptains = () => {
    setErrorMessage(null);
    if (players.length < targetTeams.length) {
      setErrorMessage(
        `Insufficient players: Need at least ${targetTeams.length} registered players to draw unique captains, but only ${players.length} are available.`
      );
      return;
    }

    // Unbiased shuffle of all available players
    const pool = [...players];
    for (let i = pool.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [pool[i], pool[j]] = [pool[j], pool[i]];
    }

    // Assign one unique captain per team (no duplicates guaranteed)
    const newAssignments: CaptainAssignment[] = targetTeams.map((team, idx) => ({
      teamId: team.id,
      teamName: team.name,
      captainId: pool[idx].id,
    }));

    setAssignments(newAssignments);
    setEditingTeamId(null);
    sportsAudio.playScorePing();
  };

  // Perform initial random draw whenever modal opens
  useEffect(() => {
    if (isOpen) {
      drawRandomCaptains();
    }
  }, [isOpen, teams.length, players.length]);

  if (!isOpen) return null;

  // Duplicate checks
  const captainCounts = new Map<string, number>();
  assignments.forEach((a) => {
    if (a.captainId) {
      captainCounts.set(a.captainId, (captainCounts.get(a.captainId) || 0) + 1);
    }
  });

  const hasDuplicates = Array.from(captainCounts.values()).some((count) => count > 1);
  const hasUnassigned = assignments.some((a) => !a.captainId);

  const handleCaptainChange = (teamId: string, newCaptainId: string) => {
    setAssignments((prev) =>
      prev.map((item) => (item.teamId === teamId ? { ...item, captainId: newCaptainId } : item))
    );
  };

  const handleConfirm = () => {
    if (hasDuplicates) {
      setErrorMessage('Cannot confirm: Duplicate captain assignment detected. Each team must have a unique captain.');
      return;
    }
    if (hasUnassigned) {
      setErrorMessage('Please assign a captain for every team.');
      return;
    }

    onConfirmCaptains(
      assignments.map((a) => ({
        teamId: a.teamId,
        captainId: a.captainId,
      }))
    );
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-950/85 backdrop-blur-md overflow-y-auto animate-fade-in">
      <div className="relative w-full max-w-2xl bg-[#0b1120] border border-white/15 rounded-3xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden font-sans">
        {/* Modal Top Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10 bg-slate-900/60">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-amber-500/20 text-amber-400 font-bold text-xl border border-amber-500/30">
              👑
            </span>
            <div>
              <h2 className="font-display text-lg sm:text-xl font-black text-white">
                Draw Random Captains
              </h2>
              <p className="text-xs text-slate-400">
                Random unbiased lottery draw assigning unique team captains from registered players.
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-white/10 transition-colors"
            aria-label="Close modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-5">
          {errorMessage && (
            <div className="p-3.5 bg-rose-500/20 border border-rose-500/30 rounded-2xl text-xs text-rose-300 flex items-center gap-2 animate-fade-in">
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Table Header Section: Explicitly titled "RANDOM CAPTAINS SELECTED" */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2">
            <div>
              <div className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-amber-400 animate-ping" />
                <h3 className="font-display text-base font-black text-amber-300 tracking-wider uppercase">
                  RANDOM CAPTAINS SELECTED
                </h3>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                {assignments.length} unique captains drawn from {players.length} registered athletes.
              </p>
            </div>

            {/* Quick Draw Again Control */}
            <button
              type="button"
              onClick={drawRandomCaptains}
              className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-amber-300 bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/30 rounded-xl transition-all shadow-sm active:scale-95 self-start sm:self-auto"
            >
              <RefreshCw className="w-3.5 h-3.5 text-amber-400" />
              <span>Draw Again</span>
            </button>
          </div>

          {/* Table: Team and Player Name */}
          <div className="rounded-2xl border border-white/10 overflow-hidden bg-slate-900/60 shadow-xl">
            <table className="w-full text-left text-xs sm:text-sm">
              <thead>
                <tr className="border-b border-white/10 bg-white/[0.04] text-[11px] font-black uppercase tracking-wider text-slate-400">
                  <th className="py-3 px-4 font-mono">Team</th>
                  <th className="py-3 px-4">Player Name</th>
                  <th className="py-3 px-4 text-right">Edit Captain</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {assignments.map((assignment, idx) => {
                  const assignedPlayer = players.find((p) => p.id === assignment.captainId);
                  const isDup = (captainCounts.get(assignment.captainId) || 0) > 1;
                  const isEditing = editingTeamId === assignment.teamId;

                  return (
                    <tr
                      key={assignment.teamId}
                      className={`hover:bg-white/[0.02] transition-colors ${
                        isDup ? 'bg-rose-500/10' : ''
                      }`}
                    >
                      {/* Column 1: Team */}
                      <td className="py-3.5 px-4 font-bold text-white whitespace-nowrap">
                        <div className="flex items-center gap-2.5">
                          <span className="w-7 h-7 rounded-xl bg-amber-500/20 text-amber-400 font-mono font-bold flex items-center justify-center text-xs border border-amber-500/30">
                            {idx + 1}
                          </span>
                          <span className="font-semibold text-slate-100">{assignment.teamName}</span>
                        </div>
                      </td>

                      {/* Column 2: Player Name */}
                      <td className="py-3.5 px-4">
                        {isEditing ? (
                          <div className="space-y-1 max-w-xs">
                            <select
                              value={assignment.captainId}
                              onChange={(e) => handleCaptainChange(assignment.teamId, e.target.value)}
                              className="w-full bg-slate-950 border border-amber-400/50 rounded-xl px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-amber-400 font-medium"
                            >
                              <option value="">Select Captain...</option>
                              {players.map((p) => {
                                const alreadyUsed = assignments.some(
                                  (a) => a.teamId !== assignment.teamId && a.captainId === p.id
                                );
                                return (
                                  <option key={p.id} value={p.id} disabled={alreadyUsed}>
                                    {p.name} {alreadyUsed ? '(Assigned to another team)' : ''}
                                  </option>
                                );
                              })}
                            </select>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2">
                            <Crown className="w-4 h-4 text-amber-400 shrink-0" />
                            <span className="font-bold text-emerald-300 font-display text-sm">
                              {assignedPlayer?.name || 'Unassigned'}
                            </span>
                            {isDup && (
                              <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-rose-500/20 text-rose-300 border border-rose-500/30">
                                Duplicate!
                              </span>
                            )}
                          </div>
                        )}
                      </td>

                      {/* Column 3: Edit Captain Action */}
                      <td className="py-3.5 px-4 text-right">
                        {isEditing ? (
                          <button
                            type="button"
                            onClick={() => setEditingTeamId(null)}
                            className="px-2.5 py-1 rounded-lg text-xs font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 hover:bg-emerald-500/30"
                          >
                            Done
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setEditingTeamId(assignment.teamId)}
                            className="px-2.5 py-1 rounded-lg text-xs font-medium text-slate-400 hover:text-white bg-white/5 hover:bg-white/10 transition-colors"
                          >
                            Edit Captain
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Info pill */}
          <div className="p-3 bg-white/5 rounded-2xl border border-white/5 text-xs text-slate-400 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4 text-amber-400 shrink-0" />
              <span>
                All {assignments.length} captain selections will be permanently saved to the tournament database.
              </span>
            </div>
            {hasDuplicates && (
              <span className="text-rose-400 font-bold text-[11px]">
                Please resolve duplicates before confirming
              </span>
            )}
          </div>
        </div>

        {/* Modal Footer Controls */}
        <div className="flex items-center justify-between gap-3 px-6 py-4 border-t border-white/10 bg-slate-900/60">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-bold text-slate-400 hover:text-white hover:bg-white/5 transition-colors"
          >
            Cancel
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={drawRandomCaptains}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold bg-white/10 hover:bg-white/15 text-white transition-colors"
            >
              <RefreshCw className="w-3.5 h-3.5 text-amber-400" />
              <span>Draw Again</span>
            </button>

            <button
              type="button"
              onClick={handleConfirm}
              disabled={hasDuplicates || hasUnassigned || assignments.length === 0}
              className="flex items-center gap-1.5 px-5 py-2 rounded-xl text-xs font-black text-slate-950 bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 transition-all shadow-lg shadow-amber-400/20 disabled:opacity-50"
            >
              <Check className="w-4 h-4" />
              <span>Confirm Captains</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
