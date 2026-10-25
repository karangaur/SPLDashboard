import React, { useState, useEffect } from 'react';
import {
  Trophy,
  CheckCircle2,
  AlertCircle,
  Copy,
  Calendar,
  MapPin,
  Sparkles,
  Phone,
  MessageCircle,
  CreditCard,
  ShieldCheck,
  RefreshCw,
  Clock,
  User,
  ExternalLink,
  Upload,
  X,
  AlertTriangle,
  ArrowRight,
  ShieldAlert,
} from 'lucide-react';
import { useTournament, sportsAudio } from '../../context/TournamentContext';
import {
  formatINR,
  validateIndianMobile,
  buildUPIPaymentLink,
  createDefaultFormConfig,
} from '../../utils/tournamentEngine';
import { Registration, RegistrationFormConfig } from '../../types/tournament';

interface PublicRegistrationPageProps {
  onBackToApp?: () => void;
  seasonParam?: string;
}

export const PublicRegistrationPage: React.FC<PublicRegistrationPageProps> = ({
  onBackToApp,
  seasonParam,
}) => {
  const { state, submitPublicRegistration } = useTournament();

  const activeSeasonSlug = seasonParam || state.registrationSettings.seasonSlug || 'season-4';

  // Form configuration loaded from server
  const [formConfig, setFormConfig] = useState<RegistrationFormConfig>(() =>
    createDefaultFormConfig(activeSeasonSlug)
  );
  const [loadingConfig, setLoadingConfig] = useState(true);

  // Link token status
  const [tokenParam, setTokenParam] = useState<string | null>(null);
  const [isTokenRevoked, setIsTokenRevoked] = useState(false);
  const [tokenChecked, setTokenChecked] = useState(false);

  // Dynamic field values state (keyed by field id)
  const [answers, setAnswers] = useState<Record<string, any>>({});
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);

  // Payment states
  const [txnId, setTxnId] = useState('');

  // UI status
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successReg, setSuccessReg] = useState<Registration | null>(null);
  const [copiedId, setCopiedId] = useState(false);

  // Fetch form configuration and validate token on load
  useEffect(() => {
    let isMounted = true;

    // 1. Get token from URL search query or hash
    let foundToken: string | null = null;
    if (typeof window !== 'undefined') {
      const searchParams = new URLSearchParams(window.location.search);
      foundToken = searchParams.get('token') || searchParams.get('tok') || null;
      if (!foundToken && window.location.hash.includes('token=')) {
        const hashMatch = window.location.hash.match(/token=([^&]+)/);
        if (hashMatch) foundToken = decodeURIComponent(hashMatch[1]);
      }
    }
    setTokenParam(foundToken);

    // 2. Fetch form config
    fetch(`/api/forms/${activeSeasonSlug}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (isMounted && data && data.fields) {
          setFormConfig(data);
        }
      })
      .catch(() => {})
      .finally(() => {
        if (isMounted) setLoadingConfig(false);
      });

    // 3. Validate token if present
    if (foundToken) {
      fetch(`/api/validate-token/${encodeURIComponent(foundToken)}`)
        .then((res) => (res.ok ? res.json() : null))
        .then((tokData) => {
          if (isMounted && tokData) {
            if (tokData.status === 'revoked') {
              setIsTokenRevoked(true);
            }
          }
        })
        .catch(() => {})
        .finally(() => {
          if (isMounted) setTokenChecked(true);
        });
    } else {
      setTokenChecked(true);
    }

    return () => {
      isMounted = false;
    };
  }, [activeSeasonSlug]);

  const appearance = formConfig.appearance;
  const accentColor = appearance?.accentColor || '#10b981';
  const entryFee = formConfig.entryFee ?? (state.settings.entryFee || 500);

  // Field change handler
  const handleFieldChange = (fieldId: string, val: any) => {
    setAnswers((prev) => ({
      ...prev,
      [fieldId]: val,
    }));
  };

  // Checkbox multi-select toggle
  const handleCheckboxToggle = (fieldId: string, opt: string) => {
    const current = (answers[fieldId] as string[]) || [];
    const updated = current.includes(opt)
      ? current.filter((x) => x !== opt)
      : [...current, opt];
    handleFieldChange(fieldId, updated);
  };

  // Photo upload handler (converts to base64 preview for persistence)
  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 2 * 1024 * 1024) {
      setErrorMsg('Profile photo must be less than 2MB in size.');
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => {
      const base64 = reader.result as string;
      setPhotoPreview(base64);
      handleFieldChange('photo', base64);
    };
    reader.readAsDataURL(file);
  };

  const handleRemovePhoto = () => {
    setPhotoPreview(null);
    handleFieldChange('photo', undefined);
  };

  // Submit Handler
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (!formConfig.enabled) {
      setErrorMsg(formConfig.closedNotice || 'Registrations are currently closed.');
      return;
    }

    // Required field validation
    for (const field of formConfig.fields) {
      if (field.enabled && field.required) {
        const val = answers[field.id];
        if (val === undefined || val === null || String(val).trim() === '') {
          setErrorMsg(`Please fill in the required field: "${field.label}"`);
          return;
        }
        if (field.type === 'mobile') {
          const mobileCheck = validateIndianMobile(String(val));
          if (!mobileCheck.isValid) {
            setErrorMsg(mobileCheck.error || `Please enter a valid 10-digit Indian mobile number for "${field.label}".`);
            return;
          }
        }
      }
    }

    // Baseline name & mobile validation
    const athleteName = String(answers.name || '').trim();
    if (athleteName.length < 2) {
      setErrorMsg('Please enter a valid athlete legal name (at least 2 characters).');
      return;
    }

    const mobileStr = String(answers.mobile || '').trim();
    const mCheck = validateIndianMobile(mobileStr);
    if (!mCheck.isValid) {
      setErrorMsg(mCheck.error || 'Please enter a valid 10-digit Indian mobile number.');
      return;
    }

    setSubmitting(true);

    try {
      const payload = {
        name: athleteName,
        mobile: mCheck.cleanMobile,
        whatsapp: answers.whatsapp ? String(answers.whatsapp).trim() : undefined,
        age: answers.age ? Number(answers.age) : undefined,
        gender: answers.gender || 'M',
        experience: answers.experience || undefined,
        category: answers.category || undefined,
        style: answers.style || undefined,
        city: answers.city ? String(answers.city).trim() : undefined,
        notes: answers.notes ? String(answers.notes).trim() : undefined,
        fee: entryFee,
        season: activeSeasonSlug,
        txnId: txnId.trim() || undefined,
        method: 'upi',
        tokenUsed: tokenParam || undefined,
        answers: { ...answers },
        photoUrl: photoPreview || undefined,
      };

      const result = await submitPublicRegistration(payload);

      if (result.success && result.registration) {
        sportsAudio.playFanfare();
        setSuccessReg(result.registration);
      } else {
        if (result.linkRevoked) {
          setIsTokenRevoked(true);
        }
        setErrorMsg(
          result.error ||
            'Failed to submit registration. Please try again or contact the tournament desk.'
        );
      }
    } catch (err: any) {
      setErrorMsg(err?.message || 'A network error occurred. Please check your connection.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleCopyRegId = () => {
    if (!successReg) return;
    navigator.clipboard.writeText(successReg.regId);
    setCopiedId(true);
    setTimeout(() => setCopiedId(false), 2000);
  };

  const handleShareWhatsAppConfirmation = () => {
    if (!successReg) return;
    const text = `🏸 *Smash Premier League — Registration Confirmed!*\n\nAthlete: ${successReg.name}\nReg ID: ${successReg.regId}\nTournament: ${formConfig.tournamentName}\nSeason: ${formConfig.seasonTitle}\nVenue: ${formConfig.venue || 'Indoor Badminton Stadium'}\nDate: ${formConfig.date || 'TBD'}\nFee Status: Pending Organizer Approval`;
    const url = `https://wa.me/?text=${encodeURIComponent(text)}`;
    window.open(url, '_blank');
  };

  const handleResetForm = () => {
    setSuccessReg(null);
    setAnswers({});
    setPhotoPreview(null);
    setTxnId('');
    setErrorMsg(null);
  };

  // UPI payment deep link
  const upiLink = buildUPIPaymentLink(state.payment, entryFee, 'ENTRY');

  return (
    <div className="min-h-screen bg-[#070a13] text-slate-100 selection:bg-emerald-400 selection:text-slate-950 flex flex-col justify-between py-6 px-4 sm:px-6 lg:px-8">
      {/* Top Header Bar */}
      <header className="max-w-3xl w-full mx-auto flex items-center justify-between pb-6 border-b border-white/10">
        <div className="flex items-center gap-3">
          <div
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl shadow-lg"
            style={{ backgroundColor: accentColor }}
          >
            <span className="text-2xl leading-none text-slate-950">🏸</span>
          </div>
          <div>
            <span className="block font-display text-base sm:text-lg font-black tracking-tight text-white leading-tight">
              {formConfig.tournamentName || 'Smash Premier League'}
            </span>
            <span className="block text-[11px] font-semibold text-slate-400">
              Official Athlete Registration Portal · {formConfig.seasonTitle}
            </span>
          </div>
        </div>

        {onBackToApp && (
          <button
            onClick={onBackToApp}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white transition-colors"
          >
            <span>Organizer Hub</span>
          </button>
        )}
      </header>

      {/* Main Form Content Container */}
      <main className="max-w-2xl w-full mx-auto my-6">
        {/* State 1: Invalidated / Revoked Link Notice */}
        {isTokenRevoked ? (
          <div className="rounded-3xl bg-[#0b1120] p-8 border border-rose-500/30 text-center space-y-5 shadow-2xl animate-fade-in">
            <div className="w-16 h-16 mx-auto rounded-3xl bg-rose-500/20 border border-rose-500/30 flex items-center justify-center text-rose-400">
              <ShieldAlert className="w-8 h-8" />
            </div>

            <div className="space-y-2">
              <h2 className="font-display text-2xl font-black text-white">
                Registration Link Expired
              </h2>
              <p className="text-sm text-slate-300 max-w-md mx-auto leading-relaxed">
                This registration link has been regenerated or closed by the tournament organizer. For security and slot fairness, previous links no longer accept entries.
              </p>
            </div>

            <div className="p-4 rounded-2xl bg-white/5 border border-white/10 max-w-md mx-auto text-xs text-slate-400 text-left space-y-1.5">
              <span className="font-bold text-slate-200 block">Next Steps:</span>
              <p>• Contact the Smash Premier League organizing committee or match desk.</p>
              <p>• Request the latest verified registration link for <span className="text-amber-400 font-bold">{formConfig.seasonTitle}</span>.</p>
            </div>

            {onBackToApp && (
              <button
                onClick={onBackToApp}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold bg-white/10 hover:bg-white/15 text-white transition-colors"
              >
                <span>Return to Dashboard</span>
              </button>
            )}
          </div>
        ) : successReg ? (
          /* State 2: Successful Registration Confirmation Card */
          <div className="rounded-3xl bg-[#0b1120] p-6 sm:p-8 border border-emerald-500/40 text-center space-y-6 shadow-2xl animate-fade-in relative overflow-hidden">
            <div
              className="absolute -top-24 left-1/2 -translate-x-1/2 w-96 h-96 rounded-full blur-3xl opacity-20 pointer-events-none"
              style={{ backgroundColor: accentColor }}
            />

            <div className="w-16 h-16 mx-auto rounded-3xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
              <CheckCircle2 className="w-8 h-8" />
            </div>

            <div className="space-y-2">
              <span className="text-xs font-black tracking-widest uppercase text-emerald-400">
                Official Receipt Confirmed
              </span>
              <h2 className="font-display text-2xl sm:text-3xl font-black text-white">
                {appearance.successTitle || 'Registration Submitted Successfully!'}
              </h2>
              <p className="text-xs sm:text-sm text-slate-300 max-w-lg mx-auto leading-relaxed">
                {appearance.successMessage ||
                  'Thank you for registering for Smash Premier League. Your details have been received by the tournament organizer.'}
              </p>
            </div>

            {/* Official Athlete Badge Card */}
            <div className="max-w-md mx-auto rounded-2xl bg-slate-900/90 border border-white/15 p-5 text-left space-y-4 shadow-xl">
              <div className="flex items-center justify-between pb-3 border-b border-white/10">
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    Registration ID
                  </span>
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-black text-lg text-emerald-400">
                      {successReg.regId}
                    </span>
                    <button
                      onClick={handleCopyRegId}
                      className="p-1 rounded-lg hover:bg-white/10 text-slate-400 hover:text-white"
                      title="Copy ID"
                    >
                      {copiedId ? (
                        <span className="text-[10px] text-emerald-400 font-bold">Copied!</span>
                      ) : (
                        <Copy className="w-3.5 h-3.5" />
                      )}
                    </button>
                  </div>
                </div>

                {photoPreview && (
                  <img
                    src={photoPreview}
                    alt="Athlete Profile"
                    className="w-12 h-12 rounded-xl object-cover border border-white/20"
                  />
                )}
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs">
                <div>
                  <span className="text-[10px] text-slate-400 block">Athlete Name</span>
                  <span className="font-bold text-white">{successReg.name}</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 block">Mobile</span>
                  <span className="font-mono font-bold text-white">{successReg.mobile}</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 block">Tournament</span>
                  <span className="font-semibold text-slate-200 truncate block">
                    {formConfig.tournamentName}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 block">Status</span>
                  <span className="text-amber-400 font-bold">Pending Organizer Review</span>
                </div>
              </div>
            </div>

            {/* Action buttons */}
            <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
              <button
                onClick={handleShareWhatsAppConfirmation}
                className="w-full sm:w-auto px-6 py-2.5 rounded-xl font-bold text-xs bg-emerald-600 hover:bg-emerald-500 text-white transition-all flex items-center justify-center gap-2 shadow-lg"
              >
                <MessageCircle className="w-4 h-4" />
                <span>Share Entry on WhatsApp</span>
              </button>

              <button
                onClick={handleResetForm}
                className="w-full sm:w-auto px-5 py-2.5 rounded-xl font-bold text-xs bg-white/10 hover:bg-white/15 text-slate-300 hover:text-white transition-colors"
              >
                <span>Register Another Player</span>
              </button>
            </div>
          </div>
        ) : (
          /* State 3: Public Athlete Registration Form */
          <div className="rounded-3xl bg-[#090d18] border border-white/10 p-6 sm:p-8 shadow-2xl relative overflow-hidden space-y-6">
            {/* Athletic subtle glow banner */}
            <div
              className="absolute -top-32 left-1/2 -translate-x-1/2 w-[500px] h-[500px] rounded-full blur-3xl opacity-10 pointer-events-none"
              style={{ backgroundColor: accentColor }}
            />

            {/* Form Headline */}
            <div className="space-y-3 pb-6 border-b border-white/10 relative">
              <div className="flex items-center gap-2">
                <span
                  className="px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider text-slate-950"
                  style={{ backgroundColor: accentColor }}
                >
                  Registration Open
                </span>
                <span className="text-xs text-slate-400 font-semibold">
                  {formConfig.seasonTitle}
                </span>
              </div>

              <h1 className="font-display text-2xl sm:text-3xl font-black text-white tracking-tight">
                {appearance.formTitle || 'Player Entry & Registration Form'}
              </h1>

              <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
                {appearance.formDescription ||
                  'Register as an official athlete for the upcoming Smash Premier League championship.'}
              </p>

              {appearance.welcomeMessage && (
                <div className="p-3 bg-white/5 border border-white/5 rounded-2xl text-xs text-slate-400">
                  ℹ️ {appearance.welcomeMessage}
                </div>
              )}

              {/* Tournament Meta Strip */}
              <div className="flex flex-wrap items-center gap-4 pt-2 text-xs text-slate-400">
                {formConfig.date && (
                  <div className="flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5 text-amber-400" />
                    <span>{formConfig.date}</span>
                  </div>
                )}
                {formConfig.venue && (
                  <div className="flex items-center gap-1.5">
                    <MapPin className="w-3.5 h-3.5 text-amber-400" />
                    <span>{formConfig.venue}</span>
                  </div>
                )}
                <div className="flex items-center gap-1.5">
                  <CreditCard className="w-3.5 h-3.5 text-emerald-400" />
                  <span className="font-bold text-white">Entry Fee: {formatINR(entryFee)}</span>
                </div>
              </div>
            </div>

            {/* Error banner */}
            {errorMsg && (
              <div className="p-3 bg-rose-500/20 border border-rose-500/30 rounded-2xl text-xs text-rose-300 flex items-center justify-between animate-fade-in">
                <div className="flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
                  <span>{errorMsg}</span>
                </div>
                <button
                  onClick={() => setErrorMsg(null)}
                  className="text-rose-400 hover:text-white font-bold ml-2"
                >
                  ✕
                </button>
              </div>
            )}

            {/* Interactive Dynamic Form */}
            <form onSubmit={handleSubmit} className="space-y-5">
              {formConfig.fields
                .filter((f) => f.enabled)
                .sort((a, b) => a.order - b.order)
                .map((field) => {
                  const currentValue = answers[field.id];

                  return (
                    <div key={field.id} className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <label className="block text-xs font-bold text-slate-200">
                          {field.label}
                          {field.required && (
                            <span className="text-rose-400 ml-1 font-bold">*</span>
                          )}
                          {!field.required && (
                            <span className="text-slate-500 text-[10px] ml-1.5 font-normal">
                              (Optional)
                            </span>
                          )}
                        </label>
                      </div>

                      {field.helpText && (
                        <p className="text-[11px] text-slate-400">{field.helpText}</p>
                      )}

                      {/* Field Type 1: Text */}
                      {field.type === 'text' && (
                        <input
                          type="text"
                          required={field.required}
                          value={currentValue || ''}
                          onChange={(e) => handleFieldChange(field.id, e.target.value)}
                          placeholder={field.placeholder || `Enter ${field.label.toLowerCase()}`}
                          className="w-full bg-slate-900/90 border border-white/10 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-emerald-500 transition-colors"
                        />
                      )}

                      {/* Field Type 2: Textarea */}
                      {field.type === 'textarea' && (
                        <textarea
                          rows={3}
                          required={field.required}
                          value={currentValue || ''}
                          onChange={(e) => handleFieldChange(field.id, e.target.value)}
                          placeholder={field.placeholder || 'Enter notes or information...'}
                          className="w-full bg-slate-900/90 border border-white/10 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-emerald-500 transition-colors resize-none"
                        />
                      )}

                      {/* Field Type 3: Mobile Number with validation */}
                      {field.type === 'mobile' && (
                        <div className="relative">
                          <span className="absolute left-3.5 top-2.5 text-xs font-mono font-bold text-slate-400">
                            +91
                          </span>
                          <input
                            type="tel"
                            maxLength={10}
                            required={field.required}
                            value={currentValue || ''}
                            onChange={(e) =>
                              handleFieldChange(field.id, e.target.value.replace(/\D/g, ''))
                            }
                            placeholder="9876543210"
                            className="w-full bg-slate-900/90 border border-white/10 rounded-xl pl-12 pr-3.5 py-2.5 text-xs text-white placeholder-slate-600 font-mono tracking-wider focus:outline-none focus:border-emerald-500 transition-colors"
                          />
                        </div>
                      )}

                      {/* Field Type 4: Email */}
                      {field.type === 'email' && (
                        <input
                          type="email"
                          required={field.required}
                          value={currentValue || ''}
                          onChange={(e) => handleFieldChange(field.id, e.target.value)}
                          placeholder="player@example.com"
                          className="w-full bg-slate-900/90 border border-white/10 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-emerald-500 transition-colors"
                        />
                      )}

                      {/* Field Type 5: Number */}
                      {field.type === 'number' && (
                        <input
                          type="number"
                          required={field.required}
                          value={currentValue || ''}
                          onChange={(e) => handleFieldChange(field.id, e.target.value)}
                          placeholder={field.placeholder || 'e.g. 24'}
                          className="w-full bg-slate-900/90 border border-white/10 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-slate-600 font-mono focus:outline-none focus:border-emerald-500 transition-colors"
                        />
                      )}

                      {/* Field Type 6: Date */}
                      {field.type === 'date' && (
                        <input
                          type="date"
                          required={field.required}
                          value={currentValue || ''}
                          onChange={(e) => handleFieldChange(field.id, e.target.value)}
                          className="w-full bg-slate-900/90 border border-white/10 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-emerald-500 transition-colors"
                        />
                      )}

                      {/* Field Type 7: Dropdown */}
                      {field.type === 'dropdown' && (
                        <select
                          required={field.required}
                          value={currentValue || ''}
                          onChange={(e) => handleFieldChange(field.id, e.target.value)}
                          className="w-full bg-slate-900 border border-white/10 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-emerald-500 transition-colors"
                        >
                          <option value="">Choose an option...</option>
                          {field.options?.map((opt, i) => (
                            <option key={i} value={opt}>
                              {opt}
                            </option>
                          ))}
                        </select>
                      )}

                      {/* Field Type 8: Radio Buttons */}
                      {field.type === 'radio' && (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                          {field.options?.map((opt, i) => {
                            const isSelected = currentValue === opt;
                            return (
                              <button
                                key={i}
                                type="button"
                                onClick={() => handleFieldChange(field.id, opt)}
                                className={`flex items-center gap-3 p-3 rounded-xl border text-left transition-all ${
                                  isSelected
                                    ? 'bg-white/10 border-white/30 ring-1 ring-white/20'
                                    : 'bg-slate-900/60 border-white/5 hover:bg-slate-900 text-slate-300'
                                }`}
                              >
                                <div
                                  className="w-4 h-4 rounded-full border border-white/30 flex items-center justify-center shrink-0"
                                  style={isSelected ? { borderColor: accentColor } : {}}
                                >
                                  {isSelected && (
                                    <div
                                      className="w-2 h-2 rounded-full"
                                      style={{ backgroundColor: accentColor }}
                                    />
                                  )}
                                </div>
                                <span className="text-xs font-semibold text-white">{opt}</span>
                              </button>
                            );
                          })}
                        </div>
                      )}

                      {/* Field Type 9: Checkboxes (multi-choice) */}
                      {field.type === 'checkbox' && (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                          {field.options?.map((opt, i) => {
                            const checkedList = (currentValue as string[]) || [];
                            const isChecked = checkedList.includes(opt);
                            return (
                              <button
                                key={i}
                                type="button"
                                onClick={() => handleCheckboxToggle(field.id, opt)}
                                className={`flex items-center gap-3 p-3 rounded-xl border text-left transition-all ${
                                  isChecked
                                    ? 'bg-white/10 border-white/30 ring-1 ring-white/20'
                                    : 'bg-slate-900/60 border-white/5 hover:bg-slate-900 text-slate-300'
                                }`}
                              >
                                <div
                                  className="w-4 h-4 rounded border border-white/30 flex items-center justify-center shrink-0"
                                  style={isChecked ? { borderColor: accentColor, backgroundColor: accentColor } : {}}
                                >
                                  {isChecked && (
                                    <span className="text-slate-950 text-[10px] font-black">✓</span>
                                  )}
                                </div>
                                <span className="text-xs font-semibold text-white">{opt}</span>
                              </button>
                            );
                          })}
                        </div>
                      )}

                      {/* Field Type 10: Profile Photo Upload */}
                      {field.type === 'photo' && (
                        <div className="pt-1">
                          {photoPreview ? (
                            <div className="flex items-center gap-4 p-3 bg-slate-900 rounded-2xl border border-white/10">
                              <img
                                src={photoPreview}
                                alt="Headshot"
                                className="w-14 h-14 rounded-xl object-cover border border-white/20"
                              />
                              <div className="flex-1 min-w-0">
                                <span className="text-xs font-bold text-white block">
                                  Athlete Photo Uploaded
                                </span>
                                <span className="text-[10px] text-emerald-400 font-semibold block">
                                  Ready for tournament badge
                                </span>
                              </div>
                              <button
                                type="button"
                                onClick={handleRemovePhoto}
                                className="p-2 rounded-xl text-rose-400 hover:text-white hover:bg-rose-500/20 text-xs font-bold"
                              >
                                Remove
                              </button>
                            </div>
                          ) : (
                            <label className="flex flex-col items-center justify-center p-6 border-2 border-dashed border-white/15 hover:border-emerald-500/50 rounded-2xl cursor-pointer bg-slate-900/50 hover:bg-slate-900/80 transition-all text-center">
                              <Upload className="w-6 h-6 text-slate-400 mb-1.5" />
                              <span className="text-xs font-bold text-slate-200">
                                Click or Drag to Upload Athlete Photo
                              </span>
                              <span className="text-[10px] text-slate-500 mt-0.5">
                                JPG, PNG or WebP (Max 2MB)
                              </span>
                              <input
                                type="file"
                                accept="image/*"
                                onChange={handlePhotoUpload}
                                className="hidden"
                              />
                            </label>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}

              {/* UPI Entry Fee Details Box */}
              {entryFee > 0 && (
                <div className="p-5 rounded-2xl bg-slate-900/90 border border-white/10 space-y-4">
                  <div className="flex items-center justify-between pb-3 border-b border-white/5">
                    <div className="flex items-center gap-2">
                      <CreditCard className="w-4 h-4 text-emerald-400" />
                      <span className="text-xs font-bold text-white uppercase tracking-wider">
                        Tournament Entry Fee Payment
                      </span>
                    </div>
                    <span className="text-sm font-black font-mono text-emerald-400">
                      {formatINR(entryFee)}
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-center">
                    {/* UPI QR & App link */}
                    <div className="flex flex-col items-center sm:items-start space-y-2">
                      {state.payment.qrImage && (
                        <img
                          src={state.payment.qrImage}
                          alt="Tournament UPI QR"
                          className="w-28 h-28 rounded-xl bg-white p-1 shadow-md"
                        />
                      )}
                      <div className="text-xs text-slate-300">
                        <span className="text-slate-400 block text-[10px]">UPI VPA:</span>
                        <span className="font-mono font-bold text-white">
                          {state.payment.upiId || 'spl.tournament@okhdfcbank'}
                        </span>
                      </div>
                      {upiLink && (
                        <a
                          href={upiLink}
                          className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-400 hover:text-emerald-300 underline"
                        >
                          <span>Open in UPI App (GPay/PhonePe)</span>
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      )}
                    </div>

                    {/* UTR / Transaction Input */}
                    <div className="space-y-2">
                      <label className="block text-xs font-bold text-slate-300">
                        UPI Transaction / Reference Ref (UTR)
                      </label>
                      <input
                        type="text"
                        value={txnId}
                        onChange={(e) => setTxnId(e.target.value)}
                        placeholder="12-digit UPI Ref ID"
                        className="w-full bg-slate-950 border border-white/10 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-slate-600 font-mono focus:outline-none focus:border-emerald-500"
                      />
                      <p className="text-[10px] text-slate-400 leading-tight">
                        You can also submit now and confirm payment directly with the match desk.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Submit Button */}
              <div className="pt-4">
                <button
                  type="submit"
                  disabled={submitting}
                  style={{ backgroundColor: accentColor }}
                  className="w-full py-3.5 rounded-2xl font-display font-black text-slate-950 text-sm tracking-wide shadow-xl hover:opacity-95 active:scale-[0.99] transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {submitting ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>Submitting Registration...</span>
                    </>
                  ) : (
                    <>
                      <span>{appearance.submitButtonText || 'Submit Registration & Confirm Entry'}</span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="max-w-3xl w-full mx-auto pt-6 border-t border-white/10 text-center text-xs text-slate-500">
        <p>Smash Premier League Tournament Organization Platform · All athlete data encrypted</p>
      </footer>
    </div>
  );
};
