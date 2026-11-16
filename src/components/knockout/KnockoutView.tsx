import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowDown,
  ArrowLeftRight,
  ArrowUp,
  Ban,
  CheckCircle2,
  ClipboardList,
  Copy,
  Crown,
  Edit2,
  Eye,
  EyeOff,
  FileCheck,
  History,
  Lock,
  Plus,
  RefreshCw,
  RotateCcw,
  Save,
  Share2,
  ShieldCheck,
  Sliders,
  SlidersHorizontal,
  Sparkles,
  Trash2,
  Trophy,
  Users,
  Wand2,
  X,
} from 'lucide-react';
import { useTournament } from '../../context/TournamentContext';
import {
  CustomKnockoutMatchDraft,
  CustomKnockoutStageConfig,
  KnockoutMatch,
  PlayoffFormat,
  PlayoffQualifiedSeed,
  QualificationMode,
} from '../../types/tournament';
import { ConfirmModal } from '../common/ConfirmModal';
import { LiveMatchScoringModal } from '../admin/LiveMatchScoringModal';
import { IPLPlayoffBracket } from './IPLPlayoffBracket';
import {
  buildCustomKnockoutStageConfig,
  calculatePlayoffLeagueStandings,
  canStartOrScorePlayoffMatch,
  evaluatePlayoffGenerationEligibility,
  formatParticipantSourceLabel,
  getFormatDisplayTitle,
  getPlayoffMatchDisplayLabel,
  getRecommendedCustomCounts,
  materializeCustomKnockoutMatches,
  normalizePlayoffSettings,
  resolveFormatQualifyingCount,
  setCustomMatchParticipantSource,
  setCustomMatchWinnerDestination,
  validateCustomKnockoutStageConfig,
  validatePlayoffScheduleAndCourts,
} from '../../utils/playoffEngine';

const FORMAT_OPTIONS: {
  id: PlayoffFormat;
  shortLabel: string;
  countLabel: string;
  defaultCount: number;
  blueprintSummary: string;
}[] = [
  {
    id: 'top2',
    shortLabel: 'Top 2',
    countLabel: 'Grand Final Only',
    defaultCount: 2,
    blueprintSummary: 'Grand Final: Rank 1 vs Rank 2',
  },
  {
    id: 'top3',
    shortLabel: 'Top 3',
    countLabel: '1 Eliminator + Final',
    defaultCount: 3,
    blueprintSummary: 'Eliminator 1: Rank 2 vs Rank 3 · Grand Final: Rank 1 (Bye) vs Winner E1',
  },
  {
    id: 'top4',
    shortLabel: 'Top 4',
    countLabel: 'Format A · Semi Finals + Final',
    defaultCount: 4,
    blueprintSummary:
      'Semi Final 1: Rank 1 vs Rank 4 · Semi Final 2: Rank 2 vs Rank 3 · Grand Final: Winner SF1 vs Winner SF2',
  },
  {
    id: 'top5',
    shortLabel: 'Top 5',
    countLabel: 'Format B · 1 Eliminator + Semis + Final',
    defaultCount: 5,
    blueprintSummary:
      'Eliminator 1: Rank 4 vs Rank 5 · Semi Final 1: Rank 1 vs Winner E1 · Semi Final 2: Rank 2 vs Rank 3 · Grand Final: Winner SF1 vs Winner SF2',
  },
  {
    id: 'top6',
    shortLabel: 'Top 6',
    countLabel: 'Format C · 2 Eliminators + Semis + Final',
    defaultCount: 6,
    blueprintSummary:
      'Eliminator 1: Rank 3 vs Rank 6 · Eliminator 2: Rank 4 vs Rank 5 · Semi Final 1: Rank 1 vs Winner E2 · Semi Final 2: Rank 2 vs Winner E1 · Grand Final: Winner SF1 vs Winner SF2',
  },
  {
    id: 'top7',
    shortLabel: 'Top 7',
    countLabel: 'Format D · 3 Eliminators + Semis + Final',
    defaultCount: 7,
    blueprintSummary:
      'Rank 1 Direct SF1 Bye · E1: Rank 4 vs Rank 5 · E2: Rank 2 vs Rank 7 · E3: Rank 3 vs Rank 6 · SF1: Rank 1 vs Winner E1 · SF2: Winner E2 vs Winner E3 · Final: Winner SF1 vs Winner SF2',
  },
  {
    id: 'top8',
    shortLabel: 'Top 8',
    countLabel: 'Format D · 4 Eliminators + Semis + Final',
    defaultCount: 8,
    blueprintSummary:
      'E1: Rank 1 vs Rank 8 · E2: Rank 4 vs Rank 5 · E3: Rank 2 vs Rank 7 · E4: Rank 3 vs Rank 6 · SF1: Winner E1 vs Winner E2 · SF2: Winner E3 vs Winner E4 · Final: Winner SF1 vs Winner SF2',
  },
  {
    id: 'custom',
    shortLabel: 'Custom Number',
    countLabel: 'Custom N Teams (Seeding & Byes)',
    defaultCount: 6,
    blueprintSummary:
      'Automatic power-of-two bracket with protected top-seed byes and full manual matchup customization.',
  },
  {
    id: 'ipl_top4',
    shortLabel: 'Top 4 (Q1 · ELIM · Q2)',
    countLabel: 'Qualifier & Eliminator System',
    defaultCount: 4,
    blueprintSummary:
      'Qualifier 1: Rank 1 vs Rank 2 · Eliminator: Rank 3 vs Rank 4 · Qualifier 2: Loser Q1 vs Winner ELIM · Grand Final: Winner Q1 vs Winner Q2',
  },
];

