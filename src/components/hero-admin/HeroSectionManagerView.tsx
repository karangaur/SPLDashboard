import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowDown,
  ArrowUp,
  Check,
  CheckCircle2,
  Eye,
  Film,
  History,
  Image as ImageIcon,
  Layers,
  Laptop,
  Loader2,
  Lock,
  Maximize2,
  Minimize2,
  MousePointerClick,
  Palette,
  RefreshCw,
  RotateCcw,
  Save,
  Send,
  ShieldAlert,
  Smartphone,
  Sparkles,
  Tablet,
  Type,
  Upload,
} from 'lucide-react';
import {
  HeroAnimationPreset,
  HeroBackgroundFit,
  HeroButtonConfig,
  HeroButtonHoverEffect,
  HeroButtonStyle,
  HeroConfig,
  HeroFontFamily,
  HeroSectionHeight,
  HeroThemePresetId,
  HeroVersionRecord,
} from '../../types/tournament';
import { useTournament } from '../../context/TournamentContext';
import { AuthService } from '../../services/authService';
import { SupabaseService } from '../../services/supabaseService';
import {
  APPROVED_HERO_ACTION_TARGETS,
  cloneHeroConfig,
  DEFAULT_HERO_CONFIG,
  DEFAULT_HERO_VERSION_COLOR,
  HERO_ANIMATION_PRESETS,
  HERO_FONT_OPTIONS,
  HERO_THEME_PRESETS,
  normalizeHeroConfig,
  sanitizeHexColor,
  validateHeroActionDestination,
} from '../../utils/heroDefaults';
import { HeroSectionCanvas } from '../home/HeroSectionCanvas';

type EditorTab =
  | 'background'
  | 'logo'
  | 'text'
  | 'buttons'
  | 'theme'
  | 'animations'
  | 'versions';

