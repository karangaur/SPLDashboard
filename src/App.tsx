import React, { useState, useEffect } from 'react';
import { TournamentProvider } from './context/TournamentContext';
import { Header, NavTab } from './components/common/Header';
import { Footer } from './components/common/Footer';
import { DashboardView } from './components/dashboard/DashboardView';
import { FixturesView } from './components/fixtures/FixturesView';
import { StandingsView } from './components/standings/StandingsView';
import { TeamsView } from './components/teams/TeamsView';
import { PlayersView } from './components/players/PlayersView';
import { KnockoutView } from './components/knockout/KnockoutView';
import { TokensView } from './components/tokens/TokensView';
import { RegistrationView } from './components/registration/RegistrationView';
import { RegisteredView } from './components/registered/RegisteredView';
import { StatisticsView } from './components/statistics/StatisticsView';
import { ChampionView } from './components/champion/ChampionView';
import { SettingsView } from './components/settings/SettingsView';
import { PublicRegistrationPage } from './components/registration/PublicRegistrationPage';
import {
  LayoutDashboard,
  Swords,
  TrendingUp,
  Trophy,
  Dices,
  UserPlus,
} from 'lucide-react';

export default function App() {
  const [currentTab, setCurrentTab] = useState<NavTab>('dashboard');

  // Check if current route is public registration link
  const [isPublicMode, setIsPublicMode] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    const path = window.location.pathname;
    const search = window.location.search;
    const hash = window.location.hash;
    return (
      path.startsWith('/register') ||
      new URLSearchParams(search).has('register') ||
      hash.startsWith('#/register')
    );
  });

  const [publicSeason, setPublicSeason] = useState<string | undefined>(() => {
    if (typeof window === 'undefined') return undefined;
    const params = new URLSearchParams(window.location.search);
    if (params.has('register')) return params.get('register') || undefined;
    const match = window.location.pathname.match(/\/register\/([^\/]+)/);
    if (match) return match[1];
    const hashMatch = window.location.hash.match(/#\/register\/([^\/]+)/);
    if (hashMatch) return hashMatch[1];
    return undefined;
  });

  // Listen for browser popstate / back button
  useEffect(() => {
    const checkRoute = () => {
      const path = window.location.pathname;
      const search = window.location.search;
      const hash = window.location.hash;
      const shouldBePublic =
        path.startsWith('/register') ||
        new URLSearchParams(search).has('register') ||
        hash.startsWith('#/register');

      setIsPublicMode(shouldBePublic);
      if (shouldBePublic) {
        const params = new URLSearchParams(search);
        if (params.has('register')) setPublicSeason(params.get('register') || undefined);
      }
    };

    window.addEventListener('popstate', checkRoute);
    return () => window.removeEventListener('popstate', checkRoute);
  }, []);

  const handleOpenPublicForm = (season?: string) => {
    setPublicSeason(season);
    setIsPublicMode(true);
  };

  const handleBackToDashboard = () => {
    setIsPublicMode(false);
    // Clean URL query without reload
    try {
      if (window.location.search.includes('register')) {
        const url = new URL(window.location.href);
        url.searchParams.delete('register');
        window.history.pushState({}, '', url.pathname);
      }
    } catch {}
  };

  const renderActiveView = () => {
    switch (currentTab) {
      case 'dashboard':
        return <DashboardView onSelectTab={setCurrentTab} />;
      case 'fixtures':
        return <FixturesView />;
      case 'standings':
        return <StandingsView />;
      case 'teams':
        return <TeamsView />;
      case 'players':
        return <PlayersView />;
      case 'knockout':
        return <KnockoutView />;
      case 'tokens':
        return <TokensView />;
      case 'registration':
        return (
          <RegistrationView
            onSelectTab={setCurrentTab}
            onOpenPublicForm={handleOpenPublicForm}
          />
        );
      case 'registered':
        return <RegisteredView />;
      case 'statistics':
        return <StatisticsView />;
      case 'champion':
        return <ChampionView />;
      case 'settings':
        return <SettingsView />;
      default:
        return <DashboardView onSelectTab={setCurrentTab} />;
    }
  };

  return (
    <TournamentProvider>
      {isPublicMode ? (
        /* Standalone Public Player Registration Form */
        <PublicRegistrationPage
          seasonParam={publicSeason}
          onBackToApp={handleBackToDashboard}
        />
      ) : (
        /* Admin Tournament Dashboard Shell */
        <div className="min-h-screen flex flex-col bg-[#070a13] text-slate-100 selection:bg-amber-400 selection:text-slate-950 font-sans">
          {/* Main Header with 3-Zone Contract */}
          <Header currentTab={currentTab} onSelectTab={setCurrentTab} />

          {/* Viewport Content Area */}
          <main className="flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
            {renderActiveView()}
          </main>

          {/* Global Footer with Persistence info */}
          <Footer onSelectTab={setCurrentTab} />

          {/* Mobile Fixed Bottom Navigation Bar (≤ 15% Mobile Sticky Cap) */}
          <div className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-slate-950/90 backdrop-blur-lg border-t border-white/10 px-2 py-1.5 flex items-center justify-around shadow-2xl">
            <button
              onClick={() => setCurrentTab('dashboard')}
              className={`flex flex-col items-center justify-center p-1.5 rounded-xl transition-colors min-w-[56px] min-h-[44px] ${
                currentTab === 'dashboard' ? 'text-amber-400 font-bold' : 'text-slate-400 hover:text-white'
              }`}
            >
              <LayoutDashboard className="w-4 h-4" />
              <span className="text-[10px] mt-0.5">Live</span>
            </button>

            <button
              onClick={() => setCurrentTab('fixtures')}
              className={`flex flex-col items-center justify-center p-1.5 rounded-xl transition-colors min-w-[56px] min-h-[44px] ${
                currentTab === 'fixtures' ? 'text-amber-400 font-bold' : 'text-slate-400 hover:text-white'
              }`}
            >
              <Swords className="w-4 h-4" />
              <span className="text-[10px] mt-0.5">Matches</span>
            </button>

            <button
              onClick={() => setCurrentTab('standings')}
              className={`flex flex-col items-center justify-center p-1.5 rounded-xl transition-colors min-w-[56px] min-h-[44px] ${
                currentTab === 'standings' ? 'text-amber-400 font-bold' : 'text-slate-400 hover:text-white'
              }`}
            >
              <TrendingUp className="w-4 h-4" />
              <span className="text-[10px] mt-0.5">Table</span>
            </button>

            <button
              onClick={() => setCurrentTab('registration')}
              className={`flex flex-col items-center justify-center p-1.5 rounded-xl transition-colors min-w-[56px] min-h-[44px] ${
                currentTab === 'registration' ? 'text-amber-400 font-bold' : 'text-slate-400 hover:text-white'
              }`}
            >
              <UserPlus className="w-4 h-4" />
              <span className="text-[10px] mt-0.5">Register</span>
            </button>

            <button
              onClick={() => setCurrentTab('tokens')}
              className={`flex flex-col items-center justify-center p-1.5 rounded-xl transition-colors min-w-[56px] min-h-[44px] ${
                currentTab === 'tokens' ? 'text-amber-400 font-bold' : 'text-slate-400 hover:text-white'
              }`}
            >
              <Dices className="w-4 h-4" />
              <span className="text-[10px] mt-0.5">Tokens</span>
            </button>
          </div>
        </div>
      )}
    </TournamentProvider>
  );
}
