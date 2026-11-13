import type { YouTubeLiveConfig, YouTubeLiveStatus } from '../types/tournament';

export const YOUTUBE_VIDEO_ID_REGEX = /^[a-zA-Z0-9_-]{11}$/;

const YOUTUBE_ALLOWED_HOSTS = new Set([
  'youtube.com',
  'www.youtube.com',
  'm.youtube.com',
  'music.youtube.com',
  'youtu.be',
  'youtube-nocookie.com',
  'www.youtube-nocookie.com',
]);

export const DEFAULT_YOUTUBE_LIVE_CONFIG: YouTubeLiveConfig = {
  enabled: false,
  videoUrl: '',
  videoId: '',
  status: 'scheduled',
  title: 'SPL 3.0 Championship Court Live Broadcast',
  scheduledAt: '',
  allowReplay: true,
  updatedAt: 0,
  updatedBy: '',
};

export interface ExtractedYouTubeResult {
  valid: boolean;
  videoId: string;
  normalizedUrl: string;
  error?: string;
}

export function extractYouTubeVideoId(rawInput: string | null | undefined): ExtractedYouTubeResult {
  const trimmed = typeof rawInput === 'string' ? rawInput.trim() : '';
  if (!trimmed) {
    return { valid: false, videoId: '', normalizedUrl: '' };
  }

  const lower = trimmed.toLowerCase();
  if (
    lower.startsWith('javascript:') ||
    lower.startsWith('data:') ||
    lower.startsWith('vbscript:') ||
    lower.startsWith('file:')
  ) {
    return {
      valid: false,
      videoId: '',
      normalizedUrl: '',
      error: 'Unsafe URL protocol detected. Only valid YouTube URLs or 11-character Video IDs are allowed.',
    };
  }

  // Raw 11-character YouTube Video ID
  if (YOUTUBE_VIDEO_ID_REGEX.test(trimmed)) {
    return {
      valid: true,
      videoId: trimmed,
      normalizedUrl: `https://www.youtube.com/watch?v=${trimmed}`,
    };
  }

  // Support URLs entered without https:// prefix (e.g. youtube.com/watch?v=... or youtu.be/...)
  const candidate =
    lower.startsWith('http://') || lower.startsWith('https://') ? trimmed : `https://${trimmed}`;

  let parsed: URL;
  try {
    parsed = new URL(candidate);
  } catch {
    return {
      valid: false,
      videoId: '',
      normalizedUrl: '',
      error: 'Invalid YouTube URL format. Paste a valid youtube.com or youtu.be link.',
    };
  }

  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
    return {
      valid: false,
      videoId: '',
      normalizedUrl: '',
      error: 'Only http(s) YouTube URLs are supported.',
    };
  }

  const host = parsed.hostname.toLowerCase();
  if (!YOUTUBE_ALLOWED_HOSTS.has(host)) {
    return {
      valid: false,
      videoId: '',
      normalizedUrl: '',
      error: 'Only official YouTube links (youtube.com, youtu.be) are permitted.',
    };
  }

  let candidateId = '';
  const pathParts = parsed.pathname.split('/').filter(Boolean);

  if (host === 'youtu.be') {
    candidateId = pathParts[0] || '';
  } else {
    const vParam = parsed.searchParams.get('v');
    if (vParam) {
      candidateId = vParam;
    } else if (pathParts.length >= 2 && ['live', 'embed', 'shorts', 'v'].includes(pathParts[0])) {
      candidateId = pathParts[1] || '';
    }
  }

  // Strip stray characters or verify strict 11-char ID match
  candidateId = candidateId.trim();
  if (!YOUTUBE_VIDEO_ID_REGEX.test(candidateId)) {
    return {
      valid: false,
      videoId: '',
      normalizedUrl: '',
      error: 'Could not extract a valid 11-character YouTube Video ID from this link.',
    };
  }

  return {
    valid: true,
    videoId: candidateId,
    normalizedUrl: `https://www.youtube.com/watch?v=${candidateId}`,
  };
}

