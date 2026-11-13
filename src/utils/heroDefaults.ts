import {
  HeroAnimationPreset,
  HeroButtonActionTarget,
  HeroButtonConfig,
  HeroConfig,
  HeroFontFamily,
  HeroThemePresetId,
} from '../types/tournament';

export const HERO_FONT_OPTIONS: { value: HeroFontFamily; label: string; sample: string }[] = [
  { value: 'Outfit', label: 'Outfit (Championship Display)', sample: 'CHAMPION EDITION' },
  { value: 'Barlow Condensed', label: 'Barlow Condensed (Broadcast Poster)', sample: 'SPL 3.0 ARENA' },
  { value: 'Oswald', label: 'Oswald (Athletic Arena)', sample: 'RISE. SMASH. CONQUER.' },
  { value: 'Plus Jakarta Sans', label: 'Plus Jakarta Sans (Modern Sans)', sample: 'Official Championship' },
  { value: 'Manrope', label: 'Manrope (Editorial Precision)', sample: 'Matchday Broadcast' },
  { value: 'DM Sans', label: 'DM Sans (Clean Geometric)', sample: 'Live Tournament' },
];

export const APPROVED_HERO_ACTION_TARGETS: {
  value: HeroButtonActionTarget;
  label: string;
}[] = [
  { value: 'register', label: 'Player Registration Portal (/register)' },
  { value: '#live-match', label: 'Live Match Broadcast (#live-match)' },
  { value: '#matches-schedule', label: 'Fixtures & Results (#matches-schedule)' },
  { value: '#teams-roster', label: 'Meet the Contenders (#teams-roster)' },
  { value: '#standings-table', label: 'Official Standings (#standings-table)' },
  { value: '#tournament-info', label: 'Venue & Rules (#tournament-info)' },
  { value: '/register', label: 'Direct Registration Route (/register)' },
  { value: 'custom-url', label: 'External HTTPS URL (Validated)' },
];

export const HERO_ANIMATION_PRESETS: {
  value: HeroAnimationPreset;
  label: string;
  description: string;
}[] = [
  {
    value: 'staggered-broadcast',
    label: 'Staggered Broadcast',
    description: 'Signature sports reveal with layered headline entrance and stadium beams.',
  },
  {
    value: 'cinematic-fade',
    label: 'Cinematic Fade',
    description: 'Smooth low-amplitude broadcast fade across hero typography and actions.',
  },
  {
    value: 'kinetic-smash',
    label: 'Kinetic Smash',
    description: 'Crisp athletic entrance with energized logo scale and button highlight.',
  },
  {
    value: 'minimal',
    label: 'Minimal Motion',
    description: 'Clean ultra-light entrance suited for low-motion environments.',
  },
  {
    value: 'none',
    label: 'Static (No Animation)',
    description: 'Disables all Hero entrance and ambient motion.',
  },
];

export interface HeroThemePresetDefinition {
  id: Exclude<HeroThemePresetId, 'custom'>;
  name: string;
  description: string;
  gradientStart: string;
  gradientMid: string;
  gradientEnd: string;
  headingColor: string;
  accentColor: string;
  borderColor: string;
  kickerColor: string;
  taglineColor: string;
  overlayColor: string;
}

export const HERO_THEME_PRESETS: HeroThemePresetDefinition[] = [
  {
    id: 'championship-gold',
    name: 'Championship Gold',
    description: 'Midnight black arena canvas with metallic gold & crimson championship highlights.',
    gradientStart: '#05060b',
    gradientMid: '#120b09',
    gradientEnd: '#05060b',
    headingColor: '#ffffff',
    accentColor: '#f59e0b',
    borderColor: '#f59e0b',
    kickerColor: '#fcd34d',
    taglineColor: '#fde047',
    overlayColor: '#05060b',
  },
  {
    id: 'electric-arena',
    name: 'Electric Arena',
    description: 'High-voltage crimson & emerald broadcast night look inspired by knockout courts.',
    gradientStart: '#050811',
    gradientMid: '#160b1d',
    gradientEnd: '#060a14',
    headingColor: '#f8fafc',
    accentColor: '#f43f5e',
    borderColor: '#a855f7',
    kickerColor: '#fda4af',
    taglineColor: '#67e8f9',
    overlayColor: '#050711',
  },
  {
    id: 'royal-championship',
    name: 'Royal Championship',
    description: 'Deep navy stadium lighting paired with royal sapphire and champagne gold.',
    gradientStart: '#04091a',
    gradientMid: '#0b1838',
    gradientEnd: '#040814',
    headingColor: '#ffffff',
    accentColor: '#38bdf8',
    borderColor: '#38bdf8',
    kickerColor: '#7dd3fc',
    taglineColor: '#fbbf24',
    overlayColor: '#040816',
  },
];

