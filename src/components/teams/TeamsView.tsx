import React, { useState } from 'react';
import {
  Shield,
  Plus,
  Crown,
  Lock,
  Unlock,
  Users,
  Edit2,
  Trash2,
  Swords,
  ChevronRight,
  TrendingUp,
} from 'lucide-react';
import { useTournament } from '../../context/TournamentContext';
import { Team } from '../../types/tournament';
import { ConfirmModal } from '../common/ConfirmModal';

export const TeamsView: React.FC = () => {
  const {
    state,
    standings,
    addTeam,
    updateTeam,
    deleteTeam,
    renameTeam,
    toggleTeamLock,
    setTeamCaptain,
  } = useTournament();

  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [editingTeam, setEditingTeam] = useState<Team | null>(null);
  const [selectedTeamDetail, setSelectedTeamDetail] = useState<Team | null>(null);
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);

  // Form states
  const [newTeamName, setNewTeamName] = useState('');
  const [newPlayer1, setNewPlayer1] = useState('');
  const [newPlayer2, setNewPlayer2] = useState('');
  const [newBadge, setNewBadge] = useState('🏸');

  const getPlayer = (id: string) => state.players.find((p) => p.id === id);

  const handleCreateTeam = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTeamName.trim()) return;

    const players = [newPlayer1, newPlayer2].filter(Boolean);
    const created = addTeam(newTeamName.trim(), players, players[0]);
    if (newBadge) {
      updateTeam(created.id, { badge: newBadge });
    }

    setCreateModalOpen(false);
    setNewTeamName('');
    setNewPlayer1('');
    setNewPlayer2('');
    setNewBadge('🏸');
  };

  const badgesList = ['🏸', '🦅', '👑', '⚡', '🛡️', '🎯', '🥷', '🦁', '🔥', '🚀'];

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-500/20 text-amber-400 font-bold text-xl">
              🛡️
            </span>
            <h1 className="font-display text-2xl sm:text-3xl font-black text-white">
              Teams & Squad Rosters
            </h1>
          </div>
          <p className="mt-1 text-xs sm:text-sm text-slate-400">
            {state.teams.length} registered tournament teams competing in {state.settings.name}.
          </p>
        </div>

        <button
          onClick={() => setCreateModalOpen(true)}
          className="flex items-center gap-1.5 px-4 py-2.5 text-xs font-bold text-slate-950 bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 rounded-xl shadow-md transition-all active:scale-95"
        >
          <Plus className="w-4 h-4" />
          <span>Add Custom Team</span>
        </button>
      </div>

      {/* Teams Grid */}
      {state.teams.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {state.teams.map((team, idx) => {
            const teamStanding = standings.find((s) => s.team.id === team.id);
            const captain = team.captainId ? getPlayer(team.captainId) : undefined;
            const teamMatches = state.matches.filter(
              (m) => m.teamA === team.id || m.teamB === team.id
            );
            const completedCount = teamMatches.filter((m) => m.status === 'completed').length;

            return (
              <div
                key={team.id}
                className="rounded-2xl glass-card border border-white/10 hover:border-white/20 transition-all overflow-hidden flex flex-col justify-between group shadow-xl"
              >
                <div>
                  {/* Team Card Top Strip */}
                  <div className="p-5 pb-3 border-b border-white/5 bg-gradient-to-r from-white/[0.03] to-transparent">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-500/20 to-amber-600/30 text-2xl border border-amber-500/20 shadow">
                          {team.badge || '🏸'}
                        </span>
                        <div className="min-w-0">
                          <h3 className="font-display text-lg font-black text-white truncate group-hover:text-amber-400 transition-colors">
                            {team.name}
                          </h3>
                          <div className="flex items-center gap-2 text-xs text-slate-400 mt-0.5">
                            {teamStanding && (
                              <span className="font-mono font-bold text-amber-400">
                                Rank #{standings.indexOf(teamStanding) + 1}
                              </span>
                            )}
                            <span>·</span>
                            <span>{team.players.length} Players</span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => toggleTeamLock(team.id)}
                          title={team.locked ? 'Locked (Protected from random draws)' : 'Unlocked'}
                          aria-label={team.locked ? 'Unlock team' : 'Lock team'}
                          className={`p-1.5 rounded-lg text-xs font-semibold transition-colors ${
                            team.locked
                              ? 'text-amber-400 bg-amber-500/10'
                              : 'text-slate-500 hover:text-slate-300'
                          }`}
                        >
                          {team.locked ? <Lock className="w-4 h-4" /> : <Unlock className="w-4 h-4" />}
                        </button>

                        <button
                          onClick={() => setEditingTeam(team)}
                          title="Edit team"
                          aria-label="Edit team"
                          className="p-1.5 text-slate-500 hover:text-slate-200 transition-colors"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>

                        <button
                          onClick={() => setDeleteTargetId(team.id)}
                          title="Delete team"
                          aria-label="Delete team"
                          className="p-1.5 text-slate-500 hover:text-rose-400 transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Players / Squad List */}
                  <div className="p-5 space-y-3">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block">
                      Squad Roster
                    </span>
                    <div className="space-y-2">
                      {team.players.length > 0 ? (
                        team.players.map((pid) => {
                          const p = getPlayer(pid);
                          const isCaptain = team.captainId === pid;

                          return (
                            <div
                              key={pid}
                              className={`flex items-center justify-between p-2 rounded-xl text-xs ${
                                isCaptain
                                  ? 'bg-amber-500/10 border border-amber-500/20'
                                  : 'bg-white/5'
                              }`}
                            >
                              <div className="flex items-center gap-2 min-w-0">
                                <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-white/10 font-bold text-[10px] text-white">
                                  {p?.name ? p.name.slice(0, 2).toUpperCase() : '??'}
                                </span>
                                <span className="font-semibold text-white truncate">
                                  {p?.name || 'Unnamed Player'}
                                </span>
                              </div>
                              {isCaptain ? (
                                <span className="flex items-center gap-1 font-bold text-amber-400 text-[10px] uppercase tracking-wide">
                                  <Crown className="w-3 h-3 text-amber-400" />
                                  <span>Captain</span>
                                </span>
                              ) : (
                                <button
                                  onClick={() => setTeamCaptain(team.id, pid)}
                                  className="text-[10px] text-slate-500 hover:text-amber-400 transition-colors"
                                >
                                  Make Captain
                                </button>
                              )}
                            </div>
                          );
                        })
                      ) : (
                        <div className="p-3 text-center text-xs text-slate-500 italic">
                          No players assigned yet.
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Team Mini Stats Strip */}
                <div className="p-4 bg-white/[0.02] border-t border-white/5 grid grid-cols-4 gap-2 text-center text-xs font-mono">
                  <div>
                    <span className="block text-[10px] text-slate-400 uppercase">Played</span>
                    <span className="font-bold text-white">{teamStanding?.played ?? 0}</span>
                  </div>
                  <div>
                    <span className="block text-[10px] text-slate-400 uppercase">Wins</span>
                    <span className="font-bold text-emerald-400">{teamStanding?.won ?? 0}</span>
                  </div>
                  <div>
                    <span className="block text-[10px] text-slate-400 uppercase">Diff</span>
                    <span
                      className={`font-bold ${
                        (teamStanding?.diff ?? 0) > 0
                          ? 'text-emerald-400'
                          : (teamStanding?.diff ?? 0) < 0
                          ? 'text-rose-400'
                          : 'text-slate-400'
                      }`}
                    >
                      {(teamStanding?.diff ?? 0) > 0 ? `+${teamStanding?.diff}` : teamStanding?.diff ?? 0}
                    </span>
                  </div>
                  <div>
                    <span className="block text-[10px] text-slate-400 uppercase">Pts</span>
                    <span className="font-bold text-amber-400">{teamStanding?.points ?? 0}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="rounded-3xl glass-card p-12 text-center border border-dashed border-white/10 space-y-3">
          <span className="text-5xl">🛡️</span>
          <h3 className="text-lg font-bold text-white">No Teams Formed Yet</h3>
          <p className="text-xs text-slate-400 max-w-sm mx-auto">
            You can create teams manually or use the Token Generator to draw lottery teams from the player pool.
          </p>
          <button
            onClick={() => setCreateModalOpen(true)}
            className="px-4 py-2 text-xs font-bold bg-amber-400 text-slate-950 rounded-xl hover:bg-amber-300"
          >
            Create First Team
          </button>
        </div>
      )}

      {/* Create Team Modal */}
      {createModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-md rounded-2xl glass-panel p-6 shadow-2xl border border-white/10 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-white/10">
              <h3 className="font-bold text-white text-lg">Create New Team</h3>
              <button
                onClick={() => setCreateModalOpen(false)}
                className="text-slate-400 hover:text-white"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateTeam} className="space-y-4 text-sm">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Team Name
                </label>
                <input
                  type="text"
                  placeholder="e.g. Thunder Smashers"
                  value={newTeamName}
                  onChange={(e) => setNewTeamName(e.target.value)}
                  className="w-full bg-slate-900 border border-white/10 rounded-xl px-3 py-2 text-white"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Badge / Mascot
                </label>
                <div className="flex flex-wrap gap-2">
                  {badgesList.map((b) => (
                    <button
                      key={b}
                      type="button"
                      onClick={() => setNewBadge(b)}
                      className={`h-9 w-9 rounded-xl flex items-center justify-center text-lg transition-colors ${
                        newBadge === b ? 'bg-amber-400/20 border border-amber-400' : 'bg-white/5 hover:bg-white/10'
                      }`}
                    >
                      {b}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Player 1 (Captain)
                  </label>
                  <select
                    value={newPlayer1}
                    onChange={(e) => setNewPlayer1(e.target.value)}
                    className="w-full bg-slate-900 border border-white/10 rounded-xl px-3 py-2 text-white text-xs"
                  >
                    <option value="">Select Player</option>
                    {state.players.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Player 2 (Partner)
                  </label>
                  <select
                    value={newPlayer2}
                    onChange={(e) => setNewPlayer2(e.target.value)}
                    className="w-full bg-slate-900 border border-white/10 rounded-xl px-3 py-2 text-white text-xs"
                  >
                    <option value="">Select Player</option>
                    {state.players
                      .filter((p) => p.id !== newPlayer1)
                      .map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name}
                        </option>
                      ))}
                  </select>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setCreateModalOpen(false)}
                  className="px-4 py-2 text-xs font-medium text-slate-400 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-xs font-bold bg-amber-400 text-slate-950 rounded-xl hover:bg-amber-300"
                >
                  Create Team
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Team Modal */}
      {editingTeam && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-md rounded-2xl glass-panel p-6 shadow-2xl border border-white/10 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-white/10">
              <h3 className="font-bold text-white text-lg">Edit Team</h3>
              <button
                onClick={() => setEditingTeam(null)}
                className="text-slate-400 hover:text-white"
              >
                ✕
              </button>
            </div>

            <div className="space-y-4 text-sm">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Team Name
                </label>
                <input
                  type="text"
                  value={editingTeam.name}
                  onChange={(e) =>
                    setEditingTeam({ ...editingTeam, name: e.target.value })
                  }
                  className="w-full bg-slate-900 border border-white/10 rounded-xl px-3 py-2 text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Team Badge
                </label>
                <div className="flex flex-wrap gap-2">
                  {badgesList.map((b) => (
                    <button
                      key={b}
                      type="button"
                      onClick={() => setEditingTeam({ ...editingTeam, badge: b })}
                      className={`h-9 w-9 rounded-xl flex items-center justify-center text-lg transition-colors ${
                        editingTeam.badge === b
                          ? 'bg-amber-400/20 border border-amber-400'
                          : 'bg-white/5 hover:bg-white/10'
                      }`}
                    >
                      {b}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setEditingTeam(null)}
                  className="px-4 py-2 text-xs font-medium text-slate-400 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => {
                    renameTeam(editingTeam.id, editingTeam.name);
                    updateTeam(editingTeam.id, { badge: editingTeam.badge });
                    setEditingTeam(null);
                  }}
                  className="px-4 py-2 text-xs font-bold bg-amber-400 text-slate-950 rounded-xl hover:bg-amber-300"
                >
                  Save Changes
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation */}
      <ConfirmModal
        isOpen={!!deleteTargetId}
        title="Delete Team"
        message="Are you sure you want to delete this team? Any fixtures associated with this team will also be removed."
        confirmLabel="Delete Team"
        variant="danger"
        onConfirm={() => {
          if (deleteTargetId) deleteTeam(deleteTargetId);
          setDeleteTargetId(null);
        }}
        onCancel={() => setDeleteTargetId(null)}
      />
    </div>
  );
};
