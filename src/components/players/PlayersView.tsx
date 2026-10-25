import React, { useState } from 'react';
import {
  Users,
  Plus,
  Search,
  Filter,
  UserPlus,
  Edit2,
  Trash2,
  Phone,
  Shield,
  Activity,
} from 'lucide-react';
import { useTournament } from '../../context/TournamentContext';
import { Player } from '../../types/tournament';
import { ConfirmModal } from '../common/ConfirmModal';

export const PlayersView: React.FC = () => {
  const { state, addPlayer, bulkAddPlayers, updatePlayer, deletePlayer } = useTournament();

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSkill, setSelectedSkill] = useState<string>('all');
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [bulkModalOpen, setBulkModalOpen] = useState(false);
  const [editingPlayer, setEditingPlayer] = useState<Player | null>(null);
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);

  // New player form
  const [newName, setNewName] = useState('');
  const [newMobile, setNewMobile] = useState('');
  const [newAge, setNewAge] = useState<number | ''>('');
  const [newGender, setNewGender] = useState<'M' | 'F' | 'Other'>('M');
  const [newSkill, setNewSkill] = useState<'Intermediate' | 'Advanced' | 'Pro'>('Advanced');

  // Bulk add text
  const [bulkNames, setBulkNames] = useState('');

  const filteredPlayers = state.players.filter((p) => {
    if (searchQuery && !p.name.toLowerCase().includes(searchQuery.toLowerCase())) {
      return false;
    }
    if (selectedSkill !== 'all' && p.skillLevel !== selectedSkill) {
      return false;
    }
    return true;
  });

  const getTeamForPlayer = (playerId: string) => {
    return state.teams.find((t) => t.players.includes(playerId));
  };

  const handleAddPlayer = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return;

    addPlayer(newName.trim(), {
      mobile: newMobile || undefined,
      age: typeof newAge === 'number' ? newAge : undefined,
      gender: newGender,
      skillLevel: newSkill,
    });

    setAddModalOpen(false);
    setNewName('');
    setNewMobile('');
    setNewAge('');
  };

  const handleBulkAdd = (e: React.FormEvent) => {
    e.preventDefault();
    const names = bulkNames
      .split(/[\n,]/)
      .map((s) => s.trim())
      .filter(Boolean);

    if (names.length > 0) {
      bulkAddPlayers(names);
    }

    setBulkModalOpen(false);
    setBulkNames('');
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-500/20 text-blue-400 font-bold text-xl">
              🏸
            </span>
            <h1 className="font-display text-2xl sm:text-3xl font-black text-white">
              Players Directory
            </h1>
          </div>
          <p className="mt-1 text-xs sm:text-sm text-slate-400">
            {state.players.length} registered badminton athletes in {state.settings.name}.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setBulkModalOpen(true)}
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-200 hover:text-white bg-white/10 hover:bg-white/15 rounded-xl transition-colors border border-white/10"
          >
            <UserPlus className="w-4 h-4 text-amber-400" />
            <span>Bulk Add</span>
          </button>

          <button
            onClick={() => setAddModalOpen(true)}
            className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-slate-950 bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 rounded-xl shadow-md transition-all active:scale-95"
          >
            <Plus className="w-4 h-4" />
            <span>Add Player</span>
          </button>
        </div>
      </div>

      {/* Search & Filter Toolbar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 p-3 rounded-2xl glass-panel">
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search players by name..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-slate-900/80 border border-white/10 rounded-xl pl-9 pr-4 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-amber-400/50"
          />
        </div>

        <div className="flex items-center gap-1.5 overflow-x-auto p-1 bg-white/5 rounded-xl">
          {['all', 'Pro', 'Advanced', 'Intermediate'].map((sk) => (
            <button
              key={sk}
              onClick={() => setSelectedSkill(sk)}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap shrink-0 ${
                selectedSkill === sk
                  ? 'bg-amber-400 text-slate-950 shadow'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              {sk === 'all' ? 'All Skills' : sk}
            </button>
          ))}
        </div>
      </div>

      {/* Players Grid */}
      {filteredPlayers.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredPlayers.map((player) => {
            const team = getTeamForPlayer(player.id);
            const isCaptain = team?.captainId === player.id;

            return (
              <div
                key={player.id}
                className="rounded-2xl glass-card p-4 border border-white/5 hover:border-white/15 transition-all flex flex-col justify-between space-y-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-tr from-blue-600/30 to-indigo-600/30 border border-blue-500/20 font-bold text-sm text-blue-300">
                      {player.name.slice(0, 2).toUpperCase()}
                    </span>
                    <div className="min-w-0">
                      <h4 className="font-bold text-white text-base truncate">
                        {player.name}
                      </h4>
                      <div className="flex items-center gap-2 text-xs text-slate-400 mt-0.5">
                        <span>{player.gender === 'F' ? 'Female' : 'Male'}</span>
                        {player.age && <span>· {player.age} yrs</span>}
                        <span>·</span>
                        <span className="text-amber-400/90 font-medium">
                          {player.skillLevel || 'Advanced'}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => setEditingPlayer(player)}
                      title="Edit Player"
                      aria-label="Edit Player"
                      className="p-1.5 text-slate-500 hover:text-slate-200 transition-colors"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => setDeleteTargetId(player.id)}
                      title="Delete Player"
                      aria-label="Delete Player"
                      className="p-1.5 text-slate-500 hover:text-rose-400 transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Team Affiliation */}
                <div className="pt-2 border-t border-white/5 flex items-center justify-between text-xs">
                  <div className="flex items-center gap-1.5 text-slate-400">
                    <Shield className="w-3.5 h-3.5 text-slate-500" />
                    <span>Team:</span>
                    {team ? (
                      <span className="font-bold text-white flex items-center gap-1 truncate max-w-[150px]">
                        <span>{team.badge || '🏸'}</span>
                        <span>{team.name}</span>
                        {isCaptain && <span className="text-amber-400 font-bold">👑</span>}
                      </span>
                    ) : (
                      <span className="italic text-slate-500">Unassigned</span>
                    )}
                  </div>

                  {player.mobile && (
                    <span className="text-slate-500 font-mono text-[11px]">
                      {player.mobile}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="rounded-3xl glass-card p-12 text-center border border-dashed border-white/10 space-y-3">
          <Users className="w-12 h-12 text-slate-500 mx-auto" />
          <h3 className="text-lg font-bold text-white">No Players Found</h3>
          <p className="text-xs text-slate-400 max-w-sm mx-auto">
            Try adjusting your search query or add a new player to the tournament roster.
          </p>
        </div>
      )}

      {/* Add Single Player Modal */}
      {addModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-md rounded-2xl glass-panel p-6 shadow-2xl border border-white/10 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-white/10">
              <h3 className="font-bold text-white text-lg">Add New Player</h3>
              <button onClick={() => setAddModalOpen(false)} className="text-slate-400 hover:text-white">
                ✕
              </button>
            </div>

            <form onSubmit={handleAddPlayer} className="space-y-4 text-sm">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Full Name *
                </label>
                <input
                  type="text"
                  placeholder="Player's full name"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  className="w-full bg-slate-900 border border-white/10 rounded-xl px-3 py-2 text-white"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  WhatsApp / Mobile
                </label>
                <input
                  type="tel"
                  placeholder="e.g. 9876543210"
                  value={newMobile}
                  onChange={(e) => setNewMobile(e.target.value)}
                  className="w-full bg-slate-900 border border-white/10 rounded-xl px-3 py-2 text-white"
                />
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Age
                  </label>
                  <input
                    type="number"
                    min={10}
                    max={80}
                    placeholder="25"
                    value={newAge}
                    onChange={(e) => setNewAge(e.target.value ? parseInt(e.target.value, 10) : '')}
                    className="w-full bg-slate-900 border border-white/10 rounded-xl px-3 py-2 text-white"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Gender
                  </label>
                  <select
                    value={newGender}
                    onChange={(e) => setNewGender(e.target.value as any)}
                    className="w-full bg-slate-900 border border-white/10 rounded-xl px-3 py-2 text-white text-xs"
                  >
                    <option value="M">Male</option>
                    <option value="F">Female</option>
                    <option value="Other">Other</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Skill Level
                  </label>
                  <select
                    value={newSkill}
                    onChange={(e) => setNewSkill(e.target.value as any)}
                    className="w-full bg-slate-900 border border-white/10 rounded-xl px-3 py-2 text-white text-xs"
                  >
                    <option value="Pro">Pro</option>
                    <option value="Advanced">Advanced</option>
                    <option value="Intermediate">Intermediate</option>
                  </select>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setAddModalOpen(false)}
                  className="px-4 py-2 text-xs font-medium text-slate-400 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-xs font-bold bg-amber-400 text-slate-950 rounded-xl hover:bg-amber-300"
                >
                  Save Player
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Bulk Add Modal */}
      {bulkModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-md rounded-2xl glass-panel p-6 shadow-2xl border border-white/10 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-white/10">
              <h3 className="font-bold text-white text-lg">Bulk Add Players</h3>
              <button onClick={() => setBulkModalOpen(false)} className="text-slate-400 hover:text-white">
                ✕
              </button>
            </div>

            <form onSubmit={handleBulkAdd} className="space-y-4 text-sm">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Paste Player Names (one per line or comma-separated)
                </label>
                <textarea
                  rows={6}
                  placeholder={`Aryan Verma\nDevendra Roy\nPooja Hegde\nSameer Sen`}
                  value={bulkNames}
                  onChange={(e) => setBulkNames(e.target.value)}
                  className="w-full bg-slate-900 border border-white/10 rounded-xl p-3 text-white font-mono text-xs"
                  required
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setBulkModalOpen(false)}
                  className="px-4 py-2 text-xs font-medium text-slate-400 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-xs font-bold bg-amber-400 text-slate-950 rounded-xl hover:bg-amber-300"
                >
                  Import Players
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Player Modal */}
      {editingPlayer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-md rounded-2xl glass-panel p-6 shadow-2xl border border-white/10 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-white/10">
              <h3 className="font-bold text-white text-lg">Edit Player</h3>
              <button onClick={() => setEditingPlayer(null)} className="text-slate-400 hover:text-white">
                ✕
              </button>
            </div>

            <div className="space-y-4 text-sm">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Name</label>
                <input
                  type="text"
                  value={editingPlayer.name}
                  onChange={(e) => setEditingPlayer({ ...editingPlayer, name: e.target.value })}
                  className="w-full bg-slate-900 border border-white/10 rounded-xl px-3 py-2 text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Mobile</label>
                <input
                  type="tel"
                  value={editingPlayer.mobile || ''}
                  onChange={(e) => setEditingPlayer({ ...editingPlayer, mobile: e.target.value })}
                  className="w-full bg-slate-900 border border-white/10 rounded-xl px-3 py-2 text-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Skill</label>
                  <select
                    value={editingPlayer.skillLevel || 'Advanced'}
                    onChange={(e) => setEditingPlayer({ ...editingPlayer, skillLevel: e.target.value as any })}
                    className="w-full bg-slate-900 border border-white/10 rounded-xl px-3 py-2 text-white text-xs"
                  >
                    <option value="Pro">Pro</option>
                    <option value="Advanced">Advanced</option>
                    <option value="Intermediate">Intermediate</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Age</label>
                  <input
                    type="number"
                    value={editingPlayer.age || ''}
                    onChange={(e) => setEditingPlayer({ ...editingPlayer, age: parseInt(e.target.value, 10) || undefined })}
                    className="w-full bg-slate-900 border border-white/10 rounded-xl px-3 py-2 text-white text-xs"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setEditingPlayer(null)}
                  className="px-4 py-2 text-xs font-medium text-slate-400 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => {
                    updatePlayer(editingPlayer.id, editingPlayer);
                    setEditingPlayer(null);
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
        title="Delete Player"
        message="Are you sure you want to remove this player? They will also be removed from any assigned team and registrations."
        confirmLabel="Delete Player"
        variant="danger"
        onConfirm={() => {
          if (deleteTargetId) deletePlayer(deleteTargetId);
          setDeleteTargetId(null);
        }}
        onCancel={() => setDeleteTargetId(null)}
      />
    </div>
  );
};