const DEFAULT_HERO_BUTTONS: HeroButtonConfig[] = [
  {
    id: 'register',
    role: 'registration',
    label: 'REGISTER NOW',
    visible: true,
    order: 1,
    style: 'gold-primary',
    customBgColor: '#f59e0b',
    customTextColor: '#090d16',
    customBorderColor: '#fbbf24',
    actionTarget: 'register',
    customUrl: '',
    hoverEffect: 'lift-glow',
  },
  {
    id: 'live',
    role: 'live',
    label: 'WATCH LIVE MATCHES',
    visible: true,
    order: 2,
    style: 'crimson-outline',
    customBgColor: '#450a0a',
    customTextColor: '#ffffff',
    customBorderColor: '#ef4444',
    actionTarget: '#live-match',
    customUrl: '',
    hoverEffect: 'lift-glow',
  },
  {
    id: 'schedule',
    role: 'schedule',
    label: 'VIEW MATCH SCHEDULE',
    visible: true,
    order: 3,
    style: 'glass-outline',
    customBgColor: '#0f172a',
    customTextColor: '#f1f5f9',
    customBorderColor: '#64748b',
    actionTarget: '#matches-schedule',
    customUrl: '',
    hoverEffect: 'lift-glow',
  },
];

export const DEFAULT_HERO_VERSION_COLOR = '#fbbf24';

export const DEFAULT_HERO_CONFIG: HeroConfig = {
  version: 1,
  status: 'published',
  updatedAt: 1730000000000,
  updatedBy: 'Tournament Director',
  publishedAt: 1730000000000,
  publishedBy: 'Tournament Director',
  background: {
    type: 'gradient',
    imageUrl: '',
    imageStoragePath: '',
    mobileImageUrl: '',
    mobileImageStoragePath: '',
    focalPointX: 50,
    focalPointY: 50,
    mobileFocalPointX: 50,
    mobileFocalPointY: 50,
    imageFit: 'cover',
    videoUrl: '',
    videoStoragePath: '',
    videoPosterUrl: '',
    videoPosterStoragePath: '',
    videoAutoplay: true,
    videoLoop: true,
    videoPlayOnMobile: true,
    overlayOpacity: 55,
    overlayColor: '#05060b',
    solidColor: '#05060b',
    gradientStart: '#05060b',
    gradientMid: '#120b09',
    gradientEnd: '#05060b',
    gradientDirection: 'to-br',
    showCourtPattern: true,
    backgroundMotion: true,
  },
  logo: {
    visible: true,
    customLogoUrl: '',
    customLogoStoragePath: '',
    customLogoMime: '',
    subtitle: 'SPL 3.0 · CHAMPION EDITION',
    desktopSize: 'md',
    mobileSize: 'md',
    alignment: 'inherit',
    entranceAnimation: true,
    applyGlobalNavbarBranding: false,
  },
  text: {
    alignment: 'left',
    fontFamily: 'Outfit',
    kickerText: 'CHAMPION EDITION',
    kickerVisible: true,
    kickerColor: '#fcd34d',
    versionColor: DEFAULT_HERO_VERSION_COLOR,
    mainHeading: {
      text: 'SMASH PREMIER LEAGUE 3.0',
      visible: true,
      color: '#ffffff',
      fontSizeDesktop: 58,
      fontSizeMobile: 34,
      fontWeight: '900',
    },
    subtitle: {
      text: 'Official Badminton Championship · Maharajganj',
      visible: false,
      color: '#cbd5e1',
      fontSizeDesktop: 18,
      fontSizeMobile: 14,
      fontWeight: '700',
    },
    tagline: {
      text: '“RISE. SMASH. CONQUER.”',
      visible: true,
      color: '#fde047',
      fontSizeDesktop: 26,
      fontSizeMobile: 18,
      fontWeight: '900',
    },
    description: {
      text: 'Where Champions Rise and Legends Are Made.',
      visible: true,
      color: '#cbd5e1',
      fontSizeDesktop: 17,
      fontSizeMobile: 14,
      fontWeight: '500',
    },
    showAnnouncementLine: true,
  },
  buttons: {
    desktopLayout: 'row',
    mobileLayout: 'stacked',
    buttons: DEFAULT_HERO_BUTTONS,
  },
  theme: {
    preset: 'championship-gold',
    sectionHeight: 'standard',
    contentAlignment: 'left',
    headingColor: '#ffffff',
    accentColor: '#f59e0b',
    borderColor: '#f59e0b',
    showRightShowcaseCard: true,
    showInfoStrip: true,
  },
  animations: {
    enabled: true,
    preset: 'staggered-broadcast',
    intensity: 'balanced',
    durationScale: 1,
    logoEntrance: true,
    headingReveal: true,
    subtitleAnimation: true,
    buttonEntrance: true,
    backgroundMotion: true,
    floatingParticles: true,
    spotlightEffects: true,
  },
};

