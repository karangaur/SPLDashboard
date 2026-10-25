import React from 'react';
import { ShieldCheck, HardDriveDownload, RefreshCw, MapPin, Calendar } from 'lucide-react';
import { useTournament } from '../../context/TournamentContext';
import { NavTab } from './Header';

interface FooterProps {
  onSelectTab: (tab: NavTab) => void;
}

export const Footer: React.FC<FooterProps> = ({ onSelectTab }) => {
  const { state, exportStateJSON, resetToDefault } = useTournament();

  return (
    <footer className="mt-20 border-t border-white/10 bg-slate-950/80 py-12 text-slate-400">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          {/* Brand & Tournament Bio */}
          <div className="md:col-span-2 space-y-3">
            <div className="flex items-center gap-2.5">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-500/20 text-amber-400 font-black text-lg">
                🏸
              </span>
              <span className="font-display font-black text-lg text-white">
                {state.settings.name}
              </span>
            </div>
            <p className="text-sm text-slate-400 leading-relaxed max-w-md">
              Official badminton tournament management system. Live scoring, round-robin fixtures,
              instant standings calculation, lottery draws, and player registrations.
            </p>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-slate-400 pt-1">
              <span className="inline-flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-amber-400" />
                {state.settings.date}
              </span>
              {state.settings.venue && (
                <span className="inline-flex items-center gap-1.5">
                  <MapPin className="w-3.5 h-3.5 text-emerald-400" />
                  {state.settings.venue}
                </span>
              )}
            </div>
          </div>

          {/* Quick Nav Links */}
          <div className="space-y-2 text-sm">
            <h4 className="font-bold text-slate-200 text-xs uppercase tracking-wider">Tournament Navigation</h4>
            <ul className="space-y-1.5">
              <li>
                <button
                  onClick={() => onSelectTab('fixtures')}
                  className="hover:text-amber-400 transition-colors"
                >
                  Match Centre & Live Scores
                </button>
              </li>
              <li>
                <button
                  onClick={() => onSelectTab('standings')}
                  className="hover:text-amber-400 transition-colors"
                >
                  Points Table & Net Run Rate
                </button>
              </li>
              <li>
                <button
                  onClick={() => onSelectTab('knockout')}
                  className="hover:text-amber-400 transition-colors"
                >
                  Knockout Championship Bracket
                </button>
              </li>
              <li>
                <button
                  onClick={() => onSelectTab('tokens')}
                  className="hover:text-amber-400 transition-colors"
                >
                  Live Token Lottery Draw
                </button>
              </li>
              <li>
                <button
                  onClick={() => onSelectTab('registered')}
                  className="hover:text-amber-400 transition-colors"
                >
                  Registered Players & Fees
                </button>
              </li>
            </ul>
          </div>

          {/* Data Persistence & Utilities */}
          <div className="space-y-2 text-sm">
            <h4 className="font-bold text-slate-200 text-xs uppercase tracking-wider">Offline Persistence</h4>
            <div className="flex items-center gap-2 text-xs text-emerald-400 font-medium bg-emerald-500/10 border border-emerald-500/20 px-3 py-2 rounded-xl">
              <ShieldCheck className="w-4 h-4 shrink-0" />
              <span>All changes automatically saved to device</span>
            </div>
            <div className="pt-2 flex flex-col gap-2">
              <button
                onClick={exportStateJSON}
                className="inline-flex items-center gap-2 text-xs text-slate-300 hover:text-white bg-white/5 hover:bg-white/10 px-3 py-2 rounded-lg transition-colors border border-white/5"
              >
                <HardDriveDownload className="w-3.5 h-3.5 text-blue-400" />
                <span>Export State Backup (.json)</span>
              </button>
              <button
                onClick={() => {
                  if (window.confirm('Reset tournament to default starter tournament state?')) {
                    resetToDefault();
                  }
                }}
                className="inline-flex items-center gap-2 text-xs text-slate-400 hover:text-rose-400 bg-white/5 hover:bg-rose-500/10 px-3 py-2 rounded-lg transition-colors border border-white/5"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Reset to Default State</span>
              </button>
            </div>
          </div>
        </div>

        <div className="mt-8 border-t border-white/5 pt-6 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-400">
          <div>
            © {new Date().getFullYear()} {state.settings.name}. Built for professional badminton tournament operations.
          </div>
          <div className="flex items-center gap-4">
            <button onClick={() => onSelectTab('settings')} className="hover:text-slate-300 transition-colors">
              Settings
            </button>
            <span>·</span>
            <button onClick={() => onSelectTab('statistics')} className="hover:text-slate-300 transition-colors">
              Statistics
            </button>
            <span>·</span>
            <button onClick={() => onSelectTab('champion')} className="hover:text-slate-300 transition-colors">
              Trophy Podium
            </button>
          </div>
        </div>
      </div>
    </footer>
  );
};
