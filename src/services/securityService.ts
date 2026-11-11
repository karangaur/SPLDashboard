/**
 * Security Service for SPL User Management
 * Handles salted SHA-256 hashing for security questions/answers,
 * password validation, recovery token management, and security question presets.
 */

export const PREDEFINED_SECURITY_QUESTIONS = [
  'What is your childhood nickname?',
  'What was the name of your first school?',
  'What is the name of your favourite teacher?',
  'What city were you born in?',
  'What was the model of your first badminton racket?',
  'What was the name of your childhood street?',
] as const;

export const SECURITY_QUESTIONS = PREDEFINED_SECURITY_QUESTIONS;

export interface SecuritySettingsMetadata {
  mobile?: string;
  dob?: string; // YYYY-MM-DD
  securityQuestion?: string;
  securityAnswerHash?: string;
  securityAnswerSalt?: string;
  passwordHash?: string;
  passwordSalt?: string;
  avatar?: string;
  createdAt?: number;
  updatedAt?: number;
}

export class SecurityService {
  /**
   * Generate a random hex salt (16 bytes = 32 hex chars)
   */
  static generateSalt(): string {
    const array = new Uint8Array(16);
    if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
      crypto.getRandomValues(array);
    } else {
      for (let i = 0; i < 16; i++) {
        array[i] = Math.floor(Math.random() * 256);
      }
    }
    return Array.from(array)
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
  }

  /**
   * Hash a password with a salt using SHA-256 (case-sensitive).
   * Plain-text passwords are never stored in the database.
   */
  static async hashPassword(password: string, salt: string): Promise<string> {
    const clean = password.trim();
    const payload = `pwd:${salt}:${clean}`;

    if (typeof crypto !== 'undefined' && crypto.subtle) {
      const encoder = new TextEncoder();
      const data = encoder.encode(payload);
      const hashBuffer = await crypto.subtle.digest('SHA-256', data);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
    }

    let hash = 0;
    for (let i = 0; i < payload.length; i++) {
      const char = payload.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash |= 0;
    }
    return `fb_pwd_${Math.abs(hash).toString(16)}`;
  }

  /**
   * Verify an entered password against stored salt and SHA-256 hash
   */
  static async verifyPassword(
    enteredPassword: string,
    storedSalt?: string,
    storedHash?: string
  ): Promise<boolean> {
    if (!enteredPassword || !storedSalt || !storedHash) return false;
    const computed = await this.hashPassword(enteredPassword, storedSalt);
    return computed === storedHash;
  }

  /**
   * Hash a security answer with a salt using SHA-256.
   * Normalizes answer to trimmed lowercase to ensure fair user entry.
   */
  static async hashSecurityAnswer(answer: string, salt: string): Promise<string> {
    const normalized = answer.trim().toLowerCase();
    const payload = `${salt}:${normalized}`;
    
    if (typeof crypto !== 'undefined' && crypto.subtle) {
      const encoder = new TextEncoder();
      const data = encoder.encode(payload);
      const hashBuffer = await crypto.subtle.digest('SHA-256', data);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
    }

    // Fallback simple hash calculation if subtle is unavailable in environment
    let hash = 0;
    for (let i = 0; i < payload.length; i++) {
      const char = payload.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash |= 0;
    }
    return `fb_${Math.abs(hash).toString(16)}`;
  }

  /**
   * Verify an entered security answer against stored salt and hash
   */
  static async verifySecurityAnswer(
    enteredAnswer: string,
    storedSalt: string,
    storedHash: string
  ): Promise<boolean> {
    if (!enteredAnswer || !storedSalt || !storedHash) return false;
    const computed = await this.hashSecurityAnswer(enteredAnswer, storedSalt);
    return computed === storedHash;
  }

  /**
   * Validate password strength
   * Requirements: minimum 8 characters, at least 1 uppercase, 1 lowercase, 1 number
   */
  static validatePassword(password: string): { isValid: boolean; message?: string } {
    if (!password || password.length < 8) {
      return { isValid: false, message: 'Password must be at least 8 characters in length.' };
    }
    if (!/[A-Z]/.test(password)) {
      return { isValid: false, message: 'Password must contain at least one uppercase letter (A-Z).' };
    }
    if (!/[a-z]/.test(password)) {
      return { isValid: false, message: 'Password must contain at least one lowercase letter (a-z).' };
    }
    if (!/[0-9]/.test(password)) {
      return { isValid: false, message: 'Password must contain at least one digit (0-9).' };
    }
    return { isValid: true };
  }

  /**
   * Parse user metadata JSON safely from avatar_url column
   */
  static parseUserMetadata(avatarUrlField?: string | null): SecuritySettingsMetadata {
    if (!avatarUrlField) return {};
    try {
      if (avatarUrlField.startsWith('{') && avatarUrlField.endsWith('}')) {
        return JSON.parse(avatarUrlField);
      }
      return { avatar: avatarUrlField };
    } catch {
      return { avatar: avatarUrlField };
    }
  }

  /**
   * Serialize user metadata into avatar_url field string
   */
  static serializeUserMetadata(meta: SecuritySettingsMetadata): string {
    return JSON.stringify(meta);
  }
}
