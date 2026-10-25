import React, { useState } from 'react';
import {
  UserCheck,
  QrCode,
  IndianRupee,
  ShieldCheck,
  CheckCircle2,
  Copy,
  Printer,
  Sparkles,
  ArrowRight,
  Phone,
  Calendar,
  CreditCard,
} from 'lucide-react';
import { useTournament, sportsAudio } from '../../context/TournamentContext';
import { formatINR, buildUPIPaymentLink } from '../../utils/tournamentEngine';
import { Registration } from '../../types/tournament';
import { NavTab } from '../common/Header';

interface RegistrationViewProps {
  onSelectTab: (tab: NavTab) => void;
}

export const RegistrationView: React.FC<RegistrationViewProps> = ({ onSelectTab }) => {
  const { state, addRegistration, triggerCelebration } = useTournament();

  const [name, setName] = useState('');
  const [mobile, setMobile] = useState('');
  const [age, setAge] = useState<number | ''>(24);
  const [gender, setGender] = useState<'M' | 'F' | 'Other'>('M');
  const [method, setMethod] = useState<'upi' | 'cash' | 'bank' | 'complimentary'>('upi');
  const [txnId, setTxnId] = useState('');
  const [completedReg, setCompletedReg] = useState<Registration | null>(null);

  const fee = state.settings.entryFee || 500;
  const upiLink = buildUPIPaymentLink(state.payment, fee, 'NEW');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    const isPaid = method !== 'complimentary';
    const status = method === 'complimentary' ? 'complimentary' : 'paid';

    const newReg = addRegistration({
      name: name.trim(),
      mobile: mobile.trim(),
      age: typeof age === 'number' ? age : undefined,
      gender,
      fee,
      status,
      method: method === 'complimentary' ? undefined : (method as any),
      txnId: txnId.trim() || undefined,
    });

    setCompletedReg(newReg);
    triggerCelebration();
  };

  const handleResetForm = () => {
    setCompletedReg(null);
    setName('');
    setMobile('');
    setTxnId('');
  };

  return (
    <div className="max-w-3xl mx-auto space-y-8 animate-fade-in">
      {/* Header */}
      <div className="text-center space-y-2">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-amber-500/10 text-amber-400 border border-amber-500/20">
          <Sparkles className="w-3.5 h-3.5" />
          <span>Official Player Entry</span>
        </div>
        <h1 className="font-display text-3xl sm:text-4xl font-black text-white">
          Tournament Player Registration
        </h1>
        <p className="text-sm text-slate-400 max-w-md mx-auto">
          Enroll for {state.settings.name}. Entry fee covers court booking, tournament shuttlecocks, and awards.
        </p>
      </div>

      {completedReg ? (
        /* Digital Registration Ticket / Confirmation */
        <div className="rounded-3xl glass-panel p-6 sm:p-8 border border-emerald-500/40 emerald-glow space-y-6 relative overflow-hidden">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-5 border-b border-white/10 gap-4">
            <div className="flex items-center gap-3">
              <div className="h-12 w-12 rounded-2xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <div>
                <span className="text-[10px] uppercase font-bold tracking-widest text-emerald-400 block">
                  Registration Confirmed
                </span>
                <h3 className="text-xl font-bold text-white">{completedReg.name}</h3>
              </div>
            </div>

            <div className="text-left sm:text-right">
              <span className="text-xs text-slate-400 block">Registration Code</span>
              <span className="font-mono text-lg font-black text-amber-400">
                {completedReg.regId}
              </span>
            </div>
          </div>

          {/* Ticket Details */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 p-4 rounded-2xl bg-white/[0.03] text-xs font-mono">
            <div>
              <span className="text-slate-400 block text-[10px] uppercase">Tournament</span>
              <span className="font-bold text-white truncate block">{state.settings.name}</span>
            </div>
            <div>
              <span className="text-slate-400 block text-[10px] uppercase">Fee Status</span>
              <span className="font-bold text-emerald-400 uppercase">{completedReg.status}</span>
            </div>
            <div>
              <span className="text-slate-400 block text-[10px] uppercase">Amount Paid</span>
              <span className="font-bold text-white">{formatINR(completedReg.fee)}</span>
            </div>
            <div>
              <span className="text-slate-400 block text-[10px] uppercase">Payment Method</span>
              <span className="font-bold text-white capitalize">{completedReg.method || 'Free/Comp'}</span>
            </div>
          </div>

          <p className="text-xs text-slate-400 leading-relaxed">
            The player has been enrolled in the master player pool. You can now assign them to a team or include them in the live token lottery draw.
          </p>

          <div className="flex flex-wrap items-center justify-between gap-3 pt-4 border-t border-white/10">
            <button
              onClick={handleResetForm}
              className="px-4 py-2 text-xs font-semibold text-slate-300 hover:text-white bg-white/5 hover:bg-white/10 rounded-xl transition-colors"
            >
              + Register Another Player
            </button>

            <div className="flex items-center gap-2">
              <button
                onClick={() => onSelectTab('registered')}
                className="px-4 py-2 text-xs font-bold bg-amber-400 hover:bg-amber-300 text-slate-950 rounded-xl transition-all shadow"
              >
                View Registered Roster →
              </button>
            </div>
          </div>
        </div>
      ) : (
        /* Registration Form */
        <form onSubmit={handleSubmit} className="rounded-3xl glass-panel p-6 sm:p-8 border border-white/10 shadow-2xl space-y-6">
          <div className="space-y-4">
            <h3 className="text-lg font-bold text-white flex items-center gap-2">
              <UserCheck className="w-5 h-5 text-amber-400" />
              <span>1. Player Information</span>
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Full Athlete Name *
                </label>
                <input
                  type="text"
                  placeholder="e.g. Rahul Sharma"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full bg-slate-900 border border-white/10 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-amber-400"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  WhatsApp Contact Mobile *
                </label>
                <input
                  type="tel"
                  placeholder="e.g. 9876543210"
                  value={mobile}
                  onChange={(e) => setMobile(e.target.value)}
                  className="w-full bg-slate-900 border border-white/10 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-amber-400"
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">Age</label>
                <input
                  type="number"
                  min={10}
                  max={80}
                  value={age}
                  onChange={(e) => setAge(e.target.value ? parseInt(e.target.value, 10) : '')}
                  className="w-full bg-slate-900 border border-white/10 rounded-xl px-3.5 py-2.5 text-sm text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">Gender</label>
                <select
                  value={gender}
                  onChange={(e) => setGender(e.target.value as any)}
                  className="w-full bg-slate-900 border border-white/10 rounded-xl px-3.5 py-2.5 text-sm text-white"
                >
                  <option value="M">Male</option>
                  <option value="F">Female</option>
                  <option value="Other">Other</option>
                </select>
              </div>
            </div>
          </div>

          {/* Payment Section */}
          <div className="space-y-4 pt-4 border-t border-white/10">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <CreditCard className="w-5 h-5 text-emerald-400" />
                <span>2. Entry Fee & Payment Method</span>
              </h3>
              <div className="text-right">
                <span className="text-xs text-slate-400 block">Entry Fee</span>
                <span className="font-mono text-xl font-black text-amber-400">{formatINR(fee)}</span>
              </div>
            </div>

            {/* Payment Method Tabs */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              {[
                { id: 'upi', label: '📱 UPI / QR', desc: 'Instant QR / App' },
                { id: 'cash', label: '💵 Cash', desc: 'On-court cash' },
                { id: 'bank', label: '🏦 Bank Transfer', desc: 'IMPS / NEFT' },
                { id: 'complimentary', label: '🎁 Complimentary', desc: 'Sponsor / VIP' },
              ].map((pm) => (
                <button
                  key={pm.id}
                  type="button"
                  onClick={() => setMethod(pm.id as any)}
                  className={`text-left p-3 rounded-xl border transition-all ${
                    method === pm.id
                      ? 'bg-amber-500/15 border-amber-500/40 text-white shadow'
                      : 'bg-white/5 border-transparent text-slate-400 hover:text-white'
                  }`}
                >
                  <span className="font-bold text-xs block">{pm.label}</span>
                  <span className="text-[10px] text-slate-400">{pm.desc}</span>
                </button>
              ))}
            </div>

            {/* UPI QR Display if UPI is selected */}
            {method === 'upi' && state.payment.upiId && (
              <div className="rounded-2xl p-4 bg-white/[0.03] border border-white/10 flex flex-col sm:flex-row items-center gap-5">
                {/* Visual QR Code Card */}
                <div className="h-32 w-32 shrink-0 bg-white rounded-xl p-2 shadow-lg flex flex-col items-center justify-center text-slate-900 text-center">
                  <div className="border-4 border-slate-900 rounded p-1 w-full h-full flex flex-col items-center justify-center">
                    <span className="text-xs font-black tracking-tight">UPI QR</span>
                    <span className="text-[10px] font-mono mt-0.5">₹{fee}</span>
                  </div>
                </div>

                <div className="space-y-2 min-w-0 flex-1">
                  <div>
                    <span className="text-[10px] uppercase font-bold text-emerald-400">Scan to Pay via Any UPI App</span>
                    <h4 className="font-mono text-sm font-bold text-white truncate">{state.payment.upiId}</h4>
                    <p className="text-xs text-slate-400">{state.payment.accountName}</p>
                  </div>

                  <a
                    href={upiLink}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-slate-950 bg-emerald-400 hover:bg-emerald-300 rounded-lg shadow transition-colors"
                  >
                    <span>Tap to Pay in UPI App</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </a>
                </div>
              </div>
            )}

            {/* UTR / Transaction ID */}
            {method !== 'complimentary' && (
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Transaction ID / UTR Number (Optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g. UPI-298371928"
                  value={txnId}
                  onChange={(e) => setTxnId(e.target.value)}
                  className="w-full bg-slate-900 border border-white/10 rounded-xl px-3.5 py-2.5 text-sm text-white font-mono"
                />
              </div>
            )}
          </div>

          <div className="pt-4 border-t border-white/10 flex items-center justify-between gap-4">
            <span className="text-xs text-slate-400">
              * Player is automatically added to the master roster
            </span>

            <button
              type="submit"
              className="px-6 py-3 text-sm font-bold text-slate-950 bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 rounded-xl shadow-lg shadow-amber-500/25 active:scale-95 transition-all"
            >
              Complete Registration & Add Player →
            </button>
          </div>
        </form>
      )}
    </div>
  );
};
