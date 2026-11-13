import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  X,
  Minimize2,
  Maximize2,
  ExternalLink,
  Radio,
  Clock,
  Film,
  Tv,
  Users,
  Trophy,
  RefreshCw,
  WifiOff,
} from 'lucide-react';
import type {
  BadmintonScoringRules,
  Match,
  Player,
  Team,
  YouTubeLiveConfig,
} from '../../types/tournament';
import {
  YOUTUBE_VIDEO_ID_REGEX,
  getYouTubeEmbedUrl,
  getYouTubeWatchUrl,
  resolveYouTubeLiveCtaState,
} from '../../utils/youtube';

interface YouTubeEmbedPlayerProps {
  videoId: string;
  title: string;
  shouldAutoplay: boolean;
}

/**
 * Isolated memoized YouTube player so frequent live score, court, or sync-status updates
 * NEVER re-render, reload, or interrupt the underlying <iframe> or exit fullscreen playback.
 */
const YouTubeEmbedPlayer = React.memo<YouTubeEmbedPlayerProps>(
  ({ videoId, title, shouldAutoplay }) => {
    const embedUrl = useMemo(
      () =>
        getYouTubeEmbedUrl(videoId, {
          autoplay: shouldAutoplay,
          mute: false,
        }),
      [videoId, shouldAutoplay]
    );

    return (
      <div className="relative w-full aspect-video bg-slate-950 overflow-hidden">
        <iframe
          key={videoId}
          src={embedUrl}
          title={title || 'SPL Live Badminton Stream'}
          className="absolute inset-0 w-full h-full border-0"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
          allowFullScreen
          referrerPolicy="strict-origin-when-cross-origin"
        />
      </div>
    );
  },
  (prev, next) =>
    prev.videoId === next.videoId &&
    prev.title === next.title &&
    prev.shouldAutoplay === next.shouldAutoplay
);

YouTubeEmbedPlayer.displayName = 'YouTubeEmbedPlayer';

interface YouTubeLivePlayerModalProps {
  config: YouTubeLiveConfig;
  isOpen: boolean;
  isMinimized: boolean;
  onClose: () => void;
  onToggleMinimize: () => void;
  matches: Match[];
  teams: Team[];
  players: Player[];
  courtNames?: string[];
  scoringRules?: BadmintonScoringRules;
  realtimeStatus?: 'connecting' | 'connected' | 'reconnecting' | 'offline';
  onRetryRealtime?: () => void;
}

