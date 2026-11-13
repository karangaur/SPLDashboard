export interface BadmintonScoringRules {
  pointTarget: number; // 21 (BWF standard), 15, 30, or custom
  setsToWin: number; // 1 (single game) or 2 (best of 3)
  deuceEnabled: boolean; // must win by 2 points
  maxPointCap: number; // golden point / cap (e.g. 30 in BWF)
  changeEndsAtInterval: boolean; // interval at 11 pts (or half point target)
}

export interface TournamentSettings {
  name: string;
  date: string;
  venue: string;
  organizer: string;
  courts: number;
  courtNames?: string[];
  format: string; // '21' | '15' | '30'
  entryFee: number;
  slotLimit: number;
  season?: string;
  announcement?: string;
  scoringRules?: BadmintonScoringRules;
}

export interface Player {
  id: string;
  name: string;
  mobile?: string;
  age?: number;
  gender?: 'M' | 'F' | 'Other';
  skillLevel?: 'Intermediate' | 'Advanced' | 'Pro';
  registrationId?: string;
  registrationStatus?: 'pending' | 'approved' | 'rejected' | 'paid' | 'direct';
  city?: string;
  category?: string;
  style?: string;
  photoUrl?: string;
}

export interface Team {
  id: string;
  name: string;
  players: string[]; // Player IDs
  captainId?: string;
  locked?: boolean;
  lockedPlayerIds?: string[];
  avatarColor?: string;
  badge?: string;
  token?: string;
}

export interface MatchSet {
  scoreA: number;
  scoreB: number;
  winner?: 'A' | 'B';
  isCompleted?: boolean;
}

export interface Match {
  id: string;
  round: number;
  court: number;
  courtName?: string;
  courtSlot?: number;
  teamA: string; // Team ID
  teamB: string; // Team ID
  scoreA?: number;
  scoreB?: number;
  status: 'upcoming' | 'live' | 'paused' | 'completed' | 'postponed';
  winner?: string; // Team ID
  time?: string;
  sets?: MatchSet[];
  mvpPlayerId?: string;
  version?: number;
  matchType?: 'group' | 'knockout';
  stage?: 'ELIM' | 'QF' | 'SF' | 'F';
  slot?: number;
  stageLabel?: string;
}

export interface KnockoutMatch {
  id: string;
  stage: 'ELIM' | 'QF' | 'SF' | 'F';
  slot: number;
  court?: number;
  courtName?: string;
  time?: string;
  teamA?: string;
  teamB?: string;
  scoreA?: number;
  scoreB?: number;
  status: 'upcoming' | 'live' | 'paused' | 'completed';
  winner?: string;
  manual?: boolean;
  sets?: MatchSet[];
  mvpPlayerId?: string;
  version?: number;
}

export interface KnockoutData {
  format: 'top2' | 'top4' | 'top8';
  matches: KnockoutMatch[];
}

export type FormFieldType =
  | 'text'
  | 'short_text'
  | 'textarea'
  | 'long_text'
  | 'mobile'
  | 'phone'
  | 'email'
  | 'number'
  | 'dropdown'
  | 'select'
  | 'radio'
  | 'checkbox'
  | 'checkboxes'
  | 'date'
  | 'gender'
  | 'city'
  | 'age'
  | 'yes_no'
  | 'terms'
  | 'section_heading'
  | 'photo';

export interface RegistrationFormField {
  id: string;
  label: string;
  type: FormFieldType;
  placeholder?: string;
  helpText?: string;
  required: boolean;
  enabled: boolean;
  options?: string[]; // for dropdown, radio, checkbox
  defaultValue?: any;
  isSystem?: boolean; // core fields like name & mobile
  order: number;
  content?: string; // for section_heading or terms descriptive body
  termsText?: string; // custom terms link or description
  min?: number; // min number/age
  max?: number; // max number/age
}

export interface FormAppearance {
  formTitle: string;
  formDescription: string;
  welcomeMessage?: string;
  logoUrl?: string;
  bannerUrl?: string;
  accentColor: string; // e.g. '#10b981', '#f59e0b', etc.
  accentName: string;
  submitButtonText: string;
  successTitle: string;
  successMessage: string;
  customUrlSlug?: string;
}

export interface FormPaymentConfig {
  enabled: boolean;
  isMandatory: boolean; // if true, payment reference or initiation required
  upiId: string; // recipient UPI ID, default: 'karan-hdfc@ybl'
  accountName: string; // recipient name, e.g. 'Smash Premier League'
  note?: string; // description / note
  instructions?: string; // custom payment instructions
  buttonText?: string; // custom button label, e.g. 'Pay Registration Fee'
  baseFee: number; // default registration fee in INR (0 for free)
  categoryFees?: Record<string, number>; // optional category-specific fees
  customQrDataUrl?: string;
}

