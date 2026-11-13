import QRCode from 'qrcode';
import {
  TournamentState,
  Team,
  Match,
  KnockoutMatch,
  StandingsRecord,
  Registration,
  PaymentStatus,
  PaymentSettings,
  RegistrationFormField,
  RegistrationFormConfig,
  FormAppearance,
  RegistrationTokenRecord,
  FormFieldType,
  FormPaymentConfig,
} from '../types/tournament';

export const STORAGE_KEY = 'smash-premier-league-v8';

export const DEFAULT_REGISTRATION_SETTINGS = {
  enabled: true,
  seasonSlug: 'season-4',
  seasonTitle: 'Smash Premier League — Season IV (Championship Edition)',
  maxSlots: 32,
  deadline: '2026-11-15T23:59',
  closedNotice: 'Registrations for Season IV are currently closed. Please contact the tournament organizer or follow the official channel for spot entries.',
  fields: {
    whatsapp: { visible: true, required: false },
    gender: { visible: true, required: true },
    age: { visible: true, required: false },
    experience: { visible: true, required: false },
    category: { visible: true, required: false },
    style: { visible: true, required: false },
    city: { visible: true, required: false },
    notes: { visible: true, required: false },
  },
};

export const COLOR_PRESETS = [
  { name: 'Electric Emerald', color: '#10b981', ring: 'ring-emerald-500', bg: 'bg-emerald-500' },
  { name: 'Championship Gold', color: '#f59e0b', ring: 'ring-amber-500', bg: 'bg-amber-500' },
  { name: 'Neon Cyan', color: '#06b6d4', ring: 'ring-cyan-500', bg: 'bg-cyan-500' },
  { name: 'Blaze Orange', color: '#f97316', ring: 'ring-orange-500', bg: 'bg-orange-500' },
  { name: 'Crimson Rose', color: '#f43f5e', ring: 'ring-rose-500', bg: 'bg-rose-500' },
  { name: 'Imperial Violet', color: '#8b5cf6', ring: 'ring-violet-500', bg: 'bg-violet-500' },
];

export const DEFAULT_FORM_FIELDS: RegistrationFormField[] = [
  {
    id: 'name',
    label: 'Full Name',
    type: 'text',
    placeholder: 'Enter athlete full legal name',
    helpText: 'As it will appear on tournament draw sheets and certificates',
    required: true,
    enabled: true,
    isSystem: true,
    order: 1,
  },
  {
    id: 'mobile',
    label: 'Mobile Number',
    type: 'mobile',
    placeholder: '9876543210',
    helpText: '10-digit Indian mobile number for tournament SMS updates',
    required: true,
    enabled: true,
    isSystem: true,
    order: 2,
  },
  {
    id: 'whatsapp',
    label: 'WhatsApp Number',
    type: 'mobile',
    placeholder: 'Same as mobile or provide alternate',
    helpText: 'For fixture schedules and captain notifications',
    required: false,
    enabled: true,
    order: 3,
  },
  {
    id: 'gender',
    label: 'Gender',
    type: 'radio',
    options: ['Male', 'Female', 'Other'],
    required: true,
    enabled: true,
    order: 4,
  },
  {
    id: 'age',
    label: 'Age',
    type: 'number',
    placeholder: 'e.g. 24',
    helpText: 'Used for seeding and veteran category classification',
    required: false,
    enabled: true,
    order: 5,
  },
  {
    id: 'experience',
    label: 'Playing Experience',
    type: 'dropdown',
    options: ['Beginner', 'Intermediate', 'Advanced', 'Pro'],
    helpText: 'Helps ensure fair team balance in captain drafts',
    required: false,
    enabled: true,
    order: 6,
  },
  {
    id: 'category',
    label: 'Preferred Playing Category',
    type: 'dropdown',
    options: ['Singles', 'Doubles', 'Mixed Doubles', 'Both'],
    required: false,
    enabled: true,
    order: 7,
  },
  {
    id: 'style',
    label: 'Playing Style',
    type: 'dropdown',
    options: ['Attacking', 'Defensive', 'All-Rounder', 'Net Play'],
    required: false,
    enabled: true,
    order: 8,
  },
  {
    id: 'city',
    label: 'City / Locality',
    type: 'text',
    placeholder: 'e.g. Maharajganj, Gorakhpur',
    required: false,
    enabled: true,
    order: 9,
  },
  {
    id: 'ownRacket',
    label: 'Do you have your own tournament racket?',
    type: 'radio',
    options: ['Yes, I will bring my own racket', 'No, require club loaner racket'],
    required: false,
    enabled: true,
    order: 10,
  },
  {
    id: 'tshirtSize',
    label: 'Tournament Jersey Size',
    type: 'dropdown',
    options: ['S (36)', 'M (38)', 'L (40)', 'XL (42)', 'XXL (44)'],
    helpText: 'Official S.P.L. dri-fit tournament jersey',
    required: false,
    enabled: true,
    order: 11,
  },
  {
    id: 'photo',
    label: 'Athlete Profile Photo',
    type: 'photo',
    helpText: 'Upload a clear headshot for your athlete player badge',
    required: false,
    enabled: true,
    order: 12,
  },
  {
    id: 'notes',
    label: 'Additional Information / Notes',
    type: 'textarea',
    placeholder: 'Any special requests, partner preferences, or medical notes',
    required: false,
    enabled: true,
    order: 13,
  },
];

