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
  ExternalLink,
  ShieldCheck,
  User,
  Palette,
  Tv,
} from 'lucide-react';
import { useTournament } from '../../context/TournamentContext';
import { AuthService } from '../../services/authService';
import { MyAccountModal } from '../auth/MyAccountModal';

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
  | 'hero'
  | 'livestream'
  | 'settings'
  | 'users';

interface HeaderProps {
  currentTab: NavTab;
  onSelectTab: (tab: NavTab) => void;
  onLogout?: () => void;
  onViewPublicHome?: () => void;
}

export const Header: React.FC<HeaderProps> = ({ currentTab, onSelectTab, onLogout, onViewPublicHome }) => {
  const { state, youtubeLiveConfig } = useTournament();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [moreDropdownOpen, setMoreDropdownOpen] = useState(false);
  const [accountModalOpen, setAccountModalOpen] = useState(false);

  const isSuperAdmin = AuthService.isSuperAdmin();
  const canManageTournament = AuthService.canManageTournament();
  const liveMatchesCount = state.matches.filter((m) => m.status === 'live').length;
  const isStreamLive = Boolean(youtubeLiveConfig?.enabled && youtubeLiveConfig?.status === 'live' && youtubeLiveConfig?.videoId);

  const handleNav = (tab: NavTab) => {
    onSelectTab(tab);
    setMobileMenuOpen(false);
    setMoreDropdownOpen(false);
  };

  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setMobileMenuOpen(false);
        setMoreDropdownOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  return (
    <header className="sticky top-0 z-40 w-full border-b border-white/10 bg-slate-950/85 backdrop-blur-md">
      {/* 3-Zone Top Bar Contract */}
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-2 sm:gap-4 md:gap-8 px-3 sm:px-6 lg:px-8">
        
        {/* Zone 1: Single Brand Wordmark with Official Logo */}
        <div className="flex items-center gap-2 sm:gap-3 shrink min-w-0">
          <button
            onClick={() => handleNav('dashboard')}
            className="flex items-center gap-2 sm:gap-2.5 text-left group focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 rounded-lg min-w-0"
          >
            <img
              src="/assets/aistudio/7fdef8a3-3175-4f56-903d-bb6551369ac1_16fe4ad8.png"
              alt="Smash Premier League"
              className="h-8 sm:h-10 w-auto object-contain shrink-0 drop-shadow group-hover:scale-105 transition-transform"
            />
            <div className="min-w-0">
              <span className="block font-display text-sm sm:text-base md:text-lg font-black tracking-tight text-white truncate">
                {state.settings.name || 'Smash Premier League'}
              </span>
              <span className="block text-[10px] sm:text-[11px] font-medium text-slate-400 truncate -mt-0.5">
                {state.settings.season || 'Maharajganj Tournament Central'}
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
              aria-expanded={moreDropdownOpen}
              aria-haspopup="true"
              className={`px-3 py-1.5 rounded-lg transition-colors whitespace-nowrap shrink-0 flex items-center gap-1 ${
                ['tokens', 'registered', 'statistics', 'champion', 'hero', 'livestream', 'settings', 'users'].includes(currentTab)
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
                  {canManageTournament && (
                    <button
                      onClick={() => handleNav('hero')}
                      className={`w-full text-left px-3 py-2 rounded-lg text-slate-200 hover:text-white flex items-center gap-2.5 ${
                        currentTab === 'hero' ? 'bg-amber-400/20 text-amber-300 font-semibold' : 'hover:bg-white/10'
                      }`}
                    >
                      <Palette className="w-4 h-4 text-amber-400" />
                      <span>Hero Section Manager</span>
                    </button>
                  )}
                  {canManageTournament && (
                    <button
                      onClick={() => handleNav('livestream')}
                      className={`w-full text-left px-3 py-2 rounded-lg text-slate-200 hover:text-white flex items-center justify-between gap-2 ${
                        currentTab === 'livestream' ? 'bg-red-500/20 text-red-200 font-semibold' : 'hover:bg-white/10'
                      }`}
                    >
                      <span className="flex items-center gap-2.5">
                        <Tv className="w-4 h-4 text-red-400" />
                        <span>YouTube Live Stream</span>
                      </span>
                      {isStreamLive && (
                        <span className="px-1.5 py-0.5 rounded-full text-[9px] font-black uppercase bg-red-600/30 text-red-300 border border-red-500/40">
                          LIVE
                        </span>
                      )}
                    </button>
                  )}
                  <button
                    onClick={() => handleNav('settings')}
                    className="w-full text-left px-3 py-2 rounded-lg hover:bg-white/10 text-slate-200 hover:text-white flex items-center gap-2.5"
                  >
                    <Sliders className="w-4 h-4 text-slate-400" />
                    <span>Tournament Settings</span>
                  </button>
                  {isSuperAdmin && (
                    <button
                      onClick={() => handleNav('users')}
                      className={`w-full text-left px-3 py-2 rounded-lg text-slate-200 hover:text-white flex items-center gap-2.5 ${
                        currentTab === 'users' ? 'bg-amber-400/20 text-amber-300' : 'hover:bg-white/10'
                      }`}
                    >
                      <ShieldCheck className="w-4 h-4 text-amber-400" />
                      <span>User Management (RBAC)</span>
                    </button>
                  )}
                </div>
              </>
            )}
          </div>
        </nav>

        {/* Zone 3: 1 Primary Action (Register Player) + Admin Logout + Mobile Toggle */}
        <div className="flex items-center gap-2 sm:gap-2.5 shrink-0">
          <button
            onClick={() => handleNav('registration')}
            className="flex items-center gap-1.5 px-3 sm:px-3.5 py-2 min-h-[38px] text-xs font-bold text-slate-950 bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 rounded-xl shadow-md shadow-amber-500/20 active:scale-95 transition-all whitespace-nowrap shrink-0"
          >
            <PlusCircle className="w-4 h-4 shrink-0" />
            <span className="hidden sm:inline">Register Player</span>
            <span className="sm:hidden">Register</span>
          </button>

          {/* Switch to Public Tournament Homepage */}
          {onViewPublicHome && (
            <button
              onClick={onViewPublicHome}
              title="View Public Tournament Home"
              className="hidden sm:flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-lime-400 hover:text-lime-300 bg-lime-400/10 hover:bg-lime-400/20 border border-lime-400/30 rounded-xl transition-all"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              <span>Public Site</span>
            </button>
          )}

          {/* User Account / Password Management */}
          <button
            type="button"
            onClick={() => setAccountModalOpen(true)}
            title="My Account & Security"
            className="hidden sm:flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-300 hover:text-white bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl transition-all"
          >
            <User className="w-3.5 h-3.5 text-amber-400" />
            <span>My Account</span>
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
            aria-expanded={mobileMenuOpen}
            className="lg:hidden p-2 min-w-[40px] min-h-[40px] flex items-center justify-center text-slate-300 hover:text-white hover:bg-white/5 rounded-xl transition-colors"
          >
            {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>

      </div>

      {/* Mobile Drawer Backdrop & Navigation */}
      {mobileMenuOpen && (
        <>
          <div
            className="lg:hidden fixed inset-0 top-16 z-30 bg-black/60 backdrop-blur-sm animate-fade-in"
            onClick={() => setMobileMenuOpen(false)}
            aria-hidden="true"
          />
          <div className="lg:hidden relative z-40 border-t border-white/10 bg-slate-950/98 backdrop-blur-xl px-4 py-4 pb-28 max-h-[calc(100dvh-4rem)] overflow-y-auto space-y-1.5 animate-fade-in shadow-2xl">
            <div className="grid grid-cols-2 gap-2 pb-2">
              <button
                onClick={() => handleNav('dashboard')}
                className={`p-3 min-h-[44px] rounded-xl text-left text-sm font-semibold transition-all active:scale-98 flex items-center gap-2 ${
                  currentTab === 'dashboard' ? 'bg-amber-500/20 text-amber-400 border border-amber-500/40 shadow-sm' : 'bg-white/5 text-slate-200 hover:bg-white/10'
                }`}
              >
                <span>📊</span>
                <span>Live Dashboard</span>
              </button>
              <button
                onClick={() => handleNav('fixtures')}
                className={`p-3 min-h-[44px] rounded-xl text-left text-sm font-semibold transition-all active:scale-98 flex items-center justify-between ${
                  currentTab === 'fixtures' ? 'bg-amber-500/20 text-amber-400 border border-amber-500/40 shadow-sm' : 'bg-white/5 text-slate-200 hover:bg-white/10'
                }`}
              >
                <span className="flex items-center gap-2">
                  <span>🏸</span>
                  <span>Match Centre</span>
                </span>
                {liveMatchesCount > 0 && (
                  <span className="px-1.5 py-0.5 text-[9px] font-black rounded-full bg-rose-500/30 text-rose-300 border border-rose-500/40">
                    {liveMatchesCount}
                  </span>
                )}
              </button>
              <button
                onClick={() => handleNav('standings')}
                className={`p-3 min-h-[44px] rounded-xl text-left text-sm font-semibold transition-all active:scale-98 flex items-center gap-2 ${
                  currentTab === 'standings' ? 'bg-amber-500/20 text-amber-400 border border-amber-500/40 shadow-sm' : 'bg-white/5 text-slate-200 hover:bg-white/10'
                }`}
              >
                <span>🏆</span>
                <span>Standings</span>
              </button>
              <button
                onClick={() => handleNav('knockout')}
                className={`p-3 min-h-[44px] rounded-xl text-left text-sm font-semibold transition-all active:scale-98 flex items-center gap-2 ${
                  currentTab === 'knockout' ? 'bg-amber-500/20 text-amber-400 border border-amber-500/40 shadow-sm' : 'bg-white/5 text-slate-200 hover:bg-white/10'
                }`}
              >
                <span>⚔️</span>
                <span>Knockout</span>
              </button>
            </div>

            <div className="pt-2 border-t border-white/10 space-y-1">
              <button
                onClick={() => handleNav('teams')}
                className={`w-full flex items-center justify-between p-3 min-h-[44px] rounded-xl transition-all active:scale-98 text-sm ${
                  currentTab === 'teams' ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30' : 'hover:bg-white/5 text-slate-300'
                }`}
              >
                <span>Teams & Squads</span>
                <span className="text-xs text-slate-400">{state.teams.length} teams</span>
              </button>
              <button
                onClick={() => handleNav('players')}
                className={`w-full flex items-center justify-between p-3 min-h-[44px] rounded-xl transition-all active:scale-98 text-sm ${
                  currentTab === 'players' ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30' : 'hover:bg-white/5 text-slate-300'
                }`}
              >
                <span>Players Directory</span>
                <span className="text-xs text-slate-400">{state.players.length} players</span>
              </button>
              <button
                onClick={() => handleNav('tokens')}
                className={`w-full flex items-center justify-between p-3 min-h-[44px] rounded-xl transition-all active:scale-98 text-sm ${
                  currentTab === 'tokens' ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30' : 'hover:bg-white/5 text-slate-300'
                }`}
              >
                <span>Token Draw (Lottery)</span>
                <Dices className="w-4 h-4 text-amber-400" />
              </button>
              <button
                onClick={() => handleNav('registration')}
                className={`w-full flex items-center justify-between p-3 min-h-[44px] rounded-xl transition-all active:scale-98 text-sm ${
                  currentTab === 'registration' ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30' : 'hover:bg-white/5 text-slate-300'
                }`}
              >
                <span>Player Registration Config</span>
                <PlusCircle className="w-4 h-4 text-amber-400" />
              </button>
              <button
                onClick={() => handleNav('registered')}
                className={`w-full flex items-center justify-between p-3 min-h-[44px] rounded-xl transition-all active:scale-98 text-sm ${
                  currentTab === 'registered' ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30' : 'hover:bg-white/5 text-slate-300'
                }`}
              >
                <span>Registered Roster & Payments</span>
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              </button>
              <button
                onClick={() => handleNav('statistics')}
                className={`w-full flex items-center justify-between p-3 min-h-[44px] rounded-xl transition-all active:scale-98 text-sm ${
                  currentTab === 'statistics' ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30' : 'hover:bg-white/5 text-slate-300'
                }`}
              >
                <span>Tournament Statistics</span>
                <BarChart3 className="w-4 h-4 text-blue-400" />
              </button>
              <button
                onClick={() => handleNav('champion')}
                className={`w-full flex items-center justify-between p-3 min-h-[44px] rounded-xl transition-all active:scale-98 text-sm ${
                  currentTab === 'champion' ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30' : 'hover:bg-white/5 text-slate-300'
                }`}
              >
                <span>Champion Ceremony</span>
                <Trophy className="w-4 h-4 text-amber-400" />
              </button>
              {canManageTournament && (
                <button
                  onClick={() => handleNav('hero')}
                  className={`w-full flex items-center justify-between p-3 min-h-[44px] rounded-xl transition-all active:scale-98 text-sm font-semibold ${
                    currentTab === 'hero' ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30' : 'hover:bg-white/5 text-slate-200'
                  }`}
                >
                  <span>Hero Section Manager</span>
                  <Palette className="w-4 h-4 text-amber-400" />
                </button>
              )}
              {canManageTournament && (
                <button
                  onClick={() => handleNav('livestream')}
                  className={`w-full flex items-center justify-between p-3 min-h-[44px] rounded-xl transition-all active:scale-98 text-sm font-semibold ${
                    currentTab === 'livestream' ? 'bg-red-500/20 text-red-200 border border-red-500/30' : 'hover:bg-white/5 text-slate-200'
                  }`}
                >
                  <span className="flex items-center gap-2">
                    <span>YouTube Live Stream</span>
                    {isStreamLive && (
                      <span className="px-1.5 py-0.5 rounded-full text-[9px] font-black uppercase bg-red-600/30 text-red-300 border border-red-500/40">
                        LIVE
                      </span>
                    )}
                  </span>
                  <Tv className="w-4 h-4 text-red-400" />
                </button>
              )}
              <button
                onClick={() => handleNav('settings')}
                className={`w-full flex items-center justify-between p-3 min-h-[44px] rounded-xl transition-all active:scale-98 text-sm ${
                  currentTab === 'settings' ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30' : 'hover:bg-white/5 text-slate-300'
                }`}
              >
                <span>Settings & Data Backup</span>
                <Sliders className="w-4 h-4 text-slate-400" />
              </button>
              {isSuperAdmin && (
                <button
                  onClick={() => handleNav('users')}
                  className={`w-full flex items-center justify-between p-3 min-h-[44px] rounded-xl transition-all active:scale-98 text-sm font-semibold ${
                    currentTab === 'users' ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30' : 'hover:bg-white/5 text-amber-300'
                  }`}
                >
                  <span>User Management (RBAC)</span>
                  <ShieldCheck className="w-4 h-4 text-amber-400" />
                </button>
              )}

              <div className="pt-2 border-t border-white/10 space-y-1.5">
                <button
                  onClick={() => {
                    setMobileMenuOpen(false);
                    setAccountModalOpen(true);
                  }}
                  className="w-full flex items-center justify-between p-3 min-h-[44px] rounded-xl bg-white/5 hover:bg-white/10 text-slate-200 text-sm transition-all active:scale-98"
                >
                  <span>My Account & Security</span>
                  <User className="w-4 h-4 text-amber-400" />
                </button>
                {onViewPublicHome && (
                  <button
                    onClick={() => {
                      setMobileMenuOpen(false);
                      onViewPublicHome();
                    }}
                    className="w-full flex items-center justify-between p-3 min-h-[44px] rounded-xl bg-lime-400/10 hover:bg-lime-400/20 text-lime-400 text-sm border border-lime-400/30 transition-all active:scale-98 font-bold"
                  >
                    <span>View Public Tournament Home</span>
                    <ExternalLink className="w-4 h-4 text-lime-400" />
                  </button>
                )}
                {onLogout && (
                  <button
                    onClick={() => {
                      setMobileMenuOpen(false);
                      onLogout();
                    }}
                    className="w-full flex items-center justify-between p-3 min-h-[44px] rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 text-sm border border-rose-500/30 transition-all active:scale-98 font-semibold"
                  >
                    <span>Logout Administrator</span>
                    <LogOut className="w-4 h-4 text-rose-400" />
                  </button>
                )}
              </div>
            </div>
          </div>
        </>
      )}

      {/* Authenticated User Account & Password Modal */}
      <MyAccountModal
        isOpen={accountModalOpen}
        onClose={() => setAccountModalOpen(false)}
      />
    </header>
  );
};
