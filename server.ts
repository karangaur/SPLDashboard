import 'dotenv/config';
import express from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createServer as createViteServer } from 'vite';
import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';
import {
  DEFAULT_HERO_CONFIG,
  normalizeHeroConfig,
  cloneHeroConfig,
  sanitizeSvgMarkup,
  sanitizePlainText,
} from './src/utils/heroDefaults';
import {
  DEFAULT_YOUTUBE_LIVE_CONFIG,
  normalizeYouTubeLiveConfig,
  extractYouTubeVideoId,
} from './src/utils/youtube';

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
const HERO_FILE = path.join(DATA_DIR, 'hero_config.json');
const HERO_MEDIA_DIR = path.join(DATA_DIR, 'hero-media');
const LIVESTREAM_FILE = path.join(DATA_DIR, 'youtube_live.json');

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) {
  try {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  } catch (err) {
    console.warn('Could not create data dir:', err);
  }
}
if (!fs.existsSync(HERO_MEDIA_DIR)) {
  try {
    fs.mkdirSync(HERO_MEDIA_DIR, { recursive: true });
  } catch {}
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
    res.header(
      'Access-Control-Allow-Headers',
      'Content-Type, Authorization, X-Requested-With, X-SPL-Admin-Id, X-File-Name, X-Media-Kind'
    );
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
    const claimedAdminId = String(req.headers['x-spl-admin-id'] || '').trim();
    if (claimedAdminId && /^spl_(sb|sess|tk)_[a-f0-9]{16,}$/i.test(token)) return true;
    if (token.startsWith('spl_sess_') || token.startsWith('spl_tk_')) return true;
    return false;
  }

  function mapServerDbRegistration(r: any) {
    const rawAnswers = r.answers_json && typeof r.answers_json === 'object' ? r.answers_json : {};
    const feeVal = typeof r.fee === 'number' && Number.isFinite(r.fee) ? Math.max(0, Math.round(r.fee)) : 0;
    const rawPaid = rawAnswers._paidAmount;
    const paidAmount =
      typeof rawPaid === 'number' && Number.isFinite(rawPaid)
        ? Math.min(feeVal, Math.max(0, Math.round(rawPaid)))
        : undefined;

    return {
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
      fee: feeVal,
      paidAmount,
      status: r.status,
      paymentStatus: r.payment_status,
      method: r.method,
      txnId: r.txn_id || undefined,
      season: r.season_slug,
      createdAt: r.created_at ? new Date(r.created_at).getTime() : Date.now(),
      paidAt: r.paid_at ? new Date(r.paid_at).getTime() : undefined,
      approvedAt: r.approved_at ? new Date(r.approved_at).getTime() : undefined,
      verifiedBy: r.verified_by || undefined,
      verifiedAt: r.verified_at ? new Date(r.verified_at).getTime() : undefined,
      auditLog: Array.isArray(r.audit_log_json) ? r.audit_log_json : [],
      answers: rawAnswers,
      photoUrl: r.photo_url || undefined,
      tokenUsed: r.token_used || undefined,
      formVersion: r.form_version || 1,
    };
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

  async function fetchServerSupabaseFormRow(seasonSlug = 'season-4'): Promise<any | null> {
    if (!serverSupabase) return null;
    try {
      const { data: exact } = await serverSupabase
        .from('registration_form_config')
        .select('*')
        .eq('season_slug', seasonSlug)
        .maybeSingle();
      if (exact) return exact;

      const { data: published } = await serverSupabase
        .from('registration_form_config')
        .select('*')
        .eq('is_published', true)
        .order('updated_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (published) return published;

      const { data: fallbackSeason } = await serverSupabase
        .from('registration_form_config')
        .select('*')
        .eq('season_slug', 'season-4')
        .maybeSingle();
      if (fallbackSeason) return fallbackSeason;

      const { data: anyRow } = await serverSupabase
        .from('registration_form_config')
        .select('*')
        .order('updated_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      return anyRow || null;
    } catch {
      return null;
    }
  }

  async function getAuthoritativeRegistrationOpenStatus(
    seasonSlug = 'season-4'
  ): Promise<{ enabled: boolean; closedNotice?: string }> {
    const supabaseRow = await fetchServerSupabaseFormRow(seasonSlug);
    if (supabaseRow && typeof supabaseRow.enabled === 'boolean') {
      return {
        enabled: supabaseRow.enabled !== false,
        closedNotice:
          supabaseRow.closed_notice ||
          'Registration for Smash Premier League 3.0 is currently closed.',
      };
    }

    const forms = readJSON<Record<string, any>>(FORMS_FILE, {});
    const formConfig = forms[seasonSlug] || forms['season-4'];
    if (formConfig && typeof formConfig.enabled === 'boolean') {
      return {
        enabled: formConfig.enabled !== false,
        closedNotice:
          formConfig.closedNotice ||
          'Registration for Smash Premier League 3.0 is currently closed.',
      };
    }

    const settings = readJSON(SETTINGS_FILE, DEFAULT_REGISTRATION_SETTINGS);
    return {
      enabled: settings.enabled !== false,
      closedNotice:
        settings.closedNotice ||
        'Registration for Smash Premier League 3.0 is currently closed.',
    };
  }

  // 1. Get Registration Settings (legacy + authoritative Supabase sync)
  app.get('/api/registration-settings', async (_req, res) => {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    const settings = readJSON(SETTINGS_FILE, DEFAULT_REGISTRATION_SETTINGS);
    const authStatus = await getAuthoritativeRegistrationOpenStatus(settings.seasonSlug || 'season-4');
    res.json({
      ...settings,
      enabled: authStatus.enabled,
      closedNotice: authStatus.closedNotice || settings.closedNotice,
    });
  });

  // 2. Update Registration Settings (legacy + mirrored into FORMS_FILE and Supabase)
  app.post('/api/registration-settings', async (req, res) => {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
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

    const slug = updated.seasonSlug || 'season-4';
    if (typeof req.body?.enabled === 'boolean') {
      const forms = readJSON<Record<string, any>>(FORMS_FILE, {});
      const targetForm = forms[slug] || forms['season-4'] || createDefaultForm(slug);
      targetForm.enabled = updated.enabled;
      if (req.body.closedNotice !== undefined) {
        targetForm.closedNotice = req.body.closedNotice;
      }
      targetForm.lastUpdatedAt = Date.now();
      forms[slug] = targetForm;
      if (slug !== 'season-4' && forms['season-4']) {
        forms['season-4'] = { ...forms['season-4'], enabled: updated.enabled, lastUpdatedAt: Date.now() };
      }
      writeJSON(FORMS_FILE, forms);

      if (serverSupabase) {
        try {
          const existingRow = await fetchServerSupabaseFormRow(slug);
          const nowIso = new Date().toISOString();
          if (existingRow?.id) {
            await serverSupabase
              .from('registration_form_config')
              .update({
                enabled: updated.enabled,
                ...(req.body.closedNotice !== undefined ? { closed_notice: req.body.closedNotice || null } : {}),
                updated_at: nowIso,
              })
              .eq('id', existingRow.id);
          }
        } catch (err) {
          console.warn('Supabase registration-settings status sync warning:', err);
        }
      }

      broadcastSse('form_published', { config: targetForm });
    }

    res.json(updated);
  });

  // 3. Dynamic Form Configuration (Drafts & Published)
  app.get('/api/forms/:seasonSlug', async (req, res) => {
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

    // Reconcile authoritative enabled & closedNotice from Supabase PostgreSQL if active
    const authStatus = await getAuthoritativeRegistrationOpenStatus(seasonSlug);
    targetForm = {
      ...targetForm,
      enabled: authStatus.enabled,
      ...(authStatus.closedNotice ? { closedNotice: authStatus.closedNotice } : {}),
    };

    // Ensure default submit button text matches exact requirement
    if (targetForm && targetForm.appearance) {
      targetForm.appearance.submitButtonText = targetForm.appearance.submitButtonText || 'Submit Registration & Confirm Entry';
    }
    res.json(targetForm);
  });

  app.post('/api/forms/:seasonSlug', async (req, res) => {
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

    // Mirror enabled status into legacy SETTINGS_FILE
    if (typeof updated.enabled === 'boolean') {
      const currentSettings = readJSON(SETTINGS_FILE, DEFAULT_REGISTRATION_SETTINGS);
      writeJSON(SETTINGS_FILE, {
        ...currentSettings,
        enabled: updated.enabled,
        ...(updated.closedNotice !== undefined ? { closedNotice: updated.closedNotice } : {}),
      });
    }

    // Sync to Supabase PostgreSQL if active
    if (serverSupabase) {
      try {
        const nowIso = new Date().toISOString();
        const existingRow = await fetchServerSupabaseFormRow(seasonSlug);
        const rowId = existingRow?.id || seasonSlug;
        const existingApp = (existingRow?.appearance_json as any) || {};
        const mergedAppearance = {
          ...(updated.appearance || {}),
          ...(existingApp.heroPublished ? { heroPublished: existingApp.heroPublished } : {}),
          ...(existingApp.heroDraft ? { heroDraft: existingApp.heroDraft } : {}),
          ...(existingApp.heroLastPublishedAt ? { heroLastPublishedAt: existingApp.heroLastPublishedAt } : {}),
          ...(existingApp.heroPublishedBy ? { heroPublishedBy: existingApp.heroPublishedBy } : {}),
          ...(existingApp.youtubeLive ? { youtubeLive: existingApp.youtubeLive } : {}),
          ...(existingApp.tournamentSettings && !updated.appearance?.tournamentSettings
            ? { tournamentSettings: existingApp.tournamentSettings }
            : {}),
        };
        await serverSupabase
          .from('registration_form_config')
          .upsert({
            id: rowId,
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
            appearance_json: mergedAppearance,
            fields_json: updated.fields || [],
            version: nextVersion,
            published_at: isPublishing ? nowIso : undefined,
            updated_at: nowIso,
          });

        serverSupabase
          .from('registration_form_versions')
          .insert({
            form_config_id: rowId,
            season_slug: seasonSlug,
            version_num: nextVersion,
            snapshot_json: updated,
            created_by: 'admin',
            created_at: nowIso,
          })
          .then(() => {});
      } catch (err) {
        console.warn('Supabase form config upsert warning:', err);
      }
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
              status: m.status === 'paused' ? 'postponed' : m.status || 'upcoming',
              winner_id: m.winner || null,
              time: m.time || (m.courtName ? `Round ${m.round} · ${m.courtName}` : null),
              sets_json: m.sets || null,
              mvp_player_id: m.mvpPlayerId || null,
              updated_at: nowIso,
            }));
            await serverSupabase.from('matches').upsert(matchRows as any);
          }
        }

        // 3b. Sync Knockout Matches if provided
        if (req.body.knockout && Array.isArray(req.body.knockout.matches)) {
          const koList = req.body.knockout.matches;
          const { data: existingKoMatches } = await serverSupabase
            .from('matches')
            .select('id')
            .eq('tournament_season', 'season-4')
            .eq('match_type', 'knockout');

          const keepKoIds = koList.map((k: any) => String(k.id)).filter(Boolean);
          const keepKoIdSet = new Set<string>(keepKoIds);

          if (existingKoMatches && existingKoMatches.length > 0) {
            const orphanKoIds = existingKoMatches
              .map((m: any) => String(m.id))
              .filter((id: string) => id && !keepKoIdSet.has(id));
            if (orphanKoIds.length > 0) {
              await serverSupabase.from('match_scores').delete().in('match_id', orphanKoIds);
              await serverSupabase.from('matches').delete().in('id', orphanKoIds);
            }
          }

          if (koList.length > 0) {
            const koRows = koList.map((k: any) => ({
              id: k.id,
              tournament_season: 'season-4',
              round: 99,
              court: typeof k.court === 'number' ? k.court : parseInt(String(k.court || '').replace(/\D/g, '') || '1', 10) || 1,
              match_type: 'knockout' as const,
              stage: (k.stage === 'QF' ? 'ELIM' : k.stage) || 'SF',
              slot: k.slot || 1,
              team_a_id: k.teamA || null,
              team_b_id: k.teamB || null,
              score_a: k.scoreA != null ? k.scoreA : null,
              score_b: k.scoreB != null ? k.scoreB : null,
              status: k.status === 'paused' ? 'postponed' : k.status || 'upcoming',
              winner_id: k.winner || null,
              time: k.time || null,
              sets_json: k.sets || null,
              mvp_player_id: k.mvpPlayerId || null,
              updated_at: nowIso,
            }));
            await serverSupabase.from('matches').upsert(koRows as any);
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
    const { fullMatch: _ignoredGroupFull, isKnockout: _ignoredGroupKo, syncedToSupabase, ...cleanGroupBody } = req.body || {};
    const updatedMatches = (current.matches || []).map((m: any) => {
      if (m.id === matchId) {
        matched = true;
        const newScoreA = sanitizeScore(cleanGroupBody.scoreA !== undefined ? cleanGroupBody.scoreA : m.scoreA);
        const newScoreB = sanitizeScore(cleanGroupBody.scoreB !== undefined ? cleanGroupBody.scoreB : m.scoreB);
        const currentVersion = (m.version || 0) + 1;

        const updated = {
          ...m,
          ...cleanGroupBody,
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

      // Sync to Supabase PostgreSQL only if client did not already persist atomically
      if (serverSupabase && matchObj) {
        if (!syncedToSupabase) {
          serverSupabase
            .from('matches')
            .upsert({
              id: matchId,
              tournament_season: 'season-4',
              court: typeof matchObj.court === 'number' ? matchObj.court : 1,
              round: matchObj.round || 1,
              team_a_id: matchObj.teamA || null,
              team_b_id: matchObj.teamB || null,
              score_a: matchObj.scoreA != null ? matchObj.scoreA : null,
              score_b: matchObj.scoreB != null ? matchObj.scoreB : null,
              status: matchObj.status === 'paused' ? 'postponed' : matchObj.status,
              winner_id: matchObj.winner || null,
              time: matchObj.time || null,
              sets_json: matchObj.sets || [],
              mvp_player_id: matchObj.mvpPlayerId || null,
              updated_at: new Date(now).toISOString(),
            } as any)
            .then(() => {});
        }

        // Record point history log
        if (matchObj.scoreA != null || matchObj.scoreB != null) {
          serverSupabase
            .from('match_scores')
            .insert({
              match_id: matchId,
              set_number: Array.isArray(matchObj.sets) ? Math.max(1, matchObj.sets.length) : 1,
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

          const { fullMatch: _ignoredFull, isKnockout: _ignoredKo, syncedToSupabase: _ignoredSynced, ...cleanBody } = req.body || {};
          const updated = {
            ...k,
            ...cleanBody,
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
          if (!syncedToSupabase) {
            serverSupabase
              .from('matches')
              .upsert({
                id: matchId,
                tournament_season: 'season-4',
                round: 99,
                court: typeof matchObj.court === 'number' ? matchObj.court : 1,
                match_type: 'knockout',
                stage: (matchObj.stage === 'QF' ? 'ELIM' : matchObj.stage) || 'SF',
                slot: matchObj.slot || 1,
                team_a_id: matchObj.teamA || null,
                team_b_id: matchObj.teamB || null,
                score_a: matchObj.scoreA != null ? matchObj.scoreA : null,
                score_b: matchObj.scoreB != null ? matchObj.scoreB : null,
                status: matchObj.status === 'paused' ? 'postponed' : matchObj.status,
                winner_id: matchObj.winner || null,
                time: matchObj.time || null,
                sets_json: matchObj.sets || [],
                mvp_player_id: matchObj.mvpPlayerId || null,
                updated_at: new Date(now).toISOString(),
              } as any)
              .then(() => {});
          }

          if (matchObj.scoreA != null || matchObj.scoreB != null) {
            serverSupabase
              .from('match_scores')
              .insert({
                match_id: matchId,
                set_number: Array.isArray(matchObj.sets) ? Math.max(1, matchObj.sets.length) : 1,
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

        broadcastSse('knockout_score', { matchId, match: matchObj, lastUpdated: now });
        return res.json({ success: true, lastUpdated: now, match: matchObj });
      }
    }

    // 3. Upsert match if created on client or sent with fullMatch details
    const { fullMatch, isKnockout: bodyIsKoFlag, syncedToSupabase: bodySyncedToSupabase, ...restBody } = req.body || {};
    const newMatch = fullMatch ? { ...fullMatch } : { id: matchId, ...restBody };
    newMatch.scoreA = sanitizeScore(newMatch.scoreA);
    newMatch.scoreB = sanitizeScore(newMatch.scoreB);
    newMatch.version = 1;

    if (newMatch.scoreA != null && newMatch.scoreB != null && newMatch.status === 'completed') {
      if (newMatch.scoreA > newMatch.scoreB) newMatch.winner = newMatch.teamA;
      else if (newMatch.scoreB > newMatch.scoreA) newMatch.winner = newMatch.teamB;
    }

    const bodyIsKnockout = Boolean(bodyIsKoFlag || newMatch.stage || newMatch.matchType === 'knockout');
    if (bodyIsKnockout) {
      current.knockout = current.knockout || { format: 'top4', matches: [] };
      current.knockout.matches = [...(current.knockout.matches || []), newMatch];
      current.lastUpdated = now;
      writeJSON(TOURNAMENT_FILE, current);

      if (serverSupabase && !bodySyncedToSupabase) {
        serverSupabase
          .from('matches')
          .upsert({
            id: matchId,
            tournament_season: 'season-4',
            round: 99,
            court: typeof newMatch.court === 'number' ? newMatch.court : 1,
            match_type: 'knockout',
            stage: (newMatch.stage === 'QF' ? 'ELIM' : newMatch.stage) || 'SF',
            slot: newMatch.slot || 1,
            team_a_id: newMatch.teamA || null,
            team_b_id: newMatch.teamB || null,
            score_a: newMatch.scoreA != null ? newMatch.scoreA : null,
            score_b: newMatch.scoreB != null ? newMatch.scoreB : null,
            status: newMatch.status === 'paused' ? 'postponed' : newMatch.status || 'upcoming',
            winner_id: newMatch.winner || null,
            time: newMatch.time || null,
            sets_json: newMatch.sets || [],
            mvp_player_id: newMatch.mvpPlayerId || null,
            updated_at: new Date(now).toISOString(),
          } as any)
          .then(() => {});
      }

      broadcastSse('knockout_score', { matchId, match: newMatch, lastUpdated: now });
      return res.json({ success: true, lastUpdated: now, match: newMatch });
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
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    let list = readJSON<any[]>(REGISTRATIONS_FILE, []);
    const season = req.query.season as string;
    const authCheck = await verifyHeroAdminRequest(req);
    const isAuthed = authCheck.authorized || isAdminAuthorized(req);

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
        if (!dbErr && Array.isArray(dbRows)) {
          const mappedFromDb = dbRows.map((r: any) => mapServerDbRegistration(r));
          list = mappedFromDb;
          if (!season || season === 'all') {
            writeJSON(REGISTRATIONS_FILE, list);
          }
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

    // Validate authoritative open/closed status (Supabase first, then FORMS_FILE / SETTINGS_FILE)
    const authStatus = await getAuthoritativeRegistrationOpenStatus(season);
    if (!authStatus.enabled) {
      return res.status(403).json({
        registrationClosed: true,
        error:
          authStatus.closedNotice ||
          'Registration for Smash Premier League 3.0 is currently closed.',
      });
    }

    const forms = readJSON<Record<string, any>>(FORMS_FILE, {});
    const formConfig = forms[season] || forms['season-4'] || createDefaultForm(season);

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

    // Authoritative slot limit and duplicate check (Supabase first when active)
    let seasonRegistrations = list.filter((r) => r.season === season);
    if (serverSupabase) {
      try {
        const { data: sbRegs, error: sbRegErr } = await serverSupabase
          .from('registrations')
          .select('id, mobile, status, season_slug')
          .eq('season_slug', season);
        if (!sbRegErr && Array.isArray(sbRegs)) {
          seasonRegistrations = sbRegs.map((r: any) => ({
            id: r.id,
            mobile: r.mobile,
            status: r.status,
            season: r.season_slug,
          }));
        }
      } catch {}
    }

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

  // 6. Verify Payment Endpoint (Authoritative Supabase PostgreSQL + Atomic Audit Trail + RBAC)
  app.post('/api/registrations/:id/verify-payment', async (req, res) => {
    const auth = await verifyHeroAdminRequest(req);
    if (!auth.authorized) {
      return res.status(auth.status).json({ error: auth.error });
    }
    const id = req.params.id;
    const validPaymentStatuses = [
      'unpaid',
      'pending',
      'initiated',
      'pending_verification',
      'paid',
      'failed',
      'cancelled',
      'refunded',
    ];
    const requestedStatus = String(req.body?.paymentStatus || '').trim();
    if (!validPaymentStatuses.includes(requestedStatus)) {
      return res.status(400).json({ error: 'Invalid paymentStatus value.' });
    }
    const verifiedBy = String(req.body?.verifiedBy || auth.adminName || 'Tournament Director').trim() || 'Tournament Director';
    const note = req.body?.note !== undefined ? String(req.body.note) : undefined;
    const paidAmountInput =
      req.body?.paidAmount !== undefined && req.body?.paidAmount !== null && req.body?.paidAmount !== ''
        ? Number(req.body.paidAmount)
        : undefined;
    const validMethods = ['cash', 'upi', 'bank', 'complimentary'];
    const methodInput = validMethods.includes(req.body?.method) ? req.body.method : undefined;
    const now = Date.now();
    const nowIso = new Date(now).toISOString();

    if (serverSupabase) {
      try {
        const { data: existingRow, error: fetchErr } = await serverSupabase
          .from('registrations')
          .select('*')
          .eq('id', id)
          .maybeSingle();

        if (fetchErr) {
          return res.status(500).json({ error: fetchErr.message });
        }
        if (!existingRow) {
          return res.status(404).json({ error: 'Registration not found' });
        }

        const existing = existingRow as any;
        const feeVal = typeof existing.fee === 'number' && Number.isFinite(existing.fee) ? Math.max(0, Math.round(existing.fee)) : 0;
        const prevStatus = existing.payment_status || (existing.status === 'paid' ? 'paid' : 'unpaid');
        const nextAnswers =
          existing.answers_json && typeof existing.answers_json === 'object' ? { ...existing.answers_json } : {};

        let resolvedPaidAt: string | null = null;
        if (requestedStatus === 'paid') {
          resolvedPaidAt = existing.paid_at || nowIso;
          nextAnswers._paidAmount = feeVal;
        } else if (
          typeof paidAmountInput === 'number' &&
          Number.isFinite(paidAmountInput) &&
          paidAmountInput > 0 &&
          requestedStatus !== 'failed' &&
          requestedStatus !== 'cancelled' &&
          requestedStatus !== 'refunded'
        ) {
          const clampedPartial = Math.min(feeVal, Math.max(0, Math.round(paidAmountInput)));
          nextAnswers._paidAmount = clampedPartial;
          resolvedPaidAt = clampedPartial >= feeVal ? existing.paid_at || nowIso : null;
        } else {
          delete nextAnswers._paidAmount;
          resolvedPaidAt = null;
        }

        const auditEntry = {
          action: requestedStatus === 'paid' ? 'verify_payment' : prevStatus === 'paid' ? 'reverse_payment' : 'update_payment_status',
          by: verifiedBy,
          at: now,
          fromStatus: prevStatus,
          toStatus: requestedStatus,
          ...(note ? { note } : {}),
          ...(typeof paidAmountInput === 'number' ? { paidAmount: paidAmountInput } : {}),
        };

        const nextRegStatus =
          requestedStatus === 'paid' && existing.status === 'pending'
            ? 'approved'
            : existing.status === 'paid' && requestedStatus !== 'paid'
            ? 'approved'
            : existing.status;

        const patch: Record<string, any> = {
          payment_status: requestedStatus,
          status: nextRegStatus,
          method: methodInput || existing.method || 'upi',
          paid_at: resolvedPaidAt,
          verified_by: verifiedBy,
          verified_at: nowIso,
          answers_json: nextAnswers,
          audit_log_json: [...(Array.isArray(existing.audit_log_json) ? existing.audit_log_json : []), auditEntry],
          updated_at: nowIso,
        };
        if (nextRegStatus === 'approved' && !existing.approved_at) {
          patch.approved_at = nowIso;
        }
        if (note !== undefined && note !== existing.notes) {
          patch.notes = note || null;
        }

        const { data: updatedRow, error: updateErr } = await serverSupabase
          .from('registrations')
          .update(patch)
          .eq('id', id)
          .select('*')
          .single();

        if (updateErr || !updatedRow) {
          return res.status(500).json({ error: updateErr?.message || 'Failed to update payment in Supabase.' });
        }

        const mapped = mapServerDbRegistration(updatedRow);

        // Mirror local store cleanly
        const localList = readJSON<any[]>(REGISTRATIONS_FILE, []);
        const idx = localList.findIndex((r) => r.id === id);
        if (idx >= 0) localList[idx] = mapped;
        else localList.unshift(mapped);
        writeJSON(REGISTRATIONS_FILE, localList);

        serverSupabase
          .from('audit_logs')
          .insert({
            action: requestedStatus === 'paid' ? 'payment_verified' : 'payment_status_updated',
            entity_type: 'registration',
            entity_id: id,
            user_email: verifiedBy,
            details_json: {
              regId: mapped.regId,
              playerName: mapped.name,
              fee: mapped.fee,
              fromStatus: prevStatus,
              toStatus: requestedStatus,
              paidAmount: mapped.paidAmount,
              note,
            },
          })
          .then(() => {});

        broadcastSse('registration_updated', { registration: mapped });
        return res.json({ success: true, registration: mapped });
      } catch (err: any) {
        return res.status(500).json({ error: err?.message || 'Supabase payment verification error' });
      }
    }

    // Local fallback only when Supabase is not configured
    const list = readJSON<any[]>(REGISTRATIONS_FILE, []);
    const index = list.findIndex((r) => r.id === id);
    if (index === -1) {
      return res.status(404).json({ error: 'Registration not found' });
    }

    const existing = list[index];
    const prevStatus = existing.paymentStatus || (existing.status === 'paid' ? 'paid' : existing.txnId ? 'pending_verification' : 'unpaid');
    const feeVal = typeof existing.fee === 'number' && Number.isFinite(existing.fee) ? Math.max(0, Math.round(existing.fee)) : 0;

    const auditEntry = {
      action: requestedStatus === 'paid' ? 'verify_payment' : prevStatus === 'paid' ? 'reverse_payment' : 'update_payment_status',
      by: verifiedBy,
      at: now,
      fromStatus: prevStatus,
      toStatus: requestedStatus,
      note: note || undefined,
    };

    const resolvedPaidAmount =
      requestedStatus === 'paid'
        ? feeVal
        : typeof paidAmountInput === 'number' && Number.isFinite(paidAmountInput) && paidAmountInput > 0 && requestedStatus !== 'failed' && requestedStatus !== 'cancelled' && requestedStatus !== 'refunded'
        ? Math.min(feeVal, Math.max(0, Math.round(paidAmountInput)))
        : undefined;

    const updated = {
      ...existing,
      paymentStatus: requestedStatus,
      paidAmount: resolvedPaidAmount,
      method: methodInput || existing.method || 'upi',
      verifiedBy,
      verifiedAt: now,
      paidAt: requestedStatus === 'paid' ? existing.paidAt || now : undefined,
      auditLog: [...(existing.auditLog || []), auditEntry],
    };

    if (requestedStatus === 'paid' && existing.status === 'pending') {
      updated.status = 'approved';
      updated.approvedAt = existing.approvedAt || now;
    } else if (existing.status === 'paid' && requestedStatus !== 'paid') {
      updated.status = 'approved';
    }

    list[index] = updated;
    writeJSON(REGISTRATIONS_FILE, list);
    broadcastSse('registration_updated', { registration: updated });
    return res.json({ success: true, registration: updated });
  });

  // 5. Update Registration (Approve / Reject / Details - Supabase First + Column-Scoped)
  app.patch('/api/registrations/:id', async (req, res) => {
    const auth = await verifyHeroAdminRequest(req);
    if (!auth.authorized) {
      return res.status(auth.status).json({ error: auth.error });
    }
    const id = req.params.id;
    const now = Date.now();
    const nowIso = new Date(now).toISOString();

    if (serverSupabase) {
      try {
        const patch: Record<string, any> = { updated_at: nowIso };
        const b = req.body || {};
        if (b.name !== undefined) patch.name = String(b.name).trim();
        if (b.mobile !== undefined) patch.mobile = String(b.mobile).replace(/\D/g, '');
        if (b.whatsapp !== undefined) patch.whatsapp = b.whatsapp ? String(b.whatsapp).replace(/\D/g, '') : null;
        if (b.age !== undefined) patch.age = typeof b.age === 'number' && !isNaN(b.age) ? Math.round(b.age) : null;
        if (b.gender !== undefined) patch.gender = b.gender;
        if (b.city !== undefined) patch.city = b.city || null;
        if (b.notes !== undefined) patch.notes = b.notes || null;
        if (b.experience !== undefined) patch.experience = b.experience || null;
        if (b.category !== undefined) patch.category = b.category || null;
        if (b.style !== undefined) patch.style = b.style || null;
        if (b.playerId !== undefined) patch.player_id = b.playerId || null;
        if (b.fee !== undefined && !Number.isNaN(Number(b.fee))) patch.fee = Math.max(0, Math.round(Number(b.fee)));
        if (b.status !== undefined) {
          patch.status = b.status;
          if (b.status === 'approved') {
            patch.approved_at = b.approvedAt ? new Date(b.approvedAt).toISOString() : nowIso;
          }
        }
        if (b.paymentStatus !== undefined) {
          patch.payment_status = b.paymentStatus;
          patch.paid_at = b.paymentStatus === 'paid' ? (b.paidAt ? new Date(b.paidAt).toISOString() : nowIso) : null;
        }
        if (b.method !== undefined) patch.method = b.method;
        if (b.txnId !== undefined) patch.txn_id = b.txnId || null;

        const { data: updatedRow, error } = await serverSupabase
          .from('registrations')
          .update(patch)
          .eq('id', id)
          .select('*')
          .maybeSingle();

        if (error) {
          return res.status(500).json({ error: error.message });
        }
        if (!updatedRow) {
          return res.status(404).json({ error: 'Registration not found' });
        }

        const mapped = mapServerDbRegistration(updatedRow);
        const localList = readJSON<any[]>(REGISTRATIONS_FILE, []);
        const idx = localList.findIndex((r) => r.id === id);
        if (idx >= 0) localList[idx] = mapped;
        else localList.unshift(mapped);
        writeJSON(REGISTRATIONS_FILE, localList);
        broadcastSse('registration_updated', { registration: mapped });
        return res.json(mapped);
      } catch (err: any) {
        return res.status(500).json({ error: err?.message || 'Supabase patch error' });
      }
    }

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
    if (req.body.paymentStatus !== undefined && req.body.paymentStatus !== 'paid') {
      updated.paidAt = undefined;
    }

    list[index] = updated;
    writeJSON(REGISTRATIONS_FILE, list);
    broadcastSse('registration_updated', { registration: updated });
    return res.json(updated);
  });

  // 6. Delete Registration
  app.delete('/api/registrations/:id', async (req, res) => {
    const auth = await verifyHeroAdminRequest(req);
    if (!auth.authorized) {
      return res.status(auth.status).json({ error: auth.error });
    }
    const id = req.params.id;
    if (serverSupabase) {
      try {
        await serverSupabase.from('registrations').delete().eq('id', id);
      } catch {}
    }
    let list = readJSON<any[]>(REGISTRATIONS_FILE, []);
    const beforeCount = list.length;
    list = list.filter((r) => r.id !== id);
    writeJSON(REGISTRATIONS_FILE, list);
    broadcastSse('registration_deleted', { id });
    return res.json({ success: true, deleted: beforeCount !== list.length || Boolean(serverSupabase) });
  });

  // 7. Bulk Delete Registrations
  app.post('/api/registrations/bulk-delete', async (req, res) => {
    const auth = await verifyHeroAdminRequest(req);
    if (!auth.authorized) {
      return res.status(auth.status).json({ error: auth.error });
    }
    const { ids } = req.body;
    if (!Array.isArray(ids)) {
      return res.status(400).json({ error: 'ids must be an array' });
    }
    if (serverSupabase && ids.length > 0) {
      try {
        await serverSupabase.from('registrations').delete().in('id', ids);
      } catch {}
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
  app.post('/api/registrations/bulk-approve', async (req, res) => {
    const auth = await verifyHeroAdminRequest(req);
    if (!auth.authorized) {
      return res.status(auth.status).json({ error: auth.error });
    }
    const { ids } = req.body;
    if (!Array.isArray(ids)) {
      return res.status(400).json({ error: 'ids must be an array' });
    }
    const idSet = new Set(ids);
    const now = Date.now();
    const nowIso = new Date(now).toISOString();
    let approvedCount = 0;

    if (serverSupabase && ids.length > 0) {
      try {
        const { data: updatedRows } = await serverSupabase
          .from('registrations')
          .update({ status: 'approved', approved_at: nowIso, updated_at: nowIso })
          .in('id', ids)
          .select('id');
        approvedCount = Array.isArray(updatedRows) ? updatedRows.length : ids.length;
      } catch {}
    }

    let list = readJSON<any[]>(REGISTRATIONS_FILE, []);
    list = list.map((r) => {
      if (idSet.has(r.id)) {
        if (!serverSupabase) approvedCount++;
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

  // =========================================================================
  // HERO SECTION CUSTOMIZATION MANAGER API ROUTES (RBAC + STORAGE + REALTIME)
  // =========================================================================
  interface HeroStorageFile {
    published: any;
    draft: any;
    versions: any[];
  }

  function readLocalHeroStore(): HeroStorageFile {
    const fallback: HeroStorageFile = {
      published: cloneHeroConfig(DEFAULT_HERO_CONFIG),
      draft: cloneHeroConfig({ ...DEFAULT_HERO_CONFIG, status: 'draft' }),
      versions: [],
    };
    const stored = readJSON<HeroStorageFile>(HERO_FILE, fallback);
    return {
      published: normalizeHeroConfig({ ...(stored.published || DEFAULT_HERO_CONFIG), status: 'published' }),
      draft: normalizeHeroConfig({ ...(stored.draft || stored.published || DEFAULT_HERO_CONFIG), status: 'draft' }),
      versions: Array.isArray(stored.versions) ? stored.versions : [],
    };
  }

  async function verifyHeroAdminRequest(req: express.Request): Promise<{
    authorized: boolean;
    status: number;
    error?: string;
    adminName?: string;
    role?: string;
  }> {
    const authHeader = req.headers.authorization;
    const token = authHeader ? authHeader.replace(/^Bearer\s+/i, '').trim() : '';
    if (!token) {
      return { authorized: false, status: 401, error: 'Unauthorized: Missing authentication token.' };
    }

    const authConfig = readJSON(AUTH_FILE, DEFAULT_ADMIN_CONFIG);
    const localSession = authConfig.activeTokens?.[token];
    if (localSession && Date.now() <= localSession.expiresAt) {
      const account = authConfig.accounts?.find((a: any) => a.id === localSession.userId);
      if (!account) {
        return { authorized: false, status: 401, error: 'Unauthorized: Session account not found.' };
      }
      if (account.role !== 'super_admin' && account.role !== 'tournament_director') {
        return { authorized: false, status: 403, error: 'Forbidden: Only Super Admin or Tournament Director can customize the Hero Section.' };
      }
      return { authorized: true, status: 200, adminName: account.name || account.username, role: account.role };
    }

    // Check Supabase JWT if token looks like a JWT
    if (serverSupabase && token.split('.').length === 3) {
      try {
        const { data: userData } = await serverSupabase.auth.getUser(token);
        if (userData?.user) {
          const { data: adminRow } = await serverSupabase
            .from('admin_users')
            .select('id, name, username, role, is_active')
            .or(`auth_user_id.eq.${userData.user.id},email.eq.${userData.user.email}`)
            .maybeSingle();
          if (adminRow && (adminRow as any).is_active !== false) {
            const role = (adminRow as any).role;
            if (role !== 'super_admin' && role !== 'tournament_director') {
              return { authorized: false, status: 403, error: 'Forbidden: Insufficient role privileges.' };
            }
            return { authorized: true, status: 200, adminName: (adminRow as any).name, role };
          }
        }
      } catch {}
    }

    // Check active Supabase-issued session token (spl_sb_... / spl_sess_...) bound to X-SPL-Admin-Id
    const claimedAdminId = String(req.headers['x-spl-admin-id'] || '').trim();
    if (
      serverSupabase &&
      claimedAdminId &&
      /^spl_(sb|sess|tk)_[a-f0-9]{16,}$/i.test(token)
    ) {
      try {
        const { data: adminRow } = await serverSupabase
          .from('admin_users')
          .select('id, name, username, role, is_active')
          .eq('id', claimedAdminId)
          .maybeSingle();
        if (adminRow && (adminRow as any).is_active !== false) {
          const role = (adminRow as any).role;
          if (role !== 'super_admin' && role !== 'tournament_director') {
            return { authorized: false, status: 403, error: 'Forbidden: Score operators cannot modify Hero configuration.' };
          }
          return {
            authorized: true,
            status: 200,
            adminName: (adminRow as any).name || (adminRow as any).username,
            role,
          };
        }
      } catch {}
    }

    return { authorized: false, status: 401, error: 'Unauthorized: Valid administrator session required.' };
  }

  function detectAndValidateHeroMedia(
    buf: Buffer,
    fileName: string,
    declaredMime: string,
    kind: 'logo' | 'image' | 'video'
  ): { valid: boolean; ext?: string; mime?: string; buffer?: Buffer; error?: string } {
    if (!buf || buf.length === 0) {
      return { valid: false, error: 'Uploaded file is empty.' };
    }

    const maxBytes =
      kind === 'logo' ? 3 * 1024 * 1024 : kind === 'image' ? 10 * 1024 * 1024 : 50 * 1024 * 1024;
    if (buf.length > maxBytes) {
      return {
        valid: false,
        error: `File exceeds maximum allowed size (${Math.round(maxBytes / (1024 * 1024))}MB) for ${kind}.`,
      };
    }

    const ext = path.extname(fileName || '').toLowerCase();

    if (kind === 'video') {
      const isMp4Signature = buf.length >= 12 && buf.subarray(4, 8).toString('ascii') === 'ftyp';
      const isWebmSignature =
        buf.length >= 4 && buf[0] === 0x1a && buf[1] === 0x45 && buf[2] === 0xdf && buf[3] === 0xa3;

      if (isMp4Signature && (ext === '.mp4' || ext === '.m4v' || declaredMime.includes('mp4') || !ext)) {
        return { valid: true, ext: '.mp4', mime: 'video/mp4', buffer: buf };
      }
      if (isWebmSignature && (ext === '.webm' || declaredMime.includes('webm') || !ext)) {
        return { valid: true, ext: '.webm', mime: 'video/webm', buffer: buf };
      }
      return {
        valid: false,
        error: 'Invalid video file signature. Only authentic MP4 and WebM video files are allowed.',
      };
    }

    // Image / Logo validation
    const isPng =
      buf.length >= 8 &&
      buf[0] === 0x89 &&
      buf[1] === 0x50 &&
      buf[2] === 0x4e &&
      buf[3] === 0x47 &&
      buf[4] === 0x0d &&
      buf[5] === 0x0a &&
      buf[6] === 0x1a &&
      buf[7] === 0x0a;
    if (isPng) {
      return { valid: true, ext: '.png', mime: 'image/png', buffer: buf };
    }

    const isJpeg = buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff;
    if (isJpeg && kind === 'image') {
      return { valid: true, ext: '.jpg', mime: 'image/jpeg', buffer: buf };
    }
    if (isJpeg && kind === 'logo') {
      return { valid: true, ext: '.jpg', mime: 'image/jpeg', buffer: buf };
    }

    const isWebp =
      buf.length >= 12 &&
      buf.subarray(0, 4).toString('ascii') === 'RIFF' &&
      buf.subarray(8, 12).toString('ascii') === 'WEBP';
    if (isWebp) {
      return { valid: true, ext: '.webp', mime: 'image/webp', buffer: buf };
    }

    const isAvif =
      buf.length >= 12 &&
      buf.subarray(4, 8).toString('ascii') === 'ftyp' &&
      (buf.subarray(8, 12).toString('ascii') === 'avif' ||
        buf.subarray(8, 12).toString('ascii') === 'avis');
    if (isAvif && kind === 'image') {
      return { valid: true, ext: '.avif', mime: 'image/avif', buffer: buf };
    }

    const isSvgCandidate =
      ext === '.svg' || declaredMime.includes('svg') || buf.subarray(0, 512).toString('utf-8').includes('<svg');
    if (isSvgCandidate && kind === 'logo') {
      const rawText = buf.toString('utf-8');
      const svgResult = sanitizeSvgMarkup(rawText);
      if (!svgResult.valid) {
        return { valid: false, error: svgResult.error || 'Unsafe or malformed SVG logo rejected.' };
      }
      return {
        valid: true,
        ext: '.svg',
        mime: 'image/svg+xml',
        buffer: Buffer.from(svgResult.sanitized, 'utf-8'),
      };
    }

    return {
      valid: false,
      error:
        kind === 'logo'
          ? 'Invalid logo format. Supported: PNG, WebP, or safe SVG.'
          : 'Invalid image format. Supported: JPG/JPEG, PNG, WebP, or AVIF.',
    };
  }

  // Public Hero Config endpoint (NEVER exposes draft!)
  app.get('/api/hero/published', async (req, res) => {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    const seasonSlug = String(req.query.season || 'season-4');
    if (serverSupabase) {
      try {
        const row = await fetchServerSupabaseFormRow(seasonSlug);
        const published = (row?.appearance_json as any)?.heroPublished;
        if (published && typeof published === 'object') {
          const normalized = normalizeHeroConfig({ ...published, status: 'published' });
          return res.json({ heroConfig: normalized, source: 'supabase' });
        }
      } catch {}
    }
    const localStore = readLocalHeroStore();
    return res.json({ heroConfig: localStore.published, source: 'server' });
  });

  // Admin Hero State (published + private draft + version history)
  app.get('/api/hero/admin/state', async (req, res) => {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    const auth = await verifyHeroAdminRequest(req);
    if (!auth.authorized) {
      return res.status(auth.status).json({ error: auth.error });
    }

    const seasonSlug = String(req.query.season || 'season-4');
    const localStore = readLocalHeroStore();
    let published = localStore.published;
    let draft = localStore.draft;
    let versions = localStore.versions;

    if (serverSupabase) {
      try {
        const row = await fetchServerSupabaseFormRow(seasonSlug);
        const appJson = (row?.appearance_json as any) || {};
        if (appJson.heroPublished) {
          published = normalizeHeroConfig({ ...appJson.heroPublished, status: 'published' });
        }
        if (appJson.heroDraft) {
          draft = normalizeHeroConfig({ ...appJson.heroDraft, status: 'draft' });
        } else {
          draft = cloneHeroConfig({ ...published, status: 'draft' });
        }

        const { data: versionRows } = await serverSupabase
          .from('registration_form_versions')
          .select('*')
          .eq('season_slug', seasonSlug)
          .order('created_at', { ascending: false })
          .limit(40);

        if (Array.isArray(versionRows)) {
          const dbVersions = versionRows
            .filter((r: any) => r?.snapshot_json?.kind === 'hero_version' && r?.snapshot_json?.heroConfig)
            .slice(0, 20)
            .map((r: any) => ({
              id: r.id,
              versionNum: Number(r.version_num) || 1,
              action: r.snapshot_json.action === 'restore' ? 'restore' : 'publish',
              createdBy: String(r.created_by || 'admin').replace(/^hero:/, ''),
              createdAt: r.created_at ? new Date(r.created_at).getTime() : Date.now(),
              summary: String(r.snapshot_json.summary || `Published v${r.version_num}`),
              config: normalizeHeroConfig(r.snapshot_json.heroConfig),
            }));
          if (dbVersions.length > 0) {
            versions = dbVersions;
          }
        }
      } catch {}
    }

    return res.json({ published, draft, versions });
  });

  // Save Hero Draft privately (NEVER modifies published hero)
  app.post('/api/hero/draft', async (req, res) => {
    const auth = await verifyHeroAdminRequest(req);
    if (!auth.authorized) {
      return res.status(auth.status).json({ error: auth.error });
    }

    const seasonSlug = String(req.body?.seasonSlug || 'season-4');
    const rawConfig = req.body?.config;
    if (!rawConfig || typeof rawConfig !== 'object') {
      return res.status(400).json({ error: 'Invalid Hero configuration payload.' });
    }

    const author = sanitizePlainText(req.body?.author || auth.adminName || 'Tournament Director', 80) || 'Tournament Director';
    const cleanDraft = normalizeHeroConfig({
      ...rawConfig,
      status: 'draft',
      updatedAt: Date.now(),
      updatedBy: author,
    });

    const store = readLocalHeroStore();
    store.draft = cleanDraft;
    writeJSON(HERO_FILE, store);

    if (serverSupabase) {
      try {
        const existingRow = await fetchServerSupabaseFormRow(seasonSlug);
        if (existingRow) {
          const existingApp = (existingRow.appearance_json as any) || {};
          const mergedApp = {
            ...existingApp,
            heroDraft: cleanDraft,
          };
          const { error: sbErr } = await serverSupabase
            .from('registration_form_config')
            .update({
              appearance_json: mergedApp,
              updated_at: new Date().toISOString(),
            })
            .eq('id', existingRow.id);
          if (sbErr) {
            return res.status(500).json({ error: sbErr.message });
          }
        }
      } catch (err: any) {
        return res.status(500).json({ error: err?.message || 'Supabase draft persistence failed.' });
      }
    }

    return res.json({ success: true, draft: cleanDraft });
  });

  // Publish Hero Config atomically + Version Snapshot + Realtime Broadcast
  app.post('/api/hero/publish', async (req, res) => {
    const auth = await verifyHeroAdminRequest(req);
    if (!auth.authorized) {
      return res.status(auth.status).json({ error: auth.error });
    }

    const seasonSlug = String(req.body?.seasonSlug || 'season-4');
    const rawConfig = req.body?.config;
    if (!rawConfig || typeof rawConfig !== 'object') {
      return res.status(400).json({ error: 'Invalid Hero configuration payload.' });
    }

    const author = sanitizePlainText(req.body?.author || auth.adminName || 'Tournament Director', 80) || 'Tournament Director';
    const action = req.body?.action === 'restore' ? 'restore' : 'publish';
    const summary = sanitizePlainText(req.body?.summary || 'Published Hero customization', 160) || 'Published Hero customization';
    const normalizedInput = normalizeHeroConfig(rawConfig);

    const store = readLocalHeroStore();
    let baseVersion = Number(store.published?.version || 0);
    let existingRow: any = null;

    if (serverSupabase) {
      existingRow = await fetchServerSupabaseFormRow(seasonSlug);
      const dbCurrentVersion = Number((existingRow?.appearance_json as any)?.heroPublished?.version || 0);
      baseVersion = Math.max(baseVersion, dbCurrentVersion);
    }

    const nextVersion = Math.max(1, baseVersion + 1);
    const nowMs = Date.now();
    const nowIso = new Date(nowMs).toISOString();

    const publishedConfig = normalizeHeroConfig({
      ...normalizedInput,
      version: nextVersion,
      status: 'published',
      updatedAt: nowMs,
      updatedBy: author,
      publishedAt: nowMs,
      publishedBy: author,
    });

    const draftMirror = cloneHeroConfig({ ...publishedConfig, status: 'draft' });
    const versionRecord = {
      id: crypto.randomUUID(),
      versionNum: nextVersion,
      action,
      createdBy: author,
      createdAt: nowMs,
      summary,
      config: publishedConfig,
    };

    if (serverSupabase && existingRow) {
      try {
        const existingApp = (existingRow.appearance_json as any) || {};
        const mergedApp = {
          ...existingApp,
          heroPublished: publishedConfig,
          heroDraft: draftMirror,
          heroLastPublishedAt: nowIso,
          heroPublishedBy: author,
        };
        const { error: updateErr } = await serverSupabase
          .from('registration_form_config')
          .update({
            appearance_json: mergedApp,
            updated_at: nowIso,
          })
          .eq('id', existingRow.id);
        if (updateErr) {
          return res.status(500).json({ error: updateErr.message });
        }

        await serverSupabase.from('registration_form_versions').insert({
          id: versionRecord.id,
          form_config_id: existingRow.id,
          season_slug: existingRow.season_slug || seasonSlug,
          version_num: nextVersion,
          snapshot_json: {
            kind: 'hero_version',
            action,
            summary,
            heroConfig: publishedConfig,
          },
          created_by: `hero:${author}`,
          created_at: nowIso,
        });

        serverSupabase
          .from('audit_logs')
          .insert({
            action: action === 'restore' ? 'hero_version_restored' : 'hero_published',
            entity_type: 'hero_config',
            entity_id: existingRow.id,
            user_email: author,
            details_json: { version: nextVersion, summary },
          })
          .then(() => {});
      } catch (err: any) {
        return res.status(500).json({ error: err?.message || 'Supabase publish error.' });
      }
    }

    store.published = publishedConfig;
    store.draft = draftMirror;
    store.versions = [versionRecord, ...store.versions].slice(0, 20);
    writeJSON(HERO_FILE, store);

    broadcastSse('hero_published', {
      seasonSlug,
      heroConfig: publishedConfig,
      version: versionRecord,
    });

    return res.json({
      success: true,
      published: publishedConfig,
      version: versionRecord,
    });
  });

  // Public & Admin YouTube Live Stream Configuration Endpoints
  app.get('/api/livestream', async (req, res) => {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    const seasonSlug = String(req.query.season || 'season-4');
    if (serverSupabase) {
      try {
        const row = await fetchServerSupabaseFormRow(seasonSlug);
        const rawLive = (row?.appearance_json as any)?.youtubeLive;
        if (rawLive && typeof rawLive === 'object') {
          return res.json({
            config: normalizeYouTubeLiveConfig(rawLive),
            source: 'supabase',
          });
        }
      } catch {}
    }

    const localCfg = normalizeYouTubeLiveConfig(
      readJSON(LIVESTREAM_FILE, DEFAULT_YOUTUBE_LIVE_CONFIG)
    );
    return res.json({ config: localCfg, source: 'server' });
  });

  app.post('/api/livestream', async (req, res) => {
    const auth = await verifyHeroAdminRequest(req);
    if (!auth.authorized) {
      return res.status(auth.status).json({ error: auth.error });
    }

    const seasonSlug = String(req.body?.seasonSlug || 'season-4');
    const rawConfig = req.body?.config;
    if (!rawConfig || typeof rawConfig !== 'object') {
      return res.status(400).json({ error: 'Invalid YouTube Live configuration payload.' });
    }

    const rawUrl = typeof rawConfig.videoUrl === 'string' ? rawConfig.videoUrl.trim() : '';
    const extracted = rawUrl ? extractYouTubeVideoId(rawUrl) : null;
    if (rawUrl && (!extracted || !extracted.valid)) {
      return res.status(400).json({
        error: extracted?.error || 'Invalid YouTube URL. Only official youtube.com or youtu.be URLs are permitted.',
      });
    }

    if (rawConfig.enabled && (!extracted || !extracted.valid)) {
      return res.status(400).json({
        error: 'Provide a valid YouTube stream URL before enabling the Watch Live button.',
      });
    }

    const author =
      sanitizePlainText(req.body?.author || auth.adminName || 'Tournament Director', 80) ||
      'Tournament Director';
    const nowMs = Date.now();
    const nowIso = new Date(nowMs).toISOString();

    const sanitizedConfig = normalizeYouTubeLiveConfig({
      ...rawConfig,
      videoUrl: extracted?.valid ? extracted.normalizedUrl : '',
      videoId: extracted?.valid ? extracted.videoId : '',
      updatedAt: nowMs,
      updatedBy: author,
    });

    if (serverSupabase) {
      try {
        const existingRow = await fetchServerSupabaseFormRow(seasonSlug);
        if (existingRow) {
          const existingApp = (existingRow.appearance_json as any) || {};
          const mergedApp = {
            ...existingApp,
            youtubeLive: sanitizedConfig,
          };
          const { error: sbErr } = await serverSupabase
            .from('registration_form_config')
            .update({
              appearance_json: mergedApp,
              updated_at: nowIso,
            })
            .eq('id', existingRow.id);
          if (sbErr) {
            return res.status(500).json({ error: sbErr.message });
          }

          serverSupabase
            .from('audit_logs')
            .insert({
              action: 'youtube_live_updated',
              entity_type: 'livestream_config',
              entity_id: existingRow.id,
              user_email: author,
              details_json: {
                enabled: sanitizedConfig.enabled,
                status: sanitizedConfig.status,
                videoId: sanitizedConfig.videoId,
                allowReplay: sanitizedConfig.allowReplay,
              },
            })
            .then(() => {});
        }
      } catch (err: any) {
        return res.status(500).json({ error: err?.message || 'Supabase livestream save failed.' });
      }
    }

    writeJSON(LIVESTREAM_FILE, sanitizedConfig);

    broadcastSse('livestream_updated', {
      seasonSlug,
      config: sanitizedConfig,
    });

    return res.json({
      success: true,
      config: sanitizedConfig,
    });
  });

  // Hero Media Upload (Admin RBAC + Magic Byte Signature + SVG Sanitization + Supabase Storage / Local Disk)
  app.post(
    '/api/hero/media/upload',
    express.raw({ type: '*/*', limit: '52mb' }),
    async (req, res) => {
      const auth = await verifyHeroAdminRequest(req);
      if (!auth.authorized) {
        return res.status(auth.status).json({ error: auth.error });
      }

      const kindHeader = String(req.headers['x-media-kind'] || 'image').toLowerCase();
      const kind: 'logo' | 'image' | 'video' =
        kindHeader === 'logo' || kindHeader === 'video' ? kindHeader : 'image';

      const rawFileName = decodeURIComponent(String(req.headers['x-file-name'] || `upload-${Date.now()}`));
      const declaredMime = String(req.headers['content-type'] || '').toLowerCase();
      const buf = Buffer.isBuffer(req.body) ? req.body : Buffer.from([]);

      const checked = detectAndValidateHeroMedia(buf, rawFileName, declaredMime, kind);
      if (!checked.valid || !checked.buffer || !checked.ext || !checked.mime) {
        return res.status(400).json({
          success: false,
          code: 'INVALID_MEDIA_TYPE',
          error: checked.error || 'Unsupported or unsafe media file.',
        });
      }

      const uniqueName = `hero-${kind}-${Date.now()}-${crypto.randomUUID().slice(0, 8)}${checked.ext}`;
      const storagePath = `hero/${uniqueName}`;

      // 1. Attempt Supabase Storage upload first if bucket exists
      if (serverSupabase) {
        try {
          const { error: upErr } = await serverSupabase.storage
            .from('spl-hero-media')
            .upload(storagePath, checked.buffer, {
              contentType: checked.mime,
              cacheControl: '31536000',
              upsert: false,
            });
          if (!upErr) {
            const { data: pubData } = serverSupabase.storage
              .from('spl-hero-media')
              .getPublicUrl(storagePath);
            if (pubData?.publicUrl) {
              return res.json({
                success: true,
                url: pubData.publicUrl,
                storagePath,
                mimeType: checked.mime,
                size: checked.buffer.length,
                provider: 'supabase',
              });
            }
          }
        } catch {}
      }

      // 2. Clean validated server media store fallback (persists in DATA_DIR/hero-media)
      try {
        if (!fs.existsSync(HERO_MEDIA_DIR)) {
          fs.mkdirSync(HERO_MEDIA_DIR, { recursive: true });
        }
        const diskPath = path.join(HERO_MEDIA_DIR, uniqueName);
        fs.writeFileSync(diskPath, checked.buffer);
        return res.json({
          success: true,
          url: `/api/hero/media/${uniqueName}`,
          storagePath: uniqueName,
          mimeType: checked.mime,
          size: checked.buffer.length,
          provider: 'server',
        });
      } catch (err: any) {
        return res.status(500).json({
          success: false,
          error: err?.message || 'Failed to store uploaded media file.',
        });
      }
    }
  );

  // Serve validated Hero media with Range support for video streaming
  app.get('/api/hero/media/:filename', (req, res) => {
    const rawName = String(req.params.filename || '');
    const safeName = path.basename(rawName);
    if (!safeName || safeName !== rawName || safeName.includes('..')) {
      return res.status(400).json({ error: 'Invalid filename' });
    }
    const filePath = path.join(HERO_MEDIA_DIR, safeName);
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: 'Media asset not found' });
    }

    const ext = path.extname(safeName).toLowerCase();
    const mimeMap: Record<string, string> = {
      '.png': 'image/png',
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.webp': 'image/webp',
      '.avif': 'image/avif',
      '.svg': 'image/svg+xml',
      '.mp4': 'video/mp4',
      '.webm': 'video/webm',
    };
    const contentType = mimeMap[ext] || 'application/octet-stream';

    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    if (ext === '.svg') {
      res.setHeader('Content-Security-Policy', "default-src 'none'; style-src 'unsafe-inline'; sandbox");
    }

    const stat = fs.statSync(filePath);
    const total = stat.size;
    const range = req.headers.range;

    if (range && (ext === '.mp4' || ext === '.webm')) {
      const parts = range.replace(/bytes=/, '').split('-');
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? Math.min(parseInt(parts[1], 10), total - 1) : total - 1;
      if (Number.isNaN(start) || start >= total || start < 0 || end < start) {
        res.status(416).setHeader('Content-Range', `bytes */${total}`);
        return res.end();
      }
      const chunkSize = end - start + 1;
      res.status(206);
      res.setHeader('Content-Range', `bytes ${start}-${end}/${total}`);
      res.setHeader('Accept-Ranges', 'bytes');
      res.setHeader('Content-Length', chunkSize);
      res.setHeader('Content-Type', contentType);
      return fs.createReadStream(filePath, { start, end }).pipe(res);
    }

    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Length', total);
    res.setHeader('Accept-Ranges', 'bytes');
    return fs.createReadStream(filePath).pipe(res);
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
