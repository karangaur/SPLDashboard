import React, { useState } from 'react';
import {
  Link2,
  Copy,
  Share2,
  Sliders,
  Users2,
  CheckCircle2,
  Clock,
  XCircle,
  AlertCircle,
  ExternalLink,
  MessageCircle,
  QrCode,
  Download,
  Search,
  Trash2,
  Edit,
  Eye,
  Check,
  UserPlus,
  RefreshCw,
  Power,
  ShieldAlert,
  FileSpreadsheet,
  Settings2,
  Calendar,
  Sparkles,
  Award,
  Layers,
  ShieldCheck,
} from 'lucide-react';
import { useTournament, sportsAudio } from '../../context/TournamentContext';
import {
  formatINR,
  calculateRegistrationStats,
  exportRegistrationsToCSV,
  downloadFile,
  validateIndianMobile,
} from '../../utils/tournamentEngine';
import { Registration, RegistrationSettings, RegistrationFormConfig } from '../../types/tournament';
import { ConfirmModal } from '../common/ConfirmModal';
import { FormCustomizerModal } from './FormCustomizerModal';
import { RegenerateLinkModal } from './RegenerateLinkModal';

interface RegistrationManagementViewProps {
  onOpenPublicForm?: (season?: string) => void;
}

export const RegistrationManagementView: React.FC<RegistrationManagementViewProps> = ({
  onOpenPublicForm,
}) => {
  const {
    state,
    formConfig,
    tokens,
    activeToken,
    fetchFormConfig,
    saveFormConfig,
    fetchTokens,
    regenerateToken,
    toggleTokenStatus,
    updateRegistrationSettings,
    updateRegistration,
    approveRegistration,
    rejectRegistration,
    deleteRegistration,
    deleteRegistrationsBulk,
    bulkApproveRegistrations,
  } = useTournament();

  const regSettings = state.registrationSettings;
  const stats = calculateRegistrationStats(state.registrations);

  // Active view tab inside Player Registration Hub
  const [activeTab, setActiveTab] = useState<'link' | 'roster' | 'settings'>('link');

  // Modals
  const [isFormCustomizerOpen, setIsFormCustomizerOpen] = useState(false);
  const [isRegenerateModalOpen, setIsRegenerateModalOpen] = useState(false);

  // Copy link feedback
  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedSlug, setCopiedSlug] = useState(false);

  // Search & Filters in Roster
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'approved' | 'rejected'>('all');

  // Bulk selection
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [bulkDeleteModalOpen, setBulkDeleteModalOpen] = useState(false);
  const [bulkApproveModalOpen, setBulkApproveModalOpen] = useState(false);

  // Single item actions
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);
  const [viewDetailsTarget, setViewDetailsTarget] = useState<Registration | null>(null);
  const [editTarget, setEditTarget] = useState<Registration | null>(null);

  // Edit form state
  const [editName, setEditName] = useState('');
  const [editMobile, setEditMobile] = useState('');
  const [editAge, setEditAge] = useState<number | ''>('');
  const [editGender, setEditGender] = useState<'M' | 'F' | 'Other'>('M');
  const [editExperience, setEditExperience] = useState<string>('Intermediate');
  const [editCategory, setEditCategory] = useState<string>('Doubles');
  const [editStyle, setEditStyle] = useState<string>('All-Rounder');
  const [editCity, setEditCity] = useState('');
  const [editNotes, setEditNotes] = useState('');

  // Base URL calculation with active token
  const origin = typeof window !== 'undefined' ? window.location.origin : 'https://smash-premier-league.web.app';
  const currentSeasonSlug = formConfig.seasonSlug || regSettings.seasonSlug || 'season-4';
  const publicRegistrationUrl = `${origin}?register=${currentSeasonSlug}${
    activeToken ? `&token=${encodeURIComponent(activeToken.token)}` : ''
  }`;

  // WhatsApp share text with active token
  const whatsAppShareText = `🏸 *Smash Premier League (S.P.L.) — Player Registration is OPEN!*\n\n🏆 *Tournament:* ${formConfig.tournamentName || state.settings.name}\n🌟 *Season:* ${formConfig.seasonTitle || state.settings.season || regSettings.seasonTitle}\n📅 *Date:* ${formConfig.date || state.settings.date}\n📍 *Venue:* ${formConfig.venue || state.settings.venue}\n💰 *Entry Fee:* ${formatINR(formConfig.entryFee ?? (state.settings.entryFee || 500))}\n\n👉 *Click here to submit your player entry:* \n${publicRegistrationUrl}\n\n_Register early to guarantee your tournament slot!_`;

  const handleCopyLink = () => {
    navigator.clipboard.writeText(publicRegistrationUrl);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  const handleShareWhatsApp = () => {
    const url = `https://wa.me/?text=${encodeURIComponent(whatsAppShareText)}`;
    window.open(url, '_blank');
  };

  const handleToggleRegistrationStatus = () => {
    const nextVal = !regSettings.enabled;
    updateRegistrationSettings({ enabled: nextVal });
    saveFormConfig({ ...formConfig, enabled: nextVal });
  };

  const handleExportCSV = () => {
    const csvContent = exportRegistrationsToCSV(state.registrations);
    downloadFile(
      `spl-registrations-${regSettings.seasonSlug}-${new Date().toISOString().slice(0, 10)}.csv`,
      csvContent,
      'text/csv;charset=utf-8;'
    );
  };

  // Filtered registrations
  const filteredRegistrations = state.registrations.filter((r) => {
    if (statusFilter !== 'all') {
      if (statusFilter === 'approved' && r.status !== 'approved' && r.status !== 'paid') return false;
      if (statusFilter === 'pending' && r.status !== 'pending') return false;
      if (statusFilter === 'rejected' && r.status !== 'rejected') return false;
    }
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      const matchName = r.name.toLowerCase().includes(q);
      const matchMobile = r.mobile.includes(q);
      const matchRegId = r.regId.toLowerCase().includes(q);
      const matchCity = r.city ? r.city.toLowerCase().includes(q) : false;
      if (!matchName && !matchMobile && !matchRegId && !matchCity) return false;
    }
    return true;
  });

  // Bulk actions helpers
  const allFilteredSelected =
    filteredRegistrations.length > 0 &&
    filteredRegistrations.every((r) => selectedIds.includes(r.id));

  const handleToggleSelectAll = () => {
    if (allFilteredSelected) {
      setSelectedIds([]);
    } else {
      setSelectedIds(filteredRegistrations.map((r) => r.id));
    }
  };

  const handleToggleSelectOne = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  };

  const handleConfirmBulkDelete = () => {
    deleteRegistrationsBulk(selectedIds);
    setSelectedIds([]);
    setBulkDeleteModalOpen(false);
  };

  const handleConfirmBulkApprove = () => {
    bulkApproveRegistrations(selectedIds);
    setSelectedIds([]);
    setBulkApproveModalOpen(false);
  };

  const openEditModal = (reg: Registration) => {
    setEditTarget(reg);
    setEditName(reg.name);
    setEditMobile(reg.mobile);
    setEditAge(reg.age || '');
    setEditGender(reg.gender || 'M');
    setEditExperience(reg.experience || 'Intermediate');
    setEditCategory(reg.category || 'Doubles');
    setEditStyle(reg.style || 'All-Rounder');
    setEditCity(reg.city || '');
    setEditNotes(reg.notes || '');
  };

  const handleSaveEdit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editTarget) return;

    updateRegistration(editTarget.id, {
      name: editName.trim(),
      mobile: editMobile.replace(/\D/g, ''),
      age: typeof editAge === 'number' && !isNaN(editAge) ? editAge : undefined,
      gender: editGender,
      experience: editExperience as any,
      category: editCategory as any,
      style: editStyle as any,
      city: editCity.trim() || undefined,
      notes: editNotes.trim() || undefined,
    });

    setEditTarget(null);
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Top Header Hub */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-white/10">
        <div>
          <div className="flex items-center gap-2.5">
            <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-amber-500/20 text-amber-400 font-bold text-xl border border-amber-500/30">
              ⚡
            </span>
            <div>
              <h1 className="font-display text-2xl sm:text-3xl font-black text-white tracking-tight">
                Player Registration Module
              </h1>
              <p className="text-xs sm:text-sm text-slate-400">
                Generate shareable public registration links, manage form settings, and vet applicants into the official tournament roster.
              </p>
            </div>
          </div>
        </div>

        {/* Global Controls & Public Preview */}
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Customize Registration Form Button */}
          <button
            onClick={() => setIsFormCustomizerOpen(true)}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 hover:bg-emerald-500/25 transition-all shadow-sm"
          >
            <Sliders className="w-3.5 h-3.5 text-emerald-400" />
            <span>Customize Registration Form</span>
          </button>

          {/* Regenerate Link Button */}
          <button
            onClick={() => setIsRegenerateModalOpen(true)}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold bg-amber-500/15 border border-amber-500/30 text-amber-300 hover:bg-amber-500/25 transition-all shadow-sm"
          >
            <RefreshCw className="w-3.5 h-3.5 text-amber-400" />
            <span>Regenerate Link</span>
          </button>

          {/* Quick Registration Status Toggle */}
          <button
            onClick={handleToggleRegistrationStatus}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all border ${
              regSettings.enabled
                ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-300 hover:bg-emerald-500/25'
                : 'bg-rose-500/15 border-rose-500/30 text-rose-300 hover:bg-rose-500/25'
            }`}
          >
            <Power className="w-3.5 h-3.5" />
            <span>{regSettings.enabled ? 'Registration is OPEN' : 'Registration is DISABLED'}</span>
          </button>

          {/* Open Public Form Preview */}
          <button
            onClick={() => onOpenPublicForm && onOpenPublicForm(currentSeasonSlug)}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold bg-white/10 hover:bg-white/15 text-white transition-colors"
          >
            <ExternalLink className="w-3.5 h-3.5 text-amber-400" />
            <span>Preview Public Form</span>
          </button>
        </div>
      </div>

      {/* Navigation Sub-Tabs */}
      <div className="flex items-center gap-2 border-b border-white/10 pb-2 overflow-x-auto">
        <button
          onClick={() => setActiveTab('link')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
            activeTab === 'link'
              ? 'bg-amber-400 text-slate-950 shadow-md'
              : 'text-slate-400 hover:text-white hover:bg-white/5'
          }`}
        >
          <Link2 className="w-4 h-4" />
          <span>Registration Link & Sharing</span>
        </button>

        <button
          onClick={() => setActiveTab('roster')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
            activeTab === 'roster'
              ? 'bg-amber-400 text-slate-950 shadow-md'
              : 'text-slate-400 hover:text-white hover:bg-white/5'
          }`}
        >
          <Users2 className="w-4 h-4" />
          <span>Registered Applicants</span>
          {stats.total > 0 && (
            <span
              className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold ${
                activeTab === 'roster'
                  ? 'bg-slate-950 text-amber-300'
                  : 'bg-amber-500/20 text-amber-300'
              }`}
            >
              {stats.total}
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveTab('settings')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
            activeTab === 'settings'
              ? 'bg-amber-400 text-slate-950 shadow-md'
              : 'text-slate-400 hover:text-white hover:bg-white/5'
          }`}
        >
          <Settings2 className="w-4 h-4" />
          <span>Form Customization Settings</span>
        </button>
      </div>

      {/* TAB 1: Registration Link & Sharing Hub */}
      {activeTab === 'link' && (
        <div className="space-y-6 animate-fade-in">
          {/* Hero Link Generator Card */}
          <div className="rounded-3xl glass-card p-6 sm:p-8 border border-white/10 space-y-6 relative overflow-hidden bg-gradient-to-br from-amber-500/10 via-transparent to-transparent">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <span className="text-[10px] uppercase font-bold tracking-widest text-amber-400 block">
                  Public Athlete Registration Link
                </span>
                <h2 className="text-xl sm:text-2xl font-bold text-white">
                  Shareable Tournament Registration URL
                </h2>
                <div className="flex flex-wrap items-center gap-2 mt-1">
                  {activeToken ? (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                      <ShieldCheck className="w-3 h-3 text-emerald-400" />
                      Active Token: {activeToken.token}
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                      Default Season Link
                    </span>
                  )}

                  {tokens.filter((t) => !t.isActive).length > 0 && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-rose-500/15 text-rose-300 border border-rose-500/20">
                      {tokens.filter((t) => !t.isActive).length} Revoked
                    </span>
                  )}
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  onClick={() => setIsRegenerateModalOpen(true)}
                  className="flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl text-xs font-bold text-amber-300 bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/30 transition-colors shadow-sm"
                >
                  <RefreshCw className="w-3.5 h-3.5 text-amber-400" />
                  <span>Regenerate Link</span>
                </button>

                <button
                  onClick={() => setIsFormCustomizerOpen(true)}
                  className="flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl text-xs font-bold text-emerald-300 bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/30 transition-colors shadow-sm"
                >
                  <Sliders className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Customize Form</span>
                </button>

                <button
                  onClick={handleShareWhatsApp}
                  className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-xs font-bold text-slate-950 bg-emerald-400 hover:bg-emerald-300 transition-colors shadow-md shadow-emerald-500/20"
                >
                  <MessageCircle className="w-4 h-4" />
                  <span>Share on WhatsApp</span>
                </button>
              </div>
            </div>

            {/* Link Box */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 p-2 rounded-2xl bg-slate-950/80 border border-white/10">
              <div className="flex items-center gap-2 px-3 py-2 flex-1 min-w-0">
                <Link2 className="w-4 h-4 text-amber-400 shrink-0" />
                <span className="font-mono text-xs sm:text-sm text-slate-200 truncate select-all">
                  {publicRegistrationUrl}
                </span>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={handleCopyLink}
                  className="flex-1 sm:flex-initial flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold text-slate-950 bg-amber-400 hover:bg-amber-300 transition-all shadow"
                >
                  {copiedLink ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedLink ? 'Link Copied!' : 'Copy Link'}</span>
                </button>

                <button
                  onClick={() => onOpenPublicForm && onOpenPublicForm(currentSeasonSlug)}
                  className="p-2 text-slate-400 hover:text-white bg-white/5 hover:bg-white/10 rounded-xl transition-colors"
                  title="Open Form in Browser"
                >
                  <ExternalLink className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Quick Link Info & WhatsApp Preview */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
              <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/10 space-y-2 text-xs">
                <span className="font-bold text-white flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                  <span>Live Features Configured</span>
                </span>
                <ul className="space-y-1.5 text-slate-300">
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Indian mobile number validation enforced</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Duplicate phone registration prevention active</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Direct UPI QR & payment link integration</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Applicants automatically sync to Admin Vetting Roster</span>
                  </li>
                </ul>
              </div>

              {/* Prefilled WhatsApp Message Box */}
              <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/10 space-y-2 text-xs">
                <span className="font-bold text-emerald-400 flex items-center gap-1.5">
                  <MessageCircle className="w-3.5 h-3.5" />
                  <span>Prefilled WhatsApp Message</span>
                </span>
                <p className="font-mono text-[11px] text-slate-300 bg-black/40 p-2.5 rounded-xl border border-white/5 line-clamp-3 leading-relaxed">
                  {whatsAppShareText}
                </p>
                <button
                  onClick={handleShareWhatsApp}
                  className="text-xs text-emerald-400 hover:text-emerald-300 font-semibold flex items-center gap-1"
                >
                  <span>Broadcast to WhatsApp Contacts & Groups →</span>
                </button>
              </div>
            </div>
          </div>

          {/* Registration Live Statistics Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="rounded-2xl glass-card p-5 border border-white/10 space-y-1">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block">
                Total Submissions
              </span>
              <div className="font-mono text-3xl font-black text-white tabular-nums">
                {stats.total}
              </div>
              <span className="text-[11px] text-slate-400">
                {regSettings.maxSlots - stats.total} open slots remaining
              </span>
            </div>

            <div className="rounded-2xl glass-card p-5 border border-amber-500/20 bg-amber-500/5 space-y-1">
              <span className="text-[11px] font-bold uppercase tracking-wider text-amber-400 block">
                Pending Vetting
              </span>
              <div className="font-mono text-3xl font-black text-amber-300 tabular-nums">
                {stats.pendingCount}
              </div>
              <span className="text-[11px] text-amber-400/80">
                Awaiting organizer approval
              </span>
            </div>

            <div className="rounded-2xl glass-card p-5 border border-emerald-500/20 bg-emerald-500/5 space-y-1">
              <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-400 block">
                Approved to Roster
              </span>
              <div className="font-mono text-3xl font-black text-emerald-300 tabular-nums">
                {stats.approvedCount}
              </div>
              <span className="text-[11px] text-emerald-400/80">
                Added to Players directory
              </span>
            </div>

            <div className="rounded-2xl glass-card p-5 border border-rose-500/20 bg-rose-500/5 space-y-1">
              <span className="text-[11px] font-bold uppercase tracking-wider text-rose-400 block">
                Rejected / Ineligible
              </span>
              <div className="font-mono text-3xl font-black text-rose-300 tabular-nums">
                {stats.rejectedCount}
              </div>
              <span className="text-[11px] text-rose-400/80">
                Excluded from draw
              </span>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: Registered Applicants Vetting Roster */}
      {activeTab === 'roster' && (
        <div className="space-y-4 animate-fade-in">
          {/* Action & Filter Bar */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 p-3 rounded-2xl glass-panel">
            <div className="relative flex-1">
              <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Search by player name, mobile, city, or SPL ID..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full bg-slate-900 border border-white/10 rounded-xl pl-9 pr-4 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-amber-400"
              />
            </div>

            <div className="flex items-center gap-2 overflow-x-auto">
              {/* Status Filter */}
              <div className="flex items-center gap-1 p-1 bg-white/5 rounded-xl shrink-0">
                {[
                  { id: 'all', label: 'All' },
                  { id: 'pending', label: `Pending (${stats.pendingCount})` },
                  { id: 'approved', label: `Approved (${stats.approvedCount})` },
                  { id: 'rejected', label: `Rejected (${stats.rejectedCount})` },
                ].map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setStatusFilter(tab.id as any)}
                    className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap ${
                      statusFilter === tab.id
                        ? 'bg-amber-400 text-slate-950 font-bold shadow'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              {/* Export CSV */}
              <button
                onClick={handleExportCSV}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold text-slate-950 bg-emerald-400 hover:bg-emerald-300 transition-colors shrink-0"
              >
                <FileSpreadsheet className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Export CSV</span>
              </button>
            </div>
          </div>

          {/* Bulk Selection Action Bar */}
          {selectedIds.length > 0 && (
            <div className="p-3 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex flex-wrap items-center justify-between gap-3 animate-fade-in">
              <div className="flex items-center gap-2 text-xs font-bold text-amber-300">
                <span className="h-2 w-2 rounded-full bg-amber-400 animate-ping"></span>
                <span>{selectedIds.length} applicants selected</span>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => setBulkApproveModalOpen(true)}
                  className="px-3 py-1.5 rounded-lg text-xs font-bold bg-emerald-400 hover:bg-emerald-300 text-slate-950 transition-colors flex items-center gap-1"
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>Approve & Add to Players ({selectedIds.length})</span>
                </button>

                <button
                  onClick={() => setBulkDeleteModalOpen(true)}
                  className="px-3 py-1.5 rounded-lg text-xs font-bold bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/40 transition-colors flex items-center gap-1"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Delete Selected</span>
                </button>

                <button
                  onClick={() => setSelectedIds([])}
                  className="px-2.5 py-1.5 rounded-lg text-xs text-slate-400 hover:text-white transition-colors"
                >
                  Clear Selection
                </button>
              </div>
            </div>
          )}

          {/* Applicants Roster Table (Desktop) & Cards (Mobile) */}
          {filteredRegistrations.length > 0 ? (
            <div className="rounded-3xl glass-panel border border-white/10 overflow-hidden shadow-2xl">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-white/10 bg-white/[0.02] text-[11px] uppercase tracking-wider text-slate-400">
                      <th className="py-3.5 pl-5 w-10">
                        <input
                          type="checkbox"
                          checked={allFilteredSelected}
                          onChange={handleToggleSelectAll}
                          className="rounded accent-amber-400 cursor-pointer"
                        />
                      </th>
                      <th className="py-3.5">Reg ID</th>
                      <th className="py-3.5">Athlete Name</th>
                      <th className="py-3.5">Contact Details</th>
                      <th className="py-3.5">Category & Style</th>
                      <th className="py-3.5">Status</th>
                      <th className="py-3.5">Fee / Method</th>
                      <th className="py-3.5 text-right pr-5">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {filteredRegistrations.map((r) => {
                      const isSelected = selectedIds.includes(r.id);
                      return (
                        <tr
                          key={r.id}
                          className={`hover:bg-white/5 transition-colors ${
                            isSelected ? 'bg-amber-500/5' : ''
                          }`}
                        >
                          <td className="py-3.5 pl-5">
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => handleToggleSelectOne(r.id)}
                              className="rounded accent-amber-400 cursor-pointer"
                            />
                          </td>

                          <td className="py-3.5 font-mono text-xs font-bold text-amber-400">
                            {r.regId}
                          </td>

                          <td className="py-3.5">
                            <div className="font-bold text-white flex items-center gap-1.5">
                              <span>{r.name}</span>
                              {r.age && <span className="text-xs text-slate-400 font-normal">({r.age}y)</span>}
                            </div>
                            <span className="text-[11px] text-slate-400">
                              Gender: {r.gender === 'M' ? 'Male' : r.gender === 'F' ? 'Female' : 'Other'}
                              {r.city ? ` • ${r.city}` : ''}
                            </span>
                          </td>

                          <td className="py-3.5">
                            <div className="font-mono text-xs text-slate-200">
                              +91 {r.mobile}
                            </div>
                            {r.whatsapp && r.whatsapp !== r.mobile && (
                              <div className="text-[10px] text-emerald-400 font-mono">
                                WA: +91 {r.whatsapp}
                              </div>
                            )}
                          </td>

                          <td className="py-3.5">
                            <div className="text-xs font-medium text-slate-200">
                              {r.experience || 'Intermediate'} • {r.category || 'Doubles'}
                            </div>
                            <span className="text-[11px] text-slate-400">
                              Style: {r.style || 'All-Rounder'}
                            </span>
                          </td>

                          <td className="py-3.5">
                            <span
                              className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold ${
                                r.status === 'approved' || r.status === 'paid'
                                  ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                                  : r.status === 'pending'
                                  ? 'bg-amber-500/15 text-amber-400 border border-amber-500/30'
                                  : 'bg-rose-500/15 text-rose-400 border border-rose-500/30'
                              }`}
                            >
                              {r.status === 'approved' && <CheckCircle2 className="w-3 h-3" />}
                              {r.status === 'pending' && <Clock className="w-3 h-3" />}
                              {r.status === 'rejected' && <XCircle className="w-3 h-3" />}
                              <span className="capitalize">{r.status}</span>
                            </span>
                          </td>

                          <td className="py-3.5">
                            <div className="font-mono text-xs font-bold text-white">
                              {formatINR(r.fee)}
                            </div>
                            <span className="text-[10px] text-slate-400 uppercase">
                              {r.method || 'UPI'} {r.txnId ? `• Ref: ${r.txnId.slice(-6)}` : ''}
                            </span>
                          </td>

                          <td className="py-3.5 text-right pr-5">
                            <div className="flex items-center justify-end gap-1.5">
                              {/* Primary Action: Approve & Add to Master Players Roster */}
                              {r.status !== 'approved' && (
                                <button
                                  onClick={() => approveRegistration(r.id)}
                                  title="Approve registration and add player to master roster"
                                  className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold text-slate-950 bg-emerald-400 hover:bg-emerald-300 transition-colors shadow"
                                >
                                  <UserPlus className="w-3.5 h-3.5" />
                                  <span>Approve</span>
                                </button>
                              )}

                              {/* Reject Action */}
                              {r.status === 'pending' && (
                                <button
                                  onClick={() => rejectRegistration(r.id)}
                                  title="Reject applicant"
                                  className="px-2 py-1 rounded-lg text-xs font-semibold text-rose-400 hover:bg-rose-500/10 transition-colors"
                                >
                                  Reject
                                </button>
                              )}

                              {/* View Details */}
                              <button
                                onClick={() => setViewDetailsTarget(r)}
                                title="View details"
                                className="p-1.5 text-slate-400 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
                              >
                                <Eye className="w-3.5 h-3.5" />
                              </button>

                              {/* Edit */}
                              <button
                                onClick={() => openEditModal(r)}
                                title="Edit applicant"
                                className="p-1.5 text-slate-400 hover:text-amber-400 hover:bg-white/10 rounded-lg transition-colors"
                              >
                                <Edit className="w-3.5 h-3.5" />
                              </button>

                              {/* Delete */}
                              <button
                                onClick={() => setDeleteTargetId(r.id)}
                                title="Delete record"
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
              <Users2 className="w-12 h-12 text-slate-500 mx-auto" />
              <h3 className="text-lg font-bold text-white">No Registered Applicants Found</h3>
              <p className="text-xs text-slate-400 max-w-md mx-auto">
                No submissions match your current filters. Share the public registration link to start receiving athlete applications.
              </p>
              <button
                onClick={() => setActiveTab('link')}
                className="px-4 py-2 rounded-xl text-xs font-bold text-slate-950 bg-amber-400 hover:bg-amber-300 transition-colors shadow"
              >
                Go to Registration Link & Sharing →
              </button>
            </div>
          )}
        </div>
      )}

      {/* TAB 3: Form Customization Settings */}
      {activeTab === 'settings' && (
        <div className="max-w-3xl space-y-6 animate-fade-in">
          <div className="rounded-3xl glass-card p-6 sm:p-8 border border-white/10 space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/30">
              <div className="space-y-1">
                <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-wider block">
                  Interactive Drag & Drop Customizer
                </span>
                <h3 className="text-base font-black text-white">
                  Advanced Form Builder & Field Manager
                </h3>
                <p className="text-xs text-slate-300">
                  Add custom questions, edit choice options (dropdown, radio, checkboxes), photo uploads, colors, reorder fields, and preview live desktop/mobile forms.
                </p>
              </div>

              <button
                onClick={() => setIsFormCustomizerOpen(true)}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-black bg-emerald-400 hover:bg-emerald-300 text-slate-950 transition-all shadow-lg shadow-emerald-500/20 shrink-0"
              >
                <Sliders className="w-4 h-4" />
                <span>Customize Registration Form</span>
              </button>
            </div>

            <div>
              <h2 className="text-xl font-bold text-white flex items-center gap-2">
                <Sliders className="w-5 h-5 text-amber-400" />
                <span>Public Registration Form Configuration</span>
              </h2>
              <p className="text-xs text-slate-400 mt-1">
                Customize which optional fields appear on the public registration page and choose whether they are mandatory.
              </p>
            </div>

            {/* General Settings */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Tournament Season Slug (URL Parameter)
                </label>
                <input
                  type="text"
                  value={regSettings.seasonSlug}
                  onChange={(e) =>
                    updateRegistrationSettings({
                      seasonSlug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-'),
                    })
                  }
                  className="w-full bg-slate-900 border border-white/10 rounded-xl px-3.5 py-2.5 text-sm text-white font-mono"
                />
                <span className="text-[11px] text-slate-500 mt-1 block">
                  e.g. season-4 generates: /register/season-4
                </span>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Maximum Athlete Capacity / Slot Limit
                </label>
                <input
                  type="number"
                  min={2}
                  max={256}
                  value={regSettings.maxSlots}
                  onChange={(e) =>
                    updateRegistrationSettings({ maxSlots: Number(e.target.value) || 32 })
                  }
                  className="w-full bg-slate-900 border border-white/10 rounded-xl px-3.5 py-2.5 text-sm text-white"
                />
              </div>
            </div>

            {/* Closed Notice Announcement */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Registration Closed Notice (Shown when registrations are disabled)
              </label>
              <textarea
                rows={2}
                value={regSettings.closedNotice || ''}
                onChange={(e) => updateRegistrationSettings({ closedNotice: e.target.value })}
                className="w-full bg-slate-900 border border-white/10 rounded-xl p-3 text-sm text-white placeholder-slate-500"
                placeholder="e.g. Registrations are currently closed. Please contact the tournament desk..."
              />
            </div>

            {/* Field Visibility & Requirement Matrix */}
            <div className="space-y-3 pt-4 border-t border-white/10">
              <h3 className="text-sm font-bold text-white flex items-center justify-between">
                <span>Field Customization Matrix</span>
                <span className="text-[11px] text-slate-400 font-normal">
                  * Full Name and Mobile Number are permanently mandatory
                </span>
              </h3>

              <div className="rounded-2xl border border-white/10 overflow-hidden divide-y divide-white/5">
                {[
                  { key: 'whatsapp', label: 'WhatsApp Number' },
                  { key: 'gender', label: 'Gender' },
                  { key: 'age', label: 'Athlete Age' },
                  { key: 'experience', label: 'Playing Experience (Beginner/Inter/Adv/Pro)' },
                  { key: 'category', label: 'Event Category (Doubles/Singles)' },
                  { key: 'style', label: 'Playing Style (Smash/Defensive/All-Rounder)' },
                  { key: 'city', label: 'City / Locality' },
                  { key: 'notes', label: 'Additional Information / Notes' },
                ].map(({ key, label }) => {
                  const fieldConfig = (regSettings.fields as any)[key] || {
                    visible: true,
                    required: false,
                  };
                  return (
                    <div
                      key={key}
                      className="p-3.5 flex items-center justify-between hover:bg-white/[0.02] text-xs"
                    >
                      <span className="font-medium text-slate-200">{label}</span>

                      <div className="flex items-center gap-6">
                        <label className="flex items-center gap-1.5 text-slate-400 hover:text-white cursor-pointer">
                          <input
                            type="checkbox"
                            checked={fieldConfig.visible}
                            onChange={(e) =>
                              updateRegistrationSettings({
                                fields: {
                                  ...regSettings.fields,
                                  [key]: { ...fieldConfig, visible: e.target.checked },
                                },
                              })
                            }
                            className="rounded accent-amber-400"
                          />
                          <span>Show on form</span>
                        </label>

                        <label className="flex items-center gap-1.5 text-slate-400 hover:text-white cursor-pointer">
                          <input
                            type="checkbox"
                            disabled={!fieldConfig.visible}
                            checked={fieldConfig.required && fieldConfig.visible}
                            onChange={(e) =>
                              updateRegistrationSettings({
                                fields: {
                                  ...regSettings.fields,
                                  [key]: { ...fieldConfig, required: e.target.checked },
                                },
                              })
                            }
                            className="rounded accent-rose-400 disabled:opacity-40"
                          />
                          <span>Mandatory</span>
                        </label>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* VIEW DETAILS MODAL */}
      {viewDetailsTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in overflow-y-auto">
          <div className="max-w-lg w-full rounded-3xl glass-panel p-6 sm:p-8 border border-white/10 shadow-2xl space-y-6 my-auto">
            <div className="flex items-start justify-between pb-4 border-b border-white/10">
              <div className="flex items-center gap-3">
                {(viewDetailsTarget.photoUrl || viewDetailsTarget.answers?.photo) && (
                  <img
                    src={viewDetailsTarget.photoUrl || viewDetailsTarget.answers?.photo}
                    alt="Athlete"
                    className="w-12 h-12 rounded-xl object-cover border border-white/20"
                  />
                )}
                <div>
                  <span className="text-[10px] uppercase font-bold tracking-wider text-amber-400 block font-mono">
                    {viewDetailsTarget.regId}
                  </span>
                  <h3 className="text-xl font-bold text-white">{viewDetailsTarget.name}</h3>
                  {viewDetailsTarget.tokenUsed && (
                    <span className="text-[10px] text-slate-400 font-mono">
                      Via Token: {viewDetailsTarget.tokenUsed}
                    </span>
                  )}
                </div>
              </div>
              <button
                onClick={() => setViewDetailsTarget(null)}
                className="text-slate-400 hover:text-white p-1"
              >
                ✕
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="p-3 rounded-xl bg-white/5 space-y-1">
                <span className="text-slate-400 text-[10px] uppercase block">Mobile Contact</span>
                <span className="font-mono font-bold text-white block">+91 {viewDetailsTarget.mobile}</span>
              </div>

              <div className="p-3 rounded-xl bg-white/5 space-y-1">
                <span className="text-slate-400 text-[10px] uppercase block">WhatsApp</span>
                <span className="font-mono font-bold text-emerald-400 block">
                  {viewDetailsTarget.whatsapp ? `+91 ${viewDetailsTarget.whatsapp}` : 'Same as Mobile'}
                </span>
              </div>

              <div className="p-3 rounded-xl bg-white/5 space-y-1">
                <span className="text-slate-400 text-[10px] uppercase block">Age / Gender</span>
                <span className="font-bold text-white block">
                  {viewDetailsTarget.age ? `${viewDetailsTarget.age} yrs` : 'Not specified'} • {viewDetailsTarget.gender}
                </span>
              </div>

              <div className="p-3 rounded-xl bg-white/5 space-y-1">
                <span className="text-slate-400 text-[10px] uppercase block">City / Locality</span>
                <span className="font-bold text-white block">{viewDetailsTarget.city || '—'}</span>
              </div>

              <div className="p-3 rounded-xl bg-white/5 space-y-1">
                <span className="text-slate-400 text-[10px] uppercase block">Experience</span>
                <span className="font-bold text-white block">{viewDetailsTarget.experience || 'Intermediate'}</span>
              </div>

              <div className="p-3 rounded-xl bg-white/5 space-y-1">
                <span className="text-slate-400 text-[10px] uppercase block">Playing Style</span>
                <span className="font-bold text-white block">{viewDetailsTarget.style || 'All-Rounder'}</span>
              </div>
            </div>

            {/* Custom Dynamic Questions Answers */}
            {viewDetailsTarget.answers && Object.keys(viewDetailsTarget.answers).length > 0 && (
              <div className="space-y-2 pt-2 border-t border-white/5">
                <span className="text-[11px] font-bold text-slate-300 uppercase tracking-wider block">
                  Custom Tournament Form Answers
                </span>
                <div className="space-y-1.5 max-h-40 overflow-y-auto">
                  {Object.entries(viewDetailsTarget.answers)
                    .filter(([k]) => k !== 'photo' && k !== 'name' && k !== 'mobile')
                    .map(([k, val]) => {
                      const matchedField = formConfig.fields?.find((f) => f.id === k);
                      const label = matchedField?.label || k;
                      const displayVal = Array.isArray(val) ? val.join(', ') : String(val);

                      return (
                        <div key={k} className="p-2.5 rounded-xl bg-white/[0.03] text-xs">
                          <span className="text-slate-400 text-[10px] block font-medium">
                            {label}
                          </span>
                          <span className="text-white font-semibold">
                            {displayVal || '—'}
                          </span>
                        </div>
                      );
                    })}
                </div>
              </div>
            )}

            {viewDetailsTarget.notes && (
              <div className="p-3 rounded-xl bg-white/5 text-xs space-y-1">
                <span className="text-slate-400 text-[10px] uppercase block">Applicant Notes</span>
                <p className="text-slate-200">{viewDetailsTarget.notes}</p>
              </div>
            )}

            <div className="flex items-center justify-between pt-4 border-t border-white/10">
              <span className="text-xs text-slate-400">
                Status: <span className="font-bold text-amber-400 uppercase">{viewDetailsTarget.status}</span>
              </span>

              {viewDetailsTarget.status !== 'approved' && (
                <button
                  onClick={() => {
                    approveRegistration(viewDetailsTarget.id);
                    setViewDetailsTarget(null);
                  }}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-slate-950 bg-emerald-400 hover:bg-emerald-300 transition-colors"
                >
                  Approve & Add to Players
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* EDIT MODAL */}
      {editTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in">
          <form
            onSubmit={handleSaveEdit}
            className="max-w-lg w-full rounded-3xl glass-panel p-6 sm:p-8 border border-white/10 shadow-2xl space-y-4"
          >
            <div className="flex items-start justify-between pb-3 border-b border-white/10">
              <h3 className="text-lg font-bold text-white">Edit Registration Details</h3>
              <button
                type="button"
                onClick={() => setEditTarget(null)}
                className="text-slate-400 hover:text-white"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-300 mb-1 font-semibold">Full Name *</label>
                <input
                  type="text"
                  required
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full bg-slate-900 border border-white/10 rounded-xl px-3 py-2 text-sm text-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 mb-1 font-semibold">Mobile Number *</label>
                  <input
                    type="tel"
                    required
                    value={editMobile}
                    onChange={(e) => setEditMobile(e.target.value.replace(/\D/g, ''))}
                    className="w-full bg-slate-900 border border-white/10 rounded-xl px-3 py-2 text-sm font-mono text-white"
                  />
                </div>

                <div>
                  <label className="block text-slate-300 mb-1 font-semibold">Age</label>
                  <input
                    type="number"
                    value={editAge}
                    onChange={(e) => setEditAge(e.target.value ? parseInt(e.target.value, 10) : '')}
                    className="w-full bg-slate-900 border border-white/10 rounded-xl px-3 py-2 text-sm text-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 mb-1 font-semibold">Gender</label>
                  <select
                    value={editGender}
                    onChange={(e) => setEditGender(e.target.value as any)}
                    className="w-full bg-slate-900 border border-white/10 rounded-xl px-3 py-2 text-sm text-white"
                  >
                    <option value="M">Male</option>
                    <option value="F">Female</option>
                    <option value="Other">Other</option>
                  </select>
                </div>

                <div>
                  <label className="block text-slate-300 mb-1 font-semibold">City</label>
                  <input
                    type="text"
                    value={editCity}
                    onChange={(e) => setEditCity(e.target.value)}
                    className="w-full bg-slate-900 border border-white/10 rounded-xl px-3 py-2 text-sm text-white"
                  />
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-4 border-t border-white/10">
              <button
                type="button"
                onClick={() => setEditTarget(null)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-300 hover:text-white bg-white/5"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-2 rounded-xl text-xs font-bold text-slate-950 bg-amber-400 hover:bg-amber-300"
              >
                Save Changes
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Delete Single Record Confirmation */}
      <ConfirmModal
        isOpen={!!deleteTargetId}
        title="Delete Registration Record"
        message="Are you sure you want to permanently delete this registration record from the tournament database?"
        confirmLabel="Delete Record"
        variant="danger"
        onConfirm={() => {
          if (deleteTargetId) deleteRegistration(deleteTargetId);
          setDeleteTargetId(null);
        }}
        onCancel={() => setDeleteTargetId(null)}
      />

      {/* Bulk Delete Modal */}
      <ConfirmModal
        isOpen={bulkDeleteModalOpen}
        title={`Delete ${selectedIds.length} Selected Registrations`}
        message={`Are you sure you want to permanently delete ${selectedIds.length} registrations? This operation will remove them from the database.`}
        confirmLabel="Delete Selected"
        variant="danger"
        onConfirm={handleConfirmBulkDelete}
        onCancel={() => setBulkDeleteModalOpen(false)}
      />

      {/* Bulk Approve Modal */}
      <ConfirmModal
        isOpen={bulkApproveModalOpen}
        title={`Approve ${selectedIds.length} Selected Registrations`}
        message={`This will approve ${selectedIds.length} applicants and add them to the official Players directory so they can be assigned to teams and token draws.`}
        confirmLabel="Approve & Add to Players"
        variant="primary"
        onConfirm={handleConfirmBulkApprove}
        onCancel={() => setBulkApproveModalOpen(false)}
      />

      {/* FORM BUILDER CUSTOMIZER MODAL */}
      <FormCustomizerModal
        isOpen={isFormCustomizerOpen}
        initialConfig={formConfig}
        onClose={() => setIsFormCustomizerOpen(false)}
        onSave={async (config, publish) => {
          await saveFormConfig(config, publish);
        }}
      />

      {/* REGENERATE SHAREABLE LINK MODAL */}
      <RegenerateLinkModal
        isOpen={isRegenerateModalOpen}
        onClose={() => setIsRegenerateModalOpen(false)}
        seasonSlug={currentSeasonSlug}
        seasonTitle={formConfig.seasonTitle || state.settings.season || 'Season IV'}
        tokens={tokens}
        activeToken={activeToken}
        onRegenerate={regenerateToken}
        onToggleStatus={toggleTokenStatus}
      />
    </div>
  );
};
