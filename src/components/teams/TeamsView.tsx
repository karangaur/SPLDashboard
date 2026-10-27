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
  Shuffle,
  Check,
  X,
  AlertTriangle,
  AlertCircle,
  CheckCircle2,
  Sparkles,
} from 'lucide-react';
import { useTournament, sportsAudio } from '../../context/TournamentContext';
import { ConfirmModal } from '../common/ConfirmModal';
import { RandomCaptainsModal } from '../common/RandomCaptainsModal';
import { Team } from '../../types/tournament';

interface CaptainAssignment {
  teamId: string;
  captainId: string;
}

export const TeamsView: React.FC = () => {
  const {
    state,
    standings,
    addTeam,
    updateTeam,
    setTeams,
    deleteTeam,
    deleteTeamsBulk,
    renameTeam,
    toggleTeamLock,
    setTeamCaptain,
    setCaptainsBulk,
    triggerCelebration,
  } = useTournament();

  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [editingTeam, setEditingTeam] = useState<Team | null>(null);
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);

  // Bulk team selection
  const [selectedTeamIds, setSelectedTeamIds] = useState<Set<string>>(new Set());
  const [bulkDeleteModalOpen, setBulkDeleteModalOpen] = useState(false);
  const [notification, setNotification] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Random Captain Selection Modal States
  const [randomCaptainModalOpen, setRandomCaptainModalOpen] = useState(false);
  const [randomCaptainStep, setRandomCaptainStep] = useState<'configure' | 'preview'>('configure');
  const [captainTargetTeamIds, setCaptainTargetTeamIds] = useState<Set<string>>(new Set());
  const [overrideExistingCaptains, setOverrideExistingCaptains] = useState(true);
  const [previewAssignments, setPreviewAssignments] = useState<CaptainAssignment[]>([]);

  // Create Team Form states
  const [newTeamName, setNewTeamName] = useState('');
  const [newPlayer1, setNewPlayer1] = useState('');
  const [newPlayer2, setNewPlayer2] = useState('');
  const [newBadge, setNewBadge] = useState('🏸');

  const showNotification = (message: string, type: 'success' | 'error' = 'success') => {
    setNotification({ type, message });
    setTimeout(() => {
      setNotification((curr) => (curr?.message === message ? null : curr));
    }, 4500);
  };

  const getPlayer = (id: string) => state.players.find((p) => p.id === id);

  // Bulk Team Selection Handlers
  const isAllTeamsSelected =
    state.teams.length > 0 && state.teams.every((t) => selectedTeamIds.has(t.id));

  const handleToggleSelectTeam = (id: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    setSelectedTeamIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleToggleSelectAllTeams = () => {
    if (isAllTeamsSelected) {
      setSelectedTeamIds(new Set());
    } else {
      setSelectedTeamIds(new Set(state.teams.map((t) => t.id)));
    }
  };

  const handleClearTeamSelection = () => {
    setSelectedTeamIds(new Set());
  };

  // Dependency analysis for bulk team delete
  const selectedTeams = state.teams.filter((t) => selectedTeamIds.has(t.id));
  const assignedPlayersInSelected = selectedTeams.reduce((sum, t) => sum + t.players.length, 0);
  const relatedMatchesCount = state.matches.filter(
    (m) => selectedTeamIds.has(m.teamA) || selectedTeamIds.has(m.teamB)
  ).length;

  const handleConfirmBulkDeleteTeams = () => {
    const count = selectedTeamIds.size;
    if (count === 0) return;

    try {
      deleteTeamsBulk(Array.from(selectedTeamIds));
      setSelectedTeamIds(new Set());
      setBulkDeleteModalOpen(false);
      showNotification(
        `Successfully deleted ${count} team${count > 1 ? 's' : ''}. Players remain in your directory and are now available for new teams.`
      );
    } catch (err) {
      setBulkDeleteModalOpen(false);
      showNotification('Failed to complete team bulk deletion.', 'error');
    }
  };

  // --- Random Captain Workflow ---
  const handleOpenRandomCaptainModal = () => {
    if (state.players.length === 0) {
      showNotification('No players found in directory. Please register or add players first.', 'error');
      return;
    }

    if (state.teams.length === 0) {
      // If no teams exist yet, initialize 4 standard tournament teams
      const defaultTeams = [
        { id: crypto.randomUUID(), name: 'Thunder Smashers', players: [] as string[], badge: '⚡', locked: false, avatarColor: 'from-amber-500 to-orange-600' },
        { id: crypto.randomUUID(), name: 'Falcon Strikers', players: [] as string[], badge: '🦅', locked: false, avatarColor: 'from-sky-500 to-blue-600' },
        { id: crypto.randomUUID(), name: 'Royal Shuttlers', players: [] as string[], badge: '👑', locked: false, avatarColor: 'from-emerald-500 to-green-600' },
        { id: crypto.randomUUID(), name: 'Lightning Aces', players: [] as string[], badge: '🔥', locked: false, avatarColor: 'from-rose-500 to-pink-600' },
      ];
      setTeams(defaultTeams);
    }

    setRandomCaptainModalOpen(true);
  };

  // Run the unbiased Fisher-Yates random draw
  const generateRandomAssignments = () => {
    const targetTeams = state.teams.filter((t) => {
      if (!captainTargetTeamIds.has(t.id)) return false;
      if (!overrideExistingCaptains && t.captainId) return false;
      return true;
    });

    if (targetTeams.length === 0) {
      showNotification('No teams eligible for captain assignment based on your selection.', 'error');
      return;
    }

    if (state.players.length < targetTeams.length) {
      showNotification(
        `Insufficient players: ${targetTeams.length} teams selected, but only ${state.players.length} players available.`,
        'error'
      );
      return;
    }

    // Fisher-Yates unbiased shuffle on available players
    const shuffledPlayers = [...state.players];
    for (let i = shuffledPlayers.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffledPlayers[i], shuffledPlayers[j]] = [shuffledPlayers[j], shuffledPlayers[i]];
    }

    // Assign one unique player per target team
    const assignments: CaptainAssignment[] = targetTeams.map((team, idx) => ({
      teamId: team.id,
      captainId: shuffledPlayers[idx].id,
    }));

    setPreviewAssignments(assignments);
    setRandomCaptainStep('preview');
    sportsAudio.playScorePing();
  };

  // Manual adjustment in preview
  const handlePreviewCaptainChange = (teamId: string, newCaptainId: string) => {
    setPreviewAssignments((prev) =>
      prev.map((item) => (item.teamId === teamId ? { ...item, captainId: newCaptainId } : item))
    );
  };

  // Duplicate checks in preview
  const duplicateCaptainIds = new Set<string>();
  const seenCaptains = new Set<string>();
  previewAssignments.forEach((a) => {
    if (a.captainId) {
      if (seenCaptains.has(a.captainId)) {
        duplicateCaptainIds.add(a.captainId);
      }
      seenCaptains.add(a.captainId);
    }
  });

  const hasDuplicates = duplicateCaptainIds.size > 0;
  const hasUnassigned = previewAssignments.some((a) => !a.captainId);

  // Commit and save final assignments
  const handleSaveCaptains = () => {
    if (hasDuplicates) {
      showNotification('Cannot save: Some players are assigned as captain to multiple teams.', 'error');
      return;
    }
    if (hasUnassigned) {
      showNotification('Please select a valid captain for every team.', 'error');
      return;
    }

    setCaptainsBulk(previewAssignments);
    setRandomCaptainModalOpen(false);
    triggerCelebration();
    showNotification(
      `Successfully assigned and updated captains for ${previewAssignments.length} team${
        previewAssignments.length > 1 ? 's' : ''
      }!`
    );
  };

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
    showNotification(`Team "${newTeamName.trim()}" created successfully.`);
  };

  const badgesList = ['🏸', '🦅', '👑', '⚡', '🛡️', '🎯', '🥷', '🦁', '🔥', '🚀'];

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

        <div className="flex flex-wrap items-center gap-2">
          {/* Random Captain Selection Action */}
          <button
            onClick={handleOpenRandomCaptainModal}
            className="flex items-center gap-1.5 px-3.5 py-2.5 text-xs font-bold text-amber-300 bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/30 rounded-xl transition-all shadow-md active:scale-95"
            title="Randomly draw unique captains for teams"
          >
            <Crown className="w-4 h-4 text-amber-400" />
            <span>Draw Random Captains</span>
          </button>

          <button
            onClick={() => setCreateModalOpen(true)}
            className="flex items-center gap-1.5 px-4 py-2.5 text-xs font-bold text-slate-950 bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 rounded-xl shadow-md transition-all active:scale-95"
          >
            <Plus className="w-4 h-4" />
            <span>Add Custom Team</span>
          </button>
        </div>
      </div>

      {/* Bulk Action Bar for Teams */}
      {state.teams.length > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-2.5 rounded-2xl bg-slate-900/70 border border-white/10 text-xs text-slate-300">
          <div className="flex items-center gap-3">
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={isAllTeamsSelected}
                onChange={handleToggleSelectAllTeams}
                className="h-4 w-4 rounded border-white/20 bg-slate-800 text-amber-500 focus:ring-amber-400 focus:ring-offset-slate-950 accent-amber-500 cursor-pointer"
                aria-label="Select all teams"
              />
              <span className="font-semibold text-white">
                {isAllTeamsSelected ? 'Deselect All Teams' : 'Select All Teams'} ({state.teams.length})
              </span>
            </label>

            {selectedTeamIds.size > 0 && (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-400/15 border border-amber-400/30 text-amber-300 font-bold">
                <span>{selectedTeamIds.size}</span> team{selectedTeamIds.size > 1 ? 's' : ''} selected
              </span>
            )}
          </div>

          {selectedTeamIds.size > 0 && (
            <div className="flex items-center gap-2">
              <button
                onClick={handleClearTeamSelection}
                className="px-2.5 py-1 rounded-lg text-slate-400 hover:text-white transition-colors"
              >
                Clear Selection
              </button>

              <button
                onClick={() => setBulkDeleteModalOpen(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-bold bg-rose-600 hover:bg-rose-500 text-white shadow-md transition-all active:scale-95"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Delete Selected Teams ({selectedTeamIds.size})</span>
              </button>
            </div>
          )}
        </div>
      )}

      {/* Teams Grid */}
      {state.teams.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {state.teams.map((team) => {
            const teamStanding = standings.find((s) => s.team.id === team.id);
            const captain = team.captainId ? getPlayer(team.captainId) : undefined;
            const isSelected = selectedTeamIds.has(team.id);

            return (
              <div
                key={team.id}
                onClick={() => handleToggleSelectTeam(team.id)}
                className={`rounded-2xl glass-card border transition-all overflow-hidden flex flex-col justify-between group shadow-xl cursor-pointer select-none ${
                  isSelected
                    ? 'border-amber-400/60 bg-amber-500/10 shadow-amber-500/10'
                    : 'border-white/10 hover:border-white/20'
                }`}
              >
                <div>
                  {/* Team Card Top Strip */}
                  <div className="p-5 pb-3 border-b border-white/5 bg-gradient-to-r from-white/[0.03] to-transparent">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3 min-w-0">
                        {/* Checkbox */}
                        <div
                          onClick={(e) => handleToggleSelectTeam(team.id, e)}
                          className={`h-5 w-5 shrink-0 rounded-md border flex items-center justify-center transition-colors ${
                            isSelected
                              ? 'bg-amber-400 border-amber-400 text-slate-950'
                              : 'border-white/20 bg-slate-900/80 hover:border-white/40'
                          }`}
                        >
                          {isSelected && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                        </div>

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

                      <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
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
                    <div className="flex items-center justify-between text-[11px] font-bold uppercase tracking-wider text-slate-400">
                      <span>Squad Roster</span>
                      {captain && (
                        <span className="text-amber-400 flex items-center gap-1 font-semibold normal-case">
                          <Crown className="w-3 h-3" />
                          <span>Captain: {captain.name}</span>
                        </span>
                      )}
                    </div>

                    <div className="space-y-2" onClick={(e) => e.stopPropagation()}>
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
        <div className="rounded-3xl glass-card p-12 text-center border border-dashed border-white/10 space-y-4">
          <div className="flex h-16 w-16 mx-auto items-center justify-center rounded-2xl bg-amber-500/15 text-amber-400 text-3xl border border-amber-500/20">
            🛡️
          </div>
          <div>
            <h3 className="text-xl font-bold text-white">No Teams Formed Yet</h3>
            <p className="text-xs sm:text-sm text-slate-400 max-w-md mx-auto mt-1 leading-relaxed">
              You can create customized teams with badges or draw balanced lottery teams from your player directory using the Token Generator.
            </p>
          </div>
          <button
            onClick={() => setCreateModalOpen(true)}
            className="px-4 py-2 text-xs font-bold bg-amber-400 text-slate-950 rounded-xl hover:bg-amber-300 transition-colors shadow-md inline-flex items-center gap-1.5"
          >
            <Plus className="w-4 h-4" />
            <span>Create First Team</span>
          </button>
        </div>
      )}

      {/* Random Captain Selection Modal */}
      {randomCaptainModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-xl rounded-2xl glass-panel p-6 shadow-2xl border border-white/10 space-y-5">
            <div className="flex items-center justify-between pb-3 border-b border-white/10">
              <div className="flex items-center gap-2.5">
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-500/20 text-amber-400 text-base">
                  👑
                </span>
                <h3 className="font-bold text-white text-lg">
                  {randomCaptainStep === 'configure'
                    ? 'Random Captain Selection'
                    : 'Review & Customize Captain Assignments'}
                </h3>
              </div>
              <button
                onClick={() => setRandomCaptainModalOpen(false)}
                className="text-slate-400 hover:text-white"
                aria-label="Close"
              >
                ✕
              </button>
            </div>

            {/* Step 1: Configure Teams and Preferences */}
            {randomCaptainStep === 'configure' ? (
              <div className="space-y-5">
                <p className="text-xs text-slate-300 leading-relaxed">
                  Select which teams will participate in the random captain draw. One unique player from the tournament roster will be randomly assigned to each selected team.
                </p>

                {/* Team Selection List */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-white">Target Teams ({captainTargetTeamIds.size} of {state.teams.length})</span>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setCaptainTargetTeamIds(new Set(state.teams.map((t) => t.id)))}
                        className="text-amber-400 hover:text-amber-300 underline"
                      >
                        Select All
                      </button>
                      <span>·</span>
                      <button
                        type="button"
                        onClick={() =>
                          setCaptainTargetTeamIds(
                            new Set(state.teams.filter((t) => !t.captainId).map((t) => t.id))
                          )
                        }
                        className="text-slate-300 hover:text-white underline"
                      >
                        Teams without Captain
                      </button>
                    </div>
                  </div>

                  <div className="max-h-48 overflow-y-auto space-y-1.5 p-2 bg-slate-900/80 rounded-xl border border-white/10">
                    {state.teams.map((team) => {
                      const isChecked = captainTargetTeamIds.has(team.id);
                      const currentCap = team.captainId ? getPlayer(team.captainId) : undefined;

                      return (
                        <label
                          key={team.id}
                          className="flex items-center justify-between p-2 rounded-lg hover:bg-white/5 cursor-pointer text-xs"
                        >
                          <div className="flex items-center gap-2.5">
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={() => {
                                setCaptainTargetTeamIds((prev) => {
                                  const next = new Set(prev);
                                  if (next.has(team.id)) next.delete(team.id);
                                  else next.add(team.id);
                                  return next;
                                });
                              }}
                              className="h-4 w-4 rounded border-white/20 bg-slate-800 text-amber-500 focus:ring-amber-400 accent-amber-500 cursor-pointer"
                            />
                            <span className="text-base">{team.badge || '🏸'}</span>
                            <span className="font-semibold text-white">{team.name}</span>
                          </div>

                          <div className="text-slate-400">
                            {currentCap ? (
                              <span className="text-amber-400/90">Current: {currentCap.name}</span>
                            ) : (
                              <span className="italic text-slate-500">No captain</span>
                            )}
                          </div>
                        </label>
                      );
                    })}
                  </div>
                </div>

                {/* Preferences */}
                <div className="p-3 rounded-xl bg-white/5 border border-white/5 space-y-2">
                  <label className="flex items-center gap-2.5 cursor-pointer text-xs text-slate-300">
                    <input
                      type="checkbox"
                      checked={overrideExistingCaptains}
                      onChange={(e) => setOverrideExistingCaptains(e.target.checked)}
                      className="h-4 w-4 rounded border-white/20 bg-slate-800 text-amber-500 focus:ring-amber-400 accent-amber-500 cursor-pointer"
                    />
                    <span>Replace / reassign teams that already have a captain</span>
                  </label>
                </div>

                {/* Validation Warnings */}
                {state.players.length < captainTargetTeamIds.size ? (
                  <div className="flex items-start gap-2.5 p-3.5 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs leading-relaxed">
                    <AlertTriangle className="w-5 h-5 shrink-0 text-rose-400 mt-0.5" />
                    <div>
                      <p className="font-bold">Insufficient Players Available</p>
                      <p className="mt-0.5">
                        You have selected <strong>{captainTargetTeamIds.size} teams</strong>, but only{' '}
                        <strong>{state.players.length} players</strong> exist in the tournament directory.
                        You need at least {captainTargetTeamIds.size} unique players so every team can have a distinct captain.
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center justify-between text-xs text-slate-400 p-2.5 rounded-xl bg-white/5">
                    <span>Eligible roster pool:</span>
                    <span className="font-bold text-emerald-400">
                      {state.players.length} players available for {captainTargetTeamIds.size} selected teams
                    </span>
                  </div>
                )}

                {/* Actions */}
                <div className="flex items-center justify-end gap-2 pt-2 border-t border-white/10">
                  <button
                    type="button"
                    onClick={() => setRandomCaptainModalOpen(false)}
                    className="px-4 py-2 text-xs font-medium text-slate-400 hover:text-white"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={generateRandomAssignments}
                    disabled={
                      captainTargetTeamIds.size === 0 ||
                      state.players.length < captainTargetTeamIds.size
                    }
                    className="flex items-center gap-1.5 px-4 py-2 text-xs font-bold bg-amber-400 text-slate-950 rounded-xl hover:bg-amber-300 transition-colors shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <Shuffle className="w-3.5 h-3.5" />
                    <span>Run Random Draw & Preview →</span>
                  </button>
                </div>
              </div>
            ) : (
              /* Step 2: Interactive Preview and Customization */
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <p className="text-xs text-slate-300">
                    Review the randomly selected captains below. You can change any assignment using the dropdowns before saving.
                  </p>
                  <button
                    type="button"
                    onClick={generateRandomAssignments}
                    className="flex items-center gap-1 text-xs font-semibold text-amber-400 hover:text-amber-300 transition-colors"
                    title="Draw again"
                  >
                    <Shuffle className="w-3.5 h-3.5" />
                    <span>Re-shuffle</span>
                  </button>
                </div>

                {/* Duplication Warning */}
                {hasDuplicates && (
                  <div className="flex items-start gap-2 p-3 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs">
                    <AlertTriangle className="w-4 h-4 shrink-0 text-rose-400 mt-0.5" />
                    <span>
                      Duplicate captain detected! A player cannot be assigned as captain to more than one team.
                      Please select distinct players.
                    </span>
                  </div>
                )}

                {/* Assignments List with Selectors */}
                <div className="max-h-72 overflow-y-auto space-y-2.5 p-1 pr-2">
                  {previewAssignments.map((assignment) => {
                    const team = state.teams.find((t) => t.id === assignment.teamId);
                    if (!team) return null;
                    const isDup = duplicateCaptainIds.has(assignment.captainId);

                    return (
                      <div
                        key={team.id}
                        className={`p-3 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                          isDup
                            ? 'bg-rose-500/10 border-rose-500/40'
                            : 'bg-slate-900/80 border-white/10'
                        }`}
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <span className="text-xl">{team.badge || '🏸'}</span>
                          <span className="font-bold text-white text-sm truncate">{team.name}</span>
                        </div>

                        <div className="flex items-center gap-2 min-w-[220px]">
                          <Crown className="w-4 h-4 text-amber-400 shrink-0" />
                          <select
                            value={assignment.captainId}
                            onChange={(e) =>
                              handlePreviewCaptainChange(team.id, e.target.value)
                            }
                            className={`w-full bg-slate-800 border rounded-xl px-2.5 py-1.5 text-xs text-white focus:outline-none ${
                              isDup
                                ? 'border-rose-500 focus:border-rose-400'
                                : 'border-white/20 focus:border-amber-400'
                            }`}
                          >
                            <option value="">-- Choose Captain --</option>
                            {state.players.map((p) => {
                              const alreadyAssignedElsewhere = previewAssignments.some(
                                (pa) => pa.teamId !== team.id && pa.captainId === p.id
                              );
                              return (
                                <option key={p.id} value={p.id}>
                                  {p.name} {alreadyAssignedElsewhere ? '(Assigned)' : ''}
                                </option>
                              );
                            })}
                          </select>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Preview Actions */}
                <div className="flex items-center justify-between pt-3 border-t border-white/10">
                  <button
                    type="button"
                    onClick={() => setRandomCaptainStep('configure')}
                    className="px-3 py-1.5 text-xs font-semibold text-slate-300 hover:text-white"
                  >
                    ← Back to Setup
                  </button>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setRandomCaptainModalOpen(false)}
                      className="px-4 py-2 text-xs font-medium text-slate-400 hover:text-white"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={handleSaveCaptains}
                      disabled={hasDuplicates || hasUnassigned}
                      className="flex items-center gap-1.5 px-4 py-2 text-xs font-bold bg-amber-400 text-slate-950 rounded-xl hover:bg-amber-300 transition-colors shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <Check className="w-4 h-4 stroke-[3]" />
                      <span>Confirm & Save Captains</span>
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
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
                aria-label="Close"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateTeam} className="space-y-4 text-sm">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Team Name *
                </label>
                <input
                  type="text"
                  placeholder="e.g. Thunder Smashers"
                  value={newTeamName}
                  onChange={(e) => setNewTeamName(e.target.value)}
                  className="w-full bg-slate-900 border border-white/10 rounded-xl px-3 py-2 text-white placeholder-slate-500 focus:outline-none focus:border-amber-400"
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
                        newBadge === b
                          ? 'bg-amber-400/20 border border-amber-400'
                          : 'bg-white/5 hover:bg-white/10'
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
                    className="w-full bg-slate-900 border border-white/10 rounded-xl px-3 py-2 text-white text-xs focus:outline-none focus:border-amber-400"
                  >
                    <option value="">Select Player (Optional)</option>
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
                    className="w-full bg-slate-900 border border-white/10 rounded-xl px-3 py-2 text-white text-xs focus:outline-none focus:border-amber-400"
                  >
                    <option value="">Select Player (Optional)</option>
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

              <div className="flex justify-end gap-2 pt-3 border-t border-white/10">
                <button
                  type="button"
                  onClick={() => setCreateModalOpen(false)}
                  className="px-4 py-2 text-xs font-medium text-slate-400 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-xs font-bold bg-amber-400 text-slate-950 rounded-xl hover:bg-amber-300 transition-colors shadow"
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
                aria-label="Close"
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
                  className="w-full bg-slate-900 border border-white/10 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-amber-400"
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

              <div className="flex justify-end gap-2 pt-3 border-t border-white/10">
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
                    showNotification(`Updated team "${editingTeam.name}".`);
                    setEditingTeam(null);
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
        title="Delete Team"
        message="Are you sure you want to delete this team? Players assigned to this team will not be deleted and will return to the unassigned player pool. Any unplayed fixtures involving this team will also be removed."
        confirmLabel="Delete Team"
        variant="danger"
        onConfirm={() => {
          if (deleteTargetId) {
            deleteTeam(deleteTargetId);
            showNotification('Team deleted successfully. Players returned to roster pool.');
          }
          setDeleteTargetId(null);
        }}
        onCancel={() => setDeleteTargetId(null)}
      />

      {/* Bulk Delete Teams Confirmation Modal */}
      <ConfirmModal
        isOpen={bulkDeleteModalOpen}
        title={`Delete ${selectedTeamIds.size} Selected Teams?`}
        message={`Are you sure you want to delete these ${selectedTeamIds.size} team(s)?\n\n• ${assignedPlayersInSelected} player(s) in these squads will NOT be deleted — they will safely return to your unassigned player pool.\n• ${relatedMatchesCount} associated match fixture(s) will be removed.\n\nThis operation is immediate and consistent.`}
        confirmLabel={`Delete ${selectedTeamIds.size} Teams`}
        variant="danger"
        onConfirm={handleConfirmBulkDeleteTeams}
        onCancel={() => setBulkDeleteModalOpen(false)}
      />

      {/* Interactive Random Captain Selection Modal */}
      <RandomCaptainsModal
        isOpen={randomCaptainModalOpen}
        onClose={() => setRandomCaptainModalOpen(false)}
        teams={state.teams}
        players={state.players}
        onConfirmCaptains={(assignments) => {
          setCaptainsBulk(assignments);
          triggerCelebration();
          showNotification(
            `Successfully assigned unique captains to ${assignments.length} teams!`
          );
        }}
      />
    </div>
  );
};