export function createDefaultFormConfig(
  seasonSlug = 'season-4',
  tournamentName = 'Smash Premier League',
  seasonTitle = 'Season IV (Championship Edition)'
): RegistrationFormConfig {
  return {
    seasonSlug,
    tournamentName,
    seasonTitle,
    deadline: '2026-11-15T23:59',
    maxSlots: 32,
    entryFee: 500,
    venue: 'Maharajganj Indoor Badminton Stadium, Court 1 & 2',
    date: '2026-10-25',
    enabled: true,
    closedNotice: 'Registrations for this tournament are currently closed. Please contact the tournament organizer for spot entry inquiries.',
    isPublished: true,
    publishedAt: Date.now(),
    lastUpdatedAt: Date.now(),
    payment: {
      enabled: true,
      isMandatory: true,
      upiId: 'karan-hdfc@ybl',
      accountName: 'Smash Premier League (Karan Gaur)',
      note: 'SPL Maharajganj Player Entry Fee',
      instructions: 'Scan the QR code or tap the UPI button to pay via Google Pay, PhonePe, or Paytm.',
      buttonText: 'Pay Registration Fee',
      baseFee: 500,
      categoryFees: {
        Singles: 300,
        Doubles: 500,
        'Mixed Doubles': 500,
        Both: 800,
      },
    },
    appearance: {
      formTitle: 'Player Entry & Registration Form',
      formDescription: 'Register as an official athlete for the upcoming Smash Premier League championship.',
      welcomeMessage: 'Welcome athletes! Please fill in your details accurately to register for the tournament draft.',
      accentColor: '#10b981',
      accentName: 'Electric Emerald',
      submitButtonText: 'Submit Registration & Confirm Entry',
      successTitle: 'Registration Submitted Successfully!',
      successMessage: 'Thank you for registering for Smash Premier League. Your details and payment reference have been received by the tournament committee. Please save your Registration ID.',
    },
    fields: [...DEFAULT_FORM_FIELDS],
  };
}

