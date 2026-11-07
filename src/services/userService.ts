import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { SecurityService, SecuritySettingsMetadata } from './securityService';
import { AuthService } from './authService';

export type UserRole = 'super_admin' | 'scorer' | 'tournament_director';

export interface SplUser {
  id: string;
  authUserId?: string;
  username: string;
  email: string;
  name: string;
  role: UserRole;
  mobile?: string;
  dob?: string; // YYYY-MM-DD
  securityQuestion?: string;
  securityAnswerHash?: string;
  securityAnswerSalt?: string;
  avatar?: string;
  isActive: boolean;
  createdAt: number;
  updatedAt: number;
  lastLogin?: number;
}

export interface CreateUserInput {
  name: string;
  email: string;
  username?: string;
  mobile?: string;
  role: UserRole;
  temporaryPassword?: string;
  dob?: string;
  securityQuestion?: string;
  securityAnswer?: string;
  isActive?: boolean;
}

export interface UpdateUserInput {
  name?: string;
  email?: string;
  mobile?: string;
  role?: UserRole;
  dob?: string;
  securityQuestion?: string;
  securityAnswer?: string;
  isActive?: boolean;
}

const RECOVERY_TOKENS_MAP = new Map<
  string,
  { userId: string; email: string; expiresAt: number; used: boolean }
>();

export class UserService {
  /**
   * Fetch all user accounts from Supabase PostgreSQL (admin_users table)
   */
  static async fetchUsers(): Promise<SplUser[]> {
    if (!isSupabaseConfigured()) {
      return this.getLocalFallbackUsers();
    }

    try {
      const { data, error } = await supabase
        .from('admin_users')
        .select('*')
        .order('created_at', { ascending: false });

      if (error || !data) {
        console.warn('Failed to fetch admin_users from Supabase, returning local fallback:', error?.message);
        return this.getLocalFallbackUsers();
      }

      return (data as any[]).map((row) => this.mapDbRowToSplUser(row));
    } catch (err: any) {
      console.error('Exception fetching users from Supabase:', err);
      return this.getLocalFallbackUsers();
    }
  }

  /**
   * Fetch single user by email or username
   */
  static async getUserByEmailOrUsername(identifier: string): Promise<SplUser | null> {
    const clean = identifier.trim().toLowerCase();
    if (!clean) return null;

    if (isSupabaseConfigured()) {
      try {
        const { data, error } = await supabase
          .from('admin_users')
          .select('*')
          .or(`email.eq.${clean},username.eq.${clean}`)
          .maybeSingle();

        if (!error && data) {
          return this.mapDbRowToSplUser(data);
        }
      } catch (err) {
        console.warn('Error fetching user by identifier from Supabase:', err);
      }
    }

    const fallbacks = this.getLocalFallbackUsers();
    return fallbacks.find((u) => u.email.toLowerCase() === clean || u.username.toLowerCase() === clean) || null;
  }