export const KnockoutView: React.FC = () => {
  const {
    state,
    setKnockoutFormat,
    configureKnockoutQualification,
    generateKnockoutBracket,
    updateKnockoutMatch,
    saveKnockoutDraft,
    rollbackKnockoutVersion,
    resetSingleKnockoutMatch,
    clearKnockout,
    resetPlayoffs,
    deletePlayoffs,
    publishPlayoffs,
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

  const activeFormat: PlayoffFormat =
    state.knockout.format || playoffSettings.format || 'top4';
  const requiredTeams = resolveFormatQualifyingCount(
    activeFormat,
    state.knockout.qualifyingTeamsCount ?? playoffSettings.qualifyingTeamsCount
  );
  const qualificationMode: QualificationMode =
    state.knockout.qualificationMode || 'auto';

  const [customCountInput, setCustomCountInput] = useState<number>(
    state.knockout.qualifyingTeamsCount || 6
  );
  const [manualTeamIds, setManualTeamIds] = useState<string[]>(
    state.knockout.manualSelectedTeamIds || []
  );
  const [showBracketBuilder, setShowBracketBuilder] = useState(false);
  const [copied, setCopied] = useState(false);
  const [showGenerateConfirm, setShowGenerateConfirm] = useState(false);
  const [pendingGenerateAsDraft, setPendingGenerateAsDraft] = useState(false);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [showAuditLog, setShowAuditLog] = useState(false);
  const [showVersionModal, setShowVersionModal] = useState(false);

  // Schedule & Court Modal state
  const [editingScheduleMatch, setEditingScheduleMatch] = useState<KnockoutMatch | null>(null);
  const [scheduleDraft, setScheduleDraft] = useState({
    court: 1,
    scheduledDate: '',
    scheduledTime: '',
    assignedUmpire: '',
  });

  // Matchup Teams / Sources Editor Modal state
  const [editingMatchup, setEditingMatchup] = useState<KnockoutMatch | null>(null);
  const [matchupDraft, setMatchupDraft] = useState<{
    sourceA: string;
    sourceB: string;
  }>({ sourceA: '', sourceB: '' });

  // Downstream Dependency Protection Modal state
  const [dependencyPrompt, setDependencyPrompt] = useState<{
    matchId: string;
    updates?: Partial<KnockoutMatch>;
    isReset?: boolean;
    errorText: string;
    dependentMatches: KnockoutMatch[];
  } | null>(null);

  const [liveScoringMatchId, setLiveScoringMatchId] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  const showNotice = (text: string, type: 'success' | 'error' = 'error') => {
    setNotice({ text, type });
    window.setTimeout(() => setNotice(null), 4800);
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

  // Keep manualTeamIds array length synced with requiredTeams
  useEffect(() => {
    setManualTeamIds((prev) => {
      const existing =
        prev.length > 0
          ? prev
          : (state.knockout.manualSelectedTeamIds && state.knockout.manualSelectedTeamIds.length > 0
              ? state.knockout.manualSelectedTeamIds
              : (state.knockout.qualifiedTeams || []).map((q) => q.teamId));

      const fallbackFromStandings = leagueStandingData.rankedActive.map((r) => r.team.id);
      const next: string[] = [];
      const used = new Set<string>();

      for (let i = 0; i < requiredTeams; i++) {
        const candidate = existing[i];
        if (candidate && !used.has(candidate) && state.teams.some((t) => t.id === candidate)) {
          next.push(candidate);
          used.add(candidate);
        } else {
          const fallback = fallbackFromStandings.find((id) => !used.has(id));
          if (fallback) {
            next.push(fallback);
            used.add(fallback);
          } else {
            next.push('');
          }
        }
      }
      return next;
    });
  }, [
    requiredTeams,
    state.knockout.manualSelectedTeamIds,
    state.knockout.qualifiedTeams,
    leagueStandingData.rankedActive,
    state.teams,
  ]);

  const eligibility = useMemo(
    () =>
      evaluatePlayoffGenerationEligibility({
        rankedActiveCount: leagueStandingData.rankedActive.length,
        leagueMatches: state.matches,
        knockout: {
          ...state.knockout,
          format: activeFormat,
          qualifyingTeamsCount: requiredTeams,
          qualificationMode,
          manualSelectedTeamIds: manualTeamIds,
        },
        playoffSettings: {
          ...playoffSettings,
          format: activeFormat,
          qualifyingTeamsCount: requiredTeams,
        },
        unresolvedTies: leagueStandingData.unresolvedTies,
        requiredTeamsCount: requiredTeams,
      }),
    [
      leagueStandingData.rankedActive.length,
      leagueStandingData.unresolvedTies,
      state.matches,
      state.knockout,
      playoffSettings,
      activeFormat,
      requiredTeams,
      qualificationMode,
      manualTeamIds,
    ]
  );

  const conflictWarnings = useMemo(
    () => validatePlayoffScheduleAndCourts(state.knockout.matches || [], state.settings.courtNames),
    [state.knockout.matches, state.settings.courtNames]
  );

  const getTeam = (teamId?: string) => (teamId ? state.teams.find((t) => t.id === teamId) : undefined);

  const finalMatch =
    state.knockout.matches.find((m) => m.stage === 'F' || m.playoffRound === 'F') ||
    state.knockout.matches[state.knockout.matches.length - 1];

  const grandChampion =
    finalMatch?.status === 'completed' && finalMatch?.winner
      ? getTeam(finalMatch.winner)
      : state.knockout.championTeamId
      ? getTeam(state.knockout.championTeamId)
      : undefined;

  const runnerUp =
    finalMatch?.status === 'completed' && finalMatch?.winner && finalMatch.teamA && finalMatch.teamB
      ? getTeam(finalMatch.winner === finalMatch.teamA ? finalMatch.teamB : finalMatch.teamA)
      : state.knockout.runnerUpTeamId
      ? getTeam(state.knockout.runnerUpTeamId)
      : undefined;

  const activeFormatMeta =
    FORMAT_OPTIONS.find((f) => f.id === activeFormat) || FORMAT_OPTIONS[2];

  const isCustomFormat = activeFormat === 'custom';

  // Custom Knockout Stage Builder state (Phases 1-5)
  const [customTeamSearch, setCustomTeamSearch] = useState('');
  const [customStageConfig, setCustomStageConfig] = useState<CustomKnockoutStageConfig>(() => {
    if (state.knockout.customStageConfig && state.knockout.customStageConfig.matches?.length > 0) {
      return state.knockout.customStageConfig;
    }
    const initN = state.knockout.qualifyingTeamsCount || 6;
    const rec = getRecommendedCustomCounts(initN);
    return buildCustomKnockoutStageConfig({
      qualifyingTeamsCount: initN,
      eliminatorsCount: rec.eliminatorsCount,
      semiFinalsCount: rec.semiFinalsCount,
      courtsCount: Math.max(1, Number(state.settings.courts) || 2),
      courtNames: state.settings.courtNames,
      tournamentDate: state.settings.date,
      useSmartDefaults: true,
    });
  });

  // Sync from persisted state if updated externally via Realtime
  useEffect(() => {
    if (
      state.knockout.customStageConfig &&
      state.knockout.customStageConfig.updatedAt &&
      state.knockout.customStageConfig.updatedAt !== customStageConfig.updatedAt
    ) {
      setCustomStageConfig(state.knockout.customStageConfig);
      setCustomCountInput(state.knockout.customStageConfig.qualifyingTeamsCount);
    }
  }, [state.knockout.customStageConfig]);

  // Effective qualified seeds for preview & validation
  const previewQualifiedSeeds: PlayoffQualifiedSeed[] = useMemo(() => {
    const selectedIds =
      qualificationMode === 'manual' && manualTeamIds.filter(Boolean).length >= requiredTeams
        ? manualTeamIds.slice(0, requiredTeams)
        : leagueStandingData.rankedActive.slice(0, requiredTeams).map((r) => r.team.id);

    return selectedIds.map((tid, idx) => {
      const row = leagueStandingData.allRows.find((r) => r.team.id === tid);
      const tObj = state.teams.find((t) => t.id === tid);
      return {
        rank: idx + 1,
        teamId: tid,
        teamName: row?.team.name || tObj?.name || `Seed #${idx + 1}`,
        playerNames: row?.playerNames || [],
        points: row?.points ?? 0,
        played: row?.played ?? 0,
        won: row?.won ?? 0,
        lost: row?.lost ?? 0,
        matchWinDiff: row?.matchWinDiff ?? 0,
        setDiff: row?.setDiff ?? 0,
        pointDiff: row?.pointDiff ?? 0,
        status: 'qualified',
      };
    });
  }, [qualificationMode, manualTeamIds, requiredTeams, leagueStandingData, state.teams]);

  const customValidation = useMemo(
    () =>
      validateCustomKnockoutStageConfig({
        config: customStageConfig,
        qualifiedSeeds: previewQualifiedSeeds,
        teams: state.teams,
        maxEligibleTeams:
          qualificationMode === 'manual'
            ? state.teams.length
            : leagueStandingData.rankedActive.length,
      }),
    [
      customStageConfig,
      previewQualifiedSeeds,
      state.teams,
      qualificationMode,
      leagueStandingData.rankedActive.length,
    ]
  );

  const persistCustomConfigUpdate = (nextConfig: CustomKnockoutStageConfig) => {
    setCustomStageConfig(nextConfig);
    setCustomCountInput(nextConfig.qualifyingTeamsCount);
    configureKnockoutQualification({
      format: 'custom',
      qualifyingTeamsCount: nextConfig.qualifyingTeamsCount,
      qualificationMode,
      manualSelectedTeamIds: manualTeamIds,
      customStageConfig: nextConfig,
    });
  };

  const handleCustomTotalTeamsChange = (newN: number, applyRecommendedCounts = true) => {
    const maxAllowed = Math.max(2, state.teams.length || 32);
    const clampedN = Math.max(2, Math.min(maxAllowed, Math.floor(Number(newN) || 2)));
    const rec = getRecommendedCustomCounts(clampedN);
    const nextConfig = buildCustomKnockoutStageConfig({
      qualifyingTeamsCount: clampedN,
      eliminatorsCount: applyRecommendedCounts ? rec.eliminatorsCount : customStageConfig.eliminatorsCount,
      semiFinalsCount: applyRecommendedCounts ? rec.semiFinalsCount : customStageConfig.semiFinalsCount,
      existingConfig: applyRecommendedCounts ? null : customStageConfig,
      courtsCount: Math.max(1, Number(state.settings.courts) || 2),
      courtNames: state.settings.courtNames,
      tournamentDate: state.settings.date,
      useSmartDefaults: applyRecommendedCounts,
    });
    persistCustomConfigUpdate(nextConfig);
  };

  const handleCustomEliminatorsCountChange = (newE: number) => {
    const clampedE = Math.max(0, Math.min(16, Math.floor(Number(newE) || 0)));
    const nextConfig = buildCustomKnockoutStageConfig({
      qualifyingTeamsCount: customStageConfig.qualifyingTeamsCount,
      eliminatorsCount: clampedE,
      semiFinalsCount: customStageConfig.semiFinalsCount,
      existingConfig: customStageConfig,
      courtsCount: Math.max(1, Number(state.settings.courts) || 2),
      courtNames: state.settings.courtNames,
      tournamentDate: state.settings.date,
      useSmartDefaults: false,
    });
    persistCustomConfigUpdate(nextConfig);
  };

  const handleCustomSemiFinalsCountChange = (newS: number) => {
    const clampedS = Math.max(0, Math.min(8, Math.floor(Number(newS) || 0)));
    const nextConfig = buildCustomKnockoutStageConfig({
      qualifyingTeamsCount: customStageConfig.qualifyingTeamsCount,
      eliminatorsCount: customStageConfig.eliminatorsCount,
      semiFinalsCount: clampedS,
      existingConfig: customStageConfig,
      courtsCount: Math.max(1, Number(state.settings.courts) || 2),
      courtNames: state.settings.courtNames,
      tournamentDate: state.settings.date,
      useSmartDefaults: false,
    });
    persistCustomConfigUpdate(nextConfig);
  };

  const handleApplyRecommendedCustomStructure = () => {
    const rec = getRecommendedCustomCounts(customStageConfig.qualifyingTeamsCount);
    const nextConfig = buildCustomKnockoutStageConfig({
      qualifyingTeamsCount: rec.qualifyingTeamsCount,
      eliminatorsCount: rec.eliminatorsCount,
      semiFinalsCount: rec.semiFinalsCount,
      courtsCount: Math.max(1, Number(state.settings.courts) || 2),
      courtNames: state.settings.courtNames,
      tournamentDate: state.settings.date,
      useSmartDefaults: true,
    });
    persistCustomConfigUpdate(nextConfig);
    showNotice(`Applied recommended structure: ${rec.summary}`, 'success');
  };

  const handleCustomMatchParticipantChange = (
    matchCode: string,
    slot: 'A' | 'B',
    newSource: string
  ) => {
    const nextConfig = setCustomMatchParticipantSource(
      customStageConfig,
      matchCode,
      slot,
      newSource
    );
    persistCustomConfigUpdate(nextConfig);
  };

  const handleCustomMatchWinnerDestChange = (
    upstreamMatchCode: string,
    destToken: string
  ) => {
    const nextConfig = setCustomMatchWinnerDestination(
      customStageConfig,
      upstreamMatchCode,
      destToken
    );
    persistCustomConfigUpdate(nextConfig);
  };

  const handleCustomMatchSwapParticipants = (matchCode: string) => {
    const nextMatches = customStageConfig.matches.map((m) =>
      m.matchCode === matchCode
        ? {
            ...m,
            participantASource: m.participantBSource,
            participantBSource: m.participantASource,
          }
        : m
    );
    persistCustomConfigUpdate({
      ...customStageConfig,
      matches: nextMatches,
      updatedAt: Date.now(),
    });
  };

  const handleCustomMatchMetaChange = (
    matchCode: string,
    updates: Partial<CustomKnockoutMatchDraft>
  ) => {
    const nextMatches = customStageConfig.matches.map((m) => {
      if (m.matchCode !== matchCode) return m;
      const courtNum = updates.court ?? m.court ?? 1;
      const courtName =
        updates.court !== undefined
          ? state.settings.courtNames?.[courtNum - 1]?.trim() || `Court ${courtNum}`
          : m.courtName;
      return {
        ...m,
        ...updates,
        court: courtNum,
        courtName,
      };
    });
    persistCustomConfigUpdate({
      ...customStageConfig,
      matches: nextMatches,
      updatedAt: Date.now(),
    });
  };

  const handleRemoveCustomMatchCard = (matchDraft: CustomKnockoutMatchDraft) => {
    if (matchDraft.stage === 'F' || matchDraft.matchCode === 'FINAL') return;
    if (matchDraft.stage === 'ELIM') {
      handleCustomEliminatorsCountChange(Math.max(0, customStageConfig.eliminatorsCount - 1));
      showNotice(`Removed ${matchDraft.matchLabel} from draft configuration.`, 'success');
    } else if (matchDraft.stage === 'SF') {
      handleCustomSemiFinalsCountChange(Math.max(0, customStageConfig.semiFinalsCount - 1));
      showNotice(`Removed ${matchDraft.matchLabel} from draft configuration.`, 'success');
    }
  };

  const handleSelectFormat = (fmt: PlayoffFormat, customVal?: number) => {
    const count = resolveFormatQualifyingCount(fmt, customVal ?? customCountInput);
    if (fmt === 'custom') {
      const rec = getRecommendedCustomCounts(count);
      const nextCfg = buildCustomKnockoutStageConfig({
        qualifyingTeamsCount: count,
        eliminatorsCount: rec.eliminatorsCount,
        semiFinalsCount: rec.semiFinalsCount,
        courtsCount: Math.max(1, Number(state.settings.courts) || 2),
        courtNames: state.settings.courtNames,
        tournamentDate: state.settings.date,
        useSmartDefaults: true,
      });
      setCustomStageConfig(nextCfg);
      setCustomCountInput(count);
      configureKnockoutQualification({
        format: fmt,
        qualifyingTeamsCount: count,
        qualificationMode,
        manualSelectedTeamIds: manualTeamIds,
        customStageConfig: nextCfg,
      });
      return;
    }
    setKnockoutFormat(fmt, count);
  };

  const handleQualificationModeChange = (mode: QualificationMode) => {
    configureKnockoutQualification({
      format: activeFormat,
      qualifyingTeamsCount: requiredTeams,
      qualificationMode: mode,
      manualSelectedTeamIds: manualTeamIds,
      customStageConfig: isCustomFormat ? customStageConfig : undefined,
    });
  };

  const handleManualSeedChange = (slotIndex: number, newTeamId: string) => {
    const next = [...manualTeamIds];
    const existingIdx = next.findIndex((id, i) => i !== slotIndex && id === newTeamId && newTeamId !== '');
    if (existingIdx !== -1) {
      // Swap with the slot that already had this team to prevent duplicates
      next[existingIdx] = next[slotIndex];
    }
    next[slotIndex] = newTeamId;
    setManualTeamIds(next);
    configureKnockoutQualification({
      format: activeFormat,
      qualifyingTeamsCount: requiredTeams,
      qualificationMode: 'manual',
      manualSelectedTeamIds: next,
      customStageConfig: isCustomFormat ? customStageConfig : undefined,
    });
  };

  const handleMoveManualSeed = (slotIndex: number, dir: -1 | 1) => {
    const target = slotIndex + dir;
    if (target < 0 || target >= manualTeamIds.length) return;
    const next = [...manualTeamIds];
    const [moved] = next.splice(slotIndex, 1);
    next.splice(target, 0, moved);
    setManualTeamIds(next);
    configureKnockoutQualification({
      format: activeFormat,
      qualifyingTeamsCount: requiredTeams,
      qualificationMode: 'manual',
      manualSelectedTeamIds: next,
      customStageConfig: isCustomFormat ? customStageConfig : undefined,
    });
  };

  const handleAutoFillManualFromStandings = () => {
    const topIds = leagueStandingData.rankedActive
      .slice(0, requiredTeams)
      .map((r) => r.team.id);
    setManualTeamIds(topIds);
    configureKnockoutQualification({
      format: activeFormat,
      qualifyingTeamsCount: requiredTeams,
      qualificationMode: 'manual',
      manualSelectedTeamIds: topIds,
      customStageConfig: isCustomFormat ? customStageConfig : undefined,
    });
    showNotice(`Filled Top ${topIds.length} seeds from Official League Standings.`, 'success');
  };

  const executeGenerateBracket = (saveAsDraft = false) => {
    if (isCustomFormat && !customValidation.valid) {
      showNotice(
        customValidation.errors[0] || 'Custom knockout configuration has validation errors.',
        'error'
      );
      return;
    }
    const res = generateKnockoutBracket({
      format: activeFormat,
      qualifyingTeamsCount: isCustomFormat ? customStageConfig.qualifyingTeamsCount : requiredTeams,
      qualificationMode,
      manualTeamIds: qualificationMode === 'manual' ? manualTeamIds : undefined,
      customStageConfig: isCustomFormat ? customStageConfig : undefined,
      saveAsDraft,
    });
    if (!res.success) {
      showNotice(res.error || 'Could not generate knockout bracket.', 'error');
      return;
    }
    triggerCelebration();
    const title = getFormatDisplayTitle(
      activeFormat,
      isCustomFormat ? customStageConfig.qualifyingTeamsCount : requiredTeams
    );
    showNotice(
      saveAsDraft
        ? `${title} saved as Draft! You can customize pairings before publishing.`
        : `${title} generated & synced live to Match Center and Public Website!`,
      'success'
    );
  };

  const handleRequestGenerate = (saveAsDraft = false) => {
    if (!eligibility.canGenerate) {
      showNotice(
        eligibility.blockingReasons[0] || 'Knockout generation prerequisites not met.',
        'error'
      );
      return;
    }
    if (isCustomFormat && !customValidation.valid) {
      showNotice(
        customValidation.errors[0] || 'Please fix the custom knockout bracket validation errors first.',
        'error'
      );
      return;
    }
    setPendingGenerateAsDraft(saveAsDraft);
    if (playoffSettings.requireAdminConfirmation || state.knockout.matches.length > 0) {
      setShowGenerateConfirm(true);
    } else {
      executeGenerateBracket(saveAsDraft);
    }
  };

  // Build available participant source options for any knockout match
  const getParticipantSourceOptions = (targetMatch: KnockoutMatch) => {
    const options: { value: string; label: string; group: string }[] = [];

    // 1. Qualified Seed Ranks (#1 .. #N)
    const seeds = state.knockout.qualifiedTeams || [];
    const maxRank = Math.max(requiredTeams, seeds.length);
    for (let r = 1; r <= maxRank; r++) {
      const seedObj = seeds.find((s) => s.rank === r);
      const teamName = seedObj
        ? getTeam(seedObj.teamId)?.name || seedObj.teamName
        : leagueStandingData.rankedActive[r - 1]?.team.name;
      options.push({
        value: `RANK_${r}`,
        label: teamName ? `Rank #${r} (${teamName})` : `Rank #${r} Seed`,
        group: 'Qualified Seeds (By Rank)',
      });
    }

    // 2. Upstream Match Winners / Losers (only matches from earlier or other slots)
    for (const m of state.knockout.matches) {
      if (m.id === targetMatch.id) continue;
      const mOrder = m.roundOrder || 1;
      const targetOrder = targetMatch.roundOrder || 2;
      if (mOrder <= targetOrder) {
        const code = m.matchCode || m.playoffRound || `${m.stage}${m.slot}`;
        const label = m.matchLabel || getPlayoffMatchDisplayLabel(m, activeFormat).title;
        const winName =
          m.status === 'completed' && m.winner ? getTeam(m.winner)?.name : undefined;
        options.push({
          value: `WINNER:${code}`,
          label: winName ? `Winner of ${label} (${winName})` : `Winner of ${label}`,
          group: 'Upstream Match Progression',
        });
        if (activeFormat === 'ipl_top4' || m.playoffRound === 'Q1') {
          options.push({
            value: `LOSER:${code}`,
            label: `Loser of ${label}`,
            group: 'Upstream Match Progression',
          });
        }
      }
    }

    // 3. Direct Team Selection (any tournament team by ID)
    for (const t of state.teams) {
      options.push({
        value: `TEAM:${t.id}`,
        label: `${t.badge || '🏸'} ${t.name}`,
        group: 'Direct Team Assignment',
      });
    }

    return options;
  };

  // Convert a selected source token (`RANK_1`, `WINNER:E1`, `TEAM:<id>`) into `{ participantSource, teamId, seed }`
  const resolveSourceSelection = (
    sourceVal: string
  ): { participantSource?: string; teamId?: string; seed?: number } => {
    if (!sourceVal) return { participantSource: undefined, teamId: undefined, seed: undefined };

    if (sourceVal.startsWith('RANK_')) {
      const rank = parseInt(sourceVal.replace('RANK_', ''), 10);
      const seedEntry = (state.knockout.qualifiedTeams || []).find((q) => q.rank === rank);
      const fallbackTeamId = leagueStandingData.rankedActive[rank - 1]?.team.id;
      return {
        participantSource: sourceVal,
        teamId: seedEntry?.teamId || fallbackTeamId,
        seed: rank,
      };
    }

    if (sourceVal.startsWith('TEAM:')) {
      const tid = sourceVal.slice('TEAM:'.length);
      const seedEntry = (state.knockout.qualifiedTeams || []).find((q) => q.teamId === tid);
      return {
        participantSource: sourceVal,
        teamId: tid || undefined,
        seed: seedEntry?.rank,
      };
    }

    if (sourceVal.startsWith('WINNER:') || sourceVal.startsWith('LOSER:')) {
      const isWinner = sourceVal.startsWith('WINNER:');
      const code = sourceVal.slice(isWinner ? 'WINNER:'.length : 'LOSER:'.length);
      const upMatch = state.knockout.matches.find(
        (m) => (m.matchCode || m.playoffRound || `${m.stage}${m.slot}`) === code
      );
      const resolvedTeamId =
        upMatch && upMatch.status === 'completed' && upMatch.winner
          ? isWinner
            ? upMatch.winner
            : upMatch.loserId ||
              (upMatch.winner === upMatch.teamA ? upMatch.teamB : upMatch.teamA)
          : undefined;
      return {
        participantSource: sourceVal,
        teamId: resolvedTeamId,
        seed: undefined,
      };
    }

    return { participantSource: sourceVal, teamId: undefined, seed: undefined };
  };

  const getInitialSourceValue = (m: KnockoutMatch, side: 'A' | 'B'): string => {
    const rawSource = side === 'A' ? m.participantASource : m.participantBSource;
    const teamId = side === 'A' ? m.teamA : m.teamB;
    if (rawSource) {
      if (rawSource === 'Q1_WINNER') return 'WINNER:Q1';
      if (rawSource === 'Q1_LOSER') return 'LOSER:Q1';
      if (rawSource === 'ELIM_WINNER') return 'WINNER:ELIM';
      if (rawSource === 'Q2_WINNER') return 'WINNER:Q2';
      return rawSource;
    }
    if (teamId) return `TEAM:${teamId}`;
    return '';
  };

  const handleOpenEditMatchup = (match: KnockoutMatch) => {
    setEditingMatchup(match);
    setMatchupDraft({
      sourceA: getInitialSourceValue(match, 'A'),
      sourceB: getInitialSourceValue(match, 'B'),
    });
  };

  const applyMatchupUpdate = (
    matchId: string,
    updates: Partial<KnockoutMatch>,
    forceCascade = false
  ) => {
    const res = updateKnockoutMatch(matchId, updates, {
      forceCascadeDownstream: forceCascade,
    });
    if (res.dependencyWarning && res.dependentMatches) {
      setDependencyPrompt({
        matchId,
        updates,
        errorText: res.error || 'Downstream match has already started.',
        dependentMatches: res.dependentMatches,
      });
      return false;
    }
    if (!res.success) {
      showNotice(res.error || 'Could not update knockout matchup.', 'error');
      return false;
    }
    return true;
  };

  const handleSaveMatchupModal = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingMatchup) return;

    const resA = resolveSourceSelection(matchupDraft.sourceA);
    const resB = resolveSourceSelection(matchupDraft.sourceB);

    if (resA.teamId && resB.teamId && resA.teamId === resB.teamId) {
      showNotice('A team cannot be assigned against itself in the same knockout match.', 'error');
      return;
    }

    const ok = applyMatchupUpdate(editingMatchup.id, {
      participantASource: resA.participantSource,
      participantBSource: resB.participantSource,
      teamA: resA.teamId,
      teamB: resB.teamId,
      seedA: resA.seed,
      seedB: resB.seed,
      manual: Boolean(
        resA.participantSource?.startsWith('TEAM:') ||
          resB.participantSource?.startsWith('TEAM:')
      ),
    });

    if (ok) {
      const label =
        editingMatchup.matchLabel ||
        getPlayoffMatchDisplayLabel(editingMatchup, activeFormat).title;
      setEditingMatchup(null);
      showNotice(`${label} matchup assignment updated!`, 'success');
    }
  };

  const handleSwapMatchTeams = (match: KnockoutMatch) => {
    const ok = applyMatchupUpdate(match.id, {
      teamA: match.teamB,
      teamB: match.teamA,
      participantASource: match.participantBSource,
      participantBSource: match.participantASource,
      seedA: match.seedB,
      seedB: match.seedA,
    });
    if (ok) {
      const label =
        match.matchLabel || getPlayoffMatchDisplayLabel(match, activeFormat).title;
      showNotice(`Swapped Team A and Team B in ${label}.`, 'success');
    }
  };

  const handleResetSingleMatch = (match: KnockoutMatch) => {
    const res = resetSingleKnockoutMatch(match.id, false);
    if (res.dependencyWarning && res.dependentMatches) {
      setDependencyPrompt({
        matchId: match.id,
        isReset: true,
        errorText: res.error || 'Downstream match depends on this result.',
        dependentMatches: res.dependentMatches,
      });
      return;
    }
    if (!res.success) {
      showNotice(res.error || 'Unable to reset match.', 'error');
      return;
    }
    showNotice(
      `Reset ${match.matchLabel || match.matchCode || 'knockout match'} to Scheduled.`,
      'success'
    );
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
    const label =
      editingScheduleMatch.matchLabel ||
      getPlayoffMatchDisplayLabel(editingScheduleMatch, activeFormat).title;
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
    if (!match.teamA || !match.teamB) {
      showNotice('Both competing teams must be determined before setting this match LIVE.', 'error');
      return;
    }
    if (activeFormat === 'ipl_top4' || match.playoffRound === 'Q1' || match.playoffRound === 'Q2') {
      const guard = canStartOrScorePlayoffMatch(match, state.knockout.matches, activeFormat);
      if (!guard.allowed) {
        showNotice(guard.reason || 'Prerequisite match not completed yet.', 'error');
        return;
      }
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

  const formatBracketText = () => {
    const title = getFormatDisplayTitle(activeFormat, requiredTeams);
    const lines = [`🏆 ${state.settings.name} — ${title}`, ''];
    state.knockout.matches.forEach((m) => {
      const label = m.matchLabel || getPlayoffMatchDisplayLabel(m, activeFormat).title;
      const tA =
        getTeam(m.teamA)?.name ||
        formatParticipantSourceLabel(
          m.participantASource,
          state.knockout.matches,
          state.knockout.qualifiedTeams,
          state.teams,
          'TBD'
        );
      const tB =
        getTeam(m.teamB)?.name ||
        formatParticipantSourceLabel(
          m.participantBSource,
          state.knockout.matches,
          state.knockout.qualifiedTeams,
          state.teams,
          'TBD'
        );
      const win = m.winner ? ` → Winner: ${getTeam(m.winner)?.name}` : '';
      lines.push(`${label}: ${tA} (${m.scoreA ?? '-'}) vs (${m.scoreB ?? '-'}) ${tB}${win}`);
    });
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
  const versionHistory = state.knockout.versionHistory || [];

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
            <div>
              <span className="text-[10px] font-mono font-black uppercase tracking-[0.2em] text-amber-400 block">
                Smash Premier League · Championship Engine
              </span>
              <h1 className="font-display text-2xl sm:text-3xl font-black text-white">
                Knockout Control Center
              </h1>
            </div>
          </div>
          <p className="mt-1 text-xs sm:text-sm text-slate-400">
            Configure qualifying team counts (Top 2 to Top 8 &amp; Custom), automatic or manual seeding, Eliminator &amp; Semi-Final pairings, and real-time bracket progression.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {state.knockout.matches.length > 0 && (
            <>
              <button
                type="button"
                onClick={handleCopy}
                className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-200 hover:text-white bg-white/10 hover:bg-white/15 rounded-xl transition-colors border border-white/10 cursor-pointer"
              >
                <Copy className="w-4 h-4 text-amber-400" />
                <span>{copied ? 'Copied' : 'Copy Bracket'}</span>
              </button>

              <button
                type="button"
                onClick={handleWhatsApp}
                className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-emerald-400 bg-emerald-500/10 hover:bg-emerald-500/20 rounded-xl transition-colors border border-emerald-500/20 cursor-pointer"
              >
                <Share2 className="w-4 h-4" />
                <span>WhatsApp</span>
              </button>
            </>
          )}

          {versionHistory.length > 0 && (
            <button
              type="button"
              onClick={() => setShowVersionModal(true)}
              className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-xl bg-violet-500/15 text-violet-300 border border-violet-400/35 hover:bg-violet-500/25 transition-colors cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Versions ({versionHistory.length})</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => setShowAuditLog((prev) => !prev)}
            className={`flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-xl transition-colors border cursor-pointer ${
              showAuditLog
                ? 'bg-amber-500/20 text-amber-300 border-amber-400/40'
                : 'bg-white/5 text-slate-300 border-white/10 hover:bg-white/10'
            }`}
          >
            <History className="w-4 h-4" />
            <span>Audit Log ({(state.knockout.auditLogs || []).length})</span>
          </button>
        </div>
      </div>

      {/* =====================================================================
          STEP 1 & STEP 2: KNOCKOUT CONTROL CENTER CONFIGURATION PANEL
         ===================================================================== */}
      <div className="rounded-2xl glass-panel p-4 sm:p-6 border border-white/10 space-y-5">
        {/* Step 1: Select Qualifying Teams Count & Format */}
        <div className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 rounded-md bg-amber-400/20 border border-amber-400/40 font-mono text-[10px] font-black text-amber-300 uppercase">
                Step 1
              </span>
              <span className="text-xs font-bold uppercase tracking-wider text-white">
                Select Qualifying Teams &amp; Knockout Structure
              </span>
            </div>
            <span className="text-[11px] font-mono text-slate-400">
              Active Roster: <strong className="text-white">{state.teams.length}</strong> teams · Eligible:{' '}
              <strong className="text-emerald-400">{leagueStandingData.rankedActive.length}</strong>
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
            {FORMAT_OPTIONS.map((opt) => {
              const isSelected = activeFormat === opt.id;
              return (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => handleSelectFormat(opt.id)}
                  className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                    isSelected
                      ? 'bg-amber-400/15 border-amber-400 text-white shadow-[0_0_20px_-6px_rgba(245,158,11,0.45)]'
                      : 'bg-white/[0.03] border-white/10 text-slate-300 hover:bg-white/[0.07] hover:border-white/20'
                  }`}
                >
                  <div className="flex items-center justify-between gap-1">
                    <span className="font-display font-black text-sm text-white">
                      {opt.shortLabel}
                    </span>
                    {isSelected && (
                      <CheckCircle2 className="w-4 h-4 text-amber-400 shrink-0" />
                    )}
                  </div>
                  <span className="block text-[10px] text-slate-400 mt-0.5 truncate">
                    {opt.countLabel}
                  </span>
                </button>
              );
            })}
          </div>

          {/* =================================================================
              ADVANCED CUSTOM KNOCKOUT STAGE BUILDER (PHASES 1 – 10)
             ================================================================= */}
          {isCustomFormat && (
            <div className="p-4 sm:p-5 rounded-2xl bg-slate-950/90 border border-amber-400/35 space-y-5 animate-fade-in">
              <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-white/10">
                <div>
                  <span className="text-[10px] font-mono font-black uppercase tracking-[0.2em] text-amber-400 block">
                    Custom Knockout Stage Builder
                  </span>
                  <h3 className="font-display font-black text-base sm:text-lg text-white">
                    Configure Qualified Teams, Eliminators, Semi Finals &amp; Grand Final
                  </h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Define the exact number of Eliminator and Semi Final matches, assign teams or Direct Byes, choose where each winner advances, and preview the live bracket in real time.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={handleApplyRecommendedCustomStructure}
                  className="px-3.5 py-2 rounded-xl bg-amber-400/15 hover:bg-amber-400/25 border border-amber-400/40 text-xs font-bold text-amber-300 flex items-center gap-1.5 cursor-pointer transition-colors"
                >
                  <Wand2 className="w-3.5 h-3.5" />
                  <span>
                    Apply Recommended ({customValidation.recommended.eliminatorsCount}E ·{' '}
                    {customValidation.recommended.semiFinalsCount}SF · 1F)
                  </span>
                </button>
              </div>

              {/* Phase 1: 4-Column Stage Count Controls */}
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3.5">
                {/* 1. Total Qualified Teams */}
                <div className="p-3.5 rounded-xl bg-slate-900/90 border border-white/10 space-y-2.5">
                  <div className="flex items-center justify-between gap-2">
                    <label className="text-xs font-bold text-amber-300">
                      1. Total Qualified Teams
                    </label>
                    <span className="font-mono text-[10px] text-slate-400">
                      Max: {Math.max(2, state.teams.length || 32)}
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {[4, 5, 6, 7, 8].map((presetN) => {
                      const active = customStageConfig.qualifyingTeamsCount === presetN;
                      return (
                        <button
                          key={presetN}
                          type="button"
                          onClick={() => handleCustomTotalTeamsChange(presetN, true)}
                          className={`px-2.5 py-1 rounded-lg text-[11px] font-mono font-bold border transition-colors cursor-pointer ${
                            active
                              ? 'bg-amber-400 text-slate-950 border-amber-300'
                              : 'bg-white/5 text-slate-300 border-white/10 hover:bg-white/10'
                          }`}
                        >
                          {presetN} Teams
                        </button>
                      );
                    })}
                  </div>
                  <div className="flex items-center gap-2 pt-1">
                    <span className="text-[11px] text-slate-400">Custom Count:</span>
                    <input
                      type="number"
                      min={2}
                      max={Math.max(2, state.teams.length || 32)}
                      value={customStageConfig.qualifyingTeamsCount}
                      onChange={(e) => {
                        const val = Math.max(2, parseInt(e.target.value, 10) || 2);
                        handleCustomTotalTeamsChange(val, true);
                      }}
                      aria-label="Total Qualified Teams"
                      className="w-20 bg-slate-950 border border-white/15 rounded-lg px-2.5 py-1 text-xs font-mono font-bold text-white"
                    />
                  </div>
                </div>

                {/* 2. Number of Eliminator Matches */}
                <div className="p-3.5 rounded-xl bg-slate-900/90 border border-white/10 space-y-2.5">
                  <label className="text-xs font-bold text-sky-300 block">
                    2. How many Eliminator matches do you want?
                  </label>
                  <div className="flex flex-wrap gap-1.5">
                    {[0, 1, 2, 3, 4].map((presetE) => {
                      const active = customStageConfig.eliminatorsCount === presetE;
                      return (
                        <button
                          key={presetE}
                          type="button"
                          onClick={() => handleCustomEliminatorsCountChange(presetE)}
                          className={`px-2.5 py-1 rounded-lg text-[11px] font-mono font-bold border transition-colors cursor-pointer ${
                            active
                              ? 'bg-sky-400 text-slate-950 border-sky-300'
                              : 'bg-white/5 text-slate-300 border-white/10 hover:bg-white/10'
                          }`}
                        >
                          {presetE} {presetE === 1 ? 'Eliminator' : 'Eliminators'}
                        </button>
                      );
                    })}
                  </div>
                  <div className="flex items-center gap-2 pt-1">
                    <span className="text-[11px] text-slate-400">Custom Eliminators:</span>
                    <input
                      type="number"
                      min={0}
                      max={16}
                      value={customStageConfig.eliminatorsCount}
                      onChange={(e) => {
                        const val = Math.max(0, parseInt(e.target.value, 10) || 0);
                        handleCustomEliminatorsCountChange(val);
                      }}
                      aria-label="Number of Eliminator matches"
                      className="w-20 bg-slate-950 border border-white/15 rounded-lg px-2.5 py-1 text-xs font-mono font-bold text-white"
                    />
                  </div>
                </div>

                {/* 3. Number of Semi Final Matches */}
                <div className="p-3.5 rounded-xl bg-slate-900/90 border border-white/10 space-y-2.5">
                  <label className="text-xs font-bold text-violet-300 block">
                    3. How many Semi Final matches do you want?
                  </label>
                  <div className="flex flex-wrap gap-1.5">
                    {[0, 1, 2].map((presetS) => {
                      const active = customStageConfig.semiFinalsCount === presetS;
                      return (
                        <button
                          key={presetS}
                          type="button"
                          onClick={() => handleCustomSemiFinalsCountChange(presetS)}
                          className={`px-2.5 py-1 rounded-lg text-[11px] font-mono font-bold border transition-colors cursor-pointer ${
                            active
                              ? 'bg-violet-400 text-slate-950 border-violet-300'
                              : 'bg-white/5 text-slate-300 border-white/10 hover:bg-white/10'
                          }`}
                        >
                          {presetS} {presetS === 1 ? 'Semi Final' : 'Semi Finals'}
                        </button>
                      );
                    })}
                  </div>
                  <div className="flex items-center gap-2 pt-1">
                    <span className="text-[11px] text-slate-400">Custom Semi Finals:</span>
                    <input
                      type="number"
                      min={0}
                      max={8}
                      value={customStageConfig.semiFinalsCount}
                      onChange={(e) => {
                        const val = Math.max(0, parseInt(e.target.value, 10) || 0);
                        handleCustomSemiFinalsCountChange(val);
                      }}
                      aria-label="Number of Semi Final matches"
                      className="w-20 bg-slate-950 border border-white/15 rounded-lg px-2.5 py-1 text-xs font-mono font-bold text-white"
                    />
                  </div>
                </div>

                {/* 4. Grand Final Summary */}
                <div className="p-3.5 rounded-xl bg-slate-900/90 border border-amber-400/25 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-amber-300">
                      4. Championship Grand Final
                    </span>
                    <Trophy className="w-4 h-4 text-amber-400" />
                  </div>
                  <p className="text-[11px] text-slate-300">
                    <strong>1 Grand Final Match</strong> receiving two valid finalists (from Semi Final winners, Eliminator winners, or Direct Final Bye).
                  </p>
                  <div className="pt-1 flex items-center justify-between text-[11px] font-mono">
                    <span className="text-slate-400">Total Matches:</span>
                    <span
                      className={`font-black ${
                        customStageConfig.matches.length ===
                        customStageConfig.qualifyingTeamsCount - 1
                          ? 'text-emerald-400'
                          : 'text-rose-400'
                      }`}
                    >
                      {customStageConfig.matches.length} /{' '}
                      {customStageConfig.qualifyingTeamsCount - 1} required (N − 1)
                    </span>
                  </div>
                </div>
              </div>

              {/* Phase 5: Real-Time 14-Point Smart Bracket Validation Status */}
              <div
                className={`p-3.5 rounded-2xl border space-y-2 ${
                  customValidation.valid
                    ? 'bg-emerald-500/10 border-emerald-400/35'
                    : 'bg-rose-500/10 border-rose-400/40'
                }`}
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    {customValidation.valid ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                    ) : (
                      <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
                    )}
                    <span
                      className={`text-xs font-black uppercase tracking-wider ${
                        customValidation.valid ? 'text-emerald-300' : 'text-rose-300'
                      }`}
                    >
                      {customValidation.valid
                        ? `Valid Single-Elimination Bracket (${customStageConfig.qualifyingTeamsCount} Teams · ${customStageConfig.matches.length} Matches)`
                        : `Invalid Custom Bracket Configuration (${customValidation.errors.length} ${
                            customValidation.errors.length === 1 ? 'Issue' : 'Issues'
                          })`}
                    </span>
                  </div>

                  {!customValidation.valid && (
                    <button
                      type="button"
                      onClick={handleApplyRecommendedCustomStructure}
                      className="px-3 py-1 rounded-lg bg-amber-400 text-slate-950 text-[11px] font-black cursor-pointer hover:bg-amber-300"
                    >
                      Fix with Recommended Structure ({customValidation.recommended.eliminatorsCount}E +{' '}
                      {customValidation.recommended.semiFinalsCount}SF + 1F)
                    </button>
                  )}
                </div>

                {!customValidation.valid && (
                  <ul className="space-y-1 text-xs text-rose-200 list-disc list-inside">
                    {customValidation.errors.map((err, i) => (
                      <li key={i}>{err}</li>
                    ))}
                  </ul>
                )}

                {customValidation.warnings.length > 0 && (
                  <ul className="space-y-1 text-xs text-amber-200 list-disc list-inside">
                    {customValidation.warnings.map((w, i) => (
                      <li key={i}>{w}</li>
                    ))}
                  </ul>
                )}

                {customValidation.directQualifiers.length > 0 && (
                  <div className="pt-1 flex flex-wrap items-center gap-1.5 text-[11px]">
                    <span className="font-mono font-bold text-emerald-300 uppercase">
                      Direct Qualification / Byes:
                    </span>
                    {customValidation.directQualifiers.map((dq, idx) => (
                      <span
                        key={idx}
                        className="px-2 py-0.5 rounded-md bg-emerald-500/15 border border-emerald-400/30 text-emerald-200 font-mono"
                      >
                        {dq.label} → {dq.destinationLabel}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {/* Searchable Team Filter for Custom Matchup Assignment */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-2 flex-1">
                  <span className="text-xs font-bold text-slate-300 shrink-0">
                    Filter Qualified Teams:
                  </span>
                  <input
                    type="text"
                    value={customTeamSearch}
                    onChange={(e) => setCustomTeamSearch(e.target.value)}
                    placeholder="Search by team name, seed #, or league rank..."
                    className="w-full max-w-sm bg-slate-900 border border-white/15 rounded-xl px-3 py-1.5 text-xs text-white focus:outline-none focus:border-amber-400"
                  />
                  {customTeamSearch && (
                    <button
                      type="button"
                      onClick={() => setCustomTeamSearch('')}
                      className="text-xs text-slate-400 hover:text-white cursor-pointer"
                    >
                      Clear
                    </button>
                  )}
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      handleCustomEliminatorsCountChange(customStageConfig.eliminatorsCount + 1)
                    }
                    className="px-3 py-1.5 rounded-xl bg-sky-500/15 hover:bg-sky-500/25 border border-sky-400/35 text-xs font-bold text-sky-300 flex items-center gap-1 cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Add Eliminator</span>
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      handleCustomSemiFinalsCountChange(customStageConfig.semiFinalsCount + 1)
                    }
                    className="px-3 py-1.5 rounded-xl bg-violet-500/15 hover:bg-violet-500/25 border border-violet-400/35 text-xs font-bold text-violet-300 flex items-center gap-1 cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Add Semi Final</span>
                  </button>
                </div>
              </div>

              {/* ===============================================================
                  SIDE-BY-SIDE DESKTOP / STACKED MOBILE:
                  LEFT (7 cols): DYNAMIC ELIMINATORS, SEMI FINALS & GRAND FINAL CARDS
                  RIGHT (5 cols): LIVE KNOCKOUT BRACKET PREVIEW
                 =============================================================== */}
              <div className="grid grid-cols-1 xl:grid-cols-12 gap-5 items-start">
                {/* LEFT COLUMN: Editable Match Generator Cards */}
                <div className="xl:col-span-7 space-y-4">
                  {[
                    {
                      stageKey: 'ELIM',
                      title: `Eliminator Matches (${customStageConfig.eliminatorsCount})`,
                      badgeClass: 'bg-sky-500/20 text-sky-300 border-sky-400/40',
                      matches: customStageConfig.matches.filter((m) => m.stage === 'ELIM'),
                    },
                    {
                      stageKey: 'SF',
                      title: `Semi Final Matches (${customStageConfig.semiFinalsCount})`,
                      badgeClass: 'bg-violet-500/20 text-violet-300 border-violet-400/40',
                      matches: customStageConfig.matches.filter((m) => m.stage === 'SF'),
                    },
                    {
                      stageKey: 'F',
                      title: 'Championship Grand Final (1)',
                      badgeClass: 'bg-amber-500/20 text-amber-300 border-amber-400/40',
                      matches: customStageConfig.matches.filter((m) => m.stage === 'F'),
                    },
                  ].map((group) => {
                    if (group.matches.length === 0) return null;

                    return (
                      <div key={group.stageKey} className="space-y-2.5">
                        <div className="flex items-center justify-between">
                          <span
                            className={`px-2.5 py-0.5 rounded-md border font-mono text-[10px] font-black uppercase ${group.badgeClass}`}
                          >
                            {group.title}
                          </span>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          {group.matches.map((card) => {
                            const cardErrs = customValidation.matchErrors[card.matchCode] || [];
                            const searchLower = customTeamSearch.trim().toLowerCase();

                            // Build participant source options for this custom card
                            const seedSourceOptions: { value: string; label: string }[] = [];
                            for (let r = 1; r <= customStageConfig.qualifyingTeamsCount; r++) {
                              const seedObj = previewQualifiedSeeds.find((s) => s.rank === r);
                              const teamObj = seedObj ? getTeam(seedObj.teamId) : undefined;
                              const row = seedObj
                                ? leagueStandingData.allRows.find((rw) => rw.team.id === seedObj.teamId)
                                : undefined;
                              const badge = teamObj?.badge || '🏸';
                              const name = seedObj?.teamName || `Seed #${r}`;
                              const leagueRankText = row && row.rank > 0 ? `League #${row.rank}` : '';
                              const byeSuffix =
                                card.stage === 'SF'
                                  ? ' · Direct Semi-Final Bye'
                                  : card.stage === 'F'
                                  ? ' · Direct Final Bye'
                                  : '';
                              const fullLabel = `Seed #${r} — ${badge} ${name}${
                                leagueRankText ? ` (${leagueRankText})` : ''
                              }${byeSuffix}`;

                              const val = `RANK_${r}`;
                              if (
                                !searchLower ||
                                fullLabel.toLowerCase().includes(searchLower) ||
                                card.participantASource === val ||
                                card.participantBSource === val
                              ) {
                                seedSourceOptions.push({ value: val, label: fullLabel });
                              }
                            }

                            // Upstream Winner Reference Options
                            const upstreamOptions: { value: string; label: string }[] = [];
                            for (const up of customStageConfig.matches) {
                              if (up.matchCode === card.matchCode) continue;
                              if (
                                up.roundOrder < card.roundOrder ||
                                (up.stage === 'ELIM' && card.stage === 'ELIM' && up.slot < card.slot)
                              ) {
                                upstreamOptions.push({
                                  value: `WINNER:${up.matchCode}`,
                                  label: `Winner ${up.matchLabel} (${up.matchCode})`,
                                });
                              }
                            }

                            // Direct Team ID Options from Qualified Pool
                            const directTeamOptions: { value: string; label: string }[] = [];
                            for (const seedObj of previewQualifiedSeeds) {
                              const t = getTeam(seedObj.teamId);
                              if (!t) continue;
                              const row = leagueStandingData.allRows.find((rw) => rw.team.id === t.id);
                              const val = `TEAM:${t.id}`;
                              const label = `${t.badge || '🏸'} ${t.name} (Seed #${seedObj.rank}${
                                row ? ` · ${row.points} pts` : ''
                              })`;
                              if (
                                !searchLower ||
                                label.toLowerCase().includes(searchLower) ||
                                card.participantASource === val ||
                                card.participantBSource === val
                              ) {
                                directTeamOptions.push({ value: val, label });
                              }
                            }

                            // Downstream Destination Options for Winner of this match
                            const destinationOptions: { value: string; label: string }[] = [];
                            if (card.stage !== 'F') {
                              for (const down of customStageConfig.matches) {
                                if (down.matchCode === card.matchCode) continue;
                                if (
                                  down.roundOrder > card.roundOrder ||
                                  (down.stage === 'ELIM' && card.stage === 'ELIM' && down.slot > card.slot)
                                ) {
                                  destinationOptions.push({
                                    value: `${down.matchCode}:A`,
                                    label: `${down.matchLabel} (${down.matchCode}) — Slot A`,
                                  });
                                  destinationOptions.push({
                                    value: `${down.matchCode}:B`,
                                    label: `${down.matchLabel} (${down.matchCode}) — Slot B`,
                                  });
                                }
                              }
                            }

                            const currentDestValue =
                              card.nextMatchCode && card.nextMatchSlot
                                ? `${card.nextMatchCode}:${card.nextMatchSlot}`
                                : '';

                            return (
                              <div
                                key={card.matchCode}
                                className={`p-3.5 rounded-2xl bg-slate-900 border space-y-3 ${
                                  cardErrs.length > 0
                                    ? 'border-rose-400/60 shadow-[0_0_20px_-8px_rgba(244,63,94,0.45)]'
                                    : 'border-white/10'
                                }`}
                              >
                                <div className="flex items-center justify-between gap-2 pb-2 border-b border-white/10">
                                  <div className="flex items-center gap-2 min-w-0">
                                    <span className="px-2 py-0.5 rounded bg-amber-400/20 border border-amber-400/40 font-mono text-[10px] font-black text-amber-300">
                                      {card.matchCode}
                                    </span>
                                    <span className="font-bold text-xs text-white truncate">
                                      {card.matchLabel}
                                    </span>
                                  </div>
                                  <div className="flex items-center gap-1">
                                    <button
                                      type="button"
                                      onClick={() =>
                                        handleCustomMatchSwapParticipants(card.matchCode)
                                      }
                                      title="Swap Participant A & Participant B"
                                      className="px-2 py-1 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-[10px] font-semibold text-slate-200 flex items-center gap-1 cursor-pointer"
                                    >
                                      <ArrowLeftRight className="w-3 h-3 text-amber-400" />
                                      <span>Swap</span>
                                    </button>
                                    {card.stage !== 'F' && (
                                      <button
                                        type="button"
                                        onClick={() => handleRemoveCustomMatchCard(card)}
                                        title={`Remove ${card.matchLabel} (Draft)`}
                                        className="p-1 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/25 text-rose-300 cursor-pointer"
                                      >
                                        <Trash2 className="w-3 h-3" />
                                      </button>
                                    )}
                                  </div>
                                </div>

                                {/* Team A / Participant A Selection */}
                                <div className="space-y-2">
                                  <div>
                                    <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">
                                      Team A / Slot A Source
                                    </label>
                                    <select
                                      value={card.participantASource}
                                      onChange={(e) =>
                                        handleCustomMatchParticipantChange(
                                          card.matchCode,
                                          'A',
                                          e.target.value
                                        )
                                      }
                                      aria-label={`${card.matchLabel} Team A`}
                                      className="w-full bg-slate-950 border border-white/15 rounded-xl px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-amber-400"
                                    >
                                      <option value="">Select Team or Winner Reference...</option>
                                      {upstreamOptions.length > 0 && (
                                        <optgroup label="Previous Match Winners (Dynamic TBD)">
                                          {upstreamOptions.map((o) => (
                                            <option key={`up-a-${o.value}`} value={o.value}>
                                              {o.label}
                                            </option>
                                          ))}
                                        </optgroup>
                                      )}
                                      <optgroup
                                        label={
                                          card.stage === 'ELIM'
                                            ? 'Qualified Team Pool (By Seed Rank)'
                                            : 'Direct Qualification / Seed Bye'
                                        }
                                      >
                                        {seedSourceOptions.map((o) => (
                                          <option key={`seed-a-${o.value}`} value={o.value}>
                                            {o.label}
                                          </option>
                                        ))}
                                      </optgroup>
                                      {directTeamOptions.length > 0 && (
                                        <optgroup label="Qualified Teams (Direct Team ID)">
                                          {directTeamOptions.map((o) => (
                                            <option key={`team-a-${o.value}`} value={o.value}>
                                              {o.label}
                                            </option>
                                          ))}
                                        </optgroup>
                                      )}
                                    </select>
                                  </div>

                                  {/* Team B / Participant B Selection */}
                                  <div>
                                    <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">
                                      Team B / Slot B Source
                                    </label>
                                    <select
                                      value={card.participantBSource}
                                      onChange={(e) =>
                                        handleCustomMatchParticipantChange(
                                          card.matchCode,
                                          'B',
                                          e.target.value
                                        )
                                      }
                                      aria-label={`${card.matchLabel} Team B`}
                                      className="w-full bg-slate-950 border border-white/15 rounded-xl px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-amber-400"
                                    >
                                      <option value="">Select Team or Winner Reference...</option>
                                      {upstreamOptions.length > 0 && (
                                        <optgroup label="Previous Match Winners (Dynamic TBD)">
                                          {upstreamOptions.map((o) => (
                                            <option key={`up-b-${o.value}`} value={o.value}>
                                              {o.label}
                                            </option>
                                          ))}
                                        </optgroup>
                                      )}
                                      <optgroup
                                        label={
                                          card.stage === 'ELIM'
                                            ? 'Qualified Team Pool (By Seed Rank)'
                                            : 'Direct Qualification / Seed Bye'
                                        }
                                      >
                                        {seedSourceOptions.map((o) => (
                                          <option key={`seed-b-${o.value}`} value={o.value}>
                                            {o.label}
                                          </option>
                                        ))}
                                      </optgroup>
                                      {directTeamOptions.length > 0 && (
                                        <optgroup label="Qualified Teams (Direct Team ID)">
                                          {directTeamOptions.map((o) => (
                                            <option key={`team-b-${o.value}`} value={o.value}>
                                              {o.label}
                                            </option>
                                          ))}
                                        </optgroup>
                                      )}
                                    </select>
                                  </div>

                                  {/* Winner Destination Selection (for Eliminators & Semi Finals) */}
                                  {card.stage !== 'F' && (
                                    <div>
                                      <label className="block text-[10px] font-bold uppercase text-emerald-300 mb-1">
                                        Winner Advances To (Destination)
                                      </label>
                                      <select
                                        value={currentDestValue}
                                        onChange={(e) =>
                                          handleCustomMatchWinnerDestChange(
                                            card.matchCode,
                                            e.target.value
                                          )
                                        }
                                        aria-label={`${card.matchLabel} Winner Destination`}
                                        className="w-full bg-slate-950 border border-emerald-400/30 rounded-xl px-2.5 py-1.5 text-xs text-emerald-200 focus:outline-none focus:border-emerald-400"
                                      >
                                        <option value="">Unassigned Winner Destination...</option>
                                        {destinationOptions.map((d) => (
                                          <option key={d.value} value={d.value}>
                                            {d.label}
                                          </option>
                                        ))}
                                      </select>
                                    </div>
                                  )}

                                  {/* Court, Date & Time Allocation */}
                                  <div className="grid grid-cols-3 gap-1.5 pt-1">
                                    <div>
                                      <label className="block text-[9px] font-bold uppercase text-slate-400 mb-0.5">
                                        Court
                                      </label>
                                      <select
                                        value={card.court || 1}
                                        onChange={(e) =>
                                          handleCustomMatchMetaChange(card.matchCode, {
                                            court: Number(e.target.value) || 1,
                                          })
                                        }
                                        aria-label={`${card.matchLabel} Court`}
                                        className="w-full bg-slate-950 border border-white/10 rounded-lg px-2 py-1 text-[11px] text-white"
                                      >
                                        {Array.from({ length: courtsCount }, (_, i) => i + 1).map(
                                          (c) => (
                                            <option key={c} value={c}>
                                              {state.settings.courtNames?.[c - 1]?.trim() ||
                                                `Court ${c}`}
                                            </option>
                                          )
                                        )}
                                      </select>
                                    </div>
                                    <div>
                                      <label className="block text-[9px] font-bold uppercase text-slate-400 mb-0.5">
                                        Date
                                      </label>
                                      <input
                                        type="date"
                                        value={card.scheduledDate || ''}
                                        onChange={(e) =>
                                          handleCustomMatchMetaChange(card.matchCode, {
                                            scheduledDate: e.target.value || undefined,
                                          })
                                        }
                                        aria-label={`${card.matchLabel} Date`}
                                        className="w-full bg-slate-950 border border-white/10 rounded-lg px-2 py-1 text-[11px] text-white"
                                      />
                                    </div>
                                    <div>
                                      <label className="block text-[9px] font-bold uppercase text-slate-400 mb-0.5">
                                        Time
                                      </label>
                                      <input
                                        type="time"
                                        value={card.scheduledTime || ''}
                                        onChange={(e) =>
                                          handleCustomMatchMetaChange(card.matchCode, {
                                            scheduledTime: e.target.value || undefined,
                                          })
                                        }
                                        aria-label={`${card.matchLabel} Time`}
                                        className="w-full bg-slate-950 border border-white/10 rounded-lg px-2 py-1 text-[11px] text-white"
                                      />
                                    </div>
                                  </div>
                                </div>

                                {cardErrs.length > 0 && (
                                  <div className="p-2 rounded-lg bg-rose-500/15 border border-rose-400/35 text-[11px] text-rose-200 space-y-0.5">
                                    {cardErrs.map((ce, idx) => (
                                      <p key={idx}>• {ce}</p>
                                    ))}
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* RIGHT COLUMN: PHASE 4 — LIVE KNOCKOUT BRACKET PREVIEW */}
                <div className="xl:col-span-5 xl:sticky xl:top-4 rounded-2xl bg-slate-900/95 border border-amber-400/30 p-4 space-y-4">
                  <div className="flex items-center justify-between gap-2 pb-2.5 border-b border-white/10">
                    <div>
                      <span className="text-[10px] font-mono font-black uppercase tracking-widest text-amber-400 block">
                        Live Knockout Bracket Preview
                      </span>
                      <h4 className="font-display font-black text-sm text-white">
                        Interactive Stage Progression Tree
                      </h4>
                    </div>
                    <span
                      className={`px-2 py-0.5 rounded-full font-mono text-[10px] font-bold border ${
                        customValidation.valid
                          ? 'bg-emerald-500/15 text-emerald-300 border-emerald-400/35'
                          : 'bg-rose-500/15 text-rose-300 border-rose-400/35'
                      }`}
                    >
                      {customValidation.valid ? 'VALID' : 'NEEDS FIX'}
                    </span>
                  </div>

                  {/* Visual Stage-by-Stage Progression Diagram */}
                  <div className="space-y-3 overflow-x-auto pb-1">
                    {[
                      {
                        label: 'ELIMINATORS',
                        items: customStageConfig.matches.filter((m) => m.stage === 'ELIM'),
                      },
                      {
                        label: 'SEMI FINALS',
                        items: customStageConfig.matches.filter((m) => m.stage === 'SF'),
                      },
                      {
                        label: 'GRAND FINAL',
                        items: customStageConfig.matches.filter((m) => m.stage === 'F'),
                      },
                    ].map((stageCol) => {
                      if (stageCol.items.length === 0) return null;

                      const renderPreviewSlot = (
                        src: string,
                        stage: CustomKnockoutMatchDraft['stage']
                      ) => {
                        if (!src) {
                          return (
                            <span className="text-rose-400 font-mono text-[11px] font-bold">
                              TBD (Unassigned Slot)
                            </span>
                          );
                        }
                        if (src.toUpperCase().startsWith('WINNER:')) {
                          const refCode = src.slice(7).toUpperCase();
                          return (
                            <span className="text-sky-300 font-mono text-[11px] font-bold">
                              TBD · Winner {refCode}
                            </span>
                          );
                        }
                        const label = formatParticipantSourceLabel(src, {
                          qualifiedTeams: previewQualifiedSeeds,
                          teams: state.teams,
                        });
                        const isDirectBye = stage === 'SF' || stage === 'F';
                        return (
                          <span className="flex items-center justify-between gap-1.5 text-[11px] font-bold text-white">
                            <span className="truncate">{label}</span>
                            {isDirectBye && (
                              <span className="px-1.5 py-0.5 rounded bg-emerald-500/20 border border-emerald-400/35 text-[9px] font-mono text-emerald-300 shrink-0">
                                DIRECT BYE
                              </span>
                            )}
                          </span>
                        );
                      };

                      return (
                        <div key={stageCol.label} className="space-y-2">
                          <div className="text-[10px] font-mono font-black uppercase tracking-wider text-slate-400">
                            {stageCol.label}
                          </div>
                          <div className="space-y-2">
                            {stageCol.items.map((item) => {
                              const hasErr =
                                (customValidation.matchErrors[item.matchCode] || []).length > 0;
                              return (
                                <div
                                  key={`prev-${item.matchCode}`}
                                  className={`p-3 rounded-xl border space-y-1.5 ${
                                    item.stage === 'F'
                                      ? 'bg-gradient-to-r from-amber-500/15 to-orange-500/10 border-amber-400/40'
                                      : hasErr
                                      ? 'bg-rose-500/10 border-rose-400/50'
                                      : 'bg-slate-950/90 border-white/10'
                                  }`}
                                >
                                  <div className="flex items-center justify-between text-[10px] font-mono">
                                    <span className="font-black text-amber-300">
                                      {item.matchCode}: {item.matchLabel}
                                    </span>
                                    <span className="text-slate-400">
                                      {item.courtName || `Court ${item.court || 1}`}
                                      {item.scheduledTime ? ` · ${item.scheduledTime}` : ''}
                                    </span>
                                  </div>
                                  <div className="p-2 rounded-lg bg-slate-900/90 border border-white/5 space-y-1">
                                    <div>{renderPreviewSlot(item.participantASource, item.stage)}</div>
                                    <div className="text-[9px] font-mono text-slate-500 uppercase">
                                      vs
                                    </div>
                                    <div>{renderPreviewSlot(item.participantBSource, item.stage)}</div>
                                  </div>
                                  {item.stage !== 'F' && (
                                    <div className="text-[10px] font-mono text-right">
                                      {item.nextMatchCode ? (
                                        <span className="text-emerald-300">
                                          ── Winner {item.matchCode} ──► {item.nextMatchCode} (Slot{' '}
                                          {item.nextMatchSlot || 'A'})
                                        </span>
                                      ) : (
                                        <span className="text-rose-400 font-bold">
                                          ⚠ Winner destination unassigned
                                        </span>
                                      )}
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Phase 8 Action Buttons inside Live Preview */}
                  <div className="pt-2 border-t border-white/10 flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      disabled={!customValidation.valid || !eligibility.canGenerate}
                      onClick={() => executeGenerateBracket(true)}
                      className={`flex-1 px-3 py-2 rounded-xl text-xs font-bold border transition-colors cursor-pointer ${
                        customValidation.valid && eligibility.canGenerate
                          ? 'bg-white/5 hover:bg-white/10 text-amber-300 border-amber-400/40'
                          : 'bg-white/5 text-slate-600 border-white/5 cursor-not-allowed'
                      }`}
                    >
                      Save Custom Draft
                    </button>
                    <button
                      type="button"
                      disabled={!customValidation.valid || !eligibility.canGenerate}
                      onClick={() => handleRequestGenerate(false)}
                      className={`flex-1 px-3 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-colors cursor-pointer ${
                        customValidation.valid && eligibility.canGenerate
                          ? 'bg-amber-400 hover:bg-amber-300 text-slate-950 shadow'
                          : 'bg-white/10 text-slate-500 cursor-not-allowed'
                      }`}
                    >
                      Generate &amp; Publish
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Format Blueprint Callout */}
          <div className="px-3.5 py-2.5 rounded-xl bg-slate-900/60 border border-white/10 flex flex-wrap items-center justify-between gap-2 text-xs">
            <div className="flex items-center gap-2 text-slate-300">
              <Sparkles className="w-4 h-4 text-amber-400 shrink-0" />
              <span>
                <strong className="text-white">
                  {getFormatDisplayTitle(activeFormat, requiredTeams)}:
                </strong>{' '}
                {isCustomFormat
                  ? `${customStageConfig.qualifyingTeamsCount} Qualified Teams · ${customStageConfig.eliminatorsCount} Eliminator(s) · ${customStageConfig.semiFinalsCount} Semi Final(s) · 1 Grand Final`
                  : activeFormatMeta.blueprintSummary}
              </span>
            </div>
          </div>
        </div>

        {/* Step 2: Select Qualification Method (Auto from Standings vs Manual Team Selection) */}
        <div className="pt-4 border-t border-white/10 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 rounded-md bg-sky-400/20 border border-sky-400/40 font-mono text-[10px] font-black text-sky-300 uppercase">
                Step 2
              </span>
              <span className="text-xs font-bold uppercase tracking-wider text-white">
                Select Qualification Method ({requiredTeams} Teams)
              </span>
            </div>

            {state.knockout.publishedSnapshot && isPublished && (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/15 border border-emerald-400/35 text-[10px] font-mono font-bold text-emerald-300">
                <Lock className="w-3 h-3" />
                Published Qualification Snapshot Active
              </span>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => handleQualificationModeChange('auto')}
              className={`p-3.5 rounded-xl border text-left transition-all cursor-pointer ${
                qualificationMode === 'auto'
                  ? 'bg-sky-500/15 border-sky-400 text-white'
                  : 'bg-white/[0.03] border-white/10 text-slate-300 hover:bg-white/[0.06]'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="font-bold text-xs sm:text-sm flex items-center gap-2">
                  <Wand2 className="w-4 h-4 text-sky-400" />
                  Mode A · Automatic from League Standings
                </span>
                {qualificationMode === 'auto' && (
                  <CheckCircle2 className="w-4 h-4 text-sky-400 shrink-0" />
                )}
              </div>
              <p className="text-[11px] text-slate-400 mt-1">
                Automatically seeds the Top {requiredTeams} teams from Official League Standings (Points → Wins → Set Diff → Point Diff → Head-to-Head).
              </p>
            </button>

            <button
              type="button"
              onClick={() => handleQualificationModeChange('manual')}
              className={`p-3.5 rounded-xl border text-left transition-all cursor-pointer ${
                qualificationMode === 'manual'
                  ? 'bg-amber-500/15 border-amber-400 text-white'
                  : 'bg-white/[0.03] border-white/10 text-slate-300 hover:bg-white/[0.06]'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="font-bold text-xs sm:text-sm flex items-center gap-2">
                  <Users className="w-4 h-4 text-amber-400" />
                  Mode B · Manual Team Selection &amp; Custom Seeding
                </span>
                {qualificationMode === 'manual' && (
                  <CheckCircle2 className="w-4 h-4 text-amber-400 shrink-0" />
                )}
              </div>
              <p className="text-[11px] text-slate-400 mt-1">
                Manually select, replace, or reorder the {requiredTeams} qualifying teams and custom seeds (#1 to #{requiredTeams}).
              </p>
            </button>
          </div>

          {/* Manual Team Selection Interactive Seed Builder */}
          {qualificationMode === 'manual' && (
            <div className="p-4 rounded-2xl bg-slate-900/90 border border-amber-400/30 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-xs font-bold uppercase tracking-wider text-amber-300">
                  Manual Qualification Seeding (#1 to #{requiredTeams})
                </span>
                <button
                  type="button"
                  onClick={handleAutoFillManualFromStandings}
                  className="px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-[11px] font-semibold text-slate-200 cursor-pointer"
                >
                  Auto-Fill Top {requiredTeams} from Standings
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
                {Array.from({ length: requiredTeams }, (_, idx) => {
                  const selectedId = manualTeamIds[idx] || '';
                  return (
                    <div
                      key={idx}
                      className="p-2.5 rounded-xl bg-slate-950 border border-white/10 space-y-1.5"
                    >
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="font-mono font-black text-amber-300">
                          Seed #{idx + 1}
                        </span>
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            disabled={idx === 0}
                            onClick={() => handleMoveManualSeed(idx, -1)}
                            className="p-1 rounded bg-white/5 hover:bg-white/15 disabled:opacity-30 text-slate-300 cursor-pointer"
                            title="Move seed up"
                          >
                            <ArrowUp className="w-3 h-3" />
                          </button>
                          <button
                            type="button"
                            disabled={idx === requiredTeams - 1}
                            onClick={() => handleMoveManualSeed(idx, 1)}
                            className="p-1 rounded bg-white/5 hover:bg-white/15 disabled:opacity-30 text-slate-300 cursor-pointer"
                            title="Move seed down"
                          >
                            <ArrowDown className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                      <select
                        value={selectedId}
                        onChange={(e) => handleManualSeedChange(idx, e.target.value)}
                        aria-label={`Select team for Seed #${idx + 1}`}
                        className="w-full bg-slate-900 border border-white/15 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-amber-400"
                      >
                        <option value="">Select Team...</option>
                        {state.teams.map((t) => {
                          const row = leagueStandingData.allRows.find((r) => r.team.id === t.id);
                          const ptsText = row ? ` (${row.points} pts · #${row.rank})` : '';
                          return (
                            <option key={t.id} value={t.id}>
                              {t.badge || '🏸'} {t.name}
                              {ptsText}
                            </option>
                          );
                        })}
                      </select>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Step 5 & Step 6: Generate, Save Draft & Publish Actions */}
        <div className="pt-4 border-t border-white/10 flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => handleRequestGenerate(false)}
              disabled={!eligibility.canGenerate}
              className={`flex items-center gap-1.5 px-4 py-2.5 text-xs font-black uppercase tracking-wider rounded-xl shadow transition-all cursor-pointer ${
                eligibility.canGenerate
                  ? 'bg-gradient-to-r from-amber-400 to-amber-500 text-slate-950 hover:from-amber-300 active:scale-95'
                  : 'bg-white/10 text-slate-500 cursor-not-allowed'
              }`}
            >
              <RefreshCw className="w-4 h-4" />
              <span>
                {state.knockout.matches.length > 0
                  ? 'Regenerate Knockout Fixtures'
                  : 'Generate Knockout Fixtures'}
              </span>
            </button>

            <button
              type="button"
              onClick={() => handleRequestGenerate(true)}
              disabled={!eligibility.canGenerate}
              className={`flex items-center gap-1.5 px-3.5 py-2.5 text-xs font-bold rounded-xl border transition-all cursor-pointer ${
                eligibility.canGenerate
                  ? 'bg-white/5 hover:bg-white/10 text-amber-300 border-amber-400/35'
                  : 'bg-white/5 text-slate-600 border-white/5 cursor-not-allowed'
              }`}
            >
              <Save className="w-3.5 h-3.5" />
              <span>Generate as Draft</span>
            </button>

            <button
              type="button"
              onClick={() => {
                recalculatePlayoffStandings();
                showNotice(
                  'League standings & knockout qualification preview recalculated.',
                  'success'
                );
              }}
              className="flex items-center gap-1.5 px-3 py-2.5 text-xs font-semibold rounded-xl bg-white/5 hover:bg-white/10 text-slate-200 border border-white/10 transition-colors cursor-pointer"
            >
              <SlidersHorizontal className="w-3.5 h-3.5 text-sky-400" />
              <span>Recalculate Standings</span>
            </button>
          </div>

          {state.knockout.matches.length > 0 && (
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setShowBracketBuilder((prev) => !prev)}
                className={`flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold rounded-xl border transition-colors cursor-pointer ${
                  showBracketBuilder
                    ? 'bg-sky-500/20 text-sky-200 border-sky-400/50'
                    : 'bg-white/5 text-slate-200 border-white/10 hover:bg-white/10'
                }`}
              >
                <Sliders className="w-3.5 h-3.5 text-sky-400" />
                <span>{showBracketBuilder ? 'Hide Matchup Editor' : 'Configure Matchups'}</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  const res = saveKnockoutDraft();
                  if (!res.success) {
                    showNotice(res.error || 'Could not save draft.', 'error');
                    return;
                  }
                  showNotice(
                    'Knockout bracket saved as Draft (hidden from Public Website until published).',
                    'success'
                  );
                }}
                className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-xl bg-white/5 hover:bg-white/10 text-slate-200 border border-white/10 transition-colors cursor-pointer"
              >
                <Save className="w-3.5 h-3.5 text-amber-300" />
                <span>Save Draft</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  const res = publishPlayoffs(!isPublished);
                  if (!res.success) {
                    showNotice(res.error || 'Cannot publish knockout bracket.', 'error');
                    return;
                  }
                  showNotice(
                    !isPublished
                      ? 'Knockout bracket published live to Public Website & Match Center!'
                      : 'Knockout bracket switched to Draft mode.',
                    'success'
                  );
                }}
                className={`flex items-center gap-1.5 px-4 py-2 text-xs font-black uppercase tracking-wider rounded-xl border transition-colors cursor-pointer ${
                  isPublished
                    ? 'bg-sky-500/15 hover:bg-sky-500/25 text-sky-300 border-sky-400/35'
                    : 'bg-emerald-400 hover:bg-emerald-300 text-slate-950 border-emerald-300 shadow'
                }`}
              >
                {isPublished ? (
                  <>
                    <EyeOff className="w-3.5 h-3.5" />
                    <span>Unpublish</span>
                  </>
                ) : (
                  <>
                    <FileCheck className="w-3.5 h-3.5" />
                    <span>Publish Knockout Bracket</span>
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={() => setShowResetConfirm(true)}
                className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-amber-300 bg-amber-500/10 hover:bg-amber-500/20 rounded-xl transition-colors border border-amber-500/25 cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Reset Scores</span>
              </button>

              <button
                type="button"
                onClick={() => setShowDeleteConfirm(true)}
                className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-rose-400 hover:text-rose-300 bg-rose-500/10 hover:bg-rose-500/20 rounded-xl transition-colors border border-rose-500/20 cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Delete Bracket</span>
              </button>
            </div>
          )}
        </div>

        {/* Status Bar */}
        {state.knockout.matches.length > 0 && (
          <div className="pt-3 border-t border-white/10 flex flex-wrap items-center justify-between gap-2 text-xs">
            <div className="flex flex-wrap items-center gap-2">
              <span
                className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full font-mono text-[11px] font-bold border ${
                  state.knockout.status === 'completed'
                    ? 'bg-emerald-500/15 text-emerald-300 border-emerald-400/35'
                    : state.knockout.status === 'draft' || !isPublished
                    ? 'bg-slate-800 text-slate-300 border-white/15'
                    : 'bg-amber-500/15 text-amber-300 border-amber-400/35'
                }`}
              >
                <ShieldCheck className="w-3.5 h-3.5" />
                Stage Status: {(state.knockout.status || 'active').toUpperCase()}
              </span>
              <span
                className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full font-mono text-[11px] font-bold border ${
                  isPublished
                    ? 'bg-sky-500/15 text-sky-300 border-sky-400/35'
                    : 'bg-amber-500/15 text-amber-300 border-amber-400/35'
                }`}
              >
                {isPublished ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
                {isPublished
                  ? 'Published to Public Website & Match Center'
                  : 'Draft Mode (Hidden from Public Website)'}
              </span>
              <span className="font-mono text-[11px] text-slate-400">
                {state.knockout.matches.length} Knockout Fixtures · Qualification:{' '}
                <strong className="text-white uppercase">{qualificationMode}</strong>
              </span>
            </div>
          </div>
        )}
      </div>

      {/* =====================================================================
          STEP 3: INTERACTIVE STAGE-BY-STAGE BRACKET & MATCHUP BUILDER
         ===================================================================== */}
      {showBracketBuilder && state.knockout.matches.length > 0 && (
        <div className="rounded-2xl glass-panel p-4 sm:p-6 border border-sky-400/35 space-y-4 animate-fade-in">
          <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-white/10">
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 rounded-md bg-sky-400/20 border border-sky-400/40 font-mono text-[10px] font-black text-sky-300 uppercase">
                Step 3
              </span>
              <div>
                <h3 className="font-display font-black text-base text-white uppercase tracking-wider">
                  Interactive Knockout Matchup &amp; Progression Builder
                </h3>
                <p className="text-xs text-slate-400">
                  Customize Team A and Team B sources (Seed Rank, Specific Team, or Upstream Winner) for any Eliminator, Semi-Final, or Grand Final match.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setShowBracketBuilder(false)}
              className="px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-xs font-semibold text-slate-300 cursor-pointer"
            >
              Done Configuring
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {state.knockout.matches.map((km) => {
              const label =
                km.matchLabel || getPlayoffMatchDisplayLabel(km, activeFormat).title;
              const code = km.matchCode || km.playoffRound || km.stage;
              const sourceOptions = getParticipantSourceOptions(km);
              const valA = getInitialSourceValue(km, 'A');
              const valB = getInitialSourceValue(km, 'B');
              const isLive = km.status === 'live';

              return (
                <div
                  key={km.id}
                  className="p-4 rounded-2xl bg-slate-900/90 border border-white/10 space-y-3"
                >
                  <div className="flex items-center justify-between gap-2 pb-2 border-b border-white/10">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="px-2 py-0.5 rounded bg-amber-400/20 border border-amber-400/40 font-mono text-[10px] font-black text-amber-300">
                        {code}
                      </span>
                      <span className="font-bold text-xs sm:text-sm text-white truncate">
                        {label}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        disabled={isLive}
                        onClick={() => handleSwapMatchTeams(km)}
                        className="px-2 py-1 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-[10px] font-semibold text-slate-200 flex items-center gap-1 disabled:opacity-40 cursor-pointer"
                      >
                        <ArrowLeftRight className="w-3 h-3" />
                        Swap
                      </button>
                      <button
                        type="button"
                        onClick={() => handleOpenEditSchedule(km)}
                        className="px-2 py-1 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-[10px] font-semibold text-amber-300 cursor-pointer"
                      >
                        Court {km.court || 1}
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    <div>
                      <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">
                        Participant A
                      </label>
                      <select
                        disabled={isLive}
                        value={valA}
                        onChange={(e) => {
                          const resA = resolveSourceSelection(e.target.value);
                          applyMatchupUpdate(km.id, {
                            participantASource: resA.participantSource,
                            teamA: resA.teamId,
                            seedA: resA.seed,
                            manual: Boolean(resA.participantSource?.startsWith('TEAM:')),
                          });
                        }}
                        className="w-full bg-slate-950 border border-white/15 rounded-xl px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-sky-400"
                      >
                        <option value="">Unassigned / TBD</option>
                        {sourceOptions.map((opt) => (
                          <option key={`a-${opt.value}`} value={opt.value}>
                            {opt.label}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">
                        Participant B
                      </label>
                      <select
                        disabled={isLive}
                        value={valB}
                        onChange={(e) => {
                          const resB = resolveSourceSelection(e.target.value);
                          applyMatchupUpdate(km.id, {
                            participantBSource: resB.participantSource,
                            teamB: resB.teamId,
                            seedB: resB.seed,
                            manual: Boolean(resB.participantSource?.startsWith('TEAM:')),
                          });
                        }}
                        className="w-full bg-slate-950 border border-white/15 rounded-xl px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-sky-400"
                      >
                        <option value="">Unassigned / TBD</option>
                        {sourceOptions.map((opt) => (
                          <option key={`b-${opt.value}`} value={opt.value}>
                            {opt.label}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Blocking Errors / Readiness Warnings */}
      {(eligibility.blockingReasons.length > 0 ||
        eligibility.warnings.length > 0 ||
        conflictWarnings.length > 0) && (
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
                <th className="py-2 pl-2 text-right">Knockout Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5 font-mono">
              {leagueStandingData.allRows.map((row) => {
                const manualIndex =
                  qualificationMode === 'manual' ? manualTeamIds.indexOf(row.team.id) : -1;
                const isQualified =
                  !row.isDisqualified &&
                  (qualificationMode === 'manual'
                    ? manualIndex !== -1 && manualIndex < requiredTeams
                    : row.rank > 0 && row.rank <= requiredTeams);

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
                            {qualificationMode === 'manual'
                              ? `Seed #${manualIndex + 1}`
                              : activeFormat === 'ipl_top4'
                              ? row.rank <= 2
                                ? 'Q1 Seed'
                                : 'Eliminator'
                              : `Seed #${row.rank}`}
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded bg-white/5 text-slate-400 text-[10px]">
                            Reserve
                          </span>
                        )}
                        <button
                          type="button"
                          onClick={() => toggleTeamPlayoffDisqualification(row.team.id)}
                          title={
                            row.isDisqualified
                              ? 'Restore team knockout eligibility'
                              : 'Exclude from automatic knockout qualification'
                          }
                          className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white transition-colors cursor-pointer"
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
              Knockout Control Audit Trail
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
            <p className="text-xs text-slate-400">No knockout audit events recorded yet.</p>
          ) : (
            <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
              {[...(state.knockout.auditLogs || [])].reverse().map((entry) => (
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

      {/* =====================================================================
          STEP 4: VISUAL KNOCKOUT BRACKET PREVIEW & LIVE CONTROL
         ===================================================================== */}
      {state.knockout.matches.length > 0 ? (
        <div className="rounded-3xl glass-panel p-4 sm:p-6 border border-amber-400/25 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-white/10">
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 rounded-md bg-amber-400/20 border border-amber-400/40 font-mono text-[10px] font-black text-amber-300 uppercase">
                Step 4
              </span>
              <h2 className="font-display font-black text-base sm:text-lg text-white uppercase tracking-wide">
                {getFormatDisplayTitle(activeFormat, requiredTeams)} — Live Bracket Tree
              </h2>
            </div>
            <span className="text-xs text-slate-400">
              Click <strong className="text-sky-300">Teams</strong> on any card to customize pairings,{' '}
              <strong className="text-amber-300">Schedule</strong> for Court/Time, or{' '}
              <strong className="text-emerald-300">Umpire Mode</strong> for live scoring.
            </span>
          </div>

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
            onEditMatchup={handleOpenEditMatchup}
            onSwapTeams={handleSwapMatchTeams}
            onResetMatch={handleResetSingleMatch}
          />
        </div>
      ) : (
        <div className="rounded-3xl glass-card p-10 sm:p-12 text-center border border-dashed border-white/10 space-y-4">
          <Trophy className="w-12 h-12 text-slate-600 mx-auto" />
          <h3 className="text-lg font-bold text-white">Knockout Bracket Not Yet Generated</h3>
          <p className="text-xs text-slate-400 max-w-lg mx-auto">
            {activeFormatMeta.blueprintSummary}
          </p>
          <div className="flex flex-wrap items-center justify-center gap-3">
            <button
              type="button"
              onClick={() => handleRequestGenerate(false)}
              disabled={!eligibility.canGenerate}
              className={`px-5 py-2.5 text-xs font-black uppercase tracking-wider rounded-xl shadow transition-all cursor-pointer ${
                eligibility.canGenerate
                  ? 'bg-amber-400 text-slate-950 hover:bg-amber-300'
                  : 'bg-white/10 text-slate-500 cursor-not-allowed'
              }`}
            >
              Generate &amp; Publish {getFormatDisplayTitle(activeFormat, requiredTeams)}
            </button>
            <button
              type="button"
              onClick={() => handleRequestGenerate(true)}
              disabled={!eligibility.canGenerate}
              className={`px-4 py-2.5 text-xs font-bold rounded-xl border transition-all cursor-pointer ${
                eligibility.canGenerate
                  ? 'bg-white/5 hover:bg-white/10 text-amber-300 border-amber-400/35'
                  : 'bg-white/5 text-slate-600 border-white/5 cursor-not-allowed'
              }`}
            >
              Generate as Draft First
            </button>
          </div>
        </div>
      )}

      {/* =====================================================================
          MODAL 1: EDIT MATCHUP PARTICIPANTS / QUALIFICATION SOURCES
         ===================================================================== */}
      {editingMatchup && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-md">
          <form
            onSubmit={handleSaveMatchupModal}
            className="w-full max-w-lg rounded-3xl bg-slate-900 border border-sky-400/35 p-6 space-y-4 shadow-2xl"
          >
            <div className="flex items-center justify-between pb-2 border-b border-white/10">
              <div>
                <span className="text-[10px] font-mono font-bold uppercase text-sky-400 block">
                  Manual Matchup Configuration
                </span>
                <h3 className="font-display font-black text-lg text-white">
                  {editingMatchup.matchLabel ||
                    getPlayoffMatchDisplayLabel(editingMatchup, activeFormat).title}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setEditingMatchup(null)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-slate-400">
              Assign each slot from a Qualified Seed Rank (#1 to #{requiredTeams}), an upstream Eliminator/Semi-Final Winner, or a specific tournament team.
            </p>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-amber-300 mb-1">
                  Participant A (Slot 1)
                </label>
                <select
                  value={matchupDraft.sourceA}
                  onChange={(e) => setMatchupDraft({ ...matchupDraft, sourceA: e.target.value })}
                  className="w-full bg-slate-950 border border-white/15 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-sky-400"
                >
                  <option value="">Unassigned / Awaiting Qualification</option>
                  {getParticipantSourceOptions(editingMatchup).map((opt) => (
                    <option key={`modal-a-${opt.value}`} value={opt.value}>
                      [{opt.group}] {opt.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex justify-center">
                <button
                  type="button"
                  onClick={() =>
                    setMatchupDraft({
                      sourceA: matchupDraft.sourceB,
                      sourceB: matchupDraft.sourceA,
                    })
                  }
                  className="px-3 py-1 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-semibold text-slate-300 flex items-center gap-1.5 cursor-pointer"
                >
                  <ArrowLeftRight className="w-3.5 h-3.5 text-amber-400" />
                  <span>Swap Slot A &amp; Slot B</span>
                </button>
              </div>

              <div>
                <label className="block text-xs font-bold text-amber-300 mb-1">
                  Participant B (Slot 2)
                </label>
                <select
                  value={matchupDraft.sourceB}
                  onChange={(e) => setMatchupDraft({ ...matchupDraft, sourceB: e.target.value })}
                  className="w-full bg-slate-950 border border-white/15 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-sky-400"
                >
                  <option value="">Unassigned / Awaiting Qualification</option>
                  {getParticipantSourceOptions(editingMatchup).map((opt) => (
                    <option key={`modal-b-${opt.value}`} value={opt.value}>
                      [{opt.group}] {opt.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setEditingMatchup(null)}
                className="px-4 py-2 text-xs font-semibold text-slate-300 hover:text-white"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-5 py-2 text-xs font-black bg-amber-400 hover:bg-amber-300 text-slate-950 rounded-xl shadow cursor-pointer"
              >
                Save Matchup
              </button>
            </div>
          </form>
        </div>
      )}

      {/* =====================================================================
          MODAL 2: EDIT SCHEDULE / COURT / UMPIRE
         ===================================================================== */}
      {editingScheduleMatch && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-md">
          <form
            onSubmit={handleSaveSchedule}
            className="w-full max-w-md rounded-3xl bg-slate-900 border border-white/15 p-6 space-y-4 shadow-2xl"
          >
            <div className="flex items-center justify-between pb-2 border-b border-white/10">
              <h3 className="font-display font-black text-lg text-white">
                {editingScheduleMatch.matchLabel ||
                  getPlayoffMatchDisplayLabel(editingScheduleMatch, activeFormat).title}{' '}
                — Schedule &amp; Court
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
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Court Assignment
                </label>
                <select
                  value={scheduleDraft.court}
                  onChange={(e) =>
                    setScheduleDraft({ ...scheduleDraft, court: Number(e.target.value) || 1 })
                  }
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
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Match Date
                  </label>
                  <input
                    type="date"
                    value={scheduleDraft.scheduledDate}
                    onChange={(e) =>
                      setScheduleDraft({ ...scheduleDraft, scheduledDate: e.target.value })
                    }
                    className="w-full bg-slate-950 border border-white/15 rounded-xl px-3 py-2 text-sm text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Start Time
                  </label>
                  <input
                    type="time"
                    value={scheduleDraft.scheduledTime}
                    onChange={(e) =>
                      setScheduleDraft({ ...scheduleDraft, scheduledTime: e.target.value })
                    }
                    className="w-full bg-slate-950 border border-white/15 rounded-xl px-3 py-2 text-sm text-white"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Assigned Umpire / Scorer
                </label>
                <input
                  type="text"
                  placeholder="e.g. Official Umpire Name"
                  value={scheduleDraft.assignedUmpire}
                  onChange={(e) =>
                    setScheduleDraft({ ...scheduleDraft, assignedUmpire: e.target.value })
                  }
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
                className="px-5 py-2 text-xs font-black bg-amber-400 hover:bg-amber-300 text-slate-950 rounded-xl shadow cursor-pointer"
              >
                Save Assignment
              </button>
            </div>
          </form>
        </div>
      )}

      {/* =====================================================================
          MODAL 3: VERSION HISTORY & ROLLBACK
         ===================================================================== */}
      {showVersionModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-md">
          <div className="w-full max-w-lg rounded-3xl bg-slate-900 border border-violet-400/35 p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between pb-2 border-b border-white/10">
              <div>
                <span className="text-[10px] font-mono font-bold uppercase text-violet-300 block">
                  Bracket Version Snapshots
                </span>
                <h3 className="font-display font-black text-lg text-white">
                  Restore Previous Bracket Configuration
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowVersionModal(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-2.5 max-h-80 overflow-y-auto pr-1">
              {[...versionHistory].reverse().map((ver) => (
                <div
                  key={ver.id}
                  className="p-3.5 rounded-2xl bg-slate-950 border border-white/10 flex items-center justify-between gap-3"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 rounded bg-violet-500/20 text-violet-300 font-mono text-[10px] font-bold">
                        v{ver.version}
                      </span>
                      <span className="font-bold text-xs text-white truncate">{ver.label}</span>
                    </div>
                    <span className="block text-[10px] text-slate-400 font-mono mt-1">
                      {ver.matches.length} fixtures · by {ver.createdBy} ·{' '}
                      {new Date(ver.createdAt).toLocaleString()}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      const res = rollbackKnockoutVersion(ver.id);
                      if (!res.success) {
                        showNotice(res.error || 'Could not roll back version.', 'error');
                        return;
                      }
                      setShowVersionModal(false);
                      showNotice(`Restored bracket to Version v${ver.version}!`, 'success');
                    }}
                    className="px-3 py-1.5 rounded-xl bg-violet-500/20 hover:bg-violet-500/30 border border-violet-400/40 text-xs font-bold text-violet-200 shrink-0 cursor-pointer"
                  >
                    Restore
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* =====================================================================
          MODAL 4: DOWNSTREAM DEPENDENCY PROTECTION CONFIRMATION
         ===================================================================== */}
      <ConfirmModal
        isOpen={Boolean(dependencyPrompt)}
        title="Downstream Knockout Match Already Started"
        message={
          dependencyPrompt
            ? `${dependencyPrompt.errorText} Proceeding will reset ${dependencyPrompt.dependentMatches
                .map((d) => d.matchLabel || d.matchCode || d.stage)
                .join(', ')} back to Scheduled and re-run automatic winner advancement.`
            : ''
        }
        confirmLabel="Confirm & Cascade Reset Downstream"
        variant="warning"
        onConfirm={() => {
          if (!dependencyPrompt) return;
          if (dependencyPrompt.isReset) {
            const res = resetSingleKnockoutMatch(dependencyPrompt.matchId, true);
            if (res.success) {
              showNotice('Match and dependent downstream matches reset cleanly.', 'success');
            }
          } else if (dependencyPrompt.updates) {
            const ok = applyMatchupUpdate(
              dependencyPrompt.matchId,
              dependencyPrompt.updates,
              true
            );
            if (ok) {
              setEditingMatchup(null);
              showNotice('Matchup updated and downstream fixtures resynchronized.', 'success');
            }
          }
          setDependencyPrompt(null);
        }}
        onCancel={() => setDependencyPrompt(null)}
      />

      {/* Confirm Generate / Replace Bracket */}
      <ConfirmModal
        isOpen={showGenerateConfirm}
        title={
          state.knockout.matches.length > 0
            ? 'Regenerate Knockout Bracket'
            : `Generate ${getFormatDisplayTitle(activeFormat, requiredTeams)}`
        }
        message={
          state.knockout.matches.length > 0
            ? `An active knockout bracket already exists. Regenerating will create the ${getFormatDisplayTitle(
                activeFormat,
                requiredTeams
              )} bracket (${qualificationMode.toUpperCase()} qualification) and reset existing knockout scores while preserving all league fixtures.`
            : `Confirm generating ${getFormatDisplayTitle(
                activeFormat,
                requiredTeams
              )} using ${
                qualificationMode === 'manual'
                  ? 'manually selected teams'
                  : `Top ${requiredTeams} teams from Official League Standings`
              }?`
        }
        confirmLabel={
          state.knockout.matches.length > 0 ? 'Regenerate Bracket' : 'Generate Bracket'
        }
        variant={state.knockout.matches.length > 0 ? 'warning' : 'primary'}
        onConfirm={() => {
          setShowGenerateConfirm(false);
          executeGenerateBracket(pendingGenerateAsDraft);
        }}
        onCancel={() => setShowGenerateConfirm(false)}
      />

      {/* Confirm Reset Playoffs */}
      <ConfirmModal
        isOpen={showResetConfirm}
        title="Reset Knockout Matches"
        message="Reset all knockout scores, match statuses, and downstream progression slots back to Scheduled while keeping league matches, teams, and qualified seeds intact?"
        confirmLabel="Reset Knockout Matches"
        variant="warning"
        onConfirm={() => {
          resetPlayoffs();
          setShowResetConfirm(false);
          showNotice('Knockout matches reset cleanly. League fixtures remain intact.', 'success');
        }}
        onCancel={() => setShowResetConfirm(false)}
      />

      {/* Confirm Delete Playoffs */}
      <ConfirmModal
        isOpen={showDeleteConfirm}
        title="Delete Knockout Bracket"
        message="Delete all knockout bracket matches and reset champion state? All league stage matches, scores, players, and teams will remain untouched."
        confirmLabel="Delete Bracket"
        variant="danger"
        onConfirm={() => {
          deletePlayoffs();
          setShowDeleteConfirm(false);
          showNotice('Knockout bracket deleted cleanly. League data untouched.', 'success');
        }}
        onCancel={() => setShowDeleteConfirm(false)}
      />

      {/* Legacy Clear Confirmation */}
      <ConfirmModal
        isOpen={showClearConfirm}
        title="Clear Knockout Bracket"
        message="Are you sure you want to clear the entire knockout bracket and all knockout scores?"
        confirmLabel="Clear Bracket"
        variant="danger"
        onConfirm={() => {
          clearKnockout();
          setShowClearConfirm(false);
        }}
        onCancel={() => setShowClearConfirm(false)}
      />

      {/* Live Badminton Scoring Modal for Knockout matches */}
      <LiveMatchScoringModal
        isOpen={Boolean(liveScoringMatchId)}
        onClose={() => setLiveScoringMatchId(null)}
        initialMatchId={liveScoringMatchId || undefined}
        isKnockout={true}
      />
    </div>
  );
};
