import React, { useId } from 'react';

export interface SPLLogoProps {
  variant?: 'emblem' | 'horizontal' | 'hero';
  className?: string;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  showTagline?: boolean;
  animated?: boolean;
  subtitle?: string;
}

const SIZE_MAP = {
  xs: { icon: 'w-9 h-9', text: 'text-sm', sub: 'text-[9px]' },
  sm: { icon: 'w-11 h-11', text: 'text-base sm:text-lg', sub: 'text-[10px]' },
  md: { icon: 'w-14 h-14 sm:w-16 sm:h-16', text: 'text-lg sm:text-xl', sub: 'text-[10px] sm:text-xs' },
  lg: { icon: 'w-20 h-20 sm:w-24 sm:h-24', text: 'text-xl sm:text-2xl', sub: 'text-xs' },
  xl: { icon: 'w-28 h-28 sm:w-36 sm:h-36', text: 'text-2xl sm:text-3xl', sub: 'text-xs sm:text-sm' },
} as const;

export const SPLLogoEmblemSvg: React.FC<{ className?: string; include30?: boolean }> = ({
  className = 'w-14 h-14',
  include30 = false,
}) => {
  const uid = useId().replace(/:/g, '');
  const goldId = `spl-gold-${uid}`;
  const goldSoftId = `spl-gold-soft-${uid}`;
  const crimsonId = `spl-crimson-${uid}`;
  const obsidianId = `spl-obsidian-${uid}`;
  const platinumId = `spl-platinum-${uid}`;

  return (
    <svg
      viewBox="0 0 360 360"
      fill="none"
      className={className}
      role="img"
      aria-label="Smash Premier League Championship Crest"
    >
      <defs>
        <linearGradient id={goldId} x1="40" y1="24" x2="320" y2="336" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#FEF3C7" />
          <stop offset="38%" stopColor="#F59E0B" />
          <stop offset="100%" stopColor="#B45309" />
        </linearGradient>
        <linearGradient id={goldSoftId} x1="80" y1="40" x2="280" y2="280" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#FDE68A" />
          <stop offset="100%" stopColor="#D97706" />
        </linearGradient>
        <linearGradient id={crimsonId} x1="45" y1="100" x2="315" y2="240" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#EF4444" />
          <stop offset="100%" stopColor="#EA580C" />
        </linearGradient>
        <linearGradient id={obsidianId} x1="180" y1="24" x2="180" y2="336" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#121726" />
          <stop offset="100%" stopColor="#05060A" />
        </linearGradient>
        <linearGradient id={platinumId} x1="120" y1="80" x2="240" y2="200" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#F8FAFC" />
          <stop offset="100%" stopColor="#94A3B8" />
        </linearGradient>
      </defs>

      {/* Deep Midnight Black Championship Shield */}
      <path
        d="M180 20L308 66L288 214C281 268 238 312 180 338C122 312 79 268 72 214L52 66L180 20Z"
        fill={`url(#${obsidianId})`}
        stroke={`url(#${goldId})`}
        strokeWidth="11"
        strokeLinejoin="round"
      />

      {/* Inner Platinum Bevel */}
      <path
        d="M180 37L291 77L273 210C267 256 229 295 180 318C131 295 93 256 87 210L69 77L180 37Z"
        stroke={`url(#${platinumId})`}
        strokeOpacity="0.34"
        strokeWidth="2.2"
        strokeLinejoin="round"
      />

      {/* High-Speed Dynamic Badminton Wings */}
      <path d="M22 114L93 127L81 145L31 133L22 114Z" fill={`url(#${crimsonId})`} />
      <path d="M36 153L97 157L89 173L45 169L36 153Z" fill={`url(#${goldSoftId})`} />
      <path d="M338 114L267 127L279 145L329 133L338 114Z" fill={`url(#${crimsonId})`} />
      <path d="M324 153L263 157L271 173L315 169L324 153Z" fill={`url(#${goldSoftId})`} />

      {/* 3-Point Championship Crown */}
      <path
        d="M144 74L154 49L180 63L206 49L216 74H144Z"
        fill={`url(#${goldId})`}
        stroke="#FEF3C7"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />

      {/* Stylized Badminton Shuttlecock */}
      <path
        d="M141 93L162 157H198L219 93L200 99L190 89L180 101L170 89L160 99L141 93Z"
        fill={`url(#${platinumId})`}
      />
      <path
        d="M158 99L168 153M180 101V153M202 99L192 153"
        stroke="#070A12"
        strokeWidth="2.8"
        strokeLinecap="round"
      />
      <rect x="159" y="155" width="42" height="8" rx="3" fill={`url(#${crimsonId})`} />
      <path
        d="M164 165H196V172C196 181 189 188 180 188C171 188 164 181 164 172V165Z"
        fill={`url(#${goldId})`}
      />

      {/* Custom Angular Athletic SPL Lettermark */}
      <g transform="translate(0, 6)">
        <path
          d="M138 198H102L94 212V226L104 232H128L124 242H92L86 254H132L140 240V224L130 218H107L111 210H134L138 198Z"
          fill={`url(#${goldId})`}
          stroke="#05060A"
          strokeWidth="2.5"
          strokeLinejoin="round"
        />
        <path
          d="M154 198H198L204 208V228L196 236H170V254H154V198ZM170 211V223H188V211H170Z"
          fill="#F8FAFC"
          stroke="#05060A"
          strokeWidth="2.5"
          strokeLinejoin="round"
        />
        <path
          d="M218 198H235V240H268L262 254H218V198Z"
          fill={`url(#${goldId})`}
          stroke="#05060A"
          strokeWidth="2.5"
          strokeLinejoin="round"
        />
      </g>

      {/* Crimson Speed Divider */}
      <path d="M112 273H248" stroke={`url(#${crimsonId})`} strokeWidth="3.5" strokeLinecap="round" />

      {include30 ? (
        <text
          x="180"
          y="296"
          textAnchor="middle"
          fill="#FDE68A"
          fontFamily="Outfit, Plus Jakarta Sans, sans-serif"
          fontSize="14"
          fontWeight="900"
          letterSpacing="2.4"
        >
          3.0 · CHAMPION
        </text>
      ) : (
        <path d="M148 286L180 298L212 286" stroke={`url(#${goldSoftId})`} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      )}
    </svg>
  );
};

