import React, { useEffect, useMemo, useState } from 'react';
import {
  Archive,
  Award,
  BarChart3,
  Calendar,
  CheckCircle2,
  Crown,
  Eye,
  IndianRupee,
  Loader2,
  Lock,
  MapPin,
  RefreshCw,
  ShieldCheck,
  Swords,
  Trophy,
  Users,
} from 'lucide-react';
import { useTournament } from '../../context/TournamentContext';
import { SupabaseService } from '../../services/supabaseService';
import { SeasonArchiveSnapshot, StandingsRecord, TournamentSeason } from '../../types/tournament';
import { calculateStandings } from '../../utils/tournamentEngine';
import { getPlayoffMatchDisplayLabel } from '../../utils/playoffEngine';
import { NavTab } from '../common/Header';

interface PreviousSeasonsViewProps {
  onSelectTab?: (tab: NavTab) => void;
}

type ArchiveSubTab = 'overview' | 'standings' | 'teams' | 'matches' | 'registrations';

export const PreviousSeasonsView: React.FC<PreviousSeasonsViewProps> = ({ onSelectTab }) => {
  const { seasons, activeSeason, switchActiveSeason } = useTournament();

  const globalActiveSeason = useMemo(
    () => seasons.find((s) => s.isActive) || activeSeason,
    [seasons, activeSeason]
  );

  // Order historical/completed/archived seasons first (SPL 3.0 prioritized), then any other seasons
  const archivableSeasons = useMemo(() => {
    const historical = seasons.filter(
      (s) =>
        s.status === 'completed' ||
        s.status === 'archived' ||
        s.seasonSlug === 'season-4' ||
        s.seasonSlug !== globalActiveSeason.seasonSlug
    );
    return historical.length > 0 ? historical : seasons;
  }, [seasons, globalActiveSeason.seasonSlug]);

  const [selectedSlug, setSelectedSlug] = useState<string>(() => {
    const spl3 = archivableSeasons.find(
      (s) => s.seasonSlug === 'season-4' || s.seasonNumber === '3.0'
    );
    return spl3?.seasonSlug || archivableSeasons[0]?.seasonSlug || 'season-4';
  });

  useEffect(() => {
    if (!archivableSeasons.some((s) => s.seasonSlug === selectedSlug)) {
      const spl3 = archivableSeasons.find(
        (s) => s.seasonSlug === 'season-4' || s.seasonNumber === '3.0'
      );
      setSelectedSlug(spl3?.seasonSlug || archivableSeasons[0]?.seasonSlug || 'season-4');
    }
  }, [archivableSeasons, selectedSlug]);

  const selectedSeason: TournamentSeason | undefined = useMemo(
    () =>
      seasons.find((s) => s.seasonSlug === selectedSlug) ||
      archivableSeasons[0] ||
      activeSeason,
    [seasons, selectedSlug, archivableSeasons, activeSeason]
  );

  const [snapshot, setSnapshot] = useState<SeasonArchiveSnapshot | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [archiveTab, setArchiveTab] = useState<ArchiveSubTab>('overview');
  const [switchingPortal, setSwitchingPortal] = useState<boolean>(false);

  const loadSnapshot = async (season?: TournamentSeason) => {
    if (!season) return;
    setLoading(true);
    setError(null);
    try {
      const res = await SupabaseService.fetchSeasonArchiveSnapshot(season.seasonSlug, season.id);
      if (!res) {
        setError(`Could not load historical records for SPL ${season.seasonNumber}.`);
        setSnapshot(null);
      } else {
        setSnapshot(res);
      }
    } catch (err: any) {
      setError(err?.message || 'Unable to load historical archive snapshot.');
      setSnapshot(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadSnapshot(selectedSeason);
  }, [selectedSeason?.seasonSlug, selectedSeason?.id]);

  const computedStandings: StandingsRecord[] = useMemo(() => {
    if (!snapshot) return [];
    if (snapshot.standings && snapshot.standings.length > 0) {
      return snapshot.standings;
    }
    if (snapshot.teams.length === 0) return [];
    return calculateStandings(
      snapshot.teams,
      snapshot.matches,
      snapshot.knockout?.matches || [],
      { includeKnockoutInStandings: false }
    );
  }, [snapshot]);

  const playerLookup = useMemo(() => {
    const map = new Map<string, string>();
    for (const p of snapshot?.players || []) {
      map.set(p.id, p.name);
    }
    return map;
  }, [snapshot?.players]);

  const teamLookup = useMemo(() => {
    const map = new Map<string, { name: string; badge?: string; players: string[] }>();
    for (const t of snapshot?.teams || []) {
      map.set(t.id, { name: t.name, badge: t.badge, players: t.players || [] });
    }
    return map;
  }, [snapshot?.teams]);

  // Resolve verified honors from snapshot knockout Final or season historicalSummary
  const resolvedHonors = useMemo(() => {
    const hist = selectedSeason?.historicalSummary;
    const gf = (snapshot?.knockout?.matches || []).find(
      (m) => m.stage === 'F' && m.status === 'completed'
    );
    const gfChampTeam = gf?.winner ? teamLookup.get(gf.winner) : undefined;
    const gfRunnerId =
      gf?.winner && gf.teamA && gf.teamB
        ? gf.winner === gf.teamA
          ? gf.teamB
          : gf.teamA
        : undefined;
    const gfRunnerTeam = gfRunnerId ? teamLookup.get(gfRunnerId) : undefined;

    const champPlayersFromTeam = gfChampTeam?.players
      .map((pid) => playerLookup.get(pid))
      .filter(Boolean)
      .join(' & ');
    const runnerPlayersFromTeam = gfRunnerTeam?.players
      .map((pid) => playerLookup.get(pid))
      .filter(Boolean)
      .join(' & ');

    return {
      champions: hist?.champions || champPlayersFromTeam || gfChampTeam?.name || 'Not Recorded',
      championTeam: hist?.championTeam || gfChampTeam?.name || '',
      runnersUp: hist?.runnersUp || runnerPlayersFromTeam || gfRunnerTeam?.name || 'Not Recorded',
      runnerUpTeam: hist?.runnerUpTeam || gfRunnerTeam?.name || '',
      gfScore:
        gf && gf.scoreA !== undefined && gf.scoreB !== undefined
          ? `${gf.scoreA} – ${gf.scoreB}`
          : undefined,
      mvp: hist?.mvp || (gf?.mvpPlayerId ? playerLookup.get(gf.mvpPlayerId) : undefined),
    };
  }, [selectedSeason, snapshot, teamLookup, playerLookup]);

  const handleInspectFullPortal = async () => {
    if (!selectedSeason) return;
    setSwitchingPortal(true);
    const ok = await switchActiveSeason(selectedSeason.seasonSlug, { persistGlobal: false });
    setSwitchingPortal(false);
    if (ok && onSelectTab) {
      onSelectTab('dashboard');
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Strictly Read-Only Archive Banner */}
      <div className="rounded-2xl border border-amber-400/30 bg-gradient-to-r from-amber-500/10 via-[#0d1424] to-slate-900/90 p-4 sm:p-6 space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-amber-400/15 border border-amber-400/35 text-amber-300 text-[11px] font-mono font-bold uppercase tracking-wider">
                <Lock className="w-3.5 h-3.5" />
                <span>Read-Only Historical Archive</span>
              </span>
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-800 border border-white/10 text-slate-300 text-[11px] font-mono">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                <span>Historical Scores & Financials Protected</span>
              </span>
            </div>
            <h2 className="text-xl sm:text-2xl font-display font-black text-white tracking-tight">
              Previous Seasons & Championship Records
            </h2>
            <p className="text-xs sm:text-sm text-slate-400 max-w-2xl">
              Inspect verified SPL historical standings, match results, team rosters, registrations, and financial totals without modifying or affecting the active public tournament.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 shrink-0">
            <button
              type="button"
              onClick={() => void loadSnapshot(selectedSeason)}
              disabled={loading}
              className="inline-flex items-center gap-1.5 px-3.5 py-2.5 min-h-[44px] rounded-xl text-xs font-semibold text-slate-300 hover:text-white bg-white/5 hover:bg-white/10 border border-white/10 cursor-pointer disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-amber-400' : ''}`} />
              <span>Reload Archive</span>
            </button>

            {selectedSeason && (
              <button
                type="button"
                onClick={() => void handleInspectFullPortal()}
                disabled={switchingPortal}
                className="inline-flex items-center gap-2 px-4 py-2.5 min-h-[44px] rounded-xl text-xs font-bold text-sky-200 bg-sky-500/15 hover:bg-sky-500/25 border border-sky-500/35 cursor-pointer disabled:opacity-50"
              >
                <Eye className="w-4 h-4" />
                <span>
                  {switchingPortal
                    ? 'Opening...'
                    : `Inspect Full Admin Views (Read-Only)`}
                </span>
              </button>
            )}
          </div>
        </div>

        {/* Historical Season Selector Pills */}
        <div className="flex flex-wrap items-center gap-2 pt-3 border-t border-white/10">
          {archivableSeasons.map((season) => {
            const isSelected = season.seasonSlug === selectedSeason?.seasonSlug;
            return (
              <button
                key={season.id || season.seasonSlug}
                type="button"
                onClick={() => {
                  setSelectedSlug(season.seasonSlug);
                  setArchiveTab('overview');
                }}
                className={`inline-flex items-center gap-2 px-3.5 py-2 min-h-[40px] rounded-xl text-xs font-bold border transition-colors cursor-pointer ${
                  isSelected
                    ? 'bg-amber-400 text-slate-950 border-amber-300 shadow'
                    : 'bg-slate-900/80 text-slate-300 hover:text-white border-white/10 hover:bg-white/5'
                }`}
              >
                <Archive className="w-3.5 h-3.5 shrink-0" />
                <span>SPL {season.seasonNumber}</span>
                <span className="opacity-80 font-normal">({season.editionName})</span>
                <span
                  className={`px-1.5 py-0.5 rounded text-[9px] font-mono uppercase ${
                    isSelected ? 'bg-slate-950/20 text-slate-950' : 'bg-white/10 text-slate-300'
                  }`}
                >
                  {season.status}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {loading ? (
        <div className="rounded-2xl border border-white/10 bg-[#0d1424] p-12 text-center space-y-3">
          <Loader2 className="w-8 h-8 text-amber-400 animate-spin mx-auto" />
          <p className="text-xs font-mono uppercase tracking-widest text-slate-400">
            Loading Historical Archive Snapshot...
          </p>
        </div>
      ) : error || !snapshot || !selectedSeason ? (
        <div className="rounded-2xl border border-rose-500/30 bg-[#0d1424] p-8 text-center space-y-2">
          <p className="text-sm font-semibold text-rose-300">
            {error || 'No historical snapshot found for the selected season.'}
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Verified Honors & Financial Summary Header */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
            <div className="lg:col-span-7 rounded-2xl border border-amber-400/30 bg-gradient-to-br from-[#171207] via-[#0d1424] to-[#0a0f1c] p-5 sm:p-6 space-y-4">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <span className="inline-flex items-center gap-1.5 text-[11px] font-mono font-bold uppercase tracking-widest text-amber-300">
                  <Crown className="w-4 h-4" />
                  <span>SPL {selectedSeason.seasonNumber} · {selectedSeason.editionName}</span>
                </span>
                <span className="px-2 py-0.5 rounded bg-amber-400/15 border border-amber-400/30 text-amber-200 text-[10px] font-mono font-bold uppercase">
                  {selectedSeason.status} · {selectedSeason.tournamentYear}
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="rounded-xl border border-amber-400/35 bg-amber-400/[0.07] p-4 space-y-1">
                  <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-amber-300 block">
                    🏆 Champions
                  </span>
                  <p className="text-lg font-display font-black text-white">
                    {resolvedHonors.champions}
                  </p>
                  {resolvedHonors.championTeam && (
                    <p className="text-xs text-amber-200/80 font-semibold">
                      {resolvedHonors.championTeam}
                    </p>
                  )}
                </div>

                <div className="rounded-xl border border-white/15 bg-white/[0.03] p-4 space-y-1">
                  <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-slate-400 block">
                    🥈 Runners-Up
                  </span>
                  <p className="text-lg font-display font-black text-white">
                    {resolvedHonors.runnersUp}
                  </p>
                  {resolvedHonors.runnerUpTeam && (
                    <p className="text-xs text-slate-300 font-semibold">
                      {resolvedHonors.runnerUpTeam}
                    </p>
                  )}
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-x-5 gap-y-1.5 text-xs text-slate-400 pt-1">
                <span className="inline-flex items-center gap-1.5">
                  <MapPin className="w-3.5 h-3.5 text-amber-400" />
                  {selectedSeason.venue}
                </span>
                {(selectedSeason.startDate || selectedSeason.date) && (
                  <span className="inline-flex items-center gap-1.5 font-mono">
                    <Calendar className="w-3.5 h-3.5 text-amber-400" />
                    {selectedSeason.startDate || selectedSeason.date}
                  </span>
                )}
                {resolvedHonors.gfScore && (
                  <span className="inline-flex items-center gap-1.5 font-mono text-amber-300 font-bold">
                    <Trophy className="w-3.5 h-3.5" />
                    Final Score: {resolvedHonors.gfScore}
                  </span>
                )}
              </div>
            </div>

            <div className="lg:col-span-5 grid grid-cols-2 gap-3">
              <div className="rounded-2xl border border-white/10 bg-[#0d1424] p-4 flex flex-col justify-between">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                  <Users className="w-3.5 h-3.5 text-sky-400" />
                  Registrations
                </span>
                <div className="mt-2">
                  <span className="text-2xl font-mono font-black text-white tabular-nums">
                    {snapshot.registrations.length}
                  </span>
                  <span className="block text-[11px] text-emerald-400 font-semibold mt-0.5">
                    {snapshot.paidCount} Paid Entries
                  </span>
                </div>
              </div>

              <div className="rounded-2xl border border-white/10 bg-[#0d1424] p-4 flex flex-col justify-between">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                  <IndianRupee className="w-3.5 h-3.5 text-emerald-400" />
                  Entry Revenue
                </span>
                <div className="mt-2">
                  <span className="text-2xl font-mono font-black text-emerald-300 tabular-nums">
                    ₹{snapshot.revenueCollected.toLocaleString('en-IN')}
                  </span>
                  <span className="block text-[11px] text-slate-400 mt-0.5">
                    Fee: ₹{selectedSeason.entryFee} / player
                  </span>
                </div>
              </div>

              <div className="rounded-2xl border border-white/10 bg-[#0d1424] p-4 flex flex-col justify-between">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                  <Award className="w-3.5 h-3.5 text-amber-400" />
                  Teams & Roster
                </span>
                <div className="mt-2">
                  <span className="text-2xl font-mono font-black text-white tabular-nums">
                    {snapshot.teams.length} Teams
                  </span>
                  <span className="block text-[11px] text-slate-400 mt-0.5">
                    {snapshot.players.length} Players
                  </span>
                </div>
              </div>

              <div className="rounded-2xl border border-white/10 bg-[#0d1424] p-4 flex flex-col justify-between">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                  <Swords className="w-3.5 h-3.5 text-lime-400" />
                  Matches Recorded
                </span>
                <div className="mt-2">
                  <span className="text-2xl font-mono font-black text-white tabular-nums">
                    {snapshot.matches.length + (snapshot.knockout?.matches?.length || 0)}
                  </span>
                  <span className="block text-[11px] text-slate-400 mt-0.5">
                    {snapshot.matches.length} League · {snapshot.knockout?.matches?.length || 0} Knockout
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* 5 Read-Only Archive Sub-Tabs */}
          <div className="rounded-2xl border border-white/10 bg-[#0d1424] overflow-hidden">
            <div className="flex items-center gap-1.5 overflow-x-auto border-b border-white/10 px-4 py-3 bg-slate-950/50">
              {(
                [
                  { id: 'overview', label: 'Overview & Honors', icon: Trophy },
                  { id: 'standings', label: `Standings (${computedStandings.length})`, icon: BarChart3 },
                  { id: 'teams', label: `Teams & Players (${snapshot.teams.length})`, icon: Users },
                  {
                    id: 'matches',
                    label: `Matches & Bracket (${snapshot.matches.length + (snapshot.knockout?.matches?.length || 0)})`,
                    icon: Swords,
                  },
                  {
                    id: 'registrations',
                    label: `Registrations & Financials (${snapshot.registrations.length})`,
                    icon: IndianRupee,
                  },
                ] as const
              ).map((tab) => {
                const Icon = tab.icon;
                const active = archiveTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setArchiveTab(tab.id)}
                    className={`inline-flex items-center gap-2 px-3.5 py-2 min-h-[40px] rounded-xl text-xs font-bold whitespace-nowrap transition-colors cursor-pointer ${
                      active
                        ? 'bg-amber-400 text-slate-950'
                        : 'text-slate-300 hover:text-white hover:bg-white/5'
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5" />
                    <span>{tab.label}</span>
                  </button>
                );
              })}
            </div>

            <div className="p-4 sm:p-6">
              {archiveTab === 'overview' && (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="rounded-xl border border-white/10 bg-slate-950/60 p-4 space-y-1">
                      <span className="text-[11px] font-bold uppercase text-slate-400">
                        Season Title
                      </span>
                      <p className="text-sm font-bold text-white">{selectedSeason.seasonTitle}</p>
                      <p className="text-xs font-mono text-slate-400">
                        slug: {selectedSeason.seasonSlug}
                      </p>
                    </div>
                    <div className="rounded-xl border border-white/10 bg-slate-950/60 p-4 space-y-1">
                      <span className="text-[11px] font-bold uppercase text-slate-400">
                        Scoring Format & Courts
                      </span>
                      <p className="text-sm font-bold text-white">
                        {selectedSeason.scoringRules?.pointTarget || 21}-Point Rally ·{' '}
                        {selectedSeason.scoringRules?.setsToWin === 2 ? 'Best of 3 Sets' : '1 Set'}
                      </p>
                      <p className="text-xs text-slate-400">
                        {(selectedSeason.courtNames || ['Court 1', 'Court 2']).join(', ')}
                      </p>
                    </div>
                    <div className="rounded-xl border border-white/10 bg-slate-950/60 p-4 space-y-1">
                      <span className="text-[11px] font-bold uppercase text-slate-400">
                        Archive Integrity
                      </span>
                      <p className="text-sm font-bold text-emerald-300 flex items-center gap-1.5">
                        <CheckCircle2 className="w-4 h-4" />
                        Verified Historical Record
                      </p>
                      <p className="text-xs text-slate-400">
                        Read-only snapshot; mutations disabled.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {archiveTab === 'standings' && (
                computedStandings.length === 0 ? (
                  <p className="text-sm text-slate-400 py-8 text-center">
                    No league standings recorded for this season.
                  </p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs text-slate-300">
                      <thead className="text-[11px] uppercase font-bold text-slate-400 bg-slate-950/70 border-b border-white/10">
                        <tr>
                          <th className="px-4 py-3">Rank</th>
                          <th className="px-4 py-3">Team</th>
                          <th className="px-3 py-3 text-center">P</th>
                          <th className="px-3 py-3 text-center">W</th>
                          <th className="px-3 py-3 text-center">L</th>
                          <th className="px-3 py-3 text-center">Diff</th>
                          <th className="px-4 py-3 text-center text-lime-400">PTS</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/5 font-mono">
                        {computedStandings.map((row, idx) => (
                          <tr key={row.team.id}>
                            <td className="px-4 py-3 font-bold">
                              {idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : `#${idx + 1}`}
                            </td>
                            <td className="px-4 py-3 font-sans font-bold text-white">
                              {row.team.badge || '🏸'} {row.team.name}
                            </td>
                            <td className="px-3 py-3 text-center">{row.played}</td>
                            <td className="px-3 py-3 text-center text-emerald-400 font-bold">{row.won}</td>
                            <td className="px-3 py-3 text-center text-rose-400">{row.lost}</td>
                            <td className="px-3 py-3 text-center">
                              {row.diff > 0 ? `+${row.diff}` : row.diff}
                            </td>
                            <td className="px-4 py-3 text-center font-black text-lime-400">
                              {row.points}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )
              )}

              {archiveTab === 'teams' && (
                <div className="space-y-6">
                  {snapshot.teams.length > 0 && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                      {snapshot.teams.map((t) => {
                        const roster = (t.players || [])
                          .map((pid) => playerLookup.get(pid) || pid)
                          .join(' & ');
                        return (
                          <div
                            key={t.id}
                            className="rounded-xl border border-white/10 bg-slate-950/60 p-4 space-y-1.5"
                          >
                            <div className="flex items-center justify-between gap-2">
                              <span className="font-display font-bold text-sm text-white">
                                {t.badge || '🏸'} {t.name}
                              </span>
                              {t.token && (
                                <span className="text-[10px] font-mono text-slate-400">
                                  #{t.token}
                                </span>
                              )}
                            </div>
                            <p className="text-xs text-amber-200/90 font-medium">
                              {roster || 'No players linked'}
                            </p>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {snapshot.players.length > 0 && (
                    <div className="overflow-x-auto rounded-xl border border-white/10">
                      <table className="w-full text-left text-xs text-slate-300">
                        <thead className="text-[11px] uppercase font-bold text-slate-400 bg-slate-950/70 border-b border-white/10">
                          <tr>
                            <th className="px-4 py-2.5">Player</th>
                            <th className="px-4 py-2.5">Skill</th>
                            <th className="px-4 py-2.5">Category</th>
                            <th className="px-4 py-2.5">Status</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5">
                          {snapshot.players.map((p) => (
                            <tr key={p.id}>
                              <td className="px-4 py-2.5 font-semibold text-white">{p.name}</td>
                              <td className="px-4 py-2.5">{p.skillLevel}</td>
                              <td className="px-4 py-2.5">{p.category || '-'}</td>
                              <td className="px-4 py-2.5 text-slate-400">
                                {p.registrationStatus || 'direct'}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}

              {archiveTab === 'matches' && (
                <div className="space-y-6">
                  {snapshot.knockout?.matches && snapshot.knockout.matches.length > 0 && (
                    <div className="space-y-2.5">
                      <h4 className="text-xs font-mono font-bold uppercase tracking-wider text-amber-300">
                        Knockout & Final Results
                      </h4>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {snapshot.knockout.matches.map((ko) => {
                          const label = getPlayoffMatchDisplayLabel(
                            ko,
                            snapshot.knockout.format
                          ).title;
                          const nameA = (ko.teamA && teamLookup.get(ko.teamA)?.name) || 'TBD';
                          const nameB = (ko.teamB && teamLookup.get(ko.teamB)?.name) || 'TBD';
                          const winnerName = ko.winner ? teamLookup.get(ko.winner)?.name : undefined;
                          return (
                            <div
                              key={ko.id}
                              className="rounded-xl border border-amber-400/25 bg-slate-950/70 p-4 space-y-1.5"
                            >
                              <div className="flex items-center justify-between text-[11px] font-mono text-amber-300">
                                <span className="font-bold uppercase">{label}</span>
                                <span className="uppercase text-slate-400">{ko.status}</span>
                              </div>
                              <div className="flex items-center justify-between text-sm font-bold text-white">
                                <span>{nameA}</span>
                                <span className="font-mono text-amber-300 tabular-nums">
                                  {ko.scoreA ?? 0} – {ko.scoreB ?? 0}
                                </span>
                                <span>{nameB}</span>
                              </div>
                              {winnerName && (
                                <p className="text-[11px] text-emerald-300 font-semibold">
                                  Winner: {winnerName}
                                </p>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  <div className="space-y-2.5">
                    <h4 className="text-xs font-mono font-bold uppercase tracking-wider text-slate-400">
                      League Fixtures ({snapshot.matches.length})
                    </h4>
                    {snapshot.matches.length === 0 ? (
                      <p className="text-sm text-slate-400 py-4">No league matches recorded.</p>
                    ) : (
                      <div className="overflow-x-auto rounded-xl border border-white/10">
                        <table className="w-full text-left text-xs text-slate-300">
                          <thead className="text-[11px] uppercase font-bold text-slate-400 bg-slate-950/70 border-b border-white/10">
                            <tr>
                              <th className="px-4 py-2.5">Round</th>
                              <th className="px-4 py-2.5">Matchup</th>
                              <th className="px-4 py-2.5 text-center">Score</th>
                              <th className="px-4 py-2.5">Winner</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-white/5">
                            {snapshot.matches.map((m) => {
                              const nameA = teamLookup.get(m.teamA)?.name || m.teamA;
                              const nameB = teamLookup.get(m.teamB)?.name || m.teamB;
                              const win = m.winner ? teamLookup.get(m.winner)?.name || m.winner : '-';
                              return (
                                <tr key={m.id}>
                                  <td className="px-4 py-2.5 font-mono text-slate-400">
                                    R{m.round} · C{m.court}
                                  </td>
                                  <td className="px-4 py-2.5 font-semibold text-white">
                                    {nameA} vs {nameB}
                                  </td>
                                  <td className="px-4 py-2.5 text-center font-mono font-bold text-amber-300 tabular-nums">
                                    {m.scoreA ?? 0} – {m.scoreB ?? 0}
                                  </td>
                                  <td className="px-4 py-2.5 text-emerald-300 font-semibold">{win}</td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {archiveTab === 'registrations' && (
                snapshot.registrations.length === 0 ? (
                  <p className="text-sm text-slate-400 py-8 text-center">
                    No registrations recorded for this season.
                  </p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs text-slate-300">
                      <thead className="text-[11px] uppercase font-bold text-slate-400 bg-slate-950/70 border-b border-white/10">
                        <tr>
                          <th className="px-4 py-3">Reg ID</th>
                          <th className="px-4 py-3">Athlete</th>
                          <th className="px-4 py-3">Category</th>
                          <th className="px-4 py-3">Fee (₹)</th>
                          <th className="px-4 py-3">Payment</th>
                          <th className="px-4 py-3">Approval</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/5">
                        {snapshot.registrations.map((r) => (
                          <tr key={r.id}>
                            <td className="px-4 py-3 font-mono text-slate-400">{r.regId}</td>
                            <td className="px-4 py-3 font-semibold text-white">{r.name}</td>
                            <td className="px-4 py-3">{r.category || '-'}</td>
                            <td className="px-4 py-3 font-mono tabular-nums">₹{r.paidAmount ?? r.fee ?? 0}</td>
                            <td className="px-4 py-3">
                              <span
                                className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase ${
                                  r.paymentStatus === 'paid' || r.status === 'paid'
                                    ? 'bg-emerald-500/15 text-emerald-300'
                                    : 'bg-slate-800 text-slate-300'
                                }`}
                              >
                                {r.paymentStatus || (r.status === 'paid' ? 'paid' : 'unpaid')}
                              </span>
                            </td>
                            <td className="px-4 py-3 font-mono uppercase text-[11px]">
                              {r.status}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
