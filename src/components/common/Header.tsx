import React, { useState } from 'react';
import {
  Trophy,
  Menu,
  X,
  PlusCircle,
  Dices,
  BarChart3,
  Sliders,
  Users2,
  CheckCircle2,
  LogOut,
  Shield,
} from 'lucide-react';
import { useTournament } from '../../context/TournamentContext';

export type NavTab =
  | 'dashboard'
  | 'fixtures'
  | 'standings'
  | 'teams'
  | 'players'
  | 'knockout'
  | 'tokens'
  | 'registration'
  | 'registered'
  | 'statistics'
  | 'champion'
  | 'settings';

interface HeaderProps {
  currentTab: NavTab;
  onSelectTab: (tab: NavTab) => void;
  onLogout?: () => void;
}

export const Header: React.FC<HeaderProps> = ({ currentTab, onSelectTab, onLogout }) => {
  const { state } = useTournament();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [moreDropdownOpen, setMoreDropdownOpen] = useState(false);

  const liveMatchesCount = state.matches.filter((m) => m.status === 'live').length;

  const handleNav = (tab: NavTab) => {
    onSelectTab(tab);
    setMobileMenuOpen(false);
    setMoreDropdownOpen(false);
  };

  return (
    <header className="sticky top-0 z-40 w-full border-b border-white/10 bg-slate-950/85 backdrop-blur-md">
      {/* 3-Zone Top Bar Contract */}
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-8 px-4 sm:px-6 lg:px-8">
        
        {/* Zone 1: Single Brand Wordmark */}
        <div className="flex items-center gap-3 shrink-0">
          <button
            onClick={() => handleNav('dashboard')}
            className="flex items-center gap-2.5 text-left group focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 rounded-lg"
          >
            <div className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-tr from-amber-500 to-amber-400 text-slate-950 font-black shadow-md shadow-amber-500/20 group-hover:scale-105 transition-transform">
              <span className="text-xl leading-none">🏸</span>
            </div>
            <div className="min-w-0">
              <span className="block font-display text-lg font-black tracking-tight text-white whitespace-nowrap">
                Smash Premier League
              </span>
              <span className="block text-[11px] font-medium text-slate-400 truncate -mt-0.5">
                {state.settings.season || 'Tournament Central'}
              </span>
            </div>
          </button>
        </div>

        {/* Zone 2: 4-5 Concise Single-line Nav Links (Desktop) */}
        <nav className="hidden lg:flex items-center gap-1 text-sm font-medium text-slate-300">
          <button
            onClick={() => handleNav('dashboard')}
            className={`px-3 py-1.5 rounded-lg transition-colors whitespace-nowrap shrink-0 ${
              currentTab === 'dashboard'
                ? 'bg-white/10 text-white font-semibold'
                : 'text-slate-300 hover:text-white hover:bg-white/5'
            }`}
          >
            Dashboard
          </button>

          <button
            onClick={() => handleNav('fixtures')}
            className={`relative px-3 py-1.5 rounded-lg transition-colors whitespace-nowrap shrink-0 flex items-center gap-1.5 ${
              currentTab === 'fixtures'
                ? 'bg-white/10 text-white font-semibold'
                : 'text-slate-300 hover:text-white hover:bg-white/5'
            }`}
          >
            <span>Match Centre</span>
            {liveMatchesCount > 0 && (
              <span className="inline-flex items-center justify-center px-1.5 py-0.5 text-[10px] font-bold text-rose-300 bg-rose-500/20 border border-rose-500/40 rounded-full">
                {liveMatchesCount} Live
              </span>
            )}
          </button>

          <button
            onClick={() => handleNav('standings')}
            className={`px-3 py-1.5 rounded-lg transition-colors whitespace-nowrap shrink-0 ${
              currentTab === 'standings'
                ? 'bg-white/10 text-white font-semibold'
                : 'text-slate-300 hover:text-white hover:bg-white/5'
            }`}
          >
            Standings
          </button>

          <button
            onClick={() => handleNav('knockout')}
            className={`px-3 py-1.5 rounded-lg transition-colors whitespace-nowrap shrink-0 ${
              currentTab === 'knockout'
                ? 'bg-white/10 text-white font-semibold'
                : 'text-slate-300 hover:text-white hover:bg-white/5'
            }`}
          >
            Knockout Stage
          </button>

          <button
            onClick={() => handleNav('teams')}
            className={`px-3 py-1.5 rounded-lg transition-colors whitespace-nowrap shrink-0 ${
              currentTab === 'teams'
                ? 'bg-white/10 text-white font-semibold'
                : 'text-slate-300 hover:text-white hover:bg-white/5'
            }`}
          >
            Teams
          </button>

          <button
            onClick={() => handleNav('registration')}
            className={`px-3 py-1.5 rounded-lg transition-colors whitespace-nowrap shrink-0 flex items-center gap-1.5 ${
              currentTab === 'registration'
                ? 'bg-amber-400 text-slate-950 font-bold shadow'
                : 'text-slate-300 hover:text-white hover:bg-white/5'
            }`}
          >
            <span>Player Registration</span>
          </button>

          {/* More Dropdown for Secondary Portals */}
          <div className="relative">
            <button
              onClick={() => setMoreDropdownOpen((prev) => !prev)}
              className={`px-3 py-1.5 rounded-lg transition-colors whitespace-nowrap shrink-0 flex items-center gap-1 ${
                ['tokens', 'registered', 'statistics', 'champion', 'settings'].includes(currentTab)
                  ? 'bg-white/10 text-amber-400 font-semibold'
                  : 'text-slate-300 hover:text-white hover:bg-white/5'
              }`}
            >
              <span>More</span>
              <span className="text-xs opacity-60">▾</span>
            </button>

            {moreDropdownOpen && (
              <>
                <div
                  className="fixed inset-0 z-30"
                  onClick={() => setMoreDropdownOpen(false)}
                />
                <div className="absolute right-0 mt-2 w-56 rounded-xl glass-dropdown p-1.5 z-40 text-sm animate-fade-in">
                  <button
                    onClick={() => handleNav('players')}
                    className="w-full text-left px-3 py-2 rounded-lg hover:bg-white/10 text-slate-200 hover:text-white flex items-center gap-2.5"
                  >
                    <Users2 className="w-4 h-4 text-amber-400" />
                    <span>Players Directory</span>
                  </button>
                  <button
                    onClick={() => handleNav('tokens')}
                    className="w-full text-left px-3 py-2 rounded-lg hover:bg-white/10 text-slate-200 hover:text-white flex items-center gap-2.5"
                  >
                    <Dices className="w-4 h-4 text-amber-400" />
                    <span>Token Draw (Lottery)</span>
                  </button>
                  <button
                    onClick={() => handleNav('registered')}
                    className="w-full text-left px-3 py-2 rounded-lg hover:bg-white/10 text-slate-200 hover:text-white flex items-center gap-2.5"
                  >
                    <Users2 className="w-4 h-4 text-emerald-400" />
                    <span>Registered Roster</span>
                  </button>
                  <button
                    onClick={() => handleNav('statistics')}
                    className="w-full text-left px-3 py-2 rounded-lg hover:bg-white/10 text-slate-200 hover:text-white flex items-center gap-2.5"
                  >
                    <BarChart3 className="w-4 h-4 text-blue-400" />
                    <span>Statistics & Records</span>
                  </button>
                  <button
                    onClick={() => handleNav('champion')}
                    className="w-full text-left px-3 py-2 rounded-lg hover:bg-white/10 text-slate-200 hover:text-white flex items-center gap-2.5"
                  >
                    <Trophy className="w-4 h-4 text-amber-400" />
                    <span>Champion Ceremony</span>
                  </button>
                  <div className="my-1 border-t border-white/10" />
                  <button
                    onClick={() => handleNav('settings')}
                    className="w-full text-left px-3 py-2 rounded-lg hover:bg-white/10 text-slate-200 hover:text-white flex items-center gap-2.5"
                  >
                    <Sliders className="w-4 h-4 text-slate-400" />
                    <span>Tournament Settings</span>
                  </button>
                </div>
              </>
            )}
          </div>
        </nav>

        {/* Zone 3: 1 Primary Action (Register Player) + Admin Logout + Mobile Toggle */}
        <div className="flex items-center gap-2.5 shrink-0">
          <button
            onClick={() => handleNav('registration')}
            className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-slate-950 bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 rounded-xl shadow-md shadow-amber-500/20 active:scale-95 transition-all whitespace-nowrap shrink-0"
          >
            <PlusCircle className="w-4 h-4" />
            <span className="hidden sm:inline">Register Player</span>
            <span className="sm:hidden">Register</span>
          </button>

          {/* Admin Indicator & Logout */}
          {onLogout && (
            <button
              onClick={onLogout}
              title="Sign Out of Admin Portal"
              className="hidden sm:flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-300 hover:text-rose-400 bg-white/5 hover:bg-rose-500/10 border border-white/10 hover:border-rose-500/30 rounded-xl transition-all"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Logout</span>
            </button>
          )}

          {/* Mobile hamburger menu toggle */}
          <button
            type="button"
            onClick={() => setMobileMenuOpen((o) => !o)}
            aria-label="Toggle navigation menu"
            className="lg:hidden p-2 text-slate-300 hover:text-white hover:bg-white/5 rounded-xl transition-colors"
          >
            {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>

      </div>

      {/* Mobile Drawer Navigation */}
      {mobileMenuOpen && (
        <div className="lg:hidden border-t border-white/10 bg-slate-950/95 backdrop-blur-xl px-4 py-4 space-y-1 animate-fade-in shadow-2xl">
          <div className="grid grid-cols-2 gap-2 pb-2">
            <button
              onClick={() => handleNav('dashboard')}
              className={`p-2.5 rounded-xl text-left text-sm font-semibold transition-colors ${
                currentTab === 'dashboard' ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30' : 'bg-white/5 text-slate-200'
              }`}
            >
              📊 Live Dashboard
            </button>
            <button
              onClick={() => handleNav('fixtures')}
              className={`p-2.5 rounded-xl text-left text-sm font-semibold transition-colors ${
                currentTab === 'fixtures' ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30' : 'bg-white/5 text-slate-200'
              }`}
            >
              🏸 Match Centre
            </button>
            <button
              onClick={() => handleNav('standings')}
              className={`p-2.5 rounded-xl text-left text-sm font-semibold transition-colors ${
                currentTab === 'standings' ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30' : 'bg-white/5 text-slate-200'
              }`}
            >
              🏆 Standings
            </button>
            <button
              onClick={() => handleNav('knockout')}
              className={`p-2.5 rounded-xl text-left text-sm font-semibold transition-colors ${
                currentTab === 'knockout' ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30' : 'bg-white/5 text-slate-200'
              }`}
            >
              ⚔️ Knockout Stage
            </button>
          </div>

          <div className="pt-2 border-t border-white/10 space-y-1">
            <button
              onClick={() => handleNav('teams')}
              className="w-full flex items-center justify-between p-2.5 rounded-xl hover:bg-white/5 text-slate-300 text-sm"
            >
              <span>Teams & Squads</span>
              <span className="text-xs text-slate-400">{state.teams.length} teams</span>
            </button>
            <button
              onClick={() => handleNav('players')}
              className="w-full flex items-center justify-between p-2.5 rounded-xl hover:bg-white/5 text-slate-300 text-sm"
            >
              <span>Players Directory</span>
              <span className="text-xs text-slate-400">{state.players.length} players</span>
            </button>
            <button
              onClick={() => handleNav('tokens')}
              className="w-full flex items-center justify-between p-2.5 rounded-xl hover:bg-white/5 text-slate-300 text-sm"
            >
              <span>Token Draw (Lottery)</span>
              <Dices className="w-4 h-4 text-amber-400" />
            </button>
            <button
              onClick={() => handleNav('registered')}
              className="w-full flex items-center justify-between p-2.5 rounded-xl hover:bg-white/5 text-slate-300 text-sm"
            >
              <span>Registered Roster & Payments</span>
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            </button>
            <button
              onClick={() => handleNav('statistics')}
              className="w-full flex items-center justify-between p-2.5 rounded-xl hover:bg-white/5 text-slate-300 text-sm"
            >
              <span>Tournament Statistics</span>
              <BarChart3 className="w-4 h-4 text-blue-400" />
            </button>
            <button
              onClick={() => handleNav('champion')}
              className="w-full flex items-center justify-between p-2.5 rounded-xl hover:bg-white/5 text-slate-300 text-sm"
            >
              <span>Champion Ceremony</span>
              <Trophy className="w-4 h-4 text-amber-400" />
            </button>
            <button
              onClick={() => handleNav('settings')}
              className="w-full flex items-center justify-between p-2.5 rounded-xl hover:bg-white/5 text-slate-300 text-sm"
            >
              <span>Settings & Data Backup</span>
              <Sliders className="w-4 h-4 text-slate-400" />
            </button>
            {onLogout && (
              <button
                onClick={() => {
                  setMobileMenuOpen(false);
                  onLogout();
                }}
                className="w-full flex items-center justify-between p-2.5 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 text-sm border border-rose-500/30 mt-2 transition-colors"
              >
                <span>Logout Administrator</span>
                <LogOut className="w-4 h-4 text-rose-400" />
              </button>
            )}
          </div>
        </div>
      )}
    </header>
  );
};
