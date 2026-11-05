import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { Database } from '../types/database.types';

// Read client environment variables
const envUrl = (import.meta as any).env?.VITE_SUPABASE_URL || '';
const envKey = (import.meta as any).env?.VITE_SUPABASE_ANON_KEY || '';

// Check if credentials are genuine (not placeholder)
export const isSupabaseConfigured = (): boolean => {
  return Boolean(
    envUrl &&
    envKey &&
    !envUrl.includes('your-project') &&
    !envKey.includes('your-anon-key') &&
    envUrl.startsWith('https://')
  );
};

export const getSupabaseConfig = () => ({
  url: envUrl,
  hasKey: Boolean(envKey && !envKey.includes('your-anon-key')),
  isConfigured: isSupabaseConfigured(),
});

// Create client or fallback dummy instance
export const supabase: SupabaseClient<Database> = isSupabaseConfigured()
  ? createClient<Database>(envUrl, envKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
      realtime: {
        params: {
          eventsPerSecond: 10,
        },
      },
    })
  : (createClient<Database>(
      'https://placeholder-spl.supabase.co',
      'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.e30.placeholder',
      {
        auth: { persistSession: false },
      }
    ) as unknown as SupabaseClient<Database>);

export interface SupabaseTestResult {
  configured: boolean;
  connected: boolean;
  message: string;
  hint?: string;
  tablesFound?: string[];
}

/**
 * Test connectivity to Supabase backend
 */
export async function testSupabaseConnection(): Promise<SupabaseTestResult> {
  if (isSupabaseConfigured()) {
    try {
      const { data, error } = await supabase.from('registration_form_config').select('id, season_slug').limit(1);
      if (error) {
        // Table might not exist yet if schema was not run
        if (
          error.code === '42P01' ||
          error.message?.includes('not find the table') ||
          error.message?.includes('schema cache')
        ) {
          return {
            configured: true,
            connected: true,
            message: 'Connected to Supabase PostgreSQL, but tables need to be created.',
            hint: 'Execute supabase/schema.sql in the Supabase SQL Editor to initialize all 11 relational tables.',
          };
        }
        return {
          configured: true,
          connected: false,
          message: `Connected to Supabase endpoint, but query failed: ${error.message}`,
        };
      }
      return {
        configured: true,
        connected: true,
        message: 'Successfully connected to centralized Supabase PostgreSQL database.',
        tablesFound: ['registration_form_config'],
      };
    } catch (err: any) {
      return {
        configured: true,
        connected: false,
        message: `Failed to connect to Supabase: ${err?.message || 'Network error'}`,
      };
    }
  }

  // If client-side VITE_* vars are pending, check if server backend is configured with Supabase
  try {
    const res = await fetch('/api/database/status');
    if (res.ok) {
      const info = await res.json();
      if (info.supabaseStatus?.configured) {
        return {
          configured: true,
          connected: Boolean(info.supabaseStatus.connected),
          message: info.supabaseStatus.message || info.message,
          hint: info.supabaseStatus.hint,
        };
      }
    }
  } catch {}

  return {
    configured: false,
    connected: false,
    message: 'Supabase credentials (VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY) are not yet configured in environment variables.',
    hint: 'Add your Supabase project URL and anon public key to your .env file and run supabase/schema.sql in the Supabase SQL Editor.',
  };
}