export function getYouTubeEmbedUrl(
  videoId: string,
  options?: { autoplay?: boolean; mute?: boolean }
): string {
  const cleanId = typeof videoId === 'string' ? videoId.trim() : '';
  if (!YOUTUBE_VIDEO_ID_REGEX.test(cleanId)) return '';
  const params = new URLSearchParams({
    autoplay: options?.autoplay ? '1' : '0',
    mute: options?.mute ? '1' : '0',
    rel: '0',
    modestbranding: '1',
    playsinline: '1',
  });
  return `https://www.youtube.com/embed/${cleanId}?${params.toString()}`;
}

export function getYouTubeWatchUrl(videoId: string): string {
  const cleanId = typeof videoId === 'string' ? videoId.trim() : '';
  if (!YOUTUBE_VIDEO_ID_REGEX.test(cleanId)) return '';
  return `https://www.youtube.com/watch?v=${cleanId}`;
}

export function getYouTubeThumbnailUrl(videoId: string): string {
  const cleanId = typeof videoId === 'string' ? videoId.trim() : '';
  if (!YOUTUBE_VIDEO_ID_REGEX.test(cleanId)) return '';
  return `https://i.ytimg.com/vi/${cleanId}/hqdefault.jpg`;
}

function cleanPlainLabel(val: unknown, maxLen: number): string {
  if (typeof val !== 'string') return '';
  return val.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim().slice(0, maxLen);
}

export function normalizeYouTubeLiveConfig(raw: unknown): YouTubeLiveConfig {
  const obj = raw && typeof raw === 'object' ? (raw as Record<string, any>) : {};
  const rawUrlOrId = typeof obj.videoUrl === 'string' && obj.videoUrl.trim()
    ? obj.videoUrl
    : typeof obj.videoId === 'string'
    ? obj.videoId
    : '';
  const extracted = extractYouTubeVideoId(rawUrlOrId);

  const rawStatus = String(obj.status || 'scheduled').toLowerCase();
  const status: YouTubeLiveStatus =
    rawStatus === 'live' || rawStatus === 'ended' ? (rawStatus as YouTubeLiveStatus) : 'scheduled';

  const title = cleanPlainLabel(obj.title, 120) || DEFAULT_YOUTUBE_LIVE_CONFIG.title;
  const scheduledAt = cleanPlainLabel(obj.scheduledAt, 60);
  const updatedBy = cleanPlainLabel(obj.updatedBy, 80);

  return {
    enabled: Boolean(obj.enabled) && extracted.valid,
    videoUrl: extracted.valid ? extracted.normalizedUrl : '',
    videoId: extracted.valid ? extracted.videoId : '',
    status,
    title,
    scheduledAt,
    allowReplay: obj.allowReplay !== undefined ? Boolean(obj.allowReplay) : true,
    updatedAt: Number.isFinite(Number(obj.updatedAt)) ? Number(obj.updatedAt) : 0,
    updatedBy,
  };
}

export interface YouTubeLiveCtaState {
  visible: boolean;
  mode: 'hidden' | 'scheduled' | 'live' | 'replay';
  label: string;
  sublabel?: string;
}

export function resolveYouTubeLiveCtaState(config?: YouTubeLiveConfig | null): YouTubeLiveCtaState {
  if (!config || !config.enabled || !YOUTUBE_VIDEO_ID_REGEX.test(config.videoId || '')) {
    return { visible: false, mode: 'hidden', label: '' };
  }

  if (config.status === 'live') {
    return {
      visible: true,
      mode: 'live',
      label: 'WATCH LIVE',
      sublabel: config.title || 'Live Match Stream',
    };
  }

  if (config.status === 'scheduled') {
    return {
      visible: true,
      mode: 'scheduled',
      label: 'Live Starting Soon',
      sublabel: config.scheduledAt || 'Stream Scheduled',
    };
  }

  if (config.status === 'ended' && config.allowReplay) {
    return {
      visible: true,
      mode: 'replay',
      label: 'Watch Replay',
      sublabel: config.title || 'Match Replay',
    };
  }

  return { visible: false, mode: 'hidden', label: '' };
}
