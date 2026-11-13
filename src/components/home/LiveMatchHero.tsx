import React, { useState, useEffect, useRef, useMemo } from 'react';
import confetti from 'canvas-confetti';
import {
  ArrowRight,
  Award,
  CheckCircle2,
  Clock,
  Crown,
  Flame,
  Maximize2,
  PartyPopper,
  RefreshCw,
  RotateCcw,
  Sparkles,
  Trophy,
  WifiOff,
  Zap,
} from 'lucide-react';
import { Match, Team, Player, BadmintonScoringRules } from '../../types/tournament';
import { RealtimeConnectionStatus } from '../../context/TournamentContext';
import { DEFAULT_BADMINTON_RULES, evaluateSetStatus } from '../../utils/badmintonEngine';

interface LiveMatchHeroProps {
  matches: Match[];
  teams: Team[];
  players: Player[];
  scoringRules?: BadmintonScoringRules;
  courtNames?: string[];
  venue?: string;
  realtimeStatus?: RealtimeConnectionStatus;
  onRetryRealtime?: () => void;
  onOpenMatchModal?: (match: Match) => void;
  onGoToFixtures?: () => void;
}

const SEMI_FINAL_PARTICLES = [
  { left: '8%', top: '22%', size: 'w-1.5 h-1.5', color: 'bg-blue-400', delay: '0s', duration: '5.5s' },
  { left: '19%', top: '72%', size: 'w-1 h-1', color: 'bg-violet-300', delay: '1.1s', duration: '6.4s' },
  { left: '34%', top: '16%', size: 'w-1.5 h-1.5', color: 'bg-purple-400', delay: '0.6s', duration: '7s' },
  { left: '52%', top: '82%', size: 'w-1 h-1', color: 'bg-sky-300', delay: '1.8s', duration: '5.8s' },
  { left: '68%', top: '24%', size: 'w-1.5 h-1.5', color: 'bg-violet-400', delay: '0.4s', duration: '6.8s' },
  { left: '81%', top: '68%', size: 'w-1 h-1', color: 'bg-blue-300', delay: '2.1s', duration: '5.2s' },
  { left: '91%', top: '34%', size: 'w-1.5 h-1.5', color: 'bg-fuchsia-400', delay: '1.4s', duration: '6.2s' },
  { left: '44%', top: '12%', size: 'w-1 h-1', color: 'bg-indigo-300', delay: '2.5s', duration: '7.2s' },
];

const GRAND_FINAL_PARTICLES = [
  { left: '6%', top: '28%', size: 'w-1.5 h-1.5', color: 'bg-amber-300', delay: '0s', duration: '5.2s' },
  { left: '16%', top: '76%', size: 'w-1 h-1', color: 'bg-orange-400', delay: '0.9s', duration: '6.1s' },
  { left: '29%', top: '18%', size: 'w-1.5 h-1.5', color: 'bg-yellow-300', delay: '0.4s', duration: '6.7s' },
  { left: '48%', top: '84%', size: 'w-1 h-1', color: 'bg-amber-200', delay: '1.6s', duration: '5.6s' },
  { left: '63%', top: '20%', size: 'w-1.5 h-1.5', color: 'bg-orange-300', delay: '0.3s', duration: '6.4s' },
  { left: '78%', top: '70%', size: 'w-1 h-1', color: 'bg-yellow-400', delay: '1.9s', duration: '5.1s' },
  { left: '90%', top: '30%', size: 'w-1.5 h-1.5', color: 'bg-amber-400', delay: '1.2s', duration: '5.9s' },
  { left: '41%', top: '11%', size: 'w-1 h-1', color: 'bg-amber-100', delay: '2.2s', duration: '6.8s' },
];

type CelebrationStageTheme = 'league' | 'quarter_final' | 'semi_final' | 'grand_final';
type GrandFinalCeremonyStep =
  | 'step1_victory'
  | 'step2_trophy'
  | 'step3_fireworks'
  | 'step4_announce'
  | 'step5_final_screen';

const CONFETTI_PALETTES: Record<CelebrationStageTheme, string[]> = {
  league: ['bg-amber-300', 'bg-yellow-400', 'bg-emerald-400', 'bg-lime-300', 'bg-amber-200', 'bg-emerald-300'],
  quarter_final: ['bg-sky-400', 'bg-amber-300', 'bg-cyan-300', 'bg-yellow-400', 'bg-blue-400', 'bg-amber-200'],
  semi_final: ['bg-purple-400', 'bg-amber-300', 'bg-violet-300', 'bg-yellow-400', 'bg-fuchsia-400', 'bg-amber-200'],
  grand_final: ['bg-amber-300', 'bg-yellow-300', 'bg-orange-400', 'bg-amber-100', 'bg-yellow-400', 'bg-orange-300'],
};

const isGrandFinalMatchRecord = (m?: Match | null) =>
  Boolean(
    m &&
      (m.stage === 'F' ||
        (m.matchType === 'knockout' &&
          Boolean(m.stageLabel?.toLowerCase().includes('final')) &&
          !m.stageLabel?.toLowerCase().includes('semi') &&
          !m.stageLabel?.toLowerCase().includes('quarter')))
  );

const GoldenChampionshipTrophySvg: React.FC<{ className?: string }> = ({ className = 'w-20 h-20' }) => (
  <svg viewBox="0 0 120 120" fill="none" className={className} aria-hidden="true">
    <defs>
      <linearGradient id="splGoldCupGrad" x1="20" y1="15" x2="100" y2="105" gradientUnits="userSpaceOnUse">
        <stop offset="0%" stopColor="#FEF3C7" />
        <stop offset="35%" stopColor="#FBBF24" />
        <stop offset="70%" stopColor="#D97706" />
        <stop offset="100%" stopColor="#FDE68A" />
      </linearGradient>
      <linearGradient id="splGoldPedestalGrad" x1="34" y1="86" x2="86" y2="112" gradientUnits="userSpaceOnUse">
        <stop offset="0%" stopColor="#FDE68A" />
        <stop offset="50%" stopColor="#B45309" />
        <stop offset="100%" stopColor="#F59E0B" />
      </linearGradient>
    </defs>
    {/* Cup Handles */}
    <path
      d="M32 28H20C14 28 11 35 14 44C17 53 26 57 35 55"
      stroke="url(#splGoldCupGrad)"
      strokeWidth="6"
      strokeLinecap="round"
    />
    <path
      d="M88 28H100C106 28 109 35 106 44C103 53 94 57 85 55"
      stroke="url(#splGoldCupGrad)"
      strokeWidth="6"
      strokeLinecap="round"
    />
    {/* Main Trophy Bowl */}
    <path
      d="M30 20H90L85 54C83 68 73 78 60 78C47 78 37 68 35 54L30 20Z"
      fill="url(#splGoldCupGrad)"
      stroke="#FEF08A"
      strokeWidth="2.5"
    />
    {/* Specular Highlight Stripe */}
    <path d="M40 26L43 52C44 60 48 66 53 69" stroke="#FFFBEB" strokeOpacity="0.65" strokeWidth="3.5" strokeLinecap="round" />
    {/* Crown Emblem on Cup */}
    <path
      d="M48 48L51 37L60 43L69 37L72 48H48Z"
      fill="#78350F"
      fillOpacity="0.45"
      stroke="#FEF3C7"
      strokeWidth="1.5"
      strokeLinejoin="round"
    />
    {/* Stem & Pedestal */}
    <rect x="54" y="77" width="12" height="14" rx="2" fill="url(#splGoldCupGrad)" />
    <path d="M40 91H80L84 100H36L40 91Z" fill="url(#splGoldPedestalGrad)" stroke="#FDE68A" strokeWidth="1.5" />
    <rect x="30" y="100" width="60" height="10" rx="3" fill="url(#splGoldPedestalGrad)" stroke="#FEF08A" strokeWidth="1.5" />
  </svg>
);

const getKnockoutStageMeta = (match?: Match | null) => {
  if (!match || match.matchType !== 'knockout') {
    return {
      isKnockout: false,
      label: `Round ${match?.round || 1}`,
      shortTag: `R${match?.round || 1}`,
      priority: 0,
    };
  }
  if (match.stage === 'F') {
    return {
      isKnockout: true,
      label: match.stageLabel || 'Grand Final',
      shortTag: 'FINAL',
      priority: 3,
    };
  }
  if (match.stage === 'SF') {
    const slot = match.slot || 1;
    return {
      isKnockout: true,
      label: match.stageLabel || `Semi-Final ${slot}`,
      shortTag: `SF${slot}`,
      priority: 2,
    };
  }
  const slot = match.slot || 1;
  return {
    isKnockout: true,
    label: match.stageLabel || `Quarter-Final ${slot}`,
    shortTag: `QF${slot}`,
    priority: 1,
  };
};

