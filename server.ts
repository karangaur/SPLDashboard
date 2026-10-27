import express from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createServer as createViteServer } from 'vite';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const isVercel = Boolean(process.env.VERCEL || process.env.NOW_REGION);
const ORIGINAL_DATA_DIR = path.join(__dirname, 'data');
const DATA_DIR = isVercel ? path.join('/tmp', 'spl-data') : ORIGINAL_DATA_DIR;

const REGISTRATIONS_FILE = path.join(DATA_DIR, 'registrations.json');
const SETTINGS_FILE = path.join(DATA_DIR, 'registration_settings.json');
const FORMS_FILE = path.join(DATA_DIR, 'registration_forms.json');
const TOKENS_FILE = path.join(DATA_DIR, 'registration_tokens.json');
const AUTH_FILE = path.join(DATA_DIR, 'admin_auth.json');
const TOURNAMENT_FILE = path.join(DATA_DIR, 'tournament_state.json');

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) {
  try {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  } catch (err) {
    console.warn('Could not create data dir:', err);
  }
}

// In Vercel serverless, copy initial seed files from read-only filesystem to /tmp
if (isVercel && fs.existsSync(ORIGINAL_DATA_DIR)) {
  try {
    const files = fs.readdirSync(ORIGINAL_DATA_DIR);
    for (const f of files) {
      const src = path.join(ORIGINAL_DATA_DIR, f);
      const dest = path.join(DATA_DIR, f);
      if (!fs.existsSync(dest) && fs.statSync(src).isFile()) {
        fs.copyFileSync(src, dest);
      }
    }
  } catch (err) {
    console.warn('Could not copy initial files to /tmp:', err);
  }
}

function readJSON<T>(filePath: string, fallback: T): T {
  try {
    if (fs.existsSync(filePath)) {
      const content = fs.readFileSync(filePath, 'utf-8');
      return JSON.parse(content);
    }
  } catch (err) {
    console.error(`Error reading ${filePath}:`, err);
  }
  return fallback;
}

function writeJSON<T>(filePath: string, data: T): void {
  try {
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
  } catch (err) {
    console.error(`Error writing ${filePath}:`, err);
  }
}

function createDefaultForm(seasonSlug = 'season-4') {
  return {
    seasonSlug,
    tournamentName: 'Smash Premier League',
    seasonTitle: 'Season IV (Championship Edition)',
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
      instructions: 'Scan the QR code or tap the UPI button to pay via Google Pay, PhonePe, or Paytm. Submit the 12-digit transaction UTR reference below for verification.',
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
      successMessage: 'Thank you for registering for Smash Premier League. Your details have been received by the tournament committee. Please save your Registration ID.',
    },
    fields: [
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
    ],
  };
}

const DEFAULT_REGISTRATION_SETTINGS = {
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

function cleanIndianMobile(raw: string): { isValid: boolean; cleanMobile: string; error?: string } {
  if (!raw || typeof raw !== 'string') {
    return { isValid: false, cleanMobile: '', error: 'Mobile number is required' };
  }
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
    return { isValid: false, cleanMobile: clean, error: 'Indian mobile number must start with 6, 7, 8, or 9' };
  }
  return { isValid: true, cleanMobile: clean };
}

