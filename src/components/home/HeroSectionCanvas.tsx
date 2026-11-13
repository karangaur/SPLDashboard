import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowRight,
  Calendar,
  Lock,
  Pause,
  Play,
  PlusCircle,
} from 'lucide-react';
import { HeroButtonConfig, HeroConfig, Match, Team } from '../../types/tournament';
import { BadmintonHeroVisual } from './BadmintonHeroVisual';
import { SPLLogo } from '../common/SPLLogo';
import { DEFAULT_HERO_CONFIG, validateHeroActionDestination } from '../../utils/heroDefaults';

export interface HeroSectionCanvasProps {
  heroConfig?: HeroConfig;
  isRegistrationOpen: boolean;
  tournamentName: string;
  organizerLabel: string;
  venueLabel: string;
  announcementText?: string;
  currentTournamentStage: string;
  teamsCount: number;
  liveMatchesCount: number;
  featuredFixture?: (Match & { stageLabel?: string }) | null;
  getTeam?: (teamId?: string) => Team | undefined;
  onOpenPublicRegister: () => void;
  onScrollToSection: (sectionId: string) => void;
  isPreviewMode?: boolean;
  previewViewport?: 'desktop' | 'tablet' | 'mobile';
  onPreviewActionNotice?: (label: string) => void;
}

function hexToRgba(hex: string, alpha: number): string {
  const clean = (hex || '#05060b').replace('#', '');
  const full =
    clean.length === 3
      ? clean
          .split('')
          .map((c) => c + c)
          .join('')
      : clean.padEnd(6, '0').slice(0, 6);
  const r = parseInt(full.slice(0, 2), 16) || 5;
  const g = parseInt(full.slice(2, 4), 16) || 6;
  const b = parseInt(full.slice(4, 6), 16) || 11;
  return `rgba(${r}, ${g}, ${b}, ${Math.min(1, Math.max(0, alpha))})`;
}

