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
import { HeroSectionManagerView } from './components/hero-admin/HeroSectionManagerView';
import { ScoreOperatorDashboard } from './components/scorer/ScoreOperatorDashboard';
import { PublicRegistrationPage } from './components/registration/PublicRegistrationPage';
import { AdminLoginPage } from './components/auth/AdminLoginPage';
import { HeroHomePage } from './components/home/HeroHomePage';
import { AuthService } from './services/authService';
import {
  LayoutDashboard,
  Swords,
  TrendingUp,
  Dices,
  UserPlus,
} from 'lucide-react';

const RESERVED_PATHS = new Set([
  '',
  'home',
  'admin',
  'admin-spl',
  'login',
  'api',
  'dashboard',
  'fixtures',
  'matches',
  'standings',
  'teams',
  'players',
  'knockout',
  'tokens',
  'registration',
  'registered',
  'statistics',
  'champion',
  'hero',
  'hero-manager',
  'settings',
  'users',
]);

const VALID_ADMIN_TABS: Record<string, NavTab> = {
  dashboard: 'dashboard',
  fixtures: 'fixtures',
  matches: 'fixtures',
  standings: 'standings',
  teams: 'teams',
  players: 'players',
  knockout: 'knockout',
  tokens: 'tokens',
  registration: 'registration',
  registered: 'registered',
  statistics: 'statistics',
  champion: 'champion',
  hero: 'hero',
  'hero-manager': 'hero',
  settings: 'settings',
  users: 'users',
};

export type AppRouteMode = 'home' | 'admin-login' | 'admin-dashboard' | 'register';

export interface RouteInfo {
  mode: AppRouteMode;
  tab?: NavTab;
  season?: string;
}

