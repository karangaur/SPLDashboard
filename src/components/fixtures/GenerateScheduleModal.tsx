import React, { useState, useMemo } from 'react';
import {
  AlertTriangle,
  RefreshCw,
  X,
  Layers,
  ChevronDown,
  ChevronUp,
  Sliders,
  Check,
  Calendar,
  Sparkles,
} from 'lucide-react';
import { useTournament } from '../../context/TournamentContext';
import { generateRoundRobinFixtures } from '../../utils/tournamentEngine';

interface GenerateScheduleModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: (count: number) => void;
  onOpenScheduleEditor?: () => void;
}

export const GenerateScheduleModal: React.FC<GenerateScheduleModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  onOpenScheduleEditor,
}) => {
  const { state, generateFixtures } = useTournament();

  const initialCourts = state.settings.courts || 1;
  const [courtCount, setCourtCount] = useState<number>(initialCourts);
  const [isCustom, setIsCustom] = useState<boolean>(initialCourts > 4);
  const [customCourtInput, setCustomCourtInput] = useState<string>(String(initialCourts));

  // Dynamic court names
  const [courtNames, setCourtNames] = useState<string[]>(() => {
    const existing = state.settings.courtNames || [];
    const count = initialCourts;
    return Array.from({ length: count }, (_, i) => existing[i]?.trim() || `Court ${i + 1}`);
  });

  const [showPreview, setShowPreview] = useState<boolean>(true);
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Update court count and maintain court names
  const handleCourtSelect = (count: number) => {
    const validCount = Math.max(1, Math.min(16, count));
    setCourtCount(validCount);
    setIsCustom(validCount > 4);
    setCustomCourtInput(String(validCount));

    setCourtNames((prev) => {
      return Array.from({ length: validCount }, (_, i) => {
        return prev[i]?.trim() || `Court ${i + 1}`;
      });
    });
  };

  const handleCourtNameChange = (index: number, newName: string) => {
    setCourtNames((prev) => {
      const next = [...prev];
      next[index] = newName;
      return next;
    });
  };

  const applyPresetNames = (preset: 'numeric' | 'alpha' | 'arena') => {
    const nextNames = Array.from({ length: courtCount }, (_, i) => {
      if (preset === 'alpha') {
        const letter = String.fromCharCode(65 + i);
        return `Court ${letter}`;
      }
      if (preset === 'arena') {
        return i === 0 ? 'Main Centre Court' : `Arena Court ${i + 1}`;
      }
      return `Court ${i + 1}`;
    });
    setCourtNames(nextNames);
  };

  // Preview generated fixtures live in modal
  const previewMatches = useMemo(() => {
    if (state.teams.length < 2) return [];
    return generateRoundRobinFixtures(state.teams, courtCount, courtNames);
  }, [state.teams, courtCount, courtNames]);

  const teamsCount = state.teams.length;
  const estimatedMatches =
    teamsCount >= 2 ? Math.floor((teamsCount * (teamsCount - 1)) / 2) : 0;
  const estimatedRounds =
    teamsCount >= 2 ? (teamsCount % 2 === 0 ? teamsCount - 1 : teamsCount) : 0;

  // Existing schedule checks
  const existingMatchesCount = state.matches.length;
  const liveMatchesCount = state.matches.filter((m) => m.status === 'live').length;
  const completedMatchesCount = state.matches.filter((m) => m.status === 'completed').length;
  const hasActiveScores = liveMatchesCount > 0 || completedMatchesCount > 0;

  const handleGenerate = async () => {
    if (teamsCount < 2) {
      setErrorMsg('At least 2 eligible teams are required to generate a match schedule.');
      return;
    }
    setErrorMsg(null);
    setIsGenerating(true);

    try {
      const cleanNames = courtNames.map((name, i) => (name.trim() ? name.trim() : `Court ${i + 1}`));
      const result = await generateFixtures({
        courts: courtCount,
        courtNames: cleanNames,
      });

      if (!result.success) {
        setErrorMsg(result.error || 'Failed to replace schedule. Please try again.');
        setIsGenerating(false);
        return;
      }

      setIsGenerating(false);
      onClose();
      if (onSuccess) {
        onSuccess(result.count || previewMatches.length);
      }
    } catch (err: any) {
      setErrorMsg(err?.message || 'Failed to replace match schedule.');
      setIsGenerating(false);
    }
  };

  if (!isOpen) return null;

  const getTeamName = (id: string) => {
    const t = state.teams.find((team) => team.id === id);
    return t ? t.name : id;
  };

  const getTeamBadge = (id: string) => {
    const t = state.teams.find((team) => team.id === id);
    return t?.badge || '🏸';
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-md animate-fade-in overflow-y-auto">
      <div className="relative w-full max-w-2xl my-auto rounded-3xl glass-panel bg-slate-950/95 border border-white/15 shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="px-5 sm:px-7 py-4 sm:py-5 border-b border-white/10 flex items-center justify-between shrink-0 bg-gradient-to-r from-amber-500/10 via-transparent to-transparent">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-400 to-amber-600 text-slate-950 font-black text-xl shadow-lg shadow-amber-500/20 shrink-0">
              🏸
            </span>
            <div>
              <h2 className="font-display text-lg sm:text-xl font-black text-white tracking-wide">
                Generate Match Schedule
              </h2>
              <p className="text-xs text-slate-400 truncate max-w-[260px] sm:max-w-md">
                {state.settings.name} · {state.settings.season || 'Season IV'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={isGenerating}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-white/10 transition-colors disabled:opacity-50"
            aria-label="Close schedule generation modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Body */}
        <div className="px-5 sm:px-7 py-5 space-y-5 overflow-y-auto custom-scrollbar">
          {errorMsg && (
            <div className="p-3.5 rounded-2xl bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs font-semibold flex items-center justify-between animate-fade-in">
              <span>{errorMsg}</span>
              <button
                type="button"
                onClick={() => setErrorMsg(null)}
                className="ml-2 hover:opacity-100 opacity-70"
              >
                ✕
              </button>
            </div>
          )}

          {/* Warning Banner when replacing existing schedule */}
          {existingMatchesCount > 0 && (
            <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 space-y-2.5">
              <div className="flex items-start gap-2.5">
                <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
                <div className="space-y-1 text-xs flex-1">
                  <h4 className="font-bold text-amber-300">
                    Replace Existing Schedule ({existingMatchesCount} Matches)
                  </h4>
                  <p className="text-slate-300 leading-relaxed">
                    Generating a new schedule will permanently replace the existing matches and their
                    associated scores for this tournament. This action cannot be undone.
                  </p>
                  {hasActiveScores && (
                    <div className="pt-1 text-[11px] font-bold text-rose-400 flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-rose-500 animate-ping" />
                      <span>
                        Notice: {liveMatchesCount} live and {completedMatchesCount} finished match
                        results will be cleared upon replacement.
                      </span>
                    </div>
                  )}
                  {onOpenScheduleEditor && (
                    <div className="pt-2">
                      <button
                        type="button"
                        onClick={() => {
                          onClose();
                          onOpenScheduleEditor();
                        }}
                        className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 text-xs font-black shadow-md transition-all active:scale-95"
                      >
                        <span aria-hidden="true">✏️</span>
                        <span>Edit Existing Schedule Instead (Preserve Scores & Order)</span>
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Tournament Overview Stats Strip */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
            <div className="p-3 rounded-2xl bg-white/5 border border-white/5 space-y-0.5">
              <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                Eligible Teams
              </span>
              <p className="font-mono text-lg font-black text-white">{teamsCount}</p>
            </div>
            <div className="p-3 rounded-2xl bg-white/5 border border-white/5 space-y-0.5">
              <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                Matches Count
              </span>
              <p className="font-mono text-lg font-black text-amber-400">{estimatedMatches}</p>
            </div>
            <div className="p-3 rounded-2xl bg-white/5 border border-white/5 space-y-0.5">
              <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                Rounds
              </span>
              <p className="font-mono text-lg font-black text-emerald-400">{estimatedRounds}</p>
            </div>
            <div className="p-3 rounded-2xl bg-white/5 border border-white/5 space-y-0.5">
              <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                Format
              </span>
              <p className="font-mono text-xs font-bold text-slate-200 mt-1 truncate">
                {state.settings.format || '21'} Pts Rally
              </p>
            </div>
          </div>

          {/* Court Configuration Section */}
          <div className="space-y-3 p-4 rounded-2xl bg-slate-900/60 border border-white/10">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Sliders className="w-4 h-4 text-amber-400 shrink-0" />
                <h3 className="text-xs sm:text-sm font-bold text-white uppercase tracking-wider">
                  Number of Badminton Courts
                </h3>
              </div>
              <span className="text-[11px] font-mono text-slate-400">
                {courtCount} {courtCount === 1 ? 'Court' : 'Courts'} Active
              </span>
            </div>

            {/* Quick Court Select Buttons */}
            <div className="grid grid-cols-4 sm:grid-cols-5 gap-2">
              {[1, 2, 3, 4].map((num) => {
                const isSelected = !isCustom && courtCount === num;
                return (
                  <button
                    key={num}
                    type="button"
                    onClick={() => handleCourtSelect(num)}
                    className={`py-2 px-3 rounded-xl text-xs font-bold transition-all flex flex-col items-center justify-center min-h-[44px] ${
                      isSelected
                        ? 'bg-amber-400 text-slate-950 shadow-lg shadow-amber-400/20 scale-[1.02]'
                        : 'bg-white/5 hover:bg-white/10 text-slate-300 border border-white/5'
                    }`}
                  >
                    <span>{num} {num === 1 ? 'Court' : 'Courts'}</span>
                  </button>
                );
              })}

              <button
                type="button"
                onClick={() => {
                  setIsCustom(true);
                  const parsed = parseInt(customCourtInput, 10) || 5;
                  handleCourtSelect(parsed);
                }}
                className={`py-2 px-3 rounded-xl text-xs font-bold transition-all flex flex-col items-center justify-center min-h-[44px] col-span-4 sm:col-span-1 ${
                  isCustom
                    ? 'bg-amber-400 text-slate-950 shadow-lg shadow-amber-400/20 scale-[1.02]'
                    : 'bg-white/5 hover:bg-white/10 text-slate-300 border border-white/5'
                }`}
              >
                <span>Custom</span>
              </button>
            </div>

            {/* Custom Court Count Stepper */}
            {isCustom && (
              <div className="pt-2 flex items-center gap-3 animate-fade-in">
                <label className="text-xs font-semibold text-slate-300 shrink-0">
                  Custom Court Count (1 - 16):
                </label>
                <div className="flex items-center gap-1.5">
                  <input
                    type="number"
                    min={1}
                    max={16}
                    value={customCourtInput}
                    onChange={(e) => {
                      setCustomCourtInput(e.target.value);
                      const val = parseInt(e.target.value, 10);
                      if (!isNaN(val) && val >= 1 && val <= 16) {
                        handleCourtSelect(val);
                      }
                    }}
                    className="w-20 px-3 py-1.5 rounded-xl bg-slate-900 border border-white/20 text-white font-mono text-center text-sm font-bold focus:border-amber-400 focus:outline-none"
                  />
                  <span className="text-xs text-slate-400">courts</span>
                </div>
              </div>
            )}

            {/* Editable Court Names */}
            <div className="pt-3 border-t border-white/10 space-y-2.5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-xs font-semibold text-slate-300">
                  Custom Court Names:
                </span>
                {/* Presets */}
                <div className="flex items-center gap-1.5 text-[11px]">
                  <span className="text-slate-400 text-[10px]">Presets:</span>
                  <button
                    type="button"
                    onClick={() => applyPresetNames('numeric')}
                    className="px-2 py-0.5 rounded bg-white/5 hover:bg-white/10 text-slate-300"
                  >
                    1, 2, 3
                  </button>
                  <button
                    type="button"
                    onClick={() => applyPresetNames('alpha')}
                    className="px-2 py-0.5 rounded bg-white/5 hover:bg-white/10 text-slate-300"
                  >
                    A, B, C
                  </button>
                  <button
                    type="button"
                    onClick={() => applyPresetNames('arena')}
                    className="px-2 py-0.5 rounded bg-white/5 hover:bg-white/10 text-slate-300"
                  >
                    Arena
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {courtNames.slice(0, courtCount).map((name, idx) => (
                  <div key={idx} className="flex items-center gap-2">
                    <span className="text-xs font-mono font-bold text-amber-400 w-16 shrink-0">
                      Court {idx + 1}:
                    </span>
                    <input
                      type="text"
                      value={name}
                      maxLength={30}
                      onChange={(e) => handleCourtNameChange(idx, e.target.value)}
                      placeholder={`Court ${idx + 1}`}
                      className="w-full px-3 py-1.5 rounded-xl bg-slate-950/80 border border-white/10 text-xs font-medium text-white focus:border-amber-400 focus:outline-none"
                    />
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Schedule Preview Accordion */}
          <div className="rounded-2xl bg-white/[0.02] border border-white/10 overflow-hidden">
            <button
              type="button"
              onClick={() => setShowPreview(!showPreview)}
              className="w-full px-4 py-3 flex items-center justify-between text-xs font-bold text-slate-300 hover:text-white bg-white/5 transition-colors"
            >
              <div className="flex items-center gap-2">
                <Layers className="w-4 h-4 text-emerald-400" />
                <span>
                  Schedule Preview ({previewMatches.length} Fixtures across {courtCount}{' '}
                  {courtCount === 1 ? 'Court' : 'Courts'})
                </span>
              </div>
              {showPreview ? (
                <ChevronUp className="w-4 h-4 text-slate-400" />
              ) : (
                <ChevronDown className="w-4 h-4 text-slate-400" />
              )}
            </button>

            {showPreview && (
              <div className="p-3.5 max-h-56 overflow-y-auto custom-scrollbar space-y-2 border-t border-white/5 text-xs">
                {previewMatches.length === 0 ? (
                  <p className="text-center py-4 text-slate-400 text-xs">
                    Please ensure at least 2 teams exist to preview fixtures.
                  </p>
                ) : (
                  previewMatches.map((m, idx) => {
                    const nameA = getTeamName(m.teamA);
                    const nameB = getTeamName(m.teamB);
                    const badgeA = getTeamBadge(m.teamA);
                    const badgeB = getTeamBadge(m.teamB);

                    return (
                      <div
                        key={m.id || idx}
                        className="px-3 py-2 rounded-xl bg-slate-900/80 border border-white/5 flex items-center justify-between gap-2 hover:border-amber-500/20 transition-colors"
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="font-mono text-[10px] text-amber-400 font-bold shrink-0">
                            M{idx + 1}
                          </span>
                          <span className="text-[11px] font-semibold text-slate-400 shrink-0">
                            R{m.round}
                          </span>
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-white/10 text-slate-300 truncate max-w-[100px] sm:max-w-none">
                            {m.courtName || `Court ${m.court}`}
                          </span>
                        </div>

                        <div className="flex items-center gap-1.5 font-bold text-white text-xs truncate">
                          <span className="truncate max-w-[80px] sm:max-w-[120px]">
                            {badgeA} {nameA}
                          </span>
                          <span className="text-amber-400 text-[10px]">vs</span>
                          <span className="truncate max-w-[80px] sm:max-w-[120px]">
                            {badgeB} {nameB}
                          </span>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            )}
          </div>
        </div>

        {/* Footer Actions */}
        <div className="px-5 sm:px-7 py-4 border-t border-white/10 flex flex-col-reverse sm:flex-row sm:items-center justify-between gap-3 shrink-0 bg-slate-950">
          <button
            type="button"
            onClick={onClose}
            disabled={isGenerating}
            className="w-full sm:w-auto px-5 py-2.5 rounded-xl text-xs font-semibold text-slate-400 hover:text-white hover:bg-white/10 transition-colors text-center disabled:opacity-50"
          >
            Cancel
          </button>

          <button
            type="button"
            onClick={handleGenerate}
            disabled={isGenerating || teamsCount < 2}
            className="w-full sm:w-auto px-6 py-2.5 min-h-[44px] rounded-xl text-xs font-bold text-slate-950 bg-gradient-to-r from-amber-400 via-amber-300 to-amber-500 hover:from-amber-300 hover:to-amber-400 active:scale-95 transition-all shadow-lg shadow-amber-500/20 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isGenerating ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin shrink-0" />
                <span>Replacing Schedule in Supabase...</span>
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4 shrink-0 text-slate-950" />
                <span>
                  {existingMatchesCount > 0
                    ? 'Generate & Replace Schedule'
                    : 'Generate Round-Robin Schedule'}
                </span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
