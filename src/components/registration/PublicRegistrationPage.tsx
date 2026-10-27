import React, { useState, useEffect, useMemo } from 'react';
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
  Check,
  QrCode,
} from 'lucide-react';
import { useTournament, sportsAudio } from '../../context/TournamentContext';
import {
  formatINR,
  validateIndianMobile,
  buildUPIPaymentUri,
  generateUPIQRCode,
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

  // Dynamic fee calculation based on selected category if category pricing is configured
  const selectedCategory = answers.category || answers.preferredCategory || answers.eventCategory;
  const effectiveFee = useMemo(() => {
    if (formConfig.payment && !formConfig.payment.enabled) return 0;
    if (selectedCategory && formConfig.payment?.categoryFees && formConfig.payment.categoryFees[selectedCategory] !== undefined) {
      return Number(formConfig.payment.categoryFees[selectedCategory]);
    }
    return formConfig.payment?.baseFee ?? formConfig.entryFee ?? (state.settings.entryFee || 500);
  }, [formConfig.payment, formConfig.entryFee, state.settings.entryFee, selectedCategory]);

  const recipientUpiId = formConfig.payment?.upiId || state.payment.upiId || 'karan-hdfc@ybl';
  const recipientName = formConfig.payment?.accountName || state.payment.accountName || 'Smash Premier League (Karan Gaur)';
  const paymentInstructions = formConfig.payment?.instructions || 'Scan the QR code or tap the UPI button to pay using Google Pay, PhonePe, or Paytm. Submit the 12-digit transaction UTR reference below.';
  const paymentBtnLabel = formConfig.payment?.buttonText || 'Pay Registration Fee';

  const [upiQrCodeUrl, setUpiQrCodeUrl] = useState<string>('');
  const [copiedUpi, setCopiedUpi] = useState(false);

  useEffect(() => {
    if (effectiveFee > 0 && recipientUpiId) {
      const uri = buildUPIPaymentUri({
        upiId: recipientUpiId,
        accountName: recipientName,
        amount: effectiveFee,
        note: formConfig.payment?.note || 'SPL Maharajganj Player Entry Fee',
      }, 'generic');
      generateUPIQRCode(uri).then(setUpiQrCodeUrl).catch(() => {});
    } else {
      setUpiQrCodeUrl('');
    }
  }, [effectiveFee, recipientUpiId, recipientName, formConfig.payment?.note]);

  const gpayUri = buildUPIPaymentUri({ upiId: recipientUpiId, accountName: recipientName, amount: effectiveFee, note: 'SPL Tournament Fee' }, 'gpay');
  const phonepeUri = buildUPIPaymentUri({ upiId: recipientUpiId, accountName: recipientName, amount: effectiveFee, note: 'SPL Tournament Fee' }, 'phonepe');
  const paytmUri = buildUPIPaymentUri({ upiId: recipientUpiId, accountName: recipientName, amount: effectiveFee, note: 'SPL Tournament Fee' }, 'paytm');
  const genericUri = buildUPIPaymentUri({ upiId: recipientUpiId, accountName: recipientName, amount: effectiveFee, note: 'SPL Tournament Fee' }, 'generic');

  const handleCopyUpiId = () => {
    navigator.clipboard.writeText(recipientUpiId);
    setCopiedUpi(true);
    setTimeout(() => setCopiedUpi(false), 2000);
  };

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

    // Required field validation (skipping informational section headings)
    for (const field of formConfig.fields) {
      if (field.enabled && field.required && field.type !== 'section_heading') {
        const val = answers[field.id];
        if (field.type === 'terms' && !val) {
          setErrorMsg(`Please accept the terms and conditions: "${field.label}"`);
          return;
        }
        if (val === undefined || val === null || String(val).trim() === '') {
          setErrorMsg(`Please fill in the required field: "${field.label}"`);
          return;
        }
        if (field.type === 'mobile' || field.type === 'phone') {
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

    // Mandatory payment check
    if (formConfig.payment?.enabled && formConfig.payment?.isMandatory && effectiveFee > 0) {
      if (!txnId.trim()) {
        setErrorMsg('Payment reference (UTR number) is required for registration. Please initiate payment via Google Pay, PhonePe, or Paytm and enter your 12-digit UPI reference number below.');
        return;
      }
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
        category: selectedCategory || answers.category || undefined,
        style: answers.style || undefined,
        city: answers.city ? String(answers.city).trim() : undefined,
        notes: answers.notes ? String(answers.notes).trim() : undefined,
        fee: effectiveFee,
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
  const upiLink = buildUPIPaymentLink(state.payment, effectiveFee, 'ENTRY');

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
                  <span className="font-bold text-white">Entry Fee: {formatINR(effectiveFee)}</span>
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

                  // Type 1: Section Heading / Informational Text
                  if (field.type === 'section_heading') {
                    return (
                      <div key={field.id} className="pt-3 pb-1">
                        <div className="p-4 rounded-2xl bg-white/[0.04] border border-white/10 flex items-start gap-3">
                          <span className="text-xl">🏷️</span>
                          <div>
                            <h3 className="font-display font-bold text-white text-sm sm:text-base tracking-tight">
                              {field.label}
                            </h3>
                            <p className="text-xs text-slate-400 mt-0.5 leading-relaxed">
                              {field.content || field.helpText || 'Official tournament instructions and guidelines.'}
                            </p>
                          </div>
                        </div>
                      </div>
                    );
                  }

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

                      {/* Field Type: Short Text */}
                      {(field.type === 'text' || field.type === 'short_text') && (
                        <input
                          type="text"
                          required={field.required}
                          value={currentValue || ''}
                          onChange={(e) => handleFieldChange(field.id, e.target.value)}
                          placeholder={field.placeholder || `Enter ${field.label.toLowerCase()}`}
                          className="w-full bg-slate-900/90 border border-white/10 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-emerald-500 transition-colors"
                        />
                      )}

                      {/* Field Type: Long Text */}
                      {(field.type === 'textarea' || field.type === 'long_text') && (
                        <textarea
                          rows={3}
                          required={field.required}
                          value={currentValue || ''}
                          onChange={(e) => handleFieldChange(field.id, e.target.value)}
                          placeholder={field.placeholder || 'Enter notes or information...'}
                          className="w-full bg-slate-900/90 border border-white/10 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-emerald-500 transition-colors resize-none"
                        />
                      )}

                      {/* Field Type: Mobile / Phone with +91 */}
                      {(field.type === 'mobile' || field.type === 'phone') && (
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

                      {/* Field Type: Email */}
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

                      {/* Field Type: Number */}
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

                      {/* Field Type: Athlete Age */}
                      {field.type === 'age' && (
                        <div className="space-y-1">
                          <input
                            type="number"
                            min={field.min ?? 10}
                            max={field.max ?? 80}
                            required={field.required}
                            value={currentValue || ''}
                            onChange={(e) => handleFieldChange(field.id, e.target.value)}
                            placeholder="e.g. 24"
                            className="w-full bg-slate-900/90 border border-white/10 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-slate-600 font-mono focus:outline-none focus:border-emerald-500 transition-colors"
                          />
                          {(field.min != null || field.max != null) && (
                            <span className="text-[10px] text-slate-500">
                              Eligible age: {field.min ?? 10} to {field.max ?? 80} years
                            </span>
                          )}
                        </div>
                      )}

                      {/* Field Type: City / Locality */}
                      {field.type === 'city' && (
                        <div className="relative">
                          <span className="absolute left-3.5 top-2.5 text-xs text-slate-400">📍</span>
                          <input
                            type="text"
                            required={field.required}
                            value={currentValue || ''}
                            onChange={(e) => handleFieldChange(field.id, e.target.value)}
                            placeholder={field.placeholder || 'e.g. Maharajganj, Gorakhpur'}
                            className="w-full bg-slate-900/90 border border-white/10 rounded-xl pl-9 pr-3.5 py-2.5 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-emerald-500 transition-colors"
                          />
                        </div>
                      )}

                      {/* Field Type: Date Picker */}
                      {field.type === 'date' && (
                        <input
                          type="date"
                          required={field.required}
                          value={currentValue || ''}
                          onChange={(e) => handleFieldChange(field.id, e.target.value)}
                          className="w-full bg-slate-900/90 border border-white/10 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-emerald-500 transition-colors"
                        />
                      )}

                      {/* Field Type: Dropdown / Select */}
                      {(field.type === 'dropdown' || field.type === 'select') && (
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

                      {/* Field Type: Radio Buttons */}
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

                      {/* Field Type: Gender Selection */}
                      {field.type === 'gender' && (
                        <div className="grid grid-cols-3 gap-2 pt-1">
                          {[
                            { id: 'Male', label: 'Male', icon: '♂️' },
                            { id: 'Female', label: 'Female', icon: '♀️' },
                            { id: 'Other', label: 'Other', icon: '⚧' },
                          ].map((g) => {
                            const isSelected = currentValue === g.id || (answers.gender === g.id && !currentValue);
                            return (
                              <button
                                key={g.id}
                                type="button"
                                onClick={() => {
                                  handleFieldChange(field.id, g.id);
                                  handleFieldChange('gender', g.id === 'Male' ? 'M' : g.id === 'Female' ? 'F' : 'Other');
                                }}
                                className={`flex items-center justify-center gap-1.5 p-2.5 rounded-xl border text-xs font-bold transition-all ${
                                  isSelected
                                    ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-300'
                                    : 'bg-slate-900/60 border-white/10 text-slate-400 hover:text-white hover:bg-slate-900'
                                }`}
                              >
                                <span>{g.icon}</span>
                                <span>{g.label}</span>
                              </button>
                            );
                          })}
                        </div>
                      )}

                      {/* Field Type: Yes / No Toggle */}
                      {field.type === 'yes_no' && (
                        <div className="grid grid-cols-2 gap-2 pt-1">
                          {['Yes', 'No'].map((opt) => {
                            const isSelected = currentValue === opt;
                            return (
                              <button
                                key={opt}
                                type="button"
                                onClick={() => handleFieldChange(field.id, opt)}
                                className={`flex items-center justify-center gap-2 p-2.5 rounded-xl border text-xs font-bold transition-all ${
                                  isSelected
                                    ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-300'
                                    : 'bg-slate-900/60 border-white/10 text-slate-400 hover:text-white hover:bg-slate-900'
                                }`}
                              >
                                <span>{opt === 'Yes' ? '✅ Yes' : '❌ No'}</span>
                              </button>
                            );
                          })}
                        </div>
                      )}

                      {/* Field Type: Checkboxes */}
                      {(field.type === 'checkbox' || field.type === 'checkboxes') && (
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

                      {/* Field Type: Terms and Conditions */}
                      {field.type === 'terms' && (
                        <div className="p-3.5 bg-white/[0.03] border border-white/10 rounded-2xl text-xs space-y-2">
                          <label className="flex items-start gap-3 cursor-pointer">
                            <input
                              type="checkbox"
                              required={field.required}
                              checked={Boolean(currentValue)}
                              onChange={(e) => handleFieldChange(field.id, e.target.checked)}
                              className="mt-0.5 rounded text-emerald-500 focus:ring-0 bg-slate-950 border-white/20 accent-emerald-400 cursor-pointer"
                            />
                            <div className="text-[11px] text-slate-300 leading-relaxed select-none">
                              {field.termsText ||
                                'I declare that the information provided is accurate and agree to follow all official tournament rules, referee decisions, and venue regulations of Smash Premier League Maharajganj.'}
                            </div>
                          </label>
                        </div>
                      )}

                      {/* Field Type: Profile Photo Upload */}
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

              {/* Direct UPI Payment Section */}
              {effectiveFee > 0 && (formConfig.payment?.enabled ?? true) && (
                <div className="p-5 sm:p-6 rounded-3xl bg-slate-900/95 border border-emerald-500/30 space-y-5 shadow-2xl relative overflow-hidden">
                  <div className="flex items-center justify-between pb-3 border-b border-white/10">
                    <div className="flex items-center gap-2">
                      <CreditCard className="w-5 h-5 text-emerald-400" />
                      <div>
                        <span className="text-xs font-black text-white uppercase tracking-wider block">
                          Tournament Entry Fee Payment
                        </span>
                        <span className="text-[11px] text-slate-400">
                          Direct UPI Transfer to Official Tournament Desk
                        </span>
                      </div>
                    </div>
                    <div className="text-right">
                      <span className="text-base sm:text-lg font-black font-mono text-emerald-400 block">
                        {formatINR(effectiveFee)}
                      </span>
                      {selectedCategory && (
                        <span className="text-[10px] text-slate-400 font-semibold block">
                          Category: {selectedCategory}
                        </span>
                      )}
                    </div>
                  </div>

                  <p className="text-xs text-slate-300 leading-relaxed">
                    {paymentInstructions}
                  </p>

                  {/* One-Tap UPI Launch Buttons (Mobile & Desktop) */}
                  <div className="space-y-2">
                    <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
                      ⚡ Quick One-Tap UPI Pay:
                    </span>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                      <a
                        href={gpayUri}
                        className="flex items-center justify-center gap-1.5 p-2.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-bold text-white transition-all hover:scale-[1.02]"
                      >
                        <span className="text-emerald-400 font-black">G</span>
                        <span>Google Pay</span>
                      </a>

                      <a
                        href={phonepeUri}
                        className="flex items-center justify-center gap-1.5 p-2.5 rounded-xl bg-purple-500/10 hover:bg-purple-500/20 border border-purple-500/30 text-xs font-bold text-purple-300 transition-all hover:scale-[1.02]"
                      >
                        <span className="text-purple-400 font-black">Pe</span>
                        <span>PhonePe</span>
                      </a>

                      <a
                        href={paytmUri}
                        className="flex items-center justify-center gap-1.5 p-2.5 rounded-xl bg-sky-500/10 hover:bg-sky-500/20 border border-sky-500/30 text-xs font-bold text-sky-300 transition-all hover:scale-[1.02]"
                      >
                        <span className="text-sky-400 font-black">₹</span>
                        <span>Paytm</span>
                      </a>

                      <a
                        href={genericUri}
                        className="flex items-center justify-center gap-1.5 p-2.5 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 text-xs font-bold text-amber-300 transition-all hover:scale-[1.02]"
                      >
                        <span>⚡ Any UPI App</span>
                      </a>
                    </div>
                  </div>

                  {/* Desktop QR Code & Manual Copy */}
                  <div className="flex flex-col sm:flex-row items-center gap-5 p-4 rounded-2xl bg-black/40 border border-white/10">
                    <div className="shrink-0 flex flex-col items-center gap-1">
                      {upiQrCodeUrl ? (
                        <img
                          src={upiQrCodeUrl}
                          alt="Tournament UPI QR Code"
                          className="w-32 h-32 rounded-xl bg-white p-1.5 shadow-lg"
                        />
                      ) : (
                        <div className="w-32 h-32 rounded-xl bg-slate-800 flex items-center justify-center text-xs text-slate-400">
                          <QrCode className="w-8 h-8 text-slate-500" />
                        </div>
                      )}
                      <span className="text-[10px] text-slate-400">Scan via any UPI App</span>
                    </div>

                    <div className="space-y-3 flex-1 min-w-0 text-center sm:text-left">
                      <div>
                        <span className="text-[10px] text-slate-400 uppercase tracking-wider block">
                          Recipient Official UPI ID
                        </span>
                        <div className="flex items-center justify-center sm:justify-start gap-2 mt-0.5">
                          <span className="font-mono text-sm font-bold text-white select-all">
                            {recipientUpiId}
                          </span>
                          <button
                            type="button"
                            onClick={handleCopyUpiId}
                            className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold bg-white/10 hover:bg-white/15 text-slate-300 transition-colors"
                          >
                            {copiedUpi ? (
                              <>
                                <Check className="w-3 h-3 text-emerald-400" />
                                <span className="text-emerald-400 text-[10px]">Copied!</span>
                              </>
                            ) : (
                              <>
                                <Copy className="w-3 h-3" />
                                <span className="text-[10px]">Copy</span>
                              </>
                            )}
                          </button>
                        </div>
                        <span className="text-xs text-slate-400 block mt-0.5 truncate">
                          Name: <span className="text-slate-200 font-semibold">{recipientName}</span>
                        </span>
                      </div>

                      {/* UTR / Transaction Reference Input */}
                      <div className="space-y-1.5 text-left">
                        <label className="block text-xs font-bold text-slate-200">
                          UPI Reference / UTR Number (12 Digits)
                          {formConfig.payment?.isMandatory && (
                            <span className="text-rose-400 ml-1 font-bold">*</span>
                          )}
                        </label>
                        <input
                          type="text"
                          required={formConfig.payment?.isMandatory}
                          value={txnId}
                          onChange={(e) => setTxnId(e.target.value)}
                          placeholder="e.g. 423589102456"
                          className="w-full bg-slate-950 border border-white/15 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-slate-600 font-mono focus:outline-none focus:border-emerald-500 tracking-wider"
                        />
                        <p className="text-[10px] text-slate-400 leading-tight">
                          Enter the 12-digit UPI transaction reference shown in Google Pay / PhonePe / Paytm after completing payment.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Free Registration Badge */}
              {effectiveFee === 0 && (formConfig.payment?.enabled ?? true) && (
                <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex items-center gap-3 text-xs text-emerald-300">
                  <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
                  <div>
                    <span className="font-bold block">Free Athlete Registration (₹0)</span>
                    <span className="text-[11px] text-slate-300">
                      No entry fee is required for this tournament category. Complete the form to confirm your spot.
                    </span>
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
                      <span>
                        {effectiveFee > 0 && formConfig.payment?.isMandatory
                          ? paymentBtnLabel
                          : appearance.submitButtonText || 'Submit Registration & Confirm Entry'}
                      </span>
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
