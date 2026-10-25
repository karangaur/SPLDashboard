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

export interface Registration {
  id: string;
  playerId: string;
  regId: string;
  name: string;
  mobile: string;
  age?: number;
  gender: 'M' | 'F' | 'Other';
  fee: number;
  status: 'paid' | 'pending' | 'complimentary';
  method?: 'cash' | 'upi' | 'bank';
  txnId?: string;
  createdAt: number;
  paidAt?: number;
}

export interface PaymentSettings {
  enabled: boolean;
  qrImage: string;
  upiId: string;
  accountName: string;
  note: string;
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
  players: Player[];
  teams: Team[];
  matches: Match[];
  knockout: KnockoutData;
  registrations: Registration[];
  payment: PaymentSettings;
  predefinedTeams: PredefinedTeam[];
  teamFormationMode: 'random' | 'predefined' | 'mixed';
}