export const LiveMatchHero: React.FC<LiveMatchHeroProps> = React.memo(({
  matches,
  teams,
  players,
  scoringRules,
  courtNames,
  venue,
  realtimeStatus = 'connected',
  onRetryRealtime,
  onOpenMatchModal,
  onGoToFixtures,
}) => {
  const effectiveRules = scoringRules || DEFAULT_BADMINTON_RULES;

  const resolveCourtName = (m?: Match | null) => {
    if (!m) return 'Court 1';
    const cNum = m.court || 1;
    return m.courtName || courtNames?.[cNum - 1]?.trim() || `Court ${cNum}`;
  };

  // Prioritize live matches across courts (finals & knockouts surfaced cleanly, then by court number)
  const liveMatches = useMemo(() => {
    return matches
      .filter((m) => m.status === 'live')
      .sort((a, b) => {
        const pa = getKnockoutStageMeta(a).priority;
        const pb = getKnockoutStageMeta(b).priority;
        if (pb !== pa) return pb - pa;
        return (a.court || 1) - (b.court || 1);
      });
  }, [matches]);

  const pausedMatches = useMemo(() => matches.filter((m) => m.status === 'paused'), [matches]);
  const readyUpcomingMatches = useMemo(
    () => matches.filter((m) => m.status === 'upcoming' && Boolean(m.teamA && m.teamB)),
    [matches]
  );
  const completedMatches = useMemo(() => matches.filter((m) => m.status === 'completed'), [matches]);

  // Active match selection
  const [selectedMatchId, setSelectedMatchId] = useState<string | null>(null);
  const prevLiveIdsRef = useRef<Set<string>>(new Set());
  const prevResolvedActiveIdRef = useRef<string | null>(null);

  // Per-match independent Winner Celebration Manager & Grand Final Championship Ceremony
  const hasHydratedMatchesRef = useRef<boolean>(false);
  const prevMatchStatesRef = useRef<Map<string, { status: string; winner?: string }>>(new Map());
  const celebratedKeysRef = useRef<Set<string>>(new Set());
  const celebrationTimersRef = useRef<Map<string, number>>(new Map());
  const [activeCelebrations, setActiveCelebrations] = useState<
    Record<string, { winnerId: string; runId: number }>
  >({});

  const gfCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const gfCeremonyTimersRef = useRef<number[]>([]);
  const gfRunCounterRef = useRef<number>(0);
  const [gfCeremony, setGfCeremony] = useState<{
    matchId: string;
    winnerId: string;
    step: GrandFinalCeremonyStep;
    runId: number;
  } | null>(null);

  const clearGfCeremonyTimers = () => {
    gfCeremonyTimersRef.current.forEach((t) => window.clearTimeout(t));
    gfCeremonyTimersRef.current = [];
  };

  const launchScopedGoldFireworks = () => {
    if (typeof window === 'undefined' || !gfCanvasRef.current) return;
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;
    try {
      const fire = confetti.create(gfCanvasRef.current, { resize: true, useWorker: false });
      const goldColors = ['#FBBF24', '#F59E0B', '#FDE68A', '#FB923C', '#FFFFFF'];
      fire({
        particleCount: 55,
        angle: 60,
        spread: 60,
        origin: { x: 0.15, y: 0.72 },
        colors: goldColors,
        scalar: 0.95,
      });
      fire({
        particleCount: 55,
        angle: 120,
        spread: 60,
        origin: { x: 0.85, y: 0.72 },
        colors: goldColors,
        scalar: 0.95,
      });
      const burstTimer = window.setTimeout(() => {
        try {
          fire({
            particleCount: 70,
            spread: 85,
            origin: { x: 0.5, y: 0.42 },
            colors: goldColors,
            scalar: 1.05,
          });
        } catch {}
      }, 450);
      gfCeremonyTimersRef.current.push(burstTimer);
    } catch {}
  };

  const startGrandFinalCeremony = (matchId: string, winnerId: string) => {
    clearGfCeremonyTimers();
    const runId = ++gfRunCounterRef.current;

    try {
      sessionStorage.setItem(`spl_gf_champ_celebrated_${matchId}_${winnerId}`, '1');
    } catch {}

    const prefersReducedMotion =
      typeof window !== 'undefined' &&
      Boolean(window.matchMedia?.('(prefers-reduced-motion: reduce)').matches);

    if (prefersReducedMotion) {
      setGfCeremony({ matchId, winnerId, step: 'step5_final_screen', runId });
      return;
    }

    setGfCeremony({ matchId, winnerId, step: 'step1_victory', runId });

    const scheduleStep = (delay: number, nextStep: GrandFinalCeremonyStep, onEnter?: () => void) => {
      const timer = window.setTimeout(() => {
        setGfCeremony((curr) =>
          curr && curr.matchId === matchId && curr.runId === runId
            ? { ...curr, step: nextStep }
            : curr
        );
        if (onEnter) onEnter();
      }, delay);
      gfCeremonyTimersRef.current.push(timer);
    };

    scheduleStep(1100, 'step2_trophy');
    scheduleStep(2400, 'step3_fireworks', () => {
      launchScopedGoldFireworks();
      triggerCelebrationForMatch(matchId, winnerId);
    });
    scheduleStep(3900, 'step4_announce', () => {
      launchScopedGoldFireworks();
    });
    scheduleStep(6400, 'step5_final_screen');
  };

  const triggerCelebrationForMatch = (matchId: string, winnerId: string) => {
    const existingTimer = celebrationTimersRef.current.get(matchId);
    if (existingTimer) window.clearTimeout(existingTimer);

    setActiveCelebrations((prev) => ({
      ...prev,
      [matchId]: {
        winnerId,
        runId: (prev[matchId]?.runId || 0) + 1,
      },
    }));

    const timer = window.setTimeout(() => {
      celebrationTimersRef.current.delete(matchId);
      setActiveCelebrations((prev) => {
        if (!prev[matchId]) return prev;
        const next = { ...prev };
        delete next[matchId];
        return next;
      });
    }, 3600);
    celebrationTimersRef.current.set(matchId, timer);
  };

  useEffect(() => {
    return () => {
      celebrationTimersRef.current.forEach((timerId) => window.clearTimeout(timerId));
      celebrationTimersRef.current.clear();
      clearGfCeremonyTimers();
    };
  }, []);

  // Detect confirmed Supabase match completions, winner corrections, and resets per match
  useEffect(() => {
    if (matches.length === 0) return;

    const getConfirmedWinner = (m: Match): string | undefined => {
      if (m.status !== 'completed' || !m.winner) return undefined;
      return m.winner === m.teamA || m.winner === m.teamB ? m.winner : undefined;
    };

    if (!hasHydratedMatchesRef.current) {
      for (const m of matches) {
        const confirmedWinner = getConfirmedWinner(m);
        prevMatchStatesRef.current.set(m.id, { status: m.status, winner: confirmedWinner });
        if (confirmedWinner) {
          // Never auto-replay full celebration animation when joining/refreshing after completion
          celebratedKeysRef.current.add(`${m.id}:${confirmedWinner}`);
        }
      }
      hasHydratedMatchesRef.current = true;
      return;
    }

    for (const m of matches) {
      const prev = prevMatchStatesRef.current.get(m.id);
      const confirmedWinner = getConfirmedWinner(m);
      const isGf = isGrandFinalMatchRecord(m);

      // Admin reset or un-completed match: clear winner highlight keys & cancel celebration
      if (prev?.status === 'completed' && !confirmedWinner) {
        Array.from(celebratedKeysRef.current).forEach((k) => {
          if (k.startsWith(`${m.id}:`)) celebratedKeysRef.current.delete(k);
        });
        try {
          for (let i = sessionStorage.length - 1; i >= 0; i--) {
            const key = sessionStorage.key(i);
            if (key && key.startsWith(`spl_gf_champ_celebrated_${m.id}_`)) {
              sessionStorage.removeItem(key);
            }
          }
        } catch {}

        const existingTimer = celebrationTimersRef.current.get(m.id);
        if (existingTimer) {
          window.clearTimeout(existingTimer);
          celebrationTimersRef.current.delete(m.id);
        }
        setActiveCelebrations((curr) => {
          if (!curr[m.id]) return curr;
          const next = { ...curr };
          delete next[m.id];
          return next;
        });
        if (isGf) {
          clearGfCeremonyTimers();
          setGfCeremony((curr) => (curr?.matchId === m.id ? null : curr));
        }
      } else if (confirmedWinner && (prev?.status !== 'completed' || prev?.winner !== confirmedWinner)) {
        // Confirmed new completion or winner correction
        if (prev?.winner && prev.winner !== confirmedWinner) {
          celebratedKeysRef.current.delete(`${m.id}:${prev.winner}`);
          try {
            sessionStorage.removeItem(`spl_gf_champ_celebrated_${m.id}_${prev.winner}`);
          } catch {}
        }
        const dedupeKey = `${m.id}:${confirmedWinner}`;
        if (!celebratedKeysRef.current.has(dedupeKey)) {
          celebratedKeysRef.current.add(dedupeKey);
          if (isGf) {
            let alreadyCelebratedInSession = false;
            try {
              alreadyCelebratedInSession =
                sessionStorage.getItem(`spl_gf_champ_celebrated_${m.id}_${confirmedWinner}`) === '1';
            } catch {}
            if (!alreadyCelebratedInSession) {
              startGrandFinalCeremony(m.id, confirmedWinner);
            }
          } else {
            triggerCelebrationForMatch(m.id, confirmedWinner);
          }
        }
      }

      prevMatchStatesRef.current.set(m.id, { status: m.status, winner: confirmedWinner });
    }
  }, [matches]);

  // Automatically surface newly started LIVE matches, while keeping just-completed matches visible for celebration
  useEffect(() => {
    const currentLiveIds = new Set(liveMatches.map((m) => m.id));
    const newlyLive = liveMatches.filter((m) => !prevLiveIdsRef.current.has(m.id));
    const justLeftLiveIds = Array.from(prevLiveIdsRef.current).filter((id) => !currentLiveIds.has(id));
    prevLiveIdsRef.current = currentLiveIds;

    setSelectedMatchId((prevId) => {
      const stillExists = prevId ? matches.find((m) => m.id === prevId) : undefined;
      if (prevId && !stillExists) {
        return liveMatches[0]?.id || null;
      }

      // If the currently viewed live match just completed with an official winner, keep it pinned so celebration displays
      const focusedId = prevId || prevResolvedActiveIdRef.current;
      if (focusedId && justLeftLiveIds.includes(focusedId)) {
        const finishedFocused = matches.find(
          (m) => m.id === focusedId && m.status === 'completed' && Boolean(m.winner)
        );
        if (finishedFocused) {
          return finishedFocused.id;
        }
      }

      if (newlyLive.length > 0 && (!stillExists || stillExists.status !== 'live')) {
        return newlyLive[0].id;
      }
      return prevId;
    });
  }, [matches, liveMatches]);

  const activeMatch =
    (selectedMatchId && matches.find((m) => m.id === selectedMatchId)) ||
    liveMatches[0] ||
    pausedMatches[0] ||
    readyUpcomingMatches[0] ||
    completedMatches[completedMatches.length - 1] ||
    matches[0] ||
    null;

  useEffect(() => {
    prevResolvedActiveIdRef.current = activeMatch?.id || null;
  }, [activeMatch?.id]);

  // Build responsive selector list: ALL live + paused + populated knockouts + upcoming/recent matches
  const selectorMatches = useMemo(() => {
    const seen = new Set<string>();
    const ordered: Match[] = [];

    const pushUnique = (list: Match[]) => {
      for (const m of list) {
        if (!seen.has(m.id)) {
          seen.add(m.id);
          ordered.push(m);
        }
      }
    };

    // 1. All LIVE matches across all courts (never truncated)
    pushUnique(liveMatches);
    // 2. All PAUSED matches
    pushUnique(pausedMatches);
    // 3. All Knockout stage matches (QF / SF / Final) that have teams or results
    pushUnique(
      matches
        .filter((m) => m.matchType === 'knockout' && (Boolean(m.teamA && m.teamB) || m.status === 'completed'))
        .sort((a, b) => getKnockoutStageMeta(b).priority - getKnockoutStageMeta(a).priority)
    );
    // 4. Fill remaining slots with upcoming / recent matches up to 8 non-live items
    const nonLiveLimit = ordered.length + 6;
    for (const m of [...readyUpcomingMatches, ...completedMatches.slice().reverse()]) {
      if (ordered.length >= nonLiveLimit) break;
      if (!seen.has(m.id)) {
        seen.add(m.id);
        ordered.push(m);
      }
    }

    return ordered;
  }, [matches, liveMatches, pausedMatches, readyUpcomingMatches, completedMatches]);

  // Helper getters
  const getTeam = (id?: string) => (id ? teams.find((t) => t.id === id) : undefined);
  const getPlayer = (id?: string) => (id ? players.find((p) => p.id === id) : undefined);

  const teamA = getTeam(activeMatch?.teamA);
  const teamB = getTeam(activeMatch?.teamB);

  const teamAPlayers = (teamA?.players?.map(getPlayer).filter(Boolean) as Player[]) || [];
  const teamBPlayers = (teamB?.players?.map(getPlayer).filter(Boolean) as Player[]) || [];

  const scoreA = activeMatch?.scoreA ?? 0;
  const scoreB = activeMatch?.scoreB ?? 0;
  const sets = activeMatch?.sets || [];
  const isLive = activeMatch?.status === 'live';
  const isPaused = activeMatch?.status === 'paused';
  const isCompleted = activeMatch?.status === 'completed';

  const stageMeta = getKnockoutStageMeta(activeMatch);
  const courtDisplayName = resolveCourtName(activeMatch);

  // Automatic Championship Stage Detection from Supabase match stage (scoped strictly to the active broadcast match)
  const isGrandFinal = Boolean(
    activeMatch &&
      (activeMatch.stage === 'F' ||
        (activeMatch.matchType === 'knockout' &&
          Boolean(activeMatch.stageLabel?.toLowerCase().includes('final')) &&
          !activeMatch.stageLabel?.toLowerCase().includes('semi') &&
          !activeMatch.stageLabel?.toLowerCase().includes('quarter')))
  );

  const isSemiFinal = Boolean(
    !isGrandFinal &&
      activeMatch &&
      (activeMatch.stage === 'SF' ||
        (activeMatch.matchType === 'knockout' &&
          activeMatch.stageLabel?.toLowerCase().includes('semi')))
  );

  const isQuarterFinal = Boolean(
    !isGrandFinal && !isSemiFinal && activeMatch && activeMatch.matchType === 'knockout'
  );

  // Official DB-verified Winner & Tournament Qualification Confirmation (never inferred from scores alone)
  const officialWinnerId =
    isCompleted &&
    activeMatch?.winner &&
    (activeMatch.winner === activeMatch.teamA || activeMatch.winner === activeMatch.teamB)
      ? activeMatch.winner
      : undefined;

  const winnerTeam = officialWinnerId ? getTeam(officialWinnerId) : undefined;
  const winnerPlayers =
    (winnerTeam?.players?.map(getPlayer).filter(Boolean) as Player[]) || [];
  const isWinnerA = Boolean(officialWinnerId && officialWinnerId === activeMatch?.teamA);
  const isWinnerB = Boolean(officialWinnerId && officialWinnerId === activeMatch?.teamB);

  const isGrandFinalChampionConfirmed = Boolean(isGrandFinal && isCompleted && officialWinnerId);
  const currentGfCeremonyStep: GrandFinalCeremonyStep =
    isGrandFinalChampionConfirmed &&
    gfCeremony &&
    activeMatch &&
    gfCeremony.matchId === activeMatch.id &&
    gfCeremony.winnerId === officialWinnerId
      ? gfCeremony.step
      : 'step5_final_screen';
  const isGrandFinalCeremonyPlaying = Boolean(
    isGrandFinalChampionConfirmed && currentGfCeremonyStep !== 'step5_final_screen'
  );

  const isQuarterFinalQualified = Boolean(
    isQuarterFinal &&
      officialWinnerId &&
      matches.some(
        (m) =>
          m.matchType === 'knockout' &&
          m.stage === 'SF' &&
          (m.teamA === officialWinnerId || m.teamB === officialWinnerId)
      )
  );

  const isSemiFinalQualified = Boolean(
    isSemiFinal &&
      officialWinnerId &&
      matches.some(
        (m) =>
          m.matchType === 'knockout' &&
          m.stage === 'F' &&
          (m.teamA === officialWinnerId || m.teamB === officialWinnerId)
      )
  );

  const activeMatchCelebration =
    activeMatch &&
    officialWinnerId &&
    activeCelebrations[activeMatch.id]?.winnerId === officialWinnerId
      ? activeCelebrations[activeMatch.id]
      : undefined;

  const isCelebratingNow = Boolean(activeMatchCelebration);

  const celebrationTheme: CelebrationStageTheme = isGrandFinal
    ? 'grand_final'
    : isSemiFinal
    ? 'semi_final'
    : isQuarterFinal
    ? 'quarter_final'
    : 'league';
  const confettiPalette = CONFETTI_PALETTES[celebrationTheme];

  // Brief, smooth, non-blocking Grand Final Intro triggered once on transition/opening as LIVE (never replays on score updates)
  const playedGfIntroIdsRef = useRef<Set<string>>(new Set());
  const prevMatchStatusesRef = useRef<Record<string, string>>({});
  const [activeGfIntroMatchId, setActiveGfIntroMatchId] = useState<string | null>(null);
  const gfIntroTimerRef = useRef<number | null>(null);

  useEffect(() => {
    const prevMap = prevMatchStatusesRef.current;
    const nextMap: Record<string, string> = {};
    for (const m of matches) {
      nextMap[m.id] = m.status;
    }

    if (activeMatch && isGrandFinal) {
      const mId = activeMatch.id;
      const prevStatus = prevMap[mId];
      const transitionedToLive =
        prevStatus !== undefined && prevStatus !== 'live' && activeMatch.status === 'live';

      let seenInSession = false;
      try {
        seenInSession = sessionStorage.getItem(`spl_gf_intro_${mId}`) === '1';
      } catch {}

      if (
        activeMatch.status === 'live' &&
        (transitionedToLive || (!playedGfIntroIdsRef.current.has(mId) && !seenInSession))
      ) {
        playedGfIntroIdsRef.current.add(mId);
        try {
          sessionStorage.setItem(`spl_gf_intro_${mId}`, '1');
        } catch {}
        setActiveGfIntroMatchId(mId);
        if (gfIntroTimerRef.current) window.clearTimeout(gfIntroTimerRef.current);
        gfIntroTimerRef.current = window.setTimeout(() => {
          setActiveGfIntroMatchId((curr) => (curr === mId ? null : curr));
        }, 2900);
      } else if (activeMatch.status !== 'live') {
        setActiveGfIntroMatchId((curr) => (curr === mId ? null : curr));
      }
    } else {
      setActiveGfIntroMatchId((curr) => (curr ? null : curr));
    }

    prevMatchStatusesRef.current = nextMap;
  }, [matches, activeMatch?.id, activeMatch?.status, isGrandFinal]);

  useEffect(() => {
    return () => {
      if (gfIntroTimerRef.current) window.clearTimeout(gfIntroTimerRef.current);
    };
  }, []);

  const showGrandFinalIntro = Boolean(
    isGrandFinal && activeMatch && activeMatch.status === 'live' && activeGfIntroMatchId === activeMatch.id
  );

  // Use same badminton scoring engine for both league and knockout matches
  const setEval = evaluateSetStatus(scoreA, scoreB, effectiveRules);
  const targetScore = effectiveRules.pointTarget || 21;

  let leadText = 'Scores Level (0 - 0)';
  if (isCompleted && activeMatch?.winner) {
    const winName = activeMatch.winner === activeMatch.teamA ? teamA?.name : teamB?.name;
    leadText = `${winName || 'Winner'} Won (${scoreA} - ${scoreB})`;
  } else if (scoreA > scoreB) {
    leadText = `${teamA?.name || 'Team A'} leads by ${scoreA - scoreB}`;
  } else if (scoreB > scoreA) {
    leadText = `${teamB?.name || 'Team B'} leads by ${scoreB - scoreA}`;
  } else if (scoreA > 0 && scoreA === scoreB) {
    leadText = `Scores tied at ${scoreA} — All`;
  }

  return (
    <section id="live-match" className="relative scroll-mt-24">
      {/* Ambient Stage Aura (transitions smoothly across League, Semi-Final, and Grand Final) */}
      <div
        className={`absolute inset-0 rounded-3xl blur-2xl pointer-events-none transition-all duration-500 ${
          isGrandFinal
            ? 'bg-gradient-to-r from-amber-500/35 via-orange-600/25 to-yellow-500/35 opacity-100'
            : isSemiFinal
            ? 'bg-gradient-to-r from-blue-600/30 via-purple-600/25 to-violet-500/30 opacity-100'
            : 'bg-gradient-to-r from-rose-500/10 via-amber-500/5 to-lime-500/10 opacity-90'
        }`}
      />

      <div
        className={`relative rounded-3xl border p-4 sm:p-8 shadow-2xl overflow-hidden transition-all duration-500 ease-out ${
          isGrandFinal
            ? 'border-amber-400/60 bg-gradient-to-br from-[#060503] via-[#170f04] to-[#050403] shadow-[0_0_65px_-12px_rgba(245,158,11,0.55),0_0_32px_-8px_rgba(249,115,22,0.35)]'
            : isSemiFinal
            ? 'border-violet-400/50 bg-gradient-to-br from-[#090d29] via-[#1b0b3d] to-[#06081c] shadow-[0_0_55px_-12px_rgba(139,92,246,0.5),0_0_28px_-8px_rgba(59,130,246,0.35)]'
            : 'border-white/15 bg-gradient-to-b from-[#0a0e1c] via-[#070a14] to-[#04060d]'
        }`}
      >
        {/* Top Metallic Neon Accent Bar */}
        <div
          aria-hidden="true"
          className={`absolute inset-x-0 top-0 h-[3px] pointer-events-none transition-opacity duration-500 ${
            isGrandFinal
              ? 'bg-gradient-to-r from-amber-300 via-orange-500 to-yellow-300 opacity-100'
              : isSemiFinal
              ? 'bg-gradient-to-r from-blue-400 via-violet-400 to-fuchsia-400 opacity-100'
              : 'opacity-0'
          }`}
        />

        {/* Animated Fiery Gold Spotlights & Golden Particles (Grand Final Championship Only) */}
        {isGrandFinal && (
          <div aria-hidden="true" className="absolute inset-0 pointer-events-none overflow-hidden">
            {/* Left Fiery Gold Stadium Spotlight */}
            <div className="spl-spotlight-left absolute -top-28 -left-16 w-[58%] h-[145%] origin-top bg-[conic-gradient(from_165deg_at_35%_0%,transparent_0deg,rgba(245,158,11,0.28)_18deg,rgba(249,115,22,0.16)_34deg,transparent_54deg)]" />
            {/* Right Metallic Gold Stadium Spotlight */}
            <div className="spl-spotlight-right absolute -top-28 -right-16 w-[58%] h-[145%] origin-top bg-[conic-gradient(from_140deg_at_65%_0%,transparent_0deg,rgba(251,191,36,0.28)_18deg,rgba(234,88,12,0.15)_34deg,transparent_54deg)]" />
            {/* Center Fiery Amber Arena Glow */}
            <div className="absolute inset-x-0 top-1/4 h-72 bg-[radial-gradient(circle,rgba(245,158,11,0.2)_0%,rgba(249,115,22,0.08)_55%,transparent_75%)] blur-2xl" />
            {/* Floating Golden Championship Particles */}
            {GRAND_FINAL_PARTICLES.map((p, i) => (
              <span
                key={i}
                className={`spl-gold-particle absolute rounded-full ${p.size} ${p.color} blur-[0.5px]`}
                style={{
                  left: p.left,
                  top: p.top,
                  animationDelay: p.delay,
                  animationDuration: p.duration,
                }}
              />
            ))}
          </div>
        )}

        {/* Animated Stadium Spotlights & Subtle Particles (Semi-Final Championship Broadcast Only) */}
        {isSemiFinal && (
          <div aria-hidden="true" className="absolute inset-0 pointer-events-none overflow-hidden">
            {/* Left Electric Blue Stadium Spotlight Beam */}
            <div className="spl-spotlight-left absolute -top-28 -left-16 w-[55%] h-[145%] origin-top bg-[conic-gradient(from_165deg_at_35%_0%,transparent_0deg,rgba(59,130,246,0.22)_18deg,rgba(99,102,241,0.12)_34deg,transparent_52deg)]" />
            {/* Right Electric Purple Stadium Spotlight Beam */}
            <div className="spl-spotlight-right absolute -top-28 -right-16 w-[55%] h-[145%] origin-top bg-[conic-gradient(from_140deg_at_65%_0%,transparent_0deg,rgba(168,85,247,0.24)_18deg,rgba(139,92,246,0.12)_34deg,transparent_52deg)]" />
            {/* Soft Center Radial Arena Depth */}
            <div className="absolute inset-x-0 top-1/4 h-64 bg-[radial-gradient(circle,rgba(139,92,246,0.16)_0%,rgba(59,130,246,0.06)_55%,transparent_75%)] blur-2xl" />
            {/* Smooth Floating Background Particles */}
            {SEMI_FINAL_PARTICLES.map((p, i) => (
              <span
                key={i}
                className={`spl-particle-float absolute rounded-full ${p.size} ${p.color} blur-[0.5px]`}
                style={{
                  left: p.left,
                  top: p.top,
                  animationDelay: p.delay,
                  animationDuration: p.duration,
                }}
              />
            ))}
          </div>
        )}

        {/* Animated Celebration Spotlights for League / Quarter-Final when celebration triggers */}
        {isCelebratingNow && !isGrandFinal && !isSemiFinal && (
          <div aria-hidden="true" className="absolute inset-0 pointer-events-none overflow-hidden">
            <div className="spl-spotlight-left absolute -top-28 -left-16 w-[52%] h-[145%] origin-top bg-[conic-gradient(from_165deg_at_35%_0%,transparent_0deg,rgba(251,191,36,0.22)_18deg,rgba(16,185,129,0.12)_34deg,transparent_52deg)]" />
            <div className="spl-spotlight-right absolute -top-28 -right-16 w-[52%] h-[145%] origin-top bg-[conic-gradient(from_140deg_at_65%_0%,transparent_0deg,rgba(245,158,11,0.22)_18deg,rgba(56,189,248,0.12)_34deg,transparent_52deg)]" />
          </div>
        )}

        {/* Scoped Fireworks & Confetti Canvas strictly contained within Broadcast Area */}
        {isGrandFinalChampionConfirmed && (
          <canvas
            ref={gfCanvasRef}
            aria-hidden="true"
            className="absolute inset-0 w-full h-full pointer-events-none z-20"
          />
        )}

        {/* Step 1 Backdrop Dimmer during Grand Final Victory Ceremony */}
        {isGrandFinalCeremonyPlaying && (
          <div
            aria-hidden="true"
            className="absolute inset-0 bg-black/45 pointer-events-none transition-opacity duration-500 z-10"
          />
        )}

        {/* Step 3 Animated Radial Golden Fireworks Bursts (contained within broadcast container) */}
        {isGrandFinalChampionConfirmed &&
          (currentGfCeremonyStep === 'step3_fireworks' || currentGfCeremonyStep === 'step4_announce') && (
            <div aria-hidden="true" className="absolute inset-0 pointer-events-none overflow-hidden z-20">
              <div className="spl-firework-burst absolute top-14 left-[14%] w-32 h-32 rounded-full bg-[radial-gradient(circle,rgba(253,224,71,0.75)_0%,rgba(245,158,11,0.35)_38%,transparent_72%)] blur-[1px]" />
              <div className="spl-firework-burst spl-firework-delay-1 absolute top-10 right-[14%] w-36 h-36 rounded-full bg-[radial-gradient(circle,rgba(251,146,60,0.8)_0%,rgba(251,191,36,0.38)_38%,transparent_72%)] blur-[1px]" />
              <div className="spl-firework-burst spl-firework-delay-2 absolute bottom-16 left-1/2 -translate-x-1/2 w-40 h-40 rounded-full bg-[radial-gradient(circle,rgba(254,240,138,0.7)_0%,rgba(234,88,12,0.32)_40%,transparent_72%)] blur-[1px]" />
            </div>
          )}

        {/* Lightweight GPU-Compositor Confetti Overlay (independent per match, replayable) */}
        {(isCelebratingNow ||
          (isGrandFinalChampionConfirmed &&
            (currentGfCeremonyStep === 'step3_fireworks' ||
              currentGfCeremonyStep === 'step4_announce'))) &&
          activeMatch && (
            <div
              key={`confetti-${activeMatch.id}-${activeMatchCelebration?.runId || gfCeremony?.runId || 1}`}
              aria-hidden="true"
              className="absolute inset-0 pointer-events-none overflow-hidden z-20"
            >
              {Array.from({ length: 18 }, (_, idx) => (
                <span
                  key={idx}
                  className={`spl-confetti-piece ${confettiPalette[idx % confettiPalette.length]}`}
                />
              ))}
            </div>
          )}

        {/* Subtle Badminton Court Line Watermark */}
        <div
          className={`absolute right-0 top-0 bottom-0 w-1/2 pointer-events-none overflow-hidden transition-opacity duration-500 ${
            isGrandFinal
              ? 'opacity-[0.15] text-amber-300'
              : isSemiFinal
              ? 'opacity-[0.14] text-violet-200'
              : 'opacity-10 text-white'
          }`}
        >
          <svg className="w-full h-full" viewBox="0 0 400 300" fill="none" stroke="currentColor">
            <rect x="20" y="20" width="360" height="260" strokeWidth="2" />
            <line x1="200" y1="20" x2="200" y2="280" strokeWidth="3" strokeDasharray="6 4" />
            <line x1="120" y1="20" x2="120" y2="280" strokeWidth="1" />
            <line x1="280" y1="20" x2="280" y2="280" strokeWidth="1" />
            <line x1="20" y1="150" x2="380" y2="150" strokeWidth="1" />
          </svg>
        </div>

        {/* Section Top Bar: Status Badges, Stage Tag & Multi-Court Selector */}
        <div
          className={`relative z-10 flex flex-col gap-3 pb-5 sm:pb-6 border-b transition-colors duration-500 ${
            isGrandFinal
              ? 'border-amber-400/30'
              : isSemiFinal
              ? 'border-violet-400/25'
              : 'border-white/10'
          }`}
        >
          <div className="flex flex-wrap items-center justify-between gap-2.5">
            <div className="flex flex-wrap items-center gap-2 sm:gap-2.5">
              {activeMatch ? (
                isLive ? (
                  <div
                    className={`flex items-center gap-2 px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider shadow-lg ${
                      isGrandFinal
                        ? 'bg-gradient-to-r from-orange-500/25 to-amber-500/25 border border-amber-400/60 text-amber-200 shadow-amber-500/25'
                        : 'bg-rose-500/20 border border-rose-500/45 text-rose-300 shadow-rose-500/20'
                    }`}
                  >
                    <span className="relative flex h-2.5 w-2.5">
                      <span
                        className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${
                          isGrandFinal ? 'bg-amber-400' : 'bg-rose-400'
                        }`}
                      />
                      <span
                        className={`relative inline-flex rounded-full h-2.5 w-2.5 ${
                          isGrandFinal ? 'bg-orange-400' : 'bg-rose-500'
                        }`}
                      />
                    </span>
                    <span>LIVE · {courtDisplayName.toUpperCase()}</span>
                  </div>
                ) : isPaused ? (
                  <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/20 border border-amber-500/40 text-amber-300 text-xs font-black uppercase tracking-wider">
                    <Clock className="w-3.5 h-3.5 text-amber-400" />
                    <span>PAUSED · {courtDisplayName.toUpperCase()}</span>
                  </div>
                ) : isCompleted ? (
                  <div
                    className={`flex items-center gap-2 px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider ${
                      isGrandFinal
                        ? 'bg-amber-500/20 border border-amber-400/50 text-amber-200'
                        : 'bg-emerald-500/20 border border-emerald-500/40 text-emerald-300'
                    }`}
                  >
                    <CheckCircle2 className={`w-3.5 h-3.5 ${isGrandFinal ? 'text-amber-300' : 'text-emerald-400'}`} />
                    <span>{isGrandFinal ? 'CHAMPION CROWNED' : 'FINAL RESULT'} · {courtDisplayName.toUpperCase()}</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-slate-500/20 border border-slate-500/40 text-slate-300 text-xs font-black uppercase tracking-wider">
                    <Clock className="w-3.5 h-3.5 text-slate-400" />
                    <span>NEXT ON {courtDisplayName.toUpperCase()}</span>
                  </div>
                )
              ) : (
                <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-slate-500/20 border border-slate-500/40 text-slate-300 text-xs font-black uppercase tracking-wider">
                  <Clock className="w-3.5 h-3.5 text-slate-400" />
                  <span>COURT BROADCAST STANDBY</span>
                </div>
              )}

              {activeMatch && (
                isGrandFinal ? (
                  <span className="relative overflow-hidden inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-black uppercase tracking-widest bg-gradient-to-r from-amber-500/30 via-yellow-500/30 to-orange-500/30 text-amber-100 border border-amber-300/70 shadow-[0_0_20px_rgba(245,158,11,0.5)]">
                    <span
                      aria-hidden="true"
                      className="spl-championship-sheen absolute inset-y-0 w-10 bg-gradient-to-r from-transparent via-amber-100/40 to-transparent skew-x-[-20deg] pointer-events-none"
                    />
                    <Crown className="w-3 h-3 text-amber-300 shrink-0 relative z-10" />
                    <span className="relative z-10">GRAND FINAL</span>
                  </span>
                ) : isSemiFinal ? (
                  <span className="relative overflow-hidden inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-black uppercase tracking-widest bg-gradient-to-r from-blue-500/25 via-violet-500/30 to-purple-500/25 text-violet-100 border border-violet-400/60 shadow-[0_0_18px_rgba(139,92,246,0.45)]">
                    <span
                      aria-hidden="true"
                      className="spl-championship-sheen absolute inset-y-0 w-10 bg-gradient-to-r from-transparent via-white/30 to-transparent skew-x-[-20deg] pointer-events-none"
                    />
                    <Zap className="w-3 h-3 text-blue-300 shrink-0 relative z-10" />
                    <span className="relative z-10">SEMI-FINAL</span>
                  </span>
                ) : (
                  <span
                    className={`px-2.5 py-1 rounded-full text-[11px] font-black uppercase tracking-wider border ${
                      stageMeta.isKnockout
                        ? 'bg-sky-500/20 text-sky-300 border-sky-500/40'
                        : 'bg-white/5 text-slate-300 border-white/10'
                    }`}
                  >
                    {stageMeta.label}
                  </span>
                )
              )}

              <span
                className={`text-xs font-mono hidden md:inline transition-colors duration-300 ${
                  isGrandFinal
                    ? 'text-amber-200/85'
                    : isSemiFinal
                    ? 'text-violet-200/80'
                    : 'text-slate-400'
                }`}
              >
                BWF {targetScore}-pt Rally Format
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {(realtimeStatus === 'reconnecting' || realtimeStatus === 'offline') && (
                <div
                  role="status"
                  aria-live="polite"
                  className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold border ${
                    realtimeStatus === 'offline'
                      ? 'bg-rose-500/15 text-rose-300 border-rose-500/40'
                      : 'bg-amber-500/15 text-amber-300 border-amber-500/40'
                  }`}
                >
                  {realtimeStatus === 'offline' ? (
                    <WifiOff className="w-3.5 h-3.5 shrink-0" />
                  ) : (
                    <RefreshCw className="w-3.5 h-3.5 animate-spin shrink-0" />
                  )}
                  <span>
                    {realtimeStatus === 'offline'
                      ? 'Offline — Live updates paused'
                      : 'Reconnecting live sync...'}
                  </span>
                  {onRetryRealtime && (
                    <button
                      type="button"
                      onClick={onRetryRealtime}
                      className="ml-1 px-1.5 py-0.5 rounded bg-white/10 hover:bg-white/20 text-white text-[10px] font-black uppercase cursor-pointer"
                    >
                      Retry
                    </button>
                  )}
                </div>
              )}

              {liveMatches.length > 1 && (
                <span
                  className={`text-[11px] font-bold px-2.5 py-1 rounded-full border transition-colors duration-300 ${
                    isGrandFinal
                      ? 'text-amber-200 bg-amber-500/15 border-amber-400/45'
                      : isSemiFinal
                      ? 'text-blue-200 bg-blue-500/15 border-blue-400/35'
                      : 'text-rose-300 bg-rose-500/10 border-rose-500/30'
                  }`}
                >
                  {liveMatches.length} Courts Live — Tap to Switch
                </span>
              )}
            </div>
          </div>

          {/* Cinematic Grand Final Championship Heading & Non-Blocking Intro Banner */}
          {isGrandFinal && (
            <div
              className={`relative overflow-hidden rounded-2xl border border-amber-400/45 bg-gradient-to-r from-[#161005]/95 via-[#241706]/90 to-[#140d04]/95 px-3.5 py-3 sm:px-6 sm:py-4 shadow-[inset_0_1px_0_rgba(253,230,138,0.2),0_0_32px_-12px_rgba(245,158,11,0.5)] ${
                showGrandFinalIntro ? 'spl-gf-banner-reveal' : ''
              }`}
            >
              <div
                aria-hidden="true"
                className="spl-championship-sheen absolute inset-y-0 w-28 bg-gradient-to-r from-transparent via-amber-200/20 to-transparent skew-x-[-20deg] pointer-events-none"
              />
              <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-start sm:items-center gap-3 min-w-0">
                  {/* Golden Championship Trophy Crest */}
                  <div className="relative shrink-0 flex items-center justify-center w-11 h-11 sm:w-14 sm:h-14 rounded-2xl bg-gradient-to-br from-amber-300 via-yellow-500 to-orange-600 text-slate-950 shadow-[0_0_24px_rgba(245,158,11,0.6)] ring-1 ring-amber-200/70">
                    <span
                      aria-hidden="true"
                      className="spl-trophy-glow absolute -inset-1 rounded-2xl bg-amber-400/30 blur-md pointer-events-none"
                    />
                    <Trophy className="w-5 h-5 sm:w-7 sm:h-7 relative z-10 stroke-[2.4]" />
                  </div>

                  <div className="min-w-0 space-y-0.5">
                    <div className="flex flex-wrap items-center gap-x-2.5 gap-y-0.5 text-[10px] sm:text-xs font-extrabold uppercase tracking-widest text-amber-200">
                      <span>🏆 SMASH PREMIER LEAGUE 3.0</span>
                      <span aria-hidden="true" className="text-amber-500/70 hidden sm:inline">·</span>
                      <span className="text-yellow-300">👑 CHAMPION EDITION</span>
                    </div>
                    <h3 className="text-base sm:text-2xl lg:text-3xl font-black font-display uppercase tracking-wide bg-gradient-to-r from-amber-100 via-yellow-300 to-orange-400 bg-clip-text text-transparent leading-tight">
                      🔥 THE GRAND FINAL
                    </h3>
                    <p className="text-[11px] sm:text-xs font-black uppercase tracking-[0.22em] text-amber-300/95">
                      THE ULTIMATE SHOWDOWN
                    </p>
                  </div>
                </div>

                <div className="flex sm:flex-col items-center sm:items-end justify-between sm:justify-center gap-2 shrink-0">
                  <span className="inline-flex items-center gap-1.5 text-[11px] font-bold text-amber-100/90">
                    <Flame className="w-3.5 h-3.5 text-orange-400 shrink-0" />
                    <span>{isCompleted ? 'Championship Winner Decided' : 'Winner Takes the SPL Crown'}</span>
                  </span>
                  {showGrandFinalIntro && (
                    <button
                      type="button"
                      onClick={() => setActiveGfIntroMatchId(null)}
                      className="px-2.5 py-1 min-h-[32px] rounded-lg text-[10px] font-bold uppercase tracking-wider text-amber-200 hover:text-white bg-amber-500/15 hover:bg-amber-500/25 border border-amber-400/35 transition-colors cursor-pointer"
                    >
                      Live View
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Animated Semi-Final Championship Heading Strip */}
          {isSemiFinal && (
            <div className="relative overflow-hidden rounded-2xl border border-violet-400/30 bg-gradient-to-r from-blue-950/70 via-purple-950/70 to-indigo-950/70 px-3.5 py-2.5 sm:px-5 sm:py-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]">
              <div
                aria-hidden="true"
                className="spl-championship-sheen absolute inset-y-0 w-24 bg-gradient-to-r from-transparent via-violet-300/10 to-transparent skew-x-[-20deg] pointer-events-none"
              />
              <div className="relative z-10 min-w-0">
                <h3 className="text-sm sm:text-xl lg:text-2xl font-black font-display uppercase tracking-wide bg-gradient-to-r from-blue-200 via-white to-purple-200 bg-clip-text text-transparent leading-tight">
                  SEMI-FINAL – BATTLE FOR THE FINAL
                </h3>
              </div>
              <p className="relative z-10 text-[11px] sm:text-xs font-semibold text-violet-200/90 shrink-0">
                {stageMeta.label} · {isCompleted ? 'Championship Result' : 'Winner Advances to Grand Final'}
              </p>
            </div>
          )}

          {/* Responsive Multi-Court & Knockout Match Selector (each tab retains its own stage theme) */}
          {selectorMatches.length > 1 && (
            <div
              role="tablist"
              aria-label="Live and upcoming court matches"
              className="flex flex-wrap sm:flex-nowrap items-center gap-1.5 sm:overflow-x-auto no-scrollbar pt-1"
            >
              {selectorMatches.map((m) => {
                const tA = getTeam(m.teamA);
                const tB = getTeam(m.teamB);
                const isSelected = activeMatch?.id === m.id;
                const mStage = getKnockoutStageMeta(m);
                const mIsGf =
                  m.matchType === 'knockout' &&
                  (m.stage === 'F' ||
                    (Boolean(m.stageLabel?.toLowerCase().includes('final')) &&
                      !m.stageLabel?.toLowerCase().includes('semi') &&
                      !m.stageLabel?.toLowerCase().includes('quarter')));
                const mIsSf = !mIsGf && m.matchType === 'knockout' && m.stage === 'SF';
                const mCourt = resolveCourtName(m);
                const hasScore = m.status === 'live' || m.status === 'paused' || m.status === 'completed';

                return (
                  <button
                    key={m.id}
                    type="button"
                    role="tab"
                    aria-selected={isSelected}
                    onClick={() => setSelectedMatchId(m.id)}
                    className={`px-2.5 py-1.5 min-h-[40px] rounded-xl text-xs font-bold transition-all whitespace-nowrap flex items-center gap-1.5 shrink-0 cursor-pointer ${
                      isSelected
                        ? mIsGf
                          ? 'bg-gradient-to-r from-amber-400 via-yellow-300 to-orange-400 text-slate-950 border border-amber-200/80 shadow-lg shadow-amber-500/35'
                          : mIsSf
                          ? 'bg-gradient-to-r from-blue-500 to-purple-600 text-white border border-violet-300/60 shadow-lg shadow-purple-500/30'
                          : 'bg-lime-400 text-slate-950 shadow-md shadow-lime-400/20'
                        : mIsGf
                        ? 'bg-amber-500/15 hover:bg-amber-500/25 text-amber-100 border border-amber-400/45'
                        : mIsSf
                        ? 'bg-violet-500/15 hover:bg-violet-500/25 text-violet-100 border border-violet-400/40'
                        : m.status === 'live'
                        ? 'bg-rose-500/15 hover:bg-rose-500/25 text-white border border-rose-500/40'
                        : 'bg-white/5 hover:bg-white/10 text-slate-300 border border-white/10'
                    }`}
                  >
                    {m.status === 'live' && (
                      <span
                        className={`w-1.5 h-1.5 rounded-full animate-pulse shrink-0 ${
                          isSelected ? (mIsSf ? 'bg-white' : 'bg-slate-950') : mIsGf ? 'bg-amber-400' : 'bg-rose-500'
                        }`}
                      />
                    )}
                    {mStage.isKnockout && (
                      <span
                        className={`px-1 py-0.5 rounded text-[9px] font-black uppercase ${
                          isSelected
                            ? mIsGf
                              ? 'bg-slate-950/15 text-slate-950'
                              : mIsSf
                              ? 'bg-white/20 text-white'
                              : 'bg-slate-950/15 text-slate-950'
                            : mIsGf
                            ? 'bg-amber-400/25 text-amber-200'
                            : mIsSf
                            ? 'bg-violet-400/25 text-violet-200'
                            : 'bg-sky-400/20 text-sky-300'
                        }`}
                      >
                        {mStage.shortTag}
                      </span>
                    )}
                    <span className="opacity-75 font-mono text-[10px]">
                      {mCourt.replace(/^Court\s+/i, 'C')}:
                    </span>
                    <span className="truncate max-w-[140px]">
                      {tA?.badge || ''} {tA?.name?.slice(0, 9) || 'TBD'} v {tB?.name?.slice(0, 9) || 'TBD'}
                    </span>
                    {hasScore && (
                      <span
                        className={`font-mono text-[11px] font-black pl-0.5 tabular-nums ${
                          isSelected
                            ? mIsGf
                              ? 'text-slate-950'
                              : mIsSf
                              ? 'text-blue-200'
                              : 'text-slate-950'
                            : mIsGf
                            ? 'text-amber-300'
                            : mIsSf
                            ? 'text-violet-300'
                            : 'text-lime-400'
                        }`}
                      >
                        {m.scoreA ?? 0}-{m.scoreB ?? 0}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Main Live Scoreboard Grid */}
        {!activeMatch ? (
          <div className="relative z-10 py-12 text-center space-y-2">
            <span className="text-4xl block">🏸</span>
            <h3 className="text-lg font-bold text-white">No Matches Scheduled Yet</h3>
            <p className="text-xs text-slate-400 max-w-md mx-auto">
              Matches will automatically appear here as soon as the tournament schedule or knockout bracket goes live.
            </p>
          </div>
        ) : (
          <div className="relative z-10 py-5 sm:py-8">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 sm:gap-6 items-center">
              
              {/* Team A Card */}
              <div
                className={`lg:col-span-5 flex items-center justify-between gap-3 sm:gap-4 p-3.5 sm:p-5 rounded-2xl border transition-all duration-500 ${
                  showGrandFinalIntro ? 'spl-gf-enter-left' : ''
                } ${
                  isWinnerA
                    ? isSemiFinal
                      ? 'bg-gradient-to-br from-violet-950/90 via-[#1b0f3f]/90 to-amber-500/15 border-amber-400/80 shadow-[0_0_36px_-6px_rgba(251,191,36,0.6),0_0_24px_-6px_rgba(168,85,247,0.5)] ring-1 ring-amber-300/45'
                      : 'bg-gradient-to-br from-amber-500/15 via-[#161005]/90 to-yellow-500/10 border-amber-400/80 shadow-[0_0_34px_-6px_rgba(251,191,36,0.65)] ring-1 ring-amber-300/45'
                    : isGrandFinal
                    ? 'bg-[#120d05]/85 border-amber-400/55 shadow-[0_0_32px_-8px_rgba(245,158,11,0.45)] hover:border-amber-300/80'
                    : isSemiFinal
                    ? 'bg-[#0b1335]/80 border-blue-400/45 shadow-[0_0_28px_-8px_rgba(59,130,246,0.45)] hover:border-blue-300/70'
                    : 'bg-white/[0.03] border-white/10 hover:border-lime-400/30'
                }`}
              >
                <div className="flex items-center gap-2.5 sm:gap-3 min-w-0 flex-1">
                  <div
                    className={`relative flex h-12 w-12 sm:h-14 sm:w-14 shrink-0 items-center justify-center rounded-2xl font-black text-xl sm:text-2xl shadow-lg transition-all duration-500 ${
                      isGrandFinal
                        ? 'bg-gradient-to-tr from-amber-500 via-yellow-400 to-orange-400 text-slate-950 shadow-amber-500/40 ring-1 ring-amber-200/70'
                        : isSemiFinal
                        ? 'bg-gradient-to-tr from-blue-600 via-indigo-500 to-cyan-400 text-white shadow-blue-500/35 ring-1 ring-blue-300/40'
                        : 'bg-gradient-to-tr from-amber-500 to-amber-400 text-slate-950 shadow-amber-500/20'
                    }`}
                  >
                    <span>{teamA?.badge || '🏸'}</span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
                      <h3 className="text-base sm:text-xl font-black text-white font-display truncate">
                        {teamA?.name || 'Awaiting Team'}
                      </h3>
                      {isWinnerA && (
                        <span className="px-2 py-0.5 rounded text-[9px] sm:text-[10px] font-black uppercase shrink-0 border bg-amber-400/25 text-amber-200 border-amber-300/55">
                          {isGrandFinal ? '👑 Champion' : '🏆 Winner'}
                        </span>
                      )}
                    </div>
                    <div
                      className={`text-xs mt-0.5 truncate ${
                        isGrandFinal
                          ? 'text-amber-200/85'
                          : isSemiFinal
                          ? 'text-blue-200/80'
                          : 'text-slate-400'
                      }`}
                    >
                      {teamAPlayers.length > 0
                        ? teamAPlayers.map((p) => p.name).join(' & ')
                        : teamA ? 'Doubles Pair' : 'Championship Contender'}
                    </div>
                    {isLive && setEval.isGamePointA && (
                      <span
                        className={`inline-block mt-1 px-2 py-0.5 text-[10px] font-bold rounded ${
                          isGrandFinal
                            ? 'text-amber-100 bg-orange-500/30 border border-amber-400/50'
                            : isSemiFinal
                            ? 'text-blue-200 bg-blue-500/25 border border-blue-400/40'
                            : 'text-amber-300 bg-amber-500/20'
                        }`}
                      >
                        🔥 {setEval.isMatchPointA ? 'CHAMPIONSHIP POINT' : 'GAME POINT'}
                      </span>
                    )}
                  </div>
                </div>

                {/* Large Score Digit (zero animation delay for instant real-time updates) */}
                <div className={`text-right shrink-0 pl-2 ${showGrandFinalIntro ? 'spl-gf-scoreboard-reveal' : ''}`}>
                  <div
                    className={`text-3xl sm:text-5xl lg:text-6xl font-black font-mono tracking-tight tabular-nums ${
                      scoreA > scoreB
                        ? isGrandFinal
                          ? 'text-amber-300 drop-shadow-[0_0_22px_rgba(251,191,36,0.75)]'
                          : isSemiFinal
                          ? 'text-blue-300 drop-shadow-[0_0_18px_rgba(96,165,250,0.65)]'
                          : 'text-lime-400 drop-shadow-[0_0_15px_rgba(163,230,53,0.4)]'
                        : isGrandFinal
                        ? 'text-amber-50'
                        : 'text-white'
                    }`}
                  >
                    {scoreA}
                  </div>
                  <span
                    className={`text-[10px] uppercase font-bold ${
                      isGrandFinal
                        ? 'text-amber-300/80'
                        : isSemiFinal
                        ? 'text-blue-300/75'
                        : 'text-slate-400'
                    }`}
                  >
                    Points
                  </span>
                </div>
              </div>

              {/* Middle Match Broadcast Status & Cinematic VS Divider */}
              <div className="lg:col-span-2 flex flex-col items-center justify-center text-center space-y-2 py-1 sm:py-2">
                {isGrandFinal ? (
                  <div className={`relative flex items-center justify-center ${showGrandFinalIntro ? 'spl-gf-vs-burst' : ''}`}>
                    <span
                      aria-hidden="true"
                      className="spl-vs-pulse absolute w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-gradient-to-tr from-amber-500/50 via-orange-500/45 to-yellow-400/45 blur-md pointer-events-none"
                    />
                    <div className="relative inline-flex items-center justify-center w-12 h-12 sm:w-14 sm:h-14 rounded-2xl rotate-3 bg-gradient-to-br from-amber-300 via-amber-500 to-orange-600 border border-amber-200/85 text-slate-950 font-black italic text-base sm:text-lg font-display tracking-wider shadow-[0_0_28px_rgba(245,158,11,0.8)]">
                      VS
                    </div>
                  </div>
                ) : isSemiFinal ? (
                  <div className="relative flex items-center justify-center">
                    <span
                      aria-hidden="true"
                      className="spl-vs-pulse absolute w-14 h-14 sm:w-16 sm:h-16 rounded-full bg-gradient-to-tr from-blue-500/40 via-violet-500/40 to-purple-500/40 blur-sm pointer-events-none"
                    />
                    <div className="relative inline-flex items-center justify-center w-11 h-11 sm:w-12 sm:h-12 rounded-2xl rotate-3 bg-gradient-to-br from-blue-500 via-violet-600 to-purple-600 border border-violet-300/70 text-white font-black italic text-sm sm:text-base font-display tracking-wider shadow-[0_0_24px_rgba(139,92,246,0.75)]">
                      VS
                    </div>
                  </div>
                ) : (
                  <div className="inline-flex items-center justify-center w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-white/5 border border-white/10 text-slate-400 font-black text-xs font-mono">
                    VS
                  </div>
                )}

                <div className="space-y-0.5">
                  <span
                    className={`text-[11px] font-bold uppercase tracking-wider block ${
                      isGrandFinal
                        ? 'text-amber-100'
                        : isSemiFinal
                        ? 'text-violet-100'
                        : 'text-slate-300'
                    }`}
                  >
                    {setEval.isDeuce && isLive
                      ? `⚡ DEUCE (${scoreA}-ALL)`
                      : isLive
                      ? `SET 0${sets.filter((s) => s.isCompleted).length + 1}`
                      : isPaused
                      ? 'PAUSED'
                      : isCompleted
                      ? isGrandFinal
                        ? 'CHAMPIONSHIP RESULT'
                        : 'FINAL RESULT'
                      : 'UPCOMING'}
                  </span>
                  <span
                    className={`text-[10px] font-medium block ${
                      isGrandFinal
                        ? 'text-amber-300'
                        : isSemiFinal
                        ? 'text-blue-300'
                        : 'text-lime-400'
                    }`}
                  >
                    {leadText}
                  </span>
                  {sets.length > 1 && (
                    <div className="pt-1 flex items-center justify-center gap-1.5 flex-wrap">
                      {sets.map((s, idx) => (
                        <span
                          key={idx}
                          className={`px-1.5 py-0.5 rounded text-[9px] font-mono tabular-nums ${
                            isGrandFinal
                              ? 'bg-amber-500/20 text-amber-100 border border-amber-400/35'
                              : isSemiFinal
                              ? 'bg-violet-500/20 text-violet-100 border border-violet-400/25'
                              : 'bg-white/10 text-slate-300'
                          }`}
                        >
                          S{idx + 1}: {s.scoreA}-{s.scoreB}
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                {/* Court & Stage Footer in Center Column */}
                <div
                  className={`flex items-center gap-1.5 text-xs pt-0.5 ${
                    isGrandFinal
                      ? 'text-amber-200/90'
                      : isSemiFinal
                      ? 'text-violet-200/90'
                      : 'text-slate-400'
                  }`}
                >
                  <span className={`text-base ${isLive ? 'animate-bounce' : ''}`}>
                    {isGrandFinal ? '🏆' : '🏸'}
                  </span>
                  <span className="text-[11px] font-mono">{courtDisplayName}</span>
                </div>
              </div>

              {/* Team B Card */}
              <div
                className={`lg:col-span-5 flex items-center justify-between gap-3 sm:gap-4 p-3.5 sm:p-5 rounded-2xl border transition-all duration-500 ${
                  showGrandFinalIntro ? 'spl-gf-enter-right' : ''
                } ${
                  isWinnerB
                    ? isSemiFinal
                      ? 'bg-gradient-to-br from-purple-950/90 via-[#1b0f3f]/90 to-amber-500/15 border-amber-400/80 shadow-[0_0_36px_-6px_rgba(251,191,36,0.6),0_0_24px_-6px_rgba(168,85,247,0.5)] ring-1 ring-amber-300/45'
                      : 'bg-gradient-to-br from-amber-500/15 via-[#161005]/90 to-yellow-500/10 border-amber-400/80 shadow-[0_0_34px_-6px_rgba(251,191,36,0.65)] ring-1 ring-amber-300/45'
                    : isGrandFinal
                    ? 'bg-[#170f04]/85 border-orange-400/55 shadow-[0_0_32px_-8px_rgba(249,115,22,0.45)] hover:border-amber-300/80'
                    : isSemiFinal
                    ? 'bg-[#190e3c]/80 border-purple-400/45 shadow-[0_0_28px_-8px_rgba(168,85,247,0.45)] hover:border-purple-300/70'
                    : 'bg-white/[0.03] border-white/10 hover:border-lime-400/30'
                }`}
              >
                {/* Score Digit (Left on desktop for symmetry, right on mobile) */}
                <div
                  className={`text-right lg:text-left order-2 lg:order-1 shrink-0 pl-2 lg:pl-0 lg:pr-2 ${
                    showGrandFinalIntro ? 'spl-gf-scoreboard-reveal' : ''
                  }`}
                >
                  <div
                    className={`text-3xl sm:text-5xl lg:text-6xl font-black font-mono tracking-tight tabular-nums ${
                      scoreB > scoreA
                        ? isGrandFinal
                          ? 'text-amber-300 drop-shadow-[0_0_22px_rgba(251,191,36,0.75)]'
                          : isSemiFinal
                          ? 'text-purple-300 drop-shadow-[0_0_18px_rgba(192,132,252,0.65)]'
                          : 'text-lime-400 drop-shadow-[0_0_15px_rgba(163,230,53,0.4)]'
                        : isGrandFinal
                        ? 'text-amber-50'
                        : 'text-white'
                    }`}
                  >
                    {scoreB}
                  </div>
                  <span
                    className={`text-[10px] uppercase font-bold ${
                      isGrandFinal
                        ? 'text-amber-300/80'
                        : isSemiFinal
                        ? 'text-purple-300/75'
                        : 'text-slate-400'
                    }`}
                  >
                    Points
                  </span>
                </div>

                <div className="flex items-center gap-2.5 sm:gap-3 min-w-0 flex-1 order-1 lg:order-2 text-left lg:text-right justify-start lg:justify-end">
                  <div
                    className={`relative flex lg:hidden h-12 w-12 sm:h-14 sm:w-14 shrink-0 items-center justify-center rounded-2xl font-black text-xl sm:text-2xl shadow-lg transition-all duration-500 ${
                      isGrandFinal
                        ? 'bg-gradient-to-tr from-orange-600 via-amber-500 to-yellow-400 text-slate-950 shadow-orange-500/40 ring-1 ring-amber-200/70'
                        : isSemiFinal
                        ? 'bg-gradient-to-tr from-purple-600 via-violet-500 to-fuchsia-500 text-white shadow-purple-500/35 ring-1 ring-purple-300/40'
                        : 'bg-gradient-to-tr from-cyan-500 to-blue-500 text-white shadow-cyan-500/20'
                    }`}
                  >
                    <span>{teamB?.badge || '🏸'}</span>
                  </div>

                  <div className="min-w-0 flex-1 lg:flex-initial">
                    <div className="flex flex-wrap items-center justify-start lg:justify-end gap-1.5 sm:gap-2">
                      {isWinnerB && (
                        <span className="px-2 py-0.5 rounded text-[9px] sm:text-[10px] font-black uppercase shrink-0 border bg-amber-400/25 text-amber-200 border-amber-300/55">
                          {isGrandFinal ? '👑 Champion' : '🏆 Winner'}
                        </span>
                      )}
                      <h3 className="text-base sm:text-xl font-black text-white font-display truncate">
                        {teamB?.name || 'Awaiting Team'}
                      </h3>
                    </div>
                    <div
                      className={`text-xs mt-0.5 truncate ${
                        isGrandFinal
                          ? 'text-amber-200/85'
                          : isSemiFinal
                          ? 'text-purple-200/80'
                          : 'text-slate-400'
                      }`}
                    >
                      {teamBPlayers.length > 0
                        ? teamBPlayers.map((p) => p.name).join(' & ')
                        : teamB ? 'Doubles Pair' : 'Championship Contender'}
                    </div>
                    {isLive && setEval.isGamePointB && (
                      <span
                        className={`inline-block mt-1 px-2 py-0.5 text-[10px] font-bold rounded ${
                          isGrandFinal
                            ? 'text-amber-100 bg-orange-500/30 border border-amber-400/50'
                            : isSemiFinal
                            ? 'text-purple-200 bg-purple-500/25 border border-purple-400/40'
                            : 'text-amber-300 bg-amber-500/20'
                        }`}
                      >
                        🔥 {setEval.isMatchPointB ? 'CHAMPIONSHIP POINT' : 'GAME POINT'}
                      </span>
                    )}
                  </div>

                  <div
                    className={`relative hidden lg:flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl font-black text-2xl shadow-lg transition-all duration-500 ${
                      isGrandFinal
                        ? 'bg-gradient-to-tr from-orange-600 via-amber-500 to-yellow-400 text-slate-950 shadow-orange-500/40 ring-1 ring-amber-200/70'
                        : isSemiFinal
                        ? 'bg-gradient-to-tr from-purple-600 via-violet-500 to-fuchsia-500 text-white shadow-purple-500/35 ring-1 ring-purple-300/40'
                        : 'bg-gradient-to-tr from-cyan-500 to-blue-500 text-white shadow-cyan-500/20'
                    }`}
                  >
                    <span>{teamB?.badge || '🏸'}</span>
                  </div>
                </div>
              </div>

            </div>

            {/* PHASE 6: SPECTACULAR GRAND FINAL CHAMPIONSHIP CEREMONY & FINAL CHAMPIONSHIP SCREEN */}
            {isGrandFinalChampionConfirmed && officialWinnerId ? (
              <div className="mt-6 relative z-30">
                {isGrandFinalCeremonyPlaying ? (
                  <div className="relative overflow-hidden rounded-3xl border border-amber-300/75 bg-gradient-to-b from-[#171003]/95 via-[#0b0803]/95 to-[#170e03]/95 px-4 py-6 sm:px-8 sm:py-8 text-center shadow-[0_0_55px_-10px_rgba(251,191,36,0.65)]">
                    <div
                      aria-hidden="true"
                      className="spl-championship-sheen absolute inset-y-0 w-32 bg-gradient-to-r from-transparent via-amber-200/20 to-transparent skew-x-[-20deg] pointer-events-none"
                    />

                    <div className="relative z-10 flex flex-col items-center space-y-4">
                      {/* Step 1 Heading */}
                      <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-amber-400/20 border border-amber-300/60 text-amber-200 text-xs sm:text-sm font-black uppercase tracking-[0.2em]">
                        <Sparkles className="w-4 h-4 text-yellow-300 shrink-0" />
                        <span>WE HAVE OUR CHAMPIONS!</span>
                      </div>

                      {/* Step 2+: Rising Golden 3D-Spinning Championship Trophy with Halo Glow */}
                      {currentGfCeremonyStep !== 'step1_victory' && (
                        <div className="relative flex items-center justify-center py-2 spl-gf-trophy-rise">
                          <div
                            aria-hidden="true"
                            className="spl-trophy-glow absolute w-32 h-32 rounded-full bg-[radial-gradient(circle,rgba(251,191,36,0.55)_0%,rgba(249,115,22,0.25)_50%,transparent_75%)] blur-xl"
                          />
                          <div className="spl-gf-trophy-spin3d relative z-10 drop-shadow-[0_0_24px_rgba(251,191,36,0.8)]">
                            <GoldenChampionshipTrophySvg className="w-20 h-20 sm:w-24 sm:h-24" />
                          </div>
                        </div>
                      )}

                      {/* Step 4: Grand Champion Announcement */}
                      {currentGfCeremonyStep === 'step4_announce' ? (
                        <div className="space-y-2 spl-champion-text-reveal">
                          <div className="text-xs sm:text-sm font-black uppercase tracking-[0.2em] text-amber-200">
                            🏆 SMASH PREMIER LEAGUE 3.0
                          </div>
                          <div className="text-sm sm:text-base font-extrabold uppercase tracking-[0.18em] text-yellow-300">
                            👑 GRAND CHAMPIONS
                          </div>
                          <h4 className="text-2xl sm:text-4xl font-black font-display uppercase tracking-wide bg-gradient-to-r from-amber-100 via-yellow-300 to-orange-400 bg-clip-text text-transparent">
                            🎉 {winnerTeam?.name || 'CHAMPIONS'}
                          </h4>
                          <p className="text-xs sm:text-base font-black uppercase tracking-widest text-orange-300">
                            🔥 THE CHAMPIONS OF SPL 3.0!
                          </p>
                          <div className="pt-1 flex flex-wrap items-center justify-center gap-2 text-xs sm:text-sm text-amber-100/95 font-semibold">
                            <span className="text-xl">{winnerTeam?.badge || '🏆'}</span>
                            <span>
                              {winnerPlayers.length > 0
                                ? winnerPlayers.map((p) => p.name).join(' · ')
                                : 'Championship Squad'}
                            </span>
                          </div>
                        </div>
                      ) : (
                        <div className="space-y-1">
                          <div className="text-xl sm:text-3xl font-black font-display uppercase text-amber-200">
                            {winnerTeam?.badge || '🏆'} {winnerTeam?.name || 'Champions'}
                          </div>
                          <p className="text-xs sm:text-sm font-mono font-bold text-amber-300/90 tabular-nums">
                            Final Score: {scoreA} - {scoreB} · {courtDisplayName}
                          </p>
                        </div>
                      )}

                      <button
                        type="button"
                        onClick={() => {
                          clearGfCeremonyTimers();
                          setGfCeremony((curr) =>
                            curr ? { ...curr, step: 'step5_final_screen' } : null
                          );
                        }}
                        className="px-3.5 py-1.5 min-h-[36px] rounded-xl text-[11px] font-bold uppercase tracking-wider text-amber-200 hover:text-white bg-amber-500/15 hover:bg-amber-500/25 border border-amber-400/40 transition-colors cursor-pointer"
                      >
                        Results View
                      </button>
                    </div>
                  </div>
                ) : (
                  /* Step 5: Final Black-and-Gold Championship Results Screen (refresh-safe, authoritative Supabase scores) */
                  <div className="relative overflow-hidden rounded-3xl border border-amber-300/75 bg-gradient-to-br from-[#080603] via-[#1b1204] to-[#070502] p-5 sm:p-8 shadow-[0_0_50px_-10px_rgba(251,191,36,0.55),inset_0_1px_0_rgba(253,230,138,0.25)]">
                    <div
                      aria-hidden="true"
                      className="spl-championship-sheen absolute inset-y-0 w-28 bg-gradient-to-r from-transparent via-amber-200/15 to-transparent skew-x-[-20deg] pointer-events-none"
                    />

                    <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
                      <div className="flex flex-col sm:flex-row items-center sm:items-start gap-4 sm:gap-5 text-center sm:text-left min-w-0">
                        <div className="relative shrink-0 flex items-center justify-center w-20 h-20 sm:w-24 sm:h-24 rounded-2xl bg-gradient-to-br from-amber-500/20 via-yellow-500/10 to-orange-600/20 border border-amber-300/60 shadow-[0_0_28px_rgba(245,158,11,0.45)]">
                          <span
                            aria-hidden="true"
                            className="spl-trophy-glow absolute inset-1 rounded-2xl bg-amber-400/20 blur-md"
                          />
                          <GoldenChampionshipTrophySvg className="w-16 h-16 sm:w-20 sm:h-20 relative z-10" />
                        </div>

                        <div className="min-w-0 space-y-1.5">
                          <div className="text-[11px] sm:text-xs font-extrabold uppercase tracking-[0.22em] text-amber-300">
                            🏆 SMASH PREMIER LEAGUE 3.0 · 👑 SPL 3.0 CHAMPION EDITION
                          </div>
                          <h4 className="text-2xl sm:text-4xl font-black font-display uppercase tracking-wider bg-gradient-to-r from-amber-100 via-yellow-300 to-orange-400 bg-clip-text text-transparent">
                            CHAMPIONS
                          </h4>
                          <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2.5">
                            <span className="text-2xl">{winnerTeam?.badge || '🏆'}</span>
                            <span className="text-lg sm:text-2xl font-black text-white font-display">
                              {winnerTeam?.name || 'Grand Final Winner'}
                            </span>
                          </div>
                          <p className="text-xs sm:text-sm text-amber-100/90 font-medium">
                            {winnerPlayers.length > 0
                              ? `Players: ${winnerPlayers.map((p) => p.name).join(' · ')}`
                              : 'Official Championship Squad'}
                          </p>
                        </div>
                      </div>

                      <div className="flex flex-col items-center lg:items-end gap-3 shrink-0">
                        <div className="px-4 py-2.5 rounded-2xl border border-amber-400/45 bg-black/50 text-center lg:text-right">
                          <div className="text-[10px] font-bold uppercase tracking-widest text-amber-300/85">
                            Grand Final Score · {courtDisplayName}
                          </div>
                          <div className="text-xl sm:text-2xl font-black font-mono text-amber-200 tabular-nums mt-0.5">
                            {teamA?.name?.slice(0, 12) || 'Team A'} {scoreA} – {scoreB} {teamB?.name?.slice(0, 12) || 'Team B'}
                          </div>
                          {sets.length > 1 && (
                            <div className="text-[10px] font-mono text-amber-100/80 mt-0.5 tabular-nums">
                              {sets.map((s, i) => `S${i + 1}: ${s.scoreA}-${s.scoreB}`).join(' · ')}
                            </div>
                          )}
                        </div>

                        <button
                          type="button"
                          onClick={() => startGrandFinalCeremony(activeMatch.id, officialWinnerId)}
                          className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-2.5 min-h-[44px] rounded-xl text-xs font-black uppercase tracking-wider text-slate-950 bg-gradient-to-r from-amber-300 via-yellow-400 to-orange-400 hover:from-amber-200 hover:to-orange-300 shadow-lg shadow-amber-500/35 transition-all cursor-pointer whitespace-nowrap"
                        >
                          <RotateCcw className="w-4 h-4 shrink-0" />
                          <span>Replay Championship Celebration</span>
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              /* Official Match Winner Celebration Banner for League, Quarter-Final & Semi-Final */
              isCompleted &&
              officialWinnerId && (
                <div
                  key={`winner-banner-${activeMatch.id}-${activeMatchCelebration?.runId || 0}`}
                  className={`mt-5 sm:mt-6 relative overflow-hidden rounded-2xl border px-4 py-3.5 sm:px-6 sm:py-4 flex flex-col md:flex-row md:items-center justify-between gap-3 ${
                    isCelebratingNow ? 'spl-winner-banner-in' : ''
                  } ${
                    isSemiFinal
                      ? 'border-violet-300/60 bg-gradient-to-r from-[#170b36] via-[#23104f] to-[#1a1230] shadow-[0_0_28px_-8px_rgba(168,85,247,0.45)]'
                      : isQuarterFinal
                      ? 'border-sky-300/55 bg-gradient-to-r from-[#0a1930] via-[#13223d] to-[#1a170b] shadow-[0_0_28px_-10px_rgba(56,189,248,0.45)]'
                      : 'border-amber-400/55 bg-gradient-to-r from-[#141106] via-[#1d1706] to-[#0b1915] shadow-[0_0_26px_-10px_rgba(251,191,36,0.4)]'
                  }`}
                >
                  <div className="flex items-start sm:items-center gap-3 min-w-0">
                    <div
                      className={`flex h-10 w-10 sm:h-12 sm:w-12 shrink-0 items-center justify-center rounded-xl shadow-lg ${
                        isSemiFinal
                          ? 'bg-gradient-to-br from-violet-400 via-purple-500 to-amber-400 text-white'
                          : 'bg-gradient-to-br from-amber-300 to-amber-500 text-slate-950'
                      }`}
                    >
                      {isSemiFinal || isQuarterFinal ? (
                        <Award className="w-5 h-5 sm:w-6 sm:h-6" />
                      ) : (
                        <PartyPopper className="w-5 h-5 sm:w-6 sm:h-6" />
                      )}
                    </div>

                    <div className="min-w-0 space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm sm:text-lg font-black font-display uppercase tracking-wide text-amber-200 truncate">
                          {isSemiFinal
                            ? `SEMI-FINAL WINNER – ${winnerTeam?.name || 'Winner'}`
                            : isQuarterFinal
                            ? `QUARTER-FINAL WINNER – ${winnerTeam?.name || 'Winner'}`
                            : `MATCH WINNER – ${winnerTeam?.name || 'Winner'}`}
                        </span>
                        <span className="text-xs font-mono font-bold text-white/90 tabular-nums">
                          ({scoreA} - {scoreB})
                        </span>
                      </div>

                      <div className="flex flex-wrap items-center gap-2 text-xs">
                        {isQuarterFinal && isQuarterFinalQualified && (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-sky-500/20 border border-sky-400/50 text-sky-200 font-black uppercase tracking-wider text-[11px]">
                            <Sparkles className="w-3 h-3 text-amber-300 shrink-0" />
                            <span>ADVANCED TO THE NEXT ROUND</span>
                          </span>
                        )}
                        {isSemiFinal && isSemiFinalQualified && (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-gradient-to-r from-purple-500/30 to-amber-500/30 border border-amber-300/60 text-amber-100 font-black uppercase tracking-wider text-[11px]">
                            <Crown className="w-3 h-3 text-amber-300 shrink-0" />
                            <span>QUALIFIED FOR THE GRAND FINAL!</span>
                          </span>
                        )}
                        <span className="text-slate-300">
                          {winnerTeam?.badge || '🏆'} Official Result Verified · {courtDisplayName}
                        </span>
                      </div>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => triggerCelebrationForMatch(activeMatch.id, officialWinnerId)}
                    className={`shrink-0 inline-flex items-center justify-center gap-2 px-4 py-2 min-h-[40px] rounded-xl text-xs font-bold border transition-all cursor-pointer whitespace-nowrap ${
                      isSemiFinal
                        ? 'bg-violet-500/25 hover:bg-violet-500/35 text-violet-100 border-violet-300/50'
                        : 'bg-amber-400/20 hover:bg-amber-400/30 text-amber-100 border-amber-300/55'
                    }`}
                  >
                    <RotateCcw className="w-3.5 h-3.5 shrink-0" />
                    <span>Replay Celebration</span>
                  </button>
                </div>
              )
            )}
          </div>
        )}

        {/* Footer Actions Strip: Match Controls & Details */}
        <div
          className={`relative z-10 flex flex-col sm:flex-row items-center justify-between gap-4 pt-5 border-t transition-colors duration-500 ${
            isGrandFinal
              ? 'border-amber-400/30'
              : isSemiFinal
              ? 'border-violet-400/25'
              : 'border-white/10'
          }`}
        >
          <div
            className={`flex items-center gap-2 text-xs text-center sm:text-left ${
              isGrandFinal
                ? 'text-amber-200/85'
                : isSemiFinal
                ? 'text-violet-200/80'
                : 'text-slate-400'
            }`}
          >
            <span
              className={`w-2 h-2 rounded-full shrink-0 ${
                isGrandFinal ? 'bg-amber-400' : isSemiFinal ? 'bg-violet-400' : 'bg-emerald-400'
              }`}
            />
            <span>{venue || 'Maharajganj Indoor Stadium'} · Official Referee Monitored</span>
          </div>

          <div className="flex items-center gap-3 w-full sm:w-auto">
            {activeMatch && onOpenMatchModal && (
              <button
                onClick={() => onOpenMatchModal(activeMatch)}
                className={`flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2.5 min-h-[44px] rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  isGrandFinal
                    ? 'text-slate-950 bg-gradient-to-r from-amber-300 via-yellow-400 to-orange-400 hover:from-amber-200 hover:to-orange-300 shadow-lg shadow-amber-500/35'
                    : isSemiFinal
                    ? 'text-white bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 border border-violet-300/40 shadow-lg shadow-purple-600/30'
                    : 'text-slate-950 bg-lime-400 hover:bg-lime-300 shadow-md shadow-lime-400/20'
                }`}
              >
                <Maximize2 className="w-3.5 h-3.5" />
                <span>OPEN LIVE MATCH</span>
              </button>
            )}

            {onGoToFixtures && (
              <button
                onClick={onGoToFixtures}
                className={`flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-4 py-2.5 min-h-[44px] rounded-xl text-xs font-semibold border transition-colors cursor-pointer ${
                  isGrandFinal
                    ? 'text-amber-100 hover:text-white bg-amber-500/15 hover:bg-amber-500/25 border-amber-400/40'
                    : isSemiFinal
                    ? 'text-violet-100 hover:text-white bg-violet-500/15 hover:bg-violet-500/25 border-violet-400/35'
                    : 'text-slate-300 hover:text-white bg-white/5 hover:bg-white/10 border-white/10'
                }`}
              >
                <span>Full Match Centre</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

      </div>
    </section>
  );
});

