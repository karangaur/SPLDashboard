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
  Eye,
  Phone,
  MapPin,
  Sparkles,
  Crown,
  Tag,
  Filter,
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
    assignPlayerToTeam,
    removePlayerFromTeam,
  } = useTournament();

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSkill, setSelectedSkill] = useState<string>('all');
  const [teamFilter, setTeamFilter] = useState<'all' | 'assigned' | 'unassigned'>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'approved' | 'pending' | 'direct'>('all');

  const [addModalOpen, setAddModalOpen] = useState(false);
  const [bulkModalOpen, setBulkModalOpen] = useState(false);
  const [editingPlayer, setEditingPlayer] = useState<Player | null>(null);
  const [selectedPlayerDetails, setSelectedPlayerDetails] = useState<Player | null>(null);
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);

  // Bulk selection state
  const [selectedPlayerIds, setSelectedPlayerIds] = useState<Set<string>>(new Set());
  const [bulkDeleteModalOpen, setBulkDeleteModalOpen] = useState(false);
  const [notification, setNotification] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // New player form
  const [newName, setNewName] = useState('');
  const [newMobile, setNewMobile] = useState('');
  const [newAge, setNewAge] = useState<number | ''>('');
  const [newGender, setNewGender] = useState<'M' | 'F' | 'Other'>('M');
  const [newSkill, setNewSkill] = useState<'Intermediate' | 'Advanced' | 'Pro'>('Advanced');
  const [newCity, setNewCity] = useState('');
  const [newCategory, setNewCategory] = useState('Doubles');
  const [newStyle, setNewStyle] = useState('All-Rounder');

  // Bulk add text
  const [bulkNames, setBulkNames] = useState('');

  const showNotification = (message: string, type: 'success' | 'error' = 'success') => {
    setNotification({ type, message });
    setTimeout(() => {
      setNotification((curr) => (curr?.message === message ? null : curr));
    }, 4500);
  };

  const getTeamForPlayer = (playerId: string) => {
    return state.teams.find((t) => t.players.includes(playerId));
  };

  const getRegistrationForPlayer = (player: Player) => {
    return state.registrations.find(
      (r) =>
        r.playerId === player.id ||
        (player.registrationId && r.regId === player.registrationId) ||
        (player.mobile && r.mobile && r.mobile.replace(/\D/g, '') === player.mobile.replace(/\D/g, ''))
    );
  };

  const getPlayerEffectiveStatus = (player: Player): { label: string; badgeClass: string; type: string } => {
    const reg = getRegistrationForPlayer(player);
    if (reg) {
      if (reg.status === 'approved' || reg.status === 'paid') {
        return {
          label: 'Approved Applicant',
          badgeClass: 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30',
          type: 'approved',
        };
      }
      if (reg.status === 'pending') {
        return {
          label: 'Pending Approval',
          badgeClass: 'bg-amber-500/15 text-amber-400 border border-amber-500/30',
          type: 'pending',
        };
      }
      if (reg.status === 'rejected') {
        return {
          label: 'Rejected Entry',
          badgeClass: 'bg-rose-500/15 text-rose-400 border border-rose-500/30',
          type: 'rejected',
        };
      }
    }

    if (player.registrationStatus === 'approved') {
      return {
        label: 'Approved Athlete',
        badgeClass: 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30',
        type: 'approved',
      };
    }
    if (player.registrationStatus === 'pending') {
      return {
        label: 'Pending Vetting',
        badgeClass: 'bg-amber-500/15 text-amber-400 border border-amber-500/30',
        type: 'pending',
      };
    }

    return {
      label: 'Direct Entry',
      badgeClass: 'bg-blue-500/15 text-blue-400 border border-blue-500/30',
      type: 'direct',
    };
  };

  const filteredPlayers = state.players.filter((p) => {
    const q = searchQuery.toLowerCase().trim();
    if (q) {
      const matchName = p.name.toLowerCase().includes(q);
      const matchMobile = p.mobile ? p.mobile.includes(q) : false;
      const matchCity = p.city ? p.city.toLowerCase().includes(q) : false;
      const team = getTeamForPlayer(p.id);
      const matchTeam = team ? team.name.toLowerCase().includes(q) : false;
      if (!matchName && !matchMobile && !matchCity && !matchTeam) return false;
    }

    if (selectedSkill !== 'all' && p.skillLevel !== selectedSkill) {
      return false;
    }

    const team = getTeamForPlayer(p.id);
    if (teamFilter === 'assigned' && !team) return false;
    if (teamFilter === 'unassigned' && team) return false;

    const statusInfo = getPlayerEffectiveStatus(p);
    if (statusFilter !== 'all' && statusInfo.type !== statusFilter) return false;

    return true;
  });

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
      setSelectedPlayerIds((prev) => {
        const next = new Set(prev);
        filteredPlayers.forEach((p) => next.delete(p.id));
        return next;
      });
    } else {
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
        `Successfully deleted ${count} player${count > 1 ? 's' : ''} from centralized Supabase database.`
      );
    } catch {
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
      city: newCity.trim() || undefined,
      category: newCategory,
      style: newStyle,
      registrationStatus: 'direct',
    });

    setAddModalOpen(false);
    setNewName('');
    setNewMobile('');
    setNewAge('');
    setNewCity('');
    showNotification(`Player "${newName.trim()}" added to tournament directory.`);
  };

  const handleBulkAdd = (e: React.FormEvent) => {
    e.preventDefault();
    const names = bulkNames
      .split(/[\n,]/)
      .map((s) => s.trim())
      .filter(Boolean);

    if (names.length > 0) {
      bulkAddPlayers(names);
      showNotification(`Added ${names.length} players to the centralized tournament database.`);
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
            {state.players.length} registered badminton athletes in {state.settings.name}. Synchronized with Supabase.
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

      {/* Search & Multiple Filter Toolbar */}
      {state.players.length > 0 && (
        <div className="p-4 rounded-2xl glass-panel space-y-3">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
            <div className="relative flex-1">
              <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Search athletes by name, mobile, city, or team..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-slate-900/80 border border-white/10 rounded-xl pl-9 pr-4 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-amber-400/50"
              />
            </div>

            {/* Skill Level Filter */}
            <div className="flex items-center gap-1 overflow-x-auto p-1 bg-white/5 rounded-xl shrink-0">
              {['all', 'Pro', 'Advanced', 'Intermediate'].map((sk) => (
                <button
                  key={sk}
                  onClick={() => setSelectedSkill(sk)}
                  className={`px-2.5 py-1 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap shrink-0 ${
                    selectedSkill === sk
                      ? 'bg-amber-400 text-slate-950 shadow font-bold'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  {sk === 'all' ? 'All Skills' : sk}
                </button>
              ))}
            </div>
          </div>

          {/* Secondary Filter Chips: Team Status & Registration Status */}
          <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-white/5 text-xs text-slate-400">
            <div className="flex flex-wrap items-center gap-2">
              <span className="flex items-center gap-1 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                <Filter className="w-3 h-3 text-slate-400" />
                <span>Filters:</span>
              </span>

              {/* Team Assignment Filter */}
              <div className="flex items-center gap-1 bg-black/30 p-0.5 rounded-lg border border-white/5">
                <button
                  onClick={() => setTeamFilter('all')}
                  className={`px-2 py-0.5 rounded text-[11px] font-medium transition-colors ${
                    teamFilter === 'all' ? 'bg-white/15 text-white' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  All Rosters
                </button>
                <button
                  onClick={() => setTeamFilter('assigned')}
                  className={`px-2 py-0.5 rounded text-[11px] font-medium transition-colors ${
                    teamFilter === 'assigned' ? 'bg-amber-500/20 text-amber-300 font-bold' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Assigned
                </button>
                <button
                  onClick={() => setTeamFilter('unassigned')}
                  className={`px-2 py-0.5 rounded text-[11px] font-medium transition-colors ${
                    teamFilter === 'unassigned' ? 'bg-blue-500/20 text-blue-300 font-bold' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Unassigned
                </button>
              </div>

              {/* Registration Status Filter */}
              <div className="flex items-center gap-1 bg-black/30 p-0.5 rounded-lg border border-white/5">
                <button
                  onClick={() => setStatusFilter('all')}
                  className={`px-2 py-0.5 rounded text-[11px] font-medium transition-colors ${
                    statusFilter === 'all' ? 'bg-white/15 text-white' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  All Statuses
                </button>
                <button
                  onClick={() => setStatusFilter('approved')}
                  className={`px-2 py-0.5 rounded text-[11px] font-medium transition-colors ${
                    statusFilter === 'approved' ? 'bg-emerald-500/20 text-emerald-300 font-bold' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Approved
                </button>
                <button
                  onClick={() => setStatusFilter('pending')}
                  className={`px-2 py-0.5 rounded text-[11px] font-medium transition-colors ${
                    statusFilter === 'pending' ? 'bg-amber-500/20 text-amber-300 font-bold' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Pending
                </button>
                <button
                  onClick={() => setStatusFilter('direct')}
                  className={`px-2 py-0.5 rounded text-[11px] font-medium transition-colors ${
                    statusFilter === 'direct' ? 'bg-blue-500/20 text-blue-300 font-bold' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Direct Entry
                </button>
              </div>
            </div>

            {(searchQuery || selectedSkill !== 'all' || teamFilter !== 'all' || statusFilter !== 'all') && (
              <button
                onClick={() => {
                  setSearchQuery('');
                  setSelectedSkill('all');
                  setTeamFilter('all');
                  setStatusFilter('all');
                }}
                className="text-[11px] text-amber-400 hover:underline font-semibold"
              >
                Reset All Filters
              </button>
            )}
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
            const statusInfo = getPlayerEffectiveStatus(player);
            const reg = getRegistrationForPlayer(player);

            return (
              <div
                key={player.id}
                onClick={() => handleToggleSelectPlayer(player.id)}
                className={`rounded-2xl glass-card p-4 border transition-all flex flex-col justify-between space-y-3 cursor-pointer select-none ${
                  isSelected
                    ? 'border-amber-400/60 bg-amber-500/10 shadow-lg shadow-amber-500/5'
                    : 'border-white/5 hover:border-white/15'
                }`}
              >
                <div className="space-y-3">
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
                        <div className="flex items-center gap-1.5 text-xs text-slate-400 mt-0.5">
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
                      {/* View Details */}
                      <button
                        onClick={() => setSelectedPlayerDetails(player)}
                        title="View Full Profile"
                        aria-label={`View details of ${player.name}`}
                        className="p-1.5 text-slate-400 hover:text-amber-400 hover:bg-white/10 rounded-lg transition-colors"
                      >
                        <Eye className="w-3.5 h-3.5" />
                      </button>

                      {/* Edit */}
                      <button
                        onClick={() => setEditingPlayer(player)}
                        title="Edit Player"
                        aria-label={`Edit ${player.name}`}
                        className="p-1.5 text-slate-400 hover:text-slate-200 hover:bg-white/10 rounded-lg transition-colors"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>

                      {/* Delete */}
                      <button
                        onClick={() => setDeleteTargetId(player.id)}
                        title="Delete Player"
                        aria-label={`Delete ${player.name}`}
                        className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition-colors"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* Status & Attributes Badges */}
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${statusInfo.badgeClass}`}>
                      <span>●</span>
                      <span>{statusInfo.label}</span>
                    </span>

                    {reg?.regId && (
                      <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-mono text-slate-400 bg-white/5 border border-white/5">
                        {reg.regId}
                      </span>
                    )}

                    {player.city && (
                      <span className="inline-flex items-center gap-0.5 text-[10px] text-slate-400 bg-white/5 px-1.5 py-0.5 rounded">
                        <MapPin className="w-2.5 h-2.5 text-slate-500" />
                        <span>{player.city}</span>
                      </span>
                    )}
                  </div>
                </div>

                {/* Team Affiliation & Mobile Footer */}
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
                    <span className="text-slate-400 font-mono text-[11px] flex items-center gap-1">
                      <Phone className="w-2.5 h-2.5 text-slate-500" />
                      <span>{player.mobile}</span>
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
            Try adjusting your search query, skill level, or registration status filters.
          </p>
          <button
            onClick={() => {
              setSearchQuery('');
              setSelectedSkill('all');
              setTeamFilter('all');
              setStatusFilter('all');
            }}
            className="px-3 py-1.5 text-xs font-semibold text-slate-300 hover:text-white bg-white/5 hover:bg-white/10 rounded-xl"
          >
            Clear Filters
          </button>
        </div>
      )}

      {/* VIEW PLAYER DETAILS MODAL */}
      {selectedPlayerDetails && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in overflow-y-auto">
          <div className="max-w-md w-full rounded-3xl glass-panel p-6 border border-white/10 shadow-2xl space-y-5 my-auto">
            <div className="flex items-start justify-between pb-3 border-b border-white/10">
              <div className="flex items-center gap-3">
                <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-tr from-amber-500/20 to-orange-500/30 border border-amber-500/30 font-black text-amber-300 text-lg">
                  {selectedPlayerDetails.name.slice(0, 2).toUpperCase()}
                </span>
                <div>
                  <h3 className="font-bold text-white text-lg">{selectedPlayerDetails.name}</h3>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${getPlayerEffectiveStatus(selectedPlayerDetails).badgeClass}`}>
                      {getPlayerEffectiveStatus(selectedPlayerDetails).label}
                    </span>
                    {selectedPlayerDetails.registrationId && (
                      <span className="text-[10px] text-amber-400 font-mono">
                        {selectedPlayerDetails.registrationId}
                      </span>
                    )}
                  </div>
                </div>
              </div>
              <button
                onClick={() => setSelectedPlayerDetails(null)}
                className="text-slate-400 hover:text-white p-1"
              >
                ✕
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="p-3 rounded-xl bg-white/5 space-y-1">
                <span className="text-slate-400 text-[10px] uppercase block">Mobile Number</span>
                <span className="font-mono font-bold text-white block">
                  {selectedPlayerDetails.mobile ? `+91 ${selectedPlayerDetails.mobile}` : 'Not provided'}
                </span>
              </div>

              <div className="p-3 rounded-xl bg-white/5 space-y-1">
                <span className="text-slate-400 text-[10px] uppercase block">Age / Gender</span>
                <span className="font-bold text-white block">
                  {selectedPlayerDetails.age ? `${selectedPlayerDetails.age} yrs` : 'Unspecified'} · {selectedPlayerDetails.gender === 'F' ? 'Female' : 'Male'}
                </span>
              </div>

              <div className="p-3 rounded-xl bg-white/5 space-y-1">
                <span className="text-slate-400 text-[10px] uppercase block">Skill Level</span>
                <span className="font-bold text-amber-400 block">{selectedPlayerDetails.skillLevel || 'Advanced'}</span>
              </div>

              <div className="p-3 rounded-xl bg-white/5 space-y-1">
                <span className="text-slate-400 text-[10px] uppercase block">City / Locality</span>
                <span className="font-bold text-white block">{selectedPlayerDetails.city || 'Maharajganj'}</span>
              </div>

              <div className="p-3 rounded-xl bg-white/5 space-y-1">
                <span className="text-slate-400 text-[10px] uppercase block">Preferred Category</span>
                <span className="font-bold text-white block">{selectedPlayerDetails.category || 'Doubles'}</span>
              </div>

              <div className="p-3 rounded-xl bg-white/5 space-y-1">
                <span className="text-slate-400 text-[10px] uppercase block">Playing Style</span>
                <span className="font-bold text-white block">{selectedPlayerDetails.style || 'All-Rounder'}</span>
              </div>
            </div>

            {/* Team Affiliation Status */}
            <div className="p-3.5 rounded-2xl bg-white/[0.03] border border-white/5 space-y-1.5">
              <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider block">
                Team Affiliation
              </span>
              {(() => {
                const team = getTeamForPlayer(selectedPlayerDetails.id);
                if (team) {
                  const isCap = team.captainId === selectedPlayerDetails.id;
                  return (
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-xl">{team.badge || '🏸'}</span>
                        <div>
                          <span className="font-bold text-white block">{team.name}</span>
                          <span className="text-[11px] text-slate-400">
                            {isCap ? '👑 Team Captain' : 'Squad Player'}
                          </span>
                        </div>
                      </div>
                      <button
                        onClick={() => {
                          removePlayerFromTeam(team.id, selectedPlayerDetails.id);
                          showNotification(`Removed ${selectedPlayerDetails.name} from ${team.name}.`);
                        }}
                        className="text-xs text-rose-400 hover:text-rose-300 font-semibold px-2 py-1 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 transition-colors"
                      >
                        Unassign
                      </button>
                    </div>
                  );
                }
                return (
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-slate-400 italic">Not currently assigned to any team.</span>
                    <select
                      onChange={(e) => {
                        if (e.target.value) {
                          assignPlayerToTeam(e.target.value, selectedPlayerDetails.id);
                          const t = state.teams.find((x) => x.id === e.target.value);
                          showNotification(`Assigned ${selectedPlayerDetails.name} to ${t?.name}.`);
                        }
                      }}
                      className="bg-slate-900 border border-white/20 rounded-lg px-2 py-1 text-xs text-amber-300 focus:outline-none"
                    >
                      <option value="">Assign To Team...</option>
                      {state.teams.map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.name}
                        </option>
                      ))}
                    </select>
                  </div>
                );
              })()}
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-white/10">
              <button
                onClick={() => {
                  setEditingPlayer(selectedPlayerDetails);
                  setSelectedPlayerDetails(null);
                }}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-slate-200 hover:text-white bg-white/10 hover:bg-white/15 rounded-xl transition-colors"
              >
                <Edit2 className="w-3.5 h-3.5" />
                <span>Edit Profile</span>
              </button>
              <button
                onClick={() => setSelectedPlayerDetails(null)}
                className="px-4 py-1.5 text-xs font-bold text-slate-950 bg-amber-400 hover:bg-amber-300 rounded-xl transition-colors shadow"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Single Player Modal */}
      {addModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-sm animate-fade-in overflow-y-auto">
          <div className="w-full max-w-md max-h-[90dvh] overflow-y-auto rounded-2xl glass-panel p-5 sm:p-6 shadow-2xl border border-white/10 space-y-4 my-auto">
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

            <form onSubmit={handleAddPlayer} className="space-y-3.5 text-sm">
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
                  placeholder="e.g. 9876543210"
                  value={newMobile}
                  onChange={(e) => setNewMobile(e.target.value)}
                  className="w-full bg-slate-900 border border-white/10 rounded-xl px-3 py-2 text-white placeholder-slate-500 focus:outline-none focus:border-amber-400"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Skill Level
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

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    City / Locality
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Maharajganj"
                    value={newCity}
                    onChange={(e) => setNewCity(e.target.value)}
                    className="w-full bg-slate-900 border border-white/10 rounded-xl px-3 py-2 text-white placeholder-slate-500 focus:outline-none focus:border-amber-400"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Preferred Category
                  </label>
                  <select
                    value={newCategory}
                    onChange={(e) => setNewCategory(e.target.value)}
                    className="w-full bg-slate-900 border border-white/10 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-amber-400"
                  >
                    <option value="Doubles">Doubles</option>
                    <option value="Singles">Singles</option>
                    <option value="Mixed Doubles">Mixed Doubles</option>
                    <option value="Both">Both</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Playing Style
                  </label>
                  <select
                    value={newStyle}
                    onChange={(e) => setNewStyle(e.target.value)}
                    className="w-full bg-slate-900 border border-white/10 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-amber-400"
                  >
                    <option value="All-Rounder">All-Rounder</option>
                    <option value="Attacking">Attacking</option>
                    <option value="Defensive">Defensive</option>
                    <option value="Net Play">Net Play</option>
                  </select>
                </div>
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
              Paste or type athlete names separated by commas or new lines. Each player will be added to the Supabase database.
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-sm animate-fade-in overflow-y-auto">
          <div className="w-full max-w-md rounded-2xl glass-panel p-5 sm:p-6 shadow-2xl border border-white/10 space-y-4 my-auto max-h-[90dvh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-white/10">
              <h3 className="font-bold text-white text-base sm:text-lg">Edit Player Details</h3>
              <button
                onClick={() => setEditingPlayer(null)}
                className="w-10 h-10 flex items-center justify-center rounded-lg text-slate-400 hover:text-white hover:bg-white/5 transition-colors"
                aria-label="Close"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3.5 text-sm">
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

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    City / Locality
                  </label>
                  <input
                    type="text"
                    value={editingPlayer.city || ''}
                    onChange={(e) =>
                      setEditingPlayer({ ...editingPlayer, city: e.target.value })
                    }
                    className="w-full bg-slate-900 border border-white/10 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-amber-400"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Category
                  </label>
                  <select
                    value={editingPlayer.category || 'Doubles'}
                    onChange={(e) =>
                      setEditingPlayer({ ...editingPlayer, category: e.target.value })
                    }
                    className="w-full bg-slate-900 border border-white/10 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-amber-400"
                  >
                    <option value="Doubles">Doubles</option>
                    <option value="Singles">Singles</option>
                    <option value="Mixed Doubles">Mixed Doubles</option>
                    <option value="Both">Both</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Playing Style
                  </label>
                  <select
                    value={editingPlayer.style || 'All-Rounder'}
                    onChange={(e) =>
                      setEditingPlayer({ ...editingPlayer, style: e.target.value })
                    }
                    className="w-full bg-slate-900 border border-white/10 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-amber-400"
                  >
                    <option value="All-Rounder">All-Rounder</option>
                    <option value="Attacking">Attacking</option>
                    <option value="Defensive">Defensive</option>
                    <option value="Net Play">Net Play</option>
                  </select>
                </div>
              </div>

              <div className="flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-end gap-2 pt-2 border-t border-white/10">
                <button
                  type="button"
                  onClick={() => setEditingPlayer(null)}
                  className="px-4 py-2.5 min-h-[44px] rounded-xl text-xs font-medium text-slate-400 hover:text-white hover:bg-white/5 transition-colors text-center"
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
                  className="px-5 py-2.5 min-h-[44px] text-xs font-bold bg-amber-400 text-slate-950 rounded-xl hover:bg-amber-300 transition-colors shadow flex items-center justify-center"
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
        message="Are you sure you want to permanently remove this player? They will also be removed from any assigned team roster and registrations in Supabase."
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
        message={`Are you sure you want to permanently delete these ${selectedPlayerIds.size} selected players? They will be removed from team rosters and registration records in the centralized Supabase database without corrupting any historical match scores. This action cannot be undone.`}
        confirmLabel={`Delete ${selectedPlayerIds.size} Players`}
        variant="danger"
        onConfirm={handleConfirmBulkDelete}
        onCancel={() => setBulkDeleteModalOpen(false)}
      />
    </div>
  );
};
