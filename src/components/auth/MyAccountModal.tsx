import React, { useState, useEffect } from 'react';
import {
  X,
  User,
  Shield,
  KeyRound,
  Calendar,
  Phone,
  HelpCircle,
  CheckCircle2,
  AlertCircle,
  Eye,
  EyeOff,
  Save,
  Lock,
} from 'lucide-react';
import { AuthService, AdminUser } from '../../services/authService';
import { UserService } from '../../services/userService';
import { SecurityService, PREDEFINED_SECURITY_QUESTIONS } from '../../services/securityService';

interface MyAccountModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser?: AdminUser | null;
  onUserUpdated?: () => void;
  onLogout?: () => void;
}

export const MyAccountModal: React.FC<MyAccountModalProps> = ({
  isOpen,
  onClose,
  currentUser: propUser,
  onUserUpdated,
  onLogout,
}) => {
  const activeUser = propUser || AuthService.getCurrentUser();
  const activeUserId = activeUser?.id || '';
  const activeUserEmail = activeUser?.email || '';
  const activeUserUsername = activeUser?.username || '';

  const [activeTab, setActiveTab] = useState<'profile' | 'password' | 'security'>('profile');

  // Password change state
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrentPass, setShowCurrentPass] = useState(false);
  const [showNewPass, setShowNewPass] = useState(false);
  const [passLoading, setPassLoading] = useState(false);
  const [passError, setPassError] = useState<string | null>(null);
  const [passSuccess, setPassSuccess] = useState<string | null>(null);

  // Security settings state
  const [mobile, setMobile] = useState('');
  const [dob, setDob] = useState('');
  const [securityQuestion, setSecurityQuestion] = useState<string>(PREDEFINED_SECURITY_QUESTIONS[0]);
  const [customQuestion, setCustomQuestion] = useState('');
  const [isCustomQuestion, setIsCustomQuestion] = useState(false);
  const [securityAnswer, setSecurityAnswer] = useState('');
  const [securityLoading, setSecurityLoading] = useState(false);
  const [securityError, setSecurityError] = useState<string | null>(null);
  const [securitySuccess, setSecuritySuccess] = useState<string | null>(null);

  // Handle Escape key & background scroll lock while modal is open
  useEffect(() => {
    if (!isOpen) return;

    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  // Load existing user metadata ONLY when modal opens or user identity changes
  useEffect(() => {
    if (isOpen && (activeUserEmail || activeUserUsername)) {
      setPassError(null);
      setPassSuccess(null);
      setSecurityError(null);
      setSecuritySuccess(null);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setSecurityAnswer('');

      UserService.getUserByEmailOrUsername(activeUserEmail || activeUserUsername).then((dbUser) => {
        if (dbUser) {
          if (dbUser.mobile) setMobile(dbUser.mobile);
          if (dbUser.dob) setDob(dbUser.dob);
          if (dbUser.securityQuestion) {
            const isPredefined = PREDEFINED_SECURITY_QUESTIONS.includes(
              dbUser.securityQuestion as any
            );
            if (isPredefined) {
              setSecurityQuestion(dbUser.securityQuestion);
              setIsCustomQuestion(false);
            } else {
              setSecurityQuestion('custom');
              setCustomQuestion(dbUser.securityQuestion);
              setIsCustomQuestion(true);
            }
          }
        }
      });
    }
  }, [isOpen, activeUserId, activeUserEmail, activeUserUsername]);

  if (!isOpen || !activeUser) return null;

  const handleSignOut = async () => {
    onClose();
    if (onLogout) {
      onLogout();
    } else {
      await AuthService.logout();
      window.location.href = '/';
    }
  };

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setPassError(null);
    setPassSuccess(null);

    if (!currentPassword) {
      setPassError('Please enter your current password.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setPassError('New password and confirmation do not match.');
      return;
    }

    const val = SecurityService.validatePassword(newPassword);
    if (!val.isValid) {
      setPassError(val.message || 'Password does not meet security requirements.');
      return;
    }

    setPassLoading(true);
    try {
      const res = await UserService.changePassword(currentPassword, newPassword);
      if (res.success) {
        setPassSuccess('Your password has been securely updated in Supabase across all devices.');
        setCurrentPassword('');
        setNewPassword('');
        setConfirmPassword('');
        setTimeout(() => {
          setPassSuccess(null);
        }, 4000);
      } else {
        setPassError(res.error || 'Failed to update password.');
      }
    } catch (err: any) {
      setPassError(err?.message || 'Error updating password.');
    } finally {
      setPassLoading(false);
    }
  };

  const handleSecuritySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSecurityError(null);
    setSecuritySuccess(null);

    const questionToSave = isCustomQuestion ? customQuestion.trim() : securityQuestion;

    if (!questionToSave) {
      setSecurityError('Please select or specify a security question.');
      return;
    }

    setSecurityLoading(true);
    try {
      const res = await UserService.updateUser(
        activeUser.id,
        {
          mobile: mobile.trim() || undefined,
          dob: dob.trim() || undefined,
          securityQuestion: questionToSave,
          securityAnswer: securityAnswer.trim() || undefined,
        },
        activeUser.id
      );

      if (res.success) {
        setSecuritySuccess('Security settings and recovery information successfully saved to Supabase.');
        setSecurityAnswer('');
        if (onUserUpdated) onUserUpdated();
        setTimeout(() => setSecuritySuccess(null), 4000);
      } else {
        setSecurityError(res.error || 'Failed to update security settings.');
      }
    } catch (err: any) {
      setSecurityError(err?.message || 'An error occurred saving security settings.');
    } finally {
      setSecurityLoading(false);
    }
  };

  const roleBadge = () => {
    if (activeUser.role === 'super_admin') {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] sm:text-xs font-black uppercase tracking-wider bg-amber-400/20 text-amber-300 border border-amber-400/40 shrink-0">
          Super Admin
        </span>
      );
    }
    if (activeUser.role === 'scorer') {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] sm:text-xs font-black uppercase tracking-wider bg-emerald-400/20 text-emerald-300 border border-emerald-400/40 shrink-0">
          Score Operator
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] sm:text-xs font-bold uppercase tracking-wider bg-blue-400/20 text-blue-300 border border-blue-400/40 shrink-0">
        Tournament Official
      </span>
    );
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-2.5 sm:p-4 bg-slate-950/80 backdrop-blur-md animate-fade-in overflow-y-auto"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="my-account-modal-title"
    >
      <div
        className="relative w-full max-w-2xl bg-slate-900 border border-white/10 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[92dvh] my-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between gap-2 px-4 sm:px-6 py-4 border-b border-white/10 bg-slate-950/60 shrink-0">
          <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
            <div className="p-2 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400 shrink-0">
              <Shield className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h3
                  id="my-account-modal-title"
                  className="text-sm sm:text-base font-black uppercase tracking-wide text-white truncate"
                >
                  My Account & Security
                </h3>
                {roleBadge()}
              </div>
              <p className="text-xs text-slate-400 truncate">
                {activeUser.name} ({activeUser.email || activeUser.username})
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={handleSignOut}
              className="px-2.5 py-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 text-rose-300 text-xs font-bold transition-colors"
            >
              Logout
            </button>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close My Account modal"
              className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center border-b border-white/10 bg-slate-950/40 px-3 sm:px-6 gap-1 sm:gap-2 overflow-x-auto no-scrollbar shrink-0">
          <button
            type="button"
            onClick={() => setActiveTab('profile')}
            className={`px-3 sm:px-4 py-3 text-xs font-bold uppercase tracking-wider border-b-2 transition-all flex items-center gap-1.5 sm:gap-2 whitespace-nowrap shrink-0 ${
              activeTab === 'profile'
                ? 'border-amber-400 text-amber-300'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <User className="w-3.5 h-3.5" />
            <span>Profile</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('password')}
            className={`px-3 sm:px-4 py-3 text-xs font-bold uppercase tracking-wider border-b-2 transition-all flex items-center gap-1.5 sm:gap-2 whitespace-nowrap shrink-0 ${
              activeTab === 'password'
                ? 'border-amber-400 text-amber-300'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <KeyRound className="w-3.5 h-3.5" />
            <span>Change Password</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('security')}
            className={`px-3 sm:px-4 py-3 text-xs font-bold uppercase tracking-wider border-b-2 transition-all flex items-center gap-1.5 sm:gap-2 whitespace-nowrap shrink-0 ${
              activeTab === 'security'
                ? 'border-amber-400 text-amber-300'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <HelpCircle className="w-3.5 h-3.5" />
            <span>Security & Recovery</span>
          </button>
        </div>

        {/* Content Area */}
        <div className="p-4 sm:p-6 overflow-y-auto flex-1 space-y-6">
          {activeTab === 'profile' && (
            <div className="space-y-4">
              <div className="p-4 rounded-xl bg-white/[0.02] border border-white/5 space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                      Full Legal Name
                    </label>
                    <p className="text-sm font-semibold text-white mt-0.5">{activeUser.name}</p>
                  </div>
                  <div>
                    <label className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                      Username
                    </label>
                    <p className="text-sm font-mono text-slate-200 mt-0.5">{activeUser.username}</p>
                  </div>
                  <div>
                    <label className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                      Email Address
                    </label>
                    <p className="text-sm text-slate-200 mt-0.5">{activeUser.email || 'Not set'}</p>
                  </div>
                  <div>
                    <label className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                      Access Role
                    </label>
                    <div className="mt-1">{roleBadge()}</div>
                  </div>
                </div>
              </div>

              <div className="p-4 rounded-xl bg-amber-500/[0.04] border border-amber-500/20 text-xs text-slate-300 space-y-2">
                <div className="flex items-center gap-2 font-bold text-amber-300">
                  <Shield className="w-4 h-4" />
                  <span>Security & Permissions Contract</span>
                </div>
                <p>
                  {activeUser.role === 'super_admin'
                    ? 'Super Admin accounts maintain full unrestricted tournament authority including user management, matches, rosters, and form customization.'
                    : 'Normal User (Score Operator) accounts are restricted to live scoring on ongoing matches, viewing player profiles, and managing personal account credentials.'}
                </p>
              </div>
            </div>
          )}

          {activeTab === 'password' && (
            <form onSubmit={handlePasswordSubmit} className="space-y-4">
              {passError && (
                <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{passError}</span>
                </div>
              )}
              {passSuccess && (
                <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                  <span>{passSuccess}</span>
                </div>
              )}

              <div className="space-y-1.5">
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-300">
                  Current Password
                </label>
                <div className="relative">
                  <input
                    type={showCurrentPass ? 'text' : 'password'}
                    required
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    placeholder="Enter existing password"
                    className="w-full pl-3.5 pr-10 py-2.5 bg-slate-950 border border-white/10 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:border-amber-400"
                  />
                  <button
                    type="button"
                    onClick={() => setShowCurrentPass(!showCurrentPass)}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-200"
                  >
                    {showCurrentPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-300">
                  New Password
                </label>
                <div className="relative">
                  <input
                    type={showNewPass ? 'text' : 'password'}
                    required
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Minimum 8 characters (uppercase, lowercase, number)"
                    className="w-full pl-3.5 pr-10 py-2.5 bg-slate-950 border border-white/10 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:border-amber-400"
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPass(!showNewPass)}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-200"
                  >
                    {showNewPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-300">
                  Confirm New Password
                </label>
                <input
                  type="password"
                  required
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Re-enter new password"
                  className="w-full px-3.5 py-2.5 bg-slate-950 border border-white/10 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:border-amber-400"
                />
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={passLoading}
                  className="w-full py-2.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-black uppercase tracking-wider text-xs shadow-lg transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  <Lock className="w-4 h-4" />
                  <span>{passLoading ? 'Updating Password...' : 'Save & Update Password'}</span>
                </button>
              </div>
            </form>
          )}

          {activeTab === 'security' && (
            <form onSubmit={handleSecuritySubmit} className="space-y-4">
              {securityError && (
                <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{securityError}</span>
                </div>
              )}
              {securitySuccess && (
                <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                  <span>{securitySuccess}</span>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-300">
                    Mobile Number (Optional)
                  </label>
                  <div className="relative">
                    <Phone className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
                    <input
                      type="tel"
                      value={mobile}
                      onChange={(e) => setMobile(e.target.value)}
                      placeholder="10-digit mobile"
                      className="w-full pl-9 pr-3.5 py-2.5 bg-slate-950 border border-white/10 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:border-amber-400"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-300">
                    Date of Birth (For Recovery)
                  </label>
                  <div className="relative">
                    <Calendar className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
                    <input
                      type="date"
                      value={dob}
                      onChange={(e) => setDob(e.target.value)}
                      className="w-full pl-9 pr-3.5 py-2.5 bg-slate-950 border border-white/10 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:border-amber-400"
                    />
                  </div>
                </div>
              </div>

              {/* Security Question Selection */}
              <div className="space-y-1.5">
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-300">
                  Security Question
                </label>
                <select
                  value={isCustomQuestion ? 'custom' : securityQuestion}
                  onChange={(e) => {
                    if (e.target.value === 'custom') {
                      setIsCustomQuestion(true);
                    } else {
                      setIsCustomQuestion(false);
                      setSecurityQuestion(e.target.value);
                    }
                  }}
                  className="w-full px-3.5 py-2.5 bg-slate-950 border border-white/10 rounded-xl text-sm text-white focus:outline-none focus:border-amber-400"
                >
                  {PREDEFINED_SECURITY_QUESTIONS.map((q) => (
                    <option key={q} value={q}>
                      {q}
                    </option>
                  ))}
                  <option value="custom">-- Custom Security Question --</option>
                </select>
              </div>

              {isCustomQuestion && (
                <div className="space-y-1.5">
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-300">
                    Custom Question
                  </label>
                  <input
                    type="text"
                    required
                    value={customQuestion}
                    onChange={(e) => setCustomQuestion(e.target.value)}
                    placeholder="Enter your custom security question"
                    className="w-full px-3.5 py-2.5 bg-slate-950 border border-white/10 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:border-amber-400"
                  />
                </div>
              )}

              {/* Security Answer */}
              <div className="space-y-1.5">
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-300">
                  Security Answer (Hashed with Salt)
                </label>
                <input
                  type="text"
                  value={securityAnswer}
                  onChange={(e) => setSecurityAnswer(e.target.value)}
                  placeholder="Enter or update your security answer"
                  className="w-full px-3.5 py-2.5 bg-slate-950 border border-white/10 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:border-amber-400"
                />
                <p className="text-[11px] text-slate-400">
                  Stored securely using salted SHA-256 encryption. Plaintext is never saved.
                </p>
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={securityLoading}
                  className="w-full py-2.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-black uppercase tracking-wider text-xs shadow-lg transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  <Save className="w-4 h-4" />
                  <span>{securityLoading ? 'Saving Settings...' : 'Save Recovery Settings'}</span>
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
