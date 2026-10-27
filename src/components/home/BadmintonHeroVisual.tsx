import React from 'react';

const OFFICIAL_SPL_LOGO = '/assets/aistudio/7fdef8a3-3175-4f56-903d-bb6551369ac1_16fe4ad8.png';

export const BadmintonHeroVisual: React.FC = () => {
  return (
    <div className="relative w-full max-w-lg lg:max-w-xl mx-auto flex items-center justify-center select-none">
      
      {/* Background Stadium Floodlights & Ambient Glows (Electric Blue & Gold matching the 3D Logo) */}
      <div className="absolute -inset-6 bg-gradient-to-tr from-blue-600/25 via-indigo-600/15 to-amber-500/20 rounded-full blur-3xl opacity-75 pointer-events-none" />
      <div className="absolute -top-12 -right-8 w-64 h-64 bg-blue-500/20 rounded-full blur-2xl pointer-events-none" />
      <div className="absolute -bottom-12 -left-8 w-64 h-64 bg-amber-500/15 rounded-full blur-2xl pointer-events-none" />

      {/* Main Composition Card with Court Perspective & 3D Metallic Badge Showcase */}
      <div className="relative w-full rounded-3xl overflow-hidden border border-white/15 bg-gradient-to-b from-[#0a1128] via-[#050a18] to-[#02040a] shadow-[0_25px_60px_-15px_rgba(0,0,0,0.85)] p-5 sm:p-7 flex flex-col justify-between">
        
        {/* Badminton Court Perspective Floor Lines in Subtle Slate/Blue */}
        <svg
          className="absolute inset-0 w-full h-full opacity-20 text-sky-400 pointer-events-none"
          viewBox="0 0 600 440"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
        >
          {/* Court Perspective Floor Grid */}
          <path d="M 50 420 L 190 190 L 410 190 L 550 420 Z" strokeWidth="2" stroke="rgba(56,189,248,0.45)" />
          {/* Inner Singles Lines */}
          <path d="M 110 420 L 220 190" strokeWidth="1" strokeDasharray="4 2" />
          <path d="M 490 420 L 380 190" strokeWidth="1" strokeDasharray="4 2" />
          {/* Short Service Line */}
          <path d="M 130 290 L 470 290" strokeWidth="1.5" stroke="rgba(234,179,8,0.4)" />
          {/* Center Line */}
          <path d="M 300 290 L 300 420" strokeWidth="1.5" />
          {/* Badminton Net Line */}
          <line x1="170" y1="190" x2="430" y2="190" strokeWidth="4" stroke="rgba(255,255,255,0.75)" />
          <line x1="170" y1="180" x2="430" y2="180" strokeWidth="1" strokeDasharray="3 2" stroke="rgba(255,255,255,0.3)" />
          <line x1="170" y1="170" x2="430" y2="170" strokeWidth="1" strokeDasharray="3 2" stroke="rgba(255,255,255,0.2)" />
        </svg>

        {/* Top Header Badge inside Card */}
        <div className="relative z-10 flex items-center justify-between gap-2">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-slate-950/80 border border-blue-400/30 text-sky-300 text-xs font-bold uppercase tracking-wider backdrop-blur-md shadow-sm">
            <span className="w-2 h-2 rounded-full bg-sky-400 animate-ping" />
            <span>Official Championship Crest</span>
          </div>

          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-amber-500/10 border border-amber-500/30 text-[11px] font-mono font-bold text-amber-300">
            <span>MAHARAJGANJ</span>
          </div>
        </div>

        {/* Centerpiece: Official 3D SMASH PREMIER LEAGUE Logo */}
        <div className="relative z-10 my-4 sm:my-6 flex flex-col items-center justify-center">
          {/* Dynamic Light Aura Behind Logo */}
          <div className="absolute w-56 sm:w-72 h-56 sm:h-72 bg-gradient-to-tr from-blue-500/25 via-sky-400/20 to-amber-400/20 rounded-full blur-3xl pointer-events-none" />

          {/* Official 3D Logo Image */}
          <div className="relative group transition-transform duration-500 hover:scale-[1.02]">
            <img
              src={OFFICIAL_SPL_LOGO}
              alt="Smash Premier League Official 3D Tournament Logo"
              className="w-full max-w-[340px] sm:max-w-[420px] h-auto object-contain drop-shadow-[0_15px_30px_rgba(29,78,216,0.5)] drop-shadow-[0_5px_15px_rgba(245,158,11,0.3)]"
              loading="eager"
            />
          </div>

          {/* Subtext under logo */}
          <div className="mt-3 text-center">
            <p className="text-xs font-black uppercase tracking-[0.25em] text-slate-400">
              Championship Identity · Maharajganj
            </p>
          </div>
        </div>

        {/* Bottom Metrics Bar inside Graphic Card */}
        <div className="relative z-10 grid grid-cols-3 gap-2.5 pt-3.5 border-t border-white/10 text-center">
          <div className="bg-slate-950/70 rounded-xl p-2.5 border border-white/5 backdrop-blur-sm">
            <span className="block text-[10px] text-slate-400 uppercase font-semibold">Tournament</span>
            <span className="text-xs sm:text-sm font-black text-white font-mono">Badminton S.P.L.</span>
          </div>
          <div className="bg-slate-950/70 rounded-xl p-2.5 border border-white/5 backdrop-blur-sm">
            <span className="block text-[10px] text-slate-400 uppercase font-semibold">Match Rules</span>
            <span className="text-xs sm:text-sm font-black text-amber-300 font-mono">BWF 21 Rally</span>
          </div>
          <div className="bg-slate-950/70 rounded-xl p-2.5 border border-white/5 backdrop-blur-sm">
            <span className="block text-[10px] text-slate-400 uppercase font-semibold">Live Courts</span>
            <span className="text-xs sm:text-sm font-black text-sky-400 font-mono">Court 1 & 2</span>
          </div>
        </div>

      </div>
    </div>
  );
};