async function startServer() {
  const app = express();
  const PORT = Number(process.env.PORT) || 3000;
  const isProd = process.env.NODE_ENV === 'production';

  // Increase payload limit to 50MB to support athlete profile photos & rich custom forms
  app.use(express.json({ limit: '50mb' }));
  app.use(express.urlencoded({ limit: '50mb', extended: true }));

  // CORS middleware for multi-domain & Vercel deployments
  app.use((_req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PATCH, DELETE, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
    if (_req.method === 'OPTIONS') {
      return res.sendStatus(200);
    }
    next();
  });

  // 0. Administrator Authentication Endpoints
  const DEFAULT_ADMIN_CONFIG = {
    accounts: [
      {
        id: 'admin-spl-master-01',
        username: 'admin',
        email: 'admin@spl.com',
        name: 'Tournament Director',
        role: 'super_admin',
        // In production apps, passwords or hashes are verified; here we accept master admin passwords
        passwords: ['smash2026', 'admin123', 'spladmin2026'],
      },
    ],
    activeTokens: {} as Record<string, { userId: string; expiresAt: number }>,
  };

  app.post('/api/auth/login', (req, res) => {
    const { identifier, password, rememberMe } = req.body;
    if (!identifier || !password) {
      return res.status(400).json({ success: false, error: 'Identifier and password are required' });
    }

    const cleanId = String(identifier).trim().toLowerCase();
    const cleanPass = String(password).trim();
    const authConfig = readJSON(AUTH_FILE, DEFAULT_ADMIN_CONFIG);

    const account = authConfig.accounts.find(
      (acc: any) =>
        acc.username.toLowerCase() === cleanId ||
        acc.email.toLowerCase() === cleanId ||
        (cleanId === 'organizer' && acc.role === 'super_admin') ||
        (cleanId === 'director' && acc.role === 'super_admin')
    );

    if (!account) {
      return res.status(401).json({
        success: false,
        error: 'Invalid username or email. Please check your credentials or contact the lead organizer.',
      });
    }

    const isMatch = account.passwords.includes(cleanPass);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        error: 'Incorrect password. Passwords are case-sensitive.',
      });
    }

    const token = `spl_sess_${crypto.randomUUID().replace(/-/g, '')}`;
    const expiresAt = rememberMe ? Date.now() + 30 * 24 * 60 * 60 * 1000 : Date.now() + 8 * 60 * 60 * 1000;

    authConfig.activeTokens = authConfig.activeTokens || {};
    authConfig.activeTokens[token] = { userId: account.id, expiresAt };
    writeJSON(AUTH_FILE, authConfig);

    const user = {
      id: account.id,
      username: account.username,
      email: account.email,
      name: account.name,
      role: account.role,
      lastLogin: Date.now(),
    };

    res.json({
      success: true,
      token,
      user,
    });
  });

  app.post('/api/auth/verify', (req, res) => {
    const authHeader = req.headers.authorization;
    const token = req.body?.token || (authHeader ? authHeader.replace(/^Bearer\s+/i, '') : '');

    if (!token) {
      return res.status(401).json({ valid: false, error: 'No token provided' });
    }

    const authConfig = readJSON(AUTH_FILE, DEFAULT_ADMIN_CONFIG);
    const session = authConfig.activeTokens?.[token];

    if (!session || Date.now() > session.expiresAt) {
      return res.status(401).json({ valid: false, error: 'Session expired or invalid' });
    }

    const account = authConfig.accounts.find((a: any) => a.id === session.userId);
    if (!account) {
      return res.status(401).json({ valid: false, error: 'User not found' });
    }

    res.json({
      valid: true,
      user: {
        id: account.id,
        username: account.username,
        email: account.email,
        name: account.name,
        role: account.role,
      },
    });
  });

  app.post('/api/auth/logout', (req, res) => {
    const authHeader = req.headers.authorization;
    const token = req.body?.token || (authHeader ? authHeader.replace(/^Bearer\s+/i, '') : '');

    if (token) {
      const authConfig = readJSON(AUTH_FILE, DEFAULT_ADMIN_CONFIG);
      if (authConfig.activeTokens && authConfig.activeTokens[token]) {
        delete authConfig.activeTokens[token];
        writeJSON(AUTH_FILE, authConfig);
      }
    }
    res.json({ success: true });
  });

  // 1. Get Registration Settings (legacy)
  app.get('/api/registration-settings', (_req, res) => {
    const settings = readJSON(SETTINGS_FILE, DEFAULT_REGISTRATION_SETTINGS);
    res.json(settings);
  });

  // 2. Update Registration Settings (legacy)
  app.post('/api/registration-settings', (req, res) => {
    const current = readJSON(SETTINGS_FILE, DEFAULT_REGISTRATION_SETTINGS);
    const updated = {
      ...current,
      ...req.body,
      fields: {
        ...current.fields,
        ...(req.body.fields || {}),
      },
    };
    writeJSON(SETTINGS_FILE, updated);
    res.json(updated);
  });

  // 3. Dynamic Form Configuration (Drafts & Published)
  app.get('/api/forms/:seasonSlug', (req, res) => {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    let seasonSlug = req.params.seasonSlug;
    if (!seasonSlug || seasonSlug === 'undefined' || seasonSlug.trim() === '') {
      seasonSlug = 'season-4';
    }
    const forms = readJSON<Record<string, any>>(FORMS_FILE, {});
    let targetForm = forms[seasonSlug];
    if (!targetForm) {
      // Fallback to season-4 or the first available form if customized
      if (forms['season-4']) {
        targetForm = { ...forms['season-4'], seasonSlug };
      } else {
        const availableKeys = Object.keys(forms);
        if (availableKeys.length > 0 && forms[availableKeys[0]]) {
          targetForm = { ...forms[availableKeys[0]], seasonSlug };
        } else {
          targetForm = createDefaultForm(seasonSlug);
          forms[seasonSlug] = targetForm;
          writeJSON(FORMS_FILE, forms);
        }
      }
    }
    // Ensure default submit button text matches exact requirement
    if (targetForm && targetForm.appearance) {
      targetForm.appearance.submitButtonText = targetForm.appearance.submitButtonText || 'Submit Registration & Confirm Entry';
    }
    res.json(targetForm);
  });

  app.post('/api/forms/:seasonSlug', (req, res) => {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    let seasonSlug = req.params.seasonSlug;
    if (!seasonSlug || seasonSlug === 'undefined' || seasonSlug.trim() === '') {
      seasonSlug = 'season-4';
    }
    const forms = readJSON<Record<string, any>>(FORMS_FILE, {});
    const existing = forms[seasonSlug] || forms['season-4'] || createDefaultForm(seasonSlug);
    const updated = {
      ...existing,
      ...req.body,
      seasonSlug,
      isPublished: req.body.isPublished !== undefined ? req.body.isPublished : true,
      lastUpdatedAt: Date.now(),
      publishedAt: req.body.isPublished ? Date.now() : (existing.publishedAt || Date.now()),
    };
    if (updated.appearance) {
      updated.appearance.submitButtonText = updated.appearance.submitButtonText || 'Submit Registration & Confirm Entry';
    }
    forms[seasonSlug] = updated;
    // Always mirror to season-4 if season-4 doesn't exist
    if (seasonSlug !== 'season-4' && !forms['season-4']) {
      forms['season-4'] = updated;
    }
    writeJSON(FORMS_FILE, forms);
    res.json(updated);
  });

  // 3.5. Persistent Tournament State & Automatic Live Score Synchronization
  const DEFAULT_TOURNAMENT_PAYLOAD = {
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
    players: [] as any[],
    teams: [] as any[],
    matches: [] as any[],
    knockout: {
      format: 'top4',
      matches: [] as any[],
    },
    predefinedTeams: [] as any[],
    teamFormationMode: 'random',
    lastUpdated: Date.now(),
  };

  app.get('/api/tournament/state', (_req, res) => {
    const data = readJSON<typeof DEFAULT_TOURNAMENT_PAYLOAD>(TOURNAMENT_FILE, DEFAULT_TOURNAMENT_PAYLOAD);
    res.json(data);
  });

  app.post('/api/tournament/state', (req, res) => {
    const current = readJSON<typeof DEFAULT_TOURNAMENT_PAYLOAD>(TOURNAMENT_FILE, DEFAULT_TOURNAMENT_PAYLOAD);
    const now = Date.now();
    const updated = {
      ...current,
      ...req.body,
      lastUpdated: now,
    };
    writeJSON(TOURNAMENT_FILE, updated);
    res.json({ success: true, lastUpdated: now, state: updated });
  });

  // Lightweight rapid score endpoint for live polling without heavy payloads
  // Lightweight rapid score endpoint for live polling without heavy payloads
  app.get('/api/tournament/scores', (_req, res) => {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    const data = readJSON<typeof DEFAULT_TOURNAMENT_PAYLOAD>(TOURNAMENT_FILE, DEFAULT_TOURNAMENT_PAYLOAD);
    res.json({
      matches: data.matches || [],
      teams: data.teams || [],
      knockout: data.knockout || { format: 'top4', matches: [] },
      lastUpdated: data.lastUpdated || Date.now(),
    });
  });

  // Real-time match score update endpoint
  app.patch('/api/tournament/matches/:id', (req, res) => {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    const matchId = req.params.id;
    const current = readJSON<typeof DEFAULT_TOURNAMENT_PAYLOAD>(TOURNAMENT_FILE, DEFAULT_TOURNAMENT_PAYLOAD);
    let matched = false;
    const now = Date.now();

    const updatedMatches = (current.matches || []).map((m: any) => {
      if (m.id === matchId) {
        matched = true;
        const updated = { ...m, ...req.body };
        if (updated.scoreA != null && updated.scoreB != null && updated.status === 'completed') {
          if (updated.scoreA > updated.scoreB) updated.winner = updated.teamA;
          else if (updated.scoreB > updated.scoreA) updated.winner = updated.teamB;
        }
        return updated;
      }
      return m;
    });

    if (matched) {
      current.matches = updatedMatches;
      current.lastUpdated = now;
      writeJSON(TOURNAMENT_FILE, current);
      return res.json({ success: true, lastUpdated: now, match: updatedMatches.find((m: any) => m.id === matchId) });
    }

    // Check knockout matches
    if (current.knockout && Array.isArray(current.knockout.matches)) {
      const updatedKnockout = current.knockout.matches.map((k: any) => {
        if (k.id === matchId) {
          matched = true;
          const updated = { ...k, ...req.body };
          if (updated.scoreA != null && updated.scoreB != null && updated.status === 'completed') {
            if (updated.scoreA > updated.scoreB) updated.winner = updated.teamA;
            else if (updated.scoreB > updated.scoreA) updated.winner = updated.teamB;
          }
          return updated;
        }
        return k;
      });

      if (matched) {
        current.knockout.matches = updatedKnockout;
        current.lastUpdated = now;
        writeJSON(TOURNAMENT_FILE, current);
        return res.json({ success: true, lastUpdated: now, match: updatedKnockout.find((k: any) => k.id === matchId) });
      }
    }

    // Upsert match if created on client or sent with fullMatch details
    const newMatch = req.body.fullMatch || {
      id: matchId,
      ...req.body,
    };
    if (newMatch.scoreA != null && newMatch.scoreB != null && newMatch.status === 'completed') {
      if (newMatch.scoreA > newMatch.scoreB) newMatch.winner = newMatch.teamA;
      else if (newMatch.scoreB > newMatch.scoreA) newMatch.winner = newMatch.teamB;
    }
    current.matches = current.matches || [];
    current.matches.push(newMatch);
    current.lastUpdated = now;
    writeJSON(TOURNAMENT_FILE, current);
    res.json({ success: true, lastUpdated: now, match: newMatch });
  });

  // Bulk captain assignment persistent endpoint
  app.post('/api/tournament/captains', (req, res) => {
    const { assignments } = req.body; // array of { teamId, captainId }
    if (!Array.isArray(assignments)) {
      return res.status(400).json({ error: 'assignments must be an array' });
    }
    const current = readJSON<typeof DEFAULT_TOURNAMENT_PAYLOAD>(TOURNAMENT_FILE, DEFAULT_TOURNAMENT_PAYLOAD);
    const map = new Map(assignments.map((a: any) => [a.teamId, a.captainId]));

    current.teams = (current.teams || []).map((t: any) => {
      if (map.has(t.id)) {
        const newCap = map.get(t.id);
        const players = Array.isArray(t.players) ? [...t.players] : [];
        if (newCap && !players.includes(newCap)) {
          players.unshift(newCap);
        }
        return {
          ...t,
          captainId: newCap,
          players,
        };
      }
      return t;
    });

    current.lastUpdated = Date.now();
    writeJSON(TOURNAMENT_FILE, current);
    res.json({ success: true, teams: current.teams, lastUpdated: current.lastUpdated });
  });

  // 4. Registration Token / Link Management
  app.get('/api/tokens/:seasonSlug', (req, res) => {
    const seasonSlug = req.params.seasonSlug || 'season-4';
    let tokens = readJSON<any[]>(TOKENS_FILE, []);

    // If no tokens exist for this season, create an initial default token
    let seasonTokens = tokens.filter((t) => t.seasonSlug === seasonSlug);
    if (seasonTokens.length === 0) {
      const initialToken = {
        id: crypto.randomUUID(),
        token: `SPL-${seasonSlug.toUpperCase()}-${Math.random().toString(36).substring(2, 7).toUpperCase()}`,
        seasonSlug,
        label: 'Initial Official Link',
        createdAt: Date.now(),
        isActive: true,
        submissionsCount: 0,
      };
      tokens.push(initialToken);
      writeJSON(TOKENS_FILE, tokens);
      seasonTokens = [initialToken];
    }

    const activeToken = seasonTokens.find((t) => t.isActive) || seasonTokens[seasonTokens.length - 1];
    res.json({
      tokens: seasonTokens.sort((a, b) => b.createdAt - a.createdAt),
      activeToken,
    });
  });

  app.post('/api/tokens/regenerate', (req, res) => {
    const { seasonSlug = 'season-4', invalidatePrevious = true, label } = req.body;
    let tokens = readJSON<any[]>(TOKENS_FILE, []);

    const now = Date.now();
    if (invalidatePrevious) {
      tokens = tokens.map((t) => {
        if (t.seasonSlug === seasonSlug && t.isActive) {
          return {
            ...t,
            isActive: false,
            revokedAt: now,
          };
        }
        return t;
      });
    }

    const chars = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
    let rand = '';
    for (let i = 0; i < 6; i++) {
      rand += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    const tokenStr = `SPL-${seasonSlug.replace(/[^a-zA-Z0-9]/g, '').toUpperCase()}-${rand}`;

    const newTokenRecord = {
      id: crypto.randomUUID(),
      token: tokenStr,
      seasonSlug,
      label: label || `Generated ${new Date().toLocaleDateString('en-IN')}`,
      createdAt: now,
      isActive: true,
      submissionsCount: 0,
    };

    tokens.push(newTokenRecord);
    writeJSON(TOKENS_FILE, tokens);

    res.json({
      success: true,
      tokenRecord: newTokenRecord,
      tokens: tokens.filter((t) => t.seasonSlug === seasonSlug).sort((a, b) => b.createdAt - a.createdAt),
    });
  });

  app.post('/api/tokens/:tokenId/toggle-status', (req, res) => {
    const tokenId = req.params.tokenId;
    const tokens = readJSON<any[]>(TOKENS_FILE, []);
    const target = tokens.find((t) => t.id === tokenId);
    if (!target) {
      return res.status(404).json({ error: 'Token not found' });
    }

    target.isActive = !target.isActive;
    if (!target.isActive) {
      target.revokedAt = Date.now();
    } else {
      delete target.revokedAt;
    }
    writeJSON(TOKENS_FILE, tokens);
    res.json({ success: true, token: target });
  });

  // Validate Token Endpoint
  app.get('/api/validate-token/:token', (req, res) => {
    const rawToken = req.params.token;
    const tokens = readJSON<any[]>(TOKENS_FILE, []);
    const match = tokens.find((t) => t.token.toLowerCase() === rawToken.toLowerCase());

    if (!match) {
      // If no token records exist in DB at all, allow as legacy fallback
      if (tokens.length === 0) {
        return res.json({ valid: true, status: 'active', seasonSlug: 'season-4' });
      }
      return res.json({ valid: false, status: 'not_found' });
    }

    if (!match.isActive) {
      return res.json({
        valid: false,
        status: 'revoked',
        seasonSlug: match.seasonSlug,
        revokedAt: match.revokedAt,
      });
    }

    res.json({
      valid: true,
      status: 'active',
      seasonSlug: match.seasonSlug,
      tokenRecord: match,
    });
  });

  // 5. Get All Registrations
  app.get('/api/registrations', (req, res) => {
    const list = readJSON<any[]>(REGISTRATIONS_FILE, []);
    const season = req.query.season as string;
    if (season) {
      res.json(list.filter((r) => r.season === season));
    } else {
      res.json(list);
    }
  });

  // 6. Submit New Registration
  app.post('/api/registrations', (req, res) => {
    const {
      name,
      mobile,
      whatsapp,
      age,
      gender,
      experience,
      category,
      style,
      city,
      notes,
      fee = 500,
      season = 'season-4',
      txnId,
      method = 'upi',
      tokenUsed,
      answers = {},
      photoUrl,
    } = req.body;

    // Validate token if provided
    if (tokenUsed) {
      const tokens = readJSON<any[]>(TOKENS_FILE, []);
      const tokenMatch = tokens.find((t) => t.token.toLowerCase() === String(tokenUsed).trim().toLowerCase());
      if (tokenMatch && !tokenMatch.isActive) {
        return res.status(403).json({
          error: 'This registration link has expired or has been revoked by the tournament organizer. Please obtain the latest link to register.',
          linkRevoked: true,
        });
      }
    }

    // Validate settings & published form
    const forms = readJSON<Record<string, any>>(FORMS_FILE, {});
    const formConfig = forms[season] || createDefaultForm(season);
    if (!formConfig.enabled) {
      return res.status(403).json({
        error: formConfig.closedNotice || 'Registrations are currently closed by the tournament committee.',
      });
    }

    // Name validation
    if (!name || typeof name !== 'string' || name.trim().length < 2) {
      return res.status(400).json({ error: 'Please enter a valid athlete name (at least 2 characters).' });
    }

    // Mobile validation
    const mobileCheck = cleanIndianMobile(mobile);
    if (!mobileCheck.isValid) {
      return res.status(400).json({ error: mobileCheck.error });
    }

    const list = readJSON<any[]>(REGISTRATIONS_FILE, []);

    // Check slot limit
    const seasonRegistrations = list.filter((r) => r.season === season);
    const maxSlots = formConfig.maxSlots ?? 32;
    if (maxSlots && seasonRegistrations.length >= maxSlots) {
      return res.status(400).json({
        error: `Registration limit of ${maxSlots} players has been reached for this tournament.`,
      });
    }

    // Duplicate check on mobile number within the same season
    const isDuplicate = seasonRegistrations.some(
      (r) => r.mobile === mobileCheck.cleanMobile && r.status !== 'rejected'
    );
    if (isDuplicate) {
      return res.status(409).json({
        error: `A registration with mobile number ${mobileCheck.cleanMobile} already exists for this season. Each player may register only once.`,
      });
    }

    // Clean whatsapp if present
    let cleanWhatsApp = undefined;
    if (whatsapp) {
      const waCheck = cleanIndianMobile(whatsapp);
      cleanWhatsApp = waCheck.isValid ? waCheck.cleanMobile : String(whatsapp).trim();
    }

    // Dynamic field answers validation
    if (formConfig.fields && Array.isArray(formConfig.fields)) {
      for (const f of formConfig.fields) {
        if (f.enabled && f.required && !f.isSystem) {
          const val = answers[f.id];
          if (val === undefined || val === null || String(val).trim() === '') {
            return res.status(400).json({
              error: `Please fill in required field: "${f.label}"`,
            });
          }
        }
      }
    }

    // Calculate fee dynamically from server form configuration
    let calculatedFee = formConfig.payment?.baseFee ?? formConfig.entryFee ?? 500;
    const cat = category || answers.category;
    if (cat && formConfig.payment?.categoryFees && formConfig.payment.categoryFees[cat] !== undefined) {
      calculatedFee = Number(formConfig.payment.categoryFees[cat]);
    }

    // Determine payment status - strictly unverified until admin confirmation
    let initialPaymentStatus: 'unpaid' | 'pending' | 'pending_verification' | 'paid' = 'unpaid';
    if (calculatedFee === 0) {
      initialPaymentStatus = 'paid';
    } else if (txnId && String(txnId).trim().length > 0) {
      initialPaymentStatus = 'pending_verification';
    } else if (formConfig.payment?.isMandatory) {
      initialPaymentStatus = 'pending';
    } else {
      initialPaymentStatus = 'unpaid';
    }

    const regId = `SPL-2026-${String(list.length + 1).padStart(3, '0')}`;
    const newReg = {
      id: crypto.randomUUID(),
      regId,
      name: name.trim(),
      mobile: mobileCheck.cleanMobile,
      whatsapp: cleanWhatsApp,
      age: age ? Number(age) : undefined,
      gender: gender || 'M',
      experience: experience || undefined,
      category: cat || undefined,
      style: style || undefined,
      city: city ? String(city).trim() : undefined,
      notes: notes ? String(notes).trim() : undefined,
      fee: calculatedFee,
      status: 'pending',
      paymentStatus: initialPaymentStatus,
      method: method || 'upi',
      txnId: txnId ? String(txnId).trim() : undefined,
      season,
      createdAt: Date.now(),
      paidAt: initialPaymentStatus === 'paid' ? Date.now() : undefined,
      auditLog: [
        {
          action: 'created',
          by: 'Player Submission',
          at: Date.now(),
          toStatus: initialPaymentStatus,
          note: txnId ? `Submitted UPI Ref: ${txnId}` : undefined,
        },
      ],
      answers,
      photoUrl: photoUrl || answers.photo || undefined,
      tokenUsed: tokenUsed || undefined,
    };

    list.push(newReg);
    writeJSON(REGISTRATIONS_FILE, list);

    // Update token submissions count if applicable
    if (tokenUsed) {
      const tokens = readJSON<any[]>(TOKENS_FILE, []);
      const tokenMatch = tokens.find((t) => t.token.toLowerCase() === String(tokenUsed).trim().toLowerCase());
      if (tokenMatch) {
        tokenMatch.submissionsCount = (tokenMatch.submissionsCount || 0) + 1;
        writeJSON(TOKENS_FILE, tokens);
      }
    }

    const successMessage = formConfig.appearance?.successMessage ||
      'Registration submitted successfully! Thank you for registering for Smash Premier League. Your details have been received by the tournament organizer.';

    return res.status(201).json({
      success: true,
      registration: newReg,
      message: successMessage,
    });
  });

  // 6. Verify Payment Endpoint (Admin manual review with audit trail)
  app.post('/api/registrations/:id/verify-payment', (req, res) => {
    const id = req.params.id;
    const { paymentStatus, verifiedBy = 'Tournament Director', note } = req.body;
    const list = readJSON<any[]>(REGISTRATIONS_FILE, []);
    const index = list.findIndex((r) => r.id === id);
    if (index === -1) {
      return res.status(404).json({ error: 'Registration not found' });
    }

    const existing = list[index];
    const prevStatus = existing.paymentStatus || (existing.status === 'paid' ? 'paid' : existing.txnId ? 'pending_verification' : 'unpaid');
    const now = Date.now();

    const auditEntry = {
      action: 'verify_payment',
      by: verifiedBy,
      at: now,
      fromStatus: prevStatus,
      toStatus: paymentStatus,
      note: note || undefined,
    };

    const updated = {
      ...existing,
      paymentStatus,
      verifiedBy,
      verifiedAt: now,
      paidAt: paymentStatus === 'paid' ? existing.paidAt || now : existing.paidAt,
      auditLog: [...(existing.auditLog || []), auditEntry],
    };

    // If payment verified as paid, also auto-update application status to approved if currently pending
    if (paymentStatus === 'paid' && existing.status === 'pending') {
      updated.status = 'approved';
      updated.approvedAt = existing.approvedAt || now;
    }

    list[index] = updated;
    writeJSON(REGISTRATIONS_FILE, list);
    return res.json({ success: true, registration: updated });
  });

  // 5. Update Registration (Approve / Reject / Details)
  app.patch('/api/registrations/:id', (req, res) => {
    const id = req.params.id;
    const list = readJSON<any[]>(REGISTRATIONS_FILE, []);
    const index = list.findIndex((r) => r.id === id);
    if (index === -1) {
      return res.status(404).json({ error: 'Registration not found' });
    }

    const existing = list[index];
    const updated = {
      ...existing,
      ...req.body,
    };

    if (req.body.status === 'approved' && !existing.approvedAt) {
      updated.approvedAt = Date.now();
    }

    list[index] = updated;
    writeJSON(REGISTRATIONS_FILE, list);
    return res.json(updated);
  });

  // 6. Delete Registration
  app.delete('/api/registrations/:id', (req, res) => {
    const id = req.params.id;
    let list = readJSON<any[]>(REGISTRATIONS_FILE, []);
    const beforeCount = list.length;
    list = list.filter((r) => r.id !== id);
    writeJSON(REGISTRATIONS_FILE, list);
    return res.json({ success: true, deleted: beforeCount !== list.length });
  });

  // 7. Bulk Delete Registrations
  app.post('/api/registrations/bulk-delete', (req, res) => {
    const { ids } = req.body;
    if (!Array.isArray(ids)) {
      return res.status(400).json({ error: 'ids must be an array' });
    }
    const idSet = new Set(ids);
    let list = readJSON<any[]>(REGISTRATIONS_FILE, []);
    const countBefore = list.length;
    list = list.filter((r) => !idSet.has(r.id));
    writeJSON(REGISTRATIONS_FILE, list);
    return res.json({ success: true, count: countBefore - list.length });
  });

  // 8. Bulk Approve Registrations
  app.post('/api/registrations/bulk-approve', (req, res) => {
    const { ids } = req.body;
    if (!Array.isArray(ids)) {
      return res.status(400).json({ error: 'ids must be an array' });
    }
    const idSet = new Set(ids);
    let list = readJSON<any[]>(REGISTRATIONS_FILE, []);
    const now = Date.now();
    let approvedCount = 0;

    list = list.map((r) => {
      if (idSet.has(r.id)) {
        approvedCount++;
        return {
          ...r,
          status: 'approved',
          approvedAt: r.approvedAt || now,
        };
      }
      return r;
    });

    writeJSON(REGISTRATIONS_FILE, list);
    return res.json({ success: true, approvedCount });
  });

  // Dedicated JSON error handling middleware
  app.use((err: any, _req: express.Request, res: express.Response, next: express.NextFunction) => {
    if (err && (err.type === 'entity.too.large' || err.status === 413)) {
      return res.status(413).json({
        error: 'Uploaded data or image exceeds payload limit (50MB). Please select a smaller photo.',
        type: 'PayloadTooLargeError',
      });
    }
    if (err) {
      return res.status(err.status || 500).json({
        error: err.message || 'Internal Server Error',
      });
    }
    next();
  });

  // In development, mount Vite middleware
  if (!isProd) {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.join(__dirname, 'dist')));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(__dirname, 'dist', 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`SPL Server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer();