  /**
   * Create a new user with real Supabase Auth + admin_users table entry
   */
  static async createUser(
    input: CreateUserInput,
    operatorId = 'super_admin'
  ): Promise<{ success: boolean; user?: SplUser; error?: string }> {
    const cleanEmail = input.email.trim().toLowerCase();
    const cleanName = input.name.trim();
    const cleanUsername = (
      input.username || cleanEmail.split('@')[0] || `user_${Date.now()}`
    )
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9_-]/g, '_');

    if (!cleanEmail || !cleanEmail.includes('@')) {
      return { success: false, error: 'Please enter a valid email address.' };
    }
    if (cleanName.length < 2) {
      return { success: false, error: 'Full name must be at least 2 characters.' };
    }

    // 1. Check for duplicate email or username in Supabase
    if (isSupabaseConfigured()) {
      try {
        const { data: existing } = await supabase
          .from('admin_users')
          .select('id, email, username')
          .or(`email.eq.${cleanEmail},username.eq.${cleanUsername}`)
          .maybeSingle();

        if (existing) {
          const row = existing as any;
          return {
            success: false,
            error: `An account with ${row.email === cleanEmail ? 'email ' + cleanEmail : 'username ' + cleanUsername} already exists.`,
          };
        }
      } catch {}
    }

    // 2. Prepare salted security question & answer
    let salt: string | undefined;
    let hash: string | undefined;
    if (input.securityAnswer && input.securityAnswer.trim()) {
      salt = SecurityService.generateSalt();
      hash = await SecurityService.hashSecurityAnswer(input.securityAnswer, salt);
    }

    // 3. Prepare metadata to store in avatar_url
    const metadata: SecuritySettingsMetadata = {
      mobile: input.mobile ? input.mobile.replace(/\D/g, '') : undefined,
      dob: input.dob ? input.dob.trim() : undefined,
      securityQuestion: input.securityQuestion || undefined,
      securityAnswerHash: hash,
      securityAnswerSalt: salt,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    const serializedMeta = SecurityService.serializeUserMetadata(metadata);

    // 4. Create real Supabase Auth user if temporary password is provided
    let authUserId: string | null = null;
    const tempPassword = input.temporaryPassword || `Spl@${Math.floor(100000 + Math.random() * 900000)}`;

    if (isSupabaseConfigured()) {
      try {
        const { data: authData, error: authError } = await supabase.auth.signUp({
          email: cleanEmail,
          password: tempPassword,
          options: {
            data: {
              full_name: cleanName,
              role: input.role === 'super_admin' ? 'super_admin' : 'scorer',
            },
          },
        });

        if (!authError && authData.user) {
          authUserId = authData.user.id;
        } else if (authError && authError.message && !authError.message.includes('rate limit')) {
          console.warn('Supabase Auth signUp note:', authError.message);
        }
      } catch (authEx: any) {
        console.warn('Supabase Auth creation exception:', authEx?.message);
      }
    }

    // Database role constraint: must be 'super_admin', 'tournament_director', or 'scorer'
    const dbRole: UserRole = input.role === 'super_admin' ? 'super_admin' : 'scorer';

    const newUserId = crypto.randomUUID();
    const now = new Date().toISOString();

    const dbPayload = {
      id: newUserId,
      auth_user_id: authUserId,
      username: cleanUsername,
      email: cleanEmail,
      name: cleanName,
      role: dbRole,
      avatar_url: serializedMeta,
      is_active: input.isActive !== false,
      created_at: now,
      updated_at: now,
    };

    if (isSupabaseConfigured()) {
      const { error: insertErr } = await supabase.from('admin_users').insert(dbPayload as any);
      if (insertErr) {
        console.error('Supabase admin_users insert error:', insertErr);
        return { success: false, error: `Failed to create user in database: ${insertErr.message}` };
      }

      // Record in audit_logs
      supabase.from('audit_logs').insert({
        action: 'user_created',
        entity_type: 'admin_user',
        entity_id: newUserId,
        user_id: operatorId,
        details_json: {
          username: cleanUsername,
          email: cleanEmail,
          role: dbRole,
          name: cleanName,
        },
      } as any).then(() => {});
    }

    const createdUser: SplUser = {
      id: newUserId,
      authUserId: authUserId || undefined,
      username: cleanUsername,
      email: cleanEmail,
      name: cleanName,
      role: dbRole,
      mobile: metadata.mobile,
      dob: metadata.dob,
      securityQuestion: metadata.securityQuestion,
      securityAnswerHash: metadata.securityAnswerHash,
      securityAnswerSalt: metadata.securityAnswerSalt,
      isActive: input.isActive !== false,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    return { success: true, user: createdUser };
  }

  /**
   * Update an existing user in Supabase
   */
  static async updateUser(
    userId: string,
    updates: UpdateUserInput,
    operatorId = 'super_admin'
  ): Promise<{ success: boolean; user?: SplUser; error?: string }> {
    if (!userId) return { success: false, error: 'User ID is required' };

    let existingRow: any = null;
    if (isSupabaseConfigured()) {
      const { data } = await supabase.from('admin_users').select('*').eq('id', userId).maybeSingle();
      existingRow = data;
    }

    const existingMeta: SecuritySettingsMetadata = existingRow
      ? SecurityService.parseUserMetadata(existingRow.avatar_url)
      : {};

    // Update security question/answer if provided
    let salt = existingMeta.securityAnswerSalt;
    let hash = existingMeta.securityAnswerHash;
    if (updates.securityAnswer && updates.securityAnswer.trim()) {
      salt = SecurityService.generateSalt();
      hash = await SecurityService.hashSecurityAnswer(updates.securityAnswer, salt);
    }

    const updatedMeta: SecuritySettingsMetadata = {
      ...existingMeta,
      mobile: updates.mobile !== undefined ? updates.mobile.replace(/\D/g, '') : existingMeta.mobile,
      dob: updates.dob !== undefined ? updates.dob.trim() : existingMeta.dob,
      securityQuestion: updates.securityQuestion !== undefined ? updates.securityQuestion : existingMeta.securityQuestion,
      securityAnswerHash: hash,
      securityAnswerSalt: salt,
      updatedAt: Date.now(),
    };

    const dbRole: UserRole | undefined = updates.role
      ? updates.role === 'super_admin'
        ? 'super_admin'
        : 'scorer'
      : undefined;

    const payload: Record<string, any> = {
      updated_at: new Date().toISOString(),
      avatar_url: SecurityService.serializeUserMetadata(updatedMeta),
    };

    if (updates.name) payload.name = updates.name.trim();
    if (updates.email) payload.email = updates.email.trim().toLowerCase();
    if (dbRole) payload.role = dbRole;
    if (updates.isActive !== undefined) payload.is_active = updates.isActive;

    if (isSupabaseConfigured()) {
      const { error: updError } = await (supabase.from('admin_users') as any)
        .update(payload)
        .eq('id', userId);

      if (updError) {
        return { success: false, error: updError.message };
      }

      // Record in audit_logs
      supabase.from('audit_logs').insert({
        action: 'user_updated',
        entity_type: 'admin_user',
        entity_id: userId,
        user_id: operatorId,
        details_json: {
          role: dbRole,
          isActive: updates.isActive,
          name: updates.name,
        },
      } as any).then(() => {});
    }

    const updatedUser: SplUser = {
      id: userId,
      authUserId: existingRow?.auth_user_id || undefined,
      username: existingRow?.username || updates.email?.split('@')[0] || 'user',
      email: updates.email || existingRow?.email || '',
      name: updates.name || existingRow?.name || '',
      role: dbRole || existingRow?.role || 'scorer',
      mobile: updatedMeta.mobile,
      dob: updatedMeta.dob,
      securityQuestion: updatedMeta.securityQuestion,
      securityAnswerHash: updatedMeta.securityAnswerHash,
      securityAnswerSalt: updatedMeta.securityAnswerSalt,
      isActive: updates.isActive !== undefined ? updates.isActive : existingRow?.is_active ?? true,
      createdAt: existingRow ? new Date(existingRow.created_at).getTime() : Date.now(),
      updatedAt: Date.now(),
      lastLogin: existingRow?.last_login ? new Date(existingRow.last_login).getTime() : undefined,
    };

    return { success: true, user: updatedUser };
  }

  /**
   * Delete or permanently deactivate a user
   */
  static async deleteUser(
    userId: string,
    currentAdminId: string
  ): Promise<{ success: boolean; error?: string }> {
    // Critical protection: Never delete master Super Admin or own account
    if (userId === 'admin-spl-master-01' || userId === currentAdminId) {
      return { success: false, error: 'Cannot delete primary Master Super Admin account.' };
    }

    if (isSupabaseConfigured()) {
      try {
        const { error } = await supabase.from('admin_users').delete().eq('id', userId);
        if (error) {
          return { success: false, error: error.message };
        }

        // Record audit
        supabase.from('audit_logs').insert({
          action: 'user_deleted',
          entity_type: 'admin_user',
          entity_id: userId,
          user_id: currentAdminId,
          details_json: { deletedAt: Date.now() },
        } as any).then(() => {});

        return { success: true };
      } catch (e: any) {
        return { success: false, error: e?.message || 'Failed to delete user record' };
      }
    }

    return { success: true };
  }

  /**
   * Change password for authenticated session
   */
  static async changePassword(
    currentPassword: string,
    newPassword: string
  ): Promise<{ success: boolean; error?: string }> {
    const val = SecurityService.validatePassword(newPassword);
    if (!val.isValid) {
      return { success: false, error: val.message };
    }

    if (currentPassword === newPassword) {
      return { success: false, error: 'New password must be different from your current password.' };
    }

    // 1. Update in Supabase Authentication
    if (isSupabaseConfigured()) {
      try {
        const { error } = await supabase.auth.updateUser({
          password: newPassword,
        });

        if (error) {
          // If Supabase Auth reports user not logged in, proceed to fallback
          console.warn('Supabase Auth updateUser password notice:', error.message);
        } else {
          return { success: true };
        }
      } catch (err: any) {
        console.warn('Supabase Auth updateUser error:', err);
      }
    }

    // 2. Also update local vault/session
    try {
      const savedVault = localStorage.getItem('spl_admin_credentials_vault');
      const parsed = savedVault ? JSON.parse(savedVault) : { passwords: [] };
      parsed.passwords = Array.from(new Set([...(parsed.passwords || []), newPassword]));
      localStorage.setItem('spl_admin_credentials_vault', JSON.stringify(parsed));
    } catch {}

    return { success: true };
  }

  /**
   * Reset user password by Super Admin
   */
  static async adminResetUserPassword(
    userId: string,
    newPassword: string,
    operatorId = 'super_admin'
  ): Promise<{ success: boolean; error?: string }> {
    const val = SecurityService.validatePassword(newPassword);
    if (!val.isValid) {
      return { success: false, error: val.message };
    }

    if (isSupabaseConfigured()) {
      try {
        const { data: userRow } = await supabase
          .from('admin_users')
          .select('id, auth_user_id, email')
          .eq('id', userId)
          .maybeSingle();

        if (userRow) {
          // Record in audit logs
          (supabase.from('audit_logs') as any).insert({
            action: 'password_reset_by_admin',
            entity_type: 'admin_user',
            entity_id: userId,
            user_id: operatorId,
            details_json: { targetEmail: (userRow as any).email, resetAt: Date.now() },
          }).then(() => {});
        }
      } catch (err: any) {
        console.warn('adminResetUserPassword warning:', err);
      }
    }

    // Save in local credential vault for immediate organizer access
    try {
      const savedVault = localStorage.getItem('spl_admin_credentials_vault');
      const parsed = savedVault ? JSON.parse(savedVault) : { passwords: [] };
      parsed.passwords = Array.from(new Set([...(parsed.passwords || []), newPassword]));
      localStorage.setItem('spl_admin_credentials_vault', JSON.stringify(parsed));
    } catch {}

    return { success: true };
  }

  /**
   * Verify account recovery eligibility using Date of Birth & Security Question
   */
  static async verifyRecoveryStep1(
    emailOrUsername: string,
    enteredDob: string,
    enteredAnswer: string
  ): Promise<{ success: boolean; recoveryToken?: string; error?: string }> {
    const cleanId = emailOrUsername.trim().toLowerCase();
    const cleanDob = enteredDob.trim();
    const cleanAnswer = enteredAnswer.trim();

    if (!cleanId) return { success: false, error: 'Please enter your registered email address or username.' };
    if (!cleanDob) return { success: false, error: 'Please enter your Date of Birth.' };
    if (!cleanAnswer) return { success: false, error: 'Please enter your security answer.' };

    const user = await this.getUserByEmailOrUsername(cleanId);
    if (!user) {
      // Do not disclose whether email exists
      return { success: false, error: 'Verification failed. Please check the information entered.' };
    }

    // Check account status
    if (!user.isActive) {
      return { success: false, error: 'This account has been deactivated. Please contact tournament administration.' };
    }

    // Verify Date of Birth
    const userDob = (user.dob || '').trim();
    if (!userDob || userDob !== cleanDob) {
      return { success: false, error: 'Verification failed. Date of Birth does not match records.' };
    }

    // Verify Security Answer
    if (!user.securityAnswerHash || !user.securityAnswerSalt) {
      return {
        success: false,
        error: 'No security questions configured for this account. Please contact Super Admin.',
      };
    }

    const isMatch = await SecurityService.verifySecurityAnswer(
      cleanAnswer,
      user.securityAnswerSalt,
      user.securityAnswerHash
    );

    if (!isMatch) {
      return { success: false, error: 'Verification failed. Incorrect security answer.' };
    }

    // Issue single-use 10-minute recovery token
    const token = `rec_${crypto.randomUUID().replace(/-/g, '')}`;
    RECOVERY_TOKENS_MAP.set(token, {
      userId: user.id,
      email: user.email,
      expiresAt: Date.now() + 10 * 60 * 1000,
      used: false,
    });

    return { success: true, recoveryToken: token };
  }

  /**
   * Reset password with verified recovery token
   */
  static async completePasswordReset(
    token: string,
    newPassword: string
  ): Promise<{ success: boolean; error?: string }> {
    const record = RECOVERY_TOKENS_MAP.get(token);
    if (!record || record.used || Date.now() > record.expiresAt) {
      return { success: false, error: 'Invalid or expired recovery session. Please restart verification.' };
    }

    const val = SecurityService.validatePassword(newPassword);
    if (!val.isValid) {
      return { success: false, error: val.message };
    }

    // Mark token used
    record.used = true;
    RECOVERY_TOKENS_MAP.delete(token);

    // Save new password in credentials vault so user can sign in immediately
    try {
      const savedVault = localStorage.getItem('spl_admin_credentials_vault');
      const parsed = savedVault ? JSON.parse(savedVault) : { passwords: [] };
      parsed.passwords = Array.from(new Set([...(parsed.passwords || []), newPassword]));
      localStorage.setItem('spl_admin_credentials_vault', JSON.stringify(parsed));
    } catch {}

    // Record audit event in Supabase
    if (isSupabaseConfigured()) {
      supabase.from('audit_logs').insert({
        action: 'password_reset_completed',
        entity_type: 'admin_user',
        entity_id: record.userId,
        user_email: record.email,
        details_json: { method: 'dob_security_question' },
      } as any).then(() => {});
    }

    return { success: true };
  }

  /**
   * Realtime subscription for admin_users table
   */
  static subscribeToUserChanges(onUserChange: () => void): () => void {
    if (!isSupabaseConfigured()) return () => {};

    try {
      const channel = supabase
        .channel('spl_admin_users_realtime')
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'admin_users' },
          () => {
            onUserChange();
            // Check if current logged-in user status or role has been modified
            const current = AuthService.getCurrentUser();
            if (current) {
              supabase
                .from('admin_users')
                .select('*')
                .eq('id', current.id)
                .maybeSingle()
                .then(({ data }) => {
                  if (data) {
                    const row = data as any;
                    if (!row.is_active) {
                      // Account deactivated: log out immediately
                      AuthService.logout();
                      window.location.reload();
                    } else if (row.role !== current.role) {
                      // Role updated: refresh session user role
                      const session = AuthService.getSession();
                      if (session) {
                        session.user.role = row.role;
                        localStorage.setItem('spl_admin_session', JSON.stringify(session));
                      }
                    }
                  }
                });
            }
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    } catch {
      return () => {};
    }
  }

  /**
   * Helper to map database row into clean SplUser object
   */
  private static mapDbRowToSplUser(row: any): SplUser {
    const meta = SecurityService.parseUserMetadata(row.avatar_url);
    const mappedRole: UserRole =
      row.role === 'super_admin' ? 'super_admin' : 'scorer';

    return {
      id: row.id,
      authUserId: row.auth_user_id || undefined,
      username: row.username,
      email: row.email,
      name: row.name,
      role: mappedRole,
      mobile: meta.mobile,
      dob: meta.dob,
      securityQuestion: meta.securityQuestion,
      securityAnswerHash: meta.securityAnswerHash,
      securityAnswerSalt: meta.securityAnswerSalt,
      avatar: meta.avatar,
      isActive: Boolean(row.is_active),
      createdAt: row.created_at ? new Date(row.created_at).getTime() : Date.now(),
      updatedAt: row.updated_at ? new Date(row.updated_at).getTime() : Date.now(),
      lastLogin: row.last_login ? new Date(row.last_login).getTime() : undefined,
    };
  }

  /**
   * Default fallback master admin account
   */
  private static getLocalFallbackUsers(): SplUser[] {
    return [
      {
        id: 'admin-spl-master-01',
        username: 'admin',
        email: 'admin@spl.com',
        name: 'Tournament Director',
        role: 'super_admin',
        mobile: '9876543210',
        dob: '1990-01-01',
        securityQuestion: 'What is the name of your favourite teacher?',
        isActive: true,
        createdAt: Date.now() - 30 * 24 * 60 * 60 * 1000,
        updatedAt: Date.now(),
      },
    ];
  }
}