export const HeroSectionCanvas: React.FC<HeroSectionCanvasProps> = ({
  heroConfig = DEFAULT_HERO_CONFIG,
  isRegistrationOpen,
  tournamentName,
  organizerLabel,
  venueLabel,
  announcementText = '',
  currentTournamentStage,
  teamsCount,
  liveMatchesCount,
  featuredFixture,
  getTeam,
  onOpenPublicRegister,
  onScrollToSection,
  isPreviewMode = false,
  previewViewport = 'desktop',
  onPreviewActionNotice,
}) => {
  const cfg = heroConfig || DEFAULT_HERO_CONFIG;
  const { background, logo, text, buttons, theme, animations } = cfg;

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [videoPlaybackFailed, setVideoPlaybackFailed] = useState(false);
  const [videoManuallyPaused, setVideoManuallyPaused] = useState(false);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);
  const [windowMobile, setWindowMobile] = useState(false);

  useEffect(() => {
    setVideoPlaybackFailed(false);
  }, [background.videoUrl]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const motionMq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const mobileMq = window.matchMedia('(max-width: 767px)');
    const syncMqs = () => {
      setPrefersReducedMotion(motionMq.matches);
      setWindowMobile(mobileMq.matches);
    };
    syncMqs();
    motionMq.addEventListener?.('change', syncMqs);
    mobileMq.addEventListener?.('change', syncMqs);
    return () => {
      motionMq.removeEventListener?.('change', syncMqs);
      mobileMq.removeEventListener?.('change', syncMqs);
    };
  }, []);

  const isMobileViewport = isPreviewMode ? previewViewport === 'mobile' : windowMobile;
  const isTabletViewport = isPreviewMode ? previewViewport === 'tablet' : false;
  const isCompactPreview = isPreviewMode && (previewViewport === 'mobile' || previewViewport === 'tablet');

  const animationsActive =
    animations.enabled &&
    animations.preset !== 'none' &&
    !prefersReducedMotion;

  const shouldRenderVideo =
    background.type === 'video' &&
    Boolean(background.videoUrl) &&
    !videoPlaybackFailed &&
    !prefersReducedMotion &&
    (!isMobileViewport || background.videoPlayOnMobile);

  useEffect(() => {
    const vid = videoRef.current;
    if (!vid || !shouldRenderVideo) return;
    if (background.videoAutoplay && !videoManuallyPaused) {
      vid.play().catch(() => {
        // Fallback gracefully if browser blocks autoplay
      });
    } else {
      vid.pause();
    }
  }, [shouldRenderVideo, background.videoAutoplay, videoManuallyPaused, background.videoUrl]);

  const toggleVideoPlay = () => {
    const vid = videoRef.current;
    if (!vid) return;
    if (vid.paused) {
      vid.play().catch(() => {});
      setVideoManuallyPaused(false);
    } else {
      vid.pause();
      setVideoManuallyPaused(true);
    }
  };

  // Section height mapping
  const sectionPaddingClass = useMemo(() => {
    if (isMobileViewport) {
      return theme.sectionHeight === 'compact'
        ? 'pt-6 pb-8'
        : theme.sectionHeight === 'fullscreen'
          ? 'pt-10 pb-12 min-h-[82vh] flex flex-col justify-center'
          : 'pt-8 pb-10';
    }
    switch (theme.sectionHeight) {
      case 'compact':
        return 'pt-6 pb-8 sm:pt-8 sm:pb-10';
      case 'tall':
        return 'pt-12 pb-16 sm:pt-16 sm:pb-20 lg:min-h-[680px] flex flex-col justify-center';
      case 'fullscreen':
        return 'pt-12 pb-16 sm:pt-16 sm:pb-20 min-h-[calc(100dvh-5rem)] flex flex-col justify-center';
      case 'standard':
      default:
        return 'pt-8 pb-10 sm:pt-12 sm:pb-14 lg:pt-14 lg:pb-16';
    }
  }, [theme.sectionHeight, isMobileViewport]);

  // Gradient background builder
  const backgroundGradientCss = useMemo(() => {
    const s = background.gradientStart || '#05060b';
    const m = background.gradientMid || '#120b09';
    const e = background.gradientEnd || '#05060b';
    if (background.gradientDirection === 'radial') {
      return `radial-gradient(ellipse at 30% 20%, ${m} 0%, ${s} 58%, ${e} 100%)`;
    }
    if (background.gradientDirection === 'to-b') {
      return `linear-gradient(180deg, ${s} 0%, ${m} 50%, ${e} 100%)`;
    }
    if (background.gradientDirection === 'to-r') {
      return `linear-gradient(90deg, ${s} 0%, ${m} 50%, ${e} 100%)`;
    }
    return `linear-gradient(135deg, ${s} 0%, ${m} 50%, ${e} 100%)`;
  }, [
    background.gradientStart,
    background.gradientMid,
    background.gradientEnd,
    background.gradientDirection,
  ]);

  const effectiveAlign = theme.contentAlignment || text.alignment || 'left';
  const alignWrapperClass =
    effectiveAlign === 'center'
      ? 'text-center items-center'
      : effectiveAlign === 'right'
        ? 'text-center lg:text-right items-center lg:items-end'
        : 'text-center lg:text-left items-center lg:items-start';

  const alignFlexJustify =
    effectiveAlign === 'center'
      ? 'justify-center'
      : effectiveAlign === 'right'
        ? 'justify-center lg:justify-end'
        : 'justify-center lg:justify-start';

  const logoEffectiveAlign = logo.alignment === 'inherit' ? effectiveAlign : logo.alignment;
  const logoJustifyClass =
    logoEffectiveAlign === 'center'
      ? 'justify-center'
      : logoEffectiveAlign === 'right'
        ? 'justify-center lg:justify-end'
        : 'justify-center lg:justify-start';

  const customLogoHeightClass = useMemo(() => {
    const desktopMap = {
      sm: 'lg:h-14',
      md: 'lg:h-20',
      lg: 'lg:h-28',
      xl: 'lg:h-36',
    };
    const mobileMap = {
      sm: 'h-12',
      md: 'h-16',
      lg: 'h-22',
    };
    return `${mobileMap[logo.mobileSize || 'md']} ${desktopMap[logo.desktopSize || 'md']}`;
  }, [logo.desktopSize, logo.mobileSize]);

  const sortedVisibleButtons = useMemo(
    () =>
      [...(buttons.buttons || [])]
        .filter((b) => b.visible)
        .sort((a, b) => a.order - b.order),
    [buttons.buttons]
  );

  // Animation helpers
  const animDurationStyle: React.CSSProperties = animationsActive
    ? ({
        '--spl-anim-scale': String(animations.durationScale || 1),
      } as React.CSSProperties)
    : {};

  const getStaggerClass = (stage: 'logo' | 'heading' | 'subtitle' | 'buttons') => {
    if (!animationsActive) return '';
    if (stage === 'logo' && logo.entranceAnimation && animations.logoEntrance) {
      return 'spl-hero-logo-reveal';
    }
    if (stage === 'heading' && animations.headingReveal) {
      return 'spl-hero-stagger-1';
    }
    if (stage === 'subtitle' && animations.subtitleAnimation) {
      return 'spl-hero-stagger-2';
    }
    if (stage === 'buttons' && animations.buttonEntrance) {
      return 'spl-hero-stagger-3';
    }
    return '';
  };

  const resolveHoverClasses = (hover: HeroButtonConfig['hoverEffect']) => {
    if (hover === 'none') return '';
    if (hover === 'scale') return 'hover:scale-[1.03] active:scale-95';
    if (hover === 'shine') return 'hover:-translate-y-0.5 hover:brightness-110 active:scale-95';
    return 'hover:-translate-y-0.5 hover:shadow-xl active:scale-95';
  };

  const resolveButtonStyle = (btn: HeroButtonConfig): { className: string; style?: React.CSSProperties } => {
    const hoverCls = resolveHoverClasses(btn.hoverEffect);
    switch (btn.style) {
      case 'gold-primary':
        return {
          className: `text-slate-950 bg-gradient-to-r from-amber-300 via-amber-400 to-orange-500 hover:from-amber-200 hover:via-amber-300 hover:to-orange-400 shadow-[0_12px_30px_-8px_rgba(245,158,11,0.55)] border border-amber-300/60 ${hoverCls}`,
        };
      case 'crimson-outline':
        return {
          className: `text-white bg-red-950/45 hover:bg-red-900/55 border border-red-500/50 hover:border-red-400/75 backdrop-blur-md ${hoverCls}`,
        };
      case 'emerald-solid':
        return {
          className: `text-slate-950 bg-gradient-to-r from-emerald-400 to-teal-400 hover:from-emerald-300 hover:to-teal-300 shadow-[0_10px_28px_-8px_rgba(16,185,129,0.45)] border border-emerald-300/60 ${hoverCls}`,
        };
      case 'royal-solid':
        return {
          className: `text-white bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 shadow-[0_10px_28px_-8px_rgba(37,99,235,0.5)] border border-blue-400/50 ${hoverCls}`,
        };
      case 'custom':
        return {
          className: `backdrop-blur-md border ${hoverCls}`,
          style: {
            backgroundColor: btn.customBgColor || '#f59e0b',
            color: btn.customTextColor || '#090d16',
            borderColor: btn.customBorderColor || btn.customBgColor || '#fbbf24',
          },
        };
      case 'glass-outline':
      default:
        return {
          className: `text-slate-100 bg-white/[0.05] hover:bg-white/[0.12] border border-slate-300/25 hover:border-amber-300/50 backdrop-blur-md ${hoverCls}`,
        };
    }
  };

  const handleActionClick = (btn: HeroButtonConfig) => {
    if (btn.role === 'registration') {
      if (!isRegistrationOpen) return;
      if (isPreviewMode) {
        onPreviewActionNotice?.(`"${btn.label}" -> Opens Player Registration (/register)`);
        return;
      }
      onOpenPublicRegister();
      return;
    }

    const check = validateHeroActionDestination(btn.actionTarget, btn.customUrl);
    if (!check.valid) return;

    if (check.target === 'register' || check.target === '/register') {
      if (!isRegistrationOpen) return;
      if (isPreviewMode) {
        onPreviewActionNotice?.(`"${btn.label}" -> Opens Player Registration (/register)`);
        return;
      }
      onOpenPublicRegister();
      return;
    }

    if (check.target.startsWith('#')) {
      const sectionId = check.target.slice(1);
      if (isPreviewMode) {
        onPreviewActionNotice?.(`"${btn.label}" -> Scrolls to section ${check.target}`);
        return;
      }
      onScrollToSection(sectionId);
      return;
    }

    if (check.target === 'custom-url' && check.customUrl) {
      if (isPreviewMode) {
        onPreviewActionNotice?.(`"${btn.label}" -> Opens ${check.customUrl}`);
        return;
      }
      window.open(check.customUrl, '_blank', 'noopener,noreferrer');
    }
  };

  // Responsive computed pixel font sizes for desktop/mobile or simulated preview viewport
  const computeResponsiveFontSize = (desk: number, mob: number) => {
    if (isMobileViewport) return `${mob}px`;
    if (isTabletViewport || isCompactPreview) return `${Math.round((desk + mob) / 2)}px`;
    return `clamp(${mob}px, ${(desk / 14.4).toFixed(2)}vw, ${desk}px)`;
  };

  const imageToRender =
    isMobileViewport && background.mobileImageUrl ? background.mobileImageUrl : background.imageUrl;
  const posterToRender = background.videoPosterUrl || imageToRender;
  const focalX = isMobileViewport ? background.mobileFocalPointX : background.focalPointX;
  const focalY = isMobileViewport ? background.mobileFocalPointY : background.focalPointY;

  const buttonGroupLayoutClass = useMemo(() => {
    const mob = buttons.mobileLayout === 'row' ? 'flex-row flex-wrap' : 'flex-col';
    const desk =
      buttons.desktopLayout === 'stacked'
        ? 'sm:flex-col sm:items-stretch'
        : buttons.desktopLayout === 'wrap'
          ? 'sm:flex-row sm:flex-wrap'
          : 'sm:flex-row sm:flex-wrap';
    return `flex ${mob} ${desk} items-stretch sm:items-center gap-3 pt-1 ${alignFlexJustify}`;
  }, [buttons.mobileLayout, buttons.desktopLayout, alignFlexJustify]);

  const showTwoColumnGrid = theme.showRightShowcaseCard && !isMobileViewport && !isTabletViewport;

  return (
    <section
      aria-label="Smash Premier League 3.0 Championship Hero"
      style={{
        background: backgroundGradientCss,
        borderColor: hexToRgba(theme.borderColor || '#f59e0b', 0.2),
        fontFamily: `'${text.fontFamily}', 'Outfit', 'Plus Jakarta Sans', sans-serif`,
        ...animDurationStyle,
      }}
      className={`relative overflow-hidden border-b ${sectionPaddingClass}`}
    >
      {/* Background Media Layer: Image or Video + Fallback */}
      {background.type === 'image' && imageToRender && (
        <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
          <img
            src={imageToRender}
            alt=""
            className={`w-full h-full ${
              animationsActive && animations.backgroundMotion && background.backgroundMotion
                ? 'transition-transform duration-1000 scale-[1.02]'
                : ''
            }`}
            style={{
              objectFit: background.imageFit || 'cover',
              objectPosition: `${focalX}% ${focalY}%`,
            }}
          />
        </div>
      )}

      {background.type === 'video' && (
        <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
          {posterToRender && (
            <img
              src={posterToRender}
              alt=""
              className="w-full h-full object-cover"
              style={{ objectPosition: `${focalX}% ${focalY}%` }}
            />
          )}
          {shouldRenderVideo && (
            <video
              ref={videoRef}
              key={background.videoUrl}
              src={background.videoUrl}
              poster={posterToRender || undefined}
              muted
              playsInline
              loop={background.videoLoop}
              autoPlay={background.videoAutoplay}
              preload="metadata"
              onError={() => setVideoPlaybackFailed(true)}
              className="absolute inset-0 w-full h-full"
              style={{
                objectFit: background.imageFit || 'cover',
                objectPosition: `${focalX}% ${focalY}%`,
              }}
            />
          )}
        </div>
      )}

      {/* Configurable Contrast Overlay */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0"
        style={{
          backgroundColor: hexToRgba(
            background.overlayColor || '#05060b',
            (background.overlayOpacity ?? 55) / 100
          ),
        }}
      />

      {/* Atmospheric Arena Spotlights, Court Lines & Golden Particles */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden spl-broadcast-layer">
        {animations.spotlightEffects && (
          <>
            <div
              className={`${animationsActive && animations.backgroundMotion ? 'spl-spotlight-left ' : ''}absolute -top-28 -left-24 w-[28rem] h-[34rem] blur-3xl`}
              style={{
                background: `linear-gradient(180deg, ${hexToRgba(theme.accentColor || '#f59e0b', 0.22)} 0%, transparent 80%)`,
              }}
            />
            <div
              className={`${animationsActive && animations.backgroundMotion ? 'spl-spotlight-right ' : ''}absolute -top-28 -right-20 w-[30rem] h-[34rem] blur-3xl`}
              style={{
                background: `linear-gradient(180deg, ${hexToRgba(theme.borderColor || '#ef4444', 0.2)} 0%, transparent 80%)`,
              }}
            />
          </>
        )}

        <div
          className="absolute inset-x-0 top-0 h-px"
          style={{
            background: `linear-gradient(90deg, transparent 0%, ${hexToRgba(theme.borderColor || '#f59e0b', 0.45)} 50%, transparent 100%)`,
          }}
        />

        {background.showCourtPattern && (
          <svg
            className="hidden md:block absolute inset-0 w-full h-full opacity-[0.07] text-amber-200"
            viewBox="0 0 1200 600"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            preserveAspectRatio="xMidYMid slice"
          >
            <rect x="110" y="70" width="980" height="460" />
            <line x1="600" y1="70" x2="600" y2="530" strokeDasharray="8 6" />
            <line x1="250" y1="70" x2="250" y2="530" />
            <line x1="950" y1="70" x2="950" y2="530" />
            <line x1="110" y1="145" x2="1090" y2="145" />
            <line x1="110" y1="455" x2="1090" y2="455" />
          </svg>
        )}

        {animationsActive && animations.floatingParticles && (
          <>
            <span className="hidden sm:block spl-particle-float absolute top-[22%] left-[14%] w-1.5 h-1.5 rounded-full bg-amber-300/60" />
            <span className="hidden sm:block spl-particle-float absolute top-[34%] left-[44%] w-1 h-1 rounded-full bg-red-400/55" />
            <span className="hidden md:block spl-particle-float absolute top-[18%] right-[22%] w-1.5 h-1.5 rounded-full bg-amber-200/50" />
            <span className="hidden md:block spl-particle-float absolute bottom-[28%] right-[12%] w-1 h-1 rounded-full bg-orange-400/60" />
          </>
        )}
      </div>

      {/* Accessible Play/Pause toggle for video backgrounds */}
      {shouldRenderVideo && (
        <button
          type="button"
          onClick={toggleVideoPlay}
          aria-label={videoManuallyPaused ? 'Play background video' : 'Pause background video'}
          className="absolute bottom-3 right-3 z-20 inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-slate-950/75 hover:bg-slate-900 border border-white/15 text-[11px] font-semibold text-slate-200 backdrop-blur-md transition-colors cursor-pointer"
        >
          {videoManuallyPaused ? <Play className="w-3.5 h-3.5 text-amber-300" /> : <Pause className="w-3.5 h-3.5 text-amber-300" />}
          <span className="hidden sm:inline">{videoManuallyPaused ? 'Play Video' : 'Pause Video'}</span>
        </button>
      )}

      <div className="relative z-10 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div
          className={
            showTwoColumnGrid
              ? 'grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-10 items-stretch'
              : 'grid grid-cols-1 gap-6 items-stretch'
          }
        >
          {/* Text & Branding Column */}
          <div
            className={`${
              showTwoColumnGrid ? 'lg:col-span-6 xl:col-span-7' : 'col-span-1 max-w-4xl mx-auto w-full'
            } flex flex-col justify-center space-y-5 sm:space-y-6 ${alignWrapperClass}`}
          >
            {/* Hero Logo Block */}
            {logo.visible && (
              <div className={`w-full flex ${logoJustifyClass} ${getStaggerClass('logo')}`}>
                {logo.customLogoUrl ? (
                  <div className="inline-flex flex-col sm:flex-row items-center gap-3">
                    <img
                      src={logo.customLogoUrl}
                      alt="Smash Premier League Official Logo"
                      className={`${customLogoHeightClass} w-auto max-w-[240px] sm:max-w-[320px] object-contain drop-shadow-[0_12px_28px_rgba(0,0,0,0.65)]`}
                    />
                    {logo.subtitle && (
                      <div className="text-center sm:text-left">
                        <span className="block text-xs font-display font-bold uppercase tracking-[0.22em] text-amber-300">
                          {logo.subtitle}
                        </span>
                      </div>
                    )}
                  </div>
                ) : (
                  <SPLLogo
                    variant="hero"
                    size={isMobileViewport ? logo.mobileSize || 'md' : logo.desktopSize === 'xl' ? 'lg' : logo.desktopSize || 'md'}
                    animated={animationsActive && logo.entranceAnimation && animations.logoEntrance}
                    subtitle={logo.subtitle || 'SPL 3.0 · CHAMPION EDITION'}
                  />
                )}
              </div>
            )}

            {/* Kicker */}
            {text.kickerVisible && text.kickerText && (
              <div
                className={`${getStaggerClass('heading')} flex items-center ${alignFlexJustify} gap-2.5 text-xs font-display font-black uppercase tracking-[0.26em]`}
                style={{ color: text.kickerColor || '#fcd34d' }}
              >
                <span
                  className="h-[2px] w-7 rounded-full shrink-0"
                  style={{
                    background: `linear-gradient(90deg, ${theme.accentColor || '#ef4444'} 0%, ${text.kickerColor || '#fcd34d'} 100%)`,
                  }}
                />
                <span>{text.kickerText}</span>
                <span className="text-slate-600">·</span>
                <span className="text-slate-300 truncate">{organizerLabel}</span>
              </div>
            )}

            {/* Headings & Copy */}
            <div className={`${getStaggerClass('heading')} space-y-3 w-full`}>
              {text.mainHeading.visible && text.mainHeading.text && (
                <h1
                  className="font-display tracking-tight uppercase leading-[1.03] text-balance break-words"
                  style={{
                    color: text.mainHeading.color || theme.headingColor || '#ffffff',
                    fontWeight: Number(text.mainHeading.fontWeight) || 900,
                    fontSize: computeResponsiveFontSize(
                      text.mainHeading.fontSizeDesktop,
                      text.mainHeading.fontSizeMobile
                    ),
                    fontFamily: `'${text.fontFamily}', 'Outfit', sans-serif`,
                  }}
                >
                  {text.mainHeading.text}
                </h1>
              )}

              {text.subtitle.visible && text.subtitle.text && (
                <p
                  className={`${getStaggerClass('subtitle')} uppercase tracking-wider leading-snug break-words`}
                  style={{
                    color: text.subtitle.color || '#cbd5e1',
                    fontWeight: Number(text.subtitle.fontWeight) || 700,
                    fontSize: computeResponsiveFontSize(
                      text.subtitle.fontSizeDesktop,
                      text.subtitle.fontSizeMobile
                    ),
                  }}
                >
                  {text.subtitle.text}
                </p>
              )}

              {text.tagline.visible && text.tagline.text && (
                <p
                  className={`${getStaggerClass('subtitle')} font-display uppercase italic tracking-[0.06em] break-words`}
                  style={{
                    color: text.tagline.color || '#fde047',
                    fontWeight: Number(text.tagline.fontWeight) || 900,
                    fontSize: computeResponsiveFontSize(
                      text.tagline.fontSizeDesktop,
                      text.tagline.fontSizeMobile
                    ),
                  }}
                >
                  {text.tagline.text}
                </p>
              )}

              {text.description.visible && (text.description.text || announcementText) && (
                <div
                  className={`${getStaggerClass('subtitle')} max-w-xl ${
                    effectiveAlign === 'center'
                      ? 'mx-auto'
                      : effectiveAlign === 'right'
                        ? 'mx-auto lg:ml-auto lg:mr-0'
                        : 'mx-auto lg:mx-0'
                  } leading-relaxed whitespace-pre-line break-words`}
                  style={{
                    color: text.description.color || '#cbd5e1',
                    fontWeight: Number(text.description.fontWeight) || 500,
                    fontSize: computeResponsiveFontSize(
                      text.description.fontSizeDesktop,
                      text.description.fontSizeMobile
                    ),
                  }}
                >
                  {text.description.text}
                  {text.showAnnouncementLine && announcementText ? (
                    <span className="block mt-1.5 text-xs sm:text-sm text-amber-200/90 font-medium">
                      {announcementText}
                    </span>
                  ) : null}
                </div>
              )}
            </div>

            {/* Action CTAs with Non-Bypassable Registration Lock */}
            {sortedVisibleButtons.length > 0 && (
              <div className={`${getStaggerClass('buttons')} w-full ${buttonGroupLayoutClass}`}>
                {sortedVisibleButtons.map((btn) => {
                  const isRegAction = btn.role === 'registration' || btn.actionTarget === 'register' || btn.actionTarget === '/register';

                  if (isRegAction && !isRegistrationOpen) {
                    return (
                      <button
                        key={btn.id}
                        type="button"
                        disabled
                        aria-disabled="true"
                        className="w-full sm:w-auto flex items-center justify-center gap-2.5 px-6 py-3.5 min-h-[48px] rounded-xl font-display font-black text-xs sm:text-sm uppercase tracking-wider text-slate-400 bg-slate-800/90 border border-slate-700 cursor-not-allowed whitespace-nowrap"
                      >
                        <Lock className="w-4 h-4 shrink-0 text-slate-400" />
                        <span>REGISTRATION CLOSED</span>
                      </button>
                    );
                  }

                  const resolved = resolveButtonStyle(btn);

                  return (
                    <button
                      key={btn.id}
                      type="button"
                      onClick={() => handleActionClick(btn)}
                      style={resolved.style}
                      className={`group relative overflow-hidden w-full sm:w-auto flex items-center justify-center gap-2.5 px-6 py-3.5 min-h-[48px] rounded-xl font-display font-black text-xs sm:text-sm uppercase tracking-wider transition-all duration-200 cursor-pointer whitespace-nowrap ${resolved.className}`}
                    >
                      {btn.role === 'registration' ? (
                        <>
                          <PlusCircle className="w-4 h-4 shrink-0" />
                          <span>{btn.label}</span>
                          <ArrowRight className="w-4 h-4 shrink-0 transition-transform group-hover:translate-x-0.5" />
                        </>
                      ) : btn.role === 'live' ? (
                        <>
                          {liveMatchesCount > 0 ? (
                            <span className="relative flex h-2.5 w-2.5 shrink-0">
                              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
                              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-red-500" />
                            </span>
                          ) : (
                            <Play className="w-4 h-4 shrink-0 text-red-400" />
                          )}
                          <span>{btn.label}</span>
                        </>
                      ) : (
                        <>
                          <Calendar className="w-4 h-4 shrink-0 text-amber-300" />
                          <span>{btn.label}</span>
                        </>
                      )}
                    </button>
                  );
                })}
              </div>
            )}

            {!isRegistrationOpen && (
              <p className={`text-xs sm:text-sm text-slate-400 font-medium flex items-center ${alignFlexJustify} gap-2`}>
                <Lock className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                <span>Registration for Smash Premier League 3.0 is currently closed.</span>
              </p>
            )}
          </div>

          {/* Right Column Showcase Visual */}
          {showTwoColumnGrid && (
            <div className={`lg:col-span-6 xl:col-span-5 flex items-stretch ${getStaggerClass('subtitle')}`}>
              <BadmintonHeroVisual venue={venueLabel} />
            </div>
          )}
        </div>

        {/* Live Tournament Information Strip */}
        {theme.showInfoStrip && (
          <div
            aria-label="Live Tournament Information Strip"
            className="mt-8 sm:mt-10 rounded-2xl border border-white/10 bg-[#0b0e18]/85 backdrop-blur-md p-3.5 sm:p-4 shadow-[0_18px_40px_-20px_rgba(0,0,0,0.9)]"
          >
            <div
              className={`grid ${
                isMobileViewport
                  ? 'grid-cols-1 gap-3 divide-y divide-white/10'
                  : 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 sm:gap-4 divide-y sm:divide-y-0 sm:divide-x divide-white/10'
              }`}
            >
              {/* 1. Tournament Name */}
              <div className="pt-1 sm:pt-0 sm:pr-3 min-w-0">
                <span className="block text-[10px] font-display font-bold uppercase tracking-[0.2em] text-slate-400">
                  Tournament
                </span>
                <span
                  title={tournamentName}
                  className="mt-1 block text-sm sm:text-base font-display font-black text-white truncate"
                >
                  {tournamentName || 'Not Configured'}
                </span>
              </div>

              {/* 2. Current Stage */}
              <div className="pt-2.5 sm:pt-0 sm:pl-4 sm:pr-3 min-w-0">
                <span className="block text-[10px] font-display font-bold uppercase tracking-[0.2em] text-slate-400">
                  Current Stage
                </span>
                <span className="mt-1 block text-sm sm:text-base font-display font-black text-amber-300 truncate">
                  {currentTournamentStage}
                </span>
              </div>

              {/* 3. Registered Teams */}
              <div className="pt-2.5 sm:pt-0 sm:pl-4 sm:pr-3 min-w-0">
                <span className="block text-[10px] font-display font-bold uppercase tracking-[0.2em] text-slate-400">
                  Registered Teams
                </span>
                <span className="mt-1 block text-sm sm:text-base font-mono font-black text-white tabular-nums">
                  {teamsCount > 0 ? `${teamsCount} Teams` : 'No Teams Yet'}
                </span>
              </div>

              {/* 4. Active Live Matches */}
              <div className="pt-2.5 sm:pt-0 sm:pl-4 sm:pr-3 min-w-0">
                <span className="block text-[10px] font-display font-bold uppercase tracking-[0.2em] text-slate-400">
                  Active Live Matches
                </span>
                <div className="mt-1 flex items-center gap-2">
                  {liveMatchesCount > 0 && (
                    <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse shrink-0" />
                  )}
                  <span
                    className={`text-sm sm:text-base font-mono font-black tabular-nums ${
                      liveMatchesCount > 0 ? 'text-red-400' : 'text-slate-300'
                    }`}
                  >
                    {liveMatchesCount > 0 ? `${liveMatchesCount} Live` : '0 Live'}
                  </span>
                </div>
              </div>

              {/* 5. Next / Active Match Info */}
              <div className="pt-2.5 sm:pt-0 sm:pl-4 min-w-0">
                <span className="block text-[10px] font-display font-bold uppercase tracking-[0.2em] text-slate-400">
                  {featuredFixture?.status === 'live' ? 'On Court Now' : 'Upcoming Match'}
                </span>
                {featuredFixture ? (
                  <div className="mt-1 min-w-0">
                    <span className="block text-xs sm:text-sm font-bold text-white truncate">
                      {(getTeam?.(featuredFixture.teamA)?.name || 'TBD')} vs{' '}
                      {(getTeam?.(featuredFixture.teamB)?.name || 'TBD')}
                    </span>
                    <span className="block text-[11px] font-mono text-amber-300/90 truncate">
                      {featuredFixture.courtName || `Court ${featuredFixture.court}`}
                      {featuredFixture.stageLabel ? ` · ${featuredFixture.stageLabel}` : ''}
                    </span>
                  </div>
                ) : (
                  <span className="mt-1 block text-xs sm:text-sm font-semibold text-slate-400 truncate">
                    No Upcoming Fixtures
                  </span>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </section>
  );
};
