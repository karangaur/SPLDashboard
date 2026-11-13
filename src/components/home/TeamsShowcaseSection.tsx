import React, { useMemo, useState, useEffect, useCallback } from 'react';
import {
  ArrowRight,
  CheckCircle2,
  Crown,
  PlusCircle,
  Shield,
  Star,
  Trophy,
  X,
  XCircle,
} from 'lucide-react';
import { KnockoutData, KnockoutMatch, Match, Player, StandingsRecord, Team } from '../../types/tournament';

export interface TeamsShowcaseSectionProps {
  teams: Team[];
  players: Player[];
  matches: Match[];
  knockout?: KnockoutData;
  standings: StandingsRecord[];
  courtNames?: string[];
  tournamentName: string;
  onOpenPublicRegister: () => void;
  onSelectMatch?: (match: Match) => void;
}

type TeamTournamentStatus = 'CHAMPION' | 'QUALIFIED' | 'ELIMINATED' | 'ACTIVE';

interface TeamAccentTheme {
  crestGradient: string;
  glowHalo: string;
  hoverBorder: string;
  accentBar: string;
  accentText: string;
  ringColor: string;
}

const TEAM_ACCENT_THEMES: Record<string, TeamAccentTheme> = {
  'from-amber-500 to-orange-600': {
    crestGradient: 'from-amber-400 via-amber-500 to-orange-600',
    glowHalo: 'from-amber-500/20 via-orange-500/10 to-transparent',
    hoverBorder: 'hover:border-amber-400/60',
    accentBar: 'from-amber-300 via-amber-500 to-orange-500',
    accentText: 'text-amber-300',
    ringColor: 'ring-amber-400/40',
  },
  'from-rose-500 to-pink-600': {
    crestGradient: 'from-red-500 via-rose-500 to-orange-500',
    glowHalo: 'from-red-500/20 via-rose-500/10 to-transparent',
    hoverBorder: 'hover:border-red-400/55',
    accentBar: 'from-red-400 via-rose-500 to-amber-400',
    accentText: 'text-red-300',
    ringColor: 'ring-red-400/40',
  },
  'from-emerald-500 to-green-600': {
    crestGradient: 'from-emerald-400 via-emerald-500 to-teal-600',
    glowHalo: 'from-emerald-500/18 via-amber-400/10 to-transparent',
    hoverBorder: 'hover:border-emerald-400/55',
    accentBar: 'from-emerald-400 via-teal-400 to-amber-300',
    accentText: 'text-emerald-300',
    ringColor: 'ring-emerald-400/40',
  },
  'from-sky-500 to-blue-600': {
    crestGradient: 'from-sky-400 via-blue-500 to-indigo-600',
    glowHalo: 'from-sky-500/20 via-blue-500/10 to-transparent',
    hoverBorder: 'hover:border-sky-400/55',
    accentBar: 'from-sky-400 via-blue-400 to-amber-300',
    accentText: 'text-sky-300',
    ringColor: 'ring-sky-400/40',
  },
  'from-violet-500 to-purple-600': {
    crestGradient: 'from-violet-400 via-purple-500 to-indigo-600',
    glowHalo: 'from-violet-500/20 via-purple-500/10 to-transparent',
    hoverBorder: 'hover:border-violet-400/55',
    accentBar: 'from-violet-400 via-purple-400 to-amber-300',
    accentText: 'text-violet-300',
    ringColor: 'ring-violet-400/40',
  },
  'from-fuchsia-500 to-pink-600': {
    crestGradient: 'from-fuchsia-400 via-pink-500 to-rose-600',
    glowHalo: 'from-fuchsia-500/18 via-amber-400/10 to-transparent',
    hoverBorder: 'hover:border-fuchsia-400/55',
    accentBar: 'from-fuchsia-400 via-rose-400 to-amber-300',
    accentText: 'text-fuchsia-300',
    ringColor: 'ring-fuchsia-400/40',
  },
  'from-teal-500 to-cyan-600': {
    crestGradient: 'from-teal-400 via-cyan-500 to-sky-600',
    glowHalo: 'from-teal-500/18 via-cyan-500/10 to-transparent',
    hoverBorder: 'hover:border-teal-400/55',
    accentBar: 'from-teal-400 via-cyan-400 to-amber-300',
    accentText: 'text-teal-300',
    ringColor: 'ring-teal-400/40',
  },
  'from-indigo-500 to-blue-600': {
    crestGradient: 'from-indigo-400 via-blue-500 to-violet-600',
    glowHalo: 'from-indigo-500/20 via-amber-400/10 to-transparent',
    hoverBorder: 'hover:border-indigo-400/55',
    accentBar: 'from-indigo-400 via-blue-400 to-amber-300',
    accentText: 'text-indigo-300',
    ringColor: 'ring-indigo-400/40',
  },
};

const FALLBACK_THEME_LIST = Object.values(TEAM_ACCENT_THEMES);

function resolveTeamAccentTheme(avatarColor: string | undefined, idx: number): TeamAccentTheme {
  if (avatarColor && TEAM_ACCENT_THEMES[avatarColor]) {
    return TEAM_ACCENT_THEMES[avatarColor];
  }
  return FALLBACK_THEME_LIST[idx % FALLBACK_THEME_LIST.length];
}