export function cloneHeroConfig(config: HeroConfig): HeroConfig {
  return JSON.parse(JSON.stringify(config)) as HeroConfig;
}

export function sanitizePlainText(input: unknown, maxLength = 320): string {
  if (input === null || input === undefined) return '';
  let str = String(input);
  // Strip null bytes and dangerous tags cleanly
  str = str.replace(/\0/g, '');
  str = str.replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, '');
  str = str.replace(/<style[\s\S]*?>[\s\S]*?<\/style>/gi, '');
  str = str.replace(/<[^>]+>/g, '');
  str = str.replace(/javascript\s*:/gi, '');
  str = str.replace(/\r\n/g, '\n');
  if (str.length > maxLength) {
    str = str.slice(0, maxLength);
  }
  return str.trim();
}

export function sanitizeHexColor(input: unknown, fallback: string): string {
  if (typeof input !== 'string') return fallback;
  const trimmed = input.trim();
  if (/^#[0-9a-fA-F]{6}$/.test(trimmed)) return trimmed.toLowerCase();
  if (/^#[0-9a-fA-F]{3}$/.test(trimmed)) {
    const r = trimmed[1];
    const g = trimmed[2];
    const b = trimmed[3];
    return `#${r}${r}${g}${g}${b}${b}`.toLowerCase();
  }
  return fallback;
}

export function validateMediaUrl(input: unknown): string {
  if (typeof input !== 'string') return '';
  const trimmed = input.trim();
  if (!trimmed) return '';
  const lower = trimmed.toLowerCase();
  if (
    lower.startsWith('javascript:') ||
    lower.startsWith('vbscript:') ||
    lower.startsWith('data:text/') ||
    lower.startsWith('data:application/')
  ) {
    return '';
  }
  if (trimmed.startsWith('/api/hero/media/') || trimmed.startsWith('/assets/')) {
    return trimmed;
  }
  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol === 'https:' || (parsed.protocol === 'http:' && parsed.hostname === 'localhost')) {
      return parsed.toString();
    }
  } catch {
    // Allow safe root-relative asset paths without ".." traversal
    if (trimmed.startsWith('/') && !trimmed.includes('..') && !trimmed.includes('<')) {
      return trimmed;
    }
  }
  return '';
}

export function validateHeroActionDestination(
  actionTarget: unknown,
  customUrl: unknown
): {
  valid: boolean;
  target: HeroButtonActionTarget;
  customUrl: string;
  error?: string;
} {
  const allowedTargets = new Set<HeroButtonActionTarget>([
    'register',
    '#live-match',
    '#matches-schedule',
    '#teams-roster',
    '#standings-table',
    '#tournament-info',
    '/register',
    'custom-url',
  ]);

  const target: HeroButtonActionTarget = allowedTargets.has(actionTarget as HeroButtonActionTarget)
    ? (actionTarget as HeroButtonActionTarget)
    : '#live-match';

  if (target !== 'custom-url') {
    return { valid: true, target, customUrl: '' };
  }

  const rawUrl = typeof customUrl === 'string' ? customUrl.trim() : '';
  if (!rawUrl) {
    return {
      valid: false,
      target,
      customUrl: '',
      error: 'Please enter a destination HTTPS URL or select an approved tournament section.',
    };
  }

  if (/^(javascript|data|vbscript):/i.test(rawUrl)) {
    return {
      valid: false,
      target,
      customUrl: '',
      error: 'Unsafe URI scheme rejected. Only valid https:// URLs or internal sections are allowed.',
    };
  }

  try {
    const parsed = new URL(rawUrl);
    if (parsed.protocol !== 'https:') {
      return {
        valid: false,
        target,
        customUrl: '',
        error: 'External destinations must use secure https:// URLs.',
      };
    }
    return { valid: true, target, customUrl: parsed.toString() };
  } catch {
    return {
      valid: false,
      target,
      customUrl: '',
      error: 'Invalid URL format. Enter a complete https:// address.',
    };
  }
}

