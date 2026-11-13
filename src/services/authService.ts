import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { SecurityService } from './securityService';

export interface AdminUser {
  id: string;
  username: string;
  email: string;
  name: string;
  role: 'super_admin' | 'tournament_director' | 'scorer';
  avatar?: string;
  lastLogin?: number;
  authSource?: 'supabase' | 'internal';
}

export interface AdminSession {
  token: string;
  user: AdminUser;
  expiresAt: number;
  rememberMe: boolean;
}

const SESSION_STORAGE_KEY = 'spl_admin_session';
const ACCOUNTS_STORAGE_KEY = 'spl_admin_credentials_vault';

// Default master admin credentials for tournament organizers
const DEFAULT_ADMIN_USER: AdminUser = {
  id: 'admin-spl-master-01',
  username: 'admin',
  email: 'admin@spl.com',
  name: 'Tournament Director',
  role: 'super_admin',
  authSource: 'internal',
};

// Initial default passwords accepted for master admin fallback
const ACCEPTED_PASSWORDS = ['smash2026', 'admin123', 'spladmin2026', 'Spl@2026!'];

export class AuthService {
  /**
   * Get current stored admin session
   */
  static getSession(): AdminSession | null {
    try {
      const raw = localStorage.getItem(SESSION_STORAGE_KEY) || sessionStorage.getItem(SESSION_STORAGE_KEY);
      if (!raw) return null;
      const session: AdminSession = JSON.parse(raw);
      if (session.expiresAt && Date.now() > session.expiresAt) {
        this.logout();
        return null;
      }
      return session;
    } catch {
      return null;
    }
  }

  /**
   * Check if current user is logged in as an administrator
   */
  static isAuthenticated(): boolean {
    const session = this.getSession();
    return Boolean(session && session.token && session.user);
  }

  /**
   * Get Authorization header for API requests
   */
  static getAuthHeader(): Record<string, string> {
    const session = this.getSession();
    if (session?.token) {
      return {
        Authorization: `Bearer ${session.token}`,
        ...(session.user?.id ? { 'X-SPL-Admin-Id': session.user.id } : {}),
      };
    }
    return {};
  }

  /**
   * Get current logged in admin user
   */
  static getCurrentUser(): AdminUser | null {
    const session = this.getSession();
    return session ? session.user : null;
  }

  static getUser(): AdminUser | null {
    return this.getCurrentUser();
  }

  /**
   * Check if user has super admin permission
   */
  static isSuperAdmin(): boolean {
    const user = this.getCurrentUser();
    return user?.role === 'super_admin';
  }

  /**
   * Check if user has score operator permission
   */
  static isScoreOperator(): boolean {
    const user = this.getCurrentUser();
    return user?.role === 'scorer';
  }

  /**
   * Check if user has organizer/director permission
   */
  static canManageTournament(): boolean {
    const user = this.getCurrentUser();
    return user?.role === 'super_admin' || user?.role === 'tournament_director';
  }

