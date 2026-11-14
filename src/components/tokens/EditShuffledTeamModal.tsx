import React, { useMemo, useState, useEffect } from 'react';
import {
  X,
  UserCheck,
  ArrowLeftRight,
  Lock,
  Unlock,
  ShieldAlert,
  AlertTriangle,
  CheckCircle2,
  Crown,
  Search,
  Sparkles,
  Users,
  RefreshCw,
  ShieldCheck,
} from 'lucide-react';
import {
  KnockoutMatch,
  Match,
  Player,
  PredefinedTeam,
  Team,
} from '../../types/tournament';
import {
  computeManualTeamEdit,
  ManualTeamEditInput,
  ManualTeamEditPreviewResult,
} from '../../utils/manualTeamEditEngine';

interface EditShuffledTeamModalProps {
  isOpen: boolean;
  team: Team | null;
  allTeams: Team[];
  allPlayers: Player[];
  predefinedTeams: PredefinedTeam[];
  teamFormationMode: 'random' | 'predefined' | 'mixed';
  matches: Match[];
  knockoutMatches: KnockoutMatch[];
  onClose: () => void;
  onSave: (
    input: ManualTeamEditInput
  ) => Promise<{
    success: boolean;
    conflict?: boolean;
    error?: string;
    preview?: ManualTeamEditPreviewResult;
  }>;
}

type PlayerFilterMode = 'all' | 'unassigned' | 'assigned';

