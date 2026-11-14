import React, { useState, useMemo } from 'react';
import {
  GripVertical,
  ArrowUp,
  ArrowDown,
  ArrowLeftRight,
  Plus,
  Trash2,
  Undo2,
  RotateCcw,
  Save,
  X,
  Calendar,
  Clock,
  Layers,
  Eye,
  ListOrdered,
  AlertTriangle,
  ShieldCheck,
  CheckCircle2,
  Lock,
  RefreshCw,
} from 'lucide-react';
import { KnockoutMatch, Match, Team } from '../../types/tournament';
import {
  addMatchToDraft,
  moveMatchAcrossOrWithinCourt,
  normalizeScheduleSequence,
  parseMatchScheduleTime,
  removeMatchFromDraft,
  reorderScheduleMatches,
  resolveCourtDisplayName,
  ScheduleValidationReport,
  swapScheduleMatches,
  updateMatchInDraft,
  validateScheduleDraft,
} from '../../utils/scheduleEditorEngine';
import { ConfirmModal } from '../common/ConfirmModal';

interface ScheduleEditorPanelProps {
  baselineMatches: Match[];
  teams: Team[];
  courtsCount: number;
  courtNames?: string[];
  defaultTournamentDate?: string;
  knockoutMatches: KnockoutMatch[];
  onSaveSchedule: (
    draftMatches: Match[]
  ) => Promise<{
    success: boolean;
    conflict?: boolean;
    error?: string;
    report?: ScheduleValidationReport;
  }>;
  onCancelEditMode: () => void;
  onNotify: (text: string, type: 'success' | 'error') => void;
}

type EditorTabMode = 'sequence' | 'courts' | 'preview';

