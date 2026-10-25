import {
  TournamentState,
  Team,
  Match,
  KnockoutMatch,
  StandingsRecord,
  Registration,
  PaymentSettings,
} from '../types/tournament';

export const STORAGE_KEY = 'smash-premier-league-v2';

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
  },
  players: [
    { id: 'p-1', name: 'Vikramaditya Rao', mobile: '9876543210', age: 24, gender: 'M', skillLevel: 'Pro' },
    { id: 'p-2', name: 'Rohan Deshmukh', mobile: '9876543211', age: 26, gender: 'M', skillLevel: 'Advanced' },
    { id: 'p-3', name: 'Ananya Sharma', mobile: '9876543212', age: 22, gender: 'F', skillLevel: 'Pro' },
    { id: 'p-4', name: 'Kabir Patel', mobile: '9876543213', age: 28, gender: 'M', skillLevel: 'Advanced' },
    { id: 'p-5', name: 'Aditya Singhania', mobile: '9876543214', age: 25, gender: 'M', skillLevel: 'Pro' },
    { id: 'p-6', name: 'Pooja Venkatesh', mobile: '9876543215', age: 23, gender: 'F', skillLevel: 'Advanced' },
    { id: 'p-7', name: 'Sameer Joshi', mobile: '9876543216', age: 27, gender: 'M', skillLevel: 'Intermediate' },
    { id: 'p-8', name: 'Farhan Akhtar', mobile: '9876543217', age: 29, gender: 'M', skillLevel: 'Advanced' },
    { id: 'p-9', name: 'Kavita Nair', mobile: '9876543218', age: 21, gender: 'F', skillLevel: 'Pro' },
    { id: 'p-10', name: 'Aryan Mehta', mobile: '9876543219', age: 24, gender: 'M', skillLevel: 'Advanced' },
    { id: 'p-11', name: 'Gaurav Kulkarni', mobile: '9876543220', age: 30, gender: 'M', skillLevel: 'Intermediate' },
    { id: 'p-12', name: 'Devendra Sen', mobile: '9876543221', age: 26, gender: 'M', skillLevel: 'Advanced' },
  ],
  teams: [
    {
      id: 'team-1',
      name: 'Falcon Smasherz',
      players: ['p-1', 'p-2'],
      captainId: 'p-1',
      locked: true,
      avatarColor: 'from-amber-500 to-orange-600',
      badge: '🦅',
    },
    {
      id: 'team-2',
      name: 'Royal Shuttlers',
      players: ['p-3', 'p-4'],
      captainId: 'p-3',
      locked: true,
      avatarColor: 'from-blue-600 to-indigo-700',
      badge: '👑',
    },
    {
      id: 'team-3',
      name: 'Thunder Bolts',
      players: ['p-5', 'p-6'],
      captainId: 'p-5',
      locked: true,
      avatarColor: 'from-emerald-500 to-teal-700',
      badge: '⚡',
    },
    {
      id: 'team-4',
      name: 'Court Titans',
      players: ['p-7', 'p-8'],
      captainId: 'p-8',
      locked: true,
      avatarColor: 'from-rose-500 to-pink-700',
      badge: '🛡️',
    },
    {
      id: 'team-5',
      name: 'Aero Aces',
      players: ['p-9', 'p-10'],
      captainId: 'p-9',
      locked: false,
      avatarColor: 'from-violet-500 to-purple-800',
      badge: '🎯',
    },
    {
      id: 'team-6',
      name: 'Net Ninjas',
      players: ['p-11', 'p-12'],
      captainId: 'p-12',
      locked: false,
      avatarColor: 'from-cyan-500 to-blue-700',
      badge: '🥷',
    },
  ],
  matches: [
    {
      id: 'm-1',
      round: 1,
      court: 1,
      teamA: 'team-1',
      teamB: 'team-2',
      scoreA: 21,
      scoreB: 18,
      status: 'completed',
      winner: 'team-1',
      time: '09:00 AM',
      sets: [{ scoreA: 21, scoreB: 18 }],
    },
    {
      id: 'm-2',
      round: 1,
      court: 2,
      teamA: 'team-3',
      teamB: 'team-4',
      scoreA: 21,
      scoreB: 14,
      status: 'completed',
      winner: 'team-3',
      time: '09:30 AM',
      sets: [{ scoreA: 21, scoreB: 14 }],
    },
    {
      id: 'm-3',
      round: 2,
      court: 1,
      teamA: 'team-5',
      teamB: 'team-6',
      scoreA: 22,
      scoreB: 20,
      status: 'completed',
      winner: 'team-5',
      time: '10:00 AM',
      sets: [{ scoreA: 22, scoreB: 20 }],
    },
    {
      id: 'm-4',
      round: 2,
      court: 2,
      teamA: 'team-1',
      teamB: 'team-3',
      scoreA: 21,
      scoreB: 19,
      status: 'completed',
      winner: 'team-1',
      time: '10:30 AM',
      sets: [{ scoreA: 21, scoreB: 19 }],
    },
    {
      id: 'm-5',
      round: 3,
      court: 1,
      teamA: 'team-2',
      teamB: 'team-5',
      scoreA: 19,
      scoreB: 17,
      status: 'live',
      time: '11:15 AM',
      sets: [{ scoreA: 19, scoreB: 17 }],
    },
    {
      id: 'm-6',
      round: 3,
      court: 2,
      teamA: 'team-4',
      teamB: 'team-6',
      status: 'upcoming',
      time: '12:00 PM',
    },
    {
      id: 'm-7',
      round: 4,
      court: 1,
      teamA: 'team-1',
      teamB: 'team-5',
      status: 'upcoming',
      time: '01:00 PM',
    },
    {
      id: 'm-8',
      round: 4,
      court: 2,
      teamA: 'team-2',
      teamB: 'team-4',
      status: 'upcoming',
      time: '01:45 PM',
    },
  ],
  knockout: {
    format: 'top4',
    matches: [
      {
        id: 'ko-1',
        stage: 'SF',
        slot: 1,
        teamA: 'team-1',
        teamB: 'team-4',
        status: 'upcoming',
      },
      {
        id: 'ko-2',
        stage: 'SF',
        slot: 2,
        teamA: 'team-3',
        teamB: 'team-2',
        status: 'upcoming',
      },
      {
        id: 'ko-3',
        stage: 'F',
        slot: 1,
        status: 'upcoming',
      },
    ],
  },
  registrations: [
    {
      id: 'reg-1',
      playerId: 'p-1',
      regId: 'SPL-2026-001',
      name: 'Vikramaditya Rao',
      mobile: '9876543210',
      age: 24,
      gender: 'M',
      fee: 500,
      status: 'paid',
      method: 'upi',
      txnId: 'UPI-9823487192',
      createdAt: 1774300000000,
      paidAt: 1774300500000,
    },
    {
      id: 'reg-2',
      playerId: 'p-2',
      regId: 'SPL-2026-002',
      name: 'Rohan Deshmukh',
      mobile: '9876543211',
      age: 26,
      gender: 'M',
      fee: 500,
      status: 'paid',
      method: 'cash',
      createdAt: 1774301000000,
      paidAt: 1774301000000,
    },
    {
      id: 'reg-3',
      playerId: 'p-3',
      regId: 'SPL-2026-003',
      name: 'Ananya Sharma',
      mobile: '9876543212',
      age: 22,
      gender: 'F',
      fee: 500,
      status: 'paid',
      method: 'upi',
      txnId: 'UPI-7712398412',
      createdAt: 1774302000000,
      paidAt: 1774302200000,
    },
    {
      id: 'reg-4',
      playerId: 'p-4',
      regId: 'SPL-2026-004',
      name: 'Kabir Patel',
      mobile: '9876543213',
      age: 28,
      gender: 'M',
      fee: 500,
      status: 'paid',
      method: 'bank',
      txnId: 'IMPS-2894719283',
      createdAt: 1774303000000,
      paidAt: 1774303100000,
    },
    {
      id: 'reg-5',
      playerId: 'p-5',
      regId: 'SPL-2026-005',
      name: 'Aditya Singhania',
      mobile: '9876543214',
      age: 25,
      gender: 'M',
      fee: 500,
      status: 'paid',
      method: 'upi',
      txnId: 'UPI-3312984712',
      createdAt: 1774304000000,
      paidAt: 1774304100000,
    },
    {
      id: 'reg-6',
      playerId: 'p-6',
      regId: 'SPL-2026-006',
      name: 'Pooja Venkatesh',
      mobile: '9876543215',
      age: 23,
      gender: 'F',
      fee: 500,
      status: 'complimentary',
      createdAt: 1774305000000,
      paidAt: 1774305000000,
    },
    {
      id: 'reg-7',
      playerId: 'p-7',
      regId: 'SPL-2026-007',
      name: 'Sameer Joshi',
      mobile: '9876543216',
      age: 27,
      gender: 'M',
      fee: 500,
      status: 'pending',
      createdAt: 1774306000000,
    },
  ],
  payment: {
    enabled: true,
    qrImage: '',
    upiId: 'smashleague@icici',
    accountName: 'Smash Premier League Tournament',
    note: 'SPL Entry Fee',
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

// Round Robin Generator
export function generateRoundRobinFixtures(teams: Team[], courtsCount = 2): Match[] {
  const teamList = [...teams];
  if (teamList.length < 2) return [];

  if (teamList.length % 2 === 1) {
    teamList.push({ id: '__BYE__', name: 'BYE', players: [] });
  }

  const n = teamList.length;
  const rounds = n - 1;
  const matchesPerRound = n / 2;
  const teamIds = teamList.map((t) => t.id);
  const result: Match[] = [];

  for (let r = 0; r < rounds; r++) {
    let court = 1;
    for (let m = 0; m < matchesPerRound; m++) {
      const a = teamIds[m];
      const b = teamIds[n - 1 - m];
      if (a !== '__BYE__' && b !== '__BYE__') {
        result.push({
          id: crypto.randomUUID(),
          round: r + 1,
          court: ((court - 1) % courtsCount) + 1,
          teamA: a,
          teamB: b,
          status: 'upcoming',
          time: `Round ${r + 1} · Match ${court}`,
        });
        court++;
      }
    }

    // Rotate: keep first fixed, rotate remaining
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

// Registration Summary Analytics
export function calculateRegistrationStats(registrations: Registration[]) {
  const paid = registrations.filter((r) => r.status === 'paid');
  const pending = registrations.filter((r) => r.status === 'pending');
  const comp = registrations.filter((r) => r.status === 'complimentary');

  const collected = paid.reduce((sum, r) => sum + (r.fee || 0), 0);
  const pendingAmount = pending.reduce((sum, r) => sum + (r.fee || 0), 0);

  const byUpi = paid.filter((r) => r.method === 'upi').reduce((sum, r) => sum + r.fee, 0);
  const byCash = paid.filter((r) => r.method === 'cash').reduce((sum, r) => sum + r.fee, 0);
  const byBank = paid.filter((r) => r.method === 'bank').reduce((sum, r) => sum + r.fee, 0);

  return {
    total: registrations.length,
    paidCount: paid.length,
    pendingCount: pending.length,
    compCount: comp.length,
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

// UPI QR / Link Generator
export function buildUPIPaymentLink(payment: PaymentSettings, amount: number, regId: string): string {
  if (!payment.upiId) return '';
  const params = new URLSearchParams({
    pa: payment.upiId,
    pn: payment.accountName || 'Smash Premier League',
    am: String(amount),
    cu: 'INR',
    tn: `${payment.note || 'Tournament Entry Fee'} - ${regId}`,
  });
  return `upi://pay?${params.toString()}`;
}

// CSV Export Generator
export function exportRegistrationsToCSV(registrations: Registration[]): string {
  const headers = [
    'Registration ID',
    'Player Name',
    'Mobile',
    'Age',
    'Gender',
    'Entry Fee',
    'Payment Status',
    'Payment Method',
    'Transaction ID',
    'Date Registered',
  ];

  const escapeCSV = (s: any) => `"${String(s ?? '').replace(/"/g, '""')}"`;

  const rows = registrations.map((r) => [
    escapeCSV(r.regId),
    escapeCSV(r.name),
    escapeCSV(r.mobile),
    escapeCSV(r.age ?? ''),
    escapeCSV(r.gender),
    escapeCSV(r.fee),
    escapeCSV(r.status),
    escapeCSV(r.method ?? ''),
    escapeCSV(r.txnId ?? ''),
    escapeCSV(new Date(r.createdAt).toLocaleString()),
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
