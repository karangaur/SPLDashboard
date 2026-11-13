import React, { useEffect, useMemo, useState } from 'react';
import {
  Tv,
  Radio,
  Clock,
  Film,
  Eye,
  EyeOff,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  Trash2,
  Play,
  ShieldCheck,
  Sparkles,
  Link as LinkIcon,
  Save,
} from 'lucide-react';
import { useTournament } from '../../context/TournamentContext';
import { AuthService } from '../../services/authService';
import type { YouTubeLiveConfig, YouTubeLiveStatus } from '../../types/tournament';
import {
  extractYouTubeVideoId,
  getYouTubeEmbedUrl,
  getYouTubeThumbnailUrl,
  getYouTubeWatchUrl,
  resolveYouTubeLiveCtaState,
} from '../../utils/youtube';

export const YouTubeLiveManagerView: React.FC = () => {
  const { youtubeLiveConfig, saveYouTubeLiveConfig } = useTournament();
  const canManage = AuthService.canManageTournament();

  const [draftUrl, setDraftUrl] = useState(youtubeLiveConfig.videoUrl || '');
  const [title, setTitle] = useState(youtubeLiveConfig.title || '');
  const [scheduledAt, setScheduledAt] = useState(youtubeLiveConfig.scheduledAt || '');
  const [status, setStatus] = useState<YouTubeLiveStatus>(youtubeLiveConfig.status || 'scheduled');
  const [enabled, setEnabled] = useState<boolean>(Boolean(youtubeLiveConfig.enabled));
  const [allowReplay, setAllowReplay] = useState<boolean>(
    youtubeLiveConfig.allowReplay !== undefined ? youtubeLiveConfig.allowReplay : true
  );
  const [isSaving, setIsSaving] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [showTestEmbed, setShowTestEmbed] = useState(false);

  // Sync form inputs whenever upstream authoritative config updates
  useEffect(() => {
    setDraftUrl(youtubeLiveConfig.videoUrl || '');
    setTitle(youtubeLiveConfig.title || '');
    setScheduledAt(youtubeLiveConfig.scheduledAt || '');
    setStatus(youtubeLiveConfig.status || 'scheduled');
    setEnabled(Boolean(youtubeLiveConfig.enabled));
    setAllowReplay(youtubeLiveConfig.allowReplay !== undefined ? youtubeLiveConfig.allowReplay : true);
  }, [youtubeLiveConfig]);

  const parsedInput = useMemo(() => extractYouTubeVideoId(draftUrl), [draftUrl]);
  const urlHasText = draftUrl.trim().length > 0;
  const previewConfig: YouTubeLiveConfig = useMemo(
    () => ({
      enabled: enabled && parsedInput.valid,
      videoUrl: parsedInput.valid ? parsedInput.normalizedUrl : '',
      videoId: parsedInput.valid ? parsedInput.videoId : '',
      status,
      title: title.trim() || 'SPL 3.0 Championship Court Live Broadcast',
      scheduledAt: scheduledAt.trim(),
      allowReplay,
      updatedAt: youtubeLiveConfig.updatedAt,
      updatedBy: youtubeLiveConfig.updatedBy,
    }),
    [enabled, parsedInput, status, title, scheduledAt, allowReplay, youtubeLiveConfig.updatedAt, youtubeLiveConfig.updatedBy]
  );

  const publicPreviewCta = useMemo(() => resolveYouTubeLiveCtaState(previewConfig), [previewConfig]);
  const liveSavedCta = useMemo(() => resolveYouTubeLiveCtaState(youtubeLiveConfig), [youtubeLiveConfig]);

  const handleSave = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setFeedback(null);

    if (!canManage) {
      setFeedback({ type: 'error', text: 'Only Tournament Directors or Super Admins can modify live stream settings.' });
      return;
    }

    if (urlHasText && !parsedInput.valid) {
      setFeedback({ type: 'error', text: parsedInput.error || 'Invalid YouTube stream link.' });
      return;
    }

    if (enabled && !parsedInput.valid) {
      setFeedback({
        type: 'error',
        text: 'Paste a valid YouTube Live URL or 11-character Video ID before enabling the public Watch Live button.',
      });
      return;
    }

    setIsSaving(true);
    try {
      const res = await saveYouTubeLiveConfig(previewConfig);
      if (res.success) {
        setFeedback({
          type: 'success',
          text: previewConfig.enabled
            ? `Saved & synced! Public spectators now see "${publicPreviewCta.label || 'Stream Ready'}" in real time.`
            : 'Saved & synced! Public Watch Live button is currently hidden.',
        });
      } else {
        setFeedback({ type: 'error', text: res.error || 'Failed to save YouTube Live settings.' });
      }
    } finally {
      setIsSaving(false);
    }
  };

  const handleClearStream = async () => {
    setFeedback(null);
    setShowTestEmbed(false);
    setDraftUrl('');
    setEnabled(false);
    setIsSaving(true);
    try {
      const cleared: YouTubeLiveConfig = {
        enabled: false,
        videoUrl: '',
        videoId: '',
        status: 'scheduled',
        title: title.trim() || 'SPL 3.0 Championship Court Live Broadcast',
        scheduledAt: '',
        allowReplay,
      };
      const res = await saveYouTubeLiveConfig(cleared);
      if (res.success) {
        setFeedback({ type: 'success', text: 'Stream cleared and Watch Live button removed from public website.' });
      } else {
        setFeedback({ type: 'error', text: res.error || 'Failed to clear stream.' });
      }
    } finally {
      setIsSaving(false);
    }
  };

  const handleQuickStatusSwitch = async (nextStatus: YouTubeLiveStatus) => {
    setStatus(nextStatus);
    if (!parsedInput.valid) return;
    setFeedback(null);
    setIsSaving(true);
    try {
      const nextCfg: YouTubeLiveConfig = {
        ...previewConfig,
        status: nextStatus,
        enabled: nextStatus === 'live' ? true : enabled,
      };
      if (nextStatus === 'live') setEnabled(true);
      const res = await saveYouTubeLiveConfig(nextCfg);
      if (res.success) {
        const nextCta = resolveYouTubeLiveCtaState(res.config);
        setFeedback({
          type: 'success',
          text: nextCta.visible
            ? `Stream status updated to "${nextStatus.toUpperCase()}". Public CTA is now "${nextCta.label}".`
            : `Stream status updated to "${nextStatus.toUpperCase()}". Public CTA is hidden.`,
        });
      } else {
        setFeedback({ type: 'error', text: res.error || 'Failed to update stream status.' });
      }
    } finally {
      setIsSaving(false);
    }
  };

  const embedUrl = parsedInput.valid ? getYouTubeEmbedUrl(parsedInput.videoId, { autoplay: false }) : '';
  const watchUrl = parsedInput.valid ? getYouTubeWatchUrl(parsedInput.videoId) : '';
  const thumbUrl = parsedInput.valid ? getYouTubeThumbnailUrl(parsedInput.videoId) : '';

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 space-y-6">
      {/* Header Banner */}
      <div className="rounded-2xl border border-white/10 bg-[#0d1221] p-5 sm:p-6 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="space-y-1.5 min-w-0">
          <div className="inline-flex items-center gap-2 text-xs font-mono font-bold uppercase tracking-wider text-red-400">
            <Tv className="w-4 h-4 shrink-0" />
            <span>Broadcast Control Center · Supabase Synced</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black font-display uppercase tracking-tight text-white">
            YouTube Live Streaming
          </h1>
          <p className="text-xs sm:text-sm text-slate-400 max-w-2xl">
            Manage the embedded YouTube Live stream shown directly on the SPL 3.0 public website alongside synchronized live scores.
          </p>
        </div>

        {/* Currently Published Public State Summary */}
        <div className="flex flex-wrap items-center gap-3 shrink-0">
          <div className="px-4 py-2.5 rounded-xl bg-slate-950/90 border border-white/10">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
              Published Public Button
            </span>
            {liveSavedCta.visible ? (
              <span
                className={`mt-0.5 inline-flex items-center gap-1.5 text-xs font-black uppercase tracking-wider ${
                  liveSavedCta.mode === 'live'
                    ? 'text-red-400'
                    : liveSavedCta.mode === 'scheduled'
                    ? 'text-amber-300'
                    : 'text-indigo-300'
                }`}
              >
                {liveSavedCta.mode === 'live' && (
                  <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse motion-reduce:animate-none" />
                )}
                <span>{liveSavedCta.label}</span>
              </span>
            ) : (
              <span className="mt-0.5 inline-flex items-center gap-1.5 text-xs font-bold text-slate-400">
                <EyeOff className="w-3.5 h-3.5" />
                <span>Hidden on Public Site</span>
              </span>
            )}
          </div>
        </div>
      </div>

      {!canManage && (
        <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-xs text-amber-200 flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-amber-400 shrink-0" />
          <span>Read-only view. Super Admin or Tournament Director permissions are required to publish stream changes.</span>
        </div>
      )}

      {feedback && (
        <div
          role="status"
          className={`rounded-xl border px-4 py-3 text-xs sm:text-sm font-medium flex items-center gap-2.5 ${
            feedback.type === 'success'
              ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-200'
              : 'border-rose-500/40 bg-rose-500/10 text-rose-200'
          }`}
        >
          {feedback.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          ) : (
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
          )}
          <span>{feedback.text}</span>
        </div>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
        {/* Left: Configuration Controls */}
        <form
          onSubmit={handleSave}
          className="xl:col-span-7 rounded-2xl border border-white/10 bg-[#0d1221] p-5 sm:p-6 space-y-6"
        >
          {/* 1. YouTube URL / Video ID Input */}
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <label htmlFor="yt-live-url" className="text-xs font-bold uppercase tracking-wider text-slate-200">
                YouTube Live Video URL or Video ID
              </label>
              {parsedInput.valid && (
                <span className="px-2 py-0.5 rounded-md bg-emerald-500/15 border border-emerald-500/35 text-emerald-300 font-mono text-[11px] font-bold">
                  ID: {parsedInput.videoId}
                </span>
              )}
            </div>

            <div className="relative flex items-center gap-2">
              <div className="relative flex-1">
                <LinkIcon className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  id="yt-live-url"
                  type="text"
                  value={draftUrl}
                  onChange={(e) => {
                    setDraftUrl(e.target.value);
                    setShowTestEmbed(false);
                    setFeedback(null);
                  }}
                  placeholder="https://www.youtube.com/watch?v=... or https://youtu.be/..."
                  disabled={!canManage || isSaving}
                  className="w-full pl-10 pr-4 py-3 min-h-[46px] rounded-xl bg-slate-950 border border-white/15 focus:border-amber-400 focus:outline-none text-sm text-white placeholder:text-slate-500 font-mono"
                />
              </div>

              {urlHasText && (
                <button
                  type="button"
                  onClick={handleClearStream}
                  disabled={!canManage || isSaving}
                  title="Clear stream and hide Watch Live button"
                  className="px-3.5 py-3 min-h-[46px] rounded-xl border border-rose-500/35 bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer shrink-0"
                >
                  <Trash2 className="w-4 h-4" />
                  <span className="hidden sm:inline">Clear</span>
                </button>
              )}
            </div>

            {urlHasText && !parsedInput.valid ? (
              <p className="text-xs text-rose-400 flex items-center gap-1.5">
                <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                <span>{parsedInput.error}</span>
              </p>
            ) : (
              <p className="text-[11px] text-slate-400">
                Supports <code className="text-slate-300">youtube.com/watch?v=...</code>,{' '}
                <code className="text-slate-300">youtu.be/...</code>,{' '}
                <code className="text-slate-300">youtube.com/live/...</code>,{' '}
                <code className="text-slate-300">youtube.com/shorts/...</code>, or an 11-character Video ID.
              </p>
            )}
          </div>

          {/* 2. Stream Status Selector */}
          <div className="space-y-2.5">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-200 block">
              Broadcast Stream Status
            </span>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              {(
                [
                  {
                    value: 'scheduled',
                    label: 'Scheduled',
                    desc: 'Shows "Live Starting Soon"',
                    icon: Clock,
                    activeCls: 'border-amber-400/70 bg-amber-400/15 text-amber-200',
                  },
                  {
                    value: 'live',
                    label: 'Live Now',
                    desc: 'Shows glowing "WATCH LIVE"',
                    icon: Radio,
                    activeCls: 'border-red-500/80 bg-red-600/20 text-red-200 shadow-lg shadow-red-950/30',
                  },
                  {
                    value: 'ended',
                    label: 'Ended',
                    desc: allowReplay ? 'Shows "Watch Replay"' : 'Hides Watch Live button',
                    icon: Film,
                    activeCls: 'border-indigo-400/70 bg-indigo-500/20 text-indigo-200',
                  },
                ] as const
              ).map((opt) => {
                const Icon = opt.icon;
                const isSelected = status === opt.value;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    disabled={!canManage || isSaving}
                    onClick={() => handleQuickStatusSwitch(opt.value)}
                    className={`p-3.5 rounded-xl border text-left transition-all cursor-pointer ${
                      isSelected
                        ? opt.activeCls
                        : 'border-white/10 bg-slate-950/70 hover:bg-white/[0.04] text-slate-300'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-black uppercase tracking-wider flex items-center gap-1.5">
                        <Icon className="w-3.5 h-3.5 shrink-0" />
                        <span>{opt.label}</span>
                      </span>
                      {isSelected && <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />}
                    </div>
                    <span className="text-[11px] opacity-80 block mt-1">{opt.desc}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* 3. Stream Title & Schedule Note */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label htmlFor="yt-live-title" className="text-xs font-bold uppercase tracking-wider text-slate-200">
                Broadcast Title
              </label>
              <input
                id="yt-live-title"
                type="text"
                maxLength={120}
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                disabled={!canManage || isSaving}
                placeholder="SPL 3.0 Grand Final · Court 1 Live"
                className="w-full px-3.5 py-2.5 min-h-[44px] rounded-xl bg-slate-950 border border-white/15 focus:border-amber-400 focus:outline-none text-sm text-white placeholder:text-slate-500"
              />
            </div>

            <div className="space-y-1.5">
              <label htmlFor="yt-live-sched" className="text-xs font-bold uppercase tracking-wider text-slate-200">
                Schedule Label (Optional)
              </label>
              <input
                id="yt-live-sched"
                type="text"
                maxLength={60}
                value={scheduledAt}
                onChange={(e) => setScheduledAt(e.target.value)}
                disabled={!canManage || isSaving}
                placeholder="Today · 7:00 PM IST"
                className="w-full px-3.5 py-2.5 min-h-[44px] rounded-xl bg-slate-950 border border-white/15 focus:border-amber-400 focus:outline-none text-sm text-white placeholder:text-slate-500"
              />
            </div>
          </div>

          {/* 4. Visibility & Replay Toggles */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
            <button
              type="button"
              disabled={!canManage || isSaving}
              onClick={() => setEnabled((prev) => !prev)}
              className={`flex items-center justify-between gap-3 p-3.5 rounded-xl border transition-colors cursor-pointer text-left ${
                enabled
                  ? 'border-emerald-500/45 bg-emerald-500/10 text-emerald-100'
                  : 'border-white/10 bg-slate-950/70 text-slate-300'
              }`}
            >
              <div className="flex items-center gap-2.5 min-w-0">
                {enabled ? (
                  <Eye className="w-4 h-4 text-emerald-400 shrink-0" />
                ) : (
                  <EyeOff className="w-4 h-4 text-slate-400 shrink-0" />
                )}
                <div className="min-w-0">
                  <span className="text-xs font-bold block">Public Watch Live Button</span>
                  <span className="text-[11px] opacity-75 block">
                    {enabled ? 'Visible beside Live Scoreboard' : 'Hidden on public website'}
                  </span>
                </div>
              </div>
              <span
                className={`px-2 py-0.5 rounded-md text-[10px] font-black uppercase ${
                  enabled ? 'bg-emerald-500 text-slate-950' : 'bg-slate-800 text-slate-400'
                }`}
              >
                {enabled ? 'ON' : 'OFF'}
              </span>
            </button>

            <button
              type="button"
              disabled={!canManage || isSaving}
              onClick={() => setAllowReplay((prev) => !prev)}
              className={`flex items-center justify-between gap-3 p-3.5 rounded-xl border transition-colors cursor-pointer text-left ${
                allowReplay
                  ? 'border-indigo-400/45 bg-indigo-500/10 text-indigo-100'
                  : 'border-white/10 bg-slate-950/70 text-slate-300'
              }`}
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <Film className={`w-4 h-4 shrink-0 ${allowReplay ? 'text-indigo-400' : 'text-slate-400'}`} />
                <div className="min-w-0">
                  <span className="text-xs font-bold block">Show Replay When Ended</span>
                  <span className="text-[11px] opacity-75 block">
                    {allowReplay ? 'Displays "Watch Replay"' : 'Hides CTA when ended'}
                  </span>
                </div>
              </div>
              <span
                className={`px-2 py-0.5 rounded-md text-[10px] font-black uppercase ${
                  allowReplay ? 'bg-indigo-400 text-slate-950' : 'bg-slate-800 text-slate-400'
                }`}
              >
                {allowReplay ? 'ON' : 'OFF'}
              </span>
            </button>
          </div>

          {/* Save Action Row */}
          <div className="pt-2 border-t border-white/10 flex flex-wrap items-center justify-between gap-3">
            <span className="text-[11px] text-slate-400">
              {youtubeLiveConfig.updatedAt
                ? `Last updated ${new Date(youtubeLiveConfig.updatedAt).toLocaleString()}${
                    youtubeLiveConfig.updatedBy ? ` by ${youtubeLiveConfig.updatedBy}` : ''
                  }`
                : 'Changes sync across all spectator devices in real time.'}
            </span>

            <button
              type="submit"
              disabled={!canManage || isSaving}
              className="inline-flex items-center justify-center gap-2 px-5 py-3 min-h-[44px] rounded-xl text-xs font-black uppercase tracking-wider text-slate-950 bg-gradient-to-r from-amber-300 via-amber-400 to-orange-400 hover:from-amber-200 hover:to-orange-300 disabled:opacity-50 shadow-lg shadow-amber-500/20 transition-all cursor-pointer"
            >
              <Save className="w-4 h-4 shrink-0" />
              <span>{isSaving ? 'Saving & Syncing...' : 'Save & Publish Stream'}</span>
            </button>
          </div>
        </form>

        {/* Right: Public CTA Preview & On-Demand Player Verification */}
        <div className="xl:col-span-5 space-y-5">
          {/* Public Button Live Preview */}
          <div className="rounded-2xl border border-white/10 bg-[#0d1221] p-5 space-y-4">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-xs font-black uppercase tracking-wider text-slate-200 flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-amber-400" />
                <span>Public Website Button Preview</span>
              </h2>
              <span className="text-[11px] font-mono text-slate-400">Draft Preview</span>
            </div>

            <div className="rounded-xl border border-white/10 bg-[#070a13] p-5 flex flex-col items-center justify-center text-center min-h-[120px] gap-2.5">
              {publicPreviewCta.visible ? (
                <>
                  <div
                    className={`inline-flex items-center gap-2 px-5 py-3 rounded-xl text-xs font-black uppercase tracking-wider shadow-lg ${
                      publicPreviewCta.mode === 'live'
                        ? 'bg-gradient-to-r from-red-600 via-rose-600 to-red-500 text-white border border-red-400/60 shadow-red-600/30'
                        : publicPreviewCta.mode === 'scheduled'
                        ? 'bg-amber-500/15 text-amber-200 border border-amber-400/45'
                        : 'bg-indigo-500/20 text-indigo-100 border border-indigo-400/50'
                    }`}
                  >
                    {publicPreviewCta.mode === 'live' ? (
                      <span className="w-2.5 h-2.5 rounded-full bg-white animate-pulse motion-reduce:animate-none" />
                    ) : publicPreviewCta.mode === 'scheduled' ? (
                      <Clock className="w-4 h-4 text-amber-300" />
                    ) : (
                      <Film className="w-4 h-4 text-indigo-300" />
                    )}
                    <span>{publicPreviewCta.label}</span>
                  </div>
                  {publicPreviewCta.sublabel && (
                    <span className="text-[11px] text-slate-400">{publicPreviewCta.sublabel}</span>
                  )}
                </>
              ) : (
                <div className="space-y-1 text-slate-400">
                  <EyeOff className="w-6 h-6 mx-auto opacity-60" />
                  <p className="text-xs font-semibold">Watch Live button is hidden</p>
                  <p className="text-[11px] opacity-75">
                    {!parsedInput.valid
                      ? 'Add a valid YouTube link and turn visibility ON to display.'
                      : !enabled
                      ? 'Public visibility toggle is currently OFF.'
                      : 'Stream is Ended and Replay display is OFF.'}
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* On-Demand Stream Embed Preview (Lazy-Loaded only when admin clicks Test) */}
          <div className="rounded-2xl border border-white/10 bg-[#0d1221] p-5 space-y-4">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-xs font-black uppercase tracking-wider text-slate-200">
                Embedded Player Test
              </h2>
              {watchUrl && (
                <a
                  href={watchUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-300 hover:text-amber-200"
                >
                  <span>Open on YouTube</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
              )}
            </div>

            {!parsedInput.valid ? (
              <div className="aspect-video rounded-xl border border-dashed border-white/15 bg-slate-950/60 flex flex-col items-center justify-center p-6 text-center space-y-2">
                <Tv className="w-8 h-8 text-slate-600" />
                <p className="text-xs text-slate-400">
                  Paste a valid YouTube Live URL on the left to preview the embedded player.
                </p>
              </div>
            ) : showTestEmbed ? (
              <div className="space-y-2.5">
                <div className="relative aspect-video w-full rounded-xl overflow-hidden bg-black border border-white/15">
                  <iframe
                    src={embedUrl}
                    title="Admin Stream Preview"
                    className="absolute inset-0 w-full h-full border-0"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                    allowFullScreen
                    referrerPolicy="strict-origin-when-cross-origin"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => setShowTestEmbed(false)}
                  className="w-full py-2 min-h-[38px] rounded-xl text-xs font-bold text-slate-300 hover:text-white bg-white/[0.05] hover:bg-white/10 border border-white/10 transition-colors cursor-pointer"
                >
                  Stop Preview Player
                </button>
              </div>
            ) : (
              <div className="relative aspect-video w-full rounded-xl overflow-hidden bg-slate-950 border border-white/15 group">
                {thumbUrl && (
                  <img
                    src={thumbUrl}
                    alt="YouTube Stream Thumbnail Preview"
                    className="w-full h-full object-cover opacity-60 group-hover:opacity-75 transition-opacity"
                  />
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/40 to-black/20 flex flex-col items-center justify-center p-4 text-center gap-3">
                  <button
                    type="button"
                    onClick={() => setShowTestEmbed(true)}
                    className="inline-flex items-center gap-2 px-4 py-2.5 min-h-[44px] rounded-xl text-xs font-black uppercase tracking-wider text-white bg-red-600 hover:bg-red-500 shadow-lg shadow-red-600/35 transition-all cursor-pointer"
                  >
                    <Play className="w-4 h-4 fill-current" />
                    <span>Load Test Embed</span>
                  </button>
                  <p className="text-[11px] text-slate-300 max-w-xs">
                    Verify the YouTube channel allows website embedding before publishing to spectators.
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