export const YouTubeLivePlayerModal: React.FC<YouTubeLivePlayerModalProps> = ({
  config,
  isOpen,
  isMinimized,
  onClose,
  onToggleMinimize,
  matches,
  teams,
  players,
  courtNames,
  realtimeStatus = 'connected',
  onRetryRealtime,
}) => {
  const [selectedMatchId, setSelectedMatchId] = useState<string | null>(null);
  const prevLiveIdsRef = useRef<Set<string>>(new Set());
  const prevResolvedActiveIdRef = useRef<string | null>(null);
  const syncedOnOpenRef = useRef<boolean>(false);

  const cta = useMemo(() => resolveYouTubeLiveCtaState(config), [config]);
  const hasValidId = YOUTUBE_VIDEO_ID_REGEX.test(config.videoId || '');

  // If realtime dropped prior to opening modal, trigger single-channel reconnect & reconciliation once
  useEffect(() => {
    if (isOpen && !syncedOnOpenRef.current) {
      syncedOnOpenRef.current = true;
      if ((realtimeStatus === 'reconnecting' || realtimeStatus === 'offline') && onRetryRealtime) {
        onRetryRealtime();
      }
    } else if (!isOpen) {
      syncedOnOpenRef.current = false;
    }
  }, [isOpen, realtimeStatus, onRetryRealtime]);

  // Escape key closes expanded theater modal cleanly
  useEffect(() => {
    if (!isOpen || isMinimized) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isOpen, isMinimized, onClose]);

  const liveMatches = useMemo(() => {
    const sortKnockoutFirst = (list: Match[]) =>
      [...list].sort((a, b) => {
        const prio = (m: Match) =>
          m.stage === 'F' ? 4 : m.stage === 'SF' ? 3 : m.stage === 'QF' ? 2 : m.matchType === 'knockout' ? 1 : 0;
        return prio(b) - prio(a);
      });
    return sortKnockoutFirst(matches.filter((m) => m.status === 'live'));
  }, [matches]);

  // Smart match auto-switching matching LiveMatchHero behavior:
  // - Pins just-completed match when a live match finishes with a winner
  // - Auto-switches when a new court goes live and current selection isn't live
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

  const prioritizedMatches = useMemo(() => {
    const paused = matches.filter((m) => m.status === 'paused');
    const completed = matches.filter((m) => m.status === 'completed');
    const upcoming = matches.filter((m) => m.status === 'upcoming' && Boolean(m.teamA && m.teamB));

    const sortKnockoutFirst = (list: Match[]) =>
      [...list].sort((a, b) => {
        const prio = (m: Match) =>
          m.stage === 'F' ? 4 : m.stage === 'SF' ? 3 : m.stage === 'QF' ? 2 : m.matchType === 'knockout' ? 1 : 0;
        return prio(b) - prio(a);
      });

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

    pushUnique(liveMatches);
    pushUnique(sortKnockoutFirst(paused));
    pushUnique(
      sortKnockoutFirst(
        matches.filter((m) => m.matchType === 'knockout' && (Boolean(m.teamA && m.teamB) || m.status === 'completed'))
      )
    );
    if (ordered.length === 0) {
      pushUnique(sortKnockoutFirst(completed).slice(-4).reverse());
      pushUnique(sortKnockoutFirst(upcoming).slice(0, 4));
    } else if (selectedMatchId) {
      const focused = matches.find((m) => m.id === selectedMatchId);
      if (focused) pushUnique([focused]);
    }

    return ordered;
  }, [matches, liveMatches, selectedMatchId]);

  const activeMatch =
    (selectedMatchId && matches.find((m) => m.id === selectedMatchId)) ||
    prioritizedMatches[0] ||
    null;

  useEffect(() => {
    prevResolvedActiveIdRef.current = activeMatch?.id || null;
  }, [activeMatch?.id]);

  // Fast O(1) lookup maps for live tick updates
  const teamMap = useMemo(() => new Map(teams.map((t) => [t.id, t])), [teams]);
  const playerMap = useMemo(() => new Map(players.map((p) => [p.id, p])), [players]);

  const shouldAutoplay = config.status === 'live' || config.status === 'ended';
  const watchUrl = useMemo(() => getYouTubeWatchUrl(config.videoId), [config.videoId]);

  // Completely unmount iframe whenever closed, disabled, or missing valid video ID
  if (!isOpen || !hasValidId || !cta.visible) {
    return null;
  }

  const getTeam = (id?: string) => (id ? teamMap.get(id) : undefined);
  const getPlayerNames = (team?: Team) => {
    if (!team?.players || team.players.length === 0) return 'Doubles Pair';
    const names = team.players
      .map((pid) => playerMap.get(pid)?.name)
      .filter((n): n is string => Boolean(n));
    return names.length > 0 ? names.join(' & ') : 'Doubles Pair';
  };
  const resolveCourt = (m?: Match | null) => {
    if (!m) return 'Court 1';
    if (m.courtName?.trim()) return m.courtName;
    const idx = (m.court || 1) - 1;
    return courtNames?.[idx]?.trim() || `Court ${m.court || 1}`;
  };

  const activeTeamA = getTeam(activeMatch?.teamA);
  const activeTeamB = getTeam(activeMatch?.teamB);
  // Always read authoritative scoreA/scoreB updated by Umpire Mode & Admin Scoring (never let stale sets snapshot mask live scores)
  const activeScoreA = activeMatch?.scoreA ?? 0;
  const activeScoreB = activeMatch?.scoreB ?? 0;
  const completedSets = (activeMatch?.sets || []).filter((s) => s.isCompleted || s.winner);
  const activeWinnerTeam = activeMatch?.winner ? getTeam(activeMatch.winner) : undefined;
  const liveCount = liveMatches.length;

  const statusBadge =
    config.status === 'live' ? (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-red-600/20 border border-red-500/50 text-red-300 text-[11px] font-black uppercase tracking-wider shrink-0">
        <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse motion-reduce:animate-none" />
        <span>LIVE STREAM</span>
      </span>
    ) : config.status === 'scheduled' ? (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-500/15 border border-amber-400/45 text-amber-200 text-[11px] font-black uppercase tracking-wider shrink-0">
        <Clock className="w-3 h-3 text-amber-300" />
        <span>STARTING SOON</span>
      </span>
    ) : (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-indigo-500/20 border border-indigo-400/45 text-indigo-200 text-[11px] font-black uppercase tracking-wider shrink-0">
        <Film className="w-3 h-3 text-indigo-300" />
        <span>REPLAY</span>
      </span>
    );

  // Single persistent iframe node so Minimize <-> Expand & score updates NEVER reload or interrupt playback
  return (
    <div
      role={isMinimized ? 'region' : 'dialog'}
      aria-modal={!isMinimized}
      aria-label={config.title || 'SPL YouTube Live Broadcast'}
      className={
        isMinimized
          ? 'fixed bottom-3 right-3 z-[90] w-[264px] sm:w-[340px] max-w-[calc(100vw-1.5rem)] rounded-2xl border border-amber-400/40 bg-[#080b14]/95 backdrop-blur-xl shadow-[0_20px_50px_rgba(0,0,0,0.85)] overflow-hidden'
          : 'fixed inset-0 z-[90] flex items-center justify-center p-2 sm:p-4 lg:p-6 bg-black/85 backdrop-blur-md overflow-y-auto'
      }
    >
      {/* Click outside backdrop closes modal in expanded view */}
      {!isMinimized && (
        <div
          className="fixed inset-0 z-0"
          aria-hidden="true"
          onClick={onClose}
        />
      )}

      <div
        className={
          isMinimized
            ? 'relative z-10 flex flex-col'
            : 'relative z-10 w-full max-w-6xl my-auto rounded-2xl sm:rounded-3xl border border-amber-400/35 bg-[#070a13] shadow-[0_25px_70px_-15px_rgba(0,0,0,0.95)] overflow-hidden'
        }
      >
        {/* Modal / Mini-Player Header Controls */}
        <div
          className={`flex items-center justify-between gap-2 border-b border-white/10 bg-[#0b101d] ${
            isMinimized ? 'px-3 py-2' : 'px-4 py-3 sm:px-6 sm:py-4'
          }`}
        >
          <div className="flex items-center gap-2.5 min-w-0">
            {isMinimized ? (
              <span
                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider shrink-0 ${
                  config.status === 'live'
                    ? 'bg-red-600/25 text-red-300 border border-red-500/45'
                    : config.status === 'scheduled'
                    ? 'bg-amber-500/20 text-amber-200 border border-amber-400/40'
                    : 'bg-indigo-500/20 text-indigo-200 border border-indigo-400/40'
                }`}
              >
                {config.status === 'live' && (
                  <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse motion-reduce:animate-none" />
                )}
                <span>{config.status === 'live' ? 'LIVE' : config.status === 'scheduled' ? 'SOON' : 'REPLAY'}</span>
              </span>
            ) : (
              statusBadge
            )}
            <div className="min-w-0">
              <h3
                className={`font-display font-black text-white truncate ${
                  isMinimized ? 'text-xs' : 'text-sm sm:text-lg'
                }`}
              >
                {config.title || 'SPL 3.0 Live Stream'}
              </h3>
              {!isMinimized && config.status === 'scheduled' && config.scheduledAt && (
                <p className="text-[11px] text-amber-300/90 font-medium truncate">
                  Scheduled: {config.scheduledAt}
                </p>
              )}
            </div>
          </div>

          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            {!isMinimized && watchUrl && (
              <a
                href={watchUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="hidden sm:inline-flex items-center gap-1.5 px-3 py-2 min-h-[38px] rounded-xl text-xs font-bold text-slate-200 hover:text-white bg-white/[0.06] hover:bg-white/12 border border-white/10 transition-colors"
              >
                <span>Watch on YouTube</span>
                <ExternalLink className="w-3.5 h-3.5 text-red-400 shrink-0" />
              </a>
            )}

            <button
              type="button"
              onClick={onToggleMinimize}
              title={isMinimized ? 'Expand Theater View' : 'Minimize to Mini-Player'}
              aria-label={isMinimized ? 'Expand Live Video Player' : 'Minimize Live Video Player'}
              className={`inline-flex items-center justify-center rounded-xl text-slate-300 hover:text-white bg-white/[0.06] hover:bg-white/12 border border-white/10 transition-colors cursor-pointer ${
                isMinimized ? 'w-8 h-8' : 'px-3 py-2 min-h-[38px] gap-1.5 text-xs font-semibold'
              }`}
            >
              {isMinimized ? (
                <Maximize2 className="w-3.5 h-3.5" />
              ) : (
                <>
                  <Minimize2 className="w-3.5 h-3.5" />
                  <span className="hidden md:inline">Minimize</span>
                </>
              )}
            </button>

            <button
              type="button"
              onClick={onClose}
              title="Close Stream Player"
              aria-label="Close Live Stream Player"
              className={`inline-flex items-center justify-center rounded-xl text-slate-300 hover:text-rose-300 bg-white/[0.06] hover:bg-rose-500/20 border border-white/10 hover:border-rose-500/40 transition-colors cursor-pointer ${
                isMinimized ? 'w-8 h-8' : 'w-10 h-10'
              }`}
            >
              <X className={isMinimized ? 'w-4 h-4' : 'w-5 h-5'} />
            </button>
          </div>
        </div>

        {/* Main Content Grid: Responsive Video + Concurrent Live Scores */}
        <div
          className={
            isMinimized
              ? 'flex flex-col'
              : 'grid grid-cols-1 lg:grid-cols-12 max-h-[calc(100dvh-6rem)] overflow-y-auto'
          }
        >
          {/* YouTube 16:9 Embedded Player Column */}
          <div
            className={
              isMinimized
                ? 'w-full bg-black'
                : 'lg:col-span-8 flex flex-col bg-black border-b lg:border-b-0 lg:border-r border-white/10'
            }
          >
            <YouTubeEmbedPlayer
              videoId={config.videoId}
              title={config.title || 'SPL Live Badminton Stream'}
              shouldAutoplay={shouldAutoplay}
            />

            {!isMinimized && (
              <div className="px-4 py-3 sm:px-5 bg-[#0a0f1c] border-t border-white/10 flex flex-wrap items-center justify-between gap-2.5 text-xs">
                <div className="flex items-center gap-2 text-slate-300 min-w-0">
                  <Tv className="w-4 h-4 text-red-400 shrink-0" />
                  <span className="truncate">
                    {config.status === 'scheduled'
                      ? 'Broadcast scheduled — live player updates automatically when stream starts.'
                      : config.status === 'ended'
                      ? 'Official SPL Championship Replay Broadcast'
                      : 'Streaming live inside Smash Premier League 3.0 · Use player controls for HD & volume.'}
                  </span>
                </div>
                {watchUrl && (
                  <a
                    href={watchUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="sm:hidden inline-flex items-center gap-1.5 px-3 py-2 min-h-[38px] rounded-xl text-xs font-bold text-white bg-red-600/25 border border-red-500/40"
                  >
                    <span>Watch on YouTube</span>
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                )}
              </div>
            )}
          </div>

          {/* Minimized Compact Live Score Ticker */}
          {isMinimized && activeMatch && (
            <div className="px-3 py-2 bg-[#0b101d] border-t border-white/10 flex items-center justify-between gap-2 text-[11px]">
              <div className="flex items-center gap-1.5 min-w-0 font-bold text-white truncate">
                <span
                  className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                    realtimeStatus === 'offline'
                      ? 'bg-rose-500'
                      : realtimeStatus === 'reconnecting'
                      ? 'bg-amber-400 animate-pulse motion-reduce:animate-none'
                      : activeMatch.status === 'live'
                      ? 'bg-red-500 animate-pulse motion-reduce:animate-none'
                      : 'bg-amber-400'
                  }`}
                />
                <span className="truncate">{activeTeamA?.name || 'Team A'}</span>
                <span className="font-mono font-black text-amber-300 tabular-nums shrink-0">
                  {activeScoreA}-{activeScoreB}
                </span>
                <span className="truncate">{activeTeamB?.name || 'Team B'}</span>
              </div>
              {watchUrl && (
                <a
                  href={watchUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  title="Watch on YouTube"
                  className="text-slate-400 hover:text-white shrink-0"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              )}
            </div>
          )}

          {/* Expanded Concurrent Live Match Scoreboard Sidebar (Right on Desktop, Below on Mobile) */}
          {!isMinimized && (
            <div className="lg:col-span-4 flex flex-col bg-[#090d18] p-4 sm:p-5 space-y-4">
              <div className="flex items-center justify-between gap-2 border-b border-white/10 pb-3">
                <div className="flex items-center gap-2 min-w-0">
                  {realtimeStatus === 'offline' ? (
                    <WifiOff className="w-4 h-4 shrink-0 text-rose-400" />
                  ) : (
                    <Radio
                      className={`w-4 h-4 shrink-0 ${
                        realtimeStatus === 'reconnecting'
                          ? 'text-amber-400 animate-pulse motion-reduce:animate-none'
                          : liveCount > 0
                          ? 'text-rose-400'
                          : 'text-amber-400'
                      }`}
                    />
                  )}
                  <div className="min-w-0">
                    <h4 className="text-xs font-black uppercase tracking-wider text-white">
                      Synchronized Live Scoreboard
                    </h4>
                    <p
                      className={`text-[11px] truncate ${
                        realtimeStatus === 'reconnecting' || realtimeStatus === 'connecting'
                          ? 'text-amber-300 font-semibold'
                          : realtimeStatus === 'offline'
                          ? 'text-rose-300 font-semibold'
                          : 'text-slate-400'
                      }`}
                    >
                      {realtimeStatus === 'connecting'
                        ? 'Connecting Live Score...'
                        : realtimeStatus === 'reconnecting'
                        ? 'Reconnecting Live Score...'
                        : realtimeStatus === 'offline'
                        ? 'Offline — Reconnects automatically'
                        : liveCount > 0
                        ? `${liveCount} Court${liveCount > 1 ? 's' : ''} Updating Live`
                        : 'Latest Official Match Scores'}
                    </p>
                  </div>
                </div>

                {(realtimeStatus === 'reconnecting' || realtimeStatus === 'offline') && onRetryRealtime && (
                  <button
                    type="button"
                    onClick={onRetryRealtime}
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-bold text-amber-200 bg-amber-500/15 hover:bg-amber-500/25 border border-amber-400/35 transition-colors shrink-0 cursor-pointer"
                  >
                    <RefreshCw className="w-3 h-3" />
                    <span>Sync</span>
                  </button>
                )}
              </div>

              {/* Multi-Court Selector when >1 active match */}
              {prioritizedMatches.length > 1 && (
                <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-1">
                  {prioritizedMatches.map((m) => {
                    const isActive = activeMatch?.id === m.id;
                    const tA = getTeam(m.teamA);
                    const tB = getTeam(m.teamB);
                    return (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() => setSelectedMatchId(m.id)}
                        className={`px-2.5 py-1.5 min-h-[36px] rounded-xl text-[11px] font-bold whitespace-nowrap transition-colors shrink-0 cursor-pointer flex items-center gap-1.5 border ${
                          isActive
                            ? 'bg-amber-400/20 text-amber-200 border-amber-400/50'
                            : 'bg-white/[0.04] text-slate-300 border-white/10 hover:bg-white/10'
                        }`}
                      >
                        {m.status === 'live' && (
                          <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse motion-reduce:animate-none" />
                        )}
                        <span>{resolveCourt(m)}</span>
                        <span className="opacity-75">
                          ({tA?.name?.slice(0, 8) || 'T1'} vs {tB?.name?.slice(0, 8) || 'T2'})
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}

              {activeMatch ? (
                <div className="rounded-2xl border border-white/10 bg-[#0d1221] p-4 space-y-4">
                  <div className="flex items-center justify-between gap-2 text-[11px]">
                    <span className="font-mono font-bold uppercase tracking-wider text-amber-300">
                      {activeMatch.matchType === 'knockout'
                        ? activeMatch.stageLabel || 'Knockout Match'
                        : `Round ${activeMatch.round || 1}`}
                      {' · '}
                      {resolveCourt(activeMatch)}
                    </span>
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${
                        activeMatch.status === 'live'
                          ? 'bg-red-500/20 text-red-300 border border-red-500/40'
                          : activeMatch.status === 'paused'
                          ? 'bg-amber-500/20 text-amber-200 border border-amber-400/40'
                          : activeMatch.status === 'completed'
                          ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-400/40'
                          : 'bg-slate-700/60 text-slate-300'
                      }`}
                    >
                      {activeMatch.status === 'live'
                        ? 'LIVE'
                        : activeMatch.status === 'paused'
                        ? 'PAUSED'
                        : activeMatch.status === 'completed'
                        ? 'FINAL'
                        : 'UPCOMING'}
                    </span>
                  </div>

                  {/* Team A Score Row */}
                  <div
                    className={`flex items-center justify-between gap-3 p-3 rounded-xl border transition-colors ${
                      activeMatch.winner === activeMatch.teamA
                        ? 'bg-emerald-500/15 border-emerald-400/50'
                        : activeScoreA > activeScoreB
                        ? 'bg-amber-400/10 border-amber-400/40'
                        : 'bg-white/[0.03] border-white/10'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span className="text-xl shrink-0">{activeTeamA?.badge || '🏸'}</span>
                      <div className="min-w-0">
                        <p className="font-bold text-white text-sm truncate">
                          {activeTeamA?.name || 'Awaiting Team'}
                        </p>
                        <p className="text-[11px] text-slate-400 truncate flex items-center gap-1">
                          <Users className="w-3 h-3 shrink-0 text-slate-500" />
                          <span className="truncate">{getPlayerNames(activeTeamA)}</span>
                        </p>
                      </div>
                    </div>
                    <span className="text-3xl font-black font-mono tabular-nums text-amber-300 shrink-0">
                      {activeScoreA}
                    </span>
                  </div>

                  {/* Team B Score Row */}
                  <div
                    className={`flex items-center justify-between gap-3 p-3 rounded-xl border transition-colors ${
                      activeMatch.winner === activeMatch.teamB
                        ? 'bg-emerald-500/15 border-emerald-400/50'
                        : activeScoreB > activeScoreA
                        ? 'bg-amber-400/10 border-amber-400/40'
                        : 'bg-white/[0.03] border-white/10'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span className="text-xl shrink-0">{activeTeamB?.badge || '🏸'}</span>
                      <div className="min-w-0">
                        <p className="font-bold text-white text-sm truncate">
                          {activeTeamB?.name || 'Awaiting Team'}
                        </p>
                        <p className="text-[11px] text-slate-400 truncate flex items-center gap-1">
                          <Users className="w-3 h-3 shrink-0 text-slate-500" />
                          <span className="truncate">{getPlayerNames(activeTeamB)}</span>
                        </p>
                      </div>
                    </div>
                    <span className="text-3xl font-black font-mono tabular-nums text-white shrink-0">
                      {activeScoreB}
                    </span>
                  </div>

                  {/* Completed Match Winner Banner */}
                  {activeMatch.status === 'completed' && activeWinnerTeam && (
                    <div className="p-3 rounded-xl bg-emerald-500/12 border border-emerald-400/35 flex items-center gap-2 text-xs text-emerald-200">
                      <Trophy className="w-4 h-4 text-emerald-400 shrink-0" />
                      <span className="truncate">
                        Official Winner:{' '}
                        <strong className="text-white">{activeWinnerTeam.name}</strong>
                      </span>
                    </div>
                  )}

                  {/* Completed Historical Set Breakdown */}
                  {completedSets.length > 0 && (
                    <div className="flex flex-wrap items-center gap-1.5 pt-1">
                      {completedSets.map((s, idx) => (
                        <span
                          key={idx}
                          className="px-2 py-0.5 rounded bg-white/[0.06] border border-white/10 text-[10px] font-mono text-slate-300 tabular-nums"
                        >
                          Set {idx + 1}: {s.scoreA}-{s.scoreB}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                <div className="rounded-2xl border border-white/10 bg-[#0d1221] p-6 text-center space-y-2">
                  <Tv className="w-7 h-7 text-slate-500 mx-auto" />
                  <p className="text-xs font-semibold text-slate-300">
                    Waiting for court match scores to begin.
                  </p>
                  <p className="text-[11px] text-slate-400">
                    Scores appear here automatically in real time as umpires update points.
                  </p>
                </div>
              )}

              <p className="text-[11px] text-slate-400 leading-relaxed pt-1">
                Tip: Click <strong className="text-slate-200">Minimize</strong> to keep watching in a floating corner player while checking Fixtures, Teams, or Standings.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

