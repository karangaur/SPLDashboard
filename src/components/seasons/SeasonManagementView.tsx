import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  Archive,
  Calendar,
  CheckCircle2,
  Copy,
  Edit3,
  Eye,
  Layers,
  Loader2,
  Lock,
  Palette,
  PlayCircle,
  Plus,
  RefreshCw,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Trophy,
  Unlock,
  Users,
  X,
  XCircle,
} from 'lucide-react';
import { useTournament } from '../../context/TournamentContext';
import { AuthService } from '../../services/authService';
import { SupabaseService } from '../../services/supabaseService';
import {
  CreateSeasonInput,
  SeasonActivationCheckResult,
  TournamentSeason,
  TournamentSeasonStatus,
  UpdateSeasonInput,
} from '../../types/tournament';
import { SeasonDesignStudio } from './SeasonDesignStudio';
import { PreviousSeasonsView } from './PreviousSeasonsView';
import { NavTab } from '../common/Header';

export type SeasonSubTab = 'dashboard' | 'design-studio' | 'previous-seasons';

interface SeasonManagementViewProps {
  onSelectTab?: (tab: NavTab) => void;
  initialSubTab?: SeasonSubTab;
}

const STATUS_BADGE_MAP: Record<
  TournamentSeasonStatus,
  { label: string; className: string }
> = {
  active: {
    label: 'ACTIVE',
    className: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/35',
  },
  upcoming: {
    label: 'UPCOMING',
    className: 'bg-sky-500/15 text-sky-300 border-sky-500/35',
  },
  completed: {
    label: 'COMPLETED',
    className: 'bg-amber-500/15 text-amber-300 border-amber-500/35',
  },
  archived: {
    label: 'ARCHIVED',
    className: 'bg-slate-700/60 text-slate-300 border-white/15',
  },
};