export function generateRegistrationToken(prefix = 'SPL'): string {
  const chars = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
  let rand = '';
  for (let i = 0; i < 6; i++) {
    rand += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return `${prefix}-${Date.now().toString(36).slice(-3).toUpperCase()}-${rand}`;
}

export const DEFAULT_STATE: TournamentState = {
  settings: {
    name: 'Smash Premier League',
    date: '2026-10-25',
    venue: 'Maharajganj Indoor Badminton Stadium, Court 1 & 2',
    organizer: 'SPL Tournament Committee',
    courts: 2,
    format: '21',
    entryFee: 500,
    slotLimit: 32,
    season: 'Season IV (Championship Edition)',
    announcement: 'Grand Finale on Court 1! Live scoring active.',
    scoringRules: {
      pointTarget: 21,
      setsToWin: 1,
      deuceEnabled: true,
      maxPointCap: 30,
      changeEndsAtInterval: true,
    },
  },
  registrationSettings: DEFAULT_REGISTRATION_SETTINGS,
  players: [],
  teams: [],
  matches: [],
  knockout: {
    format: 'top4',
    matches: [],
  },
  registrations: [],
  payment: {
    enabled: true,
    isMandatory: true,
    qrImage: '',
    upiId: 'karan-hdfc@ybl',
    accountName: 'Smash Premier League (Karan Gaur)',
    note: 'SPL Maharajganj Entry Fee',
    instructions: 'Scan the QR code or tap the UPI button to pay via Google Pay, PhonePe, or Paytm.',
    buttonText: 'Pay Registration Fee',
    categoryFees: {
      Singles: 300,
      Doubles: 500,
      'Mixed Doubles': 500,
      Both: 800,
    },
  },
  predefinedTeams: [],
  teamFormationMode: 'random',
};

// Standings calculation
export function calculateStandings(
  teams: Team[],
  matches: Match[],
  knockoutMatches: KnockoutMatch[] = []
): StandingsRecord[] {
  const records = new Map<string, StandingsRecord>();

  for (const team of teams) {
    records.set(team.id, {
      team,
      played: 0,
      won: 0,
      lost: 0,
      points: 0,
      pointsFor: 0,
      pointsAgainst: 0,
      diff: 0,
      form: [],
    });
  }

  // Combine league matches and completed knockout matches
  const allMatches: { teamA: string; teamB: string; scoreA?: number; scoreB?: number; status: string }[] = [
    ...matches,
    ...knockoutMatches
      .filter((k) => k.status === 'completed' && k.teamA && k.teamB && k.scoreA != null && k.scoreB != null)
      .map((k) => ({
        teamA: k.teamA!,
        teamB: k.teamB!,
        scoreA: k.scoreA,
        scoreB: k.scoreB,
        status: 'completed',
      })),
  ];

  for (const m of allMatches) {
    if (m.status !== 'completed' || m.scoreA == null || m.scoreB == null) continue;
    const a = records.get(m.teamA);
    const b = records.get(m.teamB);
    if (!a || !b) continue;

    a.played++;
    b.played++;
    a.pointsFor += m.scoreA;
    a.pointsAgainst += m.scoreB;
    b.pointsFor += m.scoreB;
    b.pointsAgainst += m.scoreA;

    if (m.scoreA > m.scoreB) {
      a.won++;
      a.points += 2;
      a.form.push('W');
      b.lost++;
      b.form.push('L');
    } else if (m.scoreB > m.scoreA) {
      b.won++;
      b.points += 2;
      b.form.push('W');
      a.lost++;
      a.form.push('L');
    }
  }

  const list = Array.from(records.values()).map((r) => ({
    ...r,
    diff: r.pointsFor - r.pointsAgainst,
    form: r.form.slice(-5), // last 5 results
  }));

  // Sort by Points (desc), then Won (desc), then Point Diff (desc), then Points For (desc)
  return list.sort((x, y) => {
    if (y.points !== x.points) return y.points - x.points;
    if (y.won !== x.won) return y.won - x.won;
    if (y.diff !== x.diff) return y.diff - x.diff;
    return y.pointsFor - x.pointsFor;
  });
}

// Intelligent Multi-Court Round Robin Generator
export function generateRoundRobinFixtures(
  teams: Team[],
  courtsCount = 1,
  courtNames?: string[]
): Match[] {
  const teamList = teams.filter((t) => t && t.id && t.name);
  if (teamList.length < 2) return [];

  const actualCourts = Math.max(1, Math.min(32, courtsCount || 1));
  const normalizedCourtNames: string[] = Array.from({ length: actualCourts }, (_, i) => {
    const custom = courtNames && courtNames[i]?.trim();
    return custom && custom.length > 0 ? custom : `Court ${i + 1}`;
  });

  const workingTeams = [...teamList];
  if (workingTeams.length % 2 === 1) {
    workingTeams.push({ id: '__BYE__', name: 'BYE', players: [] });
  }

  const n = workingTeams.length;
  const rounds = n - 1;
  const matchesPerRound = n / 2;
  const teamIds = workingTeams.map((t) => t.id);
  const result: Match[] = [];

  let globalSlot = 1;
  let prevRoundLastSlotTeams = new Set<string>();

  for (let r = 0; r < rounds; r++) {
    // 1. Gather all valid matches for this round
    const roundPairings: { teamA: string; teamB: string }[] = [];
    for (let m = 0; m < matchesPerRound; m++) {
      const a = teamIds[m];
      const b = teamIds[n - 1 - m];
      if (a !== '__BYE__' && b !== '__BYE__') {
        roundPairings.push({ teamA: a, teamB: b });
      }
    }

    // 2. Sort pairings to minimize consecutive back-to-back matches across round transitions
    if (roundPairings.length > actualCourts && prevRoundLastSlotTeams.size > 0) {
      roundPairings.sort((p1, p2) => {
        const p1HasPrev = prevRoundLastSlotTeams.has(p1.teamA) || prevRoundLastSlotTeams.has(p1.teamB) ? 1 : 0;
        const p2HasPrev = prevRoundLastSlotTeams.has(p2.teamA) || prevRoundLastSlotTeams.has(p2.teamB) ? 1 : 0;
        return p1HasPrev - p2HasPrev; // pairs without previous round last slot teams play earlier
      });
    }

    // 3. Partition round into time slots of size <= actualCourts
    // Since all pairings within a round are mutually disjoint, each time slot has 0 team overlap
    const slotsInRound = Math.ceil(roundPairings.length / actualCourts);
    let roundLastSlotTeams = new Set<string>();

    for (let s = 0; s < slotsInRound; s++) {
      const slotMatches = roundPairings.slice(s * actualCourts, (s + 1) * actualCourts);
      const isLastSlot = s === slotsInRound - 1;
      if (isLastSlot) {
        roundLastSlotTeams = new Set<string>();
        slotMatches.forEach((pm) => {
          roundLastSlotTeams.add(pm.teamA);
          roundLastSlotTeams.add(pm.teamB);
        });
      }

      // Distribute fairly across courts with round rotation offset
      const courtOffset = (r + s) % actualCourts;

      slotMatches.forEach((pair, idx) => {
        const courtIndex0 = (courtOffset + idx) % actualCourts;
        const courtNumber = courtIndex0 + 1;
        const courtName = normalizedCourtNames[courtIndex0] || `Court ${courtNumber}`;

        result.push({
          id: crypto.randomUUID(),
          round: r + 1,
          court: courtNumber,
          courtName,
          courtSlot: globalSlot,
          teamA: pair.teamA,
          teamB: pair.teamB,
          status: 'upcoming',
          time: `Round ${r + 1} · Slot ${s + 1} · ${courtName}`,
          version: 1,
        });
      });

      globalSlot++;
    }

    prevRoundLastSlotTeams = roundLastSlotTeams;

    // Rotate: keep first fixed, rotate remaining (standard Berger circle algorithm)
    const fixed = teamIds[0];
    const rest = teamIds.slice(1);
    rest.unshift(rest.pop()!);
    teamIds.splice(0, teamIds.length, fixed, ...rest);
  }

  return result;
}

// Knockout Bracket Progression Engine
export function progressKnockoutMatches(matches: KnockoutMatch[], format: 'top2' | 'top4' | 'top8'): KnockoutMatch[] {
  if (!matches || matches.length === 0) return matches;
  const updated = matches.map((m) => ({ ...m }));

  const elims = updated.filter((m) => m.stage === 'ELIM').sort((a, b) => a.slot - b.slot);
  const sfs = updated.filter((m) => m.stage === 'SF').sort((a, b) => a.slot - b.slot);
  const f = updated.find((m) => m.stage === 'F');

  const updatePairing = (target: KnockoutMatch, newA?: string, newB?: string) => {
    const changed = target.teamA !== newA || target.teamB !== newB;
    target.teamA = newA;
    target.teamB = newB;
    if (changed && target.status === 'completed') {
      target.status = 'upcoming';
      target.winner = undefined;
      target.scoreA = undefined;
      target.scoreB = undefined;
    }
  };

  if (format === 'top8' && elims.length >= 4 && sfs.length >= 2) {
    if (!sfs[0].manual) updatePairing(sfs[0], elims[0]?.winner, elims[1]?.winner);
    if (!sfs[1].manual) updatePairing(sfs[1], elims[2]?.winner, elims[3]?.winner);
  }

  if ((format === 'top4' || format === 'top8') && sfs.length >= 2 && f && !f.manual) {
    updatePairing(f, sfs[0]?.winner, sfs[1]?.winner);
  }

  return updated;
}

// Indian Mobile Validator
export function validateIndianMobile(raw: string): { isValid: boolean; cleanMobile: string; error?: string } {
  if (!raw || typeof raw !== 'string') {
    return { isValid: false, cleanMobile: '', error: 'Mobile number is required' };
  }
  // Remove non-digit characters (+91, spaces, hyphens)
  let clean = raw.replace(/\D/g, '');
  if (clean.startsWith('91') && clean.length === 12) {
    clean = clean.slice(2);
  } else if (clean.startsWith('0') && clean.length === 11) {
    clean = clean.slice(1);
  }

  if (clean.length !== 10) {
    return { isValid: false, cleanMobile: clean, error: 'Mobile number must be exactly 10 digits' };
  }
  if (!/^[6-9]/.test(clean)) {
    return { isValid: false, cleanMobile: clean, error: 'Indian mobile numbers must start with 6, 7, 8, or 9' };
  }
  return { isValid: true, cleanMobile: clean };
}

export interface RegistrationPaymentBreakdown {
  isExcluded: boolean;
  isComplimentary: boolean;
  payableFee: number;
  verifiedPaidAmount: number;
  outstandingDue: number;
  effectivePaymentStatus: PaymentStatus;
}

export function getRegistrationPaymentBreakdown(reg: Registration): RegistrationPaymentBreakdown {
  const isRejected = reg.status === 'rejected';
  const isCancelled = reg.paymentStatus === 'cancelled';
  const isRefunded = reg.paymentStatus === 'refunded';
  const isExcluded = isRejected || isCancelled || isRefunded;
  const isComplimentary = reg.status === 'complimentary' || reg.method === 'complimentary';

  const rawFee = Number(reg.fee);
  const sanitizedFee = Number.isFinite(rawFee) ? Math.max(0, Math.round(rawFee)) : 0;
  const payableFee = isExcluded || isComplimentary ? 0 : sanitizedFee;

  let effectivePaymentStatus: PaymentStatus = reg.paymentStatus || (reg.status === 'paid' ? 'paid' : reg.txnId ? 'pending_verification' : 'unpaid');
  if (reg.status === 'paid' && !reg.paymentStatus) {
    effectivePaymentStatus = 'paid';
  }

  let verifiedPaidAmount = 0;
  if (!isExcluded && !isComplimentary) {
    if (effectivePaymentStatus === 'paid' || reg.status === 'paid') {
      verifiedPaidAmount = payableFee;
    } else if (
      typeof reg.paidAmount === 'number' &&
      Number.isFinite(reg.paidAmount) &&
      reg.paidAmount > 0 &&
      effectivePaymentStatus !== 'failed'
    ) {
      verifiedPaidAmount = Math.min(payableFee, Math.max(0, Math.round(reg.paidAmount)));
    }
  }

  const outstandingDue = Math.max(0, payableFee - verifiedPaidAmount);

  return {
    isExcluded,
    isComplimentary,
    payableFee,
    verifiedPaidAmount,
    outstandingDue,
    effectivePaymentStatus,
  };
}

// Registration Summary Analytics (Authoritative Financial & Roster Totals)
export function calculateRegistrationStats(registrations: Registration[]) {
  // Deduplicate strictly by registration ID to prevent double counting
  const uniqueMap = new Map<string, Registration>();
  for (const reg of registrations) {
    if (reg && reg.id) {
      uniqueMap.set(reg.id, reg);
    }
  }
  const uniqueRegs = Array.from(uniqueMap.values());

  const approved = uniqueRegs.filter((r) => r.status === 'approved' || r.status === 'paid');
  const pending = uniqueRegs.filter((r) => r.status === 'pending');
  const rejected = uniqueRegs.filter((r) => r.status === 'rejected');
  const comp = uniqueRegs.filter((r) => r.status === 'complimentary' || r.method === 'complimentary');

  let totalPayableAmount = 0;
  let totalVerifiedAmount = 0;
  let pendingVerificationAmount = 0;
  let pendingVerificationCount = 0;
  let paidCount = 0;
  let unpaidPlayersCount = 0;
  let failedCount = 0;
  let activePayableCount = 0;
  let byUpi = 0;
  let byCash = 0;
  let byBank = 0;

  for (const r of uniqueRegs) {
    const b = getRegistrationPaymentBreakdown(r);

    if (b.effectivePaymentStatus === 'failed' || b.effectivePaymentStatus === 'cancelled' || b.effectivePaymentStatus === 'refunded') {
      failedCount += 1;
    }

    if (b.isExcluded) {
      continue;
    }

    if (!b.isComplimentary) {
      activePayableCount += 1;
      totalPayableAmount += b.payableFee;
      totalVerifiedAmount += b.verifiedPaidAmount;

      if (b.verifiedPaidAmount > 0) {
        if (r.method === 'upi') byUpi += b.verifiedPaidAmount;
        else if (r.method === 'cash') byCash += b.verifiedPaidAmount;
        else if (r.method === 'bank') byBank += b.verifiedPaidAmount;
      }

      if (b.outstandingDue > 0) {
        unpaidPlayersCount += 1;
      } else if (b.payableFee > 0 && b.verifiedPaidAmount >= b.payableFee) {
        paidCount += 1;
      }

      if (
        b.effectivePaymentStatus === 'pending_verification' ||
        (r.txnId && b.effectivePaymentStatus !== 'paid' && b.effectivePaymentStatus !== 'failed')
      ) {
        pendingVerificationCount += 1;
        pendingVerificationAmount += b.outstandingDue;
      }
    }
  }

  // Authoritative equations:
  // Collected Entry Fees = Sum of verified paid amounts only
  // Pending Dues = Total Entry Fees Payable - Collected Entry Fees (never negative)
  const collected = Math.max(0, totalVerifiedAmount);
  const pendingAmount = Math.max(0, totalPayableAmount - collected);

  return {
    total: uniqueRegs.length,
    activePayableCount,
    approvedCount: approved.length,
    paidCount,
    unpaidCount: unpaidPlayersCount,
    unpaidPlayersCount,
    pendingCount: pending.length,
    pendingVerificationCount,
    failedCount,
    rejectedCount: rejected.length,
    compCount: comp.length,
    totalPayableAmount,
    totalVerifiedAmount: collected,
    pendingVerificationAmount,
    collected,
    pendingAmount,
    byUpi,
    byCash,
    byBank,
  };
}

// Currency Formatter
export function formatINR(val: number): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(val);
}

