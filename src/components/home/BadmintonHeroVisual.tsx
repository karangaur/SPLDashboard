import React, { useState } from 'react';
import heroSmashImg from '../../assets/images/spl_jump_smash_arena_1794553838311.jpg';
import { SPLLogoEmblemSvg } from '../common/SPLLogo';

interface BadmintonHeroVisualProps {
  venue?: string;
}

export const BadmintonHeroVisual: React.FC<BadmintonHeroVisualProps> = ({
  venue = 'Maharajganj Indoor Badminton Stadium',
}) => {
  const [imgError, setImgError] = useState(false);

  return (
    <div className="relative w-full flex items-stretch select-none">
      {/* Subtle Ambient Gold & Crimson Arena Halo */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -inset-3 rounded-[2rem] bg-gradient-to-tr from-amber-500/20 via-red-600/15 to-amber-300/10 blur-2xl opacity-75"
      />

      {/* Widescreen Athletic Championship Frame */}
      <div className="relative w-full aspect-[16/10] sm:aspect-[16/11] lg:aspect-auto lg:min-h-[440px] rounded-2xl sm:rounded-3xl overflow-hidden border border-amber-400/25 bg-[#06070c] shadow-[0_24px_64px_-16px_rgba(0,0,0,0.92)]">
        {/* Background Action Visual or Styled Championship Fallback */}
        {!imgError ? (
          <img
            src={heroSmashImg}
            alt="Badminton athlete executing an aerial jump smash under championship stadium floodlights"
            referrerPolicy="no-referrer"
            loading="eager"
            decoding="async"
            onError={() => setImgError(true)}
            className="absolute inset-0 w-full h-full object-cover object-[78%_22%] transition-transform duration-700 hover:scale-[1.03]"
          />
        ) : (
          <div className="absolute inset-0 bg-gradient-to-br from-[#121728] via-[#090b12] to-[#1a0d08] flex items-center justify-center">
            <SPLLogoEmblemSvg className="w-32 h-32 opacity-80" include30 />
          </div>
        )}

        {/* Directional Obsidian Contrast Scrims */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 bg-gradient-to-t from-[#05060b] via-[#05060b]/25 to-black/25"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 bg-gradient-to-r from-[#05060b]/70 via-transparent to-transparent"
        />

        {/* Subtle Court Geometry Lines (Lower Deck Texture) */}
        <svg
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 bottom-0 w-full h-1/2 opacity-20 text-amber-300"
          viewBox="0 0 600 220"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.25"
        >
          <path d="M 40 215 L 185 70 L 415 70 L 560 215" strokeOpacity="0.65" />
          <path d="M 110 215 L 220 70" strokeDasharray="5 4" strokeOpacity="0.45" />
          <path d="M 490 215 L 380 70" strokeDasharray="5 4" strokeOpacity="0.45" />
          <line x1="145" y1="125" x2="455" y2="125" strokeOpacity="0.55" />
        </svg>

        {/* Lightweight Animated Shuttlecock Motion Arc (Desktop/Tablet) */}
        <div
          aria-hidden="true"
          className="hidden sm:block pointer-events-none absolute inset-0 overflow-hidden spl-broadcast-layer"
        >
          <svg className="w-full h-full opacity-55" viewBox="0 0 600 400" fill="none">
            <path
              d="M 40 290 Q 290 60 560 155"
              stroke="url(#splArcGrad)"
              strokeWidth="2"
              strokeDasharray="6 8"
            />
            <defs>
              <linearGradient id="splArcGrad" x1="40" y1="290" x2="560" y2="155" gradientUnits="userSpaceOnUse">
                <stop offset="0%" stopColor="#F59E0B" stopOpacity="0" />
                <stop offset="50%" stopColor="#FDE68A" stopOpacity="0.85" />
                <stop offset="100%" stopColor="#EF4444" stopOpacity="0" />
              </linearGradient>
            </defs>
          </svg>
          <div className="spl-shuttle-trail absolute top-0 left-0 w-6 h-6">
            <span className="block w-3 h-3 rounded-full bg-amber-300 shadow-[0_0_16px_4px_rgba(251,191,36,0.75)]" />
          </div>
        </div>

        {/* Top-Left Championship Crest Lockup */}
        <div className="absolute top-3.5 left-3.5 sm:top-5 sm:left-5 z-10 flex items-center gap-2.5">
          <SPLLogoEmblemSvg
            className="w-10 h-10 sm:w-12 sm:h-12 drop-shadow-[0_6px_14px_rgba(0,0,0,0.85)]"
            include30
          />
          <div className="hidden sm:block text-left">
            <span className="block text-[10px] font-display font-black uppercase tracking-[0.22em] text-amber-300 leading-none">
              SPL 3.0 Arena
            </span>
            <span className="block text-[11px] font-semibold text-slate-200/90 mt-0.5">
              Champion Edition
            </span>
          </div>
        </div>

        {/* Bottom Clean Unboxed Venue & Championship Spec Line */}
        <div className="absolute inset-x-0 bottom-0 z-10 px-4 py-3.5 sm:px-6 sm:py-5 flex items-end justify-between gap-3">
          <div className="min-w-0">
            <span className="block text-[10px] sm:text-xs font-display font-extrabold uppercase tracking-[0.22em] text-amber-400">
              Championship Stage
            </span>
            <p className="text-xs sm:text-sm font-bold text-white truncate mt-0.5">
              {venue}
            </p>
          </div>
          <span className="text-[10px] sm:text-xs font-mono font-bold uppercase tracking-wider text-slate-300 shrink-0">
            BWF 21-Pt Rally
          </span>
        </div>
      </div>
    </div>
  );
};

