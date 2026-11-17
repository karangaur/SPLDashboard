import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Check,
  CheckCircle2,
  Eye,
  History,
  Laptop,
  Loader2,
  Lock,
  Palette,
  RotateCcw,
  Save,
  Send,
  Smartphone,
  Sparkles,
  Tablet,
  Type,
} from 'lucide-react';
import {
  HeroConfig,
  HeroVersionRecord,
  SeasonBrandingConfig,
  SeasonGradientDirection,
  TournamentSeason,
} from '../../types/tournament';
import { useTournament } from '../../context/TournamentContext';
import { AuthService } from '../../services/authService';
import {
  applySeasonDesignPreset,
  buildSeasonInitialHeroConfig,
  cloneHeroConfig,
  DEFAULT_HERO_VERSION_COLOR,
  DEFAULT_SEASON_BRANDING,
  normalizeHeroConfig,
  sanitizeHexColor,
  SEASON_DESIGN_PRESETS,
} from '../../utils/heroDefaults';
import { HeroSectionCanvas } from '../home/HeroSectionCanvas';

interface SeasonDesignStudioProps {
  initialSeasonSlug?: string;
}

interface HexColorFieldProps {
  id: string;
  label: string;
  value: string;
  disabled?: boolean;
  onChange: (validHex: string) => void;
}

const HexColorField: React.FC<HexColorFieldProps> = ({
  id,
  label,
  value,
  disabled,
  onChange,
}) => {
  const [textVal, setTextVal] = useState(value);

  useEffect(() => {
    setTextVal(value);
  }, [value]);

  const handleTextChange = (raw: string) => {
    setTextVal(raw);
    const trimmed = raw.trim();
    const withHash = trimmed.startsWith('#') ? trimmed : `#${trimmed}`;
    const valid = sanitizeHexColor(withHash, '');
    if (valid) onChange(valid);
  };

  return (
    <div className="space-y-1">
      <label htmlFor={id} className="block text-[11px] font-semibold text-slate-300">
        {label}
      </label>
      <div className="flex items-center gap-2 rounded-xl border border-white/15 bg-slate-900 px-2.5 py-1.5 min-h-[42px]">
        <input
          type="color"
          aria-label={`${label} picker`}
          disabled={disabled}
          value={sanitizeHexColor(value, '#fbbf24')}
          onChange={(e) => {
            setTextVal(e.target.value);
            onChange(e.target.value);
          }}
          className="h-7 w-7 shrink-0 rounded border-0 bg-transparent p-0 cursor-pointer disabled:opacity-50"
        />
        <input
          id={id}
          type="text"
          maxLength={7}
          disabled={disabled}
          value={textVal}
          onChange={(e) => handleTextChange(e.target.value)}
          onBlur={() => setTextVal(value)}
          className="w-full min-w-0 bg-transparent text-xs font-mono uppercase text-white focus:outline-none disabled:opacity-50"
          placeholder="#fbbf24"
        />
      </div>
    </div>
  );
};

