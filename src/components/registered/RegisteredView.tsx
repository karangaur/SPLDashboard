import React, { useState } from 'react';
import {
  Download,
  Search,
  CheckCircle2,
  Clock,
  Gift,
  Share2,
  Trash2,
  CreditCard,
  IndianRupee,
  Phone,
  FileSpreadsheet,
} from 'lucide-react';
import { useTournament } from '../../context/TournamentContext';
import {
  formatINR,
  calculateRegistrationStats,
  exportRegistrationsToCSV,
  downloadFile,
} from '../../utils/tournamentEngine';
import { ConfirmModal } from '../common/ConfirmModal';

export const RegisteredView: React.FC = () => {
  const { state, updateRegistration, deleteRegistration, approveRegistration } = useTournament();

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'approved' | 'rejected'>('all');
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);

  const stats = calculateRegistrationStats(state.registrations);

  const filtered = state.registrations.filter((r) => {
    if (statusFilter !== 'all') {
      if (statusFilter === 'approved' && r.status !== 'approved' && r.status !== 'paid') return false;
      if (statusFilter === 'pending' && r.status !== 'pending') return false;
      if (statusFilter === 'rejected' && r.status !== 'rejected') return false;
    }
    if (search) {
      const q = search.toLowerCase();
      const matchName = r.name.toLowerCase().includes(q);
      const matchReg = r.regId.toLowerCase().includes(q);
      const matchMobile = r.mobile.includes(q);
      if (!matchName && !matchReg && !matchMobile) return false;
    }
    return true;
  });

  const handleExportCSV = () => {
    const csvContent = exportRegistrationsToCSV(state.registrations);
    downloadFile(
      `spl-registrations-${new Date().toISOString().slice(0, 10)}.csv`,
      csvContent,
      'text/csv;charset=utf-8;'
    );
  };

  const handleWhatsAppReminder = (r: (typeof state.registrations)[0]) => {
    const text = `Hi ${r.name}, this is a gentle reminder regarding your pending entry fee of ₹${r.fee} for the ${state.settings.name}. Please complete your payment via UPI to ${state.payment.upiId} to confirm your tournament slot. Thank you!`;
    const cleanMobile = r.mobile.replace(/[^0-9]/g, '');
    const url = `https://wa.me/${cleanMobile}?text=${encodeURIComponent(text)}`;
    window.open(url, '_blank');
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-500/20 text-emerald-400 font-bold text-xl">
              📋
            </span>
            <h1 className="font-display text-2xl sm:text-3xl font-black text-white">
              Registered Roster & Fee Ledger
            </h1>
          </div>
          <p className="mt-1 text-xs sm:text-sm text-slate-400">
            Payment tracking, financial ledger, and player directory for {state.settings.name}.
          </p>
        </div>

        <button
          onClick={handleExportCSV}
          className="flex items-center gap-1.5 px-4 py-2.5 text-xs font-bold text-slate-950 bg-gradient-to-r from-emerald-400 to-emerald-500 hover:from-emerald-300 rounded-xl shadow-md transition-all active:scale-95"
        >
          <FileSpreadsheet className="w-4 h-4" />
          <span>Export Roster CSV</span>
        </button>
      </div>

      {/* KPI Cards Strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Registered */}
        <div className="rounded-2xl glass-card p-5 border border-white/5 space-y-1">
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-400 block">
            Total Registrations
          </span>
          <div className="font-mono text-3xl font-black text-white tabular-nums">
            {stats.total}
          </div>
          <span className="text-[11px] text-slate-400">
            {state.settings.slotLimit - stats.total} open slots remaining
          </span>
        </div>

        {/* Fees Collected */}
        <div className="rounded-2xl glass-card p-5 border border-emerald-500/20 bg-emerald-500/5 space-y-1">
          <span className="text-xs font-semibold uppercase tracking-wider text-emerald-400 block">
            Collected Entry Fees
          </span>
          <div className="font-mono text-3xl font-black text-emerald-300 tabular-nums">
            {formatINR(stats.collected)}
          </div>
          <span className="text-[11px] text-emerald-400/80">
            {stats.paidCount} players confirmed paid
          </span>
        </div>

        {/* Pending Dues */}
        <div className="rounded-2xl glass-card p-5 border border-amber-500/20 bg-amber-500/5 space-y-1">
          <span className="text-xs font-semibold uppercase tracking-wider text-amber-400 block">
            Pending Dues
          </span>
          <div className="font-mono text-3xl font-black text-amber-300 tabular-nums">
            {formatINR(stats.pendingAmount)}
          </div>
          <span className="text-[11px] text-amber-400/80">
            {stats.pendingCount} unpaid entries
          </span>
        </div>

        {/* Payment Channel Breakdown */}
        <div className="rounded-2xl glass-card p-5 border border-blue-500/20 bg-blue-500/5 space-y-1">
          <span className="text-xs font-semibold uppercase tracking-wider text-blue-400 block">
            By Payment Method
          </span>
          <div className="text-xs font-mono space-y-0.5 pt-1 text-slate-300">
            <div>UPI: <span className="font-bold text-white">{formatINR(stats.byUpi)}</span></div>
            <div>Cash: <span className="font-bold text-white">{formatINR(stats.byCash)}</span></div>
            <div>Bank: <span className="font-bold text-white">{formatINR(stats.byBank)}</span></div>
          </div>
        </div>
      </div>

      {/* Search & Filter Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 p-3 rounded-2xl glass-panel">
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search by player name, mobile, or SPL-2026-XXX..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-slate-900/80 border border-white/10 rounded-xl pl-9 pr-4 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-emerald-400/50"
          />
        </div>

        <div className="flex items-center gap-1.5 overflow-x-auto p-1 bg-white/5 rounded-xl">
          {[
            { id: 'all', label: 'All Entries' },
            { id: 'pending', label: 'Pending' },
            { id: 'approved', label: 'Approved' },
            { id: 'rejected', label: 'Rejected' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setStatusFilter(tab.id as any)}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap shrink-0 ${
                statusFilter === tab.id
                  ? 'bg-emerald-400 text-slate-950 shadow'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Roster Table */}
      {filtered.length > 0 ? (
        <div className="rounded-3xl glass-panel border border-white/10 overflow-hidden shadow-2xl">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-white/10 bg-white/[0.02] text-[11px] uppercase tracking-wider text-slate-400">
                  <th className="py-4 pl-6">Reg ID</th>
                  <th className="py-4">Player Name</th>
                  <th className="py-4">Mobile</th>
                  <th className="py-4">Fee Status</th>
                  <th className="py-4">Amount</th>
                  <th className="py-4">Payment Method</th>
                  <th className="py-4">Transaction Ref</th>
                  <th className="py-4 text-right pr-6">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {filtered.map((r) => {
                  return (
                    <tr key={r.id} className="hover:bg-white/5 transition-colors">
                      <td className="py-3.5 pl-6 font-mono font-bold text-amber-400 text-xs">
                        {r.regId}
                      </td>

                      <td className="py-3.5 font-bold text-white">
                        <div className="flex items-center gap-2">
                          <span>{r.name}</span>
                          {r.age && <span className="text-xs text-slate-400 font-normal">({r.age}y)</span>}
                        </div>
                      </td>

                      <td className="py-3.5 font-mono text-xs text-slate-300">
                        {r.mobile}
                      </td>

                      {/* Payment Status Dropdown Selector */}
                      <td className="py-3.5">
                        <select
                          value={r.status}
                          onChange={(e) => {
                            const newStatus = e.target.value as any;
                            if (newStatus === 'approved') {
                              approveRegistration(r.id);
                            } else {
                              updateRegistration(r.id, { status: newStatus });
                            }
                          }}
                          className={`text-xs font-bold rounded-lg px-2.5 py-1 border transition-colors ${
                            r.status === 'approved' || r.status === 'paid'
                              ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
                              : r.status === 'pending'
                              ? 'bg-amber-500/15 text-amber-400 border-amber-500/30'
                              : 'bg-rose-500/15 text-rose-400 border-rose-500/30'
                          }`}
                        >
                          <option value="pending" className="bg-slate-900 text-white">Pending</option>
                          <option value="approved" className="bg-slate-900 text-white">Approved</option>
                          <option value="rejected" className="bg-slate-900 text-white">Rejected</option>
                        </select>
                      </td>

                      <td className="py-3.5 font-mono tabular-nums text-slate-200">
                        {formatINR(r.fee)}
                      </td>

                      <td className="py-3.5 text-xs text-slate-300 capitalize">
                        {r.method || '—'}
                      </td>

                      <td className="py-3.5 font-mono text-xs text-slate-400 truncate max-w-[120px]">
                        {r.txnId || '—'}
                      </td>

                      {/* Action buttons */}
                      <td className="py-3.5 text-right pr-6">
                        <div className="flex items-center justify-end gap-1.5">
                          {r.status !== 'approved' && (
                            <button
                              onClick={() => approveRegistration(r.id)}
                              title="Approve and promote to player roster"
                              aria-label="Approve and promote to player roster"
                              className="px-2 py-1 text-xs font-bold bg-emerald-400 hover:bg-emerald-300 text-slate-950 rounded-lg transition-colors shadow"
                            >
                              Approve
                            </button>
                          )}
                          {r.status === 'pending' && (
                            <button
                              onClick={() => handleWhatsAppReminder(r)}
                              title="Send WhatsApp Payment Reminder"
                              aria-label="Send WhatsApp Payment Reminder"
                              className="p-1.5 text-amber-400 hover:text-amber-300 hover:bg-amber-400/10 rounded-lg transition-colors"
                            >
                              <Phone className="w-3.5 h-3.5" />
                            </button>
                          )}
                          <button
                            onClick={() => setDeleteTargetId(r.id)}
                            title="Delete Registration"
                            aria-label="Delete Registration"
                            className="p-1.5 text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition-colors"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="rounded-3xl glass-card p-12 text-center border border-dashed border-white/10 space-y-3">
          <CreditCard className="w-12 h-12 text-slate-500 mx-auto" />
          <h3 className="text-lg font-bold text-white">No Registrations Match Filter</h3>
          <p className="text-xs text-slate-400 max-w-sm mx-auto">
            Try resetting your search or filter options.
          </p>
        </div>
      )}

      {/* Delete Confirmation */}
      <ConfirmModal
        isOpen={!!deleteTargetId}
        title="Delete Player Registration"
        message="Are you sure you want to remove this registration record? The athlete will also be removed from the tournament player list."
        confirmLabel="Delete Record"
        variant="danger"
        onConfirm={() => {
          if (deleteTargetId) deleteRegistration(deleteTargetId);
          setDeleteTargetId(null);
        }}
        onCancel={() => setDeleteTargetId(null)}
      />
    </div>
  );
};
