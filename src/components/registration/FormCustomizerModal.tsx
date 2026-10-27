import React, { useState, useEffect } from 'react';
import {
  X,
  Plus,
  Trash2,
  ChevronUp,
  ChevronDown,
  Eye,
  Check,
  Smartphone,
  Monitor,
  AlertCircle,
  Sparkles,
  HelpCircle,
  Palette,
  FileText,
  Sliders,
  Settings,
  Upload,
  Calendar,
  Layers,
  Lock,
  CreditCard,
  QrCode,
  ExternalLink,
  ArrowRight,
  Copy,
} from 'lucide-react';
import {
  RegistrationFormField,
  RegistrationFormConfig,
  FormFieldType,
  FormAppearance,
} from '../../types/tournament';
import {
  COLOR_PRESETS,
  buildUPIPaymentUri,
  generateUPIQRCode,
  formatINR,
} from '../../utils/tournamentEngine';

interface FormCustomizerModalProps {
  initialConfig: RegistrationFormConfig;
  isOpen: boolean;
  onClose: () => void;
  onSave: (config: RegistrationFormConfig, publish: boolean) => Promise<void>;
}

const FIELD_TYPE_OPTIONS: { type: FormFieldType; label: string; icon: string; desc: string }[] = [
  { type: 'text', label: 'Short Text', icon: '📝', desc: 'Single-line text (e.g. Club Name, Locality)' },
  { type: 'textarea', label: 'Long Text', icon: '📄', desc: 'Multi-line notes, requests or medical history' },
  { type: 'number', label: 'Number', icon: '🔢', desc: 'Numeric ranking, seed or numeric input' },
  { type: 'mobile', label: 'Phone Number', icon: '📱', desc: '10-digit Indian mobile number' },
  { type: 'email', label: 'Email Address', icon: '✉️', desc: 'Electronic mail confirmation' },
  { type: 'dropdown', label: 'Dropdown / Select', icon: '▾', desc: 'Single selection from a dropdown list' },
  { type: 'radio', label: 'Radio Buttons', icon: '🔘', desc: 'Single choice displayed as radio options' },
  { type: 'checkbox', label: 'Checkboxes', icon: '☑️', desc: 'Multiple selectable options' },
  { type: 'date', label: 'Date Picker', icon: '📅', desc: 'Date of birth or tournament availability' },
  { type: 'gender', label: 'Gender Selection', icon: '⚧', desc: 'Preset choices: Male, Female, Other' },
  { type: 'city', label: 'City / Locality', icon: '📍', desc: 'Athlete city or local region' },
  { type: 'age', label: 'Athlete Age', icon: '🎂', desc: 'Age in years for tournament seeding' },
  { type: 'yes_no', label: 'Yes / No Toggle', icon: '⚖️', desc: 'Binary decision (Yes or No)' },
  { type: 'terms', label: 'Terms & Conditions', icon: '📜', desc: 'Athlete declaration and rules agreement' },
  { type: 'section_heading', label: 'Section Heading / Info', icon: '🏷️', desc: 'Visual divider or informational text' },
  { type: 'photo', label: 'Profile Photo Upload', icon: '📷', desc: 'Athlete headshot upload with instant preview' },
];

