export interface TournamentSettings {
  name: string;
  date: string;
  venue: string;
  organizer: string;
  courts: number;
  format: string; // '21' | '15' | '30'
  entryFee: number;
  slotLimit: number;
  season?: string;
  announcement?: string;
}

export interface Player {
  id: string;
  name: string;
  mobile?: string;
  age?: number;
  gender?: 'M' | 'F' | 'Other';
  skillLevel?: 'Intermediate' | 'Advanced' | 'Pro';
}

export interface Team {
  id: string;
  name: string;
  players: string[]; // Player IDs
  captainId?: string;
  locked?: boolean;
  avatarColor?: string;
  badge?: string;
}

export interface MatchSet {
  scoreA: number;
  scoreB: number;
}

export interface Match {
  id: string;
  round: number;
  court: number;
  teamA: string; // Team ID
  teamB: string; // Team ID
  scoreA?: number;
  scoreB?: number;
  status: 'upcoming' | 'live' | 'completed' | 'postponed';
  winner?: string; // Team ID
  time?: string;
  sets?: MatchSet[];
  mvpPlayerId?: string;
}

export interface KnockoutMatch {
  id: string;
  stage: 'ELIM' | 'SF' | 'F';
  slot: number;
  teamA?: string;
  teamB?: string;
  scoreA?: number;
  scoreB?: number;
  status: 'upcoming' | 'live' | 'completed';
  winner?: string;
  manual?: boolean;
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