export const HeroSectionManagerView: React.FC = () => {
  const {
    state,
    isRegistrationOpen,
    publishedHeroConfig,
    fetchAdminHeroState,
    saveHeroDraft,
    publishHeroConfig,
    saveHeroVersionColor,
    restoreHeroVersion,
  } = useTournament();

  const canManage = AuthService.canManageTournament();

  const [activeTab, setActiveTab] = useState<EditorTab>('background');
  const [draftConfig, setDraftConfig] = useState<HeroConfig>(() =>
    cloneHeroConfig({ ...publishedHeroConfig, status: 'draft' })
  );
  const [livePublished, setLivePublished] = useState<HeroConfig>(() =>
    cloneHeroConfig(publishedHeroConfig)
  );
  const [versions, setVersions] = useState<HeroVersionRecord[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isSavingDraft, setIsSavingDraft] = useState<boolean>(false);
  const [isPublishing, setIsPublishing] = useState<boolean>(false);
  const [restoringVersionId, setRestoringVersionId] = useState<string | null>(null);
  const [uploadingField, setUploadingField] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{
    type: 'success' | 'error' | 'info';
    text: string;
  } | null>(null);

  // Preview Controls
  const [previewViewport, setPreviewViewport] = useState<'desktop' | 'tablet' | 'mobile'>('desktop');
  const [previewSource, setPreviewSource] = useState<'draft' | 'published'>('draft');
  const [previewRegOpen, setPreviewRegOpen] = useState<boolean>(isRegistrationOpen);
  const [expandedPreview, setExpandedPreview] = useState<boolean>(false);
  const [confirmResetModal, setConfirmResetModal] = useState<boolean>(false);
  const [versionColorHex, setVersionColorHex] = useState<string>(
    () => publishedHeroConfig.text.versionColor || DEFAULT_HERO_VERSION_COLOR
  );
  const [isSavingVersionColor, setIsSavingVersionColor] = useState<boolean>(false);
  const [isResettingVersionColor, setIsResettingVersionColor] = useState<boolean>(false);

  const deskBgInputRef = useRef<HTMLInputElement | null>(null);
  const mobBgInputRef = useRef<HTMLInputElement | null>(null);
  const videoInputRef = useRef<HTMLInputElement | null>(null);
  const posterInputRef = useRef<HTMLInputElement | null>(null);
  const logoInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    setPreviewRegOpen(isRegistrationOpen);
  }, [isRegistrationOpen]);

  const loadHeroAdminState = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await fetchAdminHeroState();
      setLivePublished(cloneHeroConfig(res.published));
      setDraftConfig(cloneHeroConfig(res.draft));
      setVersions(res.versions || []);
    } catch {
      setLivePublished(cloneHeroConfig(publishedHeroConfig));
      setDraftConfig(cloneHeroConfig({ ...publishedHeroConfig, status: 'draft' }));
    } finally {
      setIsLoading(false);
    }
  }, [fetchAdminHeroState, publishedHeroConfig]);

  useEffect(() => {
    void loadHeroAdminState();
  }, [loadHeroAdminState]);

  useEffect(() => {
    setLivePublished(cloneHeroConfig(publishedHeroConfig));
  }, [publishedHeroConfig]);

  useEffect(() => {
    const nextColor = draftConfig.text.versionColor || DEFAULT_HERO_VERSION_COLOR;
    setVersionColorHex((curr) => {
      const normalizedCurr = curr.trim().startsWith('#') ? curr.trim() : `#${curr.trim()}`;
      return sanitizeHexColor(normalizedCurr, '') === nextColor ? curr : nextColor;
    });
  }, [draftConfig.text.versionColor]);

  const showToast = (type: 'success' | 'error' | 'info', text: string) => {
    setFeedback({ type, text });
    window.setTimeout(() => {
      setFeedback((curr) => (curr?.text === text ? null : curr));
    }, 5500);
  };

  // Detect unsaved changes comparing normalized draft vs live published (ignoring timestamps/status)
  const hasUnpublishedChanges = useMemo(() => {
    const stripMeta = (c: HeroConfig) => ({
      background: c.background,
      logo: c.logo,
      text: c.text,
      buttons: c.buttons,
      theme: c.theme,
      animations: c.animations,
    });
    return JSON.stringify(stripMeta(draftConfig)) !== JSON.stringify(stripMeta(livePublished));
  }, [draftConfig, livePublished]);

  // Helper telemetry derived from live state for accurate preview
  const liveMatchesCount = useMemo(
    () => state.matches.filter((m) => m.status === 'live').length + state.knockout.matches.filter((k) => k.status === 'live').length,
    [state.matches, state.knockout.matches]
  );

  // Handlers
  const handleMediaUpload = async (
    file: File | undefined,
    kind: 'logo' | 'image' | 'video',
    targetSlot: 'desktop-image' | 'mobile-image' | 'video' | 'video-poster' | 'logo'
  ) => {
    if (!file) return;
    setUploadingField(targetSlot);
    const res = await SupabaseService.uploadHeroMediaFile(file, kind);
    setUploadingField(null);

    if (!res.success || !res.url) {
      showToast('error', res.error || 'Failed to upload media asset.');
      return;
    }

    setDraftConfig((prev) => {
      const next = cloneHeroConfig(prev);
      if (targetSlot === 'desktop-image') {
        next.background.type = 'image';
        next.background.imageUrl = res.url!;
        next.background.imageStoragePath = res.storagePath || '';
      } else if (targetSlot === 'mobile-image') {
        next.background.type = 'image';
        next.background.mobileImageUrl = res.url!;
        next.background.mobileImageStoragePath = res.storagePath || '';
      } else if (targetSlot === 'video') {
        next.background.type = 'video';
        next.background.videoUrl = res.url!;
        next.background.videoStoragePath = res.storagePath || '';
      } else if (targetSlot === 'video-poster') {
        next.background.videoPosterUrl = res.url!;
        next.background.videoPosterStoragePath = res.storagePath || '';
      } else if (targetSlot === 'logo') {
        next.logo.customLogoUrl = res.url!;
        next.logo.customLogoStoragePath = res.storagePath || '';
        next.logo.customLogoMime = res.mimeType || '';
        next.logo.visible = true;
      }
      return next;
    });

    setPreviewSource('draft');
    showToast('success', `Uploaded ${file.name} (${(file.size / 1024).toFixed(0)} KB). Preview updated — publish when ready.`);
  };

  const handleSaveDraft = async () => {
    setIsSavingDraft(true);
    const res = await saveHeroDraft(draftConfig);
    setIsSavingDraft(false);
    if (res.success && res.draft) {
      setDraftConfig(cloneHeroConfig(res.draft));
      showToast('info', 'Draft saved privately. Live public homepage remains unchanged until you Publish.');
    } else {
      showToast('error', res.error || 'Could not save draft.');
    }
  };

  const handlePublish = async () => {
    // Validate custom button URLs before publish
    for (const btn of draftConfig.buttons.buttons) {
      if (btn.visible && btn.actionTarget === 'custom-url') {
        const check = validateHeroActionDestination(btn.actionTarget, btn.customUrl);
        if (!check.valid) {
          setActiveTab('buttons');
          showToast('error', `${btn.label}: ${check.error}`);
          return;
        }
      }
    }

    setIsPublishing(true);
    const res = await publishHeroConfig(
      draftConfig,
      `Published Hero customization (${draftConfig.theme.preset})`
    );
    setIsPublishing(false);

    if (res.success && res.published) {
      setLivePublished(cloneHeroConfig(res.published));
      setDraftConfig(cloneHeroConfig({ ...res.published, status: 'draft' }));
      if (res.version) {
        setVersions((prev) => [res.version!, ...prev.filter((v) => v.id !== res.version!.id)]);
      } else {
        void loadHeroAdminState();
      }
      showToast('success', `Published Version v${res.published.version} live to the Smash Premier League homepage!`);
    } else {
      showToast('error', res.error || 'Publish failed.');
    }
  };

  const normalizedHexInput = useMemo(() => {
    const trimmed = versionColorHex.trim();
    const withHash = trimmed.startsWith('#') ? trimmed : `#${trimmed}`;
    return sanitizeHexColor(withHash, '');
  }, [versionColorHex]);

  const handleVersionColorChange = (rawValue: string) => {
    setVersionColorHex(rawValue);
    const trimmed = rawValue.trim();
    const withHash = trimmed.startsWith('#') ? trimmed : `#${trimmed}`;
    const valid = sanitizeHexColor(withHash, '');
    if (valid) {
      setDraftConfig((prev) => ({
        ...prev,
        text: { ...prev.text, versionColor: valid },
      }));
      setPreviewSource('draft');
    }
  };

  const handleSaveVersionColor = async () => {
    if (!normalizedHexInput) {
      showToast('error', 'Please enter a valid HEX color (e.g. #fbbf24 or #ef4444) before saving.');
      return;
    }
    setIsSavingVersionColor(true);
    const res = await saveHeroVersionColor(normalizedHexInput);
    setIsSavingVersionColor(false);

    if (res.success && res.published) {
      const savedColor = res.published.text.versionColor || normalizedHexInput;
      setLivePublished(cloneHeroConfig(res.published));
      setDraftConfig((prev) => ({
        ...prev,
        text: { ...prev.text, versionColor: savedColor },
      }));
      setVersionColorHex(savedColor);
      if (res.version) {
        setVersions((prev) => [res.version!, ...prev.filter((v) => v.id !== res.version!.id)]);
      }
      showToast('success', `"3.0" text color (${savedColor.toUpperCase()}) saved and synced live across all devices!`);
    } else {
      showToast('error', res.error || 'Failed to save "3.0" text color.');
    }
  };

  const handleResetVersionColor = async () => {
    setVersionColorHex(DEFAULT_HERO_VERSION_COLOR);
    setDraftConfig((prev) => ({
      ...prev,
      text: { ...prev.text, versionColor: DEFAULT_HERO_VERSION_COLOR },
    }));
    setPreviewSource('draft');
    setIsResettingVersionColor(true);
    const res = await saveHeroVersionColor(DEFAULT_HERO_VERSION_COLOR);
    setIsResettingVersionColor(false);

    if (res.success && res.published) {
      setLivePublished(cloneHeroConfig(res.published));
      setDraftConfig((prev) => ({
        ...prev,
        text: { ...prev.text, versionColor: DEFAULT_HERO_VERSION_COLOR },
      }));
      if (res.version) {
        setVersions((prev) => [res.version!, ...prev.filter((v) => v.id !== res.version!.id)]);
      }
      showToast('success', 'Restored default "3.0" color matching "Meet the Contenders" and published live!');
    } else {
      showToast('error', res.error || 'Failed to reset "3.0" text color.');
    }
  };

  const handleRestoreVersion = async (ver: HeroVersionRecord) => {
    setRestoringVersionId(ver.id);
    const res = await restoreHeroVersion(ver);
    setRestoringVersionId(null);

    if (res.success && res.published) {
      setLivePublished(cloneHeroConfig(res.published));
      setDraftConfig(cloneHeroConfig({ ...res.published, status: 'draft' }));
      if (res.version) {
        setVersions((prev) => [res.version!, ...prev]);
      }
      showToast('success', `Restored v${ver.versionNum} and published as v${res.published.version}.`);
    } else {
      showToast('error', res.error || 'Restore failed.');
    }
  };

  const applyThemePreset = (presetId: Exclude<HeroThemePresetId, 'custom'>) => {
    const preset = HERO_THEME_PRESETS.find((p) => p.id === presetId);
    if (!preset) return;
    setDraftConfig((prev) => ({
      ...prev,
      background: {
        ...prev.background,
        gradientStart: preset.gradientStart,
        gradientMid: preset.gradientMid,
        gradientEnd: preset.gradientEnd,
        overlayColor: preset.overlayColor,
      },
      text: {
        ...prev.text,
        kickerColor: preset.kickerColor,
        mainHeading: { ...prev.text.mainHeading, color: preset.headingColor },
        tagline: { ...prev.text.tagline, color: preset.taglineColor },
      },
      theme: {
        ...prev.theme,
        preset: presetId,
        headingColor: preset.headingColor,
        accentColor: preset.accentColor,
        borderColor: preset.borderColor,
      },
    }));
    setPreviewSource('draft');
  };

  const moveButtonOrder = (index: number, direction: -1 | 1) => {
    setDraftConfig((prev) => {
      const sorted = [...prev.buttons.buttons].sort((a, b) => a.order - b.order);
      const targetIndex = index + direction;
      if (targetIndex < 0 || targetIndex >= sorted.length) return prev;
      const temp = sorted[index];
      sorted[index] = sorted[targetIndex];
      sorted[targetIndex] = temp;
      const reindexed = sorted.map((b, idx) => ({ ...b, order: idx + 1 }));
      return {
        ...prev,
        buttons: { ...prev.buttons, buttons: reindexed },
      };
    });
  };

  const updateButton = (id: string, patch: Partial<HeroButtonConfig>) => {
    setDraftConfig((prev) => ({
      ...prev,
      buttons: {
        ...prev.buttons,
        buttons: prev.buttons.buttons.map((b) => (b.id === id ? { ...b, ...patch } : b)),
      },
    }));
  };

  if (!canManage) {
    return (
      <div className="max-w-3xl mx-auto rounded-2xl border border-rose-500/30 bg-slate-900/70 p-6 sm:p-8 text-center space-y-3">
        <ShieldAlert className="w-10 h-10 text-rose-400 mx-auto" />
        <h2 className="text-xl font-display font-black text-white">Restricted Access</h2>
        <p className="text-sm text-slate-300">
          Only Tournament Directors and Super Administrators can customize and publish the public homepage Hero Section.
        </p>
      </div>
    );
  }

  const navTabs: { id: EditorTab; label: string; icon: React.ReactNode }[] = [
    { id: 'background', label: 'Background', icon: <ImageIcon className="w-4 h-4" /> },
    { id: 'logo', label: 'Logo & Brand', icon: <Sparkles className="w-4 h-4" /> },
    { id: 'text', label: 'Headlines', icon: <Type className="w-4 h-4" /> },
    { id: 'buttons', label: 'Buttons', icon: <MousePointerClick className="w-4 h-4" /> },
    { id: 'theme', label: 'Theme & Layout', icon: <Palette className="w-4 h-4" /> },
    { id: 'animations', label: 'Animations', icon: <Layers className="w-4 h-4" /> },
    { id: 'versions', label: 'Versions', icon: <History className="w-4 h-4" /> },
  ];

  const activePreviewConfig = previewSource === 'published' ? livePublished : draftConfig;
  const sortedButtons = [...draftConfig.buttons.buttons].sort((a, b) => a.order - b.order);

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Top Action Header */}
      <div className="rounded-2xl border border-white/10 bg-[#0d1424] p-4 sm:p-6">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="space-y-1 min-w-0">
            <div className="flex items-center gap-2.5 flex-wrap">
              <h1 className="text-xl sm:text-2xl font-display font-black tracking-tight text-white">
                Hero Section Manager
              </h1>
              <span className="text-xs font-mono font-semibold text-amber-300 tabular-nums">
                Live v{livePublished.version || 1}
              </span>
              {hasUnpublishedChanges && (
                <span className="text-xs font-semibold text-sky-300">
                  · Unsaved / Unpublished Draft Changes
                </span>
              )}
            </div>
            <p className="text-xs sm:text-sm text-slate-400">
              Customize background media, championship emblem, headlines, CTAs, theme presets, and animations with safe live preview before publishing.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 shrink-0">
            <button
              type="button"
              onClick={() => setConfirmResetModal(true)}
              className="inline-flex items-center gap-1.5 px-3.5 py-2.5 min-h-[42px] rounded-xl text-xs font-semibold text-slate-300 hover:text-white bg-white/5 hover:bg-white/10 border border-white/10 transition-colors cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Reset Default</span>
            </button>

            <button
              type="button"
              onClick={handleSaveDraft}
              disabled={isSavingDraft || isLoading}
              className="inline-flex items-center gap-1.5 px-4 py-2.5 min-h-[42px] rounded-xl text-xs font-bold text-slate-100 bg-slate-800 hover:bg-slate-700 border border-white/15 transition-colors disabled:opacity-50 cursor-pointer"
            >
              {isSavingDraft ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5 text-sky-400" />}
              <span>{isSavingDraft ? 'Saving Draft...' : 'Save Draft'}</span>
            </button>

            <button
              type="button"
              onClick={handlePublish}
              disabled={isPublishing || isLoading}
              className="inline-flex items-center gap-2 px-5 py-2.5 min-h-[42px] rounded-xl text-xs sm:text-sm font-black uppercase tracking-wider text-slate-950 bg-gradient-to-r from-amber-300 via-amber-400 to-orange-500 hover:from-amber-200 hover:to-orange-400 shadow-lg shadow-amber-500/20 transition-all disabled:opacity-50 cursor-pointer"
            >
              {isPublishing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              <span>{isPublishing ? 'Publishing...' : 'Publish to Live Site'}</span>
            </button>
          </div>
        </div>

        {feedback && (
          <div
            role="status"
            className={`mt-4 rounded-xl border px-4 py-3 text-xs sm:text-sm font-medium flex items-center justify-between gap-3 ${
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

      {/* Confirm Reset Inline Banner */}
      {confirmResetModal && (
        <div className="rounded-2xl border border-amber-500/40 bg-amber-950/25 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="text-xs sm:text-sm text-amber-100">
            Reset draft to the factory <strong>SPL 3.0 Champion Edition</strong> design? You can inspect the preview before clicking Publish.
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => setConfirmResetModal(false)}
              className="px-3 py-2 rounded-lg text-xs font-semibold text-slate-300 bg-white/5 hover:bg-white/10 cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => {
                setDraftConfig(cloneHeroConfig({ ...DEFAULT_HERO_CONFIG, status: 'draft' }));
                setPreviewSource('draft');
                setConfirmResetModal(false);
                showToast('info', 'Draft reset to SPL 3.0 default. Save Draft or Publish when ready.');
              }}
              className="px-3.5 py-2 rounded-lg text-xs font-bold text-slate-950 bg-amber-400 hover:bg-amber-300 cursor-pointer"
            >
              Reset Draft to Default
            </button>
          </div>
        </div>
      )}

      {/* Horizontal Section Sub-Nav */}
      <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-1 border-b border-white/10">
        {navTabs.map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`inline-flex items-center gap-2 px-3.5 py-2.5 min-h-[44px] rounded-xl text-xs sm:text-sm font-semibold whitespace-nowrap shrink-0 transition-colors cursor-pointer ${
                isActive
                  ? 'bg-amber-400 text-slate-950 font-bold'
                  : 'text-slate-300 hover:text-white hover:bg-white/5'
              }`}
            >
              {tab.icon}
              <span>{tab.label}</span>
              {tab.id === 'versions' && versions.length > 0 && (
                <span
                  className={`text-[11px] font-mono tabular-nums ${
                    isActive ? 'text-slate-900' : 'text-slate-400'
                  }`}
                >
                  ({versions.length})
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Main Split Workspace: Controls + Real-Time Preview */}
      <div className={`grid grid-cols-1 ${expandedPreview ? 'gap-6' : 'xl:grid-cols-12 gap-6 items-start'}`}>
        {/* LEFT COLUMN: Configuration Controls */}
        <div className={`${expandedPreview ? 'order-2' : 'xl:col-span-5'} rounded-2xl border border-white/10 bg-[#0d1424] p-4 sm:p-5 space-y-5`}>
          {isLoading ? (
            <div className="py-12 flex flex-col items-center justify-center gap-3 text-slate-400 text-sm">
              <Loader2 className="w-6 h-6 animate-spin text-amber-400" />
              <span>Loading Hero customization configuration...</span>
            </div>
          ) : (
            <>
              {/* TAB 1: BACKGROUND MANAGER */}
              {activeTab === 'background' && (
                <div className="space-y-5">
                  <div>
                    <h2 className="text-base font-display font-bold text-white">Hero Background Manager</h2>
                    <p className="text-xs text-slate-400 mt-0.5">
                      Choose between an Image backdrop, looping Sports Video, or Championship Gradient.
                    </p>
                  </div>

                  {/* Background Type Switcher */}
                  <div className="grid grid-cols-3 gap-2">
                    {([
                      { id: 'gradient', label: 'Gradient', icon: <Palette className="w-4 h-4" /> },
                      { id: 'image', label: 'Image', icon: <ImageIcon className="w-4 h-4" /> },
                      { id: 'video', label: 'Video', icon: <Film className="w-4 h-4" /> },
                    ] as const).map((opt) => (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => {
                          setDraftConfig((prev) => ({
                            ...prev,
                            background: { ...prev.background, type: opt.id },
                          }));
                          setPreviewSource('draft');
                        }}
                        className={`flex flex-col items-center justify-center gap-1.5 py-3 px-2 rounded-xl border text-xs font-bold transition-colors cursor-pointer ${
                          draftConfig.background.type === opt.id
                            ? 'bg-amber-400/15 border-amber-400 text-amber-300'
                            : 'bg-white/[0.03] border-white/10 text-slate-300 hover:bg-white/[0.06]'
                        }`}
                      >
                        {opt.icon}
                        <span>{opt.label}</span>
                      </button>
                    ))}
                  </div>

                  {/* Background: IMAGE */}
                  {draftConfig.background.type === 'image' && (
                    <div className="space-y-4 border-t border-white/10 pt-4">
                      <div className="space-y-2">
                        <label className="block text-xs font-bold text-slate-200">
                          Desktop Background Image (JPG, PNG, WebP, AVIF · max 10MB)
                        </label>
                        <input
                          ref={deskBgInputRef}
                          type="file"
                          accept=".jpg,.jpeg,.png,.webp,.avif,image/jpeg,image/png,image/webp,image/avif"
                          className="hidden"
                          onChange={(e) => void handleMediaUpload(e.target.files?.[0], 'image', 'desktop-image')}
                        />
                        <div className="flex flex-wrap items-center gap-2">
                          <button
                            type="button"
                            onClick={() => deskBgInputRef.current?.click()}
                            disabled={uploadingField === 'desktop-image'}
                            className="inline-flex items-center gap-2 px-3.5 py-2.5 min-h-[42px] rounded-xl text-xs font-bold text-slate-950 bg-amber-400 hover:bg-amber-300 transition-colors cursor-pointer"
                          >
                            {uploadingField === 'desktop-image' ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              <Upload className="w-4 h-4" />
                            )}
                            <span>Upload Desktop Image</span>
                          </button>
                          {draftConfig.background.imageUrl && (
                            <button
                              type="button"
                              onClick={() =>
                                setDraftConfig((prev) => ({
                                  ...prev,
                                  background: { ...prev.background, imageUrl: '', imageStoragePath: '' },
                                }))
                              }
                              className="px-3 py-2.5 min-h-[42px] rounded-xl text-xs font-semibold text-rose-300 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 cursor-pointer"
                            >
                              Remove
                            </button>
                          )}
                        </div>
                        {draftConfig.background.imageUrl && (
                          <div className="rounded-xl overflow-hidden border border-white/10 h-28 bg-slate-950">
                            <img
                              src={draftConfig.background.imageUrl}
                              alt="Desktop background preview"
                              className="w-full h-full object-cover"
                              style={{
                                objectPosition: `${draftConfig.background.focalPointX}% ${draftConfig.background.focalPointY}%`,
                              }}
                            />
                          </div>
                        )}
                      </div>

                      <div className="space-y-2">
                        <label className="block text-xs font-bold text-slate-200">
                          Optional Mobile Background Image (Fallback to Desktop if blank)
                        </label>
                        <input
                          ref={mobBgInputRef}
                          type="file"
                          accept=".jpg,.jpeg,.png,.webp,.avif,image/jpeg,image/png,image/webp,image/avif"
                          className="hidden"
                          onChange={(e) => void handleMediaUpload(e.target.files?.[0], 'image', 'mobile-image')}
                        />
                        <div className="flex flex-wrap items-center gap-2">
                          <button
                            type="button"
                            onClick={() => mobBgInputRef.current?.click()}
                            disabled={uploadingField === 'mobile-image'}
                            className="inline-flex items-center gap-2 px-3.5 py-2 min-h-[40px] rounded-xl text-xs font-semibold text-slate-200 bg-white/5 hover:bg-white/10 border border-white/10 cursor-pointer"
                          >
                            {uploadingField === 'mobile-image' ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              <Upload className="w-4 h-4" />
                            )}
                            <span>Upload Mobile Image</span>
                          </button>
                          {draftConfig.background.mobileImageUrl && (
                            <button
                              type="button"
                              onClick={() =>
                                setDraftConfig((prev) => ({
                                  ...prev,
                                  background: { ...prev.background, mobileImageUrl: '', mobileImageStoragePath: '' },
                                }))
                              }
                              className="px-3 py-2 rounded-xl text-xs font-semibold text-rose-300 bg-rose-500/10 hover:bg-rose-500/20 cursor-pointer"
                            >
                              Clear Mobile
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Focal Point & Image Fit */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                          <label className="flex justify-between text-xs font-semibold text-slate-300 mb-1">
                            <span>Desktop Focal X</span>
                            <span className="font-mono tabular-nums">{draftConfig.background.focalPointX}%</span>
                          </label>
                          <input
                            type="range"
                            min={0}
                            max={100}
                            value={draftConfig.background.focalPointX}
                            onChange={(e) =>
                              setDraftConfig((prev) => ({
                                ...prev,
                                background: { ...prev.background, focalPointX: Number(e.target.value) },
                              }))
                            }
                            className="w-full accent-amber-400"
                          />
                        </div>
                        <div>
                          <label className="flex justify-between text-xs font-semibold text-slate-300 mb-1">
                            <span>Desktop Focal Y</span>
                            <span className="font-mono tabular-nums">{draftConfig.background.focalPointY}%</span>
                          </label>
                          <input
                            type="range"
                            min={0}
                            max={100}
                            value={draftConfig.background.focalPointY}
                            onChange={(e) =>
                              setDraftConfig((prev) => ({
                                ...prev,
                                background: { ...prev.background, focalPointY: Number(e.target.value) },
                              }))
                            }
                            className="w-full accent-amber-400"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="flex justify-between text-xs font-semibold text-slate-300 mb-1">
                            <span>Mobile Focal X</span>
                            <span className="font-mono tabular-nums">{draftConfig.background.mobileFocalPointX}%</span>
                          </label>
                          <input
                            type="range"
                            min={0}
                            max={100}
                            value={draftConfig.background.mobileFocalPointX}
                            onChange={(e) =>
                              setDraftConfig((prev) => ({
                                ...prev,
                                background: { ...prev.background, mobileFocalPointX: Number(e.target.value) },
                              }))
                            }
                            className="w-full accent-amber-400"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-semibold text-slate-300 mb-1">
                            Image Sizing Mode
                          </label>
                          <select
                            value={draftConfig.background.imageFit}
                            onChange={(e) =>
                              setDraftConfig((prev) => ({
                                ...prev,
                                background: {
                                  ...prev.background,
                                  imageFit: e.target.value as HeroBackgroundFit,
                                },
                              }))
                            }
                            className="w-full rounded-xl bg-slate-900 border border-white/15 px-3 py-2 text-xs text-white"
                          >
                            <option value="cover">Cover (Full Bleed)</option>
                            <option value="contain">Contain (No Crop)</option>
                            <option value="fill">Stretch to Fill</option>
                          </select>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Background: VIDEO */}
                  {draftConfig.background.type === 'video' && (
                    <div className="space-y-4 border-t border-white/10 pt-4">
                      <div className="space-y-2">
                        <label className="block text-xs font-bold text-slate-200">
                          Hero Background Video (MP4 or WebM · max 50MB)
                        </label>
                        <input
                          ref={videoInputRef}
                          type="file"
                          accept=".mp4,.webm,video/mp4,video/webm"
                          className="hidden"
                          onChange={(e) => void handleMediaUpload(e.target.files?.[0], 'video', 'video')}
                        />
                        <div className="flex flex-wrap items-center gap-2">
                          <button
                            type="button"
                            onClick={() => videoInputRef.current?.click()}
                            disabled={uploadingField === 'video'}
                            className="inline-flex items-center gap-2 px-3.5 py-2.5 min-h-[42px] rounded-xl text-xs font-bold text-slate-950 bg-amber-400 hover:bg-amber-300 cursor-pointer"
                          >
                            {uploadingField === 'video' ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              <Upload className="w-4 h-4" />
                            )}
                            <span>Upload Hero Video</span>
                          </button>
                          {draftConfig.background.videoUrl && (
                            <button
                              type="button"
                              onClick={() =>
                                setDraftConfig((prev) => ({
                                  ...prev,
                                  background: { ...prev.background, videoUrl: '', videoStoragePath: '' },
                                }))
                              }
                              className="px-3 py-2.5 min-h-[42px] rounded-xl text-xs font-semibold text-rose-300 bg-rose-500/10 hover:bg-rose-500/20 cursor-pointer"
                            >
                              Remove Video
                            </button>
                          )}
                        </div>
                        {draftConfig.background.videoUrl && (
                          <video
                            src={draftConfig.background.videoUrl}
                            poster={draftConfig.background.videoPosterUrl || undefined}
                            muted
                            controls
                            playsInline
                            className="w-full h-32 rounded-xl border border-white/10 bg-black object-cover"
                          />
                        )}
                      </div>

                      <div className="space-y-2">
                        <label className="block text-xs font-bold text-slate-200">
                          Fallback Poster Image (Shown while loading, on reduced-motion, or mobile off)
                        </label>
                        <input
                          ref={posterInputRef}
                          type="file"
                          accept=".jpg,.jpeg,.png,.webp,.avif,image/jpeg,image/png,image/webp,image/avif"
                          className="hidden"
                          onChange={(e) => void handleMediaUpload(e.target.files?.[0], 'image', 'video-poster')}
                        />
                        <button
                          type="button"
                          onClick={() => posterInputRef.current?.click()}
                          disabled={uploadingField === 'video-poster'}
                          className="inline-flex items-center gap-2 px-3.5 py-2 min-h-[40px] rounded-xl text-xs font-semibold text-slate-200 bg-white/5 hover:bg-white/10 border border-white/10 cursor-pointer"
                        >
                          <Upload className="w-4 h-4" />
                          <span>{draftConfig.background.videoPosterUrl ? 'Replace Poster Image' : 'Upload Poster Image'}</span>
                        </button>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                        {[
                          { key: 'videoAutoplay', label: 'Autoplay (Muted)' },
                          { key: 'videoLoop', label: 'Loop Playback' },
                          { key: 'videoPlayOnMobile', label: 'Play on Mobile' },
                        ].map((toggle) => (
                          <label
                            key={toggle.key}
                            className="flex items-center justify-between gap-2 p-2.5 rounded-xl bg-white/[0.03] border border-white/10 text-xs text-slate-200 cursor-pointer"
                          >
                            <span>{toggle.label}</span>
                            <input
                              type="checkbox"
                              checked={Boolean((draftConfig.background as any)[toggle.key])}
                              onChange={(e) =>
                                setDraftConfig((prev) => ({
                                  ...prev,
                                  background: {
                                    ...prev.background,
                                    [toggle.key]: e.target.checked,
                                  },
                                }))
                              }
                              className="accent-amber-400 h-4 w-4"
                            />
                          </label>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Background: GRADIENT */}
                  {draftConfig.background.type === 'gradient' && (
                    <div className="space-y-4 border-t border-white/10 pt-4">
                      <div className="grid grid-cols-3 gap-3">
                        <div>
                          <label className="block text-[11px] font-semibold text-slate-300 mb-1">Start Color</label>
                          <input
                            type="color"
                            value={draftConfig.background.gradientStart}
                            onChange={(e) =>
                              setDraftConfig((prev) => ({
                                ...prev,
                                background: { ...prev.background, gradientStart: e.target.value },
                                theme: { ...prev.theme, preset: 'custom' },
                              }))
                            }
                            className="w-full h-10 rounded-lg bg-slate-900 border border-white/15 cursor-pointer"
                          />
                        </div>
                        <div>
                          <label className="block text-[11px] font-semibold text-slate-300 mb-1">Arena Glow</label>
                          <input
                            type="color"
                            value={draftConfig.background.gradientMid}
                            onChange={(e) =>
                              setDraftConfig((prev) => ({
                                ...prev,
                                background: { ...prev.background, gradientMid: e.target.value },
                                theme: { ...prev.theme, preset: 'custom' },
                              }))
                            }
                            className="w-full h-10 rounded-lg bg-slate-900 border border-white/15 cursor-pointer"
                          />
                        </div>
                        <div>
                          <label className="block text-[11px] font-semibold text-slate-300 mb-1">End Color</label>
                          <input
                            type="color"
                            value={draftConfig.background.gradientEnd}
                            onChange={(e) =>
                              setDraftConfig((prev) => ({
                                ...prev,
                                background: { ...prev.background, gradientEnd: e.target.value },
                                theme: { ...prev.theme, preset: 'custom' },
                              }))
                            }
                            className="w-full h-10 rounded-lg bg-slate-900 border border-white/15 cursor-pointer"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-xs font-semibold text-slate-300 mb-1">
                            Gradient Direction
                          </label>
                          <select
                            value={draftConfig.background.gradientDirection}
                            onChange={(e) =>
                              setDraftConfig((prev) => ({
                                ...prev,
                                background: {
                                  ...prev.background,
                                  gradientDirection: e.target.value as any,
                                },
                              }))
                            }
                            className="w-full rounded-xl bg-slate-900 border border-white/15 px-3 py-2 text-xs text-white"
                          >
                            <option value="to-br">Diagonal Arena Sweep</option>
                            <option value="to-b">Vertical Spotlight</option>
                            <option value="to-r">Horizontal Court Split</option>
                            <option value="radial">Radial Center Glow</option>
                          </select>
                        </div>

                        <label className="flex items-center justify-between gap-2 px-3 py-2 rounded-xl bg-white/[0.03] border border-white/10 text-xs text-slate-200 cursor-pointer self-end min-h-[38px]">
                          <span>Court Lines Pattern</span>
                          <input
                            type="checkbox"
                            checked={draftConfig.background.showCourtPattern}
                            onChange={(e) =>
                              setDraftConfig((prev) => ({
                                ...prev,
                                background: { ...prev.background, showCourtPattern: e.target.checked },
                              }))
                            }
                            className="accent-amber-400 h-4 w-4"
                          />
                        </label>
                      </div>
                    </div>
                  )}

                  {/* Shared Contrast Overlay & Reset Background */}
                  <div className="border-t border-white/10 pt-4 space-y-3">
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-center">
                      <div className="sm:col-span-2">
                        <label className="flex justify-between text-xs font-semibold text-slate-300 mb-1">
                          <span>Contrast Overlay Darkness</span>
                          <span className="font-mono tabular-nums">{draftConfig.background.overlayOpacity}%</span>
                        </label>
                        <input
                          type="range"
                          min={0}
                          max={90}
                          value={draftConfig.background.overlayOpacity}
                          onChange={(e) =>
                            setDraftConfig((prev) => ({
                              ...prev,
                              background: { ...prev.background, overlayOpacity: Number(e.target.value) },
                            }))
                          }
                          className="w-full accent-amber-400"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-semibold text-slate-300 mb-1">Overlay Tint</label>
                        <input
                          type="color"
                          value={draftConfig.background.overlayColor}
                          onChange={(e) =>
                            setDraftConfig((prev) => ({
                              ...prev,
                              background: { ...prev.background, overlayColor: e.target.value },
                            }))
                          }
                          className="w-full h-9 rounded-lg bg-slate-900 border border-white/15 cursor-pointer"
                        />
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() =>
                        setDraftConfig((prev) => ({
                          ...prev,
                          background: cloneHeroConfig(DEFAULT_HERO_CONFIG).background,
                        }))
                      }
                      className="text-xs font-semibold text-amber-300 hover:text-amber-200 cursor-pointer"
                    >
                      Reset Background to Default Arena Theme
                    </button>
                  </div>
                </div>
              )}

              {/* TAB 2: LOGO & BRANDING MANAGER */}
              {activeTab === 'logo' && (
                <div className="space-y-5">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h2 className="text-base font-display font-bold text-white">Hero Logo & Branding</h2>
                      <p className="text-xs text-slate-400 mt-0.5">
                        Upload a custom SVG, PNG, or WebP emblem for the Hero Section (max 3MB).
                      </p>
                    </div>
                    <label className="inline-flex items-center gap-2 text-xs font-semibold text-slate-200 cursor-pointer shrink-0">
                      <input
                        type="checkbox"
                        checked={draftConfig.logo.visible}
                        onChange={(e) =>
                          setDraftConfig((prev) => ({
                            ...prev,
                            logo: { ...prev.logo, visible: e.target.checked },
                          }))
                        }
                        className="accent-amber-400 h-4 w-4"
                      />
                      <span>Show Logo</span>
                    </label>
                  </div>

                  <input
                    ref={logoInputRef}
                    type="file"
                    accept=".png,.webp,.svg,image/png,image/webp,image/svg+xml"
                    className="hidden"
                    onChange={(e) => void handleMediaUpload(e.target.files?.[0], 'logo', 'logo')}
                  />

                  <div className="flex flex-wrap items-center gap-2.5">
                    <button
                      type="button"
                      onClick={() => logoInputRef.current?.click()}
                      disabled={uploadingField === 'logo'}
                      className="inline-flex items-center gap-2 px-4 py-2.5 min-h-[42px] rounded-xl text-xs font-bold text-slate-950 bg-amber-400 hover:bg-amber-300 cursor-pointer"
                    >
                      {uploadingField === 'logo' ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Upload className="w-4 h-4" />
                      )}
                      <span>{draftConfig.logo.customLogoUrl ? 'Replace Hero Logo' : 'Upload Custom Hero Logo'}</span>
                    </button>

                    {draftConfig.logo.customLogoUrl && (
                      <button
                        type="button"
                        onClick={() =>
                          setDraftConfig((prev) => ({
                            ...prev,
                            logo: {
                              ...prev.logo,
                              customLogoUrl: '',
                              customLogoStoragePath: '',
                              customLogoMime: '',
                            },
                          }))
                        }
                        className="px-3.5 py-2.5 min-h-[42px] rounded-xl text-xs font-semibold text-slate-200 bg-white/5 hover:bg-white/10 border border-white/10 cursor-pointer"
                      >
                        Restore Default SPL Emblem
                      </button>
                    )}
                  </div>

                  {draftConfig.logo.customLogoUrl && (
                    <div className="rounded-xl border border-white/10 bg-slate-950 p-4 flex items-center justify-between gap-4">
                      <img
                        src={draftConfig.logo.customLogoUrl}
                        alt="Custom Hero Logo Preview"
                        className="h-16 w-auto max-w-[200px] object-contain"
                      />
                      <span className="text-xs font-mono text-slate-400">
                        {draftConfig.logo.customLogoMime || 'Custom Upload'}
                      </span>
                    </div>
                  )}

                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">
                      Emblem Lockup Subtitle
                    </label>
                    <input
                      type="text"
                      maxLength={60}
                      value={draftConfig.logo.subtitle}
                      onChange={(e) =>
                        setDraftConfig((prev) => ({
                          ...prev,
                          logo: { ...prev.logo, subtitle: e.target.value },
                        }))
                      }
                      className="w-full rounded-xl bg-slate-900 border border-white/15 px-3 py-2.5 text-sm text-white"
                      placeholder="SPL 3.0 · CHAMPION EDITION"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-slate-300 mb-1">Desktop Size</label>
                      <select
                        value={draftConfig.logo.desktopSize}
                        onChange={(e) =>
                          setDraftConfig((prev) => ({
                            ...prev,
                            logo: { ...prev.logo, desktopSize: e.target.value as any },
                          }))
                        }
                        className="w-full rounded-xl bg-slate-900 border border-white/15 px-3 py-2 text-xs text-white"
                      >
                        <option value="sm">Compact</option>
                        <option value="md">Standard</option>
                        <option value="lg">Large</option>
                        <option value="xl">Showcase XL</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-300 mb-1">Mobile Size</label>
                      <select
                        value={draftConfig.logo.mobileSize}
                        onChange={(e) =>
                          setDraftConfig((prev) => ({
                            ...prev,
                            logo: { ...prev.logo, mobileSize: e.target.value as any },
                          }))
                        }
                        className="w-full rounded-xl bg-slate-900 border border-white/15 px-3 py-2 text-xs text-white"
                      >
                        <option value="sm">Compact</option>
                        <option value="md">Standard</option>
                        <option value="lg">Large</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-300 mb-1">Positioning</label>
                      <select
                        value={draftConfig.logo.alignment}
                        onChange={(e) =>
                          setDraftConfig((prev) => ({
                            ...prev,
                            logo: { ...prev.logo, alignment: e.target.value as any },
                          }))
                        }
                        className="w-full rounded-xl bg-slate-900 border border-white/15 px-3 py-2 text-xs text-white"
                      >
                        <option value="inherit">Match Hero Content</option>
                        <option value="left">Align Left</option>
                        <option value="center">Align Center</option>
                        <option value="right">Align Right</option>
                      </select>
                    </div>
                  </div>

                  <div className="space-y-2 border-t border-white/10 pt-4">
                    <label className="flex items-center justify-between gap-3 p-3 rounded-xl bg-white/[0.03] border border-white/10 text-xs text-slate-200 cursor-pointer">
                      <span>Enable Logo Entrance Animation</span>
                      <input
                        type="checkbox"
                        checked={draftConfig.logo.entranceAnimation}
                        onChange={(e) =>
                          setDraftConfig((prev) => ({
                            ...prev,
                            logo: { ...prev.logo, entranceAnimation: e.target.checked },
                          }))
                        }
                        className="accent-amber-400 h-4 w-4"
                      />
                    </label>

                    <label className="flex items-center justify-between gap-3 p-3 rounded-xl bg-white/[0.03] border border-white/10 text-xs text-slate-200 cursor-pointer">
                      <div>
                        <span className="block font-semibold text-white">Also Sync Custom Logo to Public Top Navbar</span>
                        <span className="block text-[11px] text-slate-400 mt-0.5">
                          Off by default — keeps logo updates strictly scoped to the Hero Section.
                        </span>
                      </div>
                      <input
                        type="checkbox"
                        checked={draftConfig.logo.applyGlobalNavbarBranding}
                        onChange={(e) =>
                          setDraftConfig((prev) => ({
                            ...prev,
                            logo: { ...prev.logo, applyGlobalNavbarBranding: e.target.checked },
                          }))
                        }
                        className="accent-amber-400 h-4 w-4 shrink-0"
                      />
                    </label>
                  </div>
                </div>
              )}

              {/* TAB 3: HEADLINE & TEXT EDITOR */}
              {activeTab === 'text' && (
                <div className="space-y-5">
                  <div>
                    <h2 className="text-base font-display font-bold text-white">Headlines & Typography</h2>
                    <p className="text-xs text-slate-400 mt-0.5">
                      Edit championship headlines, subtitle, tagline, and responsive desktop/mobile sizing.
                    </p>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-slate-300 mb-1">Typography Family</label>
                      <select
                        value={draftConfig.text.fontFamily}
                        onChange={(e) =>
                          setDraftConfig((prev) => ({
                            ...prev,
                            text: { ...prev.text, fontFamily: e.target.value as HeroFontFamily },
                          }))
                        }
                        className="w-full rounded-xl bg-slate-900 border border-white/15 px-3 py-2 text-xs text-white"
                      >
                        {HERO_FONT_OPTIONS.map((f) => (
                          <option key={f.value} value={f.value}>
                            {f.label}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-300 mb-1">Content Alignment</label>
                      <select
                        value={draftConfig.theme.contentAlignment}
                        onChange={(e) =>
                          setDraftConfig((prev) => ({
                            ...prev,
                            text: { ...prev.text, alignment: e.target.value as any },
                            theme: { ...prev.theme, contentAlignment: e.target.value as any },
                          }))
                        }
                        className="w-full rounded-xl bg-slate-900 border border-white/15 px-3 py-2 text-xs text-white"
                      >
                        <option value="left">Left Aligned (Split Broadcast)</option>
                        <option value="center">Center Aligned Showcase</option>
                        <option value="right">Right Aligned</option>
                      </select>
                    </div>
                  </div>

                  {/* Kicker Field */}
                  <div className="rounded-xl border border-white/10 bg-white/[0.02] p-3.5 space-y-2.5">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-bold text-white">Kicker Badge Line</span>
                      <label className="inline-flex items-center gap-1.5 text-xs text-slate-300 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={draftConfig.text.kickerVisible}
                          onChange={(e) =>
                            setDraftConfig((prev) => ({
                              ...prev,
                              text: { ...prev.text, kickerVisible: e.target.checked },
                            }))
                          }
                          className="accent-amber-400"
                        />
                        <span>Visible</span>
                      </label>
                    </div>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        maxLength={64}
                        value={draftConfig.text.kickerText}
                        onChange={(e) =>
                          setDraftConfig((prev) => ({
                            ...prev,
                            text: { ...prev.text, kickerText: e.target.value },
                          }))
                        }
                        className="flex-1 rounded-xl bg-slate-900 border border-white/15 px-3 py-2 text-xs text-white"
                      />
                      <input
                        type="color"
                        value={draftConfig.text.kickerColor}
                        onChange={(e) =>
                          setDraftConfig((prev) => ({
                            ...prev,
                            text: { ...prev.text, kickerColor: e.target.value },
                          }))
                        }
                        className="w-11 h-9 rounded-lg bg-slate-900 border border-white/15 cursor-pointer"
                      />
                    </div>
                  </div>

                  {/* Structured Text Blocks */}
                  {([
                    { key: 'mainHeading', label: 'Main Heading', multiline: false, minDesk: 28, maxDesk: 84 },
                    { key: 'subtitle', label: 'Subtitle Line', multiline: false, minDesk: 14, maxDesk: 36 },
                    { key: 'tagline', label: 'Championship Tagline', multiline: false, minDesk: 16, maxDesk: 42 },
                    { key: 'description', label: 'Description Copy', multiline: true, minDesk: 13, maxDesk: 26 },
                  ] as const).map((item) => {
                    const field = draftConfig.text[item.key];
                    const activeVersionColor = (
                      draftConfig.text.versionColor || DEFAULT_HERO_VERSION_COLOR
                    ).toLowerCase();
                    const isDefaultVersionColor = activeVersionColor === DEFAULT_HERO_VERSION_COLOR;

                    return (
                      <React.Fragment key={item.key}>
                        <div className="rounded-xl border border-white/10 bg-white/[0.02] p-3.5 space-y-3">
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-xs font-bold text-white">{item.label}</span>
                            <label className="inline-flex items-center gap-1.5 text-xs text-slate-300 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={field.visible}
                                onChange={(e) =>
                                  setDraftConfig((prev) => ({
                                    ...prev,
                                    text: {
                                      ...prev.text,
                                      [item.key]: { ...prev.text[item.key], visible: e.target.checked },
                                    },
                                  }))
                                }
                                className="accent-amber-400"
                              />
                              <span>Visible</span>
                            </label>
                          </div>

                          {item.multiline ? (
                            <textarea
                              rows={2}
                              maxLength={420}
                              value={field.text}
                              onChange={(e) =>
                                setDraftConfig((prev) => ({
                                  ...prev,
                                  text: {
                                    ...prev.text,
                                    [item.key]: { ...prev.text[item.key], text: e.target.value },
                                  },
                                }))
                              }
                              className="w-full rounded-xl bg-slate-900 border border-white/15 px-3 py-2 text-xs text-white"
                            />
                          ) : (
                            <input
                              type="text"
                              maxLength={160}
                              value={field.text}
                              onChange={(e) =>
                                setDraftConfig((prev) => ({
                                  ...prev,
                                  text: {
                                    ...prev.text,
                                    [item.key]: { ...prev.text[item.key], text: e.target.value },
                                  },
                                }))
                              }
                              className="w-full rounded-xl bg-slate-900 border border-white/15 px-3 py-2 text-xs text-white"
                            />
                          )}

                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 items-center">
                            <div>
                              <label className="block text-[11px] text-slate-400 mb-1">Color</label>
                              <input
                                type="color"
                                value={field.color}
                                onChange={(e) =>
                                  setDraftConfig((prev) => ({
                                    ...prev,
                                    text: {
                                      ...prev.text,
                                      [item.key]: { ...prev.text[item.key], color: e.target.value },
                                    },
                                  }))
                                }
                                className="w-full h-8 rounded-lg bg-slate-900 border border-white/15 cursor-pointer"
                              />
                            </div>
                            <div>
                              <label className="block text-[11px] text-slate-400 mb-1">Weight</label>
                              <select
                                value={field.fontWeight}
                                onChange={(e) =>
                                  setDraftConfig((prev) => ({
                                    ...prev,
                                    text: {
                                      ...prev.text,
                                      [item.key]: { ...prev.text[item.key], fontWeight: e.target.value as any },
                                    },
                                  }))
                                }
                                className="w-full rounded-lg bg-slate-900 border border-white/15 px-2 py-1.5 text-xs text-white"
                              >
                                <option value="500">Medium</option>
                                <option value="600">Semibold</option>
                                <option value="700">Bold</option>
                                <option value="800">Extrabold</option>
                                <option value="900">Black</option>
                              </select>
                            </div>
                            <div>
                              <label className="flex justify-between text-[11px] text-slate-400 mb-1">
                                <span>Desk</span>
                                <span className="font-mono tabular-nums">{field.fontSizeDesktop}px</span>
                              </label>
                              <input
                                type="range"
                                min={item.minDesk}
                                max={item.maxDesk}
                                value={field.fontSizeDesktop}
                                onChange={(e) =>
                                  setDraftConfig((prev) => ({
                                    ...prev,
                                    text: {
                                      ...prev.text,
                                      [item.key]: {
                                        ...prev.text[item.key],
                                        fontSizeDesktop: Number(e.target.value),
                                      },
                                    },
                                  }))
                                }
                                className="w-full accent-amber-400"
                              />
                            </div>
                            <div>
                              <label className="flex justify-between text-[11px] text-slate-400 mb-1">
                                <span>Mob</span>
                                <span className="font-mono tabular-nums">{field.fontSizeMobile}px</span>
                              </label>
                              <input
                                type="range"
                                min={12}
                                max={52}
                                value={field.fontSizeMobile}
                                onChange={(e) =>
                                  setDraftConfig((prev) => ({
                                    ...prev,
                                    text: {
                                      ...prev.text,
                                      [item.key]: {
                                        ...prev.text[item.key],
                                        fontSizeMobile: Number(e.target.value),
                                      },
                                    },
                                  }))
                                }
                                className="w-full accent-amber-400"
                              />
                            </div>
                          </div>
                        </div>

                        {item.key === 'mainHeading' && (
                          <div
                            id="hero-version-color-setting"
                            className="rounded-xl border border-amber-400/25 bg-gradient-to-br from-slate-900/90 via-[#0d1424] to-slate-950/90 p-3.5 sm:p-4 space-y-3"
                          >
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <div>
                                <h3 className="text-xs sm:text-sm font-display font-bold text-white">
                                  3.0 Text Color
                                </h3>
                                <p className="text-[11px] text-slate-400 mt-0.5">
                                  Customize the highlighted “3.0” color in the Hero heading or restore the default “Meet the Contenders” color.
                                </p>
                              </div>
                              <span className="text-[11px] font-mono px-2 py-0.5 rounded-md border border-white/10 bg-slate-950/80 text-amber-300 uppercase">
                                {isDefaultVersionColor ? 'Default Branding' : activeVersionColor}
                              </span>
                            </div>

                            {/* Live Preview of Selected "3.0" Color */}
                            <div className="rounded-xl border border-white/10 bg-[#05060b] px-4 py-3 flex items-center justify-between gap-3">
                              <span className="text-[10px] font-display font-bold uppercase tracking-[0.18em] text-slate-400 shrink-0">
                                Preview
                              </span>
                              <div
                                className="font-display font-black uppercase tracking-tight text-base sm:text-lg truncate text-right"
                                style={{ color: draftConfig.text.mainHeading.color || '#ffffff' }}
                              >
                                SMASH PREMIER LEAGUE{' '}
                                {isDefaultVersionColor ? (
                                  <span className="bg-gradient-to-r from-amber-200 via-amber-400 to-orange-500 bg-clip-text text-transparent">
                                    3.0
                                  </span>
                                ) : (
                                  <span style={{ color: activeVersionColor }}>3.0</span>
                                )}
                              </div>
                            </div>

                            {/* Responsive Color Picker & Custom HEX Input */}
                            <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5 items-end">
                              <div className="sm:col-span-4">
                                <label
                                  htmlFor="hero-30-color-picker"
                                  className="block text-[11px] font-semibold text-slate-300 mb-1"
                                >
                                  Color Picker
                                </label>
                                <div className="flex items-center gap-2 rounded-xl bg-slate-900 border border-white/15 px-2.5 py-1.5 min-h-[42px]">
                                  <input
                                    id="hero-30-color-picker"
                                    type="color"
                                    aria-label="3.0 Text Color Picker"
                                    value={activeVersionColor}
                                    onChange={(e) => handleVersionColorChange(e.target.value)}
                                    className="w-8 h-7 rounded-md bg-transparent border-0 cursor-pointer shrink-0 p-0"
                                  />
                                  <span className="text-xs font-mono text-slate-300 uppercase truncate">
                                    {activeVersionColor}
                                  </span>
                                </div>
                              </div>

                              <div className="sm:col-span-8">
                                <label
                                  htmlFor="hero-30-hex-input"
                                  className="block text-[11px] font-semibold text-slate-300 mb-1"
                                >
                                  Custom HEX Color
                                </label>
                                <input
                                  id="hero-30-hex-input"
                                  type="text"
                                  aria-label="3.0 Custom HEX Color"
                                  maxLength={7}
                                  value={versionColorHex}
                                  onChange={(e) => handleVersionColorChange(e.target.value)}
                                  onBlur={() => {
                                    if (!normalizedHexInput) {
                                      setVersionColorHex(activeVersionColor);
                                    } else {
                                      setVersionColorHex(normalizedHexInput);
                                    }
                                  }}
                                  placeholder="#fbbf24"
                                  className="w-full min-h-[42px] rounded-xl bg-slate-900 border border-white/15 px-3 py-2 text-xs sm:text-sm font-mono uppercase text-white placeholder:text-slate-500 focus:outline-none focus:border-amber-400"
                                />
                              </div>
                            </div>

                            {!normalizedHexInput && (
                              <p className="text-[11px] text-rose-400">
                                Enter a valid 3- or 6-digit HEX color (e.g. #fbbf24 or #ef4444).
                              </p>
                            )}

                            {/* Dedicated Save Color & Reset to Default Actions */}
                            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 pt-1">
                              <button
                                type="button"
                                onClick={() => void handleSaveVersionColor()}
                                disabled={isSavingVersionColor || isResettingVersionColor || !normalizedHexInput}
                                className="flex-1 inline-flex items-center justify-center gap-1.5 px-4 py-2.5 min-h-[42px] rounded-xl text-xs font-black uppercase tracking-wider text-slate-950 bg-gradient-to-r from-amber-300 via-amber-400 to-orange-500 hover:from-amber-200 hover:to-orange-400 shadow-md shadow-amber-500/20 transition-all disabled:opacity-50 cursor-pointer"
                              >
                                {isSavingVersionColor ? (
                                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                ) : (
                                  <Save className="w-3.5 h-3.5" />
                                )}
                                <span>{isSavingVersionColor ? 'Saving Color...' : 'Save Color'}</span>
                              </button>

                              <button
                                type="button"
                                onClick={() => void handleResetVersionColor()}
                                disabled={isSavingVersionColor || isResettingVersionColor}
                                className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2.5 min-h-[42px] rounded-xl text-xs font-semibold text-slate-200 hover:text-white bg-white/5 hover:bg-white/10 border border-white/15 transition-colors disabled:opacity-50 cursor-pointer"
                              >
                                {isResettingVersionColor ? (
                                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                ) : (
                                  <RotateCcw className="w-3.5 h-3.5 text-amber-300" />
                                )}
                                <span>Reset to Default</span>
                              </button>
                            </div>
                          </div>
                        )}
                      </React.Fragment>
                    );
                  })}
                </div>
              )}

              {/* TAB 4: BUTTONS & ACTIONS MANAGER */}
              {activeTab === 'buttons' && (
                <div className="space-y-5">
                  <div>
                    <h2 className="text-base font-display font-bold text-white">Hero Buttons & Actions</h2>
                    <p className="text-xs text-slate-400 mt-0.5">
                      Customize labels, styling, order, hover animations, and approved destinations.
                    </p>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-slate-300 mb-1">Desktop Layout</label>
                      <select
                        value={draftConfig.buttons.desktopLayout}
                        onChange={(e) =>
                          setDraftConfig((prev) => ({
                            ...prev,
                            buttons: { ...prev.buttons, desktopLayout: e.target.value as any },
                          }))
                        }
                        className="w-full rounded-xl bg-slate-900 border border-white/15 px-3 py-2 text-xs text-white"
                      >
                        <option value="row">Horizontal Row</option>
                        <option value="wrap">Adaptive Wrap</option>
                        <option value="stacked">Stacked Vertical</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-300 mb-1">Mobile Layout</label>
                      <select
                        value={draftConfig.buttons.mobileLayout}
                        onChange={(e) =>
                          setDraftConfig((prev) => ({
                            ...prev,
                            buttons: { ...prev.buttons, mobileLayout: e.target.value as any },
                          }))
                        }
                        className="w-full rounded-xl bg-slate-900 border border-white/15 px-3 py-2 text-xs text-white"
                      >
                        <option value="stacked">Full-Width Stacked</option>
                        <option value="row">Compact Wrap</option>
                      </select>
                    </div>
                  </div>

                  <div className="space-y-4">
                    {sortedButtons.map((btn, idx) => {
                      const urlValidation: { valid: boolean; error?: string } =
                        btn.actionTarget === 'custom-url'
                          ? validateHeroActionDestination(btn.actionTarget, btn.customUrl)
                          : { valid: true };
                      return (
                        <div key={btn.id} className="rounded-xl border border-white/10 bg-white/[0.02] p-3.5 space-y-3">
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-mono font-bold text-amber-300">#{idx + 1}</span>
                              <span className="text-xs font-bold text-white uppercase">{btn.role} CTA</span>
                            </div>
                            <div className="flex items-center gap-1.5">
                              <button
                                type="button"
                                onClick={() => moveButtonOrder(idx, -1)}
                                disabled={idx === 0}
                                aria-label="Move button up"
                                className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 disabled:opacity-30 cursor-pointer"
                              >
                                <ArrowUp className="w-3.5 h-3.5 text-slate-200" />
                              </button>
                              <button
                                type="button"
                                onClick={() => moveButtonOrder(idx, 1)}
                                disabled={idx === sortedButtons.length - 1}
                                aria-label="Move button down"
                                className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 disabled:opacity-30 cursor-pointer"
                              >
                                <ArrowDown className="w-3.5 h-3.5 text-slate-200" />
                              </button>
                              <label className="inline-flex items-center gap-1.5 ml-2 text-xs text-slate-300 cursor-pointer">
                                <input
                                  type="checkbox"
                                  checked={btn.visible}
                                  onChange={(e) => updateButton(btn.id, { visible: e.target.checked })}
                                  className="accent-amber-400"
                                />
                                <span>Show</span>
                              </label>
                            </div>
                          </div>

                          {btn.role === 'registration' && (
                            <div className="rounded-lg border border-amber-500/25 bg-amber-500/10 px-3 py-2 text-[11px] text-amber-200 flex items-center gap-2">
                              <Lock className="w-3.5 h-3.5 shrink-0" />
                              <span>
                                Registration Open/Closed status is enforced automatically. When Closed, this button locks to disabled REGISTRATION CLOSED.
                              </span>
                            </div>
                          )}

                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                            <div>
                              <label className="block text-[11px] text-slate-400 mb-1">Button Label</label>
                              <input
                                type="text"
                                maxLength={48}
                                value={btn.label}
                                onChange={(e) => updateButton(btn.id, { label: e.target.value })}
                                className="w-full rounded-xl bg-slate-900 border border-white/15 px-3 py-2 text-xs text-white"
                              />
                            </div>
                            <div>
                              <label className="block text-[11px] text-slate-400 mb-1">Visual Style</label>
                              <select
                                value={btn.style}
                                onChange={(e) => updateButton(btn.id, { style: e.target.value as HeroButtonStyle })}
                                className="w-full rounded-xl bg-slate-900 border border-white/15 px-3 py-2 text-xs text-white"
                              >
                                <option value="gold-primary">Championship Gold</option>
                                <option value="crimson-outline">Crimson Arena</option>
                                <option value="glass-outline">Glass Slate Outline</option>
                                <option value="emerald-solid">Electric Emerald</option>
                                <option value="royal-solid">Royal Sapphire</option>
                                <option value="custom">Custom Colors</option>
                              </select>
                            </div>
                          </div>

                          {btn.style === 'custom' && (
                            <div className="grid grid-cols-3 gap-2">
                              <div>
                                <label className="block text-[11px] text-slate-400 mb-1">Fill</label>
                                <input
                                  type="color"
                                  value={btn.customBgColor}
                                  onChange={(e) => updateButton(btn.id, { customBgColor: e.target.value })}
                                  className="w-full h-8 rounded-lg bg-slate-900 border border-white/15 cursor-pointer"
                                />
                              </div>
                              <div>
                                <label className="block text-[11px] text-slate-400 mb-1">Text</label>
                                <input
                                  type="color"
                                  value={btn.customTextColor}
                                  onChange={(e) => updateButton(btn.id, { customTextColor: e.target.value })}
                                  className="w-full h-8 rounded-lg bg-slate-900 border border-white/15 cursor-pointer"
                                />
                              </div>
                              <div>
                                <label className="block text-[11px] text-slate-400 mb-1">Border</label>
                                <input
                                  type="color"
                                  value={btn.customBorderColor}
                                  onChange={(e) => updateButton(btn.id, { customBorderColor: e.target.value })}
                                  className="w-full h-8 rounded-lg bg-slate-900 border border-white/15 cursor-pointer"
                                />
                              </div>
                            </div>
                          )}

                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                            <div>
                              <label className="block text-[11px] text-slate-400 mb-1">Destination Action</label>
                              <select
                                value={btn.actionTarget}
                                disabled={btn.role === 'registration'}
                                onChange={(e) => updateButton(btn.id, { actionTarget: e.target.value as any })}
                                className="w-full rounded-xl bg-slate-900 border border-white/15 px-3 py-2 text-xs text-white disabled:opacity-60"
                              >
                                {APPROVED_HERO_ACTION_TARGETS.map((t) => (
                                  <option key={t.value} value={t.value}>
                                    {t.label}
                                  </option>
                                ))}
                              </select>
                            </div>
                            <div>
                              <label className="block text-[11px] text-slate-400 mb-1">Hover Effect</label>
                              <select
                                value={btn.hoverEffect}
                                onChange={(e) => updateButton(btn.id, { hoverEffect: e.target.value as HeroButtonHoverEffect })}
                                className="w-full rounded-xl bg-slate-900 border border-white/15 px-3 py-2 text-xs text-white"
                              >
                                <option value="lift-glow">Lift + Shadow Glow</option>
                                <option value="scale">Athletic Scale</option>
                                <option value="shine">Brightness Highlight</option>
                                <option value="none">None</option>
                              </select>
                            </div>
                          </div>

                          {btn.actionTarget === 'custom-url' && btn.role !== 'registration' && (
                            <div>
                              <label className="block text-[11px] text-slate-400 mb-1">
                                External HTTPS Destination
                              </label>
                              <input
                                type="url"
                                value={btn.customUrl}
                                onChange={(e) => updateButton(btn.id, { customUrl: e.target.value })}
                                placeholder="https://example.com/schedule"
                                className="w-full rounded-xl bg-slate-900 border border-white/15 px-3 py-2 text-xs text-white"
                              />
                              {!urlValidation.valid && (
                                <p className="text-[11px] text-rose-400 mt-1">{urlValidation.error}</p>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* TAB 5: THEME & APPEARANCE */}
              {activeTab === 'theme' && (
                <div className="space-y-5">
                  <div>
                    <h2 className="text-base font-display font-bold text-white">Theme Presets & Layout</h2>
                    <p className="text-xs text-slate-400 mt-0.5">
                      Apply official SPL arena color themes and customize hero height and structural modules.
                    </p>
                  </div>

                  <div className="space-y-2.5">
                    {HERO_THEME_PRESETS.map((preset) => {
                      const active = draftConfig.theme.preset === preset.id;
                      return (
                        <button
                          key={preset.id}
                          type="button"
                          onClick={() => applyThemePreset(preset.id)}
                          className={`w-full text-left p-3.5 rounded-xl border transition-colors cursor-pointer ${
                            active
                              ? 'border-amber-400 bg-amber-400/10'
                              : 'border-white/10 bg-white/[0.02] hover:bg-white/[0.05]'
                          }`}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-sm font-display font-bold text-white">{preset.name}</span>
                            <div className="flex items-center gap-1.5">
                              <span className="w-4 h-4 rounded-full border border-white/20" style={{ background: preset.gradientMid }} />
                              <span className="w-4 h-4 rounded-full border border-white/20" style={{ background: preset.accentColor }} />
                              {active && <Check className="w-4 h-4 text-amber-400 ml-1" />}
                            </div>
                          </div>
                          <p className="text-xs text-slate-400 mt-1">{preset.description}</p>
                        </button>
                      );
                    })}
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 border-t border-white/10 pt-4">
                    <div>
                      <label className="block text-xs font-semibold text-slate-300 mb-1">Hero Section Height</label>
                      <select
                        value={draftConfig.theme.sectionHeight}
                        onChange={(e) =>
                          setDraftConfig((prev) => ({
                            ...prev,
                            theme: { ...prev.theme, sectionHeight: e.target.value as HeroSectionHeight },
                          }))
                        }
                        className="w-full rounded-xl bg-slate-900 border border-white/15 px-3 py-2 text-xs text-white"
                      >
                        <option value="compact">Compact Arena</option>
                        <option value="standard">Standard Championship</option>
                        <option value="tall">Tall Broadcast Showcase</option>
                        <option value="fullscreen">Fullscreen Immersion</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-300 mb-1">Content Alignment</label>
                      <select
                        value={draftConfig.theme.contentAlignment}
                        onChange={(e) =>
                          setDraftConfig((prev) => ({
                            ...prev,
                            theme: { ...prev.theme, contentAlignment: e.target.value as any },
                            text: { ...prev.text, alignment: e.target.value as any },
                          }))
                        }
                        className="w-full rounded-xl bg-slate-900 border border-white/15 px-3 py-2 text-xs text-white"
                      >
                        <option value="left">Left Split Layout</option>
                        <option value="center">Center Broadcast Layout</option>
                        <option value="right">Right Aligned</option>
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-slate-300 mb-1">Spotlight Accent Color</label>
                      <input
                        type="color"
                        value={draftConfig.theme.accentColor}
                        onChange={(e) =>
                          setDraftConfig((prev) => ({
                            ...prev,
                            theme: { ...prev.theme, accentColor: e.target.value, preset: 'custom' },
                          }))
                        }
                        className="w-full h-10 rounded-lg bg-slate-900 border border-white/15 cursor-pointer"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-300 mb-1">Border Highlight Color</label>
                      <input
                        type="color"
                        value={draftConfig.theme.borderColor}
                        onChange={(e) =>
                          setDraftConfig((prev) => ({
                            ...prev,
                            theme: { ...prev.theme, borderColor: e.target.value, preset: 'custom' },
                          }))
                        }
                        className="w-full h-10 rounded-lg bg-slate-900 border border-white/15 cursor-pointer"
                      />
                    </div>
                  </div>

                  <div className="space-y-2 border-t border-white/10 pt-4">
                    <label className="flex items-center justify-between p-3 rounded-xl bg-white/[0.03] border border-white/10 text-xs text-slate-200 cursor-pointer">
                      <span>Show Right Jump-Smash Visual Card</span>
                      <input
                        type="checkbox"
                        checked={draftConfig.theme.showRightShowcaseCard}
                        onChange={(e) =>
                          setDraftConfig((prev) => ({
                            ...prev,
                            theme: { ...prev.theme, showRightShowcaseCard: e.target.checked },
                          }))
                        }
                        className="accent-amber-400 h-4 w-4"
                      />
                    </label>
                    <label className="flex items-center justify-between p-3 rounded-xl bg-white/[0.03] border border-white/10 text-xs text-slate-200 cursor-pointer">
                      <span>Show Live Tournament Telemetry Strip</span>
                      <input
                        type="checkbox"
                        checked={draftConfig.theme.showInfoStrip}
                        onChange={(e) =>
                          setDraftConfig((prev) => ({
                            ...prev,
                            theme: { ...prev.theme, showInfoStrip: e.target.checked },
                          }))
                        }
                        className="accent-amber-400 h-4 w-4"
                      />
                    </label>
                  </div>
                </div>
              )}

              {/* TAB 6: ANIMATION & VISUAL EFFECTS */}
              {activeTab === 'animations' && (
                <div className="space-y-5">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h2 className="text-base font-display font-bold text-white">Animations & Effects</h2>
                      <p className="text-xs text-slate-400 mt-0.5">
                        Lightweight GPU-composited motion that respects OS reduced-motion preferences.
                      </p>
                    </div>
                    <label className="inline-flex items-center gap-2 text-xs font-bold text-amber-300 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={draftConfig.animations.enabled}
                        onChange={(e) =>
                          setDraftConfig((prev) => ({
                            ...prev,
                            animations: { ...prev.animations, enabled: e.target.checked },
                          }))
                        }
                        className="accent-amber-400 h-4 w-4"
                      />
                      <span>Enable Motion</span>
                    </label>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-slate-300 mb-1">Animation Preset</label>
                      <select
                        value={draftConfig.animations.preset}
                        onChange={(e) =>
                          setDraftConfig((prev) => ({
                            ...prev,
                            animations: { ...prev.animations, preset: e.target.value as HeroAnimationPreset },
                          }))
                        }
                        className="w-full rounded-xl bg-slate-900 border border-white/15 px-3 py-2 text-xs text-white"
                      >
                        {HERO_ANIMATION_PRESETS.map((p) => (
                          <option key={p.value} value={p.value}>
                            {p.label}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="flex justify-between text-xs font-semibold text-slate-300 mb-1">
                        <span>Motion Duration Scale</span>
                        <span className="font-mono tabular-nums">{draftConfig.animations.durationScale.toFixed(1)}x</span>
                      </label>
                      <input
                        type="range"
                        min={0.6}
                        max={1.5}
                        step={0.1}
                        value={draftConfig.animations.durationScale}
                        onChange={(e) =>
                          setDraftConfig((prev) => ({
                            ...prev,
                            animations: { ...prev.animations, durationScale: Number(e.target.value) },
                          }))
                        }
                        className="w-full accent-amber-400 mt-2"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    {([
                      { key: 'logoEntrance', label: 'Logo Entrance Reveal' },
                      { key: 'headingReveal', label: 'Main Heading Stagger' },
                      { key: 'subtitleAnimation', label: 'Subtitle & Tagline Motion' },
                      { key: 'buttonEntrance', label: 'CTA Buttons Entrance' },
                      { key: 'backgroundMotion', label: 'Background Gentle Motion' },
                      { key: 'spotlightEffects', label: 'Arena Spotlight Beams' },
                      { key: 'floatingParticles', label: 'Ambient Gold Dust Particles' },
                    ] as const).map((item) => (
                      <label
                        key={item.key}
                        className="flex items-center justify-between gap-2 p-3 rounded-xl bg-white/[0.03] border border-white/10 text-xs text-slate-200 cursor-pointer"
                      >
                        <span>{item.label}</span>
                        <input
                          type="checkbox"
                          checked={Boolean(draftConfig.animations[item.key])}
                          onChange={(e) =>
                            setDraftConfig((prev) => ({
                              ...prev,
                              animations: { ...prev.animations, [item.key]: e.target.checked },
                            }))
                          }
                          className="accent-amber-400 h-4 w-4"
                        />
                      </label>
                    ))}
                  </div>
                </div>
              )}

              {/* TAB 7: VERSION HISTORY */}
              {activeTab === 'versions' && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <h2 className="text-base font-display font-bold text-white">Published Version History</h2>
                      <p className="text-xs text-slate-400 mt-0.5">
                        Preview or restore any previously published Hero Section snapshot.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => void loadHeroAdminState()}
                      className="p-2 rounded-lg bg-white/5 hover:bg-white/10 text-slate-300 cursor-pointer"
                      title="Refresh Version History"
                    >
                      <RefreshCw className="w-4 h-4" />
                    </button>
                  </div>

                  {versions.length === 0 ? (
                    <div className="rounded-xl border border-white/10 bg-white/[0.02] p-6 text-center text-xs text-slate-400">
                      No published Hero history snapshots recorded yet. Publishing changes creates an automatic restorable snapshot.
                    </div>
                  ) : (
                    <div className="space-y-2.5 max-h-[460px] overflow-y-auto pr-1">
                      {versions.map((ver) => (
                        <div
                          key={ver.id}
                          className="rounded-xl border border-white/10 bg-white/[0.02] p-3.5 space-y-2.5"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <div>
                              <span className="text-xs font-mono font-bold text-amber-300 tabular-nums">
                                v{ver.versionNum}
                              </span>
                              <span className="text-xs text-slate-400 ml-2">
                                {ver.action === 'restore' ? 'Restored' : 'Published'} · {ver.createdBy}
                              </span>
                            </div>
                            <span className="text-[11px] font-mono text-slate-400 tabular-nums">
                              {new Date(ver.createdAt).toLocaleString()}
                            </span>
                          </div>
                          <p className="text-xs text-slate-300">{ver.summary}</p>
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => {
                                setDraftConfig(cloneHeroConfig({ ...ver.config, status: 'draft' }));
                                setPreviewSource('draft');
                                showToast('info', `Loaded v${ver.versionNum} into Draft Preview. Click Publish to restore live.`);
                              }}
                              className="px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-200 bg-white/5 hover:bg-white/10 border border-white/10 cursor-pointer"
                            >
                              Load into Preview
                            </button>
                            <button
                              type="button"
                              onClick={() => void handleRestoreVersion(ver)}
                              disabled={restoringVersionId === ver.id}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold text-slate-950 bg-amber-400 hover:bg-amber-300 disabled:opacity-50 cursor-pointer"
                            >
                              {restoringVersionId === ver.id ? (
                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                              ) : (
                                <RotateCcw className="w-3.5 h-3.5" />
                              )}
                              <span>Restore & Publish</span>
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>

        {/* RIGHT COLUMN: REAL-TIME LIVE PREVIEW */}
        <div className={`${expandedPreview ? 'order-1' : 'xl:col-span-7 xl:sticky xl:top-20'} rounded-2xl border border-white/10 bg-[#0d1424] overflow-hidden`}>
          {/* Preview Toolbar */}
          <div className="border-b border-white/10 px-4 py-3 flex flex-wrap items-center justify-between gap-3 bg-slate-950/60">
            <div className="flex items-center gap-2">
              <Eye className="w-4 h-4 text-amber-400 shrink-0" />
              <span className="text-xs sm:text-sm font-display font-bold text-white">
                Real-Time Hero Preview
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {/* Draft vs Published Toggle */}
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

              {/* Sim Reg Open / Closed Toggle */}
              <button
                type="button"
                onClick={() => setPreviewRegOpen((prev) => !prev)}
                className={`px-2.5 py-1.5 rounded-lg border text-[11px] font-semibold cursor-pointer ${
                  previewRegOpen
                    ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300'
                    : 'border-slate-600 bg-slate-800 text-slate-300'
                }`}
                title="Test how the Hero displays when Registration is Open vs Closed"
              >
                {previewRegOpen ? 'Preview: Reg Open' : 'Preview: Reg Closed'}
              </button>

              {/* Viewport Switcher */}
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

              <button
                type="button"
                onClick={() => setExpandedPreview((prev) => !prev)}
                aria-label={expandedPreview ? 'Collapse preview' : 'Expand preview'}
                className="p-1.5 rounded-lg border border-white/10 bg-slate-900 text-slate-300 hover:text-white cursor-pointer"
              >
                {expandedPreview ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
              </button>
            </div>
          </div>

          {/* Responsive Preview Frame */}
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
                heroConfig={normalizeHeroConfig(activePreviewConfig)}
                isRegistrationOpen={previewRegOpen}
                tournamentName={state.settings.name || 'Smash Premier League'}
                organizerLabel={state.settings.organizer || 'Maharajganj Badminton Association Presents'}
                venueLabel={state.settings.venue || 'Maharajganj Indoor Badminton Stadium'}
                announcementText={state.settings.announcement || ''}
                currentTournamentStage={
                  state.knockout.matches.some((m) => m.stage === 'F' && m.status === 'live')
                    ? 'Grand Final Live'
                    : state.matches.some((m) => m.status === 'live')
                      ? 'League Stage'
                      : 'Tournament Ready'
                }
                teamsCount={state.teams.length}
                liveMatchesCount={liveMatchesCount}
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
