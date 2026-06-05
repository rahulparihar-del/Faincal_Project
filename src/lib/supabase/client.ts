import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
// Supports the new publishable key (sb_publishable_...) as well as the legacy
// anon key — whichever is set in the environment.
const supabaseAnonKey =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

/**
 * Whether the Supabase environment variables are present. When false, the app
 * gracefully falls back to localStorage so it keeps working before setup.
 */
export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);

/**
 * Browser Supabase client. `null` until the env vars are configured.
 * All data lives in simple `{ id, data, created_at }` tables (see
 * `supabase/schema.sql`), so the client is only used for CRUD on those.
 */
export const supabase: SupabaseClient | null = isSupabaseConfigured
  ? createClient(supabaseUrl as string, supabaseAnonKey as string, {
      auth: { persistSession: false },
    })
  : null;
