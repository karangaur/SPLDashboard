import React, { useState, useRef, useEffect, useMemo } from 'react';
import {
  Dices,
  Users2,
  Crown,
  Lock,
  Unlock,
  Shuffle,
  Volume2,
  VolumeX,
  Share2,
  Copy,
  Trash2,
  Plus,
  Sparkles,
  ArrowRight,
  CheckCircle,
} from 'lucide-react';
import { useTournament, sportsAudio } from '../../context/TournamentContext';
import { ConfirmModal } from '../common/ConfirmModal';
import { RandomCaptainsModal } from '../common/RandomCaptainsModal';
import { Team } from '../../types/tournament';

const TOKEN_LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');
const GRADIENT_PALETTES = [
  'from-rose-500 to-pink-600',
  'from-amber-500 to-orange-600',
  'from-emerald-500 to-green-600',
  'from-sky-500 to-blue-600',
  'from-violet-500 to-purple-600',
  'from-fuchsia-500 to-pink-600',
  'from-teal-500 to-cyan-600',
  'from-indigo-500 to-blue-600',
];

const getTokenLabel = (index: number): string =>
  index < TOKEN_LETTERS.length ? TOKEN_LETTERS[index] : `${index + 1}`;

export const TokensView: React.FC = () => {
  const {
    state,
    setTeams,
    clearTeams,
    setTeamFormationMode,
    addPredefinedTeam,
    deletePredefinedTeam,
    toggleTeamLock,
    setCaptainsBulk,
    generateFixtures,
    triggerCelebration,
  } = useTournament();

  // Deduplicated existing registered teams (authoritative eligible team list)
  const existingTeams = useMemo(() => {
    const map = new Map<string, Team>();
    for (const t of state.teams) {
      if (t && t.id && !map.has(t.id)) {
        map.set(t.id, t);
      }
    }
    return Array.from(map.values());
  }, [state.teams]);

  const eligibleTeamCount = existingTeams.length;

  const [soundEnabled, setSoundEnabled] = useState(true);
  const [numTeams, setNumTeams] = useState<number>(() => Math.max(1, state.teams.length || 4));
  const [playersPerTeam, setPlayersPerTeam] = useState(2);
  const [isDrawing, setIsDrawing] = useState(false);
  const [spinningSlotNames, setSpinningSlotNames] = useState<string[]>([]);
  const [showClearConfirm, setShowClearConfirm] = useState(false);

  // Synchronous ref locks to prevent duplicate/concurrent spin executions
  const isSpinningRef = useRef(false);
  const spinIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Keep numTeams synchronized with actual registered teams count
  useEffect(() => {
    if (eligibleTeamCount > 0) {
      setNumTeams(eligibleTeamCount);
    }
  }, [eligibleTeamCount]);

  // Cleanup any active spin interval on unmount
  useEffect(() => {
    return () => {
      if (spinIntervalRef.current) {
        clearInterval(spinIntervalRef.current);
        spinIntervalRef.current = null;
      }
      isSpinningRef.current = false;
    };
  }, []);

  // Pre-decided pairs form
  const [pairName, setPairName] = useState('');
  const [pairP1, setPairP1] = useState('');
  const [pairP2, setPairP2] = useState('');

  // Captain slots & selection modal
  const [selectedCaptains, setSelectedCaptains] = useState<string[]>([]);
  const [isCaptainModalOpen, setIsCaptainModalOpen] = useState(false);
  const [toastMsg, setToastMsg] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  const showNotice = (text: string, type: 'success' | 'error' = 'error') => {
    setToastMsg({ text, type });
    setTimeout(() => setToastMsg(null), 4000);
  };

  const eligiblePlayers = state.players;
  const maxPossibleTeams = Math.max(2, Math.floor(eligiblePlayers.length / playersPerTeam));

  // Open interactive Random Captains Modal with preview, draw again, and edit controls
  const handleRandomCaptains = () => {
    const requiredCaptains = eligibleTeamCount > 0 ? eligibleTeamCount : numTeams;
    if (eligiblePlayers.length < requiredCaptains) {
      showNotice(
        `Need at least ${requiredCaptains} registered players to draw captains, but only ${eligiblePlayers.length} are available.`,
        'error'
      );
      return;
    }
    setIsCaptainModalOpen(true);
  };

  const handleConfirmCaptainsFromModal = (assignments: { teamId: string; captainId: string }[]) => {
    if (existingTeams.length > 0) {
      setCaptainsBulk(assignments);
      showNotice(`Updated captains for ${assignments.length} registered team(s).`, 'success');
    }
    setSelectedCaptains(assignments.map((a) => a.captainId));
    setIsCaptainModalOpen(false);
  };

  // Run lottery draw animation exclusively for existing registered teams
  const handleRunLotteryDraw = () => {
    // Prevent concurrent/duplicate spins
    if (isSpinningRef.current || isDrawing) {
      return;
    }

    if (eligibleTeamCount === 0) {
      showNotice(
        'No eligible teams found. Please register or create teams first before generating tokens.',
        'error'
      );
      return;
    }

    isSpinningRef.current = true;
    setIsDrawing(true);

    const snapshotTeams = [...existingTeams];
    const totalCount = snapshotTeams.length;
    const tokenPool = Array.from({ length: totalCount }, (_, i) => getTokenLabel(i));

    let iterations = 0;
    const maxIterations = 20;

    if (spinIntervalRef.current) {
      clearInterval(spinIntervalRef.current);
    }

    spinIntervalRef.current = setInterval(() => {
      iterations++;
      if (soundEnabled) sportsAudio.playScorePing();

      // Show spinning preview of existing teams and candidate tokens
      const previewSlots = snapshotTeams.slice(0, 4).map((t) => {
        const randTok = tokenPool[Math.floor(Math.random() * tokenPool.length)] || 'A';
        return `Token ${randTok} · ${t.name}`;
      });
      setSpinningSlotNames(previewSlots);

      if (iterations >= maxIterations) {
        if (spinIntervalRef.current) {
          clearInterval(spinIntervalRef.current);
          spinIntervalRef.current = null;
        }
        finalizeTokenAssignment(snapshotTeams);
      }
    }, 90);
  };

  // Strictly assign 1 unique token per existing eligible team without ever changing team count or IDs
  const finalizeTokenAssignment = (fallbackTeams?: Team[]) => {
    try {
      const targetTeams = existingTeams.length > 0 ? existingTeams : fallbackTeams || [];
      const count = targetTeams.length;

      if (count === 0) {
        setIsDrawing(false);
        isSpinningRef.current = false;
        showNotice('No eligible teams available for token generation.', 'error');
        return;
      }

      // Generate exact N unique tokens for the N existing teams
      const allTokens = Array.from({ length: count }, (_, idx) => getTokenLabel(idx));
      const validTokenSet = new Set(allTokens);

      // Check if there is a partial lock (some teams locked with valid unique tokens, some unlocked)
      const hasUnlockedTeams = targetTeams.some((t) => !t.locked);
      const reservedTokens = new Set<string>();
      const lockedTokenByTeamId = new Map<string, string>();

      if (hasUnlockedTeams) {
        for (const t of targetTeams) {
          if (t.locked && t.token && validTokenSet.has(t.token) && !reservedTokens.has(t.token)) {
            reservedTokens.add(t.token);
            lockedTokenByTeamId.set(t.id, t.token);
          }
        }
      }

      // Remaining tokens to shuffle across unlocked (or all) teams
      const availableTokens = allTokens.filter((tok) => !reservedTokens.has(tok));

      // Unbiased Fisher-Yates shuffle
      for (let i = availableTokens.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [availableTokens[i], availableTokens[j]] = [availableTokens[j], availableTokens[i]];
      }

      // Guarantee that when regenerating with 2+ unlocked teams, the token order changes if possible
      if (availableTokens.length > 1) {
        const unlockedTeams = targetTeams.filter((t) => !lockedTokenByTeamId.has(t.id));
        const isIdenticalToCurrent = unlockedTeams.every(
          (t, i) => t.token && t.token === availableTokens[i]
        );
        if (isIdenticalToCurrent) {
          // Rotate by 1 position so regeneration produces a fresh permutation
          const first = availableTokens.shift()!;
          availableTokens.push(first);
        }
      }

      let cursor = 0;
      const updatedTeams: Team[] = targetTeams.map((team, idx) => {
        const assignedToken = lockedTokenByTeamId.get(team.id) || availableTokens[cursor++];
        const tokenIndex = Math.max(0, TOKEN_LETTERS.indexOf(assignedToken));
        return {
          ...team,
          id: team.id, // Strictly preserve existing team ID
          name: team.name, // Strictly preserve existing team name
          players: [...team.players], // Strictly preserve existing team roster
          captainId: team.captainId,
          locked: Boolean(team.locked),
          badge: team.badge || '🏸',
          avatarColor:
            team.avatarColor || GRADIENT_PALETTES[(tokenIndex >= 0 ? tokenIndex : idx) % GRADIENT_PALETTES.length],
          token: assignedToken,
        };
      });

      setTeams(updatedTeams);
      triggerCelebration();
      showNotice(
        `Successfully generated ${updatedTeams.length} unique token${
          updatedTeams.length === 1 ? '' : 's'
        } for ${updatedTeams.length} existing team${updatedTeams.length === 1 ? '' : 's'}.`,
        'success'
      );
    } catch (err) {
      showNotice('Failed to generate tokens. Please try again.', 'error');
    } finally {
      setIsDrawing(false);
      isSpinningRef.current = false;
    }
  };

  // Apply Pre-Decided Locked Pairs without creating duplicate teams
  const handleApplyLockedPairs = () => {
    if (state.predefinedTeams.length === 0) {
      showNotice('No locked pairs to apply.', 'error');
      return;
    }

    const updatedTeams: Team[] = state.predefinedTeams.map((pt, idx) => {
      // Reuse existing team ID if this predefined pair was already applied
      const existingMatch = existingTeams.find(
        (t) =>
          t.id === pt.id ||
          (t.players.length === pt.players.length &&
            pt.players.every((pid) => t.players.includes(pid)))
      );
      return {
        id: existingMatch?.id || pt.id,
        name: pt.name || existingMatch?.name || `Team ${getTokenLabel(idx)}`,
        players: [...pt.players],
        captainId: existingMatch?.captainId || pt.players[0],
        locked: true,
        badge: existingMatch?.badge || '🏸',
        avatarColor: existingMatch?.avatarColor || GRADIENT_PALETTES[idx % GRADIENT_PALETTES.length],
        token: existingMatch?.token || getTokenLabel(idx),
      };
    });

    setTeams(updatedTeams);
    triggerCelebration();
    showNotice(
      `Applied ${updatedTeams.length} locked pair${updatedTeams.length === 1 ? '' : 's'} with ${
        updatedTeams.length
      } assigned token${updatedTeams.length === 1 ? '' : 's'}.`,
      'success'
    );
  };

  const handleAddPredefinedPair = (e: React.FormEvent) => {
    e.preventDefault();
    if (!pairP1 || !pairP2) {
      showNotice('Please select both players for the doubles pair.', 'error');
      return;
    }
    if (pairP1 === pairP2) {
      showNotice('A player cannot pair with themselves.', 'error');
      return;
    }

    const p1Name = state.players.find((p) => p.id === pairP1)?.name.split(' ')[0] || 'P1';
    const p2Name = state.players.find((p) => p.id === pairP2)?.name.split(' ')[0] || 'P2';
    const autoName = pairName.trim() || `${p1Name} & ${p2Name}`;

    addPredefinedTeam(autoName, pairP1, pairP2);
    setPairName('');
    setPairP1('');
    setPairP2('');
  };

  const formatTeamsShareText = () => {
    const lines = [
      `🏸 ${state.settings.name} — Official Token Draw Teams`,
      `Date: ${state.settings.date}`,
      '----------------------------------------',
    ];

    existingTeams.forEach((t, idx) => {
      const pNames = t.players
        .map((pid) => {
          const p = state.players.find((item) => item.id === pid);
          return `${p?.name || 'Unknown'}${t.captainId === pid ? ' 👑 (Captain)' : ''}`;
        })
        .join(' + ');

      const tokenLabel = t.token || getTokenLabel(idx);
      lines.push(`Token ${tokenLabel}: ${t.name}`);
      lines.push(`  Squad: ${pNames || 'Unassigned'}`);
    });

    return lines.join('\n');
  };

  const handleShare = () => {
    const text = formatTeamsShareText();
    const url = `https://wa.me/?text=${encodeURIComponent(text)}`;
    window.open(url, '_blank');
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(formatTeamsShareText());
      showNotice('Teams copied to clipboard!', 'success');
    } catch {}
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {toastMsg && (
        <div
          role="status"
          className={`flex items-center justify-between gap-3 px-4 py-3 rounded-xl text-xs font-semibold animate-fade-in border ${
            toastMsg.type === 'success'
              ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-300'
              : 'bg-rose-500/15 border-rose-500/30 text-rose-300'
          }`}
        >
          <span>{toastMsg.text}</span>
          <button
            onClick={() => setToastMsg(null)}
            className="text-current opacity-75 hover:opacity-100 px-1"
            aria-label="Dismiss notification"
          >
            ✕
          </button>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-500/20 text-amber-400 font-bold text-xl">
              🎲
            </span>
            <h1 className="font-display text-2xl sm:text-3xl font-black text-white">
              Token Lottery Draw
            </h1>
          </div>
          <p className="mt-1 text-xs sm:text-sm text-slate-400">
            Automated doubles team draw, captain selection, and pre-decided pairs locking.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setSoundEnabled((s) => !s)}
            className="p-2 text-slate-400 hover:text-white bg-white/5 hover:bg-white/10 rounded-xl transition-colors border border-white/5"
            title={soundEnabled ? 'Mute Sound Effects' : 'Enable Sound Effects'}
            aria-label={soundEnabled ? 'Mute Sound Effects' : 'Enable Sound Effects'}
          >
            {soundEnabled ? <Volume2 className="w-4 h-4 text-amber-400" /> : <VolumeX className="w-4 h-4" />}
          </button>

          {state.teams.length > 0 && (
            <>
              <button
                onClick={handleCopy}
                className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-200 hover:text-white bg-white/10 hover:bg-white/15 rounded-xl transition-colors border border-white/10"
              >
                <Copy className="w-4 h-4 text-amber-400" />
                <span>Copy</span>
              </button>
              <button
                onClick={handleShare}
                className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-emerald-400 bg-emerald-500/10 hover:bg-emerald-500/20 rounded-xl transition-colors border border-emerald-500/20"
              >
                <Share2 className="w-4 h-4" />
                <span>WhatsApp</span>
              </button>
              <button
                onClick={() => setShowClearConfirm(true)}
                className="p-2 text-slate-400 hover:text-rose-400 bg-white/5 hover:bg-rose-500/10 rounded-xl transition-colors border border-white/5"
                title="Clear Teams"
                aria-label="Clear Teams"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </>
          )}
        </div>
      </div>

      {/* Mode Selector Tabs */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-2 rounded-2xl glass-panel">
        {[
          {
            id: 'random',
            label: 'Random Formation',
            desc: 'Draw balanced pairs randomly from the pool',
            icon: '🎲',
          },
          {
            id: 'predefined',
            label: 'Pre-Decided Teams',
            desc: 'Use locked pairs only (no random shuffle)',
            icon: '🔒',
          },
          {
            id: 'mixed',
            label: 'Mixed Mode',
            desc: 'Lock designated pairs + shuffle remaining',
            icon: '⚡',
          },
        ].map((m) => (
          <button
            key={m.id}
            onClick={() => setTeamFormationMode(m.id as any)}
            className={`text-left p-3.5 rounded-xl transition-all border ${
              state.teamFormationMode === m.id
                ? 'bg-amber-500/15 border-amber-500/40 shadow-md'
                : 'bg-white/5 border-transparent hover:bg-white/10'
            }`}
          >
            <div className="flex items-center gap-2 mb-1">
              <span className="text-lg">{m.icon}</span>
              <span className="font-bold text-sm text-white">{m.label}</span>
            </div>
            <p className="text-xs text-slate-400 leading-relaxed">{m.desc}</p>
          </button>
        ))}
      </div>

      {/* Mode 1: Random Draw Control Center */}
      {state.teamFormationMode === 'random' && (
        <div className="rounded-2xl glass-card p-6 border border-white/10 space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
            {/* Eligible Registered Teams Count (Strict 1:1 with Registered Teams) */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-1.5">
                Registered Eligible Teams
              </label>
              <input
                type="number"
                readOnly
                value={eligibleTeamCount}
                aria-label="Registered Eligible Teams"
                className="w-full bg-slate-900/80 border border-white/10 rounded-xl px-3 py-2 text-amber-400 font-mono font-bold cursor-not-allowed"
              />
              <p className="text-[11px] text-slate-400 mt-2">
                {eligibleTeamCount > 0
                  ? `${eligibleTeamCount} existing team${eligibleTeamCount === 1 ? '' : 's'} → generates ${eligibleTeamCount} unique token${eligibleTeamCount === 1 ? '' : 's'}`
                  : 'No registered teams yet — add teams in Teams tab first'}
              </p>
            </div>

            {/* Players Per Team */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-1.5">
                Players Per Team
              </label>
              <select
                value={playersPerTeam}
                onChange={(e) => setPlayersPerTeam(parseInt(e.target.value, 10) || 2)}
                className="w-full bg-slate-900 border border-white/10 rounded-xl px-3 py-2 text-white text-sm"
              >
                <option value={2}>2 (Standard Doubles)</option>
                <option value={3}>3 (Triples Squad)</option>
              </select>
              <p className="text-[11px] text-slate-400 mt-2">
                {eligibleTeamCount} team{eligibleTeamCount === 1 ? '' : 's'} registered · {eligiblePlayers.length} players in pool
              </p>
            </div>

            {/* Draw Actions */}
            <div className="flex flex-col justify-end gap-2">
              <button
                type="button"
                onClick={handleRandomCaptains}
                disabled={isDrawing || eligibleTeamCount === 0}
                className="w-full py-2 px-3 text-xs font-semibold text-slate-200 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl transition-colors flex items-center justify-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Crown className="w-3.5 h-3.5 text-amber-400" />
                <span>Draw Random Captains</span>
              </button>

              <button
                type="button"
                onClick={handleRunLotteryDraw}
                disabled={isDrawing}
                className="w-full py-2.5 px-4 text-sm font-bold text-slate-950 bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 rounded-xl shadow-lg shadow-amber-500/25 active:scale-95 transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Dices className={`w-4 h-4 ${isDrawing ? 'animate-spin' : ''}`} />
                <span>
                  {isDrawing
                    ? `Drawing ${eligibleTeamCount} Token${eligibleTeamCount === 1 ? '' : 's'}...`
                    : 'Spin & Generate Tokens'}
                </span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Mode 2: Pre-Decided Pairs */}
      {(state.teamFormationMode === 'predefined' || state.teamFormationMode === 'mixed') && (
        <div className="rounded-2xl glass-card p-6 border border-white/10 space-y-6">
          <div className="flex items-center justify-between pb-3 border-b border-white/10">
            <div>
              <h3 className="font-bold text-white text-base">Lock Pre-Decided Doubles Pairs</h3>
              <p className="text-xs text-slate-400">
                Fixed doubles pairs will stay together and form official tournament teams.
              </p>
            </div>
          </div>

          <form onSubmit={handleAddPredefinedPair} className="grid grid-cols-1 sm:grid-cols-4 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1">Pair Name (Optional)</label>
              <input
                type="text"
                placeholder="e.g. Falcon Duo"
                value={pairName}
                onChange={(e) => setPairName(e.target.value)}
                className="w-full bg-slate-900 border border-white/10 rounded-xl px-3 py-2 text-xs text-white"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1">Player 1</label>
              <select
                value={pairP1}
                onChange={(e) => setPairP1(e.target.value)}
                className="w-full bg-slate-900 border border-white/10 rounded-xl px-3 py-2 text-xs text-white"
                required
              >
                <option value="">Select Player 1</option>
                {state.players.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1">Player 2</label>
              <select
                value={pairP2}
                onChange={(e) => setPairP2(e.target.value)}
                className="w-full bg-slate-900 border border-white/10 rounded-xl px-3 py-2 text-xs text-white"
                required
              >
                <option value="">Select Player 2</option>
                {state.players
                  .filter((p) => p.id !== pairP1)
                  .map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
              </select>
            </div>
            <div className="flex items-end">
              <button
                type="submit"
                className="w-full py-2 px-3 text-xs font-bold bg-emerald-500 hover:bg-emerald-400 text-slate-950 rounded-xl transition-all shadow"
              >
                + Lock Pair
              </button>
            </div>
          </form>

          {/* Locked Pairs List */}
          <div className="space-y-2">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
              Locked Pairs ({state.predefinedTeams.length})
            </span>
            {state.predefinedTeams.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {state.predefinedTeams.map((pt) => {
                  const p1 = state.players.find((p) => p.id === pt.players[0]);
                  const p2 = state.players.find((p) => p.id === pt.players[1]);

                  return (
                    <div
                      key={pt.id}
                      className="rounded-xl bg-white/5 border border-white/10 p-3 flex items-center justify-between"
                    >
                      <div className="min-w-0">
                        <span className="font-bold text-white text-xs truncate block">{pt.name}</span>
                        <span className="text-[11px] text-slate-400 truncate block">
                          {p1?.name || 'P1'} + {p2?.name || 'P2'}
                        </span>
                      </div>
                      <button
                        onClick={() => deletePredefinedTeam(pt.id)}
                        className="text-slate-500 hover:text-rose-400 p-1"
                      >
                        ✕
                      </button>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-xs text-slate-500 italic">No locked pairs yet.</p>
            )}

            <div className="pt-3 flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={handleApplyLockedPairs}
                disabled={state.predefinedTeams.length === 0 || isDrawing}
                className="px-5 py-2.5 text-xs font-bold text-slate-950 bg-amber-400 hover:bg-amber-300 rounded-xl shadow transition-all disabled:opacity-50"
              >
                Apply Locked Pairs as Tournament Teams
              </button>

              {eligibleTeamCount > 0 && (
                <button
                  type="button"
                  onClick={handleRunLotteryDraw}
                  disabled={isDrawing}
                  className="px-5 py-2.5 text-xs font-bold text-slate-950 bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 rounded-xl shadow transition-all flex items-center gap-2 disabled:opacity-50"
                >
                  <Dices className={`w-4 h-4 ${isDrawing ? 'animate-spin' : ''}`} />
                  <span>
                    {isDrawing
                      ? `Drawing ${eligibleTeamCount} Token${eligibleTeamCount === 1 ? '' : 's'}...`
                      : `Spin & Generate Tokens (${eligibleTeamCount} Team${eligibleTeamCount === 1 ? '' : 's'})`}
                  </span>
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Lottery Spinning Machine Display during draw */}
      {isDrawing && (
        <div className="rounded-3xl glass-card p-8 border border-amber-500/40 text-center space-y-4 gold-glow animate-pulse">
          <span className="text-xs font-bold uppercase tracking-[0.25em] text-amber-400 block">
            Spinning Tournament Lottery Wheels ({eligibleTeamCount} Eligible Team{eligibleTeamCount === 1 ? '' : 's'})
          </span>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 max-w-xl mx-auto">
            {spinningSlotNames.map((name, idx) => (
              <div
                key={idx}
                className="p-4 rounded-2xl bg-amber-500/20 border border-amber-500/40 text-white font-bold text-sm truncate shadow"
              >
                <div className="text-2xl mb-1">🏸</div>
                {name}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Generated Teams Grid */}
      {existingTeams.length > 0 && !isDrawing && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <h3 className="font-display text-xl font-bold text-white flex items-center gap-2">
              <span>🏸</span>
              <span>Generated Tournament Tokens ({existingTeams.length} Teams)</span>
            </h3>
            <button
              onClick={() => {
                generateFixtures();
                showNotice('Round-robin match schedule auto-generated for these teams!', 'success');
              }}
              className="text-xs font-bold text-amber-400 hover:underline self-start sm:self-auto"
            >
              Generate Match Schedule from These Teams →
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {existingTeams.map((team, idx) => {
              const letter = team.token || getTokenLabel(idx);
              const gradient = team.avatarColor || GRADIENT_PALETTES[idx % GRADIENT_PALETTES.length];

              return (
                <div
                  key={team.id}
                  className="rounded-2xl glass-card border border-white/10 overflow-hidden shadow-xl space-y-3"
                >
                  {/* Card Header Strip */}
                  <div className={`p-4 bg-gradient-to-r ${gradient} text-white space-y-1`}>
                    <div className="flex items-center justify-between text-[11px] font-bold uppercase tracking-wider opacity-85">
                      <span>Token {letter}</span>
                      <span>{team.badge || '🏸'}</span>
                    </div>
                    <h4 className="font-display font-black text-lg truncate">{team.name}</h4>
                  </div>

                  {/* Player Roster */}
                  <div className="p-4 pt-1 space-y-2 text-xs">
                    {team.players.map((pid) => {
                      const p = state.players.find((item) => item.id === pid);
                      const isCap = team.captainId === pid;

                      return (
                        <div
                          key={pid}
                          className={`flex items-center justify-between p-2 rounded-xl ${
                            isCap ? 'bg-amber-500/10 border border-amber-500/30' : 'bg-white/5'
                          }`}
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-white/10 font-bold text-[10px] text-white">
                              {p?.name.slice(0, 2).toUpperCase() || '??'}
                            </span>
                            <span className="font-semibold text-white truncate">
                              {p?.name || 'Unnamed Player'}
                            </span>
                          </div>
                          {isCap && (
                            <span className="text-[10px] font-bold text-amber-400 flex items-center gap-0.5">
                              <Crown className="w-3 h-3 text-amber-400" />
                              <span>C</span>
                            </span>
                          )}
                        </div>
                      );
                    })}

                    <div className="pt-2 flex items-center justify-between text-[11px] text-slate-400">
                      <button
                        onClick={() => toggleTeamLock(team.id)}
                        className={`flex items-center gap-1 font-semibold ${
                          team.locked ? 'text-amber-400' : 'text-slate-500 hover:text-slate-300'
                        }`}
                      >
                        {team.locked ? <Lock className="w-3 h-3" /> : <Unlock className="w-3 h-3" />}
                        <span>{team.locked ? 'Locked' : 'Unlocked'}</span>
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Clear Confirmation */}
      <ConfirmModal
        isOpen={showClearConfirm}
        title="Clear Generated Teams"
        message="Are you sure you want to clear all tournament teams? Players and registrations will not be affected."
        confirmLabel="Clear Teams"
        variant="danger"
        onConfirm={() => {
          clearTeams();
          setShowClearConfirm(false);
        }}
        onCancel={() => setShowClearConfirm(false)}
      />

      {/* Random Captains Modal */}
      <RandomCaptainsModal
        isOpen={isCaptainModalOpen}
        onClose={() => setIsCaptainModalOpen(false)}
        teams={state.teams}
        players={eligiblePlayers}
        numTeamsFallback={numTeams}
        onConfirmCaptains={handleConfirmCaptainsFromModal}
      />
    </div>
  );
};
