import React, { useState, useMemo, useCallback } from 'react';
import {
  Trophy,
  Swords,
  Users,
  MapPin,
  Calendar,
  Sparkles,
  ArrowRight,
  ExternalLink,
  Flame,
  Clock,
  Share2,
  ChevronDown,
  Activity,
  Shield,
  Star,
  PlusCircle,
  LogIn,
  X,
  Play,
  Sliders,
  Menu,
} from 'lucide-react';
import { useTournament } from '../../context/TournamentContext';
import { BadmintonHeroVisual } from './BadmintonHeroVisual';
import { LiveMatchHero } from './LiveMatchHero';
import { FixturesShowcaseSection } from './FixturesShowcaseSection';
import { TeamsShowcaseSection } from './TeamsShowcaseSection';
import { StandingsShowcaseSection } from './StandingsShowcaseSection';
import { SPLLogo, SPLLogoEmblemSvg } from '../common/SPLLogo';
import { Match, Player } from '../../types/tournament';
import { AuthService } from '../../services/authService';

interface HeroHomePageProps {
  onOpenPublicRegister: () => void;
  onOpenLogin?: () => void;
  onGoToAdmin?: () => void;
}

export const HeroHomePage: React.FC<HeroHomePageProps> = ({
  onOpenPublicRegister,
  onOpenLogin,
  onGoToAdmin,
}) => {
  const { state, standings, realtimeStatus, reconnectRealtime } = useTournament();

  const [detailMatchSnapshot, setDetailMatch] = useState<Match | null>(null);
  const [selectedTeamId, setSelectedTeamId] = useState<string | null>(null);
  const [copiedStandings, setCopiedStandings] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  React.useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setMobileNavOpen(false);
        setDetailMatch(null);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  // Helper lookups
  const getTeam = (teamId?: string) => state.teams.find((t) => t.id === teamId);
  const getPlayer = (playerId?: string) => state.players.find((p) => p.id === playerId);

  const formatKnockoutStageLabel = (stage?: string, slot?: number) => {
    if (stage === 'F') return 'Grand Final';
    if (stage === 'SF') return `Semi-Final ${slot || 1}`;
    if (stage === 'ELIM' || stage === 'QF') return `Quarter-Final ${slot || 1}`;
    return 'Knockout Match';
  };

  // Normalize knockout matches into unified public Match broadcast shape
  const normalizedKnockoutMatches: Match[] = React.useMemo(() => {
    const stageOrder: Record<string, number> = { F: 3, SF: 2, ELIM: 1, QF: 1 };
    return [...(state.knockout?.matches || [])]
      .sort((a, b) => {
        const pa = stageOrder[a.stage] ?? 0;
        const pb = stageOrder[b.stage] ?? 0;
        if (pb !== pa) return pb - pa;
        return (a.slot || 1) - (b.slot || 1);
      })
      .map((ko) => {
        const cNum = ko.court || 1;
        const cName =
          ko.courtName ||
          state.settings.courtNames?.[cNum - 1]?.trim() ||
          `Court ${cNum}`;
        const stageLabel = formatKnockoutStageLabel(ko.stage, ko.slot);
        return {
          id: ko.id,
          round: ko.stage === 'F' ? 999 : ko.stage === 'SF' ? 998 : 997,
          court: cNum,
          courtName: cName,
          teamA: ko.teamA || '',
          teamB: ko.teamB || '',
          scoreA: ko.scoreA,
          scoreB: ko.scoreB,
          status: ko.status,
          winner: ko.winner,
          time: ko.time || `${stageLabel} · ${cName}`,
          sets: ko.sets,
          mvpPlayerId: ko.mvpPlayerId,
          version: ko.version,
          matchType: 'knockout' as const,
          stage: ko.stage,
          slot: ko.slot,
          stageLabel,
        };
      });
  }, [state.knockout?.matches, state.settings.courtNames]);

  // Unified broadcast + schedule list (Knockout stage matches + Regular league matches)
  const allPublicMatches = useMemo(
    () => [...normalizedKnockoutMatches, ...state.matches],
    [normalizedKnockoutMatches, state.matches]
  );

  // Keep opened Match Detail Modal live-synchronized when scores/status update
  const detailMatch = useMemo(() => {
    if (!detailMatchSnapshot) return null;
    return allPublicMatches.find((m) => m.id === detailMatchSnapshot.id) || detailMatchSnapshot;
  }, [detailMatchSnapshot, allPublicMatches]);

  const liveMatchesCount = allPublicMatches.filter((m) => m.status === 'live').length;

  // Dynamic Tournament Settings derived from Supabase-synced state
  const tournamentName = (state.settings.name || 'Smash Premier League').trim();
  const seasonLabel = state.settings.season || 'Official Badminton Championship';
  const venueLabel = state.settings.venue || 'Maharajganj Indoor Badminton Stadium';
  const organizerLabel = state.settings.organizer || 'Maharajganj Badminton Association Presents';
  const courtsCount = Math.max(1, Number(state.settings.courts) || 2);
  const activeCourtNames =
    state.settings.courtNames && state.settings.courtNames.length > 0
      ? state.settings.courtNames.slice(0, courtsCount)
      : Array.from({ length: courtsCount }, (_, i) => `Court ${i + 1}`);
  const courtsListLabel =
    activeCourtNames.length <= 2
      ? activeCourtNames.join(' & ')
      : `${activeCourtNames.slice(0, -1).join(', ')} & ${activeCourtNames[activeCourtNames.length - 1]}`;
  const pointsFormat = state.settings.format || String(state.settings.scoringRules?.pointTarget || 21);
  const entryFeeDisplay = state.settings.entryFee ?? 500;
  const announcementText = (state.settings.announcement || '').trim();

  // Dynamic Tournament Stage & Next Match Telemetry derived strictly from Supabase-synced state
  const currentTournamentStage = useMemo(() => {
    const koMatches = state.knockout?.matches || [];
    const finals = koMatches.filter((m) => m.stage === 'F');
    if (finals.some((m) => m.status === 'live' || m.status === 'paused')) return 'Grand Final Live';
    if (finals.length > 0 && finals.every((m) => m.status === 'completed')) return 'Grand Final Complete';
    if (finals.some((m) => Boolean(m.teamA && m.teamB))) return 'Grand Final';

    const semis = koMatches.filter((m) => m.stage === 'SF');
    if (semis.some((m) => m.status === 'live' || m.status === 'paused')) return 'Semi-Finals Live';
    if (semis.some((m) => Boolean(m.teamA && m.teamB) || m.status === 'completed')) return 'Semi-Finals';

    const quarters = koMatches.filter((m) => m.stage === 'ELIM' || m.stage === 'QF');
    if (quarters.some((m) => m.status === 'live' || m.status === 'paused')) return 'Quarter-Finals Live';
    if (quarters.some((m) => Boolean(m.teamA && m.teamB) || m.status === 'completed')) return 'Quarter-Finals';

    if (state.matches.length > 0) {
      if (state.matches.every((m) => m.status === 'completed')) return 'League Stage Complete';
      return 'League Stage';
    }
    return state.teams.length > 0 ? 'Fixtures Pending' : 'Registration Open';
  }, [state.knockout?.matches, state.matches, state.teams.length]);

  const featuredFixture = useMemo(() => {
    return (
      allPublicMatches.find((m) => m.status === 'live' && m.teamA && m.teamB) ||
      allPublicMatches.find((m) => m.status === 'paused' && m.teamA && m.teamB) ||
      allPublicMatches.find((m) => m.status === 'upcoming' && m.teamA && m.teamB) ||
      null
    );
  }, [allPublicMatches]);

  const scrollToSection = useCallback((id: string) => {
    setMobileNavOpen(false);
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth' });
    }
  }, []);

  const handleOpenMatchModal = useCallback((m: Match) => {
    setDetailMatch(m);
  }, []);

  const handleGoToFixtures = useCallback(() => {
    scrollToSection('matches-schedule');
  }, [scrollToSection]);

  const copyStandingsText = () => {
    const lines = [
      `🏸 ${state.settings.name || 'Smash Premier League Maharajganj'} — Points Table`,
      `Venue: ${state.settings.venue || 'Maharajganj Indoor Badminton Stadium'}`,
      '---------------------------------------',
      '# | Team | P | W | L | Diff | Pts',
    ];
    standings.forEach((r, idx) => {
      lines.push(`${idx + 1}. ${r.team.name} | P:${r.played} W:${r.won} L:${r.lost} Diff:${r.diff > 0 ? `+${r.diff}` : r.diff} | Pts:${r.points}`);
    });
    lines.push('---------------------------------------');
    navigator.clipboard.writeText(lines.join('\n'));
    setCopiedStandings(true);
    setTimeout(() => setCopiedStandings(false), 2000);
  };

  return (
    <div className="min-h-screen bg-[#04060e] text-slate-100 selection:bg-amber-400 selection:text-slate-950 font-sans relative overflow-x-hidden">
      
      {/* Dynamic Background Badminton Arena Ambience with Blue & Gold Accents */}
      <div className="fixed inset-0 pointer-events-none z-0">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[1100px] h-[600px] bg-gradient-to-b from-blue-600/15 via-indigo-600/10 to-transparent blur-3xl opacity-75" />
        <div className="absolute top-[300px] -right-40 w-[600px] h-[600px] bg-amber-500/10 blur-3xl rounded-full" />
        <div className="absolute top-[800px] -left-40 w-[600px] h-[600px] bg-sky-500/8 blur-3xl rounded-full" />
        <div className="absolute top-[1600px] -right-40 w-[600px] h-[600px] bg-amber-500/8 blur-3xl rounded-full" />
      </div>

      {/* 1. HEADER / NAVIGATION BAR */}
      <header className="sticky top-0 z-40 w-full border-b border-white/10 bg-[#060813]/90 backdrop-blur-md">
        <div className="mx-auto flex h-16 sm:h-20 max-w-7xl items-center justify-between gap-2 sm:gap-4 px-3.5 sm:px-6 lg:px-8">
          
          {/* Brand Wordmark with New SPL 3.0 Championship Emblem */}
          <div className="flex items-center gap-2.5 sm:gap-3 shrink min-w-0">
            <button
              onClick={() => {
                setMobileNavOpen(false);
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }}
              className="flex items-center gap-2.5 sm:gap-3 text-left group min-w-0"
            >
              <SPLLogoEmblemSvg
                className="h-9 w-9 sm:h-11 sm:w-11 shrink-0 drop-shadow-[0_4px_12px_rgba(245,158,11,0.3)] group-hover:scale-105 transition-transform"
                include30
              />
              <div className="min-w-0">
                <span className="font-display text-sm sm:text-base lg:text-lg font-black tracking-tight text-white uppercase truncate block leading-tight">
                  {tournamentName}
                </span>
                <span className="block text-[10px] sm:text-xs font-semibold text-amber-300/90 truncate">
                  {seasonLabel}
                </span>
              </div>
            </button>
          </div>

          {/* Center Navigation Links (Desktop) */}
          <nav aria-label="Main Tournament Sections" className="hidden md:flex items-center gap-1 lg:gap-2 text-xs sm:text-sm font-semibold text-slate-300">
            <button
              onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
              className="px-3 py-1.5 rounded-lg hover:text-white hover:bg-white/5 transition-colors"
            >
              Home
            </button>
            <button
              onClick={() => scrollToSection('live-match')}
              className="px-3 py-1.5 rounded-lg hover:text-white hover:bg-white/5 transition-colors flex items-center gap-1.5 text-amber-300 font-bold whitespace-nowrap"
            >
              <span
                className={`w-2 h-2 rounded-full bg-red-500 ${
                  liveMatchesCount > 0 ? 'animate-pulse' : 'opacity-70'
                }`}
              />
              <span>Live Match</span>
            </button>
            <button
              onClick={() => scrollToSection('matches-schedule')}
              className="px-3 py-1.5 rounded-lg hover:text-white hover:bg-white/5 transition-colors"
            >
              Matches
            </button>
            <button
              onClick={() => scrollToSection('teams-roster')}
              className="px-3 py-1.5 rounded-lg hover:text-white hover:bg-white/5 transition-colors"
            >
              Teams
            </button>
            <button
              onClick={() => scrollToSection('standings-table')}
              className="px-3 py-1.5 rounded-lg hover:text-white hover:bg-white/5 transition-colors"
            >
              Standings
            </button>
            <button
              onClick={() => scrollToSection('tournament-info')}
              className="px-3 py-1.5 rounded-lg hover:text-white hover:bg-white/5 transition-colors"
            >
              Venue & Rules
            </button>
          </nav>

          {/* Right Action Buttons */}
          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            {/* Athlete Registration Button */}
            <button
              onClick={onOpenPublicRegister}
              className="flex items-center gap-1.5 px-3 sm:px-3.5 py-2 min-h-[38px] text-xs font-bold text-slate-950 bg-gradient-to-r from-amber-400 via-amber-300 to-yellow-400 hover:from-amber-300 hover:to-yellow-300 rounded-xl shadow-md shadow-amber-400/20 transition-all active:scale-95 whitespace-nowrap"
            >
              <PlusCircle className="w-3.5 h-3.5 shrink-0" />
              <span className="hidden sm:inline">Register Player</span>
              <span className="sm:hidden">Register</span>
            </button>



            {/* Mobile Hamburger Toggle */}
            <button
              type="button"
              onClick={() => setMobileNavOpen((prev) => !prev)}
              aria-label="Toggle public navigation menu"
              aria-expanded={mobileNavOpen}
              className="md:hidden p-2 min-w-[40px] min-h-[40px] flex items-center justify-center rounded-xl text-slate-300 hover:text-white hover:bg-white/10 border border-white/10 transition-colors"
            >
              {mobileNavOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>

        </div>

        {/* Mobile Navigation Drawer */}
        {mobileNavOpen && (
          <div className="md:hidden border-t border-white/10 bg-[#060813]/98 backdrop-blur-xl px-4 py-4 space-y-3 animate-fade-in shadow-2xl">
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => scrollToSection('live-match')}
                className="flex items-center gap-2 p-3 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs font-bold text-left"
              >
                <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse shrink-0" />
                <span>Live Scoreboard</span>
              </button>
              <button
                onClick={() => scrollToSection('matches-schedule')}
                className="flex items-center gap-2 p-3 rounded-xl bg-white/5 border border-white/10 text-slate-200 text-xs font-bold text-left"
              >
                <Swords className="w-3.5 h-3.5 text-lime-400 shrink-0" />
                <span>Match Schedule</span>
              </button>
              <button
                onClick={() => scrollToSection('teams-roster')}
                className="flex items-center gap-2 p-3 rounded-xl bg-white/5 border border-white/10 text-slate-200 text-xs font-bold text-left"
              >
                <Users className="w-3.5 h-3.5 text-sky-400 shrink-0" />
                <span>The Teams ({state.teams.length})</span>
              </button>
              <button
                onClick={() => scrollToSection('standings-table')}
                className="flex items-center gap-2 p-3 rounded-xl bg-white/5 border border-white/10 text-slate-200 text-xs font-bold text-left"
              >
                <Trophy className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                <span>Points Table</span>
              </button>
            </div>

            <div className="pt-2 border-t border-white/10 flex flex-col gap-2">
              <button
                onClick={() => scrollToSection('tournament-info')}
                className="w-full flex items-center justify-between p-2.5 rounded-xl bg-white/[0.03] hover:bg-white/10 text-slate-300 text-xs font-semibold"
              >
                <span>Venue & Tournament Rules</span>
                <MapPin className="w-4 h-4 text-amber-400" />
              </button>

              <button
                onClick={() => {
                  setMobileNavOpen(false);
                  onOpenPublicRegister();
                }}
                className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl text-xs font-black uppercase tracking-wider text-slate-950 bg-gradient-to-r from-amber-400 to-yellow-400 shadow-lg"
              >
                <PlusCircle className="w-4 h-4" />
                <span>Register as an Athlete</span>
              </button>


            </div>
          </div>
        )}
      </header>

      {/* Main Content Sections */}
      <main className="relative z-10 space-y-14 sm:space-y-24 pb-20">
        
        {/* 2. REDESIGNED SPL 3.0 CHAMPIONSHIP HERO SECTION */}
        <section
          aria-label="Smash Premier League 3.0 Championship Hero"
          className="relative overflow-hidden bg-[#05060b] border-b border-amber-400/15 pt-8 pb-10 sm:pt-12 sm:pb-14 lg:pt-14 lg:pb-16"
        >
          {/* Atmospheric Arena Spotlights, Court Lines & Golden Particles */}
          <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden spl-broadcast-layer">
            {/* Volumetric Overhead Stadium Spotlight Beams */}
            <div className="spl-spotlight-left absolute -top-28 -left-24 w-[28rem] h-[34rem] bg-gradient-to-b from-amber-400/20 via-orange-500/10 to-transparent blur-3xl" />
            <div className="spl-spotlight-right absolute -top-28 -right-20 w-[30rem] h-[34rem] bg-gradient-to-b from-red-600/20 via-amber-500/10 to-transparent blur-3xl" />
            <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-amber-400/45 to-transparent" />

            {/* Subtle Background Badminton Court Architecture */}
            <svg
              className="hidden md:block absolute inset-0 w-full h-full opacity-[0.07] text-amber-200"
              viewBox="0 0 1200 600"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              preserveAspectRatio="xMidYMid slice"
            >
              <rect x="110" y="70" width="980" height="460" />
              <line x1="600" y1="70" x2="600" y2="530" strokeDasharray="8 6" />
              <line x1="250" y1="70" x2="250" y2="530" />
              <line x1="950" y1="70" x2="950" y2="530" />
              <line x1="110" y1="145" x2="1090" y2="145" />
              <line x1="110" y1="455" x2="1090" y2="455" />
            </svg>

            {/* Lightweight Arena Gold Dust Particles (Desktop/Tablet) */}
            <span className="hidden sm:block spl-particle-float absolute top-[22%] left-[14%] w-1.5 h-1.5 rounded-full bg-amber-300/60" />
            <span className="hidden sm:block spl-particle-float absolute top-[34%] left-[44%] w-1 h-1 rounded-full bg-red-400/55" />
            <span className="hidden md:block spl-particle-float absolute top-[18%] right-[22%] w-1.5 h-1.5 rounded-full bg-amber-200/50" />
            <span className="hidden md:block spl-particle-float absolute bottom-[28%] right-[12%] w-1 h-1 rounded-full bg-orange-400/60" />
          </div>

          <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            {/* Hero 2-Column Athletic Split */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-10 items-stretch">
              {/* LEFT Column: Brand Crest, Championship Title, Tagline & Action CTAs */}
              <div className="lg:col-span-6 xl:col-span-7 flex flex-col justify-center space-y-5 sm:space-y-6 text-center lg:text-left">
                {/* Prominent Brand-New SPL Championship Logo Lockup */}
                <div className="flex justify-center lg:justify-start">
                  <SPLLogo
                    variant="hero"
                    size="md"
                    animated
                    subtitle="SPL 3.0 · CHAMPION EDITION"
                  />
                </div>

                {/* Unboxed Crimson & Gold Kicker */}
                <div className="spl-hero-stagger-1 flex items-center justify-center lg:justify-start gap-2.5 text-xs font-display font-black uppercase tracking-[0.26em] text-amber-300">
                  <span className="h-[2px] w-7 bg-gradient-to-r from-red-500 to-amber-400 rounded-full shrink-0" />
                  <span>CHAMPION EDITION</span>
                  <span className="text-slate-600">·</span>
                  <span className="text-slate-300 truncate">{organizerLabel}</span>
                </div>

                {/* Bold Championship Title + Energetic Tagline + Supporting Copy */}
                <div className="spl-hero-stagger-1 space-y-3">
                  <h1 className="text-[clamp(2.25rem,4.5vw,4.15rem)] font-black font-display tracking-tight text-white uppercase leading-[1.03] text-balance">
                    SMASH PREMIER{' '}
                    <span className="block sm:inline">LEAGUE{' '}</span>
                    <span className="bg-gradient-to-r from-amber-200 via-amber-400 to-orange-500 bg-clip-text text-transparent">
                      3.0
                    </span>
                  </h1>

                  <p className="spl-hero-stagger-2 text-lg sm:text-2xl lg:text-[1.65rem] font-display font-black uppercase italic tracking-[0.06em] bg-gradient-to-r from-amber-300 via-yellow-200 to-red-400 bg-clip-text text-transparent">
                    “RISE. SMASH. CONQUER.”
                  </p>

                  <p className="spl-hero-stagger-2 text-sm sm:text-base lg:text-lg text-slate-300 max-w-xl mx-auto lg:mx-0 font-normal leading-relaxed">
                    Where Champions Rise and Legends Are Made.
                    {announcementText ? (
                      <span className="block mt-1.5 text-xs sm:text-sm text-amber-200/90 font-medium">
                        {announcementText}
                      </span>
                    ) : null}
                  </p>
                </div>

                {/* Phase 4: Premium Championship Action CTAs */}
                <div className="spl-hero-stagger-3 flex flex-col sm:flex-row flex-wrap items-stretch sm:items-center justify-center lg:justify-start gap-3 pt-1">
                  {/* 1. Primary CTA: REGISTER NOW */}
                  <button
                    type="button"
                    onClick={onOpenPublicRegister}
                    className="group relative overflow-hidden w-full sm:w-auto flex items-center justify-center gap-2.5 px-6 py-3.5 min-h-[48px] rounded-xl font-display font-black text-xs sm:text-sm uppercase tracking-wider text-slate-950 bg-gradient-to-r from-amber-300 via-amber-400 to-orange-500 hover:from-amber-200 hover:via-amber-300 hover:to-orange-400 shadow-[0_12px_30px_-8px_rgba(245,158,11,0.55)] transition-all duration-200 hover:-translate-y-0.5 active:scale-95 cursor-pointer whitespace-nowrap"
                  >
                    <PlusCircle className="w-4 h-4 shrink-0 text-slate-950" />
                    <span>REGISTER NOW</span>
                    <ArrowRight className="w-4 h-4 shrink-0 text-slate-950 transition-transform group-hover:translate-x-0.5" />
                  </button>

                  {/* 2. Secondary CTA: WATCH LIVE MATCHES */}
                  <button
                    type="button"
                    onClick={() => scrollToSection('live-match')}
                    className="w-full sm:w-auto flex items-center justify-center gap-2.5 px-6 py-3.5 min-h-[48px] rounded-xl font-display font-extrabold text-xs sm:text-sm uppercase tracking-wider text-white bg-red-950/40 hover:bg-red-900/50 border border-red-500/45 hover:border-red-400/70 backdrop-blur-md transition-all duration-200 hover:-translate-y-0.5 active:scale-95 cursor-pointer whitespace-nowrap"
                  >
                    {liveMatchesCount > 0 ? (
                      <span className="relative flex h-2.5 w-2.5 shrink-0">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
                        <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-red-500" />
                      </span>
                    ) : (
                      <Play className="w-4 h-4 shrink-0 text-red-400" />
                    )}
                    <span>WATCH LIVE MATCHES</span>
                  </button>

                  {/* 3. Tertiary CTA: VIEW MATCH SCHEDULE */}
                  <button
                    type="button"
                    onClick={() => scrollToSection('matches-schedule')}
                    className="w-full sm:w-auto flex items-center justify-center gap-2 px-5 py-3.5 min-h-[48px] rounded-xl font-display font-bold text-xs sm:text-sm uppercase tracking-wider text-slate-100 bg-white/[0.04] hover:bg-white/[0.1] border border-slate-300/25 hover:border-amber-300/45 backdrop-blur-md transition-all duration-200 hover:-translate-y-0.5 active:scale-95 cursor-pointer whitespace-nowrap"
                  >
                    <Calendar className="w-4 h-4 shrink-0 text-amber-300" />
                    <span>VIEW MATCH SCHEDULE</span>
                  </button>
                </div>
              </div>

              {/* RIGHT Column: Dramatic Jump-Smash Championship Showcase */}
              <div className="lg:col-span-6 xl:col-span-5 flex items-stretch spl-hero-stagger-2">
                <BadmintonHeroVisual venue={venueLabel} />
              </div>
            </div>

            {/* Phase 5: Live Tournament Information Strip (100% Live Supabase-Backed State) */}
            <div
              aria-label="Live Tournament Information Strip"
              className="mt-8 sm:mt-10 rounded-2xl border border-white/10 bg-[#0b0e18]/85 backdrop-blur-md p-3.5 sm:p-4 shadow-[0_18px_40px_-20px_rgba(0,0,0,0.9)]"
            >
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 sm:gap-4 divide-y sm:divide-y-0 sm:divide-x divide-white/10">
                {/* 1. Tournament Name */}
                <div className="pt-1 sm:pt-0 sm:pr-3 min-w-0">
                  <span className="block text-[10px] font-display font-bold uppercase tracking-[0.2em] text-slate-400">
                    Tournament
                  </span>
                  <span
                    title={tournamentName}
                    className="mt-1 block text-sm sm:text-base font-display font-black text-white truncate"
                  >
                    {tournamentName || 'Not Configured'}
                  </span>
                </div>

                {/* 2. Current Stage */}
                <div className="pt-2.5 sm:pt-0 sm:pl-4 sm:pr-3 min-w-0">
                  <span className="block text-[10px] font-display font-bold uppercase tracking-[0.2em] text-slate-400">
                    Current Stage
                  </span>
                  <span className="mt-1 block text-sm sm:text-base font-display font-black text-amber-300 truncate">
                    {currentTournamentStage}
                  </span>
                </div>

                {/* 3. Registered Teams */}
                <div className="pt-2.5 sm:pt-0 sm:pl-4 sm:pr-3 min-w-0">
                  <span className="block text-[10px] font-display font-bold uppercase tracking-[0.2em] text-slate-400">
                    Registered Teams
                  </span>
                  <span className="mt-1 block text-sm sm:text-base font-mono font-black text-white tabular-nums">
                    {state.teams.length > 0 ? `${state.teams.length} Teams` : 'No Teams Yet'}
                  </span>
                </div>

                {/* 4. Active Live Matches */}
                <div className="pt-2.5 sm:pt-0 sm:pl-4 sm:pr-3 min-w-0">
                  <span className="block text-[10px] font-display font-bold uppercase tracking-[0.2em] text-slate-400">
                    Active Live Matches
                  </span>
                  <div className="mt-1 flex items-center gap-2">
                    {liveMatchesCount > 0 && (
                      <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse shrink-0" />
                    )}
                    <span
                      className={`text-sm sm:text-base font-mono font-black tabular-nums ${
                        liveMatchesCount > 0 ? 'text-red-400' : 'text-slate-300'
                      }`}
                    >
                      {liveMatchesCount > 0 ? `${liveMatchesCount} Live` : '0 Live'}
                    </span>
                  </div>
                </div>

                {/* 5. Next / Active Match Info */}
                <div className="pt-2.5 sm:pt-0 sm:pl-4 min-w-0">
                  <span className="block text-[10px] font-display font-bold uppercase tracking-[0.2em] text-slate-400">
                    {featuredFixture?.status === 'live' ? 'On Court Now' : 'Upcoming Match'}
                  </span>
                  {featuredFixture ? (
                    <div className="mt-1 min-w-0">
                      <span className="block text-xs sm:text-sm font-bold text-white truncate">
                        {(getTeam(featuredFixture.teamA)?.name || 'TBD')} vs {(getTeam(featuredFixture.teamB)?.name || 'TBD')}
                      </span>
                      <span className="block text-[11px] font-mono text-amber-300/90 truncate">
                        {featuredFixture.courtName || `Court ${featuredFixture.court}`}
                        {featuredFixture.stageLabel ? ` · ${featuredFixture.stageLabel}` : ''}
                      </span>
                    </div>
                  ) : (
                    <span className="mt-1 block text-xs sm:text-sm font-semibold text-slate-400 truncate">
                      No Upcoming Fixtures
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* 3. LIVE MATCH — CHAMPIONSHIP ARENA BROADCAST */}
        <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="mb-5 flex flex-col sm:flex-row sm:items-end justify-between gap-3 border-b border-white/10 pb-4">
            <div className="min-w-0">
              <div className="flex items-center gap-2 text-[11px] font-mono font-bold uppercase tracking-[0.2em] text-amber-300/90">
                <span className="h-px w-6 bg-gradient-to-r from-amber-400 to-rose-500" />
                <span>SPL 3.0 Broadcast Desk · {venueLabel}</span>
              </div>
              <div className="mt-1.5 flex items-center gap-2.5 flex-wrap">
                <span
                  aria-hidden="true"
                  className={`inline-block w-3 h-3 rounded-full shrink-0 ${
                    liveMatchesCount > 0
                      ? 'bg-rose-500 animate-pulse shadow-[0_0_12px_rgba(244,63,94,0.85)]'
                      : 'bg-amber-400/80 shadow-[0_0_10px_rgba(245,158,11,0.5)]'
                  }`}
                />
                <h2 className="text-2xl sm:text-3xl lg:text-4xl font-black text-white font-display uppercase tracking-tight">
                  Live Match{' '}
                  <span className="bg-gradient-to-r from-amber-300 via-orange-400 to-rose-400 bg-clip-text text-transparent">
                    Broadcast
                  </span>
                </h2>
              </div>
              <p className="mt-1 text-xs sm:text-sm text-slate-400 max-w-2xl">
                Every Point Matters. Every Rally Counts.
              </p>
            </div>

            <div className="flex items-center gap-3 shrink-0 self-start sm:self-end">
              {liveMatchesCount > 0 ? (
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[#0d0a14] border border-rose-500/40 text-rose-300 text-xs font-mono font-bold uppercase tracking-wider shadow-lg shadow-rose-950/30">
                  <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse shrink-0" />
                  <span className="tabular-nums">
                    {liveMatchesCount} Match{liveMatchesCount > 1 ? 'es' : ''} Live
                  </span>
                </div>
              ) : (
                <div className="text-[11px] font-mono font-bold uppercase tracking-wider text-slate-400">
                  {courtsCount} {courtsCount === 1 ? 'Court' : 'Courts'} Ready
                </div>
              )}
            </div>
          </div>

          <LiveMatchHero
            matches={allPublicMatches}
            teams={state.teams}
            players={state.players}
            scoringRules={state.settings.scoringRules}
            courtNames={state.settings.courtNames}
            venue={venueLabel}
            realtimeStatus={realtimeStatus}
            onRetryRealtime={reconnectRealtime}
            onOpenMatchModal={handleOpenMatchModal}
            onGoToFixtures={handleGoToFixtures}
          />
        </section>

        {/* 4. REDESIGNED FIXTURES & RESULTS SECTION */}
        <FixturesShowcaseSection
          allPublicMatches={allPublicMatches}
          knockout={state.knockout}
          teams={state.teams}
          players={state.players}
          courtNames={state.settings.courtNames}
          courtsCount={courtsCount}
          courtsListLabel={courtsListLabel}
          scoringRules={state.settings.scoringRules}
          onOpenMatchModal={handleOpenMatchModal}
        />

        {/* 5. REDESIGNED SPL 3.0 TEAMS SECTION */}
        <TeamsShowcaseSection
          teams={state.teams}
          players={state.players}
          matches={state.matches}
          knockout={state.knockout}
          standings={standings}
          courtNames={state.settings.courtNames}
          tournamentName={tournamentName}
          onOpenPublicRegister={onOpenPublicRegister}
          onSelectMatch={handleOpenMatchModal}
          selectedTeamId={selectedTeamId}
          onSelectTeamChange={setSelectedTeamId}
        />

        {/* 6. REDESIGNED OFFICIAL LEAGUE STANDINGS */}
        <StandingsShowcaseSection
          standings={standings}
          teams={state.teams}
          players={state.players}
          matches={state.matches}
          knockout={state.knockout}
          copiedStandings={copiedStandings}
          onCopyStandings={copyStandingsText}
          onSelectTeam={setSelectedTeamId}
        />

        {/* 7. TOURNAMENT VENUE & MAHARAJGANJ COMMUNITY SECTION */}
        <section id="tournament-info" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 scroll-mt-24">
          <div className="rounded-3xl border border-white/15 bg-gradient-to-br from-slate-900 via-[#0a0f1d] to-[#04060e] p-5 sm:p-10 shadow-2xl relative overflow-hidden">
            
            {/* Background Floodlight Beam */}
            <div className="absolute top-0 right-0 w-96 h-96 bg-lime-400/10 rounded-full blur-3xl pointer-events-none" />

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
              
              <div className="lg:col-span-8 space-y-4">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-400/10 border border-amber-400/30 text-amber-400 text-xs font-bold uppercase tracking-wider">
                  <MapPin className="w-3.5 h-3.5" />
                  <span>Official Venue & Match Location</span>
                </div>

                <h2 className="text-2xl sm:text-4xl font-black text-white font-display uppercase tracking-tight">
                  {venueLabel}
                </h2>

                <p className="text-sm sm:text-base text-slate-300 leading-relaxed max-w-2xl">
                  Featuring {courtsCount} tournament-grade synthetic badminton {courtsCount === 1 ? 'court' : 'courts'}, calibrated arena lighting, referee observation towers, and live audience seating.
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4 pt-2 sm:pt-4">
                  <div className="p-3.5 rounded-2xl bg-white/[0.03] border border-white/5">
                    <span className="text-[11px] text-slate-400 font-bold uppercase block">Official Date</span>
                    <span className="text-sm font-bold text-white mt-1 block">
                      {state.settings.date || 'Championship Season 2026'}
                    </span>
                  </div>
                  <div className="p-3.5 rounded-2xl bg-white/[0.03] border border-white/5">
                    <span className="text-[11px] text-slate-400 font-bold uppercase block">Courts In Action</span>
                    <span className="text-sm font-bold text-lime-400 mt-1 block">
                      {courtsListLabel} ({courtsCount} {courtsCount === 1 ? 'Court' : 'Courts'})
                    </span>
                  </div>
                  <div className="p-3.5 rounded-2xl bg-white/[0.03] border border-white/5">
                    <span className="text-[11px] text-slate-400 font-bold uppercase block">Entry & Spot Inquiry</span>
                    <span className="text-sm font-bold text-emerald-400 mt-1 block">
                      ₹{entryFeeDisplay} per Athlete
                    </span>
                  </div>
                </div>
              </div>

              {/* Call to action card */}
              <div className="lg:col-span-4 p-5 sm:p-6 rounded-2xl bg-slate-950/80 border border-white/10 text-center space-y-4 shadow-xl">
                <span className="text-4xl">🏆</span>
                <h3 className="font-display font-black text-lg text-white uppercase">
                  Ready to Compete?
                </h3>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Join the official athlete draft of {tournamentName}. Open to singles and doubles competitors.
                </p>
                <button
                  onClick={onOpenPublicRegister}
                  className="w-full py-3 px-4 min-h-[44px] rounded-xl font-display font-black uppercase tracking-wider text-xs text-slate-950 bg-gradient-to-r from-lime-400 to-emerald-400 hover:from-lime-300 hover:to-emerald-300 shadow-lg shadow-lime-400/25 active:scale-95 transition-all"
                >
                  Register as an Athlete Now
                </button>
              </div>

            </div>
          </div>
        </section>

      </main>

      {/* 8. FOOTER */}
      <footer className="relative z-10 w-full border-t border-white/10 bg-[#03050c] text-xs text-slate-400 py-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 text-center sm:text-left">
            <div className="flex flex-col sm:flex-row items-center gap-3">
              <SPLLogoEmblemSvg
                className="h-10 w-10 shrink-0 drop-shadow-[0_4px_12px_rgba(245,158,11,0.3)]"
                include30
              />
              <div>
                <span className="font-display font-black text-white text-base uppercase block">
                  {tournamentName}
                </span>
                <span className="text-slate-400 text-xs">
                  Official Badminton Tournament Portal · {seasonLabel}
                </span>
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-center gap-3 sm:gap-4">
              <button
                onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
                className="hover:text-lime-400 transition-colors"
              >
                Back to Top ↑
              </button>
              <span>•</span>
              <button onClick={onOpenPublicRegister} className="hover:text-lime-400 transition-colors">
                Athlete Entry Form
              </button>
            </div>
          </div>

          <div className="pt-6 border-t border-white/5 flex flex-col sm:flex-row items-center justify-between gap-2 text-[11px] text-slate-400 text-center sm:text-left">
            <span>© {new Date().getFullYear()} {tournamentName}. All rights reserved.</span>
            <span>BWF {pointsFormat}-Point Rally System • {venueLabel}</span>
          </div>
        </div>
      </footer>

      {/* 9. MATCH DETAIL MODAL */}
      {detailMatch && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/85 backdrop-blur-md animate-fade-in"
        >
          <div className="w-full max-w-lg max-h-[90dvh] overflow-y-auto bg-slate-900 border border-white/15 rounded-3xl p-5 sm:p-8 shadow-2xl relative">
            <button
              onClick={() => setDetailMatch(null)}
              aria-label="Close match details"
              className="absolute top-4 right-4 p-2 min-w-[40px] min-h-[40px] flex items-center justify-center rounded-xl text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-lime-400 mb-1">
              <span>{detailMatch.matchType === 'knockout' ? 'Knockout Championship' : 'Match Center Card'}</span>
              <span>•</span>
              <span>{detailMatch.courtName || state.settings.courtNames?.[detailMatch.court - 1]?.trim() || `Court ${detailMatch.court}`}</span>
            </div>

            <h3 className="text-xl font-black text-white font-display uppercase tracking-tight">
              {detailMatch.matchType === 'knockout'
                ? `${detailMatch.stageLabel || 'Knockout Stage'} Breakdown`
                : `Round ${detailMatch.round} Fixture Breakdown`}
            </h3>

            {/* Scorecard Body */}
            <div className="mt-6 p-5 rounded-2xl bg-slate-950 border border-white/10 space-y-4">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2.5 min-w-0">
                  <span className="text-2xl shrink-0">{getTeam(detailMatch.teamA)?.badge || '🏸'}</span>
                  <div className="min-w-0">
                    <p className="font-bold text-white text-base truncate">{getTeam(detailMatch.teamA)?.name || 'Awaiting Team'}</p>
                    <p className="text-xs text-slate-400 mt-0.5 truncate">
                      {(getTeam(detailMatch.teamA)?.players?.map(getPlayer).filter((p): p is Player => Boolean(p)).map((p) => p.name).join(' & ')) || 'Doubles Pair'}
                    </p>
                  </div>
                </div>
                <span className="text-3xl font-black font-mono text-lime-400 shrink-0">
                  {detailMatch.scoreA ?? 0}
                </span>
              </div>

              <div className="py-1 border-t border-b border-white/10 text-center">
                <span className="text-xs font-bold text-slate-400 uppercase">
                  {detailMatch.status === 'live'
                    ? '🔴 Live in Progress'
                    : detailMatch.status === 'paused'
                    ? '⏸ Match Paused / Tactical Timeout'
                    : detailMatch.status === 'completed'
                    ? '🏆 Final Match Result'
                    : 'Scheduled Match'}
                </span>
                {detailMatch.sets && detailMatch.sets.length > 0 && (
                  <div className="flex items-center justify-center gap-1.5 mt-1.5">
                    {detailMatch.sets.map((s, idx) => (
                      <span
                        key={idx}
                        className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-white/10 text-slate-300"
                      >
                        Set {idx + 1}: {s.scoreA}-{s.scoreB}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2.5 min-w-0">
                  <span className="text-2xl shrink-0">{getTeam(detailMatch.teamB)?.badge || '🏸'}</span>
                  <div className="min-w-0">
                    <p className="font-bold text-white text-base truncate">{getTeam(detailMatch.teamB)?.name || 'Awaiting Team'}</p>
                    <p className="text-xs text-slate-400 mt-0.5 truncate">
                      {(getTeam(detailMatch.teamB)?.players?.map(getPlayer).filter((p): p is Player => Boolean(p)).map((p) => p.name).join(' & ')) || 'Doubles Pair'}
                    </p>
                  </div>
                </div>
                <span className="text-3xl font-black font-mono text-white shrink-0">
                  {detailMatch.scoreB ?? 0}
                </span>
              </div>
            </div>

            {/* Winner notice */}
            {detailMatch.winner && (
              <div className="mt-4 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 text-xs flex items-center gap-2">
                <Trophy className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>Winner: <strong>{getTeam(detailMatch.winner)?.name}</strong></span>
              </div>
            )}

            <div className="mt-6 flex justify-end">
              <button
                onClick={() => setDetailMatch(null)}
                className="px-5 py-2.5 rounded-xl text-xs font-bold bg-white/10 hover:bg-white/15 text-white transition-colors"
              >
                Close Scorecard
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