function getKnockoutMatchWinnerId(ko: KnockoutMatch): string | undefined {
  if (ko.status !== 'completed') return undefined;
  if (ko.winner) return ko.winner;
  if (ko.scoreA != null && ko.scoreB != null && ko.scoreA !== ko.scoreB) {
    return ko.scoreA > ko.scoreB ? ko.teamA : ko.teamB;
  }
  return undefined;
}

function getMatchWinnerId(m: Match): string | undefined {
  if (m.status !== 'completed') return undefined;
  if (m.winner) return m.winner;
  if (m.scoreA != null && m.scoreB != null && m.scoreA !== m.scoreB) {
    return m.scoreA > m.scoreB ? m.teamA : m.teamB;
  }
  return undefined;
}

function getInitials(name?: string): string {
  if (!name) return 'SP';
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0] || ''}${parts[parts.length - 1][0] || ''}`.toUpperCase();
}

const CHAMPION_SPARKLES = [
  'left-[10%] top-3 bg-amber-300',
  'left-[26%] top-2 bg-yellow-200',
  'left-[46%] top-4 bg-orange-400',
  'left-[66%] top-2 bg-amber-200',
  'left-[84%] top-3 bg-yellow-300',
  'left-[92%] top-6 bg-amber-400',
];

const PlayerAvatar: React.FC<{
  player: Player;
  accentRing: string;
  sizeClass?: string;
}> = React.memo(({ player, accentRing, sizeClass = 'w-9 h-9 text-xs' }) => {
  const [photoFailed, setPhotoFailed] = useState(false);

  if (player.photoUrl && !photoFailed) {
    return (
      <img
        src={player.photoUrl}
        alt={player.name}
        loading="lazy"
        decoding="async"
        referrerPolicy="no-referrer"
        onError={() => setPhotoFailed(true)}
        className={`${sizeClass} rounded-full object-cover shrink-0 ring-1 ${accentRing} bg-[#090d18]`}
      />
    );
  }

  return (
    <div
      aria-hidden="true"
      className={`${sizeClass} rounded-full shrink-0 flex items-center justify-center font-display font-black tracking-tight text-amber-200 bg-[#121726] ring-1 ${accentRing}`}
    >
      {getInitials(player.name)}
    </div>
  );
});

interface ContenderCardProps {
  team: Team;
  index: number;
  teamPlayers: Player[];
  standingRecord?: StandingsRecord;
  rank?: number;
  status: TeamTournamentStatus;
  theme: TeamAccentTheme;
  onSelect: (teamId: string) => void;
}

