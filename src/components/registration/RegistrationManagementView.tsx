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
  CreditCard,
  IndianRupee,
  History,
  FileText,
  Plus,
  ArrowUp,
  ArrowDown,
  ToggleLeft,
  ToggleRight,
  Globe,
} from 'lucide-react';
import { useTournament, sportsAudio } from '../../context/TournamentContext';
import { AuthService } from '../../services/authService';
import { SupabaseService } from '../../services/supabaseService';
import {
  formatINR,
  calculateRegistrationStats,
  exportRegistrationsToCSV,
  downloadFile,
  validateIndianMobile,
} from '../../utils/tournamentEngine';
import { Registration, RegistrationSettings, RegistrationFormConfig, PaymentStatus, RegistrationFormField } from '../../types/tournament';
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
    verifyPayment,
    deleteRegistration,
    deleteRegistrationsBulk,
    bulkApproveRegistrations,
  } = useTournament();

  const regSettings = state.registrationSettings;
  const stats = calculateRegistrationStats(state.registrations);

  // Active view tab inside Player Registration Hub
  const [activeTab, setActiveTab] = useState<'link' | 'builder' | 'payment' | 'roster'>('link');

  // Modals
  const [isFormCustomizerOpen, setIsFormCustomizerOpen] = useState(false);
  const [isRegenerateModalOpen, setIsRegenerateModalOpen] = useState(false);

  // Payment Verification Modal
  const [verifyTarget, setVerifyTarget] = useState<Registration | null>(null);
  const [verifyStatus, setVerifyStatus] = useState<PaymentStatus>('paid');
  const [verifyNote, setVerifyNote] = useState('');
  const [verifyAdminName, setVerifyAdminName] = useState('Admin');
  const [isVerifying, setIsVerifying] = useState(false);

  // Copy link feedback
  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedSlug, setCopiedSlug] = useState(false);

  // Search & Filters in Roster
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'approved' | 'rejected' | 'pending_verification' | 'paid' | 'failed'>('all');

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

  // Custom Registration URL Slug State
  const initialCustomSlug =
    formConfig.appearance?.customUrlSlug || formConfig.customUrlSlug || 'register';
  const [customSlugInput, setCustomSlugInput] = useState<string>(initialCustomSlug);
  const [activeCustomSlug, setActiveCustomSlug] = useState<string>(initialCustomSlug);
  const [isSavingSlug, setIsSavingSlug] = useState(false);
  const [slugSaveSuccess, setSlugSaveSuccess] = useState<string | null>(null);
  const [slugSaveError, setSlugSaveError] = useState<string | null>(null);

  // Sync active custom slug when formConfig updates
  React.useEffect(() => {
    const slug = formConfig.appearance?.customUrlSlug || formConfig.customUrlSlug || 'register';
    setActiveCustomSlug(slug);
    setCustomSlugInput(slug);
  }, [formConfig.appearance?.customUrlSlug, formConfig.customUrlSlug]);

  // Base URL calculation with active token
  const origin = typeof window !== 'undefined' ? window.location.origin : 'https://smash-premier-league.web.app';
  const currentSeasonSlug = formConfig.seasonSlug || regSettings.seasonSlug || 'season-4';
  const cleanCustomSlug = (activeCustomSlug || 'register').trim().toLowerCase();
  const customRegistrationUrl = `${origin}/${cleanCustomSlug}${
    activeToken ? `?token=${encodeURIComponent(activeToken.token)}` : ''
  }`;
  const publicRegistrationUrl = customRegistrationUrl;

  const validateSlug = (slug: string) => {
    const s = slug.toLowerCase().trim();
    if (!s) return { valid: false, error: 'Slug cannot be empty' };
    if (s.length < 3) return { valid: false, error: 'Slug must be at least 3 characters' };
    if (s.length > 60) return { valid: false, error: 'Slug cannot exceed 60 characters' };
    if (!/^[a-z0-9-]+$/.test(s)) {
      return { valid: false, error: 'Only lowercase letters, numbers, and hyphens (-) allowed' };
    }
    if (s.startsWith('-') || s.endsWith('-') || s.includes('--')) {
      return { valid: false, error: 'Cannot start, end, or have consecutive hyphens' };
    }
    const reserved = [
      'admin', 'login', 'api', 'dashboard', 'fixtures', 'standings', 'teams', 'players',
      'knockout', 'tokens', 'registration', 'registered', 'statistics', 'champion', 'settings',
      'public', 'dist', 'src'
    ];
    if (reserved.includes(s)) {
      return { valid: false, error: `"${s}" is a reserved system path and cannot be used` };
    }
    return { valid: true, error: null };
  };

  const handleSaveCustomSlug = async () => {
    const check = validateSlug(customSlugInput);
    if (!check.valid) {
      setSlugSaveError(check.error);
      return;
    }
    setSlugSaveError(null);
    setIsSavingSlug(true);
    const cleaned = customSlugInput.toLowerCase().trim();
    try {
      // 1. Update component and context state immediately
      setActiveCustomSlug(cleaned);
      const updatedConfig: RegistrationFormConfig = {
        ...formConfig,
        customUrlSlug: cleaned,
        appearance: {
          ...formConfig.appearance,
          customUrlSlug: cleaned,
        },
      };

      // 2. Persist to TournamentContext state & Supabase PostgreSQL directly
      await saveFormConfig(updatedConfig, false);
      if (SupabaseService.isAvailable()) {
        await SupabaseService.saveCustomUrlSlug(cleaned, currentSeasonSlug);
      }

      // 3. Gracefully notify local backend route without failing if on static hosting (e.g. Vercel)
      try {
        const res = await fetch('/api/registration-url', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...AuthService.getAuthHeader() },
          body: JSON.stringify({ customUrlSlug: cleaned, seasonSlug: currentSeasonSlug }),
        });
        const rawText = await res.text().catch(() => '');
        if (rawText && rawText.trim()) {
          try {
            const data = JSON.parse(rawText);
            if (data && !res.ok && data.error) {
              console.warn('Backend custom-url sync warning:', data.error);
            }
          } catch {
            // Not a JSON response, ignore
          }
        }
      } catch {
        // Safe to ignore on static/SPA hosting environments like Vercel
      }

      sportsAudio.playFanfare();
      setSlugSaveSuccess(`Registration link successfully set to /${cleaned}`);
      setTimeout(() => setSlugSaveSuccess(null), 4000);
    } catch (err: any) {
      setSlugSaveError(err?.message || 'Error updating custom slug');
    } finally {
      setIsSavingSlug(false);
    }
  };

  const handleResetSlugToDefault = async () => {
    setIsSavingSlug(true);
    try {
      setActiveCustomSlug('register');
      setCustomSlugInput('register');
      const updatedConfig: RegistrationFormConfig = {
        ...formConfig,
        customUrlSlug: 'register',
        appearance: {
          ...formConfig.appearance,
          customUrlSlug: 'register',
        },
      };
      await saveFormConfig(updatedConfig, false);
      if (SupabaseService.isAvailable()) {
        await SupabaseService.saveCustomUrlSlug('register', currentSeasonSlug);
      }

      try {
        await fetch('/api/registration-url/reset', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...AuthService.getAuthHeader() },
          body: JSON.stringify({ seasonSlug: currentSeasonSlug }),
        });
      } catch {}

      setSlugSaveSuccess('Registration link reset to default (/register)');
      setTimeout(() => setSlugSaveSuccess(null), 3000);
    } catch (e: any) {
      setSlugSaveError(e?.message || 'Error resetting slug');
    } finally {
      setIsSavingSlug(false);
    }
  };

  const handleCopyLink = () => {
    navigator.clipboard.writeText(customRegistrationUrl);
    setCopiedLink(true);
    setCopiedSlug(true);
    setTimeout(() => {
      setCopiedLink(false);
      setCopiedSlug(false);
    }, 2000);
  };
  const handleCopyCustomLink = handleCopyLink;

  // WhatsApp share text with active token & customized URL
  const whatsAppShareText = `🏸 *Smash Premier League (S.P.L.) — Player Registration is OPEN!*\n\n🏆 *Tournament:* ${formConfig.tournamentName || state.settings.name}\n🌟 *Season:* ${formConfig.seasonTitle || state.settings.season || regSettings.seasonTitle}\n📅 *Date:* ${formConfig.date || state.settings.date}\n📍 *Venue:* ${formConfig.venue || state.settings.venue}\n💰 *Entry Fee:* ${formatINR(formConfig.entryFee ?? (state.settings.entryFee || 500))}\n\n👉 *Click here to submit your player entry:* \n${customRegistrationUrl}\n\n_Register early to guarantee your tournament slot!_`;
  const customWhatsAppShareText = whatsAppShareText;

  const handleShareWhatsApp = () => {
    const url = `https://wa.me/?text=${encodeURIComponent(whatsAppShareText)}`;
    window.open(url, '_blank');
  };
  const handleShareCustomWhatsApp = handleShareWhatsApp;

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
      if (statusFilter === 'approved' && r.status !== 'approved') return false;
      if (statusFilter === 'pending' && r.status !== 'pending') return false;
      if (statusFilter === 'rejected' && r.status !== 'rejected') return false;
      if (
        statusFilter === 'pending_verification' &&
        r.paymentStatus !== 'pending_verification' &&
        (!r.txnId || r.paymentStatus === 'paid')
      )
        return false;
      if (statusFilter === 'paid' && r.paymentStatus !== 'paid' && r.status !== 'paid') return false;
      if (statusFilter === 'failed' && r.paymentStatus !== 'failed' && r.paymentStatus !== 'cancelled')
        return false;
    }
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      const matchName = r.name.toLowerCase().includes(q);
      const matchMobile = r.mobile.includes(q);
      const matchRegId = r.regId.toLowerCase().includes(q);
      const matchCity = r.city ? r.city.toLowerCase().includes(q) : false;
      const matchTxn = r.txnId ? r.txnId.toLowerCase().includes(q) : false;
      if (!matchName && !matchMobile && !matchRegId && !matchCity && !matchTxn) return false;
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
              ? 'bg-amber-400 text-slate-950 shadow-md font-black'
              : 'text-slate-400 hover:text-white hover:bg-white/5'
          }`}
        >
          <Link2 className="w-4 h-4" />
          <span>Registration Link & Sharing</span>
        </button>

        <button
          onClick={() => setActiveTab('builder')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
            activeTab === 'builder'
              ? 'bg-amber-400 text-slate-950 shadow-md font-black'
              : 'text-slate-400 hover:text-white hover:bg-white/5'
          }`}
        >
          <Sliders className="w-4 h-4" />
          <span>Form Builder & Fields</span>
        </button>

        <button
          onClick={() => setActiveTab('payment')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
            activeTab === 'payment'
              ? 'bg-amber-400 text-slate-950 shadow-md font-black'
              : 'text-slate-400 hover:text-white hover:bg-white/5'
          }`}
        >
          <CreditCard className="w-4 h-4" />
          <span>Payment & UPI Configuration</span>
        </button>

        <button
          onClick={() => setActiveTab('roster')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
            activeTab === 'roster'
              ? 'bg-amber-400 text-slate-950 shadow-md font-black'
              : 'text-slate-400 hover:text-white hover:bg-white/5'
          }`}
        >
          <Users2 className="w-4 h-4" />
          <span>Applicants & Payments Roster</span>
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

            {/* DEDICATED REGISTRATION LINK SETTINGS & CUSTOM URL MANAGEMENT */}
            <div className="p-5 sm:p-6 rounded-2xl bg-slate-950/90 border border-amber-500/20 space-y-5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-white/10">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center font-bold">
                    <Globe className="w-4 h-4 text-amber-400" />
                  </div>
                  <div>
                    <h3 className="text-sm sm:text-base font-bold text-white flex items-center gap-2">
                      <span>Registration Link Settings</span>
                      <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-amber-500/15 text-amber-300 border border-amber-500/30">
                        Live Slug Routing
                      </span>
                    </h3>
                    <p className="text-xs text-slate-400">
                      Customize your tournament's public registration URL. The routing system and Supabase will recognize your custom slug directly.
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleToggleRegistrationStatus}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold border transition-colors ${
                      regSettings.enabled
                        ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-300 hover:bg-emerald-500/25'
                        : 'bg-rose-500/15 border-rose-500/30 text-rose-300 hover:bg-rose-500/25'
                    }`}
                  >
                    <Power className="w-3.5 h-3.5" />
                    <span>{regSettings.enabled ? 'Public Link: Active' : 'Public Link: Disabled'}</span>
                  </button>
                </div>
              </div>

              {/* Slug Input with Prefix */}
              <div className="space-y-2">
                <label className="block text-xs font-bold text-slate-300 flex items-center justify-between">
                  <span>Custom URL Slug</span>
                  <span className="text-[11px] font-normal text-slate-400">
                    Allowed: lowercase letters (a-z), numbers (0-9), and hyphens (-)
                  </span>
                </label>

                <div className="flex flex-col sm:flex-row items-stretch gap-2">
                  <div className="flex items-center flex-1 rounded-xl bg-slate-900 border border-white/10 overflow-hidden focus-within:border-amber-400 transition-colors">
                    <span className="bg-white/5 px-3 py-2 text-xs sm:text-sm font-mono text-slate-400 border-r border-white/10 select-none shrink-0">
                      {origin}/
                    </span>
                    <input
                      type="text"
                      value={customSlugInput}
                      onChange={(e) => {
                        const val = e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-');
                        setCustomSlugInput(val);
                        setSlugSaveError(null);
                        setSlugSaveSuccess(null);
                      }}
                      placeholder="spl-maharajganj-2026"
                      className="w-full bg-transparent px-3 py-2 text-xs sm:text-sm font-mono font-bold text-white placeholder-slate-600 focus:outline-none"
                    />
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      disabled={isSavingSlug}
                      onClick={handleSaveCustomSlug}
                      className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold text-slate-950 bg-amber-400 hover:bg-amber-300 transition-all shadow-md shadow-amber-500/20 disabled:opacity-50"
                    >
                      {isSavingSlug ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                      <span>{isSavingSlug ? 'Publishing...' : 'Save & Publish URL'}</span>
                    </button>

                    <button
                      type="button"
                      disabled={isSavingSlug || activeCustomSlug === 'register'}
                      onClick={handleResetSlugToDefault}
                      className="px-3 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-white bg-white/5 hover:bg-white/10 transition-colors disabled:opacity-40"
                      title="Reset to default /register"
                    >
                      Reset Default
                    </button>
                  </div>
                </div>

                {/* Validation and Live Feedback */}
                {(() => {
                  const check = validateSlug(customSlugInput);
                  if (!check.valid) {
                    return (
                      <div className="flex items-center gap-1.5 text-xs text-rose-400 pt-1 font-medium">
                        <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                        <span>{check.error}</span>
                      </div>
                    );
                  }
                  return (
                    <div className="flex items-center gap-1.5 text-xs text-emerald-400 pt-1 font-medium">
                      <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                      <span>Valid URL Slug: Preview as <strong className="font-mono text-white underline">{origin}/{customSlugInput.toLowerCase().trim()}</strong></span>
                    </div>
                  );
                })()}

                {slugSaveSuccess && (
                  <div className="p-3 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-xs font-semibold flex items-center justify-between animate-fade-in">
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                      <span>{slugSaveSuccess}</span>
                    </div>
                    <span className="text-[10px] uppercase font-bold text-emerald-400 bg-emerald-500/20 px-2 py-0.5 rounded">
                      Active
                    </span>
                  </div>
                )}

                {slugSaveError && (
                  <div className="p-3 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs font-semibold flex items-center gap-2 animate-fade-in">
                    <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
                    <span>{slugSaveError}</span>
                  </div>
                )}
              </div>

              {/* Active Public URL Display & Sharing Box */}
              <div className="p-3.5 rounded-xl bg-black/40 border border-white/5 space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                    Active Tournament Registration Link:
                  </span>
                  <span className="text-[11px] text-amber-400 font-mono">
                    Routes directly in SPA & Supabase
                  </span>
                </div>

                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 p-2 rounded-xl bg-slate-900 border border-white/10">
                  <div className="flex items-center gap-2 px-2 py-1 flex-1 min-w-0">
                    <Link2 className="w-4 h-4 text-amber-400 shrink-0" />
                    <span className="font-mono text-xs sm:text-sm text-slate-200 truncate select-all">
                      {customRegistrationUrl}
                    </span>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      type="button"
                      onClick={handleCopyCustomLink}
                      className="flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold text-slate-950 bg-amber-400 hover:bg-amber-300 transition-all shadow"
                    >
                      {copiedSlug ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                      <span>{copiedSlug ? 'Copied!' : 'Copy Link'}</span>
                    </button>

                    <button
                      type="button"
                      onClick={handleShareCustomWhatsApp}
                      className="flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold text-slate-950 bg-emerald-400 hover:bg-emerald-300 transition-colors shadow"
                      title="Share custom registration link on WhatsApp"
                    >
                      <MessageCircle className="w-3.5 h-3.5" />
                      <span>WhatsApp</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => onOpenPublicForm && onOpenPublicForm(cleanCustomSlug)}
                      className="p-1.5 text-slate-400 hover:text-white bg-white/5 hover:bg-white/10 rounded-lg transition-colors"
                      title="Test Custom Link in Browser"
                    >
                      <ExternalLink className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>

              {/* Quick Info & Features */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-1">
                <div className="p-3.5 rounded-xl bg-white/[0.03] border border-white/5 space-y-2 text-xs">
                  <span className="font-bold text-white flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                    <span>Real-time Form Synchronization</span>
                  </span>
                  <ul className="space-y-1 text-slate-300 text-[11px]">
                    <li className="flex items-center gap-1.5">
                      <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                      <span>Same published form loaded on Homepage, Custom URL & WhatsApp</span>
                    </li>
                    <li className="flex items-center gap-1.5">
                      <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                      <span>Custom questions dynamically saved to Supabase (answers_json)</span>
                    </li>
                    <li className="flex items-center gap-1.5">
                      <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                      <span>Instant zero-refresh synchronization to Admin Roster</span>
                    </li>
                  </ul>
                </div>

                {/* Prefilled WhatsApp Message */}
                <div className="p-3.5 rounded-xl bg-white/[0.03] border border-white/5 space-y-1.5 text-xs">
                  <span className="font-bold text-emerald-400 flex items-center gap-1.5">
                    <MessageCircle className="w-3.5 h-3.5" />
                    <span>WhatsApp Broadcast Message Preview</span>
                  </span>
                  <p className="font-mono text-[10px] text-slate-300 bg-black/40 p-2 rounded-lg border border-white/5 line-clamp-2 leading-relaxed">
                    {customWhatsAppShareText}
                  </p>
                  <button
                    type="button"
                    onClick={handleShareCustomWhatsApp}
                    className="text-[11px] text-emerald-400 hover:text-emerald-300 font-semibold flex items-center gap-1"
                  >
                    <span>Send broadcast to tournament groups →</span>
                  </button>
                </div>
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
          {/* Financial & Application Summary Metrics */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
            <div className="rounded-2xl p-4 glass-card border border-white/10 space-y-1">
              <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider flex items-center gap-1.5">
                <Users2 className="w-3.5 h-3.5 text-amber-400" />
                <span>Total Submissions</span>
              </span>
              <div className="text-2xl sm:text-3xl font-black text-white font-mono">
                {stats.total}
              </div>
              <span className="text-[11px] text-slate-500 block">
                Across {regSettings.seasonSlug || 'season-4'}
              </span>
            </div>

            <div className="rounded-2xl p-4 glass-card border border-emerald-500/20 bg-emerald-500/5 space-y-1">
              <span className="text-[10px] uppercase font-bold text-emerald-400 tracking-wider flex items-center gap-1.5">
                <IndianRupee className="w-3.5 h-3.5 text-emerald-400" />
                <span>Verified Revenue</span>
              </span>
              <div className="text-2xl sm:text-3xl font-black text-emerald-300 font-mono">
                {formatINR(
                  state.registrations
                    .filter((r) => r.paymentStatus === 'paid' || r.status === 'paid' || r.status === 'approved')
                    .reduce((acc, r) => acc + (r.fee || 0), 0)
                )}
              </div>
              <span className="text-[11px] text-emerald-400/70 block">
                Confirmed in tournament account
              </span>
            </div>

            <div className="rounded-2xl p-4 glass-card border border-amber-500/20 bg-amber-500/5 space-y-1">
              <span className="text-[10px] uppercase font-bold text-amber-400 tracking-wider flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-amber-400" />
                <span>Pending Verification</span>
              </span>
              <div className="text-2xl sm:text-3xl font-black text-amber-300 font-mono">
                {
                  state.registrations.filter(
                    (r) =>
                      r.paymentStatus === 'pending_verification' ||
                      (r.txnId && r.paymentStatus !== 'paid' && r.status !== 'approved')
                  ).length
                }
              </div>
              <span className="text-[11px] text-amber-400/70 block">
                {formatINR(
                  state.registrations
                    .filter(
                      (r) =>
                        r.paymentStatus === 'pending_verification' ||
                        (r.txnId && r.paymentStatus !== 'paid' && r.status !== 'approved')
                    )
                    .reduce((acc, r) => acc + (r.fee || 0), 0)
                )}{' '}
                awaiting admin audit
              </span>
            </div>

            <div className="rounded-2xl p-4 glass-card border border-blue-500/20 bg-blue-500/5 space-y-1">
              <span className="text-[10px] uppercase font-bold text-blue-400 tracking-wider flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-blue-400" />
                <span>Confirmed Players</span>
              </span>
              <div className="text-2xl sm:text-3xl font-black text-blue-300 font-mono">
                {stats.approvedCount}
              </div>
              <span className="text-[11px] text-blue-400/70 block">
                Vetted & added to roster
              </span>
            </div>
          </div>

          {/* Action & Filter Bar */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 p-3 rounded-2xl glass-panel">
            <div className="relative flex-1">
              <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Search by player name, mobile, city, SPL ID, or UTR / Txn Ref..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full bg-slate-900 border border-white/10 rounded-xl pl-9 pr-4 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-amber-400"
              />
            </div>

            <div className="flex items-center gap-2 overflow-x-auto">
              {/* Status Filter */}
              <div className="flex items-center gap-1 p-1 bg-white/5 rounded-xl shrink-0 overflow-x-auto">
                {[
                  { id: 'all', label: `All (${stats.total})` },
                  {
                    id: 'pending_verification',
                    label: `🟡 Verify Payments (${
                      state.registrations.filter(
                        (r) =>
                          r.paymentStatus === 'pending_verification' ||
                          (r.txnId && r.paymentStatus !== 'paid' && r.status !== 'approved')
                      ).length
                    })`,
                  },
                  {
                    id: 'paid',
                    label: `🟢 Paid (${
                      state.registrations.filter(
                        (r) => r.paymentStatus === 'paid' || r.status === 'paid'
                      ).length
                    })`,
                  },
                  { id: 'pending', label: `Pending Approval (${stats.pendingCount})` },
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
              <div className="hidden md:block overflow-x-auto">
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
                      <th className="py-3.5">Admission Status</th>
                      <th className="py-3.5">Payment & UTR</th>
                      <th className="py-3.5 text-right pr-5">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {filteredRegistrations.map((r) => {
                      const isSelected = selectedIds.includes(r.id);
                      const paymentStat = r.paymentStatus || (r.status === 'approved' ? 'paid' : (r.txnId ? 'pending_verification' : 'pending'));
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
                            <div>{r.regId}</div>
                            <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-white/10 text-slate-300 border border-white/10 mt-0.5">
                              v{r.formVersion || 1}
                            </span>
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
                            <div className="flex items-center gap-2">
                              <span className="font-mono text-xs font-bold text-white">
                                {formatINR(r.fee)}
                              </span>
                              <span
                                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                  paymentStat === 'paid'
                                    ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                                    : paymentStat === 'pending_verification'
                                    ? 'bg-amber-500/15 text-amber-400 border border-amber-500/30'
                                    : paymentStat === 'failed'
                                    ? 'bg-rose-500/15 text-rose-400 border border-rose-500/30'
                                    : 'bg-slate-700/50 text-slate-400 border border-white/10'
                                }`}
                              >
                                {paymentStat === 'paid' ? 'Paid' : paymentStat === 'pending_verification' ? 'Audit Pending' : paymentStat}
                              </span>
                            </div>
                            <span className="text-[10px] text-slate-400 font-mono block mt-0.5">
                              {r.txnId ? `UTR: ${r.txnId}` : (r.method || 'UPI')}
                            </span>
                          </td>

                          <td className="py-3.5 text-right pr-5">
                            <div className="flex items-center justify-end gap-1.5">
                              {/* Payment Verify Modal Trigger */}
                              <button
                                onClick={() => {
                                  setVerifyTarget(r);
                                  setVerifyStatus((r.paymentStatus as any) || (r.txnId ? 'paid' : 'pending_verification'));
                                  setVerifyNote(r.notes || '');
                                  setVerifyAdminName('Admin');
                                }}
                                title="Audit & verify UPI payment / UTR"
                                className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-bold bg-amber-400/15 hover:bg-amber-400/25 text-amber-300 border border-amber-400/30 transition-colors"
                              >
                                <CreditCard className="w-3 h-3 text-amber-400" />
                                <span>Verify</span>
                              </button>

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

              {/* Mobile Card List for Smartphones & Tablets */}
              <div className="md:hidden divide-y divide-white/10">
                {filteredRegistrations.map((r) => {
                  const isSelected = selectedIds.includes(r.id);
                  const paymentStat = r.paymentStatus || (r.status === 'approved' ? 'paid' : (r.txnId ? 'pending_verification' : 'pending'));
                  return (
                    <div
                      key={r.id}
                      className={`p-4 space-y-3 transition-colors ${
                        isSelected ? 'bg-amber-500/5' : ''
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => handleToggleSelectOne(r.id)}
                            className="rounded accent-amber-400 cursor-pointer h-4 w-4"
                          />
                          <span className="font-mono text-xs font-bold text-amber-400">
                            {r.regId}
                          </span>
                          <span className="text-[10px] font-semibold bg-white/10 text-slate-300 px-1.5 py-0.5 rounded">
                            v{r.formVersion || 1}
                          </span>
                        </div>
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            r.status === 'approved' || r.status === 'paid'
                              ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                              : r.status === 'pending'
                              ? 'bg-amber-500/15 text-amber-400 border border-amber-500/30'
                              : 'bg-rose-500/15 text-rose-400 border border-rose-500/30'
                          }`}
                        >
                          {r.status === 'approved' && <CheckCircle2 className="w-2.5 h-2.5" />}
                          {r.status === 'pending' && <Clock className="w-2.5 h-2.5" />}
                          {r.status === 'rejected' && <XCircle className="w-2.5 h-2.5" />}
                          <span className="capitalize">{r.status}</span>
                        </span>
                      </div>

                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <h4 className="font-bold text-white text-base">
                            {r.name} {r.age && <span className="text-xs text-slate-400 font-normal">({r.age}y)</span>}
                          </h4>
                          <p className="text-xs text-slate-400 mt-0.5">
                            {r.gender === 'M' ? 'Male' : r.gender === 'F' ? 'Female' : 'Other'}
                            {r.city ? ` • ${r.city}` : ''}
                          </p>
                        </div>
                        <div className="text-right">
                          <span className="font-mono text-xs font-bold text-white block">
                            {formatINR(r.fee)}
                          </span>
                          <span
                            className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold ${
                              paymentStat === 'paid'
                                ? 'bg-emerald-500/15 text-emerald-400'
                                : paymentStat === 'pending_verification'
                                ? 'bg-amber-500/15 text-amber-400'
                                : 'bg-slate-700/50 text-slate-400'
                            }`}
                          >
                            {paymentStat === 'paid' ? 'Paid' : paymentStat === 'pending_verification' ? 'Audit Pending' : paymentStat}
                          </span>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-2 text-xs bg-black/30 p-2.5 rounded-xl border border-white/5">
                        <div>
                          <span className="text-[10px] uppercase font-bold text-slate-500 block">Contact</span>
                          <span className="font-mono text-slate-200 block">+91 {r.mobile}</span>
                        </div>
                        <div>
                          <span className="text-[10px] uppercase font-bold text-slate-500 block">Category & Style</span>
                          <span className="text-slate-200 block truncate">{r.category || 'Doubles'} • {r.style || 'All-Rounder'}</span>
                        </div>
                      </div>

                      {/* Mobile Action Buttons */}
                      <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-white/5">
                        <div className="flex items-center gap-1.5">
                          {r.status === 'pending' && (
                            <button
                              onClick={() => approveRegistration(r.id)}
                              className="px-3 py-1.5 rounded-lg text-xs font-bold text-emerald-300 bg-emerald-500/20 border border-emerald-500/30 hover:bg-emerald-500/30"
                            >
                              Approve
                            </button>
                          )}
                          {r.status === 'pending' && (
                            <button
                              onClick={() => rejectRegistration(r.id)}
                              className="px-3 py-1.5 rounded-lg text-xs font-semibold text-rose-400 hover:bg-rose-500/10"
                            >
                              Reject
                            </button>
                          )}
                        </div>
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => setVerifyTarget(r)}
                            className="p-2 text-slate-300 hover:text-white bg-white/5 rounded-lg text-xs flex items-center gap-1"
                            title="Verify Payment"
                          >
                            <CreditCard className="w-3.5 h-3.5 text-amber-400" />
                            <span>Payment</span>
                          </button>
                          <button
                            onClick={() => setViewDetailsTarget(r)}
                            className="p-2 text-slate-300 hover:text-white bg-white/5 rounded-lg"
                            title="View details"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => openEditModal(r)}
                            className="p-2 text-slate-300 hover:text-amber-400 bg-white/5 rounded-lg"
                            title="Edit applicant"
                          >
                            <Edit className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => setDeleteTargetId(r.id)}
                            className="p-2 text-slate-400 hover:text-rose-400 bg-white/5 rounded-lg"
                            title="Delete record"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
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

      {/* TAB: Form Builder & Fields Configuration */}
      {activeTab === 'builder' && (
        <div className="space-y-6 animate-fade-in">
          {/* Hero Builder Header Card */}
          <div className="rounded-3xl glass-card p-6 sm:p-8 border border-white/10 space-y-6 bg-gradient-to-br from-emerald-500/10 via-transparent to-transparent">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <span className="text-[10px] uppercase font-bold tracking-widest text-emerald-400 block">
                  Interactive Form Designer
                </span>
                <h2 className="text-xl sm:text-2xl font-black text-white">
                  Badminton Registration Form Builder
                </h2>
                <p className="text-xs sm:text-sm text-slate-300 mt-1">
                  Add, customize, reorder, or toggle fields across 15 badminton-specific field types. Changes take effect on the public registration link immediately.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2 shrink-0">
                <button
                  onClick={async () => {
                    await saveFormConfig({ ...formConfig, isPublished: true }, true);
                  }}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-black bg-amber-400 hover:bg-amber-300 text-slate-950 transition-all shadow-lg shadow-amber-400/20"
                  title="Save customizations to persistent database and update active registration link"
                >
                  <Sparkles className="w-4 h-4" />
                  <span>Publish / Generate Link</span>
                </button>
                <button
                  onClick={() => setIsFormCustomizerOpen(true)}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/40 transition-all shadow-sm"
                >
                  <Sliders className="w-4 h-4 text-emerald-400" />
                  <span>Launch Visual Builder</span>
                </button>
                <button
                  onClick={() => onOpenPublicForm && onOpenPublicForm(currentSeasonSlug)}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold bg-white/10 hover:bg-white/15 text-white transition-colors"
                >
                  <Eye className="w-4 h-4 text-amber-400" />
                  <span>Live Preview</span>
                </button>
              </div>
            </div>

            {/* Quick General Form Settings */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-4 border-t border-white/10">
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1.5">
                  Form Heading / Headline
                </label>
                <input
                  type="text"
                  value={formConfig.appearance?.formTitle || ''}
                  onChange={(e) => {
                    saveFormConfig({
                      ...formConfig,
                      appearance: {
                        ...formConfig.appearance,
                        formTitle: e.target.value,
                      },
                    });
                  }}
                  placeholder="Official Player Registration"
                  className="w-full bg-slate-900 border border-white/10 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-amber-400"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1.5">
                  Submit Button Text
                </label>
                <input
                  type="text"
                  value={formConfig.appearance?.submitButtonText || 'Confirm & Submit Registration'}
                  onChange={(e) => {
                    saveFormConfig({
                      ...formConfig,
                      appearance: {
                        ...formConfig.appearance,
                        submitButtonText: e.target.value,
                      },
                    });
                  }}
                  className="w-full bg-slate-900 border border-white/10 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-amber-400"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1.5">
                  Max Athlete Capacity
                </label>
                <input
                  type="number"
                  min={2}
                  max={512}
                  value={regSettings.maxSlots}
                  onChange={(e) => {
                    const slots = Number(e.target.value) || 32;
                    updateRegistrationSettings({ maxSlots: slots });
                    saveFormConfig({ ...formConfig, maxSlots: slots });
                  }}
                  className="w-full bg-slate-900 border border-white/10 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-amber-400"
                />
              </div>
            </div>

            {/* Form Subtitle & Instructions */}
            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1.5">
                Form Instructions & Athlete Guidance
              </label>
              <textarea
                rows={2}
                value={formConfig.appearance?.formDescription || ''}
                onChange={(e) => {
                  saveFormConfig({
                    ...formConfig,
                    appearance: {
                      ...formConfig.appearance,
                      formDescription: e.target.value,
                    },
                  });
                }}
                placeholder="Fill all required details accurately. Verify your WhatsApp number for match fixture alerts..."
                className="w-full bg-slate-900 border border-white/10 rounded-xl p-3 text-sm text-white focus:outline-none focus:border-amber-400 placeholder-slate-500"
              />
            </div>
          </div>

          {/* Active Field Inventory & Fast Controls */}
          <div className="rounded-3xl glass-card p-6 sm:p-8 border border-white/10 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-white/10">
              <div>
                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                  <FileText className="w-5 h-5 text-amber-400" />
                  <span>Configured Form Fields ({formConfig.fields?.length || 0})</span>
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Toggle visibility, enforce mandatory validation, or launch the visual editor for advanced options.
                </p>
              </div>

              <button
                onClick={() => setIsFormCustomizerOpen(true)}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold bg-amber-400 text-slate-950 hover:bg-amber-300 transition-colors shadow self-start sm:self-auto"
              >
                <Plus className="w-4 h-4" />
                <span>Add / Reorder Fields</span>
              </button>
            </div>

            {/* Fields List Grid */}
            <div className="grid grid-cols-1 gap-2.5">
              {(formConfig.fields || []).map((field, idx) => (
                <div
                  key={field.id}
                  className="flex flex-col sm:flex-row sm:items-center justify-between p-3.5 rounded-2xl bg-white/[0.03] border border-white/5 hover:border-white/15 transition-all gap-3"
                >
                  <div className="flex items-center gap-3">
                    <span className="w-6 h-6 rounded-lg bg-white/5 text-slate-400 flex items-center justify-center text-xs font-mono font-bold">
                      {idx + 1}
                    </span>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-bold text-white">{field.label}</span>
                        <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase bg-white/10 text-slate-300">
                          {field.type.replace('_', ' ')}
                        </span>
                        {field.required && (
                          <span className="px-1.5 py-0.5 rounded text-[9px] font-bold uppercase bg-rose-500/20 text-rose-300 border border-rose-500/30">
                            Required
                          </span>
                        )}
                        {!field.enabled && (
                          <span className="px-1.5 py-0.5 rounded text-[9px] font-bold uppercase bg-slate-700 text-slate-400">
                            Hidden
                          </span>
                        )}
                      </div>
                      {field.helpText && (
                        <p className="text-xs text-slate-400 mt-0.5 line-clamp-1">{field.helpText}</p>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-3 sm:gap-4 shrink-0 justify-end">
                    {/* Toggle Required */}
                    <button
                      type="button"
                      disabled={field.isSystem}
                      onClick={() => {
                        const updated = formConfig.fields.map((f) =>
                          f.id === field.id ? { ...f, required: !f.required } : f
                        );
                        saveFormConfig({ ...formConfig, fields: updated });
                      }}
                      className={`text-xs px-2.5 py-1 rounded-lg font-semibold transition-colors ${
                        field.isSystem
                          ? 'opacity-50 cursor-not-allowed text-slate-500 bg-white/5'
                          : field.required
                          ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                          : 'text-slate-400 hover:text-white bg-white/5'
                      }`}
                    >
                      {field.required ? 'Mandatory' : 'Optional'}
                    </button>

                    {/* Toggle Enabled */}
                    <button
                      type="button"
                      disabled={field.isSystem}
                      onClick={() => {
                        const updated = formConfig.fields.map((f) =>
                          f.id === field.id ? { ...f, enabled: !f.enabled } : f
                        );
                        saveFormConfig({ ...formConfig, fields: updated });
                      }}
                      className={`flex items-center gap-1.5 text-xs px-3 py-1 rounded-lg font-semibold transition-colors ${
                        field.isSystem
                          ? 'opacity-50 cursor-not-allowed text-slate-500 bg-white/5'
                          : field.enabled
                          ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                          : 'bg-slate-800 text-slate-400'
                      }`}
                    >
                      {field.enabled ? <ToggleRight className="w-4 h-4 text-emerald-400" /> : <ToggleLeft className="w-4 h-4" />}
                      <span>{field.enabled ? 'Visible' : 'Hidden'}</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* TAB: Payment & UPI Configuration */}
      {activeTab === 'payment' && (
        <div className="space-y-6 animate-fade-in max-w-4xl">
          <div className="rounded-3xl glass-card p-6 sm:p-8 border border-white/10 space-y-6 bg-gradient-to-br from-amber-500/10 via-transparent to-transparent">
            <div>
              <span className="text-[10px] uppercase font-bold tracking-widest text-amber-400 block">
                Financial Settings
              </span>
              <h2 className="text-xl sm:text-2xl font-black text-white flex items-center gap-2">
                <CreditCard className="w-6 h-6 text-amber-400" />
                <span>UPI Payment Gateway & Tournament Fee</span>
              </h2>
              <p className="text-xs sm:text-sm text-slate-300 mt-1">
                Configure tournament entry fees, payee UPI ID, account name, payment instructions, and QR code displayed on the player registration form.
              </p>
            </div>

            {/* UPI & Fee Matrix Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4 border-t border-white/10">
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1.5 flex items-center gap-1">
                  <IndianRupee className="w-3.5 h-3.5 text-amber-400" />
                  <span>Standard Entry Fee (INR)</span>
                </label>
                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 font-bold">
                    ₹
                  </span>
                  <input
                    type="number"
                    min={0}
                    step={50}
                    value={formConfig.payment?.baseFee ?? formConfig.entryFee ?? 500}
                    onChange={(e) => {
                      const val = Number(e.target.value);
                      saveFormConfig({
                        ...formConfig,
                        entryFee: val,
                        payment: {
                          ...(formConfig.payment || {
                            enabled: true,
                            isMandatory: true,
                            baseFee: 500,
                            upiId: 'karan-hdfc@ybl',
                            accountName: 'Smash Premier League (Karan Gaur)',
                          }),
                          baseFee: val,
                        },
                      });
                    }}
                    className="w-full bg-slate-900 border border-white/10 rounded-xl pl-8 pr-3.5 py-2.5 text-sm text-white font-mono font-bold focus:outline-none focus:border-amber-400"
                  />
                </div>
                <span className="text-[11px] text-slate-500 mt-1 block">
                  Set to ₹0 for complimentary free entry.
                </span>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1.5">
                  Beneficiary / Receiver UPI ID
                </label>
                <input
                  type="text"
                  value={formConfig.payment?.upiId || 'karan-hdfc@ybl'}
                  onChange={(e) => {
                    const upiVal = e.target.value.trim();
                    saveFormConfig({
                      ...formConfig,
                      payment: {
                        ...(formConfig.payment || {
                          enabled: true,
                          isMandatory: true,
                          baseFee: 500,
                          upiId: 'karan-hdfc@ybl',
                          accountName: 'Smash Premier League (Karan Gaur)',
                        }),
                        upiId: upiVal,
                      },
                    });
                  }}
                  placeholder="e.g. karan-hdfc@ybl"
                  className="w-full bg-slate-900 border border-white/10 rounded-xl px-3.5 py-2.5 text-sm text-white font-mono focus:outline-none focus:border-amber-400"
                />
                <span className="text-[11px] text-slate-500 mt-1 block">
                  Athletes will send payment directly to this VPA.
                </span>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1.5">
                  Beneficiary Name (Shown in GPay / PhonePe / Paytm)
                </label>
                <input
                  type="text"
                  value={formConfig.payment?.accountName || 'Smash Premier League (Karan Gaur)'}
                  onChange={(e) => {
                    const nameVal = e.target.value;
                    saveFormConfig({
                      ...formConfig,
                      payment: {
                        ...(formConfig.payment || {
                          enabled: true,
                          isMandatory: true,
                          baseFee: 500,
                          upiId: 'karan-hdfc@ybl',
                          accountName: 'Smash Premier League (Karan Gaur)',
                        }),
                        accountName: nameVal,
                      },
                    });
                  }}
                  className="w-full bg-slate-900 border border-white/10 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-amber-400"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1.5">
                  Payment Verification Requirement
                </label>
                <div className="p-2.5 rounded-xl bg-slate-900 border border-white/10 flex items-center justify-between">
                  <div>
                    <span className="text-xs font-bold text-white block">Require UTR / Txn Ref</span>
                    <span className="text-[10px] text-slate-400">Athletes must submit payment ref to proceed</span>
                  </div>
                  <input
                    type="checkbox"
                    checked={formConfig.payment?.isMandatory !== false}
                    onChange={(e) => {
                      const reqVal = e.target.checked;
                      saveFormConfig({
                        ...formConfig,
                        payment: {
                          ...(formConfig.payment || {
                            enabled: true,
                            isMandatory: true,
                            baseFee: 500,
                            upiId: 'karan-hdfc@ybl',
                            accountName: 'Smash Premier League (Karan Gaur)',
                          }),
                          isMandatory: reqVal,
                        },
                      });
                    }}
                    className="rounded accent-amber-400 cursor-pointer w-4 h-4"
                  />
                </div>
              </div>
            </div>

            {/* Payment Instructions Text */}
            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1.5">
                Payment Guidance & Bank Notes
              </label>
              <textarea
                rows={3}
                value={formConfig.payment?.instructions || ''}
                onChange={(e) => {
                  const insVal = e.target.value;
                  saveFormConfig({
                    ...formConfig,
                    payment: {
                      ...(formConfig.payment || {
                        enabled: true,
                        isMandatory: true,
                        baseFee: 500,
                        upiId: 'karan-hdfc@ybl',
                        accountName: 'Smash Premier League (Karan Gaur)',
                      }),
                      instructions: insVal,
                    },
                  });
                }}
                placeholder="Scan the QR code below via GPay, PhonePe, or Paytm. Enter your player name in payment notes and keep the 12-digit UTR reference handy."
                className="w-full bg-slate-900 border border-white/10 rounded-xl p-3 text-sm text-white focus:outline-none focus:border-amber-400 placeholder-slate-500"
              />
            </div>

            {/* Live QR Code Preview Card */}
            <div className="pt-4 border-t border-white/10">
              <h3 className="text-sm font-bold text-white mb-3 flex items-center gap-2">
                <QrCode className="w-4 h-4 text-amber-400" />
                <span>Live Generated UPI QR Code Preview</span>
              </h3>

              <div className="flex flex-col sm:flex-row items-center gap-6 p-4 rounded-2xl bg-slate-900 border border-white/10">
                <div className="w-36 h-36 rounded-xl bg-white p-2 shrink-0 flex items-center justify-center shadow-md">
                  <img
                    src={`https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(
                      `upi://pay?pa=${formConfig.payment?.upiId || 'karan-hdfc@ybl'}&pn=${encodeURIComponent(
                        formConfig.payment?.accountName || 'Smash Premier League'
                      )}&am=${formConfig.payment?.baseFee ?? formConfig.entryFee ?? 500}&cu=INR&tn=SPLRegistration`
                    )}`}
                    alt="UPI Payment QR"
                    className="w-full h-full object-contain"
                  />
                </div>

                <div className="space-y-2 text-xs">
                  <div className="font-mono text-slate-300">
                    <span className="text-slate-500 block text-[10px] uppercase">UPI String</span>
                    <span className="break-all text-[11px] bg-black/40 p-2 rounded-lg block border border-white/5">
                      upi://pay?pa={formConfig.payment?.upiId || 'karan-hdfc@ybl'}&pn={formConfig.payment?.accountName || 'Smash Premier League'}&am={formConfig.payment?.baseFee ?? formConfig.entryFee ?? 500}&cu=INR
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                      <ShieldCheck className="w-3 h-3 text-emerald-400" />
                      Active Gateway: ₹{formConfig.payment?.baseFee ?? formConfig.entryFee ?? 500}
                    </span>
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(formConfig.payment?.upiId || 'karan-hdfc@ybl');
                        alert('UPI ID copied!');
                      }}
                      className="px-2.5 py-1 rounded-lg text-[11px] font-bold text-slate-400 hover:text-white bg-white/5 border border-white/10 transition-colors"
                    >
                      Copy VPA
                    </button>
                  </div>
                </div>
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
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] uppercase font-bold tracking-wider text-amber-400 block font-mono">
                      {viewDetailsTarget.regId}
                    </span>
                    <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-white/10 text-slate-300 border border-white/10">
                      Form v{viewDetailsTarget.formVersion || 1}
                    </span>
                  </div>
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

      {/* PAYMENT VERIFICATION MODAL */}
      {verifyTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in overflow-y-auto">
          <div className="max-w-lg w-full rounded-3xl glass-panel p-6 sm:p-8 border border-white/10 shadow-2xl space-y-5 my-auto">
            <div className="flex items-start justify-between pb-4 border-b border-white/10">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-amber-500/20 text-amber-400 flex items-center justify-center font-bold text-lg border border-amber-500/30">
                  <CreditCard className="w-5 h-5 text-amber-400" />
                </div>
                <div>
                  <span className="text-[10px] uppercase font-bold tracking-wider text-amber-400 block font-mono">
                    Payment Verification Audit
                  </span>
                  <h3 className="text-lg font-bold text-white">{verifyTarget.name}</h3>
                  <span className="text-[11px] text-slate-400 font-mono">
                    ID: {verifyTarget.regId} • Mobile: +91 {verifyTarget.mobile}
                  </span>
                </div>
              </div>
              <button
                onClick={() => setVerifyTarget(null)}
                className="text-slate-400 hover:text-white p-1"
              >
                ✕
              </button>
            </div>

            {/* Payment Summary Box */}
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="p-3 rounded-xl bg-white/5 space-y-0.5">
                <span className="text-[10px] uppercase text-slate-400 block font-semibold">Entry Fee</span>
                <span className="text-base font-mono font-black text-white block">
                  {formatINR(verifyTarget.fee)}
                </span>
                <span className="text-[10px] text-slate-500 capitalize">{verifyTarget.category || 'Doubles'}</span>
              </div>

              <div className="p-3 rounded-xl bg-white/5 space-y-0.5">
                <span className="text-[10px] uppercase text-slate-400 block font-semibold">Submitted UTR / Txn ID</span>
                <div className="flex items-center justify-between gap-1">
                  <span className="text-xs font-mono font-bold text-amber-300 truncate">
                    {verifyTarget.txnId || 'Not provided'}
                  </span>
                  {verifyTarget.txnId && (
                    <button
                      type="button"
                      onClick={() => {
                        navigator.clipboard.writeText(verifyTarget.txnId || '');
                        alert('Transaction reference copied to clipboard!');
                      }}
                      className="p-1 hover:text-white text-slate-400"
                      title="Copy UTR Reference"
                    >
                      <Copy className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
                <span className="text-[10px] text-slate-500">Method: {verifyTarget.method || 'UPI'}</span>
              </div>
            </div>

            {/* Payment Proof / Screenshot Preview if available */}
            {Boolean(verifyTarget.answers?.payment_screenshot || verifyTarget.answers?.photo || verifyTarget.photoUrl) && (
              <div className="p-3 rounded-xl bg-white/5 space-y-2">
                <span className="text-[10px] uppercase text-slate-400 block font-semibold flex items-center justify-between">
                  <span>Player Payment Screenshot</span>
                  <a
                    href={(verifyTarget.answers?.payment_screenshot as string) || (verifyTarget.answers?.photo as string) || verifyTarget.photoUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="text-amber-400 hover:underline flex items-center gap-1"
                  >
                    <ExternalLink className="w-3 h-3" />
                    <span>Open full size</span>
                  </a>
                </span>
                <img
                  src={(verifyTarget.answers?.payment_screenshot as string) || (verifyTarget.answers?.photo as string) || verifyTarget.photoUrl}
                  alt="Payment screenshot"
                  className="w-full max-h-48 object-contain rounded-lg bg-black/40 border border-white/10"
                />
              </div>
            )}

            {/* Payment Status Selector */}
            <div className="space-y-2">
              <label className="block text-xs font-bold text-slate-300">
                Update Payment Status
              </label>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { id: 'paid', label: 'Verified Paid', color: 'border-emerald-500 bg-emerald-500/20 text-emerald-300' },
                  { id: 'pending_verification', label: 'Pending Audit', color: 'border-amber-500 bg-amber-500/20 text-amber-300' },
                  { id: 'pending', label: 'Unpaid / Pending', color: 'border-slate-500 bg-slate-500/20 text-slate-300' },
                  { id: 'failed', label: 'Payment Failed', color: 'border-rose-500 bg-rose-500/20 text-rose-300' },
                  { id: 'refunded', label: 'Refunded', color: 'border-purple-500 bg-purple-500/20 text-purple-300' },
                  { id: 'cancelled', label: 'Cancelled', color: 'border-slate-700 bg-slate-700/50 text-slate-400' },
                ].map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setVerifyStatus(item.id as PaymentStatus)}
                    className={`px-2.5 py-2 rounded-xl text-xs font-bold border transition-all text-center ${
                      verifyStatus === item.id
                        ? `${item.color} shadow-md`
                        : 'border-white/10 bg-white/5 text-slate-400 hover:text-white'
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Verifier Admin Name & Notes */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Verified By (Admin Sign-off)
                </label>
                <input
                  type="text"
                  value={verifyAdminName}
                  onChange={(e) => setVerifyAdminName(e.target.value)}
                  placeholder="e.g. Admin - Karan"
                  className="w-full bg-slate-900 border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-400"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Audit Comment / Bank Txn Note
                </label>
                <input
                  type="text"
                  value={verifyNote}
                  onChange={(e) => setVerifyNote(e.target.value)}
                  placeholder="e.g. Verified in HDFC bank statement"
                  className="w-full bg-slate-900 border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-400"
                />
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex items-center justify-end gap-2 pt-4 border-t border-white/10">
              <button
                type="button"
                onClick={() => setVerifyTarget(null)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-white bg-white/5 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isVerifying}
                onClick={async () => {
                  try {
                    setIsVerifying(true);
                    await verifyPayment(verifyTarget.id, verifyStatus, verifyNote, verifyAdminName);
                    sportsAudio.playFanfare();
                    setVerifyTarget(null);
                  } catch (err) {
                    console.error('Failed to verify payment:', err);
                  } finally {
                    setIsVerifying(false);
                  }
                }}
                className="flex items-center gap-1.5 px-5 py-2 rounded-xl text-xs font-black text-slate-950 bg-amber-400 hover:bg-amber-300 transition-all shadow-lg shadow-amber-400/20 disabled:opacity-50"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>{isVerifying ? 'Saving Audit...' : 'Save & Update Payment'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