function parseCurrentRoute(isAuthenticated: boolean): RouteInfo {
  if (typeof window === 'undefined') return { mode: 'home' };
  const rawPath = window.location.pathname;
  const path = rawPath.replace(/\/+$/, '') || '/';
  const search = window.location.search || '';
  const hash = window.location.hash || '';
  const searchParams = new URLSearchParams(search);

  // 1. Dedicated Admin Routes: /admin-spl
  if (path === '/admin-spl' || hash === '#/admin-spl') {
    if (isAuthenticated) {
      return { mode: 'admin-dashboard', tab: 'dashboard' };
    }
    return { mode: 'admin-login' };
  }

  // 1b. Dedicated Admin Sub-routes: /admin-spl/:subpath
  if (path.startsWith('/admin-spl/')) {
    const rawSubpath = path.slice('/admin-spl/'.length).split('/')[0]?.toLowerCase() || 'dashboard';
    const mappedTab = VALID_ADMIN_TABS[rawSubpath] || 'dashboard';
    if (isAuthenticated) {
      return { mode: 'admin-dashboard', tab: mappedTab };
    }
    return { mode: 'admin-login' };
  }

  // 2. Legacy admin / login entry points -> map to admin-spl
  if (path === '/login' || path === '/admin' || hash === '#/login' || hash === '#/admin' || searchParams.has('login')) {
    if (isAuthenticated) {
      return { mode: 'admin-dashboard', tab: 'dashboard' };
    }
    return { mode: 'admin-login' };
  }

  // 3. Public registration query triggers
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

  // 4. Clean custom URL slugs (e.g. /spl-maharajganj-2026, /spl-season-4, /register)
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

  // 5. Hash-based custom slugs (e.g. #/spl-maharajganj-2026)
  if (hash.startsWith('#/')) {
    const hashClean = hash.replace(/^#\/+/, '').split('/')[0]?.toLowerCase();
    if (hashClean && !RESERVED_PATHS.has(hashClean)) {
      return { mode: 'register', season: hashClean };
    }
  }

  // 6. Default: Main Public SPL Website
  return { mode: 'home' };
}

export default function App() {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(() => AuthService.isAuthenticated());

  const initialRoute = parseCurrentRoute(AuthService.isAuthenticated());
  const [currentTab, setCurrentTab] = useState<NavTab>(initialRoute.tab || 'dashboard');
  const [viewMode, setViewMode] = useState<AppRouteMode>(initialRoute.mode);
  const [publicSeason, setPublicSeason] = useState<string | undefined>(initialRoute.season);

  // Initial URL cleanup on mount (ensure browser address bar matches canonical route)
  useEffect(() => {
    const authed = AuthService.isAuthenticated();
    setIsAuthenticated(authed);
    const route = parseCurrentRoute(authed);

    if (route.mode === 'admin-login') {
      if (window.location.pathname !== '/admin-spl') {
        try {
          window.history.replaceState({}, '', '/admin-spl');
        } catch {}
      }
    } else if (route.mode === 'admin-dashboard') {
      const canonical = route.tab && route.tab !== 'dashboard' ? `/admin-spl/${route.tab}` : '/admin-spl/dashboard';
      if (window.location.pathname === '/admin-spl' || window.location.pathname === '/admin-spl/' || window.location.pathname === '/admin' || window.location.pathname === '/login') {
        try {
          window.history.replaceState({}, '', canonical);
        } catch {}
      }
    }
  }, []);

  // Listen for browser popstate / back & forward navigation
  useEffect(() => {
    const handlePopState = () => {
      const authed = AuthService.isAuthenticated();
      setIsAuthenticated(authed);
      const route = parseCurrentRoute(authed);
      setViewMode(route.mode);
      if (route.tab) {
        setCurrentTab(route.tab);
      }
      if (route.season !== undefined) {
        setPublicSeason(route.season);
      }
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  // Tab navigation in Admin Portal (updates active tab and browser URL)
  const handleSelectAdminTab = (tab: NavTab) => {
    setCurrentTab(tab);
    window.scrollTo({ top: 0, behavior: 'smooth' });
    try {
      const targetPath = tab === 'dashboard' ? '/admin-spl/dashboard' : `/admin-spl/${tab}`;
      if (window.location.pathname !== targetPath) {
        window.history.pushState({}, '', targetPath);
      }
    } catch {}
  };

  // Navigate to Public Website from anywhere
  const handleGoToPublicHome = () => {
    setViewMode('home');
    try {
      window.history.pushState({}, '', '/');
    } catch {}
  };

  // Open Public Player Registration Form
  const handleOpenPublicForm = (season?: string) => {
    setPublicSeason(season);
    setViewMode('register');
    try {
      const targetSlug = season || 'register';
      window.history.pushState({}, '', `/${targetSlug}`);
    } catch {}
  };

  // Admin Logout: clears session and redirects to /admin-spl
  const handleLogout = () => {
    AuthService.logout();
    setIsAuthenticated(false);
    setViewMode('admin-login');
    try {
      window.history.pushState({}, '', '/admin-spl');
    } catch {}
  };

  // Successful Login: activates session and redirects to /admin-spl/dashboard
  const handleLoginSuccess = () => {
    setIsAuthenticated(true);
    setViewMode('admin-dashboard');
    setCurrentTab('dashboard');
    try {
      window.history.pushState({}, '', '/admin-spl/dashboard');
    } catch {}
  };

  const renderActiveView = () => {
    switch (currentTab) {
      case 'dashboard':
        return <DashboardView onSelectTab={handleSelectAdminTab} />;
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
            onSelectTab={handleSelectAdminTab}
            onOpenPublicForm={handleOpenPublicForm}
          />
        );
      case 'registered':
        return <RegisteredView />;
      case 'statistics':
        return <StatisticsView />;
      case 'champion':
        return <ChampionView />;
      case 'hero':
        return <HeroSectionManagerView />;
      case 'settings':
        return <SettingsView />;
      case 'users':
        return <UserManagementView />;
      default:
        return <DashboardView onSelectTab={handleSelectAdminTab} />;
    }
  };

  return (
    <TournamentProvider>
      {viewMode === 'register' ? (
        /* Standalone Public Player Registration Form */
        <PublicRegistrationPage
          seasonParam={publicSeason}
          onBackToApp={handleGoToPublicHome}
        />
      ) : viewMode === 'admin-login' ? (
        /* Dedicated Admin Login Portal at /admin-spl */
        <AdminLoginPage
          onLoginSuccess={handleLoginSuccess}
          onGoToPublicRegister={() => handleOpenPublicForm()}
          onBackToHome={handleGoToPublicHome}
        />
      ) : viewMode === 'admin-dashboard' ? (
        !isAuthenticated ? (
          /* Guard: unauthenticated attempts to view admin dashboard redirect to login */
          <AdminLoginPage
            onLoginSuccess={handleLoginSuccess}
            onGoToPublicRegister={() => handleOpenPublicForm()}
            onBackToHome={handleGoToPublicHome}
          />
        ) : AuthService.isScoreOperator() ? (
          /* Normal User (Score Operator) Dedicated Console */
          <ScoreOperatorDashboard
            user={AuthService.getCurrentUser()!}
            onLogout={handleLogout}
            onViewPublicHome={handleGoToPublicHome}
          />
        ) : (
          /* Super Admin Tournament Dashboard Shell at /admin-spl/* */
          <div className="min-h-screen flex flex-col bg-[#070a13] text-slate-100 selection:bg-amber-400 selection:text-slate-950 font-sans pb-20 lg:pb-0">
            {/* Main Header with 3-Zone Contract, View Public Site & Logout */}
            <Header
              currentTab={currentTab}
              onSelectTab={handleSelectAdminTab}
              onLogout={handleLogout}
              onViewPublicHome={handleGoToPublicHome}
            />

            {/* Viewport Content Area */}
            <main className="flex-1 w-full max-w-7xl mx-auto px-3.5 sm:px-6 lg:px-8 py-5 sm:py-8 overflow-x-hidden">
              {renderActiveView()}
            </main>

            {/* Global Footer with Persistence info */}
            <Footer
              onSelectTab={handleSelectAdminTab}
            />

            {/* Mobile Fixed Bottom Navigation Bar */}
            <nav
              aria-label="Mobile Primary Navigation"
              className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-slate-950/95 backdrop-blur-xl border-t border-white/10 px-1.5 pt-1.5 pb-safe flex items-center justify-around shadow-2xl"
            >
              <button
                onClick={() => handleSelectAdminTab('dashboard')}
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
                onClick={() => handleSelectAdminTab('fixtures')}
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
                onClick={() => handleSelectAdminTab('standings')}
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
                onClick={() => handleSelectAdminTab('registration')}
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
                onClick={() => handleSelectAdminTab('tokens')}
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
        /* Main Public SPL Website at / (Accessible to everyone, zero admin controls) */
        <HeroHomePage
          onOpenPublicRegister={() => handleOpenPublicForm()}
        />
      )}
    </TournamentProvider>
  );
}