export const FormCustomizerModal: React.FC<FormCustomizerModalProps> = ({
  initialConfig,
  isOpen,
  onClose,
  onSave,
}) => {
  // Working draft state
  const [formConfig, setFormConfig] = useState<RegistrationFormConfig>(() => ({
    ...initialConfig,
    payment: {
      enabled: initialConfig.payment?.enabled ?? true,
      isMandatory: initialConfig.payment?.isMandatory ?? true,
      upiId: initialConfig.payment?.upiId || 'karan-hdfc@ybl',
      accountName: initialConfig.payment?.accountName || 'Smash Premier League (Karan Gaur)',
      note: initialConfig.payment?.note || 'SPL Maharajganj Player Entry Fee',
      instructions: initialConfig.payment?.instructions || 'Scan the QR code or tap the UPI button to pay via Google Pay, PhonePe, or Paytm. Submit the 12-digit transaction UTR reference below for verification.',
      buttonText: initialConfig.payment?.buttonText || 'Pay Registration Fee',
      baseFee: initialConfig.payment?.baseFee ?? (initialConfig.entryFee ?? 500),
      categoryFees: initialConfig.payment?.categoryFees || {
        Singles: 300,
        Doubles: 500,
        'Mixed Doubles': 500,
        Both: 800,
      },
      customQrDataUrl: initialConfig.payment?.customQrDataUrl,
    },
    appearance: {
      ...initialConfig.appearance,
    },
    fields: [...initialConfig.fields],
  }));

  const [activeTab, setActiveTab] = useState<'details' | 'fields' | 'payment' | 'appearance'>('fields');
  const [isPreviewMode, setIsPreviewMode] = useState(false);
  const [previewDevice, setPreviewDevice] = useState<'desktop' | 'mobile'>('desktop');
  const [isSaving, setIsSaving] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [previewQrCode, setPreviewQrCode] = useState<string>('');

  // Re-sync formConfig whenever modal is opened or initialConfig updates
  useEffect(() => {
    if (isOpen) {
      setFormConfig({
        ...initialConfig,
        payment: {
          enabled: initialConfig.payment?.enabled ?? true,
          isMandatory: initialConfig.payment?.isMandatory ?? true,
          upiId: initialConfig.payment?.upiId || 'karan-hdfc@ybl',
          accountName: initialConfig.payment?.accountName || 'Smash Premier League (Karan Gaur)',
          note: initialConfig.payment?.note || 'SPL Maharajganj Player Entry Fee',
          instructions: initialConfig.payment?.instructions || 'Scan the QR code or tap the UPI button to pay via Google Pay, PhonePe, or Paytm. Submit the 12-digit transaction UTR reference below for verification.',
          buttonText: initialConfig.payment?.buttonText || 'Pay Registration Fee',
          baseFee: initialConfig.payment?.baseFee ?? (initialConfig.entryFee ?? 500),
          categoryFees: initialConfig.payment?.categoryFees || {
            Singles: 300,
            Doubles: 500,
            'Mixed Doubles': 500,
            Both: 800,
          },
          customQrDataUrl: initialConfig.payment?.customQrDataUrl,
        },
        appearance: {
          ...initialConfig.appearance,
        },
        fields: [...initialConfig.fields],
      });
    }
  }, [isOpen, initialConfig]);

  // Generate dynamic QR code preview based on current UPI ID and prefilled amount
  useEffect(() => {
    const upiUri = buildUPIPaymentUri({
      upiId: formConfig.payment?.upiId || 'smashleague@icici',
      accountName: formConfig.payment?.accountName || 'Smash Premier League Tournament',
      amount: formConfig.entryFee ?? 500,
      note: formConfig.payment?.note || 'SPL Tournament Entry Fee',
    });

    if (upiUri) {
      generateUPIQRCode(upiUri).then((dataUrl) => {
        setPreviewQrCode(dataUrl);
      });
    } else {
      setPreviewQrCode('');
    }
  }, [
    formConfig.payment?.upiId,
    formConfig.payment?.accountName,
    formConfig.payment?.note,
    formConfig.entryFee,
  ]);

  // New field creator popover / drawer
  const [isAddingField, setIsAddingField] = useState(false);
  const [newFieldType, setNewFieldType] = useState<FormFieldType>('text');
  const [newFieldLabel, setNewFieldLabel] = useState('');
  const [newFieldRequired, setNewFieldRequired] = useState(false);

  // Expanded field editor
  const [expandedFieldId, setExpandedFieldId] = useState<string | null>(null);

  if (!isOpen) return null;

  // Move field order
  const handleMoveField = (index: number, direction: 'up' | 'down') => {
    const newFields = [...formConfig.fields];
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= newFields.length) return;

    const temp = newFields[index];
    newFields[index] = newFields[targetIndex];
    newFields[targetIndex] = temp;

    // Re-index order property
    const reindexed = newFields.map((f, i) => ({ ...f, order: i + 1 }));
    setFormConfig({ ...formConfig, fields: reindexed });
  };

  // Toggle field enabled
  const handleToggleFieldEnabled = (fieldId: string) => {
    setFormConfig({
      ...formConfig,
      fields: formConfig.fields.map((f) =>
        f.id === fieldId ? { ...f, enabled: !f.enabled } : f
      ),
    });
  };

  // Toggle field required
  const handleToggleFieldRequired = (fieldId: string) => {
    setFormConfig({
      ...formConfig,
      fields: formConfig.fields.map((f) =>
        f.id === fieldId ? { ...f, required: !f.required } : f
      ),
    });
  };

  // Delete field (prevent system fields like name & mobile)
  const handleDeleteField = (fieldId: string) => {
    const target = formConfig.fields.find((f) => f.id === fieldId);
    if (target?.isSystem) return;
    setFormConfig({
      ...formConfig,
      fields: formConfig.fields.filter((f) => f.id !== fieldId),
    });
    if (expandedFieldId === fieldId) setExpandedFieldId(null);
  };

  // Update specific field properties
  const handleUpdateField = (fieldId: string, updates: Partial<RegistrationFormField>) => {
    setFormConfig({
      ...formConfig,
      fields: formConfig.fields.map((f) =>
        f.id === fieldId ? { ...f, ...updates } : f
      ),
    });
  };

  // Add new custom field
  const handleAddNewField = () => {
    if (!newFieldLabel.trim()) {
      setValidationError('Please enter a label for the new field');
      return;
    }

    const fieldId = `custom_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    let defaultOptions: string[] | undefined = undefined;
    let defaultContent: string | undefined = undefined;
    let defaultTermsText: string | undefined = undefined;
    let defaultMin: number | undefined = undefined;
    let defaultMax: number | undefined = undefined;

    if (newFieldType === 'dropdown' || newFieldType === 'select' || newFieldType === 'radio' || newFieldType === 'checkbox' || newFieldType === 'checkboxes') {
      defaultOptions = ['Option 1', 'Option 2'];
    } else if (newFieldType === 'gender') {
      defaultOptions = ['Male', 'Female', 'Other'];
    } else if (newFieldType === 'yes_no') {
      defaultOptions = ['Yes', 'No'];
    } else if (newFieldType === 'terms') {
      defaultTermsText = 'I hereby declare that all information submitted is true, and I agree to abide by all official tournament regulations and code of conduct for Smash Premier League Maharajganj.';
    } else if (newFieldType === 'section_heading') {
      defaultContent = 'Important guidelines and athlete conduct instructions for this championship edition.';
    } else if (newFieldType === 'age') {
      defaultMin = 10;
      defaultMax = 75;
    }

    const newField: RegistrationFormField = {
      id: fieldId,
      label: newFieldLabel.trim(),
      type: newFieldType,
      required: newFieldType === 'section_heading' ? false : newFieldRequired,
      enabled: true,
      options: defaultOptions,
      content: defaultContent,
      termsText: defaultTermsText,
      min: defaultMin,
      max: defaultMax,
      order: formConfig.fields.length + 1,
    };

    setFormConfig({
      ...formConfig,
      fields: [...formConfig.fields, newField],
    });

    setNewFieldLabel('');
    setIsAddingField(false);
    setValidationError(null);
    setExpandedFieldId(fieldId);
  };

  // Add option to choice field
  const handleAddOption = (fieldId: string) => {
    const target = formConfig.fields.find((f) => f.id === fieldId);
    if (!target) return;
    const currentOpts = target.options || [];
    const newOpt = `Option ${currentOpts.length + 1}`;
    handleUpdateField(fieldId, { options: [...currentOpts, newOpt] });
  };

  // Edit option in choice field
  const handleEditOption = (fieldId: string, optIndex: number, newVal: string) => {
    const target = formConfig.fields.find((f) => f.id === fieldId);
    if (!target || !target.options) return;
    const newOpts = [...target.options];
    newOpts[optIndex] = newVal;
    handleUpdateField(fieldId, { options: newOpts });
  };

  // Remove option from choice field
  const handleRemoveOption = (fieldId: string, optIndex: number) => {
    const target = formConfig.fields.find((f) => f.id === fieldId);
    if (!target || !target.options || target.options.length <= 1) return;
    const newOpts = target.options.filter((_, idx) => idx !== optIndex);
    handleUpdateField(fieldId, { options: newOpts });
  };

  // Form validation before publishing
  const validateForm = (): boolean => {
    setValidationError(null);

    // Check mandatory tournament details
    if (!formConfig.tournamentName.trim()) {
      setValidationError('Tournament Name cannot be empty.');
      setActiveTab('details');
      return false;
    }

    // Check fields integrity
    for (const f of formConfig.fields) {
      if (!f.label.trim()) {
        setValidationError(`Field with ID ${f.id} has an empty label.`);
        setActiveTab('fields');
        return false;
      }
      if (['dropdown', 'radio', 'checkbox'].includes(f.type)) {
        if (!f.options || f.options.length === 0 || f.options.some((o) => !o.trim())) {
          setValidationError(`Choice field "${f.label}" must have at least one valid non-empty option.`);
          setActiveTab('fields');
          return false;
        }
      }
    }

    return true;
  };

  const handleSaveDraft = async () => {
    setIsSaving(true);
    try {
      await onSave(formConfig, false);
      onClose();
    } finally {
      setIsSaving(false);
    }
  };

  const handlePublishChanges = async () => {
    if (!validateForm()) return;
    setIsSaving(true);
    try {
      await onSave({ ...formConfig, isPublished: true }, true);
      onClose();
    } finally {
      setIsSaving(false);
    }
  };

  const accentColor = formConfig.appearance.accentColor || '#10b981';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-950/85 backdrop-blur-md overflow-y-auto animate-fade-in">
      <div className="relative w-full max-w-5xl bg-[#0b1120] border border-white/15 rounded-3xl shadow-2xl flex flex-col max-h-[92vh] overflow-hidden">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10 bg-slate-900/60">
          <div className="flex items-center gap-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-500/20 text-emerald-400 font-bold text-lg border border-emerald-500/30">
              🛠️
            </span>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="font-display text-lg sm:text-xl font-black text-white">
                  Customize Registration Form
                </h2>
                <span
                  className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider ${
                    formConfig.isPublished
                      ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                      : 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                  }`}
                >
                  {formConfig.isPublished ? 'Live Published' : 'Draft Mode'}
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Season: <span className="text-slate-200 font-semibold">{formConfig.seasonTitle}</span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Live Preview Toggle */}
            <button
              onClick={() => setIsPreviewMode(!isPreviewMode)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all border ${
                isPreviewMode
                  ? 'bg-amber-500/20 border-amber-500/40 text-amber-300'
                  : 'bg-white/5 border-white/10 hover:bg-white/10 text-slate-300'
              }`}
            >
              <Eye className="w-3.5 h-3.5" />
              <span>{isPreviewMode ? 'Exit Preview' : 'Live Preview'}</span>
            </button>

            {/* Close Button */}
            <button
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-white/10 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Validation Error Banner */}
        {validationError && (
          <div className="px-6 py-2.5 bg-rose-500/20 border-b border-rose-500/30 text-rose-300 text-xs flex items-center justify-between animate-fade-in">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
              <span>{validationError}</span>
            </div>
            <button
              onClick={() => setValidationError(null)}
              className="text-rose-400 hover:text-white font-bold ml-2"
            >
              ✕
            </button>
          </div>
        )}

        {/* Content Body: Either Builder Mode or Preview Mode */}
        {isPreviewMode ? (
          /* ======================================================== */
          /* LIVE PREVIEW CONTAINER */
          /* ======================================================== */
          <div className="flex-1 overflow-y-auto p-4 sm:p-6 bg-[#070a13] flex flex-col items-center">
            {/* Device Switcher Bar */}
            <div className="flex items-center gap-2 mb-6 bg-slate-900 border border-white/10 rounded-xl p-1">
              <button
                onClick={() => setPreviewDevice('desktop')}
                className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-semibold transition-all ${
                  previewDevice === 'desktop'
                    ? 'bg-white/15 text-white shadow-sm'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <Monitor className="w-3.5 h-3.5" />
                <span>Desktop View</span>
              </button>
              <button
                onClick={() => setPreviewDevice('mobile')}
                className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-semibold transition-all ${
                  previewDevice === 'mobile'
                    ? 'bg-white/15 text-white shadow-sm'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <Smartphone className="w-3.5 h-3.5" />
                <span>Mobile View</span>
              </button>
            </div>

            {/* Simulated Frame */}
            <div
              className={`w-full transition-all duration-300 ${
                previewDevice === 'mobile'
                  ? 'max-w-md border-4 border-slate-700 rounded-3xl p-4 bg-[#070a13] shadow-2xl relative'
                  : 'max-w-2xl bg-[#090d18] border border-white/10 rounded-3xl p-6 sm:p-8 shadow-2xl'
              }`}
            >
              {previewDevice === 'mobile' && (
                <div className="w-28 h-4 bg-slate-800 rounded-full mx-auto mb-4" />
              )}

              {/* Form Hero Header */}
              <div className="text-center space-y-2 pb-6 border-b border-white/10">
                <span className="inline-block text-3xl">🏸</span>
                <h1 className="font-display text-xl sm:text-2xl font-black text-white tracking-tight">
                  {formConfig.appearance.formTitle}
                </h1>
                <p className="text-xs sm:text-sm text-slate-300">
                  {formConfig.appearance.formDescription}
                </p>
                {formConfig.appearance.welcomeMessage && (
                  <div className="p-3 bg-white/5 rounded-xl border border-white/5 text-xs text-slate-400">
                    ℹ️ {formConfig.appearance.welcomeMessage}
                  </div>
                )}
                <div className="flex flex-wrap items-center justify-center gap-3 pt-2 text-[11px] text-slate-400">
                  <span>📅 {formConfig.date || 'TBD'}</span>
                  <span>·</span>
                  <span>📍 {formConfig.venue || 'Indoor Stadium'}</span>
                  <span>·</span>
                  <span className="text-amber-400 font-bold">
                    Fee: ₹{formConfig.entryFee || 500}
                  </span>
                </div>
              </div>

              {/* Live Form Fields */}
              <div className="space-y-4 pt-6">
                {formConfig.fields
                  .filter((f) => f.enabled)
                  .sort((a, b) => a.order - b.order)
                  .map((field) => (
                    <div key={field.id} className="space-y-1.5">
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

                      {field.helpText && (
                        <p className="text-[11px] text-slate-400">{field.helpText}</p>
                      )}

                      {/* Render simulated input by type */}
                      {field.type === 'section_heading' && (
                        <div className="pt-2 pb-1">
                          <div className="p-3.5 rounded-2xl bg-white/[0.04] border border-white/10 flex items-start gap-3">
                            <span className="text-base">🏷️</span>
                            <div>
                              <h4 className="font-bold text-white text-xs">{field.label}</h4>
                              <p className="text-[11px] text-slate-400 mt-0.5 leading-relaxed">
                                {field.content || field.helpText || 'Official section guidance.'}
                              </p>
                            </div>
                          </div>
                        </div>
                      )}

                      {(field.type === 'text' || field.type === 'short_text') && (
                        <input
                          type="text"
                          disabled
                          placeholder={field.placeholder || `Enter ${field.label.toLowerCase()}`}
                          className="w-full bg-slate-900 border border-white/10 rounded-xl px-3.5 py-2.5 text-xs text-slate-300 placeholder-slate-600 focus:outline-none"
                        />
                      )}

                      {(field.type === 'textarea' || field.type === 'long_text') && (
                        <textarea
                          rows={2}
                          disabled
                          placeholder={field.placeholder || 'Detailed notes or information...'}
                          className="w-full bg-slate-900 border border-white/10 rounded-xl px-3.5 py-2 text-xs text-slate-300 placeholder-slate-600 focus:outline-none resize-none"
                        />
                      )}

                      {(field.type === 'mobile' || field.type === 'phone') && (
                        <div className="relative">
                          <span className="absolute left-3.5 top-2.5 text-xs text-slate-500 font-mono font-bold">
                            +91
                          </span>
                          <input
                            type="tel"
                            disabled
                            placeholder="9876543210"
                            className="w-full bg-slate-900 border border-white/10 rounded-xl pl-12 pr-3.5 py-2.5 text-xs text-slate-300 placeholder-slate-600 focus:outline-none font-mono"
                          />
                        </div>
                      )}

                      {field.type === 'email' && (
                        <input
                          type="email"
                          disabled
                          placeholder="player@example.com"
                          className="w-full bg-slate-900 border border-white/10 rounded-xl px-3.5 py-2.5 text-xs text-slate-300 placeholder-slate-600 focus:outline-none"
                        />
                      )}

                      {field.type === 'number' && (
                        <input
                          type="number"
                          disabled
                          placeholder={field.placeholder || 'e.g. 24'}
                          className="w-full bg-slate-900 border border-white/10 rounded-xl px-3.5 py-2.5 text-xs text-slate-300 placeholder-slate-600 focus:outline-none font-mono"
                        />
                      )}

                      {field.type === 'age' && (
                        <div className="space-y-1">
                          <input
                            type="number"
                            disabled
                            placeholder="e.g. 24"
                            className="w-full bg-slate-900 border border-white/10 rounded-xl px-3.5 py-2.5 text-xs text-slate-300 placeholder-slate-600 focus:outline-none font-mono"
                          />
                          {(field.min != null || field.max != null) && (
                            <span className="text-[10px] text-slate-500 block">
                              Allowed age: {field.min ?? 10} to {field.max ?? 75} years
                            </span>
                          )}
                        </div>
                      )}

                      {field.type === 'city' && (
                        <div className="relative">
                          <span className="absolute left-3.5 top-2.5 text-xs text-slate-500">📍</span>
                          <input
                            type="text"
                            disabled
                            placeholder="e.g. Maharajganj, Gorakhpur"
                            className="w-full bg-slate-900 border border-white/10 rounded-xl pl-9 pr-3.5 py-2.5 text-xs text-slate-300 placeholder-slate-600 focus:outline-none"
                          />
                        </div>
                      )}

                      {field.type === 'date' && (
                        <input
                          type="date"
                          disabled
                          className="w-full bg-slate-900 border border-white/10 rounded-xl px-3.5 py-2.5 text-xs text-slate-300 focus:outline-none"
                        />
                      )}

                      {(field.type === 'dropdown' || field.type === 'select') && (
                        <select
                          disabled
                          className="w-full bg-slate-900 border border-white/10 rounded-xl px-3.5 py-2.5 text-xs text-slate-300 focus:outline-none"
                        >
                          <option value="">Select option...</option>
                          {field.options?.map((opt, i) => (
                            <option key={i} value={opt}>
                              {opt}
                            </option>
                          ))}
                        </select>
                      )}

                      {field.type === 'radio' && (
                        <div className="grid grid-cols-2 gap-2 pt-1">
                          {field.options?.map((opt, i) => (
                            <div
                              key={i}
                              className="flex items-center gap-2 p-2.5 rounded-xl bg-slate-900 border border-white/10 text-xs text-slate-300"
                            >
                              <div
                                className="w-3.5 h-3.5 rounded-full border border-white/30 flex items-center justify-center"
                                style={i === 0 ? { borderColor: accentColor } : {}}
                              >
                                {i === 0 && (
                                  <div
                                    className="w-1.5 h-1.5 rounded-full"
                                    style={{ backgroundColor: accentColor }}
                                  />
                                )}
                              </div>
                              <span className="truncate">{opt}</span>
                            </div>
                          ))}
                        </div>
                      )}

                      {field.type === 'gender' && (
                        <div className="grid grid-cols-3 gap-2 pt-1">
                          {['Male', 'Female', 'Other'].map((g, i) => (
                            <div
                              key={g}
                              className="flex items-center justify-center gap-1.5 p-2 rounded-xl bg-slate-900 border border-white/10 text-xs text-slate-300 font-semibold"
                            >
                              <span>{g === 'Male' ? '♂️' : g === 'Female' ? '♀️' : '⚧'}</span>
                              <span>{g}</span>
                            </div>
                          ))}
                        </div>
                      )}

                      {field.type === 'yes_no' && (
                        <div className="grid grid-cols-2 gap-2 pt-1">
                          {['Yes', 'No'].map((opt, i) => (
                            <div
                              key={opt}
                              className="flex items-center justify-center gap-2 p-2.5 rounded-xl bg-slate-900 border border-white/10 text-xs text-slate-300 font-bold"
                            >
                              <span>{opt === 'Yes' ? '✅ Yes' : '❌ No'}</span>
                            </div>
                          ))}
                        </div>
                      )}

                      {(field.type === 'checkbox' || field.type === 'checkboxes') && (
                        <div className="grid grid-cols-2 gap-2 pt-1">
                          {field.options?.map((opt, i) => (
                            <div
                              key={i}
                              className="flex items-center gap-2 p-2.5 rounded-xl bg-slate-900 border border-white/10 text-xs text-slate-300"
                            >
                              <div
                                className="w-3.5 h-3.5 rounded border border-white/30 flex items-center justify-center"
                                style={i === 0 ? { borderColor: accentColor, backgroundColor: accentColor } : {}}
                              >
                                {i === 0 && <Check className="w-2.5 h-2.5 text-slate-950 stroke-[3]" />}
                              </div>
                              <span className="truncate">{opt}</span>
                            </div>
                          ))}
                        </div>
                      )}

                      {field.type === 'terms' && (
                        <div className="p-3 bg-white/[0.03] border border-white/10 rounded-2xl text-xs space-y-2">
                          <div className="flex items-start gap-2.5">
                            <input type="checkbox" disabled checked className="mt-0.5 rounded accent-emerald-400" />
                            <p className="text-[11px] text-slate-300 leading-relaxed">
                              {field.termsText || 'I agree to tournament terms, safety rules and match regulations.'}
                            </p>
                          </div>
                        </div>
                      )}

                      {field.type === 'photo' && (
                        <div className="p-4 border-2 border-dashed border-white/15 rounded-2xl flex flex-col items-center justify-center text-center bg-slate-900/50">
                          <Upload className="w-5 h-5 text-slate-400 mb-1" />
                          <span className="text-xs font-semibold text-slate-300">
                            Upload Profile Photo
                          </span>
                          <span className="text-[10px] text-slate-500">
                            PNG, JPG or WebP (Headshot)
                          </span>
                        </div>
                      )}
                    </div>
                  ))}

                {/* Simulated Payment Section in Live Preview */}
                {formConfig.payment?.enabled && (
                  <div className="p-4 rounded-2xl bg-slate-900 border border-emerald-500/30 space-y-3">
                    <div className="flex items-center justify-between pb-2 border-b border-white/10">
                      <div className="flex items-center gap-2">
                        <CreditCard className="w-4 h-4 text-emerald-400" />
                        <span className="text-xs font-bold text-white uppercase tracking-wider">
                          Tournament Fee & UPI Payment
                        </span>
                      </div>
                      <span className="font-mono text-xs font-black text-emerald-400">
                        {formConfig.payment.baseFee > 0 ? formatINR(formConfig.payment.baseFee) : 'FREE (₹0)'}
                      </span>
                    </div>

                    <p className="text-[11px] text-slate-300">
                      {formConfig.payment.instructions || 'Pay directly to official tournament account via UPI.'}
                    </p>

                    <div className="flex flex-col sm:flex-row items-center gap-3 p-2.5 bg-black/40 rounded-xl border border-white/5">
                      {previewQrCode ? (
                        <img src={previewQrCode} alt="UPI QR" className="w-20 h-20 rounded-lg bg-white p-1" />
                      ) : (
                        <div className="w-20 h-20 bg-white/10 rounded-lg flex items-center justify-center text-xs text-slate-400">
                          QR Code
                        </div>
                      )}
                      <div className="text-xs space-y-1 text-center sm:text-left flex-1 min-w-0">
                        <span className="text-[10px] text-slate-400 block">Recipient UPI ID:</span>
                        <span className="font-mono font-bold text-emerald-400 block truncate">
                          {formConfig.payment.upiId || 'karan-hdfc@ybl'}
                        </span>
                        <span className="text-[10px] text-slate-400 block truncate">
                          {formConfig.payment.accountName || 'Smash Premier League (Karan Gaur)'}
                        </span>
                      </div>
                    </div>
                  </div>
                )}

                {/* Simulated Submit Button with Accent Color */}
                <div className="pt-4">
                  <button
                    disabled
                    style={{ backgroundColor: accentColor }}
                    className="w-full py-3 rounded-2xl font-display font-black text-slate-950 text-sm tracking-wide shadow-lg opacity-90 cursor-default"
                  >
                    {formConfig.appearance.submitButtonText || 'Submit Registration'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        ) : (
          /* ======================================================== */
          /* FORM BUILDER TABS & EDITOR */
          /* ======================================================== */
          <div className="flex-1 flex flex-col overflow-hidden">
            {/* Tab Navigation */}
            <div className="flex items-center border-b border-white/10 bg-slate-900/40 px-6">
              <button
                onClick={() => setActiveTab('fields')}
                className={`flex items-center gap-2 py-3 px-4 border-b-2 font-bold text-xs transition-colors ${
                  activeTab === 'fields'
                    ? 'border-emerald-400 text-emerald-400'
                    : 'border-transparent text-slate-400 hover:text-white'
                }`}
              >
                <Layers className="w-4 h-4" />
                <span>Form Fields ({formConfig.fields.filter((f) => f.enabled).length} active)</span>
              </button>

              <button
                onClick={() => setActiveTab('details')}
                className={`flex items-center gap-2 py-3 px-4 border-b-2 font-bold text-xs transition-colors ${
                  activeTab === 'details'
                    ? 'border-emerald-400 text-emerald-400'
                    : 'border-transparent text-slate-400 hover:text-white'
                }`}
              >
                <FileText className="w-4 h-4" />
                <span>Tournament Details</span>
              </button>

              <button
                onClick={() => setActiveTab('payment')}
                className={`flex items-center gap-2 py-3 px-4 border-b-2 font-bold text-xs transition-colors ${
                  activeTab === 'payment'
                    ? 'border-emerald-400 text-emerald-400'
                    : 'border-transparent text-slate-400 hover:text-white'
                }`}
              >
                <CreditCard className="w-4 h-4" />
                <span>Payment & UPI Settings</span>
              </button>

              <button
                onClick={() => setActiveTab('appearance')}
                className={`flex items-center gap-2 py-3 px-4 border-b-2 font-bold text-xs transition-colors ${
                  activeTab === 'appearance'
                    ? 'border-emerald-400 text-emerald-400'
                    : 'border-transparent text-slate-400 hover:text-white'
                }`}
              >
                <Palette className="w-4 h-4" />
                <span>Theme & Appearance</span>
              </button>
            </div>

            {/* Tab 1: Form Fields */}
            {activeTab === 'fields' && (
              <div className="flex-1 overflow-y-auto p-6 space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-bold text-white">Manage & Reorder Form Fields</h3>
                    <p className="text-xs text-slate-400">
                      Drag or use arrows to rearrange the order in which questions appear to players.
                    </p>
                  </div>

                  <button
                    onClick={() => setIsAddingField(true)}
                    className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold bg-emerald-500 hover:bg-emerald-400 text-slate-950 transition-colors shadow-lg shadow-emerald-500/20"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Add Custom Field</span>
                  </button>
                </div>

                {/* Add Field Drawer / Card */}
                {isAddingField && (
                  <div className="p-4 rounded-2xl bg-slate-900 border border-emerald-500/30 space-y-3 animate-fade-in shadow-xl">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-emerald-400 uppercase tracking-wider">
                        + New Question / Field
                      </span>
                      <button
                        onClick={() => setIsAddingField(false)}
                        className="text-slate-400 hover:text-white text-xs font-bold"
                      >
                        Cancel
                      </button>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[11px] font-bold text-slate-300 mb-1">
                          Field Question / Label *
                        </label>
                        <input
                          type="text"
                          value={newFieldLabel}
                          onChange={(e) => setNewFieldLabel(e.target.value)}
                          placeholder="e.g. Do you have your own racket?"
                          className="w-full bg-slate-950 border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:border-emerald-500 focus:outline-none"
                        />
                      </div>

                      <div>
                        <label className="block text-[11px] font-bold text-slate-300 mb-1">
                          Field Type
                        </label>
                        <select
                          value={newFieldType}
                          onChange={(e) => setNewFieldType(e.target.value as FormFieldType)}
                          className="w-full bg-slate-950 border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:border-emerald-500 focus:outline-none"
                        >
                          {FIELD_TYPE_OPTIONS.map((opt) => (
                            <option key={opt.type} value={opt.type}>
                              {opt.icon} {opt.label} — {opt.desc}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>

                    <div className="flex items-center justify-between pt-2">
                      <label className="flex items-center gap-2 cursor-pointer text-xs text-slate-300 font-semibold">
                        <input
                          type="checkbox"
                          checked={newFieldRequired}
                          onChange={(e) => setNewFieldRequired(e.target.checked)}
                          className="rounded text-emerald-500 focus:ring-0 bg-slate-950 border-white/20"
                        />
                        <span>Mandatory / Required question</span>
                      </label>

                      <button
                        onClick={handleAddNewField}
                        className="px-4 py-1.5 rounded-xl text-xs font-bold bg-emerald-500 hover:bg-emerald-400 text-slate-950 transition-colors"
                      >
                        Add to Form
                      </button>
                    </div>
                  </div>
                )}

                {/* Field List Cards */}
                <div className="space-y-2.5">
                  {formConfig.fields.map((field, idx) => {
                    const isExpanded = expandedFieldId === field.id;
                    const isChoice = ['dropdown', 'radio', 'checkbox'].includes(field.type);

                    return (
                      <div
                        key={field.id}
                        className={`rounded-2xl border transition-all ${
                          field.enabled
                            ? 'bg-slate-900/80 border-white/10'
                            : 'bg-slate-950/40 border-white/5 opacity-60'
                        }`}
                      >
                        {/* Main row */}
                        <div className="flex items-center justify-between p-3.5 gap-3">
                          {/* Left: Reorder arrows & type icon */}
                          <div className="flex items-center gap-2">
                            <div className="flex flex-col gap-0.5">
                              <button
                                disabled={idx === 0}
                                onClick={() => handleMoveField(idx, 'up')}
                                className="p-1 text-slate-400 hover:text-white disabled:opacity-20 hover:bg-white/5 rounded"
                              >
                                <ChevronUp className="w-3.5 h-3.5" />
                              </button>
                              <button
                                disabled={idx === formConfig.fields.length - 1}
                                onClick={() => handleMoveField(idx, 'down')}
                                className="p-1 text-slate-400 hover:text-white disabled:opacity-20 hover:bg-white/5 rounded"
                              >
                                <ChevronDown className="w-3.5 h-3.5" />
                              </button>
                            </div>

                            <span className="w-7 h-7 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center text-xs">
                              {FIELD_TYPE_OPTIONS.find((t) => t.type === field.type)?.icon || '📝'}
                            </span>

                            <div>
                              <div className="flex items-center gap-2">
                                <span className="text-xs font-bold text-white">
                                  {field.label}
                                </span>
                                {field.required && (
                                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-rose-500/15 text-rose-300 font-semibold border border-rose-500/20">
                                    Required
                                  </span>
                                )}
                                {field.isSystem && (
                                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-500/15 text-blue-300 font-semibold border border-blue-500/20 flex items-center gap-1">
                                    <Lock className="w-2.5 h-2.5" /> Core
                                  </span>
                                )}
                              </div>
                              <span className="text-[10px] text-slate-400">
                                {FIELD_TYPE_OPTIONS.find((t) => t.type === field.type)?.label}
                                {field.helpText ? ` · ${field.helpText}` : ''}
                              </span>
                            </div>
                          </div>

                          {/* Right: Controls (Toggle required, enable/disable, edit, delete) */}
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => handleToggleFieldRequired(field.id)}
                              disabled={field.isSystem}
                              className={`text-[10px] px-2 py-1 rounded-lg font-bold transition-colors ${
                                field.required
                                  ? 'bg-rose-500/20 text-rose-300 hover:bg-rose-500/30'
                                  : 'bg-white/5 text-slate-400 hover:bg-white/10 hover:text-white'
                              }`}
                            >
                              {field.required ? 'Required' : 'Optional'}
                            </button>

                            <button
                              onClick={() => handleToggleFieldEnabled(field.id)}
                              disabled={field.isSystem}
                              className={`text-[10px] px-2 py-1 rounded-lg font-bold transition-colors ${
                                field.enabled
                                  ? 'bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500/30'
                                  : 'bg-slate-800 text-slate-500 hover:text-slate-300'
                              }`}
                            >
                              {field.enabled ? 'Enabled' : 'Disabled'}
                            </button>

                            <button
                              onClick={() => setExpandedFieldId(isExpanded ? null : field.id)}
                              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/5 text-xs font-semibold"
                            >
                              <Sliders className="w-3.5 h-3.5" />
                            </button>

                            {!field.isSystem && (
                              <button
                                onClick={() => handleDeleteField(field.id)}
                                className="p-1.5 rounded-lg text-rose-400 hover:text-rose-300 hover:bg-rose-500/10"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        </div>

                        {/* Expanded Field Editor */}
                        {isExpanded && (
                          <div className="p-4 border-t border-white/5 bg-slate-950/60 space-y-3 text-xs">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                              <div>
                                <label className="block text-[11px] font-bold text-slate-300 mb-1">
                                  Question Label
                                </label>
                                <input
                                  type="text"
                                  value={field.label}
                                  onChange={(e) => handleUpdateField(field.id, { label: e.target.value })}
                                  className="w-full bg-slate-900 border border-white/10 rounded-xl px-3 py-1.5 text-xs text-white focus:outline-none focus:border-emerald-500"
                                />
                              </div>

                              <div>
                                <label className="block text-[11px] font-bold text-slate-300 mb-1">
                                  Helper / Subtitle Text
                                </label>
                                <input
                                  type="text"
                                  value={field.helpText || ''}
                                  onChange={(e) => handleUpdateField(field.id, { helpText: e.target.value })}
                                  placeholder="e.g. For official tournament records"
                                  className="w-full bg-slate-900 border border-white/10 rounded-xl px-3 py-1.5 text-xs text-white focus:outline-none focus:border-emerald-500"
                                />
                              </div>
                            </div>

                            {/* Options editor for choice types */}
                            {isChoice && (
                              <div className="space-y-2 pt-2 border-t border-white/5">
                                <div className="flex items-center justify-between">
                                  <span className="text-[11px] font-bold text-slate-300">
                                    Choices / Selectable Options
                                  </span>
                                  <button
                                    onClick={() => handleAddOption(field.id)}
                                    className="text-[11px] text-emerald-400 hover:text-emerald-300 font-bold"
                                  >
                                    + Add Option
                                  </button>
                                </div>

                                <div className="space-y-1.5">
                                  {(field.options || []).map((opt, optIdx) => (
                                    <div key={optIdx} className="flex items-center gap-2">
                                      <span className="text-slate-500 text-[10px] w-4">{optIdx + 1}.</span>
                                      <input
                                        type="text"
                                        value={opt}
                                        onChange={(e) =>
                                          handleEditOption(field.id, optIdx, e.target.value)
                                        }
                                        className="flex-1 bg-slate-900 border border-white/10 rounded-lg px-2.5 py-1 text-xs text-white focus:outline-none focus:border-emerald-500"
                                      />
                                      {(field.options?.length || 0) > 1 && (
                                        <button
                                          onClick={() => handleRemoveOption(field.id, optIdx)}
                                          className="text-slate-500 hover:text-rose-400 p-1"
                                        >
                                          ✕
                                        </button>
                                      )}
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Tab 2: Tournament Details */}
            {activeTab === 'details' && (
              <div className="flex-1 overflow-y-auto p-6 space-y-4">
                <div>
                  <h3 className="text-sm font-bold text-white">Tournament & Season Profile</h3>
                  <p className="text-xs text-slate-400">
                    Public headline information displayed to athletes when registering.
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-300 mb-1">
                      Tournament Name
                    </label>
                    <input
                      type="text"
                      value={formConfig.tournamentName}
                      onChange={(e) =>
                        setFormConfig({ ...formConfig, tournamentName: e.target.value })
                      }
                      className="w-full bg-slate-950 border border-white/10 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-300 mb-1">
                      Season Title / Edition
                    </label>
                    <input
                      type="text"
                      value={formConfig.seasonTitle}
                      onChange={(e) =>
                        setFormConfig({ ...formConfig, seasonTitle: e.target.value })
                      }
                      className="w-full bg-slate-950 border border-white/10 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-300 mb-1">
                      Venue & Stadium
                    </label>
                    <input
                      type="text"
                      value={formConfig.venue || ''}
                      onChange={(e) =>
                        setFormConfig({ ...formConfig, venue: e.target.value })
                      }
                      placeholder="e.g. Maharajganj Indoor Badminton Stadium"
                      className="w-full bg-slate-950 border border-white/10 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-300 mb-1">
                      Tournament Date
                    </label>
                    <input
                      type="date"
                      value={formConfig.date || ''}
                      onChange={(e) =>
                        setFormConfig({ ...formConfig, date: e.target.value })
                      }
                      className="w-full bg-slate-950 border border-white/10 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-300 mb-1">
                      Registration Deadline
                    </label>
                    <input
                      type="datetime-local"
                      value={formConfig.deadline || ''}
                      onChange={(e) =>
                        setFormConfig({ ...formConfig, deadline: e.target.value })
                      }
                      className="w-full bg-slate-950 border border-white/10 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-300 mb-1">
                      Maximum Player Registrations (Cap)
                    </label>
                    <input
                      type="number"
                      value={formConfig.maxSlots || 32}
                      onChange={(e) =>
                        setFormConfig({
                          ...formConfig,
                          maxSlots: parseInt(e.target.value, 10) || 32,
                        })
                      }
                      className="w-full bg-slate-950 border border-white/10 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-emerald-500 font-mono"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-300 mb-1">
                      Entry Fee per Player (INR ₹)
                    </label>
                    <input
                      type="number"
                      value={formConfig.entryFee || 500}
                      onChange={(e) =>
                        setFormConfig({
                          ...formConfig,
                          entryFee: parseInt(e.target.value, 10) || 0,
                        })
                      }
                      className="w-full bg-slate-950 border border-white/10 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-emerald-500 font-mono"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-300 mb-1">
                      Closed Notice Message
                    </label>
                    <input
                      type="text"
                      value={formConfig.closedNotice || ''}
                      onChange={(e) =>
                        setFormConfig({ ...formConfig, closedNotice: e.target.value })
                      }
                      placeholder="Registrations are currently closed..."
                      className="w-full bg-slate-950 border border-white/10 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Tab 3: Appearance & Theme */}
            {activeTab === 'appearance' && (
              <div className="flex-1 overflow-y-auto p-6 space-y-5">
                <div>
                  <h3 className="text-sm font-bold text-white">Form Styling & Copy</h3>
                  <p className="text-xs text-slate-400">
                    Customize titles, accent branding color, submit button copy, and success screen.
                  </p>
                </div>

                {/* Accent Color Palette Selector */}
                <div className="space-y-2">
                  <label className="block text-xs font-bold text-slate-300">
                    Primary Athletic Accent Color
                  </label>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                    {COLOR_PRESETS.map((preset) => {
                      const isSelected = formConfig.appearance.accentColor === preset.color;
                      return (
                        <button
                          key={preset.color}
                          type="button"
                          onClick={() =>
                            setFormConfig({
                              ...formConfig,
                              appearance: {
                                ...formConfig.appearance,
                                accentColor: preset.color,
                                accentName: preset.name,
                              },
                            })
                          }
                          className={`flex items-center gap-2.5 p-2.5 rounded-xl border text-left transition-all ${
                            isSelected
                              ? 'bg-white/15 border-white/40 ring-2 ring-white/20'
                              : 'bg-slate-900 border-white/5 hover:bg-white/5'
                          }`}
                        >
                          <span
                            className="w-4 h-4 rounded-full shrink-0 shadow-sm"
                            style={{ backgroundColor: preset.color }}
                          />
                          <span className="text-xs font-semibold text-slate-200 truncate">
                            {preset.name}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="space-y-3 pt-2">
                  <div>
                    <label className="block text-xs font-bold text-slate-300 mb-1">
                      Registration Form Title
                    </label>
                    <input
                      type="text"
                      value={formConfig.appearance.formTitle}
                      onChange={(e) =>
                        setFormConfig({
                          ...formConfig,
                          appearance: {
                            ...formConfig.appearance,
                            formTitle: e.target.value,
                          },
                        })
                      }
                      className="w-full bg-slate-950 border border-white/10 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-300 mb-1">
                      Form Description / Subtitle
                    </label>
                    <input
                      type="text"
                      value={formConfig.appearance.formDescription}
                      onChange={(e) =>
                        setFormConfig({
                          ...formConfig,
                          appearance: {
                            ...formConfig.appearance,
                            formDescription: e.target.value,
                          },
                        })
                      }
                      className="w-full bg-slate-950 border border-white/10 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-300 mb-1">
                      Welcome Message & Instructions
                    </label>
                    <textarea
                      rows={2}
                      value={formConfig.appearance.welcomeMessage || ''}
                      onChange={(e) =>
                        setFormConfig({
                          ...formConfig,
                          appearance: {
                            ...formConfig.appearance,
                            welcomeMessage: e.target.value,
                          },
                        })
                      }
                      className="w-full bg-slate-950 border border-white/10 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-emerald-500 resize-none"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-300 mb-1">
                      Submit Button Text
                    </label>
                    <input
                      type="text"
                      value={formConfig.appearance.submitButtonText}
                      onChange={(e) =>
                        setFormConfig({
                          ...formConfig,
                          appearance: {
                            ...formConfig.appearance,
                            submitButtonText: e.target.value,
                          },
                        })
                      }
                      className="w-full bg-slate-950 border border-white/10 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-300 mb-1">
                      Post-Submission Success Headline
                    </label>
                    <input
                      type="text"
                      value={formConfig.appearance.successTitle}
                      onChange={(e) =>
                        setFormConfig({
                          ...formConfig,
                          appearance: {
                            ...formConfig.appearance,
                            successTitle: e.target.value,
                          },
                        })
                      }
                      className="w-full bg-slate-950 border border-white/10 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-300 mb-1">
                      Post-Submission Confirmation Message
                    </label>
                    <textarea
                      rows={2}
                      value={formConfig.appearance.successMessage}
                      onChange={(e) =>
                        setFormConfig({
                          ...formConfig,
                          appearance: {
                            ...formConfig.appearance,
                            successMessage: e.target.value,
                          },
                        })
                      }
                      className="w-full bg-slate-950 border border-white/10 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-emerald-500 resize-none"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Tab 4: Payment & UPI Settings */}
            {activeTab === 'payment' && (
              <div className="flex-1 overflow-y-auto p-6 space-y-6">
                <div>
                  <h3 className="text-sm font-bold text-white flex items-center gap-2">
                    <CreditCard className="w-4 h-4 text-emerald-400" />
                    <span>Tournament Payment & Direct UPI Configuration</span>
                  </h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Configure online UPI payment collection, QR codes, category-specific pricing, and mandatory/optional enforcement.
                  </p>
                </div>

                {/* Primary Enablement & Mode Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Enable / Disable */}
                  <div className="p-4 rounded-2xl bg-slate-900 border border-white/10 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-white">Payment Collection</span>
                      <button
                        type="button"
                        onClick={() =>
                          setFormConfig({
                            ...formConfig,
                            payment: {
                              ...formConfig.payment!,
                              enabled: !formConfig.payment?.enabled,
                            },
                          })
                        }
                        className={`text-xs px-3 py-1 rounded-xl font-bold transition-all ${
                          formConfig.payment?.enabled
                            ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                            : 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                        }`}
                      >
                        {formConfig.payment?.enabled ? 'Active / Enabled' : 'Disabled'}
                      </button>
                    </div>
                    <p className="text-[11px] text-slate-400 leading-relaxed">
                      When enabled, payment instructions, QR code, and UPI intent links are presented to applicants.
                    </p>
                  </div>

                  {/* Mandatory vs Optional */}
                  <div className="p-4 rounded-2xl bg-slate-900 border border-white/10 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-white">Payment Enforcement</span>
                      <button
                        type="button"
                        onClick={() =>
                          setFormConfig({
                            ...formConfig,
                            payment: {
                              ...formConfig.payment!,
                              isMandatory: !formConfig.payment?.isMandatory,
                            },
                          })
                        }
                        className={`text-xs px-3 py-1 rounded-xl font-bold transition-all ${
                          formConfig.payment?.isMandatory
                            ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                            : 'bg-blue-500/20 text-blue-300 border border-blue-500/30'
                        }`}
                      >
                        {formConfig.payment?.isMandatory ? 'Mandatory' : 'Optional (Pay Later)'}
                      </button>
                    </div>
                    <p className="text-[11px] text-slate-400 leading-relaxed">
                      {formConfig.payment?.isMandatory
                        ? 'Mandatory: Applicants must submit payment reference or initiation before registering.'
                        : 'Optional: Players can submit entry and pay later or offline at tournament desk.'}
                    </p>
                  </div>
                </div>

                {/* Base Fee & Recipient Info */}
                <div className="p-5 rounded-2xl bg-slate-900 border border-white/10 space-y-4">
                  <h4 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                    <span>Official Recipient UPI Account</span>
                  </h4>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-300 mb-1">
                        Recipient UPI ID (VPA) *
                      </label>
                      <input
                        type="text"
                        value={formConfig.payment?.upiId || 'karan-hdfc@ybl'}
                        onChange={(e) =>
                          setFormConfig({
                            ...formConfig,
                            payment: {
                              ...formConfig.payment!,
                              upiId: e.target.value.trim(),
                            },
                          })
                        }
                        placeholder="e.g. karan-hdfc@ybl"
                        className="w-full bg-slate-950 border border-white/10 rounded-xl px-3.5 py-2 text-xs text-white font-mono focus:border-emerald-500 focus:outline-none"
                      />
                      <span className="text-[10px] text-slate-500 mt-1 block">
                        Default: <span className="font-mono text-slate-400">karan-hdfc@ybl</span>
                      </span>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-300 mb-1">
                        Recipient Account Name
                      </label>
                      <input
                        type="text"
                        value={formConfig.payment?.accountName || 'Smash Premier League (Karan Gaur)'}
                        onChange={(e) =>
                          setFormConfig({
                            ...formConfig,
                            payment: {
                              ...formConfig.payment!,
                              accountName: e.target.value,
                            },
                          })
                        }
                        className="w-full bg-slate-950 border border-white/10 rounded-xl px-3.5 py-2 text-xs text-white focus:border-emerald-500 focus:outline-none"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-300 mb-1">
                        Base Entry Fee (INR ₹)
                      </label>
                      <input
                        type="number"
                        min={0}
                        value={formConfig.payment?.baseFee ?? 500}
                        onChange={(e) => {
                          const val = Math.max(0, Number(e.target.value) || 0);
                          setFormConfig({
                            ...formConfig,
                            entryFee: val,
                            payment: {
                              ...formConfig.payment!,
                              baseFee: val,
                            },
                          });
                        }}
                        className="w-full bg-slate-950 border border-white/10 rounded-xl px-3.5 py-2 text-xs text-white font-mono focus:border-emerald-500 focus:outline-none"
                      />
                      <span className="text-[10px] text-slate-500 mt-1 block">
                        Set ₹0 for 100% Free Registration
                      </span>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-300 mb-1">
                        Transaction Reference Note
                      </label>
                      <input
                        type="text"
                        value={formConfig.payment?.note || 'SPL Maharajganj Player Entry Fee'}
                        onChange={(e) =>
                          setFormConfig({
                            ...formConfig,
                            payment: {
                              ...formConfig.payment!,
                              note: e.target.value,
                            },
                          })
                        }
                        className="w-full bg-slate-950 border border-white/10 rounded-xl px-3.5 py-2 text-xs text-white focus:border-emerald-500 focus:outline-none"
                      />
                    </div>
                  </div>
                </div>

                {/* Category-Specific Pricing Matrix */}
                <div className="p-5 rounded-2xl bg-slate-900 border border-white/10 space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="text-xs font-bold text-white uppercase tracking-wider">
                        Category-Specific Entry Fees
                      </h4>
                      <p className="text-[11px] text-slate-400">
                        Automatically adjust amount based on player category selection.
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        const newCat = prompt('Enter new category name (e.g. Mixed Doubles, Veteran 40+):');
                        if (newCat && newCat.trim()) {
                          const currentFees = formConfig.payment?.categoryFees || {};
                          setFormConfig({
                            ...formConfig,
                            payment: {
                              ...formConfig.payment!,
                              categoryFees: {
                                ...currentFees,
                                [newCat.trim()]: 500,
                              },
                            },
                          });
                        }
                      }}
                      className="px-3 py-1.5 rounded-xl text-xs font-bold bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500/30 border border-emerald-500/30 transition-colors"
                    >
                      + Add Category Fee
                    </button>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                    {Object.entries(formConfig.payment?.categoryFees || {
                      Singles: 300,
                      Doubles: 500,
                      'Mixed Doubles': 500,
                      Both: 800,
                    }).map(([catName, catFee]) => (
                      <div
                        key={catName}
                        className="flex items-center justify-between gap-3 p-3 rounded-xl bg-slate-950 border border-white/10 text-xs"
                      >
                        <span className="font-bold text-white truncate">{catName}</span>
                        <div className="flex items-center gap-2">
                          <span className="text-slate-400 font-mono">₹</span>
                          <input
                            type="number"
                            min={0}
                            value={catFee}
                            onChange={(e) => {
                              const newFee = Math.max(0, Number(e.target.value) || 0);
                              setFormConfig({
                                ...formConfig,
                                payment: {
                                  ...formConfig.payment!,
                                  categoryFees: {
                                    ...(formConfig.payment?.categoryFees || {}),
                                    [catName]: newFee,
                                  },
                                },
                              });
                            }}
                            className="w-20 bg-slate-900 border border-white/10 rounded-lg px-2.5 py-1 text-xs text-white font-mono focus:outline-none focus:border-emerald-500 text-right"
                          />
                          <button
                            type="button"
                            onClick={() => {
                              const copy = { ...(formConfig.payment?.categoryFees || {}) };
                              delete copy[catName];
                              setFormConfig({
                                ...formConfig,
                                payment: {
                                  ...formConfig.payment!,
                                  categoryFees: copy,
                                },
                              });
                            }}
                            className="text-slate-500 hover:text-rose-400 p-1"
                            title="Remove category fee"
                          >
                            ✕
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Instructions & Button Label */}
                <div className="p-5 rounded-2xl bg-slate-900 border border-white/10 space-y-4">
                  <h4 className="text-xs font-bold text-white uppercase tracking-wider">
                    Instructions & Button Text
                  </h4>

                  <div className="space-y-3">
                    <div>
                      <label className="block text-xs font-bold text-slate-300 mb-1">
                        Payment Instructions (Shown to player)
                      </label>
                      <textarea
                        rows={2}
                        value={formConfig.payment?.instructions || ''}
                        onChange={(e) =>
                          setFormConfig({
                            ...formConfig,
                            payment: {
                              ...formConfig.payment!,
                              instructions: e.target.value,
                            },
                          })
                        }
                        placeholder="e.g. Scan QR code or tap UPI button to pay via Google Pay, PhonePe, or Paytm..."
                        className="w-full bg-slate-950 border border-white/10 rounded-xl p-3 text-xs text-white focus:outline-none focus:border-emerald-500 resize-none"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-300 mb-1">
                        Payment Button Label
                      </label>
                      <input
                        type="text"
                        value={formConfig.payment?.buttonText || 'Pay Registration Fee'}
                        onChange={(e) =>
                          setFormConfig({
                            ...formConfig,
                            payment: {
                              ...formConfig.payment!,
                              buttonText: e.target.value,
                            },
                          })
                        }
                        className="w-full bg-slate-950 border border-white/10 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
                      />
                    </div>
                  </div>
                </div>

                {/* Live Payment Preview Card with QR */}
                <div className="p-5 rounded-2xl bg-gradient-to-br from-emerald-500/10 via-slate-900 to-slate-950 border border-emerald-500/30 space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-black uppercase tracking-wider text-emerald-400 flex items-center gap-1.5">
                      <QrCode className="w-4 h-4" />
                      <span>Live UPI Intent Preview</span>
                    </span>
                    <span className="text-[10px] font-mono text-slate-400">
                      Amount: {formatINR(formConfig.payment?.baseFee ?? 500)}
                    </span>
                  </div>

                  <div className="flex flex-col sm:flex-row items-center gap-5">
                    {previewQrCode ? (
                      <img
                        src={previewQrCode}
                        alt="Preview QR Code"
                        className="w-32 h-32 rounded-2xl bg-white p-2 shadow-xl"
                      />
                    ) : (
                      <div className="w-32 h-32 bg-slate-800 rounded-2xl flex items-center justify-center text-xs text-slate-400">
                        Generating QR...
                      </div>
                    )}

                    <div className="space-y-2 text-xs flex-1 min-w-0">
                      <div>
                        <span className="text-[10px] text-slate-400 block">UPI ID:</span>
                        <span className="font-mono font-bold text-white block select-all">
                          {formConfig.payment?.upiId || 'karan-hdfc@ybl'}
                        </span>
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-400 block">Recipient:</span>
                        <span className="font-semibold text-slate-200 block">
                          {formConfig.payment?.accountName || 'Smash Premier League'}
                        </span>
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-400 block">Intent URI:</span>
                        <span className="font-mono text-[10px] text-slate-400 truncate block bg-black/40 p-1.5 rounded-lg border border-white/5 select-all">
                          {buildUPIPaymentUri({
                            upiId: formConfig.payment?.upiId || 'karan-hdfc@ybl',
                            accountName: formConfig.payment?.accountName || 'Smash Premier League',
                            amount: formConfig.payment?.baseFee ?? 500,
                            note: formConfig.payment?.note || 'SPL Tournament Entry Fee',
                          })}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Modal Footer with Actions */}
        <div className="flex flex-wrap items-center justify-between gap-3 px-6 py-4 border-t border-white/10 bg-slate-900/60">
          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-bold text-slate-300 hover:text-white hover:bg-white/5 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={() => setIsPreviewMode(!isPreviewMode)}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold bg-white/5 hover:bg-white/10 text-white transition-colors"
            >
              <Eye className="w-3.5 h-3.5 text-amber-400" />
              <span>{isPreviewMode ? 'Back to Editor' : 'Preview Form'}</span>
            </button>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              onClick={handleSaveDraft}
              disabled={isSaving}
              className="px-4 py-2 rounded-xl text-xs font-bold bg-slate-800 hover:bg-slate-700 text-slate-200 transition-colors disabled:opacity-50"
            >
              {isSaving ? 'Saving...' : 'Save Draft'}
            </button>

            <button
              onClick={handlePublishChanges}
              disabled={isSaving}
              style={{ backgroundColor: accentColor }}
              className="flex items-center gap-1.5 px-5 py-2 rounded-xl text-xs font-black text-slate-950 hover:opacity-95 transition-all shadow-lg disabled:opacity-50"
              title="Save all form customizations to the persistent database and update the live registration link"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>{isSaving ? 'Publishing...' : 'Publish / Generate Link'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
