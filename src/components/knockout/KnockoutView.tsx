import React, { useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  Ban,
  CheckCircle2,
  ClipboardList,
  Copy,
  Crown,
  Edit2,
  Eye,
  EyeOff,
  Flame,
  History,
  Maximize2,
  RefreshCw,
  RotateCcw,
  Share2,
  ShieldCheck,
  SlidersHorizontal,
  Swords,
  Trash2,
  Trophy,
  UserCheck,
  X,
} from 'lucide-react';
import { useTournament } from '../../context/TournamentContext';
import { KnockoutMatch, PlayoffFormat } from '../../types/tournament';
import { ConfirmModal } from '../common/ConfirmModal';
import { LiveMatchScoringModal } from '../admin/LiveMatchScoringModal';
import { IPLPlayoffBracket } from './IPLPlayoffBracket';
import {
  calculatePlayoffLeagueStandings,
  canStartOrScorePlayoffMatch,
  evaluatePlayoffGenerationEligibility,
  getPlayoffMatchDisplayLabel,
  normalizePlayoffSettings,
  validatePlayoffScheduleAndCourts,
} from '../../utils/playoffEngine';

export const KnockoutView: React.FC = () => {
  const {
    state,
    standings,
    setKnockoutFormat,
    generateKnockoutBracket,
    updateKnockoutMatch,
    clearKnockout,
    resetPlayoffs,
    deletePlayoffs,
    publishPlayoffs,
    overridePlayoffQualifiedTeams,
    setPlayoffTieBreakOrder,
    toggleTeamPlayoffDisqualification,
    recalculatePlayoffStandings,
    updateSettings,
    triggerCelebration,
  } = useTournament();

  const playoffSettings = useMemo(
    () => normalizePlayoffSettings(state.settings.playoffSettings),
    [state.settings.playoffSettings]
  );

  const [editMode, setEditMode] = useState(false);
  const [copied, setCopied] = useState(false);
  const [showGenerateConfirm, setShowGenerateConfirm] = useState(false);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [showOverrideModal, setShowOverrideModal] = useState(false);
  const [showAuditLog, setShowAuditLog] = useState(false);
  const [editingScheduleMatch, setEditingScheduleMatch] = useState<KnockoutMatch | null>(null);
  const [scheduleDraft, setScheduleDraft] = useState({
    court: 1,
    scheduledDate: '',
    scheduledTime: '',
    assignedUmpire: '',
  });
  const [overrideSeeds, setOverrideSeeds] = useState<[string, string, string, string]>(['', '', '', '']);
  const [liveScoringMatchId, setLiveScoringMatchId] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  const showNotice = (text: string, type: 'success' | 'error' = 'error') => {
    setNotice({ text, type });
    window.setTimeout(() => setNotice(null), 4500);
  };

  const includeKnockoutInStandings = playoffSettings.includeKnockoutInStandings !== false;

  const leagueStandingData = useMemo(
    () =>
      calculatePlayoffLeagueStandings({
        teams: state.teams,
        players: state.players,
        matches: state.matches,
        knockoutMatches: state.knockout.matches,
        includeKnockoutInStandings,
        tieBreakerOrder: playoffSettings.tieBreakerOrder,
        disqualifiedTeamIds: state.knockout.disqualifiedTeamIds || [],
        manualTieBreakOrder: state.knockout.manualTieBreakOrder || [],
      }),
    [
      state.teams,
      state.players,
      state.matches,
      state.knockout.matches,
      includeKnockoutInStandings,
      playoffSettings.tieBreakerOrder,
      state.knockout.disqualifiedTeamIds,
      state.knockout.manualTieBreakOrder,
    ]
  );

  const eligibility = useMemo(
    () =>
      evaluatePlayoffGenerationEligibility({
        rankedActiveCount: leagueStandingData.rankedActive.length,
        leagueMatches: state.matches,
        knockout: state.knockout,
        playoffSettings: { ...playoffSettings, format: state.knockout.format || playoffSettings.format },
        unresolvedTies: leagueStandingData.unresolvedTies,
      }),
    [leagueStandingData.rankedActive.length, leagueStandingData.unresolvedTies, state.matches, state.knockout, playoffSettings]
  );

  const conflictWarnings = useMemo(
    () => validatePlayoffScheduleAndCourts(state.knockout.matches || [], state.settings.courtNames),
    [state.knockout.matches, state.settings.courtNames]
  );

  const activeFormat: PlayoffFormat = state.knockout.format || playoffSettings.format || 'ipl_top4';
  const isIPLMode = activeFormat === 'ipl_top4';
  const requiredTeams = activeFormat === 'top2' ? 2 : activeFormat === 'top8' ? 8 : 4;
  const isQualifiedReady = leagueStandingData.rankedActive.length >= requiredTeams;

  const getTeam = (teamId?: string) => (teamId ? state.teams.find((t) => t.id === teamId) : undefined);

  const elimMatches = state.knockout.matches
    .filter((m) => m.stage === 'ELIM' || m.stage === 'QF')
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

  const executeGenerateBracket = () => {
    const res = generateKnockoutBracket();
    if (!res.success) {
      showNotice(res.error || 'Could not generate playoff bracket.', 'error');
      return;
    }
    triggerCelebration();
    showNotice(
      isIPLMode
        ? 'SPL Championship Top 4 Playoff Bracket generated & synced to Supabase!'
        : 'Knockout bracket generated & synced!',
      'success'
    );
  };

  const handleRequestGenerate = () => {
    if (!eligibility.canGenerate) {
      showNotice(eligibility.blockingReasons[0] || 'Playoff generation prerequisites not met.', 'error');
      return;
    }
    if (playoffSettings.requireAdminConfirmation || state.knockout.matches.length > 0) {
      setShowGenerateConfirm(true);
    } else {
      executeGenerateBracket();
    }
  };

  const handleOpenOverrideModal = () => {
    const currentSeedIds = (state.knockout.qualifiedTeams || []).map((q) => q.teamId);
    const defaultTop4 = leagueStandingData.rankedActive.slice(0, 4).map((r) => r.team.id);
    const s = currentSeedIds.length >= 4 ? currentSeedIds : defaultTop4;
    setOverrideSeeds([s[0] || '', s[1] || '', s[2] || '', s[3] || '']);
    setShowOverrideModal(true);
  };

  const handleSaveOverride = (e: React.FormEvent) => {
    e.preventDefault();
    const res = overridePlayoffQualifiedTeams(overrideSeeds);
    if (!res.success) {
      showNotice(res.error || 'Invalid Top 4 selection.', 'error');
      return;
    }
    setShowOverrideModal(false);
    triggerCelebration();
    showNotice('Top 4 qualified teams overridden & SPL Playoff bracket updated!', 'success');
  };

  const handleOpenEditSchedule = (match: KnockoutMatch) => {
    setEditingScheduleMatch(match);
    setScheduleDraft({
      court: match.court || 1,
      scheduledDate: match.scheduledDate || state.settings.date || '',
      scheduledTime: match.scheduledTime || '',
      assignedUmpire: match.assignedUmpire || '',
    });
  };

  const handleSaveSchedule = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingScheduleMatch) return;
    const courtNum = Number(scheduleDraft.court) || 1;
    const courtName = state.settings.courtNames?.[courtNum - 1]?.trim() || `Court ${courtNum}`;
    const label = getPlayoffMatchDisplayLabel(editingScheduleMatch, activeFormat).title;
    const res = updateKnockoutMatch(editingScheduleMatch.id, {
      court: courtNum,
      courtName,
      scheduledDate: scheduleDraft.scheduledDate.trim() || undefined,
      scheduledTime: scheduleDraft.scheduledTime.trim() || undefined,
      assignedUmpire: scheduleDraft.assignedUmpire.trim() || undefined,
      time: [label, courtName, scheduleDraft.scheduledTime.trim()].filter(Boolean).join(' · '),
    });
    if (!res.success) {
      showNotice(res.error || 'Unable to save schedule.', 'error');
      return;
    }
    setEditingScheduleMatch(null);
    showNotice(`${label} schedule & court assignment saved!`, 'success');
  };

  const handleMoveTieTeam = (tiedIds: string[], idx: number, dir: -1 | 1) => {
    const target = idx + dir;
    if (target < 0 || target >= tiedIds.length) return;
    const reorderedGroup = [...tiedIds];
    const [moved] = reorderedGroup.splice(idx, 1);
    reorderedGroup.splice(target, 0, moved);
    const remaining = (state.knockout.manualTieBreakOrder || []).filter((id) => !tiedIds.includes(id));
    setPlayoffTieBreakOrder([...reorderedGroup, ...remaining]);
    showNotice('Manual tie-break ranking applied.', 'success');
  };

  const handleGoLive = (matchId: string) => {
    const match = state.knockout.matches.find((m) => m.id === matchId);
    if (!match) return;
    const guard = canStartOrScorePlayoffMatch(match, state.knockout.matches, activeFormat);
    if (!guard.allowed) {
      showNotice(guard.reason || 'Prerequisite match not completed yet.', 'error');
      return;
    }
    const res = updateKnockoutMatch(matchId, {
      status: 'live',
      scoreA: match.scoreA ?? 0,
      scoreB: match.scoreB ?? 0,
    });
    if (!res.success) {
      showNotice(res.error || 'Unable to set match live.', 'error');
    }
  };

  const handleScoreChange = (matchId: string, scoreAVal: string, scoreBVal: string) => {
    const sA = parseInt(scoreAVal, 10);
    const sB = parseInt(scoreBVal, 10);
    if (isNaN(sA) || isNaN(sB)) return;

    if (sA === sB) {
      showNotice('A knockout match cannot end in a tie! Please enter a winning score.', 'error');
      return;
    }

    const match = state.knockout.matches.find((m) => m.id === matchId);
    if (!match || !match.teamA || !match.teamB) return;

    const winnerId = sA > sB ? match.teamA : match.teamB;
    const res = updateKnockoutMatch(matchId, {
      scoreA: sA,
      scoreB: sB,
      winner: winnerId,
      status: 'completed',
    });

    if (!res.success) {
      showNotice(res.error || 'Unable to update score.', 'error');
      return;
    }

    if (match.stage === 'F') {
      triggerCelebration();
    }
  };

  const formatBracketText = () => {
    const lines = [
      `🏆 ${state.settings.name} — ${isIPLMode ? 'SPL Championship Playoff Bracket' : 'Knockout Stage Bracket'}`,
      '',
    ];

    if (isIPLMode) {
      const ordered = [...state.knockout.matches];
      ordered.forEach((m) => {
        const label = getPlayoffMatchDisplayLabel(m, 'ipl_top4').title;
        const tA = getTeam(m.teamA)?.name || 'TBD';
        const tB = getTeam(m.teamB)?.name || 'TBD';
        const win = m.winner ? ` → Winner: ${getTeam(m.winner)?.name}` : '';
        lines.push(`${label}: ${tA} (${m.scoreA ?? '-'}) vs (${m.scoreB ?? '-'}) ${tB}${win}`);
      });
      return lines.join('\n');
    }

    if (elimMatches.length > 0) {
      lines.push('🔥 Eliminator / Quarter-Finals:');
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

  const isPublished = state.knockout.published !== false;
  const courtsCount = Math.max(1, Number(state.settings.courts) || 2);

  return (
    <div className="space-y-6 animate-fade-in">
      {notice && (
        <div
          role="alert"
          className={`p-3.5 rounded-2xl border text-xs font-bold flex items-center justify-between animate-fade-in ${
            notice.type === 'success'
              ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-300'
              : 'bg-rose-500/15 border-rose-500/30 text-rose-300'
          }`}
        >
          <span>{notice.text}</span>
          <button
            type="button"
            onClick={() => setNotice(null)}
            aria-label="Dismiss notification"
            className="ml-3 opacity-70 hover:opacity-100"
          >
            ✕
          </button>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-500/20 text-amber-400 font-bold text-xl shrink-0">
              🏆
            </span>
            <h1 className="font-display text-2xl sm:text-3xl font-black text-white">
              Playoff &amp; Knockout Manager
            </h1>
          </div>
          <p className="mt-1 text-xs sm:text-sm text-slate-400">
            SPL Championship Top 4 Playoffs (Qualifier 1 → Eliminator → Qualifier 2 → Grand Final) &amp; knockout brackets.
          </p>
        </div>

        {state.knockout.matches.length > 0 && (
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={handleCopy}
              className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-200 hover:text-white bg-white/10 hover:bg-white/15 rounded-xl transition-colors border border-white/10"
            >
              <Copy className="w-4 h-4 text-amber-400" />
              <span>{copied ? 'Copied' : 'Copy Bracket'}</span>
            </button>

            <button
              type="button"
              onClick={handleWhatsApp}
              className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-emerald-400 bg-emerald-500/10 hover:bg-emerald-500/20 rounded-xl transition-colors border border-emerald-500/20"
            >
              <Share2 className="w-4 h-4" />
              <span>WhatsApp</span>
            </button>

            <button
              type="button"
              onClick={() => setShowAuditLog((prev) => !prev)}
              className={`flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-xl transition-colors border ${
                showAuditLog
                  ? 'bg-amber-500/20 text-amber-300 border-amber-400/40'
                  : 'bg-white/5 text-slate-300 border-white/10 hover:bg-white/10'
              }`}
            >
              <History className="w-4 h-4" />
              <span>Audit Log ({(state.knockout.auditLogs || []).length})</span>
            </button>
          </div>
        )}
      </div>

      {/* Format Selector & Primary Playoff Actions */}
      <div className="rounded-2xl glass-panel p-4 sm:p-5 border border-white/10 space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="space-y-1.5">
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-400">
              Championship Playoff Format
            </label>
            <div className="flex flex-wrap gap-2">
              {[
                { id: 'ipl_top4' as const, label: 'SPL Championship Top 4 (Q1 · ELIM · Q2 · Final)' },
                { id: 'top4' as const, label: 'Top 4 (Semi Finals + Final)' },
                { id: 'top8' as const, label: 'Top 8 (Eliminators + Semis + Final)' },
                { id: 'top2' as const, label: 'Top 2 (Grand Final Only)' },
              ].map((f) => (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => setKnockoutFormat(f.id)}
                  className={`px-3.5 py-1.5 text-xs font-semibold rounded-xl transition-all ${
                    activeFormat === f.id
                      ? 'bg-amber-400 text-slate-950 font-bold shadow'
                      : 'bg-white/5 text-slate-300 hover:text-white hover:bg-white/10'
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={handleRequestGenerate}
              disabled={!eligibility.canGenerate}
              className={`flex items-center gap-1.5 px-4 py-2.5 text-xs font-bold rounded-xl shadow transition-all ${
                eligibility.canGenerate
                  ? 'bg-gradient-to-r from-amber-400 to-amber-500 text-slate-950 hover:from-amber-300 active:scale-95'
                  : 'bg-white/10 text-slate-500 cursor-not-allowed'
              }`}
            >
              <RefreshCw className="w-4 h-4" />
              <span>
                {state.knockout.matches.length > 0
                  ? isIPLMode
                    ? 'Regenerate SPL Playoffs'
                    : 'Regenerate Bracket'
                  : isIPLMode
                  ? 'Generate SPL Playoffs'
                  : 'Seed & Generate Bracket'}
              </span>
            </button>

            <button
              type="button"
              onClick={() => {
                recalculatePlayoffStandings();
                showNotice('Playoff standings & Top 4 qualification recalculated from league results.', 'success');
              }}
              className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-xl bg-white/5 hover:bg-white/10 text-slate-200 border border-white/10 transition-colors"
            >
              <SlidersHorizontal className="w-3.5 h-3.5 text-sky-400" />
              <span>Recalculate Standings</span>
            </button>

            {isIPLMode && playoffSettings.allowManualOverride && (
              <button
                type="button"
                onClick={handleOpenOverrideModal}
                className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-xl bg-white/5 hover:bg-white/10 text-amber-300 border border-amber-400/30 transition-colors"
              >
                <Edit2 className="w-3.5 h-3.5" />
                <span>Override Top 4</span>
              </button>
            )}
          </div>
        </div>

        {/* Secondary Bracket Lifecycle Toolbar when bracket exists */}
        {state.knockout.matches.length > 0 && (
          <div className="pt-3 border-t border-white/10 flex flex-wrap items-center justify-between gap-2.5">
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <span
                className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full font-mono text-[11px] font-bold border ${
                  state.knockout.status === 'completed'
                    ? 'bg-emerald-500/15 text-emerald-300 border-emerald-400/35'
                    : 'bg-amber-500/15 text-amber-300 border-amber-400/35'
                }`}
              >
                <ShieldCheck className="w-3.5 h-3.5" />
                Status: {(state.knockout.status || 'active').toUpperCase()}
              </span>
              <span
                className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full font-mono text-[11px] font-bold border ${
                  isPublished
                    ? 'bg-sky-500/15 text-sky-300 border-sky-400/35'
                    : 'bg-slate-800 text-slate-400 border-white/10'
                }`}
              >
                {isPublished ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
                {isPublished ? 'Published to Public Homepage' : 'Hidden from Public Homepage'}
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  publishPlayoffs(!isPublished);
                  showNotice(
                    !isPublished
                      ? 'Playoff bracket published live to Public Homepage!'
                      : 'Playoff bracket hidden from Public Homepage.',
                    'success'
                  );
                }}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-xl bg-sky-500/15 hover:bg-sky-500/25 text-sky-300 border border-sky-400/30 transition-colors"
              >
                {isPublished ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                <span>{isPublished ? 'Unpublish' : 'Publish Live'}</span>
              </button>

              {!isIPLMode && (
                <button
                  type="button"
                  onClick={() => setEditMode((prev) => !prev)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-xl transition-colors border ${
                    editMode
                      ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                      : 'bg-white/5 text-slate-300 border-white/10 hover:bg-white/10'
                  }`}
                >
                  <Edit2 className="w-3.5 h-3.5" />
                  <span>{editMode ? 'Done Editing' : 'Edit Pairings'}</span>
                </button>
              )}

              <button
                type="button"
                onClick={() => setShowResetConfirm(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-amber-300 bg-amber-500/10 hover:bg-amber-500/20 rounded-xl transition-colors border border-amber-500/25"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Reset Playoffs</span>
              </button>

              <button
                type="button"
                onClick={() => (isIPLMode ? setShowDeleteConfirm(true) : setShowClearConfirm(true))}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-rose-400 hover:text-rose-300 bg-rose-500/10 hover:bg-rose-500/20 rounded-xl transition-colors border border-rose-500/20"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>{isIPLMode ? 'Delete Playoffs' : 'Clear Bracket'}</span>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Blocking Errors / Readiness Warnings */}
      {(eligibility.blockingReasons.length > 0 || eligibility.warnings.length > 0 || conflictWarnings.length > 0) && (
        <div className="space-y-2">
          {eligibility.blockingReasons.map((reason, idx) => (
            <div
              key={`block-${idx}`}
              className="p-3 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-xs text-rose-200 flex items-center gap-2"
            >
              <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
              <span>{reason}</span>
            </div>
          ))}
          {eligibility.warnings.map((warn, idx) => (
            <div
              key={`warn-${idx}`}
              className="p-3 rounded-2xl bg-amber-500/10 border border-amber-400/30 text-xs text-amber-200 flex items-center gap-2"
            >
              <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
              <span>{warn}</span>
            </div>
          ))}
          {conflictWarnings.map((cw, idx) => (
            <div
              key={`cw-${idx}`}
              className="p-3 rounded-2xl bg-rose-500/10 border border-rose-400/35 text-xs text-rose-200 flex items-center gap-2"
            >
              <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
              <span>{cw.message}</span>
            </div>
          ))}
        </div>
      )}

      {/* Unresolved Tie Alert & Manual Resolution Controls */}
      {leagueStandingData.unresolvedTies.length > 0 && (
        <div className="rounded-2xl border border-amber-400/40 bg-amber-500/10 p-4 space-y-3">
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-amber-300">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>Statistical Tie Detected — Admin Resolution Required</span>
          </div>
          {leagueStandingData.unresolvedTies.map((tie, idx) => (
            <div key={idx} className="space-y-2 bg-black/30 rounded-xl p-3 border border-white/10">
              <p className="text-xs text-amber-100">{tie.reason}</p>
              <div className="flex flex-wrap gap-2">
                {tie.tiedTeamIds.map((tid, tIdx) => {
                  const t = getTeam(tid);
                  return (
                    <div
                      key={tid}
                      className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-900 border border-white/10 text-xs text-white"
                    >
                      <span className="font-mono text-amber-300 font-bold">#{tie.rankStart + tIdx}</span>
                      <span className="font-bold">{t?.name || tid}</span>
                      <div className="flex items-center gap-1 ml-1">
                        <button
                          type="button"
                          disabled={tIdx === 0}
                          onClick={() => handleMoveTieTeam(tie.tiedTeamIds, tIdx, -1)}
                          aria-label={`Move ${t?.name} up`}
                          className="p-1 rounded bg-white/10 hover:bg-white/20 disabled:opacity-30"
                        >
                          <ArrowUp className="w-3 h-3" />
                        </button>
                        <button
                          type="button"
                          disabled={tIdx === tie.tiedTeamIds.length - 1}
                          onClick={() => handleMoveTieTeam(tie.tiedTeamIds, tIdx, 1)}
                          aria-label={`Move ${t?.name} down`}
                          className="p-1 rounded bg-white/10 hover:bg-white/20 disabled:opacity-30"
                        >
                          <ArrowDown className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Qualification Dashboard & Official Standings Table */}
      <div className="rounded-2xl glass-card p-4 sm:p-5 border border-white/10 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2">
            <ClipboardList className="w-4 h-4 text-amber-400" />
            <span className="font-bold uppercase tracking-wider text-slate-200">
              SPL League Standings &amp; Top {requiredTeams} Qualification Seedings
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <label className="inline-flex items-center gap-2 px-2.5 py-1 rounded-lg bg-white/5 border border-white/10 text-[11px] font-semibold text-slate-200 cursor-pointer hover:border-amber-400/40 transition-colors">
              <input
                type="checkbox"
                checked={includeKnockoutInStandings}
                onChange={(e) => {
                  const nextVal = e.target.checked;
                  updateSettings({
                    playoffSettings: normalizePlayoffSettings({
                      ...playoffSettings,
                      includeKnockoutInStandings: nextVal,
                    }),
                  });
                }}
                className="h-3.5 w-3.5 accent-amber-400 rounded cursor-pointer"
              />
              <span>Include Knockout Results in League Standings</span>
            </label>
            <span className="font-mono text-slate-400">
              League Matches: {eligibility.leagueCompletedMatches}/{eligibility.leagueTotalMatches} completed ·{' '}
              {leagueStandingData.rankedActive.length} eligible
            </span>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-300">
            <thead className="text-[10px] uppercase font-bold text-slate-400 border-b border-white/10">
              <tr>
                <th className="py-2 pr-3">Rank</th>
                <th className="py-2 pr-3">Team &amp; Doubles Players</th>
                <th className="py-2 px-2 text-center">P</th>
                <th className="py-2 px-2 text-center">W</th>
                <th className="py-2 px-2 text-center">L</th>
                <th className="py-2 px-2 text-center">Set +/-</th>
                <th className="py-2 px-2 text-center">Pt +/-</th>
                <th className="py-2 px-2 text-center text-amber-300">Pts</th>
                <th className="py-2 pl-2 text-right">Playoff Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5 font-mono">
              {leagueStandingData.allRows.map((row) => {
                const isQualified = !row.isDisqualified && row.rank > 0 && row.rank <= requiredTeams;
                return (
                  <tr key={row.team.id} className={row.isDisqualified ? 'opacity-50' : ''}>
                    <td className="py-2.5 pr-3 font-bold text-white">
                      {row.isDisqualified ? 'DQ' : `#${row.rank}`}
                    </td>
                    <td className="py-2.5 pr-3 font-sans">
                      <div className="flex items-center gap-2">
                        <span>{row.team.badge || '🏸'}</span>
                        <div>
                          <span className="font-bold text-white block">{row.team.name}</span>
                          <span className="text-[10px] text-slate-400">
                            {row.playerNames.length > 0 ? row.playerNames.join(' & ') : 'Doubles Pair'}
                          </span>
                        </div>
                      </div>
                    </td>
                    <td className="py-2.5 px-2 text-center">{row.played}</td>
                    <td className="py-2.5 px-2 text-center text-emerald-400">{row.won}</td>
                    <td className="py-2.5 px-2 text-center text-rose-400">{row.lost}</td>
                    <td className="py-2.5 px-2 text-center">
                      {row.setDiff > 0 ? `+${row.setDiff}` : row.setDiff}
                    </td>
                    <td className="py-2.5 px-2 text-center">
                      {row.pointDiff > 0 ? `+${row.pointDiff}` : row.pointDiff}
                    </td>
                    <td className="py-2.5 px-2 text-center font-black text-amber-300">{row.points}</td>
                    <td className="py-2.5 pl-2 text-right font-sans">
                      <div className="inline-flex items-center gap-2">
                        {row.isDisqualified ? (
                          <span className="px-2 py-0.5 rounded bg-rose-500/15 text-rose-300 border border-rose-500/30 text-[10px] font-bold">
                            Disqualified
                          </span>
                        ) : isQualified ? (
                          <span className="px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 text-[10px] font-bold">
                            {isIPLMode ? (row.rank <= 2 ? 'Q1 Seed' : 'Eliminator') : 'Qualified'}
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded bg-white/5 text-slate-400 text-[10px]">
                            Reserve
                          </span>
                        )}
                        <button
                          type="button"
                          onClick={() => toggleTeamPlayoffDisqualification(row.team.id)}
                          title={row.isDisqualified ? 'Restore team playoff eligibility' : 'Disqualify from playoffs'}
                          className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white transition-colors"
                        >
                          <Ban className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Audit Log Panel (Collapsible) */}
      {showAuditLog && (
        <div className="rounded-2xl glass-panel p-4 sm:p-5 border border-white/10 space-y-3">
          <div className="flex items-center justify-between pb-2 border-b border-white/10">
            <span className="text-xs font-bold uppercase tracking-wider text-amber-300 flex items-center gap-1.5">
              <History className="w-4 h-4" />
              Playoff Audit Trail
            </span>
            <button
              type="button"
              onClick={() => setShowAuditLog(false)}
              className="text-xs text-slate-400 hover:text-white"
            >
              Close
            </button>
          </div>
          {(state.knockout.auditLogs || []).length === 0 ? (
            <p className="text-xs text-slate-400">No playoff audit events recorded yet.</p>
          ) : (
            <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
              {(state.knockout.auditLogs || []).map((entry) => (
                <div
                  key={entry.id}
                  className="flex items-center justify-between gap-3 px-3 py-2 rounded-xl bg-white/[0.03] border border-white/5 text-xs"
                >
                  <div className="min-w-0">
                    <span className="font-bold text-white block truncate">{entry.message}</span>
                    <span className="text-[10px] text-slate-400 font-mono">
                      {entry.action} · by {entry.actor}
                    </span>
                  </div>
                  <span className="text-[10px] font-mono text-slate-500 shrink-0">
                    {new Date(entry.at).toLocaleString()}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Grand Champion Banner */}
      {grandChampion && (
        <div className="rounded-3xl p-6 sm:p-8 border border-amber-500/40 bg-gradient-to-r from-amber-500/20 via-amber-600/15 to-orange-500/20 text-center space-y-3 relative overflow-hidden shadow-2xl gold-glow">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-amber-400/20 via-transparent to-transparent" />
          <Crown className="w-14 h-14 sm:w-16 sm:h-16 text-amber-400 mx-auto animate-bounce motion-reduce:animate-none drop-shadow" />
          <span className="text-xs font-bold uppercase tracking-[0.25em] text-amber-300 block">
            Smash Premier League Champion
          </span>
          <h2 className="font-display text-3xl sm:text-5xl font-black text-white">
            {grandChampion.name}
          </h2>
          {runnerUp && (
            <p className="text-sm text-slate-300">
              Runner-Up: <span className="font-bold text-white">{runnerUp.name}</span>
            </p>
          )}
        </div>
      )}

      {/* Playoff Bracket Content */}
      {state.knockout.matches.length > 0 ? (
        isIPLMode ? (
          <div className="rounded-3xl glass-panel p-4 sm:p-6 border border-amber-400/25">
            <IPLPlayoffBracket
              mode="admin"
              knockout={state.knockout}
              teams={state.teams}
              players={state.players}
              courtNames={state.settings.courtNames}
              seasonLabel={state.settings.season || 'SPL 3.0 Champion Edition'}
              allowScheduleEditing={playoffSettings.allowMatchScheduleEditing}
              conflictWarnings={conflictWarnings}
              onGoLive={handleGoLive}
              onOpenUmpire={(id) => setLiveScoringMatchId(id)}
              onEditSchedule={handleOpenEditSchedule}
            />
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 sm:gap-6">
            {elimMatches.length > 0 && (
              <div className="space-y-4">
                <div className="flex items-center gap-2 pb-1 border-b border-white/10">
                  <Flame className="w-4 h-4 text-amber-500" />
                  <h3 className="font-display font-bold text-base text-white uppercase tracking-wider">
                    Quarter-Finals / Eliminators
                  </h3>
                </div>
                <div className="space-y-3">
                  {elimMatches.map((m, idx) => (
                    <KnockoutMatchCard
                      key={m.id}
                      match={m}
                      matchLabel={`Quarter-Final ${idx + 1}`}
                      onScoreSubmit={handleScoreChange}
                      onOpenUmpire={(id) => setLiveScoringMatchId(id)}
                      editMode={editMode}
                    />
                  ))}
                </div>
              </div>
            )}

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
                      onOpenUmpire={(id) => setLiveScoringMatchId(id)}
                      editMode={editMode}
                    />
                  ))}
                </div>
              </div>
            )}

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
                  onOpenUmpire={(id) => setLiveScoringMatchId(id)}
                  editMode={editMode}
                />
              </div>
            )}
          </div>
        )
      ) : (
        <div className="rounded-3xl glass-card p-10 sm:p-12 text-center border border-dashed border-white/10 space-y-4">
          <Trophy className="w-12 h-12 text-slate-600 mx-auto" />
          <h3 className="text-lg font-bold text-white">Championship Bracket Not Yet Formed</h3>
          <p className="text-xs text-slate-400 max-w-md mx-auto">
            {isIPLMode
              ? 'Top 4 teams qualify into the SPL Championship Playoff system: Qualifier 1 (#1 vs #2), Eliminator (#3 vs #4), Qualifier 2, and Grand Final.'
              : 'Once league stages produce qualified teams, click below to generate the playoff bracket.'}
          </p>
          <button
            type="button"
            onClick={handleRequestGenerate}
            disabled={!eligibility.canGenerate}
            className={`px-5 py-2.5 text-xs font-bold rounded-xl shadow transition-all ${
              eligibility.canGenerate
                ? 'bg-amber-400 text-slate-950 hover:bg-amber-300'
                : 'bg-white/10 text-slate-500 cursor-not-allowed'
            }`}
          >
            {isIPLMode ? 'Generate SPL Playoffs' : 'Generate Playoff Bracket'}
          </button>
        </div>
      )}

      {/* Override Top 4 Modal */}
      {showOverrideModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-md">
          <form
            onSubmit={handleSaveOverride}
            className="w-full max-w-lg rounded-3xl bg-slate-900 border border-amber-400/35 p-6 space-y-4 shadow-2xl"
          >
            <div className="flex items-center justify-between pb-2 border-b border-white/10">
              <h3 className="font-display font-black text-lg text-white">Override Top 4 Qualified Teams</h3>
              <button
                type="button"
                onClick={() => setShowOverrideModal(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <p className="text-xs text-slate-400">
              Select 4 distinct teams for Qualifier 1 (#1 vs #2) and Eliminator (#3 vs #4). League matches and standings data are preserved.
            </p>
            <div className="space-y-3">
              {[0, 1, 2, 3].map((slotIdx) => (
                <div key={slotIdx}>
                  <label className="block text-xs font-bold text-amber-300 mb-1">
                    Seed #{slotIdx + 1} ({slotIdx < 2 ? 'Qualifier 1' : 'Eliminator'})
                  </label>
                  <select
                    value={overrideSeeds[slotIdx]}
                    onChange={(e) => {
                      const next = [...overrideSeeds] as [string, string, string, string];
                      next[slotIdx] = e.target.value;
                      setOverrideSeeds(next);
                    }}
                    className="w-full bg-slate-950 border border-white/15 rounded-xl px-3.5 py-2 text-sm text-white focus:outline-none focus:border-amber-400"
                    required
                  >
                    <option value="">Select Team...</option>
                    {state.teams.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.badge || '🏸'} {t.name}
                      </option>
                    ))}
                  </select>
                </div>
              ))}
            </div>
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowOverrideModal(false)}
                className="px-4 py-2 text-xs font-semibold text-slate-300 hover:text-white"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-5 py-2 text-xs font-black bg-amber-400 hover:bg-amber-300 text-slate-950 rounded-xl shadow"
              >
                Save Top 4 Seeds
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Edit Schedule / Court / Umpire Modal */}
      {editingScheduleMatch && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-md">
          <form
            onSubmit={handleSaveSchedule}
            className="w-full max-w-md rounded-3xl bg-slate-900 border border-white/15 p-6 space-y-4 shadow-2xl"
          >
            <div className="flex items-center justify-between pb-2 border-b border-white/10">
              <h3 className="font-display font-black text-lg text-white">
                {getPlayoffMatchDisplayLabel(editingScheduleMatch, activeFormat).title} — Schedule &amp; Court
              </h3>
              <button
                type="button"
                onClick={() => setEditingScheduleMatch(null)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Court Assignment</label>
                <select
                  value={scheduleDraft.court}
                  onChange={(e) => setScheduleDraft({ ...scheduleDraft, court: Number(e.target.value) || 1 })}
                  className="w-full bg-slate-950 border border-white/15 rounded-xl px-3.5 py-2 text-sm text-white"
                >
                  {Array.from({ length: courtsCount }, (_, i) => i + 1).map((c) => (
                    <option key={c} value={c}>
                      {state.settings.courtNames?.[c - 1]?.trim() || `Court ${c}`}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Match Date</label>
                  <input
                    type="date"
                    value={scheduleDraft.scheduledDate}
                    onChange={(e) => setScheduleDraft({ ...scheduleDraft, scheduledDate: e.target.value })}
                    className="w-full bg-slate-950 border border-white/15 rounded-xl px-3 py-2 text-sm text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Start Time</label>
                  <input
                    type="time"
                    value={scheduleDraft.scheduledTime}
                    onChange={(e) => setScheduleDraft({ ...scheduleDraft, scheduledTime: e.target.value })}
                    className="w-full bg-slate-950 border border-white/15 rounded-xl px-3 py-2 text-sm text-white"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Assigned Umpire / Scorer</label>
                <input
                  type="text"
                  placeholder="e.g. Official Umpire Name"
                  value={scheduleDraft.assignedUmpire}
                  onChange={(e) => setScheduleDraft({ ...scheduleDraft, assignedUmpire: e.target.value })}
                  className="w-full bg-slate-950 border border-white/15 rounded-xl px-3.5 py-2 text-sm text-white"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setEditingScheduleMatch(null)}
                className="px-4 py-2 text-xs font-semibold text-slate-300 hover:text-white"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-5 py-2 text-xs font-black bg-amber-400 hover:bg-amber-300 text-slate-950 rounded-xl shadow"
              >
                Save Assignment
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Confirm Generate / Replace Bracket */}
      <ConfirmModal
        isOpen={showGenerateConfirm}
        title={state.knockout.matches.length > 0 ? 'Regenerate Playoff Bracket' : 'Generate SPL Championship Playoffs'}
        message={
          state.knockout.matches.length > 0
            ? 'An active playoff bracket already exists. Regenerating will re-seed teams from current league standings and reset existing playoff scores while preserving all league fixtures.'
            : 'Confirm generating the SPL Championship Top 4 Playoff Bracket (Qualifier 1, Eliminator, Qualifier 2, Grand Final) from current Top 4 league standings?'
        }
        confirmLabel={state.knockout.matches.length > 0 ? 'Regenerate Playoffs' : 'Generate Playoffs'}
        variant={state.knockout.matches.length > 0 ? 'warning' : 'primary'}
        onConfirm={() => {
          setShowGenerateConfirm(false);
          executeGenerateBracket();
        }}
        onCancel={() => setShowGenerateConfirm(false)}
      />

      {/* Confirm Reset Playoffs */}
      <ConfirmModal
        isOpen={showResetConfirm}
        title="Reset Playoff Matches"
        message="Reset all playoff scores, match statuses, Qualifier 2 & Grand Final slots back to scheduled while keeping league matches, teams, and Top 4 qualifiers intact?"
        confirmLabel="Reset Playoffs"
        variant="warning"
        onConfirm={() => {
          resetPlayoffs();
          setShowResetConfirm(false);
          showNotice('Playoffs reset cleanly. League fixtures remain intact.', 'success');
        }}
        onCancel={() => setShowResetConfirm(false)}
      />

      {/* Confirm Delete Playoffs */}
      <ConfirmModal
        isOpen={showDeleteConfirm}
        title="Delete Playoff Bracket"
        message="Delete all playoff bracket matches and reset playoff champion state? All league stage matches, scores, players, and teams will remain untouched."
        confirmLabel="Delete Playoffs"
        variant="danger"
        onConfirm={() => {
          deletePlayoffs();
          setShowDeleteConfirm(false);
          showNotice('Playoff bracket deleted cleanly. League data untouched.', 'success');
        }}
        onCancel={() => setShowDeleteConfirm(false)}
      />

      {/* Legacy Clear Confirmation */}
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

      {/* Live Badminton Scoring Modal for Playoff matches */}
      <LiveMatchScoringModal
        isOpen={Boolean(liveScoringMatchId)}
        onClose={() => setLiveScoringMatchId(null)}
        initialMatchId={liveScoringMatchId || undefined}
        isKnockout={true}
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
  onOpenUmpire?: (matchId: string) => void;
}

const KnockoutMatchCard: React.FC<KnockoutMatchCardProps> = ({
  match,
  matchLabel,
  isFinal,
  onScoreSubmit,
  onOpenUmpire,
}) => {
  const { state, updateKnockoutMatch } = useTournament();
  const [scoreA, setScoreA] = useState(match.scoreA?.toString() ?? '');
  const [scoreB, setScoreB] = useState(match.scoreB?.toString() ?? '');

  React.useEffect(() => {
    setScoreA(match.scoreA?.toString() ?? '');
    setScoreB(match.scoreB?.toString() ?? '');
  }, [match.scoreA, match.scoreB]);

  const teamA = match.teamA ? state.teams.find((t) => t.id === match.teamA) : undefined;
  const teamB = match.teamB ? state.teams.find((t) => t.id === match.teamB) : undefined;

  const isAWinner = match.winner === match.teamA;
  const isBWinner = match.winner === match.teamB;

  const courtNum = match.court || 1;
  const courtDisplay = match.courtName || state.settings.courtNames?.[courtNum - 1]?.trim() || `Court ${courtNum}`;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onScoreSubmit(match.id, scoreA, scoreB);
  };

  return (
    <div
      className={`rounded-2xl glass-card p-4 border transition-all space-y-3 ${
        match.status === 'live'
          ? 'border-rose-500/50 bg-rose-500/[0.04] shadow-lg shadow-rose-500/10'
          : isFinal
          ? 'border-amber-500/40 gold-glow bg-amber-500/5'
          : match.status === 'completed'
          ? 'border-white/15'
          : 'border-white/5'
      }`}
    >
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs pb-2 border-b border-white/10">
        <div className="flex items-center gap-1.5 min-w-0">
          <span className="font-bold text-slate-300 uppercase tracking-wider truncate">{matchLabel}</span>
          <span className="px-1.5 py-0.5 rounded bg-white/5 border border-white/10 text-[10px] font-mono text-slate-400 shrink-0">
            {courtDisplay}
          </span>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          {teamA && teamB && match.status === 'upcoming' && (
            <button
              type="button"
              onClick={() => updateKnockoutMatch(match.id, { status: 'live', scoreA: match.scoreA ?? 0, scoreB: match.scoreB ?? 0 })}
              className="px-2 py-0.5 rounded-lg text-[10px] font-black text-slate-950 bg-emerald-400 hover:bg-emerald-300 transition-all active:scale-95"
              title="Set this knockout match to LIVE broadcast immediately"
            >
              Go Live
            </button>
          )}
          {teamA && teamB && onOpenUmpire && (
            <button
              type="button"
              onClick={() => onOpenUmpire(match.id)}
              className="flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] font-bold text-amber-300 bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/30 transition-all active:scale-95"
              title="Open Live Badminton Scoreboard and Umpire Console"
            >
              <Maximize2 className="w-3 h-3" />
              <span>Umpire</span>
            </button>
          )}
          {match.status === 'live' && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black uppercase bg-rose-500/20 text-rose-300 border border-rose-500/40">
              <span className="w-1.5 h-1.5 rounded-full bg-rose-400 animate-pulse" />
              LIVE
            </span>
          )}
          {(match.status === 'paused' || match.status === 'postponed') && (
            <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase bg-amber-500/20 text-amber-300 border border-amber-500/40">
              PAUSE
            </span>
          )}
          {match.status === 'completed' && (
            <span className="text-[10px] font-bold text-emerald-400 flex items-center gap-1">
              <CheckCircle2 className="w-3 h-3" /> Completed
            </span>
          )}
        </div>
      </div>

      {/* Team A */}
      <div
        className={`flex items-center justify-between p-2.5 rounded-xl border transition-colors ${
          isAWinner
            ? 'bg-emerald-500/10 border-emerald-500/30 text-white font-bold'
            : 'bg-white/5 border-transparent text-slate-300'
        }`}
      >
        <div className="flex items-center gap-2 min-w-0 truncate">
          <span className="shrink-0">{teamA?.badge || '🏸'}</span>
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
        <div className="flex items-center gap-2 min-w-0 truncate">
          <span className="shrink-0">{teamB?.badge || '🏸'}</span>
          <span className="truncate">{teamB?.name || 'Awaiting Winner...'}</span>
        </div>
        {isBWinner && <Crown className="w-4 h-4 text-amber-400 shrink-0" />}
      </div>

      {/* Score input form */}
      {teamA && teamB && (
        <form onSubmit={handleSubmit} className="pt-2 border-t border-white/5 flex flex-wrap items-center gap-2">
          <input
            type="number"
            min={0}
            placeholder="Score A"
            aria-label={`Score for ${teamA.name}`}
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
            aria-label={`Score for ${teamB.name}`}
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
