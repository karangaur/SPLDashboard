export interface AdminUser {
  id: string;
  username: string;
  email: string;
  name: string;
  role: 'super_admin' | 'tournament_director' | 'scorer';
  avatar?: string;
  lastLogin?: number;
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
};

// Initial default passwords accepted
const ACCEPTED_PASSWORDS = ['smash2026', 'admin123', 'spladmin2026'];

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
   * Get current logged in admin user
   */
  static getCurrentUser(): AdminUser | null {
    const session = this.getSession();
    return session ? session.user : null;
  }

  /**
   * Attempt admin sign in
   */
  static async login(
    identifier: string,
    password: string,
    rememberMe = true
  ): Promise<{ success: boolean; user?: AdminUser; error?: string }> {
    const cleanId = identifier.trim().toLowerCase();
    const cleanPass = password.trim();

    if (!cleanId) {
      return { success: false, error: 'Please enter your admin username or email address.' };
    }
    if (!cleanPass) {
      return { success: false, error: 'Please enter your password.' };
    }

    // First attempt server-side authentication
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identifier: cleanId, password: cleanPass, rememberMe }),
      });

      const contentType = res.headers.get('content-type') || '';
      if (contentType.includes('application/json')) {
        const data = await res.json();
        if (res.ok && data.success && data.user) {
          const session: AdminSession = {
            token: data.token || `spl_tk_${crypto.randomUUID().replace(/-/g, '')}`,
            user: data.user,
            expiresAt: rememberMe ? Date.now() + 30 * 24 * 60 * 60 * 1000 : Date.now() + 8 * 60 * 60 * 1000,
            rememberMe,
          };
          this.saveSession(session, rememberMe);
          return { success: true, user: data.user };
        } else if (res.status === 401 || data.error) {
          return { success: false, error: data.error || 'Invalid credentials. Please verify your password.' };
        }
      }
    } catch {
      // Backend route unreachable or network error, proceed to resilient client auth verification
    }

    // Resilient fallback authentication for static Vercel deployments & offline use
    const isIdValid =
      cleanId === 'admin' ||
      cleanId === 'admin@spl.com' ||
      cleanId === 'organizer' ||
      cleanId === 'director' ||
      cleanId === 'tournament@spl.com';

    // Check custom local vault if organizer changed password locally
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
      error: 'Invalid username or password. Check that Caps Lock is off or use the organizer credentials helper.',
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
  static logout() {
    try {
      fetch('/api/auth/logout', { method: 'POST' }).catch(() => {});
    } catch {}
    localStorage.removeItem(SESSION_STORAGE_KEY);
    sessionStorage.removeItem(SESSION_STORAGE_KEY);
  }
}