export const EditShuffledTeamModal: React.FC<EditShuffledTeamModalProps> = ({
  isOpen,
  team,
  allTeams,
  allPlayers,
  predefinedTeams,
  teamFormationMode,
  matches,
  knockoutMatches,
  onClose,
  onSave,
}) => {
  const [proposedPlayers, setProposedPlayers] = useState<string[]>([]);
  const [proposedCaptainId, setProposedCaptainId] = useState<string>('');
  const [customTeamName, setCustomTeamName] = useState<string>('');
  const [isCustomNameEdited, setIsCustomNameEdited] = useState<boolean>(false);
  const [lockAction, setLockAction] = useState<'keep' | 'unlock'>('keep');
  const [authorizeLockedEdit, setAuthorizeLockedEdit] = useState<boolean>(false);
  const [acknowledgeFixtureWarning, setAcknowledgeFixtureWarning] = useState<boolean>(false);

  const [activeSlotIndex, setActiveSlotIndex] = useState<number>(0);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [filterMode, setFilterMode] = useState<PlayerFilterMode>('all');
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen && team) {
      const initialPlayers =
        team.players && team.players.length >= 2
          ? [...team.players]
          : [team.players?.[0] || '', team.players?.[1] || ''];
      setProposedPlayers(initialPlayers);
      setProposedCaptainId(team.captainId || initialPlayers[0] || '');
      setCustomTeamName(team.name || '');
      setIsCustomNameEdited(false);
      setLockAction('keep');
      setAuthorizeLockedEdit(false);
      setAcknowledgeFixtureWarning(false);
      setActiveSlotIndex(0);
      setSearchQuery('');
      setFilterMode('all');
      setIsSaving(false);
      setSubmitError(null);
    }
  }, [isOpen, team?.id]);

  const playersById = useMemo(() => {
    const map = new Map<string, Player>();
    for (const p of allPlayers) {
      if (p && p.id) map.set(p.id, p);
    }
    return map;
  }, [allPlayers]);

  // Map playerId -> Team they currently belong to (before edit)
  const currentTeamByPlayerId = useMemo(() => {
    const map = new Map<string, Team>();
    for (const t of allTeams) {
      for (const pid of t.players || []) {
        if (pid) map.set(pid, t);
      }
    }
    return map;
  }, [allTeams]);

  // Map playerId -> PredefinedTeam they belong to
  const predefinedByPlayerId = useMemo(() => {
    const map = new Map<string, PredefinedTeam>();
    for (const pt of predefinedTeams || []) {
      for (const pid of pt.players || []) {
        if (pid) map.set(pid, pt);
      }
    }
    return map;
  }, [predefinedTeams]);

  // Live preview & validation computation
  const preview = useMemo(() => {
    if (!team) return null;
    return computeManualTeamEdit(
      {
        primaryTeamId: team.id,
        proposedPlayers,
        proposedCaptainId,
        proposedTeamName: isCustomNameEdited ? customTeamName : undefined,
        lockAction,
        authorizeLockedEdit,
        acknowledgeFixtureWarning,
      },
      {
        teams: allTeams,
        players: allPlayers,
        predefinedTeams,
        teamFormationMode,
        matches,
        knockoutMatches,
      }
    );
  }, [
    team,
    proposedPlayers,
    proposedCaptainId,
    isCustomNameEdited,
    customTeamName,
    lockAction,
    authorizeLockedEdit,
    acknowledgeFixtureWarning,
    allTeams,
    allPlayers,
    predefinedTeams,
    teamFormationMode,
    matches,
    knockoutMatches,
  ]);

  // Sync displayed team name if auto-derived and admin hasn't typed a custom name
  useEffect(() => {
    if (!isCustomNameEdited && preview?.primaryTeamAfter?.name) {
      setCustomTeamName(preview.primaryTeamAfter.name);
    }
  }, [preview?.primaryTeamAfter?.name, isCustomNameEdited]);

  const filteredPlayers = useMemo(() => {
    if (!team) return [];
    const q = searchQuery.trim().toLowerCase();
    return allPlayers.filter((p) => {
      const assignedTeam = currentTeamByPlayerId.get(p.id);
      const isUnassigned = !assignedTeam;
      const isInOtherTeam = Boolean(assignedTeam && assignedTeam.id !== team.id);

      if (filterMode === 'unassigned' && !isUnassigned) return false;
      if (filterMode === 'assigned' && !isInOtherTeam) return false;

      if (!q) return true;
      const teamNameMatch = assignedTeam?.name?.toLowerCase().includes(q);
      const tokenMatch = assignedTeam?.token
        ? `token ${assignedTeam.token.toLowerCase()}`.includes(q)
        : false;
      return (
        p.name.toLowerCase().includes(q) ||
        (p.skillLevel || '').toLowerCase().includes(q) ||
        Boolean(teamNameMatch) ||
        Boolean(tokenMatch)
      );
    });
  }, [allPlayers, team, currentTeamByPlayerId, filterMode, searchQuery]);

  if (!isOpen || !team || !preview) return null;

  const modeLabel =
    teamFormationMode === 'random'
      ? 'Random Formation'
      : teamFormationMode === 'predefined'
      ? 'Pre-Decided Teams'
      : 'Mixed Mode';

  const handleSelectPlayerForSlot = (slotIdx: number, selectedPlayerId: string) => {
    setSubmitError(null);
    if (!selectedPlayerId) return;

    setProposedPlayers((prev) => {
      const next = [...prev];
      const existingIdxInSameTeam = next.indexOf(selectedPlayerId);

      // If player is already in the other slot of this same team, swap their slot positions cleanly
      if (existingIdxInSameTeam !== -1 && existingIdxInSameTeam !== slotIdx) {
        const currentAtSlot = next[slotIdx];
        next[slotIdx] = selectedPlayerId;
        next[existingIdxInSameTeam] = currentAtSlot;
        return next;
      }

      next[slotIdx] = selectedPlayerId;
      return next;
    });

    // Ensure captainId remains valid on the team
    setProposedCaptainId((prevCap) => {
      const nextRoster = [...proposedPlayers];
      const existingIdx = nextRoster.indexOf(selectedPlayerId);
      if (existingIdx !== -1 && existingIdx !== slotIdx) {
        const tmp = nextRoster[slotIdx];
        nextRoster[slotIdx] = selectedPlayerId;
        nextRoster[existingIdx] = tmp;
      } else {
        nextRoster[slotIdx] = selectedPlayerId;
      }
      if (prevCap && nextRoster.includes(prevCap)) return prevCap;
      return nextRoster[0] || selectedPlayerId;
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError(null);

    if (!preview.hasChanges) {
      onClose();
      return;
    }

    if (!preview.valid) {
      setSubmitError(preview.error || 'Please resolve validation warnings before saving.');
      return;
    }

    setIsSaving(true);
    try {
      const res = await onSave({
        primaryTeamId: team.id,
        proposedPlayers,
        proposedCaptainId,
        proposedTeamName: isCustomNameEdited ? customTeamName.trim() : preview.primaryTeamAfter?.name,
        lockAction,
        authorizeLockedEdit,
        acknowledgeFixtureWarning,
      });

      if (!res.success) {
        setSubmitError(res.error || 'Failed to update team members. Please try again.');
        setIsSaving(false);
        return;
      }

      setIsSaving(false);
      onClose();
    } catch (err: any) {
      setSubmitError(err?.message || 'Unexpected error while saving team changes.');
      setIsSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[120] flex items-center justify-center p-3 sm:p-4 bg-slate-950/85 backdrop-blur-md animate-fadeIn overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-labelledby="edit-shuffled-team-title"
    >
      <div className="relative w-full max-w-3xl bg-slate-900 border border-amber-500/30 rounded-3xl shadow-2xl shadow-black/70 overflow-hidden my-auto max-h-[92vh] flex flex-col">
        {/* Top Championship Accent Line */}
        <div className="h-1.5 w-full bg-gradient-to-r from-amber-500 via-orange-500 to-violet-500 shrink-0" />

        {/* Modal Header */}
        <div className="px-5 py-4 sm:px-6 sm:py-5 border-b border-slate-800/90 flex items-start justify-between gap-4 bg-slate-900/95 shrink-0">
          <div className="flex items-center gap-3.5 min-w-0">
            <div
              className={`w-12 h-12 rounded-2xl bg-gradient-to-br ${
                team.avatarColor || 'from-amber-500 to-orange-600'
              } flex items-center justify-center text-2xl shadow-lg shrink-0 border border-white/15`}
            >
              {team.badge || '🏸'}
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2 mb-1">
                {team.token && (
                  <span className="px-2.5 py-0.5 rounded-lg text-[11px] font-black tracking-wider uppercase bg-amber-500/20 text-amber-300 border border-amber-500/30">
                    Token {team.token}
                  </span>
                )}
                <span className="px-2.5 py-0.5 rounded-lg text-[11px] font-semibold bg-slate-800 text-slate-300 border border-slate-700">
                  {modeLabel}
                </span>
                {(team.locked || preview.lockProtection.primaryPredefinedPair) && (
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg text-[11px] font-semibold bg-violet-500/15 text-violet-300 border border-violet-500/30">
                    <Lock className="w-3 h-3" />
                    Locked Pair
                  </span>
                )}
              </div>
              <h3
                id="edit-shuffled-team-title"
                className="text-lg sm:text-xl font-black text-white truncate"
              >
                Edit Team Roster — {team.name}
              </h3>
              <p className="text-xs text-slate-400">
                Replace a member with an unassigned player or swap players directly with another team
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            disabled={isSaving}
            className="p-2 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors shrink-0"
            aria-label="Close Edit Team Modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Content Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-5">
          {/* Team Name & Captain Bar */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 bg-slate-950/60 border border-slate-800/80 rounded-2xl p-4">
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                Team Display Name
              </label>
              <input
                type="text"
                value={customTeamName}
                onChange={(e) => {
                  setCustomTeamName(e.target.value);
                  setIsCustomNameEdited(true);
                }}
                placeholder="Enter team name"
                className="w-full px-3.5 py-2 rounded-xl bg-slate-900 border border-slate-700/80 text-white text-sm font-semibold focus:outline-none focus:border-amber-500/60"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                Team Captain (👑)
              </label>
              <div className="grid grid-cols-2 gap-2">
                {proposedPlayers.map((pid, idx) => {
                  const p = playersById.get(pid);
                  const isCaptain = proposedCaptainId === pid;
                  return (
                    <button
                      key={`cap-slot-${idx}`}
                      type="button"
                      onClick={() => {
                        setProposedCaptainId(pid);
                      }}
                      className={`px-3 py-2 rounded-xl border text-xs font-bold flex items-center justify-center gap-1.5 truncate transition-all ${
                        isCaptain
                          ? 'bg-amber-500/20 border-amber-500/50 text-amber-300 shadow-sm'
                          : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200 hover:border-slate-700'
                      }`}
                    >
                      <Crown className={`w-3.5 h-3.5 shrink-0 ${isCaptain ? 'text-amber-400' : 'text-slate-500'}`} />
                      <span className="truncate">{p?.name || `Slot ${idx + 1}`}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Slot Selector Tabs (Player 1 & Player 2) */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                1. Select Team Position to Modify
              </span>
              <span className="text-[11px] text-slate-400">
                Click a slot below, then choose a replacement or swap player
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {proposedPlayers.map((pid, slotIdx) => {
                const currentPlayer = playersById.get(pid);
                const originalPid = team.players[slotIdx];
                const originalPlayer = playersById.get(originalPid);
                const isSlotChanged = pid !== originalPid;
                const isSlotActive = activeSlotIndex === slotIdx;
                const isCaptain = proposedCaptainId === pid;
                const swapDetail = preview.swaps.find((s) => s.slotIndex === slotIdx);
                const isOriginalPlayerLocked = (team.lockedPlayerIds || []).includes(originalPid);

                return (
                  <div
                    key={`slot-card-${slotIdx}`}
                    onClick={() => setActiveSlotIndex(slotIdx)}
                    className={`cursor-pointer rounded-2xl p-3.5 border transition-all ${
                      isSlotActive
                        ? 'bg-amber-500/10 border-amber-500/60 ring-2 ring-amber-500/20'
                        : isSlotChanged
                        ? 'bg-emerald-500/10 border-emerald-500/40 hover:border-emerald-500/60'
                        : 'bg-slate-950/70 border-slate-800 hover:border-slate-700'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2 mb-2">
                      <span
                        className={`text-[11px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md ${
                          isSlotActive
                            ? 'bg-amber-500 text-slate-950'
                            : 'bg-slate-800 text-slate-300'
                        }`}
                      >
                        Player {slotIdx + 1} {isSlotActive ? '• Editing' : ''}
                      </span>

                      <div className="flex items-center gap-1.5">
                        {isOriginalPlayerLocked && (
                          <span
                            title="Originally locked in this slot"
                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-violet-500/20 text-violet-300 border border-violet-500/30"
                          >
                            <Lock className="w-2.5 h-2.5" /> Locked Slot
                          </span>
                        )}
                        {isCaptain && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                            <Crown className="w-2.5 h-2.5" /> Captain
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-sm font-bold text-white truncate">
                          {currentPlayer?.name || 'Select Player'}
                        </p>
                        <p className="text-xs text-slate-400">
                          {currentPlayer?.skillLevel || 'Player'}
                        </p>
                      </div>

                      {isSlotChanged && (
                        <div className="text-right shrink-0">
                          <span
                            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] font-bold ${
                              swapDetail
                                ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30'
                                : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                            }`}
                          >
                            {swapDetail ? (
                              <>
                                <ArrowLeftRight className="w-3 h-3" />
                                Swap w/ {swapDetail.counterpartTeamToken ? `Token ${swapDetail.counterpartTeamToken}` : swapDetail.counterpartTeamName}
                              </>
                            ) : (
                              <>
                                <UserCheck className="w-3 h-3" />
                                Replaced
                              </>
                            )}
                          </span>
                          <p className="text-[10px] text-slate-500 mt-0.5 truncate max-w-[130px]">
                            Was: {originalPlayer?.name}
                          </p>
                        </div>
                      )}
                    </div>

                    {/* Direct dropdown for quick selection on mobile/desktop */}
                    <div className="mt-3 pt-2.5 border-t border-slate-800/80" onClick={(e) => e.stopPropagation()}>
                      <label className="sr-only">Select Player for Slot {slotIdx + 1}</label>
                      <select
                        aria-label={`Select Player for Slot ${slotIdx + 1}`}
                        value={pid}
                        onChange={(e) => {
                          setActiveSlotIndex(slotIdx);
                          handleSelectPlayerForSlot(slotIdx, e.target.value);
                        }}
                        className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700/80 text-xs font-semibold text-slate-200 focus:outline-none focus:border-amber-500/60"
                      >
                        {allPlayers.map((p) => {
                          const assignedTeam = currentTeamByPlayerId.get(p.id);
                          const isSameTeam = assignedTeam?.id === team.id;
                          const isUnassigned = !assignedTeam;
                          const isLockedInOther =
                            assignedTeam &&
                            (assignedTeam.locked ||
                              (assignedTeam.lockedPlayerIds || []).includes(p.id) ||
                              predefinedByPlayerId.has(p.id));

                          let statusSuffix = 'Available (Unassigned)';
                          if (isSameTeam) {
                            statusSuffix = `Current Member (${team.name})`;
                          } else if (assignedTeam) {
                            statusSuffix = `Swap from ${assignedTeam.name}${
                              assignedTeam.token ? ` [Token ${assignedTeam.token}]` : ''
                            }${isLockedInOther ? ' 🔒' : ''}`;
                          }

                          return (
                            <option key={p.id} value={p.id}>
                              {p.name} ({p.skillLevel}) — {statusSuffix}
                            </option>
                          );
                        })}
                      </select>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Searchable Player Browser for Active Slot */}
          <div className="bg-slate-950/60 border border-slate-800/90 rounded-2xl p-4 space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-amber-400 flex items-center gap-1.5">
                  <Users className="w-3.5 h-3.5" />
                  2. Assign or Swap Player for Slot {activeSlotIndex + 1}
                </h4>
                <p className="text-[11px] text-slate-400">
                  Choosing a player from another team automatically swaps them with{' '}
                  <span className="text-slate-200 font-semibold">
                    {playersById.get(team.players[activeSlotIndex])?.name || `Slot ${activeSlotIndex + 1}`}
                  </span>
                </p>
              </div>

              {/* Filter Tabs */}
              <div className="flex items-center gap-1 bg-slate-900 p-1 rounded-xl border border-slate-800 self-start">
                {(
                  [
                    { id: 'all', label: 'All Players' },
                    { id: 'unassigned', label: 'Available' },
                    { id: 'assigned', label: 'In Other Teams (Swap)' },
                  ] as { id: PlayerFilterMode; label: string }[]
                ).map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setFilterMode(tab.id)}
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all ${
                      filterMode === tab.id
                        ? 'bg-amber-500 text-slate-950 shadow-sm'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Search Input */}
            <div className="relative">
              <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search player name, skill level, team name, or token..."
                className="w-full pl-9 pr-4 py-2 rounded-xl bg-slate-900 border border-slate-800 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500/50"
              />
            </div>

            {/* Player List Grid */}
            <div className="max-h-48 overflow-y-auto pr-1 grid grid-cols-1 sm:grid-cols-2 gap-2">
              {filteredPlayers.length === 0 ? (
                <div className="col-span-2 py-6 text-center text-xs text-slate-500">
                  No players match the current filter.
                </div>
              ) : (
                filteredPlayers.map((p) => {
                  const assignedTeam = currentTeamByPlayerId.get(p.id);
                  const isSelectedInActiveSlot = proposedPlayers[activeSlotIndex] === p.id;
                  const isSelectedInOtherSlot =
                    proposedPlayers.includes(p.id) && !isSelectedInActiveSlot;
                  const isUnassigned = !assignedTeam;
                  const isInOtherTeam = Boolean(assignedTeam && assignedTeam.id !== team.id);
                  const isLockedInAssignedTeam =
                    Boolean(assignedTeam?.locked) ||
                    Boolean(assignedTeam?.lockedPlayerIds?.includes(p.id)) ||
                    predefinedByPlayerId.has(p.id);

                  return (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => handleSelectPlayerForSlot(activeSlotIndex, p.id)}
                      className={`w-full text-left px-3 py-2.5 rounded-xl border transition-all flex items-center justify-between gap-2 ${
                        isSelectedInActiveSlot
                          ? 'bg-amber-500/20 border-amber-500/60 text-white'
                          : isSelectedInOtherSlot
                          ? 'bg-slate-900/70 border-slate-700/70 text-slate-300'
                          : isUnassigned
                          ? 'bg-slate-900/90 border-slate-800 hover:border-emerald-500/40 text-slate-200'
                          : 'bg-slate-900/90 border-slate-800 hover:border-cyan-500/40 text-slate-200'
                      }`}
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs font-bold truncate">{p.name}</span>
                          {isLockedInAssignedTeam && (
                            <Lock className="w-3 h-3 text-violet-400 shrink-0" />
                          )}
                        </div>
                        <p className="text-[10px] text-slate-400 truncate">
                          {p.skillLevel}
                          {assignedTeam
                            ? ` • ${
                                assignedTeam.id === team.id
                                  ? 'Current Team'
                                  : `${assignedTeam.name}${
                                      assignedTeam.token ? ` (Token ${assignedTeam.token})` : ''
                                    }`
                              }`
                            : ' • Unassigned Pool'}
                        </p>
                      </div>

                      <div className="shrink-0">
                        {isSelectedInActiveSlot ? (
                          <span className="px-2 py-0.5 rounded-md text-[10px] font-black bg-amber-500 text-slate-950">
                            Selected
                          </span>
                        ) : isSelectedInOtherSlot ? (
                          <span className="px-2 py-0.5 rounded-md text-[10px] font-semibold bg-slate-800 text-slate-400">
                            Flip Slot
                          </span>
                        ) : isUnassigned ? (
                          <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                            Assign
                          </span>
                        ) : isInOtherTeam ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-cyan-500/15 text-cyan-300 border border-cyan-500/30">
                            <ArrowLeftRight className="w-2.5 h-2.5" />
                            Swap
                          </span>
                        ) : null}
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </div>

          {/* Live Current vs. Proposed Roster Preview */}
          {preview.hasChanges && (
            <div className="bg-slate-950/80 border border-amber-500/30 rounded-2xl p-4 space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-black uppercase tracking-wider text-amber-300 flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5" />
                  Live Roster Change Preview
                </h4>
                <span className="text-[11px] font-semibold text-slate-400">
                  {preview.isSwap
                    ? `Swapping across ${preview.affectedTeamIds.length} teams (all other teams untouched)`
                    : 'Updating single team only'}
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {/* Primary Team Before -> After */}
                {preview.primaryTeamBefore && preview.primaryTeamAfter && (
                  <div className="p-3 rounded-xl bg-slate-900/90 border border-slate-800 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-white">
                        {preview.primaryTeamAfter.name}{' '}
                        {preview.primaryTeamAfter.token
                          ? `(Token ${preview.primaryTeamAfter.token})`
                          : ''}
                      </span>
                      <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded bg-amber-500/20 text-amber-300">
                        Edited Team
                      </span>
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div className="p-2 rounded-lg bg-slate-950/70 border border-slate-800/80">
                        <p className="text-[10px] uppercase font-bold text-slate-500 mb-1">
                          Current
                        </p>
                        {preview.primaryTeamBefore.players.map((pid, idx) => (
                          <p key={`before-p-${idx}`} className="text-slate-300 truncate">
                            {idx + 1}. {playersById.get(pid)?.name || 'Unknown'}
                          </p>
                        ))}
                      </div>
                      <div className="p-2 rounded-lg bg-emerald-950/25 border border-emerald-500/30">
                        <p className="text-[10px] uppercase font-bold text-emerald-400 mb-1">
                          Proposed
                        </p>
                        {preview.primaryTeamAfter.players.map((pid, idx) => (
                          <p
                            key={`after-p-${idx}`}
                            className="text-emerald-200 font-semibold truncate"
                          >
                            {idx + 1}. {playersById.get(pid)?.name || 'Unknown'}
                            {preview.primaryTeamAfter?.captainId === pid ? ' 👑' : ''}
                          </p>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {/* Counterpart Swap Team(s) Before -> After */}
                {preview.counterpartTeamsBefore.map((otherBefore, cIdx) => {
                  const otherAfter = preview.counterpartTeamsAfter[cIdx];
                  if (!otherAfter) return null;
                  return (
                    <div
                      key={otherBefore.id}
                      className="p-3 rounded-xl bg-slate-900/90 border border-cyan-500/30 space-y-2"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-white">
                          {otherAfter.name}{' '}
                          {otherAfter.token ? `(Token ${otherAfter.token})` : ''}
                        </span>
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase px-2 py-0.5 rounded bg-cyan-500/20 text-cyan-300">
                          <ArrowLeftRight className="w-2.5 h-2.5" />
                          Swap Partner
                        </span>
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <div className="p-2 rounded-lg bg-slate-950/70 border border-slate-800/80">
                          <p className="text-[10px] uppercase font-bold text-slate-500 mb-1">
                            Current
                          </p>
                          {otherBefore.players.map((pid, idx) => (
                            <p key={`other-before-${idx}`} className="text-slate-300 truncate">
                              {idx + 1}. {playersById.get(pid)?.name || 'Unknown'}
                            </p>
                          ))}
                        </div>
                        <div className="p-2 rounded-lg bg-cyan-950/25 border border-cyan-500/30">
                          <p className="text-[10px] uppercase font-bold text-cyan-400 mb-1">
                            Proposed
                          </p>
                          {otherAfter.players.map((pid, idx) => (
                            <p
                              key={`other-after-${idx}`}
                              className="text-cyan-200 font-semibold truncate"
                            >
                              {idx + 1}. {playersById.get(pid)?.name || 'Unknown'}
                              {otherAfter.captainId === pid ? ' 👑' : ''}
                            </p>
                          ))}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Lock & Pre-Decided Pair Protection Warning + Authorization */}
          {preview.hasChanges && preview.lockProtection.isProtected && (
            <div className="rounded-2xl bg-violet-950/30 border border-violet-500/40 p-4 space-y-3">
              <div className="flex items-start gap-3">
                <ShieldCheck className="w-5 h-5 text-violet-400 shrink-0 mt-0.5" />
                <div className="space-y-1 flex-1">
                  <h4 className="text-xs font-black uppercase tracking-wider text-violet-300">
                    Locked Team / Pre-Decided Pair Protection
                  </h4>
                  <ul className="text-xs text-violet-200/90 space-y-1 list-disc pl-4">
                    {preview.lockProtection.warnings.map((w, idx) => (
                      <li key={idx}>{w}</li>
                    ))}
                  </ul>
                </div>
              </div>

              {/* Lock Retention Mode Choice (Preserve Lock by Default vs Explicit Unlock) */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setLockAction('keep')}
                  className={`px-3 py-2 rounded-xl border text-xs font-bold flex items-center gap-2 transition-all ${
                    lockAction === 'keep'
                      ? 'bg-violet-500/25 border-violet-400 text-violet-200'
                      : 'bg-slate-900/80 border-slate-800 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <Lock className="w-3.5 h-3.5 shrink-0" />
                  <span>Keep Team / Pair Locked After Edit (Recommended)</span>
                </button>
                <button
                  type="button"
                  onClick={() => setLockAction('unlock')}
                  className={`px-3 py-2 rounded-xl border text-xs font-bold flex items-center gap-2 transition-all ${
                    lockAction === 'unlock'
                      ? 'bg-amber-500/20 border-amber-400 text-amber-200'
                      : 'bg-slate-900/80 border-slate-800 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <Unlock className="w-3.5 h-3.5 shrink-0" />
                  <span>Explicitly Unlock Team After Edit</span>
                </button>
              </div>

              <label className="flex items-center gap-2.5 pt-1 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={authorizeLockedEdit}
                  onChange={(e) => {
                    setAuthorizeLockedEdit(e.target.checked);
                    setSubmitError(null);
                  }}
                  className="w-4 h-4 rounded border-violet-400 text-violet-500 focus:ring-violet-500 bg-slate-900"
                />
                <span className="text-xs font-bold text-violet-100">
                  I authorize modifying this locked team / pre-decided pair
                </span>
              </label>
            </div>
          )}

          {/* Match & Fixture Conflict Safeguards */}
          {preview.hasChanges && preview.fixtureConflict.hasLiveOrPaused && (
            <div className="rounded-2xl bg-rose-950/40 border border-rose-500/50 p-4 flex items-start gap-3">
              <ShieldAlert className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <h4 className="text-xs font-black uppercase tracking-wider text-rose-300">
                  Active Live Match Conflict — Roster Change Blocked
                </h4>
                <p className="text-xs text-rose-200/90">
                  {preview.fixtureConflict.affectedTeamNames.join(' / ')} is currently playing in{' '}
                  {preview.fixtureConflict.liveMatches.length} LIVE or PAUSED match(es). Complete or
                  reset the active match before modifying team members.
                </p>
              </div>
            </div>
          )}

          {preview.hasChanges &&
            !preview.fixtureConflict.hasLiveOrPaused &&
            preview.fixtureConflict.hasFixtures && (
              <div className="rounded-2xl bg-amber-950/30 border border-amber-500/40 p-4 space-y-2.5">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
                  <div className="space-y-1 flex-1">
                    <h4 className="text-xs font-black uppercase tracking-wider text-amber-300">
                      Existing Match & Fixture Safeguard Warning
                    </h4>
                    <p className="text-xs text-amber-100/90">
                      {preview.fixtureConflict.affectedTeamNames.join(' & ')} is already assigned to{' '}
                      {preview.fixtureConflict.upcomingMatches.length > 0 && (
                        <span className="font-bold">
                          {preview.fixtureConflict.upcomingMatches.length} scheduled match(es)
                        </span>
                      )}
                      {preview.fixtureConflict.upcomingMatches.length > 0 &&
                        preview.fixtureConflict.completedMatches.length > 0 &&
                        ' and '}
                      {preview.fixtureConflict.completedMatches.length > 0 && (
                        <span className="font-bold">
                          {preview.fixtureConflict.completedMatches.length} completed match(es)
                        </span>
                      )}
                      . Existing fixtures and historical match results will be preserved without
                      regenerating the schedule.
                    </p>
                  </div>
                </div>

                <label className="flex items-center gap-2.5 pt-1 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={acknowledgeFixtureWarning}
                    onChange={(e) => {
                      setAcknowledgeFixtureWarning(e.target.checked);
                      setSubmitError(null);
                    }}
                    className="w-4 h-4 rounded border-amber-400 text-amber-500 focus:ring-amber-500 bg-slate-900"
                  />
                  <span className="text-xs font-bold text-amber-100">
                    I confirm updating the team roster while preserving existing fixtures & match history
                  </span>
                </label>
              </div>
            )}

          {/* Error Banner */}
          {(submitError ||
            (preview.hasChanges &&
              !preview.valid &&
              preview.code !== 'LOCK_AUTH_REQUIRED' &&
              preview.code !== 'FIXTURE_CONFIRM_REQUIRED' &&
              preview.code !== 'LIVE_MATCH_CONFLICT')) && (
            <div className="rounded-2xl bg-rose-950/40 border border-rose-500/40 p-3.5 flex items-center gap-2.5 text-xs font-semibold text-rose-200">
              <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
              <span>{submitError || preview.error}</span>
            </div>
          )}

          {/* Footer Action Buttons */}
          <div className="pt-3 border-t border-slate-800/90 flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              disabled={isSaving}
              className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-xs font-bold transition-colors"
            >
              Cancel
            </button>

            <button
              type="submit"
              disabled={isSaving || !preview.hasChanges || !preview.valid}
              className={`px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider flex items-center justify-center gap-2 transition-all shadow-lg ${
                isSaving || !preview.hasChanges || !preview.valid
                  ? 'bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700'
                  : preview.isSwap
                  ? 'bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-slate-950 shadow-cyan-500/20'
                  : 'bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-slate-950 shadow-amber-500/20'
              }`}
            >
              {isSaving ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  Saving to Database...
                </>
              ) : preview.isSwap ? (
                <>
                  <ArrowLeftRight className="w-4 h-4" />
                  Swap Players & Save
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  Save Team Changes
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