export interface RegistrationFormConfig {
  seasonSlug: string;
  customUrlSlug?: string;
  tournamentName: string;
  seasonTitle: string;
  deadline?: string;
  maxSlots?: number;
  entryFee?: number;
  venue?: string;
  date?: string;
  enabled: boolean;
  closedNotice?: string;
  isPublished: boolean;
  version?: number;
  publishedAt?: number;
  lastUpdatedAt?: number;
  payment?: FormPaymentConfig;
  appearance: FormAppearance;
  fields: RegistrationFormField[];
}


export interface RegistrationTokenRecord {
  id: string;
  token: string;
  seasonSlug: string;
  label?: string;
  createdAt: number;
  isActive: boolean;
  revokedAt?: number;
  submissionsCount?: number;
}

export interface RegistrationFieldConfig {
  visible: boolean;
  required: boolean;
}

export interface RegistrationSettings {
  enabled: boolean;
  seasonSlug: string;
  seasonTitle: string;
  customUrlSlug?: string;
  maxSlots: number;
  deadline?: string;
  closedNotice?: string;
  fields: {
    whatsapp: RegistrationFieldConfig;
    gender: RegistrationFieldConfig;
    age: RegistrationFieldConfig;
    experience: RegistrationFieldConfig;
    category: RegistrationFieldConfig;
    style: RegistrationFieldConfig;
    city: RegistrationFieldConfig;
    notes: RegistrationFieldConfig;
  };
}

export type PaymentStatus =
  | 'unpaid'
  | 'pending'
  | 'initiated'
  | 'pending_verification'
  | 'paid'
  | 'failed'
  | 'cancelled'
  | 'refunded';

export interface PaymentAuditEntry {
  action: string;
  by: string;
  at: number;
  note?: string;
  fromStatus?: string;
  toStatus?: string;
}

export interface Registration {
  id: string;
  playerId?: string;
  regId: string;
  name: string;
  mobile: string;
  whatsapp?: string;
  age?: number;
  gender: 'M' | 'F' | 'Other';
  experience?: 'Beginner' | 'Intermediate' | 'Advanced' | 'Pro' | string;
  category?: 'Singles' | 'Doubles' | 'Mixed Doubles' | 'Both' | string;
  style?: 'Attacking' | 'Defensive' | 'All-Rounder' | 'Net Play' | string;
  city?: string;
  notes?: string;
  fee: number;
  paidAmount?: number;
  status: 'pending' | 'approved' | 'rejected' | 'paid' | 'complimentary';
  paymentStatus?: PaymentStatus;
  method?: 'cash' | 'upi' | 'bank' | 'complimentary';
  txnId?: string;
  season?: string;
  createdAt: number;
  paidAt?: number;
  approvedAt?: number;
  verifiedBy?: string;
  verifiedAt?: number;
  auditLog?: PaymentAuditEntry[];
  answers?: Record<string, any>;
  photoUrl?: string;
  tokenUsed?: string;
  formVersion?: number;
}


export interface PaymentSettings {
  enabled: boolean;
  isMandatory?: boolean;
  qrImage: string;
  upiId: string;
  accountName: string;
  note: string;
  instructions?: string;
  buttonText?: string;
  categoryFees?: Record<string, number>;
}

export interface PredefinedTeam {
  id: string;
  name: string;
  players: [string, string];
}

export interface StandingsRecord {
  team: Team;
  played: number;
  won: number;
  lost: number;
  points: number;
  pointsFor: number;
  pointsAgainst: number;
  diff: number;
  form: ('W' | 'L')[];
}

export interface TournamentState {
  settings: TournamentSettings;
  registrationSettings: RegistrationSettings;
  players: Player[];
  teams: Team[];
  matches: Match[];
  knockout: KnockoutData;
  registrations: Registration[];
  payment: PaymentSettings;
  predefinedTeams: PredefinedTeam[];
  teamFormationMode: 'random' | 'predefined' | 'mixed';
}

// ============================================================================
// HERO SECTION CUSTOMIZATION MANAGER TYPES
// ============================================================================

export type HeroBackgroundType = 'gradient' | 'image' | 'video';
export type HeroBackgroundFit = 'cover' | 'contain' | 'fill';
export type HeroSectionHeight = 'compact' | 'standard' | 'tall' | 'fullscreen';
export type HeroContentAlignment = 'left' | 'center' | 'right';
export type HeroFontFamily =
  | 'Outfit'
  | 'Plus Jakarta Sans'
  | 'Barlow Condensed'
  | 'Oswald'
  | 'Manrope'
  | 'DM Sans';
export type HeroAnimationPreset =
  | 'staggered-broadcast'
  | 'cinematic-fade'
  | 'kinetic-smash'
  | 'minimal'
  | 'none';
export type HeroThemePresetId =
  | 'championship-gold'
  | 'electric-arena'
  | 'royal-championship'
  | 'custom';
export type HeroButtonActionTarget =
  | 'register'
  | '#live-match'
  | '#matches-schedule'
  | '#teams-roster'
  | '#standings-table'
  | '#tournament-info'
  | '/register'
  | 'custom-url';
