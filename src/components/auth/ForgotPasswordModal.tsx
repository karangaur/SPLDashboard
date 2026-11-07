import React, { useState } from 'react';
import {
  X,
  KeyRound,
  Mail,
  Calendar,
  HelpCircle,
  ShieldCheck,
  AlertCircle,
  CheckCircle2,
  Lock,
  ArrowRight,
  ArrowLeft,
  RotateCcw,
} from 'lucide-react';
import { UserService } from '../../services/userService';
import { SecurityService } from '../../services/securityService';

interface ForgotPasswordModalProps {
  isOpen: boolean;
  onClose: () => void;
  onPasswordResetSuccess?: () => void;
}

type Step = 'email' | 'verify' | 'reset' | 'success';

export const ForgotPasswordModal: React.FC<ForgotPasswordModalProps> = ({
  isOpen,
  onClose,
  onPasswordResetSuccess,
}) => {
  const [step, setStep] = useState<Step>('email');
  const [identifier, setIdentifier] = useState('');
  const [dob, setDob] = useState('');
  const [securityQuestion, setSecurityQuestion] = useState('');
  const [securityAnswer, setSecurityAnswer] = useState('');
  const [recoveryToken, setRecoveryToken] = useState<string | null>(null);

  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Rate limiting attempts tracking
  const [attemptCount, setAttemptCount] = useState(0);

  if (!isOpen) return null;

  // Step 1: Submit email / username to verify account existence and load security question
  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    const cleanId = identifier.trim().toLowerCase();

    if (!cleanId) {
      setErrorMessage('Please enter your registered email address or username.');
      return;
    }

    setLoading(true);
    try {
      const user = await UserService.getUserByEmailOrUsername(cleanId);
      if (!user) {
        // Generic response to avoid email enumeration
        setErrorMessage('If this account exists and is active, you can proceed with identity verification.');
        return;
      }

      if (!user.isActive) {
        setErrorMessage('This account has been deactivated. Please contact tournament administration.');
        return;
      }

      if (!user.securityQuestion) {
        setErrorMessage('No security question is configured for this account. Please contact Super Admin for assistance.');
        return;
      }

      setSecurityQuestion(user.securityQuestion);
      setStep('verify');
    } catch {
      setErrorMessage('A network error occurred verifying your account. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Step 2: Verify DOB and Security Answer
  const handleVerifySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (attemptCount >= 5) {
      setErrorMessage('Too many failed verification attempts. Please wait 10 minutes before retrying.');
      return;
    }

    setLoading(true);
    try {
      const res = await UserService.verifyRecoveryStep1(identifier, dob, securityAnswer);
      if (res.success && res.recoveryToken) {
        setRecoveryToken(res.recoveryToken);
        setStep('reset');
      } else {
        setAttemptCount((prev) => prev + 1);
        setErrorMessage(res.error || 'Verification failed. Date of Birth or Security Answer is incorrect.');
      }
    } catch {
      setErrorMessage('An error occurred during verification. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Step 3: Set New Password
  const handleResetSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!recoveryToken) {
      setErrorMessage('Invalid recovery session. Please restart verification.');
      setStep('email');
      return;
    }

    if (newPassword !== confirmPassword) {
      setErrorMessage('New password and confirmation do not match.');
      return;
    }

    const val = SecurityService.validatePassword(newPassword);
    if (!val.isValid) {
      setErrorMessage(val.message || 'Password does not meet minimum security requirements.');
      return;
    }

    setLoading(true);
    try {
      const res = await UserService.completePasswordReset(recoveryToken, newPassword);
      if (res.success) {
        setStep('success');
        if (onPasswordResetSuccess) onPasswordResetSuccess();
      } else {
        setErrorMessage(res.error || 'Failed to reset password.');
      }
    } catch {
      setErrorMessage('An error occurred resetting your password.');
    } finally {
      setLoading(false);
    }
  };

  const resetAll = () => {
    setStep('email');
    setIdentifier('');
    setDob('');
    setSecurityQuestion('');
    setSecurityAnswer('');
    setRecoveryToken(null);
    setNewPassword('');
    setConfirmPassword('');
    setErrorMessage(null);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-md animate-fade-in">
      <div className="relative w-full max-w-md bg-slate-900 border border-white/10 rounded-3xl shadow-2xl overflow-hidden p-6 sm:p-8">
        
        {/* Accent Bar */}
        <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-amber-400 via-emerald-400 to-cyan-400" />

        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2 px-2.5 py-1 rounded bg-amber-400/10 border border-amber-400/20 text-amber-300 text-xs font-bold uppercase tracking-wider">
            <KeyRound className="w-3.5 h-3.5" />
            <span>Account Recovery</span>
          </div>
          <button
            onClick={() => {
              resetAll();
              onClose();
            }}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/5 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Step 1: Identifier Entry */}
        {step === 'email' && (
          <form onSubmit={handleEmailSubmit} className="space-y-4">
            <div className="space-y-1">
              <h3 className="text-xl font-black font-display uppercase tracking-tight text-white">
                Forgot Password?
              </h3>
              <p className="text-xs text-slate-400">
                Enter your registered administrator email address or username to begin identity verification.
              </p>
            </div>

            {errorMessage && (
              <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{errorMessage}</span>
              </div>
            )}

            <div className="space-y-1.5">
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-300">
                Registered Email or Username
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 absolute left-3.5 top-3.5 text-slate-400" />
                <input
                  type="text"
                  required
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  placeholder="admin@spl.com or username"
                  className="w-full pl-10 pr-3.5 py-2.5 bg-slate-950 border border-white/10 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:border-amber-400"
                />
              </div>
            </div>

            <div className="pt-2">
              <button
                type="submit"
                disabled={loading}
                className="w-full py-2.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-black uppercase tracking-wider text-xs shadow-lg transition-all flex items-center justify-center gap-2 disabled:opacity-50"
              >
                <span>{loading ? 'Checking Account...' : 'Continue to Verification'}</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </form>
        )}

        {/* Step 2: Date of Birth & Security Question Verification */}
        {step === 'verify' && (
          <form onSubmit={handleVerifySubmit} className="space-y-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2 text-xs font-bold text-amber-300">
                <ShieldCheck className="w-4 h-4" />
                <span>Step 2 of 3: Identity Verification</span>
              </div>
              <h3 className="text-xl font-black font-display uppercase tracking-tight text-white">
                Verify Your Identity
              </h3>
              <p className="text-xs text-slate-400">
                Answer your registered Date of Birth and security question to verify ownership.
              </p>
            </div>

            {errorMessage && (
              <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{errorMessage}</span>
              </div>
            )}

            <div className="space-y-1.5">
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-300">
                Registered Date of Birth
              </label>
              <div className="relative">
                <Calendar className="w-4 h-4 absolute left-3.5 top-3.5 text-slate-400" />
                <input
                  type="date"
                  required
                  value={dob}
                  onChange={(e) => setDob(e.target.value)}
                  className="w-full pl-10 pr-3.5 py-2.5 bg-slate-950 border border-white/10 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:border-amber-400"
                />
              </div>
            </div>

            <div className="p-3 rounded-xl bg-white/[0.02] border border-white/5 space-y-2">
              <div className="flex items-center gap-1.5 text-xs font-bold text-slate-300">
                <HelpCircle className="w-3.5 h-3.5 text-amber-400" />
                <span>Your Security Question:</span>
              </div>
              <p className="text-sm font-semibold text-white pl-5">{securityQuestion}</p>
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-300">
                Your Security Answer
              </label>
              <input
                type="text"
                required
                value={securityAnswer}
                onChange={(e) => setSecurityAnswer(e.target.value)}
                placeholder="Enter exact security answer"
                className="w-full px-3.5 py-2.5 bg-slate-950 border border-white/10 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:border-amber-400"
              />
            </div>

            <div className="flex items-center gap-2 pt-2">
              <button
                type="button"
                onClick={() => setStep('email')}
                className="px-4 py-2.5 rounded-xl border border-white/10 text-slate-300 hover:text-white text-xs font-bold uppercase transition-colors"
              >
                Back
              </button>
              <button
                type="submit"
                disabled={loading}
                className="flex-1 py-2.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-black uppercase tracking-wider text-xs shadow-lg transition-all flex items-center justify-center gap-2 disabled:opacity-50"
              >
                <span>{loading ? 'Verifying Answers...' : 'Verify & Continue'}</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </form>
        )}

        {/* Step 3: Enter New Password */}
        {step === 'reset' && (
          <form onSubmit={handleResetSubmit} className="space-y-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2 text-xs font-bold text-emerald-400">
                <CheckCircle2 className="w-4 h-4" />
                <span>Identity Verified Successfully</span>
              </div>
              <h3 className="text-xl font-black font-display uppercase tracking-tight text-white">
                Create New Password
              </h3>
              <p className="text-xs text-slate-400">
                Choose a strong security password for your tournament administration account.
              </p>
            </div>

            {errorMessage && (
              <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{errorMessage}</span>
              </div>
            )}

            <div className="space-y-1.5">
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-300">
                New Password
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 absolute left-3.5 top-3.5 text-slate-400" />
                <input
                  type="password"
                  required
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Min 8 characters (uppercase, lowercase, number)"
                  className="w-full pl-10 pr-3.5 py-2.5 bg-slate-950 border border-white/10 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:border-amber-400"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-300">
                Confirm New Password
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 absolute left-3.5 top-3.5 text-slate-400" />
                <input
                  type="password"
                  required
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Re-type new password"
                  className="w-full pl-10 pr-3.5 py-2.5 bg-slate-950 border border-white/10 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:border-amber-400"
                />
              </div>
            </div>

            <div className="pt-2">
              <button
                type="submit"
                disabled={loading}
                className="w-full py-2.5 rounded-xl bg-emerald-400 hover:bg-emerald-300 text-slate-950 font-black uppercase tracking-wider text-xs shadow-lg transition-all flex items-center justify-center gap-2 disabled:opacity-50"
              >
                <span>{loading ? 'Updating Password...' : 'Save New Password & Complete'}</span>
                <CheckCircle2 className="w-4 h-4" />
              </button>
            </div>
          </form>
        )}

        {/* Step 4: Success Screen */}
        {step === 'success' && (
          <div className="space-y-5 text-center py-4">
            <div className="w-16 h-16 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 flex items-center justify-center mx-auto shadow-xl">
              <CheckCircle2 className="w-8 h-8" />
            </div>

            <div className="space-y-2">
              <h3 className="text-2xl font-black font-display uppercase tracking-tight text-white">
                Password Reset Successfully!
              </h3>
              <p className="text-xs text-slate-300 max-w-sm mx-auto">
                Your account password has been updated in the centralized security database. You may now log in with your new credentials.
              </p>
            </div>

            <button
              onClick={() => {
                resetAll();
                onClose();
              }}
              className="w-full py-3 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-black uppercase tracking-wider text-xs shadow-lg transition-all"
            >
              Sign In Now
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