export const SeasonDesignStudio: React.FC<SeasonDesignStudioProps> = ({ initialSeasonSlug }) => {
  const {
    activeSeason,
    seasons,
    state,
    seasonSummaries,
    isRegistrationOpen,
    fetchHeroStateForSeason,
    saveHeroDraftForSeason,
    publishHeroConfigForSeason,
    restoreHeroVersionForSeason,
  } = useTournament();

  const [selectedSlug, setSelectedSlug] = useState<string>(
    () => initialSeasonSlug || activeSeason.seasonSlug
  );

  useEffect(() => {
    if (initialSeasonSlug && seasons.some((s) => s.seasonSlug === initialSeasonSlug)) {
      setSelectedSlug(initialSeasonSlug);
    }
  }, [initialSeasonSlug, seasons]);

  const targetSeason: TournamentSeason = useMemo(
    () => seasons.find((s) => s.seasonSlug === selectedSlug) || activeSeason,
    [seasons, selectedSlug, activeSeason]
  );

  const isLocked = Boolean(targetSeason.isLocked || targetSeason.status === 'archived');
  const canEdit = AuthService.canManageTournament() && !isLocked;

  const [draftConfig, setDraftConfig] = useState<HeroConfig>(() =>
    buildSeasonInitialHeroConfig(targetSeason)
  );
  const [livePublished, setLivePublished] = useState<HeroConfig>(() =>
    buildSeasonInitialHeroConfig(targetSeason)
  );
  const [versions, setVersions] = useState<HeroVersionRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSavingDraft, setIsSavingDraft] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);
  const [restoringId, setRestoringId] = useState<string | null>(null);
  const [previewSource, setPreviewSource] = useState<'draft' | 'published'>('draft');
  const [previewViewport, setPreviewViewport] = useState<'desktop' | 'tablet' | 'mobile'>('desktop');
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);

  const showToast = (type: 'success' | 'error' | 'info', text: string) => {
    setFeedback({ type, text });
    window.setTimeout(() => {
      setFeedback((curr) => (curr?.text === text ? null : curr));
    }, 5500);
  };

  const loadTargetHeroState = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await fetchHeroStateForSeason(targetSeason.seasonSlug);
      setLivePublished(cloneHeroConfig(res.published));
      setDraftConfig(cloneHeroConfig(res.draft));
      setVersions(res.versions || []);
    } catch {
      const fallback = buildSeasonInitialHeroConfig(targetSeason);
      setLivePublished(cloneHeroConfig(fallback));
      setDraftConfig(cloneHeroConfig({ ...fallback, status: 'draft' }));
      setVersions([]);
    } finally {
      setIsLoading(false);
    }
  }, [fetchHeroStateForSeason, targetSeason]);

  useEffect(() => {
    void loadTargetHeroState();
  }, [loadTargetHeroState]);

  const sb: SeasonBrandingConfig = draftConfig.seasonBranding || DEFAULT_SEASON_BRANDING;

  const updateSeasonBranding = (patch: Partial<SeasonBrandingConfig>, markCustom = true) => {
    setDraftConfig((prev) => {
      const curSb = prev.seasonBranding || DEFAULT_SEASON_BRANDING;
      const nextSb: SeasonBrandingConfig = {
        ...curSb,
        ...patch,
        presetId: patch.presetId ?? (markCustom ? 'custom' : curSb.presetId),
      };
      return {
        ...prev,
        text: {
          ...prev.text,
          versionColor: nextSb.textColor || prev.text.versionColor || DEFAULT_HERO_VERSION_COLOR,
          kickerColor: nextSb.editionColor || prev.text.kickerColor,
        },
        seasonBranding: nextSb,
      };
    });
    setPreviewSource('draft');
  };

  const hasUnpublishedChanges = useMemo(() => {
    const strip = (c: HeroConfig) => ({
      text: c.text,
      seasonBranding: c.seasonBranding,
      logo: c.logo,
      theme: c.theme,
      background: c.background,
    });
    return JSON.stringify(strip(draftConfig)) !== JSON.stringify(strip(livePublished));
  }, [draftConfig, livePublished]);

  const handleSaveDraft = async () => {
    if (!canEdit) return;
    setIsSavingDraft(true);
    const res = await saveHeroDraftForSeason(draftConfig, targetSeason.seasonSlug);
    setIsSavingDraft(false);
    if (res.success && res.draft) {
      setDraftConfig(cloneHeroConfig(res.draft));
      showToast(
        'info',
        `Saved SPL ${targetSeason.seasonNumber} design draft. Public website remains unchanged until you Save & Publish.`
      );
    } else {
      showToast('error', res.error || 'Failed to save design draft.');
    }
  };

  const handlePublish = async () => {
    if (!canEdit) return;
    setIsPublishing(true);
    const presetLabel = sb.presetId === 'custom' ? 'Custom Design' : sb.presetId;
    const res = await publishHeroConfigForSeason(
      draftConfig,
      `SPL ${targetSeason.seasonNumber} Design Studio (${presetLabel})`,
      'publish',
      targetSeason.seasonSlug
    );
    setIsPublishing(false);
    if (res.success && res.published) {
      setLivePublished(cloneHeroConfig(res.published));
      setDraftConfig(cloneHeroConfig({ ...res.published, status: 'draft' }));
      if (res.version) {
        setVersions((prev) => [res.version!, ...prev.filter((v) => v.id !== res.version!.id)]);
      }
      showToast(
        'success',
        `Published SPL ${targetSeason.seasonNumber} (${targetSeason.editionName}) design! Synced across live views.`
      );
    } else {
      showToast('error', res.error || 'Failed to publish season design.');
    }
  };

  const handleResetToDefault = () => {
    const resetCfg = applySeasonDesignPreset(draftConfig, 'spl-3-original');
    setDraftConfig(resetCfg);
    setPreviewSource('draft');
    showToast('info', 'Reset draft branding to SPL 3.0 Original defaults. Save Draft or Save & Publish to persist.');
  };

  const handleRestoreVersion = async (ver: HeroVersionRecord) => {
    if (!canEdit) return;
    setRestoringId(ver.id);
    const res = await restoreHeroVersionForSeason(ver, targetSeason.seasonSlug);
    setRestoringId(null);
    if (res.success && res.published) {
      setLivePublished(cloneHeroConfig(res.published));
      setDraftConfig(cloneHeroConfig({ ...res.published, status: 'draft' }));
      if (res.version) {
        setVersions((prev) => [res.version!, ...prev.filter((v) => v.id !== res.version!.id)]);
      }
      showToast('success', `Restored v${ver.versionNum} and published live as v${res.published.version}.`);
    } else {
      showToast('error', res.error || 'Failed to restore previous design.');
    }
  };

  const targetSummary = seasonSummaries[targetSeason.seasonSlug];
  const previewConfig = previewSource === 'published' ? livePublished : draftConfig;
  const previewLiveCount =
    targetSeason.seasonSlug === activeSeason.seasonSlug
      ? state.matches.filter((m) => m.status === 'live').length +
        state.knockout.matches.filter((k) => k.status === 'live').length
      : targetSummary?.liveMatchesCount || 0;
  const previewTeamsCount =
    targetSeason.seasonSlug === activeSeason.seasonSlug
      ? state.teams.length
      : targetSummary?.teamsCount || 0;

  return (
    <div className="space-y-6">
      {/* Studio Top Bar */}
      <div className="rounded-2xl border border-white/10 bg-[#0d1424] p-4 sm:p-5 space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="space-y-1 min-w-0">
            <div className="flex items-center gap-2.5 flex-wrap">
              <Palette className="w-5 h-5 text-amber-400 shrink-0" />
              <h2 className="text-lg sm:text-xl font-display font-black tracking-tight text-white">
                Season Branding & Design Studio
              </h2>
              <span className="text-xs font-mono font-semibold text-amber-300 tabular-nums">
                v{livePublished.version || 1}
              </span>
              {hasUnpublishedChanges && (
                <span className="text-xs font-semibold text-sky-300">
                  · Unsaved / Draft Changes
                </span>
              )}
            </div>
            <p className="text-xs sm:text-sm text-slate-400">
              Customize season number styling, gradients, neon glow, outline, typography, and edition badges per season.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 shrink-0">
            <div className="min-w-[210px]">
              <label htmlFor="design-studio-season-select" className="sr-only">
                Select Season to Customize
              </label>
              <select
                id="design-studio-season-select"
                value={targetSeason.seasonSlug}
                onChange={(e) => setSelectedSlug(e.target.value)}
                className="w-full min-h-[44px] rounded-xl border border-white/15 bg-slate-900 px-3 py-2 text-xs font-semibold text-white focus:outline-none focus:border-amber-400"
              >
                {seasons.map((s) => (
                  <option key={s.seasonSlug} value={s.seasonSlug}>
                    SPL {s.seasonNumber} · {s.editionName} ({s.isActive ? 'ACTIVE' : s.status.toUpperCase()})
                  </option>
                ))}
              </select>
            </div>

            <button
              type="button"
              onClick={handleResetToDefault}
              disabled={!canEdit || isLoading}
              className="inline-flex items-center gap-1.5 px-3.5 py-2.5 min-h-[44px] rounded-xl text-xs font-semibold text-slate-300 hover:text-white bg-white/5 hover:bg-white/10 border border-white/10 transition-colors disabled:opacity-50 cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Reset to Default</span>
            </button>

            <button
              type="button"
              onClick={() => void handleSaveDraft()}
              disabled={!canEdit || isLoading || isSavingDraft}
              className="inline-flex items-center gap-1.5 px-4 py-2.5 min-h-[44px] rounded-xl text-xs font-bold text-slate-100 bg-slate-800 hover:bg-slate-700 border border-white/15 transition-colors disabled:opacity-50 cursor-pointer"
            >
              {isSavingDraft ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5 text-sky-400" />}
              <span>{isSavingDraft ? 'Saving...' : 'Save Draft'}</span>
            </button>

            <button
              type="button"
              onClick={() => void handlePublish()}
              disabled={!canEdit || isLoading || isPublishing}
              className="inline-flex items-center gap-2 px-5 py-2.5 min-h-[44px] rounded-xl text-xs sm:text-sm font-black uppercase tracking-wider text-slate-950 bg-gradient-to-r from-amber-300 via-amber-400 to-orange-500 hover:from-amber-200 hover:to-orange-400 shadow-lg shadow-amber-500/20 transition-all disabled:opacity-50 cursor-pointer"
            >
              {isPublishing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              <span>{isPublishing ? 'Publishing...' : 'Save & Publish'}</span>
            </button>
          </div>
        </div>

        {isLocked && (
          <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 px-4 py-2.5 text-xs text-amber-200 flex items-center gap-2">
            <Lock className="w-4 h-4 shrink-0" />
            <span>
              <strong>SPL {targetSeason.seasonNumber} is Archived:</strong> Historical designs are read-only to preserve completed tournament records.
            </span>
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

      {/* Main Split Studio */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
        {/* LEFT COLUMN: Controls */}
        <div className="xl:col-span-5 space-y-5">
          {isLoading ? (
            <div className="rounded-2xl border border-white/10 bg-[#0d1424] py-14 flex flex-col items-center justify-center gap-3 text-slate-400 text-sm">
              <Loader2 className="w-6 h-6 animate-spin text-amber-400" />
              <span>Loading SPL {targetSeason.seasonNumber} design profile...</span>
            </div>
          ) : (
            <>
              {/* 1. Theme Presets */}
              <div className="rounded-2xl border border-white/10 bg-[#0d1424] p-4 sm:p-5 space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-amber-400" />
                    <h3 className="text-sm font-display font-bold text-white">Season Theme Presets</h3>
                  </div>
                  <span className="text-[11px] font-mono text-slate-400 uppercase">
                    {sb.presetId === 'custom' ? 'Custom Design' : sb.presetId}
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {SEASON_DESIGN_PRESETS.map((preset) => {
                    const active = sb.presetId === preset.id;
                    return (
                      <button
                        key={preset.id}
                        type="button"
                        disabled={!canEdit}
                        onClick={() => {
                          setDraftConfig((prev) => applySeasonDesignPreset(prev, preset.id));
                          setPreviewSource('draft');
                        }}
                        className={`text-left p-3 min-h-[44px] rounded-xl border transition-colors cursor-pointer disabled:opacity-50 ${
                          active
                            ? 'border-amber-400 bg-amber-400/10'
                            : 'border-white/10 bg-white/[0.02] hover:bg-white/[0.05]'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-xs font-bold text-white">{preset.name}</span>
                          <div className="flex items-center gap-1">
                            <span
                              className="w-4 h-4 rounded-full border border-white/20"
                              style={{
                                background: `linear-gradient(135deg, ${preset.branding.primaryGradientColor}, ${preset.branding.secondaryGradientColor})`,
                              }}
                            />
                            {active && <Check className="w-3.5 h-3.5 text-amber-400" />}
                          </div>
                        </div>
                        <p className="text-[11px] text-slate-400 mt-1 line-clamp-2">{preset.description}</p>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* 2. Season Number Customization */}
              <div className="rounded-2xl border border-white/10 bg-[#0d1424] p-4 sm:p-5 space-y-4">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Type className="w-4 h-4 text-amber-400" />
                    <h3 className="text-sm font-display font-bold text-white">
                      Season Number Branding (“{targetSeason.seasonNumber}”)
                    </h3>
                  </div>
                  <div className="inline-flex rounded-lg border border-white/10 bg-slate-900 p-0.5 text-[11px] font-semibold">
                    <button
                      type="button"
                      disabled={!canEdit}
                      onClick={() => updateSeasonBranding({ useGradient: false })}
                      className={`px-2.5 py-1 rounded-md cursor-pointer ${
                        !sb.useGradient ? 'bg-amber-400 text-slate-950 font-bold' : 'text-slate-300'
                      }`}
                    >
                      Solid Color
                    </button>
                    <button
                      type="button"
                      disabled={!canEdit}
                      onClick={() => updateSeasonBranding({ useGradient: true })}
                      className={`px-2.5 py-1 rounded-md cursor-pointer ${
                        sb.useGradient ? 'bg-amber-400 text-slate-950 font-bold' : 'text-slate-300'
                      }`}
                    >
                      Gradient
                    </button>
                  </div>
                </div>

                {!sb.useGradient ? (
                  <HexColorField
                    id="studio-season-solid-hex"
                    label="Season Number Color"
                    value={sb.textColor}
                    disabled={!canEdit}
                    onChange={(hex) => updateSeasonBranding({ textColor: hex })}
                  />
                ) : (
                  <div className="space-y-3">
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                      <HexColorField
                        id="studio-grad-primary"
                        label="Gradient Start"
                        value={sb.primaryGradientColor}
                        disabled={!canEdit}
                        onChange={(hex) => updateSeasonBranding({ primaryGradientColor: hex })}
                      />
                      <HexColorField
                        id="studio-grad-mid"
                        label="Gradient Mid"
                        value={sb.midGradientColor}
                        disabled={!canEdit}
                        onChange={(hex) => updateSeasonBranding({ midGradientColor: hex })}
                      />
                      <HexColorField
                        id="studio-grad-end"
                        label="Gradient End"
                        value={sb.secondaryGradientColor}
                        disabled={!canEdit}
                        onChange={(hex) => updateSeasonBranding({ secondaryGradientColor: hex })}
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                        Gradient Direction
                      </label>
                      <select
                        disabled={!canEdit}
                        value={sb.gradientDirection}
                        onChange={(e) =>
                          updateSeasonBranding({
                            gradientDirection: e.target.value as SeasonGradientDirection,
                          })
                        }
                        className="w-full min-h-[42px] rounded-xl bg-slate-900 border border-white/15 px-3 py-2 text-xs text-white"
                      >
                        <option value="to-r">Horizontal Sweep (Left → Right)</option>
                        <option value="to-br">Diagonal Arena Sweep</option>
                        <option value="to-b">Vertical Broadcast Fade</option>
                        <option value="to-l">Reverse Horizontal Sweep</option>
                      </select>
                    </div>
                  </div>
                )}

                {/* Font Size, Weight, Letter Spacing */}
                <div className="grid grid-cols-2 gap-3 border-t border-white/10 pt-3">
                  <div>
                    <label className="flex justify-between text-[11px] font-semibold text-slate-300 mb-1">
                      <span>Desktop Size</span>
                      <span className="font-mono tabular-nums">{sb.fontSizeDesktop}px</span>
                    </label>
                    <input
                      type="range"
                      min={28}
                      max={120}
                      disabled={!canEdit}
                      value={sb.fontSizeDesktop}
                      onChange={(e) =>
                        updateSeasonBranding({ fontSizeDesktop: Number(e.target.value) })
                      }
                      className="w-full accent-amber-400"
                    />
                  </div>
                  <div>
                    <label className="flex justify-between text-[11px] font-semibold text-slate-300 mb-1">
                      <span>Mobile Size</span>
                      <span className="font-mono tabular-nums">{sb.fontSizeMobile}px</span>
                    </label>
                    <input
                      type="range"
                      min={20}
                      max={72}
                      disabled={!canEdit}
                      value={sb.fontSizeMobile}
                      onChange={(e) =>
                        updateSeasonBranding({ fontSizeMobile: Number(e.target.value) })
                      }
                      className="w-full accent-amber-400"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                      Font Weight
                    </label>
                    <select
                      disabled={!canEdit}
                      value={sb.fontWeight}
                      onChange={(e) =>
                        updateSeasonBranding({ fontWeight: e.target.value as SeasonBrandingConfig['fontWeight'] })
                      }
                      className="w-full min-h-[40px] rounded-xl bg-slate-900 border border-white/15 px-2.5 py-1.5 text-xs text-white"
                    >
                      <option value="500">Medium (500)</option>
                      <option value="600">Semibold (600)</option>
                      <option value="700">Bold (700)</option>
                      <option value="800">Extrabold (800)</option>
                      <option value="900">Black (900)</option>
                    </select>
                  </div>
                  <div>
                    <label className="flex justify-between text-[11px] font-semibold text-slate-300 mb-1">
                      <span>Letter Spacing</span>
                      <span className="font-mono tabular-nums">{sb.letterSpacing}px</span>
                    </label>
                    <input
                      type="range"
                      min={-4}
                      max={16}
                      step={1}
                      disabled={!canEdit}
                      value={sb.letterSpacing}
                      onChange={(e) =>
                        updateSeasonBranding({ letterSpacing: Number(e.target.value) })
                      }
                      className="w-full accent-amber-400 mt-1.5"
                    />
                  </div>
                </div>

                {/* Shadow, Glow & Outline */}
                <div className="space-y-3 border-t border-white/10 pt-3">
                  <div className="grid grid-cols-2 gap-3 items-center">
                    <label className="flex items-center justify-between gap-2 p-2.5 min-h-[42px] rounded-xl bg-white/[0.02] border border-white/10 text-xs text-slate-200 cursor-pointer">
                      <span>Text Shadow</span>
                      <input
                        type="checkbox"
                        disabled={!canEdit}
                        checked={sb.textShadowEnabled}
                        onChange={(e) => updateSeasonBranding({ textShadowEnabled: e.target.checked })}
                        className="accent-amber-400 h-4 w-4"
                      />
                    </label>
                    <div>
                      <label className="flex justify-between text-[11px] text-slate-300 mb-1">
                        <span>Shadow Blur</span>
                        <span className="font-mono tabular-nums">{sb.textShadowBlur}px</span>
                      </label>
                      <input
                        type="range"
                        min={0}
                        max={32}
                        disabled={!canEdit || !sb.textShadowEnabled}
                        value={sb.textShadowBlur}
                        onChange={(e) => updateSeasonBranding({ textShadowBlur: Number(e.target.value) })}
                        className="w-full accent-amber-400"
                      />
                    </div>
                  </div>

                  <div className="space-y-2.5 rounded-xl border border-white/10 bg-white/[0.02] p-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-white">Arena Glow Effect</span>
                      <label className="inline-flex items-center gap-2 text-xs text-slate-300 cursor-pointer">
                        <input
                          type="checkbox"
                          disabled={!canEdit}
                          checked={sb.glowEnabled}
                          onChange={(e) => updateSeasonBranding({ glowEnabled: e.target.checked })}
                          className="accent-amber-400 h-4 w-4"
                        />
                        <span>Enable Glow</span>
                      </label>
                    </div>
                    {sb.glowEnabled && (
                      <div className="grid grid-cols-2 gap-3 items-end">
                        <HexColorField
                          id="studio-glow-color"
                          label="Glow Color"
                          value={sb.glowColor}
                          disabled={!canEdit}
                          onChange={(hex) => updateSeasonBranding({ glowColor: hex })}
                        />
                        <div>
                          <label className="flex justify-between text-[11px] font-semibold text-slate-300 mb-1">
                            <span>Glow Intensity</span>
                            <span className="font-mono tabular-nums">{sb.glowIntensity}%</span>
                          </label>
                          <input
                            type="range"
                            min={10}
                            max={100}
                            disabled={!canEdit}
                            value={sb.glowIntensity}
                            onChange={(e) => updateSeasonBranding({ glowIntensity: Number(e.target.value) })}
                            className="w-full accent-amber-400 mb-2"
                          />
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-3 items-end">
                    <HexColorField
                      id="studio-outline-color"
                      label="Outline Color"
                      value={sb.outlineColor}
                      disabled={!canEdit}
                      onChange={(hex) => updateSeasonBranding({ outlineColor: hex })}
                    />
                    <div>
                      <label className="flex justify-between text-[11px] font-semibold text-slate-300 mb-1">
                        <span>Outline Thickness</span>
                        <span className="font-mono tabular-nums">{sb.outlineThickness}px</span>
                      </label>
                      <input
                        type="range"
                        min={0}
                        max={4}
                        step={0.5}
                        disabled={!canEdit}
                        value={sb.outlineThickness}
                        onChange={(e) => updateSeasonBranding({ outlineThickness: Number(e.target.value) })}
                        className="w-full accent-amber-400 mb-2"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* 3. Edition Branding Customization */}
              <div className="rounded-2xl border border-white/10 bg-[#0d1424] p-4 sm:p-5 space-y-4">
                <div className="flex items-center justify-between gap-2">
                  <h3 className="text-sm font-display font-bold text-white">Edition Branding</h3>
                  <label className="inline-flex items-center gap-1.5 text-xs text-slate-300 cursor-pointer">
                    <input
                      type="checkbox"
                      disabled={!canEdit}
                      checked={draftConfig.text.kickerVisible}
                      onChange={(e) =>
                        setDraftConfig((prev) => ({
                          ...prev,
                          text: { ...prev.text, kickerVisible: e.target.checked },
                        }))
                      }
                      className="accent-amber-400 h-4 w-4"
                    />
                    <span>Show Edition Label</span>
                  </label>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                    Edition Kicker Text
                  </label>
                  <input
                    type="text"
                    maxLength={64}
                    disabled={!canEdit}
                    value={draftConfig.text.kickerText}
                    onChange={(e) => {
                      const val = e.target.value;
                      setDraftConfig((prev) => ({
                        ...prev,
                        text: { ...prev.text, kickerText: val },
                      }));
                      setPreviewSource('draft');
                    }}
                    className="w-full min-h-[42px] rounded-xl bg-slate-900 border border-white/15 px-3 py-2 text-xs text-white"
                    placeholder={targetSeason.editionName.toUpperCase()}
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <HexColorField
                    id="studio-edition-color"
                    label="Edition Text Color"
                    value={sb.editionColor}
                    disabled={!canEdit}
                    onChange={(hex) => updateSeasonBranding({ editionColor: hex })}
                  />
                  <HexColorField
                    id="studio-edition-bg"
                    label="Badge Fill Color"
                    value={sb.editionBadgeBg}
                    disabled={!canEdit}
                    onChange={(hex) => updateSeasonBranding({ editionBadgeBg: hex })}
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-end">
                  <div>
                    <label className="flex justify-between text-[11px] font-semibold text-slate-300 mb-1">
                      <span>Badge Background Opacity</span>
                      <span className="font-mono tabular-nums">{sb.editionBadgeBgOpacity}%</span>
                    </label>
                    <input
                      type="range"
                      min={0}
                      max={100}
                      disabled={!canEdit}
                      value={sb.editionBadgeBgOpacity}
                      onChange={(e) =>
                        updateSeasonBranding({ editionBadgeBgOpacity: Number(e.target.value) })
                      }
                      className="w-full accent-amber-400 mb-2"
                    />
                  </div>
                  <HexColorField
                    id="studio-edition-border"
                    label="Badge Border Color"
                    value={sb.editionBadgeBorderColor}
                    disabled={!canEdit || sb.editionBadgeBgOpacity === 0}
                    onChange={(hex) => updateSeasonBranding({ editionBadgeBorderColor: hex })}
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                      Edition Weight
                    </label>
                    <select
                      disabled={!canEdit}
                      value={sb.editionTextWeight}
                      onChange={(e) =>
                        updateSeasonBranding({
                          editionTextWeight: e.target.value as SeasonBrandingConfig['editionTextWeight'],
                        })
                      }
                      className="w-full min-h-[40px] rounded-xl bg-slate-900 border border-white/15 px-2.5 py-1.5 text-xs text-white"
                    >
                      <option value="600">Semibold (600)</option>
                      <option value="700">Bold (700)</option>
                      <option value="800">Extrabold (800)</option>
                      <option value="900">Black (900)</option>
                    </select>
                  </div>
                  <div>
                    <label className="flex justify-between text-[11px] font-semibold text-slate-300 mb-1">
                      <span>Tracking</span>
                      <span className="font-mono tabular-nums">{sb.editionLetterSpacing.toFixed(2)}em</span>
                    </label>
                    <input
                      type="range"
                      min={0.04}
                      max={0.4}
                      step={0.02}
                      disabled={!canEdit}
                      value={sb.editionLetterSpacing}
                      onChange={(e) =>
                        updateSeasonBranding({ editionLetterSpacing: Number(e.target.value) })
                      }
                      className="w-full accent-amber-400 mt-1.5"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <label className="flex items-center justify-between p-2.5 min-h-[42px] rounded-xl bg-white/[0.02] border border-white/10 text-xs text-slate-200 cursor-pointer">
                    <span>Uppercase</span>
                    <input
                      type="checkbox"
                      disabled={!canEdit}
                      checked={sb.editionUppercase}
                      onChange={(e) => updateSeasonBranding({ editionUppercase: e.target.checked })}
                      className="accent-amber-400 h-4 w-4"
                    />
                  </label>
                  <label className="flex items-center justify-between p-2.5 min-h-[42px] rounded-xl bg-white/[0.02] border border-white/10 text-xs text-slate-200 cursor-pointer">
                    <span>Italic Style</span>
                    <input
                      type="checkbox"
                      disabled={!canEdit}
                      checked={sb.editionItalic}
                      onChange={(e) => updateSeasonBranding({ editionItalic: e.target.checked })}
                      className="accent-amber-400 h-4 w-4"
                    />
                  </label>
                </div>
              </div>

              {/* 4. Version History / Restore Previous Design */}
              <div className="rounded-2xl border border-white/10 bg-[#0d1424] p-4 sm:p-5 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <History className="w-4 h-4 text-amber-400" />
                    <h3 className="text-sm font-display font-bold text-white">
                      Design History ({versions.length})
                    </h3>
                  </div>
                </div>
                {versions.length === 0 ? (
                  <p className="text-xs text-slate-400">
                    No published design versions recorded for SPL {targetSeason.seasonNumber} yet. Saving & publishing creates restorable snapshots.
                  </p>
                ) : (
                  <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                    {versions.map((ver) => (
                      <div
                        key={ver.id}
                        className="rounded-xl border border-white/10 bg-white/[0.02] p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2"
                      >
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-mono font-bold text-amber-300 tabular-nums">
                              v{ver.versionNum}
                            </span>
                            <span className="text-[11px] text-slate-400 truncate">{ver.summary}</span>
                          </div>
                          <span className="text-[10px] font-mono text-slate-500 tabular-nums">
                            {new Date(ver.createdAt).toLocaleString()}
                          </span>
                        </div>
                        <button
                          type="button"
                          disabled={!canEdit || restoringId === ver.id}
                          onClick={() => void handleRestoreVersion(ver)}
                          className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 min-h-[36px] rounded-lg text-xs font-bold text-slate-950 bg-amber-400 hover:bg-amber-300 disabled:opacity-50 shrink-0 cursor-pointer"
                        >
                          {restoringId === ver.id ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <RotateCcw className="w-3.5 h-3.5" />
                          )}
                          <span>Restore Previous Design</span>
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        {/* RIGHT COLUMN: Real-Time Preview */}
        <div className="xl:col-span-7 xl:sticky xl:top-20 rounded-2xl border border-white/10 bg-[#0d1424] overflow-hidden">
          <div className="border-b border-white/10 px-4 py-3 flex flex-wrap items-center justify-between gap-3 bg-slate-950/60">
            <div className="flex items-center gap-2">
              <Eye className="w-4 h-4 text-amber-400 shrink-0" />
              <span className="text-xs sm:text-sm font-display font-bold text-white">
                SPL {targetSeason.seasonNumber} Live Hero Preview
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <div className="inline-flex rounded-lg border border-white/10 bg-slate-900 p-0.5 text-[11px] font-semibold">
                <button
                  type="button"
                  onClick={() => setPreviewSource('draft')}
                  className={`px-2.5 py-1 rounded-md cursor-pointer ${
                    previewSource === 'draft' ? 'bg-amber-400 text-slate-950 font-bold' : 'text-slate-300 hover:text-white'
                  }`}
                >
                  Draft Preview
                </button>
                <button
                  type="button"
                  onClick={() => setPreviewSource('published')}
                  className={`px-2.5 py-1 rounded-md cursor-pointer ${
                    previewSource === 'published' ? 'bg-emerald-400 text-slate-950 font-bold' : 'text-slate-300 hover:text-white'
                  }`}
                >
                  Live Published
                </button>
              </div>

              <div className="inline-flex rounded-lg border border-white/10 bg-slate-900 p-0.5">
                {([
                  { id: 'desktop', icon: <Laptop className="w-3.5 h-3.5" />, label: 'Desktop' },
                  { id: 'tablet', icon: <Tablet className="w-3.5 h-3.5" />, label: 'Tablet' },
                  { id: 'mobile', icon: <Smartphone className="w-3.5 h-3.5" />, label: 'Mobile' },
                ] as const).map((vp) => (
                  <button
                    key={vp.id}
                    type="button"
                    onClick={() => setPreviewViewport(vp.id)}
                    aria-label={`${vp.label} preview`}
                    className={`p-1.5 rounded-md cursor-pointer ${
                      previewViewport === vp.id ? 'bg-white/15 text-amber-300' : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    {vp.icon}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="p-3 sm:p-4 bg-[#05070e] overflow-x-auto">
            <div
              className={`mx-auto rounded-xl border border-white/10 overflow-hidden transition-all duration-300 bg-[#04060e] ${
                previewViewport === 'mobile'
                  ? 'max-w-[390px]'
                  : previewViewport === 'tablet'
                    ? 'max-w-[768px]'
                    : 'w-full'
              }`}
            >
              <HeroSectionCanvas
                heroConfig={normalizeHeroConfig(previewConfig)}
                isRegistrationOpen={isRegistrationOpen}
                tournamentName={targetSeason.leagueName || 'Smash Premier League'}
                seasonNumber={targetSeason.seasonNumber}
                editionName={targetSeason.editionName}
                organizerLabel={targetSeason.organizer || 'SPL Tournament Committee'}
                venueLabel={targetSeason.venue || 'Maharajganj Indoor Badminton Stadium'}
                announcementText={targetSeason.announcement || ''}
                currentTournamentStage={targetSeason.isActive ? 'Active Season' : targetSeason.status.toUpperCase()}
                teamsCount={previewTeamsCount}
                liveMatchesCount={previewLiveCount}
                onOpenPublicRegister={() => showToast('info', 'Preview action: Opens Public Registration Page.')}
                onScrollToSection={(sec) => showToast('info', `Preview action: Scrolls to #${sec}.`)}
                isPreviewMode
                previewViewport={previewViewport}
                onPreviewActionNotice={(msg) => showToast('info', `Preview action: ${msg}`)}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