  /**
   * Attempt sign in via Supabase admin_users + Supabase Auth with salted SHA-256 verification
   */
  static async login(
    identifier: string,
    password: string,
    rememberMe = true
  ): Promise<{ success: boolean; user?: AdminUser; error?: string }> {
    const cleanId = identifier.trim().toLowerCase();
    const cleanPass = password.trim();

    if (!cleanId) {
      return { success: false, error: 'Please enter your username or email address.' };
    }
    if (!cleanPass) {
      return { success: false, error: 'Please enter your password.' };
    }

    // 1. Primary Source of Truth: Supabase PostgreSQL admin_users table
    if (isSupabaseConfigured()) {
      try {
        const { data: dbUser } = await supabase
          .from('admin_users')
          .select('*')
          .or(`email.eq.${cleanId},username.eq.${cleanId}`)
          .maybeSingle();

        const adminRow = dbUser as any;

        if (adminRow) {
          // Verify account status
          if (!adminRow.is_active) {
            return {
              success: false,
              error: 'This account has been deactivated by the tournament administrator.',
            };
          }

          const meta = SecurityService.parseUserMetadata(adminRow.avatar_url);
          let passwordVerified = false;
          let accessToken = `spl_sb_${crypto.randomUUID().replace(/-/g, '')}`;

          // 1a. Verify against stored salted SHA-256 password hash in Supabase admin_users
          if (meta.passwordHash && meta.passwordSalt) {
            passwordVerified = await SecurityService.verifyPassword(
              cleanPass,
              meta.passwordSalt,
              meta.passwordHash
            );
          }

          // 1b. If not yet verified, also check Supabase Auth signInWithPassword
          if (!passwordVerified && adminRow.email) {
            try {
              const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
                email: adminRow.email,
                password: cleanPass,
              });
              if (!authError && authData.user && authData.session) {
                passwordVerified = true;
                accessToken = authData.session.access_token;
              }
            } catch {}
          }

          // 1c. Master Super Admin default password check
          if (
            !passwordVerified &&
            adminRow.role === 'super_admin' &&
            ACCEPTED_PASSWORDS.includes(cleanPass)
          ) {
            passwordVerified = true;
          }

          // 1d. Legacy migration: if an existing admin_users row was created before passwordHash
          // was stored in metadata (i.e. !meta.passwordHash), accept their password on first login
          // and immediately persist its salted SHA-256 hash in Supabase!
          if (!passwordVerified && !meta.passwordHash && cleanPass.length >= 4) {
            passwordVerified = true;
            try {
              const newSalt = SecurityService.generateSalt();
              const newHash = await SecurityService.hashPassword(cleanPass, newSalt);
              const updatedMeta = {
                ...meta,
                passwordSalt: newSalt,
                passwordHash: newHash,
                updatedAt: Date.now(),
              };
              await (supabase.from('admin_users') as any)
                .update({
                  avatar_url: SecurityService.serializeUserMetadata(updatedMeta),
                  updated_at: new Date().toISOString(),
                })
                .eq('id', adminRow.id);
            } catch {}
          }

          if (!passwordVerified) {
            return {
              success: false,
              error: 'Invalid password for this account. Please check your password or reset it.',
            };
          }

          const resolvedRole: 'super_admin' | 'tournament_director' | 'scorer' =
            adminRow.role === 'super_admin'
              ? 'super_admin'
              : adminRow.role === 'tournament_director'
                ? 'tournament_director'
                : 'scorer';

          const adminUser: AdminUser = {
            id: adminRow.id,
            username: adminRow.username || cleanId.split('@')[0],
            email: adminRow.email,
            name: adminRow.name || 'Tournament Official',
            role: resolvedRole,
            avatar: meta.avatar || undefined,
            lastLogin: Date.now(),
            authSource: 'supabase',
          };

          const session: AdminSession = {
            token: accessToken,
            user: adminUser,
            expiresAt: rememberMe ? Date.now() + 30 * 24 * 60 * 60 * 1000 : Date.now() + 8 * 60 * 60 * 1000,
            rememberMe,
          };

          this.saveSession(session, rememberMe);

          // Update last_login timestamp in Supabase admin_users
          (supabase.from('admin_users') as any)
            .update({ last_login: new Date().toISOString() })
            .eq('id', adminRow.id)
            .then(() => {});

          return { success: true, user: adminUser };
        }
      } catch (e) {
        console.warn('Supabase admin_users lookup warning:', e);
      }
    }

    // 2. Express server-side authentication fallback
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identifier: cleanId, password: cleanPass, rememberMe }),
      });

      const rawText = await res.text().catch(() => '');
      let data: any = null;
      try {
        if (rawText && rawText.trim()) data = JSON.parse(rawText);
      } catch {}

      if (data && res.ok && data.success && data.user) {
        const session: AdminSession = {
          token: data.token || `spl_tk_${crypto.randomUUID().replace(/-/g, '')}`,
          user: { ...data.user, authSource: 'internal' },
          expiresAt: rememberMe ? Date.now() + 30 * 24 * 60 * 60 * 1000 : Date.now() + 8 * 60 * 60 * 1000,
          rememberMe,
        };
        this.saveSession(session, rememberMe);
        return { success: true, user: session.user };
      }
    } catch {
      // Backend route unreachable or network error, proceed to client fallback
    }

    // 3. Resilient fallback authentication for offline / organizer use
    const isIdValid =
      cleanId === 'admin' ||
      cleanId === 'admin@spl.com' ||
      cleanId === 'organizer' ||
      cleanId === 'director' ||
      cleanId === 'tournament@spl.com';

    let vaultPasswords = [...ACCEPTED_PASSWORDS];
    try {
      const savedVault = localStorage.getItem(ACCOUNTS_STORAGE_KEY);
      if (savedVault) {
        const parsed = JSON.parse(savedVault);
        if (Array.isArray(parsed.passwords)) {
          vaultPasswords = [...vaultPasswords, ...parsed.passwords];
        }
      }
    } catch {}

    const isPassValid = vaultPasswords.includes(cleanPass);

    if (isIdValid && isPassValid) {
      const user: AdminUser = {
        ...DEFAULT_ADMIN_USER,
        lastLogin: Date.now(),
        authSource: 'internal',
      };
      const session: AdminSession = {
        token: `spl_sess_${crypto.randomUUID().replace(/-/g, '')}`,
        user,
        expiresAt: rememberMe ? Date.now() + 30 * 24 * 60 * 60 * 1000 : Date.now() + 8 * 60 * 60 * 1000,
        rememberMe,
      };
      this.saveSession(session, rememberMe);
      return { success: true, user };
    }

    return {
      success: false,
      error: 'Invalid username or password. Please verify your credentials or contact the Super Admin.',
    };
  }

  /**
   * Save session to storage
   */
  private static saveSession(session: AdminSession, rememberMe: boolean) {
    const raw = JSON.stringify(session);
    if (rememberMe) {
      localStorage.setItem(SESSION_STORAGE_KEY, raw);
      sessionStorage.removeItem(SESSION_STORAGE_KEY);
    } else {
      sessionStorage.setItem(SESSION_STORAGE_KEY, raw);
      localStorage.removeItem(SESSION_STORAGE_KEY);
    }
  }

  /**
   * Log out current admin
   */
  static async logout(): Promise<void> {
    try {
      if (isSupabaseConfigured()) {
        await supabase.auth.signOut().catch(() => {});
      }
    } catch {}

    try {
      fetch('/api/auth/logout', { method: 'POST' }).catch(() => {});
    } catch {}

    localStorage.removeItem(SESSION_STORAGE_KEY);
    sessionStorage.removeItem(SESSION_STORAGE_KEY);
  }
}
