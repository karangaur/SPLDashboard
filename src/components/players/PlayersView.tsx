import React, { useState } from 'react';
import {
  Users,
  Plus,
  Search,
  UserPlus,
  Edit2,
  Trash2,
  Shield,
  Check,
  CheckSquare,
  Square,
  X,
  AlertCircle,
  CheckCircle2,
} from 'lucide-react';
import { useTournament } from '../../context/TournamentContext';
import { Player } from '../../types/tournament';
import { ConfirmModal } from '../common/ConfirmModal';

export const PlayersView: React.FC = () => {
  const {
    state,
    addPlayer,
    bulkAddPlayers,
    updatePlayer,
    deletePlayer,
    deletePlayersBulk,
  } = useTournament();

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSkill, setSelectedSkill] = useState<string>('all');
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [bulkModalOpen, setBulkModalOpen] = useState(false);
  const [editingPlayer, setEditingPlayer] = useState<Player | null>(null);
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);

  // Bulk selection state
  const [selectedPlayerIds, setSelectedPlayerIds] = useState<Set<string>>(new Set());
  const [bulkDeleteModalOpen, setBulkDeleteModalOpen] = useState(false);
  const [notification, setNotification] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // New player form - Only Name and Gender are mandatory
  const [newName, setNewName] = useState('');
  const [newMobile, setNewMobile] = useState('');
  const [newAge, setNewAge] = useState<number | ''>('');
  const [newGender, setNewGender] = useState<'M' | 'F' | 'Other'>('M');
  const [newSkill, setNewSkill] = useState<'Intermediate' | 'Advanced' | 'Pro'>('Advanced');

  // Bulk add text
  const [bulkNames, setBulkNames] = useState('');

  const showNotification = (message: string, type: 'success' | 'error' = 'success') => {
    setNotification({ type, message });
    setTimeout(() => {
      setNotification((curr) => (curr?.message === message ? null : curr));
    }, 4500);
  };

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

  const handleToggleSelectPlayer = (id: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    setSelectedPlayerIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const isAllSelected =
    filteredPlayers.length > 0 && filteredPlayers.every((p) => selectedPlayerIds.has(p.id));

  const handleToggleSelectAll = () => {
    if (isAllSelected) {
      // Unselect only filtered
      setSelectedPlayerIds((prev) => {
        const next = new Set(prev);
        filteredPlayers.forEach((p) => next.delete(p.id));
        return next;
      });
    } else {
      // Select all filtered
      setSelectedPlayerIds((prev) => {
        const next = new Set(prev);
        filteredPlayers.forEach((p) => next.add(p.id));
        return next;
      });
    }
  };

  const handleClearSelection = () => {
    setSelectedPlayerIds(new Set());
  };

  const handleConfirmBulkDelete = () => {
    const count = selectedPlayerIds.size;
    if (count === 0) return;

    try {
      deletePlayersBulk(Array.from(selectedPlayerIds));
      setSelectedPlayerIds(new Set());
      setBulkDeleteModalOpen(false);
      showNotification(
        `Successfully deleted ${count} player${count > 1 ? 's' : ''} and updated all team assignments.`
      );
    } catch (err) {
      setBulkDeleteModalOpen(false);
      showNotification('Failed to complete bulk deletion. Please try again.', 'error');
    }
  };

  const handleAddPlayer = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return;

    addPlayer(newName.trim(), {
      mobile: newMobile.trim() || undefined,
      age: typeof newAge === 'number' ? newAge : undefined,
      gender: newGender,
      skillLevel: newSkill,
    });

    setAddModalOpen(false);
    setNewName('');
    setNewMobile('');
    setNewAge('');
    showNotification(`Player "${newName.trim()}" added successfully.`);
  };

  const handleBulkAdd = (e: React.FormEvent) => {
    e.preventDefault();
    const names = bulkNames
      .split(/[\n,]/)
      .map((s) => s.trim())
      .filter(Boolean);

    if (names.length > 0) {
      bulkAddPlayers(names);
      showNotification(`Added ${names.length} players to the tournament roster.`);
    }

    setBulkModalOpen(false);
    setBulkNames('');
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Toast Notification */}
      {notification && (
        <div
          role="status"
          aria-live="polite"
          className={`flex items-center justify-between p-3.5 rounded-2xl border text-sm font-medium shadow-lg transition-all ${
            notification.type === 'success'
              ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-300'
              : 'bg-rose-500/15 border-rose-500/30 text-rose-300'
          }`}
        >
          <div className="flex items-center gap-2.5">
            {notification.type === 'success' ? (
              <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
            ) : (
              <AlertCircle className="w-5 h-5 text-rose-400 shrink-0" />
            )}
            <span>{notification.message}</span>
          </div>
          <button
            onClick={() => setNotification(null)}
            className="p-1 text-slate-400 hover:text-white rounded-lg"
            aria-label="Dismiss message"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Top Header */}
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
      {state.players.length > 0 && (
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
      )}

      {/* Bulk Selection Action Bar */}
      {state.players.length > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-2.5 rounded-2xl bg-slate-900/70 border border-white/10 text-xs text-slate-300">
          <div className="flex items-center gap-3">
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={isAllSelected}
                onChange={handleToggleSelectAll}
                className="h-4 w-4 rounded border-white/20 bg-slate-800 text-amber-500 focus:ring-amber-400 focus:ring-offset-slate-950 accent-amber-500 cursor-pointer"
                aria-label="Select all players"
              />
              <span className="font-semibold text-white">
                {isAllSelected ? 'Deselect All' : 'Select All'} ({filteredPlayers.length})
              </span>
            </label>

            {selectedPlayerIds.size > 0 && (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-400/15 border border-amber-400/30 text-amber-300 font-bold">
                <span>{selectedPlayerIds.size}</span> selected
              </span>
            )}
          </div>

          {selectedPlayerIds.size > 0 && (
            <div className="flex items-center gap-2">
              <button
                onClick={handleClearSelection}
                className="px-2.5 py-1 rounded-lg text-slate-400 hover:text-white transition-colors"
              >
                Clear Selection
              </button>

              <button
                onClick={() => setBulkDeleteModalOpen(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-bold bg-rose-600 hover:bg-rose-500 text-white shadow-md transition-all active:scale-95"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Delete Selected ({selectedPlayerIds.size})</span>
              </button>
            </div>
          )}
        </div>
      )}

      {/* Players Grid or Empty State */}
      {state.players.length === 0 ? (
        <div className="rounded-3xl glass-card p-12 text-center border border-dashed border-white/10 space-y-4">
          <div className="flex h-16 w-16 mx-auto items-center justify-center rounded-2xl bg-amber-500/15 text-amber-400 text-3xl border border-amber-500/20">
            🏸
          </div>
          <div>
            <h3 className="text-xl font-bold text-white">No Players Added Yet</h3>
            <p className="text-xs sm:text-sm text-slate-400 max-w-md mx-auto mt-1 leading-relaxed">
              The tournament player list is currently empty. Add your athletes individually or use Bulk Add to paste a list of player names.
            </p>
          </div>
          <div className="flex items-center justify-center gap-3 pt-2">
            <button
              onClick={() => setAddModalOpen(true)}
              className="flex items-center gap-1.5 px-4 py-2 text-xs font-bold bg-amber-400 text-slate-950 rounded-xl hover:bg-amber-300 transition-colors shadow-md"
            >
              <Plus className="w-4 h-4" />
              <span>Add First Player</span>
            </button>
            <button
              onClick={() => setBulkModalOpen(true)}
              className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-slate-200 bg-white/10 hover:bg-white/15 rounded-xl transition-colors border border-white/10"
            >
              <UserPlus className="w-4 h-4 text-amber-400" />
              <span>Bulk Add</span>
            </button>
          </div>
        </div>
      ) : filteredPlayers.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredPlayers.map((player) => {
            const team = getTeamForPlayer(player.id);
            const isCaptain = team?.captainId === player.id;
            const isSelected = selectedPlayerIds.has(player.id);

            return (
              <div
                key={player.id}
                onClick={() => handleToggleSelectPlayer(player.id)}
                className={`rounded-2xl glass-card p-4 border transition-all flex flex-col justify-between space-y-4 cursor-pointer select-none ${
                  isSelected
                    ? 'border-amber-400/60 bg-amber-500/10 shadow-lg shadow-amber-500/5'
                    : 'border-white/5 hover:border-white/15'
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    {/* Checkbox */}
                    <div
                      onClick={(e) => handleToggleSelectPlayer(player.id, e)}
                      className={`h-5 w-5 shrink-0 rounded-md border flex items-center justify-center transition-colors ${
                        isSelected
                          ? 'bg-amber-400 border-amber-400 text-slate-950'
                          : 'border-white/20 bg-slate-900/80 hover:border-white/40'
                      }`}
                    >
                      {isSelected && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                    </div>

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

                  <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                    <button
                      onClick={() => setEditingPlayer(player)}
                      title="Edit Player"
                      aria-label={`Edit ${player.name}`}
                      className="p-1.5 text-slate-500 hover:text-slate-200 transition-colors"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => setDeleteTargetId(player.id)}
                      title="Delete Player"
                      aria-label={`Delete ${player.name}`}
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
                        {isCaptain && <span className="text-amber-400 font-bold" title="Captain">👑</span>}
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
          <h3 className="text-lg font-bold text-white">No Matching Players Found</h3>
          <p className="text-xs text-slate-400 max-w-sm mx-auto">
            Try adjusting your search query or skill level filter.
          </p>
          <button
            onClick={() => {
              setSearchQuery('');
              setSelectedSkill('all');
            }}
            className="px-3 py-1.5 text-xs font-semibold text-slate-300 hover:text-white bg-white/5 hover:bg-white/10 rounded-xl"
          >
            Clear Filters
          </button>
        </div>
      )}

      {/* Add Single Player Modal */}
      {addModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-md rounded-2xl glass-panel p-6 shadow-2xl border border-white/10 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-white/10">
              <h3 className="font-bold text-white text-lg">Add New Player</h3>
              <button
                onClick={() => setAddModalOpen(false)}
                className="text-slate-400 hover:text-white"
                aria-label="Close"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleAddPlayer} className="space-y-4 text-sm">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Full Athlete Name *
                </label>
                <input
                  type="text"
                  placeholder="e.g. Karan Gaur"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  className="w-full bg-slate-900 border border-white/10 rounded-xl px-3 py-2 text-white placeholder-slate-500 focus:outline-none focus:border-amber-400"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  WhatsApp / Mobile <span className="text-slate-500 font-normal">(Optional)</span>
                </label>
                <input
                  type="tel"
                  placeholder="e.g. 9876543210 (Optional)"
                  value={newMobile}
                  onChange={(e) => setNewMobile(e.target.value)}
                  className="w-full bg-slate-900 border border-white/10 rounded-xl px-3 py-2 text-white placeholder-slate-500 focus:outline-none focus:border-amber-400"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Gender *
                  </label>
                  <select
                    value={newGender}
                    onChange={(e) => setNewGender(e.target.value as any)}
                    className="w-full bg-slate-900 border border-white/10 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-amber-400"
                    required
                  >
                    <option value="M">Male</option>
                    <option value="F">Female</option>
                    <option value="Other">Other</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Age <span className="text-slate-500 font-normal">(Optional)</span>
                  </label>
                  <input
                    type="number"
                    min={10}
                    max={80}
                    placeholder="e.g. 24"
                    value={newAge}
                    onChange={(e) => setNewAge(e.target.value ? parseInt(e.target.value, 10) : '')}
                    className="w-full bg-slate-900 border border-white/10 rounded-xl px-3 py-2 text-white placeholder-slate-500 focus:outline-none focus:border-amber-400"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Skill Level <span className="text-slate-500 font-normal">(Optional)</span>
                </label>
                <select
                  value={newSkill}
                  onChange={(e) => setNewSkill(e.target.value as any)}
                  className="w-full bg-slate-900 border border-white/10 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-amber-400"
                >
                  <option value="Intermediate">Intermediate</option>
                  <option value="Advanced">Advanced</option>
                  <option value="Pro">Pro</option>
                </select>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-white/10">
                <button
                  type="button"
                  onClick={() => setAddModalOpen(false)}
                  className="px-4 py-2 text-xs font-medium text-slate-400 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-xs font-bold bg-amber-400 text-slate-950 rounded-xl hover:bg-amber-300 transition-colors shadow"
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
          <div className="w-full max-w-lg rounded-2xl glass-panel p-6 shadow-2xl border border-white/10 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-white/10">
              <h3 className="font-bold text-white text-lg">Bulk Import Players</h3>
              <button
                onClick={() => setBulkModalOpen(false)}
                className="text-slate-400 hover:text-white"
                aria-label="Close"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-slate-300">
              Paste or type athlete names separated by commas or new lines. Each player will be added to the directory.
            </p>

            <form onSubmit={handleBulkAdd} className="space-y-4">
              <textarea
                rows={6}
                placeholder="Karan Gaur&#10;Amit Singhania&#10;Devendra Sen"
                value={bulkNames}
                onChange={(e) => setBulkNames(e.target.value)}
                className="w-full bg-slate-900 border border-white/10 rounded-xl p-3 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-amber-400"
                required
              />

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-white/10">
                <button
                  type="button"
                  onClick={() => setBulkModalOpen(false)}
                  className="px-4 py-2 text-xs font-medium text-slate-400 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-xs font-bold bg-amber-400 text-slate-950 rounded-xl hover:bg-amber-300 transition-colors shadow"
                >
                  Add All Players
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
              <h3 className="font-bold text-white text-lg">Edit Player Details</h3>
              <button
                onClick={() => setEditingPlayer(null)}
                className="text-slate-400 hover:text-white"
                aria-label="Close"
              >
                ✕
              </button>
            </div>

            <div className="space-y-4 text-sm">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Full Athlete Name *
                </label>
                <input
                  type="text"
                  value={editingPlayer.name}
                  onChange={(e) =>
                    setEditingPlayer({ ...editingPlayer, name: e.target.value })
                  }
                  className="w-full bg-slate-900 border border-white/10 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-amber-400"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  WhatsApp / Mobile <span className="text-slate-500 font-normal">(Optional)</span>
                </label>
                <input
                  type="tel"
                  value={editingPlayer.mobile || ''}
                  onChange={(e) =>
                    setEditingPlayer({ ...editingPlayer, mobile: e.target.value })
                  }
                  className="w-full bg-slate-900 border border-white/10 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-amber-400"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Gender *
                  </label>
                  <select
                    value={editingPlayer.gender || 'M'}
                    onChange={(e) =>
                      setEditingPlayer({ ...editingPlayer, gender: e.target.value as any })
                    }
                    className="w-full bg-slate-900 border border-white/10 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-amber-400"
                  >
                    <option value="M">Male</option>
                    <option value="F">Female</option>
                    <option value="Other">Other</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Age <span className="text-slate-500 font-normal">(Optional)</span>
                  </label>
                  <input
                    type="number"
                    min={10}
                    max={80}
                    value={editingPlayer.age || ''}
                    onChange={(e) =>
                      setEditingPlayer({
                        ...editingPlayer,
                        age: e.target.value ? parseInt(e.target.value, 10) : undefined,
                      })
                    }
                    className="w-full bg-slate-900 border border-white/10 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-amber-400"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Skill Level
                </label>
                <select
                  value={editingPlayer.skillLevel || 'Advanced'}
                  onChange={(e) =>
                    setEditingPlayer({ ...editingPlayer, skillLevel: e.target.value as any })
                  }
                  className="w-full bg-slate-900 border border-white/10 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-amber-400"
                >
                  <option value="Intermediate">Intermediate</option>
                  <option value="Advanced">Advanced</option>
                  <option value="Pro">Pro</option>
                </select>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-white/10">
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
                    showNotification(`Updated player "${editingPlayer.name}".`);
                    setEditingPlayer(null);
                  }}
                  className="px-4 py-2 text-xs font-bold bg-amber-400 text-slate-950 rounded-xl hover:bg-amber-300 transition-colors shadow"
                >
                  Save Changes
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Single Delete Confirmation */}
      <ConfirmModal
        isOpen={!!deleteTargetId}
        title="Delete Player"
        message="Are you sure you want to permanently remove this player? They will also be removed from any assigned team roster and registrations."
        confirmLabel="Delete Player"
        variant="danger"
        onConfirm={() => {
          if (deleteTargetId) {
            deletePlayer(deleteTargetId);
            showNotification('Player removed from tournament roster.');
          }
          setDeleteTargetId(null);
        }}
        onCancel={() => setDeleteTargetId(null)}
      />

      {/* Bulk Delete Confirmation Modal */}
      <ConfirmModal
        isOpen={bulkDeleteModalOpen}
        title={`Delete ${selectedPlayerIds.size} Selected Players?`}
        message={`Are you sure you want to permanently delete these ${selectedPlayerIds.size} selected players? They will be removed from team rosters and registration records without corrupting any historical match scores. This action cannot be undone.`}
        confirmLabel={`Delete ${selectedPlayerIds.size} Players`}
        variant="danger"
        onConfirm={handleConfirmBulkDelete}
        onCancel={() => setBulkDeleteModalOpen(false)}
      />
    </div>
  );
};