export type HeroButtonStyle =
  | 'gold-primary'
  | 'crimson-outline'
  | 'glass-outline'
  | 'emerald-solid'
  | 'royal-solid'
  | 'custom';
export type HeroButtonHoverEffect = 'lift-glow' | 'scale' | 'shine' | 'none';

export interface HeroBackgroundConfig {
  type: HeroBackgroundType;
  imageUrl: string;
  imageStoragePath?: string;
  mobileImageUrl: string;
  mobileImageStoragePath?: string;
  focalPointX: number;
  focalPointY: number;
  mobileFocalPointX: number;
  mobileFocalPointY: number;
  imageFit: HeroBackgroundFit;
  videoUrl: string;
  videoStoragePath?: string;
  videoPosterUrl: string;
  videoPosterStoragePath?: string;
  videoAutoplay: boolean;
  videoLoop: boolean;
  videoPlayOnMobile: boolean;
  overlayOpacity: number;
  overlayColor: string;
  solidColor: string;
  gradientStart: string;
  gradientMid: string;
  gradientEnd: string;
  gradientDirection: 'to-b' | 'to-br' | 'to-r' | 'radial';
  showCourtPattern: boolean;
  backgroundMotion: boolean;
}

export interface HeroLogoConfig {
  visible: boolean;
  customLogoUrl: string;
  customLogoStoragePath?: string;
  customLogoMime?: string;
  subtitle: string;
  desktopSize: 'sm' | 'md' | 'lg' | 'xl';
  mobileSize: 'sm' | 'md' | 'lg';
  alignment: 'inherit' | 'left' | 'center' | 'right';
  entranceAnimation: boolean;
  applyGlobalNavbarBranding: boolean;
}

export interface HeroTextFieldStyle {
  text: string;
  visible: boolean;
  color: string;
  fontSizeDesktop: number;
  fontSizeMobile: number;
  fontWeight: '500' | '600' | '700' | '800' | '900';
}

export interface HeroTextConfig {
  alignment: HeroContentAlignment;
  fontFamily: HeroFontFamily;
  kickerText: string;
  kickerVisible: boolean;
  kickerColor: string;
  versionColor?: string;
  mainHeading: HeroTextFieldStyle;
  subtitle: HeroTextFieldStyle;
  tagline: HeroTextFieldStyle;
  description: HeroTextFieldStyle;
  showAnnouncementLine: boolean;
}

export interface HeroButtonConfig {
  id: string;
  role: 'registration' | 'live' | 'schedule';
  label: string;
  visible: boolean;
  order: number;
  style: HeroButtonStyle;
  customBgColor: string;
  customTextColor: string;
  customBorderColor: string;
  actionTarget: HeroButtonActionTarget;
  customUrl: string;
  hoverEffect: HeroButtonHoverEffect;
}

export interface HeroButtonsLayoutConfig {
  desktopLayout: 'row' | 'wrap' | 'stacked';
  mobileLayout: 'stacked' | 'row';
  buttons: HeroButtonConfig[];
}

export interface HeroThemeConfig {
  preset: HeroThemePresetId;
  sectionHeight: HeroSectionHeight;
  contentAlignment: HeroContentAlignment;
  headingColor: string;
  accentColor: string;
  borderColor: string;
  showRightShowcaseCard: boolean;
  showInfoStrip: boolean;
}

export interface HeroAnimationConfig {
  enabled: boolean;
  preset: HeroAnimationPreset;
  intensity: 'subtle' | 'balanced' | 'energetic';
  durationScale: number;
  logoEntrance: boolean;
  headingReveal: boolean;
  subtitleAnimation: boolean;
  buttonEntrance: boolean;
  backgroundMotion: boolean;
  floatingParticles: boolean;
  spotlightEffects: boolean;
}

export interface HeroConfig {
  version: number;
  status: 'draft' | 'published';
  updatedAt: number;
  updatedBy: string;
  publishedAt?: number;
  publishedBy?: string;
  background: HeroBackgroundConfig;
  logo: HeroLogoConfig;
  text: HeroTextConfig;
  buttons: HeroButtonsLayoutConfig;
  theme: HeroThemeConfig;
  animations: HeroAnimationConfig;
}

export interface HeroVersionRecord {
  id: string;
  versionNum: number;
  action: 'publish' | 'restore';
  createdBy: string;
  createdAt: number;
  summary: string;
  config: HeroConfig;
}

// ============================================================================
// YOUTUBE LIVE STREAMING INTEGRATION TYPES
// ============================================================================

export type YouTubeLiveStatus = 'scheduled' | 'live' | 'ended';

export interface YouTubeLiveConfig {
  enabled: boolean;
  videoUrl: string;
  videoId: string;
  status: YouTubeLiveStatus;
  title: string;
  scheduledAt?: string;
  allowReplay: boolean;
  updatedAt?: number;
  updatedBy?: string;
}