export function sanitizeSvgMarkup(rawSvg: string): { valid: boolean; sanitized: string; error?: string } {
  if (!rawSvg || typeof rawSvg !== 'string') {
    return { valid: false, sanitized: '', error: 'Empty SVG file.' };
  }
  if (!/<svg[\s>]/i.test(rawSvg) || !/<\/svg>/i.test(rawSvg)) {
    return { valid: false, sanitized: '', error: 'Invalid SVG document structure.' };
  }

  let cleaned = rawSvg
    // Remove XML/DOCTYPE instructions that may reference external DTDs
    .replace(/<!DOCTYPE[\s\S]*?>/gi, '')
    .replace(/<\?xml[\s\S]*?\?>/gi, '')
    // Remove dangerous elements
    .replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, '')
    .replace(/<script[\s\S]*?\/>/gi, '')
    .replace(/<foreignObject[\s\S]*?>[\s\S]*?<\/foreignObject>/gi, '')
    .replace(/<iframe[\s\S]*?>[\s\S]*?<\/iframe>/gi, '')
    .replace(/<object[\s\S]*?>[\s\S]*?<\/object>/gi, '')
    .replace(/<embed[\s\S]*?>[\s\S]*?<\/embed>/gi, '')
    .replace(/<link[\s\S]*?>/gi, '')
    // Remove inline event handlers (onload, onclick, onerror, etc.)
    .replace(/\son[a-z]+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, '')
    // Remove javascript: or data:text/html links in href / xlink:href / src
    .replace(/(href|xlink:href|src)\s*=\s*["']\s*(?:javascript|vbscript|data:text\/html)[^"']*["']/gi, '$1=""')
    // Block external <use> references
    .replace(/<use[^>]*href\s*=\s*["']https?:[^"']*["'][^>]*\/?>/gi, '');

  if (!/<svg[\s>]/i.test(cleaned)) {
    return { valid: false, sanitized: '', error: 'SVG failed safety sanitization.' };
  }

  return { valid: true, sanitized: cleaned.trim() };
}

function clampNumber(val: unknown, min: number, max: number, fallback: number): number {
  const num = Number(val);
  if (!Number.isFinite(num)) return fallback;
  return Math.min(max, Math.max(min, num));
}