export const SeasonManagementView: React.FC<SeasonManagementViewProps> = ({
  onSelectTab,
  initialSubTab,
}) => {
  const {
    activeSeason,
    seasons,
    seasonSummaries,
    state,
    refreshSeason,
    refreshSeasonSummaries,
    switchActiveSeason,
    activateSeasonSafely,
    createSeason,
    updateSeason,
    updateSeasonStatus,
  } = useTournament();

  const canManage = AuthService.canManageTournament();

  const [subTab, setSubTab] = useState<SeasonSubTab>(initialSubTab || 'dashboard');
  useEffect(() => {
    if (initialSubTab) setSubTab(initialSubTab);
  }, [initialSubTab]);

  const [designStudioTargetSlug, setDesignStudioTargetSlug] = useState<string>(
    () => activeSeason.seasonSlug
  );
  const [feedback, setFeedback] = useState<{
    type: 'success' | 'error' | 'info';
    text: string;
  } | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isPreparingSpl4, setIsPreparingSpl4] = useState(false);

  // Create Modal State
  const [createOpen, setCreateOpen] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [createForm, setCreateForm] = useState<{
    seasonNumber: string;
    editionName: string;
    seasonSlug: string;
    tournamentYear: string;
    startDate: string;
    endDate: string;
    venue: string;
    entryFee: string;
    maxSlots: string;
    description: string;
    status: 'upcoming' | 'active';
    activateNow: boolean;
    copySettingsFromSeasonSlug: string;
  }>({
    seasonNumber: '4.0',
    editionName: 'PRO EDITION',
    seasonSlug: 'spl-4-0',
    tournamentYear: String(new Date().getFullYear() + 1),
    startDate: '',
    endDate: '',
    venue: activeSeason.venue || 'Maharajganj Indoor Badminton Stadium, Court 1 & 2',
    entryFee: String(activeSeason.entryFee ?? 500),
    maxSlots: String(activeSeason.maxSlots ?? 32),
    description: '',
    status: 'upcoming',
    activateNow: false,
    copySettingsFromSeasonSlug: activeSeason.seasonSlug,
  });

  // Edit Modal State
  const [editingSeason, setEditingSeason] = useState<TournamentSeason | null>(null);
  const [isSavingEdit, setIsSavingEdit] = useState(false);
  const [editForm, setEditForm] = useState<{
    seasonNumber: string;
    editionName: string;
    tournamentYear: string;
    startDate: string;
    endDate: string;
    date: string;
    venue: string;
    organizer: string;
    entryFee: string;
    maxSlots: string;
    description: string;
    status: TournamentSeasonStatus;
  }>({
    seasonNumber: '',
    editionName: '',
    tournamentYear: '',
    startDate: '',
    endDate: '',
    date: '',
    venue: '',
    organizer: '',
    entryFee: '500',
    maxSlots: '32',
    description: '',
    status: 'upcoming',
  });

  // Activate Confirmation Modal State
  const [activateTarget, setActivateTarget] = useState<TournamentSeason | null>(null);
  const [isActivating, setIsActivating] = useState(false);
  const [liveWarningCount, setLiveWarningCount] = useState<number | null>(null);
  const [checkingReadiness, setCheckingReadiness] = useState(false);
  const [readiness, setReadiness] = useState<SeasonActivationCheckResult | null>(null);

  // Archive Confirmation Modal State
  const [archiveTarget, setArchiveTarget] = useState<TournamentSeason | null>(null);
  const [isArchiving, setIsArchiving] = useState(false);

  const showToast = (type: 'success' | 'error' | 'info', text: string) => {
    setFeedback({ type, text });
    window.setTimeout(() => {
      setFeedback((curr) => (curr?.text === text ? null : curr));
    }, 6000);
  };

  const globalActiveSeason = useMemo(
    () => seasons.find((s) => s.isActive) || activeSeason,
    [seasons, activeSeason]
  );

  const isInspectingHistorical =
    activeSeason.seasonSlug !== globalActiveSeason.seasonSlug;

  const getCountsForSeason = (s: TournamentSeason) => {
    const summary = seasonSummaries[s.seasonSlug];
    if (s.seasonSlug === activeSeason.seasonSlug) {
      return {
        registeredPlayers: Math.max(
          summary?.registeredPlayers ?? 0,
          state.registrations.length
        ),
        rosterPlayers: Math.max(summary?.rosterPlayers ?? 0, state.players.length),
        teamsCount: Math.max(summary?.teamsCount ?? 0, state.teams.length),
        matchesCount: Math.max(
          summary?.matchesCount ?? 0,
          state.matches.length + state.knockout.matches.length
        ),
      };
    }
    return {
      registeredPlayers: summary?.registeredPlayers ?? 0,
      rosterPlayers: summary?.rosterPlayers ?? 0,
      teamsCount: summary?.teamsCount ?? 0,
      matchesCount: summary?.matchesCount ?? 0,
    };
  };

  const openCreateModal = () => {
    const maxNum = seasons.reduce((acc, s) => {
      const n = parseFloat(s.seasonNumber);
      return Number.isFinite(n) && n > acc ? n : acc;
    }, 3.0);
    const nextNum = `${Math.floor(maxNum) + 1}.0`;
    const nextSlug = `spl-${nextNum.replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '').toLowerCase()}`;
    setCreateForm({
      seasonNumber: nextNum,
      editionName: 'PRO EDITION',
      seasonSlug: nextSlug,
      tournamentYear: String(new Date().getFullYear()),
      startDate: '',
      endDate: '',
      venue: activeSeason.venue || 'Maharajganj Indoor Badminton Stadium, Court 1 & 2',
      entryFee: String(activeSeason.entryFee ?? 500),
      maxSlots: String(activeSeason.maxSlots ?? 32),
      description: '',
      status: 'upcoming',
      activateNow: false,
      copySettingsFromSeasonSlug: globalActiveSeason.seasonSlug,
    });
    setCreateOpen(true);
  };

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!createForm.seasonNumber.trim() || !createForm.editionName.trim() || !createForm.seasonSlug.trim()) {
      showToast('error', 'Season number, edition name, and URL slug are required.');
      return;
    }
    setIsCreating(true);
    const payload: CreateSeasonInput = {
      seasonNumber: createForm.seasonNumber.trim(),
      editionName: createForm.editionName.trim(),
      seasonSlug: createForm.seasonSlug.trim().toLowerCase(),
      tournamentYear: Number(createForm.tournamentYear) || new Date().getFullYear(),
      startDate: createForm.startDate.trim() || undefined,
      endDate: createForm.endDate.trim() || undefined,
      date: createForm.startDate.trim() || undefined,
      venue: createForm.venue.trim() || undefined,
      entryFee: Math.max(0, Number(createForm.entryFee) || 0),
      maxSlots: Math.max(2, Number(createForm.maxSlots) || 32),
      description: createForm.description.trim() || undefined,
      status: createForm.activateNow ? 'active' : createForm.status,
      activateNow: createForm.activateNow,
      copySettingsFromSeasonSlug: createForm.copySettingsFromSeasonSlug || undefined,
    };
    const res = await createSeason(payload);
    setIsCreating(false);

    if (res.success && res.season) {
      setCreateOpen(false);
      await refreshSeasonSummaries();
      showToast(
        'success',
        createForm.activateNow
          ? `Created and activated SPL ${res.season.seasonNumber} (${res.season.editionName}).`
          : `Created SPL ${res.season.seasonNumber} (${res.season.editionName}) with clean operational state. Live SPL ${globalActiveSeason.seasonNumber} remains active.`
      );
    } else {
      showToast('error', res.error || 'Could not create season.');
    }
  };

  const openEditModal = (season: TournamentSeason) => {
    setEditingSeason(season);
    setEditForm({
      seasonNumber: season.seasonNumber,
      editionName: season.editionName,
      tournamentYear: String(season.tournamentYear),
      startDate: season.startDate || '',
      endDate: season.endDate || '',
      date: season.date || '',
      venue: season.venue || '',
      organizer: season.organizer || '',
      entryFee: String(season.entryFee ?? 500),
      maxSlots: String(season.maxSlots ?? 32),
      description: season.description || '',
      status: season.status,
    });
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingSeason) return;
    setIsSavingEdit(true);
    const updates: UpdateSeasonInput = {
      seasonNumber: editForm.seasonNumber.trim(),
      editionName: editForm.editionName.trim(),
      tournamentYear: Number(editForm.tournamentYear) || editingSeason.tournamentYear,
      startDate: editForm.startDate.trim(),
      endDate: editForm.endDate.trim(),
      date: editForm.date.trim() || editForm.startDate.trim(),
      venue: editForm.venue.trim(),
      organizer: editForm.organizer.trim(),
      entryFee: Math.max(0, Number(editForm.entryFee) || 0),
      maxSlots: Math.max(2, Number(editForm.maxSlots) || 32),
      description: editForm.description.trim(),
      status: editForm.status,
    };
    const res = await updateSeason(editingSeason.seasonSlug, updates);
    setIsSavingEdit(false);
    if (res.success && res.season) {
      setEditingSeason(null);
      showToast(
        'success',
        `Updated SPL ${res.season.seasonNumber} (${res.season.editionName}).`
      );
    } else {
      showToast('error', res.error || 'Failed to update season details.');
    }
  };

  const handleConfirmActivate = async (force = false) => {
    if (!activateTarget) return;
    setIsActivating(true);
    const res = await activateSeasonSafely(activateTarget.seasonSlug, { force });
    setIsActivating(false);

    if (!res.success && res.requiresConfirmation) {
      setLiveWarningCount(res.liveMatchesCount || 1);
      return;
    }

    if (res.success) {
      const targetNum = activateTarget.seasonNumber;
      const targetEd = activateTarget.editionName;
      setActivateTarget(null);
      setLiveWarningCount(null);
      showToast(
        'success',
        `SPL ${targetNum} (${targetEd}) is now the active tournament season across public and admin portals.`
      );
    } else {
      showToast('error', res.error || 'Activation failed.');
    }
  };

  const openActivateModal = async (season: TournamentSeason) => {
    setLiveWarningCount(null);
    setReadiness(null);
    setActivateTarget(season);
    setCheckingReadiness(true);
    try {
      const result = await SupabaseService.checkSeasonActivationReadiness(season.seasonSlug);
      setReadiness(result);
      if (result.liveMatchesCount > 0) {
        setLiveWarningCount(result.liveMatchesCount);
      }
    } finally {
      setCheckingReadiness(false);
    }
  };

  const handlePrepareSpl4 = async () => {
    const existing = seasons.find(
      (s) => s.seasonNumber === '4.0' || s.seasonSlug === 'spl-4-0'
    );
    if (existing) {
      showToast('info', 'SPL 4.0 already exists — no duplicate created.');
      return;
    }
    setIsPreparingSpl4(true);
    const res = await createSeason({
      seasonNumber: '4.0',
      editionName: 'To Be Announced',
      seasonSlug: 'spl-4-0',
      seasonTitle: 'Smash Premier League — Season 4.0 (To Be Announced)',
      tournamentYear: 2026,
      status: 'upcoming',
      activateNow: false,
      registrationEnabled: false,
      entryFee: activeSeason.entryFee ?? 250,
      maxSlots: activeSeason.maxSlots ?? 32,
      venue: activeSeason.venue || 'Maharajganj Indoor Badminton Stadium',
      copySettingsFromSeasonSlug: globalActiveSeason.seasonSlug,
    });
    setIsPreparingSpl4(false);
    if (res.success && res.season) {
      await refreshSeasonSummaries();
      showToast(
        'success',
        'Prepared SPL 4.0 (To Be Announced · 2026) cleanly without altering active SPL 3.0.'
      );
    } else {
      showToast('error', res.error || 'Could not prepare SPL 4.0.');
    }
  };

  const handleConfirmArchiveToggle = async () => {
    if (!archiveTarget) return;
    setIsArchiving(true);
    const nextStatus: TournamentSeasonStatus =
      archiveTarget.status === 'archived' ? 'completed' : 'archived';
    const ok = await updateSeasonStatus(archiveTarget.seasonSlug, nextStatus);
    setIsArchiving(false);
    if (ok) {
      showToast(
        'success',
        nextStatus === 'archived'
          ? `Archived SPL ${archiveTarget.seasonNumber}. Historical records are now read-only.`
          : `Unarchived SPL ${archiveTarget.seasonNumber} to Completed status.`
      );
      setArchiveTarget(null);
    } else {
      showToast('error', 'Failed to update archive status.');
    }
  };

  const handleInspectHistorical = async (season: TournamentSeason) => {
    const ok = await switchActiveSeason(season.seasonSlug, { persistGlobal: false });
    if (ok) {
      showToast(
        'info',
        `Inspecting historical records for SPL ${season.seasonNumber} locally (Read-Only). Public site remains on SPL ${globalActiveSeason.seasonNumber}.`
      );
    } else {
      showToast('error', 'Unable to load selected historical season.');
    }
  };

  const handleOpenDesignStudio = (slug: string) => {
    setDesignStudioTargetSlug(slug);
    setSubTab('design-studio');
  };

  if (!canManage) {
    return (
      <div className="max-w-3xl mx-auto rounded-2xl border border-rose-500/30 bg-slate-900/70 p-6 sm:p-8 text-center space-y-3">
        <ShieldAlert className="w-10 h-10 text-rose-400 mx-auto" />
        <h2 className="text-xl font-display font-black text-white">Restricted Access</h2>
        <p className="text-sm text-slate-300">
          Only Super Administrators and Tournament Directors can manage tournament seasons and seasonal branding.
        </p>
      </div>
    );
  }

  const hasSpl4 = useMemo(
    () => seasons.some((s) => s.seasonNumber === '4.0' || s.seasonSlug === 'spl-4-0'),
    [seasons]
  );

  const activeCounts = getCountsForSeason(activeSeason);
  const historicalAndOtherSeasons = seasons.filter(
    (s) => s.seasonSlug !== globalActiveSeason.seasonSlug
  );

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header & Sub-Navigation */}
      <div className="rounded-2xl border border-white/10 bg-[#0d1424] p-4 sm:p-6 space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2.5 flex-wrap">
              <Layers className="w-5 h-5 text-amber-400 shrink-0" />
              <h1 className="text-xl sm:text-2xl font-display font-black tracking-tight text-white">
                Season Management & Branding Studio
              </h1>
            </div>
            <p className="text-xs sm:text-sm text-slate-400">
              Orchestrate SPL 3.0, SPL 4.0, and future editions with isolated operational data, safe activation guards, and custom hero branding.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 shrink-0">
            <button
              type="button"
              onClick={async () => {
                setIsRefreshing(true);
                await refreshSeason();
                await refreshSeasonSummaries();
                setIsRefreshing(false);
              }}
              className="inline-flex items-center gap-1.5 px-3.5 py-2.5 min-h-[44px] rounded-xl text-xs font-semibold text-slate-300 hover:text-white bg-white/5 hover:bg-white/10 border border-white/10 transition-colors cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin text-amber-400' : ''}`} />
              <span>Refresh</span>
            </button>

            {!hasSpl4 && (
              <button
                type="button"
                disabled={isPreparingSpl4}
                onClick={() => void handlePrepareSpl4()}
                className="inline-flex items-center gap-2 px-4 py-2.5 min-h-[44px] rounded-xl text-xs font-bold text-sky-200 bg-sky-500/15 hover:bg-sky-500/25 border border-sky-500/35 transition-colors cursor-pointer disabled:opacity-50"
              >
                {isPreparingSpl4 ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                <span>Prepare SPL 4.0</span>
              </button>
            )}

            <button
              type="button"
              onClick={openCreateModal}
              className="inline-flex items-center gap-2 px-4 py-2.5 min-h-[44px] rounded-xl text-xs sm:text-sm font-black uppercase tracking-wider text-slate-950 bg-gradient-to-r from-amber-300 via-amber-400 to-orange-500 hover:from-amber-200 hover:to-orange-400 shadow-lg shadow-amber-500/20 transition-all cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Create New Season</span>
            </button>
          </div>
        </div>

        {/* Sub-Nav Tabs */}
        <div className="flex flex-wrap items-center gap-2 border-t border-white/10 pt-3">
          <button
            type="button"
            onClick={() => setSubTab('dashboard')}
            className={`inline-flex items-center gap-2 px-4 py-2.5 min-h-[44px] rounded-xl text-xs sm:text-sm font-semibold transition-colors cursor-pointer ${
              subTab === 'dashboard'
                ? 'bg-amber-400 text-slate-950 font-bold'
                : 'text-slate-300 hover:text-white hover:bg-white/5'
            }`}
          >
            <Trophy className="w-4 h-4" />
            <span>Season Dashboard</span>
          </button>

          <button
            type="button"
            onClick={() => setSubTab('previous-seasons')}
            className={`inline-flex items-center gap-2 px-4 py-2.5 min-h-[44px] rounded-xl text-xs sm:text-sm font-semibold transition-colors cursor-pointer ${
              subTab === 'previous-seasons'
                ? 'bg-amber-400 text-slate-950 font-bold'
                : 'text-slate-300 hover:text-white hover:bg-white/5'
            }`}
          >
            <Archive className="w-4 h-4" />
            <span>Previous Seasons</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setDesignStudioTargetSlug(activeSeason.seasonSlug);
              setSubTab('design-studio');
            }}
            className={`inline-flex items-center gap-2 px-4 py-2.5 min-h-[44px] rounded-xl text-xs sm:text-sm font-semibold transition-colors cursor-pointer ${
              subTab === 'design-studio'
                ? 'bg-amber-400 text-slate-950 font-bold'
                : 'text-slate-300 hover:text-white hover:bg-white/5'
            }`}
          >
            <Palette className="w-4 h-4" />
            <span>Design Studio</span>
          </button>
        </div>

        {isInspectingHistorical && (
          <div className="rounded-xl border border-sky-500/40 bg-sky-500/10 px-4 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-sky-200">
            <div className="flex items-center gap-2">
              <Eye className="w-4 h-4 text-sky-300 shrink-0" />
              <span>
                <strong>Local Session Inspection:</strong> Viewing{' '}
                <strong>SPL {activeSeason.seasonNumber} ({activeSeason.editionName})</strong>. Public site remains live on{' '}
                <strong>SPL {globalActiveSeason.seasonNumber}</strong>.
              </span>
            </div>
            <button
              type="button"
              onClick={() => void switchActiveSeason(globalActiveSeason.seasonSlug, { persistGlobal: false })}
              className="px-3 py-1.5 min-h-[36px] rounded-lg bg-sky-400 text-slate-950 font-bold text-xs hover:bg-sky-300 shrink-0 cursor-pointer"
            >
              Return to SPL {globalActiveSeason.seasonNumber}
            </button>
          </div>
        )}

        {feedback && (
          <div
            role="status"
            className={`rounded-xl border px-4 py-3 text-xs sm:text-sm font-medium flex items-center justify-between gap-3 ${
              feedback.type === 'success'
                ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-200'
                : feedback.type === 'error'
                  ? 'border-rose-500/40 bg-rose-500/10 text-rose-200'
                  : 'border-sky-500/40 bg-sky-500/10 text-sky-200'
            }`}
          >
            <div className="flex items-center gap-2 min-w-0">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>{feedback.text}</span>
            </div>
            <button
              type="button"
              onClick={() => setFeedback(null)}
              className="text-xs opacity-75 hover:opacity-100 shrink-0 cursor-pointer"
            >
              Dismiss
            </button>
          </div>
        )}
      </div>

      {subTab === 'design-studio' ? (
        <SeasonDesignStudio initialSeasonSlug={designStudioTargetSlug} />
      ) : subTab === 'previous-seasons' ? (
        <PreviousSeasonsView onSelectTab={onSelectTab} />
      ) : (
        <div className="space-y-6">
          {/* Currently Active Season Spotlight Card */}
          <div className="rounded-2xl border border-amber-400/25 bg-[#0d1424] p-5 sm:p-6 space-y-5">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
              <div className="space-y-1.5">
                <div className="flex items-center gap-2.5 flex-wrap">
                  <span className="text-[11px] font-mono font-bold uppercase tracking-widest text-amber-300">
                    {isInspectingHistorical ? 'Currently Inspecting Season' : 'Currently Active Season'}
                  </span>
                  <span
                    className={`inline-flex items-center px-2 py-0.5 rounded-md border text-[10px] font-mono font-bold uppercase ${
                      STATUS_BADGE_MAP[activeSeason.status].className
                    }`}
                  >
                    {STATUS_BADGE_MAP[activeSeason.status].label}
                  </span>
                  {activeSeason.isLocked && (
                    <span className="inline-flex items-center gap-1 text-[10px] font-mono text-slate-300">
                      <Lock className="w-3 h-3" /> Read-Only
                    </span>
                  )}
                </div>

                <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                  <h2 className="text-2xl sm:text-3xl font-display font-black text-white">
                    SPL {activeSeason.seasonNumber}
                  </h2>
                  <span className="text-sm sm:text-base font-display font-bold uppercase tracking-wider text-amber-300">
                    {activeSeason.editionName}
                  </span>
                  <span className="text-xs font-mono text-slate-400 tabular-nums">
                    {activeSeason.tournamentYear} · /{activeSeason.seasonSlug}
                  </span>
                </div>

                <p className="text-xs text-slate-400">
                  {activeSeason.venue || 'Maharajganj Indoor Badminton Stadium'}
                  {activeSeason.startDate || activeSeason.date
                    ? ` · ${activeSeason.startDate || activeSeason.date}${activeSeason.endDate ? ` -> ${activeSeason.endDate}` : ''}`
                    : ''}
                  {activeSeason.description ? ` — ${activeSeason.description}` : ''}
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2.5 shrink-0">
                {!activeSeason.isLocked && (
                  <button
                    type="button"
                    onClick={() => openEditModal(activeSeason)}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2.5 min-h-[44px] rounded-xl text-xs font-semibold text-slate-200 bg-white/5 hover:bg-white/10 border border-white/10 transition-colors cursor-pointer"
                  >
                    <Edit3 className="w-3.5 h-3.5 text-amber-300" />
                    <span>Edit Season</span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => handleOpenDesignStudio(activeSeason.seasonSlug)}
                  className="inline-flex items-center gap-1.5 px-4 py-2.5 min-h-[44px] rounded-xl text-xs font-bold text-slate-950 bg-amber-400 hover:bg-amber-300 transition-colors cursor-pointer"
                >
                  <Palette className="w-3.5 h-3.5" />
                  <span>Customize Season Design</span>
                </button>
              </div>
            </div>

            {/* Active Season Stats Row */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2 border-t border-white/10">
              <div className="rounded-xl border border-white/10 bg-slate-950/60 p-3.5">
                <span className="block text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                  Registered Players
                </span>
                <span className="mt-1 block text-2xl font-mono font-black text-white tabular-nums">
                  {activeCounts.registeredPlayers}
                </span>
              </div>
              <div className="rounded-xl border border-white/10 bg-slate-950/60 p-3.5">
                <span className="block text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                  Teams Formed
                </span>
                <span className="mt-1 block text-2xl font-mono font-black text-white tabular-nums">
                  {activeCounts.teamsCount}
                </span>
              </div>
              <div className="rounded-xl border border-white/10 bg-slate-950/60 p-3.5">
                <span className="block text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                  Total Matches
                </span>
                <span className="mt-1 block text-2xl font-mono font-black text-white tabular-nums">
                  {activeCounts.matchesCount}
                </span>
              </div>
              <div className="rounded-xl border border-white/10 bg-slate-950/60 p-3.5">
                <span className="block text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                  Entry Fee / Slots
                </span>
                <span className="mt-1 block text-2xl font-mono font-black text-amber-300 tabular-nums">
                  ₹{activeSeason.entryFee} · {activeSeason.maxSlots}
                </span>
              </div>
            </div>
          </div>

          {/* All Seasons Directory (Active, Upcoming, Historical / Archived) */}
          <div className="rounded-2xl border border-white/10 bg-[#0d1424] p-5 sm:p-6 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <h3 className="text-base sm:text-lg font-display font-bold text-white">
                  All Tournament Seasons ({seasons.length})
                </h3>
                <p className="text-xs text-slate-400">
                  Switch active public season, inspect historical SPL 3.0 records safely, archive completed seasons, or launch Design Studio per edition.
                </p>
              </div>
              <span className="text-xs font-mono text-slate-400 tabular-nums">
                {historicalAndOtherSeasons.length} Non-Active / Historical
              </span>
            </div>

            <div className="space-y-3">
              {seasons.map((season) => {
                const counts = getCountsForSeason(season);
                const badge = STATUS_BADGE_MAP[season.status] || STATUS_BADGE_MAP.upcoming;
                const isInspected = season.seasonSlug === activeSeason.seasonSlug;
                const isGlobal = season.isActive || season.seasonSlug === globalActiveSeason.seasonSlug;
                const isArch = season.status === 'archived' || season.isLocked;

                return (
                  <div
                    key={season.id || season.seasonSlug}
                    className={`rounded-xl border p-4 transition-colors ${
                      isGlobal
                        ? 'border-emerald-500/35 bg-emerald-500/[0.04]'
                        : isInspected
                          ? 'border-sky-500/35 bg-sky-500/[0.04]'
                          : 'border-white/10 bg-white/[0.02]'
                    }`}
                  >
                    <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4">
                      {/* Identity & Counts */}
                      <div className="space-y-1.5 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-base sm:text-lg font-display font-black text-white">
                            SPL {season.seasonNumber}
                          </span>
                          <span className="text-xs font-display font-bold uppercase tracking-wider text-amber-300">
                            {season.editionName}
                          </span>
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded-md border text-[10px] font-mono font-bold uppercase ${badge.className}`}
                          >
                            {badge.label}
                          </span>
                          {isGlobal && (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-md border border-emerald-400/40 bg-emerald-400/15 text-emerald-200 text-[10px] font-mono font-bold uppercase">
                              PUBLIC LIVE
                            </span>
                          )}
                          {isInspected && !isGlobal && (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-md border border-sky-400/40 bg-sky-400/15 text-sky-200 text-[10px] font-mono font-bold uppercase">
                              INSPECTING
                            </span>
                          )}
                        </div>

                        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-400">
                          <span className="inline-flex items-center gap-1 font-mono tabular-nums">
                            <Calendar className="w-3.5 h-3.5 text-slate-500" />
                            {season.tournamentYear}
                            {season.startDate ? ` (${season.startDate}${season.endDate ? ` -> ${season.endDate}` : ''})` : season.date ? ` (${season.date})` : ''}
                          </span>
                          <span className="inline-flex items-center gap-1 font-mono tabular-nums text-slate-300">
                            <Users className="w-3.5 h-3.5 text-amber-400" />
                            {counts.registeredPlayers} Reg · {counts.teamsCount} Teams · {counts.matchesCount} Matches
                          </span>
                          <span className="font-mono text-[11px] text-slate-500">
                            slug: {season.seasonSlug}
                          </span>
                        </div>
                        {season.historicalSummary?.champions && (
                          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-amber-200/90 pt-0.5">
                            <span>🏆 Champions: <strong>{season.historicalSummary.champions}</strong></span>
                            {season.historicalSummary.runnersUp && (
                              <span className="text-slate-300">
                                🥈 Runners-up: <strong>{season.historicalSummary.runnersUp}</strong>
                              </span>
                            )}
                          </div>
                        )}
                      </div>

                      {/* Controls */}
                      <div className="flex flex-wrap items-center gap-2 shrink-0">
                        <button
                          type="button"
                          onClick={() => openEditModal(season)}
                          disabled={isArch}
                          title={isArch ? 'Unarchive season first to edit' : 'Edit season metadata'}
                          className="inline-flex items-center gap-1.5 px-3 py-2 min-h-[44px] rounded-xl text-xs font-semibold text-slate-200 bg-white/5 hover:bg-white/10 border border-white/10 disabled:opacity-40 cursor-pointer"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                          <span>Edit</span>
                        </button>

                        {!isGlobal && (
                          <button
                            type="button"
                            onClick={() => void openActivateModal(season)}
                            disabled={isArch}
                            title={isArch ? 'Unarchive before activating' : 'Set as Global Active Season'}
                            className="inline-flex items-center gap-1.5 px-3 py-2 min-h-[44px] rounded-xl text-xs font-bold text-emerald-200 bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/35 disabled:opacity-40 cursor-pointer"
                          >
                            <PlayCircle className="w-3.5 h-3.5" />
                            <span>Activate Season</span>
                          </button>
                        )}

                        {!isGlobal && (
                          <button
                            type="button"
                            onClick={() => {
                              if (isInspected && onSelectTab) {
                                onSelectTab('dashboard');
                              } else {
                                void handleInspectHistorical(season);
                              }
                            }}
                            className="inline-flex items-center gap-1.5 px-3 py-2 min-h-[44px] rounded-xl text-xs font-semibold text-sky-200 bg-sky-500/10 hover:bg-sky-500/20 border border-sky-500/30 cursor-pointer"
                          >
                            <Eye className="w-3.5 h-3.5" />
                            <span>{isInspected ? 'Open Records' : 'View Historical Records'}</span>
                          </button>
                        )}

                        <button
                          type="button"
                          onClick={() => handleOpenDesignStudio(season.seasonSlug)}
                          className="inline-flex items-center gap-1.5 px-3 py-2 min-h-[44px] rounded-xl text-xs font-semibold text-amber-200 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 cursor-pointer"
                        >
                          <Palette className="w-3.5 h-3.5" />
                          <span>Customize Design</span>
                        </button>

                        {!isGlobal && (
                          <button
                            type="button"
                            onClick={() => setArchiveTarget(season)}
                            className="inline-flex items-center gap-1.5 px-3 py-2 min-h-[44px] rounded-xl text-xs font-semibold text-slate-300 hover:text-white bg-white/5 hover:bg-white/10 border border-white/10 cursor-pointer"
                          >
                            {isArch ? <Unlock className="w-3.5 h-3.5" /> : <Archive className="w-3.5 h-3.5" />}
                            <span>{isArch ? 'Unarchive' : 'Archive'}</span>
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* CREATE NEW SEASON MODAL */}
      {createOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="w-full max-w-2xl rounded-2xl border border-white/15 bg-[#0d1424] p-5 sm:p-6 space-y-4 my-8">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-amber-400" />
                <h2 className="text-lg font-display font-black text-white">
                  Create New Tournament Season
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setCreateOpen(false)}
                aria-label="Close modal"
                className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-slate-400">
              New seasons start completely clean — zero historical registrations, match scores, standings, or payments are cloned.
            </p>

            <form onSubmit={(e) => void handleCreateSubmit(e)} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                    Season Number *
                  </label>
                  <input
                    type="text"
                    required
                    value={createForm.seasonNumber}
                    onChange={(e) => {
                      const val = e.target.value;
                      const autoSlug = `spl-${val.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}`;
                      setCreateForm((prev) => ({
                        ...prev,
                        seasonNumber: val,
                        seasonSlug: autoSlug || prev.seasonSlug,
                      }));
                    }}
                    placeholder="4.0"
                    className="w-full min-h-[42px] rounded-xl bg-slate-900 border border-white/15 px-3 py-2 text-xs text-white"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                    Edition Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={createForm.editionName}
                    onChange={(e) => setCreateForm((prev) => ({ ...prev, editionName: e.target.value }))}
                    placeholder="PRO EDITION"
                    className="w-full min-h-[42px] rounded-xl bg-slate-900 border border-white/15 px-3 py-2 text-xs text-white"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                    Tournament Year *
                  </label>
                  <input
                    type="number"
                    required
                    min={2024}
                    max={2040}
                    value={createForm.tournamentYear}
                    onChange={(e) => setCreateForm((prev) => ({ ...prev, tournamentYear: e.target.value }))}
                    className="w-full min-h-[42px] rounded-xl bg-slate-900 border border-white/15 px-3 py-2 text-xs font-mono text-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                    URL Slug *
                  </label>
                  <input
                    type="text"
                    required
                    value={createForm.seasonSlug}
                    onChange={(e) => setCreateForm((prev) => ({ ...prev, seasonSlug: e.target.value }))}
                    placeholder="spl-4-0"
                    className="w-full min-h-[42px] rounded-xl bg-slate-900 border border-white/15 px-3 py-2 text-xs font-mono text-white"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                    Start Date
                  </label>
                  <input
                    type="date"
                    value={createForm.startDate}
                    onChange={(e) => setCreateForm((prev) => ({ ...prev, startDate: e.target.value }))}
                    className="w-full min-h-[42px] rounded-xl bg-slate-900 border border-white/15 px-3 py-2 text-xs text-white"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                    End Date
                  </label>
                  <input
                    type="date"
                    value={createForm.endDate}
                    onChange={(e) => setCreateForm((prev) => ({ ...prev, endDate: e.target.value }))}
                    className="w-full min-h-[42px] rounded-xl bg-slate-900 border border-white/15 px-3 py-2 text-xs text-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="sm:col-span-1">
                  <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                    Entry Fee (₹)
                  </label>
                  <input
                    type="number"
                    min={0}
                    value={createForm.entryFee}
                    onChange={(e) => setCreateForm((prev) => ({ ...prev, entryFee: e.target.value }))}
                    className="w-full min-h-[42px] rounded-xl bg-slate-900 border border-white/15 px-3 py-2 text-xs font-mono text-white"
                  />
                </div>
                <div className="sm:col-span-1">
                  <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                    Max Player Slots
                  </label>
                  <input
                    type="number"
                    min={2}
                    value={createForm.maxSlots}
                    onChange={(e) => setCreateForm((prev) => ({ ...prev, maxSlots: e.target.value }))}
                    className="w-full min-h-[42px] rounded-xl bg-slate-900 border border-white/15 px-3 py-2 text-xs font-mono text-white"
                  />
                </div>
                <div className="sm:col-span-1">
                  <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                    Initial Status
                  </label>
                  <select
                    value={createForm.status}
                    onChange={(e) =>
                      setCreateForm((prev) => ({
                        ...prev,
                        status: e.target.value as 'upcoming' | 'active',
                      }))
                    }
                    className="w-full min-h-[42px] rounded-xl bg-slate-900 border border-white/15 px-3 py-2 text-xs text-white"
                  >
                    <option value="upcoming">Upcoming (Draft / Prepare)</option>
                    <option value="active">Active</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                  Venue
                </label>
                <input
                  type="text"
                  value={createForm.venue}
                  onChange={(e) => setCreateForm((prev) => ({ ...prev, venue: e.target.value }))}
                  className="w-full min-h-[42px] rounded-xl bg-slate-900 border border-white/15 px-3 py-2 text-xs text-white"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                  Description / Season Notes
                </label>
                <textarea
                  rows={2}
                  value={createForm.description}
                  onChange={(e) => setCreateForm((prev) => ({ ...prev, description: e.target.value }))}
                  placeholder="Optional season highlights or announcement notes..."
                  className="w-full rounded-xl bg-slate-900 border border-white/15 px-3 py-2 text-xs text-white"
                />
              </div>

              {/* Safe Copy Reusable Rules & Settings */}
              <div className="rounded-xl border border-white/10 bg-white/[0.02] p-3.5 space-y-2">
                <div className="flex items-center gap-2 text-xs font-bold text-white">
                  <Copy className="w-3.5 h-3.5 text-amber-400" />
                  <span>Copy Reusable Tournament Rules & Form Template (Safe Copy)</span>
                </div>
                <select
                  value={createForm.copySettingsFromSeasonSlug}
                  onChange={(e) =>
                    setCreateForm((prev) => ({ ...prev, copySettingsFromSeasonSlug: e.target.value }))
                  }
                  className="w-full min-h-[40px] rounded-xl bg-slate-900 border border-white/15 px-3 py-2 text-xs text-white"
                >
                  <option value="">Start Fresh with Factory SPL Defaults</option>
                  {seasons.map((s) => (
                    <option key={s.seasonSlug} value={s.seasonSlug}>
                      Copy rules, courts & form layout from SPL {s.seasonNumber} ({s.editionName})
                    </option>
                  ))}
                </select>
                <p className="text-[11px] text-slate-400">
                  Copies only scoring rules, playoff settings, court names, and form structure. Never clones players, teams, matches, or payments.
                </p>
              </div>

              <label className="flex items-center justify-between gap-3 p-3.5 min-h-[44px] rounded-xl border border-emerald-500/30 bg-emerald-500/[0.06] text-xs text-slate-200 cursor-pointer">
                <span>
                  <strong className="text-emerald-300">Activate Immediately</strong> — leave unchecked to create SPL {createForm.seasonNumber || '4.0'} quietly without switching the live public site.
                </span>
                <input
                  type="checkbox"
                  checked={createForm.activateNow}
                  onChange={(e) => setCreateForm((prev) => ({ ...prev, activateNow: e.target.checked }))}
                  className="accent-emerald-400 h-4 w-4 shrink-0"
                />
              </label>

              <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-white/10">
                <button
                  type="button"
                  onClick={() => setCreateOpen(false)}
                  className="px-4 py-2.5 min-h-[44px] rounded-xl text-xs font-semibold text-slate-300 bg-white/5 hover:bg-white/10 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isCreating}
                  className="inline-flex items-center gap-2 px-5 py-2.5 min-h-[44px] rounded-xl text-xs font-black uppercase tracking-wider text-slate-950 bg-gradient-to-r from-amber-300 via-amber-400 to-orange-500 hover:from-amber-200 hover:to-orange-400 disabled:opacity-50 cursor-pointer"
                >
                  {isCreating && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  <span>Create Season</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* EDIT SEASON MODAL */}
      {editingSeason && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="w-full max-w-xl rounded-2xl border border-white/15 bg-[#0d1424] p-5 sm:p-6 space-y-4 my-8">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-lg font-display font-black text-white">
                Edit SPL {editingSeason.seasonNumber} ({editingSeason.editionName})
              </h2>
              <button
                type="button"
                onClick={() => setEditingSeason(null)}
                aria-label="Close modal"
                className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={(e) => void handleEditSubmit(e)} className="space-y-3.5">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-300 mb-1">Season Number</label>
                  <input
                    type="text"
                    required
                    value={editForm.seasonNumber}
                    onChange={(e) => setEditForm((prev) => ({ ...prev, seasonNumber: e.target.value }))}
                    className="w-full min-h-[42px] rounded-xl bg-slate-900 border border-white/15 px-3 py-2 text-xs text-white"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-300 mb-1">Edition Name</label>
                  <input
                    type="text"
                    required
                    value={editForm.editionName}
                    onChange={(e) => setEditForm((prev) => ({ ...prev, editionName: e.target.value }))}
                    className="w-full min-h-[42px] rounded-xl bg-slate-900 border border-white/15 px-3 py-2 text-xs text-white"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-300 mb-1">Year</label>
                  <input
                    type="number"
                    required
                    value={editForm.tournamentYear}
                    onChange={(e) => setEditForm((prev) => ({ ...prev, tournamentYear: e.target.value }))}
                    className="w-full min-h-[42px] rounded-xl bg-slate-900 border border-white/15 px-3 py-2 text-xs font-mono text-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-300 mb-1">Start Date</label>
                  <input
                    type="date"
                    value={editForm.startDate}
                    onChange={(e) => setEditForm((prev) => ({ ...prev, startDate: e.target.value }))}
                    className="w-full min-h-[42px] rounded-xl bg-slate-900 border border-white/15 px-3 py-2 text-xs text-white"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-300 mb-1">End Date</label>
                  <input
                    type="date"
                    value={editForm.endDate}
                    onChange={(e) => setEditForm((prev) => ({ ...prev, endDate: e.target.value }))}
                    className="w-full min-h-[42px] rounded-xl bg-slate-900 border border-white/15 px-3 py-2 text-xs text-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-300 mb-1">Entry Fee (₹)</label>
                  <input
                    type="number"
                    min={0}
                    value={editForm.entryFee}
                    onChange={(e) => setEditForm((prev) => ({ ...prev, entryFee: e.target.value }))}
                    className="w-full min-h-[42px] rounded-xl bg-slate-900 border border-white/15 px-3 py-2 text-xs font-mono text-white"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-300 mb-1">Max Slots</label>
                  <input
                    type="number"
                    min={2}
                    value={editForm.maxSlots}
                    onChange={(e) => setEditForm((prev) => ({ ...prev, maxSlots: e.target.value }))}
                    className="w-full min-h-[42px] rounded-xl bg-slate-900 border border-white/15 px-3 py-2 text-xs font-mono text-white"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-300 mb-1">Status</label>
                  <select
                    value={editForm.status}
                    onChange={(e) =>
                      setEditForm((prev) => ({ ...prev, status: e.target.value as TournamentSeasonStatus }))
                    }
                    className="w-full min-h-[42px] rounded-xl bg-slate-900 border border-white/15 px-3 py-2 text-xs text-white"
                  >
                    <option value="upcoming">Upcoming</option>
                    <option value="active">Active</option>
                    <option value="completed">Completed</option>
                    <option value="archived">Archived</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-300 mb-1">Venue</label>
                <input
                  type="text"
                  value={editForm.venue}
                  onChange={(e) => setEditForm((prev) => ({ ...prev, venue: e.target.value }))}
                  className="w-full min-h-[42px] rounded-xl bg-slate-900 border border-white/15 px-3 py-2 text-xs text-white"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-300 mb-1">Description</label>
                <textarea
                  rows={2}
                  value={editForm.description}
                  onChange={(e) => setEditForm((prev) => ({ ...prev, description: e.target.value }))}
                  className="w-full rounded-xl bg-slate-900 border border-white/15 px-3 py-2 text-xs text-white"
                />
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-white/10">
                <button
                  type="button"
                  onClick={() => setEditingSeason(null)}
                  className="px-4 py-2.5 min-h-[44px] rounded-xl text-xs font-semibold text-slate-300 bg-white/5 hover:bg-white/10 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSavingEdit}
                  className="inline-flex items-center gap-2 px-5 py-2.5 min-h-[44px] rounded-xl text-xs font-black uppercase tracking-wider text-slate-950 bg-amber-400 hover:bg-amber-300 disabled:opacity-50 cursor-pointer"
                >
                  {isSavingEdit && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  <span>Save Changes</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ACTIVATE SEASON CONFIRMATION & PRE-ACTIVATION CHECKLIST MODAL */}
      {activateTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="w-full max-w-lg rounded-2xl border border-white/15 bg-[#0d1424] p-5 sm:p-6 space-y-4 my-8">
            <div className="flex items-start gap-3">
              <ShieldCheck className="w-6 h-6 text-amber-400 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <h3 className="text-base font-display font-black text-white">
                  {liveWarningCount
                    ? 'Ongoing Live Matches Detected'
                    : `Pre-Activation Verification · SPL ${activateTarget.seasonNumber}`}
                </h3>
                <p className="text-xs text-slate-300 leading-relaxed">
                  {liveWarningCount ? (
                    <>
                      There are currently <strong className="text-rose-300">{liveWarningCount} live or paused match(es)</strong> in progress in SPL {globalActiveSeason.seasonNumber}. Switching seasons now will immediately move public viewers and scorers to <strong>SPL {activateTarget.seasonNumber} ({activateTarget.editionName})</strong>.
                    </>
                  ) : (
                    <>
                      Activating <strong>SPL {activateTarget.seasonNumber} ({activateTarget.editionName})</strong> will switch the live public website, registration portal, and admin workspace while preserving historical SPL {globalActiveSeason.seasonNumber} records.
                    </>
                  )}
                </p>
              </div>
            </div>

            {/* Live Pre-Activation Readiness Checks */}
            <div className="rounded-xl border border-white/10 bg-slate-950/70 p-3.5 space-y-2.5">
              <div className="flex items-center justify-between text-[11px] font-mono font-bold uppercase tracking-wider text-slate-400">
                <span>Activation Readiness Gate</span>
                {checkingReadiness && (
                  <span className="inline-flex items-center gap-1 text-amber-300">
                    <Loader2 className="w-3 h-3 animate-spin" /> Checking...
                  </span>
                )}
              </div>

              {readiness && (
                <div className="space-y-1.5 text-xs">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-slate-300">1. Multi-Season DB Migration</span>
                    <span
                      className={`inline-flex items-center gap-1 font-mono font-bold ${
                        readiness.dbMigrationReady ? 'text-emerald-400' : 'text-rose-400'
                      }`}
                    >
                      {readiness.dbMigrationReady ? <CheckCircle2 className="w-3.5 h-3.5" /> : <XCircle className="w-3.5 h-3.5" />}
                      {readiness.dbMigrationReady ? 'READY' : 'MIGRATION PENDING'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-slate-300">2. SPL 3.0 Historical Integrity</span>
                    <span
                      className={`inline-flex items-center gap-1 font-mono font-bold ${
                        readiness.historicalDataVerified ? 'text-emerald-400' : 'text-amber-300'
                      }`}
                    >
                      {readiness.historicalDataVerified ? <CheckCircle2 className="w-3.5 h-3.5" /> : <AlertTriangle className="w-3.5 h-3.5" />}
                      {readiness.spl3Summary
                        ? `${readiness.spl3Summary.teams}T · ${readiness.spl3Summary.matches}M · ${readiness.spl3Summary.registrations}R`
                        : readiness.historicalDataVerified
                          ? 'PRESERVED'
                          : 'UNVERIFIED'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-slate-300">3. Zero Ongoing Live Matches</span>
                    <span
                      className={`inline-flex items-center gap-1 font-mono font-bold ${
                        readiness.zeroLiveMatches ? 'text-emerald-400' : 'text-amber-300'
                      }`}
                    >
                      {readiness.zeroLiveMatches ? <CheckCircle2 className="w-3.5 h-3.5" /> : <AlertTriangle className="w-3.5 h-3.5" />}
                      {readiness.zeroLiveMatches ? '0 LIVE' : `${readiness.liveMatchesCount} LIVE`}
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-slate-300">4. Hero Branding (SPL {activateTarget.seasonNumber})</span>
                    <span
                      className={`inline-flex items-center gap-1 font-mono font-bold ${
                        readiness.designConfigReady ? 'text-emerald-400' : 'text-amber-300'
                      }`}
                    >
                      {readiness.designConfigReady ? <CheckCircle2 className="w-3.5 h-3.5" /> : <AlertTriangle className="w-3.5 h-3.5" />}
                      {readiness.designConfigReady ? 'CONFIGURED' : 'DEFAULT FALLBACK'}
                    </span>
                  </div>

                  {readiness.blockers.length > 0 && (
                    <div className="mt-2 rounded-lg border border-rose-500/40 bg-rose-500/10 p-2.5 text-[11px] text-rose-200 space-y-1">
                      <span className="font-bold uppercase block">Activation Blocked:</span>
                      {readiness.blockers.map((b, i) => (
                        <p key={i}>{b}</p>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-white/10">
              <button
                type="button"
                onClick={() => {
                  setActivateTarget(null);
                  setLiveWarningCount(null);
                  setReadiness(null);
                }}
                className="px-4 py-2.5 min-h-[44px] rounded-xl text-xs font-semibold text-slate-300 bg-white/5 hover:bg-white/10 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={
                  isActivating ||
                  checkingReadiness ||
                  Boolean(readiness && readiness.blockers.length > 0)
                }
                onClick={() => void handleConfirmActivate(Boolean(liveWarningCount))}
                className={`inline-flex items-center gap-2 px-4 py-2.5 min-h-[44px] rounded-xl text-xs font-black uppercase tracking-wider cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed ${
                  liveWarningCount
                    ? 'bg-rose-500 text-white hover:bg-rose-400'
                    : 'bg-emerald-400 text-slate-950 hover:bg-emerald-300'
                }`}
              >
                {isActivating && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                <span>
                  {liveWarningCount ? 'Force Activate Season' : 'Confirm Activation'}
                </span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ARCHIVE / UNARCHIVE CONFIRMATION MODAL */}
      {archiveTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-2xl border border-white/15 bg-[#0d1424] p-5 sm:p-6 space-y-4">
            <div className="flex items-start gap-3">
              <Archive className="w-6 h-6 text-amber-400 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <h3 className="text-base font-display font-black text-white">
                  {archiveTarget.status === 'archived'
                    ? `Unarchive SPL ${archiveTarget.seasonNumber}?`
                    : `Archive SPL ${archiveTarget.seasonNumber}?`}
                </h3>
                <p className="text-xs text-slate-300 leading-relaxed">
                  {archiveTarget.status === 'archived'
                    ? 'Restoring this season to Completed status will re-enable metadata edits.'
                    : 'Archiving locks historical scores, registrations, standings, and Hero designs as strictly read-only while keeping records inspectable.'}
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-white/10">
              <button
                type="button"
                onClick={() => setArchiveTarget(null)}
                className="px-4 py-2.5 min-h-[44px] rounded-xl text-xs font-semibold text-slate-300 bg-white/5 hover:bg-white/10 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isArchiving}
                onClick={() => void handleConfirmArchiveToggle()}
                className="inline-flex items-center gap-2 px-4 py-2.5 min-h-[44px] rounded-xl text-xs font-bold text-slate-950 bg-amber-400 hover:bg-amber-300 disabled:opacity-50 cursor-pointer"
              >
                {isArchiving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                <span>{archiveTarget.status === 'archived' ? 'Unarchive Season' : 'Archive Season'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
