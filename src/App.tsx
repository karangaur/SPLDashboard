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
import { UserManagementView } from './components/users/UserManagementView';
import { ScoreOperatorDashboard } from './components/scorer/ScoreOperatorDashboard';
import { PublicRegistrationPage } from './components/registration/PublicRegistrationPage';
import { AdminLoginPage } from './components/auth/AdminLoginPage';
import { HeroHomePage } from './components/home/HeroHomePage';
import { AuthService } from './services/authService';
import {
  LayoutDashboard,
  Swords,
  TrendingUp,
  Trophy,
  Dices,
  UserPlus,
} from 'lucide-react';

const RESERVED_PATHS = new Set([
  '',
  'home',
  'admin',
  'login',
  'api',
  'dashboard',
  'fixtures',
  'standings',
  'teams',
  'players',
  'knockout',
  'tokens',
  'registration',
  'registered',
  'statistics',
  'champion',
  'settings',
  'users',
]);

function getRouteInfo(): { mode: 'home' | 'admin' | 'login' | 'register'; season?: string } {
  if (typeof window === 'undefined') return { mode: 'home' };
  const path = window.location.pathname;
  const search = window.location.search;
  const hash = window.location.hash;
  const searchParams = new URLSearchParams(search);

  // 1. Check login
  if (path === '/login' || hash === '#/login' || searchParams.has('login')) {
    return { mode: 'login' };
  }

  // 2. Check admin
  if (path === '/admin' || hash === '#/admin') {
    return { mode: 'admin' };
  }

  // 3. Check query triggers
  if (
    searchParams.has('register') ||
    searchParams.has('slug') ||
    searchParams.has('token') ||
    searchParams.has('tok') ||
    hash.startsWith('#/register') ||
    hash.includes('token=')
  ) {
    const slug = searchParams.get('register') || searchParams.get('slug') || undefined;
    return { mode: 'register', season: slug };
  }

  // 4. Check clean custom URL slugs (e.g. /spl-maharajganj-2026, /spl-season-3, /register)
  const cleanPath = path.replace(/^\/+|\/+$/g, '');
  if (cleanPath.length > 0) {
    const segments = cleanPath.split('/');
    const firstSegment = segments[0]?.toLowerCase();
    if (firstSegment === 'register') {
      return { mode: 'register', season: segments[1] || undefined };
    }
    if (firstSegment && !RESERVED_PATHS.has(firstSegment)) {
      return { mode: 'register', season: firstSegment };
    }
  }

  // 5. Check hash-based custom slugs (e.g. #/spl-maharajganj-2026)
  if (hash.startsWith('#/')) {
    const hashClean = hash.replace(/^#\/+/, '').split('/')[0]?.toLowerCase();
    if (hashClean && !RESERVED_PATHS.has(hashClean)) {
      return { mode: 'register', season: hashClean };
    }
  }

  return { mode: 'home' };
}

export default function App() {
  const [currentTab, setCurrentTab] = useState<NavTab>('dashboard');
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(() => AuthService.isAuthenticated());

  // Determine initial view from URL
  const [viewMode, setViewMode] = useState<'home' | 'admin' | 'login' | 'register'>(() => {
    return getRouteInfo().mode;
  });

  const [publicSeason, setPublicSeason] = useState<string | undefined>(() => {
    return getRouteInfo().season;
  });

  // Listen for browser popstate / back button
  useEffect(() => {
    const checkRoute = () => {
      const route = getRouteInfo();
      setViewMode(route.mode);
      if (route.season !== undefined) {
        setPublicSeason(route.season);
      }
    };

    window.addEventListener('popstate', checkRoute);
    return () => window.removeEventListener('popstate', checkRoute);
  }, []);

  const handleOpenPublicForm = (season?: string) => {
    setPublicSeason(season);
    setViewMode('register');
    try {
      const targetSlug = season || 'register';
      window.history.pushState({}, '', `/${targetSlug}`);
    } catch {}
  };

  const handleBackToDashboard = () => {
    setViewMode('home');
    try {
      window.history.pushState({}, '', '/');
    } catch {}
  };

  const handleLogout = () => {
    AuthService.logout();
    setIsAuthenticated(false);
    setViewMode('home');
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
      case 'users':
        return <UserManagementView />;
      default:
        return <DashboardView onSelectTab={setCurrentTab} />;
    }
  };

  return (
    <TournamentProvider>
      {viewMode === 'register' ? (
        /* Standalone Public Player Registration Form */
        <PublicRegistrationPage
          seasonParam={publicSeason}
          onBackToApp={handleBackToDashboard}
        />
      ) : viewMode === 'login' ? (
        /* Modern Badminton-Sporty Admin Login Page */
        <AdminLoginPage
          onLoginSuccess={() => {
            setIsAuthenticated(true);
            setViewMode('admin');
          }}
          onGoToPublicRegister={() => handleOpenPublicForm()}
          onBackToHome={() => setViewMode('home')}
        />
      ) : viewMode === 'admin' ? (
        !isAuthenticated ? (
          <AdminLoginPage
            onLoginSuccess={() => {
              setIsAuthenticated(true);
              setViewMode('admin');
            }}
            onGoToPublicRegister={() => handleOpenPublicForm()}
            onBackToHome={() => setViewMode('home')}
          />
        ) : AuthService.isScoreOperator() ? (
          /* Normal User (Score Operator) Dedicated Console */
          <ScoreOperatorDashboard
            user={AuthService.getCurrentUser()!}
            onLogout={handleLogout}
          />
        ) : (
          /* Super Admin Tournament Dashboard Shell */
          <div className="min-h-screen flex flex-col bg-[#070a13] text-slate-100 selection:bg-amber-400 selection:text-slate-950 font-sans pb-20 lg:pb-0">
            {/* Main Header with 3-Zone Contract, View Public Site & Logout */}
            <Header
              currentTab={currentTab}
              onSelectTab={(tab) => {
                setCurrentTab(tab);
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }}
              onLogout={handleLogout}
              onViewPublicHome={() => setViewMode('home')}
            />

            {/* Viewport Content Area */}
            <main className="flex-1 w-full max-w-7xl mx-auto px-3.5 sm:px-6 lg:px-8 py-5 sm:py-8 overflow-x-hidden">
              {renderActiveView()}
            </main>

            {/* Global Footer with Persistence info */}
            <Footer
              onSelectTab={(tab) => {
                setCurrentTab(tab);
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }}
            />

            {/* Mobile Fixed Bottom Navigation Bar */}
            <nav
              aria-label="Mobile Primary Navigation"
              className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-slate-950/95 backdrop-blur-xl border-t border-white/10 px-1.5 pt-1.5 pb-safe flex items-center justify-around shadow-2xl"
            >
              <button
                onClick={() => {
                  setCurrentTab('dashboard');
                  window.scrollTo({ top: 0, behavior: 'smooth' });
                }}
                aria-label="Live Dashboard"
                aria-current={currentTab === 'dashboard' ? 'page' : undefined}
                className={`flex flex-col items-center justify-center p-1.5 rounded-xl transition-colors min-w-[56px] min-h-[48px] ${
                  currentTab === 'dashboard' ? 'text-amber-400 font-bold bg-amber-400/10' : 'text-slate-400 hover:text-white'
                }`}
              >
                <LayoutDashboard className="w-4 h-4" />
                <span className="text-[10px] mt-0.5">Live</span>
              </button>

              <button
                onClick={() => {
                  setCurrentTab('fixtures');
                  window.scrollTo({ top: 0, behavior: 'smooth' });
                }}
                aria-label="Matches and Fixtures"
                aria-current={currentTab === 'fixtures' ? 'page' : undefined}
                className={`flex flex-col items-center justify-center p-1.5 rounded-xl transition-colors min-w-[56px] min-h-[48px] ${
                  currentTab === 'fixtures' ? 'text-amber-400 font-bold bg-amber-400/10' : 'text-slate-400 hover:text-white'
                }`}
              >
                <Swords className="w-4 h-4" />
                <span className="text-[10px] mt-0.5">Matches</span>
              </button>

              <button
                onClick={() => {
                  setCurrentTab('standings');
                  window.scrollTo({ top: 0, behavior: 'smooth' });
                }}
                aria-label="Standings Table"
                aria-current={currentTab === 'standings' ? 'page' : undefined}
                className={`flex flex-col items-center justify-center p-1.5 rounded-xl transition-colors min-w-[56px] min-h-[48px] ${
                  currentTab === 'standings' ? 'text-amber-400 font-bold bg-amber-400/10' : 'text-slate-400 hover:text-white'
                }`}
              >
                <TrendingUp className="w-4 h-4" />
                <span className="text-[10px] mt-0.5">Table</span>
              </button>

              <button
                onClick={() => {
                  setCurrentTab('registration');
                  window.scrollTo({ top: 0, behavior: 'smooth' });
                }}
                aria-label="Player Registration"
                aria-current={currentTab === 'registration' ? 'page' : undefined}
                className={`flex flex-col items-center justify-center p-1.5 rounded-xl transition-colors min-w-[56px] min-h-[48px] ${
                  currentTab === 'registration' ? 'text-amber-400 font-bold bg-amber-400/10' : 'text-slate-400 hover:text-white'
                }`}
              >
                <UserPlus className="w-4 h-4" />
                <span className="text-[10px] mt-0.5">Register</span>
              </button>

              <button
                onClick={() => {
                  setCurrentTab('tokens');
                  window.scrollTo({ top: 0, behavior: 'smooth' });
                }}
                aria-label="Token Lottery Draw"
                aria-current={currentTab === 'tokens' ? 'page' : undefined}
                className={`flex flex-col items-center justify-center p-1.5 rounded-xl transition-colors min-w-[56px] min-h-[48px] ${
                  currentTab === 'tokens' ? 'text-amber-400 font-bold bg-amber-400/10' : 'text-slate-400 hover:text-white'
                }`}
              >
                <Dices className="w-4 h-4" />
                <span className="text-[10px] mt-0.5">Tokens</span>
              </button>
            </nav>
          </div>
        )
      ) : (
        /* Premium Badminton Tournament Hero Homepage */
        <HeroHomePage
          onOpenLogin={() => {
            if (isAuthenticated) {
              setViewMode('admin');
            } else {
              setViewMode('login');
            }
          }}
          onOpenPublicRegister={() => handleOpenPublicForm()}
          onGoToAdmin={() => setViewMode('admin')}
        />
      )}
    </TournamentProvider>
  );
}
