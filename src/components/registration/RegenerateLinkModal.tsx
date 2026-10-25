import React, { useState } from 'react';
import {
  X,
  RefreshCw,
  Copy,
  Check,
  Share2,
  AlertTriangle,
  ShieldAlert,
  Clock,
  CheckCircle2,
  XCircle,
  ExternalLink,
  MessageCircle,
} from 'lucide-react';
import { RegistrationTokenRecord } from '../../types/tournament';

interface RegenerateLinkModalProps {
  isOpen: boolean;
  onClose: () => void;
  seasonSlug: string;
  seasonTitle: string;
  tokens: RegistrationTokenRecord[];
  activeToken: RegistrationTokenRecord | null;
  onRegenerate: (
    seasonSlug: string,
    invalidatePrevious: boolean,
    label?: string
  ) => Promise<{ success: boolean; tokenRecord?: RegistrationTokenRecord; error?: string }>;
  onToggleStatus: (tokenId: string) => Promise<{ success: boolean }>;
}

export const RegenerateLinkModal: React.FC<RegenerateLinkModalProps> = ({
  isOpen,
  onClose,
  seasonSlug,
  seasonTitle,
  tokens,
  activeToken,
  onRegenerate,
  onToggleStatus,
}) => {
  const [invalidatePrevious, setInvalidatePrevious] = useState(true);
  const [customLabel, setCustomLabel] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [copiedToken, setCopiedToken] = useState<string | null>(null);

  if (!isOpen) return null;

  const origin = typeof window !== 'undefined' ? window.location.origin : 'https://smash-premier-league.web.app';

  const buildUrlForToken = (token: string) => {
    return `${origin}?register=${seasonSlug}&token=${encodeURIComponent(token)}`;
  };

  const handleCopy = (token: string) => {
    const url = buildUrlForToken(token);
    navigator.clipboard.writeText(url);
    setCopiedToken(token);
    setTimeout(() => setCopiedToken(null), 2000);
  };

  const handleShareWhatsApp = (token: string) => {
    const url = buildUrlForToken(token);
    const text = `🏸 *Smash Premier League — Official Registration Link*\n\n🏆 Season: ${seasonTitle}\n👉 *Register your entry here:* \n${url}\n\n_Official link authorized by the tournament desk._`;
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
  };

  const handleConfirmRegenerate = async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const res = await onRegenerate(seasonSlug, invalidatePrevious, customLabel.trim() || undefined);
      if (!res.success) {
        setErrorMsg(res.error || 'Failed to regenerate link');
      } else {
        setCustomLabel('');
      }
    } catch (e: any) {
      setErrorMsg(e?.message || 'Error regenerating link');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-950/85 backdrop-blur-md overflow-y-auto animate-fade-in">
      <div className="relative w-full max-w-2xl bg-[#0b1120] border border-white/15 rounded-3xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10 bg-slate-900/60">
          <div className="flex items-center gap-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-500/20 text-amber-400 font-bold text-lg border border-amber-500/30">
              🔄
            </span>
            <div>
              <h2 className="font-display text-lg font-black text-white">
                Regenerate Registration Link
              </h2>
              <p className="text-xs text-slate-400">
                Manage unique shareable tokens and prevent unauthorized or outdated entries.
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-white/10 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {errorMsg && (
            <div className="p-3 bg-rose-500/20 border border-rose-500/30 rounded-xl text-xs text-rose-300 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Explanation Banner */}
          <div className="p-4 rounded-2xl bg-slate-900/80 border border-white/10 space-y-3">
            <div className="flex items-start gap-3">
              <ShieldAlert className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <h4 className="text-xs font-bold text-white uppercase tracking-wider">
                  Important Notice on Link Invalidation
                </h4>
                <p className="text-xs text-slate-300 leading-relaxed">
                  Regenerating creates a fresh cryptographic token for this tournament season. If you choose to invalidate previous links, any athlete who opens the old URL will be blocked from submitting and shown an expiration notice directing them to contact you.
                </p>
              </div>
            </div>

            {/* Invalidation Radio Selector */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-2">
              <label
                className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-all ${
                  invalidatePrevious
                    ? 'bg-amber-500/10 border-amber-500/40 text-white'
                    : 'bg-slate-950 border-white/10 text-slate-400 hover:text-slate-200'
                }`}
              >
                <input
                  type="radio"
                  name="invalidation"
                  checked={invalidatePrevious}
                  onChange={() => setInvalidatePrevious(true)}
                  className="mt-0.5 text-amber-500 focus:ring-0"
                />
                <div>
                  <span className="block text-xs font-bold text-amber-300">
                    ⚡ Invalidate previous links (Recommended)
                  </span>
                  <span className="block text-[11px] text-slate-400 mt-0.5">
                    Previous registration links immediately expire and refuse submissions.
                  </span>
                </div>
              </label>

              <label
                className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-all ${
                  !invalidatePrevious
                    ? 'bg-emerald-500/10 border-emerald-500/40 text-white'
                    : 'bg-slate-950 border-white/10 text-slate-400 hover:text-slate-200'
                }`}
              >
                <input
                  type="radio"
                  name="invalidation"
                  checked={!invalidatePrevious}
                  onChange={() => setInvalidatePrevious(false)}
                  className="mt-0.5 text-emerald-500 focus:ring-0"
                />
                <div>
                  <span className="block text-xs font-bold text-emerald-300">
                    🔄 Keep previous links active
                  </span>
                  <span className="block text-[11px] text-slate-400 mt-0.5">
                    Both old and new links will continue accepting player entries.
                  </span>
                </div>
              </label>
            </div>

            {/* Optional Campaign Label */}
            <div className="pt-2">
              <label className="block text-[11px] font-bold text-slate-400 mb-1">
                Optional Link Label / Campaign Note
              </label>
              <input
                type="text"
                value={customLabel}
                onChange={(e) => setCustomLabel(e.target.value)}
                placeholder="e.g. WhatsApp Group Blast, Social Media Post, Spot Entry Batch"
                className="w-full bg-slate-950 border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-400"
              />
            </div>

            <button
              onClick={handleConfirmRegenerate}
              disabled={loading}
              className="w-full mt-2 py-2.5 rounded-xl text-xs font-black bg-amber-500 hover:bg-amber-400 text-slate-950 transition-colors flex items-center justify-center gap-2 shadow-lg shadow-amber-500/20 disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              <span>{loading ? 'Regenerating...' : 'Generate New Link Now'}</span>
            </button>
          </div>

          {/* Current Active Token Box */}
          {activeToken && (
            <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-emerald-400 uppercase tracking-wider flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5" /> Active Registration Link
                </span>
                <span className="text-[10px] text-slate-400">
                  Created {new Date(activeToken.createdAt).toLocaleDateString('en-IN')}
                </span>
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="text"
                  readOnly
                  value={buildUrlForToken(activeToken.token)}
                  className="flex-1 bg-slate-950 border border-white/10 rounded-xl px-3 py-2 text-xs text-slate-200 font-mono select-all focus:outline-none"
                />

                <button
                  onClick={() => handleCopy(activeToken.token)}
                  className="flex items-center gap-1 px-3 py-2 rounded-xl text-xs font-bold bg-white/10 hover:bg-white/15 text-white transition-colors shrink-0"
                >
                  {copiedToken === activeToken.token ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-400" />
                      <span className="text-emerald-400">Copied</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      <span>Copy</span>
                    </>
                  )}
                </button>

                <button
                  onClick={() => handleShareWhatsApp(activeToken.token)}
                  className="flex items-center gap-1 px-3 py-2 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white transition-colors shrink-0"
                >
                  <MessageCircle className="w-3.5 h-3.5" />
                  <span>WhatsApp</span>
                </button>
              </div>
            </div>
          )}

          {/* Generated Tokens History Table */}
          <div className="space-y-2">
            <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider">
              Token History for Season ({tokens.length})
            </h4>

            <div className="border border-white/10 rounded-2xl overflow-hidden bg-slate-900/60 divide-y divide-white/5">
              {tokens.length === 0 ? (
                <div className="p-4 text-center text-xs text-slate-500">
                  No previous link tokens recorded yet.
                </div>
              ) : (
                tokens.map((tok) => {
                  const isCopied = copiedToken === tok.token;

                  return (
                    <div
                      key={tok.id}
                      className="p-3 sm:px-4 flex items-center justify-between gap-3 text-xs"
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-bold text-white text-[11px] truncate">
                            {tok.token}
                          </span>
                          <span
                            className={`text-[9px] px-1.5 py-0.5 rounded font-bold uppercase tracking-wider ${
                              tok.isActive
                                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                                : 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                            }`}
                          >
                            {tok.isActive ? 'Active' : 'Revoked'}
                          </span>
                        </div>

                        <div className="flex items-center gap-2 text-[10px] text-slate-400 mt-0.5">
                          <span>
                            {tok.label || `Created ${new Date(tok.createdAt).toLocaleDateString('en-IN')}`}
                          </span>
                          <span>·</span>
                          <span className="text-slate-300">
                            Submissions: {tok.submissionsCount || 0}
                          </span>
                          {tok.revokedAt && (
                            <>
                              <span>·</span>
                              <span className="text-rose-400">
                                Revoked on {new Date(tok.revokedAt).toLocaleDateString('en-IN')}
                              </span>
                            </>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        <button
                          onClick={() => handleCopy(tok.token)}
                          className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white"
                          title="Copy Link"
                        >
                          {isCopied ? (
                            <Check className="w-3.5 h-3.5 text-emerald-400" />
                          ) : (
                            <Copy className="w-3.5 h-3.5" />
                          )}
                        </button>

                        <button
                          onClick={() => handleShareWhatsApp(tok.token)}
                          className="p-1.5 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400"
                          title="Share on WhatsApp"
                        >
                          <MessageCircle className="w-3.5 h-3.5" />
                        </button>

                        <button
                          onClick={() => onToggleStatus(tok.id)}
                          className={`text-[10px] px-2 py-1 rounded-lg font-bold border transition-colors ${
                            tok.isActive
                              ? 'bg-rose-500/15 border-rose-500/30 text-rose-300 hover:bg-rose-500/25'
                              : 'bg-emerald-500/15 border-emerald-500/30 text-emerald-300 hover:bg-emerald-500/25'
                          }`}
                        >
                          {tok.isActive ? 'Revoke' : 'Reactivate'}
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end px-6 py-3.5 border-t border-white/10 bg-slate-900/60">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-bold text-slate-300 hover:text-white hover:bg-white/5 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
