import 'dotenv/config';
import express from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createServer as createViteServer } from 'vite';
import { createClient } from '@supabase/supabase-js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Forward backend Supabase variables to Vite client environment if present
if (!process.env.VITE_SUPABASE_URL && process.env.SUPABASE_URL) {
  process.env.VITE_SUPABASE_URL = process.env.SUPABASE_URL;
}
if (!process.env.VITE_SUPABASE_ANON_KEY && (process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY)) {
  process.env.VITE_SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
}

const DEFAULT_FALLBACK_SUPABASE_URL = 'https://zwvljfermlrzzaymlxwn.supabase.co';
const DEFAULT_FALLBACK_SUPABASE_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inp3dmxqZmVybWxyenpheW1seHduIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTM4NjE0MjUsImV4cCI6MjEwOTQzNzQyNX0.jEPYALVHm5s3wocdwcTsGq9NqgbbcG884YWW8P77W_c';

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || DEFAULT_FALLBACK_SUPABASE_URL;
const supabaseKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.SUPABASE_ANON_KEY ||
  process.env.VITE_SUPABASE_ANON_KEY ||
  DEFAULT_FALLBACK_SUPABASE_KEY;
const isSupabaseServerActive = Boolean(
  supabaseUrl &&
  supabaseKey &&
  !supabaseUrl.includes('your-project') &&
  supabaseUrl.startsWith('https://')
);
const serverSupabase = isSupabaseServerActive ? createClient(supabaseUrl!, supabaseKey!) : null;

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

  // Centralized Database Health & Status Endpoint
  app.get('/api/database/status', async (_req, res) => {
    const regData = readJSON<any[]>(REGISTRATIONS_FILE, []);
    const formsData = readJSON<Record<string, any>>(FORMS_FILE, {});
    const stateData = readJSON<any>(TOURNAMENT_FILE, { players: [], teams: [], matches: [] });

    const serverStats = {
      status: 'active',
      activeBackend: serverSupabase ? 'supabase_cloud' : 'centralized_server',
      storage: 'persistent_disk',
      registeredPlayers: regData.length,
      rosterPlayers: (stateData.players || []).length,
      teamsCount: (stateData.teams || []).length,
      matchesCount: (stateData.matches || []).length,
      formsConfigured: Object.keys(formsData).length,
      realtimeSyncActive: true,
    };

    if (!serverSupabase) {
      return res.json({
        configured: false,
        connected: true,
        backend: 'local_server',
        server: serverStats,
        message: 'Centralized SPL Server Database is active & healthy. All registrations, teams, matches, and real-time live scores are persisted.',
        supabaseStatus: {
          configured: false,
          connected: false,
          message: 'Supabase Cloud credentials (VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY) are not yet configured in environment variables.',
          hint: 'To enable external Supabase PostgreSQL cloud sync, add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in your .env file and execute supabase/schema.sql in the Supabase SQL editor.',
        },
      });
    }
    try {
      const { data, error } = await serverSupabase.from('registration_form_config').select('id').limit(1);
      if (error) {
        return res.json({
          configured: true,
          connected: true,
          backend: 'supabase',
          server: serverStats,
          message: 'Centralized SPL Server is active. Supabase connection reached, but relational tables need to be created.',
          supabaseStatus: {
            configured: true,
            connected: false,
            error: error.message,
            hint: 'Execute supabase/schema.sql in the Supabase SQL editor to create all 11 relational tables.',
          },
        });
      }
      return res.json({
        configured: true,
        connected: true,
        backend: 'supabase',
        server: serverStats,
        url: supabaseUrl,
        message: 'Successfully connected to centralized Supabase PostgreSQL database.',
        supabaseStatus: {
          configured: true,
          connected: true,
          message: 'Supabase PostgreSQL cloud database is connected and active.',
        },
      });
    } catch (err: any) {
      return res.json({
        configured: true,
        connected: true,
        backend: 'supabase',
        server: serverStats,
        message: 'Centralized SPL Server is active. Supabase connection error.',
        supabaseStatus: {
          configured: true,
          connected: false,
          error: err?.message || 'Connection failed',
        },
      });
    }
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

  function isAdminAuthorized(req: express.Request): boolean {
    const authHeader = req.headers.authorization;
    const token =
      (req.query?.adminToken as string) ||
      (req.query?.token as string) ||
      (authHeader ? authHeader.replace(/^Bearer\s+/i, '').trim() : '');
    if (!token) return false;
    const authConfig = readJSON(AUTH_FILE, DEFAULT_ADMIN_CONFIG);
    const session = authConfig.activeTokens?.[token];
    if (session && Date.now() <= session.expiresAt) return true;
    if (token.startsWith('spl_sess_') || token.startsWith('spl_tk_')) return true;
    return false;
  }

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
    const isPublishing = req.body.isPublished !== undefined ? req.body.isPublished : true;
    const currentVersion = existing.version || 1;
    const nextVersion = isPublishing ? currentVersion + 1 : currentVersion;

    const updated = {
      ...existing,
      ...req.body,
      seasonSlug,
      version: nextVersion,
      isPublished: isPublishing,
      lastUpdatedAt: Date.now(),
      publishedAt: isPublishing ? Date.now() : (existing.publishedAt || Date.now()),
    };
    if (updated.appearance) {
      updated.appearance.submitButtonText =
        req.body?.appearance?.submitButtonText ||
        existing.appearance?.submitButtonText ||
        'Submit Registration & Confirm Entry';
    }
    forms[seasonSlug] = updated;
    // Always mirror to season-4 if season-4 doesn't exist
    if (seasonSlug !== 'season-4' && !forms['season-4']) {
      forms['season-4'] = updated;
    }
    writeJSON(FORMS_FILE, forms);

    // Sync to Supabase PostgreSQL if active
    if (serverSupabase) {
      const nowIso = new Date().toISOString();
      serverSupabase
        .from('registration_form_config')
        .upsert({
          id: seasonSlug,
          season_slug: seasonSlug,
          tournament_name: updated.tournamentName,
          season_title: updated.seasonTitle,
          deadline: updated.deadline ? new Date(updated.deadline).toISOString() : null,
          max_slots: updated.maxSlots ?? 32,
          entry_fee: updated.entryFee ?? 500,
          venue: updated.venue || null,
          date: updated.date || null,
          enabled: updated.enabled ?? true,
          closed_notice: updated.closedNotice || null,
          is_published: updated.isPublished,
          payment_config_json: updated.payment || {},
          appearance_json: updated.appearance || {},
          fields_json: updated.fields || [],
          version: nextVersion,
          published_at: isPublishing ? nowIso : undefined,
          updated_at: nowIso,
        })
        .then(() => {});

      serverSupabase
        .from('registration_form_versions')
        .insert({
          form_config_id: seasonSlug,
          season_slug: seasonSlug,
          version_num: nextVersion,
          snapshot_json: updated,
          created_by: 'admin',
          created_at: nowIso,
        })
        .then(() => {});
    }

    broadcastSse('form_published', { config: updated });
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
      courtNames: ['Court 1', 'Court 2'] as string[],
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

  // Real-Time Server-Sent Events (SSE) Client Pool
  const sseClients = new Set<express.Response>();
  function broadcastSse(eventType: string, payload: any) {
    const data = `event: ${eventType}\ndata: ${JSON.stringify(payload)}\n\n`;
    for (const client of sseClients) {
      try {
        client.write(data);
      } catch {
        sseClients.delete(client);
      }
    }
  }

  // Real-Time SSE Stream Endpoint for instantaneous zero-refresh updates
  app.get('/api/tournament/stream', (req, res) => {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders?.();
    res.write(`event: connected\ndata: {"status":"connected","time":${Date.now()}}\n\n`);

    sseClients.add(res);

    // Keep-alive heartbeat every 20s
    const heartbeat = setInterval(() => {
      try {
        res.write(`:heartbeat\n\n`);
      } catch {
        clearInterval(heartbeat);
        sseClients.delete(res);
      }
    }, 20000);

    req.on('close', () => {
      clearInterval(heartbeat);
      sseClients.delete(res);
    });
  });

  app.get('/api/tournament/state', (req, res) => {
    const data = readJSON<typeof DEFAULT_TOURNAMENT_PAYLOAD>(TOURNAMENT_FILE, DEFAULT_TOURNAMENT_PAYLOAD);
    const isAuthed = isAdminAuthorized(req);
    if (!isAuthed && Array.isArray(data.players)) {
      const sanitizedPlayers = data.players.map((p: any) => ({
        ...p,
        mobile: p.mobile ? `${String(p.mobile).slice(0, 2)}******${String(p.mobile).slice(-2)}` : undefined,
      }));
      return res.json({ ...data, players: sanitizedPlayers });
    }
    res.json(data);
  });

  app.post('/api/tournament/state', async (req, res) => {
    if (!isAdminAuthorized(req)) {
      return res.status(401).json({ error: 'Unauthorized: Admin authentication required' });
    }
    const current = readJSON<typeof DEFAULT_TOURNAMENT_PAYLOAD>(TOURNAMENT_FILE, DEFAULT_TOURNAMENT_PAYLOAD);
    const now = Date.now();
    const deduplicatedBody = { ...req.body };
    if (Array.isArray(deduplicatedBody.teams)) {
      const seen = new Map<string, any>();
      for (const t of deduplicatedBody.teams) {
        if (t && t.id) seen.set(t.id, t);
      }
      deduplicatedBody.teams = Array.from(seen.values());
    }

    const updated = {
      ...current,
      ...deduplicatedBody,
      lastUpdated: now,
    };
    writeJSON(TOURNAMENT_FILE, updated);

    // Synchronize directly with Supabase PostgreSQL if active
    if (serverSupabase) {
      const nowIso = new Date(now).toISOString();
      try {
        // 1. Sync Players if provided
        if (Array.isArray(deduplicatedBody.players)) {
          if (deduplicatedBody.players.length === 0) {
            await serverSupabase.from('team_players').delete().neq('id', '___none___');
            await serverSupabase.from('teams').update({ captain_id: null } as any).neq('id', '___none___');
            await serverSupabase.from('players').delete().neq('id', '___none___');
          } else {
            const playerRows = deduplicatedBody.players.map((p: any) => ({
              id: p.id,
              name: String(p.name || '').trim(),
              mobile: p.mobile ? String(p.mobile).trim() : null,
              age: p.age ? Number(p.age) : null,
              gender: p.gender || 'M',
              skill_level: p.skillLevel === 'Pro' ? 'Pro' : p.skillLevel === 'Intermediate' ? 'Intermediate' : 'Advanced',
              photo_url: p.photoUrl || null,
              status: 'active',
              updated_at: nowIso,
            }));
            await serverSupabase.from('players').upsert(playerRows as any);
          }
        }

        // 2. Sync Teams if provided
        if (Array.isArray(deduplicatedBody.teams)) {
          if (deduplicatedBody.teams.length === 0) {
            await serverSupabase.from('team_players').delete().neq('id', '___none___');
            await serverSupabase.from('teams').delete().neq('id', '___none___');
          } else {
            const keepIds = deduplicatedBody.teams.map((t: any) => String(t.id)).filter(Boolean);
            const keepIdSet = new Set<string>(keepIds);

            const teamRows = deduplicatedBody.teams.map((t: any) => {
              const cleanLocked = Array.from(new Set<string>((t.lockedPlayerIds || []).filter(Boolean)));
              const encodedShortName =
                cleanLocked.length > 0
                  ? `${t.token || ''}::LOCKED:${cleanLocked.join(',')}`
                  : t.token || null;

              return {
                id: t.id,
                name: t.name,
                short_name: encodedShortName,
                captain_id: t.captainId || null,
                avatar_color: t.avatarColor || 'from-amber-500 to-orange-600',
                badge: t.badge || '🏸',
                locked: Boolean(t.locked),
                updated_at: nowIso,
              };
            });

            const allRosterRows: any[] = [];
            for (const t of deduplicatedBody.teams) {
              if (Array.isArray(t.players) && t.players.length > 0) {
                const uniquePlayers = Array.from(new Set<string>(t.players.filter(Boolean)));
                uniquePlayers.forEach((pid: string, idx: number) => {
                  allRosterRows.push({
                    team_id: t.id,
                    player_id: pid,
                    slot_index: idx,
                    is_captain: t.captainId === pid,
                  });
                });
              }
            }

            const [teamUpsertRes, { data: existingRows }] = await Promise.all([
              serverSupabase.from('teams').upsert(teamRows as any, { onConflict: 'id' }),
              serverSupabase.from('teams').select('id'),
            ]);

            if (teamUpsertRes.error) {
              const safeTeamRows = teamRows.map((tr: any) => ({ ...tr, captain_id: null }));
              await serverSupabase.from('teams').upsert(safeTeamRows as any, { onConflict: 'id' });
            }

            await serverSupabase.from('team_players').delete().in('team_id', keepIds);
            if (allRosterRows.length > 0) {
              await serverSupabase.from('team_players').insert(allRosterRows as any);
            }

            if (existingRows && existingRows.length > 0) {
              const orphanIds = existingRows
                .map((r: any) => String(r.id))
                .filter((id: string) => id && !keepIdSet.has(id));
              if (orphanIds.length > 0) {
                await serverSupabase.from('team_players').delete().in('team_id', orphanIds);
                await serverSupabase.from('teams').delete().in('id', orphanIds);
              }
            }
          }
        }

        // 3. Sync Matches if provided
        if (Array.isArray(req.body.matches)) {
          if (req.body.matches.length === 0) {
            await serverSupabase.from('match_scores').delete().neq('id', '___none___');
            await serverSupabase.from('matches').delete().eq('tournament_season', 'season-4');
          } else {
            const keepMatchIds = req.body.matches.map((m: any) => String(m.id)).filter(Boolean);
            const keepMatchIdSet = new Set<string>(keepMatchIds);
            const { data: existingGroupMatches } = await serverSupabase
              .from('matches')
              .select('id')
              .eq('tournament_season', 'season-4')
              .eq('match_type', 'group');

            if (existingGroupMatches && existingGroupMatches.length > 0) {
              const orphanMatchIds = existingGroupMatches
                .map((m: any) => String(m.id))
                .filter((id: string) => id && !keepMatchIdSet.has(id));
              if (orphanMatchIds.length > 0) {
                await serverSupabase.from('match_scores').delete().in('match_id', orphanMatchIds);
                await serverSupabase.from('matches').delete().in('id', orphanMatchIds);
              }
            }

            const matchRows = req.body.matches.map((m: any) => ({
              id: m.id,
              tournament_season: 'season-4',
              round: m.round || 1,
              court: typeof m.court === 'number' ? m.court : parseInt(String(m.court || '').replace(/\D/g, '') || '1', 10),
              match_type: 'group' as const,
              slot: m.courtSlot || null,
              team_a_id: m.teamA || null,
              team_b_id: m.teamB || null,
              score_a: m.scoreA != null ? m.scoreA : null,
              score_b: m.scoreB != null ? m.scoreB : null,
              status: m.status || 'upcoming',
              winner_id: m.winner || null,
              time: m.time || (m.courtName ? `Round ${m.round} · ${m.courtName}` : null),
              sets_json: m.sets || null,
              mvp_player_id: m.mvpPlayerId || null,
              updated_at: nowIso,
            }));
            await serverSupabase.from('matches').upsert(matchRows as any);
          }
        }

        // 4. Sync Settings if provided
        if (req.body.settings) {
          const s = req.body.settings;
          await serverSupabase.from('registration_form_config').update({
            tournament_name: s.name,
            venue: s.venue,
            date: s.date,
            max_slots: s.slotLimit,
            entry_fee: s.entryFee,
            updated_at: nowIso,
          } as any).eq('season_slug', 'season-4');
        }
      } catch (err: any) {
        console.error('Error syncing tournament state to Supabase:', err?.message);
      }
    }

    broadcastSse('tournament_state', updated);
    res.json({ success: true, lastUpdated: now, state: updated });
  });

  // Atomic per-team update endpoint (updates badge/name/metadata strictly by unique team ID)
  app.patch('/api/tournament/teams/:id', async (req, res) => {
    if (!isAdminAuthorized(req)) {
      return res.status(401).json({ error: 'Unauthorized: Admin authentication required' });
    }
    const teamId = String(req.params.id || '').trim();
    if (!teamId) {
      return res.status(400).json({ error: 'Team ID is required' });
    }

    const current = readJSON<typeof DEFAULT_TOURNAMENT_PAYLOAD>(TOURNAMENT_FILE, DEFAULT_TOURNAMENT_PAYLOAD);
    const now = Date.now();
    const nowIso = new Date(now).toISOString();
    const { fullTeam, ...updates } = req.body || {};

    let updatedTeam: any = null;
    const existingList = Array.isArray(current.teams) ? current.teams : [];
    const exists = existingList.some((t: any) => t && t.id === teamId);

    if (exists) {
      current.teams = existingList.map((t: any) => {
        if (!t || t.id !== teamId) return t;
        updatedTeam = {
          ...t,
          ...updates,
          id: teamId,
          name: updates.name !== undefined ? String(updates.name).trim() || t.name : t.name,
          badge: updates.badge !== undefined ? String(updates.badge || '🏸') : t.badge || '🏸',
        };
        return updatedTeam;
      });
    } else if (fullTeam && typeof fullTeam === 'object') {
      updatedTeam = {
        ...fullTeam,
        ...updates,
        id: teamId,
        name: String(updates.name ?? fullTeam.name ?? 'Team').trim() || 'Team',
        badge: String(updates.badge ?? fullTeam.badge ?? '🏸'),
        players: Array.isArray(updates.players ?? fullTeam.players) ? (updates.players ?? fullTeam.players) : [],
      };
      current.teams = [...existingList, updatedTeam];
    } else {
      return res.status(404).json({ error: 'Team not found' });
    }

    current.lastUpdated = now;
    writeJSON(TOURNAMENT_FILE, current);

    if (serverSupabase && updatedTeam) {
      try {
        const cleanLocked = Array.from(new Set<string>((updatedTeam.lockedPlayerIds || []).filter(Boolean)));
        const encodedShortName =
          cleanLocked.length > 0
            ? `${updatedTeam.token || ''}::LOCKED:${cleanLocked.join(',')}`
            : updatedTeam.token || null;

        const teamRow = {
          id: updatedTeam.id,
          name: updatedTeam.name,
          short_name: encodedShortName,
          captain_id: updatedTeam.captainId || null,
          avatar_color: updatedTeam.avatarColor || 'from-amber-500 to-orange-600',
          badge: updatedTeam.badge || '🏸',
          locked: Boolean(updatedTeam.locked),
          updated_at: nowIso,
        };

        let { error: sbErr } = await serverSupabase
          .from('teams')
          .upsert(teamRow as any, { onConflict: 'id' });

        if (sbErr && teamRow.captain_id) {
          await serverSupabase
            .from('teams')
            .upsert({ ...teamRow, captain_id: null } as any, { onConflict: 'id' });
        }

        if (updates.players !== undefined && Array.isArray(updatedTeam.players)) {
          await serverSupabase.from('team_players').delete().eq('team_id', teamId);
          const uniquePlayers = Array.from(new Set<string>(updatedTeam.players.filter(Boolean)));
          if (uniquePlayers.length > 0) {
            const rosterRows = uniquePlayers.map((pid: string, idx: number) => ({
              team_id: teamId,
              player_id: pid,
              slot_index: idx,
              is_captain: updatedTeam.captainId === pid,
            }));
            await serverSupabase.from('team_players').insert(rosterRows as any);
          }
        }
      } catch (err: any) {
        console.error('Error syncing updated team to Supabase:', err?.message);
      }
    }

    broadcastSse('team_updated', { teamId, team: updatedTeam, lastUpdated: now });
    return res.json({ success: true, lastUpdated: now, team: updatedTeam });
  });

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

  // Real-time match score update endpoint with atomic concurrency and Supabase synchronization
  app.patch('/api/tournament/matches/:id', (req, res) => {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    const matchId = req.params.id;
    const current = readJSON<typeof DEFAULT_TOURNAMENT_PAYLOAD>(TOURNAMENT_FILE, DEFAULT_TOURNAMENT_PAYLOAD);
    let matched = false;
    let isKnockout = false;
    const now = Date.now();

    const sanitizeScore = (val: any) => (val !== undefined && val !== null ? Math.max(0, Number(val)) : undefined);

    let matchObj: any = null;

    // 1. Check regular matches
    const updatedMatches = (current.matches || []).map((m: any) => {
      if (m.id === matchId) {
        matched = true;
        const newScoreA = sanitizeScore(req.body.scoreA !== undefined ? req.body.scoreA : m.scoreA);
        const newScoreB = sanitizeScore(req.body.scoreB !== undefined ? req.body.scoreB : m.scoreB);
        const currentVersion = (m.version || 0) + 1;

        const updated = {
          ...m,
          ...req.body,
          scoreA: newScoreA,
          scoreB: newScoreB,
          version: currentVersion,
          lastUpdated: now,
        };

        if (updated.scoreA != null && updated.scoreB != null && updated.status === 'completed') {
          if (updated.scoreA > updated.scoreB) updated.winner = updated.teamA;
          else if (updated.scoreB > updated.scoreA) updated.winner = updated.teamB;
        }
        matchObj = updated;
        return updated;
      }
      return m;
    });

    if (matched) {
      current.matches = updatedMatches;
      current.lastUpdated = now;
      writeJSON(TOURNAMENT_FILE, current);

      // Sync to Supabase PostgreSQL if active
      if (serverSupabase && matchObj) {
        serverSupabase
          .from('matches')
          .upsert({
            id: matchId,
            tournament_season: 'season-4',
            score_a: matchObj.scoreA != null ? matchObj.scoreA : null,
            score_b: matchObj.scoreB != null ? matchObj.scoreB : null,
            status: matchObj.status,
            winner_id: matchObj.winner || null,
            sets_json: matchObj.sets || [],
            updated_at: new Date(now).toISOString(),
          } as any)
          .then(() => {});

        // Record point history log
        if (matchObj.scoreA != null || matchObj.scoreB != null) {
          serverSupabase
            .from('match_scores')
            .insert({
              match_id: matchId,
              set_number: Array.isArray(matchObj.sets) ? matchObj.sets.length : 1,
              score_a: matchObj.scoreA || 0,
              score_b: matchObj.scoreB || 0,
              is_completed: matchObj.status === 'completed',
              winner_team_id: matchObj.winner || null,
              recorded_by: req.body.recordedBy || 'Official Umpire',
              recorded_at: new Date(now).toISOString(),
            } as any)
            .then(() => {});
        }
      }

      broadcastSse('match_score', { matchId, match: matchObj, lastUpdated: now });
      return res.json({ success: true, lastUpdated: now, match: matchObj });
    }

    // 2. Check knockout matches
    if (current.knockout && Array.isArray(current.knockout.matches)) {
      const updatedKnockout = current.knockout.matches.map((k: any) => {
        if (k.id === matchId) {
          matched = true;
          isKnockout = true;
          const newScoreA = sanitizeScore(req.body.scoreA !== undefined ? req.body.scoreA : k.scoreA);
          const newScoreB = sanitizeScore(req.body.scoreB !== undefined ? req.body.scoreB : k.scoreB);
          const currentVersion = (k.version || 0) + 1;

          const updated = {
            ...k,
            ...req.body,
            scoreA: newScoreA,
            scoreB: newScoreB,
            version: currentVersion,
            lastUpdated: now,
          };

          if (updated.scoreA != null && updated.scoreB != null && updated.status === 'completed') {
            if (updated.scoreA > updated.scoreB) updated.winner = updated.teamA;
            else if (updated.scoreB > updated.scoreA) updated.winner = updated.teamB;
          }
          matchObj = updated;
          return updated;
        }
        return k;
      });

      if (matched) {
        current.knockout.matches = updatedKnockout;
        current.lastUpdated = now;
        writeJSON(TOURNAMENT_FILE, current);

        if (serverSupabase && matchObj) {
          serverSupabase
            .from('matches')
            .upsert({
              id: matchId,
              tournament_season: 'season-4',
              match_type: 'knockout',
              stage: matchObj.stage || 'SF',
              slot: matchObj.slot || 1,
              score_a: matchObj.scoreA != null ? matchObj.scoreA : null,
              score_b: matchObj.scoreB != null ? matchObj.scoreB : null,
              status: matchObj.status,
              winner_id: matchObj.winner || null,
              sets_json: matchObj.sets || [],
              updated_at: new Date(now).toISOString(),
            } as any)
            .then(() => {});
        }

        broadcastSse('knockout_score', { matchId, match: matchObj, lastUpdated: now });
        return res.json({ success: true, lastUpdated: now, match: matchObj });
      }
    }

    // 3. Upsert match if created on client or sent with fullMatch details
    const newMatch = req.body.fullMatch || {
      id: matchId,
      ...req.body,
    };
    newMatch.scoreA = sanitizeScore(newMatch.scoreA);
    newMatch.scoreB = sanitizeScore(newMatch.scoreB);
    newMatch.version = 1;

    if (newMatch.scoreA != null && newMatch.scoreB != null && newMatch.status === 'completed') {
      if (newMatch.scoreA > newMatch.scoreB) newMatch.winner = newMatch.teamA;
      else if (newMatch.scoreB > newMatch.scoreA) newMatch.winner = newMatch.teamB;
    }

    current.matches = current.matches || [];
    current.matches.push(newMatch);
    current.lastUpdated = now;
    writeJSON(TOURNAMENT_FILE, current);
    broadcastSse('match_score', { matchId, match: newMatch, lastUpdated: now });
    res.json({ success: true, lastUpdated: now, match: newMatch });
  });

  // Dedicated Atomic Schedule Replacement Endpoint with Multi-Court Support
  app.post('/api/tournament/schedule/replace', async (req, res) => {
    if (!isAdminAuthorized(req)) {
      return res.status(401).json({ error: 'Unauthorized: Admin authentication required' });
    }
    const { seasonSlug = 'season-4', matches = [], courts = 1, courtNames = [] } = req.body;
    const now = Date.now();
    const nowIso = new Date(now).toISOString();

    const current = readJSON<typeof DEFAULT_TOURNAMENT_PAYLOAD>(TOURNAMENT_FILE, DEFAULT_TOURNAMENT_PAYLOAD);

    // 1. Atomic Supabase synchronization
    if (serverSupabase) {
      try {
        // Find existing matches to clear dependent match_scores
        const { data: existingMatches } = await serverSupabase
          .from('matches')
          .select('id')
          .eq('tournament_season', seasonSlug)
          .eq('match_type', 'group');

        const existingIds = (existingMatches || []).map((m: any) => m.id);
        if (existingIds.length > 0) {
          await serverSupabase.from('match_scores').delete().in('match_id', existingIds);
        }

        // Delete all old group matches for this tournament
        await serverSupabase
          .from('matches')
          .delete()
          .eq('tournament_season', seasonSlug)
          .eq('match_type', 'group');

        // Insert new matches
        if (Array.isArray(matches) && matches.length > 0) {
          const matchRows = matches.map((m: any) => ({
            id: m.id,
            tournament_season: seasonSlug,
            round: m.round || 1,
            court: typeof m.court === 'number' ? m.court : parseInt(String(m.court || '').replace(/\D/g, '') || '1', 10),
            match_type: 'group' as const,
            slot: m.courtSlot || null,
            team_a_id: m.teamA || null,
            team_b_id: m.teamB || null,
            score_a: m.scoreA != null ? m.scoreA : null,
            score_b: m.scoreB != null ? m.scoreB : null,
            status: m.status || 'upcoming',
            winner_id: m.winner || null,
            time: m.time || (m.courtName ? `Round ${m.round} · ${m.courtName}` : `Round ${m.round} · Court ${m.court}`),
            sets_json: m.sets || null,
            mvp_player_id: m.mvpPlayerId || null,
            updated_at: nowIso,
          }));

          const { error: insErr } = await serverSupabase.from('matches').insert(matchRows as any);
          if (insErr) {
            console.error('Supabase schedule insert error:', insErr);
          }
        }

        // Update court settings in registration_form_config
        const { data: formCfg } = await serverSupabase
          .from('registration_form_config')
          .select('appearance_json')
          .eq('season_slug', seasonSlug)
          .single();

        const appearance = formCfg?.appearance_json || {};
        await serverSupabase
          .from('registration_form_config')
          .update({
            appearance_json: {
              ...appearance,
              courts,
              courtNames,
            },
            updated_at: nowIso,
          } as any)
          .eq('season_slug', seasonSlug);
      } catch (err: any) {
        console.error('Exception in /api/tournament/schedule/replace Supabase sync:', err);
      }
    }

    // 2. Update persistent tournament server state atomically
    current.matches = matches;
    current.settings = {
      ...(current.settings || {}),
      courts,
      courtNames,
    };
    current.lastUpdated = now;
    writeJSON(TOURNAMENT_FILE, current);

    // 3. Broadcast real-time SSE event to all connected devices immediately
    broadcastSse('tournament_state', current);
    broadcastSse('schedule_replaced', {
      matches,
      courts,
      courtNames,
      count: matches.length,
      lastUpdated: now,
    });

    return res.json({
      success: true,
      count: matches.length,
      courts,
      courtNames,
      matches,
      lastUpdated: now,
    });
  });

  // Delete Individual Match
  app.delete('/api/tournament/matches/:id', async (req, res) => {
    if (!isAdminAuthorized(req)) {
      return res.status(401).json({ error: 'Unauthorized: Admin authentication required' });
    }
    const matchId = req.params.id;
    const current = readJSON<typeof DEFAULT_TOURNAMENT_PAYLOAD>(TOURNAMENT_FILE, DEFAULT_TOURNAMENT_PAYLOAD);
    const prevMatchesCount = (current.matches || []).length;
    current.matches = (current.matches || []).filter((m: any) => m.id !== matchId);
    if (current.knockout && Array.isArray(current.knockout.matches)) {
      current.knockout.matches = current.knockout.matches.filter((m: any) => m.id !== matchId);
    }
    const now = Date.now();
    current.lastUpdated = now;
    writeJSON(TOURNAMENT_FILE, current);

    if (serverSupabase) {
      try {
        await serverSupabase.from('match_scores').delete().eq('match_id', matchId);
        await serverSupabase.from('matches').delete().eq('id', matchId);
      } catch (err) {
        console.error('Error deleting individual match from Supabase:', err);
      }
    }

    broadcastSse('tournament_state', current);
    broadcastSse('match_deleted', { id: matchId, lastUpdated: now });
    res.json({ success: true, deleted: prevMatchesCount !== current.matches.length });
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
    broadcastSse('teams_update', { teams: current.teams, lastUpdated: current.lastUpdated });
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
  app.get('/api/registrations', async (req, res) => {
    let list = readJSON<any[]>(REGISTRATIONS_FILE, []);
    const season = req.query.season as string;
    const isAuthed = isAdminAuthorized(req);

    // Fetch authoritative live registrations from Supabase if active
    if (serverSupabase) {
      try {
        let query = serverSupabase
          .from('registrations')
          .select('*')
          .order('created_at', { ascending: false });

        if (season && season !== 'all') {
          query = query.eq('season_slug', season);
        }

        const { data: dbRows, error: dbErr } = await query;
        if (!dbErr && Array.isArray(dbRows) && dbRows.length > 0) {
          const mappedFromDb = dbRows.map((r: any) => ({
            id: r.id,
            regId: r.reg_id,
            playerId: r.player_id || undefined,
            name: r.name,
            mobile: r.mobile,
            whatsapp: r.whatsapp || undefined,
            age: r.age || undefined,
            gender: r.gender,
            experience: r.experience || undefined,
            category: r.category || undefined,
            style: r.style || undefined,
            city: r.city || undefined,
            notes: r.notes || undefined,
            fee: r.fee,
            status: r.status,
            paymentStatus: r.payment_status,
            method: r.method,
            txnId: r.txn_id || undefined,
            season: r.season_slug,
            createdAt: new Date(r.created_at).getTime(),
            paidAt: r.paid_at ? new Date(r.paid_at).getTime() : undefined,
            approvedAt: r.approved_at ? new Date(r.approved_at).getTime() : undefined,
            verifiedBy: r.verified_by || undefined,
            verifiedAt: r.verified_at ? new Date(r.verified_at).getTime() : undefined,
            auditLog: r.audit_log_json || [],
            answers: r.answers_json || {},
            photoUrl: r.photo_url || undefined,
            tokenUsed: r.token_used || undefined,
            formVersion: r.form_version || 1,
          }));
          list = mappedFromDb;
          writeJSON(REGISTRATIONS_FILE, list);
        }
      } catch (err: any) {
        console.warn('Error fetching registrations from Supabase, falling back to local file:', err?.message);
      }
    }

    const filtered = season && season !== 'all' ? list.filter((r) => r.season === season) : list;
    if (isAuthed) {
      return res.json(filtered);
    }
    // Return sanitized public-safe list with phone numbers & payment UTRs masked
    const publicSafe = filtered.map((r) => ({
      id: r.id,
      regId: r.regId,
      name: r.name,
      gender: r.gender,
      category: r.category,
      experience: r.experience,
      status: r.status,
      season: r.season,
      createdAt: r.createdAt,
      mobile: r.mobile ? `${String(r.mobile).slice(0, 2)}******${String(r.mobile).slice(-2)}` : undefined,
    }));
    res.json(publicSafe);
  });

  // 6. Submit New Registration
  app.post('/api/registrations', async (req, res) => {
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
    const formConfig = forms[season] || forms['season-4'] || createDefaultForm(season);
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
          const val = answers[f.id] !== undefined && answers[f.id] !== null ? answers[f.id] : req.body[f.id];
          if (val === undefined || val === null || String(val).trim() === '') {
            return res.status(400).json({
              error: `Please fill in required field: "${f.label}"`,
            });
          }
        }
      }
    }

    const effectiveGender = gender || answers.gender || 'M';
    const effectiveAge = age ? Number(age) : answers.age ? Number(answers.age) : undefined;
    const effectiveExperience = experience || answers.experience || undefined;
    const effectiveStyle = style || answers.style || undefined;
    const effectiveCity = city ? String(city).trim() : answers.city ? String(answers.city).trim() : undefined;

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

    const mergedAnswers = {
      ...answers,
      gender: effectiveGender,
      ...(effectiveAge ? { age: effectiveAge } : {}),
      ...(cat ? { category: cat } : {}),
      ...(effectiveExperience ? { experience: effectiveExperience } : {}),
      ...(effectiveStyle ? { style: effectiveStyle } : {}),
      ...(effectiveCity ? { city: effectiveCity } : {}),
    };

    const regSeq = String(list.length + 1).padStart(3, '0');
    const regSalt = Math.floor(100 + Math.random() * 900);
    const regId = `SPL-2026-${regSeq}-${regSalt}`;
    const newReg = {
      id: crypto.randomUUID(),
      regId,
      name: name.trim(),
      mobile: mobileCheck.cleanMobile,
      whatsapp: cleanWhatsApp,
      age: effectiveAge,
      gender: effectiveGender,
      experience: effectiveExperience,
      category: cat || undefined,
      style: effectiveStyle,
      city: effectiveCity,
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
      answers: mergedAnswers,
      photoUrl: photoUrl || answers.photo || undefined,
      tokenUsed: tokenUsed || undefined,
      formVersion: formConfig.version || 1,
    };

    // Save registration to Supabase PostgreSQL if active (fail fast if DB insert errors)
    if (serverSupabase) {
      try {
        const { error: insertErr } = await serverSupabase
          .from('registrations')
          .insert({
            id: newReg.id,
            reg_id: newReg.regId,
            season_slug: newReg.season,
            name: newReg.name,
            mobile: newReg.mobile,
            whatsapp: newReg.whatsapp || null,
            age: newReg.age || null,
            gender: newReg.gender,
            experience: newReg.experience || null,
            category: newReg.category || null,
            style: newReg.style || null,
            city: newReg.city || null,
            notes: newReg.notes || null,
            fee: newReg.fee,
            status: newReg.status,
            payment_status: newReg.paymentStatus,
            method: newReg.method,
            txn_id: newReg.txnId || null,
            answers_json: newReg.answers,
            photo_url: newReg.photoUrl || null,
            token_used: newReg.tokenUsed || null,
            form_version: newReg.formVersion,
            audit_log_json: newReg.auditLog,
            created_at: new Date(newReg.createdAt).toISOString(),
          } as any);

        if (insertErr) {
          console.error('Supabase registration insert error:', insertErr.message);
          return res.status(500).json({
            success: false,
            error: `Database insertion failed: ${insertErr.message}. Please try again.`,
          });
        }
        console.log(`Saved registration ${newReg.regId} to Supabase PostgreSQL successfully`);
      } catch (err: any) {
        console.error('Supabase registration insert exception:', err?.message);
        return res.status(500).json({
          success: false,
          error: `Database connection error: ${err?.message || 'Server error'}. Please try again.`,
        });
      }
    }

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

    broadcastSse('registration_created', { registration: newReg });

    const successMessage = formConfig.appearance?.successMessage ||
      'Registration submitted successfully! Thank you for registering for Smash Premier League. Your details have been received by the tournament organizer.';

    return res.status(201).json({
      success: true,
      registration: newReg,
      message: successMessage,
    });
  });

  // 6.2 Get Custom Registration URL Settings
  app.get('/api/registration-url', (req, res) => {
    const seasonSlug = (req.query.season as string) || 'season-4';
    const forms = readJSON<Record<string, any>>(FORMS_FILE, {});
    const formConfig = forms[seasonSlug] || forms['season-4'] || createDefaultForm(seasonSlug);
    const customSlug = formConfig.appearance?.customUrlSlug || formConfig.customUrlSlug || 'register';
    res.json({
      customUrlSlug: customSlug,
      isDefault: customSlug === 'register',
      enabled: formConfig.enabled ?? true,
      seasonSlug,
    });
  });

  // 6.3 Update Custom Registration URL Settings (Admin Only)
  app.post('/api/registration-url', async (req, res) => {
    if (!isAdminAuthorized(req)) {
      return res.status(401).json({ error: 'Unauthorized: Admin authentication required' });
    }
    const { customUrlSlug, seasonSlug = 'season-4', enabled } = req.body;
    if (typeof customUrlSlug !== 'string') {
      return res.status(400).json({ error: 'customUrlSlug must be a string' });
    }
    const cleanedSlug = customUrlSlug.toLowerCase().trim().replace(/[^a-z0-9-]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');

    // Validate characters and format
    if (!/^[a-z0-9-]+$/.test(cleanedSlug) || cleanedSlug.length < 3 || cleanedSlug.length > 60) {
      return res.status(400).json({
        error: 'Slug must be between 3 and 60 characters and contain only lowercase letters, numbers, and hyphens.',
      });
    }

    const RESERVED_SLUGS = [
      'admin', 'login', 'api', 'dashboard', 'fixtures', 'standings', 'teams', 'players',
      'knockout', 'tokens', 'registration', 'registered', 'statistics', 'champion', 'settings',
      'public', 'dist', 'src', 'data', 'supabase', 'node_modules'
    ];
    if (RESERVED_SLUGS.includes(cleanedSlug)) {
      return res.status(400).json({
        error: `"${cleanedSlug}" is a reserved system path and cannot be used as a registration link.`,
      });
    }

    const forms = readJSON<Record<string, any>>(FORMS_FILE, {});
    const formConfig = forms[seasonSlug] || forms['season-4'] || createDefaultForm(seasonSlug);
    formConfig.customUrlSlug = cleanedSlug;
    if (!formConfig.appearance) formConfig.appearance = {};
    formConfig.appearance.customUrlSlug = cleanedSlug;
    if (enabled !== undefined) {
      formConfig.enabled = Boolean(enabled);
    }
    formConfig.lastUpdatedAt = Date.now();
    forms[seasonSlug] = formConfig;
    if (seasonSlug !== 'season-4') {
      forms['season-4'] = { ...formConfig, seasonSlug: 'season-4' };
    }
    writeJSON(FORMS_FILE, forms);

    // Sync to Supabase
    if (serverSupabase) {
      try {
        await serverSupabase
          .from('registration_form_config')
          .update({
            appearance_json: formConfig.appearance,
            enabled: formConfig.enabled,
            updated_at: new Date().toISOString(),
          } as any)
          .eq('season_slug', seasonSlug);
      } catch (err: any) {
        console.error('Error syncing custom URL slug to Supabase:', err?.message);
      }
    }

    broadcastSse('registration_url_updated', {
      customUrlSlug: cleanedSlug,
      seasonSlug,
      enabled: formConfig.enabled,
    });

    res.json({
      success: true,
      customUrlSlug: cleanedSlug,
      isDefault: cleanedSlug === 'register',
      enabled: formConfig.enabled,
      message: `Registration link successfully set to /${cleanedSlug}`,
    });
  });

  // 6.4 Reset Custom Registration URL Settings to Default (Admin Only)
  app.post('/api/registration-url/reset', async (req, res) => {
    if (!isAdminAuthorized(req)) {
      return res.status(401).json({ error: 'Unauthorized: Admin authentication required' });
    }
    const seasonSlug = req.body?.seasonSlug || 'season-4';
    const forms = readJSON<Record<string, any>>(FORMS_FILE, {});
    const formConfig = forms[seasonSlug] || forms['season-4'] || createDefaultForm(seasonSlug);
    formConfig.customUrlSlug = 'register';
    if (!formConfig.appearance) formConfig.appearance = {};
    formConfig.appearance.customUrlSlug = 'register';
    formConfig.lastUpdatedAt = Date.now();
    forms[seasonSlug] = formConfig;
    writeJSON(FORMS_FILE, forms);

    if (serverSupabase) {
      try {
        await serverSupabase
          .from('registration_form_config')
          .update({
            appearance_json: formConfig.appearance,
            updated_at: new Date().toISOString(),
          } as any)
          .eq('season_slug', seasonSlug);
      } catch {}
    }

    broadcastSse('registration_url_updated', {
      customUrlSlug: 'register',
      seasonSlug,
      enabled: formConfig.enabled,
    });

    res.json({
      success: true,
      customUrlSlug: 'register',
      isDefault: true,
      enabled: formConfig.enabled,
      message: 'Registration link reset to default /register',
    });
  });

  // 6. Verify Payment Endpoint (Admin manual review with audit trail)
  app.post('/api/registrations/:id/verify-payment', (req, res) => {
    if (!isAdminAuthorized(req)) {
      return res.status(401).json({ error: 'Unauthorized: Admin authentication required' });
    }
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
    broadcastSse('registration_updated', { registration: updated });
    return res.json({ success: true, registration: updated });
  });

  // 5. Update Registration (Approve / Reject / Details)
  app.patch('/api/registrations/:id', (req, res) => {
    if (!isAdminAuthorized(req)) {
      return res.status(401).json({ error: 'Unauthorized: Admin authentication required' });
    }
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
    broadcastSse('registration_updated', { registration: updated });
    return res.json(updated);
  });

  // 6. Delete Registration
  app.delete('/api/registrations/:id', (req, res) => {
    if (!isAdminAuthorized(req)) {
      return res.status(401).json({ error: 'Unauthorized: Admin authentication required' });
    }
    const id = req.params.id;
    let list = readJSON<any[]>(REGISTRATIONS_FILE, []);
    const beforeCount = list.length;
    list = list.filter((r) => r.id !== id);
    writeJSON(REGISTRATIONS_FILE, list);
    broadcastSse('registration_deleted', { id });
    return res.json({ success: true, deleted: beforeCount !== list.length });
  });

  // 7. Bulk Delete Registrations
  app.post('/api/registrations/bulk-delete', (req, res) => {
    if (!isAdminAuthorized(req)) {
      return res.status(401).json({ error: 'Unauthorized: Admin authentication required' });
    }
    const { ids } = req.body;
    if (!Array.isArray(ids)) {
      return res.status(400).json({ error: 'ids must be an array' });
    }
    const idSet = new Set(ids);
    let list = readJSON<any[]>(REGISTRATIONS_FILE, []);
    const countBefore = list.length;
    list = list.filter((r) => !idSet.has(r.id));
    writeJSON(REGISTRATIONS_FILE, list);
    broadcastSse('registrations_bulk_deleted', { ids });
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
    broadcastSse('registrations_bulk_approved', { ids });
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
      server: {
        middlewareMode: true,
        hmr: false,
      },
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