export const SPLLogo: React.FC<SPLLogoProps> = ({
  variant = 'horizontal',
  className = '',
  size = 'md',
  showTagline = true,
  animated = false,
  subtitle = 'SPL 3.0 · CHAMPION EDITION',
}) => {
  const s = SIZE_MAP[size];

  if (variant === 'emblem') {
    return (
      <div
        className={`inline-flex flex-col items-center text-center select-none ${
          animated ? 'spl-hero-logo-reveal' : ''
        } ${className}`}
      >
        <div className="relative flex items-center justify-center">
          <div
            aria-hidden="true"
            className="absolute inset-1 rounded-full bg-amber-500/20 blur-xl pointer-events-none"
          />
          <SPLLogoEmblemSvg className={`${s.icon} relative z-10 drop-shadow-[0_10px_24px_rgba(245,158,11,0.3)]`} include30 />
        </div>
        {showTagline && (
          <div className="mt-2 space-y-0.5">
            <span className={`block font-display font-black uppercase tracking-wider text-white leading-none ${s.text}`}>
              SMASH PREMIER LEAGUE
            </span>
            <span className={`block font-display font-extrabold uppercase tracking-[0.22em] text-amber-400 ${s.sub}`}>
              {subtitle}
            </span>
          </div>
        )}
      </div>
    );
  }

  return (
    <div
      className={`inline-flex items-center gap-2.5 sm:gap-3.5 min-w-0 max-w-full select-none ${
        animated ? 'spl-hero-logo-reveal' : ''
      } ${className}`}
    >
      <div className="relative shrink-0">
        {variant === 'hero' && (
          <div
            aria-hidden="true"
            className="absolute -inset-2 rounded-full bg-gradient-to-tr from-amber-500/30 via-red-500/20 to-amber-300/25 blur-lg pointer-events-none"
          />
        )}
        <SPLLogoEmblemSvg
          className={`${s.icon} relative z-10 drop-shadow-[0_8px_18px_rgba(245,158,11,0.32)]`}
          include30={variant === 'hero'}
        />
      </div>

      <div className="min-w-0 text-left">
        <div className={`font-display font-black uppercase tracking-tight text-white leading-tight break-words sm:truncate ${s.text}`}>
          SMASH PREMIER LEAGUE
        </div>
        {showTagline && (
          <div className="flex items-center gap-2 mt-0.5 min-w-0">
            <span className="h-[2px] w-4 bg-gradient-to-r from-red-500 to-amber-400 rounded-full shrink-0" />
            <span className={`font-display font-extrabold uppercase tracking-[0.12em] sm:tracking-[0.18em] text-amber-400 break-words sm:truncate ${s.sub}`}>
              {subtitle}
            </span>
          </div>
        )}
      </div>
    </div>
  );
};