export const ScheduleEditorPanel: React.FC<ScheduleEditorPanelProps> = ({
  baselineMatches,
  teams,
  courtsCount,
  courtNames,
  defaultTournamentDate,
  knockoutMatches,
  onSaveSchedule,
  onCancelEditMode,
  onNotify,
}) => {
  const normalizedInitial = useMemo(
    () => normalizeScheduleSequence(baselineMatches, courtNames),
    [baselineMatches, courtNames]
  );

  const [draftMatches, setDraftMatches] = useState<Match[]>(normalizedInitial);
  const [historyStack, setHistoryStack] = useState<Match[][]>([]);
  const [editorTab, setEditorTab] = useState<EditorTabMode>('sequence');

  // Drag-and-drop state
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const [draggedMatchId, setDraggedMatchId] = useState<string | null>(null);
  const [dragOverCourt, setDragOverCourt] = useState<number | null>(null);

  // Add Match inline form state
  const [showAddMatchForm, setShowAddMatchForm] = useState<boolean>(false);
  const [newTeamA, setNewTeamA] = useState<string>('');
  const [newTeamB, setNewTeamB] = useState<string>('');
  const [newCourt, setNewCourt] = useState<number>(1);
  const [newRound, setNewRound] = useState<number>(1);
  const [newDate, setNewDate] = useState<string>(defaultTournamentDate || '');
  const [newStartTime, setNewStartTime] = useState<string>('');
  const [newInsertPos, setNewInsertPos] = useState<number>(draftMatches.length + 1);

  // Swap two matches quick bar
  const [swapPosA, setSwapPosA] = useState<number>(1);
  const [swapPosB, setSwapPosB] = useState<number>(Math.min(2, Math.max(1, draftMatches.length)));

  // Confirmation modals
  const [pendingDeleteMatchId, setPendingDeleteMatchId] = useState<string | null>(null);
  const [showResetDraftConfirm, setShowResetDraftConfirm] = useState<boolean>(false);
  const [showCancelConfirm, setShowCancelConfirm] = useState<boolean>(false);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const courtsList = useMemo(
    () => Array.from({ length: Math.max(1, courtsCount || 1) }, (_, i) => i + 1),
    [courtsCount]
  );

  const teamMap = useMemo(() => new Map(teams.map((t) => [t.id, t])), [teams]);
  const baselineById = useMemo(
    () => new Map(normalizedInitial.map((m) => [m.id, m])),
    [normalizedInitial]
  );
  const baselineIndexById = useMemo(
    () => new Map(normalizedInitial.map((m, idx) => [m.id, idx + 1])),
    [normalizedInitial]
  );

  // Live validation report
  const validation = useMemo(
    () =>
      validateScheduleDraft({
        draftMatches,
        baselineMatches: normalizedInitial,
        teams,
        courtsCount,
        knockoutMatches,
      }),
    [draftMatches, normalizedInitial, teams, courtsCount, knockoutMatches]
  );

  const pushHistoryAndApply = (nextMatches: Match[]) => {
    setActionError(null);
    setHistoryStack((prev) => [...prev.slice(-29), draftMatches]);
    setDraftMatches(nextMatches);
  };

  // Undo most recent unsaved editing action
  const handleUndo = () => {
    if (historyStack.length === 0) return;
    setActionError(null);
    const previous = historyStack[historyStack.length - 1];
    setHistoryStack((prev) => prev.slice(0, -1));
    setDraftMatches(previous);
    onNotify('Undid last schedule edit.', 'success');
  };

  // Reset all unsaved changes back to saved schedule
  const handleResetUnsavedChanges = () => {
    setActionError(null);
    setHistoryStack([]);
    setDraftMatches(normalizeScheduleSequence(baselineMatches, courtNames));
    setShowResetDraftConfirm(false);
    onNotify('Restored currently saved schedule (unsaved edits discarded).', 'success');
  };

  // Move match up/down by 1 position
  const handleMoveMatchStep = (index: number, direction: 'up' | 'down') => {
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= draftMatches.length) return;
    const reordered = reorderScheduleMatches(draftMatches, index, targetIndex, courtNames);
    pushHistoryAndApply(reordered);
  };

  // Swap two match positions directly
  const handleQuickSwapPositions = () => {
    const idxA = swapPosA - 1;
    const idxB = swapPosB - 1;
    if (
      idxA < 0 ||
      idxA >= draftMatches.length ||
      idxB < 0 ||
      idxB >= draftMatches.length ||
      idxA === idxB
    ) {
      setActionError('Please choose two different match numbers to swap.');
      return;
    }
    const swapped = swapScheduleMatches(draftMatches, idxA, idxB, courtNames);
    pushHistoryAndApply(swapped);
    onNotify(`Swapped Match #${swapPosA} and Match #${swapPosB} in draft schedule.`, 'success');
  };

  // Update individual match fields
  const handleFieldUpdate = (
    matchId: string,
    updates: {
      matchNumber?: number;
      teamA?: string;
      teamB?: string;
      court?: number;
      round?: number;
      date?: string;
      startTime?: string;
      status?: Match['status'];
    }
  ) => {
    const res = updateMatchInDraft(draftMatches, matchId, updates, courtNames);
    if (!res.success) {
      setActionError(res.error || 'Invalid match modification.');
      onNotify(res.error || 'Invalid match modification.', 'error');
      return;
    }
    pushHistoryAndApply(res.matches);
  };

  // Add new custom upcoming match to draft
  const handleAddMatchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const res = addMatchToDraft(
      draftMatches,
      {
        teamA: newTeamA,
        teamB: newTeamB,
        court: newCourt,
        round: newRound,
        date: newDate,
        startTime: newStartTime,
        insertAtMatchNumber: newInsertPos,
      },
      courtNames
    );

    if (!res.success) {
      setActionError(res.error || 'Could not add match.');
      onNotify(res.error || 'Could not add match.', 'error');
      return;
    }

    pushHistoryAndApply(res.matches);
    setShowAddMatchForm(false);
    setNewTeamA('');
    setNewTeamB('');
    setNewInsertPos(res.matches.length + 1);
    onNotify('Added new upcoming fixture to draft schedule.', 'success');
  };

  // Confirm removal of an upcoming match from draft
  const handleConfirmDeleteUpcoming = () => {
    if (!pendingDeleteMatchId) return;
    const res = removeMatchFromDraft(draftMatches, pendingDeleteMatchId, courtNames);
    setPendingDeleteMatchId(null);

    if (!res.success) {
      setActionError(res.error || 'Cannot remove this match.');
      onNotify(res.error || 'Cannot remove this match.', 'error');
      return;
    }

    pushHistoryAndApply(res.matches);
    onNotify('Removed upcoming match from draft schedule.', 'success');
  };

  // Save edited schedule to Supabase
  const handleSave = async () => {
    setActionError(null);
    if (!validation.valid) {
      const firstErr = validation.errors[0]?.message || 'Please fix schedule validation errors.';
      setActionError(firstErr);
      onNotify(firstErr, 'error');
      return;
    }

    setIsSaving(true);
    try {
      const res = await onSaveSchedule(draftMatches);
      if (!res.success) {
        setActionError(res.error || 'Failed to save schedule changes to Supabase.');
        onNotify(res.error || 'Failed to save schedule changes to Supabase.', 'error');
        setIsSaving(false);
        return;
      }
      setIsSaving(false);
      setHistoryStack([]);
      onNotify(
        `Schedule saved to Supabase (${draftMatches.length} fixtures synchronized across all devices)!`,
        'success'
      );
      onCancelEditMode();
    } catch (err: any) {
      const msg = err?.message || 'Unexpected error saving schedule.';
      setActionError(msg);
      onNotify(msg, 'error');
      setIsSaving(false);
    }
  };

  const getTeamName = (id: string) => teamMap.get(id)?.name || 'Unknown Team';
  const getTeamBadge = (id: string) => teamMap.get(id)?.badge || '🏸';

  return (
    <div className="space-y-5 rounded-3xl bg-slate-950/90 border-2 border-amber-500/40 p-4 sm:p-6 shadow-2xl animate-fade-in">
      {/* Top Sticky Editor Control Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-slate-800">
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="px-2.5 py-1 rounded-lg bg-amber-500 text-slate-950 text-[11px] font-black uppercase tracking-wider">
              ✏️ Schedule Editing Mode
            </span>
            <span className="px-2.5 py-1 rounded-lg bg-slate-900 border border-slate-700 text-slate-300 text-xs font-bold">
              {draftMatches.length} Total Fixtures · {courtsCount}{' '}
              {courtsCount === 1 ? 'Court' : 'Courts'}
            </span>
            {validation.hasChanges ? (
              <span className="px-2.5 py-1 rounded-lg bg-cyan-500/15 border border-cyan-500/30 text-cyan-300 text-xs font-bold">
                {validation.changedMatchIds.length + validation.removedMatchIds.length} Unsaved
                Modification(s)
              </span>
            ) : (
              <span className="px-2.5 py-1 rounded-lg bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-xs font-bold">
                In Sync with Database
              </span>
            )}
          </div>
          <p className="text-xs text-slate-400">
            Drag and drop fixtures (or use Move Up / Down on mobile), change courts, dates, times,
            or teams, then click <strong className="text-amber-300">Save Changes</strong> to publish
            to Supabase.
          </p>
        </div>

        {/* Primary Action Controls: Undo, Reset Unsaved, Cancel, Save */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => {
              setNewInsertPos(draftMatches.length + 1);
              setShowAddMatchForm((prev) => !prev);
            }}
            disabled={isSaving}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-300 border border-emerald-500/30 text-xs font-bold transition-all"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Fixture</span>
          </button>

          <button
            type="button"
            onClick={handleUndo}
            disabled={isSaving || historyStack.length === 0}
            title="Undo most recent unsaved schedule change"
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-200 border border-slate-700 text-xs font-bold transition-all disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Undo2 className="w-3.5 h-3.5" />
            <span>Undo ({historyStack.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setShowResetDraftConfirm(true)}
            disabled={isSaving || !validation.hasChanges}
            title="Restore currently saved schedule without regenerating fixtures"
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-amber-300 border border-amber-500/30 text-xs font-bold transition-all disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Reset Unsaved Changes</span>
          </button>

          <button
            type="button"
            onClick={() => {
              if (validation.hasChanges) {
                setShowCancelConfirm(true);
              } else {
                onCancelEditMode();
              }
            }}
            disabled={isSaving}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-xs font-bold transition-all"
          >
            <X className="w-3.5 h-3.5" />
            <span>Cancel Editing</span>
          </button>

          <button
            type="button"
            onClick={handleSave}
            disabled={isSaving || !validation.valid || !validation.hasChanges}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-gradient-to-r from-amber-400 to-orange-500 hover:from-amber-300 hover:to-orange-400 text-slate-950 text-xs font-black uppercase tracking-wider shadow-lg shadow-amber-500/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSaving ? (
              <>
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                <span>Saving to Supabase...</span>
              </>
            ) : (
              <>
                <Save className="w-3.5 h-3.5" />
                <span>Save Changes</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Sub-Navigation Tabs + Quick Match Swap Tool */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 bg-slate-900/80 p-3 rounded-2xl border border-slate-800">
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
          <button
            type="button"
            onClick={() => setEditorTab('sequence')}
            className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
              editorTab === 'sequence'
                ? 'bg-amber-400 text-slate-950 shadow'
                : 'text-slate-400 hover:text-white bg-slate-950/50'
            }`}
          >
            <ListOrdered className="w-3.5 h-3.5" />
            <span>Match Sequence & Field Editor</span>
          </button>

          <button
            type="button"
            onClick={() => setEditorTab('courts')}
            className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
              editorTab === 'courts'
                ? 'bg-amber-400 text-slate-950 shadow'
                : 'text-slate-400 hover:text-white bg-slate-950/50'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>Court Assignment Board ({courtsCount} Courts)</span>
          </button>

          <button
            type="button"
            onClick={() => setEditorTab('preview')}
            className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
              editorTab === 'preview'
                ? 'bg-amber-400 text-slate-950 shadow'
                : 'text-slate-400 hover:text-white bg-slate-950/50'
            }`}
          >
            <Eye className="w-3.5 h-3.5" />
            <span>Preview Updated Schedule</span>
          </button>
        </div>

        {/* Quick Swap Two Match Numbers */}
        {draftMatches.length >= 2 && (
          <div className="flex flex-wrap items-center gap-2 text-xs bg-slate-950/80 px-3 py-1.5 rounded-xl border border-slate-800">
            <span className="text-[11px] font-bold text-slate-400 flex items-center gap-1">
              <ArrowLeftRight className="w-3 h-3 text-amber-400" />
              Quick Swap:
            </span>
            <select
              aria-label="First match number to swap"
              value={swapPosA}
              onChange={(e) => setSwapPosA(Number(e.target.value))}
              className="px-2 py-1 rounded-lg bg-slate-900 border border-slate-700 text-white font-mono text-xs"
            >
              {draftMatches.map((m, i) => (
                <option key={`swap-a-${m.id}`} value={i + 1}>
                  Match #{i + 1}
                </option>
              ))}
            </select>
            <span className="text-slate-500">⇄</span>
            <select
              aria-label="Second match number to swap"
              value={swapPosB}
              onChange={(e) => setSwapPosB(Number(e.target.value))}
              className="px-2 py-1 rounded-lg bg-slate-900 border border-slate-700 text-white font-mono text-xs"
            >
              {draftMatches.map((m, i) => (
                <option key={`swap-b-${m.id}`} value={i + 1}>
                  Match #{i + 1}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={handleQuickSwapPositions}
              className="px-2.5 py-1 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/30 font-bold text-[11px] transition-colors"
            >
              Swap Order
            </button>
          </div>
        )}
      </div>

      {/* Add New Fixture Inline Form */}
      {showAddMatchForm && (
        <form
          onSubmit={handleAddMatchSubmit}
          className="p-4 rounded-2xl bg-emerald-950/20 border border-emerald-500/40 space-y-3 animate-fade-in"
        >
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-black uppercase tracking-wider text-emerald-300 flex items-center gap-1.5">
              <Plus className="w-4 h-4" />
              Add Custom Upcoming Fixture to Schedule
            </h4>
            <button
              type="button"
              onClick={() => setShowAddMatchForm(false)}
              className="text-xs text-slate-400 hover:text-white"
            >
              Close ✕
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3 text-xs">
            <div>
              <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">
                Insert at Position
              </label>
              <select
                value={newInsertPos}
                onChange={(e) => setNewInsertPos(Number(e.target.value))}
                className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-white font-semibold"
              >
                {Array.from({ length: draftMatches.length + 1 }, (_, i) => i + 1).map((pos) => (
                  <option key={pos} value={pos}>
                    Match #{pos} {pos === draftMatches.length + 1 ? '(End)' : ''}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">
                Team A
              </label>
              <select
                value={newTeamA}
                onChange={(e) => setNewTeamA(e.target.value)}
                required
                className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-white font-semibold"
              >
                <option value="">Select Team A</option>
                {teams.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">
                Team B
              </label>
              <select
                value={newTeamB}
                onChange={(e) => setNewTeamB(e.target.value)}
                required
                className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-white font-semibold"
              >
                <option value="">Select Team B</option>
                {teams
                  .filter((t) => t.id !== newTeamA)
                  .map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
              </select>
            </div>

            <div>
              <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">
                Court
              </label>
              <select
                value={newCourt}
                onChange={(e) => setNewCourt(Number(e.target.value))}
                className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-white font-semibold"
              >
                {courtsList.map((c) => (
                  <option key={c} value={c}>
                    {resolveCourtDisplayName(c, courtNames)}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">
                Round & Date
              </label>
              <div className="flex gap-1.5">
                <input
                  type="number"
                  min={1}
                  value={newRound}
                  onChange={(e) => setNewRound(Math.max(1, Number(e.target.value) || 1))}
                  title="Round Number"
                  className="w-16 px-2.5 py-2 rounded-xl bg-slate-900 border border-slate-700 text-white font-mono"
                />
                <input
                  type="date"
                  value={newDate}
                  onChange={(e) => setNewDate(e.target.value)}
                  className="flex-1 min-w-0 px-2.5 py-2 rounded-xl bg-slate-900 border border-slate-700 text-white"
                />
              </div>
            </div>

            <div>
              <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">
                Start Time
              </label>
              <div className="flex gap-1.5">
                <input
                  type="time"
                  value={newStartTime}
                  onChange={(e) => setNewStartTime(e.target.value)}
                  className="flex-1 min-w-0 px-2.5 py-2 rounded-xl bg-slate-900 border border-slate-700 text-white"
                />
                <button
                  type="submit"
                  className="px-3.5 py-2 rounded-xl bg-emerald-400 hover:bg-emerald-300 text-slate-950 font-black whitespace-nowrap"
                >
                  Insert
                </button>
              </div>
            </div>
          </div>
        </form>
      )}

      {/* Validation Errors & Warnings Banner */}
      {(actionError || validation.errors.length > 0) && (
        <div className="p-4 rounded-2xl bg-rose-950/40 border border-rose-500/50 space-y-1.5">
          <div className="flex items-center gap-2 text-xs font-black uppercase tracking-wider text-rose-300">
            <AlertTriangle className="w-4 h-4 shrink-0 text-rose-400" />
            <span>Schedule Validation Issue(s) — Please Resolve Before Saving</span>
          </div>
          {actionError && <p className="text-xs text-rose-200 font-semibold">{actionError}</p>}
          {validation.errors.map((err, idx) => (
            <p key={idx} className="text-xs text-rose-200">
              • {err.message}
            </p>
          ))}
        </div>
      )}

      {validation.warnings.length > 0 && (
        <div className="p-3.5 rounded-2xl bg-amber-950/30 border border-amber-500/30 space-y-1">
          <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-wider text-amber-300">
            <ShieldCheck className="w-4 h-4 shrink-0 text-amber-400" />
            <span>Schedule Advisories</span>
          </div>
          {validation.warnings.map((w, idx) => (
            <p key={idx} className="text-xs text-amber-200/90">
              • {w.message}
            </p>
          ))}
        </div>
      )}

      {/* TAB 1: SEQUENCE & FIELD EDITOR */}
      {editorTab === 'sequence' && (
        <div className="space-y-3">
          {draftMatches.map((match, idx) => {
            const matchNum = idx + 1;
            const origNum = baselineIndexById.get(match.id);
            const origMatch = baselineById.get(match.id);
            const isProtected =
              match.status === 'completed' ||
              match.status === 'live' ||
              match.status === 'paused';
            const parsedTime = parseMatchScheduleTime(match.time);
            const effectiveDate = match.date ?? parsedTime.date ?? '';
            const effectiveStartTime = match.startTime ?? parsedTime.startTime ?? '';
            const isModified = validation.changedMatchIds.includes(match.id);

            return (
              <div
                key={match.id}
                draggable
                onDragStart={() => {
                  setDraggedIndex(idx);
                }}
                onDragOver={(e) => {
                  e.preventDefault();
                  if (dragOverIndex !== idx) setDragOverIndex(idx);
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  if (draggedIndex !== null && draggedIndex !== idx) {
                    const reordered = reorderScheduleMatches(
                      draftMatches,
                      draggedIndex,
                      idx,
                      courtNames
                    );
                    pushHistoryAndApply(reordered);
                  }
                  setDraggedIndex(null);
                  setDragOverIndex(null);
                }}
                onDragEnd={() => {
                  setDraggedIndex(null);
                  setDragOverIndex(null);
                }}
                className={`rounded-2xl p-3.5 sm:p-4 border transition-all ${
                  dragOverIndex === idx
                    ? 'border-amber-400 bg-amber-500/10 ring-2 ring-amber-400/30'
                    : isModified
                    ? 'border-cyan-500/40 bg-slate-900/90'
                    : 'border-slate-800 bg-slate-900/60 hover:border-slate-700'
                }`}
              >
                {/* Row Top Header: Drag Handle, Match Number Selector, Mobile Up/Down, Status & Delete */}
                <div className="flex flex-wrap items-center justify-between gap-2 pb-3 mb-3 border-b border-slate-800/80">
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className="cursor-grab active:cursor-grabbing p-1.5 rounded-lg bg-slate-800/80 text-slate-400 hover:text-amber-300"
                      title="Drag to reorder match"
                    >
                      <GripVertical className="w-4 h-4" />
                    </span>

                    {/* Direct Match Number Selector */}
                    <div className="flex items-center gap-1.5">
                      <span className="text-[11px] font-bold uppercase text-slate-400">Order:</span>
                      <select
                        aria-label={`Change sequence position for Match #${matchNum}`}
                        value={matchNum}
                        onChange={(e) =>
                          handleFieldUpdate(match.id, {
                            matchNumber: Number(e.target.value),
                          })
                        }
                        className="px-2.5 py-1 rounded-lg bg-amber-500/20 border border-amber-500/40 text-amber-300 font-mono text-xs font-black"
                      >
                        {draftMatches.map((_, posIdx) => (
                          <option
                            key={`pos-${match.id}-${posIdx + 1}`}
                            value={posIdx + 1}
                            className="bg-slate-900 text-white"
                          >
                            Match #{String(posIdx + 1).padStart(2, '0')}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Mobile-Friendly Move Up / Move Down Buttons */}
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => handleMoveMatchStep(idx, 'up')}
                        disabled={idx === 0}
                        title="Move match earlier in schedule"
                        aria-label={`Move Match #${matchNum} up`}
                        className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 disabled:opacity-30 disabled:cursor-not-allowed"
                      >
                        <ArrowUp className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleMoveMatchStep(idx, 'down')}
                        disabled={idx === draftMatches.length - 1}
                        title="Move match later in schedule"
                        aria-label={`Move Match #${matchNum} down`}
                        className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 disabled:opacity-30 disabled:cursor-not-allowed"
                      >
                        <ArrowDown className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    {origNum !== undefined && origNum !== matchNum && (
                      <span className="px-2 py-0.5 rounded-md bg-cyan-500/15 border border-cyan-500/30 text-cyan-300 text-[10px] font-bold">
                        Moved from #{origNum} → #{matchNum}
                      </span>
                    )}
                    {!origMatch && (
                      <span className="px-2 py-0.5 rounded-md bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-[10px] font-bold">
                        New Fixture
                      </span>
                    )}
                  </div>

                  {/* Right Status & Delete Controls */}
                  <div className="flex items-center gap-2">
                    {isProtected && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-500/15 border border-amber-500/30 text-amber-300 text-[10px] font-bold">
                        <Lock className="w-3 h-3" />
                        {match.status === 'completed'
                          ? `Completed (${match.scoreA ?? 0}-${match.scoreB ?? 0}) · Result Protected`
                          : `Active (${match.status.toUpperCase()}) · Teams Protected`}
                      </span>
                    )}

                    <select
                      aria-label={`Status for Match #${matchNum}`}
                      value={match.status}
                      disabled={match.status === 'completed'}
                      onChange={(e) =>
                        handleFieldUpdate(match.id, {
                          status: e.target.value as Match['status'],
                        })
                      }
                      className="px-2.5 py-1 rounded-lg bg-slate-950 border border-slate-700 text-[11px] font-bold uppercase text-slate-200 disabled:opacity-60"
                    >
                      <option value="upcoming">Upcoming</option>
                      <option value="postponed">Postponed</option>
                      <option value="live">Live</option>
                      <option value="paused">Paused</option>
                      <option value="completed">Completed</option>
                    </select>

                    {!isProtected && (
                      <button
                        type="button"
                        onClick={() => setPendingDeleteMatchId(match.id)}
                        title="Remove this upcoming match from schedule"
                        aria-label={`Remove Match #${matchNum}`}
                        className="p-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/25 text-rose-400 border border-rose-500/20 transition-colors"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>

                {/* Editable Fields Grid: Team A, Team B, Court, Round, Date, Start Time */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-2.5 text-xs">
                  {/* Team A */}
                  <div>
                    <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">
                      Team A
                    </label>
                    <select
                      aria-label={`Team A for Match #${matchNum}`}
                      value={match.teamA}
                      disabled={isProtected}
                      onChange={(e) => handleFieldUpdate(match.id, { teamA: e.target.value })}
                      className="w-full px-2.5 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white font-semibold disabled:opacity-60"
                    >
                      {teams.map((t) => (
                        <option key={t.id} value={t.id} disabled={t.id === match.teamB}>
                          {t.badge || '🏸'} {t.name} {t.id === match.teamB ? '(Team B)' : ''}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Team B */}
                  <div>
                    <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">
                      Team B
                    </label>
                    <select
                      aria-label={`Team B for Match #${matchNum}`}
                      value={match.teamB}
                      disabled={isProtected}
                      onChange={(e) => handleFieldUpdate(match.id, { teamB: e.target.value })}
                      className="w-full px-2.5 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white font-semibold disabled:opacity-60"
                    >
                      {teams.map((t) => (
                        <option key={t.id} value={t.id} disabled={t.id === match.teamA}>
                          {t.badge || '🏸'} {t.name} {t.id === match.teamA ? '(Team A)' : ''}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Court */}
                  <div>
                    <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">
                      Assigned Court
                    </label>
                    <select
                      aria-label={`Court for Match #${matchNum}`}
                      value={match.court}
                      onChange={(e) =>
                        handleFieldUpdate(match.id, { court: Number(e.target.value) })
                      }
                      className="w-full px-2.5 py-2 rounded-xl bg-slate-950 border border-slate-700 text-amber-300 font-bold"
                    >
                      {courtsList.map((c) => (
                        <option key={c} value={c}>
                          {resolveCourtDisplayName(c, courtNames)}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Round */}
                  <div>
                    <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">
                      Round
                    </label>
                    <input
                      type="number"
                      min={1}
                      aria-label={`Round for Match #${matchNum}`}
                      value={match.round}
                      onChange={(e) =>
                        handleFieldUpdate(match.id, {
                          round: Math.max(1, Number(e.target.value) || 1),
                        })
                      }
                      className="w-full px-2.5 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white font-mono font-bold"
                    />
                  </div>

                  {/* Match Date */}
                  <div>
                    <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">
                      Match Date
                    </label>
                    <div className="relative">
                      <Calendar className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                      <input
                        type="date"
                        aria-label={`Date for Match #${matchNum}`}
                        value={effectiveDate}
                        onChange={(e) =>
                          handleFieldUpdate(match.id, { date: e.target.value })
                        }
                        className="w-full pl-8 pr-2 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white text-xs"
                      />
                    </div>
                  </div>

                  {/* Match Start Time */}
                  <div>
                    <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">
                      Start Time
                    </label>
                    <div className="relative">
                      <Clock className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                      <input
                        type="time"
                        aria-label={`Start time for Match #${matchNum}`}
                        value={effectiveStartTime}
                        onChange={(e) =>
                          handleFieldUpdate(match.id, { startTime: e.target.value })
                        }
                        className="w-full pl-8 pr-2 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white text-xs"
                      />
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* TAB 2: COURT ASSIGNMENT BOARD (DRAG BETWEEN COURTS OR REORDER WITHIN COURT) */}
      {editorTab === 'courts' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {courtsList.map((courtNum) => {
            const courtMatches = draftMatches.filter((m) => m.court === courtNum);
            const courtLabel = resolveCourtDisplayName(courtNum, courtNames);

            return (
              <div
                key={`court-col-${courtNum}`}
                onDragOver={(e) => {
                  e.preventDefault();
                  if (dragOverCourt !== courtNum) setDragOverCourt(courtNum);
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  if (draggedMatchId) {
                    const moved = moveMatchAcrossOrWithinCourt(
                      draftMatches,
                      draggedMatchId,
                      courtNum,
                      courtMatches.length,
                      courtNames
                    );
                    pushHistoryAndApply(moved);
                  }
                  setDraggedMatchId(null);
                  setDragOverCourt(null);
                }}
                className={`rounded-2xl p-4 border transition-all space-y-3 ${
                  dragOverCourt === courtNum
                    ? 'border-amber-400 bg-amber-500/10'
                    : 'border-slate-800 bg-slate-900/70'
                }`}
              >
                <div className="flex items-center justify-between pb-2.5 border-b border-slate-800">
                  <div className="flex items-center gap-2">
                    <span className="px-2.5 py-1 rounded-lg bg-amber-500/20 text-amber-300 border border-amber-500/30 text-xs font-black uppercase">
                      {courtLabel}
                    </span>
                    <span className="text-xs text-slate-400 font-mono">
                      ({courtMatches.length} {courtMatches.length === 1 ? 'Match' : 'Matches'})
                    </span>
                  </div>
                  <span className="text-[10px] text-slate-500">
                    Drag matches here or use Court selector
                  </span>
                </div>

                {courtMatches.length === 0 ? (
                  <div className="py-8 text-center text-xs text-slate-500 border border-dashed border-slate-800 rounded-xl">
                    No fixtures currently assigned to {courtLabel}.
                  </div>
                ) : (
                  <div className="space-y-2.5">
                    {courtMatches.map((m, localIdx) => {
                      const globalIdx = draftMatches.findIndex((dm) => dm.id === m.id);
                      const parsedTime = parseMatchScheduleTime(m.time);

                      return (
                        <div
                          key={m.id}
                          draggable
                          onDragStart={() => setDraggedMatchId(m.id)}
                          onDragEnd={() => {
                            setDraggedMatchId(null);
                            setDragOverCourt(null);
                          }}
                          onDrop={(e) => {
                            e.stopPropagation();
                            if (draggedMatchId && draggedMatchId !== m.id) {
                              const moved = moveMatchAcrossOrWithinCourt(
                                draftMatches,
                                draggedMatchId,
                                courtNum,
                                localIdx,
                                courtNames
                              );
                              pushHistoryAndApply(moved);
                            }
                            setDraggedMatchId(null);
                            setDragOverCourt(null);
                          }}
                          className="p-3 rounded-xl bg-slate-950/90 border border-slate-800 hover:border-amber-500/40 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 text-xs"
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <GripVertical className="w-4 h-4 text-slate-500 shrink-0 cursor-grab" />
                            <span className="px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 font-mono font-bold text-[11px] shrink-0">
                              #{globalIdx + 1}
                            </span>
                            <div className="min-w-0">
                              <p className="font-bold text-white truncate">
                                {getTeamBadge(m.teamA)} {getTeamName(m.teamA)}{' '}
                                <span className="text-amber-400">vs</span>{' '}
                                {getTeamBadge(m.teamB)} {getTeamName(m.teamB)}
                              </p>
                              <p className="text-[10px] text-slate-400">
                                Round {m.round}
                                {m.date || parsedTime.date ? ` · ${m.date || parsedTime.date}` : ''}
                                {m.startTime || parsedTime.startTime
                                  ? ` · ${m.startTime || parsedTime.startTime}`
                                  : ''}
                              </p>
                            </div>
                          </div>

                          <div className="flex items-center gap-1.5 shrink-0 self-end sm:self-center">
                            <button
                              type="button"
                              disabled={localIdx === 0}
                              onClick={() => {
                                const moved = moveMatchAcrossOrWithinCourt(
                                  draftMatches,
                                  m.id,
                                  courtNum,
                                  localIdx - 1,
                                  courtNames
                                );
                                pushHistoryAndApply(moved);
                              }}
                              title="Move up within this court"
                              className="p-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 disabled:opacity-30"
                            >
                              <ArrowUp className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              disabled={localIdx === courtMatches.length - 1}
                              onClick={() => {
                                const moved = moveMatchAcrossOrWithinCourt(
                                  draftMatches,
                                  m.id,
                                  courtNum,
                                  localIdx + 1,
                                  courtNames
                                );
                                pushHistoryAndApply(moved);
                              }}
                              title="Move down within this court"
                              className="p-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 disabled:opacity-30"
                            >
                              <ArrowDown className="w-3.5 h-3.5" />
                            </button>

                            <select
                              aria-label={`Reassign court for Match #${globalIdx + 1}`}
                              value={m.court}
                              onChange={(e) =>
                                handleFieldUpdate(m.id, { court: Number(e.target.value) })
                              }
                              className="px-2 py-1 rounded-lg bg-slate-900 border border-slate-700 text-amber-300 font-bold text-[11px]"
                            >
                              {courtsList.map((c) => (
                                <option key={c} value={c}>
                                  → {resolveCourtDisplayName(c, courtNames)}
                                </option>
                              ))}
                            </select>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* TAB 3: UPDATED SCHEDULE PREVIEW TABLE */}
      {editorTab === 'preview' && (
        <div className="rounded-2xl border border-slate-800 overflow-hidden bg-slate-900/70">
          <div className="px-4 py-3 bg-slate-900 border-b border-slate-800 flex items-center justify-between">
            <span className="text-xs font-black uppercase tracking-wider text-amber-300 flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              Live Preview of Updated Tournament Schedule
            </span>
            <span className="text-[11px] text-slate-400">
              Exact order that will appear on the Public Website & Umpire Console
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-800 text-[10px] uppercase tracking-wider text-slate-400 bg-slate-950/60">
                  <th className="py-2.5 px-3">Order</th>
                  <th className="py-2.5 px-3">Court</th>
                  <th className="py-2.5 px-3">Round</th>
                  <th className="py-2.5 px-3">Fixture</th>
                  <th className="py-2.5 px-3">Date & Time</th>
                  <th className="py-2.5 px-3">Status</th>
                  <th className="py-2.5 px-3">Change Summary</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/70">
                {draftMatches.map((m, idx) => {
                  const seqNum = idx + 1;
                  const origNum = baselineIndexById.get(m.id);
                  const orig = baselineById.get(m.id);
                  const parsed = parseMatchScheduleTime(m.time);
                  const dateTimeLabel =
                    m.date || parsed.date || m.startTime || parsed.startTime
                      ? [m.date || parsed.date, m.startTime || parsed.startTime]
                          .filter(Boolean)
                          .join(' · ')
                      : 'Standard Slot';

                  const changes: string[] = [];
                  if (!orig) {
                    changes.push('New Match');
                  } else {
                    if (origNum !== seqNum) changes.push(`Order #${origNum} → #${seqNum}`);
                    if (orig.court !== m.court)
                      changes.push(`Court ${orig.court} → Court ${m.court}`);
                    if (orig.teamA !== m.teamA || orig.teamB !== m.teamB)
                      changes.push('Teams Updated');
                    if ((orig.time || '') !== (m.time || '')) changes.push('Schedule Time Updated');
                  }

                  return (
                    <tr key={m.id} className="hover:bg-white/[0.02]">
                      <td className="py-2.5 px-3 font-mono font-black text-amber-400">
                        #{String(seqNum).padStart(2, '0')}
                      </td>
                      <td className="py-2.5 px-3 font-bold text-slate-200">
                        {m.courtName || resolveCourtDisplayName(m.court, courtNames)}
                      </td>
                      <td className="py-2.5 px-3 font-mono text-slate-300">R{m.round}</td>
                      <td className="py-2.5 px-3 font-bold text-white">
                        {getTeamBadge(m.teamA)} {getTeamName(m.teamA)}{' '}
                        <span className="text-amber-400">vs</span> {getTeamBadge(m.teamB)}{' '}
                        {getTeamName(m.teamB)}
                      </td>
                      <td className="py-2.5 px-3 font-mono text-slate-300">{dateTimeLabel}</td>
                      <td className="py-2.5 px-3 uppercase text-[10px] font-bold text-slate-300">
                        {m.status}
                        {m.status === 'completed' ? ` (${m.scoreA}-${m.scoreB})` : ''}
                      </td>
                      <td className="py-2.5 px-3">
                        {changes.length > 0 ? (
                          <span className="px-2 py-0.5 rounded bg-cyan-500/15 border border-cyan-500/30 text-cyan-300 text-[10px] font-bold">
                            {changes.join(' · ')}
                          </span>
                        ) : (
                          <span className="text-[10px] text-slate-500">Unchanged</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Confirm Remove Upcoming Match Modal */}
      <ConfirmModal
        isOpen={Boolean(pendingDeleteMatchId)}
        title="Remove Upcoming Match from Schedule"
        message="Are you sure you want to remove this upcoming fixture from the schedule? Match numbers will be automatically re-sequenced, and the removal will be committed when you click Save Changes."
        confirmLabel="Remove Fixture"
        variant="danger"
        onConfirm={handleConfirmDeleteUpcoming}
        onCancel={() => setPendingDeleteMatchId(null)}
      />

      {/* Confirm Reset Unsaved Changes Modal */}
      <ConfirmModal
        isOpen={showResetDraftConfirm}
        title="Reset Unsaved Schedule Changes"
        message="Restore the currently saved schedule and discard your unsaved edits? Existing matches and scores will remain intact."
        confirmLabel="Reset Unsaved Changes"
        variant="warning"
        onConfirm={handleResetUnsavedChanges}
        onCancel={() => setShowResetDraftConfirm(false)}
      />

      {/* Confirm Cancel Editing Mode Modal */}
      <ConfirmModal
        isOpen={showCancelConfirm}
        title="Discard Unsaved Schedule Edits?"
        message="You have unsaved schedule modifications. Exiting Schedule Editing Mode now will discard those changes and keep the last saved schedule."
        confirmLabel="Discard & Exit"
        variant="warning"
        onConfirm={() => {
          setShowCancelConfirm(false);
          onCancelEditMode();
        }}
        onCancel={() => setShowCancelConfirm(false)}
      />
    </div>
  );
};
