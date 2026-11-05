import React, { useState } from 'react';
import {
  Sliders,
  CreditCard,
  HardDriveDownload,
  Upload,
  RefreshCw,
  Trash2,
  CheckCircle2,
  ShieldAlert,
  Database,
  Server,
  Check,
  Copy,
  ExternalLink,
} from 'lucide-react';
import { useTournament } from '../../context/TournamentContext';
import { ConfirmModal } from '../common/ConfirmModal';

export const SettingsView: React.FC = () => {
  const {
    state,
    isCentralizedDbConnected,
    dbBackendType,
    testDbConnection,
    updateSettings,
    updatePaymentSettings,
    resetToDefault,
    clearResults,
    exportStateJSON,
    importStateJSON,
  } = useTournament();

  const [testingDb, setTestingDb] = useState(false);
  const [dbTestResult, setDbTestResult] = useState<{ connected: boolean; message: string } | null>(null);
  const [copiedEnv, setCopiedEnv] = useState(false);

  const [settingsForm, setSettingsForm] = useState(state.settings);
  const [paymentForm, setPaymentForm] = useState(state.payment);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [importJsonText, setImportJsonText] = useState('');
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [showClearResultsConfirm, setShowClearResultsConfirm] = useState(false);

  const handleSaveSettings = (e: React.FormEvent) => {
    e.preventDefault();
    updateSettings(settingsForm);
    updatePaymentSettings(paymentForm);
    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 2500);
  };

  const handleImportJSON = () => {
    if (!importJsonText.trim()) return;
    const ok = importStateJSON(importJsonText);
    if (ok) {
      alert('Tournament data restored successfully!');
      setImportJsonText('');
    } else {
      alert('Invalid backup JSON. Please check file format.');
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      if (content) {
        const ok = importStateJSON(content);
        if (ok) {
          alert('Tournament backup imported successfully!');
        } else {
          alert('Failed to parse backup JSON file.');
        }
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8 animate-fade-in pb-12">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2.5">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-800 text-amber-400 font-bold text-xl">
            ⚙️
          </span>
          <h1 className="font-display text-2xl sm:text-3xl font-black text-white">
            Tournament Settings & Administration
          </h1>
        </div>
        <p className="mt-1 text-xs sm:text-sm text-slate-400">
          Configure league parameters, court schedules, payment channels, and offline backups.
        </p>
      </div>

      <form onSubmit={handleSaveSettings} className="space-y-6">
        {/* Tournament Parameters */}
        <div className="rounded-3xl glass-panel p-6 sm:p-8 border border-white/10 space-y-5">
          <h3 className="font-bold text-white text-base flex items-center gap-2 pb-2 border-b border-white/10">
            <Sliders className="w-4 h-4 text-amber-400" />
            <span>Tournament Profile</span>
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Tournament Name
              </label>
              <input
                type="text"
                value={settingsForm.name}
                onChange={(e) => setSettingsForm({ ...settingsForm, name: e.target.value })}
                className="w-full bg-slate-900 border border-white/10 rounded-xl px-3.5 py-2 text-sm text-white focus:outline-none focus:border-amber-400"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Season / Edition Label
              </label>
              <input
                type="text"
                value={settingsForm.season || ''}
                onChange={(e) => setSettingsForm({ ...settingsForm, season: e.target.value })}
                className="w-full bg-slate-900 border border-white/10 rounded-xl px-3.5 py-2 text-sm text-white"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Tournament Date
              </label>
              <input
                type="date"
                value={settingsForm.date}
                onChange={(e) => setSettingsForm({ ...settingsForm, date: e.target.value })}
                className="w-full bg-slate-900 border border-white/10 rounded-xl px-3.5 py-2 text-sm text-white"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Venue & Court Location
              </label>
              <input
                type="text"
                value={settingsForm.venue}
                onChange={(e) => setSettingsForm({ ...settingsForm, venue: e.target.value })}
                className="w-full bg-slate-900 border border-white/10 rounded-xl px-3.5 py-2 text-sm text-white"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">
              Broadcast Announcement Banner
            </label>
            <input
              type="text"
              value={settingsForm.announcement || ''}
              onChange={(e) => setSettingsForm({ ...settingsForm, announcement: e.target.value })}
              className="w-full bg-slate-900 border border-white/10 rounded-xl px-3.5 py-2 text-sm text-white"
            />
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Active Courts
              </label>
              <input
                type="number"
                min={1}
                max={10}
                value={settingsForm.courts}
                onChange={(e) =>
                  setSettingsForm({ ...settingsForm, courts: parseInt(e.target.value, 10) || 1 })
                }
                className="w-full bg-slate-900 border border-white/10 rounded-xl px-3.5 py-2 text-sm text-white"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Format (Winning Pts)
              </label>
              <select
                value={settingsForm.format}
                onChange={(e) => setSettingsForm({ ...settingsForm, format: e.target.value })}
                className="w-full bg-slate-900 border border-white/10 rounded-xl px-3.5 py-2 text-sm text-white"
              >
                <option value="21">21 Points (Standard)</option>
                <option value="15">15 Points (Short)</option>
                <option value="30">30 Points (Sudden)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Entry Fee (₹)
              </label>
              <input
                type="number"
                min={0}
                step={50}
                value={settingsForm.entryFee}
                onChange={(e) =>
                  setSettingsForm({ ...settingsForm, entryFee: parseInt(e.target.value, 10) || 0 })
                }
                className="w-full bg-slate-900 border border-white/10 rounded-xl px-3.5 py-2 text-sm text-white font-mono"
              />
            </div>
          </div>
        </div>

        {/* Payment & UPI Gateway */}
        <div className="rounded-3xl glass-panel p-6 sm:p-8 border border-white/10 space-y-5">
          <h3 className="font-bold text-white text-base flex items-center gap-2 pb-2 border-b border-white/10">
            <CreditCard className="w-4 h-4 text-emerald-400" />
            <span>UPI & Fee Collection Settings</span>
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                UPI ID (VPA)
              </label>
              <input
                type="text"
                placeholder="e.g. tournament@upi"
                value={paymentForm.upiId}
                onChange={(e) => setPaymentForm({ ...paymentForm, upiId: e.target.value })}
                className="w-full bg-slate-900 border border-white/10 rounded-xl px-3.5 py-2 text-sm text-white font-mono"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Beneficiary Account / Payee Name
              </label>
              <input
                type="text"
                value={paymentForm.accountName}
                onChange={(e) => setPaymentForm({ ...paymentForm, accountName: e.target.value })}
                className="w-full bg-slate-900 border border-white/10 rounded-xl px-3.5 py-2 text-sm text-white"
              />
            </div>
          </div>
        </div>

        {/* Submit button */}
        <div className="flex items-center justify-between">
          <div>
            {saveSuccess && (
              <span className="text-xs font-bold text-emerald-400 flex items-center gap-1.5 animate-fade-in">
                <CheckCircle2 className="w-4 h-4" />
                <span>Settings saved successfully!</span>
              </span>
            )}
          </div>

          <button
            type="submit"
            className="px-6 py-2.5 text-xs font-bold bg-amber-400 hover:bg-amber-300 text-slate-950 rounded-xl transition-all shadow-md active:scale-95"
          >
            Save All Settings
          </button>
        </div>
      </form>

      {/* Centralized Supabase PostgreSQL Database Configuration */}
      <div className="rounded-3xl glass-panel p-6 sm:p-8 border border-white/10 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-3 border-b border-white/10">
          <div className="flex items-center gap-2.5">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              <Database className="w-4 h-4" />
            </span>
            <div>
              <h3 className="font-bold text-white text-base">Centralized Backend Database (Supabase PostgreSQL)</h3>
              <p className="text-xs text-slate-400">Multi-device real-time tournament persistence & Row-Level Security</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span
              className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold font-mono border ${
                isCentralizedDbConnected
                  ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
                  : 'bg-amber-500/15 text-amber-300 border-amber-500/30'
              }`}
            >
              <span
                className={`w-2 h-2 rounded-full ${
                  isCentralizedDbConnected ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'
                }`}
              />
              {isCentralizedDbConnected ? 'CONNECTED (SUPABASE)' : 'STANDBY (LOCAL CACHE)'}
            </span>
          </div>
        </div>

        {/* 11 Centralized Tables Grid */}
        <div>
          <span className="text-xs font-bold uppercase tracking-wider text-slate-400 block mb-2">
            Centralized Relational Schema (11 Tables Managed)
          </span>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
            {[
              { name: 'players', desc: 'Athlete profiles' },
              { name: 'teams', desc: 'Franchises & purse' },
              { name: 'team_players', desc: 'Roster allocations' },
              { name: 'registrations', desc: 'Public applicant records' },
              { name: 'registration_form_config', desc: 'Customizer schema' },
              { name: 'registration_form_versions', desc: 'Form version audits' },
              { name: 'registration_tokens', desc: 'Shareable links' },
              { name: 'matches', desc: 'Round-robin & playoffs' },
              { name: 'match_scores', desc: 'Live ball/set scores' },
              { name: 'tournament_standings', desc: 'NRR & points table' },
              { name: 'admin_users', desc: 'RBAC administrators' },
              { name: 'audit_logs', desc: 'Security audit trail' },
            ].map((tbl) => (
              <div
                key={tbl.name}
                className="p-2.5 rounded-xl bg-white/[0.03] border border-white/5 flex flex-col justify-between"
              >
                <div className="flex items-center gap-1.5 font-mono text-[11px] font-bold text-slate-200">
                  <span className="text-emerald-400">●</span>
                  <span className="truncate">{tbl.name}</span>
                </div>
                <span className="text-[10px] text-slate-500 mt-1">{tbl.desc}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Live Test & Diagnostics */}
        <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/5 space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <span className="text-xs font-bold text-white block">Connection Diagnostic Test</span>
              <p className="text-xs text-slate-400">
                Pings your Supabase project endpoints and verifies database read permissions.
              </p>
            </div>
            <button
              type="button"
              disabled={testingDb}
              onClick={async () => {
                setTestingDb(true);
                setDbTestResult(null);
                try {
                  const res = await testDbConnection();
                  setDbTestResult(res);
                } finally {
                  setTestingDb(false);
                }
              }}
              className="px-4 py-2 text-xs font-bold text-slate-900 bg-emerald-400 hover:bg-emerald-300 rounded-xl transition-all flex items-center justify-center gap-2 self-start sm:self-auto cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${testingDb ? 'animate-spin' : ''}`} />
              <span>{testingDb ? 'Testing Connection...' : 'Test Supabase Connection'}</span>
            </button>
          </div>

          {dbTestResult && (
            <div
              className={`p-3 rounded-xl border text-xs leading-relaxed ${
                dbTestResult.connected
                  ? 'bg-emerald-500/10 border-emerald-500/25 text-emerald-300'
                  : 'bg-amber-500/10 border-amber-500/25 text-amber-300'
              }`}
            >
              <span className="font-bold mr-1.5">{dbTestResult.connected ? '✓ Success:' : 'ℹ Note:'}</span>
              {dbTestResult.message}
            </div>
          )}
        </div>

        {/* Environment Setup Guide */}
        <div className="p-4 rounded-2xl bg-slate-900/60 border border-white/10 space-y-2.5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-amber-300 flex items-center gap-1.5 font-mono uppercase">
              <Server className="w-3.5 h-3.5" />
              <span>Supabase Connection Variables</span>
            </span>
            <button
              type="button"
              onClick={() => {
                const text = `VITE_SUPABASE_URL=https://your-project.supabase.co\nVITE_SUPABASE_ANON_KEY=your-anon-key`;
                navigator.clipboard?.writeText(text);
                setCopiedEnv(true);
                setTimeout(() => setCopiedEnv(false), 2000);
              }}
              className="text-[11px] text-slate-400 hover:text-white flex items-center gap-1 cursor-pointer"
            >
              {copiedEnv ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
              <span>{copiedEnv ? 'Copied' : 'Copy keys'}</span>
            </button>
          </div>
          <p className="text-xs text-slate-400 leading-relaxed">
            Provide your project URL and anon public key in environment settings. The SQL schema is ready in{' '}
            <code className="text-emerald-300 font-mono">supabase/schema.sql</code> to paste into your Supabase SQL Editor.
          </p>
        </div>
      </div>

      {/* Data Backup & Maintenance Operations */}
      <div className="rounded-3xl glass-card p-6 sm:p-8 border border-white/10 space-y-6">
        <h3 className="font-bold text-white text-base flex items-center gap-2 pb-2 border-b border-white/10">
          <HardDriveDownload className="w-4 h-4 text-blue-400" />
          <span>Data Backup & Recovery</span>
        </h3>


        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/5 space-y-2">
            <span className="font-bold text-white text-sm block">Export Full Tournament State</span>
            <p className="text-xs text-slate-400 leading-relaxed">
              Download complete tournament snapshot including all players, teams, matches, scores, and fee records as a JSON file.
            </p>
            <button
              type="button"
              onClick={exportStateJSON}
              className="mt-2 px-4 py-2 text-xs font-semibold text-slate-200 bg-white/10 hover:bg-white/15 rounded-xl transition-colors flex items-center gap-2"
            >
              <HardDriveDownload className="w-3.5 h-3.5 text-blue-400" />
              <span>Download State Backup (.json)</span>
            </button>
          </div>

          <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/5 space-y-2">
            <span className="font-bold text-white text-sm block">Import / Restore Backup</span>
            <p className="text-xs text-slate-400 leading-relaxed">
              Upload a previously exported tournament JSON file to restore the database.
            </p>
            <label className="mt-2 inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-slate-200 bg-white/10 hover:bg-white/15 rounded-xl transition-colors cursor-pointer">
              <Upload className="w-3.5 h-3.5 text-emerald-400" />
              <span>Upload Backup File</span>
              <input
                type="file"
                accept=".json"
                onChange={handleFileUpload}
                className="hidden"
              />
            </label>
          </div>
        </div>

        {/* Danger Zone */}
        <div className="pt-4 border-t border-white/10 space-y-3">
          <span className="text-xs font-bold uppercase tracking-wider text-rose-400 flex items-center gap-1.5">
            <ShieldAlert className="w-3.5 h-3.5" />
            <span>Danger Zone</span>
          </span>

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => setShowClearResultsConfirm(true)}
              className="px-4 py-2 text-xs font-semibold text-rose-300 hover:text-white bg-rose-500/10 hover:bg-rose-500/20 rounded-xl transition-colors border border-rose-500/20"
            >
              Reset Match Scores (Keep Teams)
            </button>

            <button
              type="button"
              onClick={() => setShowResetConfirm(true)}
              className="px-4 py-2 text-xs font-semibold text-rose-400 hover:text-white bg-rose-500/15 hover:bg-rose-600 rounded-xl transition-colors border border-rose-500/30"
            >
              Reset to Starter State
            </button>
          </div>
        </div>
      </div>

      {/* Confirm Reset Starter */}
      <ConfirmModal
        isOpen={showResetConfirm}
        title="Reset to Factory Starter Tournament"
        message="This will overwrite the current database with default sample teams, fixtures, and registrations. Are you sure you wish to continue?"
        confirmLabel="Reset Everything"
        variant="danger"
        onConfirm={() => {
          resetToDefault();
          setShowResetConfirm(false);
          alert('Tournament reset to default state.');
        }}
        onCancel={() => setShowResetConfirm(false)}
      />

      {/* Confirm Clear Results */}
      <ConfirmModal
        isOpen={showClearResultsConfirm}
        title="Clear All Match Results"
        message="All match scores in both round-robin and playoffs will be cleared back to 0-0. Teams and players will remain intact."
        confirmLabel="Clear Scores"
        variant="warning"
        onConfirm={() => {
          clearResults();
          setShowClearResultsConfirm(false);
          alert('All scores have been reset.');
        }}
        onCancel={() => setShowClearResultsConfirm(false)}
      />
    </div>
  );
};