export function normalizeHeroConfig(input?: Partial<HeroConfig> | null): HeroConfig {
  const base = cloneHeroConfig(DEFAULT_HERO_CONFIG);
  if (!input || typeof input !== 'object') return base;

  const raw = input as any;

  const allowedFonts = new Set<HeroFontFamily>(HERO_FONT_OPTIONS.map((f) => f.value));
  const allowedHeights = new Set(['compact', 'standard', 'tall', 'fullscreen']);
  const allowedAlignments = new Set(['left', 'center', 'right']);
  const allowedAnimPresets = new Set([
    'staggered-broadcast',
    'cinematic-fade',
    'kinetic-smash',
    'minimal',
    'none',
  ]);
  const allowedThemePresets = new Set([
    'championship-gold',
    'electric-arena',
    'royal-championship',
    'custom',
  ]);

  const normalizedBgType =
    raw.background?.type === 'image' || raw.background?.type === 'video'
      ? raw.background.type
      : 'gradient';

  const normalizedFit =
    raw.background?.imageFit === 'contain' || raw.background?.imageFit === 'fill'
      ? raw.background.imageFit
      : 'cover';

  const normalizedGradDir =
    raw.background?.gradientDirection === 'to-b' ||
    raw.background?.gradientDirection === 'to-r' ||
    raw.background?.gradientDirection === 'radial'
      ? raw.background.gradientDirection
      : 'to-br';

  const normalizeField = (rawField: any, defField: typeof base.text.mainHeading, maxLen: number) => ({
    text: rawField?.text !== undefined ? sanitizePlainText(rawField.text, maxLen) : defField.text,
    visible: typeof rawField?.visible === 'boolean' ? rawField.visible : defField.visible,
    color: sanitizeHexColor(rawField?.color, defField.color),
    fontSizeDesktop: clampNumber(rawField?.fontSizeDesktop, 12, 92, defField.fontSizeDesktop),
    fontSizeMobile: clampNumber(rawField?.fontSizeMobile, 11, 56, defField.fontSizeMobile),
    fontWeight: (['500', '600', '700', '800', '900'].includes(String(rawField?.fontWeight))
      ? String(rawField.fontWeight)
      : defField.fontWeight) as typeof defField.fontWeight,
  });

  const rawButtons: any[] = Array.isArray(raw.buttons?.buttons) ? raw.buttons.buttons : [];
  const normalizedButtons: HeroButtonConfig[] = DEFAULT_HERO_BUTTONS.map((defBtn) => {
    const match = rawButtons.find((b) => b?.id === defBtn.id || b?.role === defBtn.role);
    if (!match) return { ...defBtn };

    const actionCheck =
      defBtn.role === 'registration'
        ? { valid: true, target: 'register' as HeroButtonActionTarget, customUrl: '' }
        : validateHeroActionDestination(match.actionTarget, match.customUrl);

    const allowedStyles = new Set([
      'gold-primary',
      'crimson-outline',
      'glass-outline',
      'emerald-solid',
      'royal-solid',
      'custom',
    ]);
    const allowedHovers = new Set(['lift-glow', 'scale', 'shine', 'none']);

    return {
      id: defBtn.id,
      role: defBtn.role,
      label: sanitizePlainText(match.label, 48) || defBtn.label,
      visible: typeof match.visible === 'boolean' ? match.visible : defBtn.visible,
      order: clampNumber(match.order, 1, 10, defBtn.order),
      style: (allowedStyles.has(match.style) ? match.style : defBtn.style) as HeroButtonConfig['style'],
      customBgColor: sanitizeHexColor(match.customBgColor, defBtn.customBgColor),
      customTextColor: sanitizeHexColor(match.customTextColor, defBtn.customTextColor),
      customBorderColor: sanitizeHexColor(match.customBorderColor, defBtn.customBorderColor),
      actionTarget: actionCheck.target,
      customUrl: actionCheck.valid ? actionCheck.customUrl : '',
      hoverEffect: (allowedHovers.has(match.hoverEffect)
        ? match.hoverEffect
        : defBtn.hoverEffect) as HeroButtonConfig['hoverEffect'],
    };
  }).sort((a, b) => a.order - b.order);

  const resolvedThemeAlignment = allowedAlignments.has(raw.theme?.contentAlignment)
    ? raw.theme.contentAlignment
    : allowedAlignments.has(raw.text?.alignment)
      ? raw.text.alignment
      : base.theme.contentAlignment;

  return {
    version: clampNumber(raw.version, 1, 999999, base.version),
    status: raw.status === 'draft' ? 'draft' : 'published',
    updatedAt: Number.isFinite(Number(raw.updatedAt)) ? Number(raw.updatedAt) : base.updatedAt,
    updatedBy: sanitizePlainText(raw.updatedBy, 80) || base.updatedBy,
    publishedAt: Number.isFinite(Number(raw.publishedAt)) ? Number(raw.publishedAt) : base.publishedAt,
    publishedBy: sanitizePlainText(raw.publishedBy, 80) || base.publishedBy,
    background: {
      type: normalizedBgType,
      imageUrl: validateMediaUrl(raw.background?.imageUrl),
      imageStoragePath: sanitizePlainText(raw.background?.imageStoragePath, 260),
      mobileImageUrl: validateMediaUrl(raw.background?.mobileImageUrl),
      mobileImageStoragePath: sanitizePlainText(raw.background?.mobileImageStoragePath, 260),
      focalPointX: clampNumber(raw.background?.focalPointX, 0, 100, base.background.focalPointX),
      focalPointY: clampNumber(raw.background?.focalPointY, 0, 100, base.background.focalPointY),
      mobileFocalPointX: clampNumber(
        raw.background?.mobileFocalPointX,
        0,
        100,
        base.background.mobileFocalPointX
      ),
      mobileFocalPointY: clampNumber(
        raw.background?.mobileFocalPointY,
        0,
        100,
        base.background.mobileFocalPointY
      ),
      imageFit: normalizedFit,
      videoUrl: validateMediaUrl(raw.background?.videoUrl),
      videoStoragePath: sanitizePlainText(raw.background?.videoStoragePath, 260),
      videoPosterUrl: validateMediaUrl(raw.background?.videoPosterUrl),
      videoPosterStoragePath: sanitizePlainText(raw.background?.videoPosterStoragePath, 260),
      videoAutoplay:
        typeof raw.background?.videoAutoplay === 'boolean'
          ? raw.background.videoAutoplay
          : base.background.videoAutoplay,
      videoLoop:
        typeof raw.background?.videoLoop === 'boolean'
          ? raw.background.videoLoop
          : base.background.videoLoop,
      videoPlayOnMobile:
        typeof raw.background?.videoPlayOnMobile === 'boolean'
          ? raw.background.videoPlayOnMobile
          : base.background.videoPlayOnMobile,
      overlayOpacity: clampNumber(raw.background?.overlayOpacity, 0, 92, base.background.overlayOpacity),
      overlayColor: sanitizeHexColor(raw.background?.overlayColor, base.background.overlayColor),
      solidColor: sanitizeHexColor(raw.background?.solidColor, base.background.solidColor),
      gradientStart: sanitizeHexColor(raw.background?.gradientStart, base.background.gradientStart),
      gradientMid: sanitizeHexColor(raw.background?.gradientMid, base.background.gradientMid),
      gradientEnd: sanitizeHexColor(raw.background?.gradientEnd, base.background.gradientEnd),
      gradientDirection: normalizedGradDir,
      showCourtPattern:
        typeof raw.background?.showCourtPattern === 'boolean'
          ? raw.background.showCourtPattern
          : base.background.showCourtPattern,
      backgroundMotion:
        typeof raw.background?.backgroundMotion === 'boolean'
          ? raw.background.backgroundMotion
          : base.background.backgroundMotion,
    },
    logo: {
      visible: typeof raw.logo?.visible === 'boolean' ? raw.logo.visible : base.logo.visible,
      customLogoUrl: validateMediaUrl(raw.logo?.customLogoUrl),
      customLogoStoragePath: sanitizePlainText(raw.logo?.customLogoStoragePath, 260),
      customLogoMime: sanitizePlainText(raw.logo?.customLogoMime, 64),
      subtitle:
        raw.logo?.subtitle !== undefined
          ? sanitizePlainText(raw.logo.subtitle, 60)
          : base.logo.subtitle,
      desktopSize: (['sm', 'md', 'lg', 'xl'].includes(raw.logo?.desktopSize)
        ? raw.logo.desktopSize
        : base.logo.desktopSize) as HeroConfig['logo']['desktopSize'],
      mobileSize: (['sm', 'md', 'lg'].includes(raw.logo?.mobileSize)
        ? raw.logo.mobileSize
        : base.logo.mobileSize) as HeroConfig['logo']['mobileSize'],
      alignment: (['inherit', 'left', 'center', 'right'].includes(raw.logo?.alignment)
        ? raw.logo.alignment
        : base.logo.alignment) as HeroConfig['logo']['alignment'],
      entranceAnimation:
        typeof raw.logo?.entranceAnimation === 'boolean'
          ? raw.logo.entranceAnimation
          : base.logo.entranceAnimation,
      applyGlobalNavbarBranding:
        typeof raw.logo?.applyGlobalNavbarBranding === 'boolean'
          ? raw.logo.applyGlobalNavbarBranding
          : false,
    },
    text: {
      alignment: resolvedThemeAlignment,
      fontFamily: allowedFonts.has(raw.text?.fontFamily) ? raw.text.fontFamily : base.text.fontFamily,
      kickerText:
        raw.text?.kickerText !== undefined
          ? sanitizePlainText(raw.text.kickerText, 64)
          : base.text.kickerText,
      kickerVisible:
        typeof raw.text?.kickerVisible === 'boolean' ? raw.text.kickerVisible : base.text.kickerVisible,
      kickerColor: sanitizeHexColor(raw.text?.kickerColor, base.text.kickerColor),
      versionColor: sanitizeHexColor(raw.text?.versionColor, DEFAULT_HERO_VERSION_COLOR),
      mainHeading: normalizeField(raw.text?.mainHeading, base.text.mainHeading, 120),
      subtitle: normalizeField(raw.text?.subtitle, base.text.subtitle, 160),
      tagline: normalizeField(raw.text?.tagline, base.text.tagline, 120),
      description: normalizeField(raw.text?.description, base.text.description, 420),
      showAnnouncementLine:
        typeof raw.text?.showAnnouncementLine === 'boolean'
          ? raw.text.showAnnouncementLine
          : base.text.showAnnouncementLine,
    },
    buttons: {
      desktopLayout: (['row', 'wrap', 'stacked'].includes(raw.buttons?.desktopLayout)
        ? raw.buttons.desktopLayout
        : base.buttons.desktopLayout) as HeroConfig['buttons']['desktopLayout'],
      mobileLayout: (['stacked', 'row'].includes(raw.buttons?.mobileLayout)
        ? raw.buttons.mobileLayout
        : base.buttons.mobileLayout) as HeroConfig['buttons']['mobileLayout'],
      buttons: normalizedButtons,
    },
    theme: {
      preset: (allowedThemePresets.has(raw.theme?.preset)
        ? raw.theme.preset
        : base.theme.preset) as HeroThemePresetId,
      sectionHeight: (allowedHeights.has(raw.theme?.sectionHeight)
        ? raw.theme.sectionHeight
        : base.theme.sectionHeight) as HeroConfig['theme']['sectionHeight'],
      contentAlignment: resolvedThemeAlignment,
      headingColor: sanitizeHexColor(raw.theme?.headingColor, base.theme.headingColor),
      accentColor: sanitizeHexColor(raw.theme?.accentColor, base.theme.accentColor),
      borderColor: sanitizeHexColor(raw.theme?.borderColor, base.theme.borderColor),
      showRightShowcaseCard:
        typeof raw.theme?.showRightShowcaseCard === 'boolean'
          ? raw.theme.showRightShowcaseCard
          : base.theme.showRightShowcaseCard,
      showInfoStrip:
        typeof raw.theme?.showInfoStrip === 'boolean'
          ? raw.theme.showInfoStrip
          : base.theme.showInfoStrip,
    },
    animations: {
      enabled:
        typeof raw.animations?.enabled === 'boolean' ? raw.animations.enabled : base.animations.enabled,
      preset: (allowedAnimPresets.has(raw.animations?.preset)
        ? raw.animations.preset
        : base.animations.preset) as HeroAnimationPreset,
      intensity: (['subtle', 'balanced', 'energetic'].includes(raw.animations?.intensity)
        ? raw.animations.intensity
        : base.animations.intensity) as HeroConfig['animations']['intensity'],
      durationScale: clampNumber(raw.animations?.durationScale, 0.6, 1.5, base.animations.durationScale),
      logoEntrance:
        typeof raw.animations?.logoEntrance === 'boolean'
          ? raw.animations.logoEntrance
          : base.animations.logoEntrance,
      headingReveal:
        typeof raw.animations?.headingReveal === 'boolean'
          ? raw.animations.headingReveal
          : base.animations.headingReveal,
      subtitleAnimation:
        typeof raw.animations?.subtitleAnimation === 'boolean'
          ? raw.animations.subtitleAnimation
          : base.animations.subtitleAnimation,
      buttonEntrance:
        typeof raw.animations?.buttonEntrance === 'boolean'
          ? raw.animations.buttonEntrance
          : base.animations.buttonEntrance,
      backgroundMotion:
        typeof raw.animations?.backgroundMotion === 'boolean'
          ? raw.animations.backgroundMotion
          : base.animations.backgroundMotion,
      floatingParticles:
        typeof raw.animations?.floatingParticles === 'boolean'
          ? raw.animations.floatingParticles
          : base.animations.floatingParticles,
      spotlightEffects:
        typeof raw.animations?.spotlightEffects === 'boolean'
          ? raw.animations.spotlightEffects
          : base.animations.spotlightEffects,
    },
  };
}
