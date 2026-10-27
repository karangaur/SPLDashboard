import React, { useState } from 'react';
import {
  Lock,
  User,
  Eye,
  EyeOff,
  Trophy,
  ArrowRight,
  ShieldCheck,
  AlertCircle,
  Sparkles,
  HelpCircle,
  X,
  Swords,
  Activity,
  Zap,
} from 'lucide-react';
import { AuthService, AdminUser } from '../../services/authService';

interface AdminLoginPageProps {
  onLoginSuccess: (user: AdminUser) => void;
  onGoToPublicRegister?: () => void;
  onBackToHome?: () => void;
}

export const AdminLoginPage: React.FC<AdminLoginPageProps> = ({
  onLoginSuccess,
  onGoToPublicRegister,
  onBackToHome,
}) => {
  const [identifier, setIdentifier] = useState('admin');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [showHelpModal, setShowHelpModal] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setLoading(true);

    try {
      const res = await AuthService.login(identifier, password, rememberMe);
      if (res.success && res.user) {
        onLoginSuccess(res.user);
      } else {
        setErrorMessage(res.error || 'Authentication failed. Please verify your credentials.');
      }
    } catch {
      setErrorMessage('A network error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const fillQuickCredentials = (user: string, pass: string) => {
    setIdentifier(user);
    setPassword(pass);
    setErrorMessage(null);
  };

  return (
    <div className="min-h-screen w-full bg-[#04060d] text-slate-100 flex flex-col justify-between selection:bg-lime-400 selection:text-slate-950 relative overflow-x-hidden">
      {/* Dynamic Badminton Court Background Overlay */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden opacity-25">
        {/* Court lines SVG */}
        <svg
          className="absolute -right-24 -top-24 w-[700px] h-[700px] lg:w-[1000px] lg:h-[1000px] text-lime-400/20"
          viewBox="0 0 800 800"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
        >
          {/* Badminton Court Perimeter */}
          <rect x="100" y="80" width="600" height="640" rx="4" />
          {/* Doubles Sidelines */}
          <line x1="160" y1="80" x2="160" y2="720" />
          <line x1="640" y1="80" x2="640" y2="720" />
          {/* Net Line */}
          <line x1="100" y1="400" x2="700" y2="400" strokeWidth="3" strokeDasharray="6 4" />
          {/* Short Service Lines */}
          <line x1="100" y1="310" x2="700" y2="310" />
          <line x1="100" y1="490" x2="700" y2="490" />
          {/* Long Service Lines (Doubles) */}
          <line x1="100" y1="130" x2="700" y2="130" />
          <line x1="100" y1="670" x2="700" y2="670" />
          {/* Centre Line */}
          <line x1="400" y1="80" x2="400" y2="310" />
          <line x1="400" y1="490" x2="400" y2="720" />
        </svg>

        {/* Stadium Floodlight Radial Glows */}
        <div className="absolute top-0 left-1/4 w-[600px] h-[500px] bg-gradient-to-b from-lime-500/15 via-emerald-500/5 to-transparent blur-3xl rounded-full" />
        <div className="absolute -bottom-32 right-1/3 w-[500px] h-[500px] bg-gradient-to-t from-cyan-500/10 via-blue-500/5 to-transparent blur-3xl rounded-full" />
      </div>

      {/* Top Bar / Minimal Navigation */}
      <header className="relative z-10 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-5 flex items-center justify-between border-b border-white/5">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-tr from-lime-500 via-lime-400 to-emerald-400 text-slate-950 font-black shadow-lg shadow-lime-500/25">
            <span className="text-2xl">🏸</span>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-display text-lg font-black tracking-tight text-white uppercase">
                Smash Premier League
              </span>
              <span className="px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider bg-lime-400 text-slate-950">
                PRO
              </span>
            </div>
            <p className="text-xs text-slate-400 font-medium">Official Tournament Management Suite</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {onBackToHome && (
            <button
              onClick={onBackToHome}
              className="px-3.5 py-1.5 text-xs font-semibold text-slate-300 hover:text-white bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl transition-all"
            >
              ← Tournament Home
            </button>
          )}

          {/* Quick action: Link to athlete registration form */}
          {onGoToPublicRegister && (
            <button
              onClick={onGoToPublicRegister}
              className="flex items-center gap-2 px-3.5 py-1.5 text-xs font-semibold text-lime-400 bg-lime-400/10 hover:bg-lime-400/20 border border-lime-400/30 rounded-xl transition-all"
            >
              <span>Public Registration</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </header>

      {/* Main Content: Split-Screen on Desktop */}
      <main className="relative z-10 flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-8 lg:py-12 flex items-center">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-14 w-full items-center">
          
          {/* Left Column: Athletic Badminton Stadium Showcase (55%) */}
          <div className="lg:col-span-7 flex flex-col justify-center space-y-8">
            <div className="space-y-4">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-lime-500/10 border border-lime-500/30 text-lime-400 text-xs font-bold tracking-wide uppercase">
                <Zap className="w-3.5 h-3.5 animate-pulse" />
                <span>Season IV Championship Portal</span>
              </div>

              <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black font-display tracking-tight text-white uppercase leading-[1.08]">
                Built for <br />
                <span className="bg-gradient-to-r from-lime-400 via-emerald-300 to-cyan-400 bg-clip-text text-transparent">
                  The Game.
                </span>
              </h1>

              <p className="text-base sm:text-lg text-slate-300 max-w-xl font-normal leading-relaxed">
                Take full command of your badminton league. Live scoring, automated round-robin and knockout brackets, real-time player draft, and verified athlete registrations in one arena.
              </p>
            </div>

            {/* Athletic Visual Banner / Badminton Action Graphic */}
            <div className="relative rounded-2xl overflow-hidden border border-white/10 bg-gradient-to-br from-slate-900/90 via-[#0a0f1e] to-slate-950 p-6 shadow-2xl backdrop-blur-md">
              <div className="flex flex-col sm:flex-row items-center gap-6">
                
                {/* Badminton Court Smash SVG Badge */}
                <div className="relative shrink-0 w-28 h-28 rounded-2xl bg-gradient-to-tr from-lime-500/20 via-emerald-500/10 to-transparent border border-lime-400/30 flex items-center justify-center p-3 shadow-inner">
                  <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(163,230,53,0.35)_0%,transparent_70%)]" />
                  {/* Stylized jump smash silhouette & shuttlecock */}
                  <svg
                    className="w-16 h-16 text-lime-400 drop-shadow-[0_0_12px_rgba(163,230,53,0.7)]"
                    viewBox="0 0 64 64"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    {/* Shuttlecock Motion Trail */}
                    <path d="M12 52L26 38" strokeDasharray="3 3" opacity="0.6" strokeWidth="1.5" />
                    <path d="M18 56L30 44" strokeDasharray="3 3" opacity="0.4" strokeWidth="1.5" />
                    {/* Shuttlecock Head & Feathers */}
                    <circle cx="48" cy="18" r="4" fill="currentColor" />
                    <path d="M45 21L34 32M48 22L40 36M51 19L44 32" strokeWidth="2.5" />
                    <path d="M34 32C36 35 42 37 44 32" />
                    {/* Speed Lines */}
                    <line x1="56" y1="12" x2="60" y2="8" strokeWidth="2" />
                    <line x1="52" y1="8" x2="54" y2="4" strokeWidth="2" />
                  </svg>
                </div>

                <div className="space-y-2 text-center sm:text-left">
                  <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2">
                    <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                      Live Tournament Ready
                    </span>
                    <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-blue-500/20 text-blue-300 border border-blue-500/30">
                      Instant Bracket Engine
                    </span>
                  </div>
                  <h3 className="text-white font-bold text-base sm:text-lg">
                    Every Match. Every Player. Every Victory.
                  </h3>
                  <p className="text-xs text-slate-400">
                    Trusted by organizers for high-stakes tournaments with instant UPI verification and live court updates.
                  </p>
                </div>
              </div>

              {/* Tournament Key Metrics strip */}
              <div className="grid grid-cols-3 gap-3 mt-6 pt-5 border-t border-white/10 text-center">
                <div className="p-2 rounded-xl bg-white/[0.03]">
                  <p className="text-xs text-slate-400 uppercase font-semibold">Match Engine</p>
                  <p className="text-sm font-black text-lime-400">Round Robin + KO</p>
                </div>
                <div className="p-2 rounded-xl bg-white/[0.03]">
                  <p className="text-xs text-slate-400 uppercase font-semibold">Form Builder</p>
                  <p className="text-sm font-black text-white">Dynamic 10 Types</p>
                </div>
                <div className="p-2 rounded-xl bg-white/[0.03]">
                  <p className="text-xs text-slate-400 uppercase font-semibold">Security</p>
                  <p className="text-sm font-black text-emerald-400">Admin Encrypted</p>
                </div>
              </div>
            </div>

            {/* Quick Athlete Registration Link Banner */}
            {onGoToPublicRegister && (
              <div className="p-4 rounded-xl border border-lime-500/20 bg-lime-500/[0.04] flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-lime-400/10 text-lime-400">
                    <Trophy className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-white">Are you an athlete participating in SPL?</p>
                    <p className="text-xs text-slate-400">No admin account needed. Open the public player entry form.</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={onGoToPublicRegister}
                  className="px-3.5 py-2 text-xs font-black uppercase tracking-wider text-slate-950 bg-lime-400 hover:bg-lime-300 rounded-lg shadow-md transition-all shrink-0"
                >
                  Register Now
                </button>
              </div>
            )}
          </div>

          {/* Right Column: Sporty Admin Login Card (45%) */}
          <div className="lg:col-span-5 flex justify-center">
            <div className="w-full max-w-md bg-slate-900/90 border border-white/10 rounded-3xl p-6 sm:p-8 shadow-2xl backdrop-blur-xl relative overflow-hidden">
              
              {/* Top Accent Gradient Border */}
              <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-lime-400 via-emerald-400 to-cyan-400" />

              <div className="mb-6 space-y-1.5">
                <div className="flex items-center justify-between">
                  <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-lime-400/15 border border-lime-400/30 text-lime-400 text-[11px] font-black uppercase tracking-widest">
                    <ShieldCheck className="w-3.5 h-3.5" />
                    <span>Admin Portal</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowHelpModal(true)}
                    className="text-xs text-slate-400 hover:text-lime-400 flex items-center gap-1 transition-colors"
                  >
                    <HelpCircle className="w-3.5 h-3.5" />
                    <span>Credentials Help</span>
                  </button>
                </div>

                <h2 className="text-2xl font-black font-display tracking-tight text-white uppercase pt-1">
                  Organizer Sign In
                </h2>
                <p className="text-xs text-slate-400 font-medium">
                  Manage Your Tournament. Own the Game.
                </p>
              </div>

              {/* Error Message Box */}
              {errorMessage && (
                <div className="mb-5 p-3.5 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-200 text-xs flex items-start gap-2.5 animate-shake">
                  <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <p className="font-semibold">Access Denied</p>
                    <p className="mt-0.5 opacity-90">{errorMessage}</p>
                  </div>
                </div>
              )}

              {/* Login Form */}
              <form onSubmit={handleSubmit} className="space-y-4">
                {/* Username / Email field */}
                <div className="space-y-1.5">
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-300">
                    Admin Username or Email
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                      <User className="w-4 h-4" />
                    </div>
                    <input
                      type="text"
                      required
                      value={identifier}
                      onChange={(e) => setIdentifier(e.target.value)}
                      placeholder="admin or admin@spl.com"
                      className="w-full pl-10 pr-4 py-2.5 bg-slate-950/80 border border-white/10 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:border-lime-400 focus:ring-1 focus:ring-lime-400 transition-colors font-sans"
                    />
                  </div>
                </div>

                {/* Password field with Show/Hide toggle */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-300">
                      Security Password
                    </label>
                    <button
                      type="button"
                      onClick={() => setShowHelpModal(true)}
                      className="text-[11px] font-semibold text-lime-400 hover:text-lime-300 transition-colors"
                    >
                      Forgot?
                    </button>
                  </div>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                      <Lock className="w-4 h-4" />
                    </div>
                    <input
                      type={showPassword ? 'text' : 'password'}
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Enter administrator password"
                      className="w-full pl-10 pr-11 py-2.5 bg-slate-950/80 border border-white/10 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:border-lime-400 focus:ring-1 focus:ring-lime-400 transition-colors font-sans"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-200 focus:outline-none transition-colors"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                {/* Remember Me and Security Badge */}
                <div className="flex items-center justify-between pt-1">
                  <label className="flex items-center gap-2 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={rememberMe}
                      onChange={(e) => setRememberMe(e.target.checked)}
                      className="w-4 h-4 rounded bg-slate-950 border border-white/20 text-lime-500 focus:ring-lime-400 focus:ring-offset-0 transition-colors cursor-pointer"
                    />
                    <span className="text-xs text-slate-300 font-medium">Remember on this device</span>
                  </label>

                  <div className="flex items-center gap-1 text-[11px] text-slate-400">
                    <ShieldCheck className="w-3.5 h-3.5 text-lime-400" />
                    <span>256-bit Encrypted</span>
                  </div>
                </div>

                {/* Sign In Submit Button */}
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full mt-2 py-3 px-4 rounded-xl font-display font-black uppercase tracking-wider text-sm text-slate-950 bg-gradient-to-r from-lime-400 via-lime-300 to-emerald-400 hover:from-lime-300 hover:to-emerald-300 shadow-lg shadow-lime-500/25 active:scale-[0.98] transition-all flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer"
                >
                  {loading ? (
                    <>
                      <div className="w-4 h-4 border-2 border-slate-950 border-t-transparent rounded-full animate-spin" />
                      <span>Authenticating Organizer...</span>
                    </>
                  ) : (
                    <>
                      <span>Sign In to Admin Portal</span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </form>

              {/* Quick default credential helper pills */}
              <div className="mt-6 pt-5 border-t border-white/10 space-y-2">
                <div className="flex items-center justify-between text-[11px] text-slate-400 font-semibold uppercase tracking-wider">
                  <span>Organizer Quick Fill</span>
                  <span className="text-lime-400">Default Credentials</span>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => fillQuickCredentials('admin', 'smash2026')}
                    className="p-2 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] border border-white/10 text-left transition-all group"
                  >
                    <p className="text-[10px] text-slate-400 font-bold uppercase group-hover:text-lime-400">
                      Standard Admin
                    </p>
                    <p className="text-xs text-white font-mono mt-0.5 truncate">admin / smash2026</p>
                  </button>
                  <button
                    type="button"
                    onClick={() => fillQuickCredentials('admin@spl.com', 'admin123')}
                    className="p-2 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] border border-white/10 text-left transition-all group"
                  >
                    <p className="text-[10px] text-slate-400 font-bold uppercase group-hover:text-lime-400">
                      Director Email
                    </p>
                    <p className="text-xs text-white font-mono mt-0.5 truncate">admin@spl.com / admin123</p>
                  </button>
                </div>
              </div>

              {/* Notice */}
              <p className="mt-5 text-center text-[11px] text-slate-400 leading-normal">
                Authorized tournament committee only. Unauthorized access attempts are monitored and recorded.
              </p>
            </div>
          </div>

        </div>
      </main>

      {/* Footer */}
      <footer className="relative z-10 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-5 border-t border-white/5 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-400">
        <div className="flex items-center gap-2">
          <span>🏸 Smash Premier League Official System</span>
          <span>•</span>
          <span>Season IV Edition</span>
        </div>
        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={() => setShowHelpModal(true)}
            className="hover:text-lime-400 transition-colors"
          >
            Access Help
          </button>
          <span>•</span>
          <span className="text-slate-400">Secure Tournament Operations</span>
        </div>
      </footer>

      {/* Forgot Password & Credentials Help Modal */}
      {showHelpModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md">
          <div className="w-full max-w-md bg-slate-900 border border-white/15 rounded-2xl p-6 shadow-2xl relative animate-in fade-in zoom-in-95 duration-150">
            <button
              onClick={() => setShowHelpModal(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-white p-1 rounded-lg hover:bg-white/10 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-2.5 mb-4">
              <div className="p-2 rounded-xl bg-lime-400/15 text-lime-400 border border-lime-400/30">
                <HelpCircle className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-display font-black uppercase text-base text-white">
                  Administrator Credentials Help
                </h3>
                <p className="text-xs text-slate-400">Access instructions for tournament committee</p>
              </div>
            </div>

            <div className="space-y-4 text-xs text-slate-300">
              <div className="p-3.5 rounded-xl bg-slate-950 border border-white/10 space-y-2">
                <p className="font-bold text-white uppercase text-[11px] tracking-wide text-lime-400">
                  Pre-configured Organizer Credentials:
                </p>
                <div className="space-y-1 font-mono text-[12px]">
                  <div className="flex justify-between py-1 border-b border-white/5">
                    <span className="text-slate-400">Username:</span>
                    <span className="text-white font-bold select-all">admin</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-white/5">
                    <span className="text-slate-400">Email:</span>
                    <span className="text-white select-all">admin@spl.com</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-white/5">
                    <span className="text-slate-400">Password:</span>
                    <span className="text-lime-400 font-bold select-all">smash2026</span>
                  </div>
                  <div className="flex justify-between py-1">
                    <span className="text-slate-400">Alternative Password:</span>
                    <span className="text-emerald-400 select-all">admin123</span>
                  </div>
                </div>
              </div>

              <div className="p-3 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-200">
                <p className="font-semibold text-white mb-1">Forgot or Changed Password?</p>
                <p className="leading-relaxed">
                  If you customized the administrator credentials in Settings, they are securely preserved in your local session vault. You can always use the master default credentials above to regain access.
                </p>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    fillQuickCredentials('admin', 'smash2026');
                    setShowHelpModal(false);
                  }}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-slate-950 bg-lime-400 hover:bg-lime-300 transition-colors"
                >
                  Use Default Credentials & Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