const TeamContenderCard: React.FC<ContenderCardProps> = React.memo(
  ({ team, index, teamPlayers, standingRecord, rank, status, theme, onSelect }) => {
    const isChampion = status === 'CHAMPION';
    const played = standingRecord?.played ?? 0;
    const won = standingRecord?.won ?? 0;
    const lost = standingRecord?.lost ?? 0;
    const winPct = played > 0 ? Math.round((won / played) * 100) : null;
    const staggerClass = `spl-team-enter-${Math.min(index, 7)}`;

    const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        onSelect(team.id);
      }
    };

    const statusConfig = (() => {
      switch (status) {
        case 'CHAMPION':
          return {
            label: 'CHAMPIONS',
            textClass: 'text-amber-300',
            icon: <Crown className="w-3.5 h-3.5 text-amber-300 shrink-0" />,
          };
        case 'QUALIFIED':
          return {
            label: 'QUALIFIED',
            textClass: 'text-emerald-300',
            icon: <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />,
          };
        case 'ELIMINATED':
          return {
            label: 'ELIMINATED',
            textClass: 'text-slate-400',
            icon: <XCircle className="w-3.5 h-3.5 text-red-400/80 shrink-0" />,
          };
        case 'ACTIVE':
        default:
          return {
            label: 'ACTIVE',
            textClass: 'text-amber-200',
            icon: <Shield className="w-3.5 h-3.5 text-amber-400 shrink-0" />,
          };
      }
    })();

    return (
      <div className={`spl-team-card-enter ${staggerClass} h-full`}>
        <div
          role="button"
          tabIndex={0}
          onClick={() => onSelect(team.id)}
          onKeyDown={handleKeyDown}
          aria-label={`${team.name} team profile, status ${statusConfig.label}`}
          className={`spl-team-card-surface group relative h-full flex flex-col justify-between rounded-2xl overflow-hidden text-left cursor-pointer focus-visible:outline-2 focus-visible:outline-amber-400 ${
            isChampion
              ? 'bg-gradient-to-b from-[#171207] via-[#0c0e17] to-[#06070c] border border-amber-400/75 shadow-[0_22px_50px_-14px_rgba(245,158,11,0.35)]'
              : `bg-gradient-to-b from-[#101422] via-[#0a0d17] to-[#06070c] border border-white/12 ${theme.hoverBorder} shadow-[0_18px_42px_-18px_rgba(0,0,0,0.9)]`
          }`}
        >
          {/* Top Metallic Accent Strip */}
          <div
            aria-hidden="true"
            className={`h-[3px] w-full bg-gradient-to-r ${
              isChampion ? 'from-amber-200 via-amber-400 to-yellow-300' : theme.accentBar
            }`}
          />

          {/* Champion Animated Ambient Glow & Lightweight Sparkles */}
          {isChampion && (
            <>
              <div
                aria-hidden="true"
                className="spl-champion-halo pointer-events-none absolute -top-14 left-1/2 -translate-x-1/2 w-56 h-36 rounded-full bg-amber-400/20 blur-2xl"
              />
              <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-0 h-16 overflow-hidden">
                {CHAMPION_SPARKLES.map((cls, sIdx) => (
                  <span
                    key={sIdx}
                    className={`spl-confetti-piece absolute w-1.5 h-1.5 rounded-full opacity-75 ${cls}`}
                  />
                ))}
              </div>
            </>
          )}

          {/* Subtle Team Accent Spotlight Glow */}
          {!isChampion && (
            <div
              aria-hidden="true"
              className={`pointer-events-none absolute -top-12 -right-12 w-40 h-40 rounded-full bg-gradient-to-bl ${theme.glowHalo} blur-2xl opacity-75 group-hover:opacity-100 transition-opacity`}
            />
          )}

          {/* Subtle Court Geometry Corner Line Pattern */}
          <svg
            aria-hidden="true"
            className="pointer-events-none absolute top-2 right-2 w-24 h-24 opacity-[0.06] text-amber-200"
            viewBox="0 0 100 100"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.4"
          >
            <rect x="12" y="12" width="76" height="76" />
            <line x1="50" y1="12" x2="50" y2="88" strokeDasharray="4 4" />
            <line x1="12" y1="50" x2="88" y2="50" />
          </svg>

          {/* CARD CONTENT BODY */}
          <div className="relative z-10 p-5 flex-1 flex flex-col justify-between space-y-5">
            {/* TOP AREA: Prominent Team Emblem, Championship Name & Unboxed Metadata */}
            <div>
              {/* Status Line & Champion Crest */}
              <div className="flex items-center justify-between gap-2 pb-3.5 border-b border-white/10">
                <div className="flex items-center gap-1.5 text-[11px] font-display font-bold uppercase tracking-[0.16em] text-slate-400 min-w-0">
                  <span className="tabular-nums text-slate-300">Team #{String(index + 1).padStart(2, '0')}</span>
                  {team.token && (
                    <>
                      <span aria-hidden="true">·</span>
                      <span className="truncate font-mono text-slate-400">{team.token}</span>
                    </>
                  )}
                  {rank != null && rank > 0 && (
                    <>
                      <span aria-hidden="true">·</span>
                      <span className={`font-mono tabular-nums font-bold ${isChampion ? 'text-amber-300' : theme.accentText}`}>
                        Rank #{rank}
                      </span>
                    </>
                  )}
                </div>

                {isChampion && (
                  <span className="inline-flex items-center gap-1 text-[10px] font-display font-black uppercase tracking-[0.18em] text-amber-300 shrink-0">
                    <Trophy className="w-3.5 h-3.5 text-amber-300" />
                    <span>CHAMPIONS</span>
                  </span>
                )}
              </div>

              {/* Team Crest + Bold Team Name */}
              <div className="pt-4 flex items-center gap-3.5">
                <div className="relative shrink-0 spl-team-badge-fade">
                  <div
                    aria-hidden="true"
                    className={`absolute -inset-1 rounded-2xl bg-gradient-to-br ${
                      isChampion ? 'from-amber-300/45 to-orange-500/30' : theme.glowHalo
                    } blur-md opacity-70 group-hover:opacity-100 transition-opacity`}
                  />
                  <div
                    className={`relative w-14 h-14 rounded-2xl flex items-center justify-center text-2xl sm:text-3xl shadow-lg transition-transform duration-200 group-hover:scale-105 bg-gradient-to-br ${
                      isChampion ? 'from-amber-300 via-amber-400 to-orange-500 text-slate-950' : `${theme.crestGradient} text-white`
                    } ring-1 ring-white/25`}
                  >
                    <span role="img" aria-hidden="true">
                      {team.badge || '🏸'}
                    </span>
                  </div>
                </div>

                <div className="min-w-0 flex-1">
                  <h3
                    title={team.name}
                    className={`font-display font-black text-lg leading-snug tracking-tight line-clamp-2 transition-colors ${
                      isChampion ? 'text-amber-200' : 'text-white group-hover:text-amber-200'
                    }`}
                  >
                    {team.name}
                  </h3>
                  <p className="text-[11px] font-medium text-slate-400 mt-0.5 truncate">
                    {teamPlayers.length === 2
                      ? 'Doubles Contender'
                      : teamPlayers.length === 1
                      ? '1 Athlete Assigned'
                      : teamPlayers.length > 2
                      ? `${teamPlayers.length} Squad Athletes`
                      : 'Squad Formation Pending'}
                  </p>
                </div>
              </div>
            </div>

            {/* MIDDLE AREA: Balanced Two-Player Championship Nameplates */}
            <div className="space-y-2">
              <span className="block text-[10px] font-display font-bold uppercase tracking-[0.2em] text-slate-400">
                Active Duo
              </span>

              {teamPlayers.length === 0 ? (
                <div className="py-3.5 px-3 rounded-xl bg-white/[0.02] border border-dashed border-white/10 text-xs text-slate-400 text-center">
                  Athletes awaiting team draft
                </div>
              ) : (
                <div className="space-y-2">
                  {teamPlayers.map((p, pIdx) => {
                    const isCaptain = team.captainId === p.id;
                    return (
                      <div
                        key={p.id}
                        className="flex items-center justify-between gap-2.5 px-3 py-2 rounded-xl bg-white/[0.03] border border-white/[0.07] group-hover:border-white/15 transition-colors"
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <PlayerAvatar player={p} accentRing={isChampion ? 'ring-amber-400/60' : theme.ringColor} />
                          <div className="min-w-0">
                            <span
                              title={p.name}
                              className="block text-xs sm:text-sm font-bold text-slate-100 truncate"
                            >
                              {p.name}
                            </span>
                            <span className="block text-[10px] text-slate-400 font-medium">
                              Player {pIdx + 1}
                              {p.style ? ` · ${p.style}` : ''}
                            </span>
                          </div>
                        </div>

                        {isCaptain && (
                          <span
                            title="Team Captain"
                            className="inline-flex items-center gap-1 text-[10px] font-display font-black uppercase tracking-wider text-amber-300 shrink-0"
                          >
                            <Star className="w-3 h-3 fill-current" />
                            <span>C</span>
                          </span>
                        )}
                      </div>
                    );
                  })}

                  {/* Show clean draft slot only if 1 player assigned */}
                  {teamPlayers.length === 1 && (
                    <div className="flex items-center gap-2.5 px-3 py-2 rounded-xl bg-white/[0.015] border border-dashed border-white/10 text-slate-500">
                      <div className="w-9 h-9 rounded-full flex items-center justify-center bg-white/[0.03] text-[11px] font-mono">
                        P2
                      </div>
                      <span className="text-xs font-medium italic">Partner slot open</span>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* BOTTOM AREA: Verified Live Match Stats & Official Status */}
            <div className="space-y-3 pt-1">
              <div className="grid grid-cols-4 gap-1.5 pt-3 border-t border-white/10 text-center">
                <div className="py-1.5 px-1 rounded-lg bg-white/[0.02]">
                  <span className="block text-[9px] font-display font-bold uppercase tracking-wider text-slate-400">
                    Played
                  </span>
                  <span className="text-xs sm:text-sm font-mono font-black text-white tabular-nums">
                    {played}
                  </span>
                </div>
                <div className="py-1.5 px-1 rounded-lg bg-white/[0.02]">
                  <span className="block text-[9px] font-display font-bold uppercase tracking-wider text-slate-400">
                    Won
                  </span>
                  <span className="text-xs sm:text-sm font-mono font-black text-emerald-400 tabular-nums">
                    {won}
                  </span>
                </div>
                <div className="py-1.5 px-1 rounded-lg bg-white/[0.02]">
                  <span className="block text-[9px] font-display font-bold uppercase tracking-wider text-slate-400">
                    Lost
                  </span>
                  <span className="text-xs sm:text-sm font-mono font-black text-red-400 tabular-nums">
                    {lost}
                  </span>
                </div>
                <div className="py-1.5 px-1 rounded-lg bg-white/[0.02]">
                  <span className="block text-[9px] font-display font-bold uppercase tracking-wider text-slate-400">
                    Win %
                  </span>
                  <span className="text-xs sm:text-sm font-mono font-black text-amber-300 tabular-nums">
                    {winPct !== null ? `${winPct}%` : '—'}
                  </span>
                </div>
              </div>

              {/* Official Status Footer Bar */}
              <div className="flex items-center justify-between pt-2 border-t border-white/[0.07]">
                <div className={`flex items-center gap-1.5 text-[11px] font-display font-black uppercase tracking-[0.16em] ${statusConfig.textClass}`}>
                  {statusConfig.icon}
                  <span>{statusConfig.label}</span>
                </div>

                <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-400 group-hover:text-amber-300 transition-colors">
                  <span>Profile</span>
                  <ArrowRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-0.5" />
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }
);

interface TeamDetailModalProps {
  team: Team;
  teamIndex: number;
  teamPlayers: Player[];
  standingRecord?: StandingsRecord;
  rank?: number;
  status: TeamTournamentStatus;
  theme: TeamAccentTheme;
  teamMatches: Match[];
  allTeams: Team[];
  courtNames?: string[];
  onClose: () => void;
  onSelectMatch?: (match: Match) => void;
}

const TeamDetailModal: React.FC<TeamDetailModalProps> = ({
  team,
  teamIndex,
  teamPlayers,
  standingRecord,
  rank,
  status,
  theme,
  teamMatches,
  allTeams,
  courtNames,
  onClose,
  onSelectMatch,
}) => {
  const isChampion = status === 'CHAMPION';
  const played = standingRecord?.played ?? 0;
  const won = standingRecord?.won ?? 0;
  const lost = standingRecord?.lost ?? 0;
  const points = standingRecord?.points ?? 0;
  const diff = standingRecord?.diff ?? 0;
  const winPct = played > 0 ? Math.round((won / played) * 100) : null;

  const getTeamById = (id?: string) => allTeams.find((t) => t.id === id);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`${team.name} Team Profile`}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-[#03050b]/85 backdrop-blur-md animate-fade-in"
    >
      <div className="w-full max-w-2xl max-h-[90dvh] overflow-y-auto rounded-3xl bg-[#090c16] border border-amber-400/25 shadow-[0_28px_80px_-15px_rgba(0,0,0,0.95)] relative">
        {/* Top Accent Line */}
        <div
          aria-hidden="true"
          className={`h-1 w-full bg-gradient-to-r ${
            isChampion ? 'from-amber-200 via-amber-400 to-yellow-300' : theme.accentBar
          }`}
        />

        <button
          type="button"
          onClick={onClose}
          aria-label="Close team details"
          className="absolute top-4 right-4 z-20 p-2 min-w-[44px] min-h-[44px] flex items-center justify-center rounded-xl text-slate-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="p-5 sm:p-8 space-y-6">
          {/* Team Header */}
          <div className="flex flex-col sm:flex-row sm:items-center gap-4 pr-10">
            <div
              className={`w-16 h-16 sm:w-20 sm:h-20 rounded-2xl flex items-center justify-center text-3xl sm:text-4xl shrink-0 shadow-xl ring-1 ring-white/20 bg-gradient-to-br ${
                isChampion ? 'from-amber-300 via-amber-400 to-orange-500 text-slate-950' : `${theme.crestGradient} text-white`
              }`}
            >
              <span role="img" aria-hidden="true">
                {team.badge || '🏸'}
              </span>
            </div>

            <div className="min-w-0 space-y-1">
              <div className="flex flex-wrap items-center gap-2 text-xs font-display font-black uppercase tracking-[0.18em]">
                {isChampion ? (
                  <span className="inline-flex items-center gap-1 text-amber-300">
                    <Crown className="w-3.5 h-3.5" />
                    <span>OFFICIAL CHAMPIONS</span>
                  </span>
                ) : (
                  <span className={theme.accentText}>{status}</span>
                )}
                <span className="text-slate-600">·</span>
                <span className="text-slate-400">Team #{String(teamIndex + 1).padStart(2, '0')}</span>
                {rank != null && rank > 0 && (
                  <>
                    <span className="text-slate-600">·</span>
                    <span className="text-amber-300 font-mono">Standing #{rank}</span>
                  </>
                )}
              </div>

              <h3 className="text-2xl sm:text-3xl font-display font-black text-white tracking-tight break-words">
                {team.name}
              </h3>

              {team.token && (
                <p className="text-xs font-mono text-slate-400">Draft Token: {team.token}</p>
              )}
            </div>
          </div>

          {/* Tournament Record Grid */}
          <div className="grid grid-cols-3 sm:grid-cols-6 gap-2.5 p-3.5 rounded-2xl bg-white/[0.03] border border-white/10 text-center">
            <div>
              <span className="block text-[10px] font-display uppercase tracking-wider text-slate-400">Played</span>
              <span className="text-lg font-mono font-black text-white tabular-nums">{played}</span>
            </div>
            <div>
              <span className="block text-[10px] font-display uppercase tracking-wider text-slate-400">Won</span>
              <span className="text-lg font-mono font-black text-emerald-400 tabular-nums">{won}</span>
            </div>
            <div>
              <span className="block text-[10px] font-display uppercase tracking-wider text-slate-400">Lost</span>
              <span className="text-lg font-mono font-black text-red-400 tabular-nums">{lost}</span>
            </div>
            <div>
              <span className="block text-[10px] font-display uppercase tracking-wider text-slate-400">Win %</span>
              <span className="text-lg font-mono font-black text-amber-300 tabular-nums">
                {winPct !== null ? `${winPct}%` : '—'}
              </span>
            </div>
            <div>
              <span className="block text-[10px] font-display uppercase tracking-wider text-slate-400">Net Diff</span>
              <span className="text-lg font-mono font-black text-slate-200 tabular-nums">
                {diff > 0 ? `+${diff}` : diff}
              </span>
            </div>
            <div>
              <span className="block text-[10px] font-display uppercase tracking-wider text-slate-400">Points</span>
              <span className="text-lg font-mono font-black text-amber-400 tabular-nums">{points}</span>
            </div>
          </div>

          {/* Players Lineup */}
          <div className="space-y-3">
            <h4 className="text-xs font-display font-bold uppercase tracking-[0.2em] text-slate-400">
              Team Athletes
            </h4>
            {teamPlayers.length === 0 ? (
              <p className="text-sm text-slate-400 italic">No athletes assigned to this team yet.</p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {teamPlayers.map((p, idx) => {
                  const isCaptain = team.captainId === p.id;
                  return (
                    <div
                      key={p.id}
                      className="flex items-center justify-between gap-3 p-3.5 rounded-2xl bg-white/[0.03] border border-white/10"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <PlayerAvatar
                          player={p}
                          accentRing={isChampion ? 'ring-amber-400/60' : theme.ringColor}
                          sizeClass="w-11 h-11 text-sm"
                        />
                        <div className="min-w-0">
                          <span className="block font-bold text-sm text-white truncate">{p.name}</span>
                          <span className="block text-[11px] text-slate-400">
                            Player {idx + 1}
                            {p.style ? ` · ${p.style}` : ''}
                            {p.skillLevel ? ` · ${p.skillLevel}` : ''}
                          </span>
                        </div>
                      </div>
                      {isCaptain && (
                        <span className="inline-flex items-center gap-1 text-[10px] font-display font-black uppercase tracking-wider text-amber-300 shrink-0">
                          <Star className="w-3.5 h-3.5 fill-current" />
                          <span>Captain</span>
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Match History & Progression */}
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-2">
              <h4 className="text-xs font-display font-bold uppercase tracking-[0.2em] text-slate-400">
                Match History & Progression
              </h4>
              <span className="text-xs font-mono text-slate-400 tabular-nums">
                {teamMatches.length} {teamMatches.length === 1 ? 'Fixture' : 'Fixtures'}
              </span>
            </div>

            {teamMatches.length === 0 ? (
              <div className="p-5 rounded-2xl bg-white/[0.02] border border-white/10 text-center text-xs text-slate-400">
                No scheduled or completed fixtures recorded for {team.name} yet.
              </div>
            ) : (
              <div className="space-y-2.5 max-h-64 overflow-y-auto pr-1">
                {teamMatches.map((m) => {
                  const isTeamA = m.teamA === team.id;
                  const opponentId = isTeamA ? m.teamB : m.teamA;
                  const opponent = getTeamById(opponentId);
                  const teamScore = isTeamA ? m.scoreA : m.scoreB;
                  const oppScore = isTeamA ? m.scoreB : m.scoreA;
                  const winnerId = getMatchWinnerId(m);
                  const wonMatch = winnerId === team.id;
                  const lostMatch = m.status === 'completed' && Boolean(winnerId) && winnerId !== team.id;
                  const courtLabel =
                    m.courtName || courtNames?.[Math.max(0, (m.court || 1) - 1)]?.trim() || `Court ${m.court || 1}`;

                  return (
                    <div
                      key={m.id}
                      role={onSelectMatch ? 'button' : undefined}
                      tabIndex={onSelectMatch ? 0 : undefined}
                      onClick={() => {
                        if (onSelectMatch) {
                          onClose();
                          onSelectMatch(m);
                        }
                      }}
                      onKeyDown={(e) => {
                        if (onSelectMatch && (e.key === 'Enter' || e.key === ' ')) {
                          e.preventDefault();
                          onClose();
                          onSelectMatch(m);
                        }
                      }}
                      className={`p-3.5 rounded-xl bg-white/[0.03] border border-white/10 flex items-center justify-between gap-3 transition-colors ${
                        onSelectMatch ? 'hover:border-amber-400/45 hover:bg-white/[0.05] cursor-pointer' : ''
                      }`}
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 text-[11px] font-mono text-slate-400">
                          <span className={m.matchType === 'knockout' ? 'text-amber-300 font-bold' : ''}>
                            {m.matchType === 'knockout' ? m.stageLabel || 'Knockout' : `Round ${m.round}`}
                          </span>
                          <span aria-hidden="true">·</span>
                          <span>{courtLabel}</span>
                        </div>
                        <p className="text-sm font-bold text-white truncate mt-0.5">
                          vs {opponent?.badge ? `${opponent.badge} ` : ''}
                          {opponent?.name || 'Awaiting Opponent'}
                        </p>
                      </div>

                      <div className="text-right shrink-0">
                        {m.status === 'completed' || m.status === 'live' || m.status === 'paused' ? (
                          <>
                            <span className="block text-base font-mono font-black text-white tabular-nums">
                              {teamScore ?? 0} – {oppScore ?? 0}
                            </span>
                            <span
                              className={`block text-[10px] font-display font-black uppercase tracking-wider ${
                                m.status === 'live'
                                  ? 'text-red-400'
                                  : wonMatch
                                  ? 'text-emerald-400'
                                  : lostMatch
                                  ? 'text-red-400'
                                  : 'text-amber-300'
                              }`}
                            >
                              {m.status === 'live' ? 'LIVE' : wonMatch ? 'WIN' : lostMatch ? 'LOSS' : m.status.toUpperCase()}
                            </span>
                          </>
                        ) : (
                          <span className="text-[10px] font-display font-bold uppercase tracking-wider text-amber-300">
                            UPCOMING
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export const TeamsShowcaseSection: React.FC<TeamsShowcaseSectionProps> = ({
  teams,
  players,
  matches,
  knockout,
  standings,
  courtNames,
  tournamentName,
  onOpenPublicRegister,
  onSelectMatch,
}) => {
  const [selectedTeamId, setSelectedTeamId] = useState<string | null>(null);

  useEffect(() => {
    if (!selectedTeamId) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setSelectedTeamId(null);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [selectedTeamId]);

  const playerMap = useMemo(() => {
    const map = new Map<string, Player>();
    for (const p of players) {
      map.set(p.id, p);
    }
    return map;
  }, [players]);

  const standingsMap = useMemo(() => {
    const map = new Map<string, { record: StandingsRecord; rank: number }>();
    standings.forEach((s, idx) => {
      map.set(s.team.id, { record: s, rank: idx + 1 });
    });
    return map;
  }, [standings]);

  // Normalize knockout + league matches once for status & match history derivation
  const allTeamMatches = useMemo(() => {
    const koList: Match[] = (knockout?.matches || []).map((ko) => {
      const stageLabel =
        ko.stage === 'F'
          ? 'Grand Final'
          : ko.stage === 'SF'
          ? `Semi-Final ${ko.slot || 1}`
          : `Quarter-Final ${ko.slot || 1}`;
      return {
        id: ko.id,
        round: ko.stage === 'F' ? 999 : ko.stage === 'SF' ? 998 : 997,
        court: ko.court || 1,
        courtName: ko.courtName,
        teamA: ko.teamA || '',
        teamB: ko.teamB || '',
        scoreA: ko.scoreA,
        scoreB: ko.scoreB,
        status: ko.status,
        winner: ko.winner,
        time: ko.time,
        sets: ko.sets,
        mvpPlayerId: ko.mvpPlayerId,
        version: ko.version,
        matchType: 'knockout',
        stage: ko.stage,
        slot: ko.slot,
        stageLabel,
      };
    });
    return [...koList, ...matches];
  }, [knockout?.matches, matches]);

  // Accurate Supabase-backed tournament status derivation for every team
  const teamStatusMap = useMemo(() => {
    const map = new Map<string, TeamTournamentStatus>();
    const koMatches = knockout?.matches || [];

    // 1. Check confirmed Grand Final Champion
    const finalMatch = koMatches.find((m) => m.stage === 'F');
    const championId = finalMatch ? getKnockoutMatchWinnerId(finalMatch) : undefined;

    // 2. Determine whether knockout stage brackets already contain assigned teams
    const activeKoMatches = koMatches.filter((m) => Boolean(m.teamA || m.teamB));
    const hasSeededKnockout = activeKoMatches.length > 0;

    for (const team of teams) {
      if (championId && team.id === championId) {
        map.set(team.id, 'CHAMPION');
        continue;
      }

      if (!hasSeededKnockout) {
        map.set(team.id, 'ACTIVE');
        continue;
      }

      const participatedKo = koMatches.filter((m) => m.teamA === team.id || m.teamB === team.id);
      if (participatedKo.length === 0) {
        // Bracket is populated and this team did not enter the knockout cut
        map.set(team.id, 'ELIMINATED');
        continue;
      }

      // Check if team still has an active/upcoming knockout match or won its latest knockout match
      const hasOngoingOrUpcomingKo = participatedKo.some(
        (m) => m.status === 'upcoming' || m.status === 'live' || m.status === 'paused'
      );
      if (hasOngoingOrUpcomingKo) {
        map.set(team.id, 'QUALIFIED');
        continue;
      }

      const lostAnyKo = participatedKo.some((m) => {
        const w = getKnockoutMatchWinnerId(m);
        return Boolean(w && w !== team.id);
      });

      map.set(team.id, lostAnyKo ? 'ELIMINATED' : 'QUALIFIED');
    }

    return map;
  }, [teams, knockout?.matches]);

  const handleSelectTeam = useCallback((teamId: string) => {
    setSelectedTeamId(teamId);
  }, []);

  const selectedTeamIndex = selectedTeamId ? teams.findIndex((t) => t.id === selectedTeamId) : -1;
  const selectedTeam = selectedTeamIndex >= 0 ? teams[selectedTeamIndex] : null;
  const selectedTeamPlayers = useMemo(() => {
    if (!selectedTeam) return [];
    return (selectedTeam.players || [])
      .map((pid) => playerMap.get(pid))
      .filter((p): p is Player => Boolean(p));
  }, [selectedTeam, playerMap]);

  const selectedTeamMatches = useMemo(() => {
    if (!selectedTeam) return [];
    return allTeamMatches.filter((m) => m.teamA === selectedTeam.id || m.teamB === selectedTeam.id);
  }, [selectedTeam, allTeamMatches]);

  return (
    <section
      id="teams-roster"
      aria-label="Smash Premier League 3.0 Teams"
      className="relative overflow-hidden bg-[#05060b] border-y border-white/10 py-14 sm:py-20 scroll-mt-20"
    >
      {/* Atmospheric Arena Glows & Subtle Badminton Court Floor Geometry */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden spl-broadcast-layer">
        <div className="absolute -top-24 left-1/4 w-[28rem] h-72 rounded-full bg-amber-500/10 blur-3xl" />
        <div className="absolute -bottom-24 right-1/4 w-[26rem] h-72 rounded-full bg-red-600/10 blur-3xl" />
        <svg
          className="hidden md:block absolute inset-0 w-full h-full opacity-[0.045] text-amber-200"
          viewBox="0 0 1200 700"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.4"
          preserveAspectRatio="xMidYMid slice"
        >
          <rect x="80" y="60" width="1040" height="580" />
          <line x1="600" y1="60" x2="600" y2="640" strokeDasharray="8 6" />
          <line x1="220" y1="60" x2="220" y2="640" />
          <line x1="980" y1="60" x2="980" y2="640" />
          <line x1="80" y1="150" x2="1120" y2="150" />
          <line x1="80" y1="550" x2="1120" y2="550" />
        </svg>
      </div>

      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* PHASE 1: Championship Section Header */}
        <div className="text-center max-w-3xl mx-auto mb-10 sm:mb-14 space-y-3 spl-hero-stagger-1">
          <div className="flex items-center justify-center gap-2 text-xs font-display font-black uppercase tracking-[0.26em] text-amber-400">
            <Trophy className="w-4 h-4 text-amber-400 shrink-0" />
            <span>MEET THE CONTENDERS</span>
            <span className="text-slate-600">·</span>
            <span className="text-slate-300 truncate max-w-[220px] sm:max-w-none">{tournamentName}</span>
          </div>

          <h2 className="text-[clamp(1.9rem,4vw,3.25rem)] font-black text-white font-display uppercase tracking-tight leading-[1.06] text-balance">
            SMASH PREMIER LEAGUE{' '}
            <span className="bg-gradient-to-r from-amber-200 via-amber-400 to-orange-500 bg-clip-text text-transparent">
              3.0
            </span>
          </h2>

          <p className="text-sm sm:text-lg font-medium text-slate-300 max-w-xl mx-auto">
            “Every Team Has a Dream. Only One Becomes Champion.”
          </p>

          {teams.length > 0 && (
            <div className="pt-1 flex items-center justify-center gap-3 text-xs font-mono text-slate-400 tabular-nums">
              <span>{teams.length} Official Contenders</span>
              <span aria-hidden="true">·</span>
              <span>{players.length} Athletes</span>
              <span aria-hidden="true">·</span>
              <span className="text-amber-300/90">Click any team for full match history</span>
            </div>
          )}
        </div>

        {/* Empty State vs Championship Contender Grid */}
        {teams.length === 0 ? (
          <div className="p-10 sm:p-14 text-center rounded-3xl bg-[#0a0d18]/90 border border-amber-400/20 max-w-xl mx-auto shadow-2xl">
            <div className="w-16 h-16 mx-auto rounded-2xl bg-amber-400/10 border border-amber-400/25 flex items-center justify-center text-3xl">
              <Trophy className="w-8 h-8 text-amber-400" />
            </div>
            <h3 className="text-xl font-display font-black text-white uppercase mt-5">
              Contenders Draft in Progress
            </h3>
            <p className="text-xs sm:text-sm text-slate-400 mt-2 leading-relaxed">
              Official championship squads for {tournamentName} are being finalized. Register now to enter the athlete draft.
            </p>
            <button
              type="button"
              onClick={onOpenPublicRegister}
              className="mt-6 inline-flex items-center gap-2 px-6 py-3 min-h-[44px] rounded-xl font-display font-black text-xs uppercase tracking-wider text-slate-950 bg-gradient-to-r from-amber-300 via-amber-400 to-orange-500 hover:from-amber-200 hover:to-orange-400 shadow-lg shadow-amber-500/25 transition-all active:scale-95 cursor-pointer"
            >
              <PlusCircle className="w-4 h-4" />
              <span>Register as an Athlete</span>
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5 sm:gap-6 items-stretch">
            {teams.map((team, idx) => {
              const teamPlayers = (team.players || [])
                .map((pid) => playerMap.get(pid))
                .filter((p): p is Player => Boolean(p));
              const standingInfo = standingsMap.get(team.id);
              const status = teamStatusMap.get(team.id) || 'ACTIVE';
              const theme = resolveTeamAccentTheme(team.avatarColor, idx);

              return (
                <TeamContenderCard
                  key={team.id}
                  team={team}
                  index={idx}
                  teamPlayers={teamPlayers}
                  standingRecord={standingInfo?.record}
                  rank={standingInfo?.rank}
                  status={status}
                  theme={theme}
                  onSelect={handleSelectTeam}
                />
              );
            })}
          </div>
        )}
      </div>

      {/* PHASE 7: Enhanced Team Detail Modal */}
      {selectedTeam && (
        <TeamDetailModal
          team={selectedTeam}
          teamIndex={selectedTeamIndex}
          teamPlayers={selectedTeamPlayers}
          standingRecord={standingsMap.get(selectedTeam.id)?.record}
          rank={standingsMap.get(selectedTeam.id)?.rank}
          status={teamStatusMap.get(selectedTeam.id) || 'ACTIVE'}
          theme={resolveTeamAccentTheme(selectedTeam.avatarColor, selectedTeamIndex)}
          teamMatches={selectedTeamMatches}
          allTeams={teams}
          courtNames={courtNames}
          onClose={() => setSelectedTeamId(null)}
          onSelectMatch={onSelectMatch}
        />
      )}
    </section>
  );
};
