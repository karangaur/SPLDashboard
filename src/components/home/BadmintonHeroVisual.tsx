import React from 'react';

export const BadmintonHeroVisual: React.FC = () => {
  return (
    <div className="relative w-full max-w-lg lg:max-w-xl mx-auto flex items-center justify-center select-none pointer-events-none">
      {/* Background Stadium Floodlights & Ambient Glow */}
      <div className="absolute -inset-4 bg-gradient-to-tr from-lime-500/20 via-emerald-500/15 to-amber-500/10 rounded-full blur-3xl opacity-75" />
      <div className="absolute -top-10 -right-10 w-72 h-72 bg-lime-400/15 rounded-full blur-2xl" />
      <div className="absolute -bottom-10 -left-10 w-72 h-72 bg-cyan-400/10 rounded-full blur-2xl" />

      {/* Main Composition Card with Court Perspective */}
      <div className="relative w-full aspect-[4/3] sm:aspect-[16/11] rounded-3xl overflow-hidden border border-white/15 bg-gradient-to-b from-slate-900/90 via-[#0a0f1d] to-[#04060d] shadow-2xl p-6 flex flex-col justify-between">
        
        {/* Badminton Court Perspective Lines in Background */}
        <svg
          className="absolute inset-0 w-full h-full opacity-30 text-lime-400"
          viewBox="0 0 600 400"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
        >
          {/* Court Perspective Floor Grid */}
          <path d="M 60 380 L 180 180 L 420 180 L 540 380 Z" strokeWidth="2" stroke="rgba(163,230,53,0.4)" />
          {/* Inner Singles Lines */}
          <path d="M 110 380 L 210 180" strokeWidth="1" strokeDasharray="4 2" />
          <path d="M 490 380 L 390 180" strokeWidth="1" strokeDasharray="4 2" />
          {/* Short Service Line */}
          <path d="M 130 260 L 470 260" strokeWidth="1.5" />
          {/* Center Line */}
          <path d="M 300 260 L 300 380" strokeWidth="1.5" />
          {/* Badminton Net Line with mesh texture */}
          <line x1="170" y1="180" x2="430" y2="180" strokeWidth="4" stroke="rgba(255,255,255,0.7)" />
          <line x1="170" y1="170" x2="430" y2="170" strokeWidth="1" strokeDasharray="2 2" stroke="rgba(255,255,255,0.3)" />
          <line x1="170" y1="160" x2="430" y2="160" strokeWidth="1" strokeDasharray="2 2" stroke="rgba(255,255,255,0.2)" />
        </svg>

        {/* Top Header Badge inside Card */}
        <div className="relative z-10 flex items-center justify-between">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-slate-950/80 border border-lime-400/30 text-lime-400 text-xs font-bold uppercase tracking-wider backdrop-blur-md">
            <span className="w-2 h-2 rounded-full bg-lime-400 animate-ping" />
            <span>Championship Arena · Court 1</span>
          </div>

          <div className="px-2.5 py-1 rounded-lg bg-white/5 border border-white/10 text-[11px] font-mono text-slate-300">
            SPL 2026
          </div>
        </div>

        {/* Center Dynamic Jumping Badminton Smash Silhouette & Aerodynamic Shuttlecock */}
        <div className="relative z-10 my-auto flex items-center justify-center">
          <svg
            className="w-56 h-56 sm:w-64 sm:h-64 drop-shadow-[0_10px_25px_rgba(163,230,53,0.35)]"
            viewBox="0 0 240 240"
            fill="none"
          >
            {/* Speed Motion Trails */}
            <path
              d="M 50 190 Q 110 130 160 80"
              stroke="url(#speed-gradient)"
              strokeWidth="4"
              strokeDasharray="8 6"
              strokeLinecap="round"
            />
            <path
              d="M 65 205 Q 120 145 170 95"
              stroke="url(#speed-gradient-2)"
              strokeWidth="2.5"
              strokeDasharray="6 4"
              strokeLinecap="round"
            />
            <path
              d="M 40 175 Q 95 120 150 70"
              stroke="url(#speed-gradient-2)"
              strokeWidth="1.5"
              strokeDasharray="4 4"
              strokeLinecap="round"
            />

            {/* Badminton Jumping Player Silhouette (Smash Stance) */}
            <g className="text-white" fill="currentColor">
              {/* Head */}
              <circle cx="85" cy="75" r="9" />
              {/* Torso & Arching Back for Jump Smash */}
              <path d="M 82 86 C 88 95 95 110 93 130 L 78 132 C 76 115 72 98 82 86 Z" />
              {/* Non-racket Balancing Left Arm */}
              <path d="M 80 92 L 60 85 L 48 95 L 53 98 L 62 90 L 78 96 Z" />
              {/* Power Racket Right Arm Extended High */}
              <path d="M 88 88 L 105 72 L 125 50 L 132 54 L 112 76 L 92 92 Z" />
              {/* Legs in Mid-Air Scissors Kick / Jump Stance */}
              <path d="M 80 130 L 70 160 L 58 185 L 67 188 L 78 165 L 86 135 Z" />
              <path d="M 90 130 L 106 155 L 125 175 L 120 180 L 100 160 L 85 135 Z" />
            </g>

            {/* High-Tension Badminton Racket (Carbon Composite) */}
            <g transform="translate(126, 44) rotate(-35)">
              {/* Racket Shaft */}
              <line x1="0" y1="0" x2="0" y2="-45" stroke="#a3e635" strokeWidth="2.5" strokeLinecap="round" />
              {/* Racket Handle */}
              <line x1="0" y1="0" x2="0" y2="18" stroke="#ffffff" strokeWidth="4" strokeLinecap="round" />
              {/* Racket Head Oval */}
              <ellipse cx="0" cy="-65" rx="16" ry="22" stroke="#a3e635" strokeWidth="3" fill="rgba(163,230,53,0.08)" />
              {/* High-Tension String Grid */}
              <line x1="-10" y1="-65" x2="10" y2="-65" stroke="rgba(255,255,255,0.6)" strokeWidth="0.8" />
              <line x1="-12" y1="-55" x2="12" y2="-55" stroke="rgba(255,255,255,0.6)" strokeWidth="0.8" />
              <line x1="-12" y1="-75" x2="12" y2="-75" stroke="rgba(255,255,255,0.6)" strokeWidth="0.8" />
              <line x1="-6" y1="-80" x2="-6" y2="-50" stroke="rgba(255,255,255,0.6)" strokeWidth="0.8" />
              <line x1="0" y1="-84" x2="0" y2="-46" stroke="rgba(255,255,255,0.6)" strokeWidth="0.8" />
              <line x1="6" y1="-80" x2="6" y2="-50" stroke="rgba(255,255,255,0.6)" strokeWidth="0.8" />
            </g>

            {/* Smashed Feather Shuttlecock Traveling Downward at High Velocity */}
            <g transform="translate(185, 80) rotate(55)">
              {/* Motion Impact Spark */}
              <circle cx="0" cy="0" r="16" fill="url(#shuttle-glow)" opacity="0.6" />
              {/* Cork Base */}
              <ellipse cx="14" cy="0" rx="4.5" ry="4" fill="#ffffff" stroke="#e2e8f0" strokeWidth="1" />
              {/* Feather Skirt (16 Goose Feathers) */}
              <path
                d="M 12 -4 L -8 -11 C -9 -5 -9 5 -8 11 L 12 4 Z"
                fill="url(#feather-gradient)"
                stroke="#cbd5e1"
                strokeWidth="0.8"
              />
              {/* Feather Ribbons / Binding Thread */}
              <line x1="2" y1="-7" x2="2" y2="7" stroke="#3b82f6" strokeWidth="1.2" />
              <line x1="-3" y1="-9" x2="-3" y2="9" stroke="#3b82f6" strokeWidth="1" />
            </g>

            {/* SVG Gradients */}
            <defs>
              <linearGradient id="speed-gradient" x1="0%" y1="100%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#a3e635" stopOpacity="0" />
                <stop offset="60%" stopColor="#a3e635" stopOpacity="0.8" />
                <stop offset="100%" stopColor="#38bdf8" stopOpacity="1" />
              </linearGradient>
              <linearGradient id="speed-gradient-2" x1="0%" y1="100%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#10b981" stopOpacity="0" />
                <stop offset="100%" stopColor="#a3e635" stopOpacity="0.5" />
              </linearGradient>
              <radialGradient id="shuttle-glow" cx="50%" cy="50%" r="50%">
                <stop offset="0%" stopColor="#a3e635" stopOpacity="0.9" />
                <stop offset="50%" stopColor="#38bdf8" stopOpacity="0.4" />
                <stop offset="100%" stopColor="#000000" stopOpacity="0" />
              </radialGradient>
              <linearGradient id="feather-gradient" x1="100%" y1="0%" x2="0%" y2="0%">
                <stop offset="0%" stopColor="#f8fafc" />
                <stop offset="100%" stopColor="#e2e8f0" />
              </linearGradient>
            </defs>
          </svg>
        </div>

        {/* Bottom Metrics Bar inside Graphic Card */}
        <div className="relative z-10 grid grid-cols-3 gap-2 pt-3 border-t border-white/10 text-center">
          <div className="bg-slate-950/60 rounded-xl p-2 border border-white/5 backdrop-blur-sm">
            <span className="block text-[10px] text-slate-400 uppercase font-semibold">Smash Speed</span>
            <span className="text-xs sm:text-sm font-black text-lime-400 font-mono">340+ km/h</span>
          </div>
          <div className="bg-slate-950/60 rounded-xl p-2 border border-white/5 backdrop-blur-sm">
            <span className="block text-[10px] text-slate-400 uppercase font-semibold">Scoring Rule</span>
            <span className="text-xs sm:text-sm font-black text-white font-mono">BWF 21 Rally</span>
          </div>
          <div className="bg-slate-950/60 rounded-xl p-2 border border-white/5 backdrop-blur-sm">
            <span className="block text-[10px] text-slate-400 uppercase font-semibold">Live Courts</span>
            <span className="text-xs sm:text-sm font-black text-emerald-400 font-mono">2 Courts</span>
          </div>
        </div>

      </div>
    </div>
  );
};