export type UPIAppType = 'generic' | 'gpay' | 'phonepe' | 'paytm';

export interface UPIPaymentDetails {
  upiId: string;
  accountName?: string;
  amount?: number;
  note?: string;
  regId?: string;
}

// Builds exact UPI intent URI for PhonePe, GPay, Paytm, and generic UPI with prefilled money
export function buildUPIPaymentUri(
  details: UPIPaymentDetails,
  app: UPIAppType = 'generic'
): string {
  const { upiId, accountName = 'Smash Premier League', amount, note, regId } = details;
  if (!upiId || !upiId.trim()) return '';

  const cleanUpi = upiId.trim();
  const cleanAccount = (accountName || 'Smash Premier League').trim();
  const cleanNote = note
    ? regId
      ? `${note} - ${regId}`
      : note
    : regId
    ? `Tournament Entry Fee - ${regId}`
    : 'Tournament Entry Fee';

  const params = new URLSearchParams();
  params.set('pa', cleanUpi);
  params.set('pn', cleanAccount);

  if (amount != null && !isNaN(Number(amount)) && Number(amount) > 0) {
    params.set('am', Number(amount).toFixed(2));
  }
  params.set('cu', 'INR');
  if (cleanNote) {
    params.set('tn', cleanNote.slice(0, 45));
  }

  const queryStr = params.toString();

  switch (app) {
    case 'phonepe':
      return `phonepe://pay?${queryStr}`;
    case 'gpay':
      return `gpay://upi/pay?${queryStr}`;
    case 'paytm':
      return `paytmmp://pay?${queryStr}`;
    case 'generic':
    default:
      return `upi://pay?${queryStr}`;
  }
}

// Generates dynamic high-res QR code directly from UPI URI with prefilled amount
export async function generateUPIQRCode(upiUri: string): Promise<string> {
  if (!upiUri || !upiUri.trim()) return '';
  try {
    return await QRCode.toDataURL(upiUri, {
      width: 360,
      margin: 1,
      color: {
        dark: '#020617',
        light: '#ffffff',
      },
      errorCorrectionLevel: 'M',
    });
  } catch (err) {
    console.error('Failed to generate UPI QR code:', err);
    return '';
  }
}

// Legacy helper preserved for backward compatibility
export function buildUPIPaymentLink(
  payment: PaymentSettings | { upiId: string; accountName?: string; note?: string },
  amount: number,
  regId: string
): string {
  return buildUPIPaymentUri(
    {
      upiId: payment.upiId,
      accountName: payment.accountName,
      amount,
      note: payment.note,
      regId,
    },
    'generic'
  );
}

// CSV Export Generator
export function exportRegistrationsToCSV(registrations: Registration[]): string {
  const headers = [
    'Registration ID',
    'Player Name',
    'Mobile',
    'WhatsApp',
    'Age',
    'Gender',
    'Experience Level',
    'Category',
    'Playing Style',
    'City',
    'Application Status',
    'Payment Status',
    'Entry Fee (INR)',
    'Payment Method',
    'Transaction Ref / UTR',
    'Verified By',
    'Verified At',
    'Season',
    'Date Submitted',
  ];

  const escapeCSV = (s: any) => `"${String(s ?? '').replace(/"/g, '""')}"`;

  const rows = registrations.map((r) => [
    escapeCSV(r.regId),
    escapeCSV(r.name),
    escapeCSV(r.mobile),
    escapeCSV(r.whatsapp ?? ''),
    escapeCSV(r.age ?? ''),
    escapeCSV(r.gender),
    escapeCSV(r.experience ?? ''),
    escapeCSV(r.category ?? ''),
    escapeCSV(r.style ?? ''),
    escapeCSV(r.city ?? ''),
    escapeCSV(r.status),
    escapeCSV(r.paymentStatus || (r.status === 'paid' ? 'paid' : r.txnId ? 'pending_verification' : 'unpaid')),
    escapeCSV(r.fee),
    escapeCSV(r.method ?? ''),
    escapeCSV(r.txnId ?? ''),
    escapeCSV(r.verifiedBy ?? ''),
    escapeCSV(r.verifiedAt ? new Date(r.verifiedAt).toLocaleString('en-IN') : ''),
    escapeCSV(r.season ?? ''),
    escapeCSV(new Date(r.createdAt).toLocaleString('en-IN')),
  ]);

  return [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
}

// Download Helper
export function downloadFile(filename: string, content: string, mimeType = 'text/csv;charset=utf-8;') {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
